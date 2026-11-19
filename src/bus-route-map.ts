import type { BusRoute } from '@/bus-routes';
import { routeOptionKey, routeSequenceChoices, routeStopKey, stopVisitKey, type RouteStop, type RouteStopIdentity } from '@/bus-stops';
import { isNearHongKong, type Coordinates } from '@/nearby-bus-data';

export type BusMapVisit = {
  stop: RouteStop;
  key: string;
  coordinate?: Coordinates;
};

export type BusMapMarker = BusMapVisit & { coordinate: Coordinates };

export function isBusMapCoordinate(point: Coordinates | undefined): point is Coordinates {
  return !!point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && isNearHongKong(point);
}

export function readBusMapChoice(route: BusRoute, direction: unknown) {
  if (route.source === 'nlb' ? direction !== undefined : direction !== 'outbound' && direction !== 'inbound') return;
  return routeSequenceChoices([route], routeOptionKey(route))
    .find(({ identity }) => identity.source === 'nlb' || identity.direction === direction);
}

export function busRouteMapHref(routeId: string, identity: RouteStopIdentity, stop?: RouteStop) {
  return {
    pathname: '/bus/route-map' as const,
    params: {
      routeId,
      ...(identity.source !== 'nlb' && { direction: identity.direction }),
      ...(stop && { stopId: stop.id, stopSeq: String(stop.seq) }),
    },
  };
}

export function buildBusMapStops(
  identity: RouteStopIdentity,
  stops: readonly RouteStop[],
  indexed: ReadonlyMap<string, Coordinates>,
  fromStopDetails: (id: string) => Coordinates | undefined,
) {
  const visits: BusMapVisit[] = stops.map((stop) => {
    return {
      stop,
      key: stopVisitKey(identity, stop),
      coordinate: [indexed.get(stop.id), stop.coordinate, fromStopDetails(stop.id)].find(isBusMapCoordinate),
    };
  });
  const markers = visits.filter((visit): visit is BusMapMarker => visit.coordinate !== undefined);
  return {
    routeKey: routeStopKey(identity),
    status: markers.length ? 'stops_only' as const : 'unavailable' as const,
    visits,
    markers,
  };
}

type BusMapViewport = Coordinates & {
  latitudeDelta: number;
  longitudeDelta: number;
};

export function numberedBusMapStops(
  markers: readonly BusMapMarker[],
  selected: string | undefined,
  viewport: BusMapViewport | undefined,
  size: { width: number; height: number } | undefined,
) {
  const numbered = new Set<string>();
  const active = markers.find(({ key }) => key === selected);
  if (active) numbered.add(active.key);
  if (markers.length === 1) numbered.add(markers[0].key);
  if (!viewport || !size || viewport.latitudeDelta <= 0 || viewport.longitudeDelta <= 0) return numbered;

  const separation = 40; // Existing 32 pt badges with room between nearby labels.
  const eastScale = size.width / viewport.longitudeDelta;
  const northScale = size.height / viewport.latitudeDelta;
  const placed: { x: number; y: number }[] = [];
  const priority = [active, markers[0], markers.at(-1), ...markers];
  for (const marker of priority) {
    if (!marker || (numbered.has(marker.key) && marker !== active)) continue;
    const x = (marker.coordinate.longitude - viewport.longitude) * eastScale;
    const y = (marker.coordinate.latitude - viewport.latitude) * northScale;
    if (Math.abs(x) > size.width / 2 + separation || Math.abs(y) > size.height / 2 + separation) continue;
    if (placed.some((point) => Math.abs(point.x - x) < separation && Math.abs(point.y - y) < separation)) continue;
    placed.push({ x, y });
    numbered.add(marker.key);
  }
  return numbered;
}
