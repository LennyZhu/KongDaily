import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon, Screen } from '@/components/ui';
import { lastWarningCheck, warningLevel } from '@/components/weather-warning-ui';
import { useLanguage } from '@/language';
import { colors, radius, space, touchTarget, weatherWarningColors } from '@/theme';
import { formatWeatherTime, weatherWarningUrl } from '@/weather';
import { useWarningDetails, useWeatherWarnings } from '@/weather-hooks';
import { matchingWarningDetail, warningTone, type ActiveWeatherWarning, type WarningDetail } from '@/weather-warnings';

export default function WeatherWarningsScreen() {
  const { copy, locale } = useLanguage();
  const weather = copy.weather;
  const labels = weather.warning;
  const summary = useWeatherWarnings(locale);
  const { details, loading: detailsLoading, now, refresh: refreshDetails } = useWarningDetails(locale);
  const { status, warnings, checkedAt, failure } = summary;
  const unverified = status === 'unknown' || status === 'stale';
  const title = status === 'active' ? labels.active(warnings.length)
    : status === 'none' ? labels.none : status === 'loading' ? labels.loading : labels.unknown;
  const failureText = failure === 'invalid' ? labels.invalid : failure && weather.issues[failure];
  const special = details.filter((detail) =>
    detail.category === 'WTCPRE8' && detail.updateTime <= now && detail.contents.some((paragraph) => paragraph.trim()))
    .sort((a, b) => b.updateTime - a.updateTime)[0];

  function refresh() {
    summary.refresh();
    refreshDetails();
  }

  function openOfficial() {
    void Linking.openURL(weatherWarningUrl(locale)).catch(() => Alert.alert(weather.openLinkFailed));
  }

  return (
    <Screen hasHeader contentStyle={styles.screen}>
      <View style={styles.panel}>
        <View style={styles.summary}>
          <View style={styles.statusIcon}>
            {status === 'loading' ? <ActivityIndicator color={colors.primary} />
              : <Icon name={status === 'active' ? 'exclamationmark.triangle' : 'info.circle'} size={25} />}
          </View>
          <View style={styles.statusText} accessibilityLiveRegion="polite">
            <AppText variant="homeHeading" accessibilityRole="header">{title}</AppText>
            <AppText variant="brandSubtitle" tone="muted">{weather.attribution}</AppText>
          </View>
        </View>
        {failureText && <AppText variant="detail" tone="error" accessibilityRole="alert">{failureText}</AppText>}
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: !summary.canRefresh, busy: summary.refreshing }}
            accessibilityHint={!summary.canRefresh && !summary.refreshing ? weather.retryWait : undefined}
            disabled={!summary.canRefresh} onPress={refresh}
            style={({ pressed }) => [styles.action, styles.refresh, !summary.canRefresh && styles.disabled, pressed && styles.pressed]}>
            {summary.refreshing ? <ActivityIndicator size="small" color={colors.primary} />
              : <Icon name="arrow.clockwise" size={17} />}
            <AppText variant="detail" tone="primary" style={styles.buttonLabel}>{failure ? weather.retry : weather.refresh}</AppText>
          </Pressable>
          <Pressable accessibilityRole="link" onPress={openOfficial}
            style={({ pressed }) => [styles.action, styles.official, pressed && styles.pressed]}>
            <AppText variant="detail" tone="onPrimary" style={styles.buttonLabel}>{labels.official}</AppText>
            <Icon name="arrow.up.right" size={13} color={colors.onPrimary} />
          </Pressable>
        </View>
        <AppText variant="caption" tone="muted">{lastWarningCheck(checkedAt, locale, labels)}</AppText>
      </View>

      {unverified && (
        <View style={styles.note}>
          <Icon name="info.circle" size={18} />
          <AppText variant="detail" style={styles.statusText}>{labels.checkOfficial}</AppText>
        </View>
      )}

      {status === 'active' && warnings.map((warning) => (
        <WarningCard key={warning.code} warning={warning} detail={matchingWarningDetail(warning, details, now)}
          loading={detailsLoading} />
      ))}

      {status === 'stale' && warnings.length > 0 && (
        <View style={styles.panel}>
          <AppText variant="homeCardTitle" accessibilityRole="header">{labels.stale}</AppText>
          {warnings.map((warning) => (
            <AppText key={warning.code} variant="detail" tone="muted">
              {[warning.name, warningLevel(warning, labels)].filter(Boolean).join(' · ')}
            </AppText>
          ))}
        </View>
      )}

      {special && (
        <View style={styles.panel}>
          <AppText variant="caption" tone="primary">{labels.special}</AppText>
          <AppText variant="homeCardTitle" accessibilityRole="header">{labels.preNo8}</AppText>
          <AppText variant="brandSubtitle" tone="muted">{labels.updatedAt(formatWeatherTime(special.updateTime, locale, true))}</AppText>
          <WarningParagraphs detail={special} />
          <AppText variant="caption" tone="muted">{weather.attribution}</AppText>
        </View>
      )}
    </Screen>
  );
}

