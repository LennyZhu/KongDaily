import snapshot from '../assets/data/light-rail-static.json';

export type LightRailDirection = '1' | '2';
type LightRailVisit = { stopId: string; sequence: number };
export type LightRailPattern = { direction: LightRailDirection; visits: readonly LightRailVisit[] };
export type LightRailRoute = {
  kind: 'light-rail-route';
  id: string;
  circular: boolean;
  patterns: readonly LightRailPattern[];
};
export type LightRailStop = {
  kind: 'light-rail-stop';
  id: string;
  code: string;
  zh: string;
  en: string;
  routes: readonly string[];
};
export type LightRailEntry = LightRailRoute | LightRailStop;

export const lightRailSource = snapshot.source;

const directions: readonly LightRailDirection[] = ['1', '2'];
export const lightRailRoutes: readonly LightRailRoute[] = Object.entries(snapshot.routes)
  .sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))
  .map(([id, { circular, directions: sequences }]) => ({
    kind: 'light-rail-route', id, circular,
    patterns: directions.map((direction) => ({
      direction,
      visits: sequences[direction].map((stopId, index) => ({ stopId, sequence: index + 1 })),
    })),
  }));

const routesByStop = new Map<string, Set<string>>();
for (const route of lightRailRoutes) {
  for (const pattern of route.patterns) {
    for (const { stopId } of pattern.visits) {
      const routes = routesByStop.get(stopId) ?? new Set<string>();
      routes.add(route.id);
      routesByStop.set(stopId, routes);
    }
  }
}

export const lightRailStops: readonly LightRailStop[] = Object.entries(snapshot.stops)
  .map(([id, stop]): LightRailStop => ({ kind: 'light-rail-stop', id, ...stop, routes: [...(routesByStop.get(id) ?? [])] }))
  .sort((a, b) => a.en.localeCompare(b.en) || a.id.localeCompare(b.id));

const routesById = new Map(lightRailRoutes.map((route) => [route.id, route]));
const stopsById = new Map(lightRailStops.map((stop) => [stop.id, stop]));

export function findLightRailRoute(id: unknown) {
  return typeof id === 'string' ? routesById.get(id) : undefined;
}

export function findLightRailStop(id: unknown) {
  return typeof id === 'string' ? stopsById.get(id) : undefined;
}

function normalize(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toUpperCase();
}

const searchIndex: { entry: LightRailEntry; terms: string[] }[] = [
  ...lightRailRoutes.map((entry) => ({ entry, terms: [entry.id] })),
  ...lightRailStops.map((entry) => ({ entry, terms: [entry.id, entry.code, entry.zh, entry.en].map(normalize) })),
];

export function searchLightRail(input: string) {
  const query = normalize(input);
  if (!query) return [];
  return searchIndex.flatMap(({ entry, terms }) => {
    if (terms.includes(query)) return [{ entry, rank: 0 }];
    if (terms.some((term) => term.startsWith(query))) return [{ entry, rank: 1 }];
    if (terms.some((term) => term.includes(query))) return [{ entry, rank: 2 }];
    return [];
  }).sort((a, b) => a.rank - b.rank).map(({ entry }) => entry);
}
