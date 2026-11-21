import farePack from '../assets/data/nearby-bus-fares.json';

import type { EtaTarget } from '@/bus-eta';
import { routeStopKey } from '@/bus-stops';

type FareRoute = {
  number: string;
  fullCents: number;
  boarding: Record<string, { stopId: string; cents: number } | undefined>;
};
type FarePack = {
  version: number;
  datasetDate: string;
  reviewedDate: string;
  records: Record<string, FareRoute | undefined>;
};
type AdultFare = { scope: 'boarding' | 'full'; cents: number };

const maxAge = 14 * 24 * 60 * 60 * 1_000;

function hongKongMidnight(date: string) {
  const midnight = Date.parse(`${date}T00:00:00+08:00`);
  return Number.isFinite(midnight) && new Date(midnight + 8 * 60 * 60 * 1_000).toISOString().slice(0, 10) === date
    ? midnight : NaN;
}

function validCents(cents: number) {
  return Number.isSafeInteger(cents) && cents > 0;
}

export function readAdultBusFare(target: EtaTarget, now: number, pack: FarePack = farePack): AdultFare | undefined {
  if (pack.version !== 1) return;
  const route = pack.records[routeStopKey(target)];
  if (!route || route.number !== target.number || !validCents(route.fullCents)) return;

  const revision = hongKongMidnight(pack.datasetDate);
  const review = hongKongMidnight(pack.reviewedDate);
  if (!(revision <= review && review <= now && now < revision + maxAge)) return;

  const visit = route.boarding[target.stopSeq];
  if (!target.repeatedStop && visit?.stopId === target.stopId && validCents(visit.cents) && visit.cents <= route.fullCents) {
    return { scope: 'boarding', cents: visit.cents };
  }
  return { scope: 'full', cents: route.fullCents };
}

export function formatAdultBusFare(cents: number) {
  return `HK$${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}
