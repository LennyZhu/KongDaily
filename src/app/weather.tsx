import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon, Screen } from '@/components/ui';
import { useLanguage } from '@/language';
import { colors, homeColors, radius, space, touchTarget, weatherColors } from '@/theme';
import {
  formatWeatherTime, primaryWeather, weatherCondition, weatherDatasetUrl, weatherStaleAge,
  weatherTermsUrl, weatherWarningUrl,
} from '@/weather';
import { useWeather } from '@/weather-hooks';

export default function WeatherScreen() {
  const { copy, locale } = useLanguage();
  const labels = copy.weather;
  const weather = useWeather(locale);
  const [showStations, setShowStations] = useState(false);
  const [showRainfall, setShowRainfall] = useState(false);
  const temps = weather.report?.temperature;
  const rain = weather.report?.rainfall;
  const temperatures = temps?.readings ?? [];
  const { temperature } = primaryWeather(weather.report);
  const regionalPreview = temperatures.filter((reading) => reading !== temperature).slice(0, 2);
  const shownTemperatures = showStations || temperatures.length <= 2 ? temperatures : regionalPreview;
  const fullTime = (time: number) => formatWeatherTime(time, locale, true);

  function openOfficial(url: string) {
    void Linking.openURL(url).catch(() => Alert.alert(labels.openLinkFailed));
  }

  return (
    <Screen hasHeader contentStyle={styles.screen}>
      <ObservationCard weather={weather} />

      <Pressable accessibilityRole="link" onPress={() => openOfficial(weatherWarningUrl(locale))}
        style={({ pressed }) => [styles.warning, pressed && styles.pressed]}>
        <Icon name="info.circle" color={weatherColors.warningInk} size={21} />
        <View style={styles.grow}>
          <AppText variant="homeCardTitle" style={styles.warningText}>{labels.warnings}</AppText>
          <AppText variant="brandSubtitle" style={styles.warningText}>{labels.warningsLink}</AppText>
        </View>
        <Icon name="arrow.up.right" color={weatherColors.warningInk} size={14} />
      </Pressable>

      <View style={styles.section}>
        <AppText variant="homeHeading" accessibilityRole="header">{labels.forecast}</AppText>
        <View style={[styles.panel, styles.forecast]}>
          <Icon name="calendar" size={19} />
          <AppText variant="detail" tone="muted" style={styles.grow}>{labels.forecastSoon}</AppText>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <AppText variant="homeHeading" accessibilityRole="header" style={styles.grow}>{labels.temperatures}</AppText>
          <AppText variant="caption" tone="muted" style={styles.sideLabel}>{labels.stationData}</AppText>
        </View>
        {temps && <AppText variant="brandSubtitle" tone="muted">{labels.observed(fullTime(temps.recordTime))}</AppText>}
        <View style={styles.panel}>
          {shownTemperatures.length === 0 && <AppText variant="detail" tone="muted" style={styles.empty}>{labels.noValue}</AppText>}
          {shownTemperatures.map(({ place, value }, index) => (
            <View key={place} style={[styles.listRow, index > 0 && styles.separator]}>
              <AppText variant="detail" style={styles.grow}>{place}</AppText>
              <AppText variant="homeCardTitle" style={styles.number}>{value}°C</AppText>
            </View>
          ))}
          {temperatures.length > 2 && (
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: showStations }}
              onPress={() => setShowStations((shown) => !shown)}
              style={({ pressed }) => [styles.listRow, styles.separator, pressed && styles.pressed]}>
              <AppText variant="detail" tone="primary" style={styles.grow}>
                {showStations ? labels.showLess : labels.showStations(temperatures.length)}
              </AppText>
              <Icon name={showStations ? 'chevron.up' : 'chevron.down'} size={13} />
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <AppText variant="homeHeading" accessibilityRole="header">{labels.rainfall}</AppText>
        <View style={styles.panel}>
          {rain ? (
            <>
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: showRainfall }}
                onPress={() => setShowRainfall((shown) => !shown)}
                style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}>
                <View style={styles.grow}>
                  <AppText variant="detail" tone="primary">{showRainfall ? labels.showLess : labels.showRainfall(rain.readings.length)}</AppText>
                  <AppText variant="brandSubtitle" tone="muted">{labels.rainfallWindow(fullTime(rain.startTime), fullTime(rain.endTime))}</AppText>
                  {weather.now - rain.endTime >= weatherStaleAge && (
                    <AppText variant="caption" tone="muted">{labels.lastData}</AppText>
                  )}
                </View>
                <Icon name={showRainfall ? 'chevron.up' : 'chevron.down'} size={13} />
              </Pressable>
              {showRainfall && rain.readings.map(({ place, min, max }) => (
                <View key={place} style={[styles.listRow, styles.separator]}>
                  <AppText variant="detail" style={styles.grow}>{place}</AppText>
                  <View style={styles.rainValues}>
                    {min !== undefined && <AppText variant="caption" style={styles.number}>{labels.rainMin(min)}</AppText>}
                    {max !== undefined && <AppText variant="caption" style={styles.number}>{labels.rainMax(max)}</AppText>}
                  </View>
                </View>
              ))}
            </>
          ) : <AppText variant="detail" tone="muted" style={styles.empty}>{labels.noValue}</AppText>}
        </View>
      </View>

      <View style={styles.attribution}>
        <Pressable accessibilityRole="link" onPress={() => openOfficial(weatherDatasetUrl(locale))}
          style={({ pressed }) => [styles.sourceLink, pressed && styles.pressed]}>
          <AppText variant="detail" tone="primary" style={styles.linkText}>{labels.attribution}</AppText>
          <Icon name="arrow.up.right" size={13} />
        </Pressable>
        <AppText variant="brandSubtitle" tone="muted" style={styles.center}>{labels.ownership}</AppText>
        <AppText variant="brandSubtitle" tone="muted" style={styles.center}>{labels.hongKongTime}</AppText>
        <Pressable accessibilityRole="link" onPress={() => openOfficial(weatherTermsUrl(locale))}
          style={({ pressed }) => [styles.sourceLink, pressed && styles.pressed]}>
          <AppText variant="brandSubtitle" tone="primary" style={styles.linkText}>{labels.terms}</AppText>
          <Icon name="arrow.up.right" size={12} />
        </Pressable>
      </View>
    </Screen>
  );
}

