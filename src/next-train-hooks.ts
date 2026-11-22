import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { nextTrainClock, type NextTrainReading } from '@/next-train-time';

export function useNextTrainReading<Payload>(key: string, read: () => Promise<NextTrainReading<Payload>>, clock = nextTrainClock, autoRefresh = false) {
  const [sample, setSample] = useState<{ key: string; reading: NextTrainReading<Payload> }>();
  const [now, setNow] = useState(clock);
  const [busy, setBusy] = useState(true);
  const refresh = useRef<() => void>(undefined);

  useFocusEffect(useCallback(() => {
    let active = false;
    let pending = false;
    let generation = 0;
    let retryAt = Infinity;
    let ticker: ReturnType<typeof setInterval> | undefined;

    function load() {
      if (!active || pending) return;
      pending = true;
      const attempt = ++generation;
      setBusy(true);
      void read().then((sample) => {
        if (!active || generation !== attempt) return;
        pending = false;
        retryAt = sample.retryAt;
        setSample({ key, reading: sample });
        setNow(clock());
        setBusy(false);
      });
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
      pending = false;
      generation++;
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

  return { reading: sample?.key === key ? sample.reading : undefined, now, busy, refresh: () => refresh.current?.() };
}
