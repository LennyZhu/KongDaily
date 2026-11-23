import { isBusFeedFresh, type BusFeed, type BusFeedFailure, type BusFeeds } from '@/bus-data';
import { busRouteSearchNames, busSources, compareBusRoutes, matchBusRoutes, normalizeBusQuery, type BusRoute, type BusSource, type RouteName } from '@/bus-routes';
import { getExplorePlaces, type ExplorePlace } from '@/explore-places';
import { facilityFavoriteKey, resolveFacilityIdentity, type FacilityFavoriteIdentity } from '@/facility-identity';
import { facilityType, nearbyFacilities, type Facility } from '@/facilities';
import type { FerryRoute } from '@/ferry-data';
import type { GmbRoute } from '@/gmb-data';
import type { GmbSearchState } from '@/gmb-search';
import { matchHkkfRoutes, type HkkfSearchState } from '@/hkkf-search';
import { messages } from '@/i18n';
import { searchLightRail, type LightRailEntry, type LightRailRoute, type LightRailStop } from '@/light-rail-static';
import { searchMtr, type MtrEntry, type MtrLine, type MtrStation } from '@/mtr-static';
import { readBusStopsForSearch } from '@/nearby-bus-data';

export const globalSearchKinds = ['transport_route', 'transport_stop', 'facility', 'explore_place'] as const;
export type GlobalSearchKind = (typeof globalSearchKinds)[number];
export type GlobalSearchCategory = 'all' | GlobalSearchKind;
export const globalSearchMaxLength = 80;
const previewLimit = 8;
const categoryLimits = { bus_route: 30, bus_stop: 30, facility: 15, explore_place: 8, transport_route: 30, transport_stop: 30 };

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
export type RailwayRouteSearchResult = { kind: 'mtr_line'; key: string; entry: MtrLine }
  | { kind: 'light_rail_route'; key: string; entry: LightRailRoute };
export type RailwayStopSearchResult = { kind: 'mtr_station'; key: string; entry: MtrStation }
  | { kind: 'light_rail_stop'; key: string; entry: LightRailStop };
export type RailwaySearchResult = RailwayRouteSearchResult | RailwayStopSearchResult;
export type GmbRouteSearchResult = { kind: 'gmb_route'; key: string; service: GmbRoute };
export type FerryRouteSearchResult = { kind: 'ferry_route'; key: string; service: FerryRoute };
export type TransportRouteSearchResult = FerryRouteSearchResult | BusRouteSearchResult | RailwayRouteSearchResult | GmbRouteSearchResult;
export type TransportStopSearchResult = BusStopSearchResult | RailwayStopSearchResult;
export type TransportSearchResult = TransportRouteSearchResult | TransportStopSearchResult;
export type GlobalSearchResult = TransportSearchResult | FacilitySearchResult | ExploreSearchResult;

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
type TransportRouteGroup = ResultPage<TransportRouteSearchResult> & { kind: 'transport_route'; status: GroupStatus; bus?: RouteSearchGroup };
type TransportStopGroup = ResultPage<TransportStopSearchResult> & { kind: 'transport_stop'; status: GroupStatus; bus?: SearchGroup<BusStopSearchResult> };
export type GlobalSearchGroup = TransportRouteGroup | TransportStopGroup
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
  gmb?: GmbSearchState;
  ferry?: HkkfSearchState;
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

