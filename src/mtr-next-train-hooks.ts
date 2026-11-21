import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { readMtrNextTrains } from '@/mtr-next-train-client';
import { mtrClock, type MtrReading } from '@/mtr-realtime';

export function useMtrNextTrains(line: string, station: string) {
  const pair = `${line}-${station}`;
  const [sample, setSample] = useState<{ pair: string; reading: MtrReading }>();
  const [now, setNow] = useState(mtrClock);
  const [busy, setBusy] = useState(true);
  const refresh = useRef<() => void>(undefined);

  useFocusEffect(useCallback(() => {
    let active = false;
    let pending = false;
    let generation = 0;
    let ticker: ReturnType<typeof setInterval> | undefined;

    function load() {
      if (!active || pending) return;
      pending = true;
      const attempt = ++generation;
      setBusy(true);
      void readMtrNextTrains(line, station).then((sample) => {
        if (!active || generation !== attempt) return;
        pending = false;
        setSample({ pair, reading: sample });
        setNow(mtrClock());
        setBusy(false);
      });
    }

    function resume() {
      if (active) return;
      active = true;
      setNow(mtrClock());
      ticker = setInterval(() => setNow(mtrClock()), 1000);
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
  }, [line, pair, station]));

  return { reading: sample?.pair === pair ? sample.reading : undefined, now, busy, refresh: () => refresh.current?.() };
}
