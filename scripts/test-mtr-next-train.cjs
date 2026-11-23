const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { existsSync, readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { join } = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

const root = join(__dirname, '..', 'src');
const compiled = new Map();

function sources(mocks = {}, runtime = {}) {
  const modules = new Map();
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename).exports;
    if (!compiled.has(filename)) {
      const js = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
      } }).outputText;
      compiled.set(filename, new Function('module', 'exports', 'require', 'setInterval', 'clearInterval', js));
    }
    const module = { exports: {} };
    modules.set(filename, module);
    const local = createRequire(filename);
    compiled.get(filename)(module, module.exports, (id) => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      return id.startsWith('@/') ? source(id.slice(2)) : local(id);
    }, runtime.setInterval ?? setInterval, runtime.clearInterval ?? clearInterval);
    return module.exports;
  }
  function source(name) {
    const filename = join(root, name + '.ts');
    return load(existsSync(filename) ? filename : filename + 'x');
  }
  return source;
}

const source = sources();
const { findMtrStation, mtrStations } = source('mtr-static');
const { parseHongKongTime, formatHongKongTime, mtrForecastView, parseMtrForecast, supportsMtrForecast, mtrServiceAlertUrl } =
  source('mtr-realtime');
const { createMtrNextTrainClient } = source('mtr-next-train-client');
const timestamp = '2026-11-21 23:59:50';
const wall = Date.parse('2026-11-21T15:59:50Z');
const start = { wall, monotonic: 5000 };

function body(pair, up = [], down = [], at = timestamp, extra = {}) {
  return {
    status: 1, sys_time: at, curr_time: at, isdelay: 'N',
    data: { [pair]: { UP: up, DOWN: down, curr_time: at, sys_time: at } },
    ...extra,
  };
}
function train(dest, seq = '1', overrides = {}) {
  return { dest, seq, plat: '2', time: '2026-11-22 00:01:00', ttnt: '0', valid: 'N', ...overrides };
}
function reading(payload, extra = {}) {
  return { payload, receivedAt: start, serverNow: wall, retryAt: start.monotonic + 20_000, ...extra };
}
function clockAfter(ms) {
  return { wall: wall + ms, monotonic: start.monotonic + ms };
}
function nextTick() {
  return new Promise(setImmediate);
}

test('validated line/station pairs preserve all documented static memberships and reject mismatches', () => {
  const memberships = mtrStations.flatMap(({ id, memberships }) => memberships.map(({ lineCode }) => [lineCode, id]));
  assert.equal(memberships.length, 121);
  assert.ok(memberships.every(([line, station]) => supportsMtrForecast(line, station)));
  for (const pair of [['AEL', 'ADM'], ['EAL', 'CEN'], ['ISL', 'RAC'], ['XRL', 'HOK'], ['EAL', 'Admiralty']]) {
    assert.equal(supportsMtrForecast(...pair), false);
  }
  assert.deepEqual(findMtrStation('HOK').memberships.map(({ stationId }) => stationId), [44, 39]);
  for (const line of ['AEL', 'TCL']) assert.equal(supportsMtrForecast(line, 'HOK'), true);
});

test('two directions, different termini in a direction, provider sequence, and multi-platform labels', () => {
  const payload = parseMtrForecast(body('TKL-TKO',
    [train('LHP', '2'), train('POA', '1'), train('POA', '3', { plat: 'unknown' }), train('LHP', '4', { plat: 2 })],
    [train('NOP', 1), train('TIK', '2')]), 'TKL', 'TKO');
  const view = mtrForecastView(reading(payload), start);
  assert.equal(view.kind, 'ready');
  assert.deepEqual(view.groups.map(({ direction }) => direction), ['UP', 'DOWN']);
  assert.deepEqual(view.groups[0].trains.map(({ destination }) => destination), ['POA', 'LHP', 'POA', 'LHP']);
  assert.deepEqual(view.groups[0].trains.map(({ platform }) => platform), ['2', '2', undefined, '2']);
  assert.deepEqual(view.groups[1].trains.map(({ destination }) => destination), ['NOP', 'TIK']);
  const air = parseMtrForecast(body('AEL-AIR', [train('AWE', '1', { plat: '1/3' })],
    [train('HOK', '1', { plat: '2/4' })]), 'AEL', 'AIR');
  assert.deepEqual(air.groups.map(({ trains }) => trains[0].platform), ['1/3', '2/4']);
});

test('East Rail timeType and timetype record explicit arrival, departure and Racecourse routing', () => {
  const east = parseMtrForecast(body('EAL-ADM', [
    train('LOW', '1', { timeType: 'D', route: 'RAC' }),
    train('LMC', '2', { timetype: 'A' }),
    train('RAC', '3', { timeType: 'D', timetype: 'A' }),
  ]), 'EAL', 'ADM');
  assert.deepEqual(east.groups[0].trains.map(({ timeType, viaRacecourse }) => [timeType, viaRacecourse]),
    [['departure', true], ['arrival', false], ['estimate', false]]);
  const ordinary = parseMtrForecast(body('ISL-ADM', [train('CHW', '1', { timeType: 'A' })]), 'ISL', 'ADM');
  assert.equal(ordinary.groups[0].trains[0].timeType, 'estimate');
});

test('clock math uses HK time across midnight and expires source or client age without a countdown', () => {
  assert.equal(parseHongKongTime(timestamp), wall);
  assert.equal(parseHongKongTime('2026-02-30 19:00:00'), undefined);
  assert.equal(parseHongKongTime('2026-11-21 24:00:00'), undefined);
  assert.equal(formatHongKongTime(wall, true), timestamp);
  const payload = parseMtrForecast(body('TKL-TKO', [
    train('POA', '1', { time: '2026-11-21 23:59:52' }),
    train('LHP', '2'),
  ]), 'TKL', 'TKO');
  const sample = reading(payload);
  assert.deepEqual(mtrForecastView(sample, start).groups[0].trains.map(({ minutes }) => minutes), [1, 2]);
  assert.deepEqual(mtrForecastView(sample, clockAfter(11_000)).groups[0].trains.map(({ minutes }) => minutes), [1]);
  assert.equal(formatHongKongTime(payload.groups[0].trains[1].time), '2026-11-22 00:01');
  assert.deepEqual(mtrForecastView(sample, clockAfter(60_000)), { kind: 'stale' });
  assert.equal(mtrForecastView(reading(payload, { serverNow: wall + 61_000 }), start).kind, 'stale');
  assert.equal(mtrForecastView(reading(payload, { serverNow: wall - 6000 }), start).kind, 'stale');
  assert.equal(mtrForecastView(reading({ ...payload, updatedAt: undefined }), start).kind, 'stale');
  assert.equal(mtrForecastView(sample, { wall: wall - 1000, monotonic: start.monotonic + 60_000 }).kind, 'stale');
});

test('provider no-data, terminus, delays, alert, suspension, unsupported and malformed remain distinct', () => {
  const view = (data, line = 'TKL', station = 'TKO') => mtrForecastView(reading(parseMtrForecast(data, line, station)), start);
  for (const fixture of [body('TKL-TKO'), body('TKL-TKO', [], [], '-'), {
    status: '1', isdelay: 'Y', data: { 'TKL-TKO': { curr_time: '-', sys_time: '-' } },
  }]) assert.equal(view(fixture).kind, 'empty');
  assert.deepEqual(view(body('TKL-TKO', [train('POA')], [], timestamp, { isdelay: 'Y' })).groups.map(({ direction }) => direction), ['UP']);
  assert.equal(view(body('TKL-TKO', [train('POA')], [], timestamp, { isdelay: 'Y' })).delayed, true);
  assert.equal(view({ status: 0, url: mtrServiceAlertUrl, cur_time: timestamp }).kind, 'special');
  assert.equal(view({ status: 0, message: 'LOW station is suspended' }, 'EAL', 'LOW').kind, 'suspended');
  assert.equal(view({ status: 0, message: 'LMC station is suspended' }, 'EAL', 'LMC').kind, 'suspended');
  assert.equal(view({ status: 0, message: 'LOW station is suspended' }, 'EAL', 'ADM').kind, 'failed');
  assert.equal(view({ status: 0, error: { errorCode: 'NT-204' } }).kind, 'failed');
  assert.equal(view({ status: 0, url: 'https://elsewhere.invalid/' }).kind, 'failed');
  for (const fixture of [null, {}, body('TKL-LHP'), body('TKL-TKO', {}), body('TKL-TKO', [train('POA'), train('LHP')]),
    body('TKL-TKO', [{ seq: '1', time: 'wrong', dest: 'POA' }])]) assert.equal(view(fixture).kind, 'failed');
  assert.equal(view({}, 'AEL', 'ADM').kind, 'unsupported');
});

