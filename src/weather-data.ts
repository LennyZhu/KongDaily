import { AppState } from 'react-native';

import { getDatabase } from '@/database';
import {
  forecastApiType, hongKongForecastDay, parseForecastReport, parseWeatherReport, weatherApiType, type WeatherLocale,
} from '@/weather';
import {
  parseWarningDetails, parseWarningSummary, warningCheckInterval, warningDetailsApiType, warningSummaryApiType,
} from '@/weather-warnings';

export type WeatherFailure = 'network' | 'tls' | 'http' | 'timeout' | 'json' | 'invalid' | 'outdated';
type WeatherApiType = typeof weatherApiType | typeof forecastApiType | typeof warningSummaryApiType | typeof warningDetailsApiType;
type Snapshot<Report> = { locale: WeatherLocale; report: Report; fetchedAt: number; verified?: boolean };
type Entry<Report> = { snapshot?: Snapshot<Report>; failure?: WeatherFailure; refreshing?: boolean; attemptedAt?: number };
type CacheRow = { language: WeatherLocale; update_time: number; fetched_at: number; payload: string };
type WeatherState<Report> = { hydrated: boolean; entries: Record<WeatherLocale, Entry<Report>> };

const refreshInterval = 20 * 60_000;
export const weatherRetryInterval = 15_000;
const requestTimeout = 12_000;
const baseUrl = 'https://data.weather.gov.hk/weatherAPI/opendata/weather.php';

class WeatherRequestError extends Error {
  constructor(readonly kind: WeatherFailure) {
    super(kind);
  }
}

async function requestWeather<Report>(apiType: WeatherApiType, locale: WeatherLocale, signal: AbortSignal,
  parse: (payload: unknown) => Report | undefined) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal.aborted) cancel();
  else signal.addEventListener('abort', cancel);
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, requestTimeout);
  let payload: string;
  try {
    const response = await fetch(`${baseUrl}?dataType=${apiType}&lang=${locale === 'en' ? 'en' : 'tc'}`,
      { signal: controller.signal });
    if (!response.ok) throw new WeatherRequestError('http');
    payload = await response.text();
  } catch (error) {
    if (signal.aborted || error instanceof WeatherRequestError) throw error;
    if (timedOut) throw new WeatherRequestError('timeout');
    const message = error instanceof Error ? `${error.message} ${error.cause instanceof Error ? error.cause.message : ''}` : '';
    const kind = /\b(?:tls|ssl|certificate|server trust|secure connection)\b/i.test(message) ? 'tls' : 'network';
    throw new WeatherRequestError(kind);
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', cancel);
  }
  if (timedOut) throw new WeatherRequestError('timeout');

  let json: unknown;
  try {
    json = JSON.parse(payload);
  } catch {
    throw new WeatherRequestError('json');
  }
  const report = parse(json);
  if (!report) throw new WeatherRequestError('invalid');
  return { report, payload };
}

