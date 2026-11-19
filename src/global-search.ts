import { isBusFeedFresh, type BusFeed, type BusFeedFailure, type BusFeeds } from '@/bus-data';
import { busRouteSearchNames, busSources, compareBusRoutes, normalizeBusQuery, type BusRoute, type BusSource, type RouteName } from '@/bus-routes';
import { getExplorePlaces, type ExplorePlace } from '@/explore-places';
import { facilityFavoriteKey, resolveFacilityIdentity, type FacilityFavoriteIdentity } from '@/facility-identity';
import { facilityType, nearbyFacilities, type Facility } from '@/facilities';
import { messages } from '@/i18n';
import { readBusStopsForSearch } from '@/nearby-bus-data';

export const globalSearchKinds = ['bus_route', 'bus_stop', 'facility', 'explore_place'] as const;
export type GlobalSearchKind = (typeof globalSearchKinds)[number];
export type GlobalSearchCategory = 'all' | GlobalSearchKind;
export const globalSearchMaxLength = 80;
const previewLimit = 8;
const categoryLimits: Record<GlobalSearchKind, number> = { bus_route: 30, bus_stop: 30, facility: 15, explore_place: 8 };

export type BusRouteSearchResult = { kind: 'bus_route'; key: string; route: BusRoute };
export type BusStopSearchResult = {
  kind: 'bus_stop';
  key: string;
  source: BusSource;
  stopId: string;
  name: RouteName;
  street: RouteName;
  etaContext: 'route_required';
};
export type FacilitySearchResult = {
  kind: 'facility';
  key: string;
  identity: FacilityFavoriteIdentity;
  facility: Pick<Facility, 'name' | 'category' | 'district' | 'area' | 'address' | 'sourceName' | 'serviceNotice'>;
  typeLabel: { 'zh-HK': string; en: string };
};
export type ExploreSearchResult = {
  kind: 'explore_place';
  key: string;
  place: Pick<ExplorePlace, 'id' | 'title' | 'district' | 'category' | 'additionalCategories'>;
};
export type GlobalSearchResult = BusRouteSearchResult | BusStopSearchResult | FacilitySearchResult | ExploreSearchResult;

type SourceStatus = 'not_loaded' | 'loading' | 'ready' | 'failed';
type GroupStatus = SourceStatus | 'partial';
type ResultPage<Result> = { results: Result[]; totalMatches: number; hasMore: boolean };
type SearchGroup<Result extends GlobalSearchResult> = ResultPage<Result> & { kind: Result['kind']; status: GroupStatus };
type RouteSourceState = {
  status: SourceStatus;
  failure?: BusFeedFailure;
  fetchedAt?: number;
  freshness?: 'fresh' | 'stale';
  persisted?: boolean;
};
type RouteSearchGroup = SearchGroup<BusRouteSearchResult> & { sources: Record<BusSource, RouteSourceState> };
export type GlobalSearchGroup = RouteSearchGroup | SearchGroup<BusStopSearchResult>
  | SearchGroup<FacilitySearchResult> | SearchGroup<ExploreSearchResult>;

type CatalogueState = { feeds: BusFeeds; loading: boolean; failed: Partial<Record<BusSource, BusFeedFailure>> };
type IndexedResult<Result> = { result: Result; names: string[]; fields: string[] };
export type GlobalBusStopsState =
  | { status: Exclude<SourceStatus, 'ready'> }
  | { status: 'ready'; index: readonly IndexedResult<BusStopSearchResult>[] };

export type GlobalSearchOptions = {
  category?: GlobalSearchCategory;
  busCatalogue?: CatalogueState;
  busStops?: GlobalBusStopsState;
  requestId?: number;
  now?: number;
};

type SearchTerms = { text: string; words: string[]; routeNumber: string; matchNames: boolean; matchRouteNames: boolean };
type PreparedSearch =
  | { status: 'empty' | 'too_long' | 'too_short'; text: string }
  | { status: 'ready'; text: string; terms: SearchTerms };
type SearchScope = 'preview' | 'category';
type MatchRank = 0 | 1 | 2 | 3;

function normalizeText(text: string) {
  return text.normalize('NFKC').trim().replace(/\s+/gu, ' ').replace(/[‘’]/gu, "'").toLowerCase();
}

export function prepareGlobalSearchQuery(input: string): PreparedSearch {
  if (input.length > globalSearchMaxLength) return { status: 'too_long', text: '' };
  const text = normalizeText(input);
  if (text.length > globalSearchMaxLength) return { status: 'too_long', text: '' };
  if (!text) return { status: 'empty', text };
  const matchNames = /\p{Script=Han}/u.test(text) || (text.match(/[\p{L}\p{N}]/gu)?.length ?? 0) >= 2;
  if (!matchNames && !/^[a-z0-9]$/u.test(text)) return { status: 'too_short', text };

  const routeNumber = normalizeBusQuery(text).replace(/ /g, '');
  return {
    status: 'ready', text,
    terms: { text, words: text.split(' '), routeNumber, matchNames,
      matchRouteNames: matchNames && !/^[A-Z]{0,2}\d+[A-Z]{0,2}$/.test(routeNumber) },
  };
}