function WarningCard({ warning, detail, loading }: {
  warning: ActiveWeatherWarning;
  detail?: WarningDetail;
  loading: boolean;
}) {
  const { copy, locale } = useLanguage();
  const labels = copy.weather.warning;
  const palette = weatherWarningColors[warningTone(warning)];
  const level = warningLevel(warning, labels);
  const time = (timestamp: number) => formatWeatherTime(timestamp, locale, true);
  return (
    <View style={styles.panel}>
      <View style={[styles.badge, { backgroundColor: palette.surface }]}>
        <Icon name="exclamationmark.triangle" color={palette.ink} size={16} />
        <AppText variant="caption" style={[styles.actionLabel, { color: palette.ink }]}>
          {[level, labels.actions[warning.action]].filter(Boolean).join(' · ')}
        </AppText>
      </View>
      <AppText variant="weatherTitle" accessibilityRole="header">{warning.name}</AppText>
      <View style={styles.times}>
        <AppText variant="brandSubtitle" tone="muted">{labels.issuedAt(time(warning.issueTime))}</AppText>
        {(warning.updateTime !== warning.issueTime || warning.action !== 'ISSUE') && (
          <AppText variant="brandSubtitle" tone="muted">{labels.updatedAt(time(warning.updateTime))}</AppText>
        )}
        {warning.expireTime !== undefined && (
          <AppText variant="brandSubtitle" tone="muted">{labels.expiresAt(time(warning.expireTime))}</AppText>
        )}
        <AppText variant="caption" tone="muted">{copy.weather.hongKongTime}</AppText>
      </View>
      {detail ? <WarningParagraphs detail={detail} /> : (
        <AppText variant="detail" tone="muted">{loading ? labels.detailsLoading : labels.detailsUnavailable}</AppText>
      )}
      <AppText variant="caption" tone="muted">{copy.weather.attribution}</AppText>
    </View>
  );
}

function WarningParagraphs({ detail }: { detail: WarningDetail }) {
  return (
    <View style={styles.paragraphs}>
      {detail.contents.map((paragraph, index) => (
        <AppText key={index} variant="detail" selectable>{paragraph}</AppText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { gap: space.md },
  panel: {
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.largeCard, padding: space.lg, gap: space.sm,
  },
  summary: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  statusIcon: {
    width: 46, height: 46, borderRadius: radius.control, backgroundColor: colors.tintedBackground,
    justifyContent: 'center', alignItems: 'center',
  },
  statusText: { flex: 1, minWidth: 0, gap: space.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', gap: space.sm, marginTop: space.xs },
  action: {
    flexGrow: 1, flexBasis: 120, minHeight: touchTarget, borderRadius: radius.control, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: space.xs, paddingHorizontal: space.md, paddingVertical: space.sm,
  },
  refresh: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.primary },
  official: { backgroundColor: colors.primary, flexBasis: 148 },
  buttonLabel: { flexShrink: 1, minWidth: 0, textAlign: 'center' },
  actionLabel: { flexShrink: 1 },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.72 },
  note: {
    flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, padding: space.md,
    borderRadius: radius.card, backgroundColor: colors.tintedBackground,
  },
  badge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space.xs,
    borderRadius: radius.control, paddingHorizontal: space.sm, paddingVertical: space.xs,
  },
  times: { gap: space.xs },
  paragraphs: {
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: space.sm, gap: space.sm,
  },
});
