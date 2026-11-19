import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { findBusRouteFamily } from '@/bus-data';
import { busStopEtaHref, describeBusVisit } from '@/bus-favorites';
import { buildBusMapStops, isBusMapCoordinate, readBusMapChoice, type BusMapVisit } from '@/bus-route-map';
import { routePlaceName } from '@/bus-routes';
import { useRouteSequences, useRouteStopNames } from '@/bus-stop-hooks';
import { routeStopKey, stopVisitKey, type RouteSequenceChoice, type RouteStop } from '@/bus-stops';
import { BusAction } from '@/components/bus-ui';
import { BusStopMap } from '@/components/bus-stop-map';
import { AppText, EmptyState, Icon, Screen } from '@/components/ui';
import { useLanguage } from '@/language';
import { readBusStopCoordinates } from '@/nearby-bus-data';
import { colors, radius, space, touchTarget } from '@/theme';

const noStops: readonly RouteStop[] = [];
type IndexedStops = Awaited<ReturnType<typeof readBusStopCoordinates>>;
const noIndexedStops: IndexedStops = new Map();

export default function BusRouteMapScreen() {
  const { routeId, direction, stopId, stopSeq } = useLocalSearchParams();
  return <RouteMapLoader key={JSON.stringify([routeId, direction, stopId, stopSeq])}
    routeId={routeId} direction={direction} stopId={stopId} stopSeq={stopSeq} />;
}

function RouteMapLoader({ routeId, direction, stopId, stopSeq }: {
  routeId: unknown;
  direction: unknown;
  stopId: unknown;
  stopSeq: unknown;
}) {
  const router = useRouter();
  const { copy } = useLanguage();
  const [choice, setChoice] = useState<RouteSequenceChoice | null>();

  useEffect(() => {
    if (typeof routeId !== 'string') {
      setChoice(null);
      return;
    }
    let active = true;
    void findBusRouteFamily(routeId, true).then(
      (family) => {
        if (active) setChoice(family ? readBusMapChoice(family.selected, direction) ?? null : null);
      },
      () => { if (active) setChoice(null); },
    );
    return () => { active = false; };
  }, [routeId, direction]);

  if (choice === undefined) {
    return <Screen hasHeader><Loading label={copy.busDetail.loadingSequence} /></Screen>;
  }
  if (!choice) {
    return (
      <Screen hasHeader>
        <EmptyState icon="bus" title={copy.busDetail.loadFailed} detail={copy.busDetail.routeChanged} />
        <BusAction label={copy.busDetail.backToSearch} onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/bus');
        }} />
      </Screen>
    );
  }
  return <RouteMap choice={choice} initialStopId={stopId} initialStopSeq={stopSeq} />;
}

