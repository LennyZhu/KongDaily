const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { existsSync, readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { test } = require('node:test');
const ts = require('typescript');

const root = join(__dirname, '..');
const { stops } = require('../assets/data/nearby-stops.json');
const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE nearby_bus_stops (
  source TEXT, stop_id TEXT, name_zh TEXT, name_en TEXT,
  latitude REAL, longitude REAL, street_zh TEXT, street_en TEXT
)`);
const insert = db.prepare('INSERT INTO nearby_bus_stops VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
db.exec('BEGIN');
for (const [source, rows] of Object.entries(stops)) {
  for (const row of rows) insert.run(source, ...row);
}
db.exec('COMMIT');

const transpiled = new Map();
const granted = { granted: true, canAskAgain: true };
const promptable = { granted: false, canAskAgain: true };
const blocked = { granted: false, canAskAgain: false };

function mount(t, {
  permission = granted, servicesEnabled = true, appState = 'active', locale = 'zh-HK', transport = false,
  intent, delayCatalogue = false, offlineCatalogue = false, mtrDetail, lightRailDetail,
} = {}) {
  const events = new EventEmitter();
  const requests = [];
  const queries = [];
  const routes = [];
  const settings = [];
  const alerts = [];
  const openedLinks = [];
  const calls = { services: 0, permission: 0, prompt: 0 };
  let permissionOnRequest = granted;
  let focused = true;
  let mounted = true;
  let dirty = true;
  let cursor = 0;
  let effects = [];
  let screenTree;
  let tree;
  let modePickerTree;
  let searchTree;
  let lineStationsTree;
  let etaRoutes;
  let etaNow = 0;
  let dismissals = 0;
  let catalogueReads = 0;
  let finishCatalogue;
  const slots = [];
  const frames = new Map();
  let frameId = 0;

  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (argument) => {
        assert.ok(mounted, 'State updated after Nearby Bus unmounted');
        const next = typeof argument === 'function' ? argument(slots[index]) : argument;
        if (!Object.is(next, slots[index])) dirty = true;
        slots[index] = next;
      }];
    },
    useRef(current) {
      const index = cursor++;
      return slots[index] ??= { current };
    },
    useMemo(factory, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (previous && dependencies.every((value, i) => Object.is(value, previous.dependencies[i]))) return previous.value;
      const value = factory();
      slots[index] = { value, dependencies };
      return value;
    },
    useCallback: (fn, dependencies) => react.useMemo(() => fn, dependencies),
    useEffect(effect, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (previous && dependencies.every((value, i) => Object.is(value, previous.dependencies[i]))) return;
      effects.push(() => {
        previous?.cleanup?.();
        slots[index] = { dependencies, cleanup: effect() };
      });
    },
  };
  react.useLayoutEffect = react.useEffect;

  const AppState = {
    currentState: appState,
    addEventListener(event, listener) {
      assert.equal(event, 'change');
      events.on(event, listener);
      return { remove: () => events.off(event, listener) };
    },
  };
  const navigation = {
    isFocused: () => focused,
    addListener(event, listener) {
      events.on(event, listener);
      return () => events.off(event, listener);
    },
  };
  const native = Object.fromEntries(['ActivityIndicator', 'FlatList', 'Pressable', 'ScrollView', 'TextInput', 'View'].map((name) => [name, name]));
  const setVisible = () => {};
  const mocks = {
    react,
    'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
    'react-native': {
      ...native, AppState, StyleSheet: { create: (styles) => styles }, useWindowDimensions: () => ({ width: 320 }),
      Keyboard: { dismiss: () => { dismissals++; } },
      Linking: {
        openSettings: () => new Promise((resolve, reject) => settings.push({ resolve, reject })),
        async openURL(url) { openedLinks.push(url); },
      },
      Alert: { alert: (message) => alerts.push(message) },
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    'expo-location': {
      Accuracy: { High: 4 },
      async hasServicesEnabledAsync() { calls.services++; return servicesEnabled; },
      async getForegroundPermissionsAsync() { calls.permission++; return permission; },
      async requestForegroundPermissionsAsync() { calls.prompt++; return permission = await permissionOnRequest; },
      getCurrentPositionAsync({ accuracy }) {
        assert.equal(accuracy, 4);
        return new Promise((resolve, reject) => requests.push({ resolve, reject }));
      },
    },
    'expo-router': {
      useRouter: () => ({ push: (href) => routes.push(href) }),
      useLocalSearchParams: () => mtrDetail ?? lightRailDetail ?? { intent },
      useFocusEffect: (effect) => load(require.resolve('expo-router/build/useFocusEffect')).useFocusEffect(effect),
    },
    './link/useLoadedNavigation': { useOptionalNavigation: () => navigation },
    './useNavigation': { useNavigation: () => navigation },
    '@/language': { useLanguage: () => ({ locale, copy: source('i18n').messages[locale] }) },
    '@/components/ui': {
      AppText: 'AppText', EmptyState: 'EmptyState', Icon: 'Icon', Filters: 'Filters',
      PageHeading: 'PageHeading', Screen: 'Screen',
    },
    '@/database': { getDatabase: async () => ({
      async getAllAsync(sql, ...params) {
        queries.push(params);
        return db.prepare(sql).all(...params);
      },
    }) },
    '@/components/home-ui': { HarbourBackdrop: 'HarbourBackdrop' },
    '@/components/saved-bus-ui': { FavoriteBusRow: 'FavoriteBusRow' },
    '@/bus-favorite-hooks': {},
    '@/bus-data': {
      async readBusFeeds() {
        catalogueReads++;
        if (pendingCatalogue) await pendingCatalogue;
        return offlineCatalogue ? {} : cachedCatalogue;
      },
      BusFeedError: class BusFeedError extends Error {},
      isBusFeedFresh: () => true,
      requestBusJson: () => assert.fail('Unexpected bus network request'),
      async refreshBusFeed() {
        if (offlineCatalogue) throw new Error('Offline');
        assert.fail('Unexpected catalogue refresh');
      },
    },
    '@/nearby-stop-eta-hooks': { useStationEta(routes) {
      etaRoutes = routes;
      return { records: {}, rateLimits: {}, now: etaNow, setVisible };
    } },
  };
  const modules = new Map();

  function source(name) {
    const base = join(root, 'src', name + '.ts');
    return load(existsSync(base) ? base : `${base}x`);
  }

  function load(filename) {
    if (modules.has(filename)) return modules.get(filename).exports;
    const module = { exports: {} };
    modules.set(filename, module);
    if (!transpiled.has(filename)) {
      const text = readFileSync(filename, 'utf8');
      const code = filename.endsWith('.js') ? text : ts.transpileModule(text, { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
      } }).outputText;
      transpiled.set(filename, new Function('module', 'exports', 'require', 'requestAnimationFrame', 'cancelAnimationFrame', code));
    }
    const localRequire = createRequire(filename);
    transpiled.get(filename)(module, module.exports, (id) => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id === '@/nearby-bus-data') return {
        ...source('nearby-bus-data'), prepareNearbyBusIndex: async () => [], kmbNearbyNeedsRefresh: () => false,
      };
      return id.startsWith('@/') ? source(id.slice(2)) : localRequire(id);
    }, (callback) => { frames.set(++frameId, callback); return frameId; }, (id) => frames.delete(id));
    return module.exports;
  }

  const { parseBusCatalogue } = source('bus-routes');
  const catalogueRoutes = {
    kmbLwb: parseBusCatalogue('kmbLwb', { data: [1, 3].map((variant) => ({
      route: '268X', bound: 'O', service_type: variant, orig_tc: '洪水橋', orig_en: 'Hung Shui Kiu',
      dest_tc: '高鐵(西九龍站)', dest_en: 'High Speed Rail West Kowloon Station',
    })) }),
    citybus: parseBusCatalogue('citybus', { data: [{
      co: 'CTB', route: '23', orig_tc: '蒲飛路', orig_en: 'Pokfield Road', dest_tc: '北角碼頭', dest_en: 'North Point Ferry Pier',
    }] }),
    nlb: parseBusCatalogue('nlb', { routes: [
      { routeId: 37, routeNo: 'B2', routeName_c: '元朗港鐵站>深圳灣口岸', routeName_e: 'Yuen Long MTR Station>Shenzhen Bay Port' },
      { routeId: 33, routeNo: 'B2P', routeName_c: '天水圍 (天慈邨)>深圳灣口岸', routeName_e: 'Tin Shui Wai (Tin Tsz Estate)>Shenzhen Bay Port' },
    ] }),
  };
  const cachedCatalogue = Object.fromEntries(Object.entries(catalogueRoutes).map(([source, routes]) => [
    source, { routes, fetchedAt: Date.now(), persisted: true },
  ]));
  const pendingCatalogue = delayCatalogue && new Promise((resolve) => { finishCatalogue = resolve; });

  const busScreen = source('app/bus/nearby').default;
  const transportEntry = transport && source('app/transport').default();
  if (transportEntry) assert.equal(transportEntry.type, busScreen);
  const screen = mtrDetail ? source('app/mtr/[kind]').default
    : lightRailDetail ? source('app/light-rail/[kind]').default
    : transportEntry ? () => transportEntry.type(transportEntry.props) : busScreen;
  const copy = source('i18n').messages[locale];
  const labels = copy.nearbyBus;
  const landmarks = source('nearby-bus-landmarks').nearbyBusLandmarks;

  async function settle() {
    for (let attempt = 0; attempt < 15; attempt++) {
      if (dirty) {
        dirty = false;
        cursor = 0;
        effects = [];
        screenTree = screen();
        tree = elements(screenTree, false).find(({ type }) => type === 'FlatList');
        if (transport) {
          const controls = elements(screenTree, false);
          const picker = controls.find(({ type }) => type.name === 'TransportModePicker');
          modePickerTree = picker.type(picker.props);
          const search = controls.find(({ type }) => type.name === 'TransportSearch');
          searchTree = search && search.type(search.props);
        }
        if (mtrDetail || lightRailDetail) {
          const stationList = elements(screenTree, false)
            .find(({ type }) => type.name === (mtrDetail ? 'MtrLineStations' : 'LightRailRouteStops'));
          lineStationsTree = stationList && stationList.type(stationList.props);
        }
        effects.forEach((run) => run());
      }
      await new Promise(setImmediate);
      if (!dirty) return;
    }
    assert.fail('Nearby bus screen did not settle');
  }

  function elements(node, expand = true) {
    if (Array.isArray(node)) return node.flatMap((child) => elements(child, expand));
    if (!node?.props) return [];
    let children = node.props.children;
    if (expand) {
      const name = node.type?.name;
      if (name === 'TransportModePicker') children = modePickerTree;
      else if (name === 'TransportSearch') children = searchTree;
      else if (name === 'MtrLineStations' || name === 'LightRailRouteStops') children = lineStationsTree;
      else if (name?.startsWith('Transport')
        || ['Loading', 'MtrEntryRow', 'MtrSources', 'LightRailEntryRow', 'LightRailSources'].includes(name)) children = node.type(node.props);
    }
    return [node, ...elements(children, expand)];
  }
  function visibleElements() {
    return elements([screenTree, tree?.props.ListHeaderComponent, tree?.props.data.length === 0 && tree.props.ListEmptyComponent]);
  }
  function findAction(label) {
    const action = visibleElements()
      .find(({ type, props }) => type === 'Pressable'
      && (props.accessibilityLabel === label || elements(props.children).some((child) => child.props.children === label)));
    assert.ok(action, `Missing action: ${label}`);
    return action;
  }
  function press(label) {
    const action = findAction(label);
    assert.equal(Boolean(action.props.disabled), false, `Disabled action: ${label}`);
    action.props.onPress();
  }
  function shows(label) {
    return visibleElements().some(({ props }) => props.children === label || props.title === label || props.description === label);
  }

  function unmount() {
    if (!mounted) return;
    slots.forEach((slot) => slot?.cleanup?.());
    mounted = false;
  }

  function attachList({ failIndex = false } = {}) {
    const scrolls = [];
    tree.props.ref.current = {
      scrollToIndex(params) {
        scrolls.push({ method: 'index', ...params });
        if (failIndex) tree.props.onScrollToIndexFailed({ index: params.index, averageItemLength: 100 });
      },
      scrollToOffset(params) { scrolls.push({ method: 'offset', ...params }); },
    };
    return scrolls;
  }

  function showRows(indexes, offset) {
    tree.props.onScroll({ nativeEvent: { contentOffset: { y: offset } } });
    tree.props.onViewableItemsChanged({ viewableItems: indexes.map((index) => {
      const item = tree.props.data[index];
      assert.ok(item, `Missing visible row at ${index}`);
      return { item, index, key: tree.props.keyExtractor(item), isViewable: true };
    }) });
  }

  function paint() {
    for (const [id, run] of frames) {
      frames.delete(id);
      run();
    }
  }

  t.after(unmount);
  return {
    calls, labels, landmarks, requests, queries, routes, settings, alerts, openedLinks, settle, press, shows, unmount, findAction,
    visibleElements,
    transportCopy: copy.transport, busCopy: copy.bus, mtrCopy: copy.mtr, lightRailCopy: copy.lightRail,
    catalogueRoutes, theme: source('theme'),
    mtr: () => source('mtr-static'),
    lightRail: () => source('light-rail-static'),
    mtrForecastProps: () => visibleElements().find(({ type }) => type.name === 'MtrNextTrains')?.props,
    lightRailForecastProps: () => visibleElements().find(({ type }) => type.name === 'LightRailNextTrains')?.props,
    detailRows: () => visibleElements().filter(({ type }) => ['MtrEntryRow', 'LightRailEntryRow'].includes(type.name)).map(({ props }) => props),
    directionFilters: () => visibleElements().find(({ type }) => type === 'Filters')?.props,
    openResult: (index) => elements(tree.props.renderItem({ item: tree.props.data[index] }))
      .find(({ type, props }) => type === 'Pressable' || (type.name === 'BusRouteRow' && props.onPress)).props.onPress(),
    finishCatalogue: () => finishCatalogue(),
    catalogueReads: () => catalogueReads,
    dismissals: () => dismissals,
    controls: () => screenTree.props.children[0].props.children.filter(Boolean),
    searchInput: () => elements(searchTree).find(({ type }) => type === 'TextInput')?.props,
    list: () => tree,
    modeScroller: () => elements(modePickerTree).find(({ type }) => type === 'ScrollView').props,
    unavailableTitle: () => elements(tree.props.ListEmptyComponent).find(({ type }) => type === 'EmptyState')?.props.title,
    etaRoutes: () => etaRoutes,
    attachList, showRows, paint,
    tickEta() { etaNow += 1000; dirty = true; },
    rows: () => tree.props.data,
    renderRow: (index) => tree.props.renderItem({ item: tree.props.data[index] }),
    renderFirstRow: () => tree.props.renderItem({ item: tree.props.data[0] }),
    locateButton: () => elements(tree.props.ListHeaderComponent).find(({ props }) => props.accessibilityLabel === labels.useLocation),
    appState(state) { AppState.currentState = state; events.emit('change', state); },
    focus(value) { focused = value; events.emit(value ? 'focus' : 'blur'); },
    changePermission(value) { permission = value; },
    changeServices(value) { servicesEnabled = value; },
    answerPrompt(value) { permissionOnRequest = value; },
    fix(index, point, accuracy = 20) { requests[index].resolve({ coords: { ...point, accuracy } }); },
  };
}

test('authorized focus uses real stop and route data, preserves mode and radius, and refreshes on refocus', async (t) => {
  const page = mount(t);
  const { labels, landmarks } = page;
  await page.settle();
  assert.ok(page.shows('正在尋找附近巴士…'));
  assert.deepEqual(page.calls, { services: 1, permission: 1, prompt: 0 });
  assert.equal(page.requests.length, 1);
  assert.deepEqual(page.locateButton().props.accessibilityState, { disabled: true, busy: true });
  page.locateButton().props.onPress();
  page.focus(true);
  page.fix(0, landmarks.central);
  await page.settle();
  assert.ok(page.shows(labels.currentLocation));
  assert.ok(page.rows().length > 1);
  const routeDistances = page.rows().map(({ stop }) => stop.distance);
  assert.deepEqual(routeDistances, [...routeDistances].sort((a, b) => a - b));
  const { target } = page.rows()[0].route;
  page.renderFirstRow().props.onPress();
  assert.equal(page.routes[0].pathname, '/bus/route');
  assert.equal(page.routes[0].params.stopId, target.stopId);
  assert.equal(page.routes[0].params.stopSeq, String(target.stopSeq));
  page.press(labels.byStop);
  await page.settle();
  const stopDistances = page.rows().map(({ stops }) => stops[0].distance);
  assert.ok(stopDistances.length > 1);
  assert.deepEqual(stopDistances, [...stopDistances].sort((a, b) => a - b));
  const stop = page.rows()[0].stops[0];
  page.renderFirstRow().props.onOpen(stop);
  assert.deepEqual(page.routes[1], { pathname: '/bus/nearby/stop', params: {
    source: stop.source, stopId: stop.stop_id, distance: String(stop.distance),
  } });
  assert.equal(page.queries.length, 1);
  assert.equal(page.requests.length, 1);

  page.press(labels.radius(labels.metres(500)));
  await page.settle();
  page.press(labels.kilometres(1));
  await page.settle();
  page.focus(false);
  page.focus(true);
  await page.settle();
  assert.equal(page.requests.length, 2);
  assert.equal(page.rows().length, 0);
  page.fix(1, landmarks.shaTin);
  await page.settle();
  assert.ok(page.shows(labels.radius(labels.kilometres(1))));
  assert.ok(page.rows().length > 0 && page.rows().every((row) => 'stops' in row));
  const [from, to] = page.queries.at(-1);
  assert.ok(Math.abs((from + to) / 2 - landmarks.shaTin.latitude) < 1e-9);
});

test('a manual landmark wins over a late GPS fix and remains selected until explicit GPS succeeds', async (t) => {
  const page = mount(t);
  const { labels, landmarks } = page;
  await page.settle();
  page.press(labels.chooseLandmark);
  await page.settle();
  page.press(labels.landmarks.central);
  await page.settle();
  page.fix(0, landmarks.shaTin);
  await page.settle();
  assert.ok(page.shows(labels.landmarkReference(labels.landmarks.central)));
  assert.equal(page.queries.length, 1);
  page.focus(false);
  page.focus(true);
  page.appState('background');
  page.appState('active');
  await page.settle();
  assert.equal(page.calls.permission, 1);
  page.press(labels.useLocation);
  await page.settle();
  page.fix(1, landmarks.shaTin);
  await page.settle();
  assert.ok(page.shows(labels.currentLocation));
});

test('blur and background discard late fixes; each genuine resume requests only one fresh position', async (t) => {
  const page = mount(t);
  await page.settle();
  page.focus(false);
  page.appState('background');
  page.appState('active');
  page.fix(0, page.landmarks.central);
  await page.settle();
  assert.equal(page.queries.length, 0);
  assert.equal(page.requests.length, 1);

  page.focus(true);
  await page.settle();
  page.appState('background');
  page.fix(1, page.landmarks.central);
  await page.settle();
  assert.equal(page.queries.length, 0);
  page.appState('active');
  page.appState('inactive');
  page.appState('active');
  page.appState('active');
  await page.settle();
  assert.equal(page.requests.length, 3);
  page.fix(2, page.landmarks.shaTin);
  await page.settle();
  assert.ok(page.shows(page.labels.currentLocation));
  assert.equal(page.queries.length, 1);
});

test('ungranted access never prompts automatically; explicit permission and a later retry work', async (t) => {
  const page = mount(t, { permission: promptable, locale: 'en' });
  const { labels } = page;
  await page.settle();
  assert.equal(page.calls.prompt, 0);
  assert.equal(page.requests.length, 0);
  assert.ok(page.shows(labels.issues.denied));
  page.answerPrompt(promptable);
  page.press(labels.useLocation);
  await page.settle();
  assert.equal(page.calls.prompt, 1);
  assert.ok(page.shows(labels.issues.denied));
  page.focus(false);
  page.focus(true);
  await page.settle();
  assert.equal(page.calls.prompt, 1);
  let allow;
  page.answerPrompt(new Promise((resolve) => { allow = resolve; }));
  page.press(labels.useLocation);
  await page.settle();
  assert.equal(page.calls.prompt, 2);
  page.appState('inactive');
  page.appState('active');
  page.locateButton().props.onPress();
  await page.settle();
  assert.equal(page.calls.prompt, 2);
  assert.equal(page.requests.length, 0);
  assert.ok(page.shows('Finding nearby buses…'));
  allow(granted);
  await page.settle();
  page.fix(0, page.landmarks.central);
  await page.settle();
  assert.ok(page.shows(labels.currentLocation));
});

test('blocked permission leaves landmark available and a later mount requests fresh GPS when authorized', async (t) => {
  const page = mount(t, { permission: blocked });
  await page.settle();
  assert.ok(page.shows(page.labels.issues.blocked));
  page.press(page.labels.useLocation);
  await page.settle();
  assert.equal(page.calls.prompt, 0);
  page.press(page.labels.chooseLandmark);
  await page.settle();
  page.press(page.labels.landmarks.central);
  await page.settle();
  assert.ok(page.rows().length > 0);
  page.unmount();
  const reopened = mount(t);
  await reopened.settle();
  assert.equal(reopened.requests.length, 1);
  assert.equal(reopened.calls.prompt, 0);
});

test('disabled services, failed and imprecise fixes are recoverable; a failed refresh hides the old GPS point', async (t) => {
  const page = mount(t, { servicesEnabled: false, appState: 'background', locale: 'en' });
  await page.settle();
  assert.equal(page.calls.services, 0);
  page.appState('active');
  await page.settle();
  assert.ok(page.shows(page.labels.issues.unavailable));
  assert.equal(page.calls.permission, 0);
  page.changeServices(true);
  page.press(page.labels.useLocation);
  await page.settle();
  page.fix(0, page.landmarks.central, 200);
  await page.settle();
  assert.ok(page.shows(page.labels.issues.imprecise));
  page.press(page.labels.useLocation);
  await page.settle();
  page.fix(1, page.landmarks.central);
  await page.settle();
  assert.ok(page.rows().length > 0);

  page.appState('background');
  page.appState('active');
  await page.settle();
  page.requests[2].reject(new Error('native location error'));
  await page.settle();
  assert.ok(page.shows(page.labels.issues.unavailable));
  assert.ok(page.shows(page.labels.noReference));
  assert.equal(page.rows().length, 0);
  assert.equal(page.locateButton().props.disabled, false);
  page.changePermission(blocked);
  page.appState('background');
  page.appState('active');
  await page.settle();
  assert.ok(page.shows(page.labels.issues.blocked));
  assert.equal(page.requests.length, 3);
});

test('a hung native fix times out and its late result cannot replace a retry', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const page = mount(t);
  await page.settle();
  assert.equal(page.requests.length, 1);
  t.mock.timers.tick(12_000);
  await page.settle();
  assert.ok(page.shows(page.labels.issues.timeout));
  page.press(page.labels.useLocation);
  await page.settle();
  page.fix(0, page.landmarks.central);
  await page.settle();
  assert.equal(page.queries.length, 0);
  page.fix(1, page.landmarks.shaTin);
  await page.settle();
  assert.ok(page.shows(page.labels.currentLocation));
  page.focus(false);
  page.focus(true);
  await page.settle();
  assert.equal(page.requests.length, 3);
  page.unmount();
  page.fix(2, page.landmarks.central);
  await page.settle();
  assert.equal(page.queries.length, 1);
});

for (const locale of ['zh-HK', 'en']) {
  test(`transport filters use real bus results and keep the same position and mode (${locale})`, async (t) => {
    const page = mount(t, { transport: true, locale });
    const { labels, landmarks, transportCopy: copy } = page;
    const expected = locale === 'en'
      ? ['All', 'Bus', 'MTR', 'Light Rail', 'Ferry', 'Tram', 'Green Minibus']
      : ['全部', '巴士', '港鐵', '輕鐵', '渡輪', '電車', '專線小巴'];
    assert.deepEqual(Object.values(copy.modes), expected);
    await page.settle();
    assert.ok(!page.shows(locale === 'en' ? 'Find transport services near you' : '查看附近可用的交通服務'));
    assert.equal(copy.searchAll, locale === 'en' ? 'Search transport routes' : '搜尋交通路線');
    assert.equal(copy.searchBuses, locale === 'en' ? 'Search bus routes' : '搜尋巴士路線');
    assert.equal(page.searchInput().placeholder, copy.searchAll);
    page.searchInput().onFocus();
    await page.settle();
    assert.deepEqual(page.routes, []);
    for (const label of expected) {
      const { props } = page.findAction(label);
      assert.equal(props.accessibilityRole, 'tab');
      assert.equal(props.accessibilityState.selected, label === copy.modes.all);
      assert.equal(props.style({ pressed: false })[0].minHeight, 44);
      assert.equal(props.style({ pressed: false })[1].maxWidth, 212);
    }
    page.fix(0, landmarks.central);
    await page.settle();
    const allRoutes = page.rows();
    assert.ok(allRoutes.length > 1);
    assert.equal(page.etaRoutes().length, allRoutes.length);
    page.searchInput().onChangeText('B2');
    await page.settle();
    assert.deepEqual(page.rows().map((route) => route.number), ['B2', 'B2P']);
    assert.equal(page.requests.length, 1);
    assert.equal(page.queries.length, 1);
    page.press(page.busCopy.clearInput);
    await page.settle();
    assert.deepEqual(page.rows(), allRoutes);
    for (const mode of ['ferry', 'tram', 'minibus']) {
      page.press(copy.modes[mode]);
      await page.settle();
      assert.ok(page.findAction(copy.modes[mode]).props.accessibilityState.selected);
      assert.equal(page.unavailableTitle(), copy.unavailable(copy.modes[mode]));
      assert.equal(page.searchInput(), undefined);
      assert.ok(!page.shows(copy.locating) && !page.shows(labels.noReference));
      assert.throws(() => page.findAction(copy.changeReference), /Missing action/);
      assert.deepEqual(page.routes, []);
      assert.deepEqual(page.rows(), []);
      assert.equal(page.etaRoutes().length, 0);
    }
    page.press(copy.modes.bus);
    await page.settle();
    assert.deepEqual(page.rows(), allRoutes);
    assert.equal(page.searchInput().placeholder, copy.searchBuses);
    page.press(labels.byStop);
    await page.settle();
    const { floatingTab, colors } = page.theme;
    const stopTab = page.findAction(labels.byStop).props;
    const routeTab = page.findAction(labels.byRoute).props;
    assert.equal(stopTab.accessibilityState.selected, true);
    assert.equal(stopTab.style({ pressed: false })[1].backgroundColor, floatingTab.selected);
    assert.equal(stopTab.children[0].props.color, colors.primary);
    assert.equal(stopTab.children[1].props.tone, 'primary');
    assert.equal(routeTab.children[0].props.color, colors.muted);
    assert.equal(routeTab.children[1].props.tone, 'muted');
    const allStops = page.rows();
    assert.ok(allStops.length > 1 && allStops.every((row) => 'stops' in row));
    page.press(copy.modes.ferry);
    await page.settle();
    page.press(copy.modes.all);
    await page.settle();
    assert.deepEqual(page.rows(), allStops);
    assert.equal(page.searchInput().placeholder, copy.searchAll);
    assert.ok(!page.shows(labels.distanceNote));
    assert.ok(!page.shows(labels.currentLocation));
    assert.ok(!page.locateButton());
    assert.equal(page.requests.length, 1);
    assert.equal(page.queries.length, 1);
  });

  test(`transport puts search first and discloses distance and location controls on demand (${locale})`, async (t) => {
    const page = mount(t, { transport: true, locale });
    const { labels, landmarks, transportCopy: copy } = page;
    await page.settle();

    const list = page.list();
    assert.equal(list.type, 'FlatList');
    assert.equal(list.props.contentInsetAdjustmentBehavior, 'never');
    assert.ok(list.props.contentContainerStyle.at(-1).paddingBottom > 0);
    assert.equal(list.props.automaticallyAdjustKeyboardInsets, true);
    assert.equal(list.props.keyboardShouldPersistTaps, 'handled');
    const [search, picker] = page.controls();
    const [listMode] = list.props.ListHeaderComponent.props.children.filter(Boolean);
    assert.equal(search.props.label, copy.searchAll);
    assert.equal(picker.type.name, 'TransportModePicker');
    assert.equal(listMode.props.accessibilityRole, 'tablist');
    assert.equal(listMode.props.style[1].backgroundColor, page.theme.floatingTab.background);
    assert.ok(!page.shows(labels.reference) && !page.shows(labels.currentLocation));
    assert.ok(page.shows(locale === 'en' ? 'Finding nearby transport…' : '正在尋找附近交通…'));
    assert.ok(!page.shows(labels.noRoutes(labels.metres(500))) && !page.locateButton());
    const landmark = page.findAction(copy.chooseLandmark);
    assert.equal(landmark.props.style({ pressed: false })[0][0].minHeight, 44);

    assert.ok(!page.shows(labels.distanceNote) && !page.shows(labels.routeCoverage));
    page.fix(0, landmarks.central);
    await page.settle();
    assert.ok(!page.shows(copy.locating) && !page.locateButton());
    assert.ok(page.rows().length > 0);
    assert.throws(() => page.findAction(copy.chooseLandmark), /Missing action/);
    const changeReference = page.findAction(copy.changeReference);
    assert.equal(changeReference.props.accessibilityState.expanded, false);
    assert.equal(changeReference.props.style({ pressed: false })[0].minHeight, 44);
    page.press(copy.changeReference);
    await page.settle();
    assert.equal(page.findAction(copy.changeReference).props.accessibilityState.expanded, true);
    assert.ok(page.findAction(labels.landmarks.central));
    assert.ok(page.locateButton());
    page.press(copy.changeReference);
    await page.settle();
    assert.ok(!page.locateButton());
    const info = page.findAction(copy.distanceInfo);
    assert.equal(info.props.accessibilityState.expanded, false);
    assert.equal(info.props.style({ pressed: false })[0].minHeight, 44);
    assert.equal(info.props.style({ pressed: false })[0].minWidth, 44);
    page.press(copy.distanceInfo);
    await page.settle();
    assert.equal(page.findAction(copy.distanceInfo).props.accessibilityState.expanded, true);
    assert.ok(page.shows(labels.distanceNote) && page.shows(labels.routeCoverage));

    const range500 = locale === 'en' ? 'Straight-line 500 m' : '直線 500 米';
    const range1000 = locale === 'en' ? 'Straight-line 1 km' : '直線 1 公里';
    page.press(range500);
    await page.settle();
    page.press(labels.kilometres(1));
    await page.settle();
    assert.ok(page.findAction(range1000));
    assert.ok(!page.shows(range500));
    assert.equal(page.queries.length, 2);
    assert.equal(page.requests.length, 1);
    page.press(labels.byStop);
    await page.settle();
    assert.ok(page.shows(labels.distanceNote) && page.shows(labels.partialCoverage));
    assert.ok(!page.shows(labels.routeCoverage));
    page.press(copy.distanceInfo);
    await page.settle();
    assert.ok(!page.shows(labels.distanceNote) && !page.shows(labels.partialCoverage));
    page.press(copy.distanceInfo);
    await page.settle();
    page.press(copy.modes.mtr);
    await page.settle();
    assert.ok(!page.shows(range1000) && !page.shows(labels.distanceNote) && !page.shows(labels.partialCoverage));
    assert.throws(() => page.findAction(copy.distanceInfo), /Missing action/);
    page.press(copy.modes.all);
    await page.settle();
    page.press(copy.changeReference);
    await page.settle();
    page.press(labels.landmarks.shaTin);
    await page.settle();
    assert.ok(page.shows(labels.landmarkReference(labels.landmarks.shaTin)));
    assert.equal(page.findAction(copy.changeReference).props.accessibilityState.expanded, false);
    assert.equal(page.requests.length, 1);
  });
}

for (const locale of ['zh-HK', 'en']) {
  test(`home intent opens Bus and offers inline search and boarding-stop guidance (${locale})`, async (t) => {
    const page = mount(t, { transport: true, locale, intent: 'add-frequent-route', permission: promptable });
    const { transportCopy: copy } = page;
    await page.settle();
    assert.equal(page.searchInput().placeholder, copy.searchBuses);
    assert.equal(page.searchInput().autoFocus, true);
    assert.ok(page.findAction(copy.modes.bus).props.accessibilityState.selected);
    assert.ok(page.shows(locale === 'en' ? 'Search for a route and choose a boarding stop to save it.' : '搜尋路線並選擇上車站，即可加入常用。'));
    assert.equal(page.catalogueReads(), 0);
    assert.equal(page.calls.prompt, 0);
    assert.deepEqual(page.routes, []);
  });
}

test('inline search reuses catalogue identities, ranks results, and restores the nearby state after clear or cancel', async (t) => {
  const page = mount(t, { transport: true, delayCatalogue: true });
  const { labels, transportCopy: copy, busCopy: bus, catalogueRoutes } = page;
  await page.settle();
  assert.ok(!page.shows(copy.addFrequentHint));
  assert.equal(page.searchInput().autoFocus, false);
  page.press(copy.chooseLandmark);
  await page.settle();
  page.press(labels.landmarks.central);
  await page.settle();
  page.press(labels.byStop);
  await page.settle();
  page.press(copy.straightLineRadius(labels.metres(500)));
  await page.settle();
  page.press(labels.kilometres(1));
  await page.settle();
  const nearby = page.rows();
  assert.ok(nearby.length > 1 && nearby.every((row) => 'stops' in row));
  assert.equal(page.catalogueReads(), 0);
  const gpsRequests = page.requests.length;

  page.searchInput().onChangeText('B2');
  await page.settle();
  assert.ok(page.shows(bus.loading));
  assert.deepEqual(page.rows(), []);
  page.searchInput().onChangeText('2');
  page.searchInput().onChangeText('268X');
  await page.settle();
  assert.equal(page.catalogueReads(), 1);
  page.press(copy.modes.mtr);
  await page.settle();
  page.finishCatalogue();
  await page.settle();
  assert.equal(page.searchInput().placeholder, page.mtrCopy.search);
  assert.equal(page.searchInput().value, '268X');
  assert.deepEqual(page.rows(), []);
  assert.equal(page.unavailableTitle(), page.mtrCopy.noMatches);
  page.press(copy.modes.bus);
  await page.settle();
  assert.equal(page.searchInput().value, '268X');
  assert.equal(page.searchInput().placeholder, copy.searchBuses);
  assert.deepEqual(page.rows(), catalogueRoutes.kmbLwb);
  assert.deepEqual(page.rows().map((route) => route.serviceType), ['1', '3']);
  assert.ok(page.shows(copy.busResults));
  assert.deepEqual(page.etaRoutes(), []);

  page.press(copy.modes.all);
  await page.settle();
  page.searchInput().onChangeText(' ｂ２ ');
  await page.settle();
  assert.deepEqual(page.rows().map((route) => route.number), ['B2', 'B2P']);
  const row = page.renderFirstRow();
  assert.equal(row.type.name, 'BusRouteRow');
  const searchList = page.list().key;
  const searchScrolls = page.attachList();
  page.showRows([1], 120);
  row.props.onPress();
  assert.deepEqual(page.routes, [{ pathname: '/bus/route', params: { routeId: catalogueRoutes.nlb[0].id } }]);
  assert.ok(page.dismissals() > 0);
  page.focus(false);
  page.focus(true);
  await page.settle();
  assert.equal(page.searchInput().value, ' ｂ２ ');
  assert.deepEqual(page.rows().map((route) => route.number), ['B2', 'B2P']);
  assert.equal(page.list().key, searchList);
  page.paint();
  assert.deepEqual(searchScrolls, []);

  for (const query of ['north point ferry pier', '北角碼頭']) {
    page.searchInput().onChangeText(query);
    await page.settle();
    assert.deepEqual(page.rows(), catalogueRoutes.citybus);
  }
  page.searchInput().onChangeText('invalid route query');
  await page.settle();
  assert.ok(page.shows(copy.noMatches));
  page.press(copy.modes.bus);
  await page.settle();
  assert.ok(page.shows(bus.noResults));
  page.press(copy.modes.all);
  await page.settle();
  assert.deepEqual(page.rows(), []);
  assert.ok(searchScrolls.some(({ method, offset }) => method === 'offset' && offset === 0));
  page.press(bus.clearInput);
  await page.settle();
  assert.equal(page.searchInput().value, '');
  assert.notEqual(page.list().key, searchList);
  assert.deepEqual(page.rows(), nearby);
  assert.ok(page.findAction(labels.byStop).props.accessibilityState.selected);
  assert.ok(page.findAction(copy.straightLineRadius(labels.kilometres(1))));
  page.searchInput().onChangeText('26');
  await page.settle();
  const beforeCancel = page.dismissals();
  page.press(bus.cancel);
  await page.settle();
  assert.equal(page.dismissals(), beforeCancel + 1);
  assert.equal(page.searchInput().value, '');
  assert.deepEqual(page.rows(), nearby);
  assert.equal(page.catalogueReads(), 1);
  assert.equal(page.requests.length, gpsRequests);
  assert.equal(page.calls.prompt, 0);
});

test('transport keeps search available before permission and offers Settings when permission is blocked', async (t) => {
  const page = mount(t, { transport: true, permission: promptable, locale: 'en' });
  const { labels, transportCopy: copy } = page;
  await page.settle();
  assert.equal(page.calls.prompt, 0);
  assert.equal(page.requests.length, 0);
  assert.ok(page.shows(labels.issues.denied));
  page.searchInput().onFocus();
  await page.settle();
  assert.deepEqual(page.routes, []);
  page.answerPrompt(blocked);
  page.press(labels.useLocation);
  await page.settle();
  assert.equal(page.calls.prompt, 1);
  assert.ok(page.shows(labels.issues.denied));
  page.focus(false);
  page.focus(true);
  await page.settle();
  assert.equal(page.requests.length, 0);
  assert.ok(!page.locateButton());
  assert.ok(page.shows(labels.issues.blocked));
  page.press(copy.openSettings);
  assert.equal(page.settings.length, 1);
  page.settings[0].reject(new Error('Settings unavailable'));
  await page.settle();
  assert.deepEqual(page.alerts, [copy.settingsUnavailable]);
  page.press(copy.chooseLandmark);
  await page.settle();
  page.press(labels.landmarks.central);
  await page.settle();
  assert.ok(page.shows(labels.landmarkReference(labels.landmarks.central)));
  assert.ok(page.rows().length > 0);
  assert.equal(page.calls.prompt, 1);
});

test('transport recovers from disabled services and failed GPS without showing stale nearby results', async (t) => {
  const page = mount(t, { transport: true, servicesEnabled: false });
  const { labels, landmarks, transportCopy: copy } = page;
  await page.settle();
  assert.ok(page.shows(labels.issues.unavailable));
  assert.ok(page.findAction(copy.chooseLandmark));
  assert.equal(page.calls.prompt, 0);
  page.changeServices(true);
  page.press(labels.useLocation);
  await page.settle();
  assert.ok(page.shows(copy.locating));
  page.fix(0, landmarks.central);
  await page.settle();
  assert.ok(page.rows().length > 0);
  assert.ok(!page.locateButton());

  page.focus(false);
  page.focus(true);
  await page.settle();
  assert.equal(page.requests.length, 2);
  assert.ok(!page.shows(copy.locating));
  assert.ok(page.rows().length > 0, 'The previous nearby data stays visible during passive GPS refresh');
  assert.ok(!page.shows(labels.noRoutes(labels.metres(500))));
  page.requests[1].reject(new Error('Native location failed'));
  await page.settle();
  assert.ok(page.shows(labels.issues.unavailable));
  assert.ok(!page.shows(copy.locating));
  assert.equal(page.rows().length, 0);
  assert.ok(page.locateButton());

  page.appState('background');
  page.appState('active');
  await page.settle();
  assert.equal(page.requests.length, 3);
  page.fix(2, landmarks.shaTin);
  await page.settle();
  assert.ok(page.rows().length > 0);
  assert.ok(!page.shows(labels.issues.unavailable) && !page.locateButton());
});

for (const mode of ['routes', 'stops']) {
  test(`transport ${mode} detail preserves the mounted list across refocus, GPS and ETA updates`, async (t) => {
    const page = mount(t, { transport: true, locale: mode === 'routes' ? 'zh-HK' : 'en' });
    const { landmarks, transportCopy: copy, labels } = page;
    await page.settle();
    page.fix(0, landmarks.central);
    await page.settle();
    page.press(copy.modes.bus);
    await page.settle();
    if (mode === 'stops') {
      page.press(labels.byStop);
      await page.settle();
    }
    page.press(copy.straightLineRadius(labels.metres(500)));
    await page.settle();
    page.press(labels.kilometres(1));
    await page.settle();

    const rows = page.rows();
    const listKey = page.list().key;
    const scrolls = page.attachList();
    page.showRows([13, 14, 15], 1500);
    const card = page.renderRow(14);
    if (mode === 'routes') {
      card.props.onPress();
      assert.equal(page.routes.at(-1).pathname, '/bus/route');
      assert.equal(page.routes.at(-1).params.stopId, rows[14].route.target.stopId);
    } else {
      card.props.onOpen(rows[14].stops[0]);
      assert.equal(page.routes.at(-1).pathname, '/bus/nearby/stop');
      assert.equal(page.routes.at(-1).params.stopId, rows[14].stops[0].stop_id);
    }
    page.focus(false);
    page.focus(true);
    await page.settle();
    assert.equal(page.requests.length, 2);
    assert.equal(page.list().key, listKey);
    assert.equal(page.rows(), rows);
    assert.ok(!page.shows(copy.locating));
    page.tickEta();
    await page.settle();
    assert.equal(page.list().key, listKey);
    assert.equal(page.rows(), rows);
    page.fix(1, landmarks.central);
    await page.settle();
    page.paint();
    assert.equal(page.list().key, listKey);
    assert.deepEqual(page.rows(), rows);
    assert.deepEqual(scrolls, []);
    assert.ok(page.findAction(copy.modes.bus).props.accessibilityState.selected);
    assert.ok(page.findAction(mode === 'routes' ? labels.byRoute : labels.byStop).props.accessibilityState.selected);
    assert.ok(page.findAction(copy.straightLineRadius(labels.kilometres(1))));
    page.press(mode === 'routes' ? labels.byStop : labels.byRoute);
    await page.settle();
    assert.notEqual(page.list().key, listKey, 'An explicit display-mode change uses a new list scope');
  });
}

test('a changed GPS ranking keeps a visible station nearby with one layout fallback', async (t) => {
  const page = mount(t, { transport: true });
  const { landmarks, labels, transportCopy: copy } = page;
  await page.settle();
  page.fix(0, landmarks.central);
  await page.settle();
  page.press(labels.byStop);
  await page.settle();
  page.press(copy.straightLineRadius(labels.metres(500)));
  await page.settle();
  page.press(labels.kilometres(1));
  await page.settle();
  const listKey = page.list().key;
  const scrolls = page.attachList({ failIndex: true });
  const originalVisible = page.rows().slice(12, 15);
  page.showRows([12, 13, 14], 1400);
  page.focus(false);
  page.focus(true);
  await page.settle();
  page.fix(1, { latitude: landmarks.central.latitude + 0.00035, longitude: landmarks.central.longitude + 0.00055 });
  await page.settle();
  const ids = page.rows().map(({ id }) => id);
  const surviving = originalVisible.find(({ id }) => ids.includes(id));
  assert.ok(surviving, 'A station in the original viewport still exists at the nearby position');
  const index = ids.indexOf(surviving.id);
  assert.notEqual(index, 12);
  assert.equal(page.list().key, listKey);
  assert.deepEqual(scrolls, []);
  page.paint();
  page.paint();
  assert.deepEqual(scrolls, [
    { method: 'index', index, animated: false },
    { method: 'offset', offset: Math.max(0, 1400 + (index - 12) * 100), animated: false },
  ]);
});

test('a vanished station falls back within the new list, and a fresh drag cancels the next correction', async (t) => {
  const page = mount(t, { transport: true });
  const { landmarks, labels } = page;
  await page.settle();
  page.fix(0, landmarks.central);
  await page.settle();
  page.press(labels.byStop);
  await page.settle();
  const scrolls = page.attachList();
  const oldId = page.rows()[12].id;
  page.showRows([12], 1400);
  page.focus(false);
  page.focus(true);
  await page.settle();
  page.fix(1, landmarks.shaTin);
  await page.settle();
  assert.ok(!page.rows().some(({ id }) => id === oldId));
  const index = Math.min(12, page.rows().length - 1);
  page.paint();
  assert.deepEqual(scrolls, [{ method: 'index', index, animated: false }]);

  page.showRows([index], 1400);
  page.appState('background');
  page.appState('active');
  await page.settle();
  page.fix(2, landmarks.central);
  await page.settle();
  page.list().props.onScrollBeginDrag();
  page.showRows([4], 450);
  page.list().props.onScrollEndDrag();
  page.paint();
  assert.equal(scrolls.length, 1, 'The queued correction does not override a new drag');
});

test('horizontal transport overflow has a usable next-page and return-to-start control', async (t) => {
  const page = mount(t, { transport: true, locale: 'en' });
  await page.settle();
  const scroll = page.modeScroller();
  assert.equal(scroll.horizontal, true);
  const calls = [];
  scroll.ref.current = { scrollTo: (options) => calls.push(options) };
  scroll.onLayout({ nativeEvent: { layout: { width: 280 } } });
  scroll.onContentSizeChange(650);
  await page.settle();
  const more = page.findAction(page.transportCopy.moreModes);
  assert.equal(more.props.style({ pressed: false })[0].minHeight, 44);
  assert.equal(more.props.style({ pressed: false })[0].minWidth, 44);
  scroll.onLayout({ nativeEvent: { layout: { width: 232 } } });
  page.press(page.transportCopy.moreModes);
  assert.deepEqual(calls, [{ x: 212, animated: true }]);
  scroll.onScroll({ nativeEvent: { contentOffset: { x: 418 } } });
  await page.settle();
  page.press(page.transportCopy.firstModes);
  assert.deepEqual(calls.at(-1), { x: 0, animated: true });
  assert.equal(page.requests.length, 1);
  assert.deepEqual(page.routes, []);
});

test('a transport filter change does not let a pending GPS fix replace a selected landmark', async (t) => {
  const page = mount(t, { transport: true });
  const { labels, landmarks, transportCopy: copy } = page;
  await page.settle();
  page.press(copy.modes.bus);
  await page.settle();
  page.press(copy.chooseLandmark);
  await page.settle();
  page.press(labels.landmarks.central);
  await page.settle();
  page.press(copy.modes.mtr);
  await page.settle();
  page.fix(0, landmarks.shaTin);
  page.press(copy.modes.all);
  await page.settle();
  assert.ok(page.shows(labels.landmarkReference(labels.landmarks.central)));
  assert.equal(page.requests.length, 1);
  assert.equal(page.queries.length, 1);
});

test('MTR snapshot preserves each official line/station identity and every ordered visit', (t) => {
  const page = mount(t);
  const { mtrLines, mtrStations, findMtrLine, findMtrStation, searchMtr, mtrSource } = page.mtr();
  assert.equal(mtrSource.csvSha256, 'e0e781152e2e6c5f6d7763262acbae76577b71ca4c66b4b7b72a97252175e0c3');
  assert.deepEqual(mtrLines.map(({ id }) => id).sort(), ['AEL', 'DRL', 'EAL', 'ISL', 'KTL', 'SIL', 'TCL', 'TKL', 'TML', 'TWL']);
  assert.equal(mtrStations.length, 98);
  assert.equal(new Set(mtrStations.map(({ id }) => id)).size, mtrStations.length);

  let patternCount = 0;
  let visitCount = 0;
  const memberships = new Set();
  for (const { id, patterns } of mtrLines) {
    for (const { stations } of patterns) {
      assert.equal(new Set(stations).size, stations.length);
      patternCount++;
      visitCount += stations.length;
      for (const code of stations) {
        const station = findMtrStation(code);
        assert.ok(station.zh && station.en);
        assert.ok(station.memberships.some(({ lineCode }) => lineCode === id));
        memberships.add(`${id}:${code}`);
      }
    }
  }
  assert.equal(patternCount, 24);
  assert.equal(visitCount, 270);
  assert.equal(memberships.size, 120);
  const officialIds = new Set();
  for (const station of mtrStations.filter(({ supplemental }) => !supplemental)) {
    for (const { lineCode, stationId } of station.memberships) {
      assert.ok(findMtrLine(lineCode) && Number.isInteger(stationId));
      assert.ok(memberships.has(`${lineCode}:${station.id}`));
      officialIds.add(stationId);
    }
  }
  assert.equal(officialIds.size, 100);

  for (const [code, ael, tcl] of [['HOK', 44, 39], ['KOW', 45, 40], ['TSY', 46, 42]]) {
    const matches = searchMtr(code);
    assert.equal(matches[0], findMtrStation(code));
    assert.equal(matches.filter(({ id }) => id === code).length, 1);
    assert.deepEqual(findMtrStation(code).memberships, [{ lineCode: 'AEL', stationId: ael }, { lineCode: 'TCL', stationId: tcl }]);
  }
  assert.deepEqual(findMtrStation('ADM').memberships.map(({ lineCode }) => lineCode), ['EAL', 'ISL', 'SIL', 'TWL']);
  assert.notEqual(findMtrStation('CEN'), findMtrStation('HOK'));
  assert.notEqual(findMtrStation('TST'), findMtrStation('ETS'));

  const racecourse = findMtrStation('RAC');
  assert.equal(racecourse.supplemental, true);
  assert.deepEqual(racecourse.memberships, [{ lineCode: 'EAL', stationId: null }]);
  const eal = findMtrLine('EAL');
  assert.deepEqual(eal.patterns.map(({ stations }) => [stations[0], stations.at(-1)]),
    [['ADM', 'LOW'], ['LOW', 'ADM'], ['ADM', 'LMC'], ['LMC', 'ADM']]);
  assert.ok(eal.patterns.every(({ stations }) => !stations.includes('RAC')));
  assert.deepEqual(findMtrLine('TKL').patterns.find(({ direction }) => direction === 'TKS-UT').stations,
    ['TIK', 'TKO', 'LHP']);
  assert.equal(searchMtr('  tUnG  cHuNg LiNe  ')[0].id, 'TCL');
  assert.equal(searchMtr('東涌線')[0].id, 'TCL');
  assert.equal(searchMtr('ＡＤＭ')[0].id, 'ADM');
  assert.equal(searchMtr('金鐘')[0].id, 'ADM');
  assert.equal(searchMtr('racecourt').length, 0);
  assert.equal(searchMtr('Racecourse')[0], racecourse);
});

for (const locale of ['zh-HK', 'en']) {
  test(`MTR directory and bilingual search work offline and stay mounted on return (${locale})`, async (t) => {
    const page = mount(t, { transport: true, permission: blocked, locale });
    const { transportCopy: copy, mtrCopy, labels } = page;
    await page.settle();
    page.press(copy.modes.mtr);
    await page.settle();
    assert.ok(page.shows(mtrCopy.lines));
    assert.equal(page.searchInput().placeholder, mtrCopy.search);
    assert.equal(page.rows().length, 10);
    assert.ok(page.rows().every(({ kind }) => kind === 'mtr-line'));
    assert.throws(() => page.findAction(copy.distanceInfo), /Missing action/);

    page.press(labels.byStop);
    await page.settle();
    assert.ok(page.shows(mtrCopy.stations));
    assert.equal(page.rows().length, 98);
    assert.ok(page.rows().every(({ kind }) => kind === 'mtr-station'));
    page.searchInput().onChangeText(locale === 'en' ? 'lInE' : '綫');
    await page.settle();
    assert.ok(page.shows(mtrCopy.results));
    assert.ok(page.rows().length > 2);
    const before = page.rows();
    const query = page.searchInput().value;
    const stableList = page.list().key;
    const scrolls = page.attachList();
    page.showRows([2], 140);
    page.openResult(2);
    assert.deepEqual(page.routes, [{ pathname: '/mtr/[kind]', params: { kind: 'line', code: before[2].id } }]);
    page.focus(false);
    page.focus(true);
    await page.settle();
    page.paint();
    assert.equal(page.rows(), before);
    assert.equal(page.searchInput().value, query);
    assert.equal(page.list().key, stableList);
    assert.deepEqual(scrolls, []);

    page.searchInput().onChangeText(locale === 'en' ? 'aDmIrAlTy' : '金鐘');
    await page.settle();
    assert.deepEqual(page.rows().map(({ id, kind }) => [id, kind]), [['ADM', 'mtr-station']]);
    page.openResult(0);
    assert.deepEqual(page.routes.at(-1), { pathname: '/mtr/[kind]', params: { kind: 'station', code: 'ADM' } });
    page.press(page.busCopy.clearInput);
    await page.settle();
    assert.ok(page.shows(mtrCopy.stations));
    assert.equal(page.rows().length, 98);
    assert.equal(page.catalogueReads(), 0);
    assert.equal(page.calls.prompt, 0);
    assert.equal(page.requests.length, 0);
    assert.equal(page.queries.length, 0);
    assert.deepEqual(page.etaRoutes(), []);
  });
}

test('MTR detail shows separate official branch orders and a supplemental Racecourse station', async (t) => {
  const page = mount(t, { mtrDetail: { kind: 'line', code: 'EAL' } });
  await page.settle();
  assert.ok(page.shows('東鐵綫'));
  assert.equal(page.mtrForecastProps(), undefined);
  assert.equal(page.directionFilters().options.length, 4);
  const orderedStops = () => page.detailRows().filter(({ sequence }) => sequence !== undefined);
  assert.deepEqual(orderedStops().map(({ sequence }) => sequence), Array.from({ length: 14 }, (_, i) => i + 1));
  assert.equal(orderedStops()[0].entry.id, 'ADM');
  assert.equal(orderedStops().at(-1).entry.id, 'LOW');
  page.directionFilters().onSelect('LMC-UT');
  await page.settle();
  assert.equal(page.directionFilters().selected, 'LMC-UT');
  assert.equal(orderedStops().at(-1).entry.id, 'LMC');
  assert.ok(page.shows(page.mtrCopy.racecourse));
  assert.equal(page.detailRows().find(({ entry }) => entry.id === 'RAC').sequence, undefined);
  page.press('馬場');
  assert.deepEqual(page.routes, [{ pathname: '/mtr/[kind]', params: { kind: 'station', code: 'RAC', line: 'EAL' } }]);

  const station = mount(t, { locale: 'en', mtrDetail: { kind: 'station', code: 'HOK' } });
  await station.settle();
  assert.ok(station.shows('Hong Kong') && station.shows('香港'));
  assert.equal(station.mtrForecastProps().station.id, 'HOK');
  assert.equal(station.mtrForecastProps().initialLine, undefined);
  assert.ok(station.shows(station.mtrCopy.attribution) && station.shows(station.mtrCopy.disclaimer));
  assert.deepEqual(station.openedLinks, []);
  station.press(station.mtrCopy.dataset);
  assert.deepEqual(station.openedLinks, [page.mtr().mtrSource.resource]);
  assert.deepEqual(station.detailRows().map(({ entry }) => entry.id), ['AEL', 'TCL']);
  station.press('Airport Express');
  assert.deepEqual(station.routes, [{ pathname: '/mtr/[kind]', params: { kind: 'line', code: 'AEL' } }]);

  const invalid = mount(t, { mtrDetail: { kind: 'station', code: ['HOK', 'KOW'] } });
  await invalid.settle();
  assert.ok(invalid.shows(invalid.mtrCopy.unavailable));
  assert.deepEqual(invalid.detailRows(), []);
});

for (const locale of ['zh-HK', 'en']) {
  test(`MTR Admiralty details put the forecast before all four linked lines (${locale})`, async (t) => {
    const station = mount(t, { locale, mtrDetail: { kind: 'station', code: 'ADM', line: 'ISL' } });
    await station.settle();
    const elements = station.visibleElements();
    const [title, description] = locale === 'en' ? ['Admiralty', '金鐘'] : ['金鐘', 'Admiralty'];
    const headingIndex = elements.findIndex(({ props }) => props.title === title && props.description === description);
    const forecastIndex = elements.findIndex(({ type }) => type.name === 'MtrNextTrains');
    const linesIndex = elements.findIndex(({ props }) => props.children === station.mtrCopy.lines);
    const sourcesIndex = elements.findIndex(({ props }) => props.children === station.mtrCopy.source);
    assert.ok(headingIndex >= 0 && headingIndex < forecastIndex && forecastIndex < linesIndex && linesIndex < sourcesIndex);
    assert.equal(station.mtrForecastProps().station.id, 'ADM');
    assert.equal(station.mtrForecastProps().initialLine, 'ISL');

    const rows = station.detailRows();
    assert.deepEqual(rows.map(({ entry }) => entry.id), ['EAL', 'ISL', 'SIL', 'TWL']);
    for (const { entry } of rows) {
      station.press(station.mtr().mtrName(entry, locale));
      assert.deepEqual(station.routes.at(-1), { pathname: '/mtr/[kind]', params: { kind: 'line', code: entry.id } });
    }
  });
}

test('All search separates Bus, MTR and Light Rail identities and restores nearby buses after clearing', async (t) => {
  const page = mount(t, { transport: true, locale: 'en', delayCatalogue: true });
  await page.settle();
  page.fix(0, page.landmarks.central);
  await page.settle();
  const nearby = page.rows();
  assert.ok(nearby.length > 0 && nearby.every((row) => 'route' in row));
  page.searchInput().onChangeText('Yuen Long');
  await page.settle();
  assert.ok(page.shows(page.busCopy.loading));
  assert.deepEqual(page.rows().map(({ kind, id }) => [kind, id]), [['mtr-station', 'YUL'], ['light-rail-stop', '600']]);
  page.finishCatalogue();
  await page.settle();
  const busRow = page.rows().findIndex(({ number }) => number === 'B2');
  const mtrRow = page.rows().findIndex(({ id }) => id === 'YUL');
  const lightRailRow = page.rows().findIndex(({ kind, id }) => kind === 'light-rail-stop' && id === '600');
  assert.ok(busRow >= 0 && mtrRow > busRow && lightRailRow > mtrRow);
  assert.equal(page.renderRow(busRow).props.modeLabel, page.transportCopy.modes.bus);
  assert.equal(page.list().props.keyExtractor(page.rows()[mtrRow]), 'mtr-station:YUL');
  page.openResult(mtrRow);
  assert.deepEqual(page.routes.at(-1), { pathname: '/mtr/[kind]', params: { kind: 'station', code: 'YUL' } });
  assert.equal(page.list().props.keyExtractor(page.rows()[lightRailRow]), 'light-rail-stop:600');
  page.openResult(lightRailRow);
  assert.deepEqual(page.routes.at(-1), { pathname: '/light-rail/[kind]', params: { kind: 'stop', id: '600' } });
  page.press(page.busCopy.clearInput);
  await page.settle();
  assert.deepEqual(page.rows(), nearby);
  assert.equal(page.requests.length, 1);
  assert.equal(page.catalogueReads(), 1);
});

test('All search keeps both offline rail sources if the bus catalogue fails', async (t) => {
  const page = mount(t, { transport: true, locale: 'en', permission: blocked, offlineCatalogue: true });
  await page.settle();
  page.searchInput().onChangeText('Tung Chung Line');
  await page.settle();
  assert.ok(page.shows(page.busCopy.loadFailed));
  assert.deepEqual(page.rows().map(({ kind, id }) => [kind, id]), [['mtr-line', 'TCL']]);
  page.searchInput().onChangeText('Yuen Long');
  await page.settle();
  assert.deepEqual(page.rows().map(({ kind, id }) => [kind, id]), [['mtr-station', 'YUL'], ['light-rail-stop', '600']]);
  page.searchInput().onChangeText('unknown station or route');
  await page.settle();
  assert.ok(page.shows(page.busCopy.loadFailed));
  assert.ok(page.shows(page.transportCopy.noRailMatches));
  assert.ok(!page.shows(page.transportCopy.noMatches));
  assert.equal(page.catalogueReads(), 1);
});

test('Light Rail snapshot keeps official identities, asymmetric directions, loops and every repeat visit', (t) => {
  const page = mount(t);
  const { lightRailRoutes, lightRailStops, findLightRailRoute, findLightRailStop, searchLightRail, lightRailSource } = page.lightRail();
  assert.equal(lightRailSource.csvSha256, 'f2fec60de38b72f38d3478fcdeecea4e3332b300b73c23bf41b22d412a2c2066');
  assert.deepEqual(lightRailRoutes.map(({ id }) => id), ['505', '507', '610', '614', '614P', '615', '615P', '705', '706', '751', '761P']);
  assert.equal(lightRailStops.length, 68);
  assert.equal(new Set(lightRailStops.map(({ id }) => id)).size, 68);
  assert.equal(new Set(lightRailStops.map(({ code }) => code)).size, 68);
  const memberships = new Map(lightRailStops.map(({ id }) => [id, new Set()]));
  let count = 0;
  for (const route of lightRailRoutes) {
    assert.deepEqual(route.patterns.map(({ direction }) => direction), ['1', '2']);
    for (const { visits } of route.patterns) {
      assert.ok(visits.length > 0);
      visits.forEach(({ stopId, sequence }, i) => {
        assert.equal(sequence, i + 1);
        assert.ok(findLightRailStop(stopId));
        memberships.get(stopId).add(route.id);
        count++;
      });
    }
  }
  assert.equal(count, 382);
  for (const stop of lightRailStops) {
    assert.ok(stop.zh && stop.en);
    assert.deepEqual(stop.routes, [...memberships.get(stop.id)]);
  }
  const hoiWong = findLightRailStop('250');
  assert.deepEqual(hoiWong, {
    kind: 'light-rail-stop', id: '250', code: 'TSP', zh: '海皇路', en: 'Hoi Wong Road', routes: ['507', '614', '614P'],
  });
  for (const term of ['250', ' Ｔｓｐ ', '海皇路', ' hOI  woNG roAd ']) assert.equal(searchLightRail(term)[0], hoiWong);
  assert.deepEqual(searchLightRail('屯門泳池'), []);
  for (const code of ['505', '610', '751']) assert.equal(searchLightRail(code)[0], findLightRailRoute(code));
  const asymmetric = findLightRailRoute('505').patterns;
  assert.deepEqual(asymmetric.map(({ visits }) => [visits[0].stopId, visits.at(-1).stopId, visits.length]),
    [['920', '100', 16], ['100', '920', 14]]);
  assert.deepEqual(lightRailRoutes.filter(({ circular }) => circular).map(({ id }) => id), ['705', '706']);
  for (const [code, expected] of [['705', [5, 12]], ['706', [12, 5]]]) {
    const pair = findLightRailRoute(code).patterns.map(({ visits }) => visits);
    assert.deepEqual(pair.map((visits) => visits.length), expected);
    assert.deepEqual(pair.map((visits) => [visits[0].stopId, visits.at(-1).stopId]),
      [['430', '500'], ['500', '430']]);
  }
  for (const [route, directionIndex, stop] of [['507', 1, '140'], ['751', 0, '550'], ['761P', 1, '550']]) {
    const visits = findLightRailRoute(route).patterns[directionIndex].visits.filter(({ stopId }) => stop === stopId);
    assert.equal(visits.length, 2);
    assert.notEqual(visits[0].sequence, visits[1].sequence);
  }
  for (const special of ['507P', '720', '751P', '610P']) {
    assert.equal(findLightRailRoute(special), undefined);
    assert.deepEqual(searchLightRail(special), []);
  }
});

for (const locale of ['zh-HK', 'en']) {
  test(`Light Rail directory and search stay offline and keep their scope on returning from details (${locale})`, async (t) => {
    const page = mount(t, { transport: true, permission: blocked, locale });
    const { transportCopy: copy, lightRailCopy: rail, labels } = page;
    await page.settle();
    page.press(copy.modes.lightRail);
    await page.settle();
    assert.ok(page.shows(rail.lines));
    assert.equal(page.searchInput().placeholder, rail.search);
    assert.equal(page.rows().length, 11);
    assert.ok(page.rows().every(({ kind }) => kind === 'light-rail-route'));
    assert.throws(() => page.findAction(copy.distanceInfo), /Missing action/);

    page.press(labels.byStop);
    await page.settle();
    assert.ok(page.shows(rail.stations));
    assert.equal(page.rows().length, 68);
    const directoryScope = page.list().key;
    const scrolls = page.attachList();
    const directoryRows = page.rows();
    page.showRows([20], 440);
    page.openResult(20);
    assert.deepEqual(page.routes.at(-1), {
      pathname: '/light-rail/[kind]', params: { kind: 'stop', id: directoryRows[20].id },
    });
    page.focus(false);
    page.focus(true);
    await page.settle();
    page.paint();
    assert.equal(page.list().key, directoryScope);
    assert.equal(page.rows(), directoryRows);
    assert.deepEqual(scrolls, []);

    page.searchInput().onChangeText('６１０');
    await page.settle();
    assert.ok(page.shows(rail.results));
    assert.equal(page.rows()[0].kind, 'light-rail-route');
    assert.equal(page.rows()[0].id, '610');
    page.openResult(0);
    assert.deepEqual(page.routes.at(-1), { pathname: '/light-rail/[kind]', params: { kind: 'route', id: '610' } });
    const searchScope = page.list().key;
    page.focus(false);
    page.focus(true);
    await page.settle();
    assert.equal(page.searchInput().value, '６１０');
    assert.equal(page.list().key, searchScope);
    page.searchInput().onChangeText(locale === 'en' ? 'Hoi WOnG road' : '海皇路');
    await page.settle();
    assert.deepEqual(page.rows().map(({ kind, id }) => [kind, id]), [['light-rail-stop', '250']]);
    page.press(page.busCopy.clearInput);
    await page.settle();
    assert.ok(page.shows(rail.stations));
    assert.equal(page.list().key, directoryScope);
    assert.equal(page.rows(), directoryRows);
    assert.equal(page.catalogueReads(), 0);
    assert.equal(page.requests.length, 0);
    assert.equal(page.queries.length, 0);
    assert.deepEqual(page.etaRoutes(), []);
    page.press(copy.modes.mtr);
    await page.settle();
    assert.ok(page.shows(page.mtrCopy.lines));
  });
}

test('Light Rail details switch official visits, open stable stop IDs and link to official sources', async (t) => {
  const route = mount(t, { lightRailDetail: { kind: 'route', id: '761P' } });
  await route.settle();
  assert.ok(route.shows(route.lightRailCopy.route('761P')));
  assert.equal(route.lightRailForecastProps(), undefined);
  assert.ok(route.shows(`離線路線資料更新日期 ${route.lightRail().lightRailSource.resourceUpdatedOn}`));
  assert.deepEqual(route.directionFilters().options, [['1', '天逸 → 元朗'], ['2', '元朗 → 天逸']]);
  route.directionFilters().onSelect('2');
  await route.settle();
  const visits = route.detailRows();
  assert.equal(visits.length, 15);
  assert.deepEqual(visits.slice(-2).map(({ entry, sequence }) => [entry.id, sequence]), [['550', 14], ['550', 15]]);
  route.press('天逸');
  assert.deepEqual(route.routes, [{ pathname: '/light-rail/[kind]', params: { kind: 'stop', id: '550' } }]);

  const circular = mount(t, { lightRailDetail: { kind: 'route', id: '705' }, locale: 'en' });
  await circular.settle();
  assert.ok(circular.shows(circular.lightRailCopy.circularNote));
  assert.deepEqual(circular.directionFilters().options, [['1', 'Segment 1'], ['2', 'Segment 2']]);
  assert.equal(circular.detailRows().length, 5);
  circular.directionFilters().onSelect('2');
  await circular.settle();
  assert.equal(circular.detailRows().length, 12);

  const stop = mount(t, { lightRailDetail: { kind: 'stop', id: '250' }, locale: 'en' });
  await stop.settle();
  assert.ok(stop.shows('Hoi Wong Road') && stop.shows('海皇路') && stop.shows(stop.lightRailCopy.stopId('250')));
  assert.deepEqual(stop.lightRailForecastProps(), { stationId: '250' });
  const elements = stop.visibleElements();
  const stopIdIndex = elements.findIndex(({ props }) => props.children === stop.lightRailCopy.stopId('250'));
  const forecastIndex = elements.findIndex(({ type }) => type.name === 'LightRailNextTrains');
  const routesIndex = elements.findIndex(({ props }) => props.children === stop.lightRailCopy.lines);
  assert.ok(stopIdIndex >= 0 && stopIdIndex < forecastIndex && forecastIndex < routesIndex);
  assert.ok(stop.shows(`Offline route data updated ${stop.lightRail().lightRailSource.resourceUpdatedOn}`));
  assert.deepEqual(stop.detailRows().map(({ entry }) => entry.id), ['507', '614', '614P']);
  stop.press('Route 614P');
  assert.deepEqual(stop.routes, [{ pathname: '/light-rail/[kind]', params: { kind: 'route', id: '614P' } }]);
  assert.deepEqual(stop.openedLinks, []);
  stop.press(stop.lightRailCopy.dataset);
  stop.press(stop.lightRailCopy.timetable);
  assert.deepEqual(stop.openedLinks, [stop.lightRail().lightRailSource.resource, stop.lightRail().lightRailSource.timetable.en]);

  const invalid = mount(t, { lightRailDetail: { kind: 'stop', id: ['250', '550'] } });
  await invalid.settle();
  assert.ok(invalid.shows(invalid.lightRailCopy.unavailable));
  assert.deepEqual(invalid.detailRows(), []);
});
