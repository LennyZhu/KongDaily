const assert = require('node:assert/strict');
const { existsSync, readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { mock } = require('node:test');
const ts = require('typescript');
const { getRoutes } = require('expo-router/build/getRoutes');
const { getReactNavigationConfig } = require('expo-router/build/getReactNavigationConfig');
const { resolveHref } = require('expo-router/build/link/href');
const { getStateFromPath } = require('expo-router/build/react-navigation/core/getStateFromPath');
const { StackRouter } = require('expo-router/build/react-navigation/routers/StackRouter');

const root = join(__dirname, '..');
const { stops } = require('../assets/data/nearby-stops.json');
const { sources } = require('../assets/data/nearby-stop-routes.json');
const geometryPack = require('../assets/data/bus-route-geometry.json');
const sourcePoints = Object.fromEntries(Object.entries(stops).map(([source, rows]) => [
  source, new Map(rows.map(([id, , , latitude, longitude]) => [id, { latitude, longitude }])),
]));
const actions = [];
const react = {
  Component: class {},
  useEffect(fn) { effects.push(fn); },
  useMemo(fn, dependencies) {
    const index = memoIndex++;
    if (!memos.has(state)) memos.set(state, []);
    const cache = memos.get(state);
    const entry = cache[index];
    if (entry && entry.dependencies.length === dependencies.length
        && dependencies.every((value, i) => Object.is(value, entry.dependencies[i]))) return entry.value;
    const value = fn();
    cache[index] = { dependencies, value };
    return value;
  },
  useCallback: (fn, dependencies) => react.useMemo(() => fn, dependencies),
  useRef(current) {
    if (!refs.has(state)) refs.set(state, []);
    const cache = refs.get(state);
    const index = refIndex++;
    return cache[index] ?? (cache[index] = { current });
  },
  useState(initial) {
    const index = hookIndex++;
    const local = state;
    if (!Object.hasOwn(local, index)) local[index] = typeof initial === 'function' ? initial() : initial;
    return [local[index], (value) => { local[index] = typeof value === 'function' ? value(local[index]) : value; }];
  },
};
let state = {};
let hookIndex = 0;
let memoIndex = 0;
let refIndex = 0;
let effects = [];
let focusedEffect;
const memos = new WeakMap();
const refs = new WeakMap();
let locale = 'zh-HK';
let sequence;
const native = Object.fromEntries(['ActivityIndicator', 'FlatList', 'Pressable', 'ScrollView', 'TextInput', 'View'].map((type) => [type, type]));
Object.assign(native, { Keyboard: { dismiss() {} }, StyleSheet: { create: (styles) => styles, absoluteFill: {} } });
native.AppState = { currentState: 'active', addEventListener: () => ({ remove() {} }) };
const stubs = {
  react, 'react-native': native, 'expo-sqlite': {}, 'expo-location': {},
  'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
  'react-native-maps': { __esModule: true, default: 'MapView', Marker: 'Marker', Polyline: 'Polyline' },
  'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ bottom: 0 }) },
  'expo-router': {
    useRouter: () => ({ push: (href) => actions.push(href), canGoBack: () => true }),
    useFocusEffect: (fn) => { focusedEffect = fn; },
  },
  '@/language': { useLanguage: () => ({ copy: load('i18n').messages[locale], locale }) },
  '@/components/ui': { AppText: 'AppText', EmptyState: 'EmptyState', Icon: 'Icon', Screen: 'Screen' },
  '@/components/home-ui': { HarbourBackdrop: 'HarbourBackdrop' },
  '@/components/saved-bus-ui': { FavoriteBusRow: 'FavoriteBusRow' },
  '@/bus-favorite-hooks': { useBusFavorites: () => ({ items: [], status: 'ready' }) },
  '@/bus-hooks': {
    useBusCatalogue: () => ({ feeds: {}, failed: {} }),
    useBusHistory: () => ({ history: [] }),
  },
  '@/bus-stop-hooks': {
    useRouteSequences: () => ({ sequences: sequence }),
    useRouteStopNames: () => ({ names: {} }),
  },
  '@/route-stop-recommendation': { useRouteStopRecommendation: () => ({}) },
};
const modules = new Map();

function load(name) {
  if (modules.has(name)) return modules.get(name).exports;
  const tsPath = join(root, 'src', name + '.ts');
  const filename = existsSync(tsPath) ? tsPath : tsPath + 'x';
  const module = { exports: {} };
  modules.set(name, module);
  const testExports = { 'app/bus/route-map': 'RouteMap', 'app/bus/route': 'RouteDetails', 'app/bus/nearby': 'RouteCard' }[name];
  const source = readFileSync(filename, 'utf8') + (testExports ? '\nexport { ' + testExports + ' };' : '');
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } });
  new Function('module', 'exports', 'require', outputText)(module, module.exports, (id) => {
    if (Object.hasOwn(stubs, id)) return stubs[id];
    if (id.startsWith('@/')) return load(id.slice(2));
    return require(id);
  });
  return module.exports;
}

function render(component, props) {
  hookIndex = 0;
  memoIndex = 0;
  refIndex = 0;
  effects = [];
  focusedEffect = undefined;
  return component(props);
}

function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements);
  return node?.props ? [node, ...elements(node.props.children)] : [];
}

function preview(tree) {
  return elements(tree).find(({ type }) => type.name === 'MapStopArrival');
}

function action(tree, label) {
  return elements(tree).find(({ type, props }) => type === 'Pressable'
    && elements(props.children).some(({ props }) => props.children === label));
}

const { buildBusMapStops, busRouteMapHref, numberedBusMapStops, readBusMapChoice } = load('bus-route-map');
const { readBusRouteGeometry } = load('bus-route-geometry');
const { routeStopKey, parseBusStop, parseRouteStops, stopVisitKey } = load('bus-stops');
const { parseBusCatalogue } = load('bus-routes');
const { readEtaTarget } = load('bus-eta');
const { BusStopMap } = load('components/bus-stop-map');
const { BusAction, BusHero, BusLanding } = load('components/bus-ui');
const { RouteMap } = load('app/bus/route-map');
const { RouteDetails } = load('app/bus/route');
const { messages } = load('i18n');

function fixture(source, number, bound, variant) {
  const feed = sources[source];
  const index = feed.routes.findIndex((route) => route[0] === number && route[1] === bound && route[2] === variant);
  assert.notEqual(index, -1);
  const [, , , , , , originZh, originEn] = feed.routes[index];
  const stops = Object.entries(feed.stops).flatMap(([id, visits]) => visits
    .filter(([route]) => route === index).map(([, seq]) => ({ id, seq }))).sort((a, b) => a.seq - b.seq);
  const row = source === 'nlb' ? { routeId: variant, routeNo: number,
    routeName_c: `${originZh} > ${feed.routes[index][3]}`, routeName_e: `${originEn} > ${feed.routes[index][4]}` }
    : { co: 'CTB', route: number, bound, service_type: variant, orig_tc: '起點', dest_tc: feed.routes[index][3] };
  const [route] = parseBusCatalogue(source, source === 'nlb' ? { routes: [row] } : { data: [row] });
  const direction = source === 'nlb' ? undefined : bound === 'O' ? 'outbound' : 'inbound';
  return { choice: readBusMapChoice(route, direction), route, stops };
}

