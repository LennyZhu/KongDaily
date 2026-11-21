import { BusFeedError, requestBusJson } from '@/bus-data';
import { routePlaceName, type RouteName } from '@/bus-routes';
import type { RouteStopIdentity } from '@/bus-stops';
import type { Messages } from '@/i18n';

export type EtaTarget = RouteStopIdentity & { stopId: string; stopSeq: number; repeatedStop?: boolean };
export type EtaLocale = 'zh-HK' | 'en';

export type EtaEntry = {
  arrivalAt?: number;
  generatedAt?: number;
  destination?: RouteName;
  remark?: RouteName;
  etaSequence?: number;
  nlb?: { variant?: string; departed?: boolean; noGPS?: 0 | 1; wheelChair?: boolean };
};

export type EtaSnapshot = {
  target: EtaTarget;
  match: 'matched' | 'empty' | 'unmatched';
  entries: EtaEntry[];
  generatedAt?: number;
  receivedAt: number;
  message?: string;
};

export const etaMaxAge = 120_000;

export function readEtaTarget(params: Record<string, string | string[] | undefined>): EtaTarget | undefined {
  const { source, number, stopId, stopSeq, direction, serviceType, nlbRouteId } = params;
  if (typeof number !== 'string' || !/^[A-Z0-9]{1,12}$/.test(number)
    || typeof stopId !== 'string' || typeof stopSeq !== 'string' || !/^\d+$/.test(stopSeq)) return;
  const seq = Number(stopSeq);
  if (!Number.isSafeInteger(seq) || seq < 1) return;
  const stop = { number, stopId, stopSeq: seq };

  if (source === 'nlb') {
    if (typeof nlbRouteId !== 'string' || !/^\d+$/.test(nlbRouteId) || !/^\d+$/.test(stopId)) return;
    return { ...stop, source, routeId: nlbRouteId, repeatedStop: params.repeatedStop === '1' };
  }
  if (direction !== 'outbound' && direction !== 'inbound') return;
  if (source === 'citybus' && /^\d{6}$/.test(stopId)) return { ...stop, source, direction };
  if (source === 'kmbLwb' && /^[A-F0-9]{16}$/i.test(stopId) && typeof serviceType === 'string'
    && /^\d+$/.test(serviceType)) return { ...stop, source, direction, serviceType };
}

export function etaUrl(target: EtaTarget, locale: EtaLocale) {
  const stop = encodeURIComponent(target.stopId);
  const number = encodeURIComponent(target.number);
  if (target.source === 'kmbLwb') {
    return `https://data.etabus.gov.hk/v1/transport/kmb/eta/${stop}/${number}/${encodeURIComponent(target.serviceType)}`;
  }
  if (target.source === 'citybus') {
    return `https://rt.data.gov.hk/v2/transport/citybus/eta/CTB/${stop}/${number}`;
  }
  const routeId = encodeURIComponent(target.routeId);
  return `https://rt.data.gov.hk/v2/transport/nlb/stop.php?action=estimatedArrivals&routeId=${routeId}&stopId=${stop}&language=${locale === 'en' ? 'en' : 'zh'}`;
}

function record(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BusFeedError('invalid');
  return value as Record<string, unknown>;
}

function positiveInteger(value: unknown) {
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof number === 'number' && Number.isSafeInteger(number) && number > 0) return number;
}

function text(value: unknown) {
  return typeof value === 'string' ? value.replace(/<br\s*\/?\s*>/gi, '\n').trim() : '';
}

function bilingual(zh: unknown, en: unknown) {
  const name = { zh: text(zh), en: text(en) };
  return name.zh || name.en ? name : undefined;
}

function binary(value: unknown) {
  if (value === 0 || value === 1) return value;
}

function flag(value: unknown) {
  const bit = binary(value);
  return bit === undefined ? undefined : bit === 1;
}

