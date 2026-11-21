import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Pressable, StyleSheet, View, type ViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { describeEta, etaEntryNotes, etaIsStale } from '@/bus-eta';
import { routePlaceName } from '@/bus-routes';
import { AppText, EmptyState, Icon } from '@/components/ui';
import { useLanguage } from '@/language';
import {
  kmbNearbyNeedsRefresh, prepareNearbyBusIndex, readNearbyBusStops, refreshKmbNearbyStops,
  type BusSearchRadius, type Coordinates, type NearbyBusStop,
} from '@/nearby-bus-data';
import { nearbyBusLandmarks, type NearbyLandmark } from '@/nearby-bus-landmarks';
import { locateNearbyBusStops, type NearbyLocationIssue } from '@/nearby-bus-location';
import { useStationEta } from '@/nearby-stop-eta-hooks';
import { groupNearbyStops, type NearbyStopGroup } from '@/nearby-stop-groups';
import { nearbyRouteHref, readNearbyRoutes, readStationRoutes, type NearbyRoute, type StationEtaRecord, type StationRoute } from '@/nearby-stop-routes';
import { colors, homeLayout, radius, space, touchTarget } from '@/theme';

type Reference = { kind: 'current'; point: Coordinates } | { kind: 'landmark'; landmark: NearbyLandmark; point: Coordinates };
type Results = { reference: Reference; radius: BusSearchRadius; stops?: NearbyBusStop[]; routes?: NearbyRoute[] | 'error' };
type Mode = 'routes' | 'stops';
type NearbyItem = NearbyRoute | NearbyStopGroup;
const emptyRoutes: NearbyRoute[] = [];
const emptyStops: NearbyBusStop[] = [];
const viewability = { itemVisiblePercentThreshold: 35, minimumViewTime: 250 };
const radii = [500, 1000, 2000] as const;