function ObservationCard({ weather }: { weather: ReturnType<typeof useWeather> }) {
  const { copy, locale } = useLanguage();
  const labels = copy.weather;
  const { temperature, humidity } = primaryWeather(weather.report);
  const uvGroup = weather.report?.uv;
  const uv = uvGroup?.readings[0];
  const [icon, condition] = weatherCondition(weather.report?.icons[0]);
  const time = (timestamp: number, full = weather.stale) => formatWeatherTime(timestamp, locale, full);
  const temperatureTime = weather.raw?.temperature?.recordTime;
  const status = weather.raw && !weather.report ? labels.expired
    : weather.stale ? labels.lastData
      : weather.loading && !weather.report ? labels.loading : !weather.report ? labels.unavailable : undefined;

  return (
    <LinearGradient colors={[homeColors.weatherBright, colors.primary, homeColors.weatherDeep]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.85 }} style={styles.hero}>
      <View pointerEvents="none" style={[styles.wave, styles.waveLeft]} />
      <View pointerEvents="none" style={[styles.wave, styles.waveRight]} />
      <View style={styles.heroHeading}>
        <AppText variant="detail" tone="onPrimaryMuted" style={styles.grow}>{labels.observations}</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel={weather.failure ? labels.retry : labels.refresh}
          accessibilityHint={weather.canRefresh || weather.refreshing ? undefined : labels.retryWait}
          accessibilityState={{ disabled: !weather.canRefresh, busy: weather.refreshing }} disabled={!weather.canRefresh}
          onPress={weather.refresh}
          style={({ pressed }) => [styles.refresh, !weather.canRefresh && styles.refreshDisabled, pressed && styles.pressed]}>
          {weather.refreshing ? <ActivityIndicator color={colors.onPrimary} size="small" />
            : <Icon name="arrow.clockwise" size={19} color={colors.onPrimary} />}
          {weather.failure && <AppText variant="caption" tone="onPrimary">{labels.retry}</AppText>}
        </Pressable>
      </View>
      <View style={styles.heroHeading}>
        <AppText variant="display" tone="onPrimary" style={[styles.grow, styles.temperature]}>
          {temperature ? `${temperature.value}°C` : '—'}
        </AppText>
        <View accessible accessibilityLabel={labels.conditions[condition]}>
          <Icon name={icon} size={40} color={homeColors.weatherIcon} />
        </View>
      </View>
      {temperature && <AppText variant="homeCardTitle" tone="onPrimary">{temperature.place}</AppText>}
      {weather.report && !temperature && <AppText variant="detail" tone="onPrimaryMuted">{labels.temperatureUnavailable}</AppText>}
      {status && <AppText variant="detail" tone="onPrimary" accessibilityLiveRegion="polite">{status}</AppText>}
      {weather.failure && (
        <AppText variant="brandSubtitle" tone="onPrimaryMuted" accessibilityRole="alert">{labels.issues[weather.failure]}</AppText>
      )}
      {weather.report && weather.languageFallback && (
        <AppText variant="brandSubtitle" tone="onPrimaryMuted">{labels.languageFallback}</AppText>
      )}

      <View style={styles.metrics}>
        <WeatherMetric label={labels.humidity} value={humidity ? `${humidity.value}%` : labels.noValue}
          note={humidity && weather.report?.humidity
            ? labels.humidityObservation(humidity.place, time(weather.report.humidity.recordTime)) : undefined} />
        <WeatherMetric label={labels.uv} value={uv ? String(uv.value) : labels.noValue}
          note={uv && [labels.uvAt(uv.place), uv.intensity, uvGroup?.period,
            uvGroup?.recordTime !== undefined ? time(uvGroup.recordTime) : undefined].filter(Boolean).join(' · ')} />
        <WeatherMetric label={labels.temperatureTime}
          value={temperatureTime === undefined ? labels.noValue : time(temperatureTime)} />
      </View>
      {weather.raw && (
        <AppText variant="brandSubtitle" tone="onPrimaryMuted">{labels.updated(time(weather.raw.updateTime, true))}</AppText>
      )}
      {condition !== 'unknown' && weather.report?.iconUpdateTime !== undefined && (
        <AppText variant="caption" tone="onPrimaryMuted">
          {labels.conditions[condition]} · {labels.iconTime(time(weather.report.iconUpdateTime, true))}
        </AppText>
      )}
    </LinearGradient>
  );
}

