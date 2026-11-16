import type { BusDirection, BusRoute, BusSource, RouteName } from '@/bus-routes';

export type TravelDirection = Exclude<BusDirection, 'listed'>;
export type StopNameSource = Exclude<BusSource, 'nlb'>;
export type RouteStopIdentity = { number: string } & (
  { source: 'kmbLwb'; direction: TravelDirection; serviceType: string }
  | { source: 'citybus'; direction: TravelDirection }
  | { source: 'nlb'; routeId: string }
);
export type RouteStop = { seq: number; id: string; name?: RouteName; someDeparturesOnly?: boolean };
export type BusStop = { id: string; name: RouteName };
export type RouteSequenceChoice = { identity: RouteStopIdentity; catalogueRoute?: BusRoute };

export function routeOptionKey(route: BusRoute) {
  return route.source === 'nlb' ? route.routeId : route.serviceType;
}

export function routeSequenceChoices(routes: BusRoute[], option?: string): RouteSequenceChoice[] {
  const first = routes[0];
  if (!first) return [];
  if (first.source === 'nlb') {
    const route = routes.find((entry) => entry.source === 'nlb' && entry.routeId === option);
    return route?.source === 'nlb' ? [{
      identity: { source: 'nlb', number: route.number, routeId: route.routeId },
      catalogueRoute: route,
    }] : [];
  }
  if (first.source === 'citybus') {
    return (['outbound', 'inbound'] as const).map((direction) => ({
      identity: { source: 'citybus', number: first.number, direction },
    }));
  }
  return routes
    .filter((route) => route.source === 'kmbLwb')
    .filter((route) => route.serviceType === option)
    .sort((a, b) => Number(a.direction === 'inbound') - Number(b.direction === 'inbound'))
    .map((route) => ({
      identity: { source: 'kmbLwb', number: route.number, direction: route.direction, serviceType: route.serviceType },
      catalogueRoute: route,
    }));
}

export function routeStopKey(identity: RouteStopIdentity) {
  if (identity.source === 'nlb') return JSON.stringify([identity.source, identity.routeId]);
  return JSON.stringify([
    identity.source, identity.number, identity.direction,
    identity.source === 'kmbLwb' ? identity.serviceType : null,
  ]);
}

export function stopVisitKey(identity: RouteStopIdentity, stop: RouteStop) {
  return JSON.stringify([routeStopKey(identity), stop.seq, stop.id]);
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>) : undefined;
}

function validStopId(source: StopNameSource, value: unknown): value is string {
  return typeof value === 'string' && (source === 'citybus' ? /^\d{6}$/ : /^[A-F0-9]{16}$/i).test(value);
}

export function parseRouteStops(identity: RouteStopIdentity, payload: unknown): RouteStop[] {
  const envelope = record(payload);
  if (identity.source === 'nlb') {
    const stops = envelope?.stops;
    if (!Array.isArray(stops)) throw new Error('Invalid NLB stop list');

    // NLB V2 documents the order of the array as the route's stop sequence.
    return stops.map((value, index) => {
      const row = record(value);
      const rawId = row?.stopId;
      const id = typeof rawId === 'number' && Number.isSafeInteger(rawId) ? String(rawId) : rawId;
      if (!row || typeof id !== 'string' || !/^\d+$/.test(id)) throw new Error('Invalid NLB stop');
      return {
        seq: index + 1,
        id,
        name: {
          zh: typeof row.stopName_c === 'string' ? row.stopName_c.trim() : '',
          en: typeof row.stopName_e === 'string' ? row.stopName_e.trim() : '',
        },
        someDeparturesOnly: row.someDepartureObserveOnly === 1,
      };
    });
  }

  const data = envelope?.data;
  if (!Array.isArray(data)) throw new Error('Invalid route-stop catalogue');
  const bound = identity.direction === 'outbound' ? 'O' : 'I';
  const sequenceNumbers = new Set<number>();

  return data.map((value): RouteStop => {
    const row = record(value);
    if (!row || row.route !== identity.number || !validStopId(identity.source, row.stop)) {
      throw new Error('Invalid route-stop row');
    }
    const matches = identity.source === 'citybus'
      ? row.co === 'CTB' && row.dir === bound
      : row.bound === bound && String(row.service_type) === identity.serviceType;
    const seq = typeof row.seq === 'number' || (typeof row.seq === 'string' && /^\d+$/.test(row.seq))
      ? Number(row.seq) : NaN;
    if (!matches || !Number.isSafeInteger(seq) || seq < 1 || sequenceNumbers.has(seq)) {
      throw new Error('Invalid route-stop direction, service type or sequence');
    }
    sequenceNumbers.add(seq);
    return { seq, id: row.stop };
  }).sort((a, b) => a.seq - b.seq);
}

export function parseBusStop(source: StopNameSource, id: string, payload: unknown): BusStop {
  const row = record(record(payload)?.data);
  const zh = typeof row?.name_tc === 'string' ? row.name_tc.trim() : '';
  const en = typeof row?.name_en === 'string' ? row.name_en.trim() : '';
  if (!validStopId(source, row?.stop) || row.stop !== id || !(zh || en)) {
    throw new Error('Invalid or missing stop details');
  }
  return { id, name: { zh, en } };
}
