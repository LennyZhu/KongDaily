import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

type RefreshEta = () => Promise<void> | undefined;
export type RegisterHomeEtaRefresh = (refresh: RefreshEta) => () => void;

export function useHomeEtaRegistration(register: RegisterHomeEtaRefresh | undefined, refresh: RefreshEta) {
  useEffect(() => register?.(refresh), [register, refresh]);
}

export function useHomeEtaRefresh() {
  const callbacks = useRef(new Set<RefreshEta>());
  const cycle = useRef<symbol | undefined>(undefined);
  const focused = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const register = useCallback<RegisterHomeEtaRefresh>((refresh) => {
    callbacks.current.add(refresh);
    return () => { callbacks.current.delete(refresh); };
  }, []);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    function stop() {
      if (!cycle.current) return;
      cycle.current = undefined;
      setRefreshing(false);
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') stop();
    });
    return () => {
      focused.current = false;
      subscription.remove();
      stop();
    };
  }, []));

  const refresh = useCallback(async () => {
    if (!focused.current || (AppState.currentState && AppState.currentState !== 'active') || cycle.current) return;
    const current = cycle.current = Symbol();
    setRefreshing(true);
    await Promise.allSettled(Array.from(callbacks.current, async (read) => read()));
    if (cycle.current !== current) return;
    cycle.current = undefined;
    setRefreshing(false);
  }, []);

  return { refreshing, refresh, register };
}
