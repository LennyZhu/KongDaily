const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { dirname, join, resolve } = require('node:path');
const ts = require('typescript');
const gmbFixture = require('./fixtures/gmb-api.json');
const hkkfFixture = require('./fixtures/hkkf-api.json');

const root = join(__dirname, '..');
let slots = [];
let hookIndex = 0;
let effects = [];
let dirty = false;
const same = (a, b) => a?.length === b?.length && a.every((value, index) => Object.is(value, b[index]));
const react = {
  useState(initial) {
    const index = hookIndex++;
    const state = slots;
    if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
    return [state[index], (next) => {
      const value = typeof next === 'function' ? next(state[index]) : next;
      if (!Object.is(value, state[index])) {
        state[index] = value;
        if (state === slots) dirty = true;
      }
    }];
  },
  useMemo(fn, deps) {
    const index = hookIndex++;
    if (slots[index] && same(deps, slots[index].deps)) return slots[index].value;
    const value = fn();
    slots[index] = { value, deps };
    return value;
  },
  useRef(initial) {
    return slots[hookIndex++] ??= { current: initial };
  },
  useEffect(fn, deps) {
    const index = hookIndex++;
    const previous = slots[index];
    if (!previous || !same(deps, previous.deps)) {
      effects.push(() => {
        previous?.cleanup?.();
        slots[index] = { deps, cleanup: fn() };
      });
    }
  },
};
react.useCallback = (fn, deps) => react.useMemo(() => fn, deps);
react.useLayoutEffect = react.useEffect;

let locale = 'zh-HK';
let timerId = 0;
let time = 0;
const timers = new Map();
const after = (callback, ms) => {
  timers.set(++timerId, { callback, at: time + ms });
  return timerId;
};
function advance(ms) {
  time += ms;
  for (const [id, { callback, at }] of [...timers]) {
    if (at > time) continue;
    timers.delete(id);
    callback();
  }
}

const pushed = [];
const alerts = [];
let focusEffect;
let blur;
let failPush = false;
const router = {
  navigate: (href) => pushed.push(href),
  push(href) {
    if (failPush) throw new Error('Injected navigation failure');
    pushed.push(href);
  },
};
let keyboardDismissals = 0;
const native = Object.fromEntries(['TextInput', 'FlatList', 'Text', 'View', 'Pressable', 'ActivityIndicator', 'Image']
  .map((name) => [name, name]));
Object.assign(native, {
  StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
  Keyboard: { dismiss() { keyboardDismissals++; } },
  Alert: { alert: (title) => alerts.push(title) },
  useWindowDimensions: () => ({ width: 375, height: 812, fontScale: 1 }),
});
const basicUi = Object.fromEntries(['AppText', 'EmptyState', 'Icon', 'Screen'].map((name) => [name, name]));
const stubs = {
  react, 'react-native': native,
  'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
  'expo-router': {
    useRouter: () => router,
    useFocusEffect(fn) {
      react.useEffect(() => {
        focusEffect = fn;
        blur = fn();
        return () => blur?.();
      }, [fn]);
    },
  },
  'expo-sqlite': {},
  'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
  '@/language': { useLanguage: () => ({ copy: load('i18n').messages[locale], locale }) },
  '@/components/ui': basicUi, '@/weather-hooks': {}, '@/weather': {},
};
const loaded = new Map();
function load(name) {
  if (loaded.has(name)) return loaded.get(name).exports;
  const tsPath = join(root, 'src', name + '.ts');
  const file = existsSync(tsPath) ? tsPath : tsPath + 'x';
  const module = { exports: {} };
  loaded.set(name, module);
  const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  });
  new Function('module', 'exports', 'require', 'setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', outputText)(module, module.exports, (id) => {
    if (Object.hasOwn(stubs, id)) return stubs[id];
    if (id.endsWith('.jpg')) return id;
    if (id.startsWith('@/')) return load(id.slice(2));
    if (id.startsWith('.')) return require(resolve(dirname(file), id));
    return require(id);
  }, name === 'app/search' ? after : setTimeout, name === 'app/search' ? (id) => timers.delete(id) : clearTimeout,
  (fn) => after(fn, 16), (id) => timers.delete(id));
  return module.exports;
}

function nodes(value, expand = false) {
  if (Array.isArray(value)) return value.flatMap((item) => nodes(item, expand));
  if (!value?.props) return [];
  const children = expand && typeof value.type === 'function' ? value.type(value.props) : value.props.children;
  return [value, ...nodes(children, expand)];
}

const gmbResponses = { '/route': gmbFixture.directory, '/route/HKI/2': gmbFixture.hki2,
  '/route/KLN/2': gmbFixture.kln2, '/route/NT/2': gmbFixture.nt2 };