function bilingual(field?: Facility['name']) {
  return [field?.['zh-HK'], field?.en];
}

function indexResult<Result>(result: Result, names: (string | undefined)[], extra: (string | undefined)[]): IndexedResult<Result> {
  const primary = [...new Set(names.map((name) => normalizeText(name ?? '')).filter(Boolean))];
  const fields = [...new Set([...primary, ...extra.map((name) => normalizeText(name ?? '')).filter(Boolean)])];
  return { result, names: primary, fields };
}

function matchText(entry: IndexedResult<unknown>, { text, words }: SearchTerms): MatchRank | undefined {
  if (entry.names.includes(text)) return 0;
  if (entry.names.some((name) => name.startsWith(text))) return 1;
  if (entry.names.some((name) => words.every((word) => name.includes(word)))) return 2;
  if (words.every((word) => entry.fields.some((field) => field.includes(word)))) return 3;
}

function page<Result>(index: readonly IndexedResult<Result>[], terms: SearchTerms, limit: number,
  rank: (entry: IndexedResult<Result>, query: SearchTerms) => MatchRank | undefined = matchText): ResultPage<Result> {
  // The index already fixes tie order. Keep at most a page per rank while still counting all hits.
  const buckets: Result[][] = [[], [], [], []];
  let totalMatches = 0;
  for (const entry of index) {
    const priority = rank(entry, terms);
    if (priority === undefined) continue;
    totalMatches++;
    if (buckets[priority].length < limit) buckets[priority].push(entry.result);
  }
  const results = buckets.flat().slice(0, limit);
  return { results, totalMatches, hasMore: totalMatches > results.length };
}

function emptyPage() {
  return { results: [], totalMatches: 0, hasMore: false };
}

function limitFor(kind: GlobalSearchKind, scope: SearchScope) {
  return scope === 'preview' ? previewLimit : categoryLimits[kind];
}

function sourceState(catalogue: CatalogueState | undefined, source: BusSource, now: number): RouteSourceState {
  const feed = catalogue?.feeds[source];
  const failure = catalogue?.failed[source];
  if (feed) return {
    status: 'ready',
    failure,
    freshness: isBusFeedFresh(feed, now) ? 'fresh' : 'stale',
    fetchedAt: feed.fetchedAt,
    persisted: feed.persisted,
  };
  if (failure) return { status: 'failed', failure };
  return { status: catalogue?.loading ? 'loading' : 'not_loaded' };
}

let cachedRoutes: { lists: (BusFeed['routes'] | undefined)[]; index: IndexedResult<BusRouteSearchResult>[] } | undefined;
function busRouteIndex(feeds: BusFeeds) {
  const lists = busSources.map((source) => feeds[source]?.routes);
  const cache = cachedRoutes;
  if (cache && lists.every((routes, i) => routes === cache.lists[i])) return cache.index;

  const routes = lists.flatMap((list) => list ?? []).sort(compareBusRoutes);
  const index = routes.map((route) => indexResult<BusRouteSearchResult>(
    { kind: 'bus_route', key: `bus_route:${route.id}`, route }, busRouteSearchNames(route), [],
  ));
  cachedRoutes = { lists, index };
  return index;
}

function matchRoute(entry: IndexedResult<BusRouteSearchResult>, terms: SearchTerms): MatchRank | undefined {
  const { routeNumber } = terms;
  const number = entry.result.route.number;
  if (number === routeNumber) return 0;
  // Number-like queries keep the route code semantics of the dedicated bus search.
  const nameRank = terms.matchRouteNames ? matchText(entry, terms) : undefined;
  if (nameRank === 0) return 0;
  if (number.startsWith(routeNumber)) return 1;
  return nameRank;
}

export function searchBusRoutes(query: PreparedSearch, catalogue?: CatalogueState, scope: SearchScope = 'category', now = Date.now()): RouteSearchGroup {
  const sources = {
    kmbLwb: sourceState(catalogue, 'kmbLwb', now),
    citybus: sourceState(catalogue, 'citybus', now),
    nlb: sourceState(catalogue, 'nlb', now),
  };
  const states = Object.values(sources);
  const ready = states.filter(({ status }) => status === 'ready').length;
  let status: GroupStatus = 'not_loaded';
  if (ready === busSources.length) status = 'ready';
  else if (ready) status = 'partial';
  else if (states.some((state) => state.status === 'loading')) status = 'loading';
  else if (states.some((state) => state.status === 'failed')) status = 'failed';
  const matches = query.status === 'ready' && catalogue && ready
    ? page(busRouteIndex(catalogue.feeds), query.terms, limitFor('bus_route', scope), matchRoute)
    : emptyPage();
  return { kind: 'bus_route', status, sources, ...matches };
}

let pendingStops: Promise<GlobalBusStopsState> | undefined;
export function loadGlobalBusStops() {
  return pendingStops ??= buildBusStopIndex().finally(() => { pendingStops = undefined; });
}

