import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { getWeatherState, nextWeatherCheck, refreshWeather, subscribeWeather, weatherRetryInterval } from '@/weather-data';
import { hasOtherLanguageWeatherText, weatherHideAge, weatherStaleAge, type WeatherLocale } from '@/weather';

export function useWeather(locale: WeatherLocale) {
  const { hydrated, entries } = useSyncExternalStore(subscribeWeather, getWeatherState, getWeatherState);
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
      void refreshWeather(locale, () => focused.current && generation === current).then(() => {
        if (generation === current && focused.current && AppState.currentState === 'active') {
          timer = setTimeout(check, Math.max(1000, nextWeatherCheck(locale) - Date.now()));
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
  }, [locale]));

  const entry = entries[locale];
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
  const retryAt = (entry.attemptedAt ?? 0) + weatherRetryInterval;
  const nextDeadline = Math.min(retryAt > now ? retryAt : Infinity,
    ...observationTimes.flatMap((time) => time === undefined ? [] : [time + weatherStaleAge, time + weatherHideAge])
      .filter((deadline) => deadline > now));

  useEffect(() => {
    if (!active || !Number.isFinite(nextDeadline)) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(1, nextDeadline - Date.now()));
    return () => clearTimeout(timer);
  }, [active, nextDeadline]);

  return {
    report, raw, stale, now,
    failure: entry.failure, refreshing: Boolean(entry.refreshing),
    loading: !hydrated || (!raw && !entry.failure),
    languageFallback: Boolean(snapshot && (snapshot.locale !== locale || hasOtherLanguageWeatherText(snapshot.report, locale))),
    canRefresh: active && hydrated && !entry.refreshing && now >= retryAt,
    refresh: () => {
      setNow(Date.now());
      void refreshWeather(locale, () => focused.current, true);
    },
  };
}
