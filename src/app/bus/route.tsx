import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type Ref, type RefObject } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { findBusRouteFamily } from '@/bus-data';
import { useBusEta } from '@/bus-eta-hooks';
import { describeEta, etaIsStale, readEtaTarget, type EtaTarget } from '@/bus-eta';
import { routePlaceName } from '@/bus-routes';
import { useRouteSequences, useRouteStopNames, type SequenceState } from '@/bus-stop-hooks';
import {
  routeOptionKey, routeSequenceChoices, routeStopKey, stopVisitKey,
  type RouteSequenceChoice, type RouteStop, type TravelDirection,
} from '@/bus-stops';
import { BusAction } from '@/components/bus-ui';
import { AppText, EmptyState, Icon, Screen } from '@/components/ui';
import { useLanguage } from '@/language';
import { useRouteStopRecommendation } from '@/route-stop-recommendation';
import { colors, homeLayout, radius, space, touchTarget } from '@/theme';

type RouteFamily = NonNullable<Awaited<ReturnType<typeof findBusRouteFamily>>>;
type SequenceEntry = RouteSequenceChoice & { key: string; state?: SequenceState };
type RouteSelection = { variant?: string; direction?: TravelDirection; stop?: { routeKey: string; visit?: string } };
type BoardingParams = { stopId?: string; stopSeq?: string; direction?: string };
const etaPreviewDelay = 350;

// Settings lives outside the bus stack. Remember the last route during a language change.
let lastRouteSelection: { id: string; locale: string; value: RouteSelection } | undefined;

export default function RouteDetailsScreen() {
  const { routeId, stopId, stopSeq, direction } = useLocalSearchParams<BoardingParams & { routeId?: string }>();
  const id = typeof routeId === 'string' ? routeId : '';
  const key = JSON.stringify([id, stopId, stopSeq, direction]);
  return <RouteLoader key={key} id={id} boarding={{ stopId, stopSeq, direction }} />;
}

function RouteLoader({ id, boarding }: { id: string; boarding: BoardingParams }) {
  const { copy } = useLanguage();
  const router = useRouter();
  const [family, setFamily] = useState<RouteFamily | null>();
  const fromNearby = typeof boarding.stopId === 'string' && typeof boarding.stopSeq === 'string';

  useEffect(() => {
    let active = true;
    void findBusRouteFamily(id, fromNearby).then(
      (result) => { if (active) setFamily(result ?? null); },
      () => { if (active) setFamily(null); },
    );
    return () => { active = false; };
  }, [id, fromNearby]);

  if (family === undefined) {
    return <Screen hasHeader><RouteLoading label={copy.busDetail.loadingSequence} /></Screen>;
  }
  if (family === null) {
    return (
      <Screen hasHeader>
        <EmptyState icon="exclamationmark.circle" title={copy.busDetail.loadFailed} detail={copy.busDetail.routeChanged} />
        <BusAction label={copy.busDetail.backToSearch} onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/bus');
        }} />
      </Screen>
    );
  }
  return <RouteDetails family={family} boarding={boarding} />;
}