const samples = [
  fixture('kmbLwb', '1', 'O', '1'), fixture('kmbLwb', '1', 'I', '1'),
  fixture('citybus', '1', 'O', ''), fixture('citybus', '23', 'I', ''),
  fixture('kmbLwb', '268X', 'O', '1'), fixture('kmbLwb', '268X', 'O', '3'),
  fixture('kmbLwb', '10', 'O', '1'), fixture('kmbLwb', '296A', 'O', '1'),
  fixture('nlb', 'B2', '', '37'), fixture('nlb', 'B2', '', '38'),
  fixture('nlb', 'B2P', '', '33'), fixture('nlb', 'B2P', '', '34'),
];
const keys = new Set();
for (const { choice, route, stops } of samples) {
  assert(choice);
  const map = buildBusMapStops(choice.identity, stops, sourcePoints[choice.identity.source], () => undefined);
  assert.equal(map.status, 'stops_only');
  assert.equal(map.markers.length, stops.length);
  assert.deepEqual(map.markers.map(({ stop }) => stop), stops);
  assert.equal(new Set(map.visits.map(({ key }) => key)).size, stops.length);
  keys.add(map.routeKey);
  assert.equal(busRouteMapHref(route.id, choice.identity).params.routeId, route.id);
}
assert.equal(keys.size, samples.length, 'Operator, direction and service variants are distinct');
assert.equal(readBusMapChoice(samples[0].route, 'inbound'), undefined);
assert.equal(readBusMapChoice(samples[2].route, undefined), undefined);
assert.equal(readBusMapChoice(samples[2].route, ['outbound']), undefined);
assert.equal(readBusMapChoice(samples.at(-1).route, 'outbound'), undefined);

for (const { stops } of samples.slice(6, 8)) {
  assert.equal(stops[0].id, stops.at(-1).id);
  assert.notEqual(stops[0].seq, stops.at(-1).seq);
}
for (const { stops } of samples.slice(8)) {
  assert(stops.some(({ id }) => id === '152'));
  assert.deepEqual(sourcePoints.nlb.get('152'), { latitude: 22.497433, longitude: 113.950509 });
}
assert.equal(parseBusStop('citybus', '001027', { data: {
  stop: '001027', name_tc: '中環', lat: '22.288274', long: '114.150422',
} }).coordinate.longitude, 114.150422);
assert.equal(parseBusStop('citybus', '001027', { data: {
  stop: '001027', name_tc: '中環', lat: '114.150422', long: '22.288274',
} }).coordinate, undefined);
const citybus = samples[2];
const firstCitybus = citybus.stops[0];
const citybusPoint = sourcePoints.citybus.get(firstCitybus.id);
const fallback = buildBusMapStops(citybus.choice.identity, [firstCitybus], new Map([
  [firstCitybus.id, { latitude: Infinity, longitude: 114 }],
]), (id) => id === firstCitybus.id ? citybusPoint : undefined);
assert.equal(fallback.markers[0].coordinate, citybusPoint);

const { choice, route } = samples[8];
const visits = parseRouteStops(choice.identity, { stops: [
  { stopId: 161, stopName_c: '元朗港鐵站', stopName_e: 'Yuen Long MTR Station', latitude: '22.446189', longitude: '114.034816' },
  { stopId: 152, stopName_c: '深圳灣口岸', stopName_e: 'Shenzhen Bay Port', latitude: '22.497433', longitude: '113.950509' },
  { stopId: 152, stopName_c: '深圳灣口岸', stopName_e: 'Shenzhen Bay Port', latitude: '22.497433', longitude: '113.950509' },
  { stopId: 999, stopName_c: '缺座標站', latitude: 'NaN', longitude: '' },
] });
const mixed = buildBusMapStops(choice.identity, visits, new Map([
  ['999', { latitude: 0, longitude: 0 }],
]), () => undefined);
assert.equal(mixed.markers.length, 3);
assert.equal(mixed.visits.length, 4);
assert.equal(mixed.visits[3].coordinate, undefined);
assert.equal(buildBusMapStops(choice.identity, [visits[3]], new Map(), () => undefined).status, 'unavailable');

const appFiles = readdirSync(join(root, 'src/app'), { recursive: true }).filter((file) => file.endsWith('.tsx'));
const context = Object.assign(() => ({ default() {} }), { keys: () => appFiles.map((file) => './' + file) });
const config = JSON.parse(JSON.stringify(getReactNavigationConfig(getRoutes(context)), (key, value) =>
  key === '_route' ? undefined : key === 'path' && value === '(tabs)' ? '' : value));
const stack = StackRouter({ initialRouteName: 'bus' });
const stackOptions = { routeNames: Object.keys(config.screens), routeParamList: {}, routeGetIdList: {} };
const stateFor = (href) => getStateFromPath(resolveHref(href), config);
const homeState = stack.getRehydratedState(stateFor('/'), stackOptions);
const transportName = stateFor('/transport').routes.at(-1).name;
assert.equal(transportName, 'transport');
const transportStack = stack.getStateForAction(homeState, { type: 'PUSH', payload: { name: transportName } }, stackOptions);
assert.equal(transportStack.routes.at(-1).name, 'transport');
assert.equal(stack.getStateForAction(transportStack, { type: 'GO_BACK' }, stackOptions).routes.at(-1), homeState.routes.at(-1));
const addFrequent = stateFor('/transport?intent=add-frequent-route').routes.at(-1);
assert.equal(addFrequent.name, 'transport');
assert.deepEqual(addFrequent.params, { intent: 'add-frequent-route' });
const findFrequent = { type: 'NAVIGATE', payload: { name: addFrequent.name, params: addFrequent.params } };
const frequentStack = stack.getStateForAction(homeState, findFrequent, stackOptions);
assert.equal(stack.getStateForAction(frequentStack, findFrequent, stackOptions).routes.length, frequentStack.routes.length);
const matchedRoute = stack.getStateForAction(frequentStack, { type: 'PUSH', payload: {
  name: 'bus/route', params: { routeId: route.id },
} }, stackOptions);
assert.equal(matchedRoute.routes.at(-1).params.routeId, route.id);
assert.equal(stack.getStateForAction(matchedRoute, { type: 'GO_BACK' }, stackOptions).routes.at(-1), frequentStack.routes.at(-1));
assert.equal(stack.getStateForAction(frequentStack, { type: 'GO_BACK' }, stackOptions).routes.at(-1), homeState.routes.at(-1));
for (const [name, params] of [
  ['bus/route', { routeId: route.id, stopId: visits[2].id, stopSeq: String(visits[2].seq) }],
  ['bus/nearby/stop', { source: 'nlb', stopId: visits[2].id, distance: '120' }],
]) {
  const detail = stack.getStateForAction(transportStack, { type: 'PUSH', payload: { name, params } }, stackOptions);
  assert.deepEqual(detail.routes.at(-1).params, params);
  for (const action of [{ type: 'GO_BACK' }, { type: 'POP', payload: { count: 1 } }]) {
    assert.equal(stack.getStateForAction(detail, action, stackOptions).routes.at(-1), transportStack.routes.at(-1));
  }
}
const homeBusSearch = stack.getStateForAction(homeState, { type: 'PUSH', payload: { name: 'bus' } }, stackOptions);
assert.equal(homeBusSearch.routes.at(-1).name, 'bus');
assert.equal(stack.getStateForAction(homeBusSearch, { type: 'GO_BACK' }, stackOptions).routes.at(-1), homeState.routes.at(-1));
for (const name of ['bus', 'bus/nearby', 'bus/nearby/stop', 'bus/route', 'bus/route-map', 'bus/eta']) {
  assert.equal(stateFor(`/${name}`).routes.at(-1).name, name);
}
const routeHref = { pathname: '/bus/route', params: { routeId: route.id } };
const href = busRouteMapHref(route.id, choice.identity, visits[2]);
const mapParams = stateFor(href).routes.at(-1).params;
assert.deepEqual(mapParams, href.params);
const original = stack.getRehydratedState(stateFor(routeHref), stackOptions);
const pushed = stack.getStateForAction(original, { type: 'PUSH', payload: {
  name: 'bus/route-map', params: mapParams,
} }, stackOptions);
assert.equal(pushed.routes.at(-1).name, 'bus/route-map');
assert.equal(stack.getStateForAction(pushed, { type: 'GO_BACK' }, stackOptions).routes.at(-1), original.routes.at(-1));

