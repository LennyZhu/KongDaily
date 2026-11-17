import { useFocusEffect } from 'expo-router';
import { Component, useCallback, useState, type ReactNode, type RefObject } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';

import { AppText, Icon, type IconName } from '@/components/ui';
import { facilityText, type FacilityCategory, type NearbyFacility } from '@/facilities';
import { useLanguage } from '@/language';
import type { Coordinates } from '@/nearby-bus-data';
import { colors, homeColors, radius, shadows, space, touchTarget } from '@/theme';

export const facilityVisuals = {
  toilets: { icon: 'figure.dress.line.vertical.figure', color: colors.primary, surface: colors.tint },
  pets: { icon: 'pawprint', color: homeColors.rustInk, surface: homeColors.peach },
  parks: { icon: 'tree', color: homeColors.greenInk, surface: homeColors.green },
} satisfies Record<FacilityCategory, { icon: IconName; color: string; surface: string }>;

export function NearbyFacilitiesMap({ mapRef, initialRegion, devicePoint, items, selectedId,
  onRegionChange, onSelect, onDismiss, onRecenter, onShowList }: {
  mapRef: RefObject<MapView | null>;
  initialRegion: Region;
  devicePoint?: Coordinates;
  items: NearbyFacility[];
  selectedId?: string;
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

  useFocusEffect(useCallback(() => {
    if (status !== 'loading') return;
    // MapKit exposes readiness but no tile-loading error event through this library.
    const timer = setTimeout(() => setStatus((current) => current === 'loading' ? 'error' : current), 12_000);
    return () => clearTimeout(timer);
  }, [status, attempt]));

  return (
    <View style={styles.container}>
      <MapBoundary key={attempt} onFailure={() => setStatus('error')}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          accessibilityLabel={labels.map}
          initialRegion={initialRegion}
          showsPointsOfInterests={false}
          showsUserLocation={false}
          onMapReady={() => setStatus('ready')}
          onRegionChangeComplete={onRegionChange}
          onPress={({ nativeEvent }) => {
            if (nativeEvent.action !== 'marker-press') onDismiss();
          }}
        >
          {items.map((item) => {
            const { facility, id } = item;
            const selected = id === selectedId;
            return (
              <Marker
                key={id}
                identifier={id}
                coordinate={facility.coordinate}
                title={facilityText(facility.name, locale)}
                accessibilityLabel={`${facilityText(facility.name, locale)} · ${labels.categories[facility.category]}`}
                accessibilityState={{ selected }}
                pinColor={facilityVisuals[facility.category].color}
                opacity={selectedId && !selected ? 0.66 : 1}
                zIndex={selected ? 1 : 0}
                stopPropagation
                onPress={() => onSelect(item)}
              />
            );
          })}
          {devicePoint && (
            <Marker identifier="device-location" coordinate={devicePoint} pinColor={homeColors.blueInk}
              title={copy.nearbyBus.currentLocation} accessibilityLabel={copy.nearbyBus.currentLocation} stopPropagation />
          )}
        </MapView>
      </MapBoundary>

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