function WeatherMetric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View style={styles.metric}>
      <AppText variant="caption" tone="onPrimaryMuted">{label}</AppText>
      <AppText variant="title" tone="onPrimary" style={styles.number}>{value}</AppText>
      {note && <AppText variant="brandSubtitle" tone="onPrimaryMuted">{note}</AppText>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: space.lg },
  section: { gap: space.sm },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  sideLabel: { maxWidth: '38%', textAlign: 'right' },
  grow: { flex: 1, minWidth: 0 },
  hero: { padding: space.lg, gap: space.sm, overflow: 'hidden', borderRadius: radius.largeCard },
  heroHeading: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  temperature: { fontSize: 52, fontVariant: ['tabular-nums'] },
  refresh: {
    minWidth: touchTarget, minHeight: touchTarget, paddingHorizontal: space.sm,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs,
    borderColor: homeColors.weatherDivider, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.pill,
  },
  refreshDisabled: { opacity: 0.62 },
  metrics: {
    flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingTop: space.sm, marginTop: space.sm,
    borderTopColor: homeColors.weatherDivider, borderTopWidth: StyleSheet.hairlineWidth,
  },
  metric: { flexGrow: 1, flexBasis: 86, gap: space.xs },
  wave: { position: 'absolute', bottom: -55, width: '78%', height: 108, borderRadius: '50%' },
  waveLeft: { left: '-10%', backgroundColor: homeColors.weatherWaveLight, transform: [{ rotate: '4deg' }] },
  waveRight: { right: '-12%', backgroundColor: homeColors.weatherWave, transform: [{ rotate: '-8deg' }] },
  warning: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md,
    borderRadius: radius.card, backgroundColor: weatherColors.warningSurface,
    borderColor: weatherColors.warningBorder, borderWidth: StyleSheet.hairlineWidth,
  },
  warningText: { color: weatherColors.warningInk },
  panel: {
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: radius.largeCard,
    backgroundColor: colors.surface, overflow: 'hidden',
  },
  forecast: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md },
  listRow: {
    flexDirection: 'row', alignItems: 'center', minHeight: touchTarget,
    paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.sm,
  },
  empty: { padding: space.md },
  separator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  number: { fontVariant: ['tabular-nums'] },
  rainValues: { alignItems: 'flex-end', maxWidth: '42%' },
  attribution: { alignItems: 'center' },
  sourceLink: { minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs },
  linkText: { flexShrink: 1, textAlign: 'center' },
  center: { textAlign: 'center' },
  pressed: { opacity: 0.7 },
});
