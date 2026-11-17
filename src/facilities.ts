import { distanceBetween, isNearHongKong, type Coordinates } from '@/nearby-bus-data';

export const facilityCategories = ['toilets', 'pets', 'parks'] as const;
export type FacilityCategory = (typeof facilityCategories)[number];
export type FacilityFilter = 'all' | FacilityCategory;

type FacilityLocale = 'zh-HK' | 'en';
type FacilityText = { 'zh-HK': string; en?: string } | { en: string; 'zh-HK'?: string };

export type Facility = {
  source: string;
  officialId: string;
  sourceUrl: string;
  category: FacilityCategory;
  name: FacilityText;
  address?: FacilityText;
  district?: FacilityText;
  coordinate: Coordinates;
  updatedAt?: string;
};

export type NearbyFacility = { id: string; facility: Facility; distance: number };

// Only verified records from future official dataset adapters belong here.
export const nearbyFacilities: readonly Facility[] = [];

export function facilityFilter(value: unknown): FacilityFilter {
  return facilityCategories.find((category) => category === value) ?? 'all';
}

export function facilityId({ source, officialId }: Facility) {
  return JSON.stringify([source, officialId]);
}

export function facilityText(text: FacilityText, locale: FacilityLocale) {
  return text[locale]?.trim() || text[locale === 'en' ? 'zh-HK' : 'en']?.trim() || '';
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
