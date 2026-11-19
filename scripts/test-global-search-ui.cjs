const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { dirname, join, resolve } = require('node:path');
const ts = require('typescript');

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
let keyboardDismissals = 0;
const native = Object.fromEntries(['TextInput', 'FlatList', 'Text', 'View', 'Pressable', 'ActivityIndicator', 'Image']
  .map((name) => [name, name]));
Object.assign(native, {
  StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
  Keyboard: { dismiss() { keyboardDismissals++; } },
  useWindowDimensions: () => ({ width: 375, height: 812, fontScale: 1 }),
});
const basicUi = Object.fromEntries(['AppText', 'EmptyState', 'Icon'].map((name) => [name, name]));
const stubs = {
  react, 'react-native': native,
  'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
  'expo-router': { useRouter: () => ({ navigate: (href) => pushed.push(href) }) },
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
  new Function('module', 'exports', 'require', 'setTimeout', 'clearTimeout', outputText)(module, module.exports, (id) => {
    if (Object.hasOwn(stubs, id)) return stubs[id];
    if (id.startsWith('@/')) return load(id.slice(2));
    if (id.startsWith('.')) return require(resolve(dirname(file), id));
    return require(id);
  }, name === 'app/search' ? after : setTimeout, name === 'app/search' ? (id) => timers.delete(id) : clearTimeout);
  return module.exports;
}

function nodes(value, expand = false) {
  if (Array.isArray(value)) return value.flatMap((item) => nodes(item, expand));
  if (!value?.props) return [];
  const children = expand && typeof value.type === 'function' ? value.type(value.props) : value.props.children;
  return [value, ...nodes(children, expand)];
}

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
const displayed = (screen, kind) => resultItems(screen).filter((result) => result.kind === kind);
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
  const { HomeHero, HomeLink } = load('components/home-ui');
  const home = HomeHero(labels().home);
  const entry = nodes(home).find(({ type, props }) => type === HomeLink && props.href === '/search');
  assert(entry);
  find(HomeLink(entry.props), 'Pressable').props.onPress();
  assert.deepEqual(pushed, ['/search']);

  let screen = render();
  assert(hasCopy(empty(screen), labels().search.introduction));
  for (const title of Object.values(labels().search.groups)) assert(hasCopy(empty(screen), title));
  assert(!nodes(empty(screen), true).some(({ type }) => type === 'Pressable'));
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
  const stopHeading = list(screen).data.find((row) => row.type === 'group' && row.kind === 'bus_stop');
  const placeHeading = list(screen).data.find((row) => row.type === 'group' && row.kind === 'explore_place');
  assert.equal(placeHeading.canExpand, false);
  assert.equal(stopHeading.canExpand, true);
  const mixedScroll = list(screen).onScroll;
  mixedScroll({ nativeEvent: { contentOffset: { y: 190 } } });
  tapText(list(screen).renderItem({ item: stopHeading }), labels().search.viewAllFor(labels().search.groups.bus_stop));
  screen = render();
  assert.equal(displayed(screen, 'bus_stop').length, 30);
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
  assert(!nodes(list(screen).renderItem({ item: row }), true).some(({ type }) => type === 'Pressable'));
  assert.deepEqual(pushed, ['/search'], 'C2 results do not perform any destination navigation');

  locale = 'en';
  screen = render();
  assert.equal(input(screen).value, '香港');
  assert.deepEqual(resultItems(screen).map(({ key }) => key), mixedKeys);
  assert(hasCopy(list(screen).renderItem({ item: stopHeading }), labels().search.groups.bus_stop));
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

  console.log('PASS: Home entry, C1-backed bilingual UI, five-row previews, bounded expansion and scroll offset, debounce, local and partial states');
}

verify().catch((error) => { console.error(error); process.exitCode = 1; }).finally(reset);
