import staticData from '../assets/data/tram-static.json';
import statusData from '../assets/data/tram-service-status.json';

import { normalizeBusQuery } from '@/bus-routes';
import { distanceBetween, isNearHongKong, type BusSearchRadius, type Coordinates } from '@/nearby-bus-data';

type LocalizedNames = Readonly<{ 'zh-HK': string; en: string }>;
export type TramDirectionId = 1 | 2;
export type TramPickDrop = 1 | 2 | 3;
export type TramStop = Readonly<Coordinates & {
  stopId: number;
  key: `td:tram:stop:${number}`;
  localizedStopNames: LocalizedNames;
}>;
export type TramVisit = Readonly<{
  routeId: number;
  directionId: TramDirectionId;
  stopId: number;
  stopSequence: number;
  key: `td:tram:route:${number}:${TramDirectionId}:${number}`;
  pickDrop: TramPickDrop;
  stop: TramStop;
}>;
export type TramDirection = Readonly<{
  routeId: number;
  directionId: TramDirectionId;
  key: `td:tram:route:${number}:${TramDirectionId}`;
  routeTermini: Readonly<{ fromStopId: number; toStopId: number }>;
  visits: readonly TramVisit[];
}>;
export type TramRoute = Readonly<{
  routeId: number;
  key: `td:tram:route:${number}`;
  localizedRouteNames: LocalizedNames;
  directions: readonly TramDirection[];
}>;
type TramServiceNotice = Readonly<{
  url: string;
  publishedOn: string;
  checkedOn: string;
  description: LocalizedNames;
}>;
export type TramStopServiceStatus = Readonly<{
  serviceStatus: 'active' | 'temporarily_closed' | 'unknown';
  notice?: TramServiceNotice;
}>;
export type TramStatusOverride = Readonly<{ stopId: number; serviceStatus: TramStopServiceStatus['serviceStatus']; notice: TramServiceNotice }>;
export type NearbyTramStop = Readonly<{
  key: TramStop['key'];
  stop: TramStop;
  distance: number;
  serviceStatus: TramStopServiceStatus;
  scheduledBoardingVisits: readonly TramVisit[];
  verifiedBoardingVisits: readonly TramVisit[];
}>;

function freeze<T>(value: T): Readonly<T> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

const snapshot = staticData;
export const tramSource = freeze({
  ...snapshot.source,
  sourceVersion: snapshot.sourceVersion,
  sourceUpdatedAt: snapshot.sourceUpdatedAt,
});
export const tramCapabilities = Object.freeze({ realtimeEta: false } as const);
export const tramNoticeAttribution = Object.freeze({ 'zh-HK': '香港電車有限公司', en: 'Hong Kong Tramways Limited' });

const stops: readonly TramStop[] = freeze(snapshot.stops.map((stop): TramStop => ({
  ...stop, key: `td:tram:stop:${stop.stopId}`,
})));
const stopsById = new Map(stops.map((stop) => [stop.stopId, stop]));
const visitsByStop = new Map<number, TramVisit[]>();
const routes: readonly TramRoute[] = freeze(snapshot.routes.map(({ routeId, localizedRouteNames, directions }): TramRoute => ({
  routeId, localizedRouteNames, key: `td:tram:route:${routeId}`,
  directions: directions.map(({ directionId, visits }): TramDirection => {
    if ((directionId !== 1 && directionId !== 2) || !visits.length) {
      throw new Error('Invalid tram direction ' + routeId + '/' + directionId);
    }
    const key = `td:tram:route:${routeId}:${directionId}` as const;
    return {
      routeId, directionId, key,
      routeTermini: { fromStopId: visits[0][1], toStopId: visits[visits.length - 1][1] },
      visits: visits.map(([stopSequence, stopId, pickDrop]): TramVisit => {
        const stop = stopsById.get(stopId);
        if (!stop || (pickDrop !== 1 && pickDrop !== 2 && pickDrop !== 3)) {
          throw new Error('Invalid tram visit ' + key + ':' + stopSequence);
        }
        const visit: TramVisit = { routeId, directionId, stopId, stopSequence, key: `${key}:${stopSequence}`, pickDrop, stop };
        const indexed = visitsByStop.get(stopId);
        if (indexed) indexed.push(visit);
        else visitsByStop.set(stopId, [visit]);
        return visit;
      }),
    };
  }),
})));
for (const visits of visitsByStop.values()) Object.freeze(visits);
const routesById = new Map(routes.map((route) => [route.routeId, route]));
const empty = Object.freeze([]);
const unknownStatus = Object.freeze({ serviceStatus: 'unknown' } as const);
const searchIndex = stops.map((stop) => ({
  stop, names: Object.values(stop.localizedStopNames).map(normalizeBusQuery),
}));

