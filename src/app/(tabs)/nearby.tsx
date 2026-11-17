import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import type MapView from 'react-native-maps';
import type { Region } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { facilityVisuals, NearbyFacilitiesMap } from '@/components/nearby-facilities-map';
import { AppText, Icon } from '@/components/ui';
import { facilityCategories, facilityFilter, facilityText, indexNearbyFacilities, nearbyFacilities,
  type Facility, type FacilityFilter, type NearbyFacility } from '@/facilities';
import type { Messages } from '@/i18n';
import { useLanguage } from '@/language';
import type { Coordinates } from '@/nearby-bus-data';
import { nearbyBusLandmarks, type NearbyLandmark } from '@/nearby-bus-landmarks';
import { locateNearbyBusStops, type NearbyLocationIssue } from '@/nearby-bus-location';
import { colors, floatingTab, homeLayout, radius, space, touchTarget } from '@/theme';

type Reference = { kind: 'default' | 'landmark'; landmark: NearbyLandmark } | { kind: 'device'; point: Coordinates };
const defaultReference = { kind: 'default', landmark: 'central' } satisfies Reference;
const landmarks = Object.keys(nearbyBusLandmarks) as NearbyLandmark[];
const categories = ['all', ...facilityCategories, 'bus'] as const;
const modes = [{ key: 'map', icon: 'map' }, { key: 'list', icon: 'list.bullet' }] as const;

function regionAround(point: Coordinates): Region {
  return { ...point, latitudeDelta: 0.022, longitudeDelta: 0.022 };
}

