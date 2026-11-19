import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, type Region } from 'react-native-maps';

import { numberedBusMapStops, type BusMapMarker } from '@/bus-route-map';
import type { RouteStop } from '@/bus-stops';
import { BusAction } from '@/components/bus-ui';
import { MapBoundary } from '@/components/map-boundary';
import { AppText } from '@/components/ui';
import { useLanguage } from '@/language';
import type { Coordinates } from '@/nearby-bus-data';
import { colors, radius, space, touchTarget } from '@/theme';

const padding = { top: 36, left: 36, bottom: 36, right: 36 };

export function BusStopMap({ markers, lines, selected, focusRequest, stopLabel, onSelect }: {
  markers: readonly BusMapMarker[];
  lines?: Coordinates[][];
  selected?: string;
  focusRequest?: { key: string };
  stopLabel: (stop: RouteStop) => string;
  onSelect: (key: string) => void;
}) {
  const { copy } = useLanguage();
  const labels = copy.busMap;
  const map = useRef<MapView>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [size, setSize] = useState<{ width: number; height: number }>();
  const [region, setRegion] = useState<Region>();
  const userMoved = useRef(false);
  const lastFocused = useRef<typeof focusRequest>(undefined);
  const first = markers[0].coordinate;
  const initialRegion = useMemo(() => ({ ...first, latitudeDelta: 0.009, longitudeDelta: 0.009 }), [first]);
  const numbered = useMemo(() => numberedBusMapStops(markers, selected, region ?? initialRegion, size),
    [markers, selected, region, initialRegion, size]);
  const focusPoint = markers.find(({ key }) => key === focusRequest?.key)?.coordinate;

  useEffect(() => {
    if (status !== 'loading') return;
    const timer = setTimeout(() => setStatus('error'), 12_000);
    return () => clearTimeout(timer);
  }, [status, attempt]);

  useEffect(() => {
    if (status !== 'ready' || !size || userMoved.current) return;
    const points = markers.map(({ coordinate }) => coordinate);
    if (points.every(({ latitude, longitude }) => latitude === first.latitude && longitude === first.longitude)) return;
    const frame = requestAnimationFrame(() => {
      if (!userMoved.current) map.current?.fitToCoordinates(points, { edgePadding: padding, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [status, size, markers, first]);

  useEffect(() => {
    if (status !== 'ready' || !size || !focusRequest || !focusPoint || lastFocused.current === focusRequest) return;
    userMoved.current = true;
    lastFocused.current = focusRequest;
    map.current?.animateCamera({ center: focusPoint }, { duration: 250 });
  }, [status, size, focusRequest, focusPoint]);

  return (
    <View style={styles.mapCard}>
      <MapBoundary key={attempt} onFailure={() => setStatus('error')}>
        <MapView
          ref={map}
          style={StyleSheet.absoluteFill}
          initialRegion={initialRegion}
          accessibilityLabel={labels.stopMap}
          showsPointsOfInterests={false}
          showsUserLocation={false}
          onMapReady={() => setStatus('ready')}
          onLayout={({ nativeEvent: { layout: { width, height } } }) => {
            if (width > 0 && height > 0) setSize({ width, height });
          }}
          onRegionChangeComplete={setRegion}
          onTouchStart={() => { userMoved.current = true; }}
        >
          {lines?.map((coordinates, index) => (
            <Polyline key={index} coordinates={coordinates} strokeColor={colors.primary} strokeWidth={4} />
          ))}
          {markers.map(({ key, stop, coordinate }) => {
            const active = selected === key;
            const showNumber = numbered.has(key);
            return (
              <Marker key={key} identifier={key} coordinate={coordinate} stopPropagation
                accessibilityRole="button" accessibilityLabel={stopLabel(stop)}
                accessibilityState={{ selected: active }} zIndex={active ? 2 : showNumber ? 1 : 0}
                onPress={() => onSelect(key)}>
                <View style={styles.pinTarget}>
                  {showNumber ? (
                    <View style={[styles.pin, active && styles.selectedPin]}>
                      <AppText variant="caption" tone={active ? 'onPrimary' : 'primary'} allowFontScaling={false}>
                        {stop.seq}
                      </AppText>
                    </View>
                  ) : <View style={styles.dot} />}
                </View>
              </Marker>
            );
          })}
        </MapView>
      </MapBoundary>
      {status !== 'ready' && (
        <View style={styles.overlay} pointerEvents={status === 'loading' ? 'none' : 'auto'}>
          {status === 'loading' ? (
            <View style={styles.message} accessibilityRole="progressbar" accessibilityLabel={copy.nearby.mapLoading}>
              <ActivityIndicator color={colors.primary} />
              <AppText variant="detail" tone="muted">{copy.nearby.mapLoading}</AppText>
            </View>
          ) : (
            <View style={styles.message}>
              <AppText variant="detail" accessibilityRole="alert">{labels.mapUnavailable}</AppText>
              <BusAction label={copy.nearby.retryMap} onPress={() => {
                userMoved.current = false;
                lastFocused.current = undefined;
                setSize(undefined);
                setRegion(undefined);
                setStatus('loading');
                setAttempt((value) => value + 1);
              }} />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mapCard: {
    height: 300,
    backgroundColor: colors.tint,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  pinTarget: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
  pin: {
    minWidth: 32, height: 32, paddingHorizontal: space.xs, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.pill, borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.surface,
  },
  dot: {
    width: 12, height: 12, borderRadius: radius.pill, borderWidth: 2,
    borderColor: colors.primary, backgroundColor: colors.surface,
  },
  selectedPin: { backgroundColor: colors.primary, borderColor: colors.surface },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: space.md },
  message: { gap: space.sm, padding: space.md, borderRadius: radius.control, backgroundColor: colors.surface },
});
