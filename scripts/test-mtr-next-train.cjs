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

function mountHook() {
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
    '@/mtr-next-train-client': { readMtrNextTrains: (line, station) =>
      new Promise((resolve) => calls.push({ line, station, resolve })) },
  }, {
    setInterval: (tick, delay) => { assert.equal(delay, 1000); ticks.add(tick); return tick; },
    clearInterval: (id) => ticks.delete(id),
  });
  const useHook = load('mtr-next-train-hooks').useMtrNextTrains;
  const useNextTrainReading = load('next-train-hooks').useNextTrainReading;
  const simulatedClock = () => now;
  return {
    render(line, station) { cursor = 0; return useHook(line, station); },
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

function renderRailUi(locale, sample) {
  let selected;
  let initialized = false;
  const requests = [];
  const copy = source('i18n').messages[locale];
  const load = sources({
    react: { useState(initial) {
      if (!initialized) { initialized = true; selected = initial; }
      return [selected, (value) => { selected = value; }];
    } },
    'react-native': {
      ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', View: 'View',
      StyleSheet: { create: (styles) => styles },
    },
    '@/components/ui': { AppText: 'AppText', Filters: 'Filters', Icon: 'Icon' },
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
  shared.render('HOK');
  assert.deepEqual(shared.requests, [['TCL', 'HOK']]);
  const fromLine = renderRailUi('en', reading({ kind: 'failed' }));
  fromLine.render('HOK', 'AEL');
  assert.deepEqual(fromLine.requests, [['AEL', 'HOK']]);
  const invalid = renderRailUi('en', reading({ kind: 'failed' }));
  assert.ok(invalid.render('HOK', 'EAL').some(({ props }) => props.children === invalid.copy.unsupported));
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
