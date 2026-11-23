import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { GmbForecastRows } from '@/components/gmb-status';
import { savedBusStyles } from '@/components/saved-bus-ui';
import { AppText, Icon } from '@/components/ui';
import { gmbEtaView } from '@/gmb-data';
import type { GmbFavorite } from '@/gmb-favorites';
import { gmbRouteHref } from '@/global-search-navigation';
import { readPinnedGmbEta } from '@/home-gmb-eta';
import { useLanguage } from '@/language';
import { useNextTrainReading } from '@/next-train-hooks';
import { colors, homeLayout, radius, space, touchTarget } from '@/theme';

export function HomeFavoriteGmb({ favorite }: { favorite: GmbFavorite }) {
  const { copy, locale } = useLanguage();
  const router = useRouter();
  const { width, fontScale } = useWindowDimensions();
  const stackEta = width - 2 * (homeLayout.gutter + space.md) < 280 * fontScale;
  const stop = copy.minibus.stopLabel(favorite.stopSeq, favorite.stopName[locale]);
  const direction = copy.gmbFavorites.towards(favorite.destination[locale]);
  const route = `${copy.saved.categories.minibus} · ${favorite.routeCode}`;
  const routeCaption = `${route} · ${copy.minibus.regions[favorite.region]}`;
  const { routeId, routeSeq, stopId, stopSeq } = favorite;
  const read = useCallback((signal: AbortSignal) => readPinnedGmbEta({ routeId, routeSeq, stopId, stopSeq }, signal),
    [routeId, routeSeq, stopId, stopSeq]);
  const { reading, now } = useNextTrainReading(favorite.id, read, undefined, true);
  const payload = reading?.payload;
  const view = reading && payload?.kind === 'eta' ? gmbEtaView({ ...reading, payload: payload.eta }, now) : undefined;

  const hasTime = view?.kind === 'forecast' && !!view.entries[0] && view.entries[0].kind !== 'notice';
  const forecast = payload?.kind === 'changed' || payload?.kind === 'ambiguous' ? (
    <AppText variant="detail" tone="muted" accessibilityLiveRegion="polite">
      {payload.kind === 'changed' ? copy.minibus.visitChanged : copy.minibus.etaAmbiguous}
    </AppText>
  ) : <GmbForecastRows view={view} first={payload?.kind === 'eta' && payload.first} compact />;

  return (
    <View style={[savedBusStyles.card, styles.cardContent]}>
      <View style={[styles.summary, stackEta && styles.stackedSummary]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${routeCaption} · ${stop} · ${direction}`}
          onPress={() => router.push(gmbRouteHref(routeId, routeSeq, favorite))}
          style={({ pressed }) => [styles.destination, stackEta && styles.stackedDestination, pressed && styles.pressed]}>
          <View style={styles.badge}><Icon name="bus.fill" size={17} /></View>
          <View style={styles.copy}>
            <AppText variant="caption" tone="muted">{routeCaption}</AppText>
            <AppText variant="homeCardTitle">{stop}</AppText>
            <AppText variant="detail">{direction}</AppText>
          </View>
        </Pressable>
        {hasTime && (
          <View style={[styles.etaColumn, stackEta && styles.stackedEta]}>
            {forecast}
          </View>
        )}
      </View>
      {!hasTime && <View style={styles.status}>{forecast}</View>}
    </View>
  );
}

const badgeSize = 32;

const styles = StyleSheet.create({
  cardContent: { padding: space.md, gap: space.sm },
  badge: { width: badgeSize, height: badgeSize, borderRadius: radius.control, backgroundColor: colors.tint,
    alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  stackedSummary: { flexDirection: 'column', alignItems: 'stretch' },
  destination: { flex: 1, minWidth: 0, minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stackedDestination: { flex: 0 },
  copy: { flex: 1, minWidth: 0, gap: space.xs },
  etaColumn: { maxWidth: '38%', alignItems: 'flex-end' },
  stackedEta: { maxWidth: '100%', alignSelf: 'flex-end' },
  status: { paddingTop: space.xs, paddingStart: badgeSize + space.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  pressed: { backgroundColor: colors.pressed },
});
