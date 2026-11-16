import type { SQLiteDatabase } from 'expo-sqlite';

import { isBusFeedFresh, readBusFeeds } from '@/bus-data';
import { readEtaTarget, type EtaTarget } from '@/bus-eta';
import type { RouteName } from '@/bus-routes';
import { isStopDataFresh, readRouteStops, routeStopMaxAge } from '@/bus-stop-data';
import { routeStopKey, stopVisitKey } from '@/bus-stops';
import { getDatabase } from '@/database';

export const homeBusLimit = 3;

type BusVisitSummary = {
  target: EtaTarget;
  station: RouteName;
  destination: RouteName;
  destinationStopId?: string;
};

export type BusFavorite = BusVisitSummary & {
  id: string;
  createdAt: number;
  updatedAt: number;
  pinOrder: number | null;
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
  pin_order: number | null;
};

export type FavoriteChange = { type: 'save'; visit: BusVisitSummary }
  | { type: 'remove' | 'pin' | 'unpin'; id: string }
  | { type: 'move'; id: string; step: -1 | 1 };

export function busFavoriteId(target: EtaTarget) {
  return stopVisitKey(target, { seq: target.stopSeq, id: target.stopId });
}

export function pinnedBuses(items: readonly BusFavorite[]) {
  return items.filter((item) => item.pinOrder !== null)
    .sort((a, b) => (a.pinOrder ?? 0) - (b.pinOrder ?? 0))
    .slice(0, homeBusLimit);
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

export const favoriteEtaHref = busStopEtaHref;

async function readRows(database: SQLiteDatabase): Promise<BusFavorite[]> {
  const rows = await database.getAllAsync<FavoriteRow>(
    'SELECT * FROM bus_favorites ORDER BY pin_order IS NULL, pin_order, created_at, id',
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
      pinOrder: row.pin_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }];
  });
}

export async function readBusFavorites() {
  return readRows(await getDatabase());
}

async function replacePins(database: SQLiteDatabase, ids: string[], now: number) {
  // Clearing the ranks and writing them in the same transaction avoids a temporary unique-key collision.
  await database.runAsync('UPDATE bus_favorites SET pin_order = NULL WHERE pin_order IS NOT NULL');
  for (const [index, id] of ids.entries()) {
    await database.runAsync('UPDATE bus_favorites SET pin_order = ?, updated_at = ? WHERE id = ?', index + 1, now, id);
  }
}

export async function writeBusFavorites(change: FavoriteChange) {
  const database = await getDatabase();
  let outcome: 'ok' | 'limit' = 'ok';
  let items: BusFavorite[] = [];
  await database.withExclusiveTransactionAsync(async (transaction) => {
    items = await readRows(transaction);
    const pins = pinnedBuses(items).map(({ id }) => id);
    const now = Date.now();
    if (change.type === 'save') {
      const { target, station, destination, destinationStopId } = change.visit;
      const id = busFavoriteId(target);
      if (items.some((item) => item.id === id)) return;
      await transaction.runAsync(
        `INSERT INTO bus_favorites (
          id, source, route_number, direction, service_type, nlb_route_id, stop_id, stop_seq, repeated_stop,
          station_zh, station_en, destination_zh, destination_en, destination_stop_id, created_at, updated_at, pin_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
        id, target.source, target.number, target.source === 'nlb' ? null : target.direction,
        target.source === 'kmbLwb' ? target.serviceType : null, target.source === 'nlb' ? target.routeId : null,
        target.stopId, target.stopSeq, target.repeatedStop ? 1 : 0,
        station.zh, station.en, destination.zh, destination.en, destinationStopId ?? null,
        now, now, pins.length < homeBusLimit ? pins.length + 1 : null,
      );
    } else {
      const item = items.find(({ id }) => id === change.id);
      if (!item) return;
      const index = pins.indexOf(change.id);
      switch (change.type) {
        case 'remove':
          await transaction.runAsync('DELETE FROM bus_favorites WHERE id = ?', change.id);
          if (index >= 0) await replacePins(transaction, pins.filter((id) => id !== change.id), now);
          break;
        case 'pin':
          if (index >= 0) return;
          if (pins.length >= homeBusLimit) {
            outcome = 'limit';
            return;
          }
          await transaction.runAsync('UPDATE bus_favorites SET pin_order = ?, updated_at = ? WHERE id = ?',
            pins.length + 1, now, change.id);
          break;
        case 'unpin':
          if (index < 0) return;
          await replacePins(transaction, pins.filter((id) => id !== change.id), now);
          await transaction.runAsync('UPDATE bus_favorites SET updated_at = ? WHERE id = ?', now, change.id);
          break;
        case 'move': {
          const next = index + change.step;
          if (index < 0 || next < 0 || next >= pins.length) return;
          [pins[index], pins[next]] = [pins[next], pins[index]];
          await replacePins(transaction, pins, now);
          break;
        }
      }
    }
    items = await readRows(transaction);
  });
  return { items, outcome };
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
