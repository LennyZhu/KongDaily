import { useRouter } from 'expo-router';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { hkkfRouteHref } from '@/global-search-navigation';
import { hkkfNearbyCopy } from '@/hkkf-nearby-copy';
import { hkkfPierDisplayName, hkkfSource, isHkkfDirection } from '@/hkkf-data';
import { useLanguage } from '@/language';
import type { FerryNearbyPierRow, FerryNearbyRouteRow } from '@/nearby-hkkf';
import { colors, radius, space, touchTarget } from '@/theme';

export function HkkfNearbyRouteCard({ row: { sailing, distance }, formatDistance, insidePier = false }: {
  row: FerryNearbyRouteRow; formatDistance: (distance: number) => string; insidePier?: boolean;
}) {
  const { copy: { ferry }, locale } = useLanguage();
  const router = useRouter();
  const { direction, name } = sailing;
  const boarding = hkkfPierDisplayName(direction.originPierId)?.[locale];
  const destination = hkkfPierDisplayName(direction.destinationPierId)?.[locale];
  const title = name[locale];
  const operator = hkkfSource.owner[locale];
  const range = distance === undefined ? undefined : hkkfNearbyCopy[locale].pierDistance(formatDistance(distance));
  return (
    <Pressable accessibilityRole="button" style={({ pressed }) => [styles.row, insidePier ? styles.departure : styles.card,
      pressed && styles.pressed]}
      onPress={() => {
        if (!isHkkfDirection(direction.directionId)) return;
        const href = hkkfRouteHref(direction.operatorId, direction.operatorRouteId, direction.directionId);
        if (!href) return;
        Keyboard.dismiss();
        router.push(href);
      }}>
      {!insidePier && <View style={styles.icon}><Icon name="ferry" size={19} /></View>}
      <View style={styles.copy}>
        <AppText variant="homeCardTitle">{title}</AppText>
        {!insidePier && <AppText variant="caption" tone="muted">{operator}</AppText>}
        {!!boarding && !insidePier && <AppText variant="detail">{hkkfNearbyCopy[locale].boardingPier(boarding)}</AppText>}
        {!!destination && <AppText variant="detail">{ferry.directionTo(destination)}</AppText>}
        {!!range && <AppText variant="caption" tone="primary">{range}</AppText>}
      </View>
      <Icon name="chevron.right" size={13} />
    </Pressable>
  );
}

export function HkkfNearbyPierCard({ row, formatDistance, expanded, onToggle }: {
  row: FerryNearbyPierRow; formatDistance: (distance: number) => string; expanded: boolean; onToggle: () => void;
}) {
  const { copy: { ferry }, locale } = useLanguage();
  const { pier, distance } = row;
  const destinations = [...new Set(pier.sailings.map(({ direction }) => direction.destinationPierId))]
    .map((id) => hkkfPierDisplayName(id)?.[locale]).filter(Boolean).join(' · ');
  return (
    <View style={styles.card}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={onToggle}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <View style={styles.icon}><Icon name="mappin" size={19} /></View>
        <View style={styles.copy}>
          <AppText variant="homeCardTitle">{pier.name[locale]}</AppText>
          <AppText variant="detail" tone="muted">{pier.name[locale === 'en' ? 'zh-HK' : 'en']}</AppText>
          {!!destinations && <AppText variant="detail">{ferry.directionTo(destinations)}</AppText>}
          {distance !== undefined && <AppText variant="caption" tone="primary">{hkkfNearbyCopy[locale].pierDistance(formatDistance(distance))}</AppText>}
        </View>
        <Icon name={expanded ? 'chevron.up' : 'chevron.down'} size={13} />
      </Pressable>
      {expanded && pier.sailings.map((sailing) => <HkkfNearbyRouteCard key={sailing.id} insidePier
        row={{ kind: 'nearby-ferry-route', id: sailing.id, sailing }} formatDistance={formatDistance} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { minHeight: touchTarget, minWidth: touchTarget, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  icon: { height: touchTarget, width: touchTarget, backgroundColor: colors.tint, borderRadius: radius.control,
    justifyContent: 'center', alignItems: 'center' },
  copy: { flex: 1, minWidth: 0, gap: space.xs },
  departure: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  pressed: { backgroundColor: colors.pressed },
});
