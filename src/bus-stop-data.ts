import { BusFeedError, requestBusJson } from '@/bus-data';
import type { BusSource } from '@/bus-routes';
import { parseBusStop, parseRouteStops, routeStopKey, type BusStop, type RouteStop, type RouteStopIdentity, type StopNameSource } from '@/bus-stops';
import { getDatabase } from '@/database';

const day = 24 * 60 * 60 * 1_000;
export const routeStopMaxAge = day;
export const stopNameMaxAge = 7 * day;

const kmbBase = 'https://data.etabus.gov.hk/v1/transport/kmb';
const citybusBase = 'https://rt.data.gov.hk/v2/transport/citybus';
const nlbBase = 'https://rt.data.gov.hk/v2/transport/nlb';
const citybusConcurrency = 3;
const citybusCooldown = 30_000;
let citybusActive = 0;
let citybusPausedUntil = 0;
const citybusWaiters: (() => void)[] = [];

type CacheRow = { fetched_at: number; payload: string };
export type CachedRouteStops = { stops: RouteStop[]; fetchedAt: number };
export type CachedBusStop = { stop: BusStop; fetchedAt: number };

export function isStopDataFresh(fetchedAt: number, maxAge: number, now = Date.now()) {
  return fetchedAt <= now && now - fetchedAt < maxAge;
}

async function requestStopData(source: BusSource, url: string) {
  if (source !== 'citybus') return requestBusJson(source, url);

  if (citybusActive >= citybusConcurrency) {
    await new Promise<void>((resolve) => citybusWaiters.push(resolve));
  } else {
    citybusActive += 1;
  }

  try {
    if (Date.now() < citybusPausedUntil) throw new BusFeedError('http', 429);
    return await requestBusJson(source, url);
  } catch (error) {
    if (error instanceof BusFeedError && error.status === 429 && Date.now() >= citybusPausedUntil) {
      citybusPausedUntil = Date.now() + citybusCooldown;
    }
    throw error;
  } finally {
    const next = citybusWaiters.shift();
    if (next) next();
    else citybusActive -= 1;
  }
}

export async function readRouteStops(identity: RouteStopIdentity): Promise<CachedRouteStops | undefined> {
  try {
    const database = await getDatabase();
    const row = await database.getFirstAsync<CacheRow>(
      'SELECT fetched_at, payload FROM bus_route_stop_cache WHERE route_key = ?', routeStopKey(identity),
    );
    if (!row) return;
    const stops = parseRouteStops(identity, JSON.parse(row.payload));
    if (stops.length) return { stops, fetchedAt: row.fetched_at };
  } catch {
    // Invalid or unreadable cache entries are eligible for a fresh request.
  }
}

const pendingSequences = new Map<string, Promise<CachedRouteStops>>();
const pendingStops = new Map<string, Promise<CachedBusStop>>();

export function refreshRouteStops(identity: RouteStopIdentity) {
  const key = routeStopKey(identity);
  const pending = pendingSequences.get(key);
  if (pending) return pending;
  const request = downloadRouteStops(identity, key).finally(() => pendingSequences.delete(key));
  pendingSequences.set(key, request);
  return request;
}

async function downloadRouteStops(identity: RouteStopIdentity, key: string): Promise<CachedRouteStops> {
  const number = encodeURIComponent(identity.number);
  const url = identity.source === 'nlb'
    ? `${nlbBase}/stop.php?action=list&routeId=${encodeURIComponent(identity.routeId)}`
    : identity.source === 'kmbLwb'
      ? `${kmbBase}/route-stop/${number}/${identity.direction}/${encodeURIComponent(identity.serviceType)}`
      : `${citybusBase}/route-stop/CTB/${number}/${identity.direction}`;
  const payload = await requestStopData(identity.source, url);
  let stops: RouteStop[];
  try {
    stops = parseRouteStops(identity, payload);
  } catch {
    throw new BusFeedError('invalid');
  }
  const fetchedAt = Date.now();
  if (stops.length > 0) {
    try {
      const database = await getDatabase();
      await database.runAsync(
        `INSERT INTO bus_route_stop_cache (route_key, fetched_at, payload) VALUES (?, ?, ?)
         ON CONFLICT(route_key) DO UPDATE SET fetched_at = excluded.fetched_at, payload = excluded.payload`,
        key, fetchedAt, JSON.stringify(payload),
      );
    } catch {
      // Live results are useful even if the local cache could not be written.
    }
  }
  return { stops, fetchedAt };
}

export async function readBusStops(source: StopNameSource, ids: string[]) {
  const stops: Record<string, CachedBusStop> = {};
  if (ids.length === 0) return stops;
  try {
    const database = await getDatabase();
    const rows = await database.getAllAsync<CacheRow & { stop_id: string }>(
      `SELECT stop_id, fetched_at, payload FROM bus_stop_cache
       WHERE source = ? AND stop_id IN (${ids.map(() => '?').join(',')})`, source, ...ids,
    );
    for (const row of rows) {
      try {
        stops[row.stop_id] = { stop: parseBusStop(source, row.stop_id, JSON.parse(row.payload)), fetchedAt: row.fetched_at };
      } catch {
        // One damaged station cache entry must not hide the other stations.
      }
    }
  } catch {
    // Continue with the official requests if SQLite is unavailable.
  }
  return stops;
}

export function refreshBusStop(source: StopNameSource, id: string) {
  const key = JSON.stringify([source, id]);
  const pending = pendingStops.get(key);
  if (pending) return pending;
  const request = downloadBusStop(source, id).finally(() => pendingStops.delete(key));
  pendingStops.set(key, request);
  return request;
}

async function downloadBusStop(source: StopNameSource, id: string): Promise<CachedBusStop> {
  const base = source === 'kmbLwb' ? kmbBase : citybusBase;
  const payload = await requestStopData(source, `${base}/stop/${encodeURIComponent(id)}`);
  let stop: BusStop;
  try {
    stop = parseBusStop(source, id, payload);
  } catch {
    throw new BusFeedError('invalid');
  }
  const fetchedAt = Date.now();
  try {
    const database = await getDatabase();
    await database.runAsync(
      `INSERT INTO bus_stop_cache (source, stop_id, fetched_at, payload) VALUES (?, ?, ?, ?)
       ON CONFLICT(source, stop_id) DO UPDATE SET fetched_at = excluded.fetched_at, payload = excluded.payload`,
      source, id, fetchedAt, JSON.stringify(payload),
    );
  } catch {
    // Keep the name available for this visit.
  }
  return { stop, fetchedAt };
}
