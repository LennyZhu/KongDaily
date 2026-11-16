import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { findBusRouteFamily } from '@/bus-data';
import { routePlaceName } from '@/bus-routes';
import { useRouteSequences, useRouteStopNames, type SequenceState } from '@/bus-stop-hooks';
import {
  routeOptionKey, routeSequenceChoices, routeStopKey, stopVisitKey,
  type RouteSequenceChoice, type RouteStop, type TravelDirection,
} from '@/bus-stops';
import { BusAction } from '@/components/bus-ui';
import { AppText, EmptyState, Icon, Screen } from '@/components/ui';
import { useLanguage } from '@/language';
import { colors, homeLayout, radius, space, touchTarget } from '@/theme';

type RouteFamily = NonNullable<Awaited<ReturnType<typeof findBusRouteFamily>>>;
type SequenceEntry = RouteSequenceChoice & { key: string; state?: SequenceState };
type RouteSelection = { variant?: string; direction?: TravelDirection; visit?: string };

// Settings lives outside the bus stack. Remember the last route during a language change.
let lastRouteSelection: { id: string; locale: string; value: RouteSelection } | undefined;

export default function RouteDetailsScreen() {
  const { routeId } = useLocalSearchParams<{ routeId?: string }>();
  const id = typeof routeId === 'string' ? routeId : '';
  return <RouteLoader key={id} id={id} />;
}

function RouteLoader({ id }: { id: string }) {
  const { copy } = useLanguage();
  const router = useRouter();
  const [family, setFamily] = useState<RouteFamily | null>();

  useEffect(() => {
    let active = true;
    void findBusRouteFamily(id).then(
      (result) => { if (active) setFamily(result ?? null); },
      () => { if (active) setFamily(null); },
    );
    return () => { active = false; };
  }, [id]);

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
  return <RouteDetails family={family} />;
}

function RouteDetails({ family }: { family: RouteFamily }) {
  const { copy, locale } = useLanguage();
  const router = useRouter();
  const detail = copy.busDetail;
  const bus = copy.bus;
  const base = family.selected;
  const [selection, setSelection] = useState<RouteSelection>(() => {
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
  const { variant, direction, visit: selectedVisit } = selection;

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
  const current = preferred && (pending(preferred) || available.includes(preferred))
    ? preferred
    : available[0] ?? entries.find(pending) ?? preferred ?? entries[0];
  const sequence = current?.state?.snapshot;
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
  const picked = current && sequence?.stops.find((stop) => stopVisitKey(current.identity, stop) === selectedVisit);

  function openEta() {
    if (!current || !picked || !sequence) return;
    const { identity } = current;
    const station = picked.name ?? names[picked.id]?.snapshot?.stop.name;
    const last = sequence.stops.at(-1);
    const to = current.catalogueRoute?.destination ?? (last && names[last.id]?.snapshot?.stop.name);
    router.push({ pathname: '/bus/eta', params: {
      source: identity.source,
      number: identity.number,
      stopId: picked.id,
      stopSeq: String(picked.seq),
      ...(identity.source === 'nlb'
        ? { nlbRouteId: identity.routeId, repeatedStop: sequence.stops.some((stop) => stop.id === picked.id && stop.seq !== picked.seq) ? '1' : '0' }
        : { direction: identity.direction }),
      ...(identity.source === 'kmbLwb' && { serviceType: identity.serviceType }),
      stationZh: station?.zh ?? '',
      stationEn: station?.en ?? '',
      destinationZh: to?.zh || nlbRoute?.routeName.zh || '',
      destinationEn: to?.en || nlbRoute?.routeName.en || '',
      ...(identity.source === 'citybus' && last && { destinationStopId: last.id }),
    } });
  }

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="never">
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
                  onPress={() => setSelection((previous) => ({ ...previous, variant: value }))} compact />
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
                  onPress={() => setSelection((previous) => ({ ...previous, direction: identity.direction }))} />
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
          {current && sequence && sequence.stops.length > 0 ? (
            <View style={styles.timeline}>
              {sequence.stops.map((stop, index) => {
                const key = stopVisitKey(current.identity, stop);
                const first = index === 0;
                const last = index === sequence.stops.length - 1;
                const label = first ? detail.first : last ? detail.last : undefined;
                return (
                  <TimelineRow
                    key={key} number={stop.seq} name={stopName(stop)} terminal={label}
                    note={stop.someDeparturesOnly ? detail.someDeparturesOnly : undefined}
                    first={first} last={last} selected={selectedVisit === key}
                    onPress={() => setSelection((previous) => ({ ...previous, visit: previous.visit === key ? undefined : key }))}
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
      {picked && (
        <View style={styles.selection} accessibilityLiveRegion="polite">
          <Icon name="mappin" size={22} />
          <View style={styles.grow}>
            <AppText variant="caption" tone="primary">{detail.stopOrder(picked.seq)}</AppText>
            <AppText variant="homeCardTitle">{stopName(picked)}</AppText>
            <Pressable accessibilityRole="button" onPress={openEta}
              style={({ pressed }) => [styles.etaLink, pressed && styles.pressed]}>
              <AppText variant="detail" tone="primary" style={styles.grow}>{copy.busEta.open}</AppText>
              <Icon name="chevron.right" size={13} />
            </Pressable>
          </View>
        </View>
      )}
    </SafeAreaView>
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

function TimelineRow({ number, name, terminal, note, first, last, selected, onPress }: {
  number: number; name: string; terminal?: string; note?: string; first: boolean; last: boolean; selected: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}
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
    flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, marginHorizontal: homeLayout.gutter,
    marginBottom: space.sm, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.tintedBackground,
  },
  etaLink: { minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
