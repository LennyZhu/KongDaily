import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View, type FlatListProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { BusFeedError } from '@/bus-data';
import { describeEta, etaEntryNotes, etaIsStale } from '@/bus-eta';
import { busStopEtaHref } from '@/bus-favorites';
import { busSources, routePlaceName, type BusSource, type RouteName } from '@/bus-routes';
import { BusAction } from '@/components/bus-ui';
import { AppText, EmptyState, Icon, Screen } from '@/components/ui';
import { useLanguage } from '@/language';
import { readNearbyBusStop, type StopRow } from '@/nearby-bus-data';
import { useStationEta } from '@/nearby-stop-eta-hooks';
import { readStationRoutes, type StationEtaRecord, type StationRoute } from '@/nearby-stop-routes';
import { colors, homeLayout, radius, space, touchTarget } from '@/theme';

type StationData = { stop: StopRow; routes: StationRoute[]; capturedAt: number };
const viewabilityConfig = { viewAreaCoveragePercentThreshold: 10 };

export default function NearbyStopScreen() {
  const params = useLocalSearchParams();
  const { copy } = useLanguage();
  const source = busSources.find((item) => item === params.source);
  const stopId = typeof params.stopId === 'string' ? params.stopId : '';
  const metres = typeof params.distance === 'string' && params.distance.trim() ? Number(params.distance) : NaN;
  const distance = Number.isFinite(metres) && metres >= 0 && metres <= 2000 ? metres : undefined;

  if (!source || !stopId) {
    return <Screen hasHeader><EmptyState icon="mappin" title={copy.busStation.invalid} /></Screen>;
  }
  return <StationLoader key={`${source}:${stopId}`} source={source} stopId={stopId} distance={distance} />;
}

function StationLoader({ source, stopId, distance }: { source: BusSource; stopId: string; distance?: number }) {
  const { copy } = useLanguage();
  const [result, setResult] = useState<StationData | 'missing' | 'error'>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.all([readNearbyBusStop(source, stopId), readStationRoutes(source, stopId)]).then(
      ([stop, index]) => { if (active) setResult(stop ? { stop, ...index } : 'missing'); },
      () => { if (active) setResult('error'); },
    );
    return () => { active = false; };
  }, [source, stopId, attempt]);

  if (!result) {
    return (
      <Screen hasHeader>
        <View style={styles.inline} accessibilityRole="progressbar">
          <ActivityIndicator color={colors.primary} />
          <AppText variant="detail" tone="muted" style={styles.copy}>{copy.busStation.loading}</AppText>
        </View>
      </Screen>
    );
  }
  if (result === 'missing' || result === 'error') {
    return (
      <Screen hasHeader>
        <EmptyState icon="mappin" title={result === 'missing' ? copy.busStation.invalid : copy.busStation.loadFailed} />
        {result === 'error' && <BusAction label={copy.bus.retry} onPress={() => {
          setResult(undefined);
          setAttempt((value) => value + 1);
        }} />}
      </Screen>
    );
  }
  return <StationRouteList station={result} distance={distance} />;
}

function StationRouteList({ station, distance }: { station: StationData; distance?: number }) {
  const { copy, locale } = useLanguage();
  const { bottom } = useSafeAreaInsets();
  const { routes, stop, capturedAt } = station;
  const stationName = { zh: stop.name_zh, en: stop.name_en };
  const street = routePlaceName({ zh: stop.street_zh, en: stop.street_en }, locale);
  const labels = copy.busStation;
  const operator = copy.bus.sources[stop.source];
  const { records, now, busy, rateLimit, canRefresh, refresh, setVisible } = useStationEta(routes, locale);

  const onViewableItemsChanged: NonNullable<FlatListProps<StationRoute>['onViewableItemsChanged']> = useCallback(
    ({ viewableItems }) => setVisible(viewableItems.filter((token) => token.isViewable).map((token) => token.item.id)),
    [setVisible],
  );
  const distanceText = distance === undefined ? undefined : labels.directDistance(
    distance < 1000 ? copy.nearbyBus.metres(Math.round(distance)) : copy.nearbyBus.kilometres(Math.round(distance / 100) / 10),
  );

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: bottom + space.section }]}
      contentInsetAdjustmentBehavior="never"
      data={routes}
      keyExtractor={({ id }) => id}
      viewabilityConfig={viewabilityConfig}
      onViewableItemsChanged={onViewableItemsChanged}
      renderItem={({ item }) => <RouteArrivals route={item} stationName={stationName}
        record={records[item.id]} fallbackError={rateLimit} now={now} />}
      ListHeaderComponent={(
        <View style={styles.section}>
          <View style={[styles.card, styles.inline]}>
            <View style={styles.badge}><Icon name="mappin" color={colors.onPrimary} size={19} /></View>
            <View style={styles.copy}>
              <AppText variant="section" accessibilityRole="header">{routePlaceName(stationName, locale)}</AppText>
              <AppText variant="detail" tone="muted">{operator}</AppText>
              {!!street && <AppText variant="brandSubtitle" tone="muted">{street}</AppText>}
              {!!distanceText && <AppText variant="brandSubtitle" tone="muted">{distanceText}</AppText>}
            </View>
          </View>
          <View style={styles.inline}>
            <AppText variant="homeHeading" accessibilityRole="header" style={styles.copy}>{labels.routes}</AppText>
            {routes.length > 0 && (
              <Pressable accessibilityRole="button" accessibilityLabel={copy.busEta.refresh}
                accessibilityState={{ disabled: !canRefresh, busy }} disabled={!canRefresh} onPress={refresh}
                style={({ pressed }) => [styles.refresh, !canRefresh && styles.disabled, pressed && styles.pressed]}>
                {busy ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon name="arrow.clockwise" size={13} />}
                <AppText variant="caption" tone="primary" style={styles.shrink}>{copy.busEta.refresh}</AppText>
              </Pressable>
            )}
          </View>
          {stop.source === 'citybus' && <AppText variant="detail" tone="muted">{labels.citybusCoverage}</AppText>}
        </View>
      )}
      ListEmptyComponent={<EmptyState icon="bus" title={labels.notIndexed} />}
      ListFooterComponent={(
        <View style={styles.section}>
          {routes.length > 0 && (
            <View style={styles.note}>
              <Icon name="info.circle" size={16} />
              <AppText variant="detail" tone="muted" style={styles.copy}>{labels.visibleRefresh}</AppText>
            </View>
          )}
          <AppText variant="brandSubtitle" tone="muted">{copy.nearbyBus.officialStopId(stop.stop_id)}</AppText>
          <AppText variant="brandSubtitle" tone="muted">
            {labels.captured(new Date(capturedAt).toLocaleDateString(locale, { timeZone: 'Asia/Hong_Kong', dateStyle: 'medium' }))}
          </AppText>
        </View>
      )}
    />
  );
}

