import { findMtrStation, type MtrLineCode } from '@/mtr-static';

export const mtrForecastSource = 'https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data';
export const mtrServiceAlertUrl = 'https://www.mtr.com.hk/alert/alert_title_wap.html';
export const mtrForecastLifetime = 60_000;

// Next Train Data Dictionary v1.7, parameter tables. Keep this independent of new static CSV entries.
const stationsByLine = {
  AEL: 'HOK KOW TSY AIR AWE',
  TCL: 'HOK KOW OLY NAC LAK TSY SUN TUC',
  TML: 'WKS MOS HEO TSH SHM CIO STW CKT TAW HIK DIH KAT SUW TKW HOM HUH ETS AUS NAC MEF TWW KSR YUL LOP TIS SIH TUM',
  TKL: 'NOP QUB YAT TIK TKO LHP HAH POA',
  EAL: 'ADM EXC HUH MKK KOT TAW SHT FOT RAC UNI TAP TWO FAN SHS LOW LMC',
  SIL: 'ADM OCP WCH LET SOH',
  TWL: 'CEN ADM TST JOR YMT MOK PRE SSP CSW LCK MEF LAK KWF KWH TWH TSW',
  ISL: 'KET HKU SYP SHW CEN ADM WAC CAB TIH FOH NOP QUB TAK SWH SKW HFC CHW',
  KTL: 'WHA HOM YMT MOK PRE SKM KOT LOF WTS DIH CHH KOB NTK KWT LAT YAT TIK',
  DRL: 'SUN DIS',
} satisfies Record<MtrLineCode, string>;

const allowed = new Set(Object.entries(stationsByLine).flatMap(([line, stations]) =>
  stations.split(' ').map((station) => `${line}-${station}`),
));

export function supportsMtrForecast(line: string, station: string) {
  return allowed.has(`${line}-${station}`)
    && findMtrStation(station)?.memberships.some(({ lineCode }) => lineCode === line) === true;
}

const directions = ['UP', 'DOWN'] as const;
const minute = 60_000;
const hongKongOffset = 8 * 60 * minute;
const timeTolerance = 5_000;
type Direction = typeof directions[number];
type Train = {
  sequence: number;
  destination: string;
  platform?: string;
  time: number;
  timeType: 'arrival' | 'departure' | 'estimate';
  viaRacecourse: boolean;
};
type Group = { direction: Direction; trains: Train[] };
type Notice = { kind: 'special' | 'suspended'; updatedAt?: number };
type Forecast = { kind: 'forecast'; groups: Group[]; updatedAt?: number; delayed: boolean };
export type MtrPayload = Forecast | Notice | { kind: 'failed' | 'unsupported' | 'rateLimited' };
export type MtrClock = { wall: number; monotonic: number };
export type MtrReading = {
  payload: MtrPayload;
  receivedAt: MtrClock;
  serverNow: number;
  retryAt: number;
};

export function mtrClock(): MtrClock {
  return { wall: Date.now(), monotonic: performance.now() };
}

export function parseHongKongTime(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return undefined;
  const iso = value.replace(' ', 'T') + 'Z';
  const utc = Date.parse(iso);
  if (!Number.isFinite(utc) || new Date(utc).toISOString() !== iso.replace('Z', '.000Z')) return undefined;
  return utc - hongKongOffset;
}

