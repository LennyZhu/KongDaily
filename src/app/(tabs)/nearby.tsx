import { useFocusEffect, useLocalSearchParams, useNavigation, useRoute, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, FlatList, Linking, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { Region } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FacilityDetails, FacilitySelectionCard, FacilityServiceNotice, PetGardenTypeBadge, SharedPetRules, facilityDistance, facilityPlace } from '@/components/facility-selection-card';
import { facilityVisuals, NearbyFacilitiesMap, type NearbyFacilitiesMapHandle } from '@/components/nearby-facilities-map';
import { NearbySearchSheet } from '@/components/nearby-search-sheet';
import { AppText, Icon } from '@/components/ui';
import { loadFacilityFavorites } from '@/facility-favorite-hooks';
import { resolveStableFacilityIdentity } from '@/facility-identity';
import { facilityCategories, facilityFilter, facilityId, facilityText, facilityTextUsesFallback, facilityType, indexNearbyFacilities, nearbyFacilities, nearbyFacilitySources, petFacilityType,
  type FacilityFilter, type NearbyFacility } from '@/facilities';
import type { Messages } from '@/i18n';
import { useLanguage } from '@/language';
import { isNearHongKong, type Coordinates } from '@/nearby-bus-data';
import { nearbyBusLandmarks } from '@/nearby-bus-landmarks';
import { locateNearbyBusStops, type NearbyLocationIssue } from '@/nearby-bus-location';
import { regionAroundFacility } from '@/nearby-map-motion';
import type { NearbySearchResult } from '@/nearby-place-search';
import { colors, floatingTab, homeLayout, radius, space, touchTarget } from '@/theme';

type SearchCenter = (NearbySearchResult & { point: Coordinates }) | { kind: 'default' | 'device' | 'map'; point: Coordinates };
type NearbyParams = {
  category?: string;
  view?: string;
  savedFacilitySource?: string;
  savedFacilityId?: string;
  savedFacilityRequest?: string;
};
const defaultCenter = { kind: 'default', point: nearbyBusLandmarks.central } satisfies SearchCenter;
const categories = ['all', ...facilityCategories] as const;
const modes = [{ key: 'map', icon: 'map' }, { key: 'list', icon: 'list.bullet' }] as const;

