import { useRouter } from 'expo-router';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { gmbRouteHref } from '@/global-search-navigation';
import { gmbText, gmbVisitKey } from '@/gmb-search';
import { useLanguage } from '@/language';
import type { GmbNearbyRouteRow, GmbNearbyStopRow, GmbNearbyVisit } from '@/nearby-gmb';
import { colors, radius, space, touchTarget } from '@/theme';

function description(visit: GmbNearbyVisit, locale: 'zh-HK' | 'en') {
  const { origin, destination } = visit.direction;
  return [gmbText(origin, locale), gmbText(destination, locale)].filter(Boolean).join(' → ');
}

export function GmbNearbyRouteCard({ row, distance }: { row: GmbNearbyRouteRow; distance: string }) {
  const { copy, locale } = useLanguage();
  const router = useRouter();
  const { visit } = row;
  const { region, routeCode, hasVariants } = visit.direction;
  const title = copy.minibus.routeTitle(routeCode);
  const subtitle = [copy.minibus.regions[region], hasVariants && copy.minibus.serviceId(visit.routeId)].filter(Boolean).join(' · ');
  const boarding = copy.transport.boardingAt(gmbText(visit.name, locale));
  const direction = description(visit, locale);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={[title, subtitle, direction, boarding, distance].join(' · ')}
      onPress={() => router.push(gmbRouteHref(visit.routeId, visit.routeSeq))}
      style={({ pressed }) => [styles.card, styles.row, pressed && styles.pressed]}>
      <View style={styles.icon}><Icon name="bus.fill" size={19} /></View>
      <View style={styles.copy}>
        <AppText variant="homeCardTitle">{title}</AppText>
        <AppText variant="caption" tone="muted">{subtitle}</AppText>
        <AppText variant="detail">{direction}</AppText>
        <AppText variant="caption" tone="muted">{boarding}</AppText>
        <AppText variant="caption" tone="primary">{distance}</AppText>
      </View>
      <Icon name="chevron.right" size={13} />
    </Pressable>
  );
}

export function GmbNearbyStopCard({ row, distance, expanded, onToggle }: {
  row: GmbNearbyStopRow; distance?: string; expanded: boolean; onToggle: () => void;
}) {
  const { copy, locale } = useLanguage();
  const router = useRouter();
  const routes = [...new Set(row.stop.visits.filter(({ boarding }) => boarding).map(({ direction }) => direction.routeCode))];
  const name = gmbText(row.stop.name, locale);
  const routeList = routes.join(' · ');
  return (
    <View style={styles.card}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded }}
        accessibilityLabel={[name, distance, routeList].filter(Boolean).join(' · ')} onPress={onToggle}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <View style={styles.icon}><Icon name="mappin" size={19} /></View>
        <View style={styles.copy}>
          <AppText variant="homeCardTitle">{name}</AppText>
          <AppText variant="detail" tone="muted">{routeList}</AppText>
          {!!distance && <AppText variant="caption" tone="primary">{distance}</AppText>}
        </View>
        <Icon name={expanded ? 'chevron.up' : 'chevron.down'} size={13} />
      </Pressable>
      {expanded && row.stop.visits.map((visit) => {
        const { region, routeCode, hasVariants } = visit.direction;
        const title = [copy.minibus.routeTitle(routeCode), copy.minibus.regions[region],
          hasVariants && copy.minibus.serviceId(visit.routeId)].filter(Boolean).join(' · ');
        const via = copy.minibus.stopLabel(visit.stopSeq, gmbText(visit.name, locale));
        const direction = description(visit, locale);
        return (
          <Pressable key={gmbVisitKey(visit)} accessibilityRole="button"
            accessibilityLabel={[title, direction, via, !visit.boarding && copy.minibus.dropOff].filter(Boolean).join(' · ')}
            accessibilityState={{ disabled: !visit.boarding }} disabled={!visit.boarding}
            onPress={() => {
              Keyboard.dismiss();
              router.push(gmbRouteHref(visit.routeId, visit.routeSeq, visit));
            }}
            style={({ pressed }) => [styles.visit, pressed && styles.pressed]}>
            <View style={styles.copy}>
              <AppText variant="detail" tone="primary">{title}</AppText>
              <AppText variant="detail">{direction}</AppText>
              <AppText variant="caption" tone="muted">{via}{!visit.boarding && (' · ' + copy.minibus.dropOff)}</AppText>
            </View>
            {visit.boarding && <Icon name="chevron.right" size={13} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  icon: { height: touchTarget, width: touchTarget, backgroundColor: colors.tint, borderRadius: radius.control,
    justifyContent: 'center', alignItems: 'center' },
  copy: { flex: 1, minWidth: 0, gap: space.xs },
  visit: { minHeight: touchTarget, padding: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  pressed: { backgroundColor: colors.pressed },
});