function limitFor(kind: keyof typeof categoryLimits, scope: SearchScope) {
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

export function railwaySearchResult(entry: MtrEntry | LightRailEntry): RailwaySearchResult {
  switch (entry.kind) {
    case 'mtr-line': return { kind: 'mtr_line', key: `mtr_line:${entry.id}`, entry };
    case 'mtr-station': return { kind: 'mtr_station', key: `mtr_station:${entry.id}`, entry };
    case 'light-rail-route': return { kind: 'light_rail_route', key: `light_rail_route:${entry.id}`, entry };
    case 'light-rail-stop': return { kind: 'light_rail_stop', key: `light_rail_stop:${entry.id}`, entry };
  }
}

type TransportMode = 'bus' | 'mtr' | 'lightRail' | 'minibus' | 'ferry';
type TransportPages = { routes: ResultPage<TransportRouteSearchResult>; stops: ResultPage<TransportStopSearchResult> };
type TransportContext = { query: PreparedSearch; busRoutes: RouteSearchGroup; busStops: SearchGroup<BusStopSearchResult>; gmb?: GmbSearchState; ferry?: HkkfSearchState; browseFerry: boolean };
type TransportSearchSource = { id: TransportMode; search: (input: string, context: TransportContext) => TransportPages };

function railwayPages(entries: readonly (MtrEntry | LightRailEntry)[]): TransportPages {
  const routes: RailwayRouteSearchResult[] = [];
  const stops: RailwayStopSearchResult[] = [];
  for (const entry of entries) {
    const result = railwaySearchResult(entry);
    if (result.kind === 'mtr_line' || result.kind === 'light_rail_route') routes.push(result);
    else stops.push(result);
  }
  return { routes: { results: routes, totalMatches: routes.length, hasMore: false },
    stops: { results: stops, totalMatches: stops.length, hasMore: false } };
}

/** Register a verified transport source here; matching remains owned by each existing catalogue. */
const transportSearchSources: readonly TransportSearchSource[] = [
  { id: 'bus', search: (_input, context) => ({ routes: context.busRoutes, stops: context.busStops }) },
  { id: 'mtr', search: (input, { query }) => railwayPages(query.status === 'ready' ? searchMtr(input) : []) },
  { id: 'lightRail', search: (input, { query }) => railwayPages(query.status === 'ready' ? searchLightRail(input) : []) },
  { id: 'minibus', search: (_input, { query, gmb }) => {
    if (query.status !== 'ready' || (gmb?.status !== 'ready' && gmb?.status !== 'partial')) {
      return { routes: emptyPage(), stops: emptyPage() };
    }
    const results = gmb.routes.filter(({ routeCode }) => routeCode === query.terms.routeNumber)
      .map((service): GmbRouteSearchResult => ({ kind: 'gmb_route', key: 'gmb_route:' + service.routeId, service }));
    return { routes: { results, totalMatches: results.length, hasMore: false }, stops: emptyPage() };
  } },
  { id: 'ferry', search: (input, { query, ferry, browseFerry }) => {
    if (ferry?.status !== 'ready' || (query.status !== 'ready' && !(browseFerry && query.status === 'empty'))) {
      return { routes: emptyPage(), stops: emptyPage() };
    }
    const results = matchHkkfRoutes(ferry.routes, input)
      .map((service): FerryRouteSearchResult => ({ kind: 'ferry_route', key: 'ferry_route:' + service.routeId, service }));
    return { routes: { results, totalMatches: results.length, hasMore: false }, stops: emptyPage() };
  } },
];

function combineTransportPages<Result>(pages: readonly ResultPage<Result>[], limit: number): ResultPage<Result> {
  const results: Result[] = [];
  // Preserve each source's ranking while keeping matching rail sources visible in bounded previews.
  for (let index = 0; results.length < limit && pages.some((page) => index < page.results.length); index++) {
    for (const page of pages) if (index < page.results.length && results.length < limit) results.push(page.results[index]);
  }
  const totalMatches = pages.reduce((total, page) => total + page.totalMatches, 0);
  return { results, totalMatches, hasMore: totalMatches > results.length };
}

export function searchTransport(input: string, { busCatalogue, busStops, gmb, ferry, now, mode, scope = 'category', surface = 'global' }: {
  busCatalogue?: CatalogueState; busStops?: GlobalBusStopsState; gmb?: GmbSearchState; ferry?: HkkfSearchState; now?: number; mode?: TransportMode;
  scope?: SearchScope; surface?: 'global' | 'transport';
} = {}): { routes: TransportRouteGroup; stops: TransportStopGroup } {
  const query = prepareGlobalSearchQuery(input);
  const includeBus = mode === undefined || mode === 'bus';
  const baseRoutes = searchBusRoutes(surface === 'transport' ? { status: 'empty', text: '' } : query,
    includeBus ? busCatalogue : undefined, scope, now);
  // The dedicated transport surface retains its established substring bus-route rule.
  const busMatches = surface === 'transport' && includeBus && query.status === 'ready'
    ? matchBusRoutes(busSources.flatMap((source) => busCatalogue?.feeds[source]?.routes ?? []), input)
      .map((route): BusRouteSearchResult => ({ kind: 'bus_route', key: `bus_route:${route.id}`, route })) : undefined;
  const context: TransportContext = {
    query, busRoutes: busMatches ? { ...baseRoutes, results: busMatches, totalMatches: busMatches.length, hasMore: false } : baseRoutes,
    busStops: searchBusStops(query, includeBus ? busStops : undefined, scope), gmb, ferry, browseFerry: mode === 'ferry' && surface === 'transport',
  };
  const sources = transportSearchSources.filter((source) => mode === undefined || source.id === mode);
  const pages = sources.map((source) => source.search(input, context));
  const hasLocalRail = sources.some(({ id }) => id === 'mtr' || id === 'lightRail');
  const status = (busStatus: GroupStatus): GroupStatus => !includeBus ? 'ready'
    : hasLocalRail && busStatus !== 'ready' ? 'partial' : busStatus;
  const gmbStatus = (mode === undefined || mode === 'minibus') ? gmb?.status : undefined;
  const ferryStatus = (mode === undefined || mode === 'ferry') ? ferry?.status : undefined;
  const sourceIncomplete = [gmbStatus, ferryStatus].some((value) => value && value !== 'ready');
  const routeStatus = mode === 'ferry' ? ferryStatus ?? 'ready' : mode === 'minibus' ? gmbStatus ?? 'ready'
    : sourceIncomplete ? 'partial' : status(context.busRoutes.status);
  return {
    routes: { kind: 'transport_route', status: routeStatus, bus: includeBus ? context.busRoutes : undefined,
      ...combineTransportPages(pages.map(({ routes }) => routes), surface === 'transport' ? Infinity : limitFor('transport_route', scope)) },
    stops: { kind: 'transport_stop', status: status(context.busStops.status), bus: includeBus ? context.busStops : undefined,
      ...combineTransportPages(pages.map(({ stops }) => stops), surface === 'transport' ? Infinity : limitFor('transport_stop', scope)) },
  };
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

export function searchGlobal(input: string, { category = 'all', busCatalogue, busStops, gmb, ferry, requestId, now }: GlobalSearchOptions = {}) {
  const prepared = prepareGlobalSearchQuery(input);
  const query: PreparedSearch = category !== 'all' && category !== 'transport_route' && prepared.status === 'ready' && !prepared.terms.matchNames
    ? { status: 'too_short', text: prepared.text } : prepared;
  const scope = category === 'all' ? 'preview' : 'category';
  const transport = searchTransport(query.status === 'ready' ? input : '', { busCatalogue, busStops, gmb, ferry, now, scope });
  const searches: Record<GlobalSearchKind, () => GlobalSearchGroup> = {
    transport_route: () => transport.routes,
    transport_stop: () => transport.stops,
    facility: () => searchFacilities(query, scope),
    explore_place: () => searchExplorePlaces(query, scope),
  };
  const kinds = category === 'all' ? globalSearchKinds : [category];
  return { query: query.text, queryStatus: query.status, requestId, groups: kinds.map((kind) => searches[kind]()) };
}
