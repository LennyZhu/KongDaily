import afcd from '../assets/data/afcd-toilet-identity-registry.json';
import fehd from '../assets/data/fehd-toilet-identity-registry.json';
import inclusiveParks from '../assets/data/lcsd-inclusive-pet-park-identity-registry.json';
import parks from '../assets/data/lcsd-park-identity-registry.json';
import petGardens from '../assets/data/lcsd-pet-garden-identity-registry.json';

import { facilityId, facilityText, nearbyFacilities, type Facility, type FacilityCategory } from '@/facilities';
import { isNearHongKong } from '@/nearby-bus-data';

export type FacilityDisplayIdentity = Pick<Facility, 'source' | 'officialId'>;
export type FacilityFavoriteIdentity = { source: string; stableFacilityId: string };

type FacilityAnchor = Pick<Facility, 'name' | 'address' | 'district' | 'area' | 'officialType' | 'coordinate' | 'serviceNotice'>;
type Registration = FacilityFavoriteIdentity & {
  displayId: string;
  category: FacilityCategory;
  anchor: FacilityAnchor;
  retired?: boolean;
};

type UnresolvedFacility = { status: 'unavailable' | 'needs_review' };
export type FacilityIdentityResolution = UnresolvedFacility | {
  status: 'available';
  identity: FacilityFavoriteIdentity;
  facility: Facility;
};

function sameText(first: Facility['address'], second: Facility['address']) {
  return first?.['zh-HK'] === second?.['zh-HK'] && first?.en === second?.en;
}

function matchesAnchor(facility: Facility, { anchor, category, source }: Registration) {
  const { latitude, longitude } = facility.coordinate;
  const officialTypeMatches = source === 'lcsd-pet-gardens'
    ? facility.officialType === 'PET GARDEN' || facility.officialType === 'DOG GARDENS/PET GARDENS'
    : facility.officialType === anchor.officialType;
  return facility.category === category && officialTypeMatches && isNearHongKong(facility.coordinate)
    && latitude === anchor.coordinate.latitude && longitude === anchor.coordinate.longitude
    && Boolean(facilityText(facility.name, 'zh-HK'))
    && sameText(facility.name, anchor.name) && sameText(facility.district, anchor.district)
    && sameText(facility.area, anchor.area) && sameText(facility.address, anchor.address)
    && (category !== 'toilets' || Boolean(facility.serviceNotice) === Boolean(anchor.serviceNotice));
}

export const facilityFavoriteKey = ({ source, stableFacilityId }: FacilityFavoriteIdentity) => JSON.stringify([source, stableFacilityId]);

// Null denotes a duplicate claim. Never choose one of several records by order.
function uniqueBy<T>(rows: readonly T[], keyOf: (row: T) => string) {
  const index = new Map<string, T | null>();
  for (const row of rows) {
    const key = keyOf(row);
    index.set(key, index.has(key) ? null : row);
  }
  return index;
}

export function createFacilityIdentityResolver(facilities: readonly Facility[], registrations: readonly Registration[]) {
  const catalog = uniqueBy(facilities, facilityId);
  const registrationByStable = uniqueBy(registrations, facilityFavoriteKey);
  const registrationByDisplay = uniqueBy(registrations.filter((row) => !row.retired),
    ({ source, displayId }) => facilityId({ source, officialId: displayId }));

  function resolveStable(identity: FacilityFavoriteIdentity): FacilityIdentityResolution {
    const registration = registrationByStable.get(facilityFavoriteKey(identity));
    if (registration === null) return { status: 'needs_review' };
    if (!registration || registration.retired) return { status: 'unavailable' };

    const key = facilityId({ source: registration.source, officialId: registration.displayId });
    const facility = catalog.get(key);
    if (!identity.source.trim() || !identity.stableFacilityId.trim() || !registration.displayId.trim()
      || registrationByDisplay.get(key) !== registration || facility === null) return { status: 'needs_review' };
    if (!facility) return { status: 'unavailable' };
    if (!matchesAnchor(facility, registration)) return { status: 'needs_review' };
    return { status: 'available', identity, facility };
  }

  function resolveCurrent(current: FacilityDisplayIdentity): FacilityIdentityResolution {
    const key = facilityId(current);
    const registration = registrationByDisplay.get(key);
    if (registration) return resolveStable({ source: registration.source, stableFacilityId: registration.stableFacilityId });
    return { status: registration === null || catalog.has(key) ? 'needs_review' : 'unavailable' };
  }

  return { resolveStable, resolveCurrent };
}

const toiletRegistrations: Registration[] = [fehd, afcd].flatMap(({ source, records }) => records.map((record) => ({
  source,
  category: 'toilets',
  stableFacilityId: record.stableFacilityId,
  displayId: record.officialRecordId,
  anchor: record.anchor,
  retired: 'retired' in record && record.retired === true,
})));

const registrations: Registration[] = [
  ...toiletRegistrations,
  ...parks.records.map((anchor): Registration => ({
    source: 'lcsd-parks', category: 'parks', stableFacilityId: anchor.id, displayId: anchor.id, anchor,
  })),
  ...petGardens.records.map((anchor): Registration => ({
    source: 'lcsd-pet-gardens', category: 'pets', stableFacilityId: anchor.id, displayId: anchor.id, anchor,
  })),
  ...inclusiveParks.records.map((anchor): Registration => ({
    source: 'lcsd-inclusive-pet-parks', category: 'pets', stableFacilityId: anchor.id, displayId: anchor.id,
    anchor: { ...anchor, officialType: 'inclusive_pet_park' },
  })),
];

const resolver = createFacilityIdentityResolver(nearbyFacilities, registrations);
export const resolveFacilityIdentity = resolver.resolveCurrent;
export const resolveStableFacilityIdentity = resolver.resolveStable;