test('client sends only the selected pair and language, coalesces concurrent requests and reuses short cache', async () => {
  let now = start;
  let finish;
  const calls = [];
  const read = createMtrNextTrainClient({
    clock: () => now,
    request: (url, options) => { calls.push({ url: new URL(url), options }); return new Promise((resolve) => { finish = resolve; }); },
  });
  assert.equal((await read('AEL', 'ADM')).payload.kind, 'unsupported');
  assert.equal(calls.length, 0);
  const first = read('AEL', 'HOK');
  assert.equal(read('AEL', 'HOK'), first);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.origin, 'https://rt.data.gov.hk');
  assert.equal(calls[0].url.pathname, '/v1/transport/mtr/getSchedule.php');
  assert.deepEqual([...calls[0].url.searchParams], [['line', 'AEL'], ['sta', 'HOK'], ['lang', 'EN']]);
  assert.equal(calls[0].options.credentials, 'omit');
  finish(new Response(JSON.stringify(body('AEL-HOK')), { headers: { date: new Date(wall - 10_000).toUTCString(), age: '5' } }));
  const loaded = await first;
  assert.equal(loaded.serverNow, wall - 5000);
  assert.equal(await read('AEL', 'HOK'), loaded);
  now = clockAfter(20_000);
  const after = read('AEL', 'HOK');
  assert.equal(calls.length, 2);
  finish(new Response('', { status: 500 }));
  assert.equal((await after).payload.kind, 'failed');

  const distinct = read('TCL', 'HOK');
  assert.equal(calls[2].url.searchParams.get('line'), 'TCL');
  finish(new Response('not JSON', { status: 200 }));
  assert.equal((await distinct).payload.kind, 'failed');
});

test('client honors Retry-After seconds and HTTP-date plus a default backoff when missing', async () => {
  for (const retryAfter of ['90', new Date(wall + 90_000).toUTCString(), undefined]) {
    let now = start;
    let count = 0;
    const wait = retryAfter ? 90_000 : 60_000;
    const headers = { date: new Date(wall).toUTCString(), ...(retryAfter ? { 'retry-after': retryAfter } : {}) };
    const read = createMtrNextTrainClient({
      clock: () => now,
      request: async () => {
        count++;
        return count === 1 ? new Response('', { status: 429, headers }) : new Response('', { status: 500 });
      },
    });
    const limited = await read('TKL', 'TKO');
    assert.equal(limited.payload.kind, 'rateLimited');
    assert.equal(limited.retryAt, start.monotonic + wait);
    now = clockAfter(wait - 1);
    assert.equal((await read('AEL', 'AIR')).payload.kind, 'rateLimited');
    assert.equal(count, 1);
    now = clockAfter(wait);
    assert.equal((await read('AEL', 'AIR')).payload.kind, 'failed');
    assert.equal(count, 2);
  }
});

test('timeout aborts a hung call and a network rejection stays recoverable', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  const read = createMtrNextTrainClient({
    clock: () => start,
    request: (_, options) => { signal = options.signal; return new Promise(() => {}); },
  });
  const hung = read('ISL', 'ADM');
  t.mock.timers.tick(8000);
  assert.equal((await hung).payload.kind, 'failed');
  assert.equal(signal.aborted, true);
  const offline = createMtrNextTrainClient({ request: async () => { throw new Error('offline fixture'); } });
  assert.equal((await offline('ISL', 'ADM')).payload.kind, 'failed');
});

function mountHook(gmbClient) {
  const slots = [];
  const events = new EventEmitter();
  const calls = [];
  const ticks = new Set();
  const app = { currentState: 'active', addEventListener(event, fn) {
    events.on(event, fn);
    return { remove: () => events.off(event, fn) };
  } };
  let cursor = 0;
  let now = start;
  let focused = true;
  let effect;
  let cleanup;
  let callbacks = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (value) => { callbacks++; slots[index] = value; }];
    },
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useCallback(fn, deps) {
      const index = cursor++;
      const previous = slots[index];
      if (previous && deps.every((dep, i) => dep === previous.deps[i])) return previous.fn;
      slots[index] = { fn, deps };
      return fn;
    },
  };

  const load = sources({
    react, 'react-native': { AppState: app },
    'expo-router': { useFocusEffect(fn) {
      if (effect === fn) return;
      cleanup?.();
      effect = fn;
      cleanup = focused ? effect() : undefined;
    } },
    '@/mtr-realtime': { mtrClock: () => now },
    ...(gmbClient ? {
      '@/gmb-client': { gmbClient },
      '@/database': { getDatabase: () => assert.fail('ETA verification is independent of SQLite') },
      '@/bus-data': {},
    } : {}),
    '@/mtr-next-train-client': { readMtrNextTrains: (line, station) =>
      new Promise((resolve) => calls.push({ line, station, resolve })) },
  }, {
    setInterval: (tick, delay) => { assert.equal(delay, 1000); ticks.add(tick); return tick; },
    clearInterval: (id) => ticks.delete(id),
  });
  const useHook = load('mtr-next-train-hooks').useMtrNextTrains;
  const useNextTrainReading = load('next-train-hooks').useNextTrainReading;
  const simulatedClock = () => now;
  const readPinned = gmbClient ? load('home-gmb-eta').readPinnedGmbEta : undefined;
  return {
    renderMinibus(visit) {
      cursor = 0;
      const read = react.useCallback((signal) => readPinned(visit, signal), [visit]);
      return useNextTrainReading('minibus', read, simulatedClock, true);
    },
    render(line, station, autoRefresh = false) { cursor = 0; return useHook(line, station, autoRefresh); },
    renderLightRail(station) {
      cursor = 0;
      const read = react.useCallback(() => new Promise((resolve) => calls.push({ station, resolve })), [station]);
      return useNextTrainReading(station, read, simulatedClock);
    },
    focus(value) {
      focused = value;
      cleanup?.();
      cleanup = value ? effect() : undefined;
    },
    state(value) { app.currentState = value; events.emit('change', value); },
    advance(ms) { now = clockAfter(ms); ticks.forEach((tick) => tick()); },
    calls, ticks, listeners: () => events.listenerCount('change'), callbacks: () => callbacks,
  };
}