async function buildBusStopIndex(): Promise<GlobalBusStopsState> {
  try {
    const rows = await readBusStopsForSearch();
    if (!rows.length) return { status: 'failed' };
    const index: IndexedResult<BusStopSearchResult>[] = [];
    for (const [i, row] of rows.entries()) {
      // Give the next event-loop turn a chance to run during the first index build.
      if (i > 0 && i % 512 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const { source, stop_id, name_zh, name_en, street_zh, street_en } = row;
      index.push(indexResult<BusStopSearchResult>({
        kind: 'bus_stop', key: `bus_stop:${JSON.stringify([source, stop_id])}`, source, stopId: stop_id,
        name: { zh: name_zh, en: name_en }, street: { zh: street_zh, en: street_en }, etaContext: 'route_required',
      }, [name_zh, name_en], [street_zh, street_en]));
    }
    return { status: 'ready', index };
  } catch {
    return { status: 'failed' };
  }
}

export function searchBusStops(query: PreparedSearch, stops?: GlobalBusStopsState, scope: SearchScope = 'category'): SearchGroup<BusStopSearchResult> {
  const matches = query.status === 'ready' && query.terms.matchNames && stops?.status === 'ready'
    ? page(stops.index, query.terms, limitFor('bus_stop', scope)) : emptyPage();
  return { kind: 'bus_stop', status: stops?.status ?? 'not_loaded', ...matches };
}

let facilities: IndexedResult<FacilitySearchResult>[] | undefined;
function facilityIndex() {
  if (facilities) return facilities;
  const index: IndexedResult<FacilitySearchResult>[] = [];
  for (const row of nearbyFacilities) {
    const resolved = resolveFacilityIdentity(row);
    if (resolved.status !== 'available') continue;
    const { identity, facility } = resolved;
    const { name, category, district, area, address, sourceName, serviceNotice } = facility;
    const typeLabel = {
      'zh-HK': facilityType(facility, 'zh-HK', messages['zh-HK'].nearby),
      en: facilityType(facility, 'en', messages.en.nearby),
    };
    index.push(indexResult<FacilitySearchResult>({
      kind: 'facility', key: `facility:${facilityFavoriteKey(identity)}`, identity,
      facility: { name, category, district, area, address, sourceName, serviceNotice }, typeLabel,
    }, [...bilingual(name), ...bilingual(facility.aliases)], [
      ...bilingual(district), ...bilingual(area), ...bilingual(address), ...bilingual(typeLabel),
      messages['zh-HK'].nearby.categories[category], messages.en.nearby.categories[category],
    ]));
  }
  facilities = index.sort((a, b) => a.result.key < b.result.key ? -1 : a.result.key > b.result.key ? 1 : 0);
  return facilities;
}

export function searchFacilities(query: PreparedSearch, scope: SearchScope = 'category'): SearchGroup<FacilitySearchResult> {
  const matches = query.status === 'ready' && query.terms.matchNames
    ? page(facilityIndex(), query.terms, limitFor('facility', scope)) : emptyPage();
  return { kind: 'facility', status: 'ready', ...matches };
}

let places: IndexedResult<ExploreSearchResult>[] | undefined;
function exploreIndex() {
  return places ??= getExplorePlaces().map(({ id, title, district, category, additionalCategories }) => {
    const categories = [category, ...additionalCategories].flatMap((name) => [
      messages['zh-HK'].explore.categories[name], messages.en.explore.categories[name], messages.en.explore.categoryButtonLabels[name],
    ]);
    return indexResult<ExploreSearchResult>({
      kind: 'explore_place', key: `explore_place:${id}`, place: { id, title, district, category, additionalCategories },
    }, bilingual(title), [...bilingual(district), ...categories]);
  });
}

export function searchExplorePlaces(query: PreparedSearch, scope: SearchScope = 'category'): SearchGroup<ExploreSearchResult> {
  const matches = query.status === 'ready' && query.terms.matchNames
    ? page(exploreIndex(), query.terms, limitFor('explore_place', scope)) : emptyPage();
  return { kind: 'explore_place', status: 'ready', ...matches };
}

export function searchGlobal(input: string, { category = 'all', busCatalogue, busStops, requestId, now }: GlobalSearchOptions = {}) {
  const prepared = prepareGlobalSearchQuery(input);
  const query: PreparedSearch = category !== 'all' && category !== 'bus_route' && prepared.status === 'ready' && !prepared.terms.matchNames
    ? { status: 'too_short', text: prepared.text } : prepared;
  const scope = category === 'all' ? 'preview' : 'category';
  const searches: Record<GlobalSearchKind, () => GlobalSearchGroup> = {
    bus_route: () => searchBusRoutes(query, busCatalogue, scope, now),
    bus_stop: () => searchBusStops(query, busStops, scope),
    facility: () => searchFacilities(query, scope),
    explore_place: () => searchExplorePlaces(query, scope),
  };
  const kinds = category === 'all' ? globalSearchKinds : [category];
  return { query: query.text, queryStatus: query.status, requestId, groups: kinds.map((kind) => searches[kind]()) };
}
