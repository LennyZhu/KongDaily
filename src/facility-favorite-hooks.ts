import { useSyncExternalStore } from 'react';

import { addFacilityFavorite, isFacilityFavorite, listFacilityFavorites, removeFacilityFavorite } from '@/facility-favorites';
import { facilityFavoriteKey, resolveFacilityIdentity, type FacilityDisplayIdentity } from '@/facility-identity';

type FavoriteIssue = 'read' | 'write' | 'unavailable';
type FavoriteEntry = { saved?: boolean; pending?: boolean; issue?: FavoriteIssue };
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
      entries: new Map(items.map((item) => [facilityFavoriteKey(item), { saved: true }])),
    }),
    () => publish({ ...state, status: 'error' }),
  ).finally(() => { loading = undefined; });
  if (state.status !== 'loading') publish({ ...state, status: 'loading' });
  return loading;
}

const notSaved: FavoriteEntry = { saved: false };

function publishEntry(key: string, entry: FavoriteEntry) {
  const entries = new Map(state.entries);
  if (entry.saved === false && !entry.pending && !entry.issue) entries.delete(key);
  else entries.set(key, entry);
  publish({ ...state, entries });
}

async function pressFavorite(current: FacilityDisplayIdentity) {
  const resolved = resolveFacilityIdentity(current);
  if (resolved.status !== 'available' || state.status === 'loading') return;
  if (state.status === 'error') {
    await loadFacilityFavorites();
    return;
  }
  const { identity } = resolved;
  const key = facilityFavoriteKey(identity);
  const entry = state.entries.get(key) ?? notSaved;
  if (entry.pending || entry.issue === 'unavailable') return;

  publishEntry(key, { saved: entry.saved, pending: true });

  if (entry.saved === undefined) {
    try {
      publishEntry(key, { saved: await isFacilityFavorite(identity) });
    } catch {
      publishEntry(key, { issue: 'read' });
    }
    return;
  }

  try {
    if (entry.saved) await removeFacilityFavorite(identity);
    else if ((await addFacilityFavorite(current)).status !== 'available') {
      publishEntry(key, { issue: 'unavailable' });
      return;
    }
    publishEntry(key, { saved: !entry.saved });
  } catch {
    // Recheck after a rejected write, including failures whose commit result is uncertain.
    try {
      publishEntry(key, { saved: await isFacilityFavorite(identity), issue: 'write' });
    } catch {
      publishEntry(key, { issue: 'read' });
    }
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
    saved: snapshot.status === 'ready' ? entry.saved : undefined,
    busy,
    issue: snapshot.status === 'error' ? 'read' as const : entry.issue,
    onPress: busy ? undefined : () => pressFavorite(current),
  };
}
