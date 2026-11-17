import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { useLanguage } from '@/language';
import { colors, space } from '@/theme';
import { forecastWeekday, formatForecastDate, weatherCondition, type ForecastDay } from '@/weather';

export function ForecastDayRow({ day, now, expanded = false, onToggle }: {
  day: ForecastDay;
  now: number;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const { copy, locale } = useLanguage();
  const weather = copy.weather;
  const labels = weather.forecastDetail;
  const date = formatForecastDate(day.date, locale, now);
  const weekday = forecastWeekday(day, locale);
  const [icon, condition] = weatherCondition(day.icon);
  const high = day.maxTemp === undefined ? '—' : `${day.maxTemp}°C`;
  const low = day.minTemp === undefined ? '—' : `${day.minTemp}°C`;
  const psr = day.psr ? labels.psrLevel[day.psr] : weather.noValue;
  const accessibilityLabel = [
    date, weekday, weather.conditions[condition],
    `${labels.maximum} ${day.maxTemp === undefined ? weather.noValue : high}`,
    `${labels.minimum} ${day.minTemp === undefined ? weather.noValue : low}`,
    `${labels.psr} ${psr}`,
  ].join(' · ');

  const summary = (
    <>
      <View style={styles.date}>
        <AppText variant="homeCardTitle">{date}</AppText>
        <AppText variant="caption" tone="muted">{weekday}</AppText>
      </View>
      <View style={styles.icon}>
        <Icon name={icon} size={26} color={condition === 'unknown' ? colors.muted : colors.primary} />
      </View>
      <View style={styles.readings}>
        <View style={styles.temperatures}>
          <AppText variant="title" style={styles.temperature}>{high} /</AppText>
          <AppText variant="title" style={styles.temperature}>{low}</AppText>
        </View>
        <AppText variant="caption" tone="primary" style={styles.right}>PSR · {psr}</AppText>
      </View>
      {onToggle && <Icon name={expanded ? 'chevron.up' : 'chevron.down'} size={13} />}
    </>
  );

  return onToggle ? (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityLanguage={locale}
      accessibilityState={{ expanded }} onPress={onToggle}
      style={({ pressed }) => [styles.row, expanded && styles.expanded, pressed && styles.pressed]}>
      {summary}
    </Pressable>
  ) : (
    <View accessible accessibilityLabel={accessibilityLabel} accessibilityLanguage={locale} style={styles.row}>
      {summary}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: space.sm,
    paddingHorizontal: space.md, paddingVertical: space.sm,
  },
  date: { flex: 1, minWidth: 0, gap: 2 },
  icon: { width: 30, alignItems: 'center' },
  readings: { flex: 1.35, minWidth: 0, alignItems: 'flex-end', gap: 2 },
  temperatures: {
    alignSelf: 'stretch', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end',
    alignItems: 'baseline', columnGap: space.xs,
  },
  temperature: { maxWidth: '100%', fontVariant: ['tabular-nums'], textAlign: 'right' },
  right: { maxWidth: '100%', textAlign: 'right' },
  expanded: { backgroundColor: colors.tintedBackground },
  pressed: { backgroundColor: colors.pressed },
});
