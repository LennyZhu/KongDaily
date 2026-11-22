import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import {
  busFavoriteId, readBusFavorites, unavailableFavoriteIds, writeBusFavorites, type BusFavorite, type BusVisitSummary, type FavoriteChange,
} from '@/bus-favorites';

type StopSaveStatus = 'saving' | 'failed';
type FavoritesState = {
  items: BusFavorite[];
  status: 'loading' | 'ready' | 'error';
  stopSaves: ReadonlyMap<string, StopSaveStatus>;
};
let state: FavoritesState = { items: [], status: 'loading', stopSaves: new Map() };
const listeners = new Set<() => void>();
let loading: Promise<void> | undefined;
let writes = Promise.resolve();

function publish(next: FavoritesState) {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getSnapshot() {
  return state;
}

export function loadBusFavorites() {
  if (state.status === 'ready') return Promise.resolve();
  if (loading) return loading;
  publish({ ...state, status: 'loading' });
  loading = readBusFavorites().then(
    (items) => publish({ ...state, items, status: 'ready' }),
    () => publish({ ...state, status: 'error' }),
  ).finally(() => { loading = undefined; });
  return loading;
}

export function changeBusFavorites(change: FavoriteChange, { readBackOnFailure = false } = {}) {
  const request = writes.then(async () => {
    try {
      await loadBusFavorites();
      const { items, outcome } = await writeBusFavorites(change);
      publish({ ...state, items, status: 'ready' });
      return outcome;
    } catch {
      if (readBackOnFailure) {
        // Stay on the write queue so an older read cannot replace the next write's result.
        try {
          const items = await readBusFavorites();
          publish({ ...state, items, status: 'ready' });
        } catch {
          publish({ ...state, status: 'error' });
        }
      }
      return 'failed' as const;
    }
  });
  writes = request.then(() => {});
  return request;
}

export function useBusFavorites() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  useEffect(() => { void loadBusFavorites(); }, []);
  return snapshot;
}

function setStopSaveStatus(id: string, status?: StopSaveStatus) {
  const stopSaves = new Map(state.stopSaves);
  if (status) stopSaves.set(id, status);
  else stopSaves.delete(id);
  publish({ ...state, stopSaves });
}

async function toggleStopFavorite(visit: BusVisitSummary) {
  const id = busFavoriteId(visit.target);
  if (state.status !== 'ready' || state.stopSaves.get(id) === 'saving') return;
  const saved = state.items.some((item) => item.id === id);
  setStopSaveStatus(id, 'saving');
  const result = await changeBusFavorites(
    saved ? { type: 'remove', id } : { type: 'save', visit },
    { readBackOnFailure: true },
  );
  setStopSaveStatus(id, result === 'failed' ? 'failed' : undefined);
}

export function useBusStopFavorite(visit: BusVisitSummary) {
  const { items, status, stopSaves } = useBusFavorites();
  const id = busFavoriteId(visit.target);
  const pending = stopSaves.get(id);
  return {
    saved: status === 'ready' ? items.some((item) => item.id === id) : undefined,
    loading: status === 'loading',
    saving: pending === 'saving',
    loadFailed: status === 'error',
    saveFailed: pending === 'failed',
    onPress: pending === 'saving' || status === 'loading' ? undefined
      : status === 'error' ? loadBusFavorites : () => toggleStopFavorite(visit),
  };
}

const noUnavailable: ReadonlySet<string> = new Set();

export function useUnavailableFavorites(favorites: readonly BusFavorite[]) {
  const [unavailable, setUnavailable] = useState(noUnavailable);
  useFocusEffect(useCallback(() => {
    if (!favorites.length) return;
    let active = true;
    void unavailableFavoriteIds(favorites).then((ids) => {
      if (active) setUnavailable(ids);
    });
    return () => { active = false; };
  }, [favorites]));
  return unavailable;
}