async function saveSnapshot(apiType: WeatherApiType, locale: WeatherLocale, fetchedAt: number,
  officialTime: number | undefined, payload: string) {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO weather_cache (api_type, language, update_time, fetched_at, payload)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(api_type, language) DO UPDATE SET
       update_time = excluded.update_time, fetched_at = excluded.fetched_at, payload = excluded.payload
     WHERE ? OR excluded.update_time >= weather_cache.update_time`,
    apiType, locale, officialTime ?? fetchedAt, fetchedAt, payload, officialTime === undefined ? 1 : 0,
  );
}

function createWeatherFeed<Report>(apiType: WeatherApiType, parse: (payload: unknown) => Report | undefined, {
  officialTime, isUsable, interval = refreshInterval, verifyOnLaunch = false, checkBy,
}: {
  officialTime?: (report: Report) => number;
  isUsable?: (report: Report, now: number) => boolean;
  interval?: number;
  verifyOnLaunch?: boolean;
  checkBy?: (report: Report, receivedAt: number) => number;
}) {
  let state: WeatherState<Report> = { hydrated: false, entries: { 'zh-HK': {}, en: {} } };
  let hydration: Promise<void> | undefined;
  const listeners = new Set<() => void>();
  const pending = new Map<WeatherLocale, Promise<void>>();

  function publish(next: WeatherState<Report>) {
    state = next;
    for (const notify of listeners) notify();
  }

  function change(locale: WeatherLocale, entry: Entry<Report>) {
    publish({ ...state, entries: { ...state.entries, [locale]: { ...state.entries[locale], ...entry } } });
  }

  function hydrate() {
    hydration ??= (async () => {
      const entries = { ...state.entries };
      try {
        const db = await getDatabase();
        const rows = await db.getAllAsync<CacheRow>(
          'SELECT language, update_time, fetched_at, payload FROM weather_cache WHERE api_type = ?', apiType,
        );
        for (const row of rows) {
          if (!Object.hasOwn(entries, row.language) || !Number.isSafeInteger(row.fetched_at) || row.fetched_at <= 0) continue;
          try {
            const report = parse(JSON.parse(row.payload));
            if (report && (officialTime?.(report) ?? row.fetched_at) === row.update_time) {
              entries[row.language] = { snapshot: { locale: row.language, report, fetchedAt: row.fetched_at } };
            }
          } catch {
            // A corrupt row in one language does not invalidate the other.
          }
        }
      } catch {
        // Weather can still be fetched when local storage is unavailable.
      }
      publish({ hydrated: true, entries });
    })();
    return hydration;
  }

  function nextCheck(locale: WeatherLocale, now = Date.now()) {
    const { snapshot, attemptedAt } = state.entries[locale];
    const lastFetch = snapshot && (!verifyOnLaunch || snapshot.verified) ? snapshot.fetchedAt : 0;
    const checks = [lastFetch, attemptedAt ?? 0].filter((value) => value <= now);
    const scheduled = Math.max(0, ...checks) + interval;
    const deadline = snapshot?.verified && checkBy ? checkBy(snapshot.report, snapshot.fetchedAt) : Infinity;
    return (attemptedAt ?? 0) < deadline
      ? Math.min(scheduled, Math.max(deadline, (attemptedAt ?? 0) + weatherRetryInterval)) : scheduled;
  }

  async function refresh(locale: WeatherLocale, canStart: () => boolean, manual = false) {
    await hydrate();
    if (!canStart() || AppState.currentState !== 'active') return;
    const existing = pending.get(locale);
    if (existing) return existing;
    const now = Date.now();
    const attempt = state.entries[locale].attemptedAt;
    const due = manual ? (attempt !== undefined && attempt <= now ? attempt : 0) + weatherRetryInterval : nextCheck(locale, now);
    if (now < due) return;

    const controller = new AbortController();
    const activity = AppState.addEventListener('change', (next) => {
      if (next !== 'active') controller.abort();
    });
    change(locale, { refreshing: true, attemptedAt: now });
    const work = (async () => {
      try {
        const { report, payload } = await requestWeather(apiType, locale, controller.signal, parse);
        if (controller.signal.aborted) return;
        const prior = state.entries[locale].snapshot;
        const officialUpdateTime = officialTime?.(report);
        const priorTime = prior && officialTime?.(prior.report);
        const fetchedAt = Date.now();
        if ((priorTime !== undefined && officialUpdateTime !== undefined && officialUpdateTime < priorTime)
          || (isUsable && !isUsable(report, fetchedAt))) {
          throw new WeatherRequestError('outdated');
        }
        const snapshot = { locale, report, fetchedAt, verified: true };
        change(locale, { snapshot, failure: undefined });
        await saveSnapshot(apiType, locale, fetchedAt, officialUpdateTime, payload).catch(() => {});
      } catch (error) {
        if (!controller.signal.aborted) {
          change(locale, { failure: error instanceof WeatherRequestError ? error.kind : 'network' });
        }
      } finally {
        activity.remove();
        pending.delete(locale);
        change(locale, {
          refreshing: false,
          ...(controller.signal.aborted ? { attemptedAt: attempt } : {}),
        });
      }
    })();
    pending.set(locale, work);
    return work;
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }

  return { subscribe, getState: () => state, refresh, nextCheck };
}

export type WeatherFeed<Report> = ReturnType<typeof createWeatherFeed<Report>>;
export const observationFeed = createWeatherFeed(weatherApiType, parseWeatherReport, {
  officialTime: (report) => report.updateTime,
});
export const forecastFeed = createWeatherFeed(forecastApiType, parseForecastReport, {
  officialTime: (report) => report.updateTime,
  isUsable: (report, now) => {
    const today = hongKongForecastDay(now);
    return report.days.some(({ date }) => date >= today);
  },
});
// The warning feeds have no report-wide official timestamp. A newer response may remove every warning.
export const warningSummaryFeed = createWeatherFeed(warningSummaryApiType, parseWarningSummary, {
  interval: warningCheckInterval,
  verifyOnLaunch: true,
  checkBy: (report, receivedAt) => Math.min(Infinity, ...report.warnings
    .flatMap(({ expireTime }) => expireTime !== undefined && expireTime > receivedAt ? [expireTime] : [])),
});
export const warningDetailsFeed = createWeatherFeed(warningDetailsApiType, parseWarningDetails, {
  interval: warningCheckInterval,
  verifyOnLaunch: true,
});
