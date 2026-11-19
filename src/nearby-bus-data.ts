import type { SQLiteDatabase } from 'expo-sqlite';

import { requestBusJson } from '@/bus-data';
import { busSources, type BusSource, type RouteName } from '@/bus-routes';
import { getDatabase } from '@/database';

export type Coordinates = { latitude: number; longitude: number };
export type StopRow = Coordinates & {
  source: BusSource;
  stop_id: string;
  name_zh: string;
  name_en: string;
  street_zh: string;
  street_en: string;
};

export type NearbyBusStop = StopRow & { distance: number };
export type BusSearchRadius = 500 | 1000 | 2000;
type StopSeed = [id: string, zh: string, en: string, lat: number, lon: number, streetZh: string, streetEn: string];
type SourceRow = { source: BusSource; fetched_at: number };

const kmbStopUrl = 'https://data.etabus.gov.hk/v1/transport/kmb/stop';
const sources: Record<BusSource, string> = {
  kmbLwb: kmbStopUrl,
  citybus: 'https://rt.data.gov.hk/v2/transport/citybus/route-stop/CTB · https://rt.data.gov.hk/v2/transport/citybus/stop',
  nlb: 'https://rt.data.gov.hk/v2/transport/nlb/stop.php?action=list',
};
const earthRadius = 6_371_008.8;
const radians = Math.PI / 180;
const refreshAge = 7 * 24 * 60 * 60 * 1_000;
let importPromise: Promise<SourceRow[]> | undefined;
let refreshPromise: Promise<void> | undefined;

export function isNearHongKong({ latitude, longitude }: Coordinates) {
  return latitude >= 22.12 && latitude <= 22.59 && longitude >= 113.82 && longitude <= 114.46;
}

function coordinate(value: unknown) {
  if (typeof value === 'number') return value;
  return typeof value === 'string' && value.trim() ? Number(value) : NaN;
}

export function parseKmbNearbyStops(payload: unknown): StopSeed[] {
  const data = (payload as { data?: unknown } | null)?.data;
  if (!Array.isArray(data) || data.length === 0) throw new Error('Missing KMB stop catalogue');
  const rows: StopSeed[] = [];
  for (const stop of data) {
    if (!stop || typeof stop.stop !== 'string' || !/^[A-F0-9]{16}$/i.test(stop.stop)
      || typeof stop.name_tc !== 'string' || typeof stop.name_en !== 'string') {
      throw new Error('Invalid KMB stop record');
    }
    const latitude = coordinate(stop.lat);
    const longitude = coordinate(stop.long);
    if (isNearHongKong({ latitude, longitude }) && (stop.name_tc.trim() || stop.name_en.trim())) {
      rows.push([stop.stop, stop.name_tc.trim(), stop.name_en.trim(), latitude, longitude, '', '']);
    }
  }
  if (!rows.length) throw new Error('No KMB stops with valid Hong Kong coordinates');
  return rows;
}

async function replaceStops(db: SQLiteDatabase, source: BusSource, stops: readonly (readonly (string | number)[])[], fetchedAt: number) {
  if (!stops.length || !Number.isFinite(fetchedAt)) throw new Error('Invalid nearby stop snapshot');
  await db.runAsync('DELETE FROM nearby_bus_stops WHERE source = ?', source);
  await db.runAsync(
    `INSERT INTO nearby_bus_stops (
       source, stop_id, name_zh, name_en, latitude, longitude, street_zh, street_en
     )
     SELECT ?, json_extract(value, '$[0]'), json_extract(value, '$[1]'), json_extract(value, '$[2]'),
       json_extract(value, '$[3]'), json_extract(value, '$[4]'), json_extract(value, '$[5]'), json_extract(value, '$[6]')
     FROM json_each(?)`,
    source, JSON.stringify(stops),
  );
  await db.runAsync(
    `INSERT INTO nearby_bus_sources (source, origin, fetched_at) VALUES (?, ?, ?)
     ON CONFLICT(source) DO UPDATE SET origin = excluded.origin, fetched_at = excluded.fetched_at`,
    source, sources[source], fetchedAt,
  );
}

async function readSources(db: SQLiteDatabase) {
  return db.getAllAsync<SourceRow>('SELECT source, fetched_at FROM nearby_bus_sources');
}

