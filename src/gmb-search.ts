import { normalizeBusQuery } from '@/bus-routes';
import { gmbClient } from '@/gmb-client';
import { gmbRegions, type GmbRoute, type GmbText, type GmbVisit } from '@/gmb-data';

export type GmbSearchState =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready' | 'partial'; routes: readonly GmbRoute[] };

export function gmbSearchCode(input: string) {
  const code = normalizeBusQuery(input).replace(/ /g, '');
  return /^[A-Z0-9]+$/.test(code) && /\d/.test(code) ? code : '';
}

export async function searchGmbRoutes(code: string, signal: AbortSignal, client = gmbClient): Promise<GmbSearchState> {
  const { payload } = await client.readDirectory(signal);
  if (payload.kind !== 'ready' || signal.aborted) return { status: 'failed' };
  const regions = gmbRegions.filter((region) => payload.data.routes[region].includes(code));
  const matches = await Promise.all(regions.map((region) => client.readRoutesByCode(region, code, signal)));
  const routes = matches.flatMap(({ payload }) => payload.kind === 'ready' ? payload.data : []);
  const failed = matches.filter(({ payload }) => payload.kind !== 'ready').length;
  if (failed && failed === matches.length) return { status: 'failed' };
  return { status: failed ? 'partial' : 'ready', routes };
}

export function gmbText(text: GmbText, locale: 'zh-HK' | 'en') {
  return (locale === 'en' ? text.en?.trim() || text.tc?.trim() : text.tc?.trim() || text.en?.trim()) || text.sc?.trim() || '';
}

export function gmbVisitKey({ routeId, routeSeq, stopSeq, stopId }: GmbVisit) {
  return [routeId, routeSeq, stopSeq, stopId].join(':');
}

export function gmbRepeatedStopIds(visits: readonly GmbVisit[]) {
  const seen = new Set<number>();
  const repeats = new Set<number>();
  for (const { stopId } of visits) {
    if (seen.has(stopId)) repeats.add(stopId);
    seen.add(stopId);
  }
  return repeats;
}