for (locale of ['zh-HK', 'en']) {
  const labels = messages[locale];
  state = {};
  let opened = false;
  const landing = render(BusLanding, { copy: labels.bus, locale, history: [], routesById: new Map(),
    onMap: () => { opened = true; } });
  const shortcut = elements(landing).find(({ type, props }) => type === 'Pressable'
    && elements(props.children).some(({ props }) => props.children === labels.bus.shortcuts.map));
  shortcut.props.onPress();
  assert(opened);

  state = {};
  const BusScreen = load('app/bus').default;
  const home = render(BusScreen);
  const header = elements(elements(home).find(({ type }) => type === 'FlatList').props.ListHeaderComponent);
  let focused = false;
  header.find(({ type }) => type === BusHero).props.inputRef.current = { focus: () => { focused = true; } };
  header.find(({ type }) => type === BusLanding).props.onMap();
  assert(focused);
  const choosing = elements(render(BusScreen)).find(({ type }) => type === 'FlatList').props.ListHeaderComponent;
  assert(elements(choosing).some(({ props }) => props.children === labels.busMap.chooseRoute));

  state = {};
  const ordinary = samples[4];
  const special = samples[5];
  sequence = Object.fromEntries([ordinary, special].map(({ choice, stops }) =>
    [routeStopKey(choice.identity), { snapshot: { stops, fetchedAt: 1 }, loading: false }]));
  const routeProps = { family: { selected: ordinary.route, routes: [ordinary.route, special.route] }, boarding: {} };
  const details = elements(render(RouteDetails, routeProps));
  details.find(({ type, props }) => type.name === 'RouteOption' && props.label === labels.bus.service('3')).props.onPress();
  const selectedDetails = elements(render(RouteDetails, routeProps));
  const mapButton = selectedDetails.find(({ type, props }) =>
    type === 'Pressable' && props.accessibilityLabel === labels.busMap.open);
  const stopsHeading = selectedDetails.find(({ type, props }) =>
    type === 'View' && Array.isArray(props.children) && props.children.includes(mapButton));
  assert.deepEqual(elements(stopsHeading).filter(({ type }) => type === 'AppText').map(({ props }) => props.children),
    locale === 'en' ? ['Stops', '16 stops', 'Route map'] : ['沿線車站', '16 站', '路線圖']);
  assert(elements(mapButton).some(({ type, props }) => type === 'Icon' && props.name === 'map'));
  assert.equal(mapButton.props.style({ pressed: false })[0].minHeight, 44);
  const stopsSection = selectedDetails.find(({ type, props }) => type === 'View' && props.children?.[0] === stopsHeading);
  assert(elements(stopsSection.props.children[1]).some(({ props }) => props.children === labels.busDetail.selectStopHint));
  mapButton.props.onPress();
  assert.deepEqual(actions.at(-1), busRouteMapHref(special.route.id, special.choice.identity));

  state = {};
  sequence = { [routeStopKey(choice.identity)]: { snapshot: { stops: visits, fetchedAt: 1 } } };
  const props = { choice, initialStopId: '152', initialStopSeq: '3' };
  const tree = elements(render(RouteMap, props));
  const list = tree.find(({ type }) => type === 'FlatList').props;
  assert.equal(list.data.length, 4);
  const selected = preview(tree);
  assert.equal(selected.props.initialTarget.stopSeq, 3);
  const listState = state;
  state = {};
  action(render(selected.type, selected.props), labels.busEta.openAll).props.onPress();
  state = listState;
  const eta = actions.at(-1);
  assert.equal(stateFor(eta).routes.at(-1).name, 'bus/eta');
  assert.deepEqual(readEtaTarget(eta.params), {
    source: 'nlb', number: 'B2', routeId: '37', stopId: '152', stopSeq: 3, repeatedStop: true,
  });
  const map = elements(list.ListHeaderComponent).find(({ type }) => type === BusStopMap);
  assert.equal(map.props.selected, stopVisitKey(choice.identity, visits[2]));
  const rows = map.props.markers;
  assert.equal(rows.length, 3);
  state = {};
  const pins = elements(render(BusStopMap, { ...map.props, onSelect: (id) => actions.push(id) }))
    .filter(({ type }) => type === 'Marker');
  assert.equal(pins.length, 3);
  assert.match(pins[1].props.accessibilityLabel, locale === 'en' ? /Shenzhen Bay Port/ : /深圳灣口岸/);
  pins[1].props.onPress();
  assert.equal(actions.at(-1), stopVisitKey(choice.identity, visits[1]));
  assert.equal(pins[2].props.accessibilityState.selected, true);

  state = listState;
  list.renderItem({ item: list.data[3] }).props.onPress();
  preview(render(RouteMap, props)).props.onOpen();
  assert.equal(actions.at(-1).params.stopId, '999', 'A missing map coordinate does not block the official stop ETA');
}

console.log('PASS: official stop-map fixtures, direction and variants, repeated visits, coordinates, bilingual entry and ETA routing');

const verified = [
  ['kmbLwb', '1', 'O', '1', 'KMB', 1001, 1],
  ['kmbLwb', '1', 'I', '1', 'KMB', 1001, 2],
  ['kmbLwb', '268X', 'I', '1', 'KMB', 8203, 2],
  ['kmbLwb', '268X', 'O', '3', 'KMB', 1000333, 1],
  ['kmbLwb', '10', 'O', '1', 'KMB', 1002, 1],
  ['kmbLwb', '296A', 'O', '1', 'KMB', 1157, 1],
  ['kmbLwb', '275X', 'I', '1', 'KMB', 1000392, 2],
  ['citybus', '23', 'O', '', 'CTB', 1520, 1],
  ['citybus', '23', 'I', '', 'CTB', 1520, 2],
];
const approvedMaps = verified.map(([source, number, direction, variant, company, routeId, seq]) => {
  const { choice, stops } = fixture(source, number, direction, variant);
  const map = buildBusMapStops(choice.identity, stops, sourcePoints[source], () => undefined);
  const lines = readBusRouteGeometry(map);
  const record = geometryPack.records[map.routeKey];
  assert.deepEqual(record.td, [company, routeId, seq]);
  assert.deepEqual(lines.map((line) => line.length), record.parts.map((part) => part.length));
  const [[lon, lat]] = record.parts[0];
  assert.deepEqual(lines[0][0], { latitude: lat / 1_000_000, longitude: lon / 1_000_000 });
  assert.deepEqual(map.markers.map(({ stop }) => stop), stops);
  if (['10', '296A'].includes(number)) assert.equal(stops[0].id, stops.at(-1).id);
  return map;
});
assert.equal(Object.keys(geometryPack.records).length, approvedMaps.length);
assert.notDeepEqual(readBusRouteGeometry(approvedMaps[0]), readBusRouteGeometry(approvedMaps[1]));
assert.notDeepEqual(readBusRouteGeometry(approvedMaps[2]), readBusRouteGeometry(approvedMaps[3]));