export function prepareNearbyBusIndex() {
  if (!importPromise) {
    importPromise = (async () => {
      const db = await getDatabase();
      const { default: seed } = await import('../assets/data/nearby-stops.json');
      const cached = await readSources(db);
      if (busSources.every((source) => cached.some((row) => row.source === source && row.fetched_at >= seed.capturedAt))) return cached;

      await db.withExclusiveTransactionAsync(async (transaction) => {
        const rows = await readSources(transaction);
        for (const source of busSources) {
          if (!rows.some((row) => row.source === source && row.fetched_at >= seed.capturedAt)) {
            await replaceStops(transaction, source, seed.stops[source], seed.capturedAt);
          }
        }
      });
      return readSources(db);
    })().finally(() => { importPromise = undefined; });
  }
  return importPromise;
}

export function kmbNearbyNeedsRefresh(rows: SourceRow[], now = Date.now()) {
  const kmb = rows.find((row) => row.source === 'kmbLwb');
  return !!kmb && now - kmb.fetched_at >= refreshAge;
}

export function refreshKmbNearbyStops() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const db = await getDatabase();
      const payload = await requestBusJson('kmbLwb', kmbStopUrl);
      const stops = parseKmbNearbyStops(payload);
      const existing = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM nearby_bus_stops WHERE source = 'kmbLwb'",
      );
      if (existing && stops.length < existing.count * 0.9) throw new Error('Incomplete KMB stop catalogue');
      await db.withExclusiveTransactionAsync((transaction) => replaceStops(transaction, 'kmbLwb', stops, Date.now()));
    })().finally(() => { refreshPromise = undefined; });
  }
  return refreshPromise;
}

export function distanceBetween(from: Coordinates, to: Coordinates) {
  const lat = from.latitude * radians;
  const otherLat = to.latitude * radians;
  const lonDelta = (to.longitude - from.longitude) * radians;
  const sinLat = Math.sin((otherLat - lat) / 2);
  const sinLon = Math.sin(lonDelta / 2);
  const haversine = sinLat ** 2 + Math.cos(lat) * Math.cos(otherLat) * sinLon ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

export async function readNearbyBusStops(center: Coordinates, radius: BusSearchRadius): Promise<NearbyBusStop[]> {
  if (!isNearHongKong(center)) return [];
  const db = await getDatabase();
  const angle = radius / earthRadius;
  const latitudeDelta = angle / radians;
  const longitudeDelta = Math.asin(Math.sin(angle) / Math.cos(center.latitude * radians)) / radians;
  const rows = await db.getAllAsync<StopRow>(
    `SELECT source, stop_id, name_zh, name_en, street_zh, street_en, latitude, longitude
     FROM nearby_bus_stops WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?`,
    center.latitude - latitudeDelta, center.latitude + latitudeDelta,
    center.longitude - longitudeDelta, center.longitude + longitudeDelta,
  );
  return rows.map((row) => ({ ...row, distance: distanceBetween(center, row) }))
    .filter((row) => row.distance <= radius)
    .sort((a, b) => a.distance - b.distance || a.source.localeCompare(b.source) || a.stop_id.localeCompare(b.stop_id));
}

export async function readNearbyBusStop(source: BusSource, stopId: string) {
  await prepareNearbyBusIndex();
  const db = await getDatabase();
  return db.getFirstAsync<StopRow>('SELECT * FROM nearby_bus_stops WHERE source = ? AND stop_id = ?', source, stopId);
}

export async function readBusStopsForSearch() {
  await prepareNearbyBusIndex();
  const db = await getDatabase();
  return db.getAllAsync<Omit<StopRow, keyof Coordinates>>(
    'SELECT source, stop_id, name_zh, name_en, street_zh, street_en FROM nearby_bus_stops ORDER BY source, stop_id',
  );
}

export async function readBusStopCoordinates(source: BusSource, stopIds: string[]): Promise<Map<string, Coordinates & { name: RouteName }>> {
  if (!stopIds.length) return new Map();
  await prepareNearbyBusIndex();
  const db = await getDatabase();
  const rows = await db.getAllAsync<Pick<StopRow, 'stop_id' | 'latitude' | 'longitude' | 'name_zh' | 'name_en'>>(
    `SELECT stop_id, latitude, longitude, name_zh, name_en FROM nearby_bus_stops
     WHERE source = ? AND stop_id IN (SELECT value FROM json_each(?))`,
    source, JSON.stringify(stopIds),
  );
  return new Map(rows.map(({ stop_id, latitude, longitude, name_zh, name_en }) => [
    stop_id, { latitude, longitude, name: { zh: name_zh, en: name_en } },
  ]));
}
