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

function mount(t, { permission = granted, servicesEnabled = true, appState = 'active', locale = 'zh-HK' } = {}) {
  const events = new EventEmitter();
  const requests = [];
  const queries = [];
  const routes = [];
  const calls = { services: 0, permission: 0, prompt: 0 };
  let permissionOnRequest = granted;
  let focused = true;
  let mounted = true;
  let dirty = true;
  let cursor = 0;
  let effects = [];
  let tree;
  const slots = [];

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
  const native = Object.fromEntries(['ActivityIndicator', 'FlatList', 'Pressable', 'View'].map((name) => [name, name]));
  const setVisible = () => {};
  const mocks = {
    react,
    'react-native': { ...native, AppState, StyleSheet: { create: (styles) => styles } },
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
      useFocusEffect: (effect) => load(require.resolve('expo-router/build/useFocusEffect')).useFocusEffect(effect),
    },
    './link/useLoadedNavigation': { useOptionalNavigation: () => navigation },
    './useNavigation': { useNavigation: () => navigation },
    '@/language': { useLanguage: () => ({ locale, copy: source('i18n').messages[locale] }) },
    '@/components/ui': { AppText: 'AppText', EmptyState: 'EmptyState', Icon: 'Icon' },
    '@/database': { getDatabase: async () => ({
      async getAllAsync(sql, ...params) {
        queries.push(params);
        return db.prepare(sql).all(...params);
      },
    }) },
    '@/bus-data': { requestBusJson: () => assert.fail('Unexpected bus network request') },
    '@/nearby-stop-eta-hooks': { useStationEta: () => ({ records: {}, rateLimits: {}, now: 0, setVisible }) },
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
      transpiled.set(filename, new Function('module', 'exports', 'require', code));
    }
    const localRequire = createRequire(filename);
    transpiled.get(filename)(module, module.exports, (id) => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id === '@/nearby-bus-data') return {
        ...source('nearby-bus-data'), prepareNearbyBusIndex: async () => [], kmbNearbyNeedsRefresh: () => false,
      };
      return id.startsWith('@/') ? source(id.slice(2)) : localRequire(id);
    });
    return module.exports;
  }

  const screen = source('app/bus/nearby').default;
  const labels = source('i18n').messages[locale].nearbyBus;
  const landmarks = source('nearby-bus-landmarks').nearbyBusLandmarks;

  async function settle() {
    for (let attempt = 0; attempt < 15; attempt++) {
      if (dirty) {
        dirty = false;
        cursor = 0;
        effects = [];
        tree = screen();
        effects.forEach((run) => run());
      }
      await new Promise(setImmediate);
      if (!dirty) return;
    }
    assert.fail('Nearby bus screen did not settle');
  }

  function elements(node) {
    if (Array.isArray(node)) return node.flatMap(elements);
    return node?.props ? [node, ...elements(node.props.children)] : [];
  }
  function press(label) {
    const action = elements(tree.props.ListHeaderComponent).find(({ type, props }) => type === 'Pressable'
      && (props.accessibilityLabel === label || elements(props.children).some((child) => child.props.children === label)));
    assert.ok(action, `Missing action: ${label}`);
    assert.equal(Boolean(action.props.disabled), false, `Disabled action: ${label}`);
    action.props.onPress();
  }
  function shows(label) {
    return elements([tree.props.ListHeaderComponent, tree.props.ListEmptyComponent]).some(({ props }) => props.children === label);
  }

  function unmount() {
    if (!mounted) return;
    slots.forEach((slot) => slot?.cleanup?.());
    mounted = false;
  }

  t.after(unmount);
  return {
    calls, labels, landmarks, requests, queries, routes, settle, press, shows, unmount,
    rows: () => tree.props.data,
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
