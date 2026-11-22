import snapshot from '../assets/data/railway-station-geo.json';

import { distanceBetween, isNearHongKong, type BusSearchRadius, type Coordinates } from '@/nearby-bus-data';

export type RailwayGeoMode = 'mtr' | 'lightRail';
export type RailwayGeoPosition = {
  kind: 'entrance' | 'station-reference';
  coordinate: Coordinates;
  sourceRecordIds: readonly string[];
};
export type RailwayStationGeo = {
  mode: RailwayGeoMode;
  stationId: string;
  status: 'verified' | 'unresolved';
  stationRecordId?: string;
  positions: readonly RailwayGeoPosition[];
  source: typeof snapshot.source;
  mappingBasis: string;
  reason?: string;
};
export type NearbyRailwayStation = {
  station: RailwayStationGeo;
  position: RailwayGeoPosition;
  /** Metres in a straight line, never a walking distance. */
  distance: number;
};

type SnapshotStation = {
  status: string;
  stationRecordId?: string;
  positions: { kind: string; coordinate: Coordinates; sourceRecordIds: string[] }[];
  reason?: string;
};

export const railwayGeoSource = snapshot.source;
export const railwayGeoCoverage = snapshot.counts;

function usablePoint(point: Coordinates) {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && isNearHongKong(point);
}

function stationRecords(mode: RailwayGeoMode, records: Record<string, SnapshotStation>): RailwayStationGeo[] {
  return Object.entries(records).map(([stationId, record]) => {
    const positions = record.status !== 'verified' ? [] : record.positions.flatMap((position): RailwayGeoPosition[] => {
      if ((position.kind !== 'entrance' && position.kind !== 'station-reference')
        || !usablePoint(position.coordinate) || !position.sourceRecordIds.length) return [];
      return [{ ...position, kind: position.kind }];
    });
    return {
      mode, stationId, status: positions.length ? 'verified' : 'unresolved',
      stationRecordId: record.stationRecordId, positions, source: railwayGeoSource,
      mappingBasis: snapshot.mappingBasis[mode],
      reason: positions.length ? undefined : record.reason ?? 'No verified official position',
    };
  });
}

/** One physical station per mode/official ID; line memberships stay in the existing catalogues. */
export const railwayStationGeographies: readonly RailwayStationGeo[] = [
  ...stationRecords('mtr', snapshot.mtr), ...stationRecords('lightRail', snapshot.lightRail),
];
const byMode = {
  mtr: new Map(railwayStationGeographies.filter((station) => station.mode === 'mtr').map((station) => [station.stationId, station])),
  lightRail: new Map(railwayStationGeographies.filter((station) => station.mode === 'lightRail').map((station) => [station.stationId, station])),
};

export function getRailwayStationGeo(mode: RailwayGeoMode, stationId: unknown) {
  if (mode !== 'mtr' && mode !== 'lightRail') return;
  return typeof stationId === 'string' ? byMode[mode].get(stationId) : undefined;
}

export function getMtrStationPositions(stationId: unknown): readonly RailwayGeoPosition[] {
  return getRailwayStationGeo('mtr', stationId)?.positions ?? [];
}

export function getLightRailStopPositions(stopId: unknown): readonly RailwayGeoPosition[] {
  return getRailwayStationGeo('lightRail', stopId)?.positions ?? [];
}

export function hasRailwayStationGeo(mode: RailwayGeoMode, stationId: unknown) {
  return getRailwayStationGeo(mode, stationId)?.status === 'verified';
}

/** Prefer the nearest verified entrance; reference points are a fallback only when no entrance exists. */
export function nearestRailwayPosition(center: Coordinates, station: RailwayStationGeo): NearbyRailwayStation | undefined {
  if (!usablePoint(center) || station.status !== 'verified') return;
  const positions = station.positions.filter((position) => usablePoint(position.coordinate));
  const entrances = positions.filter((position) => position.kind === 'entrance');
  let nearest: NearbyRailwayStation | undefined;
  for (const position of entrances.length ? entrances : positions) {
    const distance = distanceBetween(center, position.coordinate);
    if (!nearest || distance < nearest.distance) nearest = { station, position, distance };
  }
  return nearest;
}

export function findNearbyRailwayStations(
  center: Coordinates, radius: BusSearchRadius, mode?: RailwayGeoMode,
  stations: readonly RailwayStationGeo[] = railwayStationGeographies,
): NearbyRailwayStation[] {
  if (!usablePoint(center) || (radius !== 500 && radius !== 1000 && radius !== 2000)) return [];
  return stations.flatMap((station) => {
    if (mode && station.mode !== mode) return [];
    const nearest = nearestRailwayPosition(center, station);
    return nearest && nearest.distance <= radius ? [nearest] : [];
  }).sort((a, b) => a.distance - b.distance
    || a.station.mode.localeCompare(b.station.mode) || a.station.stationId.localeCompare(b.station.stationId));
}