function timestamp(value: unknown, hongKongLocal = false) {
  if (value === null || value === undefined || value === '') return;
  const match = typeof value === 'string'
    && /^(\d{4})-(\d{2})-(\d{2})[T ]([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/.exec(value);
  if (!match || (!match[6] && !hongKongLocal)) throw new BusFeedError('invalid');
  const [, year, month, day, , , zone] = match;
  const calendar = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const time = Date.parse(match[0].replace(' ', 'T') + (zone ? '' : '+08:00'));
  if (calendar.getUTCMonth() !== Number(month) - 1 || calendar.getUTCDate() !== Number(day)
    || !Number.isFinite(time)) throw new BusFeedError('invalid');
  return time;
}

function parseNlbEta(payload: Record<string, unknown>) {
  const data = payload.estimatedArrivals;
  if (data !== undefined && !Array.isArray(data)) throw new BusFeedError('invalid');
  if (payload.message !== undefined && typeof payload.message !== 'string') throw new BusFeedError('invalid');
  // An unavailable route/stop pair can return an empty object with HTTP 200.
  if (data === undefined && payload.message === undefined && Object.keys(payload).length > 0) {
    throw new BusFeedError('invalid');
  }

  const entries: EtaEntry[] = (data ?? []).map((value) => {
    const row = record(value);
    return {
      arrivalAt: timestamp(row.estimatedArrivalTime, true),
      generatedAt: timestamp(row.generateTime, true),
      nlb: {
        variant: text(row.routeVariantName) || undefined,
        departed: flag(row.departed),
        // Preserve the provider value. Its name and documented meaning differ.
        noGPS: binary(row.noGPS),
        wheelChair: flag(row.wheelChair),
      },
    };
  });
  return { entries, message: text(payload.message) || undefined };
}

function parseDirectionalEta(target: Exclude<EtaTarget, { source: 'nlb' }>, data: unknown[]) {
  const entries: EtaEntry[] = [];
  const existing = new Map<string, number>();
  for (const value of data) {
    const row = record(value);
    const seq = positiveInteger(row.seq);
    const serviceType = positiveInteger(row.service_type);
    if (typeof row.route !== 'string' || (row.dir !== 'I' && row.dir !== 'O') || !seq
      || (target.source === 'citybus' ? typeof row.stop !== 'string' || row.co !== 'CTB'
        : !serviceType || (row.co !== 'KMB' && row.co !== 'LWB'))) throw new BusFeedError('invalid');
    // The KMB stop-specific endpoint identifies the stop in its URL and may omit it in the row.
    if (row.route !== target.number || row.dir !== (target.direction === 'outbound' ? 'O' : 'I') || seq !== target.stopSeq
      || (row.stop !== undefined && row.stop !== target.stopId)
      || (target.source === 'kmbLwb' && serviceType !== Number(target.serviceType))) continue;

    const entry: EtaEntry = {
      arrivalAt: timestamp(row.eta),
      generatedAt: timestamp(row.data_timestamp),
      destination: bilingual(row.dest_tc, row.dest_en),
      remark: bilingual(row.rmk_tc, row.rmk_en),
      etaSequence: positiveInteger(row.eta_seq),
    };

    // Distinct ETA sequence numbers can legitimately share the same arrival time.
    if (entry.etaSequence !== undefined && entry.arrivalAt !== undefined) {
      const key = JSON.stringify([entry.etaSequence, entry.arrivalAt, entry.destination]);
      const index = existing.get(key);
      if (index !== undefined) {
        const old = entries[index];
        const newest = (entry.generatedAt ?? 0) >= (old.generatedAt ?? 0) ? entry : old;
        entries[index] = { ...newest, remark: newest.remark ?? old.remark ?? entry.remark };
        continue;
      }
      existing.set(key, entries.length);
    }
    entries.push(entry);
  }
  return entries;
}

export function parseEta(target: EtaTarget, value: unknown, receivedAt = Date.now()): EtaSnapshot {
  const payload = record(value);
  if (target.source === 'nlb') {
    const { entries, message } = parseNlbEta(payload);
    return { target, entries, message, receivedAt, generatedAt: latestTimestamp(entries), match: entries.length ? 'matched' : 'empty' };
  }
  if (!Array.isArray(payload.data)) throw new BusFeedError('invalid');
  const entries = parseDirectionalEta(target, payload.data);
  // KMB null ETA rows can carry an older timestamp even when the response was just generated.
  const predictions = target.source === 'kmbLwb' ? entries.filter((entry) => entry.arrivalAt !== undefined) : entries;
  return {
    target, entries, receivedAt,
    generatedAt: latestTimestamp(predictions) ?? timestamp(payload.generated_timestamp),
    match: entries.length ? 'matched' : payload.data.length ? 'unmatched' : 'empty',
  };
}

function latestTimestamp(entries: EtaEntry[]) {
  return entries.reduce<number | undefined>((latest, entry) => entry.generatedAt === undefined
    ? latest : Math.max(latest ?? entry.generatedAt, entry.generatedAt), undefined);
}

export async function fetchEta(target: EtaTarget, url: string, signal: AbortSignal) {
  const payload = await requestBusJson(target.source, url, signal);
  return parseEta(target, payload);
}

export function etaIsStale(snapshot: EtaSnapshot, now: number, generatedAt = snapshot.generatedAt) {
  return now - Math.min(generatedAt ?? snapshot.receivedAt, snapshot.receivedAt) >= etaMaxAge;
}

export function fallbackNlbEtaText(snapshot: EtaSnapshot, previous: EtaSnapshot) {
  const { target } = snapshot;
  if (target.source !== 'nlb' || previous.target.source !== 'nlb' || target.routeId !== previous.target.routeId
    || target.stopId !== previous.target.stopId || etaIsStale(previous, snapshot.receivedAt)) return snapshot;
  const entries = snapshot.entries;
  // Reuse text from the other locale only when the provider returned the same identifiable departures.
  const times = entries.map((entry) => entry.arrivalAt);
  if (!entries.length || entries.length !== previous.entries.length || new Set(times).size !== entries.length
    || entries.some((entry, index) => entry.arrivalAt === undefined || entry.arrivalAt !== previous.entries[index].arrivalAt
      || entry.nlb?.departed !== previous.entries[index].nlb?.departed)) return snapshot;
  return {
    ...snapshot,
    message: snapshot.message ?? previous.message,
    entries: entries.map((entry, index) => entry.nlb?.variant ? entry
      : { ...entry, nlb: { ...entry.nlb, variant: previous.entries[index].nlb?.variant } }),
  };
}

export function etaMinutes(arrivalAt: number, now: number) {
  const remaining = arrivalAt - now;
  if (remaining < 0) return;
  return remaining <= 60_000 ? 0 : Math.ceil(remaining / 60_000);
}

export function validEtaPredictions(snapshot: EtaSnapshot, now: number) {
  if (etaIsStale(snapshot, now)) return [];
  return snapshot.entries
    .flatMap((entry) => {
      if (entry.arrivalAt === undefined || etaIsStale(snapshot, now, entry.generatedAt)) return [];
      const minutes = etaMinutes(entry.arrivalAt, now);
      return minutes === undefined ? [] : [{ ...entry, arrivalAt: entry.arrivalAt, minutes }];
    })
    .sort((a, b) => a.arrivalAt - b.arrivalAt);
}

export function etaEntryNotes(entry: EtaEntry, locale: EtaLocale) {
  return [entry.remark && routePlaceName(entry.remark, locale), entry.nlb?.variant].filter(Boolean).join(' · ');
}

export function describeEta(snapshot: EtaSnapshot | undefined, error: BusFeedError | undefined, now: number,
  loading: boolean, locale: EtaLocale, copy: Messages['busEta']) {
  const stale = snapshot && etaIsStale(snapshot, now);
  const upcoming = snapshot ? validEtaPredictions(snapshot, now) : [];
  const notices = snapshot && !stale ? [...new Set([
    snapshot.message,
    ...snapshot.entries.filter((entry) => entry.arrivalAt === undefined
      && (snapshot.target.source !== 'kmbLwb' || !etaIsStale(snapshot, now, entry.generatedAt)))
      .map((entry) => etaEntryNotes(entry, locale)),
  ].filter((message): message is string => Boolean(message)))] : [];
  const status = stale ? copy.stale
    : !snapshot ? error && !loading ? copy.failed : copy.loading
      : snapshot.match === 'unmatched' ? copy.unmatched
        : notices.length ? copy.remarksOnly : copy.empty;
  const errorText = error?.status === 429 ? copy.rateLimited
    : error?.kind === 'json' || error?.kind === 'empty' ? copy.errors.invalid
      : error && copy.errors[error.kind];
  const time = snapshot && new Date(snapshot.generatedAt ?? snapshot.receivedAt).toLocaleString(locale, {
    timeZone: 'Asia/Hong_Kong', dateStyle: 'short', timeStyle: 'medium', hourCycle: 'h23',
  });
  const updateText = time ? snapshot?.generatedAt === undefined ? copy.checked(time) : copy.updated(time) : undefined;
  return { upcoming, notices, status, errorText, updateText };
}