test('Home minibus checks exact official stop visits and respects expiry, request limits, focus and AppState', async () => {
  const visit = { routeId: 2009246, routeSeq: 2, stopSeq: 1, stopId: 101 };
  const terminal = { ...visit, stopSeq: 2, stopId: 102 };
  const name = { tc: '站', en: 'Stop', sc: null };
  const visits = [{ ...visit, name }, { ...terminal, name }];
  const directions = [];
  const etas = [];
  const client = {
    readRouteStops(key, signal) {
      assert.deepEqual(key, visit);
      return new Promise((resolve) => directions.push({ signal, resolve }));
    },
    readEta(key, signal) {
      assert.deepEqual(key, visit);
      return new Promise((resolve) => etas.push({ signal, resolve }));
    },
  };
  const verified = (rows = visits) => reading({ kind: 'ready', generatedAt: wall, data: {
    routeId: visit.routeId, routeSeq: visit.routeSeq, visits: rows, updatedAt: wall,
  } });
  const page = mountHook(client);
  const { gmbEtaView } = sources()('gmb-data');
  page.renderMinibus(visit);
  page.state('background');
  assert.equal(directions[0].signal.aborted, true);
  directions[0].resolve(verified());
  await nextTick();
  assert.equal(etas.length, 0, 'Backgrounding stops the chain before ETA');
  assert.equal(page.ticks.size, 0);
  page.state('active');
  directions[1].resolve(verified());
  await nextTick();
  assert.equal(etas.length, 1);
  const entry = { kind: 'scheduled', sequence: 1, timestamp: wall + 300000, diff: 5, remarks: name };
  etas[0].resolve(reading({ kind: 'ready', generatedAt: wall, data: { stopId: visit.stopId, kind: 'forecast', entries: [entry] } },
    { retryAt: start.monotonic + 60_000 }));
  await nextTick();
  function forecast() {
    const { reading: result, now } = page.renderMinibus(visit);
    return gmbEtaView({ ...result, payload: result.payload.eta }, now);
  }
  assert.equal(forecast().entries[0].kind, 'scheduled');
  assert.equal(forecast().entries[0].remainingMinutes, undefined);
  page.advance(59_999);
  assert.equal(directions.length, 2);
  page.advance(60_000);
  directions[2].resolve(verified());
  await nextTick();
  assert.equal(etas.length, 2);
  page.advance(120_000);
  assert.equal(forecast().kind, 'stale');
  etas[1].resolve(reading({ kind: 'timeout' }, { retryAt: start.monotonic + 180_000 }));
  await nextTick();
  assert.equal(forecast().kind, 'timeout');
  page.advance(180_000);
  directions[3].resolve(verified());
  await nextTick();
  etas[2].resolve(reading({ kind: 'rateLimited' }, { retryAt: start.monotonic + 210_000 }));
  await nextTick();
  assert.equal(forecast().kind, 'rateLimited');
  page.advance(209_999);
  assert.equal(directions.length, 4);
  page.advance(210_000);
  directions[4].resolve(verified([{ ...visit, stopId: 103, name }, visits[1]]));
  await nextTick();
  assert.equal(page.renderMinibus(visit).reading.payload.kind, 'changed');
  assert.equal(etas.length, 3, 'A changed stop ID must never request ETA for the new stop');
  page.focus(false);
  assert.equal(page.listeners(), 0);
  assert.equal(page.ticks.size, 0);
  page.focus(true);
  directions[5].resolve(verified([visits[0], { ...terminal, stopId: visit.stopId, name }]));
  await nextTick();
  assert.equal(page.renderMinibus(visit).reading.payload.kind, 'ambiguous');
  assert.equal(etas.length, 3);
  page.focus(false);
});

test('station switches, focus, and AppState ignore old responses and do not poll in background', async () => {
  const page = mountHook();
  const first = page.render('AEL', 'HOK');
  assert.deepEqual(page.calls.map(({ line, station }) => [line, station]), [['AEL', 'HOK']]);
  first.refresh();
  assert.equal(page.calls.length, 1);
  assert.equal(page.ticks.size, 1);
  assert.equal(page.render('TCL', 'HOK').reading, undefined);
  assert.deepEqual(page.calls.map(({ line, station }) => [line, station]), [['AEL', 'HOK'], ['TCL', 'HOK']]);
  assert.equal(page.listeners(), 1);
  const current = reading({ kind: 'special' });
  page.calls[1].resolve(current);
  await nextTick();
  assert.equal(page.render('TCL', 'HOK').reading, current);
  page.calls[0].resolve(reading({ kind: 'failed' }));
  await nextTick();
  assert.equal(page.render('TCL', 'HOK').reading, current);

  page.advance(20_000);
  assert.equal(page.calls.length, 2, 'Countdown tick never polls');
  page.render('TCL', 'HOK').refresh();
  assert.equal(page.calls.length, 3);
  page.state('background');
  assert.equal(page.ticks.size, 0);
  page.render('TCL', 'HOK').refresh();
  assert.equal(page.calls.length, 3);
  const before = page.callbacks();
  page.calls[2].resolve(reading({ kind: 'failed' }));
  page.advance(30_000);
  await nextTick();
  assert.equal(page.callbacks(), before);
  page.state('active');
  assert.equal(page.calls.length, 4);
  assert.equal(page.ticks.size, 1);
  page.state('active');
  assert.equal(page.calls.length, 4);
  page.focus(false);
  assert.equal(page.listeners(), 0);
  assert.equal(page.ticks.size, 0);
  page.advance(70_000);
  const afterBlur = page.callbacks();
  page.calls[3].resolve(reading({ kind: 'suspended' }));
  await nextTick();
  assert.equal(page.callbacks(), afterBlur);
  page.state('active');
  assert.equal(page.calls.length, 4);
  page.focus(true);
  assert.equal(page.calls.length, 5);
  page.focus(false);
});

test('Home rail refresh follows the client retry deadline, pauses off-screen, and rejects late responses', async () => {
  const page = mountHook();
  page.render('ISL', 'ADM', true);
  page.calls[0].resolve(reading({ kind: 'failed' }));
  await nextTick();
  page.advance(19_999);
  assert.equal(page.calls.length, 1);
  page.advance(20_000);
  assert.equal(page.calls.length, 2);
  page.advance(40_000);
  assert.equal(page.calls.length, 2, 'An in-flight request cannot multiply on countdown ticks');
  const limited = reading({ kind: 'rateLimited' }, { retryAt: start.monotonic + 120_000 });
  page.calls[1].resolve(limited);
  await nextTick();
  page.advance(119_999);
  assert.equal(page.calls.length, 2, 'HTTP 429 retryAt takes precedence over the normal refresh interval');
  page.advance(120_000);
  assert.equal(page.calls.length, 3);
  page.state('background');
  assert.equal(page.ticks.size, 0);
  page.calls[2].resolve(reading({ kind: 'unsupported' }));
  await nextTick();
  assert.equal(page.render('ISL', 'ADM', true).reading, limited);
  page.advance(180_000);
  assert.equal(page.calls.length, 3);
  page.state('active');
  assert.equal(page.calls.length, 4);
  page.focus(false);
  page.advance(240_000);
  assert.equal(page.calls.length, 4);
  page.focus(true);
  assert.equal(page.calls.length, 5);
  page.render('EAL', 'ADM', true);
  assert.deepEqual([page.calls.at(-1).line, page.calls.at(-1).station], ['EAL', 'ADM']);
  assert.equal(page.render('EAL', 'ADM', true).reading, undefined);
  page.calls[4].resolve(reading({ kind: 'special' }));
  await nextTick();
  assert.equal(page.render('EAL', 'ADM', true).reading, undefined, 'A previous line cannot overwrite the new Home card');
  page.focus(false);
});

function renderRailUi(locale, sample) {
  let selected;
  let initialized = false;
  const requests = [];
  const copy = source('i18n').messages[locale];
  const load = sources({
    react: { useRef: (current) => ({ current }), useState(initial) {
      if (!initialized) { initialized = true; selected = initial; }
      return [selected, (value) => { selected = value; }];
    } },
    'react-native': {
      ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', View: 'View',
      StyleSheet: { create: (styles) => styles },
    },
    '@/components/ui': { AppText: 'AppText', Filters: 'Filters', Icon: 'Icon' },
    '@/components/railway-favorite-action': { RailwayStationHeading: 'RailwayStationHeading' },
    '@/language': { useLanguage: () => ({ copy, locale }) },
    '@/mtr-next-train-hooks': { useMtrNextTrains(line, station) {
      requests.push([line, station]);
      return { reading: sample, now: start, busy: !sample, refresh() {} };
    } },
  });
  function elements(node) {
    if (Array.isArray(node)) return node.flatMap(elements);
    if (!node?.props) return [];
    return [node, ...elements(node.type.name === 'ForecastCard' ? node.type(node.props) : node.props.children)];
  }
  return {
    requests, copy: copy.mtr.nextTrains,
    render(stationCode, initialLine) {
      return elements(load('components/mtr-next-trains').MtrNextTrains({ station: findMtrStation(stationCode), initialLine }));
    },
  };
}

