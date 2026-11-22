import { useRouter } from 'expo-router';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { useLanguage } from '@/language';
import { findLightRailStop, type LightRailEntry, type LightRailPattern, type LightRailStop } from '@/light-rail-static';
import { colors, radius, space, touchTarget } from '@/theme';

export function lightRailEndpoints(pattern: LightRailPattern, locale: 'zh-HK' | 'en') {
  const first = findLightRailStop(pattern.visits[0]?.stopId);
  const last = findLightRailStop(pattern.visits.at(-1)?.stopId);
  if (first && last) return locale === 'en' ? `${first.en} → ${last.en}` : `${first.zh} → ${last.zh}`;
}

export function LightRailEntryRow({ entry, sequence, nearby, routeId }: {
  entry: LightRailEntry; sequence?: number; nearby?: { boarding: LightRailStop; distance: string }; routeId?: string;
}) {
  const { copy, locale } = useLanguage();
  const router = useRouter();
  const labels = copy.lightRail;
  const isRoute = entry.kind === 'light-rail-route';
  const title = isRoute ? labels.route(entry.id) : locale === 'en' ? entry.en : entry.zh;
  const detail = isRoute ? (entry.circular ? labels.circular : lightRailEndpoints(entry.patterns[0], locale))
    : locale === 'en' ? entry.zh : entry.en;

  return (
    <Pressable accessibilityRole="button" onPress={() => {
      Keyboard.dismiss();
      router.push({ pathname: '/light-rail/[kind]', params: {
        kind: isRoute ? 'route' : 'stop', id: entry.id,
        ...(!isRoute && routeId && entry.routes.includes(routeId) ? { route: routeId } : {}),
      } });
    }} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      {sequence === undefined
        ? <Icon name={isRoute ? 'train.side.front.car' : 'mappin'} size={18} />
        : <AppText variant="caption" tone="primary">{sequence}</AppText>}
      <View style={styles.copy}>
        <AppText variant="caption" tone="primary">{isRoute ? labels.routeType : labels.stopType}</AppText>
        <AppText variant="homeCardTitle">{title}</AppText>
        {!!detail && <AppText variant="detail" tone="muted">{detail}</AppText>}
        {!isRoute && <AppText variant="detail" tone="muted">{labels.servedBy(entry.routes.join(' · '))}</AppText>}
        {nearby && isRoute && <AppText variant="detail" tone="muted">
          {copy.transport.boardingAt(locale === 'en' ? nearby.boarding.en : nearby.boarding.zh)}
        </AppText>}
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
