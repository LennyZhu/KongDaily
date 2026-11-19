const assert = require('node:assert/strict');
const { existsSync, readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const ts = require('typescript');
const { getRoutes } = require('expo-router/build/getRoutes');
const { getReactNavigationConfig } = require('expo-router/build/getReactNavigationConfig');
const { resolveHref } = require('expo-router/build/link/href');
const { getStateFromPath } = require('expo-router/build/react-navigation/core/getStateFromPath');
const { StackRouter } = require('expo-router/build/react-navigation/routers/StackRouter');

const root = join(__dirname, '..');
const { stops } = require('../assets/data/nearby-stops.json');
const { sources } = require('../assets/data/nearby-stop-routes.json');
const sourcePoints = Object.fromEntries(Object.entries(stops).map(([source, rows]) => [
  source, new Map(rows.map(([id, , , latitude, longitude]) => [id, { latitude, longitude }])),
]));
const actions = [];
const react = {
  Component: class {},
  useEffect() {},
  useMemo: (fn) => fn(),
  useRef: (current) => ({ current }),
  useState(initial) {
    const index = hookIndex++;
    if (!Object.hasOwn(state, index)) state[index] = typeof initial === 'function' ? initial() : initial;
    return [state[index], (value) => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
  },
};
let state = {};
let hookIndex = 0;
let locale = 'zh-HK';
let sequence;
const native = Object.fromEntries(['ActivityIndicator', 'FlatList', 'Pressable', 'ScrollView', 'TextInput', 'View'].map((type) => [type, type]));
Object.assign(native, { Keyboard: { dismiss() {} }, StyleSheet: { create: (styles) => styles, absoluteFill: {} } });
const stubs = {
  react, 'react-native': native, 'expo-sqlite': {},
  'react-native-maps': { __esModule: true, default: 'MapView', Marker: 'Marker' },
  'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ bottom: 0 }) },
  'expo-router': { useRouter: () => ({ push: (href) => actions.push(href), canGoBack: () => true }) },
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
  '@/bus-eta-hooks': {},
  '@/route-stop-recommendation': { useRouteStopRecommendation: () => ({}) },
};
const modules = new Map();

function load(name) {
  if (modules.has(name)) return modules.get(name).exports;
  const tsPath = join(root, 'src', name + '.ts');
  const filename = existsSync(tsPath) ? tsPath : tsPath + 'x';
  const module = { exports: {} };
  modules.set(name, module);
  const testExports = { 'app/bus/route-map': 'RouteMap', 'app/bus/route': 'RouteDetails' }[name];
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
  return component(props);
}

function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements);
  return node?.props ? [node, ...elements(node.props.children)] : [];
}

const { buildBusMapStops, busRouteMapHref, readBusMapChoice } = load('bus-route-map');
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
  const selected = tree.find(({ type, props }) => type === BusAction && props.label === labels.busMap.viewStop);
  selected.props.onPress();
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

  state = {};
  list.renderItem({ item: list.data[3] }).props.onPress();
  elements(render(RouteMap, props)).find(({ type, props }) => type === BusAction && props.label === labels.busMap.viewStop).props.onPress();
  assert.equal(actions.at(-1).params.stopId, '999', 'A missing map coordinate does not block the official stop ETA');
}

console.log('PASS: official stop-map fixtures, direction and variants, repeated visits, coordinates, bilingual entry and ETA routing');