function RouteMap({ choice, initialStopId, initialStopSeq }: {
  choice: RouteSequenceChoice;
  initialStopId: unknown;
  initialStopSeq: unknown;
}) {
  const router = useRouter();
  const { copy, locale } = useLanguage();
  const labels = copy.busMap;
  const detail = copy.busDetail;
  const { identity, catalogueRoute } = choice;
  const choices = useMemo(() => [choice], [choice]);
  const { sequences, retry } = useRouteSequences(choices);
  const sequence = sequences[routeStopKey(identity)];
  const stops = sequence?.snapshot?.stops ?? noStops;
  const stopIds = useMemo(() => [...new Set(stops.map(({ id }) => id))], [stops]);
  const [index, setIndex] = useState<{ ids: string[]; stops: IndexedStops; attempt: number }>();
  const [attempt, setAttempt] = useState(0);
  const [selection, setSelection] = useState<string>();

  useEffect(() => {
    if (!stopIds.length) return;
    let active = true;
    void readBusStopCoordinates(identity.source, stopIds).then(
      (stops) => { if (active) setIndex({ ids: stopIds, stops, attempt }); },
      () => {
        if (active) setIndex((previous) => ({ ids: stopIds, stops: previous?.stops ?? noIndexedStops, attempt }));
      },
    );
    return () => { active = false; };
  }, [identity.source, stopIds, attempt]);

  const indexReady = index?.ids === stopIds && index.attempt === attempt;
  const indexed = index?.stops ?? noIndexedStops;
  const lookupIds = useMemo(() => indexReady
    ? stopIds.filter((id) => {
      const row = indexed.get(id);
      return !isBusMapCoordinate(row) || !(row.name.zh || row.name.en);
    }) : [], [indexed, indexReady, stopIds]);
  const { names } = useRouteStopNames(identity.source === 'nlb' ? undefined : identity.source, lookupIds);
  const map = useMemo(() => buildBusMapStops(identity, stops, indexed,
    (id) => names[id]?.snapshot?.stop.coordinate), [identity, stops, indexed, names]);
  const selected = selection === undefined
    ? map.visits.find(({ stop }) => stop.id === initialStopId && String(stop.seq) === initialStopSeq)
    : map.visits.find(({ key }) => key === selection);

  function station(stop: RouteStop) {
    return stop.name ?? names[stop.id]?.snapshot?.stop.name ?? indexed.get(stop.id)?.name;
  }

  function stopLabel(stop: RouteStop) {
    const name = station(stop);
    return [detail.stopOrder(stop.seq), name && routePlaceName(name, locale)].filter(Boolean).join(' · ');
  }

  const terminal = stops.at(-1);
  const routeName = catalogueRoute?.source === 'nlb' ? catalogueRoute.routeName : undefined;
  const lastStation = terminal && station(terminal);
  const endpoint = catalogueRoute?.destination ?? lastStation;
  const destination = { zh: endpoint?.zh || routeName?.zh || '', en: endpoint?.en || routeName?.en || '' };
  const destinationLabel = endpoint && routePlaceName(endpoint, locale);
  const directionLabel = destinationLabel ? detail.towards(destinationLabel)
    : routeName ? routePlaceName(routeName, locale)
      : identity.source !== 'nlb' ? copy.bus.directions[identity.direction] : '';

  const cached = sequence?.snapshot && (sequence.fromCache || sequence.error)
    ? detail.cached(new Date(sequence.snapshot.fetchedAt).toLocaleString(locale, {
      dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Hong_Kong',
    })) : undefined;
  const detailsPending = identity.source !== 'nlb' && lookupIds.some((id) => !names[id]?.snapshot && !names[id]?.error);

  function renderStop({ item }: { item: BusMapVisit }) {
    const active = selected?.key === item.key;
    const missingPoint = !item.coordinate && indexReady && !detailsPending;
    return (
      <Pressable accessibilityRole="button" accessibilityState={{ selected: active }}
        accessibilityLabel={missingPoint ? `${stopLabel(item.stop)} · ${labels.coordinateMissing}` : stopLabel(item.stop)}
        onPress={() => setSelection(item.key)}
        style={({ pressed }) => [styles.stop, active && styles.selected, pressed && styles.pressed]}>
        <AppText variant="detail" tone="primary">{item.stop.seq}</AppText>
        <View style={styles.grow}>
          <AppText variant="homeCardTitle">{routePlaceName(station(item.stop) ?? { zh: '', en: '' }, locale) || detail.unavailableName}</AppText>
          {missingPoint && <AppText variant="caption" tone="muted">{labels.coordinateMissing}</AppText>}
        </View>
        {active && <Icon name="checkmark.circle.fill" size={18} />}
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <FlatList style={styles.grow} data={map.visits} keyExtractor={({ key }) => key} renderItem={renderStop}
        contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="never"
        ListHeaderComponent={(
          <View style={styles.heading}>
            <View style={styles.card}>
              <View style={styles.routeHeader}>
                <AppText variant="moduleTitle" accessibilityRole="header">{identity.number}</AppText>
                <AppText variant="detail" tone="muted" style={styles.grow}>{copy.bus.sources[identity.source]}</AppText>
              </View>
              <AppText variant="homeCardTitle">{directionLabel}</AppText>
              {identity.source === 'kmbLwb' && <AppText variant="caption" tone="muted">{copy.bus.service(identity.serviceType)}</AppText>}
              {identity.source === 'nlb' && catalogueRoute?.source === 'nlb' && catalogueRoute.special
                && <AppText variant="caption" tone="muted">{copy.bus.specialRoute}</AppText>}
              {cached && <AppText variant="caption" tone="muted">{cached}</AppText>}
            </View>
            {!stops.length ? (
              !sequence || sequence.loading ? <Loading label={detail.loadingSequence} /> : (
                <View style={styles.heading}>
                  <EmptyState icon="bus" title={sequence.error ? detail.loadFailed : detail.noStops} detail={detail.routeChanged} />
                  <BusAction label={copy.bus.retry} onPress={retry} />
                  {router.canGoBack() && <BusAction label={labels.returnToRoute} onPress={() => router.back()} />}
                </View>
              )
            ) : (
              <>
                {map.status === 'stops_only' && (
                  <BusStopMap key={map.routeKey} markers={map.markers} selected={selected?.key}
                    stopLabel={stopLabel} onSelect={setSelection} />
                )}
                {(!indexReady || detailsPending) ? <Loading label={labels.loading} /> : (
                  <>
                    <AppText variant="detail" tone="muted">
                      {map.status === 'stops_only' ? labels.coverage(map.markers.length, stops.length) : labels.noCoordinates}
                    </AppText>
                    {map.markers.length < stops.length && (
                      <BusAction label={labels.retryCoordinates} onPress={() => setAttempt((value) => value + 1)} />
                    )}
                  </>
                )}
                {map.status === 'stops_only' && <AppText variant="caption" tone="muted">{labels.tilesNote}</AppText>}
                <AppText variant="homeHeading" accessibilityRole="header">{labels.stationOrder}</AppText>
              </>
            )}
          </View>
        )}
      />
      {selected && (
        <View style={styles.footer}>
          <AppText variant="homeCardTitle" accessibilityLiveRegion="polite">{stopLabel(selected.stop)}</AppText>
          <BusAction label={labels.viewStop}
            onPress={() => router.push(busStopEtaHref(describeBusVisit(identity, selected.stop, stops,
              station(selected.stop), destination)))} />
        </View>
      )}
    </SafeAreaView>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={colors.primary} />
      <AppText variant="detail" tone="muted" style={styles.grow}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: space.xl, gap: space.xs },
  heading: { gap: space.md, paddingBottom: space.sm },
  routeHeader: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.md },
  grow: { flex: 1 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  card: {
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
    borderRadius: radius.card, padding: space.lg, gap: space.xs,
  },
  stop: {
    minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
    borderRadius: radius.control, paddingHorizontal: space.md, paddingVertical: space.sm,
  },
  selected: { backgroundColor: colors.tint, borderColor: colors.primary },
  pressed: { opacity: 0.72 },
  footer: {
    marginHorizontal: space.xl, marginVertical: space.sm, padding: space.md, gap: space.xs,
    backgroundColor: colors.tint, borderRadius: radius.card,
  },
});
