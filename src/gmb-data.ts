import { nextTrainTiming, type NextTrainClock, type NextTrainReading } from '@/next-train-time';

export const gmbRegions = ['HKI', 'KLN', 'NT'] as const;
export type GmbRegion = typeof gmbRegions[number];
export type GmbRouteSeq = 1 | 2;
export type GmbDirectionKey = { routeId: number; routeSeq: GmbRouteSeq };
export type GmbVisitKey = GmbDirectionKey & { stopSeq: number; stopId: number };

export type GmbText = { tc: string | null; sc: string | null; en: string | null };
export type GmbHeadway = {
  sequence: number; weekdays: readonly boolean[]; publicHoliday: boolean;
  startTime: string; endTime: string | null; frequency: number | null; frequencyUpper: number | null;
};
export type GmbDirection = GmbDirectionKey & {
  origin: GmbText; destination: GmbText; remarks: GmbText; headways: readonly GmbHeadway[]; updatedAt: number;
};
export type GmbRoute = {
  region: GmbRegion; routeCode: string; routeId: number;
  description: GmbText; directions: readonly GmbDirection[]; updatedAt: number;
};
export type GmbRouteDirectory = { routes: Readonly<Record<GmbRegion, readonly string[]>>; updatedAt: number };
export type GmbRegionalDirectory = { region: GmbRegion; routes: readonly string[]; updatedAt: number };
export type GmbVisit = GmbVisitKey & { name: GmbText };
export type GmbRouteStops = GmbDirectionKey & { visits: readonly GmbVisit[]; updatedAt: number };
export type GmbStop = {
  stopId: number; coordinates: { latitude: number; longitude: number };
  enabled: boolean; remarks: GmbText; updatedAt: number;
};
export type GmbEtaEntry = { sequence: number; remarks: GmbText } & (
  | { kind: 'live' | 'scheduled'; timestamp: number; diff: number }
  | { kind: 'notice'; timestamp: number | null; diff: number | null }
);
export type GmbEta = { stopId: number } & (
  | { kind: 'forecast'; entries: readonly GmbEtaEntry[] }
  | { kind: 'empty' }
  | { kind: 'disabled'; description: GmbText }
);

export type GmbFailure =
  | { kind: 'invalidInput' | 'invalidResponse' | 'network' | 'timeout' | 'cancelled' | 'rateLimited' }
  | { kind: 'http'; status: number };
export type GmbResult<T> = { kind: 'ready'; data: T; generatedAt: number } | GmbFailure;
export type GmbReading<T> = NextTrainReading<GmbResult<T>>;

type Fields = Record<string, unknown>;

function invalid(): never {
  throw new Error('Invalid Green Minibus response');
}

export function gmbPositiveId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function gmbIsRegion(value: unknown): value is GmbRegion {
  return value === 'HKI' || value === 'KLN' || value === 'NT';
}

export function gmbIsDirection(value: unknown): value is GmbRouteSeq {
  return value === 1 || value === 2;
}

export function gmbIsRouteCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z0-9]+$/.test(value);
}

function object(value: unknown): Fields {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid();
  return value as Fields;
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : invalid();
}

function string(value: unknown): string {
  return typeof value === 'string' ? value : invalid();
}

function flag(value: unknown): boolean {
  return typeof value === 'boolean' ? value : invalid();
}

function id(value: unknown): number {
  return gmbPositiveId(value) ? value : invalid();
}

function localized(row: Fields, prefix: string): GmbText {
  const language = (suffix: string) => {
    const value = row[prefix + '_' + suffix];
    return value == null ? null : string(value);
  };
  return { tc: language('tc'), sc: language('sc'), en: language('en') };
}

function requiredName(row: Fields, prefix: string): GmbText {
  const value = localized(row, prefix);
  return Object.values(value).some((name) => name?.trim()) ? value : invalid();
}