export default function NearbyScreen() {
  const { copy, locale } = useLanguage();
  const labels = copy.nearby;
  const router = useRouter();
  const navigation = useNavigation();
  const { key: routeKey } = useRoute();
  const { height } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();
  const params = useLocalSearchParams<NearbyParams>();
  const category = facilityFilter(params.category);
  const mode = params.view === 'list' ? 'list' : 'map';
  const [committedSearchCenter, setCommittedSearchCenter] = useState<SearchCenter>(defaultCenter);
  const [deviceLocation, setDeviceLocation] = useState<Coordinates>();
  const [areaPending, setAreaPending] = useState(false);
  const [selectedFacilityKey, setSelectedFacilityKey] = useState<string>();
  const [picking, setPicking] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationIssue, setLocationIssue] = useState<NearbyLocationIssue>();
  const [listRevision, setListRevision] = useState(0);
  const locationRequest = useRef<{ controller: AbortController; manual: boolean } | null>(null);
  const triedInitialLocation = useRef(false);
  const handledSavedRequest = useRef<string>(undefined);
  const mapRef = useRef<NearbyFacilitiesMapHandle | null>(null);
  const visibleRegion = useRef(regionAroundFacility(defaultCenter.point));
  const listOffsets = useRef<Partial<Record<FacilityFilter, number>>>({});
  const currentOffsets = listOffsets.current;

  const { point } = committedSearchCenter;
  const centerName = committedSearchCenter.kind === 'landmark' ? copy.nearbyBus.landmarks[committedSearchCenter.landmark]
    : committedSearchCenter.kind === 'place' ? facilityText(committedSearchCenter.place.name, locale)
    : committedSearchCenter.kind === 'facility' ? facilityText(committedSearchCenter.facility.name, locale)
    : committedSearchCenter.kind === 'device' ? copy.nearbyBus.currentLocation
    : committedSearchCenter.kind === 'map' ? labels.mapCenter : copy.nearbyBus.landmarks.central;
  const centerConfirmed = committedSearchCenter.kind !== 'default';
  const placePin = committedSearchCenter.kind === 'landmark' || committedSearchCenter.kind === 'place'
    ? { point, name: centerName } : undefined;
  const items = useMemo(() => indexNearbyFacilities(nearbyFacilities, category, point), [category, point]);
  const selected = items.find(({ id }) => id === selectedFacilityKey);

  const cancelLocation = useCallback(() => {
    if (!locationRequest.current) return;
    locationRequest.current.controller.abort();
    locationRequest.current = null;
    setLocating(false);
  }, []);

  const recordViewport = useCallback((region: Region) => { visibleRegion.current = region; }, []);

  const recordCameraMove = useCallback((region: Region) => {
    recordViewport(region);
    setAreaPending(false);
  }, [recordViewport]);

  const moveCamera = useCallback((target: Coordinates) => {
    const region = regionAroundFacility(target);
    if (mapRef.current) mapRef.current.moveTo(region);
    else recordCameraMove(region);
  }, [recordCameraMove]);

  const confirmCenter = useCallback((center: SearchCenter) => {
    setLocationIssue(undefined);
    setCommittedSearchCenter(center);
    listOffsets.current = {};
    setListRevision((revision) => revision + 1);
  }, []);

  const requestLocation = useCallback(async (manual: boolean, fromSearch = false) => {
    const active = locationRequest.current;
    if (active && (!manual || active.manual)) return;
    active?.controller.abort();
    const request = { controller: new AbortController(), manual };
    locationRequest.current = request;
    if (manual) {
      triedInitialLocation.current = true;
      setLocating(true);
      setLocationIssue(undefined);
    }
    const result = await locateNearbyBusStops(request.controller.signal, manual ? true : 'undetermined');
    if (locationRequest.current !== request) return;
    locationRequest.current = null;
    if (manual) setLocating(false);
    if (result.kind === 'position') {
      setDeviceLocation(result.point);
      confirmCenter({ kind: 'device', point: result.point });
      moveCamera(result.point);
      if (fromSearch) setPicking(false);
    } else if (result.kind !== 'cancelled' && (manual || result.kind === 'denied' || result.kind === 'blocked')) {
      setLocationIssue(result.kind);
    }
  }, [confirmCenter, moveCamera]);

  const focusSavedFacility = useCallback(() => {
    // Focus events can fire before local search params have re-rendered.
    const latest = navigation.getState()?.routes.find((route) => route.key === routeKey)?.params as NearbyParams | undefined;
    const token = latest?.savedFacilityRequest;
    if (typeof token !== 'string' || !token || handledSavedRequest.current === token) return;
    handledSavedRequest.current = token;
    const resolved = typeof latest.savedFacilitySource === 'string' && typeof latest.savedFacilityId === 'string'
      ? resolveStableFacilityIdentity({ source: latest.savedFacilitySource, stableFacilityId: latest.savedFacilityId }) : undefined;
    const params: NearbyParams = { savedFacilityRequest: undefined, savedFacilitySource: undefined, savedFacilityId: undefined };
    if (resolved?.status === 'available' && isNearHongKong(resolved.facility.coordinate)) {
      triedInitialLocation.current = true;
      cancelLocation();
      setPicking(false);
      setLocationIssue(undefined);
      setSelectedFacilityKey(facilityId(resolved.facility));
      moveCamera(resolved.facility.coordinate);
      params.view = 'map';
      params.category = resolved.facility.category;
    }
    navigation.dispatch({ type: 'SET_PARAMS', source: routeKey, payload: { params } });
  }, [cancelLocation, moveCamera, navigation, routeKey]);

  useEffect(() => {
    if (params.savedFacilityRequest && navigation.isFocused()) focusSavedFacility();
  }, [focusSavedFacility, navigation, params.savedFacilityRequest]);

  useFocusEffect(useCallback(() => {
    focusSavedFacility();
    void loadFacilityFavorites();
    function locateInitially() {
      if (triedInitialLocation.current || locationRequest.current) return;
      triedInitialLocation.current = true;
      void requestLocation(false);
    }
    if (AppState.currentState === 'active' || AppState.currentState == null) locateInitially();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        if (locationRequest.current && !locationRequest.current.manual) triedInitialLocation.current = false;
        cancelLocation();
      } else if (state === 'active') {
        locateInitially();
        void loadFacilityFavorites();
      }
    });
    return () => {
      subscription.remove();
      cancelLocation();
      setPicking(false);
    };
  }, [cancelLocation, focusSavedFacility, requestLocation]));

  function editSearch() {
    cancelLocation();
    setLocationIssue(undefined);
  }

  function closeSearch() {
    cancelLocation();
    setPicking(false);
  }

  function chooseResult(result: NearbySearchResult) {
    const point = result.kind === 'facility' ? result.facility.coordinate
      : result.kind === 'place' ? result.place.point : nearbyBusLandmarks[result.landmark];
    if (!isNearHongKong(point)) {
      Alert.alert(labels.outsideSearchArea);
      return;
    }
    closeSearch();
    if (result.kind === 'facility') {
      if (category !== 'all' && category !== result.facility.category) router.setParams({ category: result.facility.category });
      setSelectedFacilityKey(facilityId(result.facility));
    } else {
      setSelectedFacilityKey(undefined);
    }
    confirmCenter({ ...result, point });
    moveCamera(point);
  }

  function searchThisArea() {
    cancelLocation();
    const { latitude, longitude } = visibleRegion.current;
    const point = { latitude, longitude };
    if (!isNearHongKong(point)) {
      Alert.alert(labels.outsideSearchArea);
      return;
    }
    confirmCenter({ kind: 'map', point });
    setAreaPending(false);
  }

  function selectFacility(id?: string) {
    cancelLocation();
    setSelectedFacilityKey(id);
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']}
      style={[styles.screen, { paddingBottom: bottom + floatingTab.height + floatingTab.bottomGap + space.sm }]}>
      <ScrollView style={[styles.headerScroll, { maxHeight: height * 0.43 }]}
        contentContainerStyle={styles.header} keyboardShouldPersistTaps="handled">
        <NearbyHeading />

        <Pressable accessibilityRole="button" accessibilityHint={centerConfirmed ? labels.searchPlaces : undefined}
          onPress={() => {
            editSearch();
            setPicking(true);
          }} style={({ pressed }) => [styles.searchEntry, pressed && styles.pressed]}>
          <Icon name="magnifyingglass" size={20} />
          <AppText variant="detail" tone={centerConfirmed ? 'text' : 'muted'} style={styles.shrink}>
            {centerConfirmed ? centerName : labels.searchPlaces}
          </AppText>
        </Pressable>

        {locationIssue && !picking && (
          <View style={styles.locationIssue}>
            <Icon name="info.circle" size={17} />
            <AppText variant="detail" tone="muted" style={styles.grow} accessibilityRole="alert">
              {copy.nearbyBus.issues[locationIssue]}
            </AppText>
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {categories.map((key) => {
            const active = category === key;
            const icon = key === 'all' ? undefined : facilityVisuals[key].icon;
            return (
              <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: active }}
                onPress={() => {
                  if (key !== category) {
                    cancelLocation();
                    if (selected && key !== 'all' && selected.facility.category !== key) setSelectedFacilityKey(undefined);
                    router.setParams({ category: key });
                  }
                }}
                style={({ pressed }) => [styles.filter, active && styles.activeFilter, pressed && styles.pressed]}>
                {icon && <Icon name={icon} size={15} color={active ? colors.onPrimary : colors.primary} />}
                <AppText variant="detail" tone={active ? 'onPrimary' : 'text'}>{labels.categories[key]}</AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      </ScrollView>

      <View style={styles.modeSwitch} accessibilityRole="tablist">
        {modes.map(({ key, icon }) => {
          const active = mode === key;
          return (
            <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: active }}
              onPress={() => {
                if (key === mode) return;
                cancelLocation();
                router.setParams({ view: key });
              }}
              style={({ pressed }) => [styles.segment, active && styles.activeSegment, pressed && styles.pressed]}>
              <Icon name={icon} size={17} color={active ? colors.primary : colors.muted} />
              <AppText variant="homeCardTitle" tone={active ? 'primary' : 'muted'} style={styles.shrink}>{labels[key]}</AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.body}>
        {mode === 'map' ? (
          <NearbyFacilitiesMap mapRef={mapRef} initialRegion={visibleRegion.current} items={items}
            devicePoint={deviceLocation} placePin={placePin} selectedId={selected?.id} areaPending={areaPending}
            locating={locating} onLocate={() => void requestLocation(true)}
            emptyMessage={items.length ? labels.noFacilitiesInView : facilityEmptyMessage(category, labels)}
            onViewportChange={recordViewport} onCameraMove={recordCameraMove} onMapInteraction={cancelLocation}
            onAreaBrowsed={() => setAreaPending(true)} onSearchArea={searchThisArea}
            onSelect={({ id }) => selectFacility(id)} onDismiss={() => selectFacility()}
            onShowList={() => {
              cancelLocation();
              router.setParams({ view: 'list' });
            }} />
        ) : (
          <NearbyFacilitiesList key={`${category}:${listRevision}`} items={items} category={category} selectedId={selected?.id}
            initialOffset={currentOffsets[category] ?? 0} centerName={centerName}
            onScroll={(offset) => { currentOffsets[category] = offset; }}
            onSelect={(item) => {
              cancelLocation();
              setSelectedFacilityKey((current) => current === item.id ? undefined : item.id);
              if (selected?.id !== item.id) moveCamera(item.facility.coordinate);
            }} />
        )}

        {mode === 'map' && areaPending && (
          <AppText variant="caption" tone="muted" style={styles.areaStatus}>{labels.browsingMap}</AppText>
        )}

        {mode === 'map' && selected && (
          <FacilitySelectionCard selected={selected} items={items} distance={selected.distance}
            onSelect={selectFacility} onClose={() => selectFacility()} />
        )}
      </View>

      {picking && <NearbySearchSheet onChoose={chooseResult} onClose={closeSearch} onEdit={editSearch}
        onLocate={() => void requestLocation(true, true)} locating={locating} locationIssue={locationIssue} />}
    </SafeAreaView>
  );
}

function NearbyHeading() {
  const { copy: { nearby: labels } } = useLanguage();
  return (
    <View style={styles.heading}>
      <Icon name="map" size={27} />
      <View style={styles.grow}>
        <AppText variant="moduleTitle" accessibilityRole="header">{labels.title}</AppText>
      </View>
      <FacilitySourceInfo />
    </View>
  );
}

function facilityEmptyMessage(category: FacilityFilter, labels: Messages['nearby']) {
  if (category === 'toilets') return labels.noToilets;
  if (category === 'parks') return labels.noParks;
  if (category === 'pets') return labels.noPetParks;
  return nearbyFacilities.length ? labels.noMatches : labels.empty;
}

function NearbyFacilitiesList({ items, category, selectedId, initialOffset, centerName, onScroll, onSelect }: {
  items: NearbyFacility[];
  category: FacilityFilter;
  selectedId?: string;
  initialOffset: number;
  centerName: string;
  onScroll: (offset: number) => void;
  onSelect: (item: NearbyFacility) => void;
}) {
  const { copy } = useLanguage();
  const labels = copy.nearby;
  const [contentOffset] = useState(() => ({ x: 0, y: initialOffset }));
  const visual = category === 'all' ? { icon: 'map' as const, color: colors.primary, surface: colors.tint } : facilityVisuals[category];

  return (
    <FlatList data={items} extraData={selectedId} keyExtractor={({ id }) => id} contentOffset={contentOffset}
      scrollEventThrottle={32} onScroll={({ nativeEvent }) => onScroll(nativeEvent.contentOffset.y)}
      contentContainerStyle={items.length ? styles.list : styles.emptyList}
      ListHeaderComponent={(
        <View style={styles.centerSummary}>
          <AppText variant="caption" tone="primary" style={styles.shrink}>{labels.searchCenter(centerName)}</AppText>
          <AppText variant="caption" tone="muted" style={styles.shrink}>{labels.sortedByDistance}</AppText>
        </View>
      )}
      ListEmptyComponent={(
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: visual.surface }]}><Icon name={visual.icon} color={visual.color} size={28} /></View>
          <AppText variant="homeHeading" accessibilityRole="header" style={styles.centered}>{facilityEmptyMessage(category, labels)}</AppText>
          <AppText variant="detail" tone="muted" style={styles.centered}>{labels.emptyDetail}</AppText>
        </View>
      )}
      renderItem={({ item }) => <FacilityListRow item={item} expanded={item.id === selectedId} onPress={() => onSelect(item)} />}
    />
  );
}

function FacilitySourceInfo() {
  const { copy, locale } = useLanguage();
  const labels = copy.nearby;

  function showSource() {
    const inclusiveSource = nearbyFacilitySources.find((dataset) => 'rulesUrls' in dataset);
    const datasets = nearbyFacilitySources.map((dataset) => {
      const lines = [labels.source(facilityText(dataset.sourceName, locale)), labels.snapshotDate(dataset.snapshotDate)];
      if ('fetchedAt' in dataset) {
        const acquired = new Intl.DateTimeFormat(locale, {
          dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Hong_Kong',
        }).format(new Date(dataset.fetchedAt));
        const coverage = dataset.source === 'lcsd-inclusive-pet-parks' ? labels.inclusivePetParkCoverage
          : dataset.category === 'pets' ? labels.petGardenCoverage : labels.parkCoverage;
        lines.push(labels.revisionDate(dataset.revisionDate), labels.acquiredAt(acquired), coverage(dataset.recordCount));
      }
      return lines.join('\n');
    });
    const details = [
      ...datasets, labels.inclusivePetParkRules, labels.sourceNote, labels.navigation.coordinateNote,
      labels.navigation.parkCoordinateNote, labels.navigation.petGardenCoordinateNote, labels.csdiCredit,
      labels.placeSearch.credit,
    ];
    function openSource(url: string) {
      void Linking.openURL(url).catch(() => {
        Alert.alert(labels.openSourceFailed, undefined, [{ text: labels.navigation.ok }]);
      });
    }
    Alert.alert(labels.sourceInformation, details.join('\n\n'), [
      ...nearbyFacilitySources.map(({ source, sourceUrl }) => ({
        text: source === 'lcsd-pet-gardens' ? labels.openPetGardenSource
          : source === 'lcsd-inclusive-pet-parks' ? labels.openInclusivePetParkSource
          : labels.openOfficialSource(source === 'lcsd-parks' ? 'LCSD' : source.toUpperCase()),
        onPress: () => openSource(sourceUrl),
      })),
      ...(inclusiveSource ? [{ text: labels.openInclusivePetParkRules, onPress: () => openSource(inclusiveSource.rulesUrls[locale]) }] : []),
      { text: labels.csdiTerms, onPress: () => openSource('https://portal.csdi.gov.hk/csdi-webpage/doc/TNC') },
      { text: labels.close, style: 'cancel' },
    ]);
  }

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={labels.sourceInformation} onPress={showSource}
      style={({ pressed }) => [styles.sourceAction, pressed && styles.pressed]}>
      <Icon name="info.circle" size={24} />
    </Pressable>
  );
}

