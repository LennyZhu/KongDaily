const assert = require('node:assert/strict');
const { existsSync, readFileSync, readdirSync } = require('node:fs');
const { dirname, join, resolve } = require('node:path');
const { getRoutes } = require('expo-router/build/getRoutes');
const { getReactNavigationConfig } = require('expo-router/build/getReactNavigationConfig');
const { resolveHref } = require('expo-router/build/link/href');
const { getStateFromPath } = require('expo-router/build/react-navigation/core/getStateFromPath');
const { getActionFromState } = require('expo-router/build/react-navigation/core/getActionFromState');
const { StackRouter } = require('expo-router/build/react-navigation/routers/StackRouter');
const ts = require('typescript');

const root = join(__dirname, '..');
const appFiles = readdirSync(join(root, 'src/app'), { recursive: true }).filter((file) => file.endsWith('.tsx'));
const context = Object.assign(() => ({ default() {} }), { keys: () => appFiles.map((file) => './' + file) });
const config = JSON.parse(JSON.stringify(getReactNavigationConfig(getRoutes(context)), (key, value) =>
  key === '_route' ? undefined : key === 'path' && value === '(tabs)' ? '' : value));
const stack = StackRouter({ initialRouteName: '(tabs)' });
const options = { routeNames: Object.keys(config.screens), routeParamList: {}, routeGetIdList: {} };
const stateFor = (href) => getStateFromPath(resolveHref(href), config);
function push(origin, href) {
  return stack.getStateForAction(origin, { ...getActionFromState(stateFor(href), config), type: 'PUSH' }, options);
}
const tab = stack.getRehydratedState(stateFor('/nearby?category=pets&view=list'), options);
const search = push(tab, '/search');
assert.equal(search.routes.at(-1).name, 'search');
const pop = (state) => stack.getStateForAction(state, { type: 'GO_BACK' }, options);

const openings = [];
const safeRouter = { canGoBack: () => canGoBack, back: () => openings.push('back'), replace: (href) => openings.push(href) };
let canGoBack = true;
let params = {};
let locale = 'zh-HK';
let destinationStack = search;
let sequences = {};
let routeFamily;
let readRouteId;
let stationRead;
let stationRoutes;
let focus;
let loadedFavorites = 0;
let slot = 0;
let slots;
let effects;
function render(component, props = {}, state = []) {
  slot = 0;
  slots = state;
  effects = [];
  return { tree: component(props), effects, state };
}
const react = {
  useState(initial) {
    const i = slot++;
    const state = slots;
    if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
    return [state[i], (next) => { state[i] = typeof next === 'function' ? next(state[i]) : next; }];
  },
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
  useRef: (current) => ({ current }),
  useEffect: (fn) => effects.push(fn),
  useImperativeHandle() {},
};
const nativeViews = Object.fromEntries(['FlatList', 'ScrollView', 'Pressable', 'View', 'ActivityIndicator']
  .map((name) => [name, name]));
