import { useFocusEffect } from 'expo-router';
import { useCallback, useImperativeHandle, useMemo, useRef, useState, type RefObject } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';

import { MapBoundary } from '@/components/map-boundary';
import { AppText, Icon, type IconName } from '@/components/ui';
import { facilityText, hitsFacilityMarker, petFacilityType, visibleFacilityMarkers, type FacilityCategory, type NearbyFacility } from '@/facilities';
import { useLanguage } from '@/language';
import type { Coordinates } from '@/nearby-bus-data';
import { createNearbyMapMotion } from '@/nearby-map-motion';
import { colors, homeColors, radius, shadows, space, touchTarget } from '@/theme';

export const facilityVisuals = {
  toilets: { icon: 'figure.dress.line.vertical.figure', color: colors.primary, surface: colors.tint },
  pets: { icon: 'pawprint', color: colors.primarySoft, surface: colors.tint },
  parks: { icon: 'tree', color: colors.primary, surface: colors.tint },
} satisfies Record<FacilityCategory, { icon: IconName; color: string; surface: string }>;

export type NearbyFacilitiesMapHandle = { moveTo: (region: Region) => void };

export function NearbyFacilitiesMap({ mapRef, initialRegion, devicePoint, placePin, items, selectedId, emptyMessage, areaPending,
  locating, onLocate, onViewportChange, onCameraMove, onMapInteraction, onAreaBrowsed, onSearchArea, onSelect, onDismiss, onShowList }: {
  mapRef: RefObject<NearbyFacilitiesMapHandle | null>;
  initialRegion: Region;
  devicePoint?: Coordinates;
  placePin?: { point: Coordinates; name: string };
  items: NearbyFacility[];
  selectedId?: string;
  emptyMessage: string;
  areaPending: boolean;
  locating: boolean;
  onLocate: () => void;
  onViewportChange: (region: Region) => void;
  onCameraMove: (region: Region) => void;
  onMapInteraction: () => void;
  onAreaBrowsed: () => void;
  onSearchArea: () => void;
  onSelect: (item: NearbyFacility) => void;
  onDismiss: () => void;
  onShowList: () => void;
}) {
  const { copy, locale } = useLanguage();
  const labels = copy.nearby;
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [region, setRegion] = useState(initialRegion);
  const [mapSeed, setMapSeed] = useState(initialRegion);
  const [isMoving, setIsMoving] = useState(false);
  const [size, setSize] = useState({ width: 360, height: 420 });
  const nativeMap = useRef<MapView | null>(null);
  const mapReady = useRef(false);
  const pendingCamera = useRef<Region | undefined>(undefined);
  const observing = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [motion] = useState(() => createNearbyMapMotion(initialRegion));
  const markers = useMemo(() => visibleFacilityMarkers(items, region, size, selectedId), [items, region, size, selectedId]);
  const hasClusters = markers.some((marker) => marker.kind === 'cluster');
  const hasVisibleSelection = markers.some((marker) => marker.kind === 'facility' && marker.item.id === selectedId);
  const showSearchArea = areaPending && !isMoving;
  const showPlace = placePin && !areaPending && !isMoving
    && Math.abs(placePin.point.latitude - region.latitude) <= region.latitudeDelta / 2
    && Math.abs(placePin.point.longitude - region.longitude) <= region.longitudeDelta / 2;

  const clearSettling = useCallback(() => {
    clearTimeout(settleTimer.current);
    settleTimer.current = undefined;
    motion.endGesture();
  }, [motion]);

  const moveTo = useCallback((target: Region) => {
    clearSettling();
    setIsMoving(false);
    motion.moveCamera(target, Date.now());
    onCameraMove(target);
    setRegion(target);
    if (mapReady.current) nativeMap.current?.animateToRegion(target, 250);
    else pendingCamera.current = target;
  }, [clearSettling, motion, onCameraMove]);
  useImperativeHandle(mapRef, () => ({ moveTo }), [moveTo]);

  useFocusEffect(useCallback(() => {
    observing.current = AppState.currentState !== 'background';
    setIsMoving(false);
    const subscription = AppState.addEventListener('change', (state) => {
      observing.current = state === 'active';
      if (!observing.current) {
        clearSettling();
        setIsMoving(false);
      }
    });
    return () => {
      subscription.remove();
      observing.current = false;
      clearSettling();
    };
  }, [clearSettling]));

  useFocusEffect(useCallback(() => {
    if (status !== 'loading') return;
    // MapKit exposes readiness but no tile-loading error event through this library.
    const timer = setTimeout(() => setStatus((current) => current === 'loading' ? 'error' : current), 12_000);
    return () => clearTimeout(timer);
  }, [status, attempt]));

  function noteGesture() {
    if (!observing.current) return;
    onMapInteraction();
    motion.noteGesture(Date.now());
  }

  function noteTouchStart(event: GestureResponderEvent) {
    if (!observing.current) return;
    onMapInteraction();
    if (event.nativeEvent.touches.length >= 2) noteGesture();
  }

  function changedRegion(next: Region, complete: boolean) {
    if (!observing.current) return;
    const change = motion.change(next, Date.now(), complete);
    if (!change) return;
    onViewportChange(next);
    clearTimeout(settleTimer.current);
    if (complete) setRegion(next);
    else setIsMoving(true);
    settleTimer.current = setTimeout(() => {
      clearSettling();
      setIsMoving(false);
      if (change.userMoved && observing.current) onAreaBrowsed();
    }, complete ? 160 : 500);
  }

  return (
    <View style={styles.container} onLayout={({ nativeEvent: { layout: { width, height } } }) => {
      if (width > 0 && height > 0) setSize((current) => current.width === width && current.height === height ? current : { width, height });
    }}>
      <MapBoundary key={attempt} onFailure={() => setStatus('error')}>
        <MapView
          ref={nativeMap}
          style={StyleSheet.absoluteFill}
          accessibilityLabel={labels.map}
          initialRegion={mapSeed}
          showsPointsOfInterests={false}
          showsUserLocation={false}
          onMapReady={() => {
            mapReady.current = true;
            setStatus('ready');
            const target = pendingCamera.current;
            pendingCamera.current = undefined;
            if (target) moveTo(target);
          }}
          onTouchStart={noteTouchStart}
          onTouchMove={(event) => {
            if (event.nativeEvent.touches.length >= 2) noteGesture();
          }}
          onPanDrag={noteGesture}
          onDoublePress={noteGesture}
          onRegionChange={(next) => changedRegion(next, false)}
          onRegionChangeComplete={(next) => changedRegion(next, true)}
          onPress={({ nativeEvent }) => {
            // MapKit can send a map tap for the same touch as a marker press.
            if (nativeEvent.action !== 'marker-press'
              && !hitsFacilityMarker(nativeEvent.coordinate, markers, region, size, devicePoint)
              && !(placePin && hitsFacilityMarker(nativeEvent.coordinate, [], region, size, placePin.point))) onDismiss();
          }}
        >
          {markers.map((marker) => {
            if (marker.kind === 'cluster') {
              return (
                <Marker key={marker.id} identifier={marker.id} coordinate={marker.coordinate} stopPropagation
                  accessibilityRole="button" accessibilityLabel={labels.facilityCluster(marker.count)}
                  onPress={() => {
                    onMapInteraction();
                    moveTo(marker.zoomRegion);
                  }}>
                  <View style={styles.clusterPin}>
                    <AppText variant="caption" tone="onPrimary" allowFontScaling={false}>{marker.count}</AppText>
                  </View>
                </Marker>
              );
            }
            const { facility, id } = marker.item;
            const selected = id === selectedId;
            const visual = facilityVisuals[facility.category];
            const name = facilityText(facility.name, locale);
            // An accessibility label names the pin without enabling a native name callout.
            return (
              <Marker
                key={id}
                identifier={id}
                coordinate={facility.coordinate}
                accessibilityRole="button"
                accessibilityLabel={marker.count > 1 ? labels.samePointMarker(name, marker.count)
                  : `${name} · ${facility.category === 'pets' ? petFacilityType(facility, labels) : labels.categories[facility.category]}`}
                accessibilityState={{ selected }}
                zIndex={selected ? 1 : 0}
                stopPropagation
                onPress={() => {
                  clearSettling();
                  setIsMoving(false);
                  onSelect(marker.item);
                }}
              >
                <View style={[styles.facilityPin, { backgroundColor: visual.color }, selected && styles.selectedPin,
                  hasVisibleSelection && !selected && styles.dimmedPin]}>
                  <Icon name={visual.icon} color={colors.onPrimary} size={16} />
                  {marker.count > 1 && (
                    <View style={styles.samePointCount}>
                      <AppText variant="caption" tone="primary" allowFontScaling={false}>{marker.count}</AppText>
                    </View>
                  )}
                </View>
              </Marker>
            );
          })}
          {devicePoint && (
            <Marker identifier="device-location" coordinate={devicePoint} pinColor={homeColors.blueInk}
              accessibilityLabel={copy.nearbyBus.currentLocation} stopPropagation />
          )}
          {placePin && (
            <Marker identifier="search-center" coordinate={placePin.point} accessibilityLabel={placePin.name} stopPropagation>
              <View style={styles.placePin}><Icon name="mappin" color={colors.primary} size={22} /></View>
            </Marker>
          )}
        </MapView>
      </MapBoundary>

      {status === 'ready' ? (
        <>
          {(showSearchArea || showPlace || hasClusters || !markers.length) && (
            <View pointerEvents="box-none" style={styles.markerNotice}>
              {showSearchArea && (
                <Pressable accessibilityRole="button" accessibilityHint={labels.searchAreaHint} onPress={() => {
                  clearSettling();
                  onSearchArea();
                }}
                  style={({ pressed }) => [styles.searchArea, pressed && styles.pressed]}>
                  <AppText variant="homeCardTitle" tone="onPrimary" style={styles.searchAreaText}>{labels.searchArea}</AppText>
                </Pressable>
              )}
              {showPlace && (
                <View pointerEvents="none">
                  <AppText variant="caption" tone="primary" style={styles.markerNoticeText}>{labels.showingNear(placePin.name)}</AppText>
                </View>
              )}
              {(hasClusters || !markers.length) && (
                <View pointerEvents="none">
                  <AppText variant="caption" tone="muted" style={styles.markerNoticeText}>
                    {hasClusters ? labels.zoomForFacilities : emptyMessage}
                  </AppText>
                </View>
              )}
            </View>
          )}
          <Pressable accessibilityRole="button" accessibilityLabel={locating ? copy.nearbyBus.locating : labels.useLocation}
            accessibilityState={{ busy: locating, disabled: locating }} disabled={locating} onPress={onLocate}
            style={({ pressed }) => [styles.locationAction, pressed && styles.pressed]}>
            {locating ? <ActivityIndicator color={colors.primary} /> : <Icon name="location" size={22} />}
          </Pressable>
        </>
      ) : status === 'loading' ? (
        <View pointerEvents="none" style={styles.overlay}>
          <View style={styles.status}>
            <ActivityIndicator color={colors.primary} />
            <AppText variant="detail" tone="muted">{labels.mapLoading}</AppText>
          </View>
        </View>
      ) : (
        <View style={styles.overlay}>
          <View style={styles.error} accessibilityLiveRegion="polite">
            <AppText variant="homeCardTitle" accessibilityRole="alert">{labels.mapUnavailable}</AppText>
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" onPress={() => {
                clearSettling();
                setIsMoving(false);
                mapReady.current = false;
                pendingCamera.current = undefined;
                setMapSeed(motion.getVisible());
                setStatus('loading');
                setAttempt((value) => value + 1);
              }} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
                <AppText variant="detail" tone="primary">{labels.retryMap}</AppText>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={onShowList}
                style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
                <AppText variant="detail" tone="primary">{labels.showList}</AppText>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.tint },
  facilityPin: {
    width: 32, height: 32, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
  },
  selectedPin: { borderColor: colors.text },
  dimmedPin: { opacity: 0.66 },
  samePointCount: {
    position: 'absolute', top: -4, right: -4, minWidth: 15, minHeight: 15, paddingHorizontal: 2,
    borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  clusterPin: {
    width: 38, height: 38, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.surface,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  placePin: {
    width: 34, height: 34, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.primary,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  locationAction: {
    position: 'absolute', right: space.lg, bottom: space.section, width: 48, height: 48,
    alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadows.search,
  },
  markerNotice: {
    position: 'absolute', left: space.lg, top: space.sm, right: space.lg, alignItems: 'center', gap: space.xs,
  },
  markerNoticeText: {
    textAlign: 'center', paddingHorizontal: space.sm, paddingVertical: space.xs,
    backgroundColor: colors.surface, borderRadius: radius.pill,
  },
  searchArea: {
    maxWidth: '100%', minHeight: touchTarget, paddingVertical: space.sm, paddingHorizontal: space.xl,
    borderRadius: radius.pill, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    ...shadows.search,
  },
  searchAreaText: { textAlign: 'center' },
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center', padding: space.lg },
  status: {
    flexDirection: 'row', gap: space.sm, alignItems: 'center', padding: space.md,
    backgroundColor: colors.surface, borderRadius: radius.card,
  },
  error: {
    width: '100%', maxWidth: 380, backgroundColor: colors.surface, borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: space.lg, gap: space.sm,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  action: { justifyContent: 'center', minHeight: touchTarget, paddingHorizontal: space.sm },
  pressed: { opacity: 0.72 },
});