test('rail preview asks for the line at shared stations and never fetches an invalid context', () => {
  const shared = renderRailUi('en', reading({ kind: 'failed' }));
  const view = shared.render('HOK');
  assert.ok(view.some(({ props }) => props.children === shared.copy.chooseLine));
  const { props: pick } = view.find(({ type }) => type === 'Filters');
  assert.deepEqual(pick.options, [['AEL', 'Airport Express'], ['TCL', 'Tung Chung Line']]);
  assert.deepEqual(shared.requests, []);
  pick.onSelect('TCL');
  const tcl = shared.render('HOK').find(({ type }) => type === 'Filters').props;
  assert.equal(tcl.selected, 'TCL');
  tcl.onSelect('AEL');
  const ael = shared.render('HOK').find(({ type }) => type === 'Filters').props;
  assert.equal(ael.selected, 'AEL');
  assert.deepEqual(shared.requests, [['TCL', 'HOK'], ['AEL', 'HOK']]);
  const fromLine = renderRailUi('en', reading({ kind: 'failed' }));
  fromLine.render('HOK', 'AEL');
  assert.deepEqual(fromLine.requests, [['AEL', 'HOK']]);
  const invalid = renderRailUi('en', reading({ kind: 'failed' }));
  assert.ok(invalid.render('HOK', 'EAL').some(({ props }) => props.children === invalid.copy.chooseLine));
  assert.deepEqual(invalid.requests, []);
});

for (const locale of ['zh-HK', 'en']) {
  test(`rail forecast shows bilingual destinations, grouped directions, update time and platform (${locale})`, () => {
    const sample = reading(parseMtrForecast(body('TKL-TKO',
      [train('POA', '1', { plat: '1/3' }), train('LHP', '2')], [train('TIK')]), 'TKL', 'TKO'));
    const ui = renderRailUi(locale, sample);
    const nodes = ui.render('TKO');
    const texts = nodes.filter(({ type }) => type === 'AppText').map(({ props }) =>
      Array.isArray(props.children) ? props.children.join('') : props.children);
    const [poa, lhp, tik] = locale === 'en' ? ['Po Lam', 'LOHAS Park', 'Tiu Keng Leng'] : ['寶琳', '康城', '調景嶺'];
    assert.ok(texts.includes(ui.copy.towards([poa, lhp].join(ui.copy.destinationSeparator))));
    assert.ok(texts.includes(ui.copy.towards(tik)));
    assert.ok(texts.includes(ui.copy.platform('1/3')));
    assert.ok(texts.includes(ui.copy.updated(timestamp)));
    assert.ok(texts.includes(ui.copy.estimate + ' · 2026-11-22 00:01'));
    assert.ok(!texts.some((text) => text.startsWith(ui.copy.arrival) || text.startsWith(ui.copy.departure)));
    assert.ok(nodes.some(({ props }) => props.accessibilityLabel === ui.copy.refresh));
    assert.deepEqual(ui.requests, [['TKL', 'TKO']]);

    for (const expected of ['failed', 'special', 'suspended', 'rateLimited']) {
      const status = renderRailUi(locale, reading({ kind: expected }));
      const statusNodes = status.render('TKO');
      assert.ok(statusNodes.some(({ props }) => props.children === status.copy[expected]));
    }
    const stale = renderRailUi(locale, reading(sample.payload, { serverNow: wall + 61_000 }));
    const staleNodes = stale.render('TKO');
    assert.ok(staleNodes.some(({ props }) => props.children === stale.copy.stale));
    assert.ok(!staleNodes.some(({ props }) => props.children === stale.copy.minutes(2)));
  });
}

if (process.env.MTR_PROBE_DIR) {
  test('official GET snapshots parse with their actual HTTP capture clock', () => {
    const dir = process.env.MTR_PROBE_DIR;
    const observations = [['TKL-TKO', 'ready'], ['AEL-AIR', 'ready'], ['EAL-ADM', 'ready'], ['EAL-RAC', 'empty'], ['AEL-ADM', 'unsupported']];
    for (const [pair, expected] of observations) {
      const [line, station] = pair.split('-');
      const data = JSON.parse(readFileSync(join(dir, pair + '.json'), 'utf8'));
      const headers = readFileSync(join(dir, pair + '.headers'), 'utf8');
      const date = Date.parse(headers.match(/^date: (.+)$/im)[1]);
      const age = Number(headers.match(/^age: (\d+)$/im)?.[1] ?? 0);
      const payload = parseMtrForecast(data, line, station);
      const view = mtrForecastView(reading(payload, { serverNow: date + age * 1000 }), start);
      assert.equal(view.kind, expected, pair);
    }
  });
}

const { createLightRailNextTrainClient } = source('light-rail-next-train-client');
const { parseLightRailForecast, lightRailForecastView, supportsLightRailForecast } = source('light-rail-realtime');
const { lightRailStops } = source('light-rail-static');

function railTrain(overrides = {}) {
  return {
    route_no: '507', special: 0, additionalInfo1: '', dest_en: 'Tin King', dest_ch: '田景',
    arrival_departure: 'A', time_en: '5 mins', time_ch: '5 分鐘', stop: 0, train_length: 2, ...overrides,
  };
}
function railPlatform(platform_id, ...route_list) {
  return { platform_id, route_list };
}
function railBody(...platform_list) {
  return { status: 1, system_time: timestamp, platform_list };
}

const { homeMtrPreview, homeLightRailPreview } = source('home-railway-eta');
const homeFavorite = (mode, lineId, stationId, createdAt = 1) => ({
  mode, lineId, stationId, createdAt, updatedAt: createdAt,
  id: `railway_favorite:${JSON.stringify([mode, lineId, stationId])}`,
  lineSnapshot: { zh: lineId, en: lineId }, stationSnapshot: { zh: stationId, en: stationId },
});

test('Home MTR previews keep both official directions', () => {
  const payload = parseMtrForecast(body('EAL-HUH', [train('LOW', '1', { timeType: 'D' }), train('LMC', '2')],
    [train('ADM', '1', { timeType: 'A', plat: undefined })]), 'EAL', 'HUH');
  const view = homeMtrPreview(reading(payload), start);
  assert.equal(view.kind, 'ready');
  assert.deepEqual(view.groups.map(({ direction, trains }) => [direction, trains.length, trains[0].destination, trains[0].timeType]),
    [['UP', 1, 'LOW', 'departure'], ['DOWN', 1, 'ADM', 'arrival']]);
  assert.equal(view.groups[1].trains[0].platform, undefined);
  assert.equal(homeMtrPreview(reading(payload), clockAfter(60_000)).kind, 'stale');
  assert.equal(homeMtrPreview(reading(parseMtrForecast(body('ISL-ADM'), 'ISL', 'ADM')), start).kind, 'empty');
  for (const kind of ['failed', 'rateLimited', 'unsupported', 'special', 'suspended']) {
    assert.equal(homeMtrPreview(reading({ kind }), start).kind, kind);
  }
});

function homeRailPayload() {
  return parseLightRailForecast(railBody(
    railPlatform(1, railTrain({ route_no: '614', dest_en: 'Wrong route', dest_ch: '其他路線' }),
      railTrain({ route_no: '610', stop: 1 }),
      railTrain({ route_no: '610', dest_en: 'Yuen Long', dest_ch: '元朗' }),
      railTrain({ route_no: 'SPR', special: 1, additionalInfo1: '610', dest_en: 'Special', dest_ch: '特別班次' })),
    railPlatform(2, railTrain({ route_no: '610', dest_en: 'Tuen Mun Ferry Pier', dest_ch: '屯門碼頭', arrival_departure: 'D' })),
    railPlatform(3, railTrain({ route_no: '610', time_en: '9 mins', time_ch: '9 分鐘' })),
  ), '380');
}