function timestamp(value: unknown): number {
  const iso = string(value);
  const match = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.exec(iso);
  if (!match) invalid();
  const calendar = Date.parse(match[1] + 'Z');
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed) || !Number.isFinite(calendar) ||
      new Date(calendar).toISOString().slice(0, 19) !== match[1]) invalid();
  return parsed;
}

export function parseGmbEnvelope<T>(body: unknown, type: string, parse: (data: unknown) => T): GmbResult<T> {
  try {
    const envelope = object(body);
    if (envelope.type !== type || typeof envelope.version !== 'string' || !envelope.version) invalid();
    return { kind: 'ready', generatedAt: timestamp(envelope.generated_timestamp), data: parse(envelope.data) };
  } catch {
    return { kind: 'invalidResponse' };
  }
}

function routeCodes(value: unknown): readonly string[] {
  return list(value).map((code) => gmbIsRouteCode(code) ? code : invalid());
}

export function parseGmbDirectory(value: unknown): GmbRouteDirectory {
  const data = object(value);
  const routes = object(data.routes);
  return { updatedAt: timestamp(data.data_timestamp),
    routes: { HKI: routeCodes(routes.HKI), KLN: routeCodes(routes.KLN), NT: routeCodes(routes.NT) } };
}

export function parseGmbRegionalDirectory(value: unknown, region: GmbRegion): GmbRegionalDirectory {
  const data = object(value);
  return { region, routes: routeCodes(data.routes), updatedAt: timestamp(data.data_timestamp) };
}

function headway(value: unknown): GmbHeadway {
  const row = object(value);
  const weekdays = list(row.weekdays).map(flag);
  if (weekdays.length !== 7) invalid();
  return {
    sequence: id(row.headway_seq), weekdays, publicHoliday: flag(row.public_holiday),
    startTime: string(row.start_time), endTime: row.end_time === null ? null : string(row.end_time),
    frequency: row.frequency === null ? null : id(row.frequency),
    frequencyUpper: row.frequency_upper === null ? null : id(row.frequency_upper),
  };
}

function unique<T>(rows: readonly T[], key: (row: T) => number) {
  if (new Set(rows.map(key)).size !== rows.length) invalid();
}

export function parseGmbRoutes(value: unknown, expected: { region: GmbRegion; routeCode: string } | { routeId: number }): readonly GmbRoute[] {
  const routes = list(value).map((value): GmbRoute => {
    const row = object(value);
    const { region, route_code: routeCode } = row;
    const routeId = id(row.route_id);
    if (!gmbIsRegion(region) || !gmbIsRouteCode(routeCode)) invalid();
    if ('routeId' in expected ? routeId !== expected.routeId : region !== expected.region || routeCode !== expected.routeCode) invalid();
    const directions = list(row.directions).map((value): GmbDirection => {
      const direction = object(value);
      const routeSeq = direction.route_seq;
      if (!gmbIsDirection(routeSeq)) invalid();
      return {
        routeId, routeSeq, origin: requiredName(direction, 'orig'), destination: requiredName(direction, 'dest'),
        remarks: localized(direction, 'remarks'), headways: list(direction.headways).map(headway),
        updatedAt: timestamp(direction.data_timestamp),
      };
    });
    if (directions.length === 0) invalid();
    unique(directions, (direction) => direction.routeSeq);
    return { region, routeCode, routeId, directions, description: localized(row, 'description'),
      updatedAt: timestamp(row.data_timestamp) };
  });
  unique(routes, (route) => route.routeId);
  return routes;
}

export function parseGmbRouteStops(value: unknown, direction: GmbDirectionKey): GmbRouteStops {
  const data = object(value);
  const visits = list(data.route_stops).map((value): GmbVisit => {
    const row = object(value);
    return { ...direction, stopId: id(row.stop_id), stopSeq: id(row.stop_seq), name: requiredName(row, 'name') };
  });
  unique(visits, (visit) => visit.stopSeq);
  visits.sort((left, right) => left.stopSeq - right.stopSeq);
  return { ...direction, visits, updatedAt: timestamp(data.data_timestamp) };
}