export default function NearbyBusScreen() {
  const { copy, locale } = useLanguage();
  const router = useRouter();
  const labels = copy.nearbyBus;
  const { bottom } = useSafeAreaInsets();
  const [reference, setReference] = useState<Reference>();
  const [referenceRevision, setReferenceRevision] = useState(0);
  const [mode, setMode] = useState<Mode>('routes');
  const [expandedStopGroups, setExpandedStopGroups] = useState<Set<string>>(() => new Set());
  const [radiusMeters, setRadiusMeters] = useState<BusSearchRadius>(500);
  const [pickingRadius, setPickingRadius] = useState(false);
  const [picking, setPicking] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationIssue, setLocationIssue] = useState<NearbyLocationIssue>();
  const locationRequest = useRef<AbortController | null>(null);
  const locationActive = useRef(false);
  const landmarkSelected = useRef(false);

  const [index, setIndex] = useState<'loading' | 'error' | number>('loading');
  const [reload, setReload] = useState(0);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [result, setResult] = useState<Results>();

  useEffect(() => {
    let active = true;
    setIndex('loading');
    setRefreshFailed(false);
    void prepareNearbyBusIndex().then(async (sources) => {
      if (!active) return;
      setIndex(0);
      if (!kmbNearbyNeedsRefresh(sources)) return;
      try {
        await refreshKmbNearbyStops();
        if (active) setIndex(1);
      } catch {
        if (active) setRefreshFailed(true);
      }
    }, () => { if (active) setIndex('error'); });
    return () => { active = false; };
  }, [reload]);

  useEffect(() => {
    if (!reference || typeof index !== 'number') return;
    let active = true;
    const query = { reference, radius: radiusMeters };
    void readNearbyBusStops(reference.point, radiusMeters).then(async (stops) => {
      if (!active) return;
      const routes = await readNearbyRoutes(stops).catch(() => 'error' as const);
      if (active) setResult({ ...query, stops, routes });
    }, () => { if (active) setResult(query); });
    return () => { active = false; };
  }, [index, radiusMeters, reference]);

  const resultForRadius = result && result.reference === reference && result.radius === radiusMeters ? result : undefined;
  const stops = resultForRadius?.stops ?? emptyStops;
  const stopGroups = useMemo(() => mode === 'stops' ? groupNearbyStops(stops) : [], [mode, stops]);
  const routeResult = resultForRadius?.routes;
  const routeRows = mode === 'routes' && Array.isArray(routeResult) ? routeResult : emptyRoutes;
  const etaRoutes = useMemo(() => routeRows.map(({ route }) => route), [routeRows]);
  const { records, now, rateLimits, setVisible } = useStationEta(etaRoutes, locale);
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken<NearbyItem>[] }) => {
    setVisible(viewableItems.flatMap(({ item }) => 'route' in item ? [item.route.id] : []));
  }, [setVisible]);

  const updateReference = useCallback((value: Reference, resetRadius: boolean) => {
    setVisible([]);
    if (resetRadius) setRadiusMeters(500);
    setPickingRadius(false);
    setReference(value);
    setReferenceRevision((revision) => revision + 1);
  }, [setVisible]);

  const cancelLocation = useCallback(() => {
    locationRequest.current?.abort();
    locationRequest.current = null;
  }, []);

  const requestLocation = useCallback(async (allowPermissionPrompt: boolean) => {
    if (!locationActive.current || locationRequest.current || (!allowPermissionPrompt && landmarkSelected.current)) return;

    const controller = new AbortController();
    locationRequest.current = controller;
    setLocating(true);
    setLocationIssue(undefined);
    if (allowPermissionPrompt) setPicking(false);
    setPickingRadius(false);
    setReference((previous) => previous?.kind === 'current' ? undefined : previous);

    const location = await locateNearbyBusStops(controller.signal, allowPermissionPrompt);
    if (locationRequest.current !== controller) return;
    locationRequest.current = null;
    setLocating(false);

    if (location.kind === 'position') {
      landmarkSelected.current = false;
      updateReference({ kind: 'current', point: location.point }, allowPermissionPrompt);
    } else if (location.kind !== 'cancelled') {
      setLocationIssue(location.kind);
    }
  }, [updateReference]);

  useFocusEffect(useCallback(() => {
    function resumeLocation() {
      locationActive.current = true;
      void requestLocation(false);
    }

    setLocating(false);
    const subscription = AppState.addEventListener('change', (state) => {
      // iOS can become temporarily inactive while the permission prompt is open.
      if (state === 'background') {
        locationActive.current = false;
        cancelLocation();
        setLocating(false);
      } else if (state === 'active' && !locationActive.current) {
        resumeLocation();
      }
    });
    if (AppState.currentState === 'active' || AppState.currentState == null) resumeLocation();

    return () => {
      subscription.remove();
      locationActive.current = false;
      cancelLocation();
    };
  }, [cancelLocation, requestLocation]));

  function updateRadius(value: BusSearchRadius) {
    setPickingRadius(false);
    if (value === radiusMeters) return;
    setVisible([]);
    setRadiusMeters(value);
  }

  function chooseLandmark(landmark: NearbyLandmark) {
    landmarkSelected.current = true;
    cancelLocation();
    setLocating(false);
    setLocationIssue(undefined);
    setPicking(false);
    updateReference({ kind: 'landmark', landmark, point: nearbyBusLandmarks[landmark] }, true);
  }

  function formatDistance(metres: number) {
    return metres < 1000 ? labels.metres(Math.round(metres)) : labels.kilometres(Math.round(metres / 100) / 10);
  }

  function openStop(stop: NearbyBusStop) {
    router.push({ pathname: '/bus/nearby/stop', params: {
      source: stop.source, stopId: stop.stop_id, distance: String(stop.distance),
    } });
  }

  function toggleStopGroup(id: string) {
    setExpandedStopGroups((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const expandedRadius = radiusMeters === 500 ? 1000 : radiusMeters === 1000 ? 2000 : undefined;
  const referenceName = reference?.kind === 'landmark' ? labels.landmarkReference(labels.landmarks[reference.landmark])
    : reference ? labels.currentLocation : labels.noReference;

  return (
    <FlatList<NearbyItem>
      key={`${mode}:${referenceRevision}:${radiusMeters}`}
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: bottom + space.section }]}
      contentInsetAdjustmentBehavior="never"
      data={mode === 'routes' ? routeRows : stopGroups}
      keyExtractor={(item) => 'route' in item ? item.route.id : item.id}
      viewabilityConfig={viewability}
      onViewableItemsChanged={onViewableItemsChanged}
      renderItem={({ item }) => {
        if ('route' in item) {
          return <RouteCard recommendation={item} distance={formatDistance(item.stop.distance)}
            record={records[item.route.id]} fallbackError={rateLimits[item.route.target.source]} now={now}
            onPress={() => router.push(nearbyRouteHref(item.route.target))} />;
        }
        return <StopGroupCard group={item} expanded={expandedStopGroups.has(item.id)}
          formatDistance={formatDistance} onOpen={openStop} onToggle={() => toggleStopGroup(item.id)} />;
      }}
      ListHeaderComponent={(
        <View style={styles.header}>
          <View style={[styles.panel, styles.reference]}>
            <View style={styles.referenceRow}>
              <View style={styles.copy}>
                <AppText variant="caption" tone="muted">{labels.reference}</AppText>
                <AppText variant="homeCardTitle" accessibilityLiveRegion="polite">
                  {locating ? labels.locating : referenceName}
                </AppText>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={labels.useLocation}
                accessibilityState={{ disabled: locating, busy: locating }} disabled={locating}
                onPress={() => void requestLocation(true)}
                style={({ pressed }) => [styles.locationButton, pressed && styles.pressed]}>
                {locating ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon name="location" size={14} />}
                <AppText variant="caption" tone="primary" style={styles.shrink}>{labels.useLocation}</AppText>
              </Pressable>
            </View>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: picking }}
              onPress={() => setPicking((open) => !open)}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              <Icon name="mappin" size={15} />
              <AppText variant="detail" tone="primary" style={styles.copy}>{labels.chooseLandmark}</AppText>
              <Icon name={picking ? 'chevron.up' : 'chevron.down'} size={12} />
            </Pressable>
          </View>
          {picking && (
            <View style={styles.panel}>
              {Object.entries(nearbyBusLandmarks).map(([key]) => {
                const landmark = key as NearbyLandmark;
                const selected = reference?.kind === 'landmark' && reference.landmark === landmark;
                return (
                  <Pressable key={landmark} accessibilityRole="button" accessibilityState={{ selected }}
                    onPress={() => chooseLandmark(landmark)}
                    style={({ pressed }) => [styles.landmark, selected && styles.selected, pressed && styles.pressed]}>
                    <AppText variant="detail" style={styles.copy}>{labels.landmarks[landmark]}</AppText>
                    <Icon name={selected ? 'checkmark' : 'chevron.right'} size={13} />
                  </Pressable>
                );
              })}
            </View>
          )}
          {locationIssue && (
            <View style={styles.note}>
              <Icon name="exclamationmark.circle" size={16} />
              <AppText variant="detail" tone="muted" accessibilityRole="alert" style={styles.copy}>{labels.issues[locationIssue]}</AppText>
            </View>
          )}
          {refreshFailed && <AppText variant="detail" tone="muted" accessibilityRole="alert">{labels.refreshFailed}</AppText>}
          <View style={styles.note}>
            <Icon name="info.circle" color={colors.muted} size={14} />
            <View style={styles.copy}>
              <AppText variant="brandSubtitle" tone="muted">{labels.distanceNote}</AppText>
              <AppText variant="brandSubtitle" tone="muted">
                {mode === 'routes' ? labels.routeCoverage : labels.partialCoverage}
              </AppText>
            </View>
          </View>
          <View accessibilityRole="tablist" style={styles.segment}>
            {(['routes', 'stops'] as const).map((option) => (
              <Pressable key={option} accessibilityRole="tab" accessibilityState={{ selected: mode === option }}
                onPress={() => {
                  if (mode === option) return;
                  setVisible([]);
                  setMode(option);
                }}
                style={({ pressed }) => [styles.segmentOption, mode === option && styles.segmentSelected, pressed && styles.pressed]}>
                <Icon name={option === 'routes' ? 'bus' : 'mappin'} size={16}
                  color={mode === option ? colors.onPrimary : colors.primary} />
                <AppText variant="detail" tone={mode === option ? 'onPrimary' : 'primary'} style={styles.shrink}>
                  {option === 'routes' ? labels.byRoute : labels.byStop}
                </AppText>
              </Pressable>
            ))}
          </View>
          <View style={styles.heading}>
            <AppText variant="homeHeading" accessibilityRole="header" style={styles.copy}>
              {mode === 'routes' ? labels.routes : labels.stops}
            </AppText>
            {!!reference && (
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: pickingRadius }}
                onPress={() => setPickingRadius((open) => !open)} style={styles.radiusControl}>
                <AppText variant="caption" tone="primary" style={styles.shrink}>{labels.radius(formatDistance(radiusMeters))}</AppText>
                <Icon name={pickingRadius ? 'chevron.up' : 'chevron.down'} size={11} />
              </Pressable>
            )}
          </View>
          {pickingRadius && (
            <View style={styles.segment}>
              {radii.map((value) => (
                <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: value === radiusMeters }}
                  onPress={() => updateRadius(value)}
                  style={({ pressed }) => [styles.segmentOption, value === radiusMeters && styles.segmentSelected, pressed && styles.pressed]}>
                  <AppText variant="caption" tone={value === radiusMeters ? 'onPrimary' : 'primary'}>{formatDistance(value)}</AppText>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
      ListEmptyComponent={(
        <View style={styles.header}>
          {index === 'loading' ? <Loading label={labels.preparing} />
            : index === 'error' || (resultForRadius && !resultForRadius.stops) || (mode === 'routes' && routeResult === 'error') ? (
              <>
                <EmptyState icon="exclamationmark.circle" title={routeResult === 'error' ? labels.routeIndexError : labels.indexError} />
                <ListAction label={copy.bus.retry} onPress={() => {
                  setVisible([]);
                  setResult(undefined);
                  setReload((value) => value + 1);
                }} />
              </>
            ) : !reference ? (
              locating ? null : <EmptyState icon="mappin" title={labels.chooseReference} detail={labels.chooseReferenceDetail} />
            )
              : !resultForRadius || (mode === 'routes' && !routeResult) ? <Loading label={mode === 'routes' ? labels.searchingRoutes : labels.searching} />
                : (
                  <>
                    <EmptyState icon="bus"
                      title={mode === 'routes' ? labels.noRoutes(formatDistance(radiusMeters)) : labels.noStops(formatDistance(radiusMeters))}
                      detail={mode === 'routes' && stops.length > 0 ? labels.noBoardingAssociations : undefined} />
                    {!!expandedRadius && (
                      <ListAction label={labels.expand(formatDistance(expandedRadius))} onPress={() => updateRadius(expandedRadius)} />
                    )}
                  </>
                )}
        </View>
      )}
    />
  );
}

function StopGroupCard({ group, expanded, formatDistance, onOpen, onToggle }: {
  group: NearbyStopGroup;
  expanded: boolean;
  formatDistance: (distance: number) => string;
  onOpen: (stop: NearbyBusStop) => void;
  onToggle: () => void;
}) {
  const { copy, locale } = useLanguage();
  const [nearest] = group.stops;
  const name = routePlaceName({ zh: nearest.name_zh, en: nearest.name_en }, locale);
  const street = routePlaceName({ zh: nearest.street_zh, en: nearest.street_en }, locale);
  const multiple = group.stops.length > 1;
  const distance = formatDistance(nearest.distance);

  return (
    <View style={styles.panel}>
      <Pressable accessibilityRole="button" accessibilityState={multiple ? { expanded } : undefined}
        onPress={multiple ? onToggle : () => onOpen(nearest)}
        style={({ pressed }) => [styles.stop, pressed && styles.pressed]}>
        <View style={styles.stopIcon}><Icon name="bus" size={18} /></View>
        <View style={styles.copy}>
          <AppText variant="homeCardTitle">{name}</AppText>
          <AppText variant="brandSubtitle" tone="muted">
            {multiple ? copy.nearbyBus.sameNameStops(group.stops.length) : copy.bus.sources[nearest.source]}
          </AppText>
          {!multiple && !!street && <AppText variant="brandSubtitle" tone="muted">{street}</AppText>}
        </View>
        <AppText variant="caption" tone="primary" style={[styles.distance, multiple && styles.groupDistance]}>
          {multiple ? copy.nearbyBus.nearestStop(distance) : distance}
        </AppText>
        <Icon name={multiple ? expanded ? 'chevron.up' : 'chevron.down' : 'chevron.right'} size={12} />
      </Pressable>
      {multiple && expanded && group.stops.map((stop) => (
        <StopChoice key={`${stop.source}:${stop.stop_id}`} stop={stop} distance={formatDistance(stop.distance)}
          onPress={() => onOpen(stop)} />
      ))}
    </View>
  );
}

function StopChoice({ stop, distance, onPress }: { stop: NearbyBusStop; distance: string; onPress: () => void }) {
  const { copy, locale } = useLanguage();
  const { source, stop_id: stopId } = stop;
  const [routes, setRoutes] = useState<StationRoute[] | 'error'>();
  const street = routePlaceName({ zh: stop.street_zh, en: stop.street_en }, locale);

  useEffect(() => {
    let active = true;
    void readStationRoutes(source, stopId).then(
      (result) => { if (active) setRoutes(result.routes); },
      () => { if (active) setRoutes('error'); },
    );
    return () => { active = false; };
  }, [source, stopId]);

  return (
    <Pressable accessibilityRole="button" onPress={onPress}
      style={({ pressed }) => [styles.stopChoice, pressed && styles.pressed]}>
      <View style={styles.stopChoiceHeading}>
        <AppText variant="homeCardTitle" style={styles.copy}>{copy.bus.sources[source]}</AppText>
        <AppText variant="caption" tone="primary" style={styles.distance}>{distance}</AppText>
        <Icon name="chevron.right" size={12} />
      </View>
      {!!street && <AppText variant="brandSubtitle" tone="muted">{street}</AppText>}
      <AppText variant="caption" tone="muted">{copy.nearbyBus.officialStopId(stopId)}</AppText>
      {routes === undefined || routes === 'error' || routes.length === 0 ? (
        <AppText variant="brandSubtitle" tone="muted">
          {routes === undefined ? copy.busStation.loading : routes === 'error' ? copy.busStation.loadFailed : copy.busStation.notIndexed}
        </AppText>
      ) : routes.map(({ id, target, destination }) => {
        const place = routePlaceName(destination, locale);
        const direction = place ? copy.busDetail.towards(place)
          : target.source === 'nlb' ? copy.busDetail.routeOptions : copy.bus.directions[target.direction];
        const service = target.source === 'kmbLwb' && target.serviceType !== '1' ? copy.bus.service(target.serviceType) : '';
        return (
          <AppText key={id} variant="brandSubtitle" tone="muted">
            {target.number} · {direction}{service ? ` · ${service}` : ''}
          </AppText>
        );
      })}
    </Pressable>
  );
}

function RouteCard({ recommendation, distance, record, fallbackError, now, onPress }: {
  recommendation: NearbyRoute;
  distance: string;
  record?: StationEtaRecord;
  fallbackError?: StationEtaRecord['error'];
  now: number;
  onPress: () => void;
}) {
  const { copy, locale } = useLanguage();
  const { route, stop } = recommendation;
  const { target } = route;
  const eta = copy.busEta;
  const snapshot = record?.snapshot;
  const error = record?.error ?? fallbackError;
  const view = describeEta(snapshot, error, now, !snapshot && !error, locale, eta);
  const [next, later] = view.upcoming;
  const destination = routePlaceName(next?.destination ?? route.destination, locale);
  const origin = route.origin && routePlaceName(route.origin, locale);
  const direction = destination ? copy.busDetail.towards(destination) : target.source === 'nlb'
    ? copy.busDetail.routeOptions : copy.bus.directions[target.direction];
  const name = routePlaceName({ zh: stop.name_zh, en: stop.name_en }, locale);
  const shared = snapshot && !etaIsStale(snapshot, now) && (record?.sharedThrough ?? 0) >= now;
  const status = shared ? copy.busStation.sharedForecast
    : view.status === eta.loading ? copy.nearbyBus.loadingForecast
      : view.status === eta.unmatched || view.status === eta.empty ? eta.previewEmpty : view.status;
  const countdown = (minutes: number) => minutes === 0 ? eta.due : `${eta.minutes.prefix}${minutes}${eta.minutes.suffix}`;
  const notes = [...new Set([next && etaEntryNotes(next, locale), ...view.notices].filter(Boolean))];

  return (
    <Pressable accessibilityRole="button" onPress={onPress}
      style={({ pressed }) => [styles.panel, styles.routeCard, pressed && styles.pressed]}>
      <View style={styles.routeMain}>
        <View style={styles.routeBadge}>
          <AppText variant="homeCardTitle" tone="onPrimary" style={styles.badgeText}>{target.number}</AppText>
        </View>
        <View style={styles.copy}>
          <AppText variant="homeCardTitle">{direction}</AppText>
          <AppText variant="brandSubtitle" tone="muted">
            {copy.bus.sources[target.source]}
            {target.source === 'kmbLwb' && target.serviceType !== '1' ? ` · ${copy.bus.service(target.serviceType)}` : ''}
          </AppText>
          {!!origin && <AppText variant="brandSubtitle" tone="muted">{copy.busStation.startsFrom(origin)}</AppText>}
        </View>
        <View style={styles.arrivals}>
          {next ? (
            <>
              <AppText variant="title" tone="primary" style={styles.arrivalText}>{countdown(next.minutes)}</AppText>
              {later && <AppText variant="brandSubtitle" tone="muted" style={styles.arrivalText}>{countdown(later.minutes)}</AppText>}
            </>
          ) : <AppText variant="caption" tone="muted" style={styles.arrivalText}>{status}</AppText>}
        </View>
      </View>
      {notes.map((note) => <AppText key={note} variant="brandSubtitle" tone="muted">{note}</AppText>)}
      {!!view.errorText && <AppText variant="brandSubtitle" tone="error">{view.errorText}</AppText>}
      {(!next || !!error) && !!view.updateText && <AppText variant="brandSubtitle" tone="muted">{view.updateText}</AppText>}
      {target.repeatedStop && <AppText variant="brandSubtitle" tone="muted">{eta.repeatedStop}</AppText>}
      <View style={styles.routeFooter}>
        <Icon name="mappin" size={15} />
        <AppText variant="brandSubtitle" tone="muted" style={styles.copy}>
          {copy.nearbyBus.boardingStop(name, distance)}
        </AppText>
        <View style={styles.routeLink}>
          <AppText variant="caption" tone="primary" style={styles.shrink}>{copy.nearbyBus.viewRoute}</AppText>
          <Icon name="chevron.right" size={12} />
        </View>
      </View>
    </Pressable>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <View style={styles.note} accessibilityRole="progressbar">
      <ActivityIndicator color={colors.primary} />
      <AppText variant="detail" tone="muted" style={styles.copy}>{label}</AppText>
    </View>
  );
}

function ListAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress}
      style={({ pressed }) => [styles.panel, styles.listAction, pressed && styles.pressed]}>
      <AppText variant="detail" tone="primary">{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: homeLayout.gutter, paddingTop: space.lg, gap: space.sm },
  header: { gap: space.md },
  panel: { backgroundColor: colors.surface, borderRadius: radius.media, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
  reference: { paddingHorizontal: space.md, paddingTop: space.md },
  referenceRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingBottom: space.sm },
  copy: { flex: 1, minWidth: 0, gap: space.xs },
  shrink: { flexShrink: 1 },
  locationButton: {
    minHeight: touchTarget, maxWidth: '50%', flexDirection: 'row', alignItems: 'center', gap: space.xs,
    paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.primarySoft,
  },
  action: { minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  landmark: { minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md },
  selected: { backgroundColor: colors.tint, borderRadius: radius.media },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  heading: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.xs },
  segment: { flexDirection: 'row', gap: space.xs, borderRadius: radius.pill, padding: space.xs, backgroundColor: colors.tint },
  segmentOption: {
    flex: 1, minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: space.xs, paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.pill,
  },
  segmentSelected: { backgroundColor: colors.primary },
  radiusControl: { minHeight: touchTarget, maxWidth: '45%', flexDirection: 'row', alignItems: 'center', gap: space.xs },
  routeCard: { padding: space.md, gap: space.sm },
  routeMain: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  routeBadge: {
    minWidth: 40, maxWidth: '24%', minHeight: 36, justifyContent: 'center', paddingHorizontal: space.sm,
    paddingVertical: space.xs, backgroundColor: colors.primary, borderRadius: radius.control,
  },
  badgeText: { textAlign: 'center' },
  arrivals: { maxWidth: '32%', flexShrink: 1, alignItems: 'flex-end', gap: space.xs },
  arrivalText: { textAlign: 'right', fontVariant: ['tabular-nums'] },
  routeFooter: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  routeLink: { maxWidth: '34%', flexDirection: 'row', alignItems: 'center', gap: space.xs },
  stop: { minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md },
  stopIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tint, borderRadius: radius.control },
  distance: { flexShrink: 1, fontVariant: ['tabular-nums'] },
  groupDistance: { maxWidth: '35%', textAlign: 'right' },
  stopChoice: { padding: space.md, gap: space.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  stopChoiceHeading: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  listAction: { minHeight: touchTarget, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
  pressed: { opacity: 0.76 },
});
