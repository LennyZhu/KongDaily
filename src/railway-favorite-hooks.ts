import { useEffect, useSyncExternalStore } from 'react';

import { listRailwayFavorites, railwayFavoriteId, resolveRailwayService, setRailwayFavorite,
  type RailwayFavorite, type RailwayFavoriteIdentity } from '@/railway-favorites';

type State = {
  items: RailwayFavorite[];
  status: 'loading' | 'ready' | 'error';
  operations: ReadonlyMap<string, 'saving' | 'failed' | 'uncertain'>;
};
let state: State = { items: [], status: 'loading', operations: new Map() };
let loading: Promise<void> | undefined;
let writes: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const getSnapshot = () => state;
function publish(next: State) { state = next; for (const listener of listeners) listener(); }
function operation(id: string, value?: 'saving' | 'failed' | 'uncertain') {
  const operations = new Map(state.operations);
  if (value) operations.set(id, value); else operations.delete(id);
  publish({ ...state, operations });
}

export function loadRailwayFavorites() {
  if (state.status === 'ready') return Promise.resolve();
  if (loading) return loading;
  publish({ ...state, status: 'loading' });
  loading = listRailwayFavorites().then(
    (items) => publish({ ...state, items, status: 'ready' }),
    () => publish({ ...state, status: 'error' }),
  ).finally(() => { loading = undefined; });
  return loading;
}

async function changeFavorite(identity: RailwayFavoriteIdentity, removeOnly = false) {
  if (state.status === 'loading') return;
  if (state.status === 'error') { await loadRailwayFavorites(); return; }
  const id = railwayFavoriteId(identity);
  const previous = state.operations.get(id);
  if (previous === 'saving') return;
  const saved = state.items.some((item) => item.id === id);
  if (!saved && (removeOnly || !resolveRailwayService(identity))) return;
  operation(id, 'saving');
  const request = writes.then(async () => {
    let failed = false;
    // An uncertain write must be read back before another toggle can be attempted.
    if (previous !== 'uncertain') {
      try { await setRailwayFavorite(identity, !saved); } catch { failed = true; }
    }
    try {
      const items = await listRailwayFavorites();
      publish({ ...state, items });
      operation(id, failed ? 'failed' : undefined);
    } catch { operation(id, 'uncertain'); }
  });
  writes = request.catch(() => undefined);
  await request;
}

export function useRailwayFavorites() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  useEffect(() => { void loadRailwayFavorites(); }, []);
  return snapshot;
}

export function useRailwayFavorite(identity: RailwayFavoriteIdentity) {
  const snapshot = useRailwayFavorites();
  const id = railwayFavoriteId(identity);
  const current = snapshot.operations.get(id);
  return {
    saved: snapshot.items.some((item) => item.id === id),
    busy: snapshot.status === 'loading' || current === 'saving',
    issue: snapshot.status === 'error' || current === 'uncertain' ? 'read' as const : current === 'failed' ? 'write' as const : undefined,
    onPress: () => changeFavorite(identity),
  };
}

export function removeSavedRailway(identity: RailwayFavoriteIdentity) { return changeFavorite(identity, true); }

export async function saveRailwayToHome(identity: RailwayFavoriteIdentity) {
  try {
    const result = await setRailwayFavorite(identity, true, true);
    if (!result) return 'failed' as const;
    publish({ ...state, items: result.items, status: 'ready' });
    return result.outcome;
  } catch { return 'failed' as const; }
}