export default function NearbyScreen() {
  const { copy } = useLanguage();
  const labels = copy.nearby;
  const router = useRouter();
  const { height } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string; view?: string }>();
  const category = facilityFilter(params.category);
  const mode = params.view === 'list' ? 'list' : 'map';
  const [reference, setReference] = useState<Reference>(defaultReference);
  const [selectedId, setSelectedId] = useState<string>();
  const [picking, setPicking] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationIssue, setLocationIssue] = useState<NearbyLocationIssue>();
  const locationRequest = useRef<AbortController | null>(null);
  const mapRef = useRef<MapView | null>(null);
  const viewport = useRef(regionAround(nearbyBusLandmarks.central));
  const listOffsets = useRef<Partial<Record<FacilityFilter, number>>>({});

  const point = reference.kind === 'device' ? reference.point : nearbyBusLandmarks[reference.landmark];
  const referenceName = reference.kind === 'device' ? copy.nearbyBus.currentLocation : copy.nearbyBus.landmarks[reference.landmark];
  const referenceLabel = reference.kind === 'default' ? labels.defaultArea
    : reference.kind === 'landmark' ? labels.browseArea : copy.nearbyBus.reference;
  const items = useMemo(() => indexNearbyFacilities(nearbyFacilities, category, point), [category, point]);
  const selected = items.find(({ id }) => id === selectedId);

  const cancelLocation = useCallback(() => {
    locationRequest.current?.abort();
    locationRequest.current = null;
    setLocating(false);
  }, []);

  useFocusEffect(useCallback(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') cancelLocation();
    });
    return () => {
      subscription.remove();
      cancelLocation();
    };
  }, [cancelLocation]));

  function moveCamera(target: Coordinates) {
    const next = regionAround(target);
    viewport.current = next;
    mapRef.current?.animateToRegion(next, 250);
  }

  function chooseLandmark(landmark: NearbyLandmark) {
    cancelLocation();
    setPicking(false);
    setLocationIssue(undefined);
    setReference({ kind: 'landmark', landmark });
    moveCamera(nearbyBusLandmarks[landmark]);
  }

  async function useLocation() {
    if (locationRequest.current) return;
    const request = new AbortController();
    locationRequest.current = request;
    setLocating(true);
    setLocationIssue(undefined);
    const result = await locateNearbyBusStops(request.signal);
    if (locationRequest.current !== request) return;
    locationRequest.current = null;
    setLocating(false);
    if (result.kind === 'position') {
      setReference({ kind: 'device', point: result.point });
      moveCamera(result.point);
    } else if (result.kind !== 'cancelled') {
      setLocationIssue(result.kind);
    }
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']}
      style={[styles.screen, { paddingBottom: bottom + floatingTab.height + floatingTab.bottomGap + space.sm }]}>
      <ScrollView style={[styles.headerScroll, { maxHeight: height * 0.43 }]}
        contentContainerStyle={styles.header} keyboardShouldPersistTaps="handled">
        <View style={styles.heading}>
          <Icon name="map" size={27} />
          <View style={styles.grow}>
            <AppText variant="moduleTitle" accessibilityRole="header">{labels.title}</AppText>
            <AppText variant="detail" tone="muted">{labels.intro}</AppText>
          </View>
        </View>

        <View style={styles.locationBar}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${referenceLabel} · ${referenceName}`}
            accessibilityHint={labels.chooseArea} onPress={() => {
              cancelLocation();
              setPicking(true);
            }} style={({ pressed }) => [styles.area, pressed && styles.pressed]}>
            <Icon name="mappin" size={18} />
            <View style={styles.grow}>
              <AppText variant="homeCardTitle">{referenceName}</AppText>
              <AppText variant="caption" tone="muted">{referenceLabel}</AppText>
            </View>
            <Icon name="chevron.down" size={11} />
          </Pressable>

          <Pressable accessibilityRole="button" disabled={locating}
            accessibilityState={{ busy: locating, disabled: locating }} onPress={() => void useLocation()}
            style={({ pressed }) => [styles.locationAction, pressed && styles.pressed]}>
            {locating ? <ActivityIndicator color={colors.primary} /> : <Icon name="location" size={17} />}
            <AppText variant="caption" tone="primary" style={styles.shrink}>
              {locating ? copy.nearbyBus.locating : labels.useLocation}
            </AppText>
          </Pressable>
        </View>

        {locationIssue && (
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
                    router.push('/bus/nearby');
                  } else if (key !== category) {
                    if (selected && key !== 'all' && selected.facility.category !== key) setSelectedId(undefined);
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
              onPress={() => router.setParams({ view: key })}
              style={({ pressed }) => [styles.segment, active && styles.activeSegment, pressed && styles.pressed]}>
              <Icon name={icon} size={17} color={active ? colors.primary : colors.muted} />
              <AppText variant="homeCardTitle" tone={active ? 'primary' : 'muted'} style={styles.shrink}>{labels[key]}</AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.body}>
        {mode === 'map' ? (
          <NearbyFacilitiesMap mapRef={mapRef} initialRegion={viewport.current} items={items}
            devicePoint={reference.kind === 'device' ? reference.point : undefined} selectedId={selected?.id}
            onRegionChange={(region) => { viewport.current = region; }}
            onSelect={({ id }) => setSelectedId(id)} onDismiss={() => setSelectedId(undefined)}
            onRecenter={() => moveCamera(point)} onShowList={() => router.setParams({ view: 'list' })} />
        ) : (
          <NearbyFacilitiesList key={category} items={items} category={category} selectedId={selected?.id}
            initialOffset={listOffsets.current[category] ?? 0}
            onScroll={(offset) => { listOffsets.current[category] = offset; }}
            onSelect={(item) => {
              setSelectedId(item.id);
              moveCamera(item.facility.coordinate);
            }} />
        )}

        {selected ? (
          <View style={[styles.selectedCard, { maxHeight: height * 0.3 }]}>
            <ScrollView contentContainerStyle={styles.selectedContents}>
              <FacilitySummary facility={selected.facility} />
              <Pressable accessibilityRole="button" accessibilityLabel={labels.closeFacility}
                onPress={() => setSelectedId(undefined)}
                style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
                <Icon name="xmark" size={15} />
              </Pressable>
            </ScrollView>
          </View>
        ) : mode === 'map' && (
          <View style={styles.mapFooter}>
            {!items.length && <AppText variant="caption" tone="muted">{facilityEmptyMessage(labels)}</AppText>}
            <AppText variant="caption" tone="muted">{labels.mapHelp}</AppText>
          </View>
        )}
      </View>

      <Modal visible={picking} presentationStyle="pageSheet" animationType="slide" onRequestClose={() => setPicking(false)}>
        <SafeAreaView style={styles.screen} accessibilityViewIsModal>
          <View style={styles.sheetHeader}>
            <AppText variant="homeHeading" accessibilityRole="header" style={styles.grow}>{labels.chooseArea}</AppText>
            <Pressable accessibilityRole="button" accessibilityLabel={labels.close} onPress={() => setPicking(false)}
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
              <Icon name="xmark" size={16} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetChoices}>
            {landmarks.map((landmark) => {
              const active = reference.kind !== 'device' && reference.landmark === landmark;
              return (
                <Pressable key={landmark} accessibilityRole="button" accessibilityState={{ selected: active }}
                  onPress={() => chooseLandmark(landmark)}
                  style={({ pressed }) => [styles.landmark, active && styles.activeLandmark, pressed && styles.pressed]}>
                  <Icon name="mappin" size={17} />
                  <AppText variant="detail" style={styles.grow} tone={active ? 'primary' : 'text'}>
                    {copy.nearbyBus.landmarks[landmark]}
                  </AppText>
                  {active && <Icon name="checkmark" size={15} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function facilityEmptyMessage(labels: Messages['nearby']) {
  return nearbyFacilities.length ? labels.noMatches : labels.empty;
}

function NearbyFacilitiesList({ items, category, selectedId, initialOffset, onScroll, onSelect }: {
  items: NearbyFacility[];
  category: FacilityFilter;
  selectedId?: string;
  initialOffset: number;
  onScroll: (offset: number) => void;
  onSelect: (item: NearbyFacility) => void;
}) {
  const { copy } = useLanguage();
  const labels = copy.nearby;
  const [contentOffset] = useState(() => ({ x: 0, y: initialOffset }));
  const visual = category === 'all' ? { icon: 'map' as const, color: colors.primary, surface: colors.tint } : facilityVisuals[category];

  return (
    <FlatList data={items} keyExtractor={({ id }) => id} contentOffset={contentOffset}
      scrollEventThrottle={32} onScroll={({ nativeEvent }) => onScroll(nativeEvent.contentOffset.y)}
      contentContainerStyle={items.length ? styles.list : styles.emptyList}
      ListEmptyComponent={(
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: visual.surface }]}><Icon name={visual.icon} color={visual.color} size={28} /></View>
          <AppText variant="homeHeading" accessibilityRole="header" style={styles.centered}>{facilityEmptyMessage(labels)}</AppText>
          <AppText variant="detail" tone="muted" style={styles.centered}>{labels.emptyDetail}</AppText>
        </View>
      )}
      renderItem={({ item }) => {
        const active = item.id === selectedId;
        const distance = item.distance < 1000 ? copy.nearbyBus.metres(Math.round(item.distance))
          : copy.nearbyBus.kilometres(Math.round(item.distance / 100) / 10);
        return (
          <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => onSelect(item)}
            style={({ pressed }) => [styles.listRow, active && styles.activeLandmark, pressed && styles.pressed]}>
            <FacilitySummary facility={item.facility} distance={labels.directDistance(distance)} />
            <Icon name={active ? 'checkmark' : 'chevron.right'} size={15} />
          </Pressable>
        );
      }}
    />
  );
}

function FacilitySummary({ facility, distance }: { facility: Facility; distance?: string }) {
  const { copy, locale } = useLanguage();
  const labels = copy.nearby;
  const visual = facilityVisuals[facility.category];
  const place = [facility.district, facility.address]
    .flatMap((value) => value ? [facilityText(value, locale)] : []).filter(Boolean).join(' · ');
  return (
    <>
      <View style={[styles.facilityIcon, { backgroundColor: visual.surface }]}><Icon name={visual.icon} color={visual.color} size={23} /></View>
      <View style={styles.grow}>
        <AppText variant="homeCardTitle">{facilityText(facility.name, locale)}</AppText>
        <AppText variant="detail" tone="muted">{labels.categories[facility.category]}</AppText>
        {place !== '' && <AppText variant="detail" tone="muted">{place}</AppText>}
        <AppText variant="caption" tone="muted">{labels.source(facility.source)}</AppText>
        {distance && <AppText variant="caption" tone="primary">{distance}</AppText>}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerScroll: { flexGrow: 0, flexShrink: 1 },
  header: { paddingTop: space.md, paddingBottom: space.xs, gap: space.sm },
  heading: {
    flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingHorizontal: homeLayout.gutter,
    paddingBottom: space.xs,
  },
  grow: { flex: 1, minWidth: 0, gap: space.xs },
  shrink: { flexShrink: 1 },
  locationBar: {
    flexDirection: 'row', alignItems: 'stretch', marginHorizontal: homeLayout.gutter, borderRadius: radius.largeCard,
    backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  area: {
    flex: 1, minWidth: 0, minHeight: touchTarget, flexDirection: 'row', alignItems: 'center',
    padding: space.sm, gap: space.sm,
  },
  locationAction: {
    maxWidth: '47%', minHeight: touchTarget, flexDirection: 'row', alignItems: 'center',
    padding: space.sm, gap: space.xs,
  },
  locationIssue: {
    marginHorizontal: homeLayout.gutter, padding: space.sm, borderRadius: radius.control,
    backgroundColor: colors.tint, flexDirection: 'row', alignItems: 'flex-start', gap: space.sm,
  },
  filters: { paddingHorizontal: homeLayout.gutter, alignItems: 'stretch', gap: space.xs },
  filter: {
    flexDirection: 'row', minHeight: touchTarget, alignItems: 'center', gap: space.xs, paddingHorizontal: space.sm,
    paddingVertical: space.xs, borderRadius: radius.pill, backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  activeFilter: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeSwitch: {
    marginHorizontal: homeLayout.gutter, marginTop: space.xs, marginBottom: space.sm, flexDirection: 'row',
    backgroundColor: colors.surface, borderRadius: radius.pill, padding: space.xs,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  segment: {
    flex: 1, minWidth: 0, minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: space.xs, paddingVertical: space.xs, gap: space.sm, borderRadius: radius.pill,
  },
  activeSegment: { backgroundColor: colors.tint },
  body: { flex: 1, minHeight: 0, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  mapFooter: { paddingTop: space.xs, paddingHorizontal: homeLayout.gutter, gap: space.xs },
  list: { paddingHorizontal: homeLayout.gutter, paddingVertical: space.md, gap: space.sm },
  emptyList: { flexGrow: 1, paddingHorizontal: homeLayout.gutter, paddingVertical: space.lg },
  empty: { alignItems: 'center', gap: space.sm, paddingTop: space.xxl },
  emptyIcon: {
    width: 58, height: 58, borderRadius: radius.card, justifyContent: 'center', alignItems: 'center', marginBottom: space.xs,
  },
  centered: { textAlign: 'center' },
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.card,
    backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  facilityIcon: { width: touchTarget, height: touchTarget, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  selectedCard: {
    marginHorizontal: homeLayout.gutter, marginTop: space.sm, borderRadius: radius.largeCard, backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  selectedContents: { flexDirection: 'row', alignItems: 'flex-start', padding: space.md, gap: space.sm },
  close: {
    width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.pill, backgroundColor: colors.tint,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: homeLayout.gutter, paddingVertical: space.sm,
  },
  sheetChoices: { paddingHorizontal: homeLayout.gutter, paddingBottom: space.lg, gap: space.sm },
  landmark: {
    minHeight: touchTarget, flexDirection: 'row', alignItems: 'center', padding: space.md, gap: space.sm,
    borderRadius: radius.control, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  activeLandmark: { backgroundColor: colors.tint, borderColor: colors.primary },
  pressed: { opacity: 0.72 },
});
