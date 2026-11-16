import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { BusFeedError } from '@/bus-data';
import { etaManualInterval, etaPollInterval } from '@/bus-eta-hooks';
import { fallbackNlbEtaText, type EtaLocale } from '@/bus-eta';
import type { BusSource } from '@/bus-routes';
import { fetchStationEta, stationEtaError, stationEtaJobs, type StationEtaJob, type StationEtaRecord, type StationRoute } from '@/nearby-stop-routes';

type StoredRecord = StationEtaRecord & { locale?: EtaLocale };
const maxConcurrent = 2;
const limited = new BusFeedError('http', 429);
const blockedUntil = new Map<BusSource, number>();

export function useStationEta(routes: StationRoute[], locale: EtaLocale) {
  const jobs = useMemo(() => stationEtaJobs(routes, locale), [routes, locale]);
  const [records, setRecords] = useState<Record<string, StoredRecord>>({});
  const [now, setNow] = useState(Date.now);
  const [refreshAfter, setRefreshAfter] = useState(0);
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const visible = useRef(new Set<string>());
  const nextDue = useRef(new Map<string, number>());
  const lastStarted = useRef(new Map<string, number>());
  const requestAfter = useRef(0);
  const wake = useRef<((manual?: boolean) => void) | undefined>(undefined);

  const setVisible = useCallback((ids: string[]) => {
    visible.current = new Set(ids);
    setVisibleIds(ids);
    wake.current?.();
  }, []);

  useFocusEffect(useCallback(() => {
    if (jobs.length === 0) return;
    const inFlight = new Map<string, AbortController>();
    let active = false;
    let ticker: ReturnType<typeof setInterval> | undefined;

    function start(job: StationEtaJob, startedAt: number) {
      const controller = new AbortController();
      inFlight.set(job.url, controller);
      lastStarted.current.set(job.url, startedAt);
      nextDue.current.set(job.url, startedAt + etaPollInterval);
      requestAfter.current = startedAt + etaManualInterval;
      setRefreshAfter(requestAfter.current);
      setBusy(true);

      void fetchStationEta(job, controller.signal).then((arrivals) => {
        if (controller.signal.aborted) return;
        setRecords((previous) => {
          const next = { ...previous };
          for (const [id, record] of Object.entries(arrivals)) {
            const old = previous[id];
            if (!record.snapshot) next[id] = { ...old, error: record.error };
            else {
              const snapshot = old?.snapshot && old.locale !== locale
                ? fallbackNlbEtaText(record.snapshot, old.snapshot)
                : record.snapshot;
              next[id] = { ...record, snapshot, locale };
            }
          }
          return next;
        });
      }, (failure: unknown) => {
        if (controller.signal.aborted) return;
        const error = stationEtaError(failure);
        if (error.status === 429) {
          blockedUntil.set(job.source, Date.now() + etaPollInterval);
        }
        setRecords((previous) => {
          const next = { ...previous };
          for (const { id } of job.routes) next[id] = { ...previous[id], error };
          return next;
        });
      }).finally(() => {
        if (inFlight.get(job.url) !== controller) return;
        inFlight.delete(job.url);
        setNow(Date.now());
        setBusy(inFlight.size > 0);
        pump();
      });
    }

    function pump(manual = false) {
      const time = Date.now();
      if (!active || (manual && time < requestAfter.current)) return;
      const eligible = jobs.filter((job) => time >= (blockedUntil.get(job.source) ?? 0)
        && !inFlight.has(job.url) && job.routes.some(({ id }) => visible.current.has(id)));
      if (manual) {
        for (const job of eligible) {
          if (time >= (lastStarted.current.get(job.url) ?? 0) + etaManualInterval) nextDue.current.set(job.url, time);
        }
      }
      for (const job of eligible) {
        if (inFlight.size >= maxConcurrent) break;
        if (time >= (nextDue.current.get(job.url) ?? 0)) start(job, time);
      }
    }

    function pause() {
      active = false;
      clearInterval(ticker);
      for (const [url, controller] of inFlight) {
        controller.abort();
        nextDue.current.set(url, (lastStarted.current.get(url) ?? 0) + etaManualInterval);
      }
      inFlight.clear();
    }

    function resume() {
      if (active) return;
      active = true;
      setNow(Date.now());
      setBusy(false);
      pump();
      ticker = setInterval(() => { setNow(Date.now()); pump(); }, 1_000);
    }

    wake.current = pump;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') resume();
      else pause();
    });
    if (AppState.currentState === 'active') resume();
    return () => {
      subscription.remove();
      wake.current = undefined;
      pause();
    };
  }, [jobs, locale]));

  const rateLimits: Partial<Record<BusSource, BusFeedError>> = {};
  for (const [source, until] of blockedUntil) {
    if (now < until) rateLimits[source] = limited;
  }
  const source = routes[0]?.target.source;
  return {
    records, now, busy, setVisible, refresh: () => wake.current?.(true),
    rateLimits, rateLimit: source && rateLimits[source],
    canRefresh: !busy && now >= refreshAfter
      && routes.some(({ id, target }) => !rateLimits[target.source] && visibleIds.includes(id)),
  };
}
