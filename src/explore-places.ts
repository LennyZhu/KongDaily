import content from '../assets/data/explore-places.json';

import type { LanguagePreference, Messages } from './i18n';

export type ExploreCategory = keyof Messages['explore']['categories'];
export type ExploreLocale = Exclude<LanguagePreference, 'system'>;

type ExploreText = Readonly<Record<ExploreLocale, string>>;
type SourcedExploreText = ExploreText & { readonly sourceIds: readonly string[] };

export type ExploreSource = Readonly<{
  id: string;
  organization: ExploreText;
  title: ExploreText;
  language: ExploreLocale | 'bilingual';
  url: string;
}>;

type ExploreDestination = Readonly<{
  name: ExploreText;
  coordinate: Readonly<{ latitude: number; longitude: number; crs: 'WGS84'; sourceUrl: string }>;
  role: 'trailhead' | 'venue-entrance' | 'pedestrian-arrival';
  evidenceSourceIds: readonly string[];
  verificationReport: string;
  reviewedAt: string;
}>;

export type ExploreNavigation =
  | Readonly<{ status: 'unverified' | 'not_applicable'; destination?: never }>
  | Readonly<{ status: 'verified'; destination: ExploreDestination }>;

export type ExplorePlace = Readonly<{
  id: string;
  category: ExploreCategory;
  additionalCategories: readonly ExploreCategory[];
  order: number;
  title: ExploreText;
  district: ExploreText;
  summary: ExploreText;
  highlights: readonly SourcedExploreText[];
  transport: SourcedExploreText;
  cautions: SourcedExploreText;
  sources: readonly ExploreSource[];
  reviewedAt: string;
  navigation: ExploreNavigation;
}>;

// JSON imports widen literal types. The bundled data is checked by scripts/test-explore-places.cjs.
const places = (content.places as readonly ExplorePlace[]).slice().sort((a, b) => a.order - b.order);

export const homeFeaturedPlaceIds = {
  dragon: 'dragons-back-to-tei-wan-tai-tam-gap',
  westKowloon: 'west-kowloon-art-park',
} as const;

export function getExplorePlaces(category?: ExploreCategory): readonly ExplorePlace[] {
  if (category === undefined) return places;
  return places.filter((place) => place.category === category || place.additionalCategories.includes(category));
}

export function getExplorePlace(id: string): ExplorePlace | undefined {
  return places.find((place) => place.id === id);
}

export function getExploreTrailhead(place: ExplorePlace | undefined) {
  if (!place || place.category !== 'hiking' || place.navigation.status !== 'verified'
    || (place.id !== homeFeaturedPlaceIds.dragon && place.id !== 'peak-circle-walk')) return;

  const { destination } = place.navigation;
  if (destination?.role !== 'trailhead' || destination.coordinate?.crs !== 'WGS84') return;
  const { latitude, longitude } = destination.coordinate;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < 22.13 || latitude > 22.57 || longitude < 113.82 || longitude > 114.48) return;

  return {
    name: destination.name,
    url: `https://maps.apple.com/directions?destination=${latitude},${longitude}&mode=walking`,
  };
}