test('Home Light Rail filters the exact regular route and retains real platforms without fabricated times', () => {
  const sample = reading(homeRailPayload());
  const preview = homeLightRailPreview(sample, start, '610');
  assert.equal(preview.kind, 'ready');
  assert.deepEqual(preview.platforms.map(({ id, train }) => [id, train.route.code, train.event]), [[1, '610', 'arrival'], [2, '610', 'departure']]);
  assert.equal(preview.hasMore, true);
  assert.ok(preview.platforms.every(({ train }) => train.route.kind === 'regular' && !train.serviceIssue));
  assert.equal(homeLightRailPreview(sample, start, '614').platforms[0].train.destination.en, 'Wrong route');
  assert.equal(homeLightRailPreview(sample, start, '705').kind, 'empty');
  const unordered = reading(parseLightRailForecast(railBody(
    railPlatform(1, railTrain({ route_no: '610', time_en: '9 mins', time_ch: '9 分鐘' }),
      railTrain({ route_no: '610', time_en: '2 mins', time_ch: '2 分鐘' })),
    railPlatform(2, railTrain({ route_no: '610', time_en: '5 mins', time_ch: '5 分鐘' })),
    railPlatform(3, railTrain({ route_no: '610', time_en: '1 min', time_ch: '1 分鐘' })),
  ), '380'));
  assert.deepEqual(homeLightRailPreview(unordered, start, '610').platforms.map(({ id, train }) => [id, train.time.minutes]), [[3, 1], [1, 2]]);
  assert.equal(homeLightRailPreview(sample, clockAfter(60_000), '610').kind, 'stale');
  for (const [overrides, expected] of [
    [{ stop: 1 }, 'serviceIssue'], [{ time_en: 'unrecognized', time_ch: '未知' }, 'noTime'],
    [{ route_no: 'SPR', special: 1, additionalInfo1: '610' }, 'empty'],
  ]) {
    const payload = parseLightRailForecast(railBody(railPlatform(1, railTrain({ route_no: '610', ...overrides }))), '380');
    assert.equal(homeLightRailPreview(reading(payload), start, '610').kind, expected);
  }
  for (const kind of ['failed', 'rateLimited', 'unsupported', 'providerUnavailable']) {
    assert.equal(homeLightRailPreview(reading({ kind }), start, '610').kind, kind);
  }
});

function homeRailUi(locale, initialMtr, initialRail, extra = {}) {
  let mtr = initialMtr;
  let rail = initialRail;
  let now = start;
  let dimensions = { width: 390, fontScale: 1 };
  const calls = [];
  const routes = [];
  const copy = source('i18n').messages[locale];
  const mocks = {
    react: { useCallback: (fn) => fn },
    'expo-router': { useRouter: () => ({ push: (href) => routes.push(href) }) },
    'react-native': { View: 'View', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
      useWindowDimensions: () => dimensions },
    '@/components/ui': { AppText: 'AppText', Icon: 'Icon' },
    '@/components/saved-bus-ui': { savedBusStyles: { card: {} } },
    '@/database': { getDatabase() { throw new Error('Home must not write or migrate favorites'); } },
    '@/language': { useLanguage: () => ({ locale, copy }) },
    '@/mtr-next-train-hooks': { useMtrNextTrains(line, station, auto) {
      calls.push(['mtr', line, station, auto]);
      return { reading: mtr, now, busy: !mtr, refresh() { calls.push('refresh'); } };
    } },
    '@/light-rail-next-train-hooks': { useLightRailNextTrains(station, auto) {
      calls.push(['light_rail', station, auto]);
      return { reading: rail, now, busy: !rail, refresh() { calls.push('refresh'); } };
    } },
    ...extra,
  };
  for (const key of Object.keys(mocks)) if (mocks[key] === undefined) delete mocks[key];
  const load = sources(mocks);
  function elements(node) {
    if (Array.isArray(node)) return node.flatMap(elements);
    if (!node?.props) return [];
    return [node, ...elements(typeof node.type === 'function' ? node.type(node.props) : node.props.children)];
  }
  return {
    copy, calls, routes,
    resize(width, fontScale) { dimensions = { width, fontScale }; },
    render(favorite) { return elements(load('components/home-favorite-railway').HomeFavoriteRailway({ favorite })); },
    renderMinibus(favorite) { return elements(load('components/home-favorite-gmb').HomeFavoriteGmb({ favorite })); },
    update(payload, at = start) { mtr = payload; rail = payload; now = at; },
  };
}