function FacilityListRow({ item: { facility, distance }, expanded, onPress }: {
  item: NearbyFacility; expanded: boolean; onPress: () => void;
}) {
  const { copy, locale } = useLanguage();
  const labels = copy.nearby;
  const visual = facilityVisuals[facility.category];
  const place = facilityPlace(facility, locale);
  const isAfcd = facility.source === 'afcd';
  const isPark = facility.category === 'parks';
  const isPetGarden = facility.category === 'pets';
  const source = facility.source === 'fehd' ? labels.fehdShort
    : isAfcd || isPark || isPetGarden ? undefined : facility.sourceName ? facilityText(facility.sourceName, locale) : facility.source;
  const usesFallback = [facility.name, facility.area ?? facility.district, facility.address]
    .some((field) => facilityTextUsesFallback(field, locale));
  const type = facilityType(facility, locale, labels);
  const showSpecialType = !expanded && facility.category === 'toilets' && facility.officialType !== 'toilet' && facility.typeName;
  const compactType = isAfcd ? labels.countryParkToilet : (isPark || showSpecialType) && type;
  const caption = [!expanded && compactType, !expanded && source, labels.straightLineDistance, usesFallback && labels.originalLanguageShort]
    .filter(Boolean).join(' · ');

  return (
    <View style={[styles.listRow, expanded && styles.activeLandmark]}>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: expanded, expanded }} onPress={onPress}
        style={({ pressed }) => [styles.listRowButton, pressed && styles.pressed]}>
        <View style={[styles.listIcon, { backgroundColor: visual.surface }]}>
          <Icon name={visual.icon} color={visual.color} size={21} />
        </View>
        <View style={styles.grow}>
          <View style={styles.listNameLine}>
            <AppText variant="homeCardTitle" style={styles.listName}>{facilityText(facility.name, locale)}</AppText>
            <View style={styles.listDistance}>
              <AppText variant="caption" tone="primary" style={styles.shrink}>{facilityDistance(distance, copy.nearbyBus)}</AppText>
              <Icon name={expanded ? 'chevron.up' : 'chevron.down'} size={13} />
            </View>
          </View>
          {place !== '' && <AppText variant="detail" tone="muted" numberOfLines={expanded ? undefined : 2}>{place}</AppText>}
          {isPetGarden && <PetGardenTypeBadge label={type} />}
          {!expanded && facility.petAccess && <SharedPetRules access={facility.petAccess} />}
          <AppText variant="caption" tone="muted">{caption}</AppText>
          {!expanded && facility.serviceNotice && <FacilityServiceNotice />}
        </View>
      </Pressable>
      {expanded && (
        <View style={styles.listDetails}>
          <FacilityDetails facility={facility} mode="list" type={facility.officialType === 'toilet' || isPetGarden ? undefined : type}
            usesFallback={!usesFallback && [facility.openingHours, facility.remarks, facility.details, facility.phone]
              .some((field) => facilityTextUsesFallback(field, locale))} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerScroll: { flexGrow: 0, flexShrink: 1 },
  header: { paddingTop: space.md, gap: space.sm },
  heading: {
    flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingHorizontal: homeLayout.gutter,
    paddingBottom: space.xs,
  },
  sourceAction: {
    width: touchTarget, height: touchTarget, flexShrink: 0, alignItems: 'center', justifyContent: 'center',
  },
  grow: { flex: 1, minWidth: 0, gap: space.xs },
  shrink: { flexShrink: 1 },
  searchEntry: {
    minWidth: 0, minHeight: 48, flexDirection: 'row', alignItems: 'center', marginHorizontal: homeLayout.gutter,
    paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.sm,
    borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  locationIssue: {
    marginHorizontal: homeLayout.gutter, padding: space.sm, borderRadius: radius.control,
    backgroundColor: colors.tint, flexDirection: 'row', alignItems: 'flex-start', gap: space.sm,
  },
  filters: { paddingHorizontal: homeLayout.gutter, alignItems: 'stretch', gap: space.xs },
  filter: {
    flexDirection: 'row', minHeight: touchTarget, alignItems: 'center', gap: space.xs, paddingHorizontal: space.sm,
    paddingVertical: space.xs / 2, borderRadius: radius.pill, backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  activeFilter: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeSwitch: {
    marginHorizontal: homeLayout.gutter, marginTop: space.md, marginBottom: space.sm, flexDirection: 'row',
    backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: space.xs, paddingVertical: space.xs / 4,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  segment: {
    flex: 1, minWidth: 0, minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: space.xs, paddingVertical: space.xs, gap: space.sm, borderRadius: radius.pill,
  },
  activeSegment: { backgroundColor: colors.tint },
  body: { flex: 1, minHeight: 0, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  areaStatus: { marginHorizontal: homeLayout.gutter, marginTop: space.xs },
  list: { paddingHorizontal: homeLayout.gutter, paddingTop: space.xs, paddingBottom: space.md, gap: space.sm },
  centerSummary: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space.xs,
    backgroundColor: colors.tint, borderRadius: radius.control, paddingHorizontal: space.md, paddingVertical: space.sm,
  },
  emptyList: { flexGrow: 1, paddingHorizontal: homeLayout.gutter, paddingVertical: space.lg },
  empty: { alignItems: 'center', gap: space.sm, paddingTop: space.xxl },
  emptyIcon: {
    width: 58, height: 58, borderRadius: radius.card, justifyContent: 'center', alignItems: 'center', marginBottom: space.xs,
  },
  centered: { textAlign: 'center' },
  listRow: {
    borderRadius: radius.card,
    backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  listRowButton: { minHeight: touchTarget, flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, padding: space.sm },
  listIcon: {
    width: 36, height: 36, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center',
  },
  listNameLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: space.xs },
  listName: { flexBasis: 120, flexGrow: 1, flexShrink: 1 },
  listDistance: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, marginLeft: 'auto', gap: space.xs },
  listDetails: {
    borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    padding: space.sm, marginHorizontal: space.sm, gap: space.xs,
  },
  activeLandmark: { backgroundColor: colors.tint, borderColor: colors.primary },
  pressed: { opacity: 0.72 },
});
