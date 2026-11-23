import type { Messages } from '@/i18n';
import type { TramDirection, TramDirectionId } from '@/tram-static';

// Phase 4C0 audit. The official sequence ID alone does not encode east/west.
const mainLineEastbound: Readonly<Partial<Record<number, TramDirectionId>>> = {
  4001: 2, 4002: 2, 4003: 1, 4004: 1, 4005: 2, 4007: 2,
};

export function tramDirectionLabel(direction: TramDirection, labels: Messages['tram'], locale: 'zh-HK' | 'en') {
  const eastbound = mainLineEastbound[direction.routeId];
  if (!eastbound) return labels.towards(direction.visits[direction.visits.length - 1].stop.localizedStopNames[locale]);
  const bound = eastbound === direction.directionId ? labels.eastbound : labels.westbound;
  return direction.routeId === 4002 || direction.routeId === 4003 ? labels.branchBound(bound) : bound;
}
