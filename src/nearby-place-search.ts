import { nearbyFacilities, type Facility } from '@/facilities';
import { messages } from '@/i18n';
import { normalizePlaceQuery, type LandsdPlace } from '@/landsd-location-search';
import { nearbyBusLandmarks, type NearbyLandmark } from '@/nearby-bus-landmarks';

export type NearbySearchResult = { kind: 'facility'; facility: Facility }
  | { kind: 'landmark'; landmark: NearbyLandmark }
  | { kind: 'place'; place: LandsdPlace };

const searchable = (value: string) => normalizePlaceQuery(value).toLowerCase();
const namesOf = (field?: Facility['name']) => [field?.['zh-HK'], field?.en]
  .flatMap((value) => value ? [searchable(value)] : []);
const facilities = nearbyFacilities.map((facility) => ({
  facility,
  names: [facility.name, facility.aliases].flatMap(namesOf),
  details: [facility.district, facility.area, facility.address].flatMap(namesOf),
}));
const landmarkOrder: NearbyLandmark[] = ['central', ...(Object.keys(nearbyBusLandmarks) as NearbyLandmark[])
  .filter((landmark) => landmark !== 'central')];
const landmarks = landmarkOrder.map((landmark) => ({
  landmark,
  names: [messages['zh-HK'].nearbyBus.landmarks[landmark], messages.en.nearbyBus.landmarks[landmark]].map(searchable),
}));

function match(names: string[], details: string[], query: string, terms: string[]) {
  if (names.includes(query)) return 0;
  if (names.some((name) => name.startsWith(query))) return 1;
  if (names.some((name) => terms.every((term) => name.includes(term)))) return 2;
  if (terms.every((term) => [...names, ...details].some((field) => field.includes(term)))) return 3;
  return Infinity;
}

export function searchNearbyPlaces(input: string) {
  const query = searchable(input);
  if (!query) return { facilities: [], facilityCount: 0, landmarks: landmarkOrder };
  const terms = query.split(' ');
  const facilityMatches = facilities.map((item) => ({ facility: item.facility, rank: match(item.names, item.details, query, terms) }))
    .filter(({ rank }) => Number.isFinite(rank)).sort((a, b) => a.rank - b.rank);
  return {
    facilities: facilityMatches.slice(0, 15).map((item) => item.facility),
    facilityCount: facilityMatches.length,
    landmarks: landmarks.map((item) => ({ landmark: item.landmark, rank: match(item.names, [], query, terms) }))
      .filter(({ rank }) => Number.isFinite(rank)).sort((a, b) => a.rank - b.rank).map((item) => item.landmark),
  };
}
