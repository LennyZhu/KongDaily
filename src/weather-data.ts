import { AppState } from 'react-native';

import { getDatabase } from '@/database';
import { parseWeatherReport, weatherApiType, type WeatherLocale, type WeatherReport } from '@/weather';

export type WeatherFailure = 'network' | 'tls' | 'http' | 'timeout' | 'json' | 'invalid' | 'outdated';
export type WeatherSnapshot = { locale: WeatherLocale; report: WeatherReport; fetchedAt: number };

type Entry = { snapshot?: WeatherSnapshot; failure?: WeatherFailure; refreshing?: boolean; attemptedAt?: number };
type CacheRow = { language: WeatherLocale; update_time: number; fetched_at: number; payload: string };
type WeatherState = { hydrated: boolean; entries: Record<WeatherLocale, Entry> };

const refreshInterval = 20 * 60_000;
export const weatherRetryInterval = 15_000;
const requestTimeout = 12_000;
const baseUrl = 'https://data.weather.gov.hk/weatherAPI/opendata/weather.php';

let state: WeatherState = { hydrated: false, entries: { 'zh-HK': {}, en: {} } };
let hydration: Promise<void> | undefined;
const listeners = new Set<() => void>();
const pending = new Map<WeatherLocale, Promise<void>>();

class WeatherRequestError extends Error {
  constructor(readonly kind: WeatherFailure) {
    super(kind);
  }
}

export function subscribeWeather(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getWeatherState() {
  return state;
}

function publish(next: WeatherState) {
  state = next;
  for (const notify of listeners) notify();
}

function change(locale: WeatherLocale, entry: Entry) {
  publish({ ...state, entries: { ...state.entries, [locale]: { ...state.entries[locale], ...entry } } });
}

function hydrateWeather() {
  hydration ??= (async () => {
    const entries = { ...state.entries };
    try {
      const db = await getDatabase();
      const rows = await db.getAllAsync<CacheRow>(
        'SELECT language, update_time, fetched_at, payload FROM weather_cache WHERE api_type = ?', weatherApiType,
      );
      for (const row of rows) {
        if (!Object.hasOwn(entries, row.language) || !Number.isSafeInteger(row.fetched_at) || row.fetched_at <= 0) continue;
        try {
          const report = parseWeatherReport(JSON.parse(row.payload));
          if (report && report.updateTime === row.update_time) {
            entries[row.language] = { snapshot: { locale: row.language, report, fetchedAt: row.fetched_at } };
          }
        } catch {
          // The other language can still be read if a single saved report is corrupt.
        }
      }
    } catch {
      // Weather can still be fetched when local storage is unavailable.
    }
    publish({ hydrated: true, entries });
  })();
  return hydration;
}

async function requestWeather(locale: WeatherLocale, signal: AbortSignal) {
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
    const response = await fetch(`${baseUrl}?dataType=${weatherApiType}&lang=${locale === 'en' ? 'en' : 'tc'}`,
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
  const report = parseWeatherReport(json);
  if (!report) throw new WeatherRequestError('invalid');
  return { report, payload };
}

async function saveSnapshot({ locale, report, fetchedAt }: WeatherSnapshot, payload: string) {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO weather_cache (api_type, language, update_time, fetched_at, payload)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(api_type, language) DO UPDATE SET
       update_time = excluded.update_time, fetched_at = excluded.fetched_at, payload = excluded.payload
     WHERE excluded.update_time >= weather_cache.update_time`,
    weatherApiType, locale, report.updateTime, fetchedAt, payload,
  );
}

export function nextWeatherCheck(locale: WeatherLocale, now = Date.now()) {
  const { snapshot, attemptedAt } = state.entries[locale];
  const checks = [snapshot?.fetchedAt ?? 0, attemptedAt ?? 0].filter((value) => value <= now);
  return Math.max(0, ...checks) + refreshInterval;
}

export async function refreshWeather(locale: WeatherLocale, canStart: () => boolean, manual = false) {
  await hydrateWeather();
  if (!canStart() || AppState.currentState !== 'active') return;
  const existing = pending.get(locale);
  if (existing) return existing;
  const now = Date.now();
  const attempt = state.entries[locale].attemptedAt;
  const due = manual ? (attempt !== undefined && attempt <= now ? attempt : 0) + weatherRetryInterval : nextWeatherCheck(locale, now);
  if (now < due) return;

  const controller = new AbortController();
  const activity = AppState.addEventListener('change', (next) => {
    if (next !== 'active') controller.abort();
  });
  change(locale, { refreshing: true, attemptedAt: now });
  const work = (async () => {
    try {
      const { report, payload } = await requestWeather(locale, controller.signal);
      if (controller.signal.aborted) return;
      const priorTime = state.entries[locale].snapshot?.report.updateTime;
      if (priorTime !== undefined && report.updateTime < priorTime) throw new WeatherRequestError('outdated');
      const snapshot = { locale, report, fetchedAt: Date.now() };
      change(locale, { snapshot, failure: undefined });
      await saveSnapshot(snapshot, payload).catch(() => {});
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
