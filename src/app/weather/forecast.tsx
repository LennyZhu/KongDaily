import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { ForecastDayRow } from '@/components/forecast-day-row';
import { AppText, Icon, Screen, type IconName } from '@/components/ui';
import { useLanguage } from '@/language';
import { colors, radius, space, touchTarget } from '@/theme';
import { forecastSourceUrl, formatWeatherTime, type ForecastDay } from '@/weather';
import { useForecast } from '@/weather-hooks';

export default function ForecastScreen() {
  const { copy, locale } = useLanguage();
  const weather = copy.weather;
  const labels = weather.forecastDetail;
  const forecast = useForecast(locale);
  const [selected, setSelected] = useState<number>();
  const failure = forecast.failure === 'invalid' ? labels.invalid
    : forecast.failure === 'outdated' ? labels.outdated
      : forecast.failure ? weather.issues[forecast.failure] : undefined;
  const empty = forecast.loading ? labels.loading : forecast.expired ? labels.expired : labels.unavailable;

  function openSource() {
    void Linking.openURL(forecastSourceUrl(locale)).catch(() => Alert.alert(weather.openLinkFailed));
  }

  return (
    <Screen hasHeader contentStyle={styles.screen}>
      <View style={[styles.panel, styles.summary]}>
        <View style={styles.summaryRow}>
          <View style={styles.grow}>
            <AppText variant="homeHeading" accessibilityRole="header">{labels.overview}</AppText>
            {forecast.updateTime !== undefined && (
              <AppText variant="brandSubtitle" tone="muted">
                {weather.updated(formatWeatherTime(forecast.updateTime, locale, true))}
              </AppText>
            )}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={failure ? weather.retry : weather.refresh}
            accessibilityHint={forecast.canRefresh || forecast.refreshing ? undefined : weather.retryWait}
            accessibilityState={{ disabled: !forecast.canRefresh, busy: forecast.refreshing }}
            disabled={!forecast.canRefresh} onPress={forecast.refresh}
            style={({ pressed }) => [styles.refresh, !forecast.canRefresh && styles.disabled, pressed && styles.pressed]}>
            {forecast.refreshing ? <ActivityIndicator size="small" color={colors.primary} />
              : <Icon name="arrow.clockwise" size={18} />}
            {failure && <AppText variant="caption" tone="primary">{weather.retry}</AppText>}
          </Pressable>
        </View>
        <Pressable accessibilityRole="link" onPress={openSource}
          style={({ pressed }) => [styles.source, pressed && styles.pressed]}>
          <AppText variant="brandSubtitle" tone="primary" style={styles.shrink}>{weather.attribution}</AppText>
          <Icon name="arrow.up.right" size={12} />
        </Pressable>
        {forecast.stale && <AppText variant="caption" tone="muted">{weather.lastData}</AppText>}
        {failure && <AppText variant="brandSubtitle" tone="error" accessibilityRole="alert">{failure}</AppText>}
        {forecast.incomplete && <AppText variant="brandSubtitle" tone="muted">{labels.incomplete}</AppText>}
      </View>

      <View style={styles.panel}>
        {forecast.days.length === 0 ? (
          <View style={styles.empty} accessibilityLiveRegion="polite">
            {forecast.loading ? <ActivityIndicator size="small" color={colors.primary} />
              : <Icon name="calendar" size={19} />}
            <AppText variant="detail" tone="muted" style={styles.grow}>{empty}</AppText>
          </View>
        ) : forecast.days.map((day, index) => (
          <View key={day.date} style={index > 0 ? styles.separator : undefined}>
            <ForecastRow day={day} now={forecast.now} expanded={day.date === selected}
              onToggle={() => setSelected((current) => current === day.date ? undefined : day.date)} />
          </View>
        ))}
      </View>

      <AppText variant="caption" tone="muted" style={styles.center}>{weather.hongKongTime}</AppText>
    </Screen>
  );
}

function ForecastRow({ day, now, expanded, onToggle }: {
  day: ForecastDay;
  now: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <ForecastDayRow day={day} now={now} expanded={expanded} onToggle={onToggle} />
      {expanded && <ForecastDayDetails day={day} />}
    </>
  );
}

function ForecastDayDetails({ day }: { day: ForecastDay }) {
  const { copy } = useLanguage();
  const weather = copy.weather;
  const labels = weather.forecastDetail;
  const psr = day.psr ? labels.psrLevel[day.psr] : weather.noValue;
  const humidity = day.minRh !== undefined && day.maxRh !== undefined ? `${day.minRh}%–${day.maxRh}%`
    : day.minRh !== undefined ? `${labels.minimum} ${day.minRh}%`
      : day.maxRh !== undefined ? `${labels.maximum} ${day.maxRh}%` : weather.noValue;

  return (
    <View style={styles.details}>
      <ForecastDetail icon="cloud" label={labels.description} value={day.description ?? weather.noValue} />
      <ForecastDetail icon="wind" label={labels.wind} value={day.wind ?? weather.noValue} />
      <ForecastDetail icon="humidity" label={weather.humidity} value={humidity} />
      <ForecastDetail icon="umbrella" label={labels.psr} value={psr} note={labels.psrNote} />
    </View>
  );
}

function ForecastDetail({ icon, label, value, note }: { icon: IconName; label: string; value: string; note?: string }) {
  return (
    <View style={[styles.detail, styles.separator]}>
      <View style={styles.detailIcon}><Icon name={icon} size={21} /></View>
      <View style={styles.grow}>
        <AppText variant="caption">{label}</AppText>
        <AppText variant="detail">{value}</AppText>
        {note && <AppText variant="brandSubtitle" tone="muted">{note}</AppText>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: space.md },
  panel: {
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.largeCard, overflow: 'hidden',
  },
  summary: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.xs },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  grow: { flex: 1, minWidth: 0, gap: space.xs },
  shrink: { flexShrink: 1 },
  refresh: {
    minWidth: touchTarget, minHeight: touchTarget, paddingHorizontal: space.sm, borderRadius: radius.pill,
    backgroundColor: colors.tint, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs,
  },
  disabled: { opacity: 0.55 },
  source: {
    minHeight: touchTarget, alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: space.xs,
  },
  separator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  details: { paddingHorizontal: space.md, paddingBottom: space.xs, backgroundColor: colors.tintedBackground },
  detail: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: space.sm },
  detailIcon: { width: 30, alignItems: 'center', paddingTop: 2 },
  empty: { minHeight: 74, padding: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  center: { textAlign: 'center' },
  pressed: { opacity: 0.72 },
});
