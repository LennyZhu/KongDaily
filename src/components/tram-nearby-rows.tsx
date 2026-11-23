import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { tramRouteHref } from '@/global-search-navigation';
import { useLanguage } from '@/language';
import type { TramNearbyRouteRow, TramNearbyStopRow } from '@/nearby-tram';
import { colors, radius, space, touchTarget } from '@/theme';
import { tramDirectionLabel } from '@/tram-direction';

export function TramNearbyRouteCard({ choice, station, formatDistance, insideStop = false }: {
  choice: TramNearbyRouteRow['choice']; station: TramNearbyRouteRow['station'];
  formatDistance: (distance: number) => string; insideStop?: boolean;
}) {
  const router = useRouter();
  const { copy: { tram }, locale } = useLanguage();
  const { direction, visit, affectedTerminus, service } = choice;
  const title = service.localizedRouteNames[locale];
  const bound = tramDirectionLabel(direction, tram, locale);
  const terminal = direction.visits[direction.visits.length - 1].stop.localizedStopNames[locale];
  const towards = tram.towards(terminal);
  const directionText = bound === towards ? bound : `${bound} · ${towards}`;
  const status = tram.status[station.serviceStatus.serviceStatus];
  const boarding = insideStop ? tram.pickDrop[visit.pickDrop] : tram.boardingAt(visit.stop.localizedStopNames[locale]);
  const distance = tram.straightLineDistance(formatDistance(station.distance));
  return (
    <Pressable accessibilityRole="button"
      accessibilityLabel={[title, directionText, boarding, status, distance,
        affectedTerminus && tram.affectedTerminus].filter(Boolean).join(' · ')}
      style={({ pressed }) => [styles.row, insideStop ? styles.divider : styles.card, pressed && styles.pressed]}
      onPress={() => router.push(tramRouteHref(direction.routeId, visit))}>
      {!insideStop && <View style={styles.icon}><Icon name="tram" size={19} /></View>}
      <View style={styles.copy}>
        <AppText variant="homeCardTitle">{title}</AppText>
        <AppText variant="detail">{directionText}</AppText>
        <AppText variant="caption" tone="muted">{boarding}</AppText>
        {!insideStop && <>
          <AppText variant="caption" tone="muted">{status}</AppText>
          <AppText variant="caption" tone="primary">{distance}</AppText>
        </>}
        {affectedTerminus && <AppText variant="caption" tone="error">{tram.affectedTerminus}</AppText>}
      </View>
      <Icon name="chevron.right" color={colors.muted} size={13} />
    </Pressable>
  );
}

export function TramNearbyStopCard({ row, formatDistance, expanded, onToggle }: {
  row: TramNearbyStopRow; formatDistance: (distance: number) => string; expanded: boolean; onToggle: () => void;
}) {
  const { copy: { tram }, locale } = useLanguage();
  const { station, choices } = row;
  const name = station.stop.localizedStopNames[locale];
  const bounds = [...new Set(choices.map(({ direction }) => tramDirectionLabel(direction, tram, locale)))].join(' · ');
  const routeCount = tram.routeCount(new Set(choices.map(({ service }) => service.routeId)).size);
  const status = tram.status[station.serviceStatus.serviceStatus];
  const distance = tram.straightLineDistance(formatDistance(station.distance));
  return (
    <View style={styles.card}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded }}
        accessibilityLabel={[name, tram.stopId(station.stop.stopId), bounds, routeCount, status, distance].filter(Boolean).join(' · ')}
        onPress={onToggle} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <View style={styles.icon}><Icon name="mappin" size={19} /></View>
        <View style={styles.copy}>
          <AppText variant="homeCardTitle">{name}</AppText>
          <AppText variant="detail" tone="muted">{station.stop.localizedStopNames[locale === 'en' ? 'zh-HK' : 'en']}</AppText>
          <AppText variant="detail">{[bounds, routeCount].filter(Boolean).join(' · ')}</AppText>
          <AppText variant="caption" tone="muted">{tram.stopId(station.stop.stopId)} · {status}</AppText>
          <AppText variant="caption" tone="primary">{distance}</AppText>
        </View>
        <Icon name={expanded ? 'chevron.up' : 'chevron.down'} size={13} />
      </Pressable>
      {expanded && choices.map((choice) => <TramNearbyRouteCard key={choice.visit.key} choice={choice}
        station={station} formatDistance={formatDistance} insideStop />)}
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
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  pressed: { backgroundColor: colors.pressed },
});
