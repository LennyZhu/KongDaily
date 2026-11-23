import { gmbClient } from '@/gmb-client';
import type { GmbEta, GmbResult, GmbVisitKey } from '@/gmb-data';
import { gmbRepeatedStopIds } from '@/gmb-search';
import { gmbBoardingVisit } from '@/nearby-gmb';
import type { NextTrainReading } from '@/next-train-time';

type PinnedGmbForecast =
  | { kind: 'eta'; eta: GmbResult<GmbEta>; first: boolean }
  | { kind: 'changed' | 'ambiguous' };

export async function readPinnedGmbEta(
  visit: GmbVisitKey, signal: AbortSignal, client: Pick<typeof gmbClient, 'readRouteStops' | 'readEta'> = gmbClient,
): Promise<NextTrainReading<PinnedGmbForecast>> {
  const stops = await client.readRouteStops(visit, signal);
  const { payload } = stops;
  if (signal.aborted) return { ...stops, payload: { kind: 'eta', eta: { kind: 'cancelled' }, first: false } };
  if (payload.kind !== 'ready') {
    const missing = payload.kind === 'http' && payload.status === 404;
    return { ...stops, payload: missing ? { kind: 'changed' } : { kind: 'eta', eta: payload, first: false } };
  }
  const { visits } = payload.data;
  if (!gmbBoardingVisit(visit, visits)) return { ...stops, payload: { kind: 'changed' } };
  if (gmbRepeatedStopIds(visits).has(visit.stopId)) return { ...stops, payload: { kind: 'ambiguous' } };
  const eta = await client.readEta(visit, signal);
  return { ...eta, payload: { kind: 'eta', eta: eta.payload, first: visits[0].stopSeq === visit.stopSeq } };
}
