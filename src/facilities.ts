import afcd from '../assets/data/afcd-toilets.json';
import fehd from '../assets/data/fehd-toilets.json';
import lcsdParks from '../assets/data/lcsd-parks.json';

import { distanceBetween, isNearHongKong, type Coordinates } from '@/nearby-bus-data';

export const facilityCategories = ['toilets', 'pets', 'parks'] as const;
export type FacilityCategory = (typeof facilityCategories)[number];
export type FacilityFilter = 'all' | FacilityCategory;

export type FacilityLocale = 'zh-HK' | 'en';
type FacilityText = { 'zh-HK': string; en?: string } | { en: string; 'zh-HK'?: string };

export type Facility = {
  source: string;
  officialId: string;
  sourceUrl: string;
  sourceName?: FacilityText;
  category: FacilityCategory;
  officialType?: string;
  typeName?: FacilityText;
  name: FacilityText;
  address?: FacilityText;
  district?: FacilityText;
  area?: FacilityText;
  coordinate: Coordinates;
  updatedAt?: string;
  openingHours?: FacilityText;
  details?: FacilityText;
  remarks?: FacilityText;
  serviceNotice?: boolean;
};

export type NearbyFacility = { id: string; facility: Facility; distance: number };

type FehdRecord = Omit<Facility, 'source' | 'sourceUrl' | 'sourceName' | 'typeName' | 'category'> & { officialType: string };
const fehdRecords: readonly FehdRecord[] = fehd.records;
const fehdTypeLabels: Record<string, FacilityText> = fehd.typeLabels;
const fehdSource = {
  source: 'fehd',
  sourceName: fehd.sourceName,
  sourceUrl: fehd.sources[fehd.primaryLocale === 'zh-HK' ? 'zh-HK' : 'en'].url,
  category: 'toilets',
} as const;
const afcdSource = {
  source: 'afcd',
  sourceName: afcd.sourceName,
  sourceUrl: afcd.source.url,
  category: 'toilets',
} as const;
const lcsdParkSource = {
  source: 'lcsd-parks',
  sourceName: lcsdParks.sourceName,
  sourceUrl: lcsdParks.source.url,
  category: 'parks',
} as const;

export const nearbyFacilitySources = [
  { ...fehdSource, snapshotDate: fehd.snapshotDate },
  { ...afcdSource, snapshotDate: afcd.snapshotDate },
  {
    ...lcsdParkSource,
    snapshotDate: lcsdParks.snapshotDate,
    revisionDate: lcsdParks.revisionDate,
    fetchedAt: lcsdParks.source.fetchedAt,
    recordCount: lcsdParks.records.length,
  },
] as const;

export const nearbyFacilities: readonly Facility[] = [
  ...fehdRecords.flatMap((record) => Object.hasOwn(fehdTypeLabels, record.officialType)
    ? [{ ...record, ...fehdSource, typeName: fehdTypeLabels[record.officialType] }] : []),
  ...afcd.records.map((record) => ({ ...record, ...afcdSource })),
  ...lcsdParks.records.map((record) => ({ ...record, ...lcsdParkSource })),
];

export function facilityFilter(value: unknown): FacilityFilter {
  return facilityCategories.find((category) => category === value) ?? 'all';
}

export function facilityId({ source, officialId }: Facility) {
  return JSON.stringify([source, officialId]);
}

export function facilityText(text: FacilityText, locale: FacilityLocale) {
  return text[locale]?.trim() || text[locale === 'en' ? 'zh-HK' : 'en']?.trim() || '';
}

export function facilityTextUsesFallback(text: FacilityText | undefined, locale: FacilityLocale) {
  return Boolean(text && !text[locale]?.trim() && facilityText(text, locale));
}

function isValidPoint(point: Coordinates) {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && isNearHongKong(point);
}

export function indexNearbyFacilities(
  facilities: readonly Facility[], filter: FacilityFilter, point: Coordinates,
): NearbyFacility[] {
  if (!isValidPoint(point)) return [];
  const matches = new Map<string, NearbyFacility>();
  for (const facility of facilities) {
    if (!facility.source.trim() || !facility.officialId.trim() || !facilityText(facility.name, 'zh-HK')
      || !isValidPoint(facility.coordinate)
      || !facilityCategories.includes(facility.category) || (filter !== 'all' && facility.category !== filter)) continue;
    const id = facilityId(facility);
    if (!matches.has(id)) matches.set(id, { id, facility, distance: distanceBetween(point, facility.coordinate) });
  }
  return [...matches.values()].sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
}

