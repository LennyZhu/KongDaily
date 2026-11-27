import { useHomeTransitRouter } from '@/home-transit-intent';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { useLanguage } from '@/language';
import { findMtrLine, mtrName, type MtrEntry, type MtrLineCode, type MtrStation } from '@/mtr-static';
import { colors, radius, space, touchTarget } from '@/theme';

export function MtrEntryRow({ entry, sequence, lineCode, nearby }: {
  entry: MtrEntry; sequence?: number; lineCode?: MtrLineCode;
  nearby?: { boarding: MtrStation; distance: string };
}) {
  const { copy, locale } = useLanguage();
  const router = useHomeTransitRouter();
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
      router.push({
        pathname: '/mtr/[kind]',
        params: { kind: isLine ? 'line' : 'station', code: entry.id, ...(!isLine && lineCode ? { line: lineCode } : {}) },
      });
    }} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {sequence === undefined
        ? <Icon name={isLine ? 'tram.fill.tunnel' : 'mappin'} size={18} />
        : <AppText variant="caption" tone="primary">{sequence}</AppText>}
      <View style={styles.copy}>
        <AppText variant="caption" tone="primary">{type} · {entry.id}</AppText>
        <AppText variant="homeCardTitle">{mtrName(entry, locale)}</AppText>
        <AppText variant="detail" tone="muted">{alternateName}</AppText>
        {lines.length > 0 && <AppText variant="detail" tone="muted">{lines.join(' · ')}</AppText>}
        {nearby && isLine && <AppText variant="detail" tone="muted">{copy.transport.boardingAt(mtrName(nearby.boarding, locale))}</AppText>}
        {nearby && <AppText variant="caption" tone="primary">{nearby.distance}</AppText>}
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