function RouteArrivals({ route, stationName, record, fallbackError, now }: {
  route: StationRoute;
  stationName: RouteName;
  record: StationEtaRecord | undefined;
  fallbackError?: BusFeedError;
  now: number;
}) {
  const { copy, locale } = useLanguage();
  const router = useRouter();
  const { target, destination, destinationStopId } = route;
  const eta = copy.busEta;
  const snapshot = record?.snapshot;
  const error = record?.error ?? fallbackError;
  const view = describeEta(snapshot, error, now, !snapshot && !error, locale, eta);
  const [next, later] = view.upcoming;
  const publishedDestination = routePlaceName(next?.destination ?? destination, locale);
  const publishedOrigin = route.origin && routePlaceName(route.origin, locale);
  const direction = publishedDestination ? copy.busDetail.towards(publishedDestination) : target.source === 'nlb'
    ? copy.busDetail.routeOptions : copy.bus.directions[target.direction];
  const shared = snapshot && !etaIsStale(snapshot, now) && (record?.sharedThrough ?? 0) >= now;
  const status = shared ? copy.busStation.sharedForecast : view.status === eta.unmatched || view.status === eta.empty
    ? eta.previewEmpty : view.status;
  const countdown = (minutes: number) => minutes === 0 ? eta.due : `${eta.minutes.prefix}${minutes}${eta.minutes.suffix}`;
  const notes = [...new Set([next && etaEntryNotes(next, locale), ...view.notices].filter(Boolean))];

  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(busStopEtaHref({
      target, station: stationName, destination, destinationStopId,
    }))} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.inline}>
        <View style={styles.badge}><Icon name="bus" color={colors.onPrimary} size={18} /></View>
        <View style={styles.copy}>
          <AppText variant="section">{target.number}</AppText>
          <AppText variant="detail">{direction}</AppText>
          {!!publishedOrigin && <AppText variant="brandSubtitle" tone="muted">{copy.busStation.startsFrom(publishedOrigin)}</AppText>}
        </View>
        {next && (
          <View style={styles.arrivals}>
            <AppText variant="title" tone="primary" style={styles.countdown}>{countdown(next.minutes)}</AppText>
            {later && <AppText variant="brandSubtitle" tone="muted" style={styles.countdown}>{countdown(later.minutes)}</AppText>}
          </View>
        )}
      </View>
      {!next && <AppText variant="detail" tone="muted" accessibilityLiveRegion="polite">{status}</AppText>}
      {notes.map((note) => <AppText key={note} variant="brandSubtitle" tone="muted">{note}</AppText>)}
      {!!view.errorText && <AppText variant="brandSubtitle" tone="error">{view.errorText}</AppText>}
      {!!view.updateText && <AppText variant="brandSubtitle" tone="muted">{view.updateText}</AppText>}
      {target.repeatedStop && <AppText variant="brandSubtitle" tone="muted">{eta.repeatedStop}</AppText>}
      <View style={styles.cardFooter}>
        <AppText variant="caption" tone="muted" style={styles.copy}>
          {copy.bus.sources[target.source]} · {copy.busDetail.stopOrder(target.stopSeq)}
          {target.source === 'kmbLwb' && target.serviceType !== '1' ? ` · ${copy.bus.service(target.serviceType)}` : ''}
        </AppText>
        <View style={styles.detailsLink}>
          <AppText variant="caption" tone="primary" style={styles.shrink}>{copy.busStation.etaDetails}</AppText>
          <Icon name="chevron.right" size={12} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: homeLayout.gutter, paddingTop: space.lg, gap: space.md },
  section: { gap: space.md },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.media, borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border, padding: space.md, gap: space.sm,
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  copy: { flex: 1, minWidth: 0, gap: space.xs },
  shrink: { flexShrink: 1 },
  badge: {
    width: 36, height: 36, borderRadius: radius.control, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  arrivals: { maxWidth: '38%', alignItems: 'flex-end', gap: space.xs, flexShrink: 1 },
  countdown: { textAlign: 'right', fontVariant: ['tabular-nums'] },
  refresh: {
    minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: space.xs, maxWidth: '45%',
    paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.primarySoft, backgroundColor: colors.surface,
  },
  disabled: { opacity: 0.55 },
  cardFooter: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: space.sm,
  },
  detailsLink: {
    maxWidth: '48%', minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 1,
    paddingHorizontal: space.sm, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.primarySoft,
  },
  note: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    padding: space.md, borderRadius: radius.control, backgroundColor: colors.tint,
  },
  pressed: { opacity: 0.75 },
});
