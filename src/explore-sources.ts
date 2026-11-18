import type { ExploreLocale, ExplorePlace, ExploreSource } from './explore-places';

// IDs refer to the audited sources already bundled with each place. Keep the chosen guide's
// versions together so an unrelated page cannot win just by matching the app language.
const guideIds: Readonly<Partial<Record<string, readonly string[]>>> = {
  'dragons-back-to-tei-wan-tai-tam-gap': ['afcd-route', 'afcd-map'],
  'peak-circle-walk': ['hktb-tc', 'hktb-en'],
  'west-kowloon-art-park': ['westk-guide-tc', 'westk-guide-en'],
  'avenue-of-stars': ['hktb-place-tc', 'hktb-place-en'],
  'hong-kong-park': ['lcsd-visit-tc', 'lcsd-visit-en'],
  'kowloon-walled-city-park': ['lcsd-park-tc', 'lcsd-park-en'],
  'tai-po-waterfront-park': ['lcsd-park-tc', 'lcsd-park-en'],
  'victoria-peak-garden': ['hktb-tc', 'hktb-en'],
};

const sourceHosts = new Set([
  'www.hiking.gov.hk', 'www.discoverhongkong.com', 'webmedia.westkowloon.hk',
  'hkp.lcsd.gov.hk', 'www.lcsd.gov.hk', 'www.amo.gov.hk', 'www.info.gov.hk',
]);

export function isOfficialExploreUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && sourceHosts.has(url.hostname) && !url.port && !url.username && !url.password;
  } catch {
    return false;
  }
}

function preferredSource(sources: readonly ExploreSource[], ids: readonly string[], locale: ExploreLocale) {
  const candidates = sources.filter((source) => ids.includes(source.id));
  return candidates.find((source) => source.language === locale)
    ?? candidates.find((source) => source.language === 'bilingual')
    ?? candidates[0];
}

export function selectExploreSources(place: ExplorePlace, locale: ExploreLocale) {
  const sources = place.sources.filter(({ url }) => isOfficialExploreUrl(url));
  const overview = guideIds[place.id] ?? place.transport.sourceIds;
  const main = preferredSource(sources, overview, locale);
  const remaining = sources.filter(({ id, url }) => !overview.includes(id) && url !== main?.url);
  const prioritiseCautions = place.category === 'hiking' || place.category === 'pets'
    || place.additionalCategories.includes('pets');
  const firstChoice = prioritiseCautions ? place.cautions : place.transport;
  const secondChoice = prioritiseCautions ? place.transport : place.cautions;
  const supplement = preferredSource(remaining, firstChoice.sourceIds, locale)
    ?? preferredSource(remaining, secondChoice.sourceIds, locale);
  return [main, supplement].filter((source) => source !== undefined);
}