for (const { choice, stops } of [samples[2], samples[4], ...samples.slice(8), fixture('kmbLwb', '275X', 'O', '1')]) {
  const map = buildBusMapStops(choice.identity, stops, sourcePoints[choice.identity.source], () => undefined);
  let requested = false;
  assert.equal(readBusRouteGeometry(map, () => { requested = true; return geometryPack; }), undefined);
  assert.equal(requested, false, 'Stops-only routes must not load the pack');
}
const firstMap = approvedMaps[0];
for (const payload of [null, {}, { ...geometryPack, records: {} }, { ...geometryPack, crs: 'EPSG:2326' }]) {
  assert.equal(readBusRouteGeometry(firstMap, () => payload), undefined);
}
assert.equal(readBusRouteGeometry(firstMap, () => { throw Error('read failure'); }), undefined);
for (const corrupt of [
  (record) => { record.td = ['CTB', 1001, 1]; },
  (record) => { record.parts = []; },
  (record) => { record.parts[0][0] = [22345523, 114192442]; },
  (record) => { record.parts[0][0][1] += 10; },
  (record) => { record.parts = [record.parts.flat()]; },
  (record) => { record.visits[0][1] = 'wrong-stop'; },
]) {
  const payload = structuredClone(geometryPack);
  corrupt(payload.records[firstMap.routeKey]);
  assert.equal(readBusRouteGeometry(firstMap, () => payload), undefined);
}
assert.equal(readBusRouteGeometry({ ...firstMap, markers: firstMap.markers.slice(1) }), undefined);
assert.equal(readBusRouteGeometry({ ...firstMap, markers: firstMap.markers.toReversed() }), undefined);
const moved = firstMap.markers.map((marker, i) => i ? marker
  : { ...marker, coordinate: { ...marker.coordinate, latitude: marker.coordinate.latitude + 0.00001 } });
assert.equal(readBusRouteGeometry({ ...firstMap, markers: moved }), undefined);

const b2 = samples[8];
const b2Map = buildBusMapStops(b2.choice.identity, b2.stops, sourcePoints.nlb, () => undefined);
const size = { width: 370, height: 300 };
const closeStops = b2Map.markers.slice(10, 19);
const focus = closeStops[4];
const viewport = { ...focus.coordinate, latitudeDelta: 0.18, longitudeDelta: 0.22 };
const overview = numberedBusMapStops(b2Map.markers, focus.key, viewport, size);
assert(overview.has(focus.key));
assert(closeStops.some(({ key }) => !overview.has(key)), 'Wide view suppresses crowded labels');
const neighbour = closeStops.find(({ key, coordinate }) => key !== focus.key
  && Math.hypot(coordinate.latitude - focus.coordinate.latitude, coordinate.longitude - focus.coordinate.longitude) < 0.007);
assert(neighbour && !overview.has(neighbour.key));
const closeBy = [focus, neighbour];
const zoom = {
  latitude: (focus.coordinate.latitude + neighbour.coordinate.latitude) / 2,
  longitude: (focus.coordinate.longitude + neighbour.coordinate.longitude) / 2,
  latitudeDelta: Math.max(0.001, Math.abs(focus.coordinate.latitude - neighbour.coordinate.latitude) * 2),
  longitudeDelta: Math.max(0.001, Math.abs(focus.coordinate.longitude - neighbour.coordinate.longitude) * 2),
};
assert.equal(numberedBusMapStops(closeBy, focus.key, zoom, size).size, 2, 'Zooming separates nearby labels');
const circular = approvedMaps[4].markers;
const twin = circular.at(-1);
assert.deepEqual(twin.coordinate, circular[0].coordinate);
assert.notEqual(twin.key, circular[0].key);
const repeated = numberedBusMapStops(circular, twin.key, { ...twin.coordinate, latitudeDelta: 0.05, longitudeDelta: 0.06 }, size);
assert(repeated.has(twin.key));
assert(!repeated.has(circular[0].key), 'Only one number at an identical coordinate, selected visit wins');

async function checkGeometryScreen() {
  load('nearby-bus-data').readBusStopCoordinates = async (source, ids) => new Map(ids.map((id) =>
    [id, { ...sourcePoints[source].get(id), name: { zh: '站點', en: 'Stop' } }]));
  const stopMapElement = (tree) => elements(elements(tree).find(({ type }) => type === 'FlatList').props.ListHeaderComponent);
  for (locale of ['zh-HK', 'en']) {
    const labels = messages[locale].busMap;
    assert.match(labels.geometrySource, locale === 'en' ? /Transport Department.*CSDI/ : /運輸署.*空間數據共享平台/);
    const lineSample = fixture('kmbLwb', '1', 'O', '1');
    const props = { choice: lineSample.choice };
    state = {};
    sequence = { [firstMap.routeKey]: { snapshot: { stops: lineSample.stops, fetchedAt: 1 } } };
    render(RouteMap, props);
    effects.forEach((run) => run());
    await Promise.resolve();
    let tree = render(RouteMap, props);
    let header = stopMapElement(tree);
    const verifiedElement = header.find(({ type }) => type === BusStopMap);
    assert(verifiedElement.props.lines?.length);
    assert(header.some(({ props }) => props.children === labels.geometrySource));
    const list = elements(tree).find(({ type }) => type === 'FlatList').props;
    const item = list.data[3];
    list.renderItem({ item }).props.onPress();
    tree = render(RouteMap, props);
    assert.equal(stopMapElement(tree).find(({ type }) => type === BusStopMap).props.focusRequest.key, item.key);

    state = {};
    let drawn = elements(render(BusStopMap, verifiedElement.props));
    const lineCount = drawn.filter(({ type }) => type === 'Polyline').length;
    assert.equal(lineCount, verifiedElement.props.lines.length);
    assert(drawn.findIndex(({ type }) => type === 'Polyline') < drawn.findIndex(({ type }) => type === 'Marker'));

    state = {};
    sequence = { [b2Map.routeKey]: { snapshot: { stops: b2.stops, fetchedAt: 1 } } };
    render(RouteMap, { choice: b2.choice });
    effects.forEach((run) => run());
    await Promise.resolve();
    header = stopMapElement(render(RouteMap, { choice: b2.choice }));
    const stopsOnly = header.find(({ type }) => type === BusStopMap);
    assert.equal(stopsOnly.props.lines, undefined);
    assert(!header.some(({ props }) => props.children === labels.geometrySource));
    assert.notEqual(stopsOnly.key, verifiedElement.key);

    state = {};
    const selected = { ...stopsOnly.props, selected: focus.key };
    drawn = elements(render(BusStopMap, selected));
    const map = drawn.find(({ type }) => type === 'MapView');
    map.props.onLayout({ nativeEvent: { layout: size } });
    map.props.onRegionChangeComplete(viewport);
    drawn = elements(render(BusStopMap, selected));
    const pins = drawn.filter(({ type }) => type === 'Marker');
    assert.equal(pins.length, b2.stops.length, 'Label suppression retains every native Marker');
    assert.equal(pins.find(({ props }) => props.identifier === focus.key).props.zIndex, 2);
    assert(pins.some(({ props }) => props.zIndex === 0));
    assert(!drawn.some(({ type }) => type === 'Polyline'), 'Switching to a stops-only route cannot retain a line');
  }
}

