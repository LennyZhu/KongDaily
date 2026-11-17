import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, AppState, FlatList, Linking, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { Region } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { facilityVisuals, NearbyFacilitiesMap, type NearbyFacilitiesMapHandle } from '@/components/nearby-facilities-map';
import { NearbySearchSheet } from '@/components/nearby-search-sheet';
import { AppText, Icon } from '@/components/ui';
import { showFacilityDirections } from '@/facility-navigation';
import { facilityCategories, facilityFilter, facilityId, facilityText, facilityTextUsesFallback, indexNearbyFacilities, nearbyFacilities, nearbyFacilitySources,
  type Facility, type FacilityFilter, type FacilityLocale, type NearbyFacility } from '@/facilities';
import type { Messages } from '@/i18n';
import { useLanguage } from '@/language';
import { isNearHongKong, type Coordinates } from '@/nearby-bus-data';
import { nearbyBusLandmarks } from '@/nearby-bus-landmarks';
import { locateNearbyBusStops, type NearbyLocationIssue } from '@/nearby-bus-location';
import type { NearbySearchResult } from '@/nearby-place-search';
import { colors, floatingTab, homeColors, homeLayout, radius, space, touchTarget } from '@/theme';

type SearchCenter = (NearbySearchResult & { point: Coordinates }) | { kind: 'default' | 'device' | 'map'; point: Coordinates };
const defaultCenter = { kind: 'default', point: nearbyBusLandmarks.central } satisfies SearchCenter;
const categories = ['all', ...facilityCategories, 'bus'] as const;
const modes = [{ key: 'map', icon: 'map' }, { key: 'list', icon: 'list.bullet' }] as const;

function regionAround(point: Coordinates): Region {
  return { ...point, latitudeDelta: 0.022, longitudeDelta: 0.022 };
}

