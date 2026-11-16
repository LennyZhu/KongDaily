import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { stopVisitKey, type RouteStop, type RouteStopIdentity } from '@/bus-stops';
import { distanceBetween, isNearHongKong, readBusStopCoordinates, type Coordinates } from '@/nearby-bus-data';
import { locateNearbyBusStops, type NearbyLocationIssue } from '@/nearby-bus-location';

export type RouteRecommendationTarget = { identity: RouteStopIdentity; stops: RouteStop[] };
type Recommendation =
  | { kind: 'found'; visit: string; distance: number }
  | { kind: 'loading' | 'permission' | 'incomplete' | 'noNearby' | NearbyLocationIssue };

const maxDistance = 1000;
const positionReuseAge = 30_000;

export function nearestRouteStop({ identity, stops }: RouteRecommendationTarget, point: Coordinates,
  coordinates: ReadonlyMap<string, Coordinates>): Recommendation {
  if (!isNearHongKong(point)) return { kind: 'outside' };

  let nearest: Extract<Recommendation, { kind: 'found' }> | undefined;
  for (const [index, stop] of stops.entries()) {
    const position = coordinates.get(stop.id);
    if (!position || !isNearHongKong(position)) return { kind: 'incomplete' };

    // The current trip has no onward segment at its last visit, even when a loop visits that ID earlier.
    if (index === stops.length - 1) continue;
    const distance = distanceBetween(point, position);
    if (distance <= maxDistance && (!nearest || distance < nearest.distance)) {
      nearest = { kind: 'found', visit: stopVisitKey(identity, stop), distance };
    }
  }
  return nearest ?? { kind: 'noNearby' };
}

export function useRouteStopRecommendation(target: RouteRecommendationTarget | undefined) {
  const [result, setResult] = useState<{ target: RouteRecommendationTarget; value: Recommendation }>();
  const completed = useRef<RouteRecommendationTarget | undefined>(undefined);
  const recentPosition = useRef<{ point: Coordinates; at: number } | undefined>(undefined);
  const request = useRef<((prompt: boolean) => void) | undefined>(undefined);

  useFocusEffect(useCallback(() => {
    if (!target) return;
    const candidate = target;
    let pending: AbortController | undefined;

    function publish(value: Recommendation) {
      setResult({ target: candidate, value });
    }

    function start(prompt: boolean) {
      if (pending || AppState.currentState !== 'active' || (!prompt && completed.current === candidate)) return;
      const controller = new AbortController();
      pending = controller;
      publish({ kind: 'loading' });

      void (async (): Promise<Recommendation | undefined> => {
        const saved = recentPosition.current;
        let point: Coordinates;
        const age = saved ? Date.now() - saved.at : Infinity;
        if (saved && age >= 0 && age < positionReuseAge) {
          point = saved.point;
        } else {
          const location = await locateNearbyBusStops(controller.signal, prompt);
          if (controller.signal.aborted || AppState.currentState === 'background' || location.kind === 'cancelled') return;
          if (location.kind !== 'position') {
            return { kind: !prompt && location.kind === 'denied' ? 'permission' : location.kind };
          }
          point = location.point;
          recentPosition.current = { point, at: Date.now() };
        }

        const ids = [...new Set(candidate.stops.map((stop) => stop.id))];
        const coordinates = await readBusStopCoordinates(candidate.identity.source, ids);
        return nearestRouteStop(candidate, point, coordinates);
      })().catch((): Recommendation => ({ kind: 'incomplete' })).then((value) => {
        if (controller.signal.aborted || AppState.currentState === 'background' || !value) return;
        const permissionChanged = value.kind === 'permission' || value.kind === 'blocked' || value.kind === 'denied';
        completed.current = permissionChanged ? undefined : candidate;
        publish(value);
      }).finally(() => {
        if (pending === controller) pending = undefined;
      });
    }

    function cancel() {
      pending?.abort();
      pending = undefined;
    }

    request.current = start;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') start(false);
      else if (state === 'background') {
        recentPosition.current = undefined;
        cancel();
      }
    });
    start(false);
    return () => {
      cancel();
      request.current = undefined;
      subscription.remove();
    };
  }, [target]));

  return {
    recommendation: target && result?.target === target ? result.value : undefined,
    requestLocation: () => request.current?.(true),
  };
}
