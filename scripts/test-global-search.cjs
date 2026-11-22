const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { dirname, join, resolve } = require('node:path');
const { performance } = require('node:perf_hooks');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');

const root = resolve(__dirname, '..');
const db = new DatabaseSync(':memory:');
let stopReads = 0;
let failStopRead = false;
let networkCalls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  networkCalls++;
  throw new Error('Network disabled in global search tests');
};

const sqlite = {
  async execAsync(sql) { db.exec(sql); },
  async getAllAsync(sql, ...params) {
    if (sql.includes('FROM nearby_bus_stops ORDER BY')) {
      stopReads++;
      if (failStopRead) throw new Error('Simulated stop index read failure');
    }
    return db.prepare(sql).all(...params);
  },
  async getFirstAsync(sql, ...params) { return db.prepare(sql).get(...params) ?? null; },
  async runAsync(sql, ...params) { return db.prepare(sql).run(...params); },
  async withExclusiveTransactionAsync(operation) {
    db.exec('BEGIN IMMEDIATE');
    try {
      await operation(sqlite);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  },
};
const modules = new Map();
function load(name) {
  if (modules.has(name)) return modules.get(name).exports;
  const filename = join(root, 'src', name + '.ts');
  const module = { exports: {} };
  modules.set(name, module);
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  });
  new Function('module', 'exports', 'require', outputText)(module, module.exports, (id) => {
    if (id === 'expo-sqlite') return { openDatabaseAsync: async () => sqlite };
    if (id.startsWith('@/')) return load(id.slice(2));
    if (id.startsWith('.')) return require(resolve(dirname(filename), id));
    return require(id);
  });
  return module.exports;
}

function group(result, kind) {
  const found = result.groups.find((group) => group.kind === kind);
  assert(found, kind);
  return found;
}
const { searchGlobal, loadGlobalBusStops, prepareGlobalSearchQuery, searchBusRoutes, searchBusStops,
  searchFacilities, searchExplorePlaces, searchTransport, railwaySearchResult, globalSearchMaxLength } = load('global-search');

const { parseBusCatalogue, matchBusRoutes } = load('bus-routes');
const now = Date.parse('2026-11-19T07:00:00Z');
const kmbRecord = (route, service_type = 1, bound = 'O') => ({
  route, bound, service_type, orig_tc: '洪水橋', dest_tc: '高鐵西九龍站', orig_en: 'Hung Shui Kiu', dest_en: 'West Kowloon Station',
});
const citybusRecord = (route) => ({ co: 'CTB', route, orig_tc: '北角', dest_tc: '中環', orig_en: 'North Point', dest_en: 'Central' });
const feeds = {
  kmbLwb: { routes: parseBusCatalogue('kmbLwb', { data: [
    kmbRecord('268X', 3), kmbRecord('1', 1, 'I'), kmbRecord('268X'), kmbRecord('12'),
  ] }), fetchedAt: now, persisted: true },
  citybus: { routes: parseBusCatalogue('citybus', { data: [citybusRecord('1')] }), fetchedAt: now, persisted: false },
  nlb: { routes: parseBusCatalogue('nlb', { routes: [
    { routeId: 37, routeNo: 'B2', routeName_c: '元朗 > 深圳灣口岸', routeName_e: 'Yuen Long > Shenzhen Bay Port' },
    { routeId: '38', routeNo: 'B2', routeName_c: '深圳灣口岸 > 元朗', routeName_e: 'Shenzhen Bay Port > Yuen Long' },
  ] }), fetchedAt: now, persisted: true },
};
const catalogue = { feeds, loading: false, failed: {} };
const bus = (text, state = catalogue) => searchBusRoutes(prepareGlobalSearchQuery(text), state, 'category', now);

