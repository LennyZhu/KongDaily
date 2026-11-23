import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import type { GmbEtaView } from '@/gmb-data';
import { gmbText, type GmbSearchState } from '@/gmb-search';
import { formatHongKongTime } from '@/next-train-time';
import { useLanguage } from '@/language';
import { colors, radius, space, touchTarget } from '@/theme';

export function GmbFeedback({ text, busy, onRetry }: { text: string; busy?: boolean; onRetry?: () => void }) {
  const { copy } = useLanguage();
  return (
    <View style={styles.feedback}>
      {busy && <ActivityIndicator color={colors.primary} />}
      <AppText variant="detail" tone="muted" accessibilityLiveRegion="polite" style={styles.message}>{text}</AppText>
      {onRetry && (
        <Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
          <Icon name="arrow.clockwise" size={14} />
          <AppText variant="detail" tone="primary" style={styles.actionText}>{copy.bus.retry}</AppText>
        </Pressable>
      )}
    </View>
  );
}

export function GmbSearchNotice({ state, retry }: { state?: GmbSearchState; retry: () => void }) {
  const { copy: { minibus: labels } } = useLanguage();
  if (state?.status === 'loading') return <GmbFeedback text={labels.loadingSearch} busy />;
  if (state?.status === 'failed' || state?.status === 'partial') {
    return <GmbFeedback text={state.status === 'partial' ? labels.searchPartial : labels.searchFailed} onRetry={retry} />;
  }
  return null;
}

export function GmbForecastRows({ view, first, compact = false }: {
  view?: GmbEtaView; first: boolean; compact?: boolean;
}) {
  const { copy: { minibus: labels }, locale } = useLanguage();
  const message = !view ? labels.loadingEta : view.kind === 'forecast' ? undefined
    : view.kind === 'stale' ? labels.etaStale : view.kind === 'empty' ? labels.etaEmpty
      : view.kind === 'disabled' ? gmbText(view.description, locale) || labels.etaDisabled
        : view.kind === 'timeout' ? labels.etaTimeout
          : view.kind === 'rateLimited' ? labels.etaRateLimited : labels.etaFailed;
  if (message) return <AppText variant="detail" tone="muted" accessibilityLiveRegion="polite">{message}</AppText>;
  if (view?.kind !== 'forecast') return null;
  const entries = compact ? view.entries.slice(0, 1) : view.entries;
  return entries.map((entry) => {
    const remark = gmbText(entry.remarks, locale);
    if (entry.kind === 'notice') return <AppText key={entry.sequence} variant="detail" tone="muted">{remark}</AppText>;
    const timestamp = formatHongKongTime(entry.timestamp);
    const time = compact && timestamp.slice(0, 10) === formatHongKongTime(view.generatedAt).slice(0, 10)
      ? timestamp.slice(11) : timestamp;
    // The feed does not distinguish arrivals and departures at the first stop.
    const label = entry.kind === 'scheduled' ? labels.scheduled
      : first && entry.imminent ? labels.dueSoonService
        : entry.imminent ? labels.due : entry.remainingMinutes === undefined ? undefined : labels.minutes(entry.remainingMinutes);
    return (
      <View key={entry.sequence} style={compact ? styles.homeEta : styles.etaRow}>
        {!!label && <AppText variant={compact ? entry.kind === 'scheduled' ? 'detail' : 'title' : 'detail'}
          tone="primary" style={compact && styles.homeTime}>{label}</AppText>}
        <AppText variant={compact ? 'caption' : 'detail'}
          tone={compact ? 'muted' : 'text'} style={compact && styles.homeTime}>{time}</AppText>
      </View>
    );
  });
}

const styles = StyleSheet.create({
  feedback: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  message: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  action: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: touchTarget,
    minWidth: touchTarget, maxWidth: '100%', paddingHorizontal: space.sm, borderRadius: radius.control, backgroundColor: colors.tint },
  actionText: { flexShrink: 1 },
  etaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: space.sm },
  homeTime: { textAlign: 'right', fontVariant: ['tabular-nums'] },
  homeEta: { alignItems: 'flex-end', gap: space.xs, maxWidth: '100%' },
  pressed: { opacity: 0.65 },
});
