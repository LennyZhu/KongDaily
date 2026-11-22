import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, FlatList, Keyboard, Linking, Pressable, StyleSheet, View, type ViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { describeEta, etaEntryNotes, etaIsStale } from '@/bus-eta';
import { limitedServiceTimetable } from '@/bus-limited-service';
import { useBusCatalogue } from '@/bus-hooks';
import { busSources, normalizeBusQuery, routePlaceName, type BusRoute } from '@/bus-routes';
import { routeStopKey } from '@/bus-stops';
import { BusRouteRow } from '@/components/bus-ui';
import { GmbNearbyRouteCard, GmbNearbyStopCard } from '@/components/gmb-nearby-rows';
import { GmbSearchNotice } from '@/components/gmb-status';
import { GlobalSearchResultRow } from '@/components/global-search-result-row';
import { LightRailEntryRow } from '@/components/light-rail-ui';
import { MtrEntryRow } from '@/components/mtr-ui';
import { TransportSearch, TransportModePicker, TransportUnavailable, type TransportMode } from '@/components/transport-ui';
import { AppText, EmptyState, Icon } from '@/components/ui';
import { loadGlobalBusStops, railwaySearchResult, searchTransport, type BusStopSearchResult, type GlobalBusStopsState, type GmbRouteSearchResult } from '@/global-search';
import { searchResultDestination } from '@/global-search-navigation';
import { gmbSearchCode } from '@/gmb-search';
import { useGmbSearch } from '@/gmb-query-hooks';
import { useLanguage } from '@/language';
import type { LightRailEntry } from '@/light-rail-static';
import type { MtrEntry } from '@/mtr-static';
import {
  kmbNearbyNeedsRefresh, prepareNearbyBusIndex, readNearbyBusStops, refreshKmbNearbyStops,
  type BusSearchRadius, type Coordinates, type NearbyBusStop,
} from '@/nearby-bus-data';
import { formatAdultBusFare, readAdultBusFare } from '@/nearby-bus-fares';
import { nearbyBusLandmarks, type NearbyLandmark } from '@/nearby-bus-landmarks';
import { gmbNearbySnapshotDate, nearbyGmbRows, searchGmbStopNames, type GmbNearbyRouteRow, type GmbNearbyStopRow } from '@/nearby-gmb';
import { locateNearbyBusStops, type NearbyLocationIssue } from '@/nearby-bus-location';
import { nearbyRailwayRows, type NearbyRailwayRow } from '@/nearby-railway';
import { useStationEta } from '@/nearby-stop-eta-hooks';
import { groupNearbyStops, type NearbyStopGroup } from '@/nearby-stop-groups';
import { nearbyRouteHref, readNearbyRoutes, readStationRoutes, type NearbyRoute, type StationEtaRecord, type StationRoute } from '@/nearby-stop-routes';
import { colors, floatingTab, homeLayout, radius, space, touchTarget } from '@/theme';
import { useTransportListPosition } from '@/transport-list-position';

type Reference = { kind: 'current'; point: Coordinates } | { kind: 'landmark'; landmark: NearbyLandmark; point: Coordinates };
type Results = { reference: Reference; radius: BusSearchRadius; stops?: NearbyBusStop[]; routes?: NearbyRoute[] | 'error' };
type Mode = 'routes' | 'stops';
type NearbyItem = NearbyRoute | NearbyStopGroup;
type ListItem = NearbyItem | BusRoute | MtrEntry | LightRailEntry | NearbyRailwayRow | BusStopSearchResult | GmbRouteSearchResult | GmbNearbyRouteRow | GmbNearbyStopRow;
const emptyRoutes: NearbyRoute[] = [];
const emptyStops: NearbyBusStop[] = [];
const emptySearchResults: BusRoute[] = [];
const emptyGmbNearby: (GmbNearbyRouteRow | GmbNearbyStopRow)[] = [];
const viewability = { itemVisiblePercentThreshold: 35, minimumViewTime: 250 };
const radii = [500, 1000, 2000] as const;

function browseKey(item: ListItem) {
  if ('kind' in item && (item.kind === 'bus_stop' || item.kind === 'gmb_route')) return item.key;
  if ('kind' in item && (item.kind === 'nearby-gmb-route' || item.kind === 'nearby-gmb-stop')) return item.kind + ':' + item.id;
  if ('kind' in item && item.kind !== 'nearby-railway') return railwaySearchResult(item).key;
  if ('kind' in item) return `${item.kind}:${item.id}`;
  if ('number' in item) return `bus_route:${item.id}`;
  // A location refresh can change the recommended stop while the service stays the same.
  return 'route' in item ? routeStopKey(item.route.target) : item.id;
}

