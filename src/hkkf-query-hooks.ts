import { useMemo } from 'react';

import { useGmbQuery } from '@/gmb-query-hooks';
import { hkkfPreviewClient } from '@/hkkf-preview';
import type { HkkfSearchState } from '@/hkkf-search';

async function readRoutes(signal: AbortSignal) {
  return hkkfPreviewClient?.readRoutes(signal);
}

export function useHkkfRoutes(enabled: boolean) {
  const active = enabled && !!hkkfPreviewClient;
  const { result, retry } = useGmbQuery(readRoutes, active);
  const state = useMemo<HkkfSearchState | undefined>(() => {
    if (!active) return;
    if (!result) return { status: 'loading' };
    return result.payload.kind === 'ready' ? { status: 'ready', routes: result.payload.data } : { status: 'failed' };
  }, [active, result]);
  return { state, retry };
}
