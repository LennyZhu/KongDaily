import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import type { GmbSearchState } from '@/gmb-search';
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

const styles = StyleSheet.create({
  feedback: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  message: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  action: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: touchTarget,
    minWidth: touchTarget, maxWidth: '100%', paddingHorizontal: space.sm, borderRadius: radius.control, backgroundColor: colors.tint },
  actionText: { flexShrink: 1 },
  pressed: { opacity: 0.65 },
});
