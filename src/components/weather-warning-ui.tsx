import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import type { Messages } from '@/i18n';
import { useLanguage } from '@/language';
import { colors, homeColors, radius, space, touchTarget, weatherWarningColors } from '@/theme';
import { formatWeatherTime, type WeatherLocale } from '@/weather';
import { useWeatherWarnings } from '@/weather-hooks';
import { warningTone, type ActiveWeatherWarning } from '@/weather-warnings';

type WarningCopy = Messages['weather']['warning'];

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
  const compactMeta = [others, checkedAt !== undefined && labels.checkedShort(formatWeatherTime(checkedAt, locale, status === 'stale'))]
    .filter(Boolean).join(' · ');
  const previousWarnings = status === 'stale' && warnings.length > 0;
  const palette = weatherWarningColors[top ? warningTone(top) : 'neutral'];
  const textColor = compact ? colors.onPrimary : palette.ink;

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={[label, others, checked].filter(Boolean).join(' · ')}
      accessibilityHint={[labels.title, !compact && previousWarnings && labels.stale].filter(Boolean).join(' · ')}
      onPress={() => router.push('/weather/warnings')}
      style={({ pressed }) => [
        styles.row,
        compact ? styles.compact : [styles.detail, { backgroundColor: palette.surface, borderColor: palette.border }],
        pressed && styles.pressed,
      ]}>
      <Icon name={top ? 'exclamationmark.triangle' : 'info.circle'} color={textColor} size={compact ? 17 : 21} />
      <View style={styles.copy}>
        <AppText variant={compact ? 'caption' : 'homeCardTitle'} style={{ color: textColor }}>{label}</AppText>
        {compact ? (compactMeta !== '' && (
          <AppText variant="caption" tone="onPrimaryMuted">{compactMeta}</AppText>
        )) : (
          <>
            {others && <AppText variant="caption" style={{ color: textColor }}>{others}</AppText>}
            <AppText variant="brandSubtitle" style={{ color: textColor }}>{checked}</AppText>
            {previousWarnings && <AppText variant="brandSubtitle" style={{ color: textColor }}>{labels.stale}</AppText>}
          </>
        )}
      </View>
      <Icon name="chevron.right" color={textColor} size={13} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: touchTarget },
  detail: { padding: space.md, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.card },
  compact: {
    backgroundColor: homeColors.weatherDeep, paddingHorizontal: space.lg, paddingVertical: space.sm,
  },
  copy: { flex: 1, minWidth: 0, gap: space.xs },
  pressed: { opacity: 0.72 },
});
