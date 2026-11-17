import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { forecastFeed, observationFeed, weatherRetryInterval, type WeatherFeed } from '@/weather-data';
import {
  forecastDaysForDisplay, forecastStaleAge, hasOtherLanguageWeatherText, weatherHideAge, weatherStaleAge, type WeatherLocale,
} from '@/weather';

function useWeatherFeed<Report extends { updateTime: number }>(feed: WeatherFeed<Report>, locale: WeatherLocale) {
  const { hydrated, entries } = useSyncExternalStore(feed.subscribe, feed.getState, feed.getState);
  const [now, setNow] = useState(Date.now);
  const [active, setActive] = useState(false);
  const focused = useRef(false);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let generation = 0;

    function check() {
      const current = ++generation;
      clearTimeout(timer);
      setNow(Date.now());
      void feed.refresh(locale, () => focused.current && generation === current).then(() => {
        if (generation === current && focused.current && AppState.currentState === 'active') {
          timer = setTimeout(check, Math.max(1000, feed.nextCheck(locale) - Date.now()));
        }
      });
    }

    function syncActivity() {
      const isActive = AppState.currentState === 'active';
      setActive(isActive);
      if (isActive) check();
      else {
        generation++;
        clearTimeout(timer);
      }
    }

    const subscription = AppState.addEventListener('change', syncActivity);
    syncActivity();
    return () => {
      focused.current = false;
      setActive(false);
      generation++;
      clearTimeout(timer);
      subscription.remove();
    };
  }, [feed, locale]));

  const entry = entries[locale];
  const retryAt = (entry.attemptedAt ?? 0) + weatherRetryInterval;
  return {
    hydrated, entries, entry, now, active, setNow, retryAt,
    failure: entry.failure, refreshing: Boolean(entry.refreshing),
    canRefresh: active && hydrated && !entry.refreshing && now >= retryAt,
    refresh: () => {
      setNow(Date.now());
      void feed.refresh(locale, () => focused.current, true);
    },
  };
}

function useWeatherDeadline(active: boolean, deadline: number, setNow: (time: number) => void) {
  useEffect(() => {
    if (!active || !Number.isFinite(deadline)) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(1, deadline - Date.now()));
    return () => clearTimeout(timer);
  }, [active, deadline, setNow]);
}

export function useWeather(locale: WeatherLocale) {
  const { entries, entry, now, retryAt, active, setNow, hydrated, failure, refreshing, canRefresh, refresh } =
    useWeatherFeed(observationFeed, locale);
  const isHidden = (time: number) => now - time >= weatherHideAge;
  const alternate = entries[locale === 'en' ? 'zh-HK' : 'en'].snapshot;
  const snapshot = alternate && !isHidden(alternate.report.updateTime)
    && (!entry.snapshot || isHidden(entry.snapshot.report.updateTime)) ? alternate : entry.snapshot ?? alternate;
  const raw = snapshot?.report;
  const report = raw && !isHidden(raw.updateTime) ? {
    ...raw,
    temperature: raw.temperature && !isHidden(raw.temperature.recordTime) ? raw.temperature : undefined,
    humidity: raw.humidity && !isHidden(raw.humidity.recordTime) ? raw.humidity : undefined,
    rainfall: raw.rainfall && !isHidden(raw.rainfall.endTime) ? raw.rainfall : undefined,
    uv: raw.uv && (raw.uv.recordTime === undefined || !isHidden(raw.uv.recordTime)) ? raw.uv : undefined,
  } : undefined;
  const observationTimes = [raw?.updateTime, raw?.temperature?.recordTime, raw?.humidity?.recordTime, raw?.rainfall?.endTime, raw?.uv?.recordTime];
  const stale = Boolean(raw && (
    entry.failure || now - raw.updateTime >= weatherStaleAge
    || (raw.temperature && now - raw.temperature.recordTime >= weatherStaleAge)
    || (raw.humidity && now - raw.humidity.recordTime >= weatherStaleAge)
  ));
  const nextDeadline = Math.min(retryAt > now ? retryAt : Infinity,
    ...observationTimes.flatMap((time) => time === undefined ? [] : [time + weatherStaleAge, time + weatherHideAge])
      .filter((deadline) => deadline > now));

  useWeatherDeadline(active, nextDeadline, setNow);

  return {
    report, raw, stale, now, failure, refreshing, canRefresh, refresh,
    loading: !hydrated || (!raw && !failure),
    languageFallback: Boolean(snapshot && (snapshot.locale !== locale || hasOtherLanguageWeatherText(snapshot.report, locale))),
  };
}

export function useForecast(locale: WeatherLocale) {
  const { entry, now, retryAt, active, setNow, hydrated, failure, refreshing, canRefresh, refresh } =
    useWeatherFeed(forecastFeed, locale);
  const report = entry.snapshot?.report;
  const { days, nextDay, incomplete } = forecastDaysForDisplay(report, now);
  const staleAt = report ? report.updateTime + forecastStaleAge : Infinity;
  useWeatherDeadline(active, Math.min(nextDay, retryAt > now ? retryAt : Infinity, staleAt > now ? staleAt : Infinity), setNow);

  return {
    days, incomplete, now, failure, refreshing, canRefresh, refresh, updateTime: report?.updateTime,
    loading: !hydrated || (!report && !failure),
    stale: Boolean(report && (failure || now >= staleAt)),
    expired: days.length === 0 && Boolean(report || failure === 'outdated'),
  };
}
