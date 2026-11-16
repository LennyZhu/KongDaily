import { useEffect, useState } from 'react';

import { BusFeedError } from '@/bus-data';
import {
  isStopDataFresh, readBusStops, readRouteStops, refreshBusStop, refreshRouteStops, routeStopMaxAge, stopNameMaxAge,
  type CachedBusStop, type CachedRouteStops,
} from '@/bus-stop-data';
import { routeStopKey, type RouteSequenceChoice, type StopNameSource } from '@/bus-stops';

export type SequenceState = {
  snapshot?: CachedRouteStops;
  loading: boolean;
  fromCache?: boolean;
  changed?: boolean;
  error?: BusFeedError;
};

function loadError(error: unknown) {
  return error instanceof BusFeedError ? error : new BusFeedError('network');
}

export function useRouteSequences(choices: RouteSequenceChoice[]) {
  const [sequences, setSequences] = useState<Record<string, SequenceState>>({});
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    function publish(key: string, value: SequenceState) {
      if (active) setSequences((current) => ({ ...current, [key]: value }));
    }

    for (const { identity } of choices) {
      const key = routeStopKey(identity);
      void (async () => {
        const cached = await readRouteStops(identity);
        if (!active) return;
        const fresh = cached && isStopDataFresh(cached.fetchedAt, routeStopMaxAge);
        if (fresh) {
          publish(key, { snapshot: cached, loading: false, fromCache: true });
          return;
        }
        setSequences((current) => ({
          ...current,
          [key]: { snapshot: cached ?? current[key]?.snapshot, loading: true, fromCache: Boolean(cached) },
        }));
        try {
          const result = await refreshRouteStops(identity);
          const changed = Boolean(cached && (
            cached.stops.length !== result.stops.length
            || cached.stops.some((stop, index) => stop.id !== result.stops[index]?.id || stop.seq !== result.stops[index]?.seq)
          ));
          publish(key, { snapshot: result, loading: false, changed });
        } catch (error) {
          if (active) setSequences((current) => ({
            ...current,
            [key]: { ...current[key], loading: false, error: loadError(error) },
          }));
        }
      })();
    }

    return () => { active = false; };
  }, [choices, attempt]);

  return { sequences, retry: () => setAttempt((value) => value + 1) };
}

export type StopNameState = { snapshot?: CachedBusStop; error?: BusFeedError };

export function useRouteStopNames(source: StopNameSource | undefined, ids: string[]) {
  const [names, setNames] = useState<Record<string, StopNameState>>({});
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!source || !ids.length) return;
    const sourceWithStopLookup = source;
    let active = true;
    async function load() {
      const cached = await readBusStops(sourceWithStopLookup, ids);
      if (!active) return;
      setNames((current) => {
        const next = { ...current };
        for (const id of ids) {
          const previous = current[id]?.snapshot;
          const fromDisk = cached[id];
          const snapshot = previous && (!fromDisk || previous.fetchedAt >= fromDisk.fetchedAt) ? previous : fromDisk;
          next[id] = { snapshot };
        }
        return next;
      });

      const pending = ids.filter((id) => !cached[id] || !isStopDataFresh(cached[id].fetchedAt, stopNameMaxAge));
      let nextIndex = 0;
      async function resolveNames() {
        while (active && nextIndex < pending.length) {
          const id = pending[nextIndex++];
          try {
            const snapshot = await refreshBusStop(sourceWithStopLookup, id);
            if (active) setNames((current) => ({ ...current, [id]: { snapshot } }));
          } catch (error) {
            if (active) setNames((current) => ({
              ...current, [id]: { ...current[id], error: loadError(error) },
            }));
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(pending.length, source === 'citybus' ? 3 : 4) }, resolveNames));
    }
    void load();
    return () => { active = false; };
  }, [source, ids, attempt]);

  return { names, retry: () => setAttempt((value) => value + 1) };
}