for (const locale of ['zh-HK', 'en']) {
  test(`Home minibus separates stop details from status and permits large-type wrapping (${locale})`, () => {
    const base = clockAfter(60_000);
    let now = base;
    let sample;
    const favorite = { mode: 'gmb', id: '2009246:2:1:101', routeId: 2009246, routeCode: '2', region: 'KLN', routeSeq: 2,
      stopSeq: 1, stopId: 101, stopName: { en: 'Whampoa Garden Public Transport Interchange', 'zh-HK': '黃埔花園公共運輸交匯處' },
      destination: { en: 'Kowloon Tong (Festival Walk)', 'zh-HK': '九龍塘（又一城）' } };
    const page = homeRailUi(locale, undefined, undefined, {
      '@/home-gmb-eta': {},
      '@/next-train-hooks': { useNextTrainReading(key, _read, _clock, auto) {
        assert.equal(key, favorite.id);
        assert.equal(auto, true);
        return { reading: sample, now };
      } },
    });
    const labels = page.copy.minibus;
    const at = base.wall + 180_000;
    const forecast = (kind) => ({
      kind: 'ready', generatedAt: base.wall, data: { kind: 'forecast', stopId: 101,
        entries: [{ kind, sequence: 1, timestamp: at, diff: 3, remarks: {} }] },
    });
    const eta = (payload) => reading({ kind: 'eta', first: false, eta: payload }, { receivedAt: base, serverNow: base.wall, retryAt: base.monotonic });
    sample = eta(forecast('live'));
    const nodes = page.renderMinibus(favorite);
    const getText = (list, value) => list.find(({ type, props }) => type === 'AppText' && props.children === value);
    const stopLabel = labels.stopLabel(1, favorite.stopName[locale]);
    const route = `${page.copy.saved.categories.minibus} · 2 · ${labels.regions.KLN}`;
    for (const label of [route, stopLabel, page.copy.gmbFavorites.towards(favorite.destination[locale])]) {
      const { props } = getText(nodes, label);
      assert.equal(props.numberOfLines, undefined);
      assert.equal(props.maxFontSizeMultiplier, undefined);
    }
    const countdown = getText(nodes, labels.minutes(3));
    const time = getText(nodes, formatHongKongTime(at).slice(11));
    assert.equal(countdown.props.variant, 'title');
    assert.equal(time.props.variant, 'caption');
    assert.equal(time.props.tone, 'muted');
    assert.equal(countdown.props.style.textAlign, 'right');
    assert.equal(time.props.style.textAlign, 'right');
    const summary = (tree) => tree[0].props.children[0];
    const etaColumn = (tree) => summary(tree).props.children[1];
    assert.equal(summary(nodes).props.style[0].flexDirection, 'row');
    assert.equal(etaColumn(nodes).props.style[0].alignItems, 'flex-end');
    for (const [width, fontScale] of [[320, 1], [430, 1.8]]) {
      page.resize(width, fontScale);
      const narrow = page.renderMinibus(favorite);
      assert.equal(summary(narrow).props.style[1].flexDirection, 'column');
      assert.equal(etaColumn(narrow).props.style[1].alignSelf, 'flex-end');
      assert.ok(getText(narrow, stopLabel));
      assert.ok(getText(narrow, labels.minutes(3)));
      assert.ok(getText(narrow, formatHongKongTime(at).slice(11)));
    }
    page.resize(390, 1);
    const actions = nodes.filter(({ type }) => type === 'Pressable');
    assert.equal(actions.length, 1, 'The only Home card action opens details');
    assert.ok(actions[0].props.accessibilityLabel.includes(stopLabel));
    assert.equal(actions[0].props.style({ pressed: false })[0].minHeight, 44);
    actions[0].props.onPress();
    assert.deepEqual(page.routes, [{ pathname: '/minibus/[id]', params: { id: '2009246', routeSeq: '2', stopSeq: '1', stopId: '101' } }]);

    sample = eta(forecast('scheduled'));
    assert.ok(getText(page.renderMinibus(favorite), labels.scheduled));
    assert.equal(getText(page.renderMinibus(favorite), labels.minutes(3)), undefined);
    const followingDay = base.wall + 24 * 60 * 60_000;
    const overnight = forecast('scheduled');
    overnight.data.entries[0].timestamp = followingDay;
    overnight.data.entries[0].diff = 1440;
    sample = eta(overnight);
    assert.ok(getText(page.renderMinibus(favorite), formatHongKongTime(followingDay)));
    for (const [state, text] of [
      [eta({ kind: 'ready', generatedAt: base.wall, data: { kind: 'empty', stopId: 101 } }), labels.etaEmpty],
      [eta({ kind: 'timeout' }), labels.etaTimeout], [eta({ kind: 'network' }), labels.etaFailed],
      [reading({ kind: 'ambiguous' }), labels.etaAmbiguous], [undefined, labels.loadingEta],
    ]) {
      sample = state;
      const statusCard = page.renderMinibus(favorite);
      assert.equal(getText(statusCard, text).props.accessibilityLiveRegion, 'polite');
      assert.equal(statusCard.filter(({ type }) => type === 'Pressable').length, 1);
    }
    sample = eta(forecast('live'));
    now = clockAfter(180_000);
    assert.ok(getText(page.renderMinibus(favorite), labels.etaStale));
  });

  test(`Home railway cards show accurate compact bilingual predictions and original detail links (${locale})`, () => {
    const mtr = reading(parseMtrForecast(body('EAL-HUH', [train('LOW', '1', { timeType: 'D' })], [train('ADM', '1', { timeType: 'A' })]), 'EAL', 'HUH'));
    const page = homeRailUi(locale, mtr, reading(homeRailPayload()));
    const text = (nodes) => nodes.filter(({ type }) => type === 'AppText').map(({ props }) => props.children).join('\n');
    const favorite = homeFavorite('mtr', 'EAL', 'HUH');
    const nodes = page.render(favorite);
    assert.deepEqual(page.calls, [['mtr', 'EAL', 'HUH', true]]);
    const content = text(nodes);
    assert.ok(!content.includes(page.copy.mtr.nextTrains.title), 'Home omits the standalone ETA heading');
    assert.equal(nodes.filter(({ type }) => type === 'Pressable').length, 1);
    for (const label of [page.copy.homeRailway.direction('UP'), page.copy.homeRailway.direction('DOWN'),
      page.copy.mtr.nextTrains.arrival, page.copy.mtr.nextTrains.departure,
      locale === 'en' ? 'Hung Hom' : '紅磡', locale === 'en' ? 'Lo Wu' : '羅湖']) assert.ok(content.includes(label), label);
    nodes.find(({ type, props }) => type === 'Pressable' && !props.accessibilityLabel).props.onPress();
    assert.deepEqual(page.routes.at(-1), { pathname: '/mtr/[kind]', params: { kind: 'station', code: 'HUH', line: 'EAL' } });
    page.render(homeFavorite('mtr', 'ISL', 'ADM'));
    assert.deepEqual(page.calls.at(-1), ['mtr', 'ISL', 'ADM', true]);
    page.render(homeFavorite('mtr', 'EAL', 'ADM'));
    assert.deepEqual(page.calls.at(-1), ['mtr', 'EAL', 'ADM', true]);

    const railNodes = page.render(homeFavorite('light_rail', '610', '380'));
    assert.equal(railNodes.filter(({ type }) => type === 'Pressable').length, 1);
    const forecastBody = (tree) => tree.find(({ type, props }) => type === 'View' && props.style?.borderTopWidth > 0);
    const bodyStyle = forecastBody(railNodes).props.style;
    assert.equal(bodyStyle, forecastBody(nodes).props.style, 'Light Rail and MTR use the same body style');
    assert.equal(bodyStyle.paddingStart, undefined);
    assert.equal(bodyStyle.paddingLeft, undefined);
    const forecasts = railNodes.filter(({ type, props }) => type === 'View' && props.style?.flexWrap === 'wrap');
    assert.equal(forecasts.length, 2);
    assert.equal(forecasts[0].props.style, forecasts[1].props.style);
    for (const { props } of forecasts) {
      const [copy, time] = props.children;
      assert.ok(props.style.columnGap > 0, 'Direction and ETA retain horizontal breathing room');
      assert.equal(copy.props.style.minWidth, 0);
      assert.equal(time.props.style[0].textAlign, 'right');
      assert.equal(time.props.style[1].marginStart, 'auto');
      for (const text of [...copy.props.children, time]) {
        assert.equal(text.props.numberOfLines, undefined);
        assert.equal(text.props.maxFontSizeMultiplier, undefined);
      }
    }
    const railText = text(railNodes);
    assert.deepEqual(page.calls.at(-1), ['light_rail', '380', true]);
    assert.ok(railText.includes(locale === 'en' ? 'Yuen Long' : '元朗'));
    assert.ok(!railText.includes('Wrong route') && !railText.includes('其他路線') && !railText.includes('Special'));
    assert.ok(railText.includes(page.copy.lightRail.nextTrains.platform(1)) && railText.includes(page.copy.lightRail.nextTrains.platform(2)));
    railNodes.find(({ type, props }) => type === 'Pressable' && !props.accessibilityLabel).props.onPress();
    assert.deepEqual(page.routes.at(-1), { pathname: '/light-rail/[kind]', params: { kind: 'stop', id: '380', route: '610' } });
    page.update(undefined);
    const loading = page.render(favorite);
    assert.ok(text(loading).includes(page.copy.homeRailway.status.loading));
    assert.equal(loading.filter(({ type }) => type === 'Pressable').length, 1);
    page.update(mtr, clockAfter(60_000));
    const stale = text(page.render(favorite));
    assert.ok(stale.includes(page.copy.homeRailway.status.stale));
    assert.ok(!stale.includes(page.copy.mtr.nextTrains.minutes(2)));
    for (const kind of ['failed', 'rateLimited', 'unsupported']) {
      page.update(reading({ kind }));
      const statusNodes = page.render(favorite);
      const expected = page.copy.homeRailway.status[kind];
      const notice = statusNodes.find(({ type, props }) => type === 'AppText' && props.children === expected);
      assert.ok(notice);
      assert.equal(notice.props.numberOfLines, undefined, 'Status can wrap at large text sizes');
      assert.ok(!text(statusNodes).includes(page.copy.mtr.nextTrains.empty));
    }
    page.update(reading(parseMtrForecast(body('EAL-HUH'), 'EAL', 'HUH')));
    assert.ok(text(page.render(favorite)).includes(page.copy.mtr.nextTrains.empty));
    page.update(reading(homeRailPayload()));
    const unmatched = page.render(homeFavorite('light_rail', '615', '380'));
    assert.ok(text(unmatched).includes(page.copy.homeRailway.noMatching));
    const before = page.calls.length;
    assert.ok(text(page.render(homeFavorite('mtr', 'REMOVED', 'ADM'))).includes(page.copy.railwayFavorites.unavailable));
    assert.equal(page.calls.length, before, 'An orphaned favorite makes no request');
  });
}