export default function NearbyScreen() {
  const { copy, locale } = useLanguage();
  const labels = copy.nearby;
  const router = useRouter();
  const { height } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string; view?: string }>();
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
  const mapRef = useRef<NearbyFacilitiesMapHandle | null>(null);
  const visibleRegion = useRef(regionAround(defaultCenter.point));
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
  const samePointFacilities = mode === 'map' && selected ? items.filter(({ id, facility: { coordinate } }) =>
    id !== selected.id && coordinate.latitude === selected.facility.coordinate.latitude
    && coordinate.longitude === selected.facility.coordinate.longitude) : [];

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
    const region = regionAround(target);
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
      setLocating(true);
      setLocationIssue(undefined);
    }
    const result = await locateNearbyBusStops(request.controller.signal, manual);
    if (locationRequest.current !== request) return;
    locationRequest.current = null;
    if (manual) setLocating(false);
    if (result.kind === 'position') {
      setDeviceLocation(result.point);
      confirmCenter({ kind: 'device', point: result.point });
      moveCamera(result.point);
      if (fromSearch) setPicking(false);
    } else if (manual && result.kind !== 'cancelled') {
      setLocationIssue(result.kind);
    }
  }, [confirmCenter, moveCamera]);

  useFocusEffect(useCallback(() => {
    if (!triedInitialLocation.current) {
      triedInitialLocation.current = true;
      if (AppState.currentState !== 'background') void requestLocation(false);
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') cancelLocation();
    });
    return () => {
      subscription.remove();
      cancelLocation();
      setPicking(false);
    };
  }, [cancelLocation, requestLocation]));

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
            const icon = key === 'all' ? undefined : key === 'bus' ? 'bus' : facilityVisuals[key].icon;
            return (
              <Pressable key={key} accessibilityRole="button" accessibilityState={key === 'bus' ? undefined : { selected: active }}
                onPress={() => {
                  if (key === 'bus') {
                    cancelLocation();
                    router.push('/bus/nearby');
                  } else if (key !== category) {
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
          <View style={[styles.selectedCard, { maxHeight: height * 0.3 }]}>
            <ScrollView contentContainerStyle={styles.selectedContents}>
              <FacilitySummary facility={selected.facility} distance={selected.distance} onClose={() => selectFacility()} />
              {samePointFacilities.length > 0 && (
                <View>
                  <AppText variant="caption" tone="muted">{labels.sameOfficialCoordinate}</AppText>
                  {samePointFacilities.map(({ id, facility }) => (
                    <Pressable key={id} accessibilityRole="button" onPress={() => selectFacility(id)}
                      style={({ pressed }) => [styles.samePointChoice, pressed && styles.pressed]}>
                      <AppText variant="detail" tone="primary" style={styles.grow}>{facilityText(facility.name, locale)}</AppText>
                      <Icon name="chevron.right" size={13} />
                    </Pressable>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
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
        <AppText variant="detail" tone="muted">{labels.intro}</AppText>
      </View>
      <FacilitySourceInfo />
    </View>
  );
}

function facilityEmptyMessage(category: FacilityFilter, labels: Messages['nearby']) {
  if (category === 'toilets') return labels.noToilets;
  if (category === 'parks') return labels.noParks;
  if (category === 'pets') return labels.pending.pets;
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
    const datasets = nearbyFacilitySources.map((dataset) => {
      const lines = [labels.source(facilityText(dataset.sourceName, locale)), labels.snapshotDate(dataset.snapshotDate)];
      if (dataset.source === 'lcsd-parks') {
        const acquired = new Intl.DateTimeFormat(locale, {
          dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Hong_Kong',
        }).format(new Date(dataset.fetchedAt));
        lines.push(labels.revisionDate(dataset.revisionDate), labels.acquiredAt(acquired), labels.parkCoverage(dataset.recordCount));
      }
      return lines.join('\n');
    });
    const details = [
      ...datasets, labels.sourceNote, labels.navigation.coordinateNote, labels.navigation.parkCoordinateNote, labels.csdiCredit,
      labels.placeSearch.credit,
    ];
    function openSource(url: string) {
      void Linking.openURL(url).catch(() => {
        Alert.alert(labels.openSourceFailed, undefined, [{ text: labels.navigation.ok }]);
      });
    }
    Alert.alert(labels.sourceInformation, details.join('\n\n'), [
      ...nearbyFacilitySources.map(({ source, sourceUrl }) => ({
        text: labels.openOfficialSource(source === 'lcsd-parks' ? 'LCSD' : source.toUpperCase()),
        onPress: () => openSource(sourceUrl),
      })),
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

function facilityPlace(facility: Facility, locale: FacilityLocale) {
  return [facility.area ?? facility.district, facility.address]
    .flatMap((value) => value ? [facilityText(value, locale)] : []).filter(Boolean).join(' · ');
}

function facilityType(facility: Facility, locale: FacilityLocale, labels: Messages['nearby']) {
  const subtype = facility.typeName && facilityText(facility.typeName, locale);
  if (facility.source === 'afcd') {
    return subtype ? `${labels.countryParkToilet} · ${subtype}` : labels.countryParkToilet;
  }
  return subtype || labels.categories[facility.category];
}

function facilityDistance(distance: number, labels: Messages['nearbyBus']) {
  return distance < 1000 ? labels.metres(Math.round(distance)) : labels.kilometres(Math.round(distance / 100) / 10);
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
  const source = facility.source === 'fehd' ? labels.fehdShort
    : isAfcd || isPark ? undefined : facility.sourceName ? facilityText(facility.sourceName, locale) : facility.source;
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
          <AppText variant="caption" tone="muted">{caption}</AppText>
          {!expanded && facility.serviceNotice && <FacilityServiceNotice />}
        </View>
      </Pressable>
      {expanded && (
        <View style={styles.listDetails}>
          <FacilityDetails facility={facility} type={facility.officialType === 'toilet' ? undefined : type}
            usesFallback={!usesFallback && [facility.openingHours, facility.remarks, facility.details]
              .some((field) => facilityTextUsesFallback(field, locale))} />
        </View>
      )}
    </View>
  );
}

function FacilityDirections({ facility }: { facility: Facility }) {
  const { copy, locale } = useLanguage();
  const labels = copy.nearby.navigation;
  const isOfficialToilet = facility.category === 'toilets' && (facility.source === 'fehd' || facility.source === 'afcd');
  const isLcsdPark = facility.category === 'parks' && facility.source === 'lcsd-parks';
  if (!isOfficialToilet && !isLcsdPark) return null;

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={labels.directions}
      onPress={() => void showFacilityDirections(facility, locale, labels)}
      style={({ pressed }) => [styles.roundAction, styles.directionsButton, pressed && styles.pressed]}>
      <Icon name="location" size={18} />
    </Pressable>
  );
}

function FacilityServiceNotice({ remarks }: { remarks?: string }) {
  const { copy } = useLanguage();
  return (
    <View style={[styles.serviceNotice, !remarks && styles.serviceNoticeBadge]}>
      <AppText variant="caption">{copy.nearby.serviceNotice}</AppText>
      {remarks && <AppText variant="detail">{remarks}</AppText>}
    </View>
  );
}

function FacilityDetails({ facility, distance, type, usesFallback }: {
  facility: Facility; distance?: number; type?: string; usesFallback: boolean;
}) {
  const { copy, locale } = useLanguage();
  const labels = copy.nearby;
  const openingHours = facility.openingHours && facilityText(facility.openingHours, locale);
  const remarks = facility.remarks && facilityText(facility.remarks, locale);
  const details = facility.details && facilityText(facility.details, locale);
  return (
    <>
      {facility.serviceNotice ? <FacilityServiceNotice remarks={remarks} />
        : remarks && <AppText variant="detail" tone="muted">{labels.officialRemarks(remarks)}</AppText>}
      <View style={styles.directionsRow}>
        <View style={styles.grow}>
          {type && <AppText variant="caption" tone="muted">{type}</AppText>}
          {distance !== undefined && (
            <AppText variant="caption" tone="primary">{labels.directDistance(facilityDistance(distance, copy.nearbyBus))}</AppText>
          )}
          {openingHours ? <AppText variant="detail" tone="muted">{labels.officialHours(openingHours)}</AppText>
            : facility.category === 'parks' && <AppText variant="detail" tone="muted">{labels.parkHoursUnavailable}</AppText>}
          {details && <AppText variant="detail" tone="muted">{labels.officialDetails(details)}</AppText>}
          {usesFallback && <AppText variant="caption" tone="muted">{labels.originalLanguage}</AppText>}
        </View>
        <FacilityDirections facility={facility} />
      </View>
    </>
  );
}

function FacilitySummary({ facility, distance, onClose }: { facility: Facility; distance: number; onClose: () => void }) {
  const { copy, locale } = useLanguage();
  const labels = copy.nearby;
  const visual = facilityVisuals[facility.category];
  const name = facilityText(facility.name, locale);
  const type = facility.officialType === 'toilet' ? undefined : facilityType(facility, locale, labels);
  const place = facilityPlace(facility, locale);
  const usesFallback = [facility.name, facility.area ?? facility.district, facility.address, facility.typeName,
    facility.openingHours, facility.remarks, facility.details].some((field) => facilityTextUsesFallback(field, locale));
  return (
    <>
      <View style={styles.selectedSummary}>
        <View style={[styles.facilityIcon, { backgroundColor: visual.surface }]}><Icon name={visual.icon} color={visual.color} size={23} /></View>
        <View style={styles.grow}>
          <AppText variant="homeCardTitle">{name}</AppText>
          {place !== '' && <AppText variant="detail" tone="muted">{place}</AppText>}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={labels.closeFacility} onPress={onClose}
          style={({ pressed }) => [styles.roundAction, pressed && styles.pressed]}>
          <Icon name="xmark" size={15} />
        </Pressable>
      </View>
      <FacilityDetails facility={facility} distance={distance} type={type} usesFallback={usesFallback} />
    </>
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
  directionsRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  directionsButton: { alignSelf: 'flex-end' },
  facilityIcon: { width: touchTarget, height: touchTarget, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  serviceNotice: { gap: space.xs, padding: space.sm, borderRadius: radius.control, backgroundColor: homeColors.cream },
  serviceNoticeBadge: { alignSelf: 'flex-start', paddingVertical: space.xs },
  selectedCard: {
    marginHorizontal: homeLayout.gutter, marginTop: space.sm, borderRadius: radius.largeCard, backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  selectedContents: { padding: space.md, gap: space.sm },
  selectedSummary: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  samePointChoice: { minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  roundAction: {
    width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.pill, backgroundColor: colors.tint,
  },
  activeLandmark: { backgroundColor: colors.tint, borderColor: colors.primary },
  pressed: { opacity: 0.72 },
});
