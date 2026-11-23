import { getTramVisitsForStop, listTramRoutes, listTramStops, searchTramStops,
  type TramRoute, type TramStop, type TramVisit } from '@/tram-static';

export type TramRouteSearchResult = { kind: 'tram_route'; key: TramRoute['key']; service: TramRoute };
export type TramStopSearchResult = { kind: 'tram_stop'; key: TramStop['key']; stop: TramStop; visits: readonly TramVisit[] };

function routeTerms(input: string) {
  return input.normalize('NFKC').toLocaleLowerCase('en').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

export function readTramCatalogue(input: string) {
  try {
    const routes = listTramRoutes();
    const stops = listTramStops();
    if (!routes.length || !stops.length) return { status: 'failed' } as const;
    const terms = routeTerms(input);
    const matched = input ? routes.filter(({ localizedRouteNames }) => terms.length > 0
      && Object.values(localizedRouteNames).some((name) => {
        const normalized = routeTerms(name).join(' ');
        return terms.every((term) => normalized.includes(term));
      })) : routes;
    return {
      status: 'ready',
      routes: matched.map((service): TramRouteSearchResult => ({ kind: 'tram_route', key: service.key, service })),
      stops: (input ? searchTramStops(input) : stops).map((stop): TramStopSearchResult => ({
        kind: 'tram_stop', key: stop.key, stop, visits: getTramVisitsForStop(stop.stopId),
      })),
    } as const;
  } catch {
    return { status: 'failed' } as const;
  }
}