function RouteDetails({ family, boarding }: { family: RouteFamily; boarding: BoardingParams }) {
  const { copy, locale } = useLanguage();
  const router = useRouter();
  const detail = copy.busDetail;
  const bus = copy.bus;
  const base = family.selected;
  const hasBoardingParams = boarding.stopId !== undefined || boarding.stopSeq !== undefined;
  const scroll = useRef<ScrollView>(null);
  const scrollContent = useRef<View>(null);
  const recommendedRow = useRef<View>(null);
  const [etaCooldowns] = useState(() => new Map<string, number>());
  const [selection, setSelection] = useState<RouteSelection>(() => {
    const target = readEtaTarget({
      ...boarding, source: base.source, number: base.number,
      direction: base.source === 'kmbLwb' ? base.direction : boarding.direction,
      serviceType: base.serviceType, nlbRouteId: base.source === 'nlb' ? base.routeId : undefined,
    });
    if (target) {
      return {
        variant: routeOptionKey(base),
        direction: target.source === 'nlb' ? undefined : target.direction,
        stop: { routeKey: routeStopKey(target), visit: stopVisitKey(target, { id: target.stopId, seq: target.stopSeq }) },
      };
    }
    const remembered = lastRouteSelection;
    if (remembered?.id === base.id && remembered.locale !== locale
      && family.routes.some((route) => routeOptionKey(route) === remembered.value.variant)) {
      return remembered.value;
    }
    return {
      variant: routeOptionKey(base),
      direction: base.source === 'nlb' ? undefined : base.direction === 'inbound' ? 'inbound' : 'outbound',
    };
  });
  const { variant, direction, stop: explicitStop } = selection;

  useEffect(() => {
    lastRouteSelection = { id: base.id, locale, value: selection };
  }, [base.id, locale, selection]);

  const optionHeading = base.source === 'nlb' ? detail.routeOptions : detail.variants;
  const options = useMemo(() => {
    const labels = new Map<string, string>();
    for (const route of family.routes) {
      const key = routeOptionKey(route);
      if (!key) continue;
      labels.set(key, route.source === 'nlb' ? routePlaceName(route.routeName, locale) : bus.service(key));
    }
    return [...labels].sort(([a], [b]) => Number(a) - Number(b));
  }, [bus, family.routes, locale]);
  const choices = useMemo(() => routeSequenceChoices(family.routes, variant), [family.routes, variant]);
  const { sequences, retry: retrySequence } = useRouteSequences(choices);
  const entries = choices.map((choice): SequenceEntry => {
    const key = routeStopKey(choice.identity);
    return { ...choice, key, state: sequences[key] };
  });
  const available = entries.filter(({ state }) => (state?.snapshot?.stops.length ?? 0) > 0);
  const preferred = entries.find(({ identity }) => identity.source === 'nlb' || identity.direction === direction);
  const pending = ({ state }: SequenceEntry) => !state || state.loading;
  const explicitPreferred = explicitStop?.visit && explicitStop.routeKey === preferred?.key;
  const current = preferred && (explicitPreferred || pending(preferred) || available.includes(preferred))
    ? preferred
    : available[0] ?? entries.find(pending) ?? preferred ?? entries[0];
  const sequence = current?.state?.snapshot;
  const explicitForCurrent = explicitStop?.routeKey === current?.key ? explicitStop : undefined;
  const recommendationIdentity = current?.identity;
  const recommendationStops = sequence?.stops;
  const canRecommend = !hasBoardingParams && !explicitForCurrent && current?.state?.loading === false;
  const recommendationTarget = useMemo(() => {
    if (canRecommend && recommendationIdentity && recommendationStops && recommendationStops.length > 1) {
      return { identity: recommendationIdentity, stops: recommendationStops };
    }
  }, [canRecommend, recommendationIdentity, recommendationStops]);
  const { recommendation, requestLocation } = useRouteStopRecommendation(recommendationTarget);
  const automatic = recommendation?.kind === 'found' ? recommendation : undefined;
  const selectedVisit = explicitForCurrent?.visit ?? automatic?.visit;
  const nlbRoute = current?.catalogueRoute?.source === 'nlb' ? current.catalogueRoute : undefined;
  const nlbNameOnly = nlbRoute && (!routePlaceName(nlbRoute.origin, locale) || !routePlaceName(nlbRoute.destination, locale));

  const stopIds = useMemo(() => {
    if (base.source === 'nlb') return [];
    const stops = sequence?.stops ?? [];
    const endpoints = base.source === 'citybus' ? choices.flatMap(({ identity }) => {
      const list = sequences[routeStopKey(identity)]?.snapshot?.stops;
      return list?.length ? [list[0].id, list[list.length - 1].id] : [];
    }) : [];
    const priority = stops.length ? [stops[0].id, stops[stops.length - 1].id] : [];
    return [...new Set([...priority, ...endpoints, ...stops.map((stop) => stop.id)])];
  }, [base.source, choices, sequence, sequences]);
  const { names, retry: retryNames } = useRouteStopNames(base.source === 'nlb' ? undefined : base.source, stopIds);

  function stopName(stop: RouteStop) {
    if (stop.name) return routePlaceName(stop.name, locale) || detail.unavailableName;
    const value = names[stop.id];
    if (value?.snapshot) return routePlaceName(value.snapshot.stop.name, locale);
    return value?.error ? detail.unavailableName : detail.loadingName;
  }

  function destination(entry: SequenceEntry) {
    if (entry.catalogueRoute) return routePlaceName(entry.catalogueRoute.destination, locale);
    const last = entry.state?.snapshot?.stops.at(-1);
    const name = last && names[last.id]?.snapshot?.stop.name;
    return name && routePlaceName(name, locale);
  }

  function directionLabel(entry: SequenceEntry) {
    if (entry.identity.source === 'nlb') {
      return entry.catalogueRoute?.source === 'nlb' ? routePlaceName(entry.catalogueRoute.routeName, locale) : detail.routeOptions;
    }
    const name = destination(entry);
    return name ? detail.towards(name) : bus.directions[entry.identity.direction];
  }

  function endpoint(entry: SequenceEntry | undefined, end: 'origin' | 'destination') {
    if (entry?.catalogueRoute) return routePlaceName(entry.catalogueRoute[end], locale);
    const stops = entry?.state?.snapshot?.stops;
    const stop = end === 'origin' ? stops?.[0] : stops?.at(-1);
    if (stop) return stopName(stop);
    return entry && pending(entry) ? detail.loadingName : detail.unavailableName;
  }

  const failures = entries.filter(({ state }) => state?.error);
  const partialFailureTitle = base.source === 'nlb' ? bus.updateFailed : detail.partialDirections;
  const missingNames = stopIds.map((id) => names[id]?.error).filter(Boolean);
  const showSaved = sequence && sequence.stops.length > 0 && (current.state?.fromCache || current.state?.error);
  const hasStops = (sequence?.stops.length ?? 0) > 0;
  const picked = current && sequence?.stops.find((stop) => stopVisitKey(current.identity, stop) === selectedVisit);
  const etaTarget: EtaTarget | undefined = current && picked && sequence ? {
    ...current.identity,
    stopId: picked.id,
    stopSeq: picked.seq,
    repeatedStop: current.identity.source === 'nlb' && sequence.stops.some((stop) => stop.id === picked.id && stop.seq !== picked.seq),
  } : undefined;

  function scrollToRecommendation() {
    const row = recommendedRow.current;
    const content = scrollContent.current;
    if (!row || !content) return;
    row.measureLayout(content, (_, y) => {
      if (recommendedRow.current === row) scroll.current?.scrollTo({ y: Math.max(0, y - space.sm), animated: true });
    });
  }

  function openEta() {
    if (!etaTarget || !current || !picked || !sequence) return;
    const station = picked.name ?? names[picked.id]?.snapshot?.stop.name;
    const last = sequence.stops.at(-1);
    const to = current.catalogueRoute?.destination ?? (last && names[last.id]?.snapshot?.stop.name);
    router.push({ pathname: '/bus/eta', params: {
      source: etaTarget.source,
      number: etaTarget.number,
      stopId: etaTarget.stopId,
      stopSeq: String(etaTarget.stopSeq),
      ...(etaTarget.source === 'nlb'
        ? { nlbRouteId: etaTarget.routeId, repeatedStop: etaTarget.repeatedStop ? '1' : '0' }
        : { direction: etaTarget.direction }),
      ...(etaTarget.source === 'kmbLwb' && { serviceType: etaTarget.serviceType }),
      stationZh: station?.zh ?? '',
      stationEn: station?.en ?? '',
      destinationZh: to?.zh || nlbRoute?.routeName.zh || '',
      destinationEn: to?.en || nlbRoute?.routeName.en || '',
      ...(etaTarget.source === 'citybus' && last && { destinationStopId: last.id }),
    } });
  }

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <ScrollView ref={scroll} innerViewRef={scrollContent as RefObject<View>}
        contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="never">
        <View style={styles.card}>
          <View style={styles.routeHeader}>
            <View style={styles.busBadge}><Icon name="bus" color={colors.onPrimary} size={25} /></View>
            <AppText variant="moduleTitle" accessibilityRole="header" style={styles.grow}>{base.number}</AppText>
            <AppText variant="detail" tone="muted" style={styles.source}>{bus.sources[base.source]}</AppText>
          </View>
          {nlbNameOnly ? (
            <AppText variant="homeCardTitle">{routePlaceName(nlbRoute.routeName, locale)}</AppText>
          ) : (
            <View style={styles.endpoints}>
              <View style={styles.grow}>
                <AppText variant="caption" tone="muted">{bus.origin}</AppText>
                <AppText variant="homeCardTitle">{endpoint(current, 'origin')}</AppText>
              </View>
              <Icon name="arrow.right" size={16} />
              <View style={styles.grow}>
                <AppText variant="caption" tone="muted">{bus.destination}</AppText>
                <AppText variant="homeCardTitle">{endpoint(current, 'destination')}</AppText>
              </View>
            </View>
          )}
          <View style={styles.routeMeta}>
            {current && current.identity.source !== 'nlb' && (
              <AppText variant="caption" tone="primary">{bus.directions[current.identity.direction]}</AppText>
            )}
            {base.source === 'kmbLwb' && variant && <AppText variant="caption" tone="muted">{bus.service(variant)}</AppText>}
            {nlbRoute?.special && <AppText variant="caption" tone="muted">{bus.specialRoute}</AppText>}
            {nlbRoute?.overnight && <AppText variant="caption" tone="muted">{bus.overnightRoute}</AppText>}
          </View>
        </View>

        {options.length > 1 && (
          <View style={styles.section}>
            <AppText variant="caption" tone="muted" accessibilityRole="header">{optionHeading}</AppText>
            <View style={styles.variants} accessibilityRole="radiogroup" accessibilityLabel={optionHeading}>
              {options.map(([value, label]) => (
                <RouteOption key={value} label={label} selected={value === variant}
                  onPress={() => setSelection((previous) => previous.variant === value
                    ? previous : { ...previous, variant: value, stop: undefined })} compact />
              ))}
            </View>
          </View>
        )}
        {available.length > 1 && (
          <View style={styles.segments} accessibilityRole="radiogroup" accessibilityLabel={detail.directions}>
            {available.map((entry) => {
              const { identity } = entry;
              if (identity.source === 'nlb') return null;
              return (
                <RouteOption key={entry.key} label={directionLabel(entry)} selected={entry.key === current?.key}
                  onPress={() => {
                    if (entry.key !== current?.key) {
                      setSelection((previous) => ({ ...previous, direction: identity.direction, stop: undefined }));
                    }
                  }} />
              );
            })}
          </View>
        )}

        {showSaved && (
          <AppText variant="brandSubtitle" tone="muted">
            {detail.cached(new Date(sequence.fetchedAt).toLocaleString(locale, {
              dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Hong_Kong',
            }))}
          </AppText>
        )}
        {entries.some(({ state }) => state?.changed) && <AppText variant="detail" tone="muted">{detail.sequenceUpdated}</AppText>}
        {failures.length > 0 && (
          <View style={styles.notice}>
            <AppText variant="homeCardTitle" accessibilityRole="alert">
              {available.length ? partialFailureTitle : detail.loadFailed}
            </AppText>
            {failures.map((entry) => (
              <AppText key={entry.key} variant="detail" tone="muted">
                {directionLabel(entry)} · {entry.identity.source === 'citybus' && entry.state?.error?.status === 429 ? detail.rateLimited
                  : bus.failureReasons[entry.state?.error?.kind ?? 'network']}
              </AppText>
            ))}
            <BusAction label={bus.retry} onPress={retrySequence} />
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.listHeading}>
            <AppText variant="homeHeading" accessibilityRole="header" style={styles.grow}>{detail.stops}</AppText>
            {sequence && sequence.stops.length > 0 && (
              <AppText variant="caption" tone="muted">{detail.stopCount(sequence.stops.length)}</AppText>
            )}
          </View>
          {hasStops && (
            <View style={styles.stopHint}>
              <Icon name="hand.tap" size={15} color={colors.muted} />
              <AppText variant="brandSubtitle" tone="muted" style={styles.grow}>{detail.selectStopHint}</AppText>
            </View>
          )}
          {recommendation && (
            <RouteLocationHint recommendation={recommendation}
              name={picked ? stopName(picked) : undefined} onRequest={requestLocation} onScroll={scrollToRecommendation} />
          )}
          {current && sequence && sequence.stops.length > 0 ? (
            <View style={styles.timeline}>
              {sequence.stops.map((stop, index) => {
                const key = stopVisitKey(current.identity, stop);
                const first = index === 0;
                const last = index === sequence.stops.length - 1;
                const label = first ? detail.first : last ? detail.last : undefined;
                const selected = selectedVisit === key;
                return (
                  <TimelineRow
                    key={key} number={stop.seq} name={stopName(stop)} terminal={label}
                    note={stop.someDeparturesOnly ? detail.someDeparturesOnly : undefined}
                    first={first} last={last} selected={selected}
                    rowRef={automatic && selected ? recommendedRow : undefined}
                    accessibilityHint={selected ? detail.clearStopSelection : detail.previewStopHint}
                    onPress={() => setSelection((previous) => {
                      const previousVisit = previous.stop?.routeKey === current.key ? previous.stop.visit : automatic?.visit;
                      return {
                        ...previous,
                        direction: current.identity.source === 'nlb' ? undefined : current.identity.direction,
                        stop: { routeKey: current.key, visit: previousVisit === key ? undefined : key },
                      };
                    })}
                  />
                );
              })}
            </View>
          ) : current && pending(current) ? (
            <RouteLoading label={detail.loadingSequence} />
          ) : !failures.length ? (
            <EmptyState icon="bus" title={detail.noStops} detail={base.source === 'nlb' ? undefined : detail.routeChanged} />
          ) : null}
          {missingNames.length > 0 && (
            <View style={styles.notice}>
              <AppText variant="detail" tone="muted">
                {missingNames.some((error) => error?.status === 429) ? detail.rateLimited : detail.partialNames}
              </AppText>
              <BusAction label={bus.retry} onPress={retryNames} />
            </View>
          )}
        </View>
      </ScrollView>
      {etaTarget && picked && current ? (
        <SelectedStopCard key={selectedVisit} initialTarget={etaTarget} name={stopName(picked)}
          direction={directionLabel(current)} cooldowns={etaCooldowns} onOpen={openEta} />
      ) : hasStops ? (
        <View style={[styles.selection, styles.selectionPrompt]}>
          <Icon name="mappin" size={18} />
          <AppText variant="detail" tone="muted" style={styles.grow}>{detail.selectStopPrompt}</AppText>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function RouteLocationHint({ recommendation, name, onRequest, onScroll }: {
  recommendation: NonNullable<ReturnType<typeof useRouteStopRecommendation>['recommendation']>;
  name?: string;
  onRequest: () => void;
  onScroll: () => void;
}) {
  const { copy } = useLanguage();
  const labels = copy.busDetail.nearbyStop;
  if (recommendation.kind === 'permission' || recommendation.kind === 'found') {
    const found = recommendation.kind === 'found';
    return (
      <Pressable accessibilityRole="button" onPress={found ? onScroll : onRequest}
        accessibilityHint={found ? labels.showOnList : undefined}
        style={({ pressed }) => [styles.locationHint, pressed && styles.pressed]}>
        <Icon name={found ? 'mappin' : 'location'} size={16} />
        <View style={styles.grow}>
          <AppText variant="caption" tone="primary">{found ? labels.selected : labels.find}</AppText>
          <AppText variant="brandSubtitle" tone="muted">
            {found ? labels.distance(name ?? copy.busDetail.unavailableName, Math.round(recommendation.distance)) : labels.description}
          </AppText>
        </View>
        <Icon name={found ? 'chevron.down' : 'chevron.right'} size={12} />
      </Pressable>
    );
  }

  const loading = recommendation.kind === 'loading';
  return (
    <View style={styles.locationHint} accessibilityLiveRegion="polite">
      {loading ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon name="info.circle" size={15} color={colors.muted} />}
      <AppText variant="brandSubtitle" tone="muted" style={styles.grow}>{labels.status[recommendation.kind]}</AppText>
    </View>
  );
}

function SelectedStopCard({ initialTarget, name, direction, cooldowns, onOpen }: {
  initialTarget: EtaTarget;
  name: string;
  direction: string;
  cooldowns: Map<string, number>;
  onOpen: () => void;
}) {
  // The visit key remounts this card, including the delay and request state, when the selected stop changes.
  const [target] = useState(initialTarget);
  const [ready, setReady] = useState(false);
  const { copy, locale } = useLanguage();
  const eta = copy.busEta;
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), etaPreviewDelay);
    return () => clearTimeout(timer);
  }, []);

  const { snapshot, error, now, loading } = useBusEta(target, locale, ready, cooldowns);
  const view = describeEta(snapshot, error, now, loading, locale, eta);
  const [next] = view.upcoming;
  const stale = snapshot && etaIsStale(snapshot, now);
  const status = stale || !snapshot ? view.status : loading ? eta.loading : eta.previewEmpty;
  const updateText = stale || error ? view.updateText : undefined;

  return (
    <View style={styles.selection}>
      <View style={styles.selectionHeading}>
        <Icon name="mappin" size={22} />
        <View style={styles.grow}>
          <AppText variant="caption" tone="primary">{copy.busDetail.stopOrder(target.stopSeq)}</AppText>
          <AppText variant="homeCardTitle">{name}</AppText>
          <AppText variant="detail" tone="muted">{target.number} · {direction}</AppText>
        </View>
      </View>
      <View style={styles.etaRow}>
        <View style={styles.etaPreview} accessibilityLiveRegion="polite">
          <AppText variant="caption" tone="muted">{eta.nextArrival}</AppText>
          {!next ? <AppText variant="detail" tone="muted">{status}</AppText>
            : next.minutes === 0 ? <AppText variant="title" tone="primary">{eta.due}</AppText> : (
              <AppText variant="detail" tone="primary">
                {eta.minutes.prefix}<AppText variant="section" tone="primary" style={styles.etaDigits}>{next.minutes}</AppText>{eta.minutes.suffix}
              </AppText>
            )}
        </View>
        <Pressable accessibilityRole="button" onPress={onOpen}
          style={({ pressed }) => [styles.etaLink, pressed && styles.pressed]}>
          <AppText variant="detail" tone="primary" style={styles.etaLinkText}>{eta.openAll}</AppText>
          <Icon name="chevron.right" size={13} />
        </Pressable>
      </View>
      {view.errorText && <AppText variant="brandSubtitle" tone="error">{view.errorText}</AppText>}
      {updateText && <AppText variant="brandSubtitle" tone="muted">{updateText}</AppText>}
    </View>
  );
}

