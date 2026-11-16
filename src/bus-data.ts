import { BusCatalogueError, busSources, normalizeBusQuery, parseBusCatalogue, type BusRoute, type BusSource } from '@/bus-routes';
import { getDatabase } from '@/database';

const routeUrls: Record<BusSource, string> = {
  kmbLwb: 'https://data.etabus.gov.hk/v1/transport/kmb/route/',
  citybus: 'https://rt.data.gov.hk/v2/transport/citybus/route/CTB',
  nlb: 'https://rt.data.gov.hk/v2/transport/nlb/route.php?action=list',
};
const maxCacheAge = 24 * 60 * 60 * 1_000;
const requestTimeout = 20_000;
const recentLimit = 8;

export type BusFeed = {
  routes: BusRoute[];
  fetchedAt: number;
  persisted: boolean;
};

export type BusFeeds = Partial<Record<BusSource, BusFeed>>;

type CachedFeed = { source: BusSource; fetched_at: number; payload: string };

export type BusFeedFailure = 'tls' | 'network' | 'timeout' | 'http' | 'json' | BusCatalogueError['kind'];

export class BusFeedError extends Error {
  constructor(readonly kind: BusFeedFailure, readonly status?: number) {
    super(`Bus route load failed: ${kind}`);
  }
}

function logFeed(
  source: BusSource,
  stage: 'request' | 'http' | 'body' | 'json' | 'parse' | 'cache-read' | 'cache-write',
  details: Record<string, string | number | boolean | null>,
) {
  if (__DEV__) console.info('[KongDaily bus]', { source, stage, ...details });
}

function errorType(error: unknown) {
  return error instanceof Error ? error.name : typeof error;
}

export function isBusFeedFresh(feed: BusFeed, now = Date.now()) {
  const age = now - feed.fetchedAt;
  return age >= 0 && age < maxCacheAge;
}

export async function readBusFeeds(): Promise<BusFeeds> {
  let rows: CachedFeed[];
  try {
    const database = await getDatabase();
    rows = await database.getAllAsync<CachedFeed>('SELECT source, fetched_at, payload FROM bus_route_cache');
  } catch (error) {
    for (const source of busSources) logFeed(source, 'cache-read', { outcome: 'error', errorType: errorType(error) });
    return {};
  }
  const feeds: BusFeeds = {};

  for (const source of busSources) {
    const row = rows.find((entry) => entry.source === source);
    if (!row) {
      logFeed(source, 'cache-read', { outcome: 'miss' });
      continue;
    }
    try {
      const feed: BusFeed = {
        routes: parseBusCatalogue(source, JSON.parse(row.payload)),
        fetchedAt: row.fetched_at,
        persisted: true,
      };
      feeds[source] = feed;
      logFeed(source, 'cache-read', { outcome: 'hit', parsedRows: feed.routes.length, fresh: isBusFeedFresh(feed) });
    } catch (error) {
      logFeed(source, 'cache-read', { outcome: 'invalid', errorType: errorType(error) });
    }
  }
  return feeds;
}

const pendingFeeds = new Map<BusSource, Promise<BusFeed>>();
const downloadedFeeds: BusFeeds = {};

export async function findBusRouteFamily(id: string, refreshMissing = false) {
  const source: BusSource | undefined = id.startsWith('CTB:') ? 'citybus'
    : id.startsWith('NLB:') ? 'nlb'
    : id.startsWith('KMB-LWB:') ? 'kmbLwb' : undefined;
  if (!source) return;
  let feed = downloadedFeeds[source] ?? (await readBusFeeds())[source];
  let selected = feed?.routes.find((route) => route.id === id);
  if (!selected && refreshMissing) {
    feed = await refreshBusFeed(source);
    selected = feed.routes.find((route) => route.id === id);
  }
  if (selected && feed) {
    return { selected, routes: feed.routes.filter((route) => route.number === selected.number) };
  }
}

