import { getDatabase } from '@/database';
import { forgetDeletedHomePin, queueTransportFavoriteWrite, waitForTransportFavoriteWrites } from '@/home-transport-pins';
import { findLightRailRoute, findLightRailStop } from '@/light-rail-static';
import { findMtrLine, findMtrStation } from '@/mtr-static';

export type RailwayMode = 'mtr' | 'light_rail';
export type RailwayFavoriteIdentity = { mode: RailwayMode; lineId: string; stationId: string };
type Names = { zh: string; en: string };
// A favorite represents the whole line at this station, across directions/platforms.
export type RailwayFavorite = RailwayFavoriteIdentity & {
  id: string;
  lineSnapshot: Names;
  stationSnapshot: Names;
  createdAt: number;
  updatedAt: number;
};
type FavoriteRow = {
  mode: RailwayMode; line_id: string; station_id: string;
  line_zh_snapshot: string; line_en_snapshot: string; station_zh_snapshot: string; station_en_snapshot: string;
  created_at: number; updated_at: number;
};

export function railwayFavoriteId({ mode, lineId, stationId }: RailwayFavoriteIdentity) {
  return `railway_favorite:${JSON.stringify([mode, lineId, stationId])}`;
}

export function resolveRailwayService({ mode, lineId, stationId }: RailwayFavoriteIdentity) {
  if (mode === 'mtr') {
    const line = findMtrLine(lineId);
    const station = findMtrStation(stationId);
    if (line && station?.memberships.some(({ lineCode }) => lineCode === line.id)) {
      return { line: { zh: line.zh, en: line.en }, station: { zh: station.zh, en: station.en } };
    }
  } else if (mode === 'light_rail') {
    const route = findLightRailRoute(lineId);
    const station = findLightRailStop(stationId);
    if (route && station?.routes.includes(route.id)) {
      return { line: { zh: route.id, en: route.id }, station: { zh: station.zh, en: station.en } };
    }
  }
}

export function railwayFavoriteHref(identity: RailwayFavoriteIdentity) {
  if (!resolveRailwayService(identity)) return;
  return identity.mode === 'mtr'
    ? { pathname: '/mtr/[kind]' as const, params: { kind: 'station', code: identity.stationId, line: identity.lineId } }
    : { pathname: '/light-rail/[kind]' as const, params: { kind: 'stop', id: identity.stationId, route: identity.lineId } };
}

export function setRailwayFavorite(identity: RailwayFavoriteIdentity, saved: boolean) {
  return queueTransportFavoriteWrite(async () => {
    const database = await getDatabase();
    const { mode, lineId, stationId } = identity;
    if (!saved) {
      // Removal still works when a static service has disappeared.
      await database.runAsync('DELETE FROM railway_favorites WHERE mode = ? AND line_id = ? AND station_id = ?', mode, lineId, stationId);
      forgetDeletedHomePin(identity);
      return;
    }
    const service = resolveRailwayService(identity);
    if (!service) throw new Error('Unavailable railway service');
    const now = Date.now();
    await database.runAsync(`INSERT INTO railway_favorites (
      mode, line_id, station_id, line_zh_snapshot, line_en_snapshot, station_zh_snapshot, station_en_snapshot, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(mode, line_id, station_id) DO NOTHING`,
    mode, lineId, stationId, service.line.zh, service.line.en, service.station.zh, service.station.en, now, now);
  });
}

export async function listRailwayFavorites(): Promise<RailwayFavorite[]> {
  await waitForTransportFavoriteWrites();
  const database = await getDatabase();
  const rows = await database.getAllAsync<FavoriteRow>('SELECT * FROM railway_favorites ORDER BY created_at DESC, mode, line_id, station_id');
  return rows.map((row) => {
    const identity = { mode: row.mode, lineId: row.line_id, stationId: row.station_id };
    return {
      ...identity, id: railwayFavoriteId(identity),
      lineSnapshot: { zh: row.line_zh_snapshot, en: row.line_en_snapshot },
      stationSnapshot: { zh: row.station_zh_snapshot, en: row.station_en_snapshot },
      createdAt: row.created_at, updatedAt: row.updated_at,
    };
  });
}