function RouteOption({ label, selected, onPress, compact }: {
  label: string; selected: boolean; onPress: () => void; compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={onPress}
      style={({ pressed }) => [styles.option, compact ? styles.variant : styles.segment,
        selected && styles.activeOption, pressed && styles.pressed]}
    >
      <AppText variant="detail" tone={selected ? 'onPrimary' : 'text'} style={styles.center}>{label}</AppText>
    </Pressable>
  );
}

function RouteLoading({ label }: { label: string }) {
  return (
    <View style={styles.loading} accessibilityRole="progressbar">
      <ActivityIndicator color={colors.primary} />
      <AppText variant="detail" tone="muted" style={styles.grow}>{label}</AppText>
    </View>
  );
}

function TimelineRow({ number, name, terminal, note, first, last, selected, rowRef, accessibilityHint, onPress }: {
  number: number; name: string; terminal?: string; note?: string; first: boolean; last: boolean; selected: boolean;
  rowRef?: Ref<View>; accessibilityHint: string; onPress: () => void;
}) {
  return (
    <Pressable
      ref={rowRef}
      accessibilityRole="button" accessibilityState={{ selected }} accessibilityHint={accessibilityHint} onPress={onPress}
      style={({ pressed }) => [styles.stopRow, !last && styles.separator, selected && styles.selectedRow, pressed && styles.pressed]}
    >
      <View style={styles.track}>
        {!first && <View style={[styles.line, styles.above]} />}
        {!last && <View style={[styles.line, styles.below]} />}
        <View style={[styles.marker, terminal && styles.terminal, selected && styles.selectedMarker]} />
      </View>
      <AppText variant="detail" tone="muted" style={styles.sequence}>{number}</AppText>
      <View style={[styles.grow, styles.stopCopy]}>
        <AppText variant={selected ? 'homeCardTitle' : 'detail'}>{name}</AppText>
        {terminal && <AppText variant="caption" tone="muted">{terminal}</AppText>}
        {note && <AppText variant="caption" tone="muted">{note}</AppText>}
      </View>
      {selected && <Icon name="checkmark" size={15} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: homeLayout.gutter, paddingTop: space.md, paddingBottom: space.section, gap: space.md },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.media, borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border, padding: space.lg, gap: space.md,
  },
  routeHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  busBadge: {
    width: touchTarget, height: touchTarget, borderRadius: radius.control,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary,
  },
  source: { maxWidth: '45%', textAlign: 'right' },
  endpoints: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grow: { flex: 1, minWidth: 0 },
  routeMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  section: { gap: space.sm },
  variants: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  segments: { flexDirection: 'row', gap: space.xs, padding: space.xs, borderRadius: radius.card, backgroundColor: colors.tint },
  option: { minHeight: touchTarget, justifyContent: 'center', padding: space.sm, borderRadius: radius.control },
  variant: { maxWidth: '100%', backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  segment: { flex: 1, minWidth: 0 },
  center: { textAlign: 'center' },
  activeOption: { backgroundColor: colors.primary, borderColor: colors.primary },
  listHeading: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stopHint: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
  locationHint: {
    minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: space.sm,
    borderRadius: radius.control, backgroundColor: colors.tintedBackground, padding: space.sm,
  },
  timeline: {
    overflow: 'hidden', borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border, backgroundColor: colors.surface,
  },
  stopRow: { minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md },
  separator: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  selectedRow: { backgroundColor: colors.tintedBackground },
  pressed: { opacity: 0.76 },
  track: { width: 18, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  line: { position: 'absolute', width: 2, backgroundColor: colors.primary },
  above: { top: 0, bottom: '50%' },
  below: { top: '50%', bottom: 0 },
  marker: { width: 10, height: 10, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.surface },
  terminal: { width: 13, height: 13, borderWidth: 2.5 },
  selectedMarker: { width: 16, height: 16, borderWidth: 4, backgroundColor: colors.surface },
  sequence: { minWidth: 24, fontVariant: ['tabular-nums'] },
  stopCopy: { paddingVertical: space.sm, gap: space.xs },
  notice: { padding: space.md, gap: space.xs, borderRadius: radius.card, backgroundColor: colors.tintedBackground },
  loading: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md },
  selection: {
    gap: space.sm, padding: space.md, marginHorizontal: homeLayout.gutter,
    marginBottom: space.sm, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.tintedBackground,
  },
  selectionPrompt: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.sm },
  selectionHeading: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  etaRow: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  etaPreview: { flexBasis: 116, flexGrow: 1, minWidth: 0, gap: space.xs },
  etaDigits: { fontVariant: ['tabular-nums'] },
  etaLink: {
    flexBasis: 126, flexGrow: 1, minWidth: 0, minHeight: touchTarget, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'flex-end', gap: space.sm,
  },
  etaLinkText: { flexShrink: 1, textAlign: 'right' },
});
