import { useCallback } from 'react';

import { readMtrNextTrains } from '@/mtr-next-train-client';
import { mtrClock } from '@/mtr-realtime';
import { useNextTrainReading } from '@/next-train-hooks';

export function useMtrNextTrains(line: string, station: string, autoRefresh = false) {
  const read = useCallback(() => readMtrNextTrains(line, station), [line, station]);
  return useNextTrainReading(`${line}-${station}`, read, mtrClock, autoRefresh);
}
