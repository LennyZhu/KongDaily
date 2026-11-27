import type { SQLiteDatabase } from 'expo-sqlite';

import { isBusFeedFresh, readBusFeeds } from '@/bus-data';
import { readEtaTarget, type EtaTarget } from '@/bus-eta';
import type { RouteName } from '@/bus-routes';
import { isStopDataFresh, readRouteStops, routeStopMaxAge } from '@/bus-stop-data';
import { routeStopKey, stopVisitKey, type RouteStop, type RouteStopIdentity } from '@/bus-stops';
import { getDatabase } from '@/database';
import { forgetDeletedHomePin, pinSavedHomeService, publishHomePins, queueTransportFavoriteWrite } from '@/home-transport-pins';

export type BusVisitSummary = {
  target: EtaTarget;
  station: RouteName;
  destination: RouteName;
  destinationStopId?: string;
};

export type BusFavorite = BusVisitSummary & {
  id: string;
  createdAt: number;
  updatedAt: number;
};

type FavoriteRow = {
  id: string;
  source: string;
  route_number: string;
  direction: string | null;
  service_type: string | null;
  nlb_route_id: string | null;
  stop_id: string;
  stop_seq: number;
  repeated_stop: 0 | 1;
  station_zh: string;
  station_en: string;
  destination_zh: string;
  destination_en: string;
  destination_stop_id: string | null;
  created_at: number;
  updated_at: number;
};

export type FavoriteChange = { type: 'save'; visit: BusVisitSummary; pinToHome?: boolean } | { type: 'remove'; id: string };

export function busFavoriteId(target: EtaTarget) {
  return stopVisitKey(target, { seq: target.stopSeq, id: target.stopId });
}

function etaParams(target: EtaTarget) {
  return {
    source: target.source,
    number: target.number,
    stopId: target.stopId,
    stopSeq: String(target.stopSeq),
    ...(target.source === 'nlb'
      ? { nlbRouteId: target.routeId, repeatedStop: target.repeatedStop ? '1' : '0' }
      : { direction: target.direction }),
    ...(target.source === 'kmbLwb' && { serviceType: target.serviceType }),
  };
}

export function busStopEtaHref(visit: BusVisitSummary) {
  return {
    pathname: '/bus/eta' as const,
    params: {
      ...etaParams(visit.target),
      stationZh: visit.station.zh,
      stationEn: visit.station.en,
      destinationZh: visit.destination.zh,
      destinationEn: visit.destination.en,
      ...(visit.destinationStopId && { destinationStopId: visit.destinationStopId }),
    },
  };
}

export function describeBusVisit(
  identity: RouteStopIdentity,
  stop: RouteStop,
  sequence: readonly RouteStop[],
  station: BusVisitSummary['station'] | undefined,
  destination: BusVisitSummary['destination'] | undefined,
): BusVisitSummary {
  return {
    target: {
      ...identity,
      stopId: stop.id,
      stopSeq: stop.seq,
      repeatedStop: identity.source === 'nlb' && sequence.some((visit) => visit.id === stop.id && visit.seq !== stop.seq),
    },
    station: station ?? { zh: '', en: '' },
    destination: destination ?? { zh: '', en: '' },
    destinationStopId: identity.source === 'citybus' ? sequence.at(-1)?.id : undefined,
  };
}

export const favoriteEtaHref = busStopEtaHref;

async function readRows(database: SQLiteDatabase): Promise<BusFavorite[]> {
  const rows = await database.getAllAsync<FavoriteRow>(
    'SELECT * FROM bus_favorites ORDER BY created_at, id',
  );
  return rows.flatMap((row) => {
    const target = readEtaTarget({
      source: row.source,
      number: row.route_number,
      direction: row.direction ?? undefined,
      serviceType: row.service_type ?? undefined,
      nlbRouteId: row.nlb_route_id ?? undefined,
      stopId: row.stop_id,
      stopSeq: String(row.stop_seq),
      repeatedStop: String(row.repeated_stop),
    });
    if (!target) return [];
    return [{
      id: row.id,
      target,
      station: { zh: row.station_zh, en: row.station_en },
      destination: { zh: row.destination_zh, en: row.destination_en },
      destinationStopId: row.destination_stop_id ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }];
  });
}

export async function readBusFavorites() {
  return readRows(await getDatabase());
}

async function applyFavoriteChange(database: SQLiteDatabase, change: FavoriteChange) {
  if (change.type === 'remove') {
    await database.runAsync('DELETE FROM bus_favorites WHERE id = ?', change.id);
  } else {
    const { target, station, destination, destinationStopId } = change.visit;
    const now = Date.now();
    await database.runAsync(
      `INSERT INTO bus_favorites (
        id, source, route_number, direction, service_type, nlb_route_id, stop_id, stop_seq, repeated_stop,
        station_zh, station_en, destination_zh, destination_en, destination_stop_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
      busFavoriteId(target), target.source, target.number, target.source === 'nlb' ? null : target.direction,
      target.source === 'kmbLwb' ? target.serviceType : null, target.source === 'nlb' ? target.routeId : null,
      target.stopId, target.stopSeq, target.repeatedStop ? 1 : 0,
      station.zh, station.en, destination.zh, destination.en, destinationStopId ?? null, now, now,
    );
  }
}

export function writeBusFavorites(change: FavoriteChange) {
  return queueTransportFavoriteWrite(async () => {
    const database = await getDatabase();
    let items: BusFavorite[] = [];
    let home: Awaited<ReturnType<typeof pinSavedHomeService>> | undefined;
    await database.withExclusiveTransactionAsync(async (transaction) => {
      await applyFavoriteChange(transaction, change);
      if (change.type === 'save' && change.pinToHome) home = await pinSavedHomeService(transaction, { mode: 'bus', id: busFavoriteId(change.visit.target) });
      items = await readRows(transaction);
    });
    if (change.type === 'remove') forgetDeletedHomePin({ mode: 'bus', id: change.id });
    if (home) publishHomePins(home.pins);
    return { items, outcome: home?.outcome ?? 'ok' as const };
  });
}

export async function unavailableFavoriteIds(favorites: readonly BusFavorite[]) {
  const identities = new Map(favorites.map(({ target }) => [routeStopKey(target), target]));
  const [feeds, sequences] = await Promise.all([
    readBusFeeds(),
    Promise.all([...identities].map(async ([key, target]) => [key, await readRouteStops(target)] as const)),
  ]);
  const stopsByRoute = new Map(sequences);
  const now = Date.now();

  return new Set(favorites.filter(({ target }) => {
    const feed = feeds[target.source];
    const routeFound = feed?.routes.some((route) => {
      if (route.number !== target.number || route.source !== target.source) return false;
      if (route.source === 'nlb' && target.source === 'nlb') return route.routeId === target.routeId;
      if (route.source === 'kmbLwb' && target.source === 'kmbLwb') {
        return route.direction === target.direction && route.serviceType === target.serviceType;
      }
      return true;
    });
    if (feed && isBusFeedFresh(feed, now) && !routeFound) return true;

    const sequence = stopsByRoute.get(routeStopKey(target));
    return sequence && isStopDataFresh(sequence.fetchedAt, routeStopMaxAge, now)
      && !sequence.stops.some((stop) => stop.id === target.stopId && stop.seq === target.stopSeq);
  }).map(({ id }) => id));
}