stubs['@/gmb-client'] = { gmbClient: load('gmb-client').createGmbClient({ request: async (address) => {
  const body = gmbResponses[new URL(address).pathname];
  return new Response(JSON.stringify(body), { status: body ? 200 : 500 });
} }) };
const ferryPaths = [];
const ferryPreview = { hkkfPreviewEnabled: false, hkkfPreviewClient: undefined };
stubs['@/hkkf-preview'] = ferryPreview;
const tramFeature = { ...load('tram-feature') };
stubs['@/tram-feature'] = tramFeature;
const SearchScreen = load('app/search').default;
function render(runEffects = true) {
  if (!runEffects) {
    hookIndex = 0;
    effects = [];
    return SearchScreen();
  }
  for (let frame = 0; frame < 12; frame++) {
    dirty = false;
    hookIndex = 0;
    effects = [];
    const screen = SearchScreen();
    effects.forEach((effect) => effect());
    if (!dirty) return screen;
  }
  assert.fail('Search rerender loop');
}
function reset() {
  slots.forEach((entry) => entry?.cleanup?.());
  slots = [];
  timers.clear();
}
const find = (tree, type) => nodes(tree).find((node) => node.type === type);
const labels = () => load('i18n').messages[locale];
const list = (screen) => find(screen, 'FlatList').props;
const input = (screen) => find(screen, 'TextInput').props;
const empty = (screen) => list(screen).ListEmptyComponent;
const resultItems = (screen) => list(screen).data.filter((row) => row.type === 'result').map((row) => row.result);
const displayed = (screen, kind) => resultItems(screen).filter((result) => kind === 'transport_route'
  ? ['bus_route', 'mtr_line', 'light_rail_route', 'tram_route'].includes(result.kind)
  : kind === 'transport_stop' ? ['bus_stop', 'mtr_station', 'light_rail_stop', 'tram_stop'].includes(result.kind) : result.kind === kind);
const hasCopy = (tree, copy) => nodes(tree, true).some(({ props }) => props.children === copy || props.title === copy);
function tapText(tree, label) {
  const action = nodes(tree, true).find(({ type, props }) =>
    type === 'Pressable' && (props.accessibilityLabel === label || hasCopy(props.children, label)));
  assert(action, label);
  action.props.onPress();
}

const seeds = require('../assets/data/nearby-stops.json').stops;
const reverse = require('../assets/data/nearby-stop-routes.json').sources;
const stopRows = Object.entries(seeds).flatMap(([source, stops]) => stops.map(([stop_id, name_zh, name_en, , , street_zh, street_en]) =>
  ({ source, stop_id, name_zh, name_en, street_zh, street_en })));
const { parseBusCatalogue } = load('bus-routes');
// Build deterministic catalogue fixtures from the official bundled route and station records.
function fixtureOrigin(source, routeIndex) {
  let firstSeq = Infinity;
  let firstId;
  for (const [stopId, visits] of Object.entries(reverse[source].stops)) {
    for (const [id, seq] of visits) {
      if (id === routeIndex && seq < firstSeq) {
        firstSeq = seq;
        firstId = stopId;
      }
    }
  }
  return seeds[source].find(([id]) => id === firstId);
}
const kmbRoutes = reverse.kmbLwb.routes.flatMap(([route, bound, service_type, dest_tc, dest_en], index) => {
  if (!dest_tc.includes('香港') && route !== '268X') return [];
  const [, orig_tc, orig_en] = fixtureOrigin('kmbLwb', index);
  return [{ route, bound, service_type, dest_tc, dest_en, orig_tc, orig_en }];
});
const ctbIndex = reverse.citybus.routes.findIndex(([id]) => id === '5B');
const [citybusNo, , , dest_tc, dest_en] = reverse.citybus.routes[ctbIndex];
const [, orig_tc, orig_en] = fixtureOrigin('citybus', ctbIndex);
const nlb = reverse.nlb.routes.find(([id, , variant]) => id === 'B2' && variant === '37');
const liveFeeds = {
  kmbLwb: { routes: parseBusCatalogue('kmbLwb', { data: kmbRoutes }), fetchedAt: Date.now(), persisted: true },
  citybus: { routes: parseBusCatalogue('citybus', { data: [{ co: 'CTB', route: citybusNo, dest_tc, dest_en, orig_tc, orig_en }] }),
    fetchedAt: Date.now(), persisted: true },
  nlb: { routes: parseBusCatalogue('nlb', { routes: [{
    routeNo: nlb[0], routeId: nlb[2], routeName_c: nlb[6] + ' > ' + nlb[3], routeName_e: nlb[7] + ' > ' + nlb[4],
  }] }), fetchedAt: Date.now(), persisted: true },
};

let cached = liveFeeds;
let cachedReads = 0;
let stopReads = 0;
let stopsFail = false;
let operatorFailures = new Set();
const requests = [];
const repo = load('bus-data');
repo.readBusFeeds = async () => { cachedReads++; return cached; };
repo.refreshBusFeed = async (source) => {
  requests.push(source);
  if (operatorFailures.has(source)) throw new repo.BusFeedError('network');
  return liveFeeds[source];
};
load('nearby-bus-data').readBusStopsForSearch = async () => {
  stopReads++;
  if (stopsFail) throw new Error('Fixture SQLite read failure');
  return stopRows;
};
const search = load('global-search');
const originalLoad = search.loadGlobalBusStops;
let stopsTask;
search.loadGlobalBusStops = () => { stopsTask = originalLoad(); return stopsTask; };

