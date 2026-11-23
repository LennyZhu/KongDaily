import type { FerryDirection, FerryName, FerryPierId, FerryRoute } from '@/ferry-data';
import { hkkfDirection, hkkfPierDisplayName, hkkfRouteName, type HkkfRouteId } from '@/hkkf-data';
import { hkkfSearchText, matchHkkfRoutes } from '@/hkkf-search';
import { distanceBetween, type BusSearchRadius, type Coordinates } from '@/nearby-bus-data';

type Sailing = { id: string; name: FerryName; direction: FerryDirection };
type Pier = { id: FerryPierId; name: FerryName; point: Coordinates; sailings: readonly Sailing[] };
export type FerryNearbyRouteRow = { kind: 'nearby-ferry-route'; id: string; sailing: Sailing; distance?: number };
export type FerryNearbyPierRow = { kind: 'nearby-ferry-pier'; id: FerryPierId; pier: Pier; distance?: number };
export type FerryNearbyRow = FerryNearbyRouteRow | FerryNearbyPierRow;

const routeIds = [1, 2, 3, 4] as const satisfies readonly HkkfRouteId[];
const routes: readonly FerryRoute[] = routeIds.map((id) => ({
  operatorId: 'hkkf', operatorRouteId: String(id), routeId: `hkkf:route:${id}`, name: hkkfRouteName(id),
  directions: [hkkfDirection(id, 'outbound'), hkkfDirection(id, 'inbound')],
}));

// Phase 4B0 official HKKF /opendata/pier/{pier_id} snapshot, 2026-11-22 HKT.
const coordinates = {
  'hkkf:pier:1': { latitude: 22.288007, longitude: 114.158389 },
  'hkkf:pier:2': { latitude: 22.287462, longitude: 114.160330 },
  'hkkf:pier:3': { latitude: 22.226520, longitude: 114.109105 },
  'hkkf:pier:4': { latitude: 22.284587, longitude: 114.037164 },
  'hkkf:pier:5': { latitude: 22.206086, longitude: 114.131543 },
  'hkkf:pier:6': { latitude: 22.2579923, longitude: 114.0277868 },
} satisfies Record<FerryPierId, Coordinates>;

export const hkkfNearbyPiers: readonly Pier[] = (Object.keys(coordinates) as (keyof typeof coordinates)[]).flatMap((id) => {
  const name = hkkfPierDisplayName(id);
  if (!name) return [];
  const sailings = routes.flatMap((route) => route.directions.filter(({ originPierId }) => originPierId === id)
    .map((direction) => ({ id: `${direction.routeId}:${direction.directionId}`, name: route.name, direction })));
  return [{ id, name, point: coordinates[id], sailings }];
});

function routeRows(piers: readonly FerryNearbyPierRow[], matches?: ReadonlySet<string>) {
  const rows = new Map<string, FerryNearbyRouteRow>();
  for (const { pier, distance } of piers) {
    for (const sailing of pier.sailings) {
      if ((!matches || matches.has(sailing.direction.routeId)) && !rows.has(sailing.id)) {
        rows.set(sailing.id, { kind: 'nearby-ferry-route', id: sailing.id, sailing, distance });
      }
    }
  }
  return [...rows.values()];
}

export function nearbyHkkfRows(center: Coordinates, radius: BusSearchRadius, view: 'routes' | 'stops',
  piers = hkkfNearbyPiers): FerryNearbyRow[] {
  const rows = piers.map((pier) => ({
    kind: 'nearby-ferry-pier' as const, id: pier.id, pier, distance: distanceBetween(center, pier.point),
  })).filter(({ pier, distance }) => pier.sailings.length > 0 && distance <= radius)
    .sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
  const seen = new Set<FerryPierId>();
  const uniquePiers = rows.filter(({ id }) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return view === 'routes' ? routeRows(uniquePiers) : uniquePiers;
}

export function searchHkkfNearbyCatalogue(input: string, view: 'routes' | 'stops'): FerryNearbyRow[] {
  const term = hkkfSearchText(input);
  if (!term) return [];
  const piers = hkkfNearbyPiers.map((pier): FerryNearbyPierRow => ({ kind: 'nearby-ferry-pier', id: pier.id, pier }));
  if (view === 'stops') return piers.filter(({ pier }) => Object.values(pier.name)
    .some((name) => hkkfSearchText(name).includes(term)));
  const matches = new Set(matchHkkfRoutes(routes, input).map(({ routeId }) => routeId));
  return routeRows(piers, matches);
}
