import type { BusSearchRadius, Coordinates } from '@/nearby-bus-data';
import {
  findNearbyTramStops, getTramRoute, getTramStopServiceStatus, getTramVisitsForStop,
  type NearbyTramStop, type TramDirection, type TramRoute, type TramVisit,
} from '@/tram-static';

type TramNearbyChoice = { service: TramRoute; direction: TramDirection; visit: TramVisit; affectedTerminus: boolean };
export type TramNearbyRouteRow = { kind: 'nearby-tram-route'; key: string; station: NearbyTramStop; choice: TramNearbyChoice };
export type TramNearbyStopRow = { kind: 'nearby-tram-stop'; key: string; station: NearbyTramStop; choices: readonly TramNearbyChoice[] };
export type TramNearbyRow = TramNearbyRouteRow | TramNearbyStopRow;

function describeVisit(visit: TramVisit): TramNearbyChoice | undefined {
  const service = getTramRoute(visit.routeId);
  const direction = service?.directions.find(({ directionId }) => directionId === visit.directionId);
  if (!service || !direction) return;
  const { fromStopId, toStopId } = direction.routeTermini;
  const affectedTerminus = [fromStopId, toStopId].some((id) => getTramStopServiceStatus(id)?.serviceStatus === 'temporarily_closed');
  return { service, direction, visit, affectedTerminus };
}

export function nearbyTramRows(center: Coordinates, radius: BusSearchRadius, view: 'routes' | 'stops'): TramNearbyRow[] {
  const nearby = findNearbyTramStops(center, radius); // Already excludes closures and sorts by unrounded distance.
  if (view === 'stops') return nearby.map((station): TramNearbyStopRow => ({
    kind: 'nearby-tram-stop', key: station.key, station,
    choices: getTramVisitsForStop(station.stop.stopId).map(describeVisit)
      .filter((choice): choice is TramNearbyChoice => choice !== undefined),
  }));

  const byDirection = new Map<string, TramNearbyRouteRow>();
  for (const station of nearby) {
    // This list contains only official pick-up visits. Unverified points keep their unknown status on the row.
    for (const visit of station.scheduledBoardingVisits) {
      const choice = describeVisit(visit);
      if (!choice || byDirection.has(choice.direction.key)) continue;
      const key = choice.direction.key;
      byDirection.set(key, { kind: 'nearby-tram-route', key, station, choice });
    }
  }
  return [...byDirection.values()];
}