async function checkMapEtaPreview() {
  const start = Date.parse('2026-11-19T07:00:00Z');
  mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: start });
  const requests = [];
  const { BusFeedError } = load('bus-data');
  const requestBusJson = load('bus-data').requestBusJson;
  load('bus-data').requestBusJson = (source, url, signal) => new Promise((resolve, reject) => {
    requests.push({ source, url, signal, resolve, reject });
  });
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  const hasText = (tree, label) => elements(tree).some(({ props }) => props.children === label);
  const officialRow = (target, time, extra = {}) => ({
    co: 'KMB', route: target.number, service_type: Number(target.serviceType),
    dir: target.direction === 'outbound' ? 'O' : 'I', stop: target.stopId, seq: target.stopSeq,
    eta: new Date(time).toISOString(), data_timestamp: new Date(Date.now()).toISOString(), ...extra,
  });

  function mount(node) {
    const ownState = {};
    const view = () => {
      state = ownState;
      return render(node.type, node.props);
    };
    view();
    const stopDelay = effects[0]();
    let stopFocus;
    return {
      view,
      ready() {
        mock.timers.tick(350);
        view();
        stopFocus = focusedEffect();
      },
      pause() { stopFocus?.(); },
      resume() { view(); stopFocus = focusedEffect(); },
      close() { stopDelay(); stopFocus?.(); },
    };
  }

  try {
    locale = 'en';
    const labels = messages[locale];
    const line = fixture('kmbLwb', '268X', 'O', '3');
    const props = { choice: line.choice };
    const routeState = {};
    const mapView = () => {
      state = routeState;
      return render(RouteMap, props);
    };
    const routeIdentity = routeStopKey(line.choice.identity);
    sequence = { [routeIdentity]: { snapshot: { stops: line.stops, fetchedAt: start } } };
    assert.equal(preview(mapView()), undefined);
    effects.forEach((run) => run());
    await flush();
    const mapTree = mapView();
    const list = elements(mapTree).find(({ type }) => type === 'FlatList').props;
    const busMap = elements(list.ListHeaderComponent).find(({ type }) => type === BusStopMap);
    const selectList = (index) => {
      list.renderItem({ item: list.data[index] }).props.onPress();
      return preview(mapView());
    };

    const navCount = actions.length;
    busMap.props.onSelect(busMap.props.markers[0].key);
    const selectedA = preview(mapView());
    assert.equal(actions.length, navCount, 'Selecting a marker never opens another screen');
    const previewA = mount(selectedA);
    assert(hasText(previewA.view(), labels.busEta.loading));
    assert.equal(requests.length, 0);
    previewA.ready();
    assert.equal(requests.length, 1);
    const first = requests[0];
    assert.equal(first.url, `https://data.etabus.gov.hk/v1/transport/kmb/eta/${line.stops[0].id}/268X/3`);
    assert.deepEqual(selectedA.props.initialTarget, {
      number: '268X', source: 'kmbLwb', direction: 'outbound', serviceType: '3',
      stopId: line.stops[0].id, stopSeq: line.stops[0].seq,
    });

    const selectedB = selectList(1);
    assert.notEqual(selectedB.key, selectedA.key);
    previewA.close();
    assert(first.signal.aborted);
    const previewB = mount(selectedB);
    assert(hasText(previewB.view(), labels.busEta.loading));
    previewB.ready();
    assert.equal(requests.length, 2, 'Only selected stops request ETA');
    const targetB = selectedB.props.initialTarget;
    assert.equal(requests[1].source, targetB.source);
    assert.equal(requests[1].url, first.url.replace(line.stops[0].id, line.stops[1].id));
    first.resolve({ data: [officialRow(selectedA.props.initialTarget, Date.now() + 60_000)] });
    await flush();
    assert(hasText(previewB.view(), labels.busEta.loading));
    assert(!hasText(previewB.view(), labels.busEta.due));
    requests[1].resolve({ data: [
      officialRow(targetB, Date.now() + 7 * 60_000),
      officialRow(targetB, Date.now() + 30_000, { dir: 'I' }),
      officialRow(targetB, Date.now() + 30_000, { service_type: 1 }),
      officialRow(targetB, Date.now() + 30_000, { seq: targetB.stopSeq + 1 }),
      officialRow(targetB, Date.now() + 3 * 60_000),
    ] });
    await flush();
    assert(hasText(previewB.view(), 'About 3 min'));
    assert(!hasText(previewB.view(), labels.busEta.due));
    assert.equal(selectList(1).key, selectedB.key);
    assert.equal(requests.length, 2);

    const full = action(previewB.view(), labels.busEta.openAll);
    assert.equal(full.props.style({ pressed: false })[0].minHeight, 44);
    full.props.onPress();
    assert.deepEqual(readEtaTarget(actions.at(-1).params), targetB);
    previewB.pause();
    mock.timers.tick(2_000);
    assert.equal(requests.length, 2, 'No background poll while the detail screen is open');
    assert.equal(preview(mapView()).key, selectedB.key);
    previewB.resume();
    assert(hasText(previewB.view(), 'About 3 min'));
    assert.equal(requests.length, 2, 'Opening and returning retains a fresh snapshot and the poll deadline');

    mock.timers.tick(60_000);
    assert.equal(requests.length, 3);
    requests[2].reject(new BusFeedError('network'));
    await flush();
    assert(hasText(previewB.view(), labels.busEta.errors.network));
    assert(action(previewB.view(), labels.bus.retry).props.disabled);
    mock.timers.tick(10_000);
    const retry = action(previewB.view(), labels.bus.retry);
    assert.equal(retry.props.disabled, false);
    retry.props.onPress();
    assert.equal(requests.length, 4);
    assert.equal(requests[3].url, requests[1].url);
    requests[3].resolve({ data: [
      officialRow(targetB, Date.now() + 30_000, { data_timestamp: new Date(Date.now() - 120_000).toISOString() }),
    ] });
    await flush();
    assert(hasText(previewB.view(), labels.busEta.stale));
    assert(!hasText(previewB.view(), labels.busEta.due));
    previewB.close();

    const empty = mount(selectList(2));
    empty.ready();
    requests.at(-1).resolve({ data: [] });
    await flush();
    assert(hasText(empty.view(), labels.busEta.empty));
    assert(!hasText(empty.view(), labels.busEta.due));
    empty.close();

    const unavailable = mount(selectList(3));
    unavailable.ready();
    requests.at(-1).reject(new BusFeedError('http', 501));
    await flush();
    assert(hasText(unavailable.view(), labels.busMap.etaUnavailable));
    unavailable.close();

    sequence = { [routeIdentity]: { snapshot: { stops: [{ id: 'invalid', seq: 1 }], fetchedAt: start } } };
    const invalid = elements(mapView()).find(({ type }) => type === 'FlatList').props;
    invalid.renderItem({ item: invalid.data[0] }).props.onPress();
    const invalidTree = mapView();
    assert.equal(preview(invalidTree), undefined);
    assert(hasText(invalidTree, labels.busMap.etaUnavailable));
    assert.equal(requests.length, 6, 'No request is scheduled for an invalid stop identity');

    locale = 'zh-HK';
    const zh = messages[locale];
    const loop = fixture('kmbLwb', '10', 'O', '1');
    const loopKey = routeStopKey(loop.choice.identity);
    const last = loop.stops.at(-1);
    sequence = { [loopKey]: { snapshot: { stops: loop.stops, fetchedAt: start } } };
    const firstVisit = { choice: loop.choice, initialStopId: last.id, initialStopSeq: '1' };
    state = {};
    const firstLoop = preview(render(RouteMap, firstVisit));
    state = {};
    const lastLoop = preview(render(RouteMap, { ...firstVisit, initialStopSeq: String(last.seq) }));
    assert.notEqual(firstLoop.key, lastLoop.key);
    assert.equal(firstLoop.props.initialTarget.stopId, lastLoop.props.initialTarget.stopId);
    assert.equal(lastLoop.props.initialTarget.stopSeq, last.seq);
    const previewLast = mount(lastLoop);
    previewLast.ready();
    assert.equal(requests.length, 7);
    requests.at(-1).resolve({ data: [
      officialRow(firstLoop.props.initialTarget, Date.now() + 30_000),
      officialRow(lastLoop.props.initialTarget, Date.now() + 5 * 60_000),
    ] });
    await flush();
    assert(hasText(previewLast.view(), '約 5 分鐘'));
    assert(!hasText(previewLast.view(), zh.busEta.due));
    action(previewLast.view(), zh.busEta.openAll).props.onPress();
    assert.equal(readEtaTarget(actions.at(-1).params).stopSeq, last.seq);
    previewLast.close();

    const ctb = fixture('citybus', '1', 'O', '');
    const stop = ctb.stops[0];
    sequence = { [routeStopKey(ctb.choice.identity)]: { snapshot: { stops: ctb.stops, fetchedAt: start } } };
    state = {};
    const ctbNode = preview(render(RouteMap, {
      choice: ctb.choice, initialStopId: stop.id, initialStopSeq: String(stop.seq),
    }));
    const ctbPreview = mount(ctbNode);
    ctbPreview.ready();
    const request = requests.at(-1);
    assert.equal(requests.length, 8);
    assert.equal(request.source, 'citybus');
    assert.match(stop.id, /^0\d{5}$/);
    assert.equal(request.url, `https://rt.data.gov.hk/v2/transport/citybus/eta/CTB/${stop.id}/1`);
    request.resolve({ data: [officialRow(ctbNode.props.initialTarget, Date.now() + 30_000, { co: 'CTB' })] });
    await flush();
    assert(hasText(ctbPreview.view(), zh.busEta.due));
    ctbPreview.close();
  } finally {
    load('bus-data').requestBusJson = requestBusJson;
    mock.timers.reset();
  }
}

