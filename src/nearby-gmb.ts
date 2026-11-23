import { normalizeBusQuery } from '@/bus-routes';
import type { GmbRegion, GmbRouteSeq, GmbText, GmbVisit, GmbVisitKey } from '@/gmb-data';
import { distanceBetween, isNearHongKong, type BusSearchRadius, type Coordinates } from '@/nearby-bus-data';

type SnapshotDirection = [routeId: number, seq: GmbRouteSeq, region: GmbRegion, code: string,
  originZh: string, originEn: string, destinationZh: string, destinationEn: string];
type SnapshotVisit = [directionIndex: number, stopSeq: number, pickDrop: 1 | 2 | 3, nameZh: string, nameEn: string];
type SnapshotStop = [stopId: number, lat: number, lon: number, visits: SnapshotVisit[]];
type Snapshot = {
  source: { capturedOn: string };
  directions: SnapshotDirection[];
  stops: SnapshotStop[];
};

export type GmbNearbyDirection = {
  routeId: number; routeSeq: GmbRouteSeq; region: GmbRegion; routeCode: string; origin: GmbText; destination: GmbText;
  hasVariants: boolean;
};
export type GmbNearbyVisit = GmbVisit & { direction: GmbNearbyDirection; boarding: boolean };
export type GmbNearbyStop = { stopId: number; coordinate: Coordinates; name: GmbText; visits: readonly GmbNearbyVisit[] };
export type GmbNearbyRouteRow = { kind: 'nearby-gmb-route'; id: string; visit: GmbNearbyVisit; distance: number };
export type GmbNearbyStopRow = { kind: 'nearby-gmb-stop'; id: string; stop: GmbNearbyStop; distance?: number };

function snapshot(): Snapshot {
  return require('../assets/data/gmb-nearby.json') as Snapshot;
}

function gmbKnownDropOffOnly(visit: GmbVisitKey) {
  const { stops, directions } = snapshot();
  return stops.find(([id]) => id === visit.stopId)?.[3].some(([directionIndex, seq, pickDrop]) => {
    const [routeId, routeSeq] = directions[directionIndex];
    return pickDrop === 1 && seq === visit.stopSeq && routeId === visit.routeId && routeSeq === visit.routeSeq;
  }) ?? false;
}

export function gmbBoardingVisit(visit: GmbVisitKey, visits: readonly GmbVisit[]) {
  const index = visits.findIndex(({ routeId, routeSeq, stopId, stopSeq }) =>
    routeId === visit.routeId && routeSeq === visit.routeSeq && stopId === visit.stopId && stopSeq === visit.stopSeq);
  return index >= 0 && index < visits.length - 1 && !gmbKnownDropOffOnly(visit);
}

let loaded: { stops: readonly GmbNearbyStop[]; capturedOn: string } | undefined;
let nameIndex: ReturnType<typeof indexedNames> | undefined;

function bilingual(tc: string, en: string): GmbText {
  return { tc, en, sc: null };
}

function index() {
  if (loaded) return loaded;
  // Delay decoding the packaged catalogue until entering the Minibus mode.
  const data = snapshot();
  const variants = new Map<string, Set<number>>();
  for (const [routeId, , region, code] of data.directions) {
    const key = region + ':' + code;
    if (!variants.has(key)) variants.set(key, new Set());
    variants.get(key)?.add(routeId);
  }
  const directions = data.directions.map(([routeId, routeSeq, region, routeCode, zhFrom, enFrom, zhTo, enTo]): GmbNearbyDirection => ({
    routeId, routeSeq, region, routeCode, origin: bilingual(zhFrom, enFrom), destination: bilingual(zhTo, enTo),
    hasVariants: (variants.get(region + ':' + routeCode)?.size ?? 0) > 1,
  }));
  const stops = data.stops.flatMap(([stopId, latitude, longitude, rows]): GmbNearbyStop[] => {
    const visits = rows.map(([directionIndex, stopSeq, pickDrop, zh, en]): GmbNearbyVisit => {
      const direction = directions[directionIndex];
      return { routeId: direction.routeId, routeSeq: direction.routeSeq, stopId, stopSeq,
        direction, name: bilingual(zh, en), boarding: pickDrop === 2 || pickDrop === 3 };
    });
    const firstBoarding = visits.find(({ boarding }) => boarding);
    return firstBoarding ? [{ stopId, coordinate: { latitude, longitude }, name: firstBoarding.name, visits }] : [];
  });
  return loaded = { stops, capturedOn: data.source.capturedOn };
}

export function gmbNearbySnapshotDate() {
  return index().capturedOn;
}

export function nearbyGmbRows(
  center: Coordinates, radius: BusSearchRadius, view: 'routes' | 'stops', stops?: readonly GmbNearbyStop[],
): (GmbNearbyRouteRow | GmbNearbyStopRow)[] {
  if (!isNearHongKong(center) || ![500, 1000, 2000].includes(radius)) return [];
  const nearby = (stops ?? index().stops).flatMap((stop) => {
    const distance = distanceBetween(center, stop.coordinate);
    return distance <= radius && stop.visits.some(({ boarding }) => boarding) ? [{ stop, distance }] : [];
  }).sort((a, b) => a.distance - b.distance || a.stop.stopId - b.stop.stopId);
  if (view === 'stops') return nearby.map(({ stop, distance }) => ({ kind: 'nearby-gmb-stop', id: String(stop.stopId), stop, distance }));

  const routes = new Map<string, GmbNearbyRouteRow>();
  for (const { stop, distance } of nearby) {
    for (const visit of stop.visits) {
      const id = visit.routeId + ':' + visit.routeSeq;
      if (visit.boarding && !routes.has(id)) routes.set(id, { kind: 'nearby-gmb-route', id, visit, distance });
    }
  }
  return [...routes.values()];
}

function indexedNames(stops: readonly GmbNearbyStop[]) {
  return stops.map((stop) => ({ stop, names: [...new Set(stop.visits.flatMap(({ name }) => [name.tc ?? '', name.en ?? ''])
    .map(normalizeBusQuery).filter(Boolean))] }));
}

export function searchGmbStopNames(query: string, stops?: readonly GmbNearbyStop[]): GmbNearbyStopRow[] {
  const text = normalizeBusQuery(query);
  if (!/\p{Script=Han}/u.test(text) && !/[A-Z]{2}/.test(text)) return [];
  const words = text.split(' ');
  const namesByStop = stops ? indexedNames(stops) : (nameIndex ??= indexedNames(index().stops));
  const matches = namesByStop.flatMap(({ stop, names }) => {
    const rank = names.includes(text) ? 0 : names.some((name) => name.startsWith(text)) ? 1
      : names.some((name) => words.every((word) => name.includes(word))) ? 2 : undefined;
    return rank === undefined ? [] : [{ rank, stop }];
  });
  return matches.sort((a, b) => a.rank - b.rank || a.stop.stopId - b.stop.stopId)
    .map(({ stop }) => ({ kind: 'nearby-gmb-stop', id: String(stop.stopId), stop }));
}