const sharedMap = 'NearbyFacilitiesMap';
const selectionCard = 'FacilitySelectionCard';
const stubs = {
  react,
  'expo-router': {
    Stack: { Screen: 'StackScreen' },
    useLocalSearchParams: () => params,
    useRouter: () => safeRouter,
    useNavigation: () => ({ getState: () => destinationStack }),
    useRoute: () => destinationStack.routes.at(-1),
    useFocusEffect: (fn) => { focus = fn; },
  },
  'expo-sqlite': {},
  'react-native': {
    ...nativeViews, StyleSheet: { create: (value) => value, hairlineWidth: 1 },
    useWindowDimensions: () => ({ height: 780, width: 320, fontScale: 1.8 }),
  },
  'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ bottom: 30 }) },
  'react-native-maps': { __esModule: true, default: 'MapView', Marker: 'Marker' },
  '@/language': { useLanguage: () => ({ copy: messages[locale], locale }) },
  '@/components/ui': Object.fromEntries(['AppText', 'Icon', 'Screen', 'EmptyState'].map((name) => [name, name])),
  '@/components/nearby-facilities-map': { NearbyFacilitiesMap: sharedMap },
  '@/components/map-boundary': { MapBoundary: 'MapBoundary' },
  '@/components/facility-selection-card': { FacilitySelectionCard: selectionCard },
  '@/facility-favorite-hooks': { loadFacilityFavorites: () => { loadedFavorites++; } },
  '@/bus-data': {
    async findBusRouteFamily(id) { readRouteId = id; return routeFamily; },
  },
  '@/bus-stop-hooks': { useRouteSequences: () => ({ sequences }), useRouteStopNames: () => ({ names: {} }) },
  '@/bus-eta-hooks': {},
  '@/bus-favorite-hooks': {},
  '@/route-stop-recommendation': { useRouteStopRecommendation: () => ({}) },
  '@/components/bus-ui': { BusAction: 'BusAction' },
  '@/nearby-stop-eta-hooks': {
    useStationEta(routes) { stationRoutes = routes; return { records: {}, now: 0 }; },
  },
};
const modules = new Map();
function load(name) {
  if (modules.has(name)) return modules.get(name).exports;
  const base = join(root, 'src', name + '.ts');
  const file = existsSync(base) ? base : base + 'x';
  const mod = { exports: {} };
  modules.set(name, mod);
  const script = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  new Function('module', 'exports', 'require', script)(mod, mod.exports, (id) => {
    if (Object.hasOwn(stubs, id)) return stubs[id];
    if (id.startsWith('@/')) return load(id.slice(2));
    if (id.startsWith('.')) return require(resolve(dirname(file), id));
    return require(id);
  });
  return mod.exports;
}
function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  return node?.props ? [node, ...nodes(node.props.children)] : [];
}
function find(tree, type) {
  return nodes(tree).find((node) => node.type === type || node.type.name === type);
}
function copyPresent(tree, copy) {
  return nodes(tree).some(({ props }) => props.children === copy || props.title === copy);
}

const { messages } = load('i18n');
const { parseBusCatalogue } = load('bus-routes');
const { getExplorePlaces } = load('explore-places');
const { resolveFacilityIdentity, resolveStableFacilityIdentity } = load('facility-identity');
const { facilityId, nearbyFacilities, visibleFacilityMarkers } = load('facilities');
const { searchResultDestination } = load('global-search-navigation');
const { routeStopKey } = load('bus-stops');
const end = { orig_tc: '起點', orig_en: 'Origin', dest_tc: '終點', dest_en: 'Destination' };
const kmb = parseBusCatalogue('kmbLwb', { data: [
  { ...end, route: '23', bound: 'O', service_type: '1' },
  { ...end, route: '268X', bound: 'I', service_type: '1' },
  { ...end, route: '268X', bound: 'O', service_type: '3' },
  { ...end, route: '268X', bound: 'I', service_type: '3' },
] });
const city = parseBusCatalogue('citybus', { data: [{ ...end, co: 'CTB', route: '23' }] })[0];
const nlb = parseBusCatalogue('nlb', { routes: [{ routeNo: 'B2', routeId: 37, routeName_c: '起點 > 終點' }] })[0];
const routeResult = (route) => ({ kind: 'bus_route', route });
const stops = require('../assets/data/nearby-stops.json').stops;
const station = stops.citybus.find(([id]) => id === '001027');
assert(station);
const stopResult = (source, stopId) => ({ kind: 'bus_stop', source, stopId, etaContext: 'route_required' });
const identity = resolveFacilityIdentity(nearbyFacilities.find(({ source }) => source === 'afcd')).identity;
const facilityResult = (value) => ({ kind: 'facility', identity: value });
const exploreResult = (place) => ({ kind: 'explore_place', place });

function navigate(result, name, expectedParams) {
  const { href } = searchResultDestination(result);
  assert.ok(href, name);
  const state = push(search, href);
  assert.deepEqual(state.routes.map(({ name }) => name), ['(tabs)', 'search', name]);
  assert.equal(state.routes[0], tab.routes[0], 'Keep the original Nearby Tab route and its state');
  assert.deepEqual(state.routes.at(-1).params, expectedParams);
  const returned = pop(state);
  assert.equal(returned.routes.at(-1).key, search.routes.at(-1).key);
  assert.equal(returned.routes[0], tab.routes[0]);
  return state;
}

