import { findLightRailStop } from '@/light-rail-static';
import { nextTrainExpired, nextTrainTiming, parseHongKongTime, type NextTrainClock, type NextTrainFailure, type NextTrainReading } from '@/next-train-time';

export const lightRailForecastSource = 'https://data.gov.hk/en-data/dataset/mtr-lrnt_data-light-rail-nexttrain-data';

// v1.2's station ID appendix. Intersect with the bundled directory before issuing a request.
const realtimeStops = new Set((
  '1 10 15 20 30 40 50 60 70 75 80 90 100 110 120 130 140 150 160 170 180 190 200 212 220 230 240 250 ' +
  '260 265 270 275 280 295 300 310 320 330 340 350 360 370 380 390 400 425 430 435 445 448 450 455 460 ' +
  '468 480 490 500 510 520 530 540 550 560 570 580 590 600 920'
).split(' '));

export function supportsLightRailForecast(stationId: string) {
  return realtimeStops.has(stationId) && findLightRailStop(stationId) !== undefined;
}

type Bilingual = { zh?: string; en?: string };
type RouteDisplay = { kind: 'regular' | 'special' | 'unknown'; code?: string };
type TrainTime = { kind: 'minutes'; minutes: number } | { kind: 'arriving' | 'departing' | 'imminent' | 'unknown' };
export type LightRailTrain = {
  route: RouteDisplay;
  destination: Bilingual;
  remark: Bilingual;
  event: 'arrival' | 'departure' | 'estimate';
  time: TrainTime;
  serviceIssue: boolean;
};
type Platform = { id: number; trains: LightRailTrain[] };
type Forecast = { kind: 'forecast'; platforms: Platform[]; updatedAt?: number };
export type LightRailPayload = Forecast | { kind: 'providerUnavailable' } | NextTrainFailure;
export type LightRailReading = NextTrainReading<LightRailPayload>;

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function officialText(value: unknown, limit: number) {
  if (typeof value !== 'string') return undefined;
  const text = value.trim().replace(/\s+/g, ' ');
  return text && text !== '-' && text.length <= limit ? text : undefined;
}

function parseTime(value: unknown): TrainTime | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim().toLowerCase();
  const minutes = /^(\d{1,3})\s*(?:mins?|分鐘)$/.exec(text);
  if (minutes) return { kind: 'minutes', minutes: Number(minutes[1]) };
  if (text === '-') return { kind: 'imminent' };
  if (text === 'arriving' || text === '即將抵達') return { kind: 'arriving' };
  if (text === 'departing' || text === '正在離開') return { kind: 'departing' };
}

function trainTime(zh: unknown, en: unknown): TrainTime {
  const tc = parseTime(zh);
  const english = parseTime(en);
  if (tc && english && (tc.kind !== english.kind
    || (tc.kind === 'minutes' && english.kind === 'minutes' && tc.minutes !== english.minutes))) return { kind: 'unknown' };
  return tc ?? english ?? { kind: 'unknown' };
}

function publicRoute(value: unknown, special = false) {
  const pattern = special ? /^\d{1,4}[A-Z]{0,2}\*?$/ : /^\d{1,4}[A-Z]{0,2}$/;
  const code = typeof value === 'string' ? value.trim() : '';
  return pattern.test(code) ? code : undefined;
}

function parseTrain(value: unknown): LightRailTrain | undefined {
  const row = record(value);
  if (!row || (row.special !== 1 && (typeof row.route_no !== 'string' || !row.route_no.trim()))) return;

  // v1.2 uses a separate public identifier for specials. SPR and unrecognized values get a neutral badge.
  const route: RouteDisplay = row.special === 1 ? { kind: 'special', code: publicRoute(row.additionalInfo1, true) }
    : row.special === 0 ? { kind: 'regular', code: publicRoute(row.route_no) } : { kind: 'unknown' };
  const event = row.arrival_departure === 'A' ? 'arrival' : row.arrival_departure === 'D' ? 'departure' : 'estimate';
  const serviceIssue = typeof row.stop === 'number' && Number.isSafeInteger(row.stop) && row.stop > 0;
  // The dictionary gives no numeric stop-code table. Only the normal live value 0 is used for predictions.
  const time = row.stop === 0 ? trainTime(row.time_ch, row.time_en) : { kind: 'unknown' as const };
  const conflict = (event === 'arrival' && time.kind === 'departing') || (event === 'departure' && time.kind === 'arriving');
  return {
    route, event: conflict ? 'estimate' : event, time: conflict ? { kind: 'unknown' } : time, serviceIssue,
    destination: { zh: officialText(row.dest_ch, 160), en: officialText(row.dest_en, 160) },
    remark: { zh: officialText(row.routeRemarkChi2, 600), en: officialText(row.routeRemarkEng2, 600) },
  };
}

export function parseLightRailForecast(body: unknown, stationId: string): LightRailPayload {
  if (!supportsLightRailForecast(stationId)) return { kind: 'unsupported' };
  const root = record(body);
  if (!root || (root.station_id !== undefined
    && root.station_id !== stationId && root.station_id !== Number(stationId))) return { kind: 'failed' };
  if (root.status === 0 || root.status === '0') return { kind: 'providerUnavailable' };
  if ((root.status !== 1 && root.status !== '1') || !Array.isArray(root.platform_list)) return { kind: 'failed' };

  const platforms = new Map<number, Platform>();
  let sourceRows = 0;
  for (const value of root.platform_list) {
    const platform = record(value);
    if (typeof platform?.platform_id !== 'number' || !Number.isSafeInteger(platform.platform_id)
      || platform.platform_id <= 0 || !Array.isArray(platform.route_list)) return { kind: 'failed' };
    sourceRows += platform.route_list.length;
    const trains = platform.route_list.flatMap((row: unknown) => {
      const train = parseTrain(row);
      return train ? [train] : [];
    });
    if (!trains.length) continue;
    const existing = platforms.get(platform.platform_id);
    if (existing) existing.trains.push(...trains);
    else platforms.set(platform.platform_id, { id: platform.platform_id, trains });
  }
  if (sourceRows && !platforms.size) return { kind: 'failed' };
  return { kind: 'forecast', platforms: [...platforms.values()], updatedAt: parseHongKongTime(root.system_time) };
}

export function lightRailForecastView(reading: LightRailReading, now: NextTrainClock) {
  const { payload } = reading;
  if (payload.kind !== 'forecast') return payload;
  const { updatedAt } = payload;
  if (updatedAt === undefined || nextTrainExpired(nextTrainTiming(reading, now), updatedAt)) {
    return { kind: 'stale' as const, updatedAt };
  }
  return { kind: payload.platforms.length ? 'ready' as const : 'empty' as const, platforms: payload.platforms, updatedAt };
}
