import { useEffect, useSyncExternalStore } from 'react';

import { getDatabase } from '@/database';
import { gmbIsDirection, gmbIsRegion, gmbIsRouteCode, gmbPositiveId,
  type GmbDirection, type GmbRegion, type GmbRoute, type GmbVisit, type GmbVisitKey } from '@/gmb-data';
import { gmbText, gmbVisitKey } from '@/gmb-search';
import { forgetDeletedHomePin, queueTransportFavoriteWrite } from '@/home-transport-pins';

export type GmbFavorite = GmbVisitKey & {
  mode: 'gmb'; id: string; region: GmbRegion; routeCode: string;
  stopName: { 'zh-HK': string; en: string };
  destination: { 'zh-HK': string; en: string };
};

export function createGmbFavorite(route: GmbRoute, direction: GmbDirection, visit: GmbVisit): GmbFavorite | undefined {
  if (route.routeId !== visit.routeId || direction.routeId !== visit.routeId ||
      direction.routeSeq !== visit.routeSeq || !route.directions.includes(direction)) return;
  return {
    mode: 'gmb', id: gmbVisitKey(visit), routeId: visit.routeId, routeSeq: visit.routeSeq,
    stopSeq: visit.stopSeq, stopId: visit.stopId, region: route.region, routeCode: route.routeCode,
    stopName: { 'zh-HK': gmbText(visit.name, 'zh-HK'), en: gmbText(visit.name, 'en') },
    destination: { 'zh-HK': gmbText(direction.destination, 'zh-HK'), en: gmbText(direction.destination, 'en') },
  };
}

type Row = {
  id: string; route_id: number; route_seq: GmbVisitKey['routeSeq']; stop_seq: number; stop_id: number;
  region: GmbRegion; route_code: string; stop_zh: string; stop_en: string; destination_zh: string; destination_en: string;
};

export async function listGmbFavorites(): Promise<GmbFavorite[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<Row>('SELECT * FROM gmb_favorites ORDER BY created_at DESC, id');
  return rows.map((row) => ({
    mode: 'gmb', id: row.id, routeId: row.route_id, routeSeq: row.route_seq, stopSeq: row.stop_seq,
    stopId: row.stop_id, region: row.region, routeCode: row.route_code,
    stopName: { 'zh-HK': row.stop_zh, en: row.stop_en },
    destination: { 'zh-HK': row.destination_zh, en: row.destination_en },
  }));
}

type State = { items: GmbFavorite[]; status: 'loading' | 'ready' | 'error' };
let snapshot: State = { items: [], status: 'loading' };
let loading: Promise<void> | undefined;
const listeners = new Set<() => void>();
function publish(state: State) {
  snapshot = state;
  for (const listener of listeners) listener();
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const getSnapshot = () => snapshot;

export function loadGmbFavorites() {
  if (snapshot.status === 'ready') return Promise.resolve();
  if (loading) return loading;
  publish({ ...snapshot, status: 'loading' });
  loading = queueTransportFavoriteWrite(async () => {
    try { publish({ items: await listGmbFavorites(), status: 'ready' }); }
    catch { publish({ ...snapshot, status: 'error' }); }
  }).finally(() => { loading = undefined; });
  return loading;
}

export function useGmbFavorites() {
  const state = useSyncExternalStore(subscribe, getSnapshot);
  useEffect(() => { void loadGmbFavorites(); }, []);
  return state;
}

export function setGmbFavorite(favorite: GmbFavorite, saved: boolean) {
  return queueTransportFavoriteWrite(async () => {
    try {
      if (favorite.mode !== 'gmb' || favorite.id !== gmbVisitKey(favorite) ||
          !gmbPositiveId(favorite.routeId) || !gmbIsDirection(favorite.routeSeq) ||
          !gmbPositiveId(favorite.stopId) || !gmbPositiveId(favorite.stopSeq) ||
          !gmbIsRegion(favorite.region) || !gmbIsRouteCode(favorite.routeCode)) return 'failed';
      const db = await getDatabase();
      if (saved) {
        await db.runAsync(`
          INSERT INTO gmb_favorites (id, route_id, route_seq, stop_seq, stop_id, region, route_code,
            stop_zh, stop_en, destination_zh, destination_en, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING
        `, favorite.id, favorite.routeId, favorite.routeSeq, favorite.stopSeq, favorite.stopId, favorite.region, favorite.routeCode,
        favorite.stopName['zh-HK'], favorite.stopName.en, favorite.destination['zh-HK'], favorite.destination.en, Date.now());
      } else {
        await db.runAsync('DELETE FROM gmb_favorites WHERE id = ?', favorite.id);
        forgetDeletedHomePin(favorite);
      }
    } catch { return 'failed'; }
    try { publish({ items: await listGmbFavorites(), status: 'ready' }); }
    catch { publish({ ...snapshot, status: 'error' }); return 'failed'; }
    return 'ok';
  });
}
