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
  return {
    render(line, station) { cursor = 0; return useHook(line, station); },
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