export function parseGmbStop(value: unknown, stopId: number): GmbStop {
  const row = object(value);
  const { latitude, longitude } = object(object(row.coordinates).wgs84);
  // Match the bounds used by the existing nearby stop index without loading its SQLite module.
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < 22.12 || latitude > 22.59 ||
      typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < 113.82 || longitude > 114.46) invalid();
  return { stopId, coordinates: { latitude, longitude }, enabled: flag(row.enabled),
    remarks: localized(row, 'remarks'), updatedAt: timestamp(row.data_timestamp) };
}

function etaEntry(value: unknown): GmbEtaEntry {
  const row = object(value);
  const sequence = id(row.eta_seq);
  const remarks = localized(row, 'remarks');
  const scheduled = remarks.en?.trim().toLowerCase() === 'scheduled' ||
    remarks.tc?.trim() === '未開出' || remarks.sc?.trim() === '未开出';
  const hasRemark = Object.values(remarks).some((text) => text?.trim());
  const diff = typeof row.diff === 'number' && Number.isSafeInteger(row.diff) ? row.diff : null;
  if (hasRemark && !scheduled) {
    return { sequence, remarks, kind: 'notice', diff, timestamp: row.timestamp == null ? null : timestamp(row.timestamp) };
  }
  if (diff === null) invalid();
  return { sequence, remarks, kind: scheduled ? 'scheduled' : 'live', diff, timestamp: timestamp(row.timestamp) };
}

export function parseGmbEta(value: unknown): GmbEta {
  const row = object(value);
  const stopId = id(row.stop_id);
  if (!flag(row.enabled)) return { kind: 'disabled', stopId, description: localized(row, 'description') };
  const entries = list(row.eta).map(etaEntry);
  unique(entries, (entry) => entry.sequence);
  return entries.length === 0 ? { kind: 'empty', stopId } : { kind: 'forecast', stopId, entries };
}

const minute = 60_000;
export const gmbEtaRefreshMs = minute;
const etaLifetime = 2 * minute;

type GmbEtaViewEntry = GmbEtaEntry & { remainingMinutes?: number; imminent?: true };
export type GmbEtaView =
  | GmbFailure
  | { kind: 'stale'; generatedAt: number }
  | { kind: 'empty'; generatedAt: number }
  | { kind: 'disabled'; generatedAt: number; description: GmbText }
  | { kind: 'forecast'; generatedAt: number; entries: readonly GmbEtaViewEntry[] };

export function gmbEtaView(reading: GmbReading<GmbEta>, now: NextTrainClock): GmbEtaView {
  const { payload } = reading;
  if (payload.kind !== 'ready') return payload;
  const { reference, elapsed } = nextTrainTiming(reading, now);
  const { generatedAt, data } = payload;
  if (elapsed >= etaLifetime || reference - generatedAt >= etaLifetime || generatedAt - reference > 5_000) {
    return { kind: 'stale', generatedAt };
  }
  if (data.kind === 'disabled') return { kind: 'disabled', generatedAt, description: data.description };
  if (data.kind === 'empty') return { kind: 'empty', generatedAt };

  const entries: GmbEtaViewEntry[] = [];
  let inconsistent = false;
  for (const entry of data.entries) {
    if (entry.kind === 'notice') {
      entries.push(entry);
      continue;
    }
    const remaining = entry.timestamp - reference;
    if (remaining < 0 || entry.diff < 0) continue;
    if (entry.kind === 'scheduled') {
      entries.push(entry);
      continue;
    }
    // The official relative minutes are rounded. Reject large disagreements with the source clock.
    if (Math.abs(entry.timestamp - generatedAt - entry.diff * minute) > 90_000) {
      inconsistent = true;
      continue;
    }
    entries.push(remaining < minute
      ? { ...entry, imminent: true }
      : { ...entry, remainingMinutes: Math.ceil(remaining / minute) });
  }
  if (entries.length) return { kind: 'forecast', generatedAt, entries };
  return inconsistent ? { kind: 'invalidResponse' } : { kind: 'stale', generatedAt };
}
