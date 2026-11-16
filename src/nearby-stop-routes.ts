import { BusFeedError, requestBusJson } from '@/bus-data';
import { etaUrl, parseEta, readEtaTarget, type EtaEntry, type EtaLocale, type EtaSnapshot, type EtaTarget } from '@/bus-eta';
import type { BusSource, RouteName } from '@/bus-routes';
import { routeStopKey, stopVisitKey } from '@/bus-stops';
import type { NearbyBusStop } from '@/nearby-bus-data';

type RouteRecord = [number: string, bound: string, variant: string, zh: string, en: string, terminal: string,
  originZh?: string, originEn?: string];
type StopRouteIndex = {
  capturedAt: number;
  sources: Record<BusSource, { routes: RouteRecord[]; stops: Record<string, [routeIndex: number, sequence: number][]> }>;
};
type SourceIndex = StopRouteIndex['sources'][BusSource];

export type StationRoute = {
  id: string;
  target: EtaTarget;
  destination: RouteName;
  origin?: RouteName;
  destinationStopId?: string;
};

const order = new Intl.Collator('en', { numeric: true });

function routesAtStop(table: SourceIndex, source: BusSource, stopId: string) {
  const visits = Object.hasOwn(table.stops, stopId) ? table.stops[stopId] : [];
  const repeated = new Map<number, number>();
  for (const [route] of visits) repeated.set(route, (repeated.get(route) ?? 0) + 1);

  return visits.flatMap(([route, seq]): { route: StationRoute; index: number }[] => {
    const [number, bound, variant, zh, en, terminal, originZh = '', originEn = ''] = table.routes[route];
    const target = readEtaTarget({
      source, number, stopId, stopSeq: String(seq),
      direction: bound === 'I' ? 'inbound' : bound === 'O' ? 'outbound' : undefined,
      serviceType: source === 'kmbLwb' ? variant : undefined,
      nlbRouteId: source === 'nlb' ? variant : undefined,
      repeatedStop: (repeated.get(route) ?? 0) > 1 ? '1' : '0',
    });
    if (!target) return [];
    return [{ index: route, route: {
      target, id: stopVisitKey(target, { id: stopId, seq }), destination: { zh, en },
      origin: originZh || originEn ? { zh: originZh, en: originEn } : undefined,
      destinationStopId: source === 'citybus' ? terminal : undefined,
    } }];
  });
}

export async function readStationRoutes(source: BusSource, stopId: string) {
  const { default: raw } = await import('../assets/data/nearby-stop-routes.json');
  const index = raw as unknown as StopRouteIndex;
  const routes = routesAtStop(index.sources[source], source, stopId).map(({ route }) => route)
    .sort((a, b) => order.compare(a.target.number, b.target.number)
      || order.compare(a.target.source === 'nlb' ? a.target.routeId : a.target.direction,
        b.target.source === 'nlb' ? b.target.routeId : b.target.direction)
      || order.compare(a.target.source === 'kmbLwb' ? a.target.serviceType : '',
        b.target.source === 'kmbLwb' ? b.target.serviceType : '')
      || a.target.stopSeq - b.target.stopSeq);

  return { routes, capturedAt: index.capturedAt };
}

export type NearbyRoute = { route: StationRoute; stop: NearbyBusStop };

const lastSequences = new WeakMap<SourceIndex, number[]>();

function lastSequenceByRoute(table: SourceIndex) {
  const cached = lastSequences.get(table);
  if (cached) return cached;
  const sequences = table.routes.map(() => 0);
  for (const visits of Object.values(table.stops)) {
    for (const [index, seq] of visits) sequences[index] = Math.max(sequences[index], seq);
  }
  lastSequences.set(table, sequences);
  return sequences;
}