async function checkLimitedServiceAndEtaStatus() {
  const { RouteCard } = load('app/bus/nearby');
  const { limitedServiceTimetable } = load('bus-limited-service');
  const { describeEta, etaIsStale, etaMaxAge, parseEta } = load('bus-eta');
  const { BusFeedError } = load('bus-data');
  const service = [fixture('kmbLwb', '258P', 'O', '1'), fixture('kmbLwb', '258P', 'I', '1'), fixture('kmbLwb', '261P', 'O', '1')];
  const [lamTin, hungFuk, tinPing] = service;
  const ordinary = fixture('kmbLwb', '261', 'O', '1');
  const evidence = [
    'https://search.kmb.hk/TD_SS/258d.pdf',
    'https://search.kmb.hk/TD_SS/258d.pdf',
    'https://search.kmb.hk/TD_SS/261.pdf',
  ];
  assert.deepEqual(service.map(({ choice }) => limitedServiceTimetable(choice.identity)), evidence);
  const discontinued = { ...tinPing.choice.identity, direction: 'inbound' };
  for (const other of [discontinued, { ...lamTin.choice.identity, serviceType: '2' }, ordinary.choice.identity,
    fixture('kmbLwb', '258D', 'O', '1').choice.identity, fixture('kmbLwb', '268X', 'I', '1').choice.identity,
    { source: 'citybus', number: '258P', direction: 'outbound' }, { source: 'nlb', number: '261P', routeId: '1' }]) {
    assert.equal(limitedServiceTimetable(other), undefined);
  }

  const now = Date.parse('2026-11-21T13:38:01+08:00');
  const iso = (offset) => new Date(now + offset).toISOString();
  const old = iso(-etaMaxAge);
  const target = { ...lamTin.choice.identity, stopId: lamTin.stops[0].id, stopSeq: 1 };
  const baseRow = { co: 'KMB', route: target.number, service_type: 1, dir: 'O', stop: target.stopId, seq: 1 };
  const parse = (rows, generated_timestamp = iso(0)) => parseEta(target, { generated_timestamp, data: rows }, now);
  const oldNullRow = { ...baseRow, eta: null, data_timestamp: old, rmk_tc: '舊備註', rmk_en: 'Old notice' };
  const freshNullRow = { ...oldNullRow, data_timestamp: iso(-3_000), rmk_tc: '現有備註', rmk_en: 'Current notice' };
  const oldArrival = { ...baseRow, eta: iso(240_000), data_timestamp: old };
  const freshArrival = { ...baseRow, eta: iso(150_000), data_timestamp: iso(-3_000) };
  const oldNull = parse([oldNullRow]);
  const oldTimed = parse([oldArrival, freshNullRow]);
  const fresh = parse([freshArrival, { ...oldArrival, eta: iso(100_000) }]);
  const past = parse([{ ...freshArrival, eta: iso(-1_000) }]);
  const empty = parse([]);
  const otherDirection = parse([{ ...freshArrival, dir: 'I' }]);
  const failure = new BusFeedError('network');
  assert.equal(oldNull.generatedAt, now, 'A fresh null ETA uses the response timestamp');
  assert.equal(etaIsStale(oldTimed, now), true, 'A fresh notice cannot make an old ETA current');
  assert.equal(etaIsStale(parse([], old), now), true, 'An old cached response is stale even when it contains no ETA');
  assert.equal(etaIsStale(parse([], iso(30_000)), now + etaMaxAge), true, 'A future provider clock cannot extend the receipt lifetime');
  assert.throws(() => parse([{ ...oldNullRow, data_timestamp: 'bad date' }]), (error) => error.kind === 'invalid');

  const opens = [];
  const alerts = [];
  native.Linking = { async openURL(url) { opens.push(url); throw new Error('System link unavailable'); } };
  native.Alert = { alert: (message) => alerts.push(message) };
  for (const language of ['zh-HK', 'en']) {
    locale = language;
    const copy = messages[locale];
    const label = copy.busDetail.limitedService;
    const noEstimate = locale === 'en' ? 'No arrival estimate available' : '暫無到站預報';
    assert.equal(label, locale === 'en' ? 'Operates on selected days or at specific times' : '只在指定日期或時段服務');
    const view = (snapshot, time = now) => describeEta(snapshot, undefined, time, false, locale, copy.busEta);
    assert.equal(view(fresh).upcoming[0].minutes, 3);
    assert.equal(view(fresh).upcoming.length, 1, 'Only the current arrival enters the countdown');
    assert.equal(view(past).upcoming.length, 0);
    assert.equal(view(otherDirection).status, copy.busEta.unmatched);
    assert.equal(view(oldNull).status, copy.busEta.empty);
    assert.deepEqual(view(oldNull).notices, []);
    assert.deepEqual(view(parse([freshNullRow])).notices, [locale === 'en' ? 'Current notice' : '現有備註']);

    function card(line, snapshot, error) {
      const sample = { ...line.choice.identity, stopId: line.stops[0].id, stopSeq: 1 };
      return elements(RouteCard({
        recommendation: { route: { target: sample, destination: line.route.destination }, stop: { name_zh: '分站', name_en: 'Bus stop' } },
        distance: '50 m', record: { snapshot, error }, now, onPress() {},
      })).filter(({ type }) => type === 'AppText').map(({ props }) => props.children);
    }
    for (const snapshot of [oldNull, empty, past, otherDirection]) {
      const text = card(lamTin, snapshot);
      assert(text.includes(label) && text.includes(noEstimate) && !text.includes(copy.busEta.stale));
    }
    assert(card(hungFuk).includes(label));
    assert(card(tinPing).includes(label));
    assert(!card(ordinary).includes(label));
    assert(card(lamTin, fresh).includes(`${copy.busEta.minutes.prefix}3${copy.busEta.minutes.suffix}`));
    assert(card(lamTin, oldTimed).includes(copy.busEta.stale));
    assert(card(lamTin, oldTimed, failure).includes(copy.busEta.errors.network));
    assert(card(lamTin, empty, failure).includes(copy.busEta.failed));
    assert(card(lamTin, undefined, failure).includes(copy.busEta.failed));

    for (const [index, line] of [...service, ordinary].entries()) {
      state = {};
      sequence = { [routeStopKey(line.choice.identity)]: { snapshot: { stops: line.stops, fetchedAt: now }, loading: false } };
      const details = render(RouteDetails, { family: { selected: line.route, routes: [line.route] }, boarding: {} });
      const link = action(details, copy.busDetail.officialTimetable);
      if (line === ordinary) { assert.equal(link, undefined); continue; }
      assert.equal(link.props.accessibilityRole, 'link');
      assert.equal(link.props.style({ pressed: false })[0].minHeight, 44);
      link.props.onPress();
      await new Promise(setImmediate);
      assert.equal(opens.at(-1), evidence[index]);
      assert.equal(alerts.at(-1), copy.busDetail.timetableLinkFailed);
    }
  }
  console.log('PASS: verified limited services, wrong directions and variants, official timetable links, and bilingual ETA freshness states');
}