function nearbyDistance(item: NearbyItem | NearbyRailwayRow) {
  return 'kind' in item ? item.location.distance : 'route' in item ? item.stop.distance : item.stops[0].distance;
}

export default function NearbyBusScreen({ transport = false, addFrequentRoute = false }: {
  transport?: boolean; addFrequentRoute?: boolean;
} = {}) {
  const { copy, locale } = useLanguage();
  const router = useRouter();
  const labels = copy.nearbyBus;
  const { bottom } = useSafeAreaInsets();
  const [reference, setReference] = useState<Reference>();
  const [referenceRevision, setReferenceRevision] = useState(0);
  const [transportMode, setTransportMode] = useState<TransportMode>(addFrequentRoute ? 'bus' : 'all');
  const [focusSearchOnMount, setFocusSearchOnMount] = useState(addFrequentRoute);
  const [query, setQuery] = useState('');
  const [catalogueRequested, setCatalogueRequested] = useState(false);
  const [busSearchStops, setBusSearchStops] = useState<GlobalBusStopsState>({ status: 'not_loaded' });
  const listRef = useRef<FlatList<ListItem>>(null);
  const catalogue = useBusCatalogue(transport && catalogueRequested);
  const [mode, setMode] = useState<Mode>('routes');
  const [mtrView, setMtrView] = useState<Mode>('routes');
  const [lightRailView, setLightRailView] = useState<Mode>('routes');
  const [minibusView, setMinibusView] = useState<Mode>('routes');
  const [expandedGmbStop, setExpandedGmbStop] = useState<{ scope: string; id: string }>();
  const [expandedStopGroups, setExpandedStopGroups] = useState<Set<string>>(() => new Set());
  const [radiusMeters, setRadiusMeters] = useState<BusSearchRadius>(500);
  const [pickingRadius, setPickingRadius] = useState(false);
  const [showDistanceInfo, setShowDistanceInfo] = useState(false);
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

  const refreshingCurrent = transport && reference?.kind === 'current' && result?.reference.kind === 'current'
    && !!result.stops && (mode === 'stops' || Array.isArray(result.routes));
  const resultForRadius = result && result.radius === radiusMeters && (result.reference === reference || refreshingCurrent)
    ? result : undefined;
  const stops = resultForRadius?.stops ?? emptyStops;
  const showBuses = transportMode === 'all' || transportMode === 'bus';
  const mtrMode = transport && transportMode === 'mtr';
  const lightRailMode = transport && transportMode === 'lightRail';
  const minibusMode = transport && transportMode === 'minibus';
  const railCopy = mtrMode ? copy.mtr : lightRailMode ? copy.lightRail : undefined;
  const normalizedQuery = normalizeBusQuery(query);
  const searching = transport && (showBuses || Boolean(railCopy) || minibusMode) && normalizedQuery.length > 0;
  const showingNearby = showBuses || Boolean(railCopy) || minibusMode;
  const needsNearbyLocation = showingNearby && !searching;
  const searchingBuses = searching && showBuses;
  const gmb = useGmbSearch(query, searching && (minibusMode || transportMode === 'all'), 250);
  const gmbNameSearch = minibusMode && searching && !gmbSearchCode(query);
  const gmbStops = useMemo(() => gmbNameSearch ? searchGmbStopNames(query) : [], [gmbNameSearch, query]);
  const mixedSearch = searching && transportMode === 'all';
  const searchRoutes = useMemo(() => busSources.flatMap((source) => catalogue.feeds[source]?.routes ?? []), [catalogue.feeds]);
  useEffect(() => {
    if (!searchingBuses || busSearchStops.status !== 'not_loaded') return;
    let active = true;
    void loadGlobalBusStops().then((state) => { if (active) setBusSearchStops(state); });
    return () => { active = false; };
  }, [searchingBuses, busSearchStops.status]);
  const transportMatches = useMemo(() => searchTransport(searching ? normalizedQuery : '', {
    busCatalogue: catalogue, busStops: busSearchStops, gmb: gmb.state, surface: 'transport',
    mode: minibusMode ? 'minibus' : mtrMode ? 'mtr' : lightRailMode ? 'lightRail' : transportMode === 'bus' ? 'bus' : undefined,
  }), [searching, normalizedQuery, catalogue.feeds, catalogue.loading, catalogue.failed, busSearchStops, gmb.state, minibusMode, mtrMode, lightRailMode, transportMode]);
  const busResults = transportMatches.routes.bus?.results ?? emptySearchResults;
  const stopSearch = transportMatches.stops.bus;
  const searchResults = useMemo(() => [...transportMatches.routes.results, ...transportMatches.stops.results]
    .map((result) => result.kind === 'bus_route' ? result.route : (result.kind === 'bus_stop' || result.kind === 'gmb_route') ? result : result.entry), [transportMatches]);
  const searchFailed = busSources.some((source) => catalogue.failed[source]);
  const gmbSearchIncomplete = gmb.state?.status === 'failed' || gmb.state?.status === 'partial';
  const mixedEmptyTitle = gmbSearchIncomplete ? copy.search.emptyAvailable
    : searchFailed ? copy.transport.noRailMatches : copy.transport.noMatches;
  const showSearchCount = (minibusMode && gmb.state?.status === 'ready') || Boolean(railCopy) || (mixedSearch
    ? searchResults.length > 0 || (!catalogue.loading && !searchFailed)
    : searchResults.length > 0 || (searchRoutes.length > 0 && !catalogue.loading));
  const stopGroups = useMemo(() => showBuses && mode === 'stops' ? groupNearbyStops(stops) : [], [mode, showBuses, stops]);
  const routeResult = resultForRadius?.routes;
  const routeRows = showBuses && !searching && mode === 'routes' && Array.isArray(routeResult) ? routeResult : emptyRoutes;
  const view = minibusMode ? minibusView : mtrMode ? mtrView : lightRailMode ? lightRailView : mode;
  // During a passive refresh, All keeps rail and the still-visible bus results on the same reference point.
  const nearbyReference = showBuses && resultForRadius ? resultForRadius.reference : reference;
  const railRows = useMemo(() => transport && !searching && nearbyReference
    && (transportMode === 'all' || mtrMode || lightRailMode)
    ? nearbyRailwayRows(nearbyReference.point, radiusMeters, view, mtrMode ? 'mtr' : lightRailMode ? 'lightRail' : undefined) : [],
  [transport, searching, nearbyReference, transportMode, mtrMode, lightRailMode, radiusMeters, view]);
  const gmbNearbyRows = useMemo(() => minibusMode && !searching && reference
    ? nearbyGmbRows(reference.point, radiusMeters, minibusView) : emptyGmbNearby, [minibusMode, searching, reference, radiusMeters, minibusView]);
  const nearbyRows = useMemo(() => {
    if (minibusMode) return gmbNearbyRows;
    const buses = mode === 'routes' ? routeRows : stopGroups;
    if (!transport || transportMode === 'bus') return buses;
    if (transportMode !== 'all') return railRows;
    return [...buses, ...railRows].sort((a, b) => nearbyDistance(a) - nearbyDistance(b) || browseKey(a).localeCompare(browseKey(b)));
  }, [transport, transportMode, mode, routeRows, stopGroups, railRows, minibusMode, gmbNearbyRows]);
  const rows = gmbNameSearch ? gmbStops : searching ? searchResults : nearbyRows;
  const mixedNearby = transport && transportMode === 'all' && !searching;
  const nearbyScope = `${view}:${referenceRevision}:${radiusMeters}`;
  const contentScope = searching ? 'search' : nearbyScope;
  const listScope = transport ? `${transportMode}:${contentScope}` : nearbyScope;
  const browseScope = searching ? `${listScope}:${normalizedQuery}` : listScope;
  const { recordVisible, scrollProps } = useTransportListPosition<ListItem>(transport, browseScope, rows, listRef, browseKey);
  const etaRoutes = useMemo(() => routeRows.map(({ route }) => route), [routeRows]);
  const { records, now, rateLimits, setVisible } = useStationEta(etaRoutes, locale);
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken<ListItem>[] }) => {
    if (transport) recordVisible(viewableItems);
    setVisible(viewableItems.flatMap(({ item }) => 'route' in item ? [item.route.id] : []));
  }, [recordVisible, setVisible, transport]);

  const updateReference = useCallback((value: Reference, resetRadius: boolean) => {
    if (!transport || resetRadius) {
      setVisible([]);
      setPickingRadius(false);
      setReferenceRevision((revision) => revision + 1);
    }
    if (resetRadius) {
      setRadiusMeters(500);
      if (transport) setResult(undefined);
    }
    setReference(value);
  }, [setVisible, transport]);

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
    if (!transport || allowPermissionPrompt) {
      setPickingRadius(false);
      setReference((previous) => previous?.kind === 'current' ? undefined : previous);
    }

    const location = await locateNearbyBusStops(controller.signal, allowPermissionPrompt);
    if (locationRequest.current !== controller) return;
    locationRequest.current = null;
    setLocating(false);

    if (location.kind === 'position') {
      landmarkSelected.current = false;
      updateReference({ kind: 'current', point: location.point }, allowPermissionPrompt);
    } else if (location.kind !== 'cancelled') {
      if (transport && !allowPermissionPrompt) {
        setReference((previous) => previous?.kind === 'current' ? undefined : previous);
      }
      setLocationIssue(location.kind);
    }
  }, [transport, updateReference]);

  useFocusEffect(useCallback(() => {
    setLocating(false);
    if (!needsNearbyLocation) return;

    function resumeLocation() {
      locationActive.current = true;
      void requestLocation(false);
    }

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
  }, [cancelLocation, needsNearbyLocation, requestLocation]));

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
  const range = formatDistance(radiusMeters);
  const locateAction = (
    <Pressable accessibilityRole="button" accessibilityLabel={labels.useLocation}
      accessibilityState={{ disabled: locating, busy: locating }} disabled={locating}
      onPress={() => void requestLocation(true)}
      style={({ pressed }) => [styles.locationButton, transport && styles.compactLocationAction, pressed && styles.pressed]}>
      {locating ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon name="location" size={14} />}
      <AppText variant="caption" tone="primary" style={styles.shrink}>{labels.useLocation}</AppText>
    </Pressable>
  );
  const landmarkAction = (
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: picking }}
      onPress={() => setPicking((open) => !open)}
      style={({ pressed }) => [
        transport ? [styles.locationButton, styles.compactLocationAction] : styles.action, pressed && styles.pressed,
      ]}>
      <Icon name="mappin" size={15} />
      <AppText variant={transport ? 'caption' : 'detail'} tone="primary" style={transport ? styles.shrink : styles.copy}>
        {transport ? copy.transport.chooseLandmark : labels.chooseLandmark}
      </AppText>
      <Icon name={picking ? 'chevron.up' : 'chevron.down'} size={12} />
    </Pressable>
  );
  const landmarkPicker = picking && (
    <View style={styles.panel}>
      {Object.keys(nearbyBusLandmarks).map((key) => {
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
  );
  const locationIssueNote = locationIssue && (
    <View style={styles.note}>
      <Icon name="exclamationmark.circle" size={16} />
      <AppText variant="detail" tone="muted" accessibilityRole="alert" style={styles.copy}>{labels.issues[locationIssue]}</AppText>
    </View>
  );
  const showLocationAction = !locating && (!reference || picking || !!locationIssue);
  const distanceNote = (
    <View style={styles.note}>
      <Icon name="info.circle" color={colors.muted} size={14} />
      <View style={styles.copy}>
        <AppText variant="brandSubtitle" tone="muted">{labels.distanceNote}</AppText>
        {showBuses && <AppText variant="brandSubtitle" tone="muted">
          {mode === 'routes' ? labels.routeCoverage : labels.partialCoverage}
        </AppText>}
        {minibusMode && showDistanceInfo && (
          <AppText variant="brandSubtitle" tone="muted">{copy.minibus.snapshot(gmbNearbySnapshotDate())}</AppText>
        )}
        {transport && transportMode !== 'bus' && !minibusMode && <>
          <AppText variant="brandSubtitle" tone="muted">{copy.transport.railDistanceNote}</AppText>
          <AppText variant="brandSubtitle" tone="muted">{copy.transport.railGeoCredit}</AppText>
        </>}
      </View>
    </View>
  );
  const radiusControl = reference && (
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: pickingRadius }}
      onPress={() => setPickingRadius((open) => !open)}
      style={[styles.radiusControl, transport && styles.transportRadiusControl]}>
      <AppText variant="caption" tone="primary" style={styles.shrink}>
        {transport ? copy.transport.straightLineRadius(range) : labels.radius(range)}
      </AppText>
      <Icon name={pickingRadius ? 'chevron.up' : 'chevron.down'} size={11} />
    </Pressable>
  );

  function editQuery(value: string) {
    const next = normalizeBusQuery(value);
    if (next) {
      if (showBuses) setCatalogueRequested(true);
      if (searching && next !== normalizedQuery) listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }
    setQuery(value);
  }

  function selectTransport(next: TransportMode) {
    setTransportMode(next);
    if (next !== 'all' && next !== 'bus') {
      setFocusSearchOnMount(false);
      if (next !== 'mtr' && next !== 'lightRail') Keyboard.dismiss();
    } else if (normalizedQuery) {
      setCatalogueRequested(true);
    }
  }

  const list = (
    <FlatList<ListItem>
      ref={listRef}
      key={listScope}
      {...scrollProps}
      style={transport ? [styles.screen, styles.transportScreen] : styles.screen}
      contentContainerStyle={[styles.content, transport && styles.transportContent, searchingBuses && styles.searchContent,
        { paddingBottom: bottom + space.section }]}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustKeyboardInsets={transport}
      keyboardShouldPersistTaps={transport ? 'handled' : undefined}
      keyboardDismissMode={transport ? 'on-drag' : undefined}
      data={rows}
      keyExtractor={(item) => 'route' in item ? item.route.id : browseKey(item)}
      viewabilityConfig={viewability}
      onViewableItemsChanged={onViewableItemsChanged}
      renderItem={({ item }) => {
        if ('kind' in item && item.kind === 'nearby-gmb-route') {
          return <GmbNearbyRouteCard row={item} distance={formatDistance(item.distance)} />;
        }
        if ('kind' in item && item.kind === 'nearby-gmb-stop') {
          const expanded = expandedGmbStop?.scope === browseScope && expandedGmbStop.id === item.id;
          return <GmbNearbyStopCard row={item} distance={item.distance === undefined ? undefined : formatDistance(item.distance)}
            expanded={expanded} onToggle={() => setExpandedGmbStop(expanded ? undefined : { scope: browseScope, id: item.id })} />;
        }
        if ('kind' in item && item.kind === 'gmb_route') return <GlobalSearchResultRow result={item} first last onPress={() => {
          const target = searchResultDestination(item);
          if ('href' in target) {
            Keyboard.dismiss();
            router.push(target.href);
          }
        }} />;
        if ('kind' in item && item.kind === 'bus_stop') return <GlobalSearchResultRow result={item} first last onPress={() => {
          Keyboard.dismiss();
          router.push({ pathname: '/bus/nearby/stop', params: { source: item.source, stopId: item.stopId } });
        }} />;
        if ('kind' in item && item.kind === 'nearby-railway') {
          const distance = (item.location.position.kind === 'entrance' ? copy.transport.entranceDistance : copy.transport.referenceDistance)(
            formatDistance(item.location.distance));
          const row = item.boarding.kind === 'mtr-station' && (item.entry.kind === 'mtr-line' || item.entry.kind === 'mtr-station')
            ? <MtrEntryRow entry={item.entry} nearby={{ boarding: item.boarding, distance }} />
            : item.boarding.kind === 'light-rail-stop' && (item.entry.kind === 'light-rail-route' || item.entry.kind === 'light-rail-stop')
              ? <LightRailEntryRow entry={item.entry} nearby={{ boarding: item.boarding, distance }} /> : null;
          return mixedNearby ? <View style={styles.mixedRailRow}>{row}</View> : row;
        }
        if ('kind' in item) {
          const row = item.kind === 'light-rail-route' || item.kind === 'light-rail-stop'
            ? <LightRailEntryRow entry={item} /> : <MtrEntryRow entry={item} />;
          return mixedSearch ? <View style={styles.mixedRailRow}>{row}</View> : row;
        }
        if ('number' in item) {
          return <BusRouteRow copy={copy.bus} locale={locale} route={item} modeLabel={mixedSearch ? copy.transport.modes.bus : undefined} onPress={() => {
            Keyboard.dismiss();
            router.push({ pathname: '/bus/route', params: { routeId: item.id } });
          }} />;
        }
        if ('route' in item) {
          return <RouteCard recommendation={item} distance={formatDistance(item.stop.distance)}
            modeLabel={mixedNearby ? copy.transport.modes.bus : undefined}
            record={records[item.route.id]} fallbackError={rateLimits[item.route.target.source]} now={now}
            onPress={() => router.push(nearbyRouteHref(item.route.target))} />;
        }
        return <StopGroupCard group={item} expanded={expandedStopGroups.has(item.id)}
          modeLabel={mixedNearby ? copy.transport.modes.bus : undefined}
          formatDistance={formatDistance} onOpen={openStop} onToggle={() => toggleStopGroup(item.id)} />;
      }}
      ListHeaderComponent={searching ? (
        <View style={[styles.transportHeader, searchingBuses && styles.searchFeedback]}>
          <AppText variant="homeHeading" accessibilityRole="header">
            {minibusMode ? (gmbNameSearch ? copy.search.groups.transport_stop : copy.minibus.results) : railCopy?.results ?? (mixedSearch ? copy.transport.searchResults : copy.transport.busResults)}
          </AppText>
          <GmbSearchNotice state={gmb.state} retry={gmb.retry} />
          {(gmbNameSearch || showSearchCount) && (
            <AppText variant="detail" tone="muted">{copy.bus.resultCount(rows.length)}</AppText>
          )}
          {searchingBuses && catalogue.loading && busResults.length === 0 && <Loading label={copy.bus.loading} />}
          {searchingBuses && busSearchStops.status === 'not_loaded' && <Loading label={copy.search.stopsLoading} />}
          {searchingBuses && busSearchStops.status === 'failed' && <>
            <AppText variant="detail" tone="muted" accessibilityRole="alert">{copy.search.stopsFailed}</AppText>
            <ListAction label={copy.bus.retry} onPress={() => setBusSearchStops({ status: 'not_loaded' })} />
          </>}
          {searchingBuses && stopSearch?.hasMore && <AppText variant="detail" tone="muted">
            {copy.transport.stopSearchCount(stopSearch.results.length, stopSearch.totalMatches)}
          </AppText>}
          {searchingBuses && searchFailed && (
            <>
              <AppText variant="detail" tone="muted" accessibilityRole="alert">
                {searchRoutes.length ? copy.bus.updateFailed : copy.bus.loadFailed}
              </AppText>
              {!catalogue.loading && <ListAction label={copy.bus.retry} onPress={catalogue.retry} />}
            </>
          )}
        </View>
      ) : (
        <View style={[styles.header, transport && styles.transportHeader]}>
          {addFrequentRoute && transportMode === 'bus' && (
            <AppText variant="detail" tone="muted">{copy.transport.addFrequentHint}</AppText>
          )}
          {!transport && showBuses && <View style={[styles.panel, styles.reference]}>
            <View style={styles.referenceRow}>
              <View style={styles.copy}>
                <AppText variant="caption" tone="muted">{labels.reference}</AppText>
                <AppText variant="homeCardTitle" accessibilityLiveRegion="polite">
                  {locating ? labels.locating : referenceName}
                </AppText>
              </View>
              {locateAction}
            </View>
            {landmarkAction}
          </View>}
          {showBuses && !transport && landmarkPicker}
          {showBuses && !transport && locationIssueNote}
          {showBuses && !transport && refreshFailed && <AppText variant="detail" tone="muted" accessibilityRole="alert">{labels.refreshFailed}</AppText>}
          {showBuses && !transport && distanceNote}
          {(showBuses || railCopy || minibusMode) && <View accessibilityRole="tablist" style={[styles.segment, transport && styles.transportSegment]}>
            {(['routes', 'stops'] as const).map((option) => {
              const selected = view === option;
              const tone = selected ? (transport ? 'primary' : 'onPrimary') : (transport ? 'muted' : 'primary');
              return (
                <Pressable key={option} accessibilityRole="tab" accessibilityState={{ selected }}
                  onPress={() => {
                    if (selected) return;
                    if (minibusMode) {
                      setMinibusView(option);
                      return;
                    }
                    if (mtrMode) {
                      setMtrView(option);
                      return;
                    }
                    if (lightRailMode) {
                      setLightRailView(option);
                      return;
                    }
                    setVisible([]);
                    setMode(option);
                  }}
                  style={({ pressed }) => [styles.segmentOption, selected && (transport ? styles.transportSegmentSelected : styles.segmentSelected),
                    pressed && styles.pressed]}>
                  <Icon name={option === 'routes' ? (mtrMode ? 'tram.fill.tunnel' : lightRailMode ? 'train.side.front.car' : minibusMode ? 'bus.fill' : 'bus') : 'mappin'}
                    size={16} color={colors[tone]} />
                  <AppText variant="detail" tone={tone} style={styles.shrink}>
                    {option === 'routes' ? labels.byRoute : labels.byStop}
                  </AppText>
                </Pressable>
              );
            })}
          </View>}
          {showingNearby && <View style={[styles.heading, transport && styles.transportHeading]}>
            <AppText variant="homeHeading" accessibilityRole="header" style={[styles.copy, transport && styles.transportHeadingTitle]}>
              {transport && transportMode !== 'bus' ? (view === 'routes' ? copy.transport.nearbyRoutes : copy.transport.nearbyStops)
                : mode === 'routes' ? labels.routes : labels.stops}
            </AppText>
            {transport ? (
              <View style={styles.headingActions}>
                {radiusControl}
                <Pressable accessibilityRole="button" accessibilityLabel={copy.transport.distanceInfo}
                  accessibilityState={{ expanded: showDistanceInfo }} onPress={() => setShowDistanceInfo((open) => !open)}
                  style={({ pressed }) => [styles.infoButton, pressed && styles.pressed]}>
                  <Icon name="info.circle" size={18} />
                </Pressable>
                {!!reference && (
                  <Pressable accessibilityRole="button" accessibilityLabel={copy.transport.changeReference}
                    accessibilityState={{ expanded: picking }} onPress={() => setPicking((open) => !open)}
                    style={({ pressed }) => [styles.infoButton, pressed && styles.pressed]}>
                    <Icon name="ellipsis" size={18} />
                  </Pressable>
                )}
              </View>
            ) : radiusControl}
          </View>}
          {showingNearby && transport && showDistanceInfo && distanceNote}
          {showingNearby && pickingRadius && (
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
          {showingNearby && transport && (
            <>
              {reference?.kind === 'landmark' && <AppText variant="caption" tone="muted">{referenceName}</AppText>}
              {locating && reference?.kind !== 'current' ? <Loading label={copy.transport.locating} /> : locationIssueNote}
              {!reference && !locating && !locationIssue && <AppText variant="detail" tone="muted">{labels.noReference}</AppText>}
              {(!reference || showLocationAction) && (
                <View style={styles.positionActions}>
                  {showLocationAction && (locationIssue === 'blocked' ? (
                    <Pressable accessibilityRole="button" onPress={() => {
                      void Linking.openSettings().catch(() => Alert.alert(copy.transport.settingsUnavailable));
                    }} style={({ pressed }) => [styles.locationButton, styles.compactLocationAction, pressed && styles.pressed]}>
                      <Icon name="gearshape" size={14} />
                      <AppText variant="caption" tone="primary" style={styles.shrink}>{copy.transport.openSettings}</AppText>
                    </Pressable>
                  ) : locateAction)}
                  {!reference && landmarkAction}
                </View>
              )}
              {landmarkPicker}
              {showBuses && refreshFailed && <AppText variant="detail" tone="muted" accessibilityRole="alert">{labels.refreshFailed}</AppText>}
              {mixedNearby && rows.length > 0 && (index === 'loading' ? <Loading label={labels.preparing} />
                : index === 'error' || (resultForRadius && !resultForRadius.stops) || (mode === 'routes' && routeResult === 'error')
                  ? <>
                    <AppText variant="detail" tone="muted" accessibilityRole="alert">{routeResult === 'error' ? labels.routeIndexError : labels.indexError}</AppText>
                    <ListAction label={copy.bus.retry} onPress={() => {
                      setVisible([]); setResult(undefined); setReload((value) => value + 1);
                    }} />
                  </> : null)}
            </>
          )}
        </View>
      )}
      ListEmptyComponent={minibusMode && searching ? (
        gmbNameSearch || gmb.state?.status === 'ready'
          ? <EmptyState icon="magnifyingglass" title={gmbNameSearch ? copy.minibus.noStopMatches : copy.minibus.noMatches} />
          : null
      ) : searching ? (
        gmb.state?.status !== 'loading' && (railCopy || (!catalogue.loading && (mixedSearch || searchRoutes.length > 0))) ? (
          <View style={searchingBuses && styles.searchFeedback}>
            <EmptyState icon="magnifyingglass"
              title={railCopy?.noMatches ?? (mixedSearch ? mixedEmptyTitle : copy.transport.noBusMatches)}
              detail={transportMode === 'bus' ? copy.bus.searchHint : undefined} />
          </View>
        ) : null
      ) : !showingNearby ? <TransportUnavailable copy={copy.transport} mode={transportMode} /> : transport && !reference ? null
          : (railCopy || minibusMode) ? <View style={styles.header}>
            <EmptyState icon={minibusMode ? 'bus.fill' : mtrMode ? 'tram.fill.tunnel' : 'train.side.front.car'}
              title={(view === 'routes' ? copy.transport.noNearbyRoutes : copy.transport.noNearbyStops)(range)} detail={copy.transport.nearbyHint} />
            {!!expandedRadius && <ListAction label={labels.expand(formatDistance(expandedRadius))} onPress={() => updateRadius(expandedRadius)} />}
          </View> : (
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
                      title={mixedNearby ? (view === 'routes' ? copy.transport.noNearbyRoutes : copy.transport.noNearbyStops)(range)
                        : mode === 'routes' ? labels.noRoutes(formatDistance(radiusMeters)) : labels.noStops(formatDistance(radiusMeters))}
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
  if (!transport) return list;
  return (
    <View style={styles.transportPage}>
      <View style={styles.transportControls}>
        {(showBuses || railCopy || minibusMode) && (
          <TransportSearch label={minibusMode ? copy.minibus.nearbySearch : railCopy?.search ?? (transportMode === 'all' ? copy.transport.searchAll : copy.transport.searchBuses)}
            clearLabel={copy.bus.clearInput} cancelLabel={copy.bus.cancel} query={query} onChange={editQuery}
            autoFocus={focusSearchOnMount} />
        )}
        <TransportModePicker copy={copy.transport} selected={transportMode} onSelect={selectTransport} />
      </View>
      {list}
    </View>
  );
}

function StopGroupCard({ group, expanded, formatDistance, onOpen, onToggle, modeLabel }: {
  group: NearbyStopGroup;
  expanded: boolean;
  formatDistance: (distance: number) => string;
  onOpen: (stop: NearbyBusStop) => void;
  onToggle: () => void;
  modeLabel?: string;
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
            {modeLabel && `${modeLabel} · `}
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

function RouteCard({ recommendation, distance, record, fallbackError, now, onPress, modeLabel }: {
  recommendation: NearbyRoute;
  distance: string;
  record?: StationEtaRecord;
  fallbackError?: StationEtaRecord['error'];
  now: number;
  onPress: () => void;
  modeLabel?: string;
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
  const status = view.status === eta.stale ? eta.stale
    : error ? eta.failed
      : shared ? copy.busStation.sharedForecast
        : view.status === eta.loading ? copy.nearbyBus.loadingForecast : copy.nearbyBus.noArrivalEstimate;
  const countdown = (minutes: number) => minutes === 0 ? eta.due : `${eta.minutes.prefix}${minutes}${eta.minutes.suffix}`;
  const notes = [...new Set([next && etaEntryNotes(next, locale), ...view.notices].filter(Boolean))];
  const fare = readAdultBusFare(target, now);

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
            {modeLabel && `${modeLabel} · `}
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
      {fare && (
        <AppText variant="brandSubtitle" tone="muted">
          {copy.nearbyBus.adultFare[fare.scope](formatAdultBusFare(fare.cents))}
        </AppText>
      )}
      {limitedServiceTimetable(target) && (
        <AppText variant="brandSubtitle" tone="muted">{copy.busDetail.limitedService}</AppText>
      )}
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
  transportScreen: { backgroundColor: colors.tintedBackground },
  transportPage: { flex: 1, backgroundColor: colors.tintedBackground },
  transportControls: { paddingHorizontal: homeLayout.gutter, paddingTop: space.xs, gap: space.sm },
  content: { paddingHorizontal: homeLayout.gutter, paddingTop: space.lg, gap: space.sm },
  transportContent: { paddingTop: space.sm },
  searchContent: { paddingHorizontal: 0, gap: 0 },
  searchFeedback: { paddingHorizontal: homeLayout.gutter, paddingBottom: space.sm },
  mixedRailRow: { paddingHorizontal: homeLayout.gutter, paddingBottom: space.sm },
  header: { gap: space.md },
  transportHeader: { gap: space.sm },
  panel: { backgroundColor: colors.surface, borderRadius: radius.media, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
  reference: { paddingHorizontal: space.md, paddingTop: space.md },
  referenceRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingBottom: space.sm },
  positionActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  compactLocationAction: { minWidth: touchTarget, maxWidth: '100%' },
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
  transportHeading: { flexWrap: 'wrap', columnGap: space.sm, rowGap: space.xs },
  transportHeadingTitle: { flexBasis: 112 },
  headingActions: { marginLeft: 'auto', maxWidth: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  infoButton: { minHeight: touchTarget, minWidth: touchTarget, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', gap: space.xs, borderRadius: radius.pill, padding: space.xs, backgroundColor: colors.tint },
  segmentOption: {
    flex: 1, minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: space.xs, paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.pill,
  },
  segmentSelected: { backgroundColor: colors.primary },
  transportSegment: { backgroundColor: floatingTab.background },
  transportSegmentSelected: { backgroundColor: floatingTab.selected },
  radiusControl: { minHeight: touchTarget, maxWidth: '45%', flexDirection: 'row', alignItems: 'center', gap: space.xs },
  transportRadiusControl: { maxWidth: '100%' },
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
