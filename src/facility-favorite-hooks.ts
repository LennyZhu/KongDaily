import { useMemo, useSyncExternalStore } from 'react';

import { addFacilityFavorite, getFacilityFavorite, listFacilityFavorites, removeFacilityFavorite,
  type FacilityFavorite } from '@/facility-favorites';
import { facilityFavoriteKey, resolveFacilityIdentity, type FacilityDisplayIdentity, type FacilityFavoriteIdentity } from '@/facility-identity';

type FavoriteIssue = 'read' | 'write' | 'unavailable';
type FavoriteEntry = { favorite?: FacilityFavorite; pending?: boolean; issue?: FavoriteIssue };
type FavoritesState = { status: 'loading' | 'ready' | 'error'; entries: ReadonlyMap<string, FavoriteEntry> };

let state: FavoritesState = { status: 'loading', entries: new Map() };
let loading: Promise<void> | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot() {
  return state;
}

function publish(next: FavoritesState) {
  state = next;
  for (const listener of listeners) listener();
}

export function loadFacilityFavorites() {
  if (state.status === 'ready') return Promise.resolve();
  if (loading) return loading;
  loading = listFacilityFavorites().then(
    (items) => publish({
      status: 'ready',
      entries: new Map(items.map((favorite) => [facilityFavoriteKey(favorite), { favorite }])),
    }),
    () => publish({ ...state, status: 'error' }),
  ).finally(() => { loading = undefined; });
  if (state.status !== 'loading') publish({ ...state, status: 'loading' });
  return loading;
}

const notSaved: FavoriteEntry = {};

function publishEntry(key: string, entry: FavoriteEntry) {
  const entries = new Map(state.entries);
  if (!entry.favorite && !entry.pending && !entry.issue) entries.delete(key);
  else entries.set(key, entry);
  publish({ ...state, entries });
}

async function pressFavorite(current: FacilityDisplayIdentity) {
  const resolved = resolveFacilityIdentity(current);
  if (resolved.status === 'available') await changeFavorite(resolved.identity, current);
}

async function changeFavorite(identity: FacilityFavoriteIdentity, current?: FacilityDisplayIdentity) {
  if (state.status === 'loading') return;
  if (state.status === 'error') {
    await loadFacilityFavorites();
    return;
  }
  const key = facilityFavoriteKey(identity);
  const entry = state.entries.get(key) ?? notSaved;
  if (entry.pending || entry.issue === 'unavailable') return;
  if (!current && !entry.favorite && entry.issue !== 'read') return;

  publishEntry(key, { favorite: entry.favorite, pending: true, issue: entry.issue === 'read' ? 'read' : undefined });

  let issue: 'write' | undefined;
  if (entry.issue !== 'read') {
    try {
      if (entry.favorite) {
        await removeFacilityFavorite(identity);
        publishEntry(key, notSaved);
        return;
      }
      if (current && (await addFacilityFavorite(current)).status !== 'available') {
        publishEntry(key, { issue: 'unavailable' });
        return;
      }
    } catch {
      issue = 'write';
    }
  }

  // Read back the saved row after insertion, or recheck an uncertain write result.
  try {
    publishEntry(key, { favorite: await getFacilityFavorite(identity), issue });
  } catch {
    publishEntry(key, { favorite: entry.favorite, issue: 'read' });
  }
}

export function useFacilityFavorite(current: FacilityDisplayIdentity) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  const resolved = resolveFacilityIdentity(current);
  if (resolved.status !== 'available') return { issue: 'unavailable' as const, busy: false };

  const entry = snapshot.entries.get(facilityFavoriteKey(resolved.identity)) ?? notSaved;
  if (entry.issue === 'unavailable') return { issue: 'unavailable' as const, busy: false };

  const busy = snapshot.status === 'loading' || !!entry.pending;
  return {
    facility: resolved.facility,
    saved: snapshot.status === 'ready' && entry.issue !== 'read' ? !!entry.favorite : undefined,
    busy,
    issue: snapshot.status === 'error' ? 'read' as const : entry.issue,
    onPress: busy ? undefined : () => pressFavorite(current),
  };
}

export function useFacilityFavorites() {
  const { status, entries } = useSyncExternalStore(subscribe, getSnapshot);
  const items = useMemo(() => Array.from(entries).flatMap(([key, entry]) => entry.favorite
    ? [{ key, favorite: entry.favorite, pending: !!entry.pending, issue: entry.issue }] : [])
    .sort((a, b) => b.favorite.createdAt - a.favorite.createdAt
      || a.favorite.source.localeCompare(b.favorite.source)
      || a.favorite.stableFacilityId.localeCompare(b.favorite.stableFacilityId)), [entries]);
  return { status, items };
}

export function removeSavedFacility(identity: FacilityFavoriteIdentity) {
  return changeFavorite(identity);
}