function checkAdultFares() {
  const { RouteCard } = load('app/bus/nearby');
  const { formatAdultBusFare, readAdultBusFare } = load('nearby-bus-fares');
  const pack = require('../assets/data/nearby-bus-fares.json');
  const now = Date.parse('2026-11-21T13:38:01+08:00');
  const expires = Date.parse('2026-12-02T00:00:00+08:00');
  const eligible = [
    ['nlb', 'B2', '', '37', 13, 'full', 1580],
    ['nlb', 'B2', '', '38', 7, 'full', 1580],
    ['citybus', 'B15', 'O', '', 2, 'boarding', 1020],
    ['citybus', 'B15', 'I', '', 12, 'boarding', 1390],
    ['kmbLwb', '68A', 'O', '1', 1, 'full', 1260],
    ['kmbLwb', '68A', 'I', '1', 1, 'full', 1260],
    ['kmbLwb', '68X', 'I', '1', 1, 'full', 1620],
    ['kmbLwb', '258P', 'O', '1', 1, 'full', 1880],
    ['kmbLwb', '258P', 'I', '1', 16, 'boarding', 570],
    ['kmbLwb', '261P', 'O', '1', 10, 'boarding', 430],
    ['kmbLwb', '268X', 'O', '1', 10, 'full', 1620],
    ['kmbLwb', '268X', 'I', '1', 10, 'full', 1620],
    ['kmbLwb', '268X', 'O', '3', 10, 'boarding', 580],
  ];
  assert.equal(pack.datasetDate, '2026-11-18');
  assert.equal(Object.keys(pack.records).length, eligible.length);
  assert.equal(Object.values(pack.records).reduce((count, entry) => count + Object.keys(entry.boarding).length, 0), 85);
  assert.equal(pack.sources['fare.xml'], 'https://static.data.gov.hk/td/routes-fares-xml/FARE_BUS.xml');
  assert(Object.values(pack.sha256).every((sha) => /^[a-f0-9]{64}$/.test(sha)));
  assert.equal(formatAdultBusFare(430), 'HK$4.30');
  assert.equal(formatAdultBusFare(437), 'HK$4.37');

  function targetFor(line, seq) {
    return { ...line.choice.identity, stopId: line.stops.find((stop) => stop.seq === seq).id, stopSeq: seq };
  }

  for (const [source, number, bound, variant, seq, scope, cents] of eligible) {
    const line = fixture(source, number, bound, variant);
    const target = targetFor(line, seq);
    assert.deepEqual(readAdultBusFare(target, now), { scope, cents });
    const record = pack.records[routeStopKey(target)];
    for (const [position, boarding] of Object.entries(record.boarding)) {
      assert.deepEqual(readAdultBusFare(targetFor(line, Number(position)), now), { scope: 'boarding', cents: boarding.cents });
    }
    assert.deepEqual(readAdultBusFare(target, expires - 1), { scope, cents });
    assert.equal(readAdultBusFare(target, expires), undefined);
  }
  for (const service of ['1', '3', '4']) {
    assert.equal(readAdultBusFare(targetFor(fixture('kmbLwb', '68X', 'O', service), 1), now), undefined);
  }
  const special = fixture('kmbLwb', '268X', 'O', '3');
  const section = targetFor(special, 10);
  assert.deepEqual(readAdultBusFare(targetFor(special, 1), now), { scope: 'full', cents: 1620 }, 'Price differs by alighting stop');
  for (const change of [{ stopSeq: 9 }, { stopId: 'WRONG' }, { repeatedStop: true }]) {
    assert.deepEqual(readAdultBusFare({ ...section, ...change }, now), { scope: 'full', cents: 1620 });
  }
  for (const change of [{ serviceType: '2' }, { direction: 'inbound' }, { source: 'citybus' }, { number: '268' }]) {
    assert.equal(readAdultBusFare({ ...section, ...change }, now), undefined);
  }
  assert.equal(readAdultBusFare({ ...targetFor(fixture('nlb', 'B2', '', '37'), 1), number: 'B2P' }, now), undefined);
  assert.equal(readAdultBusFare(section, now, { ...pack, datasetDate: '2026-11-31' }), undefined);
  assert.equal(readAdultBusFare(section, now, { ...pack, reviewedDate: '2026-11-22' }), undefined);

  for (const language of ['zh-HK', 'en']) {
    locale = language;
    const copy = messages[locale];
    const line = fixture('kmbLwb', '258P', 'I', '1');
    const target = targetFor(line, 16);
    const stopRow = stops.kmbLwb.find(([id]) => id === target.stopId);
    const snapshot = { target, match: 'matched', entries: [{ arrivalAt: now + 120_000 }], receivedAt: now };
    const props = { recommendation: { route: { target, destination: line.route.destination }, stop: {
      name_zh: stopRow[1], name_en: stopRow[2], source: target.source, stop_id: target.stopId,
    } }, distance: '50 m', record: { snapshot }, now, onPress() {} };
    const children = (card) => elements(card).filter(({ type }) => type === 'AppText').map(({ props }) => props.children);
    const card = children(RouteCard(props));
    assert(card.includes(locale === 'en' ? 'Adult fare from this stop HK$5.70' : '此站成人車費 HK$5.70'));
    assert(card.includes(`${copy.busEta.minutes.prefix}2${copy.busEta.minutes.suffix}`));
    assert(card.includes(copy.busDetail.limitedService));
    assert(card.includes(copy.nearbyBus.viewRoute));
    assert(children(RouteCard({ ...props, now: expires })).every((text) => !String(text).includes('HK$')));
    const full = children(RouteCard({ ...props, recommendation: { ...props.recommendation,
      route: { ...props.recommendation.route, target: { ...target, stopSeq: 1 } },
    } }));
    assert(full.includes(locale === 'en' ? 'Full-route adult fare HK$18.80' : '全程成人車費 HK$18.80'));
  }
  console.log('PASS: official full and boarding fares, exact route and visit identity, HKD cents, expiration, and bilingual cards');
}

