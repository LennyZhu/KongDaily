import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { BusFeedError } from '@/bus-data';
import { etaUrl, fallbackNlbEtaText, fetchEta, type EtaLocale, type EtaSnapshot, type EtaTarget } from '@/bus-eta';

export const etaPollInterval = 60_000;
export const etaManualInterval = 10_000;

export function useBusEta(target: EtaTarget, locale: EtaLocale, enabled = true, cooldowns?: Map<string, number>) {
  const [result, setResult] = useState<{ url: string; snapshot: EtaSnapshot }>();
  const [error, setError] = useState<BusFeedError>();
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now);
  const [refreshAfter, setRefreshAfter] = useState(0);
  const active = useRef(false);
  const inFlight = useRef<{ controller: AbortController; done: Promise<void> } | null>(null);
  const lastUrl = useRef<string | undefined>(undefined);
  const nextPoll = useRef(0);
  const nextManual = useRef(0);
  const rateLimitedUntil = useRef(0);
  const url = etaUrl(target, locale);

  const refresh = useCallback((manual = false) => {
    const startedAt = Date.now();
    if (!active.current) return;
    if (inFlight.current) return inFlight.current.done;
    if (startedAt < rateLimitedUntil.current) return;
    if (startedAt < (cooldowns?.get(target.source) ?? 0)) {
      setError((current) => current?.status === 429 ? current : new BusFeedError('http', 429));
      setLoading(false);
      return;
    }
    const threshold = manual ? nextManual.current : nextPoll.current;
    if ((url === lastUrl.current && startedAt < threshold) || startedAt < (cooldowns?.get(url) ?? 0)) return;

    const controller = new AbortController();
    lastUrl.current = url;
    nextManual.current = startedAt + etaManualInterval;
    nextPoll.current = startedAt + etaPollInterval;
    cooldowns?.set(url, nextManual.current);
    setRefreshAfter(nextManual.current);
    setNow(startedAt);
    setLoading(true);
    const done = fetchEta(target, url, controller.signal).then(
      (snapshot) => {
        if (controller.signal.aborted) return;
        setResult((previous) => ({
          url, snapshot: previous && previous.url !== url ? fallbackNlbEtaText(snapshot, previous.snapshot) : snapshot,
        }));
        setError(undefined);
      },
      (failure: unknown) => {
        if (controller.signal.aborted) return;
        const nextError = failure instanceof BusFeedError ? failure : new BusFeedError('network');
        if (nextError.status === 429) {
          rateLimitedUntil.current = Date.now() + etaPollInterval;
          cooldowns?.set(target.source, rateLimitedUntil.current);
          setRefreshAfter(rateLimitedUntil.current);
        }
        setError(nextError);
      },
    ).finally(() => {
      if (inFlight.current?.controller !== controller) return;
      inFlight.current = null;
      setNow(Date.now());
      setLoading(false);
    });
    inFlight.current = { controller, done };
    return done;
  }, [cooldowns, target, url]);
  const refreshManually = useCallback(() => refresh(true), [refresh]);

  useFocusEffect(useCallback(() => {
    if (!enabled) return;
    let ticker: ReturnType<typeof setInterval> | undefined;
    function pause() {
      active.current = false;
      clearInterval(ticker);
      if (inFlight.current) {
        inFlight.current.controller.abort();
        inFlight.current = null;
        // Retry an interrupted request after the short request cooldown.
        nextPoll.current = nextManual.current;
      }
    }
    function resume() {
      if (active.current) return;
      active.current = true;
      setLoading(false);
      setNow(Date.now());
      refresh();
      ticker = setInterval(() => {
        setNow(Date.now());
        refresh();
      }, 1_000);
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') resume();
      else pause();
    });
    if (AppState.currentState === 'active') resume();
    return () => {
      subscription.remove();
      pause();
    };
  }, [enabled, refresh]));

  const canRefresh = enabled && !loading && now >= refreshAfter;
  return { snapshot: result?.snapshot, error, now, loading, canRefresh, refresh: refreshManually };
}
