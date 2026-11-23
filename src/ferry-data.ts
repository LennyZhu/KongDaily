import { formatHongKongTime, nextTrainTiming, parseHongKongTime, type NextTrainClock, type NextTrainReading } from '@/next-train-time';

export type FerryOperatorId = 'hkkf' | 'sunFerry' | 'fortuneFerry';
export type FerryName = { 'zh-HK': string; en: string };
export type FerryPierId = `${FerryOperatorId}:pier:${string}`;
export type FerryRouteId = `${FerryOperatorId}:route:${string}`;

export type FerryDirection = {
  operatorId: FerryOperatorId; operatorRouteId: string; routeId: FerryRouteId; directionId: string;
  originPierId: FerryPierId; destinationPierId: FerryPierId; name: FerryName;
};
export type FerryRoute = {
  operatorId: FerryOperatorId; operatorRouteId: string; routeId: FerryRouteId;
  name: FerryName; directions: readonly FerryDirection[];
};
export type FerryPier = {
  operatorId: FerryOperatorId; operatorPierId: string; pierId: FerryPierId; name: FerryName;
  coordinate: { latitude: number; longitude: number; kind: 'pierReference' };
};
export type FerrySource = {
  kind: 'operatorCatalogue' | 'operatorTimetable' | 'operatorLive';
  url: string; fetchedAt: number; generatedAt?: number; version?: string;
};
export type FerryServiceDayType = 'mondayToSaturday' | 'sundayOrPublicHoliday';
export type FerryDeparture = {
  kind: 'scheduledDeparture';
  dayType: FerryServiceDayType; time: string; dayOffset: 0 | 1 | undefined;
  rule: 'regular' | 'saturdayOnly' | 'optional' | 'unverified';
  marker: string; lastSailing: boolean; freight?: 'limited' | 'advanceBooking' | 'restricted';
  onwardService?: true;
};
export type FerryTimetable = {
  direction: FerryDirection; entries: readonly FerryDeparture[]; notes: FerryName;
};
export type FerryFare = {
  routeId: FerryRouteId; dayType: FerryServiceDayType;
  product: 'single' | 'return' | 'pass'; passenger: string; hkdCents: number;
};
export type FerryArrival = {
  kind: 'liveArrival'; direction: FerryDirection; destinationPierId: FerryPierId;
  arrivalAt: number; sessionDate: string; sessionTime: string;
};
export type FerryFailure =
  | { kind: 'invalidInput' | 'invalidResponse' | 'mappingMismatch' | 'unavailable'
      | 'network' | 'timeout' | 'cancelled' | 'rateLimited' }
  | { kind: 'http'; status: number };
export type FerryResult<T> = { kind: 'ready'; data: T; source: FerrySource } | FerryFailure;
export type FerryReading<T> = NextTrainReading<FerryResult<T>>;
export type FerryFreshness = 'fresh' | 'stale' | 'unknown';

export function ferryFreshness<T>(reading: FerryReading<T>, now: NextTrainClock, maxAgeMs: number): FerryFreshness {
  if (reading.payload.kind !== 'ready') return 'unknown';
  const { elapsed, reference } = nextTrainTiming(reading, now);
  const { source } = reading.payload;
  const sourceAge = source.generatedAt === undefined ? 0 : reference - source.generatedAt;
  return elapsed >= maxAgeMs || sourceAge >= maxAgeMs || sourceAge < -5_000 ? 'stale' : 'fresh';
}

export const ferryEtaLifetime = 120_000;

export function ferryEtaView(reading: FerryReading<readonly FerryArrival[]>, now: NextTrainClock):
  FerryFailure | { kind: 'empty' | 'stale'; source: FerrySource }
  | { kind: 'ready'; arrivals: readonly FerryArrival[]; source: FerrySource } {
  const { payload } = reading;
  if (payload.kind !== 'ready') return payload;
  const { source, data } = payload;
  if (ferryFreshness(reading, now, ferryEtaLifetime) !== 'fresh') return { kind: 'stale', source };
  if (data.length === 0) return { kind: 'empty', source };
  const { reference } = nextTrainTiming(reading, now);
  const arrivals = data.filter(({ arrivalAt }) => arrivalAt >= reference);
  return arrivals.length > 0 ? { kind: 'ready', arrivals, source } : { kind: 'stale', source };
}

export type HongKongHolidayLookup = (date: string) => boolean | undefined;
type DatedDeparture = FerryDeparture & { at: number; serviceDate: string };
const dayMs = 86_400_000;

function holidayRule(dayStart: number, date: string, holidays: HongKongHolidayLookup) {
  const weekday = new Date(dayStart + 8 * 3_600_000).getUTCDay();
  const publicHoliday = weekday === 0 || holidays(date);
  return { weekday, dayType: publicHoliday === undefined ? undefined
    : publicHoliday ? 'sundayOrPublicHoliday' as const : 'mondayToSaturday' as const };
}

/** Returns the explicitly chosen service day, including validated tails on the next calendar day. */
export function ferryServiceDaySchedule(timetable: FerryTimetable, date: string, holidays: HongKongHolidayLookup) {
  const start = parseHongKongTime(date + ' 00:00:00');
  if (start === undefined) return { kind: 'invalidDate' } as const;
  const { weekday, dayType } = holidayRule(start, date, holidays);
  if (!dayType) return { kind: 'calendarUnknown' } as const;

  const entries: DatedDeparture[] = [];
  for (const entry of timetable.entries) {
    if (entry.dayType !== dayType || entry.dayOffset === undefined ||
        (entry.rule !== 'regular' && !(entry.rule === 'saturdayOnly' && weekday === 6))) continue;
    const time = parseHongKongTime(date + ' ' + entry.time + ':00');
    if (time !== undefined) entries.push({ ...entry, at: time + entry.dayOffset * dayMs, serviceDate: date });
  }
  entries.sort((a, b) => a.at - b.at);
  return entries.length ? { kind: 'ready', entries } as const : { kind: 'noTimetable' } as const;
}

/** Today follows the Hong Kong civil date; tomorrow's departure never stands in for today's last sailing. */
export function ferryDeparturesToday(timetable: FerryTimetable, now: number, holidays: HongKongHolidayLookup) {
  if (!Number.isFinite(now) || Math.abs(now) >= 8.63e15) return { kind: 'invalidDate' } as const;
  const date = formatHongKongTime(now).slice(0, 10);
  const today = ferryServiceDaySchedule(timetable, date, holidays);
  const previous = timetable.entries.some(({ dayOffset }) => dayOffset === 1)
    ? ferryServiceDaySchedule(timetable, formatHongKongTime(now - dayMs).slice(0, 10), holidays) : undefined;
  if (today.kind === 'invalidDate' || today.kind === 'calendarUnknown') return today;
  // An unknown prior service day can affect departures until the latest verified rollover.
  if (previous?.kind === 'calendarUnknown' && timetable.entries.some(({ dayOffset, time }) =>
    dayOffset === 1 && time >= formatHongKongTime(now).slice(11, 16))) return previous;
  const todayEntries = [
    ...(previous?.kind === 'ready' ? previous.entries.filter(({ dayOffset }) => dayOffset === 1) : []),
    ...(today.kind === 'ready' ? today.entries.filter(({ dayOffset }) => dayOffset === 0) : []),
  ];
  if (!todayEntries.length) return { kind: 'noTimetable' } as const;
  const next = todayEntries.find(({ at }) => at >= now);
  return next ? { kind: 'ready', entries: todayEntries, next } as const : { kind: 'ended', entries: todayEntries } as const;
}
