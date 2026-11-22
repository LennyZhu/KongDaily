import { findLightRailRoute, findLightRailStop, type LightRailEntry, type LightRailStop } from '@/light-rail-static';
import { findMtrLine, findMtrStation, type MtrEntry, type MtrStation } from '@/mtr-static';
import type { BusSearchRadius, Coordinates } from '@/nearby-bus-data';
import { findNearbyRailwayStations, type NearbyRailwayStation, type RailwayGeoMode } from '@/railway-station-geo';

export type NearbyRailwayRow = {
  kind: 'nearby-railway';
  id: string;
  entry: MtrEntry | LightRailEntry;
  boarding: MtrStation | LightRailStop;
  location: NearbyRailwayStation;
};

/** Keep the operator's catalogue objects and direction/visit patterns unchanged. */
export function nearbyRailwayRows(center: Coordinates, radius: BusSearchRadius, view: 'routes' | 'stops', mode?: RailwayGeoMode) {
  const rows = new Map<string, NearbyRailwayRow>();
  for (const location of findNearbyRailwayStations(center, radius, mode)) {
    const { station } = location;
    const boarding = station.mode === 'mtr' ? findMtrStation(station.stationId) : findLightRailStop(station.stationId);
    if (!boarding) continue;
    const entries = view === 'stops' ? [boarding] : boarding.kind === 'mtr-station'
      ? boarding.memberships.flatMap(({ lineCode }) => { const line = findMtrLine(lineCode); return line ? [line] : []; })
      : boarding.routes.flatMap((id) => { const route = findLightRailRoute(id); return route ? [route] : []; });
    for (const entry of entries) {
      const id = `${station.mode}:${entry.kind}:${entry.id}`;
      // Locations arrive nearest first, with stable station-ID ties.
      if (!rows.has(id)) rows.set(id, { kind: 'nearby-railway', id, entry, boarding, location });
    }
  }
  return [...rows.values()].sort((a, b) => a.location.distance - b.location.distance || a.id.localeCompare(b.id));
}