async function main() {
  const { railwaySearchResult } = load('global-search');
  const { findMtrLine, findMtrStation } = load('mtr-static');
  const { findLightRailRoute, findLightRailStop } = load('light-rail-static');
  for (const entry of [findMtrLine('ISL'), findMtrStation('ADM'), findMtrStation('CEN'), findMtrStation('HOK')]) {
    const result = railwaySearchResult(entry);
    navigate(result, 'mtr/[kind]', { kind: entry.kind === 'mtr-line' ? 'line' : 'station', code: entry.id });
    assert.deepEqual(searchResultDestination({ ...result, entry: { ...entry, id: 'UNKNOWN' } }), { issue: 'resultUnavailable' });
  }
  for (const entry of [findLightRailRoute('610'), findLightRailRoute('705'), findLightRailRoute('706'), findLightRailStop('250'), findLightRailStop('380')]) {
    const result = railwaySearchResult(entry);
    navigate(result, 'light-rail/[kind]', { kind: entry.kind === 'light-rail-route' ? 'route' : 'stop', id: entry.id });
    assert.deepEqual(searchResultDestination({ ...result, entry: { ...entry, id: 'UNKNOWN' } }), { issue: 'resultUnavailable' });
  }
  assert.deepEqual(searchResultDestination({ kind: 'mtr_station', entry: findLightRailStop('250') }), { issue: 'resultUnavailable' });
  assert.deepEqual(searchResultDestination({ kind: 'light_rail_stop', entry: findMtrStation('ADM') }), { issue: 'resultUnavailable' });
  for (const route of [...kmb, city, nlb]) navigate(routeResult(route), 'bus/route', { routeId: route.id });
  assert.notEqual(searchResultDestination(routeResult(kmb[0])).href.params.routeId, city.id);
  for (const route of [
    { ...kmb[2], direction: 'inbound' }, { ...kmb[2], serviceType: '1' }, { ...city, id: kmb[0].id },
    { ...nlb, routeId: '38' },
  ]) assert.deepEqual(searchResultDestination(routeResult(route)), { issue: 'resultUnavailable' });

  navigate(stopResult('citybus', station[0]), 'bus/nearby/stop', { source: 'citybus', stopId: '001027' });
  const byName = new Map();
  const twins = stops.kmbLwb.find(([id, name]) => {
    if (byName.has(name) && id !== byName.get(name)) return true;
    byName.set(name, id);
    return false;
  });
  assert(twins);
  for (const id of [twins[0], byName.get(twins[1])]) navigate(stopResult('kmbLwb', id), 'bus/nearby/stop', { source: 'kmbLwb', stopId: id });

  navigate(facilityResult(identity), 'search/facility-map', identity);
  assert.notEqual(identity.stableFacilityId, resolveStableFacilityIdentity(identity).facility.officialId);
  assert.deepEqual(searchResultDestination(facilityResult({ ...identity, source: 'fehd' })), { issue: 'facilityUnavailable' });
  for (const place of getExplorePlaces()) navigate(exploreResult(place), 'explore/place/[id]', { id: place.id });
  assert.deepEqual(searchResultDestination(exploreResult({ id: 'unknown' })), { issue: 'resultUnavailable' });

  testFacilityMap();
  await testRouteSelection();
  await testStationWithoutRoute();
  console.log('PASS: C3 exact identities, root Stack push/pop, isolated map and safe bus direction/stop handling');
}

