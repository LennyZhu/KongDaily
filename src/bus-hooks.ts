import { useEffect, useRef, useState } from 'react';

import { BusFeedError, isBusFeedFresh, readBusFeeds, readBusHistory, refreshBusFeed, type BusFeedFailure, type BusFeeds, type BusHistoryItem } from '@/bus-data';
import { busSources, type BusSource } from '@/bus-routes';

export function useBusCatalogue(enabled = true) {
  const [feeds, setFeeds] = useState<BusFeeds>({});
  const [failed, setFailed] = useState<Partial<Record<BusSource, BusFeedFailure>>>({});
  const [loading, setLoading] = useState(true);
  const [retrySources, setRetrySources] = useState<BusSource[]>();

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setLoading(true);
    setFailed({});

    async function load() {
      const cached = await readBusFeeds();
      if (!active) return;
      setFeeds((current) => {
        const merged = { ...current };
        for (const source of busSources) {
          const fromDisk = cached[source];
          const inMemory = current[source];
          if (fromDisk && (!inMemory || fromDisk.fetchedAt > inMemory.fetchedAt)) merged[source] = fromDisk;
        }
        return merged;
      });

      const needsRefresh = retrySources ?? busSources.filter((source) => {
        const feed = cached[source];
        return !feed || !isBusFeedFresh(feed);
      });
      await Promise.all(needsRefresh.map(async (source) => {
        try {
          const feed = await refreshBusFeed(source);
          if (active) setFeeds((current) => ({ ...current, [source]: feed }));
        } catch (error) {
          const kind = error instanceof BusFeedError ? error.kind : 'network';
          if (active) setFailed((current) => ({ ...current, [source]: kind }));
        }
      }));
      if (active) setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [enabled, retrySources]);

  return { feeds, failed, loading: enabled && loading,
    retry: () => setRetrySources(busSources.filter((source) => failed[source])) };
}

export function useBusHistory() {
  const [history, setHistory] = useState<BusHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyFailed, setHistoryFailed] = useState(false);
  const pending = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    pending.current = readBusHistory().then(
      (result) => { if (active) setHistory(result); },
      () => { if (active) setHistoryFailed(true); },
    ).finally(() => { if (active) setLoadingHistory(false); });
    return () => { active = false; };
  }, []);

  function changeHistory(operation: () => Promise<void>) {
    pending.current = pending.current.then(async () => {
      await operation();
      setHistory(await readBusHistory());
      setHistoryFailed(false);
    }).catch(() => setHistoryFailed(true));
  }

  return { history, loadingHistory, historyFailed, changeHistory };
}
