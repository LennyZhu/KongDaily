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
    // A future verified line must match this exact route key and current ordered visits.
    routeKey: routeStopKey(identity),
    status: markers.length ? 'stops_only' as const : 'unavailable' as const,
    visits,
    markers,
  };
}