async function checkHomeB2EtaSettlement() {
  delete stubs['@/components/saved-bus-ui'];
  const { HomeFavoriteBus } = load('components/saved-bus-ui');
  const { createMtrNextTrainClient } = load('mtr-next-train-client');
  const target = { source: 'nlb', number: 'B2', routeId: '37', stopId: '152', stopSeq: 3 };
  const props = { favorite: { target, station: { zh: '測試站', en: 'Test stop' }, destination: { zh: '總站', en: 'Terminus' } }, unavailable: false };
  let refreshBus;
  props.registerRefresh = (refresh) => { refreshBus = refresh; return () => {}; };
  const originalFetch = global.fetch;
  const originalDev = global.__DEV__;
  let cleanup;
  try {
    global.__DEV__ = false;
    locale = 'zh-HK';
    mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'], now: Date.parse('2026-11-22T15:00:00+08:00') });
    const labels = messages[locale].busEta;
    const countdown = labels.minutes.prefix + '3' + labels.minutes.suffix;
    const flush = () => new Promise(setImmediate);
    const cardText = () => {
      const row = elements(render(HomeFavoriteBus, props)).find(({ type }) => type.name === 'FavoriteBusRow');
      return elements([row.props.trailing, row.props.children]).filter(({ type }) => type === 'AppText').map(({ props }) => props.children);
    };
    for (const [scenario, expected] of [
      ['stalled connection', labels.errors.timeout], ['stalled body', labels.errors.timeout],
      ['HTTP failure', labels.errors.http], ['network failure', labels.errors.network],
      ['empty ETA', labels.empty], ['valid ETA', countdown],
    ]) {
      cleanup?.();
      state = {};
      let signal;
      let finishLateBody;
      let requests = 0;
      global.fetch = (url, options) => {
        assert.match(url, /estimatedArrivals&routeId=37&stopId=152&language=zh$/);
        requests++;
        signal = options.signal;
        // Model a transport that receives the abort signal without settling its Promise.
        if (scenario === 'stalled connection') return new Promise(() => {});
        if (scenario === 'stalled body' && requests === 1) return Promise.resolve({
          ok: true, status: 200, text: () => new Promise((resolve) => { finishLateBody = resolve; }),
        });
        if (scenario === 'HTTP failure') return Promise.resolve(new Response('', { status: 503 }));
        if (scenario === 'network failure') return Promise.reject(new Error('network fixture'));
        const hasEta = scenario === 'valid ETA' || requests > 1;
        const arrivals = hasEta ? [{ estimatedArrivalTime: new Date(Date.now() + 180_000).toISOString() }] : [];
        return Promise.resolve(new Response(JSON.stringify({ estimatedArrivals: arrivals })));
      };
      assert(cardText().includes(labels.loading));
      effects.forEach((effect) => effect());
      cleanup = focusedEffect();
      const pull = refreshBus();
      assert.ok(pull instanceof Promise);
      assert.equal(refreshBus(), pull, 'Home pull joins the in-flight automatic B2 request');
      let finishRail;
      const rail = createMtrNextTrainClient({ request: () => new Promise((resolve) => { finishRail = resolve; }) })('ISL', 'ADM');
      await flush();
      if (scenario.startsWith('stalled')) {
        mock.timers.tick(20_000);
        await flush();
        assert.equal(signal.aborted, true, scenario);
      }
      await pull;
      assert(cardText().includes(expected), scenario + ' must show its result or terminal status');
      assert(!cardText().includes(labels.loading), scenario + ' must leave Loading');
      assert.equal(requests, 1);
      if (finishLateBody) {
        finishLateBody(JSON.stringify({ estimatedArrivals: [{ estimatedArrivalTime: new Date(Date.now() + 180_000).toISOString() }] }));
        await flush();
        assert(cardText().includes(expected), 'Late data must not overwrite the timeout');
        mock.timers.tick(40_000);
        await flush();
        assert.equal(requests, 2, 'Normal Home polling can recover after the timeout');
        assert(cardText().includes(countdown));
        assert(!cardText().includes(expected));
      }
      if (scenario === 'valid ETA') {
        assert.equal(refreshBus(), undefined, 'Manual cooldown remains in force');
        mock.timers.tick(10_000);
        await refreshBus();
        assert.equal(requests, 2, 'A pull fetches before the next auto poll when eligible');
      }
      finishRail(new Response(null, { status: 503 }));
      await rail;
    }
  } finally {
    cleanup?.();
    mock.timers.reset();
    global.fetch = originalFetch;
    if (originalDev === undefined) delete global.__DEV__; else global.__DEV__ = originalDev;
  }
  console.log('PASS: Home B2 settles through real request, hook and card with parallel railway reads');
}

checkGeometryScreen().then(checkMapEtaPreview).then(checkLimitedServiceAndEtaStatus).then(checkAdultFares).then(checkHomeB2EtaSettlement).then(
  () => console.log('PASS: official geometry, selected-stop ETA requests, race isolation, retry, stale and unavailable states, and bilingual routing'),
  (error) => { console.error(error); process.exitCode = 1; },
);
