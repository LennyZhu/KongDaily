import { useHomeTransitRouter } from '@/home-transit-intent';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { findBusRouteFamily } from '@/bus-data';
import { useBusEta } from '@/bus-eta-hooks';
import { describeEta, readEtaTarget, type EtaTarget } from '@/bus-eta';
import { busStopEtaHref, describeBusVisit } from '@/bus-favorites';
import { readBusRouteGeometry } from '@/bus-route-geometry';
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
const etaPreviewDelay = 350;

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
  const router = useHomeTransitRouter();
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
  const router = useHomeTransitRouter();
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
  const [selection, setSelection] = useState<{ key: string; focusMap?: true }>();
  const [etaCooldowns] = useState(() => new Map<string, number>());

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
  const lines = useMemo(() => indexReady ? readBusRouteGeometry(map) : undefined, [indexReady, map]);
  const selected = selection === undefined
    ? map.visits.find(({ stop }) => stop.id === initialStopId && String(stop.seq) === initialStopSeq)
    : map.visits.find(({ key }) => key === selection.key);

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
  const selectedStation = selected && station(selected.stop);
  const etaHref = selected && busStopEtaHref(describeBusVisit(identity, selected.stop, stops, selectedStation, destination));
  const target = etaHref && readEtaTarget(etaHref.params);

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
        onPress={() => setSelection({ key: item.key, focusMap: true })}
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
                  <BusStopMap key={map.routeKey} markers={map.markers} lines={lines} selected={selected?.key}
                    focusRequest={selection?.focusMap ? selection : undefined}
                    stopLabel={stopLabel} onSelect={(key) => setSelection({ key })} />
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
                {lines && <AppText variant="caption" tone="muted">{labels.geometrySource}</AppText>}
                {map.status === 'stops_only' && <AppText variant="caption" tone="muted">{labels.tilesNote}</AppText>}
                <AppText variant="homeHeading" accessibilityRole="header">{labels.stationOrder}</AppText>
              </>
            )}
          </View>
        )}
      />
      {selected && (
        <ScrollView style={styles.footer} contentContainerStyle={styles.footerContent}>
          <AppText variant="caption" tone="primary">{detail.stopOrder(selected.stop.seq)} · {identity.number}</AppText>
          <AppText variant="homeCardTitle" accessibilityRole="header">
            {selectedStation && routePlaceName(selectedStation, locale) || detail.unavailableName}
          </AppText>
          {target && etaHref ? (
            <MapStopArrival key={JSON.stringify(target)} initialTarget={target} cooldowns={etaCooldowns}
              onOpen={() => router.push(etaHref)} />
          ) : <AppText variant="detail" tone="muted">{labels.etaUnavailable}</AppText>}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function MapStopArrival({ initialTarget, cooldowns, onOpen }: {
  initialTarget: EtaTarget;
  cooldowns: Map<string, number>;
  onOpen: () => void;
}) {
  // The complete target key remounts the preview on a different stop visit, including repeat visits.
  const [target] = useState(initialTarget);
  const [ready, setReady] = useState(false);
  const { copy, locale } = useLanguage();
  const eta = copy.busEta;
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), etaPreviewDelay);
    return () => clearTimeout(timer);
  }, []);

  const { snapshot, error, now, loading, canRefresh, refresh } = useBusEta(target, locale, ready, cooldowns);
  const view = describeEta(snapshot, error, now, loading, locale, eta);
  const [next] = view.upcoming;
  const unavailable = error?.status === 404 || error?.status === 501;
  const value = unavailable ? copy.busMap.etaUnavailable : next
    ? next.minutes === 0 ? eta.due : `${eta.minutes.prefix}${next.minutes}${eta.minutes.suffix}`
    : view.status;
  const retryEnabled = canRefresh && now >= (cooldowns.get(target.source) ?? 0);

  return (
    <>
      <View style={styles.arrivalRow}>
        <View style={styles.arrival} accessible accessibilityLiveRegion="polite">
          <AppText variant="caption" tone="muted">{eta.nextArrival}</AppText>
          <AppText variant={next && !unavailable ? 'title' : 'detail'} tone={next && !unavailable ? 'primary' : 'muted'}>
            {value}
          </AppText>
        </View>
        <Pressable accessibilityRole="button" onPress={onOpen}
          style={({ pressed }) => [styles.arrivalAction, pressed && styles.pressed]}>
          <AppText variant="detail" tone="primary" style={styles.actionLabel}>{eta.openAll}</AppText>
          <Icon name="chevron.right" size={13} />
        </Pressable>
      </View>
      {error && (
        <View style={styles.arrivalRow}>
          <AppText variant="caption" tone="error" style={styles.arrival}>
            {view.errorText ?? eta.failed}
          </AppText>
          <Pressable accessibilityRole="button" disabled={!retryEnabled} onPress={refresh}
            accessibilityState={{ disabled: !retryEnabled, busy: loading }}
            style={({ pressed }) => [styles.arrivalAction, !retryEnabled && styles.disabled, pressed && styles.pressed]}>
            <AppText variant="detail" tone="primary" style={styles.actionLabel}>{copy.bus.retry}</AppText>
          </Pressable>
        </View>
      )}
      {view.updateText && <AppText variant="caption" tone="muted">{view.updateText}</AppText>}
      {target.repeatedStop && <AppText variant="caption" tone="muted">{eta.repeatedStop}</AppText>}
    </>
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
  disabled: { opacity: 0.6 },
  footer: {
    maxHeight: '50%', flexGrow: 0, marginHorizontal: space.xl, marginVertical: space.sm,
    backgroundColor: colors.tint, borderRadius: radius.card,
  },
  footerContent: { padding: space.md, gap: space.xs },
  arrivalRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
  arrival: { flexBasis: 115, flexGrow: 1, minWidth: 0 },
  arrivalAction: {
    flexBasis: 145, flexGrow: 1, minWidth: 0, minHeight: touchTarget, paddingVertical: space.xs,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: space.xs,
  },
  actionLabel: { flexShrink: 1, textAlign: 'right' },
});