export function listTramRoutes(): readonly TramRoute[] {
  return routes;
}

export function getTramRoute(routeId: number) {
  return routesById.get(routeId);
}

export function getTramDirections(routeId: number): readonly TramDirection[] {
  return getTramRoute(routeId)?.directions ?? empty;
}

/** Retains one entry per official visit, even if a later snapshot revisits a stop ID. */
export function getTramStopsForDirection(routeId: number, directionId: TramDirectionId): readonly TramVisit[] {
  return getTramDirections(routeId).find((direction) => direction.directionId === directionId)?.visits ?? empty;
}

export function listTramStops(): readonly TramStop[] {
  return stops;
}

export function getTramStop(stopId: number) {
  return stopsById.get(stopId);
}

export function getTramVisitsForStop(stopId: number): readonly TramVisit[] {
  return visitsByStop.get(stopId) ?? empty;
}

export function searchTramStops(input: string): readonly TramStop[] {
  const query = normalizeBusQuery(input);
  if (!/[\p{L}\p{N}]/u.test(query)) return empty;
  const matches = searchIndex.flatMap(({ stop, names }) => {
    const rank = names.includes(query) ? 0 : names.some((name) => name.startsWith(query)) ? 1
      : names.some((name) => name.includes(query)) ? 2 : undefined;
    return rank === undefined ? [] : [{ stop, rank }];
  });
  return Object.freeze(matches.sort((a, b) => a.rank - b.rank || a.stop.stopId - b.stop.stopId).map(({ stop }) => stop));
}

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function serviceStatuses(overrides: readonly TramStatusOverride[]) {
  const byStop = new Map<number, TramStopServiceStatus>();
  for (const { stopId, serviceStatus, notice } of overrides) {
    if (!stopsById.has(stopId) || byStop.has(stopId)) throw new Error('Invalid or duplicate tram status stop: ' + stopId);
    if (!['active', 'temporarily_closed', 'unknown'].includes(serviceStatus)
      || !notice || typeof notice.url !== 'string' || !/^https:\/\/www\.hktramways\.com\/[^\s]+$/i.test(notice.url)
      || !isCalendarDate(notice.publishedOn) || !isCalendarDate(notice.checkedOn) || notice.checkedOn < notice.publishedOn
      || !notice.description || !['zh-HK', 'en'].every((locale) => {
        const text = notice.description[locale as keyof LocalizedNames];
        return typeof text === 'string' && text.trim().length > 0;
      })) throw new Error('Invalid tram status notice: ' + stopId);
    byStop.set(stopId, freeze({ serviceStatus, notice: { ...notice, description: { ...notice.description } } }));
  }
  return byStop;
}

/** Builds an independent view of the immutable catalogue and the reviewed stop-status file. */
export function createTramServiceIndex(overrides: readonly TramStatusOverride[]) {
  const statuses = serviceStatuses(overrides);

  function getTramStopServiceStatus(stopId: number): TramStopServiceStatus | undefined {
    return stopsById.has(stopId) ? statuses.get(stopId) ?? unknownStatus : undefined;
  }

  function findNearbyTramStops(center: Coordinates, radius: BusSearchRadius): readonly NearbyTramStop[] {
    if (!isNearHongKong(center) || ![300, 500, 1000, 2000].includes(radius)) return empty;

    const nearby = stops.flatMap((stop): NearbyTramStop[] => {
      const serviceStatus = statuses.get(stop.stopId) ?? unknownStatus;
      if (serviceStatus.serviceStatus === 'temporarily_closed') return [];
      const distance = distanceBetween(center, stop);
      if (distance > radius) return [];
      const scheduledBoardingVisits = Object.freeze(getTramVisitsForStop(stop.stopId).filter(({ pickDrop }) => pickDrop !== 1));
      return [{
        key: stop.key, stop, distance, serviceStatus, scheduledBoardingVisits,
        verifiedBoardingVisits: serviceStatus.serviceStatus === 'active' ? scheduledBoardingVisits : empty,
      }];
    });
    return freeze(nearby.sort((a, b) => a.distance - b.distance || a.stop.stopId - b.stop.stopId));
  }

  return Object.freeze({ getTramStopServiceStatus, findNearbyTramStops });
}

export const { getTramStopServiceStatus, findNearbyTramStops } = createTramServiceIndex(statusData as TramStatusOverride[]);
