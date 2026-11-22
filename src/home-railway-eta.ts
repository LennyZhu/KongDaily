import { lightRailForecastView, type LightRailReading, type LightRailTrain } from '@/light-rail-realtime';
import { mtrForecastView, type MtrReading } from '@/mtr-realtime';
import type { NextTrainClock } from '@/next-train-time';

export function homeMtrPreview(reading: MtrReading, now: NextTrainClock) {
  const view = mtrForecastView(reading, now);
  if (view.kind === 'stale') return { ...view, updatedAt: 'updatedAt' in reading.payload ? reading.payload.updatedAt : undefined };
  if (view.kind !== 'ready') return view;
  // Preserve both official directions; each shows its next valid train, never an unlabeled mixture.
  return { ...view, groups: view.groups.map((group) => ({ ...group, trains: group.trains.slice(0, 1) })) };
}

export function homeLightRailPreview(reading: LightRailReading, now: NextTrainClock, routeId: string) {
  const view = lightRailForecastView(reading, now);
  if (view.kind !== 'ready') return { kind: view.kind, updatedAt: 'updatedAt' in view ? view.updatedAt : undefined };
  const matching = view.platforms.flatMap(({ id, trains }) => {
    const regular = trains.filter(({ route }) => route.kind === 'regular' && route.code === routeId);
    return regular.length ? [{ id, trains: regular }] : [];
  });
  const platforms = matching.flatMap(({ id, trains }) => {
    const next = trains.filter((train) => !train.serviceIssue && train.time.kind !== 'unknown')
      .sort((a, b) => predictionOrder(a) - predictionOrder(b))[0];
    return next ? [{ id, train: next }] : [];
  });
  if (!platforms.length) {
    const kind = matching.some(({ trains }) => trains.some(({ serviceIssue }) => serviceIssue)) ? 'serviceIssue'
      : matching.length ? 'noTime' : 'empty';
    return { kind, updatedAt: view.updatedAt } as const;
  }
  // Pick the soonest two platforms, keeping provider order on ties. Never infer a direction from a platform.
  platforms.sort((a, b) => predictionOrder(a.train) - predictionOrder(b.train));
  return { kind: 'ready' as const, platforms: platforms.slice(0, 2), hasMore: platforms.length > 2, updatedAt: view.updatedAt };
}

function predictionOrder({ time }: LightRailTrain) {
  // Imminent/arriving/departing retain their official text; this priority is never rendered as a fabricated zero.
  return time.kind === 'minutes' ? time.minutes : time.kind === 'unknown' ? Infinity : 0;
}
