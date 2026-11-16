import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import {
  readBusFavorites, unavailableFavoriteIds, writeBusFavorites, type BusFavorite, type FavoriteChange,
} from '@/bus-favorites';

type FavoritesState = { items: BusFavorite[]; status: 'loading' | 'ready' | 'error' };
let state: FavoritesState = { items: [], status: 'loading' };
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
    (items) => publish({ items, status: 'ready' }),
    () => publish({ ...state, status: 'error' }),
  ).finally(() => { loading = undefined; });
  return loading;
}

export function changeBusFavorites(change: FavoriteChange) {
  const request = writes.then(async () => {
    await loadBusFavorites();
    const { items, outcome } = await writeBusFavorites(change);
    publish({ items, status: 'ready' });
    return outcome;
  }).catch(() => 'failed' as const);
  writes = request.then(() => {});
  return request;
}

export function useBusFavorites() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  useEffect(() => { void loadBusFavorites(); }, []);
  return snapshot;
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