test('Home Light Rail same-station favorites share the real client request and cache while filtering separate routes', async () => {
  let requests = 0;
  const tasks = [];
  let current;
  const read = createLightRailNextTrainClient({ clock: () => start, request: async (url) => {
    requests++;
    assert.match(url, /station_id=380&with_special=1$/);
    return new Response(JSON.stringify(railBody(railPlatform(1,
      railTrain({ route_no: '610', dest_en: 'Alpha destination' }), railTrain({ route_no: '614', dest_en: 'Beta destination' })))), { status: 200 });
  } });
  const page = homeRailUi('en', undefined, undefined, {
    '@/light-rail-next-train-hooks': undefined,
    '@/light-rail-next-train-client': { readLightRailNextTrains: read },
    '@/next-train-hooks': { useNextTrainReading(key, reader, _clock, auto) {
      assert.equal(key, '380'); assert.equal(auto, true);
      tasks.push(reader().then((sample) => { current = sample; }));
      return { reading: current, now: start, busy: !current, refresh() {} };
    } },
  });
  // Both cards use the actual shared hook/client; only the native lifecycle is stubbed here.
  const first = homeFavorite('light_rail', '610', '380');
  const second = homeFavorite('light_rail', '614', '380');
  page.render(first); page.render(second);
  await Promise.all(tasks);
  assert.equal(requests, 1);
  const firstText = page.render(first).filter(({ type }) => type === 'AppText').map(({ props }) => props.children).join('\n');
  const secondText = page.render(second).filter(({ type }) => type === 'AppText').map(({ props }) => props.children).join('\n');
  assert.ok(firstText.includes('Alpha destination') && !firstText.includes('Beta destination'));
  assert.ok(secondText.includes('Beta destination') && !secondText.includes('Alpha destination'));
  await Promise.all(tasks);
  assert.equal(requests, 1, 'Fresh cache is shared across separate route cards at one station');
});

test('Light Rail coverage matches all 68 official directory IDs and uses Hoi Wong Road ID 250', () => {
  assert.equal(lightRailStops.length, 68);
  assert.ok(lightRailStops.every(({ id }) => supportsLightRailForecast(id)));
  const stop = lightRailStops.find(({ id }) => id === '250');
  assert.equal(stop.en, 'Hoi Wong Road');
  for (const invalid of ['9999', 'TSP', '0250', '705', '250&with_special=0']) assert.equal(supportsLightRailForecast(invalid), false);
  assert.equal(parseLightRailForecast({ ...railBody(), station_id: 920 }, '250').kind, 'failed');
  assert.equal(parseLightRailForecast({ ...railBody(), station_id: 250 }, '250').kind, 'forecast');
});

test('Light Rail preserves official platform order, same-platform routes, later trains and provider destinations', () => {
  const payload = parseLightRailForecast(railBody(
    railPlatform(2, railTrain({ time_en: '5 min' }), railTrain({ route_no: '614', dest_en: 'Yuen Long', dest_ch: '元朗' })),
    railPlatform(4, railTrain({ route_no: '705', dest_en: 'TSW Circular', dest_ch: '天水圍循環綫' })),
    railPlatform(2, railTrain({ time_en: '9 mins', time_ch: '9 分鐘' })),
  ), '250');
  assert.deepEqual(payload.platforms.map(({ id, trains }) => [id, trains.map(({ route }) => route.code)]),
    [[2, ['507', '614', '507']], [4, ['705']]]);
  assert.deepEqual(payload.platforms[0].trains[1].destination, { en: 'Yuen Long', zh: '元朗' });
  assert.equal(payload.platforms[1].trains[0].destination.en, 'TSW Circular');
  assert.deepEqual(payload.platforms[0].trains.map(({ time }) => time.minutes), [5, 5, 9]);
});

test('Light Rail parses numeric and qualitative official snapshot times without inventing a zero-minute countdown', () => {
  const payload = parseLightRailForecast(railBody(railPlatform(1,
    railTrain({ time_en: '1 min', time_ch: '1 分鐘' }),
    railTrain({ time_en: '-', time_ch: '-' }),
    railTrain({ arrival_departure: 'D', time_en: 'Departing', time_ch: '正在離開' }),
    railTrain({ time_en: 'Arriving', time_ch: '即將抵達' }),
    railTrain({ arrival_departure: 'unknown', time_en: '7 mins', time_ch: '7 分鐘' }),
    railTrain({ arrival_departure: 'D', time_en: 'Arriving', time_ch: '即將抵達' }),
    railTrain({ time_en: '8 mins', time_ch: '7 分鐘' }),
    railTrain({ time_en: 'undefined', time_ch: 'not provided' }),
  )), '250');
  assert.deepEqual(payload.platforms[0].trains.map(({ event, time }) => [event, time.kind, time.minutes]), [
    ['arrival', 'minutes', 1], ['arrival', 'imminent', undefined], ['departure', 'departing', undefined],
    ['arrival', 'arriving', undefined], ['estimate', 'minutes', 7], ['estimate', 'unknown', undefined],
    ['arrival', 'unknown', undefined], ['arrival', 'unknown', undefined],
  ]);
  assert.deepEqual(lightRailForecastView(reading(payload), clockAfter(30_000)).platforms[0].trains[0].time, { kind: 'minutes', minutes: 1 });
  assert.equal(lightRailForecastView(reading(payload), clockAfter(60_000)).kind, 'stale');
});

test('Light Rail special-service fixtures use the v1.2 public identifier, notes, and conservative stop handling', () => {
  // Synthetic field values model the official 901/902 examples; they are not live predictions.
  const payload = parseLightRailForecast(railBody(railPlatform(1,
    railTrain({ route_no: '901', special: 1, additionalInfo1: '507*', routeRemarkEng2: 'English fixture note', routeRemarkChi2: '繁中測試備註' }),
    railTrain({ route_no: '902', special: 1, additionalInfo1: 'SPR' }),
    railTrain({ route_no: '902', special: 1, additionalInfo1: 'unexpected' }),
    railTrain({ route_no: undefined, special: 1, additionalInfo1: '751P*' }),
    railTrain({ route_no: '505', stop: 1 }),
    railTrain({ route_no: '507', stop: undefined }),
  )), '140');
  const trains = payload.platforms[0].trains;
  assert.deepEqual(trains.map(({ route }) => [route.kind, route.code]),
    [['special', '507*'], ['special', undefined], ['special', undefined], ['special', '751P*'], ['regular', '505'], ['regular', '507']]);
  assert.deepEqual(trains[0].remark, { en: 'English fixture note', zh: '繁中測試備註' });
  assert.equal(trains[4].serviceIssue, true);
  assert.equal(trains[4].time.kind, 'unknown');
  assert.equal(trains[5].serviceIssue, false);
  assert.equal(trains[5].time.kind, 'unknown');
});

test('Light Rail freshness, valid empty, invalid structure, unavailable provider and unknown stop differ', () => {
  const view = (input, id = '250') => lightRailForecastView(reading(parseLightRailForecast(input, id)), start);
  assert.equal(view(railBody()).kind, 'empty');
  assert.equal(view(railBody(railPlatform(1))).kind, 'empty');
  assert.equal(view({ status: 0 }).kind, 'providerUnavailable');
  assert.equal(view({ status: 0 }, '9999').kind, 'unsupported');
  assert.equal(view({ status: 1 }).kind, 'failed');
  assert.equal(view(railBody(railPlatform(0, railTrain()))).kind, 'failed');
  assert.equal(view(railBody(railPlatform(1, null))).kind, 'failed');
  assert.equal(view({ ...railBody(railPlatform(1, railTrain())), system_time: '2026-11-21 23:58:00' }).kind, 'stale');
  assert.equal(view({ ...railBody(railPlatform(1, railTrain())), system_time: '-' }).kind, 'stale');
  const midnight = { ...railBody(railPlatform(1, railTrain())), system_time: '2026-11-22 00:00:01' };
  const sample = reading(parseLightRailForecast(midnight, '250'), { receivedAt: clockAfter(12_000), serverNow: wall + 12_000 });
  const next = lightRailForecastView(sample, clockAfter(12_000));
  assert.equal(next.kind, 'ready');
  assert.equal(formatHongKongTime(next.updatedAt, true), midnight.system_time);
});

