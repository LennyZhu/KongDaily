import * as Location from 'expo-location';

import { isNearHongKong, type Coordinates } from '@/nearby-bus-data';

export type NearbyLocationIssue = 'denied' | 'blocked' | 'timeout' | 'imprecise' | 'outside' | 'unavailable';
type LocationResult = { kind: 'position'; point: Coordinates } | { kind: NearbyLocationIssue | 'cancelled' };

const locationTimeout = 12_000;
const searchAccuracy = 150;

function onePosition(signal: AbortSignal): Promise<LocationResult> {
  return new Promise((resolve) => {
    let finished = false;
    const timeout = setTimeout(() => finish({ kind: 'timeout' }), locationTimeout);
    const cancel = () => finish({ kind: 'cancelled' });

    function finish(result: LocationResult) {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      signal.removeEventListener('abort', cancel);
      resolve(result);
    }

    signal.addEventListener('abort', cancel);
    if (signal.aborted) {
      cancel();
      return;
    }
    // The iOS module makes a single Core Location request and returns one position.
    void Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).then(({ coords }) => {
      if (finished) return;
      const { latitude, longitude, accuracy } = coords;
      const point = { latitude, longitude };
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) finish({ kind: 'unavailable' });
      else if (!isNearHongKong(point)) finish({ kind: 'outside' });
      else if (accuracy === null || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > searchAccuracy) {
        finish({ kind: 'imprecise' });
      } else finish({ kind: 'position', point });
    }, () => finish({ kind: 'unavailable' }));
  });
}

// Both Nearby screens share one native prompt, even if a pending screen loses focus.
let foregroundPrompt: ReturnType<typeof Location.requestForegroundPermissionsAsync> | undefined;
let requestedUndeterminedPermission = false;

export async function locateNearbyBusStops(signal: AbortSignal, allowPermissionPrompt: boolean | 'undetermined' = true): Promise<LocationResult> {
  try {
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (signal.aborted) return { kind: 'cancelled' };
    if (!servicesEnabled) return { kind: 'unavailable' };

    let permission = await Location.getForegroundPermissionsAsync();
    if (signal.aborted) return { kind: 'cancelled' };
    if (!permission.granted) {
      if (!permission.canAskAgain) return { kind: 'blocked' };
      const initialPrompt = allowPermissionPrompt === 'undetermined';
      if (!allowPermissionPrompt || (initialPrompt && (permission.status !== 'undetermined'
          || (requestedUndeterminedPermission && !foregroundPrompt)))) return { kind: 'denied' };

      if (permission.status === 'undetermined') requestedUndeterminedPermission = true;
      foregroundPrompt ??= Location.requestForegroundPermissionsAsync().finally(() => { foregroundPrompt = undefined; });
      permission = await foregroundPrompt;
      if (signal.aborted) return { kind: 'cancelled' };
      if (!permission.granted) return { kind: initialPrompt && !permission.canAskAgain ? 'blocked' : 'denied' };
    }

    return await onePosition(signal);
  } catch {
    return { kind: signal.aborted ? 'cancelled' : 'unavailable' };
  }
}