type FacilityViewport = Coordinates & { latitudeDelta: number; longitudeDelta: number };
type MapSize = { width: number; height: number };
type FacilitySite = { coordinate: Coordinates; items: NearbyFacility[]; x: number; y: number };
type FacilityMarker =
  | { kind: 'facility'; item: NearbyFacility; coordinate: Coordinates; count: number }
  | { kind: 'cluster'; id: string; coordinate: Coordinates; count: number; zoomRegion: FacilityViewport };

const markerBudget = 100;
const clusterSpacing = 40;

function markerDistance(a: Coordinates, b: Coordinates, region: FacilityViewport, size: MapSize) {
  return Math.hypot(
    (a.longitude - b.longitude) * size.width / region.longitudeDelta,
    (a.latitude - b.latitude) * size.height / region.latitudeDelta,
  );
}

export function hitsFacilityMarker(
  point: Coordinates, markers: readonly FacilityMarker[], region: FacilityViewport, size: MapSize, devicePoint?: Coordinates,
) {
  const hits = (coordinate: Coordinates) => markerDistance(point, coordinate, region, size) <= 21;
  return markers.some(({ coordinate }) => hits(coordinate)) || Boolean(devicePoint && hits(devicePoint));
}

function groupSites(sites: FacilitySite[], spacing: number) {
  const groups: FacilitySite[][] = [];
  for (const site of sites) {
    const group = groups.find(([first]) => Math.hypot(first.x - site.x, first.y - site.y) < spacing);
    if (group) group.push(site);
    else groups.push([site]);
  }
  return groups;
}

export function visibleFacilityMarkers(
  items: readonly NearbyFacility[], region: FacilityViewport, size: MapSize, selectedId?: string,
): FacilityMarker[] {
  if (![region.latitude, region.longitude, region.latitudeDelta, region.longitudeDelta, size.width, size.height].every(Number.isFinite)
    || Math.min(region.latitudeDelta, region.longitudeDelta, size.width, size.height) <= 0) return [];
  // Buffer the viewport edges slightly so pins do not blink during small pans.
  const latitudeRange = region.latitudeDelta * 0.55;
  const longitudeRange = region.longitudeDelta * 0.55;
  const byCoordinate = new Map<string, FacilitySite>();
  for (const item of items) {
    const { coordinate } = item.facility;
    const latitudeOffset = coordinate.latitude - region.latitude;
    const longitudeOffset = coordinate.longitude - region.longitude;
    if (Math.abs(latitudeOffset) > latitudeRange || Math.abs(longitudeOffset) > longitudeRange) continue;
    const key = `${coordinate.latitude},${coordinate.longitude}`;
    const site = byCoordinate.get(key);
    if (site) {
      site.items.push(item);
    } else {
      byCoordinate.set(key, {
        coordinate, items: [item],
        x: longitudeOffset * size.width / region.longitudeDelta,
        y: latitudeOffset * size.height / region.latitudeDelta,
      });
    }
  }

  const sites = [...byCoordinate.values()];
  const selectedSite = selectedId ? sites.find((site) => site.items.some(({ id }) => id === selectedId)) : undefined;
  const remaining = sites.filter((site) => site !== selectedSite);
  let spacing = Math.max(region.latitudeDelta, region.longitudeDelta) <= 0.00035 ? 0 : clusterSpacing;
  let groups = spacing ? groupSites(remaining, spacing) : remaining.map((site) => [site]);
  // Meet the native marker budget by regrouping, keeping every record represented.
  const budget = markerBudget - Number(Boolean(selectedSite));
  while (groups.length > budget) {
    spacing = spacing ? spacing * 1.5 : clusterSpacing;
    groups = groupSites(remaining, spacing);
  }
  if (selectedSite) groups.push([selectedSite]);

  return groups.map(([first, ...rest]) => {
    if (!rest.length) {
      const item = first.items.find(({ id }) => id === selectedId) ?? first.items[0];
      return { kind: 'facility', item, coordinate: first.coordinate, count: first.items.length };
    }
    const group = [first, ...rest];
    const count = group.reduce((sum, site) => sum + site.items.length, 0);
    const latitude = group.reduce((sum, site) => sum + site.coordinate.latitude, 0) / group.length;
    const longitude = group.reduce((sum, site) => sum + site.coordinate.longitude, 0) / group.length;
    return {
      kind: 'cluster',
      id: `cluster:${first.items[0].id}`,
      coordinate: first.coordinate,
      count,
      zoomRegion: { latitude, longitude, latitudeDelta: region.latitudeDelta / 2, longitudeDelta: region.longitudeDelta / 2 },
    };
  });
}