function testFacilityMap() {
  const screen = load('app/search/facility-map').default;
  params = identity;
  const shell = render(screen).tree;
  const host = find(shell, 'FacilityMap');
  const resolved = resolveStableFacilityIdentity(identity);
  const first = render(host.type, host.props);
  const map = find(first.tree, sharedMap).props;
  assert.equal(map.selectedId, facilityId(resolved.facility));
  assert.deepEqual({ latitude: map.initialRegion.latitude, longitude: map.initialRegion.longitude }, resolved.facility.coordinate);
  assert.equal(find(first.tree, selectionCard).props.selected.facility, resolved.facility);
  assert.equal(find(first.tree, selectionCard).props.distance, undefined);
  for (const prop of ['devicePoint', 'onLocate', 'onShowList', 'onSearchArea']) assert.equal(map[prop], undefined);
  const markers = visibleFacilityMarkers(map.items, map.initialRegion, { width: 320, height: 420 }, map.selectedId);
  assert.ok(markers.some(({ item }) => item?.id === map.selectedId));
  assert.ok(markers.length <= 100);
  focus();
  assert.equal(loadedFavorites, 1);

  const nativeMap = load('components/nearby-facilities-map').NearbyFacilitiesMap;
  const native = render(nativeMap, map);
  const selectedPin = nodes(native.tree).find(({ type, props }) => type === 'Marker' && props.identifier === map.selectedId);
  assert.equal(selectedPin.props.accessibilityState.selected, true);
  find(native.tree, 'MapView').props.onMapReady();
  const ready = render(nativeMap, map, native.state).tree;
  assert.equal(find(ready, 'Pressable'), undefined, 'An isolated map offers no location or search-area action');
  find(ready, 'MapBoundary').props.onFailure();
  const failed = render(nativeMap, map, native.state).tree;
  assert.ok(copyPresent(failed, messages[locale].nearby.retryMap));
  assert.ok(!copyPresent(failed, messages[locale].nearby.showList));
  assert.equal(find(render(host.type, host.props, first.state).tree, selectionCard).props.selected.id, map.selectedId);
  find(failed, 'Pressable').props.onPress();
  assert.ok(copyPresent(render(nativeMap, map, native.state).tree, messages[locale].nearby.mapLoading));

  const other = map.items.find(({ id }) => id !== map.selectedId);
  map.onSelect(other);
  let updated = render(host.type, host.props, first.state).tree;
  assert.equal(find(updated, selectionCard).props.selected.id, other.id);
  assert.equal(find(updated, sharedMap).props.selectedId, other.id);
  find(updated, sharedMap).props.onDismiss();
  updated = render(host.type, host.props, first.state).tree;
  assert.equal(find(updated, selectionCard), undefined);
  const reopened = render(host.type, host.props).tree;
  assert.equal(find(reopened, sharedMap).props.selectedId, map.selectedId);
  assert.equal(find(shell, 'StackScreen').props.options.headerLeft({ canGoBack: true }), null);

  const registry = load('facility-identity');
  const actualResolver = registry.resolveStableFacilityIdentity;
  registry.resolveStableFacilityIdentity = (candidate) => candidate.stableFacilityId === identity.stableFacilityId
    ? { status: 'needs_review' } : actualResolver(candidate);
  for (locale of ['zh-HK', 'en']) {
    params = identity;
    assert.deepEqual(searchResultDestination(facilityResult(identity)), { issue: 'facilityNeedsReview' });
    const needsReview = render(screen).tree;
    assert.ok(copyPresent(needsReview, messages[locale].search.facilityNeedsReview));
    assert.equal(find(needsReview, 'FacilityMap'), undefined);
    for (params of [{}, { ...identity, source: ['afcd'] }, { ...identity, stableFacilityId: 'retired-or-unknown' }]) {
      const invalid = render(screen).tree;
      assert.ok(copyPresent(invalid, messages[locale].search.facilityUnavailable));
      assert.ok(copyPresent(invalid, messages[locale].search.backToSearch));
      assert.equal(find(invalid, 'FacilityMap'), undefined);
      canGoBack = true;
      find(invalid, 'Pressable').props.onPress();
      assert.equal(openings.at(-1), 'back');
      canGoBack = false;
      find(invalid, 'Pressable').props.onPress();
      assert.equal(openings.at(-1), '/search');
    }
  }
  registry.resolveStableFacilityIdentity = actualResolver;
  canGoBack = true;
}