export function refreshBusFeed(source: BusSource) {
  const pending = pendingFeeds.get(source);
  if (pending) return pending;

  const request = downloadBusFeed(source).then((feed) => {
    downloadedFeeds[source] = feed;
    return feed;
  }).finally(() => pendingFeeds.delete(source));
  pendingFeeds.set(source, request);
  return request;
}

export async function requestBusJson(source: BusSource, url: string, signal?: AbortSignal): Promise<unknown> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  else signal?.addEventListener('abort', cancel);
  const timeout = setTimeout(() => controller.abort(), requestTimeout);
  logFeed(source, 'request', { outcome: 'start', url, timeoutMs: requestTimeout });

  let body: string;
  let status: number | undefined;
  try {
    const response = await fetch(url, { signal: controller.signal });
    status = response.status;
    logFeed(source, 'http', { outcome: response.ok ? 'ok' : 'error', status, elapsedMs: Date.now() - startedAt });
    if (!response.ok) throw new BusFeedError('http', status);
    body = await response.text();
  } catch (error) {
    if (signal?.aborted || error instanceof BusFeedError) throw error;
    const stage = status === undefined ? 'request' : 'body';
    const message = error instanceof Error ? error.message : '';
    const tlsFailure = /\b(?:tls|ssl|certificate|secure connection)\b/i.test(message);
    const kind = controller.signal.aborted ? 'timeout' : tlsFailure ? 'tls' : 'network';
    logFeed(source, stage, {
      outcome: kind,
      status: status ?? null,
      errorType: errorType(error),
      elapsedMs: Date.now() - startedAt,
    });
    throw new BusFeedError(kind);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    logFeed(source, 'json', { outcome: 'invalid', status: status ?? null, errorType: errorType(error) });
    throw new BusFeedError('json');
  }
}

async function downloadBusFeed(source: BusSource): Promise<BusFeed> {
  const payload = await requestBusJson(source, routeUrls[source]);
  let routes: BusRoute[];
  try {
    routes = parseBusCatalogue(source, payload);
  } catch (error) {
    const invalid = error instanceof BusCatalogueError ? error : undefined;
    logFeed(source, 'parse', {
      outcome: invalid?.kind ?? 'invalid',
      receivedRows: invalid?.receivedRows ?? null,
      parsedRows: invalid?.parsedRows ?? 0,
    });
    throw new BusFeedError(invalid?.kind ?? 'invalid');
  }

  logFeed(source, 'parse', { outcome: 'ok', parsedRows: routes.length });
  const fetchedAt = Date.now();
  let persisted = false;
  try {
    const database = await getDatabase();
    await database.runAsync(
      `INSERT INTO bus_route_cache (source, fetched_at, payload) VALUES (?, ?, ?)
       ON CONFLICT(source) DO UPDATE SET fetched_at = excluded.fetched_at, payload = excluded.payload`,
      source, fetchedAt, JSON.stringify(payload),
    );
    persisted = true;
    logFeed(source, 'cache-write', { outcome: 'ok', parsedRows: routes.length });
  } catch (error) {
    logFeed(source, 'cache-write', { outcome: 'error', parsedRows: routes.length, errorType: errorType(error) });
  }
  return { routes, fetchedAt, persisted };
}

export type BusHistoryItem = { history_key: string; query: string; route_id: string | null };

export async function readBusHistory() {
  const database = await getDatabase();
  return database.getAllAsync<BusHistoryItem>(
    'SELECT history_key, query, route_id FROM bus_search_history ORDER BY searched_at DESC, rowid DESC LIMIT ?',
    recentLimit,
  );
}

export async function rememberBusSearch(input: string, route?: BusRoute) {
  const query = route?.number ?? input.trim();
  const normalized = normalizeBusQuery(query);
  if (!normalized) return;

  const key = route ? `route:${route.id}` : `query:${normalized}`;
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO bus_search_history (history_key, query, route_id, searched_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(history_key) DO UPDATE SET query = excluded.query, searched_at = excluded.searched_at`,
    key, query, route?.id ?? null, Date.now(),
  );
}

export async function clearBusHistory() {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM bus_search_history');
}
