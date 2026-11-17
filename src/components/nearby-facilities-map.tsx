import { useFocusEffect } from 'expo-router';
import { Component, useCallback, useMemo, useState, type ReactNode, type RefObject } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';

import { AppText, Icon, type IconName } from '@/components/ui';
import { facilityText, hitsFacilityMarker, visibleFacilityMarkers, type FacilityCategory, type NearbyFacility } from '@/facilities';
import { useLanguage } from '@/language';
import type { Coordinates } from '@/nearby-bus-data';
import { colors, homeColors, radius, shadows, space, touchTarget } from '@/theme';

export const facilityVisuals = {
  toilets: { icon: 'figure.dress.line.vertical.figure', color: colors.primary, surface: colors.tint },
  pets: { icon: 'pawprint', color: homeColors.rustInk, surface: homeColors.peach },
  parks: { icon: 'tree', color: homeColors.greenInk, surface: homeColors.green },
} satisfies Record<FacilityCategory, { icon: IconName; color: string; surface: string }>;

export function NearbyFacilitiesMap({ mapRef, initialRegion, devicePoint, items, selectedId, emptyMessage,
  onRegionChange, onSelect, onDismiss, onRecenter, onShowList }: {
  mapRef: RefObject<MapView | null>;
  initialRegion: Region;
  devicePoint?: Coordinates;
  items: NearbyFacility[];
  selectedId?: string;
  emptyMessage: string;
  onRegionChange: (region: Region) => void;
  onSelect: (item: NearbyFacility) => void;
  onDismiss: () => void;
  onRecenter: () => void;
  onShowList: () => void;
}) {
  const { copy, locale } = useLanguage();
  const labels = copy.nearby;
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [region, setRegion] = useState(initialRegion);
  const [size, setSize] = useState({ width: 360, height: 420 });
  const markers = useMemo(() => visibleFacilityMarkers(items, region, size, selectedId), [items, region, size, selectedId]);
  const hasClusters = markers.some((marker) => marker.kind === 'cluster');
  const hasVisibleSelection = markers.some((marker) => marker.kind === 'facility' && marker.item.id === selectedId);

  useFocusEffect(useCallback(() => {
    if (status !== 'loading') return;
    // MapKit exposes readiness but no tile-loading error event through this library.
    const timer = setTimeout(() => setStatus((current) => current === 'loading' ? 'error' : current), 12_000);
    return () => clearTimeout(timer);
  }, [status, attempt]));

  return (
    <View style={styles.container} onLayout={({ nativeEvent: { layout: { width, height } } }) => {
      if (width > 0 && height > 0) setSize((current) => current.width === width && current.height === height ? current : { width, height });
    }}>
      <MapBoundary key={attempt} onFailure={() => setStatus('error')}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          accessibilityLabel={labels.map}
          initialRegion={initialRegion}
          showsPointsOfInterests={false}
          showsUserLocation={false}
          onMapReady={() => setStatus('ready')}
          onRegionChangeComplete={(next) => {
            setRegion(next);
            onRegionChange(next);
          }}
          onPress={({ nativeEvent }) => {
            // MapKit can send a map tap for the same touch as a marker press.
            if (nativeEvent.action !== 'marker-press'
              && !hitsFacilityMarker(nativeEvent.coordinate, markers, region, size, devicePoint)) onDismiss();
          }}
        >
          {markers.map((marker) => {
            if (marker.kind === 'cluster') {
              return (
                <Marker key={marker.id} identifier={marker.id} coordinate={marker.coordinate} stopPropagation
                  accessibilityRole="button" accessibilityLabel={labels.facilityCluster(marker.count)}
                  onPress={() => {
                    onRegionChange(marker.zoomRegion);
                    mapRef.current?.animateToRegion(marker.zoomRegion, 250);
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
                  : `${name} · ${labels.categories[facility.category]}`}
                accessibilityState={{ selected }}
                zIndex={selected ? 1 : 0}
                stopPropagation
                onPress={() => onSelect(marker.item)}
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
        </MapView>
      </MapBoundary>

      {status === 'ready' && (hasClusters || !markers.length) && (
        <View pointerEvents="none" style={styles.markerNotice}>
          <AppText variant="caption" tone="muted" style={styles.markerNoticeText}>
            {hasClusters ? labels.zoomForFacilities : emptyMessage}
          </AppText>
        </View>
      )}
      {status === 'ready' ? (
        <Pressable accessibilityRole="button" accessibilityLabel={labels.recenter} onPress={onRecenter}
          style={({ pressed }) => [styles.recenter, pressed && styles.pressed]}>
          <Icon name="location" size={22} />
        </Pressable>
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

class MapBoundary extends Component<{ children: ReactNode; onFailure: () => void }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onFailure();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
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
  markerNotice: {
    position: 'absolute', left: space.lg, top: space.sm, right: space.lg, alignItems: 'center',
  },
  markerNoticeText: {
    textAlign: 'center', paddingHorizontal: space.sm, paddingVertical: space.xs,
    backgroundColor: colors.surface, borderRadius: radius.pill,
  },
  recenter: {
    position: 'absolute', right: space.lg, bottom: space.md, width: touchTarget, height: touchTarget,
    borderRadius: radius.pill, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
    ...shadows.search,
  },
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