const tick = () => new Promise(setImmediate);
function sequence(identity, name) {
  return [routeStopKey(identity), { loading: false, snapshot: { stops: [{ id: name, seq: 1, name: { zh: name, en: name } }] } }];
}
async function openRoute(route, routes, fromSearch = true) {
  params = searchResultDestination(routeResult(route)).href.params;
  destinationStack = push(fromSearch ? search : push(tab, '/bus'), { pathname: '/bus/route', params });
  const loaderNode = render(load('app/bus/route').default).tree;
  assert.equal(loaderNode.props.fromSearch, fromSearch);
  routeFamily = { selected: route, routes };
  const loading = render(loaderNode.type, loaderNode.props);
  loading.effects.forEach((effect) => effect());
  await tick();
  assert.equal(readRouteId, route.id);
  return render(loaderNode.type, loaderNode.props, loading.state).tree;
}

async function testRouteSelection() {
  sequences = Object.fromEntries([
    sequence({ source: 'citybus', number: '23', direction: 'outbound' }, 'Citybus outbound'),
    sequence({ source: 'citybus', number: '23', direction: 'inbound' }, 'Citybus inbound'),
  ]);
  const ctb = await openRoute(city, [city]);
  const decision = render(ctb.type, ctb.props);
  assert.ok(copyPresent(decision.tree, messages[locale].search.chooseDirection));
  assert.equal(find(decision.tree, 'TimelineRow'), undefined);
  const options = nodes(decision.tree).filter(({ type }) => type.name === 'RouteOption');
  assert.equal(options.length, 2);
  assert.ok(options.every(({ props }) => !props.selected));
  options[1].props.onPress();
  assert.equal(find(render(ctb.type, ctb.props, decision.state).tree, 'TimelineRow').props.name, 'Citybus inbound');
  const ctbOrdinary = await openRoute(city, [city], false);
  assert.equal(find(render(ctbOrdinary.type, ctbOrdinary.props).tree, 'TimelineRow').props.name, 'Citybus outbound');

  sequences = Object.fromEntries([
    sequence({ source: 'kmbLwb', number: '268X', direction: 'inbound', serviceType: '3' }, 'Other direction'),
    sequence({ source: 'kmbLwb', number: '268X', direction: 'inbound', serviceType: '1' }, 'Regular service'),
  ]);
  const special = await openRoute(kmb[2], kmb.slice(1));
  const pending = render(special.type, special.props);
  assert.equal(find(pending.tree, 'TimelineRow'), undefined);
  assert.ok(find(pending.tree, 'RouteLoading'));
  const outbound = { source: 'kmbLwb', number: '268X', direction: 'outbound', serviceType: '3' };
  sequences[routeStopKey(outbound)] = { loading: false, error: { kind: 'network' } };
  assert.equal(find(render(special.type, special.props, pending.state).tree, 'TimelineRow'), undefined);
  sequences = { ...sequences, ...Object.fromEntries([sequence(outbound, 'Requested special service')]) };
  assert.equal(find(render(special.type, special.props, pending.state).tree, 'TimelineRow').props.name, 'Requested special service');

  sequences = Object.fromEntries([sequence({ source: 'nlb', number: 'B2', routeId: '37' }, 'Official variant 37')]);
  const island = await openRoute(nlb, [nlb]);
  assert.equal(find(render(island.type, island.props).tree, 'TimelineRow').props.name, 'Official variant 37');
}

async function testStationWithoutRoute() {
  const data = load('nearby-bus-data');
  data.readNearbyBusStop = async (source, stopId) => {
    stationRead = { source, stopId };
    return { source, stop_id: stopId, name_zh: station[1], name_en: station[2] };
  };
  const routes = load('nearby-stop-routes');
  routes.readStationRoutes = async () => ({ routes: [], capturedAt: 0 });
  params = { source: 'citybus', stopId: '001027' };
  const host = render(load('app/bus/nearby/stop').default).tree;
  const loading = render(host.type, host.props);
  loading.effects.forEach((effect) => effect());
  await tick();
  assert.deepEqual(stationRead, params);
  const stationList = render(host.type, host.props, loading.state).tree;
  const list = render(stationList.type, stationList.props).tree;
  assert.deepEqual(list.props.data, []);
  assert.deepEqual(stationRoutes, []);
  assert.deepEqual(routes.stationEtaJobs(stationRoutes, locale), []);
  assert.ok(copyPresent(list.props.ListHeaderComponent, station[2]));
  assert.equal(find(list.props.ListHeaderComponent, 'BusAction'), undefined);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
