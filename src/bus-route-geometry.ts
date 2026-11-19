import review from '../assets/data/bus-route-geometry-approvals.json';
import { isBusMapCoordinate, type buildBusMapStops } from '@/bus-route-map';
import type { Coordinates } from '@/nearby-bus-data';

type StopMap = ReturnType<typeof buildBusMapStops>;
type Approval = (typeof review.approvals)[keyof typeof review.approvals];
const approvals: Readonly<Partial<Record<string, Approval>>> = review.approvals;
const scale = 1_000_000;

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}

function checksum(value: unknown) {
  // Compact runtime corruption check. The builder verifies official inputs with SHA-256.
  const bytes = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) hash = Math.imul(hash ^ bytes.charCodeAt(i), 0x01000193);
  return hash >>> 0;
}

function loadBundledGeometry(): unknown {
  // Require inside the reader so other screens and stops-only routes don't initialize the geometry pack.
  return require('../assets/data/bus-route-geometry.json');
}

export function readBusRouteGeometry(map: StopMap, loadPack = loadBundledGeometry): Coordinates[][] | undefined {
  const approval = approvals[map.routeKey];
  if (!approval || !map.visits.length || map.visits.length !== map.markers.length) return;

  try {
    const pack = object(loadPack());
    if (pack?.version !== 1 || pack.crs !== 'EPSG:4326' || pack.scale !== scale
        || pack.datasetRevision !== review.datasetRevision || pack.source !== review.datasetUrl) return;
    const record = object(object(pack.records)?.[map.routeKey]);
    if (!record || JSON.stringify(record.td) !== JSON.stringify(approval.td)) return;

    // Compare every visit in order, including repeated stops and leading zeroes in ID strings.
    const visits = map.markers.map(({ stop, coordinate }) =>
      [stop.seq, stop.id, Math.round(coordinate.latitude * scale), Math.round(coordinate.longitude * scale)]);
    if (JSON.stringify(record.visits) !== JSON.stringify(visits)) return;

    if (!Array.isArray(record.parts) || !record.parts.length) return;
    const lines: Coordinates[][] = [];
    for (const part of record.parts) {
      if (!Array.isArray(part) || part.length < 2) return;
      const line: Coordinates[] = [];
      for (const pair of part) {
        if (!Array.isArray(pair) || pair.length !== 2 || !pair.every(Number.isSafeInteger)) return;
        const point = { latitude: pair[1] / scale, longitude: pair[0] / scale };
        if (!isBusMapCoordinate(point)) return;
        line.push(point);
      }
      lines.push(line);
    }
    if (approval.packChecksum !== checksum([map.routeKey, record.td, visits, record.parts])) return;
    return lines;
  } catch {
    // Stop map, ordered list and ETA remain available when the optional pack can't be read.
    return;
  }
}
