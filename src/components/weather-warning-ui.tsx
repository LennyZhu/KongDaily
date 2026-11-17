import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon, type IconName } from '@/components/ui';
import type { Messages } from '@/i18n';
import { useLanguage } from '@/language';
import { colors, radius, space, touchTarget, weatherWarningColors } from '@/theme';
import { formatWeatherTime, type WeatherLocale } from '@/weather';
import { useWeatherWarnings } from '@/weather-hooks';
import { warningTone, type ActiveWeatherWarning } from '@/weather-warnings';

type WarningCopy = Messages['weather']['warning'];

const warningIcons: Partial<Record<ActiveWeatherWarning['category'], IconName>> = {
  WCOLD: 'thermometer.snowflake', WFIRE: 'flame', WFNTSA: 'water.waves', WFROST: 'snowflake',
  WHOT: 'thermometer.sun', WL: 'mountain.2', WMSGNL: 'wind', WTCSGNL: 'hurricane',
  WTMW: 'water.waves', WTS: 'cloud.bolt',
};

export function warningLevel(warning: ActiveWeatherWarning, labels: WarningCopy) {
  const levels: Partial<Record<ActiveWeatherWarning['code'], string>> = labels.levels;
  const level = levels[warning.code] ?? warning.type;
  return level && !warning.name.toLocaleLowerCase().includes(level.toLocaleLowerCase()) ? level : undefined;
}

export function lastWarningCheck(checkedAt: number | undefined, locale: WeatherLocale, labels: WarningCopy) {
  return checkedAt === undefined ? labels.neverChecked : labels.checked(formatWeatherTime(checkedAt, locale, true));
}

export function WeatherWarningLink({ compact = false }: { compact?: boolean }) {
  const { copy, locale } = useLanguage();
  const router = useRouter();
  const labels = copy.weather.warning;
  const { status, warnings, checkedAt } = useWeatherWarnings(locale);
  if (compact && (status === 'none' || status === 'loading')) return null;

  const top = status === 'active' ? warnings[0] : undefined;
  const label = top ? labels.activeSignal([top.name, warningLevel(top, labels)].filter(Boolean).join(' · '))
    : status === 'none' ? labels.none
    : status === 'loading' ? labels.loading : compact ? labels.unknownShort : labels.unknown;
  const others = top && warnings.length > 1 ? labels.others(warnings.length - 1) : undefined;
  const checked = lastWarningCheck(checkedAt, locale, labels);
  const previousWarnings = status === 'stale' && warnings.length > 0;
  const compactMeta = previousWarnings ? labels.stale : others;
  const palette = compact && !top
    ? { surface: colors.surface, border: colors.border, ink: colors.muted }
    : weatherWarningColors[top ? warningTone(top) : 'neutral'];
  const icon = top ? (compact ? warningIcons[top.category] : undefined) ?? 'exclamationmark.triangle' : 'info.circle';

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={[label, others, checked].filter(Boolean).join(' · ')}
      accessibilityHint={[labels.title, previousWarnings && labels.stale].filter(Boolean).join(' · ')}
      onPress={() => router.push('/weather/warnings')}
      style={({ pressed }) => [
        styles.row,
        compact ? styles.compact : styles.detail,
        { backgroundColor: palette.surface, borderColor: palette.border },
        pressed && styles.pressed,
      ]}>
      <Icon name={icon} color={palette.ink} size={compact ? 18 : 21} />
      <View style={styles.copy}>
        <AppText variant={compact && !top ? 'detail' : 'homeCardTitle'} style={{ color: palette.ink }}>{label}</AppText>
        {compact ? (compactMeta && (
          <AppText variant="caption" style={{ color: palette.ink }}>{compactMeta}</AppText>
        )) : (
          <>
            {others && <AppText variant="caption" style={{ color: palette.ink }}>{others}</AppText>}
            <AppText variant="brandSubtitle" style={{ color: palette.ink }}>{checked}</AppText>
            {previousWarnings && <AppText variant="brandSubtitle" style={{ color: palette.ink }}>{labels.stale}</AppText>}
          </>
        )}
      </View>
      <Icon name="chevron.right" color={palette.ink} size={13} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: touchTarget },
  detail: { padding: space.md, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.card },
  compact: {
    borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.control,
    paddingHorizontal: space.md, paddingVertical: space.sm,
  },
  copy: { flex: 1, minWidth: 0, gap: space.xs },
  pressed: { opacity: 0.72 },
});
