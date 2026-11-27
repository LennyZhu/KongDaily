const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { existsSync, readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { test } = require('node:test');
const ts = require('typescript');

const root = join(__dirname, '..');
const gmbFixture = require('./fixtures/gmb-api.json');
const hkkfFixture = require('./fixtures/hkkf-api.json');
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
const promptable = { granted: false, canAskAgain: true, status: 'denied' };
const undetermined = { granted: false, canAskAgain: true, status: 'undetermined' };
const blocked = { granted: false, canAskAgain: false };

function mount(t, {
  permission = granted, servicesEnabled = true, appState = 'active', locale = 'zh-HK', transport = false,
  initialRadius = 500, intent, delayCatalogue = false, offlineCatalogue = false, failBusNearby = false, mtrDetail, lightRailDetail, gmbDetail,
  ferryPreview = false, development = ferryPreview, ferryDetail, ferryNow = Date.parse('2026-11-23T00:01:00+08:00'), ferryResponse, tramDetail, tramEnabled = false, unavailableTram = false, tramStatuses,
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
  let fixtureRadiusSelected = false;
  let fixtureRadiusApplied = false;
  let cursor = 0;
  let effects = [];
  let screenTree;
  let tree;
  let modePickerTree;
  let searchTree;
  let lineStationsTree;
  let stationServicesTree;
  let mtrServicesTree;
  let etaRoutes;
  let etaNow = 0;
  let dismissals = 0;
  let catalogueReads = 0;
  let finishCatalogue;
  let stopSearchTask;
  let holdNearby = false;
  const pendingNearby = [];
  const rootSlots = [];
  let slots = rootSlots;
  const detailComponents = new Map();
  const frames = new Map();
  let frameId = 0;

  const react = {
    useState(initial) {
      const index = cursor++;
      const owner = slots;
      if (!(index in owner)) owner[index] = typeof initial === 'function' ? initial() : initial;
      return [owner[index], (argument) => {
        assert.ok(mounted, 'State updated after Nearby Bus unmounted');
        const next = typeof argument === 'function' ? argument(owner[index]) : argument;
        if (!Object.is(next, owner[index])) dirty = true;
        owner[index] = next;
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
      const owner = slots;
      effects.push(() => {
        previous?.cleanup?.();
        owner[index] = { dependencies, cleanup: effect() };
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
  const savedGmb = new Map();
  const mocks = {
    react,
    'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
    'expo-symbols': { SymbolView: 'SymbolView' },
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
      useLocalSearchParams: () => mtrDetail ?? lightRailDetail ?? gmbDetail ?? ferryDetail ?? tramDetail ?? { intent },
      useFocusEffect: (effect) => load(require.resolve('expo-router/build/useFocusEffect')).useFocusEffect(effect),
    },
    './link/useLoadedNavigation': { useOptionalNavigation: () => navigation },
    './useNavigation': { useNavigation: () => navigation },
    '@/language': { useLanguage: () => ({ locale, copy: source('i18n').messages[locale] }) },
    '@/components/railway-favorite-action': { RailwayStationHeading: ({ title, description }) => ({ type: 'PageHeading', props: { title, description } }) },
    '@/components/ui': {
      AppText: 'AppText', EmptyState: 'EmptyState', Icon: 'Icon', Filters: 'Filters',
      PageHeading: 'PageHeading', Screen: 'Screen',
    },
    '@/database': { getDatabase: async () => ({
      async getAllAsync(sql, ...params) {
        if (sql.includes('latitude BETWEEN')) queries.push(params);
        if (holdNearby && sql.includes('latitude BETWEEN')) await new Promise((resolve) => pendingNearby.push(resolve));
        if (failBusNearby && sql.includes('latitude BETWEEN')) throw new Error('Bus stop index unavailable');
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
      transpiled.set(filename, new Function('module', 'exports', 'require', 'requestAnimationFrame', 'cancelAnimationFrame', '__DEV__', code));
    }
    const localRequire = createRequire(filename);
    transpiled.get(filename)(module, module.exports, (id) => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id === '@/nearby-bus-data') return {
        ...source('nearby-bus-data'), prepareNearbyBusIndex: async () => [], kmbNearbyNeedsRefresh: () => false,
        readBusStopsForSearch: async () => db.prepare('SELECT source, stop_id, name_zh, name_en, street_zh, street_en FROM nearby_bus_stops ORDER BY source, stop_id').all(),
      };
      return id.startsWith('@/') ? source(id.slice(2)) : localRequire(id);
    }, (callback) => { frames.set(++frameId, callback); return frameId; }, (id) => frames.delete(id), development);
    return module.exports;
  }

  const gmbPaths = [];
  const gmbResponses = { '/route': gmbFixture.directory, '/route/HKI/2': gmbFixture.hki2,
    '/route/KLN/2': gmbFixture.kln2, '/route/NT/2': gmbFixture.nt2 };
  if (gmbDetail) {
    const row = (stopId, tc, en) => ({ stop_seq: 1, stop_id: stopId, name_tc: tc, name_en: en });
    const stationList = (visit) => ({ ...gmbFixture.circular, data: {
      ...gmbFixture.circular.data, route_stops: [visit],
    } });
    Object.assign(gmbResponses, {
      '/route/2006474': { ...gmbFixture.hki2, data: [gmbFixture.hki2.data[0]] },
      '/route/2009246': gmbFixture.kln2,
      '/route-stop/2006474/1': gmbFixture.circular,
      '/route-stop/2009246/1': stationList(row(20000418, '黃埔花園公共運輸交匯處', 'Whampoa Garden Public Transport Interchange')),
      '/route-stop/2009246/2': stationList(row(20013966, '又一城', 'Festival Walk')),
    });
  }
  mocks['@/gmb-client'] = { gmbClient: source('gmb-client').createGmbClient({ request: async (address) => {
    const { pathname } = new URL(address);
    gmbPaths.push(pathname);
    if (pathname === '/eta/route-stop/2009246/1/1') {
      const now = Date.now();
      const generated_timestamp = new Date(now).toISOString();
      const eta = { ...gmbFixture.forecast.data.eta[0], timestamp: new Date(now + 300_000).toISOString(), diff: 5 };
      return new Response(JSON.stringify({ ...gmbFixture.forecast, generated_timestamp,
        data: { ...gmbFixture.forecast.data, eta: [eta] } }));
    }
    return new Response(JSON.stringify(gmbResponses[pathname]), { status: gmbResponses[pathname] ? 200 : 500 });
  } }) };

  const ferryPaths = [];
  if (ferryPreview) {
    const clock = () => ({ wall: ferryNow, monotonic: 100 });
    mocks['@/next-train-time'] = { ...source('next-train-time'), nextTrainClock: clock };
    mocks['@/hkkf-preview'] = {
      hkkfPreviewEnabled: true,
      hkkfPreviewClient: source('hkkf-client').createHkkfClient({ enabled: true, clock, request: async (address) => {
        const path = new URL(address).pathname.replace('/opendata/', '');
        ferryPaths.push(path);
        const alternate = ferryResponse?.(path);
        if (alternate) return alternate;
        if (path === 'route') return new Response(JSON.stringify(hkkfFixture.routes));
        assert.ok(path.startsWith('time_table/'), 'Unexpected Ferry API call: ' + path);
        return new Response(hkkfFixture.schedules[path.slice(11)].csv);
      } }),
    };
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

  if (tramEnabled) mocks['@/tram-feature'] = { tramFeatureEnabled: true };
  if (unavailableTram) mocks['@/tram-search'] = { readTramCatalogue: () => ({ status: 'failed' }) };
  if (tramStatuses) {
    const tram = source('tram-static');
    mocks['@/tram-static'] = { ...tram, ...tram.createTramServiceIndex(tramStatuses) };
  }
  if (gmbDetail) {
    const repository = source('gmb-favorites');
    mocks['@/gmb-favorites'] = {
      ...repository,
      useGmbFavorites: () => ({ items: [...savedGmb.values()], status: 'ready' }),
      async setGmbFavorite(favorite, enabled) {
        if (enabled) savedGmb.set(favorite.id, favorite);
        else savedGmb.delete(favorite.id);
        return 'ok';
      },
    };
  }
  const busScreen = source('app/bus/nearby').default;
  const searchAdapter = source('global-search');
  const loadStops = searchAdapter.loadGlobalBusStops;
  searchAdapter.loadGlobalBusStops = () => stopSearchTask = loadStops();
  const transportEntry = transport && source('app/transport').default();
  if (transportEntry) assert.equal(transportEntry.type, busScreen);
  const screen = tramDetail ? source('app/tram/[kind]').default : ferryDetail ? source('app/ferry/[id]').default : gmbDetail ? source('app/minibus/[id]').default : mtrDetail ? source('app/mtr/[kind]').default
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
        if (gmbDetail || ferryDetail || tramDetail) {
          const rendered = new Set();
          screenTree = renderDetail(screenTree, 'detail', rendered);
          for (const [key, owner] of detailComponents) {
            if (!rendered.has(key)) {
              owner.forEach((slot) => slot?.cleanup?.());
              detailComponents.delete(key);
            }
          }
        }
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
          const stationServices = elements(screenTree, false).find(({ type }) => type.name === 'LightRailStationServices');
          stationServicesTree = stationServices && stationServices.type(stationServices.props);
          const mtrServices = elements(screenTree, false).find(({ type }) => type.name === 'MtrNextTrains');
          mtrServicesTree = mtrServices && mtrServices.type(mtrServices.props);
        }
        effects.forEach((run) => run());
        // Legacy scenarios explicitly select their 500m fixture after a reference exists.
        if (!fixtureRadiusSelected && tree && initialRadius !== 300) {
          const format = (r) => r < 1000 ? labels.metres(r) : labels.kilometres(r / 1000);
          const controlLabel = transport ? copy.transport.straightLineRadius(format(300)) : labels.radius(format(300));
          const control = visibleElements().find(({ type, props }) => type === 'Pressable'
            && (props.accessibilityLabel === controlLabel || elements(props.children).some(({ props }) => props.children === controlLabel)));
          if (control) { fixtureRadiusSelected = true; control.props.onPress(); }
        }
        if (fixtureRadiusSelected && !fixtureRadiusApplied) {
          const chosen = visibleElements().find(({ type, props }) => type === 'Pressable'
            && props.accessibilityState?.selected === false
            && elements(props.children).some(({ props }) => props.children === (initialRadius < 1000 ? labels.metres(initialRadius) : labels.kilometres(initialRadius / 1000))));
          if (chosen) { fixtureRadiusApplied = true; chosen.props.onPress(); }
        }
      }
      await new Promise(setImmediate);
      if (!dirty) return;
    }
    assert.fail('Nearby bus screen did not settle');
  }

  function renderDetail(node, key, rendered) {
    if (Array.isArray(node)) return node.map((child, index) => renderDetail(child, key + '/' + (child?.key ?? index), rendered));
    if (!node?.props) return node;
    if (typeof node.type === 'function') {
      const identity = key + '/' + node.type.name + (node.key ?? '');
      rendered.add(identity);
      if (!detailComponents.has(identity)) detailComponents.set(identity, []);
      const parent = [slots, cursor];
      slots = detailComponents.get(identity);
      cursor = 0;
      const children = node.type(node.props);
      [slots, cursor] = parent;
      return renderDetail(children, identity, rendered);
    }
    return { ...node, props: { ...node.props, children: renderDetail(node.props.children, key, rendered) } };
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
      else if (name === 'LightRailStationServices') children = stationServicesTree;
      else if (name === 'MtrNextTrains') children = mtrServicesTree;
      else if (name?.startsWith('Transport')
        || ['Loading', 'ListAction', 'MtrEntryRow', 'MtrSources', 'LightRailEntryRow', 'LightRailSources', 'GlobalSearchResultRow', 'GmbSearchNotice', 'HkkfSearchNotice', 'HkkfNearbyRouteCard', 'HkkfNearbyPierCard', 'TramNearbyRouteCard', 'TramNearbyStopCard', 'GmbFeedback', 'GmbNearbyRouteCard', 'GmbNearbyStopCard', 'RailwayStationHeading'].includes(name)) children = node.type(node.props);
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
    return visibleElements().some(({ props }) => props.children === label || props.title === label || props.description === label || props.detail === label);
  }

  function unmount() {
    if (!mounted) return;
    rootSlots.forEach((slot) => slot?.cleanup?.());
    detailComponents.forEach((owner) => owner.forEach((slot) => slot?.cleanup?.()));
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
    visibleElements, renderFilters: (props) => source('components/ui').Filters(props),
    transportCopy: copy.transport, tramCopy: copy.tram, busCopy: copy.bus, mtrCopy: copy.mtr, lightRailCopy: copy.lightRail,
    ferryPaths, ferryCopy: copy.ferry, savedGmb, gmbPaths, gmbCopy: copy.minibus, catalogueRoutes, theme: source('theme'),
    mtr: () => source('mtr-static'),
    lightRail: () => source('light-rail-static'),
    geo: () => source('railway-station-geo'),
    nearbyRail: () => source('nearby-railway'),
    nearbyGmb: () => source('nearby-gmb'),
    nearbyBus: () => source('nearby-bus-data'),
    nearbyFerry: () => source('nearby-hkkf'),
    ferryNearbyCopy: () => source('hkkf-nearby-copy').hkkfNearbyCopy[locale],
    async waitStopSearch() { await stopSearchTask; await settle(); },
    holdNearby() { holdNearby = true; },
    releaseNearby() { holdNearby = false; pendingNearby.splice(0).forEach((resolve) => resolve()); },
    rowElements: (index) => elements(tree.props.renderItem({ item: tree.props.data[index] })),
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
    failFix(index) { requests[index].reject(new Error('test location failure')); },
    fix(index, point, accuracy = 20) { requests[index].resolve({ coords: { ...point, accuracy } }); },
  };
}

for (const locale of ['zh-HK', 'en']) {
  test(`300m default aggregates every open mode and preserves an explicitly selected radius (${locale})`, async (t) => {
    const page = mount(t, { transport: true, initialRadius: 300, locale });
    const { labels, transportCopy: copy } = page;
    await page.settle();
    const point = page.geo().getLightRailStopPositions('430')[0].coordinate;
    page.fix(0, point);
    await page.settle();
    assert.ok(page.findAction(copy.straightLineRadius(labels.metres(300))));
    const distance = (row) => row.kind === 'nearby-railway' ? row.location.distance
      : 'route' in row ? row.stop.distance : 'stops' in row ? row.stops[0].distance : row.distance;
    for (const radius of [300, 500, 1000, 2000]) {
      if (radius > 300) {
        const previous = radius === 500 ? labels.metres(300) : radius === 1000 ? labels.metres(500) : labels.kilometres(1);
        page.press(copy.straightLineRadius(previous)); await page.settle();
        for (const label of [labels.metres(300), labels.metres(500), labels.kilometres(1), labels.kilometres(2)]) assert.ok(page.findAction(label));
        page.press(radius < 1000 ? labels.metres(radius) : labels.kilometres(radius / 1000)); await page.settle();
      }
      for (const [view, action] of [['routes', labels.byRoute], ['stops', labels.byStop]]) {
        page.press(action); await page.settle();
        const all = page.rows();
        assert.ok(all.length);
        assert.ok(all.every((row, i) => distance(row) <= radius && (!i || distance(row) >= distance(all[i - 1]))));
        for (const mode of ['bus', 'mtr', 'lightRail', 'minibus']) {
          page.press(copy.modes[mode]); await page.settle();
          page.press(action); await page.settle();
          const keys = new Set(all.map(page.list().props.keyExtractor));
          for (const row of page.rows()) assert.ok(keys.has(page.list().props.keyExtractor(row)));
        }
        page.press(copy.modes.all); await page.settle();
        assert.deepEqual(page.rows(), all);
      }
    }
    page.press(copy.changeReference); await page.settle();
    page.press(labels.landmarks.yuenLong); await page.settle();
    assert.ok(page.findAction(copy.straightLineRadius(labels.kilometres(2))));
    page.focus(false); page.focus(true); await page.settle();
    assert.ok(page.findAction(copy.straightLineRadius(labels.kilometres(2))));
  });
}

test('300m empty nearby results offer each larger radius once without changing the reference', async (t) => {
  const page = mount(t, { transport: true, initialRadius: 300 });
  await page.settle();
  page.fix(0, { latitude: 22.15, longitude: 114.30 }); await page.settle();
  for (const radius of [500, 1000, 2000]) {
    assert.equal(page.rows().length, 0);
    page.press(page.labels.expand(radius < 1000 ? page.labels.metres(radius) : page.labels.kilometres(radius / 1000)));
    await page.settle();
  }
  assert.equal(page.rows().length, 0);
  assert.ok(!page.visibleElements().some(({ props }) => props.accessibilityLabel?.includes('擴大')));
  assert.equal(page.requests.length, 1);
});

test('bus 300m filtering uses exact straight-line distances on either side of the boundary', async (t) => {
  const { readNearbyBusStops } = mount(t, { initialRadius: 300 }).nearbyBus();
  const point = { latitude: 22.31, longitude: 114.17 };
  const latitude = (meters) => point.latitude + meters / 6_371_008.8 * 180 / Math.PI;
  try {
    insert.run('citybus', 'phase5-inside', '站', 'Stop', latitude(299.999), point.longitude, '', '');
    insert.run('citybus', 'phase5-outside', '站', 'Stop', latitude(300.001), point.longitude, '', '');
    const rows = await readNearbyBusStops(point, 300);
    assert.ok(rows.some(({ stop_id }) => stop_id === 'phase5-inside'));
    assert.ok(!rows.some(({ stop_id }) => stop_id === 'phase5-outside'));
  } finally {
    db.prepare("DELETE FROM nearby_bus_stops WHERE stop_id IN ('phase5-inside', 'phase5-outside')").run();
  }
});

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
  assert.equal(page.queries.length, 2);
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
  assert.equal(page.queries.length, 2);
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
  assert.equal(page.queries.length, 2);
});

test('the legacy bus screen never prompts automatically for denied access; explicit permission and a later retry work', async (t) => {
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
  assert.equal(page.queries.length, 2);
});

for (const locale of ['zh-HK', 'en']) {
  test(`transport filters use real bus results and keep the same position and mode (${locale})`, async (t) => {
    const page = mount(t, { transport: true, locale });
    const { labels, landmarks, transportCopy: copy } = page;
    const expected = locale === 'en'
      ? ['All', 'Bus', 'MTR', 'Light Rail', 'Minibus', 'Ferry']
      : ['全部', '巴士', '港鐵', '輕鐵', '專線小巴', '渡輪'];
    await page.settle();
    assert.deepEqual(page.modeScroller().children.map(({ props }) => props.children[1].props.children), expected);
    assert.ok(!page.shows(locale === 'en' ? 'Find transport services near you' : '查看附近可用的交通服務'));
    assert.equal(copy.searchAll, locale === 'en' ? 'Search transport routes or stations' : '搜尋交通路線或車站');
    assert.equal(copy.searchBuses, locale === 'en' ? 'Search bus routes or stops' : '搜尋巴士路線或車站');
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
    assert.equal(page.etaRoutes().length, allRoutes.filter((row) => 'route' in row).length);
    page.searchInput().onChangeText('B2');
    await page.settle();
    assert.deepEqual(page.rows().map((route) => route.number), ['B2', 'B2P']);
    assert.equal(page.requests.length, 1);
    assert.equal(page.queries.length, 2);
    page.press(page.busCopy.clearInput);
    await page.settle();
    assert.deepEqual(page.rows(), allRoutes);
    assert.equal(page.requests.length, 2);
    for (const mode of ['ferry']) {
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
      assert.equal(page.requests.length, 2);
    }
    page.press(copy.modes.bus);
    await page.settle();
    assert.deepEqual(page.rows(), allRoutes.filter((row) => 'route' in row));
    assert.equal(page.requests.length, 3);
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
    assert.equal(page.requests.length, 3);
    page.press(copy.modes.ferry);
    await page.settle();
    page.press(copy.modes.all);
    await page.settle();
    assert.deepEqual(page.rows().filter((row) => 'stops' in row), allStops);
    assert.equal(page.searchInput().placeholder, copy.searchAll);
    assert.ok(!page.shows(labels.distanceNote));
    assert.ok(!page.shows(labels.currentLocation));
    assert.ok(!page.locateButton());
    assert.equal(page.requests.length, 4);
    assert.equal(page.queries.length, 2);
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
    const radius = page.findAction(range500);
    assert.equal(radius.props.children[0].props.children, labels.metres(500));
    assert.equal(radius.props.children[1].props.name, 'chevron.down');
    assert.equal(radius.props.style[0].minHeight, 44);
    assert.equal(radius.props.style[1].minWidth, 44);
    assert.ok(!page.shows(range500), 'Straight-line wording is announced but is not a toolbar label');
    page.press(range500);
    await page.settle();
    assert.ok(page.shows(copy.straightLineDistance));
    for (const label of [labels.metres(500), labels.kilometres(1), labels.kilometres(2)]) {
      assert.ok(page.findAction(label));
    }
    page.press(labels.kilometres(1));
    await page.settle();
    assert.ok(page.findAction(range1000));
    assert.ok(!page.shows(range500));
    assert.equal(page.queries.length, 3);
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
    assert.ok(page.shows(labels.kilometres(1)) && page.shows(copy.railDistanceNote));
    assert.ok(page.findAction(copy.distanceInfo));
    assert.equal(page.requests.length, 1);
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
  assert.ok(nearby.length > 1 && nearby.some((row) => 'stops' in row) && nearby.some((row) => row.kind === 'nearby-railway'));
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
  assert.ok(page.shows(copy.noBusMatches));
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

test('first transport entry prompts once, then loads nearby results automatically after permission is granted', async (t) => {
  const page = mount(t, { transport: true, permission: undetermined, appState: 'background' });
  let answer;
  page.answerPrompt(new Promise((resolve) => { answer = resolve; }));
  await page.settle();
  assert.equal(page.calls.prompt, 0);
  page.appState('active');
  await page.settle();
  assert.equal(page.calls.prompt, 1);
  page.appState('inactive');
  page.appState('active');
  page.focus(false);
  page.focus(true);
  await page.settle();
  assert.equal(page.calls.prompt, 1, 'Refocus while iOS is asking joins the same native prompt');
  assert.equal(page.requests.length, 0);
  answer(granted);
  await page.settle();
  assert.equal(page.requests.length, 1);
  page.fix(0, page.landmarks.central);
  await page.settle();
  assert.ok(page.rows().length > 0);
});

test('refusing the initial transport prompt keeps the landmark and Settings paths without re-prompting', async (t) => {
  const page = mount(t, { transport: true, permission: undetermined, locale: 'en' });
  page.answerPrompt(blocked);
  await page.settle();
  const { transportCopy: copy } = page;
  assert.equal(page.calls.prompt, 1);
  assert.equal(page.requests.length, 0);
  page.focus(false);
  page.focus(true);
  await page.settle();
  assert.equal(page.calls.prompt, 1);
  assert.ok(page.findAction(copy.openSettings));
  page.press(copy.chooseLandmark);
  await page.settle();
  page.press(page.labels.landmarks.central);
  await page.settle();
  assert.ok(page.rows().length > 0);
});

test('English nearby headings and controls share a flexible toolbar across all supported transport modes', async (t) => {
  const page = mount(t, { transport: true, locale: 'en', permission: blocked, ferryPreview: true });
  await page.settle();
  const copy = page.transportCopy;
  page.press(copy.chooseLandmark);
  await page.settle();
  page.press(page.labels.landmarks.central);
  await page.settle();
  function checkToolbar(text) {
    const toolbar = page.visibleElements().find(({ type, props }) => type === 'View' && Array.isArray(props.children)
      && props.children[0]?.props?.children === text);
    assert.ok(toolbar, text);
    const [title, controls] = toolbar.props.children;
    const [distance, info, more] = controls.props.children;
    assert.equal(toolbar.props.style[0].flexDirection, 'row');
    assert.equal(toolbar.props.style[1].flexWrap, 'wrap', 'Large text can move the controls to a second line');
    assert.equal(title.props.style.flexBasis, undefined, 'No fixed title width forces a second row');
    assert.equal(title.props.variant, 'homeHeading');
    assert.equal(title.props.numberOfLines, undefined);
    assert.equal(title.props.maxFontSizeMultiplier, undefined);
    assert.equal(distance.props.children[0].props.children, '500 m');
    assert.equal(info.props.accessibilityLabel, copy.distanceInfo);
    assert.equal(more.props.accessibilityLabel, copy.changeReference);
  }
  for (const mode of ['all', 'bus', 'mtr', 'lightRail', 'minibus', 'ferry']) {
    page.press(copy.modes[mode]);
    await page.settle();
    page.press(mode === 'ferry' ? 'By Route' : page.labels.byRoute);
    await page.settle();
    checkToolbar('Nearby routes');
    page.press(mode === 'ferry' ? 'By Pier' : page.labels.byStop);
    await page.settle();
    checkToolbar(mode === 'ferry' ? 'Nearby piers' : 'Nearby stops');
  }
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
  const anchorStart = 14;
  const rowKey = page.list().props.keyExtractor;
  const originalVisible = page.rows().slice(anchorStart, anchorStart + 3).map(rowKey);
  page.showRows([anchorStart, anchorStart + 1, anchorStart + 2], 1400);
  page.focus(false);
  page.focus(true);
  await page.settle();
  page.fix(1, { latitude: landmarks.central.latitude + 0.00035, longitude: landmarks.central.longitude + 0.00055 });
  await page.settle();
  const keys = page.rows().map(rowKey);
  const surviving = originalVisible.find((key) => keys.includes(key));
  assert.ok(surviving, 'A station in the original viewport still exists at the nearby position');
  const index = keys.indexOf(surviving);
  assert.notEqual(index, anchorStart);
  assert.equal(page.list().key, listKey);
  assert.deepEqual(scrolls, []);
  page.paint();
  page.paint();
  assert.deepEqual(scrolls, [
    { method: 'index', index, animated: false },
    { method: 'offset', offset: Math.max(0, 1400 + (index - anchorStart) * 100), animated: false },
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
  assert.equal(page.queries.length, 2);
});

for (const [railMode, busMode] of [['mtr', 'bus'], ['lightRail', 'all']]) {
  test(`${railMode} full-region search skips location on return and foreground, then resumes nearby ${busMode}`, async (t) => {
    const page = mount(t, { transport: true });
    const { labels, landmarks, transportCopy: copy } = page;
    await page.settle();
    page.fix(0, landmarks.central);
    await page.settle();
    page.press(copy.straightLineRadius(labels.metres(500)));
    await page.settle();
    page.press(labels.kilometres(1));
    await page.settle();
    const nearby = page.rows();
    assert.ok(nearby.length > 0);

    page.focus(false);
    page.focus(true);
    await page.settle();
    assert.equal(page.requests.length, 2);
    const locationCalls = { ...page.calls };
    const queryCount = page.queries.length;
    page.press(copy.modes[railMode]);
    await page.settle();
    page.press(labels.byStop);
    await page.settle();
    assert.throws(() => page.findAction(copy.viewAll), /Missing action/);
    page.searchInput().onChangeText(railMode === 'mtr' ? 'Line' : '天');
    await page.settle();
    page.fix(1, landmarks.shaTin);
    await page.settle();
    const matches = page.rows();
    const listKey = page.list().key;
    const scrolls = page.attachList();
    page.showRows([2], 140);
    page.openResult(2);
    page.focus(false);
    page.focus(true);
    await page.settle();
    page.appState('background');
    page.appState('active');
    await page.settle();
    page.paint();
    assert.deepEqual(page.calls, locationCalls);
    assert.equal(page.requests.length, 2);
    assert.equal(page.queries.length, queryCount);
    assert.deepEqual(page.etaRoutes(), []);
    assert.equal(page.rows(), matches);
    assert.equal(page.list().key, listKey);
    assert.deepEqual(scrolls, []);

    page.press(copy.modes[busMode]);
    page.press(page.busCopy.clearInput);
    await page.settle();
    assert.equal(page.requests.length, 3);
    assert.deepEqual(new Set(page.rows().map(page.list().props.keyExtractor)), new Set((busMode === 'bus' ? nearby.filter((row) => 'route' in row) : nearby).map(page.list().props.keyExtractor)));
    assert.ok(page.findAction(copy.straightLineRadius(labels.kilometres(1))));
    page.fix(2, landmarks.central);
    await page.settle();
    assert.deepEqual(new Set(page.rows().map(page.list().props.keyExtractor)), new Set((busMode === 'bus' ? nearby.filter((row) => 'route' in row) : nearby).map(page.list().props.keyExtractor)));
    assert.equal(page.queries.length, queryCount + 1);
    assert.equal(page.calls.prompt, 0);
  });
}

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
  test(`MTR nearby modes keep bilingual full-region search offline and mounted on return (${locale})`, async (t) => {
    const page = mount(t, { transport: true, permission: blocked, locale });
    const { transportCopy: copy, mtrCopy, labels } = page;
    await page.settle();
    page.press(copy.modes.mtr);
    await page.settle();
    assert.throws(() => page.findAction(copy.viewAll), /Missing action/);
    assert.ok(page.shows(copy.nearbyRoutes));
    assert.equal(page.searchInput().placeholder, mtrCopy.search);
    assert.equal(page.rows().length, 0);
    assert.ok(page.findAction(copy.distanceInfo));

    page.press(labels.byStop);
    await page.settle();
    assert.throws(() => page.findAction(copy.viewAll), /Missing action/);
    assert.ok(page.shows(copy.nearbyStops));
    assert.equal(page.rows().length, 0);
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
    assert.ok(page.shows(copy.nearbyStops));
    assert.equal(page.rows().length, 0);
    page.searchInput().onChangeText('RAC');
    await page.settle();
    assert.equal(page.rows()[0].id, 'RAC');
    page.press(page.busCopy.clearInput);
    await page.settle();
    assert.ok(page.shows(copy.nearbyStops));
    assert.equal(page.rows().length, 0);
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
  assert.ok(!page.shows(page.mtrCopy.forecastDisclaimer));
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
  const { mtrSource } = page.mtr();
  assert.ok(station.shows(station.mtrCopy.offlineUpdated(mtrSource.resourceUpdatedOn)));
  assert.ok(station.shows(station.mtrCopy.snapshotDate(mtrSource.fetchedOn)));
  assert.ok(station.shows(station.mtrCopy.forecastDisclaimer));
  assert.deepEqual(station.openedLinks, []);
  station.press(station.mtrCopy.dataset);
  station.press(station.mtrCopy.nextTrains.dataset);
  assert.deepEqual(station.openedLinks, [mtrSource.resource, 'https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data']);
  assert.deepEqual(station.detailRows().map(({ entry }) => entry.id), ['AEL', 'TCL']);
  station.press('Airport Express');
  assert.deepEqual(station.routes, [{ pathname: '/mtr/[kind]', params: { kind: 'line', code: 'AEL' } }]);

  const racecourse = mount(t, { mtrDetail: { kind: 'station', code: 'RAC', line: 'EAL' } });
  await racecourse.settle();
  assert.ok(racecourse.shows(racecourse.mtrCopy.racecourseSourceNote));
  assert.ok(!station.shows(station.mtrCopy.racecourseSourceNote));
  racecourse.press(racecourse.mtrCopy.racecourseDictionary);
  racecourse.press(racecourse.mtrCopy.serviceHours);
  assert.deepEqual(racecourse.openedLinks, [mtrSource.racecourseCodeSource, mtrSource.racecourseHours]);

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
    const forecastIndex = elements.findIndex(({ type }) => type.name === 'MtrNextTrains');
    const linesIndex = elements.findIndex(({ props }) => props.children === station.mtrCopy.lines);
    const sourcesIndex = elements.findIndex(({ props }) => props.children === station.mtrCopy.source);
    assert.ok(forecastIndex >= 0 && forecastIndex < linesIndex && linesIndex < sourcesIndex);
    assert.equal(station.mtr().mtrName(station.mtrForecastProps().station, locale), title);
    assert.equal(station.mtr().mtrName(station.mtrForecastProps().station, locale === 'en' ? 'zh-HK' : 'en'), description);
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
  assert.ok(nearby.length > 0 && nearby.some((row) => 'route' in row) && nearby.some((row) => row.kind === 'nearby-railway'));
  page.searchInput().onChangeText('Yuen Long');
  await page.settle();
  assert.ok(page.shows(page.busCopy.loading));
  assert.equal(page.requests.length, 1);
  assert.deepEqual(page.rows().map(({ kind, id }) => [kind, id]), [['mtr-station', 'YUL'], ['light-rail-stop', '600']]);
  page.finishCatalogue();
  await page.settle();
  const busRow = page.rows().findIndex(({ number }) => number === 'B2');
  const mtrRow = page.rows().findIndex(({ id }) => id === 'YUL');
  const lightRailRow = page.rows().findIndex(({ kind, id }) => kind === 'light-rail-stop' && id === '600');
  assert.ok(busRow >= 0 && mtrRow > busRow && lightRailRow > mtrRow);
  assert.equal(page.renderRow(busRow).props.modeLabel, page.transportCopy.modes.bus);
  assert.equal(page.list().props.keyExtractor(page.rows()[mtrRow]), 'mtr_station:YUL');
  page.openResult(mtrRow);
  assert.deepEqual(page.routes.at(-1), { pathname: '/mtr/[kind]', params: { kind: 'station', code: 'YUL' } });
  assert.equal(page.list().props.keyExtractor(page.rows()[lightRailRow]), 'light_rail_stop:600');
  page.openResult(lightRailRow);
  assert.deepEqual(page.routes.at(-1), { pathname: '/light-rail/[kind]', params: { kind: 'stop', id: '600' } });
  page.focus(false);
  page.focus(true);
  page.appState('background');
  page.appState('active');
  await page.settle();
  assert.equal(page.requests.length, 1);
  assert.equal(page.searchInput().value, 'Yuen Long');
  page.press(page.busCopy.clearInput);
  await page.settle();
  assert.deepEqual(page.rows(), nearby);
  assert.equal(page.requests.length, 2);
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
  test(`Light Rail nearby modes keep full-region search offline and retain detail return scope (${locale})`, async (t) => {
    const page = mount(t, { transport: true, permission: blocked, locale });
    const { transportCopy: copy, lightRailCopy: rail, labels } = page;
    await page.settle();
    page.press(copy.modes.lightRail);
    await page.settle();
    assert.throws(() => page.findAction(copy.viewAll), /Missing action/);
    assert.ok(page.shows(copy.nearbyRoutes));
    assert.equal(page.searchInput().placeholder, rail.search);
    assert.equal(page.rows().length, 0);
    assert.ok(page.findAction(copy.distanceInfo));

    page.press(labels.byStop);
    await page.settle();
    assert.throws(() => page.findAction(copy.viewAll), /Missing action/);
    assert.ok(page.shows(copy.nearbyStops));
    const stationQuery = locale === 'en' ? 'Tin' : '天';
    page.searchInput().onChangeText(stationQuery);
    await page.settle();
    const stationScope = page.list().key;
    const scrolls = page.attachList();
    const stationRows = page.rows();
    assert.ok(stationRows.length > 2 && stationRows.every(({ kind }) => kind === 'light-rail-stop'));
    page.showRows([2], 440);
    page.openResult(2);
    assert.deepEqual(page.routes.at(-1), {
      pathname: '/light-rail/[kind]', params: { kind: 'stop', id: stationRows[2].id },
    });
    page.focus(false);
    page.focus(true);
    await page.settle();
    page.paint();
    assert.equal(page.list().key, stationScope);
    assert.equal(page.rows(), stationRows);
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
    assert.ok(page.shows(copy.nearbyStops));
    assert.equal(page.rows().length, 0);
    page.searchInput().onChangeText(stationQuery);
    await page.settle();
    assert.ok(page.shows(rail.results));
    assert.equal(page.list().key, stationScope);
    assert.deepEqual(page.rows(), stationRows);
    page.press(page.busCopy.clearInput);
    await page.settle();
    assert.equal(page.catalogueReads(), 0);
    assert.equal(page.requests.length, 0);
    assert.equal(page.queries.length, 0);
    assert.deepEqual(page.etaRoutes(), []);
    page.press(copy.modes.mtr);
    await page.settle();
    assert.ok(page.shows(copy.nearbyRoutes));
  });
}

test('Light Rail details switch official visits, open stable stop IDs and link to official sources', async (t) => {
  const route = mount(t, { lightRailDetail: { kind: 'route', id: '761P' } });
  await route.settle();
  assert.ok(route.shows(route.lightRailCopy.route('761P')));
  assert.equal(route.lightRailForecastProps(), undefined);
  assert.ok(!route.shows(route.mtrCopy.forecastDisclaimer));
  assert.ok(route.shows(`離線路線資料更新日期 ${route.lightRail().lightRailSource.resourceUpdatedOn}`));
  assert.deepEqual(route.directionFilters().options, [['1', '天逸 → 元朗'], ['2', '元朗 → 天逸']]);
  route.directionFilters().onSelect('2');
  await route.settle();
  const visits = route.detailRows();
  assert.equal(visits.length, 15);
  assert.deepEqual(visits.slice(-2).map(({ entry, sequence }) => [entry.id, sequence]), [['550', 14], ['550', 15]]);
  route.press('天逸');
  assert.deepEqual(route.routes, [{ pathname: '/light-rail/[kind]', params: { kind: 'stop', id: '550', route: '761P' } }]);

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
  assert.deepEqual(stop.lightRailForecastProps(), { stationId: '250', selectedRoute: undefined });
  const elements = stop.visibleElements();
  const stopIdIndex = elements.findIndex(({ props }) => props.children === stop.lightRailCopy.stopId('250'));
  const forecastIndex = elements.findIndex(({ type }) => type.name === 'LightRailNextTrains');
  const routesIndex = elements.findIndex(({ props }) => props.children === stop.lightRailCopy.lines);
  assert.ok(stopIdIndex >= 0 && stopIdIndex < forecastIndex && forecastIndex < routesIndex);
  assert.ok(stop.shows(`Offline route data updated ${stop.lightRail().lightRailSource.resourceUpdatedOn}`));
  assert.ok(stop.shows(stop.mtrCopy.forecastDisclaimer));
  assert.deepEqual(stop.detailRows().map(({ entry }) => entry.id), ['507', '614', '614P']);
  stop.press('Route 614P');
  assert.deepEqual(stop.routes, [{ pathname: '/light-rail/[kind]', params: { kind: 'route', id: '614P' } }]);
  assert.deepEqual(stop.openedLinks, []);
  stop.press(stop.lightRailCopy.dataset);
  stop.press(stop.lightRailCopy.timetable);
  stop.press(stop.lightRailCopy.nextTrains.dataset);
  assert.deepEqual(stop.openedLinks, [stop.lightRail().lightRailSource.resource, stop.lightRail().lightRailSource.timetable.en,
    'https://data.gov.hk/en-data/dataset/mtr-lrnt_data-light-rail-nexttrain-data']);

  const invalid = mount(t, { lightRailDetail: { kind: 'stop', id: ['250', '550'] } });
  await invalid.settle();
  assert.ok(invalid.shows(invalid.lightRailCopy.unavailable));
  assert.deepEqual(invalid.detailRows(), []);
});

for (const locale of ['zh-HK', 'en']) {
  for (const railMode of ['mtr', 'lightRail']) {
    test(`nearby ${railMode} defaults to local routes and stations with correct distance semantics (${locale})`, async (t) => {
      const page = mount(t, { transport: true, locale });
      const { transportCopy: copy, labels } = page;
      await page.settle();
      const point = railMode === 'mtr'
        ? page.geo().getMtrStationPositions('CEN').find(({ kind }) => kind === 'entrance').coordinate
        : page.geo().getLightRailStopPositions('250')[0].coordinate;
      page.fix(0, point);
      await page.settle();
      page.press(copy.modes[railMode]);
      await page.settle();
      assert.equal(page.requests.length, 1, 'Switching nearby transport types reuses the active location lifecycle');
      assert.ok(page.shows(copy.nearbyRoutes));
      assert.throws(() => page.findAction(copy.viewAll), /Missing action/);
      assert.throws(() => page.findAction(copy.viewNearby), /Missing action/);
      assert.deepEqual(page.rows(), page.nearbyRail().nearbyRailwayRows(point, 500, 'routes', railMode));
      assert(page.rows().length > 0 && page.rows().every(({ location }) => location.distance <= 500));
      assert.equal(new Set(page.rows().map(({ entry }) => entry.id)).size, page.rows().length);
      assert.deepEqual(page.etaRoutes(), [], 'No batch rail forecasts are requested');
      const first = page.rows()[0];
      const wording = (railMode === 'mtr' ? copy.entranceDistance : copy.referenceDistance)(labels.metres(0));
      assert(page.rowElements(0).some(({ props }) => props.children === wording));
      page.openResult(0);
      assert.deepEqual(page.routes.at(-1), railMode === 'mtr'
        ? { pathname: '/mtr/[kind]', params: { kind: 'line', code: first.entry.id } }
        : { pathname: '/light-rail/[kind]', params: { kind: 'route', id: first.entry.id } });

      for (const radius of [500, 1000, 2000]) {
        if (radius !== 500) {
          page.press(copy.straightLineRadius(radius === 1000 ? labels.metres(500) : labels.kilometres(1)));
          await page.settle();
          page.press(labels.kilometres(radius / 1000));
          await page.settle();
        }
        assert.deepEqual(page.rows(), page.nearbyRail().nearbyRailwayRows(point, radius, 'routes', railMode));
        page.press(labels.byStop);
        await page.settle();
        assert.ok(page.shows(copy.nearbyStops));
        assert.throws(() => page.findAction(copy.viewAll), /Missing action/);
        assert.deepEqual(page.rows(), page.nearbyRail().nearbyRailwayRows(point, radius, 'stops', railMode));
        page.press(labels.byRoute);
        await page.settle();
      }
      page.press(labels.byStop);
      await page.settle();
      assert.deepEqual(page.rows(), page.nearbyRail().nearbyRailwayRows(point, 2000, 'stops', railMode));
      assert.equal(new Set(page.rows().map(({ entry }) => entry.id)).size, page.rows().length);
      const station = page.rows()[0];
      assert(page.rowElements(0).some(({ props }) => props.children === station.boarding.zh));
      assert(page.rowElements(0).some(({ props }) => props.children === station.boarding.en));
      page.openResult(0);
      assert.deepEqual(page.routes.at(-1), railMode === 'mtr'
        ? { pathname: '/mtr/[kind]', params: { kind: 'station', code: station.entry.id } }
        : { pathname: '/light-rail/[kind]', params: { kind: 'stop', id: station.entry.id } });
    });
  }
}

test('All merges four actual transport types with one point/radius, stable IDs and ascending distances', async (t) => {
  const page = mount(t, { transport: true });
  const { labels, transportCopy: copy } = page;
  await page.settle();
  const point = page.geo().getLightRailStopPositions('430')[0].coordinate;
  page.fix(0, point);
  await page.settle();
  const minibuses = (rows) => rows.filter(({ kind }) => kind === 'nearby-gmb-route' || kind === 'nearby-gmb-stop');
  const byId = (rows) => new Map(rows.map((row) => [row.id, row]));
  let distanceLabel = labels.metres(500);
  for (const radius of [500, 1000, 2000]) {
    if (radius > 500) {
      page.press(copy.straightLineRadius(distanceLabel)); await page.settle();
      distanceLabel = labels.kilometres(radius / 1000);
      page.press(distanceLabel); await page.settle();
    }
    for (const [view, switchLabel] of [['routes', labels.byRoute], ['stops', labels.byStop]]) {
      page.press(switchLabel); await page.settle();
      const rows = page.rows();
      assert(rows.some((row) => view === 'routes' ? 'route' in row : 'stops' in row));
      for (const railMode of ['mtr', 'lightRail']) assert(rows.some((row) => row.kind === 'nearby-railway' && row.location.station.mode === railMode));
      const eligibleMinibuses = page.nearbyGmb().nearbyGmbRows(point, radius, view);
      assert.ok(eligibleMinibuses.length > 0);
      assert.deepEqual(byId(minibuses(rows)), byId(eligibleMinibuses));
      const distances = rows.map((row) => row.kind === 'nearby-railway' ? row.location.distance
        : 'route' in row ? row.stop.distance : 'stops' in row ? row.stops[0].distance : row.distance);
      assert(distances.every((distance, index) => distance <= radius && (!index || distance >= distances[index - 1])));
      assert.equal(new Set(rows.map(page.list().props.keyExtractor)).size, rows.length);
      assert.equal(page.list().props.onEndReached, undefined, 'The full sorted data goes to the virtualized list');
      assert.ok(!rows.some(({ kind }) => /tram|ferry/.test(kind)), 'All cannot expose gated traffic');
      assert.deepEqual(rows.filter(({ kind }) => kind === 'nearby-railway'), page.nearbyRail().nearbyRailwayRows(point, radius, view));
      const busIndex = rows.findIndex((row) => view === 'routes' ? 'route' in row : 'stops' in row);
      assert.equal(page.renderRow(busIndex).props.modeLabel, copy.modes.bus);
      assert.equal(page.etaRoutes().length, view === 'routes' ? rows.filter((row) => 'route' in row).length : 0);

      const firstMinibus = minibuses(rows)[0];
      const minibusIndex = rows.indexOf(firstMinibus);
      if (radius === 500 && view === 'routes') {
        page.openResult(minibusIndex);
        const { routeId, routeSeq } = firstMinibus.visit;
        assert.deepEqual(page.routes.at(-1), { pathname: '/minibus/[id]', params: { id: String(routeId), routeSeq: String(routeSeq) } });
      }
      if (radius === 500 && view === 'stops') {
        page.openResult(minibusIndex); await page.settle();
        const visit = firstMinibus.stop.visits.find(({ boarding }) => boarding);
        page.rowElements(minibusIndex).find(({ props }) => props.accessibilityState?.disabled === false).props.onPress();
        assert.deepEqual(page.routes.at(-1), { pathname: '/minibus/[id]', params: {
          id: String(visit.routeId), routeSeq: String(visit.routeSeq), stopSeq: String(visit.stopSeq), stopId: String(visit.stopId),
        } });
      }

      page.press(copy.modes.minibus); await page.settle();
      page.press(switchLabel); await page.settle();
      assert.deepEqual(byId(page.rows()), byId(minibuses(rows)));
      page.press(copy.modes.all); await page.settle();
      assert.deepEqual(page.rows(), rows);
    }
  }
  assert.deepEqual(page.gmbPaths, [], 'The offline merge never calls live minibus ETA');
  assert.equal(page.requests.length, 1);
});

test('rail zero results and denied location remain distinct; manual landmarks and full-region search stay available', async (t) => {
  const page = mount(t, { transport: true, permission: blocked, locale: 'en' });
  const { labels, landmarks, transportCopy: copy } = page;
  await page.settle();
  page.press(copy.modes.lightRail);
  await page.settle();
  assert(page.shows(labels.issues.blocked));
  assert.equal(page.unavailableTitle(), undefined, 'No position is not a zero-result area');
  page.press(copy.chooseLandmark);
  await page.settle();
  page.press(labels.landmarks.central);
  await page.settle();
  assert.equal(page.unavailableTitle(), copy.noNearbyRoutes(labels.metres(500)));
  assert(page.findAction(copy.straightLineRadius(labels.metres(500))));
  assert(page.findAction(labels.expand(labels.kilometres(1))));
  page.press(labels.expand(labels.kilometres(1)));
  await page.settle();
  assert.equal(page.unavailableTitle(), copy.noNearbyRoutes(labels.kilometres(1)));
  assert(page.findAction(labels.expand(labels.kilometres(2))));
  page.searchInput().onChangeText('250');
  await page.settle();
  assert.equal(page.rows()[0].id, '250', 'Search includes a station far outside the current radius');
  page.press(page.busCopy.clearInput);
  await page.settle();
  assert.equal(page.unavailableTitle(), copy.noNearbyRoutes(labels.kilometres(1)));
  page.press(copy.changeReference);
  await page.settle();
  page.press(labels.landmarks.yuenLong);
  await page.settle();
  assert.deepEqual(page.rows(), page.nearbyRail().nearbyRailwayRows(landmarks.yuenLong, 500, 'routes', 'lightRail'));
  assert(page.rows().length > 0);
  page.appState('background'); page.appState('active');
  await page.settle();
  assert.equal(page.requests.length, 0);
  assert.equal(page.calls.prompt, 0);
});

for (const railMode of ['mtr', 'lightRail']) {
  test(`nearby ${railMode} preserves mounted rows/scroll on detail return and passive foreground location refresh`, async (t) => {
    const page = mount(t, { transport: true });
    const { labels, transportCopy: copy } = page;
    await page.settle();
    const point = railMode === 'mtr' ? page.landmarks.central : page.landmarks.yuenLong;
    page.fix(0, point); await page.settle();
    page.press(copy.modes[railMode]); await page.settle();
    page.press(copy.straightLineRadius(labels.metres(500))); await page.settle();
    page.press(labels.kilometres(2)); await page.settle();
    page.press(labels.byStop); await page.settle();
    const before = page.rows(); const key = page.list().key;
    const scrolls = page.attachList();
    page.showRows([1], 220); page.openResult(1);
    page.focus(false); page.focus(true); await page.settle();
    assert.equal(page.requests.length, 2);
    assert.equal(page.list().key, key); assert.equal(page.rows(), before);
    page.appState('background'); page.appState('active'); await page.settle();
    assert.equal(page.requests.length, 3);
    page.fix(1, page.landmarks.shaTin); await page.settle();
    assert.equal(page.rows(), before, 'An aborted native fix cannot replace visible rail rows');
    page.fix(2, point); await page.settle(); page.paint();
    assert.equal(page.list().key, key); assert.deepEqual(page.rows(), before);
    assert.deepEqual(scrolls, []);
    assert.deepEqual(page.etaRoutes(), []);
    page.press(copy.modes.all); page.press(copy.modes.mtr); page.press(copy.modes.lightRail); await page.settle();
    assert.equal(page.requests.length, 3, 'Nearby category switches do not restart GPS');
  });
}

test('rail text search cancels nearby GPS and stays idle on refocus/foreground after clearing and searching again', async (t) => {
  const page = mount(t, { transport: true });
  const { transportCopy: copy } = page;
  await page.settle();
  page.press(copy.modes.mtr); await page.settle();
  page.searchInput().onChangeText('RAC'); await page.settle();
  page.fix(0, page.landmarks.shaTin); await page.settle();
  assert.equal(page.rows()[0].id, 'RAC');
  page.openResult(0); page.focus(false); page.focus(true);
  page.appState('background'); page.appState('active'); await page.settle();
  assert.equal(page.requests.length, 1);
  page.press(page.busCopy.clearInput); await page.settle();
  assert.equal(page.requests.length, 2);
  assert.equal(page.rows().length, 0, 'A cancelled fix did not establish a guessed nearby location');
  page.searchInput().onChangeText('ISL'); await page.settle();
  page.fix(1, page.landmarks.central); await page.settle();
  assert.equal(page.rows()[0].id, 'ISL');
  page.focus(false); page.focus(true); page.appState('background'); page.appState('active'); await page.settle();
  assert.equal(page.requests.length, 2);
});

test('All retains a shared reference during delayed bus refresh and cannot overwrite a rapidly selected category', async (t) => {
  const page = mount(t, { transport: true });
  await page.settle(); page.fix(0, page.landmarks.central); await page.settle();
  const old = page.rows();
  page.holdNearby(); page.focus(false); page.focus(true); await page.settle();
  page.fix(1, page.landmarks.yuenLong); await page.settle();
  assert.equal(page.rows(), old, 'All sources retain the same old point until the next bus query completes');
  page.press(page.transportCopy.modes.minibus); await page.settle();
  assert.deepEqual(page.rows(), page.nearbyGmb().nearbyGmbRows(page.landmarks.yuenLong, 500, 'routes'));
  page.press(page.transportCopy.modes.lightRail); await page.settle();
  const rail = page.rows();
  assert(rail.length > 0);
  page.releaseNearby(); await page.settle();
  assert.equal(page.rows(), rail);
  assert(rail.every(({ location }) => location.station.mode === 'lightRail'));
  page.press(page.transportCopy.modes.all); await page.settle();
  assert.deepEqual(new Map(page.rows().filter(({ kind }) => kind === 'nearby-gmb-route').map((row) => [row.id, row])),
    new Map(page.nearbyGmb().nearbyGmbRows(page.landmarks.yuenLong, 500, 'routes').map((row) => [row.id, row])));
  assert.ok(page.rows().some((row) => 'route' in row));
});

test('All keeps offline rail and minibus routes and stops when the bus provider fails at a manual landmark', async (t) => {
  const page = mount(t, { transport: true, permission: blocked, failBusNearby: true, locale: 'en' });
  const { labels, landmarks, transportCopy: copy } = page;
  await page.settle();
  page.press(copy.chooseLandmark); await page.settle();
  page.press(labels.landmarks.yuenLong); await page.settle();
  for (const view of ['routes', 'stops']) {
    if (view === 'stops') { page.press(labels.byStop); await page.settle(); }
    const rows = page.rows();
    assert.ok(page.shows(labels.indexError));
    assert.ok(rows.every((row) => 'kind' in row));
    assert.deepEqual(rows.filter(({ kind }) => kind === 'nearby-railway'), page.nearbyRail().nearbyRailwayRows(landmarks.yuenLong, 500, view));
    const minibusRows = rows.filter(({ kind }) => kind === 'nearby-gmb-route' || kind === 'nearby-gmb-stop');
    const expected = page.nearbyGmb().nearbyGmbRows(landmarks.yuenLong, 500, view);
    assert.ok(expected.length > 0);
    assert.deepEqual(new Map(minibusRows.map((row) => [row.id, row])), new Map(expected.map((row) => [row.id, row])));
  }
  assert.equal(page.requests.length, 0);
  assert.deepEqual(page.gmbPaths, []);
});

test('transport reuses the existing offline bus-stop search adapter and existing detail route without a nearby radius', async (t) => {
  const page = mount(t, { transport: true, permission: blocked });
  await page.settle();
  page.searchInput().onChangeText('北角碼頭'); await page.settle(); await page.waitStopSearch();
  assert(page.rows().some((row) => 'number' in row), 'Existing route search remains available');
  const index = page.rows().findIndex(({ kind }) => kind === 'bus_stop');
  assert(index >= 0);
  const stop = page.rows()[index];
  page.openResult(index);
  assert.deepEqual(page.routes.at(-1), { pathname: '/bus/nearby/stop', params: { source: stop.source, stopId: stop.stopId } });
  assert.equal(page.requests.length, 0);
  page.focus(false); page.focus(true); page.appState('background'); page.appState('active'); await page.settle();
  assert.equal(page.requests.length, 0);
});


for (const locale of ['zh-HK', 'en']) {
  test(`minibus filter searches all regions and opens a variant without GPS or ETA (${locale})`, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const page = mount(t, { transport: true, locale, permission: blocked });
    await page.settle();
    page.press(page.transportCopy.modes.minibus);
    await page.settle();
    assert.equal(page.searchInput().placeholder, page.gmbCopy.nearbySearch);
    assert.ok(page.findAction(page.transportCopy.openSettings));
    const originalRequests = page.requests.length;
    page.searchInput().onChangeText('２');
    await page.settle();
    assert.ok(page.shows(page.gmbCopy.loadingSearch));
    t.mock.timers.tick(250);
    await page.settle();
    assert.deepEqual(page.rows().map(({ service }) => service.routeId), [2006474, 2006475, 2009246, 2002342, 2002344, 2002349]);
    const special = page.rowElements(5).find(({ type }) => type === 'Pressable');
    assert.match(special.props.accessibilityLabel, locale === 'en' ? /New Territories.*Special Departure/ : /新界.*特別班次/);
    page.openResult(5);
    assert.deepEqual(page.routes.at(-1), { pathname: '/minibus/[id]', params: { id: '2002349' } });
    assert.equal(page.requests.length, originalRequests);
    assert.deepEqual(page.gmbPaths, ['/route', '/route/HKI/2', '/route/KLN/2', '/route/NT/2']);
    page.searchInput().onChangeText('99999');
    await page.settle();
    t.mock.timers.tick(250);
    await page.settle();
    assert.ok(page.shows(page.gmbCopy.noMatches));
    page.press(page.busCopy.clearInput);
    await page.settle();
    assert.ok(page.findAction(page.transportCopy.openSettings));
  });
}

test('minibus detail retains repeated visits and withholds ambiguous ETA', async (t) => {
  const page = mount(t, { gmbDetail: { id: '2006474' } });
  await page.settle();
  const name = '香港站小巴總站';
  const first = page.gmbCopy.stopLabel(1, name);
  const last = page.gmbCopy.stopLabel(11, name);
  assert.equal(page.findAction(first).props.accessibilityState.expanded, false);
  assert.equal(page.findAction(last).props.accessibilityState.expanded, false);
  page.press(first);
  await page.settle();
  assert.ok(page.shows(page.gmbCopy.etaAmbiguous));
  page.press(last);
  await page.settle();
  assert.equal(page.findAction(first).props.accessibilityState.expanded, false);
  assert.equal(page.findAction(last).props.accessibilityState.expanded, true);
  assert.ok(page.shows(page.gmbCopy.etaAmbiguous));
  assert.deepEqual(page.gmbPaths, ['/route/2006474', '/route-stop/2006474/1']);
});

for (const locale of ['zh-HK', 'en']) {
  test(`Minibus detail saves and removes the exact visit with a bilingual accessible action (${locale})`, async (t) => {
    const page = mount(t, { gmbDetail: { id: '2006474' }, locale });
    await page.settle();
    const first = gmbFixture.circular.data.route_stops[0];
    page.press(page.gmbCopy.stopLabel(first.stop_seq, locale === 'en' ? first.name_en : first.name_tc));
    await page.settle();
    const favoriteAction = () => page.visibleElements().find(({ props }) => props.accessibilityLabel?.includes(' · ')
      && props.accessibilityState?.selected !== undefined);
    const save = favoriteAction();
    assert.ok(save.props.accessibilityLabel.includes(locale === 'en' ? 'Save' : '收藏'));
    const [touchArea] = save.props.style({ pressed: false });
    assert.equal(touchArea.minHeight, 44);
    assert.equal(touchArea.minWidth, 44);
    assert.equal(touchArea.borderWidth, undefined);
    const actionText = (button) => button.props.children[1].props;
    assert.equal(actionText(save).children, locale === 'en' ? 'Save' : '收藏');
    assert.equal(actionText(save).numberOfLines, undefined);
    assert.equal(save.props.children[0].props.children.props.name, 'bookmark');
    save.props.onPress();
    await page.settle();
    assert.deepEqual([...page.savedGmb.keys()], ['2006474:1:1:' + gmbFixture.circular.data.route_stops[0].stop_id]);
    const saved = favoriteAction();
    assert.equal(saved.props.accessibilityState.selected, true);
    assert.ok(saved.props.accessibilityLabel.startsWith(locale === 'en' ? 'Remove from saved' : '取消收藏'));
    assert.equal(actionText(saved).children, locale === 'en' ? 'Saved' : '已收藏');
    assert.equal(saved.props.children[0].props.children.props.name, 'bookmark.fill');
    assert.ok(saved.props.children[0].props.style[1].backgroundColor);
    assert.equal(page.findAction(page.gmbCopy.stopLabel(first.stop_seq, locale === 'en' ? first.name_en : first.name_tc))
      .props.accessibilityState.expanded, true);
    favoriteAction().props.onPress();
    await page.settle();
    assert.equal(page.savedGmb.size, 0);
    assert.equal(favoriteAction().props.accessibilityState.selected, false);
    assert.deepEqual(page.gmbPaths, ['/route/2006474', '/route-stop/2006474/1'], 'Ambiguous circular ETA is still withheld');
  });
}

test('minibus detail requests just the selected visit, labels planned service and clears on direction change', async (t) => {
  const page = mount(t, { gmbDetail: { id: '2009246' }, locale: 'en' });
  await page.settle();
  assert.deepEqual(page.gmbPaths, ['/route/2009246', '/route-stop/2009246/1']);
  const forward = page.gmbCopy.stopLabel(1, 'Whampoa Garden Public Transport Interchange');
  page.press(forward);
  await page.settle();
  assert.ok(page.shows(page.gmbCopy.scheduled));
  assert.ok(page.findAction(page.gmbCopy.refresh));
  assert.deepEqual(page.gmbPaths, ['/route/2009246', '/route-stop/2009246/1', '/eta/route-stop/2009246/1/1']);
  page.directionFilters().onSelect('2');
  await page.settle();
  assert.ok(!page.shows(page.gmbCopy.scheduled));
  const reverse = page.gmbCopy.stopLabel(1, 'Festival Walk');
  assert.equal(page.findAction(reverse).props.accessibilityState.expanded, false);
  page.press(reverse);
  await page.settle();
  assert.ok(page.shows(page.gmbCopy.etaFailed));
  assert.deepEqual(page.gmbPaths.slice(-2), ['/route-stop/2009246/2', '/eta/route-stop/2009246/2/1']);
});

test('official minibus snapshot covers the three regions and retains distinct variant, direction and visit IDs', (t) => {
  const snapshot = require('../assets/data/gmb-nearby.json');
  assert.deepEqual(snapshot.counts.codes, { HKI: 107, KLN: 133, NT: 332 });
  assert.equal(snapshot.stops.length, 4773);
  assert.equal(snapshot.stops.reduce((sum, row) => sum + row[3].length, 0), 13107);
  const number2 = snapshot.directions.filter((row) => row[3] === '2');
  assert.deepEqual(new Set(number2.map((row) => row[2])), new Set(['HKI', 'KLN', 'NT']));
  assert.deepEqual(number2.filter((row) => row[0] === 2009246).map((row) => row[1]), [1, 2]);
  assert.ok(number2.some((row) => row[0] === 2002349));
  const page = mount(t);
  const { nearbyGmbRows, searchGmbStopNames } = page.nearbyGmb();
  const station = searchGmbStopNames('Hong Kong Station Minibus Terminus').find(({ id }) => id === '20014492').stop;
  const circular = station.visits.filter(({ routeId }) => routeId === 2006474);
  assert.deepEqual(circular.map(({ stopSeq, boarding }) => [stopSeq, boarding]), [[1, true], [11, false]]);
  assert.ok(station.visits.some(({ routeId }) => routeId === 2006475));
  assert.ok(searchGmbStopNames('香港站小巴總站').some(({ id }) => id === '20014492'));
  const stopResults = nearbyGmbRows(station.coordinate, 500, 'stops');
  assert.equal(stopResults.filter(({ id }) => id === '20014492').length, 1);
  const routeResults = nearbyGmbRows(station.coordinate, 500, 'routes');
  assert.equal(routeResults.find(({ id }) => id === '2006474:1').visit.stopSeq, 1);
  assert.equal(routeResults.find(({ id }) => id === '2006475:1').visit.stopSeq, 1);
});

test('nearby minibus respects all radius boundaries, distinct collocated stop IDs and boarding eligibility', (t) => {
  const { nearbyGmbRows } = mount(t).nearbyGmb();
  const center = { latitude: 22.31, longitude: 114.17 };
  const location = (meters) => ({ ...center, latitude: center.latitude + (meters / 6_371_008.8) * (180 / Math.PI) });
  const name = { tc: '測試站', en: 'Test stop', sc: null };
  const visit = (stopId, stopSeq, boarding, routeId = 10) => ({ stopId, stopSeq, boarding, routeId, routeSeq: 1, name });
  const stop = (stopId, meters, visits) => ({ stopId, coordinate: location(meters), name, visits });
  const stops = [
    stop(1, 3, [visit(1, 1, false), visit(1, 1, true, 20)]),
    stop(2, 499.9, [visit(2, 4, true), visit(2, 9, true)]),
    stop(3, 499.9, [visit(3, 5, true, 30)]),
    stop(4, 500.1, [visit(4, 5, true)]),
    stop(5, 999.9, [visit(5, 5, true)]),
    stop(6, 1000.1, [visit(6, 6, true)]),
    stop(7, 1999.9, [visit(7, 7, true)]),
    stop(8, 2000.1, [visit(8, 8, true)]),
  ];
  const boundary = [stop(1, 299.999, [visit(1, 1, true)]), stop(2, 300.001, [visit(2, 1, true)])];
  assert.deepEqual(nearbyGmbRows(center, 300, 'stops', boundary).map(({ id }) => id), ['1']);
  assert.deepEqual(nearbyGmbRows(center, 300, 'routes', boundary).map(({ visit }) => visit.stopId), [1]);
  assert.deepEqual(nearbyGmbRows(center, 500, 'stops', stops).map(({ id }) => id), ['1', '2', '3']);
  assert.deepEqual(nearbyGmbRows(center, 1000, 'stops', stops).map(({ id }) => id), ['1', '2', '3', '4', '5']);
  assert.deepEqual(nearbyGmbRows(center, 2000, 'stops', stops).map(({ id }) => id), ['1', '2', '3', '4', '5', '6', '7']);
  const routes = nearbyGmbRows(center, 2000, 'routes', stops);
  assert.deepEqual(routes.map(({ visit }) => [visit.routeId, visit.stopId, visit.stopSeq]), [[20, 1, 1], [10, 2, 4], [30, 3, 5]]);
});

for (const locale of ['zh-HK', 'en']) {
  test(`minibus nearby uses shared radius and routes by direction, and stop selection passes the exact visit (${locale})`, async (t) => {
    const page = mount(t, { transport: true, locale });
    await page.settle();
    const point = page.nearbyGmb().searchGmbStopNames('Hong Kong Station Minibus Terminus')
      .find(({ id }) => id === '20014492').stop.coordinate;
    page.press(page.transportCopy.modes.minibus);
    await page.settle();
    assert.ok(page.shows(page.transportCopy.locating));
    page.fix(0, point);
    await page.settle();
    assert.equal(page.requests.length, 1);
    assert.deepEqual(page.rows(), page.nearbyGmb().nearbyGmbRows(point, 500, 'routes'));
    assert.ok(page.rows().length > 0);
    const visit = page.rows()[0].visit;
    page.openResult(0);
    assert.deepEqual(page.routes.at(-1), { pathname: '/minibus/[id]', params: { id: String(visit.routeId), routeSeq: String(visit.routeSeq) } });
    page.press(page.labels.byStop);
    await page.settle();
    assert.ok(page.shows(page.transportCopy.nearbyStops));
    page.press(page.transportCopy.straightLineRadius(page.labels.metres(500)));
    await page.settle();
    page.press(page.labels.kilometres(2));
    await page.settle();
    assert.deepEqual(page.rows(), page.nearbyGmb().nearbyGmbRows(point, 2000, 'stops'));
    const index = page.rows().findIndex(({ id }) => id === '20014492');
    page.openResult(index);
    await page.settle();
    const actions = page.rowElements(index).filter(({ type }) => type === 'Pressable');
    assert.ok(actions.some(({ props }) => props.accessibilityState?.disabled && props.accessibilityLabel.includes(page.gmbCopy.dropOff)));
    const first = page.rows()[index].stop.visits.find(({ boarding }) => boarding);
    actions.find(({ props }) => props.accessibilityState?.disabled === false).props.onPress();
    assert.deepEqual(page.routes.at(-1), { pathname: '/minibus/[id]', params: {
      id: String(first.routeId), routeSeq: String(first.routeSeq), stopSeq: String(first.stopSeq), stopId: '20014492',
    } });
    page.searchInput().onChangeText(locale === 'en' ? 'Hong Kong Station Minibus Terminus' : '香港站小巴總站');
    await page.settle();
    assert.ok(page.rows().some(({ id, distance }) => id === '20014492' && distance === undefined));
    page.press(page.busCopy.clearInput);
    await page.settle();
    assert.deepEqual(page.rows(), page.nearbyGmb().nearbyGmbRows(point, 2000, 'stops'));
    assert.deepEqual(page.gmbPaths, [], 'Nearby and stop-name search are offline with no ETA fan-out');
  });
}

test('minibus distinguishes failed location from empty results and permits a manual landmark', async (t) => {
  const page = mount(t, { transport: true });
  await page.settle();
  page.press(page.transportCopy.modes.minibus);
  await page.settle();
  page.failFix(0);
  await page.settle();
  assert.ok(page.shows(page.labels.issues.failed));
  assert.equal(page.unavailableTitle(), undefined);
  page.press(page.transportCopy.chooseLandmark);
  await page.settle();
  page.press(page.labels.landmarks.central);
  await page.settle();
  assert.deepEqual(page.rows(), page.nearbyGmb().nearbyGmbRows(page.landmarks.central, 500, 'routes'));
  assert.ok(page.rows().length > 0);
  assert.equal(page.calls.prompt, 0);
});

test('minibus nearby deep link selects official direction and validates stop identity before ETA', async (t) => {
  const page = mount(t, { gmbDetail: { id: '2009246', routeSeq: '2', stopSeq: '1', stopId: '20000418' }, locale: 'en' });
  await page.settle();
  assert.equal(page.directionFilters().selected, '2');
  assert.ok(page.shows(page.gmbCopy.visitChanged));
  assert.equal(page.findAction(page.gmbCopy.stopLabel(1, 'Festival Walk')).props.accessibilityState.expanded, false);
  assert.deepEqual(page.gmbPaths, ['/route/2009246', '/route-stop/2009246/2']);
});

test('minibus nearby deep link can open a matching stop, while a retired direction is disclosed', async (t) => {
  const exact = mount(t, { gmbDetail: { id: '2009246', routeSeq: '2', stopSeq: '1', stopId: '20013966' }, locale: 'en' });
  await exact.settle();
  assert.equal(exact.directionFilters().selected, '2');
  assert.equal(exact.findAction(exact.gmbCopy.stopLabel(1, 'Festival Walk')).props.accessibilityState.expanded, true);
  assert.deepEqual(exact.gmbPaths, ['/route/2009246', '/route-stop/2009246/2', '/eta/route-stop/2009246/2/1']);
  const retired = mount(t, { gmbDetail: { id: '2006474', routeSeq: '2' }, locale: 'en' });
  await retired.settle();
  assert.ok(retired.shows(retired.gmbCopy.directionChanged));
  assert.deepEqual(retired.gmbPaths, ['/route/2006474', '/route-stop/2006474/1']);
});

for (const locale of ['zh-HK', 'en']) {
  test(`Ferry search separates citywide routes and piers from nearby distances (${locale})`, async (t) => {
    const page = mount(t, { transport: true, locale, permission: blocked, ferryPreview: true });
    const copy = page.ferryNearbyCopy();
    await page.settle();
    page.press(page.transportCopy.modes.ferry);
    await page.settle();
    assert.equal(page.searchInput().placeholder, page.ferryCopy.search);
    assert.ok(page.findAction(page.transportCopy.openSettings));
    assert.deepEqual(page.rows(), []);
    page.press(page.transportCopy.chooseLandmark);
    await page.settle();
    page.press(page.labels.landmarks.central);
    await page.settle();
    assert.equal(page.rows().length, 3);
    page.press(page.transportCopy.straightLineRadius(page.labels.metres(500)));
    await page.settle();
    page.press(page.labels.kilometres(2));
    await page.settle();
    const search = locale === 'en' ? 'Central Pier 6' : '中環６號碼頭';
    page.searchInput().onChangeText(search);
    await page.settle();
    assert.ok(page.shows(copy.searchRoutes));
    assert.deepEqual(page.rows().map(({ id, distance }) => [id, distance]),
      [['hkkf:route:3:outbound', undefined], ['hkkf:route:3:inbound', undefined]]);
    page.press(copy.byPier);
    await page.settle();
    assert.ok(page.shows(copy.searchPiers));
    assert.deepEqual(page.rows().map(({ id, distance }) => [id, distance]), [['hkkf:pier:2', undefined]]);
    page.openResult(0);
    await page.settle();
    const directions = page.rowElements(0).filter(({ type }) => type === 'Pressable');
    assert.equal(directions.length, 2);
    directions[1].props.onPress();
    assert.deepEqual(page.routes.at(-1), { pathname: '/ferry/[id]', params: { id: '3', operatorId: 'hkkf', direction: 'outbound' } });
    page.focus(false);
    page.focus(true);
    await page.settle();
    assert.equal(page.searchInput().value, search);
    assert.ok(page.shows(copy.searchPiers));
    assert.equal(page.rowElements(0).filter(({ type }) => type === 'Pressable').length, 2);
    page.searchInput().onChangeText('xxxxxxxx');
    await page.settle();
    assert.ok(page.shows(copy.noPierMatches));
    page.press(page.busCopy.clearInput);
    await page.settle();
    assert.ok(page.shows(copy.nearbyPiers));
    assert.ok(page.shows(page.labels.kilometres(2)));
    assert.deepEqual(new Set(page.rows().map(({ id }) => id)), new Set(['hkkf:pier:1', 'hkkf:pier:2']));
    assert.ok(page.rows().every(({ distance }) => Number.isFinite(distance)));
    assert.equal(page.requests.length, 0);
    assert.deepEqual(page.ferryPaths, []);
  });
}

test('Ferry nearby uses the current fix, sorts departures by boarding distance and prefills the exact inbound direction', async (t) => {
  const page = mount(t, { transport: true, ferryPreview: true, locale: 'en' });
  await page.settle();
  page.press(page.transportCopy.modes.ferry);
  await page.settle();
  assert.ok(page.shows(page.transportCopy.locating));
  const point = { latitude: 22.284587, longitude: 114.037164 };
  page.fix(page.requests.length - 1, point);
  await page.settle();
  assert.deepEqual(page.rows().map(({ id }) => id), ['hkkf:route:3:inbound', 'hkkf:route:4:outbound']);
  assert.ok(page.rowElements(0).some(({ props }) => props.children === 'From Peng Chau Pier'));
  assert.ok(page.rowElements(0).some(({ props }) => props.children === 'To Central Pier 6 (West Berth)'));
  page.openResult(0);
  const { params } = page.routes.at(-1);
  assert.deepEqual(params, { id: '3', operatorId: 'hkkf', direction: 'inbound' });
  const detail = mount(t, { ferryPreview: true, ferryDetail: params, locale: 'en' });
  await detail.settle();
  assert.equal(detail.directionFilters().selected, 'inbound');
  assert.deepEqual(detail.ferryPaths, ['time_table/3/inbound']);
  assert.deepEqual(page.ferryPaths, []);
});

test('Ferry nearby distinguishes a failed fix from an empty radius and supports the next radius', async (t) => {
  const page = mount(t, { transport: true, ferryPreview: true, locale: 'en' });
  const copy = page.ferryNearbyCopy();
  await page.settle();
  page.press(page.transportCopy.modes.ferry);
  await page.settle();
  page.failFix(page.requests.length - 1);
  await page.settle();
  assert.ok(page.findAction(page.labels.useLocation));
  assert.ok(!page.shows(copy.noNearbyRoutes(page.labels.metres(500))));
  page.press(page.labels.useLocation);
  await page.settle();
  page.fix(page.requests.length - 1, { latitude: 22.292, longitude: 114.161 });
  await page.settle();
  assert.ok(page.shows(copy.noNearbyRoutes(page.labels.metres(500))));
  page.press(page.labels.expand(page.labels.kilometres(1)));
  await page.settle();
  assert.equal(page.rows().length, 3);
});

test('Ferry nearby snapshot matches all six source records and eight audited departure directions', (t) => {
  const { hkkfNearbyPiers, searchHkkfNearbyCatalogue } = mount(t).nearbyFerry();
  const expected = {
    1: ['1:outbound', '2:outbound'], 2: ['3:outbound'], 3: ['2:inbound'],
    4: ['3:inbound', '4:outbound'], 5: ['1:inbound'], 6: ['4:inbound'],
  };
  assert.equal(hkkfNearbyPiers.length, 6);
  for (const [index, pier] of hkkfNearbyPiers.entries()) {
    const id = index + 1;
    assert.equal(pier.id, 'hkkf:pier:' + id);
    const { lat, long } = hkkfFixture.piers[id].data;
    assert.deepEqual(pier.point, { latitude: lat, longitude: long });
    assert.deepEqual(pier.sailings.map((item) => item.id.replace('hkkf:route:', '')), expected[id]);
    assert.ok(pier.sailings.every(({ direction }) => direction.originPierId === pier.id && direction.destinationPierId !== pier.id));
  }
  assert.equal(searchHkkfNearbyCatalogue('Central ↔ Yung Shue Wan', 'routes').length, 2);
  assert.equal(searchHkkfNearbyCatalogue('坪洲往來喜靈洲', 'routes').length, 2);
  assert.equal(searchHkkfNearbyCatalogue('喜靈洲碼頭', 'stops')[0].id, 'hkkf:pier:6');
});

test('Ferry nearby radius boundaries and deduplication use metres and official identities', (t) => {
  const { hkkfNearbyPiers, nearbyHkkfRows } = mount(t).nearbyFerry();
  const center = { latitude: 22.28, longitude: 114.16 };
  const pointAt = (metres) => ({ ...center, latitude: center.latitude + (metres / 6371008.8) * 180 / Math.PI });
  for (const radius of [500, 1000, 2000]) {
    const [first, second] = hkkfNearbyPiers;
    const inside = { ...first, point: pointAt(radius - 0.001), sailings: [...first.sailings, first.sailings[0]] };
    const outside = { ...second, point: pointAt(radius + 0.001) };
    assert.deepEqual(nearbyHkkfRows(center, radius, 'stops', [outside, inside, inside]).map(({ id }) => id), [first.id]);
    assert.deepEqual(nearbyHkkfRows(center, radius, 'routes', [outside, inside, inside]).map(({ id }) => id),
      first.sailings.map(({ id }) => id));
    const collocated = { ...second, point: inside.point };
    assert.equal(nearbyHkkfRows(center, radius, 'stops', [inside, collocated]).length, 2);
  }
});

test('Ferry production placeholder and direct link stay closed', async (t) => {
  const page = mount(t, { transport: true, permission: blocked, ferryPreview: true, development: false });
  await page.settle();
  page.press(page.transportCopy.modes.ferry);
  await page.settle();
  assert.ok(page.shows(page.transportCopy.unavailable(page.transportCopy.modes.ferry)));
  assert.equal(page.searchInput(), undefined);
  assert.deepEqual(page.ferryPaths, []);
  const detail = mount(t, { ferryDetail: { id: '3', operatorId: 'hkkf' } });
  await detail.settle();
  assert.ok(detail.shows(detail.ferryCopy.unavailable));
  assert.deepEqual(detail.ferryPaths, []);
});

function chooseFerryFilter(page, value) {
  const selector = page.visibleElements().find(({ type, props }) => type === 'Filters'
    && props.options.some(([key]) => key === value));
  assert.ok(selector, value);
  selector.props.onSelect(value);
}

test('Ferry direction buttons keep bilingual destination labels to one line and stay accessible', async (t) => {
  for (const [locale, labels, fullPier] of [
    ['zh-HK', ['往索罟灣', '往中環 4 號碼頭'], '中環4號渡輪碼頭'],
    ['en', ['To Sok Kwu Wan', 'To Central Pier 4'], 'Central Pier 4'],
  ]) {
    const page = mount(t, { ferryPreview: true, ferryDetail: { id: '1', operatorId: 'hkkf' }, locale });
    await page.settle();
    const directions = () => page.visibleElements().find(({ type, props }) => type === 'Filters'
      && props.options[0][0] === 'outbound').props;
    const filters = page.renderFilters(directions());
    assert.equal(filters.props.style.flexWrap, 'wrap');
    for (const [index, button] of filters.props.children.entries()) {
      const label = button.props.children.props;
      assert.equal(label.children, labels[index]);
      assert.equal(button.props.accessibilityLabel, labels[index]);
      assert.equal(label.numberOfLines, 1);
      assert.equal(label.ellipsizeMode, 'tail');
      assert.equal(label.style.maxWidth, '100%');
      assert.equal(label.allowFontScaling, undefined);
      const buttonStyle = Object.assign({}, ...button.props.style({ pressed: false }));
      assert.equal(buttonStyle.minHeight, 44);
      assert.equal(buttonStyle.minWidth, 44);
      assert.equal(buttonStyle.maxWidth, '100%');
    }
    assert.ok(page.shows(fullPier), 'Full pier name remains in the information card');
    filters.props.children[1].props.onPress();
    await page.settle();
    assert.equal(directions().selected, 'inbound');
    const selected = page.renderFilters(directions()).props.children[1];
    assert.equal(selected.props.accessibilityState.selected, true);
    assert.equal(selected.props.children.props.tone, 'onPrimary');
    assert.deepEqual(page.ferryPaths, ['time_table/1/outbound', 'time_table/1/inbound']);
  }
});

test('Ferry detail shows verified harbour berths, Hong Kong midnight and selected directions', async (t) => {
  const page = mount(t, { ferryPreview: true, ferryDetail: { id: '3', operatorId: 'hkkf' }, locale: 'en' });
  await page.settle();
  assert.ok(page.shows('Central Pier 6 (West Berth)'));
  assert.ok(page.shows('Peng Chau Pier'));
  assert.ok(page.shows(page.ferryCopy.scheduled));
  assert.ok(page.shows(page.ferryCopy.next));
  assert.ok(page.shows('00:30'));
  assert.ok(page.visibleElements().some(({ props }) => String(props.children).includes(page.ferryCopy.previousServiceDay)));
  chooseFerryFilter(page, 'mondayToSaturday');
  await page.settle();
  assert.ok(page.visibleElements().some(({ props }) => String(props.children).includes(page.ferryCopy.nextDay)));
  assert.deepEqual(page.ferryPaths, ['time_table/3/outbound'], 'Changing the day type is local');
  chooseFerryFilter(page, 'inbound');
  await page.settle();
  assert.deepEqual(page.ferryPaths, ['time_table/3/outbound', 'time_table/3/inbound']);
  assert.ok(page.shows('03:40'));
  assert.ok(!page.shows('00:30'));
  page.press(page.ferryCopy.calendarSource);
  assert.match(page.openedLinks.at(-1), /^https:\/\/data.gov.hk\//);
});

test('Ferry detail surfaces optional service, failed fetch, empty timetable and unconfirmed holiday calendar', async (t) => {
  const fixture = hkkfFixture.schedules['1/inbound'].csv;
  const page = mount(t, { ferryPreview: true, ferryDetail: { id: '1', operatorId: 'hkkf' },
    ferryNow: Date.parse('2028-01-03T23:55:00+08:00'),
    ferryResponse: (path) => path === 'time_table/1/outbound' ? new Response('unavailable', { status: 500 }) : undefined });
  await page.settle();
  assert.ok(page.shows(page.ferryCopy.scheduleFailed));
  assert.ok(page.findAction(page.busCopy.retry));
  chooseFerryFilter(page, 'inbound');
  await page.settle();
  assert.ok(page.shows(page.ferryCopy.calendarUnknown));
  assert.ok(!page.shows(page.ferryCopy.next));
  chooseFerryFilter(page, 'sundayOrPublicHoliday');
  await page.settle();
  assert.ok(page.shows(page.ferryCopy.notes));
  assert.ok(page.visibleElements().some(({ props }) => String(props.children).includes(page.ferryCopy.optional)));

  const empty = mount(t, { ferryPreview: true, ferryDetail: { id: '1', operatorId: 'hkkf' },
    ferryResponse: () => new Response(fixture.split(/\r?\n/)[0] + '\n') });
  await empty.settle();
  assert.ok(empty.shows(empty.ferryCopy.noDepartures));

  const ended = mount(t, { ferryPreview: true, ferryDetail: { id: '1', operatorId: 'hkkf' },
    ferryNow: Date.parse('2026-11-23T23:59:00+08:00') });
  await ended.settle();
  assert.ok(ended.shows(ended.ferryCopy.ended));
  assert.ok(!ended.shows(ended.ferryCopy.next));
});

test('Ferry catalogue treats pending and failed requests separately from no matches', async (t) => {
  let finish;
  const response = new Promise((resolve) => { finish = resolve; });
  const page = mount(t, { transport: true, ferryPreview: true, permission: blocked, ferryResponse: () => response });
  await page.settle();
  page.searchInput().onChangeText('Central Pier 6');
  await page.settle();
  assert.ok(page.shows(page.ferryCopy.loading));
  assert.ok(!page.shows(page.ferryCopy.noMatches));
  finish(new Response('unavailable', { status: 500 }));
  await page.settle();
  assert.ok(page.shows(page.ferryCopy.searchFailed));
  assert.ok(!page.shows(page.ferryCopy.loading));
  assert.ok(!page.shows(page.ferryCopy.noMatches));
  assert.ok(page.findAction(page.busCopy.retry));
});

for (const locale of ['zh-HK', 'en']) {
  test(`Disabled tram is absent from the picker and a stale tram selection falls back to All (${locale})`, async (t) => {
    const page = mount(t, { transport: true, locale, permission: blocked });
    await page.settle();
    const copy = page.transportCopy;
    assert.deepEqual(page.modeScroller().children.map(({ props }) => props.children[1].props.children),
      ['all', 'bus', 'mtr', 'lightRail', 'minibus', 'ferry'].map((mode) => copy.modes[mode]));
    page.controls()[1].props.onSelect('tram');
    await page.settle();
    assert.equal(page.controls()[1].props.selected, 'all');
    assert.equal(page.searchInput().placeholder, copy.searchAll);
    page.searchInput().onChangeText(locale === 'en' ? 'Admiralty' : '金鐘');
    await page.settle();
    assert.ok(page.rows().some(({ kind }) => kind === 'mtr-station'));
    assert.ok(!page.rows().some(({ kind }) => kind === 'tram_stop' || kind === 'tram_route'));
  });

  test(`Disabled route and stop links render an unavailable screen (${locale})`, async (t) => {
    for (const tramDetail of [
      { kind: 'route', id: '4003', directionId: '2', stopId: '99304', stopSequence: '1' },
      { kind: 'stop', id: '99313' },
    ]) {
      const page = mount(t, { tramDetail, locale });
      await page.settle();
      assert.ok(page.shows(page.tramCopy.notOpen));
      assert.ok(!page.shows(page.tramCopy.source));
      assert.ok(!page.shows(page.tramCopy.sequence));
      assert.ok(!page.shows(page.tramCopy.visits));
      assert.deepEqual(page.routes, []);
    }
  });
}

for (const locale of ['zh-HK', 'en']) {
  test(`Tram nearby preserves manual position, radius, expanded stop and citywide search (${locale})`, async (t) => {
    const page = mount(t, { transport: true, tramEnabled: true, locale, permission: blocked });
    await page.settle();
    page.press(page.transportCopy.modes.tram);
    await page.settle();
    assert.equal(page.searchInput().placeholder, page.tramCopy.search);
    assert.ok(page.findAction(page.transportCopy.openSettings));
    assert.deepEqual(page.rows(), []);
    page.searchInput().onChangeText(locale === 'en' ? 'Kennedy Town Happy Valley' : '堅尼地城 跑馬地');
    await page.settle();
    assert.ok(page.shows(page.tramCopy.cityRoutes));
    assert.deepEqual(page.rows().map(({ key }) => key), ['td:tram:route:4003']);
    page.press(page.busCopy.clearInput);
    await page.settle();
    page.press(page.transportCopy.chooseLandmark);
    await page.settle();
    page.press(page.labels.landmarks.central);
    await page.settle();
    assert.ok(page.shows(page.tramCopy.nearbyRoutes));
    assert.ok(page.shows(page.tramCopy.noNearbyRoutes(page.labels.metres(500))));
    page.press(page.labels.expand(page.labels.kilometres(1)));
    await page.settle();
    assert.ok(page.rows().length > 0);
    page.press(page.labels.byStop);
    await page.settle();
    const within1000 = page.rows().map(({ key }) => key);
    assert.ok(within1000.length > 0);
    page.press(page.transportCopy.straightLineRadius(page.labels.kilometres(1)));
    await page.settle();
    page.press(page.labels.kilometres(2));
    await page.settle();
    assert.ok(within1000.every((key) => page.rows().some((row) => row.key === key)));
    const rows = page.rows();
    const index = rows.findIndex(({ station }) => station.stop.stopId === 99212);
    assert.ok(index >= 0);
    page.openResult(index);
    await page.settle();
    const actions = () => page.rowElements(index).filter(({ type }) => type === 'Pressable');
    assert.equal(actions()[0].props.accessibilityState.expanded, true);
    assert.match(actions()[0].props.accessibilityLabel, locale === 'en' ? /status unverified/ : /營運狀態未核實/);
    assert.match(actions()[1].props.accessibilityLabel, locale === 'en' ? /Eastbound/ : /東行/);
    assert.equal(actions()[0].props.style({ pressed: false })[0].minWidth, 44);
    assert.equal(actions()[1].props.style({ pressed: false })[0].minHeight, 44);
    actions()[1].props.onPress();
    const exact = { kind: 'route', id: '4001', directionId: '2', stopId: '99212', stopSequence: '1' };
    assert.deepEqual(page.routes.at(-1), { pathname: '/tram/[kind]', params: exact });
    page.focus(false);
    page.focus(true);
    await page.settle();
    assert.deepEqual(page.rows(), rows);
    assert.ok(page.shows(page.labels.landmarkReference(page.labels.landmarks.central)));
    assert.ok(page.shows(page.labels.kilometres(2)));
    assert.equal(actions()[0].props.accessibilityState.expanded, true);

    const query = locale === 'en' ? 'Western Market Terminus' : '上環街市(西港城)總站';
    page.searchInput().onChangeText(query);
    await page.settle();
    assert.ok(page.shows(page.tramCopy.cityStops));
    assert.deepEqual(page.rows().map(({ key }) => key), ['td:tram:stop:99140', 'td:tram:stop:99212']);
    assert.ok(page.rows().every((row) => row.kind === 'tram_stop'));
    page.openResult(1);
    assert.deepEqual(page.routes.at(-1), { pathname: '/tram/[kind]', params: { kind: 'stop', id: '99212' } });
    page.focus(false);
    page.focus(true);
    await page.settle();
    assert.equal(page.searchInput().value, query);
    assert.ok(page.findAction(page.labels.byStop).props.accessibilityState.selected);
    page.searchInput().onChangeText('No matching stop 123');
    await page.settle();
    assert.ok(page.shows(page.tramCopy.noMatches));
    page.press(page.busCopy.clearInput);
    await page.settle();
    assert.deepEqual(page.rows(), rows);
    assert.equal(page.requests.length, 0);
    assert.deepEqual(page.ferryPaths, []);
    assert.deepEqual(page.gmbPaths, []);
  });
}

test('Tram GPS failure offers recovery and a GPS fix at Happy Valley highlights the exact visit', async (t) => {
  const page = mount(t, { transport: true, tramEnabled: true, locale: 'en' });
  await page.settle();
  page.press(page.transportCopy.modes.tram);
  await page.settle();
  assert.ok(page.shows(page.transportCopy.locating));
  page.failFix(page.requests.length - 1);
  await page.settle();
  assert.ok(page.shows(page.labels.issues.failed));
  assert.ok(!page.shows(page.tramCopy.noNearbyRoutes(page.labels.metres(500))));
  page.press(page.labels.useLocation);
  await page.settle();
  page.fix(page.requests.length - 1, { latitude: 22.269822, longitude: 114.184151 });
  await page.settle();
  assert.ok(page.shows(page.tramCopy.nearbyHint));
  const index = page.rows().findIndex((row) => row.choice.visit.routeId === 4002 && row.choice.visit.stopId === 99304);
  assert.ok(index >= 0);
  assert.equal(page.rows()[index].choice.visit.directionId, 2);
  page.openResult(index);
  const params = page.routes.at(-1).params;
  assert.deepEqual(params, { kind: 'route', id: '4002', directionId: '2', stopId: '99304', stopSequence: '1' });
  const detail = mount(t, { tramEnabled: true, tramDetail: params, locale: 'en' });
  await detail.settle();
  assert.equal(detail.directionFilters().selected, '2');
  assert.ok(detail.visibleElements().some(({ props }) => Array.isArray(props.children)
    && props.children.join('') === detail.tramCopy.chosenStop + ' · 1'));
});

test('Tram unavailable catalogue is distinct from empty search', async (t) => {
  const page = mount(t, { transport: true, tramEnabled: true, permission: blocked, unavailableTram: true });
  await page.settle();
  page.press(page.transportCopy.modes.tram);
  await page.settle();
  assert.ok(page.shows(page.tramCopy.unavailable));
  assert.ok(!page.shows(page.tramCopy.noMatches));
});

test('Tram route keeps every stop in official order and switches to the actual Happy Valley exit', async (t) => {
  const page = mount(t, { tramEnabled: true, tramDetail: { kind: 'route', id: '4002' }, locale: 'en' });
  await page.settle();
  assert.deepEqual(page.directionFilters().options, [['1', 'Westbound on main line'], ['2', 'Eastbound on main line']]);
  const stationRows = () => page.visibleElements().filter(({ type, props }) => type === 'Pressable'
    && props.accessibilityRole === 'button');
  assert.equal(stationRows().length, 30);
  assert.ok(page.shows('Happy Valley Terminus'));
  page.directionFilters().onSelect('2');
  await page.settle();
  const rows = stationRows();
  assert.equal(rows.length, 31);
  const textRows = rows.slice(0, 5).map(({ props }) => props.children[1].props.children[0].props.children[0].props.children);
  assert.deepEqual(textRows, ['Happy Valley Terminus', 'Colonial Cemetery', "Queen's Road East", 'Leighton Road', 'Hennessy Road']);
  for (const row of rows) assert.equal(row.props.style({ pressed: false })[0].minHeight, 44);
});

test('Tram closed and unverified stops have distinct copy and official links; stop route choices preserve the exact visit', async (t) => {
  const closed = mount(t, { tramEnabled: true, tramDetail: { kind: 'stop', id: '99313' }, locale: 'en' });
  await closed.settle();
  assert.ok(closed.visibleElements().some(({ props }) => props.accessibilityRole === 'alert'
    && props.children === closed.tramCopy.status.temporarily_closed));
  assert.ok(closed.visibleElements().some(({ props }) => typeof props.children === 'string' && /07E.*94W/.test(props.children)));
  assert.ok(!closed.shows(closed.tramCopy.status.unknown));
  assert.ok(!closed.shows(closed.tramCopy.pickDrop[2]));
  closed.press(closed.tramCopy.officialNotice);
  assert.match(closed.openedLinks.at(-1), /hktramways\.com\/en\/service-updates-detail\/141/);
  const unknown = mount(t, { tramEnabled: true, tramDetail: { kind: 'stop', id: '99304' }, locale: 'zh-HK' });
  await unknown.settle();
  assert.ok(!unknown.shows(unknown.tramCopy.status.unknown));
  assert.ok(unknown.shows(unknown.tramCopy.staticStopNote));
  assert.ok(!unknown.shows(unknown.tramCopy.status.temporarily_closed));
  const routes = unknown.visibleElements().filter(({ type, props }) => type === 'Pressable' && props.accessibilityRole === 'button');
  assert.equal(routes.length, 4);
  routes[1].props.onPress();
  const params = unknown.routes.at(-1).params;
  assert.deepEqual(params, { kind: 'route', id: '4002', directionId: '2', stopId: '99304', stopSequence: '1' });
  const route = mount(t, { tramEnabled: true, tramDetail: params });
  await route.settle();
  assert.equal(route.directionFilters().selected, '2');
  assert.ok(route.visibleElements().some(({ type, props }) => type === 'Pressable' && props.accessibilityState?.selected === true));
  const closedRoute = mount(t, { tramEnabled: true, tramDetail: { kind: 'route', id: '4004' }, locale: 'en' });
  await closedRoute.settle();
  assert.ok(closedRoute.shows(closed.tramCopy.status.temporarily_closed));
  assert.ok(closedRoute.findAction(closedRoute.tramCopy.officialNotice));
  assert.ok(!closedRoute.shows(closedRoute.tramCopy.pickDrop[2]));
});

for (const locale of ['zh-HK', 'en']) {
  test(`Tram stop shows one source note and reserves status cards for evidence (${locale})`, async (t) => {
    const tramDetail = { kind: 'stop', id: '99304' };
    const unknown = mount(t, { tramEnabled: true, tramDetail, locale });
    await unknown.settle();
    const note = unknown.tramCopy.staticStopNote;
    const elements = unknown.visibleElements();
    assert.equal(elements.filter(({ props }) => props.children === note).length, 1);
    assert.ok(elements.some(({ props }) => Array.isArray(props.children)
      && props.children.some((child) => child?.props?.children === unknown.tramCopy.source)
      && props.children.some((child) => child?.props?.children === note)));
    assert.ok(!unknown.shows(unknown.tramCopy.status.unknown));
    assert.ok(!unknown.shows(unknown.tramCopy.status.active));
    assert.equal(elements.find(({ props }) => props.children === note).props.numberOfLines, undefined);

    const active = mount(t, { tramEnabled: true, tramDetail, locale, tramStatuses: [{
      stopId: 99304, serviceStatus: 'active',
      notice: { url: 'https://www.hktramways.com/en/test-only',
        publishedOn: '2026-11-01', checkedOn: '2026-11-23',
        description: { 'zh-HK': '已核實營運（測試樣本）', en: 'Verified operating (test fixture)' } },
    }] });
    await active.settle();
    assert.ok(active.shows(active.tramCopy.status.active));
    assert.ok(active.findAction(active.tramCopy.officialNotice));
    assert.ok(active.shows(note));
  });
}
