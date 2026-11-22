import { useCallback, useEffect, useState } from 'react';

import { gmbSearchCode, searchGmbRoutes } from '@/gmb-search';

export function useGmbQuery<Result>(read: (signal: AbortSignal) => Promise<Result>, enabled = true, delay = 0) {
  const [attempt, setAttempt] = useState(0);
  const [sample, setSample] = useState<{ read: typeof read; attempt: number; result: Result }>();
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const load = () => {
      void read(controller.signal).then((result) => {
        if (!controller.signal.aborted) setSample({ read, attempt, result });
      });
    };
    const timer = delay ? setTimeout(load, delay) : undefined;
    if (!delay) load();
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [read, attempt, enabled, delay]);

  return { result: enabled && sample?.read === read && sample.attempt === attempt ? sample.result : undefined, retry };
}

const loading = { status: 'loading' } as const;
export function useGmbSearch(query: string, enabled: boolean, delay = 0) {
  const code = enabled ? gmbSearchCode(query) : '';
  const read = useCallback((signal: AbortSignal) => searchGmbRoutes(code, signal), [code]);
  const { result, retry } = useGmbQuery(read, !!code, delay);
  return { state: code ? result ?? loading : undefined, retry };
}