export function formatHongKongTime(timestamp: number, withSeconds = false) {
  return new Date(timestamp + hongKongOffset).toISOString().slice(0, withSeconds ? 19 : 16).replace('T', ' ');
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function updatedAt(value: Record<string, unknown> | undefined) {
  return parseHongKongTime(value?.curr_time) ?? parseHongKongTime(value?.cur_time) ?? parseHongKongTime(value?.sys_time);
}

function parseTrain(value: unknown, line: string): Train | undefined {
  const row = record(value);
  if (!row) return;
  const time = parseHongKongTime(row.time);
  const sequence = typeof row.seq === 'string' && /^[1-4]$/.test(row.seq) ? Number(row.seq) : row.seq;
  if (time === undefined || typeof sequence !== 'number' || !Number.isInteger(sequence) || sequence < 1 || sequence > 4
    || typeof row.dest !== 'string' || !/^[A-Z]{3}$/.test(row.dest)) return;

  const platform = typeof row.plat === 'number' ? String(row.plat) : row.plat;
  const timetableType = line === 'EAL' && (row.timeType === undefined || row.timetype === undefined || row.timeType === row.timetype)
    ? row.timeType ?? row.timetype : undefined;
  return {
    sequence, time, destination: row.dest,
    platform: typeof platform === 'string' && /^[1-9]\d?(?:\/[1-9]\d?){0,3}$/.test(platform) ? platform : undefined,
    timeType: timetableType === 'A' ? 'arrival' : timetableType === 'D' ? 'departure' : 'estimate',
    viaRacecourse: line === 'EAL' && row.route === 'RAC',
  };
}

export function parseMtrForecast(body: unknown, line: string, station: string): MtrPayload {
  if (!supportsMtrForecast(line, station)) return { kind: 'unsupported' };
  const root = record(body);
  if (!root) return { kind: 'failed' };
  if (root.status === 0 || root.status === '0') {
    const message = typeof root.message === 'string' ? root.message.trim().replace(/\s+/g, ' ').toLowerCase() : '';
    if (line === 'EAL' && (station === 'LOW' || station === 'LMC') && message === `${station.toLowerCase()} station is suspended`) {
      return { kind: 'suspended', updatedAt: updatedAt(root) };
    }
    if (root.url === mtrServiceAlertUrl || message.startsWith('special train service arrangements are now in place on this line.')) {
      return { kind: 'special', updatedAt: updatedAt(root) };
    }
    return { kind: 'failed' };
  }
  if (root.status !== 1 && root.status !== '1') return { kind: 'failed' };
  const selected = record(record(root.data)?.[`${line}-${station}`]);
  if (!selected) return { kind: 'failed' };

  const groups: Group[] = [];
  let providerRows = 0;
  for (const direction of directions) {
    const rows = selected[direction];
    if (rows === undefined) continue;
    if (!Array.isArray(rows) || rows.length > 4) return { kind: 'failed' };
    providerRows += rows.length;
    const trains: Train[] = [];
    for (const row of rows) {
      const train = parseTrain(row, line);
      if (!train) continue;
      if (trains.some(({ sequence }) => sequence === train.sequence)) return { kind: 'failed' };
      trains.push(train);
    }
    if (trains.length) groups.push({ direction, trains: trains.sort((a, b) => a.sequence - b.sequence) });
  }
  if (providerRows && !groups.length) return { kind: 'failed' };
  return { kind: 'forecast', groups, updatedAt: updatedAt(selected) ?? updatedAt(root), delayed: root.isdelay === 'Y' };
}

export function mtrForecastView(reading: MtrReading, now: MtrClock) {
  const { payload, receivedAt } = reading;
  if (payload.kind !== 'forecast' && payload.kind !== 'special' && payload.kind !== 'suspended') return payload;
  const elapsed = Math.max(0, now.monotonic - receivedAt.monotonic, now.wall - receivedAt.wall);
  const reference = reading.serverNow + elapsed;
  const updated = payload.updatedAt;
  if (elapsed >= mtrForecastLifetime
    || (updated !== undefined && (reference - updated >= mtrForecastLifetime || updated > reference + timeTolerance))
    || (updated === undefined && payload.kind === 'forecast' && payload.groups.length > 0)) return { kind: 'stale' as const };
  if (payload.kind !== 'forecast') return payload;

  const groups = payload.groups.flatMap(({ direction, trains }) => {
    const upcoming = trains.filter(({ time }) => time >= reference).map((train) => ({
      ...train, minutes: Math.ceil((train.time - reference) / minute),
    }));
    return upcoming.length ? [{ direction, trains: upcoming }] : [];
  });
  return { kind: groups.length ? 'ready' as const : 'empty' as const, groups, updatedAt: updated, delayed: payload.delayed };
}