export async function readNearbyRoutes(stops: NearbyBusStop[]) {
  if (!stops.length) return [];
  const { default: raw } = await import('../assets/data/nearby-stop-routes.json');
  const { sources } = raw as unknown as StopRouteIndex;
  const recommendations = new Map<string, NearbyRoute>();
  for (const stop of stops) {
    const table = sources[stop.source];
    const terminals = lastSequenceByRoute(table);
    for (const { route, index } of routesAtStop(table, stop.source, stop.stop_id)) {
      const { target } = route;
      // A loop can visit the same stop ID earlier. Only the final visit has no onward leg.
      if (target.stopSeq >= terminals[index]) continue;
      const key = routeStopKey(target);
      const previous = recommendations.get(key);
      if (!previous || stop.distance < previous.stop.distance
        || (stop.distance === previous.stop.distance && target.stopSeq < previous.route.target.stopSeq)) {
        recommendations.set(key, { route, stop });
      }
    }
  }
  return [...recommendations.values()].sort((a, b) => a.stop.distance - b.stop.distance
    || order.compare(a.route.target.number, b.route.target.number)
    || routeStopKey(a.route.target).localeCompare(routeStopKey(b.route.target)));
}

export function nearbyRouteHref(target: EtaTarget) {
  const routeId = target.source === 'nlb' ? `NLB:${target.routeId}`
    : target.source === 'citybus' ? `CTB:${target.number}`
    : `KMB-LWB:${target.number}:${target.direction === 'outbound' ? 'O' : 'I'}:${target.serviceType}`;
  return { pathname: '/bus/route' as const, params: {
    routeId, stopId: target.stopId, stopSeq: String(target.stopSeq),
    ...(target.source === 'citybus' ? { direction: target.direction } : {}),
  } };
}

export type StationEtaJob = { url: string; source: BusSource; routes: StationRoute[] };
export type StationEtaRecord = { snapshot?: EtaSnapshot; error?: BusFeedError; sharedThrough?: number };

export function stationEtaJobs(routes: StationRoute[], locale: EtaLocale) {
  const jobs = new Map<string, StationEtaJob>();
  for (const route of routes) {
    const { target } = route;
    const url = target.source === 'kmbLwb'
      ? `https://data.etabus.gov.hk/v1/transport/kmb/stop-eta/${encodeURIComponent(target.stopId)}`
      : etaUrl(target, locale);
    const job = jobs.get(url);
    if (job) job.routes.push(route);
    else jobs.set(url, { url, source: target.source, routes: [route] });
  }
  return [...jobs.values()];
}

export function stationEtaError(error: unknown) {
  return error instanceof BusFeedError ? error : new BusFeedError('network');
}

function sharedKmbKey(target: Extract<EtaTarget, { source: 'kmbLwb' }>, entry: EtaEntry) {
  // A matching numbered departure in another service type is shared only at the same route, bound and stop sequence.
  return JSON.stringify([target.number, target.direction, target.stopSeq, entry.etaSequence,
    entry.arrivalAt, entry.destination, entry.remark, entry.generatedAt]);
}

export function parseStationEta(job: StationEtaJob, payload: unknown, receivedAt = Date.now()) {
  const variants = new Map<string, string>();
  return Object.fromEntries(job.routes.map(({ id, target }): [string, StationEtaRecord] => {
    try {
      const snapshot = parseEta(target, payload, receivedAt);
      if (target.source !== 'kmbLwb') return [id, { snapshot }];
      let sharedThrough: number | undefined;
      const entries = snapshot.entries.filter((entry) => {
        if (entry.arrivalAt === undefined || entry.etaSequence === undefined) return true;
        const key = sharedKmbKey(target, entry);
        const owner = variants.get(key);
        if (owner && owner !== target.serviceType) {
          sharedThrough = Math.max(sharedThrough ?? 0, entry.arrivalAt);
          return false;
        }
        variants.set(key, target.serviceType);
        return true;
      });
      return [id, { snapshot: { ...snapshot, entries }, sharedThrough }];
    } catch (error) {
      return [id, { error: stationEtaError(error) }];
    }
  }));
}

export async function fetchStationEta(job: StationEtaJob, signal: AbortSignal) {
  const payload = await requestBusJson(job.source, job.url, signal);
  return parseStationEta(job, payload);
}