async function verify() {
  const blank = searchGlobal(' \t　\n');
  assert.equal(blank.queryStatus, 'empty');
  assert.deepEqual(blank.groups.map(({ kind, status, totalMatches }) => [kind, status, totalMatches]), [
    ['transport_route', 'partial', 0], ['transport_stop', 'partial', 0], ['facility', 'ready', 0], ['explore_place', 'ready', 0],
  ]);
  assert.equal(searchGlobal('🤔!').queryStatus, 'too_short');
  assert.equal(searchGlobal('x'.repeat(globalSearchMaxLength + 1)).queryStatus, 'too_long');
  assert.equal(searchGlobal('㍿'.repeat(globalSearchMaxLength)).queryStatus, 'too_long');
  const short = searchGlobal(' １ ', { busCatalogue: catalogue, requestId: 7 });
  assert.equal(short.query, '1');
  assert.equal(short.queryStatus, 'ready');
  assert.equal(short.requestId, 7);
  assert.equal(group(short, 'facility').totalMatches, 0);
  assert.equal(searchGlobal('1', { category: 'transport_stop' }).queryStatus, 'too_short');

  assert.deepEqual(bus('１').results.map(({ route }) => route.id), ['KMB-LWB:1:I:1', 'CTB:1', 'KMB-LWB:12:O:1']);
  assert.deepEqual(bus('２６８ｘ').results.map(({ route }) => [route.id, route.direction, route.serviceType]), [
    ['KMB-LWB:268X:O:1', 'outbound', '1'], ['KMB-LWB:268X:O:3', 'outbound', '3'],
  ]);
  assert.deepEqual(bus('b ２').results.map(({ route }) => [route.id, route.routeId]), [['NLB:37', '37'], ['NLB:38', '38']]);
  assert.equal(bus('CITYBUS').results[0].route.direction, 'listed');
  assert.equal(bus(' WeSt    KoWLoON STATION ').totalMatches, 4);
  assert.equal(bus('高鐵西九龍站').totalMatches, 4);
  assert.equal(bus('68x').totalMatches, 0);
  assert.equal(matchBusRoutes(feeds.kmbLwb.routes, '68x').length, 2, 'Specialised bus search keeps its existing substring rule');
  assert.equal(bus('不存在路線').status, 'ready');
  assert.equal(bus('不存在路線').totalMatches, 0);
  assert.equal(bus('268X', { feeds: {}, loading: true, failed: {} }).status, 'loading');
  assert.equal(bus('268X', { feeds: {}, loading: false, failed: { kmbLwb: 'network' } }).status, 'failed');

  const oldBus = bus('268X', { feeds: { kmbLwb: { ...feeds.kmbLwb, fetchedAt: now - 86_400_000 } },
    loading: false, failed: { kmbLwb: 'timeout', citybus: 'network' } });
  assert.equal(oldBus.status, 'partial');
  assert.equal(oldBus.sources.kmbLwb.freshness, 'stale');
  assert.equal(oldBus.sources.kmbLwb.failure, 'timeout');
  assert.equal(oldBus.sources.citybus.status, 'failed');
  assert.equal(oldBus.sources.nlb.status, 'not_loaded');
  assert.equal(oldBus.totalMatches, 2);
  assert.equal(bus('1').sources.citybus.persisted, false);

  const longFeed = { ...catalogue, feeds: {
    citybus: { ...feeds.citybus, routes: parseBusCatalogue('citybus', { data: Array.from({ length: 40 },
      (_, index) => citybusRecord(String(139 - index))) }) },
  } };
  const routesLimited = bus('1', longFeed);
  assert.equal(routesLimited.totalMatches, 40);
  assert.equal(routesLimited.results.length, 30);
  assert.deepEqual(routesLimited.results.slice(0, 3).map(({ route }) => route.number), ['100', '101', '102']);
  assert(routesLimited.hasMore);
  assert.equal(group(searchGlobal('1', { busCatalogue: longFeed }), 'transport_route').results.length, 8);

  assert.equal(stopReads, 0, 'Querying alone never reads or fetches a catalogue');
  const stopStarted = performance.now();
  const first = loadGlobalBusStops();
  assert.equal(loadGlobalBusStops(), first, 'Concurrent index startup reuses the same read');
  const busStops = await first;
  const stopInitMs = performance.now() - stopStarted;
  assert.equal(busStops.status, 'ready');
  assert.equal(busStops.index.length, 7841);
  const seed = require('../assets/data/nearby-stops.json');
  const seedIds = Object.entries(seed.stops).flatMap(([source, stops]) => stops.map(([id, zh, en]) =>
    [source, id, zh, en])).sort();
  assert.deepEqual(busStops.index.map(({ result }) => [result.source, result.stopId, result.name.zh, result.name.en]).sort(), seedIds);
  assert.equal(new Set(busStops.index.map(({ result }) => result.key)).size, 7841);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 8);

  const stops = (input) => searchBusStops(prepareGlobalSearchQuery(input), busStops);
  const ferry = stops('CENTRAL (MACAO FERRY)').results[0];
  assert.equal(ferry.source, 'citybus');
  assert.equal(ferry.stopId, '001027');
  assert.equal(ferry.etaContext, 'route_required');
  assert.equal(ferry.routeId, undefined);
  assert.equal(ferry.stopSeq, undefined);
  const officialNames = new Map();
  for (const { result } of busStops.index) {
    if (!officialNames.has(result.name.zh)) officialNames.set(result.name.zh, []);
    officialNames.get(result.name.zh).push(result);
  }
  const [sameName, sameStops] = [...officialNames].find(([, items]) =>
    new Set(items.map(({ source }) => source)).size > 1 && items.length <= 30);
  const realMatches = stops(sameName).results.filter(({ name }) => name.zh === sameName);
  assert.deepEqual(realMatches.map(({ key }) => key).sort(), sameStops.map(({ key }) => key).sort());
  const library = stops('中央圖書館').results.filter(({ name }) => name.zh === '中央圖書館');
  assert(library.length > 1);
  assert.equal(new Set(library.map(({ stopId }) => stopId)).size, library.length);
  const moreStops = stops('公園');
  assert.equal(moreStops.results.length, 30);
  assert(moreStops.totalMatches > 30 && moreStops.hasMore);
  assert.equal(searchBusStops(prepareGlobalSearchQuery('公園'), busStops, 'preview').results.length, 8);

  const registry = load('facility-identity');
  const resolveFacility = registry.resolveFacilityIdentity;
  const indexedFacilities = new Set();
  registry.resolveFacilityIdentity = (row) => {
    const resolved = resolveFacility(row);
    assert.equal(resolved.status, 'available');
    indexedFacilities.add(registry.facilityFavoriteKey(resolved.identity));
    return resolved;
  };
  const rawFacilities = load('facilities').nearbyFacilities;
  assert.equal(rawFacilities.length, 1256);
  const facilitiesStarted = performance.now();
  const matchedPark = searchFacilities(prepareGlobalSearchQuery('Hong  Kong Park'));
  const facilitiesInitMs = performance.now() - facilitiesStarted;
  assert.equal(indexedFacilities.size, 1256);
  assert.equal(matchedPark.results[0].facility.name['zh-HK'], '香港公園');
  assert.equal(matchedPark.results[0].facility.coordinate, undefined, 'Navigation uses the registry, not a search coordinate');
  const afcd = rawFacilities.find((facility) => facility.source === 'afcd' && facility.officialId === 'ABD/TF/001');
  const afcdResult = searchFacilities(prepareGlobalSearchQuery(afcd.name['zh-HK'])).results
    .find(({ identity }) => identity.source === 'afcd' && identity.stableFacilityId === 'afcd-toilet-0001');
  assert.equal(registry.resolveStableFacilityIdentity(afcdResult.identity).facility, afcd);
  const park = rawFacilities.find(({ source, officialId }) => source === 'lcsd-parks' && officialId === 'park-035');
  const garden = rawFacilities.find(({ source, officialId }) => source === 'lcsd-pet-gardens' && officialId === 'pet-garden-028');
  assert.equal(park.name['zh-HK'], garden.name['zh-HK']);
  const sameFacilityName = searchFacilities(prepareGlobalSearchQuery(park.name['zh-HK'])).results;
  assert(sameFacilityName.some(({ identity }) => identity.source === park.source && identity.stableFacilityId === park.officialId));
  assert(sameFacilityName.some(({ identity }) => identity.source === garden.source && identity.stableFacilityId === garden.officialId));
  assert.equal(searchFacilities(prepareGlobalSearchQuery('公廁')).results.length, 15);
  assert.equal(group(searchGlobal('公廁'), 'facility').results.length, 8);

  const { getExplorePlaces } = load('explore-places');
  const places = getExplorePlaces();
  assert.equal(places.length, 8);
  assert.equal(new Set(places.map(({ id }) => id)).size, 8);
  for (const place of places) {
    for (const language of ['zh-HK', 'en']) {
      const { results } = searchExplorePlaces(prepareGlobalSearchQuery(place.title[language]));
      assert.equal(results[0].place.id, place.id);
      assert.equal(results.filter(({ place: candidate }) => candidate.id === place.id).length, 1);
    }
  }
  assert.equal(searchExplorePlaces(prepareGlobalSearchQuery("dRaGoN's   BaCk")).results[0].place.id,
    'dragons-back-to-tei-wan-tai-tam-gap');
  for (const query of ['海濱景點', '寵物友善']) {
    const matches = searchExplorePlaces(prepareGlobalSearchQuery(query)).results;
    assert.equal(matches.filter(({ place }) => place.id === 'west-kowloon-art-park').length, 1);
  }
  assert(searchExplorePlaces(prepareGlobalSearchQuery('大埔')).results.some(({ place }) => place.id === 'tai-po-waterfront-park'));

  const input = '公園';
  const options = { busCatalogue: catalogue, busStops, now };
  const results = searchGlobal(input, options);
  const shuffled = { ...options, busCatalogue: { ...catalogue, feeds: {
    ...feeds, kmbLwb: { ...feeds.kmbLwb, routes: [...feeds.kmbLwb.routes].reverse() },
  } } };
  assert.deepEqual(searchGlobal(input, shuffled), results, 'All group orders are deterministic');
  assert.deepEqual(bus('1', shuffled.busCatalogue), bus('1'));
  assert.deepEqual(searchBusRoutes(prepareGlobalSearchQuery('268X'), catalogue, 'category', now), bus('268X'));
  assert.deepEqual(searchBusStops(prepareGlobalSearchQuery('公園'), busStops), moreStops);

  const noCatalogue = searchGlobal('香港公園', { busStops });
  assert.equal(group(noCatalogue, 'transport_route').bus.status, 'not_loaded');
  const failed = searchGlobal('香港公園', { busStops, busCatalogue: { feeds: {}, loading: false, failed: { kmbLwb: 'network' } } });
  assert.equal(group(failed, 'transport_route').bus.status, 'failed');
  for (const kind of ['transport_stop', 'facility', 'explore_place']) {
    assert.deepEqual(group(noCatalogue, kind), group(failed, kind));
  }
  const stopsLoading = searchGlobal('香港公園', { busStops: { status: 'loading' } });
  assert.equal(group(stopsLoading, 'transport_stop').bus.status, 'loading');
  failStopRead = true;
  const failedStops = await loadGlobalBusStops();
  assert.equal(group(searchGlobal('香港公園', { busStops: failedStops }), 'transport_stop').bus.status, 'failed');
  assert(group(searchGlobal('香港公園', { busStops: failedStops }), 'explore_place').totalMatches > 0);
  failStopRead = false;
  assert.equal((await loadGlobalBusStops()).status, 'ready', 'A later load can retry after a storage failure');
  assert.equal(stopReads, 3);

  // Phase 3A: both surfaces query the same typed registry and retain operator identities.
  const transportOptions = { busCatalogue: catalogue, busStops, now };
  const { mtrLines, mtrStations } = load('mtr-static');
  const { lightRailRoutes, lightRailStops } = load('light-rail-static');
  for (const [mode, entries] of [['mtr', [...mtrLines, ...mtrStations]], ['lightRail', [...lightRailRoutes, ...lightRailStops]]]) {
    for (const entry of entries) {
      const expected = railwaySearchResult(entry);
      const global = searchTransport(entry.id, { ...transportOptions, mode });
      const transport = searchTransport(entry.id, { ...transportOptions, mode, surface: 'transport' });
      const family = entry.kind === 'mtr-line' || entry.kind === 'light-rail-route' ? 'routes' : 'stops';
      assert.equal(global[family].results.find(({ key }) => key === expected.key).entry, entry);
      assert.equal(transport[family].results.find(({ key }) => key === expected.key).entry, entry);
    }
  }
  for (const [input, family, kind, id] of [
    ['港島綫', 'routes', 'mtr_line', 'ISL'], ['ISL', 'routes', 'mtr_line', 'ISL'],
    ['Admiralty', 'stops', 'mtr_station', 'ADM'], ['金鐘', 'stops', 'mtr_station', 'ADM'],
    ['610', 'routes', 'light_rail_route', '610'], ['250', 'stops', 'light_rail_stop', '250'],
    ['Hoi Wong Road', 'stops', 'light_rail_stop', '250'], ['海皇路', 'stops', 'light_rail_stop', '250'],
    ['洪水橋', 'stops', 'light_rail_stop', '380'],
  ]) {
    const results = searchTransport(input, transportOptions)[family].results;
    assert(results.some((result) => result.kind === kind && result.entry.id === id), `${input}: ${kind}/${id}`);
  }
  const b2 = searchTransport('B2', transportOptions).routes.results;
  assert(b2.some((result) => result.kind === 'bus_route' && result.route.number === 'B2'));
  const hungShuiKiu = searchTransport('洪水橋', transportOptions).stops;
  assert(hungShuiKiu.results.some(({ kind }) => kind === 'bus_stop'));
  assert(hungShuiKiu.results.some(({ kind }) => kind === 'light_rail_stop'));
  const yuenLong = searchTransport('元朗', transportOptions).stops.results;
  assert(yuenLong.some(({ key }) => key === 'mtr_station:YUL'));
  assert(yuenLong.some(({ key }) => key === 'light_rail_stop:600'));
  assert.equal(new Set(yuenLong.map(({ key }) => key)).size, yuenLong.length);
  assert.equal(searchTransport('ADM', transportOptions).stops.results.filter(({ key }) => key === 'mtr_station:ADM').length, 1);
  const noBus = { busCatalogue: { feeds: {}, loading: false, failed: { kmbLwb: 'network' } }, busStops: { status: 'failed' } };
  assert(group(searchGlobal('610', noBus), 'transport_route').results.some(({ kind }) => kind === 'light_rail_route'));
  assert(group(searchGlobal('Admiralty', noBus), 'transport_stop').results.some(({ kind }) => kind === 'mtr_station'));
  assert.equal(searchTransport('68x', { ...transportOptions, mode: 'bus' }).routes.totalMatches, 0);
  assert.equal(searchTransport('68x', { ...transportOptions, mode: 'bus', surface: 'transport' }).routes.totalMatches, 2,
    'The dedicated bus substring rule remains explicit in the shared adapter');

  const inputs = ['公園', 'CENTRAL', '香港', 'TOILETS', '龍脊', 'LIBRARY', '268X', '西九', '站', 'PARK'];
  const durations = [];
  for (let i = 0; i < 200; i++) {
    const t = performance.now();
    searchGlobal(inputs[i % inputs.length], options);
    durations.push(performance.now() - t);
  }
  durations.sort((a, b) => a - b);
  console.log(`Node timing | first stop SQLite load/index ${stopInitMs.toFixed(1)} ms | first facility index/query ${facilitiesInitMs.toFixed(1)} ms | 200 warm mixed queries median ${durations[100].toFixed(2)} ms, p95 ${durations[189].toFixed(2)} ms`);
  assert.equal(stopReads, 3, 'Repeated queries use prepared indices');
  assert.equal(networkCalls, 0, 'Global search never fetches by keystroke');
  console.log('PASS: four groups, shared transport registry, all 187 railway entries, bilingual/code queries, stable IDs, failure isolation and offline reads');
}

verify().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => {
  globalThis.fetch = originalFetch;
  db.close();
});
