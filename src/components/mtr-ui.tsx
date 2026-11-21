import { useRouter } from 'expo-router';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { useLanguage } from '@/language';
import { findMtrLine, mtrName, type MtrEntry } from '@/mtr-static';
import { colors, radius, space, touchTarget } from '@/theme';

export function MtrEntryRow({ entry, sequence }: { entry: MtrEntry; sequence?: number }) {
  const { copy, locale } = useLanguage();
  const router = useRouter();
  const isLine = entry.kind === 'mtr-line';
  const alternateName = mtrName(entry, locale === 'en' ? 'zh-HK' : 'en');
  const lines = isLine ? [] : entry.memberships.flatMap(({ lineCode }) => {
    const line = findMtrLine(lineCode);
    return line ? [mtrName(line, locale)] : [];
  });
  const type = isLine ? copy.mtr.lineType : copy.mtr.stationType;

  return (
    <Pressable accessibilityRole="button" onPress={() => {
      Keyboard.dismiss();
      router.push({ pathname: '/mtr/[kind]', params: { kind: isLine ? 'line' : 'station', code: entry.id } });
    }} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {sequence === undefined
        ? <Icon name={isLine ? 'tram.fill.tunnel' : 'mappin'} size={18} />
        : <AppText variant="caption" tone="primary">{sequence}</AppText>}
      <View style={styles.copy}>
        <AppText variant="caption" tone="primary">{type} · {entry.id}</AppText>
        <AppText variant="homeCardTitle">{mtrName(entry, locale)}</AppText>
        <AppText variant="detail" tone="muted">{alternateName}</AppText>
        {lines.length > 0 && <AppText variant="detail" tone="muted">{lines.join(' · ')}</AppText>}
      </View>
      <Icon name="chevron.right" color={colors.muted} size={13} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: touchTarget, padding: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.surface, borderRadius: radius.media,
    borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth,
  },
  copy: { flex: 1, minWidth: 0, gap: space.xs },
  pressed: { opacity: 0.76 },
});