test('Light Rail sends only the selected ID and with_special, reuses requests and honors endpoint backoff', async () => {
  const calls = [];
  let now = start;
  let reply;
  const read = createLightRailNextTrainClient({
    clock: () => now, request: (url, options) => {
      calls.push({ url: new URL(url), options });
      return new Promise((resolve) => { reply = resolve; });
    },
  });
  assert.equal((await read('9999')).payload.kind, 'unsupported');
  const first = read('250');
  assert.equal(first, read('250'));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.origin, 'https://rt.data.gov.hk');
  assert.equal(calls[0].url.pathname, '/v1/transport/mtr/lrt/getSchedule');
  assert.deepEqual([...calls[0].url.searchParams], [['station_id', '250'], ['with_special', '1']]);
  assert.equal(calls[0].options.credentials, 'omit');
  reply(new Response(JSON.stringify(railBody(railPlatform(1, railTrain())))));
  const cached = await first;
  assert.equal(await read('250'), cached);
  now = clockAfter(20_000);
  const limited = read('250');
  reply(new Response('', { status: 429, headers: { 'retry-after': '90' } }));
  assert.equal((await limited).payload.kind, 'rateLimited');
  assert.equal((await read('920')).payload.kind, 'rateLimited');
  assert.equal(calls.length, 2);
  now = clockAfter(110_000);
  const next = read('920');
  assert.equal(calls.at(-1).url.searchParams.get('station_id'), '920');
  reply(new Response('', { status: 500 }));
  assert.equal((await next).payload.kind, 'failed');
});

test('Light Rail uses the common abort timeout and retries after the cooldown', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  let now = start;
  let count = 0;
  const read = createLightRailNextTrainClient({
    clock: () => now,
    request: (_, options) => {
      if (++count === 1) { signal = options.signal; return new Promise(() => {}); }
      return Promise.resolve(new Response(JSON.stringify(railBody())));
    },
  });
  const timeout = read('250');
  t.mock.timers.tick(8000);
  assert.equal((await timeout).payload.kind, 'failed');
  assert.equal(signal.aborted, true);
  assert.equal((await read('250')).payload.kind, 'failed');
  assert.equal(count, 1);
  now = clockAfter(20_000);
  assert.equal((await read('250')).payload.kind, 'forecast');
  assert.equal(count, 2);
});

test('Light Rail stop changes and blur discard obsolete responses and the foreground resumes only the selected stop', async () => {
  const page = mountHook();
  page.renderLightRail('250').refresh();
  assert.equal(page.calls.length, 1);
  assert.equal(page.renderLightRail('920').reading, undefined);
  assert.deepEqual(page.calls.map(({ station }) => station), ['250', '920']);
  const current = reading({ kind: 'providerUnavailable' });
  page.calls[1].resolve(current);
  page.calls[0].resolve(reading({ kind: 'failed' }));
  await nextTick();
  assert.equal(page.renderLightRail('920').reading, current);
  page.advance(5000);
  assert.equal(page.calls.length, 2);
  page.state('background');
  assert.equal(page.ticks.size, 0);
  page.renderLightRail('920').refresh();
  assert.equal(page.calls.length, 2);
  page.state('active');
  assert.equal(page.calls[2].station, '920');
  page.focus(false);
  const before = page.callbacks();
  page.calls[2].resolve(reading({ kind: 'failed' }));
  await nextTick();
  assert.equal(page.callbacks(), before);
  assert.equal(page.listeners(), 0);
  assert.equal(page.ticks.size, 0);
});

for (const locale of ['zh-HK', 'en']) {
  test(`Light Rail forecast renders real field semantics and no links to fabricated variants (${locale})`, () => {
    const copy = source('i18n').messages[locale];
    let requested;
    let now = start;
    const view = reading(parseLightRailForecast(railBody(
      railPlatform(1, railTrain({ time_en: '-', time_ch: '-' }), railTrain({
        route_no: '901', special: 1, additionalInfo1: '507*', routeRemarkEng2: 'English fixture note', routeRemarkChi2: '繁中測試備註',
      })),
      railPlatform(3, railTrain({ route_no: '505', arrival_departure: 'D', time_en: 'Departing', time_ch: '正在離開' })),
    ), '250'));
    const load = sources({
      react: { useCallback: (fn) => fn },
      'react-native': {
        ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', View: 'View', StyleSheet: { create: (styles) => styles },
      },
      '@/components/ui': { AppText: 'AppText', Icon: 'Icon' },
      '@/language': { useLanguage: () => ({ copy, locale }) },
      '@/light-rail-next-train-client': { readLightRailNextTrains: (id) => { requested = id; } },
      '@/next-train-hooks': { useNextTrainReading: (key, read) => {
        assert.equal(key, '250');
        read();
        return { reading: view, now, busy: false, refresh() {} };
      } },
    });
    function elements(node) {
      if (Array.isArray(node)) return node.flatMap(elements);
      if (!node?.props) return [];
      return [node, ...elements(node.props.children)];
    }
    const { LightRailNextTrains } = load('components/light-rail-next-trains');
    const nodes = elements(LightRailNextTrains({ stationId: '250' }));
    assert.equal(requested, '250');
    const strings = nodes.filter(({ type }) => type === 'AppText').map(({ props }) => props.children);
    const labels = copy.lightRail.nextTrains;
    for (const content of [labels.platform(1), labels.platform(3), labels.arrival, labels.departure, labels.atStop, labels.departing,
      labels.special, copy.lightRail.route('507*'), labels.updated(timestamp), locale === 'en' ? 'Tin King' : '田景',
      locale === 'en' ? 'English fixture note' : '繁中測試備註']) assert.ok(strings.includes(content), content);
    assert.ok(!strings.includes(copy.lightRail.route('901')));
    assert.equal(nodes.filter(({ type }) => type === 'Pressable').length, 1, 'Only the refresh action is interactive');
    const selected = elements(LightRailNextTrains({ stationId: '250', selectedRoute: '505' }));
    assert.ok(selected.some(({ props }) => props.children === copy.railwayFavorites.routeContext('505')));
    assert.ok(selected.some(({ props }) => props.children === `${copy.lightRail.route('505')} · ${copy.railwayFavorites.selectedRoute}`
      && props.tone === 'primary'));
    assert.ok(selected.some(({ props }) => props.children === labels.platform(1))
      && selected.some(({ props }) => props.children === labels.platform(3)), 'Selection retains every original platform group');
    const specialSelection = elements(LightRailNextTrains({ stationId: '250', selectedRoute: '507*' }));
    assert.equal(specialSelection.some(({ props }) => props.children === `${copy.lightRail.route('507*')} · ${copy.railwayFavorites.selectedRoute}`), false);
    now = clockAfter(60_000);
    const stale = elements(LightRailNextTrains({ stationId: '250' })).map(({ props }) => props.children);
    assert.ok(stale.includes(labels.stale) && stale.includes(labels.updated(timestamp)));
    assert.ok(!stale.includes(labels.platform(1)) && !stale.includes(labels.minutes(5)));
  });
}

if (process.env.LIGHT_RAIL_PROBE_DIR) {
  test('Light Rail current official GET snapshots replay with their original HTTP timestamps', () => {
    const dir = process.env.LIGHT_RAIL_PROBE_DIR;
    const targets = [['250', [1, 2]], ['920', [1]], ['140', [1, 2, 3]], ['550', [1, 2, 4, 5]], ['9999', []]];
    for (const [id, platforms] of targets) {
      const data = JSON.parse(readFileSync(join(dir, id + '.json'), 'utf8'));
      const headers = readFileSync(join(dir, id + '.headers'), 'utf8');
      assert.match(headers, /^HTTP\/2 200/m);
      const date = Date.parse(headers.match(/^date: (.+)$/im)[1]);
      const payload = parseLightRailForecast(data, id);
      const view = lightRailForecastView(reading(payload, { serverNow: date }), start);
      if (id === '9999') {
        assert.equal(data.status, 0);
        assert.equal(view.kind, 'unsupported');
        continue;
      }
      assert.equal(view.kind, 'ready');
      assert.deepEqual(view.platforms.map(({ id }) => id), platforms);
      assert.ok(view.platforms.every(({ trains }) => trains.length > 0));
      if (id === '250') assert.deepEqual(view.platforms.map(({ trains }) => trains.length), [4, 5]);
      if (id === '920') assert.ok(view.platforms[0].trains.every(({ event, route }) => event === 'departure' && route.code === '505'));
    }
  });
}
