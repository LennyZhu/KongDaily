import { useCallback } from 'react';

import { readLightRailNextTrains } from '@/light-rail-next-train-client';
import { useNextTrainReading } from '@/next-train-hooks';
import { nextTrainClock } from '@/next-train-time';

export function useLightRailNextTrains(stationId: string, autoRefresh = false) {
  const read = useCallback(() => readLightRailNextTrains(stationId), [stationId]);
  return useNextTrainReading(stationId, read, nextTrainClock, autoRefresh);
}