async function flush() {
  render();
  for (let index = 0; index < 3; index++) await new Promise(setImmediate);
  return render();
}
async function complete() {
  render();
  advance(180);
  render();
  if (stopsTask) await stopsTask;
  return flush();
}

async function verify() {
  const { HomeHero, HomeLink, HomeSection, QuickLinkCard } = load('components/home-ui');
  const pinnedB2 = { id: 'pinned-b2', target: { source: 'nlb', number: 'B2', routeId: '37', stopId: '200', stopSeq: 13 } };
  const favoriteItems = [pinnedB2, { id: 'bus-2' }, { id: 'bus-3' }, { id: 'bus-4' }];
  const busPins = favoriteItems.map(({ id }) => ({ mode: 'bus', id }));
  let busStatus = 'ready';
  let pinState;
  stubs['@/bus-favorite-hooks'] = {
    useBusFavorites: () => ({ items: favoriteItems, status: busStatus }),
    useUnavailableFavorites: () => new Set(),
  };
  stubs['@/components/saved-bus-ui'] = { HomeFavoriteBus: 'HomeFavoriteBus' };
  stubs['@/components/home-favorite-railway'] = { HomeFavoriteRailway: 'HomeFavoriteRailway' };
  stubs['@/railway-favorite-hooks'] = { useRailwayFavorites: () => ({ items: [], status: 'ready' }) };
  stubs['@/gmb-favorites'] = { useGmbFavorites: () => ({ items: [], status: 'ready' }) };
  stubs['@/home-transport-pins'] = {
    ...load('home-transport-pins'),
    useHomePins: () => pinState,
  };
  stubs['@/components/weather-warning-ui'] = { WeatherWarningLink: 'WeatherWarningLink' };
  const HomeScreen = load('app/(tabs)/index').default;
  const addFrequentHref = '/transport';
  for (locale of ['zh-HK', 'en']) {
    const { empty: emptyTitle, emptyDetail } = labels().homePins;
    const addLabel = locale === 'en' ? 'Add frequent transport' : '新增常用交通';
    pinState = { pins: busPins.slice(0, 1), status: 'ready' };
    hookIndex = 0;
    const page = nodes(HomeScreen());
    assert(page.some(({ type }) => type === HomeHero));
    assert(page.some(({ type }) => type === 'WeatherWarningLink'));
    const pinned = page.find(({ type }) => type === 'HomeFavoriteBus');
    assert.equal(pinned.props.favorite, pinnedB2);
    const frequent = page.find(({ type, props }) => type === HomeSection && props.title === labels().home.buses);
    assert.equal(frequent.props.title, locale === 'en' ? 'Frequent transport' : '常用公共交通');
    assert.equal(frequent.props.action.href, '/saved?category=all');
    const addLink = page.find(({ type, props }) => type === HomeLink && props.label === addLabel);
    assert.equal(addLink.props.label, addLabel);
    assert.deepEqual(addLink.props.href, addFrequentHref);
    const shortcuts = page.filter(({ type }) => type === QuickLinkCard);
    assert.deepEqual(shortcuts.map(({ props }) => props.href), [
      '/transport', '/nearby?category=toilets', '/nearby?category=pets', '/nearby?category=parks',
      '/explore?category=hiking', '/explore?category=waterfront',
    ]);
    const [transport] = shortcuts;
    assert.equal(transport.props.label, locale === 'en' ? 'Transport Search' : '交通查詢');
    const transportLink = QuickLinkCard(transport.props);
    assert.deepEqual(nodes(transportLink).filter(({ type }) => type === 'Icon').map(({ props }) => props.name), ['bus', 'tram.fill.tunnel']);
    find(HomeLink(transportLink.props), 'Pressable').props.onPress();
    assert.equal(pushed.pop(), '/transport');

    function assertPinVisibility(pins, status, cardCount, showAdd) {
      pinState = { pins, status };
      hookIndex = 0;
      const homePage = nodes(HomeScreen());
      const section = homePage.find(({ type, props }) => type === HomeSection && props.title === labels().home.buses);
      const children = nodes(section.props.children);
      assert.deepEqual(children.map(({ type }) => type),
        [...Array(cardCount).fill('HomeFavoriteBus'),
          ...(status === 'loading' || busStatus === 'loading' ? ['AppText'] : []),
          ...(cardCount === 0 && showAdd ? ['EmptyState'] : []),
          ...(showAdd ? [HomeLink, 'Icon', 'AppText'] : [])]);
      assert.equal(children.find(({ type }) => type === HomeLink)?.props.label, showAdd ? addLabel : undefined);
      assert.equal(section.props.action.href, '/saved?category=all');
      assert.deepEqual(homePage.filter(({ type }) => type === QuickLinkCard).map(({ props }) => props.href),
        shortcuts.map(({ props }) => props.href));
      return section;
    }

    // A cold start or a pending favorite read cannot infer availability from partial data.
    assertPinVisibility([], 'loading', 0, false);
    busStatus = 'loading';
    assertPinVisibility(busPins.slice(0, 2), 'ready', 2, false);
    busStatus = 'ready';
    const emptyFrequent = assertPinVisibility([], 'ready', 0, true);
    assert(hasCopy(emptyFrequent, emptyTitle));
    assert.equal(find(emptyFrequent, 'EmptyState').props.detail, emptyDetail);
    tapText(emptyFrequent, addLabel);
    assert.deepEqual(pushed.pop(), addFrequentHref);
    tapText(emptyFrequent, labels().homeRailway.viewSaved);
    assert.equal(pushed.pop(), '/saved?category=all');
    assertPinVisibility(busPins.slice(0, 2), 'ready', 2, true);
    const fullFrequent = assertPinVisibility(busPins.slice(0, 3), 'ready', 3, false);
    tapText(fullFrequent, labels().homeRailway.viewSaved);
    assert.equal(pushed.pop(), '/saved?category=all');
    // Returning from Saved uses the latest shared pin snapshot.
    assertPinVisibility(busPins.slice(0, 2), 'ready', 2, true);
    assertPinVisibility([...busPins.slice(0, 2), { mode: 'bus', id: 'missing' }], 'ready', 2, true);
  }
  locale = 'zh-HK';
  slots = [];
  hookIndex = 0;
  const home = HomeHero(labels().home);
  const entry = nodes(home).find(({ type, props }) => type === HomeLink && props.href === '/search');
  assert(entry);
  find(HomeLink(entry.props), 'Pressable').props.onPress();
  assert.deepEqual(pushed, ['/search']);

  let screen = render();
  assert(hasCopy(empty(screen), labels().search.introduction));
  for (const title of Object.values(labels().search.groups)) assert(hasCopy(empty(screen), title));
  assert.equal(nodes(empty(screen), true).filter(({ type }) => type === 'Pressable').length, 4);
  assert.equal(nodes(screen).filter(({ type }) => type === 'TextInput').length, 1);
  assert.equal(input(screen).maxLength, search.globalSearchMaxLength);
  assert.equal(input(screen).submitBehavior, 'blurAndSubmit');
  assert.equal(stopReads, 0);
  assert.equal(cachedReads, 0);
  assert.equal(requests.length, 0);

  input(screen).onChangeText('香港');
  screen = render();
  assert(hasCopy(empty(screen), labels().search.searching));
  advance(179);
  assert.equal(resultItems(render()).length, 0);
  assert.equal(stopReads, 0);
  advance(1);
  const preLoad = render(false);
  assert(hasCopy(list(preLoad).ListHeaderComponent, labels().search.routeNotLoaded));
  assert(!hasCopy(empty(preLoad), labels().search.empty));
  screen = render();
  assert(hasCopy(list(screen).ListHeaderComponent, labels().search.routeLoading));
  await stopsTask;
  screen = await flush();
  assert.equal(cachedReads, 1);
  assert.equal(stopReads, 1);
  assert.equal(requests.length, 0, 'Fresh cached catalogues need no network calls');
  const matched = search.searchGlobal('香港', {
    busCatalogue: { feeds: liveFeeds, loading: false, failed: {} }, busStops: await stopsTask,
  });
  for (const expected of matched.groups) {
    const actual = displayed(screen, expected.kind);
    assert(actual.length > 0, expected.kind);
    assert(actual.length <= 5);
    assert.deepEqual(actual, expected.results.slice(0, 5));
  }
  const mixedKeys = resultItems(screen).map(({ key }) => key);
  assert.equal(new Set(mixedKeys).size, mixedKeys.length);
  assert(!resultItems(screen).some(({ route }) => route?.number === '268X'), 'Unmatched design example must stay out of results');
  assert(list(screen).initialNumToRender < list(screen).data.length);
  assert.equal(list(screen).automaticallyAdjustKeyboardInsets, true);
  assert.equal(list(screen).keyboardShouldPersistTaps, 'handled');
  const stopHeading = list(screen).data.find((row) => row.type === 'group' && row.kind === 'transport_stop');
  const placeHeading = list(screen).data.find((row) => row.type === 'group' && row.kind === 'explore_place');
  assert.equal(placeHeading.canExpand, false);
  assert.equal(stopHeading.canExpand, true);
  const mixedScroll = list(screen).onScroll;
  mixedScroll({ nativeEvent: { contentOffset: { y: 190 } } });
  tapText(list(screen).renderItem({ item: stopHeading }), labels().search.viewAllFor(labels().search.groups.transport_stop));
  screen = render();
  assert.equal(displayed(screen, 'transport_stop').length, 30);
  assert.equal(displayed(screen, 'facility').length, 0);
  assert(hasCopy(list(screen).ListFooterComponent, labels().search.refine));
  assert.equal(list(screen).contentOffset.y, 0);
  mixedScroll({ nativeEvent: { contentOffset: { y: 0 } } });
  tapText(screen, labels().search.backToAll);
  screen = render();
  assert.equal(list(screen).contentOffset.y, 190);
  assert.deepEqual(resultItems(screen).map(({ key }) => key), mixedKeys);
  assert.equal(keyboardDismissals, 2);

  const row = list(screen).data.find((entry) => entry.type === 'result' && entry.result.kind === 'facility');
  assert(row.result.identity.stableFacilityId);
  const pressRow = (item) => nodes(list(screen).renderItem({ item }), true).find(({ type }) => type === 'Pressable');
  assert.ok(pressRow(row).props.accessibilityLabel.includes(row.result.facility.name['zh-HK']));
  const scrolls = [];
  const listRef = find(screen, 'FlatList').props.ref;
  listRef.current = { scrollToOffset: ({ offset }) => scrolls.push(offset) };
  pressRow(row).props.onPress();
  pressRow(row).props.onPress();
  assert.deepEqual(pushed, ['/search', { pathname: '/search/facility-map', params: row.result.identity }]);
  blur();
  blur = focusEffect();
  advance(16);
  assert.deepEqual(scrolls, [190]);
  assert.equal(input(render()).value, '香港');

  tapText(list(screen).renderItem({ item: stopHeading }), labels().search.viewAllFor(labels().search.groups.transport_stop));
  screen = render();
  const scopedData = list(screen).data;
  const stopRow = scopedData.find((entry) => entry.type === 'result');
  list(screen).onScroll({ nativeEvent: { contentOffset: { y: 310 } } });
  pressRow(stopRow).props.onPress();
  const otherStop = scopedData.find((entry) => entry.type === 'result' && entry !== stopRow);
  pressRow(otherStop).props.onPress();
  assert.equal(pushed.length, 3, 'A second row may not push while the first is opening');
  assert.deepEqual(pushed.at(-1), { pathname: '/bus/nearby/stop', params: {
    source: stopRow.result.source, stopId: stopRow.result.stopId,
  } });
  blur();
  blur = focusEffect();
  advance(16);
  screen = render();
  assert.deepEqual(scrolls, [190, 310]);
  assert.equal(input(screen).value, '香港');
  assert.deepEqual(list(screen).data.map(({ key }) => key), scopedData.map(({ key }) => key));
  assert.equal(cachedReads, 1);
  assert.equal(stopReads, 1);
  tapText(screen, labels().search.backToAll);
  screen = render();
  assert.equal(list(screen).contentOffset.y, 190);

  const invalid = { ...row, result: { ...row.result, identity: { source: 'afcd', stableFacilityId: 'unknown' } } };
  pressRow(invalid).props.onPress();
  assert.equal(alerts.at(-1), labels().search.facilityUnavailable);
  assert.equal(pushed.length, 3);
  failPush = true;
  pressRow(row).props.onPress();
  assert.equal(alerts.at(-1), labels().search.openFailed);
  failPush = false;
  pressRow(row).props.onPress();
  assert.equal(pushed.length, 4);
  blur();
  blur = focusEffect();
  advance(16);

  locale = 'en';
  screen = render();
  assert.equal(input(screen).value, '香港');
  assert.deepEqual(resultItems(screen).map(({ key }) => key), mixedKeys);
  assert(hasCopy(list(screen).renderItem({ item: stopHeading }), labels().search.groups.transport_stop));
  input(screen).onChangeText('PARK');
  screen = render();
  assert.equal(resultItems(screen).length, 0);
  advance(90);
  input(screen).onChangeText("dRaGoN's BaCk");
  screen = render();
  advance(90);
  screen = render();
  assert(hasCopy(empty(screen), labels().search.searching));
  assert.equal(resultItems(screen).length, 0, 'The earlier timer cannot publish results from a previous input');
  advance(90);
  screen = await flush();
  assert.equal(displayed(screen, 'explore_place')[0].place.id, 'dragons-back-to-tei-wan-tai-tam-gap');
  assert(hasCopy(list(screen).renderItem({ item: list(screen).data.find((item) => item.type === 'result') }), 'Dragon’s Back'));
  assert.equal(list(screen).data.filter(({ type }) => type === 'group').length, 1);
  const dragonRow = list(screen).data.find((item) => item.type === 'result');
  pressRow({ ...dragonRow, result: { ...dragonRow.result, place: { ...dragonRow.result.place, id: 'invalid' } } }).props.onPress();
  assert.equal(alerts.at(-1), 'This search result is currently unavailable');
  pressRow(dragonRow).props.onPress();
  assert.deepEqual(pushed.at(-1), { pathname: '/explore/place/[id]', params: { id: 'dragons-back-to-tei-wan-tai-tam-gap' } });
  blur();
  blur = focusEffect();
  advance(16);
  assert.equal(input(render()).value, "dRaGoN's BaCk");

  input(screen).onChangeText('不存在的關鍵詞𠮷');
  screen = await complete();
  assert(hasCopy(empty(screen), labels().search.empty));
  assert.equal(resultItems(screen).length, 0);
  tapText(screen, labels().search.clear);
  screen = render();
  assert.equal(input(screen).value, '');
  assert(hasCopy(empty(screen), labels().search.introduction));
  assert.equal(list(screen).contentOffset.y, 0);
  assert.equal(stopReads, 1, 'Clearing preserves the loaded source for this search instance');
  assert.equal(cachedReads, 1);
  assert.equal(requests.length, 0);

  reset();
  cached = {};
  operatorFailures = new Set(['kmbLwb', 'citybus', 'nlb']);
  stopsTask = undefined;
  screen = render();
  input(screen).onChangeText('香港公園');
  screen = await complete();
  assert(hasCopy(list(screen).ListHeaderComponent, labels().search.routeFailed));
  assert(displayed(screen, 'facility').some(({ facility }) => facility.name.en === 'Hong Kong Park'));
  assert(displayed(screen, 'explore_place').some(({ place }) => place.id === 'hong-kong-park'));
  assert.equal(requests.length, 3);
  input(screen).onChangeText('香港');
  screen = await complete();
  assert.equal(requests.length, 3, 'Changing keywords does not retry remote feeds');
  assert(displayed(screen, 'bus_stop').length > 0);
  assert(!hasCopy(empty(screen), labels().search.empty));
  operatorFailures.delete('kmbLwb');
  tapText(list(screen).ListHeaderComponent, labels().bus.retry);
  screen = await flush();
  assert.equal(requests.length, 6, 'Explicit retry delegates to the existing hook');
  assert(hasCopy(list(screen).ListHeaderComponent, labels().search.routePartial));
  assert(displayed(screen, 'bus_route').length > 0);
  assert(displayed(screen, 'bus_stop').length > 0);

  reset();
  cached = liveFeeds;
  stopsFail = true;
  stopsTask = undefined;
  screen = render();
  input(screen).onChangeText('香港公園');
  screen = await complete();
  assert(hasCopy(list(screen).ListHeaderComponent, labels().search.stopsFailed));
  assert(displayed(screen, 'explore_place').length > 0);
  stopsFail = false;
  tapText(list(screen).ListHeaderComponent, labels().bus.retry);
  render();
  await stopsTask;
  screen = await flush();
  assert(!hasCopy(list(screen).ListHeaderComponent, labels().search.stopsFailed));

  for (locale of ['zh-HK', 'en']) {
    reset(); cached = liveFeeds; operatorFailures = new Set(); stopsTask = undefined; stopsFail = false;
    screen = render();
    assert.deepEqual(Object.values(labels().search.groups), locale === 'en'
      ? ['Transport routes', 'Transport stops', 'Nearby facilities', 'Featured places']
      : ['交通路線', '交通車站', '附近設施', '精選地點']);
    tapText(empty(screen), labels().search.groups.transport_route);
    screen = render();
    assert(hasCopy(screen, labels().search.backToAll));
    for (const [query, kind, id, href] of [
      ['B2', 'bus_route', undefined, undefined],
      [locale === 'en' ? 'Island Line' : '港島綫', 'mtr_line', 'ISL', { pathname: '/mtr/[kind]', params: { kind: 'line', code: 'ISL' } }],
      ['610', 'light_rail_route', '610', { pathname: '/light-rail/[kind]', params: { kind: 'route', id: '610' } }],
    ]) {
      input(screen).onChangeText(query); screen = await complete();
      assert(resultItems(screen).every(({ kind }) => ['bus_route', 'mtr_line', 'light_rail_route', 'tram_route'].includes(kind)));
      const row = list(screen).data.find((row) => row.type === 'result' && row.result.kind === kind && (!id || row.result.entry?.id === id));
      assert(row, `${locale}: ${query}`);
      const actionsBefore = pushed.length;
      const returnScrolls = [];
      find(screen, 'FlatList').props.ref.current = { scrollToOffset: ({ offset }) => returnScrolls.push(offset) };
      list(screen).onScroll({ nativeEvent: { contentOffset: { y: 175 } } });
      pressRow(row).props.onPress(); pressRow(row).props.onPress();
      assert.equal(pushed.length, actionsBefore + 1);
      if (href) assert.deepEqual(pushed.at(-1), href);
      blur(); blur = focusEffect(); advance(16); screen = render();
      assert.equal(input(screen).value, query);
      assert.deepEqual(returnScrolls, [175]);
      assert(hasCopy(screen, labels().search.backToAll));
    }
    input(screen).onChangeText('2'); screen = await complete();
    const minibus = list(screen).data.find(({ result }) => result?.key === 'gmb_route:2002349');
    assert(minibus, 'Special minibus variant in global transport routes');
    assert.match(pressRow(minibus).props.accessibilityLabel, locale === 'en' ? /Minibus.*Special Departure/ : /專線小巴.*特別班次/);
    pressRow(minibus).props.onPress();
    assert.deepEqual(pushed.at(-1), { pathname: '/minibus/[id]', params: { id: '2002349' } });
    blur(); blur = focusEffect(); advance(16); screen = render();
    assert.equal(input(screen).value, '2');

    tapText(screen, labels().search.clear); screen = render();
    tapText(empty(screen), labels().search.groups.transport_stop); screen = render();
    for (const [query, kind, id, href] of [
      ['Admiralty', 'mtr_station', 'ADM', { pathname: '/mtr/[kind]', params: { kind: 'station', code: 'ADM' } }],
      ['ADM', 'mtr_station', 'ADM', { pathname: '/mtr/[kind]', params: { kind: 'station', code: 'ADM' } }],
      [locale === 'en' ? 'Hoi Wong Road' : '海皇路', 'light_rail_stop', '250', { pathname: '/light-rail/[kind]', params: { kind: 'stop', id: '250' } }],
      ['250', 'light_rail_stop', '250', { pathname: '/light-rail/[kind]', params: { kind: 'stop', id: '250' } }],
    ]) {
      input(screen).onChangeText(query); screen = await complete();
      assert(resultItems(screen).every(({ kind }) => ['bus_stop', 'mtr_station', 'light_rail_stop', 'tram_stop'].includes(kind)));
      const row = list(screen).data.find((row) => row.type === 'result' && row.result.kind === kind && row.result.entry.id === id);
      assert(row, `${locale}: ${query}`);
      const actual = pressRow(row);
      assert(actual.props.accessibilityLabel.includes(kind === 'mtr_station' ? labels().transport.modes.mtr : labels().transport.modes.lightRail));
      actual.props.onPress();
      assert.deepEqual(pushed.at(-1), href);
      blur(); blur = focusEffect(); advance(16); screen = render();
      assert.equal(input(screen).value, query);
    }
    input(screen).onChangeText('洪水橋'); screen = await complete();
    assert(displayed(screen, 'bus_stop').length > 0);
    assert(displayed(screen, 'light_rail_stop').some(({ key }) => key === 'light_rail_stop:380'));
    assert.equal(new Set(resultItems(screen).map(({ key }) => key)).size, resultItems(screen).length);
    input(screen).onChangeText('ADM'); render(); advance(90);
    input(render()).onChangeText('250'); render(); advance(90);
    assert.equal(resultItems(render()).length, 0, 'An older railway query timer cannot publish stale results');
    advance(90); screen = await flush();
    assert(displayed(screen, 'light_rail_stop').some(({ key }) => key === 'light_rail_stop:250'));
    assert.equal(displayed(screen, 'mtr_station').length, 0);
    tapText(screen, labels().search.clear); screen = render();
    assert.equal(nodes(empty(screen), true).filter(({ type }) => type === 'Pressable').length, 4);
  }
  reset(); cached = {}; operatorFailures = new Set(['kmbLwb', 'citybus', 'nlb']); stopsTask = undefined; stopsFail = true;
  screen = render(); input(screen).onChangeText('610'); screen = await complete();
  assert(displayed(screen, 'light_rail_route').some(({ key }) => key === 'light_rail_route:610'));
  assert(hasCopy(list(screen).ListHeaderComponent, labels().search.routeFailed));
  input(screen).onChangeText('Admiralty'); screen = await complete();
  assert(displayed(screen, 'mtr_station').some(({ key }) => key === 'mtr_station:ADM'));
  assert(hasCopy(list(screen).ListHeaderComponent, labels().search.stopsFailed));

  reset(); cached = liveFeeds; operatorFailures = new Set(); stopsTask = undefined; stopsFail = false;
  screen = render(); input(screen).onChangeText('Central Pier 4'); screen = await complete();
  assert(!resultItems(screen).some(({ kind }) => kind === 'ferry_route'), 'Release search has no ferry rows');

  Object.assign(ferryPreview, {
    hkkfPreviewEnabled: true,
    hkkfPreviewClient: load('hkkf-client').createHkkfClient({ enabled: true, async request(url) {
      const path = new URL(url).pathname;
      ferryPaths.push(path);
      assert.equal(path, '/opendata/route');
      return new Response(JSON.stringify(hkkfFixture.routes));
    } }),
  });
  for (locale of ['zh-HK', 'en']) {
    reset();
    screen = render();
    tapText(empty(screen), labels().search.groups.transport_route);
    screen = render();
    input(screen).onChangeText(locale === 'en' ? 'Central Pier 4' : '中環4號渡輪碼頭');
    screen = await complete();
    assert.deepEqual(resultItems(screen).filter(({ kind }) => kind === 'ferry_route').map(({ key }) => key),
      ['ferry_route:hkkf:route:1', 'ferry_route:hkkf:route:2']);
    const query = locale === 'en' ? 'Peng Chau Pier' : '坪洲渡輪碼頭';
    input(screen).onChangeText(query);
    screen = await complete();
    assert.deepEqual(resultItems(screen).filter(({ kind }) => kind === 'ferry_route').map(({ key }) => key),
      ['ferry_route:hkkf:route:3', 'ferry_route:hkkf:route:4']);
    const row = list(screen).data.find(({ result }) => result?.key === 'ferry_route:hkkf:route:4');
    const scrolls = [];
    find(screen, 'FlatList').props.ref.current = { scrollToOffset: ({ offset }) => scrolls.push(offset) };
    list(screen).onScroll({ nativeEvent: { contentOffset: { y: 100 } } });
    pressRow(row).props.onPress();
    assert.deepEqual(pushed.at(-1), { pathname: '/ferry/[id]', params: { id: '4', operatorId: 'hkkf' } });
    blur(); blur = focusEffect(); advance(16); screen = render();
    assert.equal(input(screen).value, query);
    assert.deepEqual(scrolls, [100]);
    input(screen).onChangeText(locale === 'en' ? 'Central ↔ Yung Shue Wan' : '中環往來榕樹灣');
    screen = await complete();
    assert.deepEqual(resultItems(screen).filter(({ kind }) => kind === 'ferry_route').map(({ key }) => key),
      ['ferry_route:hkkf:route:2']);
  }
  assert.deepEqual(ferryPaths, ['/opendata/route'], 'Keywords and screens reuse the catalogue without ETA requests');

  for (locale of ['zh-HK', 'en']) {
    reset();
    stopsTask = undefined;
    screen = render();
    for (const query of locale === 'en' ? ['Kennedy Town Happy Valley', 'Western Market Terminus'] : ['堅尼地城 跑馬地', '上環街市(西港城)總站']) {
      input(screen).onChangeText(query);
      screen = await complete();
      assert(!resultItems(screen).some(({ kind }) => kind === 'tram_route' || kind === 'tram_stop'));
    }
  }

  // Keep the existing navigation and bilingual checks for the future reopening.
  tramFeature.tramFeatureEnabled = true;
  for (locale of ['zh-HK', 'en']) {
    reset();
    stopsTask = undefined;
    screen = render();
    tapText(empty(screen), labels().search.groups.transport_route);
    screen = render();
    const routeName = locale === 'en' ? 'Kennedy Town Happy Valley' : '堅尼地城 跑馬地';
    input(screen).onChangeText(routeName);
    screen = await complete();
    const route = list(screen).data.find(({ result }) => result?.key === 'td:tram:route:4003');
    assert(route);
    assert.match(pressRow(route).props.accessibilityLabel, locale === 'en' ? /Tram · Route/ : /電車 · 路線/);
    pressRow(route).props.onPress();
    assert.deepEqual(pushed.at(-1), { pathname: '/tram/[kind]', params: { kind: 'route', id: '4003' } });
    blur(); blur = focusEffect(); advance(16); screen = render();
    assert.equal(input(screen).value, routeName);
    tapText(screen, labels().search.clear); screen = render();
    tapText(empty(screen), labels().search.groups.transport_stop); screen = render();
    const stopName = locale === 'en' ? 'Western Market Terminus' : '上環街市(西港城)總站';
    input(screen).onChangeText(stopName);
    screen = await complete();
    const stops = resultItems(screen).filter(({ kind }) => kind === 'tram_stop');
    assert.deepEqual(stops.map(({ stop }) => stop.stopId), [99140, 99212]);
    assert.deepEqual(stops.map(({ visits }) => visits.find(({ routeId }) => routeId === 4001)?.directionId), [1, 2]);
    assert(stops.every(({ stop, visits }) => visits.length > 0 && visits.every(({ stopId }) => stopId === stop.stopId)));
    const row = list(screen).data.find(({ result }) => result?.key === 'td:tram:stop:99212');
    assert.match(pressRow(row).props.accessibilityLabel, locale === 'en' ? /Tram · Stop · Stop ID 99212/ : /電車 · 車站 · 車站編號 99212/);
    pressRow(row).props.onPress();
    assert.deepEqual(pushed.at(-1), { pathname: '/tram/[kind]', params: { kind: 'stop', id: '99212' } });
    blur(); blur = focusEffect(); advance(16); screen = render();
    assert.equal(input(screen).value, stopName);
    input(screen).onChangeText(locale === 'en' ? 'Shek Tong Tsui Terminus' : '石塘咀總站');
    screen = await complete();
    const closed = list(screen).data.find(({ result }) => result?.key === 'td:tram:stop:99313');
    assert.match(pressRow(closed).props.accessibilityLabel, locale === 'en' ? /Temporarily closed/ : /暫時關閉/);
  }

  console.log('PASS: four interactive bilingual entry cards; six transport sources including offline tram and gated HKKF, scoped categories, detail navigation, debounce/return and offline rail under bus failures; facilities and places unchanged');
}

verify().catch((error) => { console.error(error); process.exitCode = 1; }).finally(reset);
