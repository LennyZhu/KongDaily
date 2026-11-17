import { getDatabase } from '@/database';
import { resolveFacilityIdentity, resolveStableFacilityIdentity,
  type FacilityDisplayIdentity, type FacilityFavoriteIdentity, type FacilityIdentityResolution } from '@/facility-identity';
import type { Facility, FacilityCategory } from '@/facilities';

export type FacilityFavorite = FacilityFavoriteIdentity & {
  nameSnapshot: Facility['name'];
  categorySnapshot: FacilityCategory;
  createdAt: number;
  updatedAt: number;
};

type FavoriteRow = {
  source: string;
  stable_facility_id: string;
  name_zh_hk_snapshot: string | null;
  name_en_snapshot: string | null;
  category_snapshot: FacilityCategory;
  created_at: number;
  updated_at: number;
};

let pendingWrites: Promise<unknown> = Promise.resolve();

function enqueueWrite<T>(write: () => Promise<T>) {
  const request = pendingWrites.then(write);
  pendingWrites = request.then(() => undefined, () => undefined);
  return request;
}

export async function addFacilityFavorite(current: FacilityDisplayIdentity): Promise<FacilityIdentityResolution> {
  const resolved = resolveFacilityIdentity(current);
  if (resolved.status !== 'available') return resolved;
  const { identity, facility } = resolved;
  return enqueueWrite(async () => {
    const database = await getDatabase();
    const now = Date.now();
    await database.runAsync(
      `INSERT INTO facility_favorites (
        source, stable_facility_id, name_zh_hk_snapshot, name_en_snapshot, category_snapshot, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(source, stable_facility_id) DO NOTHING`,
      identity.source, identity.stableFacilityId, facility.name['zh-HK'] ?? null, facility.name.en ?? null, facility.category, now, now,
    );
    return resolved;
  });
}

export function removeFacilityFavorite(identity: FacilityFavoriteIdentity) {
  return enqueueWrite(async () => {
    const database = await getDatabase();
    await database.runAsync(
      'DELETE FROM facility_favorites WHERE source = ? AND stable_facility_id = ?', identity.source, identity.stableFacilityId,
    );
  });
}

export async function isFacilityFavorite(identity: FacilityFavoriteIdentity) {
  await pendingWrites;
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ found: number }>(
    'SELECT 1 AS found FROM facility_favorites WHERE source = ? AND stable_facility_id = ?', identity.source, identity.stableFacilityId,
  );
  return row !== null;
}

export async function listFacilityFavorites(): Promise<FacilityFavorite[]> {
  await pendingWrites;
  const database = await getDatabase();
  const rows = await database.getAllAsync<FavoriteRow>(
    `SELECT source, stable_facility_id, name_zh_hk_snapshot, name_en_snapshot, category_snapshot, created_at, updated_at
     FROM facility_favorites ORDER BY created_at DESC, source, stable_facility_id`,
  );
  return rows.map((row) => ({
    source: row.source,
    stableFacilityId: row.stable_facility_id,
    nameSnapshot: row.name_zh_hk_snapshot
      ? { 'zh-HK': row.name_zh_hk_snapshot, ...(row.name_en_snapshot && { en: row.name_en_snapshot }) }
      : { en: row.name_en_snapshot ?? '' },
    categorySnapshot: row.category_snapshot,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function resolveFacilityFavorite(favorite: FacilityFavorite) {
  const { source, stableFacilityId } = favorite;
  return { ...resolveStableFacilityIdentity({ source, stableFacilityId }), favorite };
}
