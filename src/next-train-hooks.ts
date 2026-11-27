import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { nextTrainClock, type NextTrainReading } from '@/next-train-time';

export function useNextTrainReading<Payload>(key: string, read: (signal: AbortSignal) => Promise<NextTrainReading<Payload>>, clock = nextTrainClock, autoRefresh = false) {
  const [sample, setSample] = useState<{ key: string; reading: NextTrainReading<Payload> }>();
  const [now, setNow] = useState(clock);
  const [busy, setBusy] = useState(true);
  const refresh = useRef<() => Promise<void> | undefined>(undefined);
  const refreshManually = useCallback(() => refresh.current?.(), []);

  useFocusEffect(useCallback(() => {
    let active = false;
    let pending: Promise<void> | undefined;
    let request: AbortController | undefined;
    let retryAt = Infinity;
    let ticker: ReturnType<typeof setInterval> | undefined;

    function load() {
      if (!active) return;
      if (pending) return pending;
      const attempt = request = new AbortController();
      setBusy(true);
      pending = read(attempt.signal).then((sample) => {
        if (!active || request !== attempt) return;
        retryAt = sample.retryAt;
        setSample({ key, reading: sample });
      }, () => {
        if (active && request === attempt) retryAt = Infinity;
      }).finally(() => {
        if (!active || request !== attempt) return;
        pending = undefined;
        setNow(clock());
        setBusy(false);
      });
      return pending;
    }

    function resume() {
      if (active) return;
      active = true;
      setNow(clock());
      ticker = setInterval(() => {
        const current = clock();
        setNow(current);
        if (autoRefresh && current.monotonic >= retryAt) load();
      }, 1000);
      load();
    }

    function pause() {
      active = false;
      pending = undefined;
      request?.abort();
      request = undefined;
      clearInterval(ticker);
    }

    refresh.current = load;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') resume();
      else pause();
    });
    if (AppState.currentState === 'active' || AppState.currentState == null) resume();
    return () => {
      pause();
      subscription.remove();
      refresh.current = undefined;
    };
  }, [autoRefresh, clock, key, read]));

  return { reading: sample?.key === key ? sample.reading : undefined, now, busy, refresh: refreshManually };
}
