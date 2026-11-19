import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import type { BusMapMarker } from '@/bus-route-map';
import type { RouteStop } from '@/bus-stops';
import { BusAction } from '@/components/bus-ui';
import { MapBoundary } from '@/components/map-boundary';
import { AppText } from '@/components/ui';
import { useLanguage } from '@/language';
import { colors, radius, space, touchTarget } from '@/theme';

const padding = { top: 36, left: 36, bottom: 36, right: 36 };

export function BusStopMap({ markers, selected, stopLabel, onSelect }: {
  markers: readonly BusMapMarker[];
  selected?: string;
  stopLabel: (stop: RouteStop) => string;
  onSelect: (key: string) => void;
}) {
  const { copy } = useLanguage();
  const labels = copy.busMap;
  const map = useRef<MapView>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [hasLayout, setHasLayout] = useState(false);
  const userMoved = useRef(false);
  const first = markers[0].coordinate;

  useEffect(() => {
    if (status !== 'loading') return;
    const timer = setTimeout(() => setStatus('error'), 12_000);
    return () => clearTimeout(timer);
  }, [status, attempt]);

  useEffect(() => {
    if (status !== 'ready' || !hasLayout || userMoved.current) return;
    const points = markers.map(({ coordinate }) => coordinate);
    if (points.every(({ latitude, longitude }) => latitude === first.latitude && longitude === first.longitude)) return;
    const frame = requestAnimationFrame(() => {
      if (!userMoved.current) map.current?.fitToCoordinates(points, { edgePadding: padding, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [status, hasLayout, markers, first]);

  return (
    <View style={styles.mapCard}>
      <MapBoundary key={attempt} onFailure={() => setStatus('error')}>
        <MapView
          ref={map}
          style={StyleSheet.absoluteFill}
          initialRegion={{ ...first, latitudeDelta: 0.009, longitudeDelta: 0.009 }}
          accessibilityLabel={labels.stopMap}
          showsPointsOfInterests={false}
          showsUserLocation={false}
          onMapReady={() => setStatus('ready')}
          onLayout={() => setHasLayout(true)}
          onTouchStart={() => { userMoved.current = true; }}
        >
          {markers.map(({ key, stop, coordinate }) => (
            <Marker key={key} identifier={key} coordinate={coordinate} stopPropagation
              accessibilityRole="button" accessibilityLabel={stopLabel(stop)}
              accessibilityState={{ selected: selected === key }} zIndex={selected === key ? 1 : 0}
              onPress={() => onSelect(key)}>
              <View style={styles.pinTarget}>
                <View style={[styles.pin, selected === key && styles.selectedPin]}>
                  <AppText variant="caption" tone={selected === key ? 'onPrimary' : 'primary'} allowFontScaling={false}>
                    {stop.seq}
                  </AppText>
                </View>
              </View>
            </Marker>
          ))}
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
                setHasLayout(false);
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
  selectedPin: { backgroundColor: colors.primary, borderColor: colors.surface },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: space.md },
  message: { gap: space.sm, padding: space.md, borderRadius: radius.control, backgroundColor: colors.surface },
});
