const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
const fixture = require('./fixtures/hkkf-api.json');

const modules = new Map();
function load(name) {
  if (modules.has(name)) return modules.get(name);
  const file = join(__dirname, '..', 'src', name + '.ts');
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', source)(module, module.exports, (path) => load(path.slice(2)));
  modules.set(name, module.exports);
  return module.exports;
}
const { createHkkfClient } = load('hkkf-client');
const { parseHkkfTimetable } = load('hkkf-timetable');
const { ferryDeparturesToday, ferryServiceDaySchedule, ferryEtaView, ferryFreshness } = load('ferry-data');
const base = 'https://www.hkkfeta.com/opendata/';
const generated = Date.parse(fixture.eta['3/outbound'].generated_timestamp);
const etaPath = 'eta/3/outbound';
const noHoliday = () => false;
const mappings = {
  '1/inbound': [5, 1], '1/outbound': [1, 5], '2/inbound': [3, 1], '2/outbound': [1, 3],
  '3/inbound': [4, 2], '3/outbound': [2, 4], '4/inbound': [6, 4], '4/outbound': [4, 6],
};
function response(body, status = 200, headers = {}) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status, headers: { 'Content-Type': 'text/html; charset=utf-8', ...headers },
  });
}
function serverFixture(path) {
  if (path === 'route') return response(fixture.routes);
  if (path.startsWith('pier/')) return response(fixture.piers[path.slice(5)]);
  if (path.startsWith('eta/')) return response(fixture.eta[path.slice(4)]);
  if (path.startsWith('time_table/')) return response(fixture.schedules[path.slice(11)].csv, 200, { 'Content-Type': 'text/csv' });
  throw new Error('Unexpected request: ' + path);
}
function harness(request = serverFixture, options = {}) {
  let offset = 0;
  const paths = [];
  const clock = () => ({ wall: generated + offset, monotonic: 100 + offset });
  const client = createHkkfClient({ enabled: true, clock, ...options, request(url, init) {
    assert.ok(url.startsWith(base));
    const path = url.slice(base.length);
    paths.push(path);
    return request(path, init);
  } });
  return { client, clock, paths, advance(ms) { offset += ms; } };
}
function parsedSchedule(key) {
  const [route, direction] = key.split('/');
  return parseHkkfTimetable(fixture.schedules[key].csv, Number(route), direction);
}

test('reads four routes, eight explicit directions and all six labelled piers from JSON with HTML MIME', async () => {
  const { client } = harness();
  const routes = (await client.readRoutes()).payload;
  assert.equal(routes.kind, 'ready');
  assert.equal(routes.source.generatedAt, Date.parse(fixture.routes.generated_timestamp));
  assert.equal(routes.data.length, 4);
  for (const route of routes.data) {
    assert.equal(route.routeId, 'hkkf:route:' + route.operatorRouteId);
    assert.ok(route.name['zh-HK'] && route.name.en);
    assert.equal(route.directions.length, 2);
    for (const bound of route.directions) {
      assert.deepEqual([bound.originPierId, bound.destinationPierId],
        mappings[route.operatorRouteId + '/' + bound.directionId].map((id) => 'hkkf:pier:' + id));
      assert.match(bound.name.en, / → /);
    }
  }
  const piers = await Promise.all(Array.from({ length: 6 }, (_, index) => client.readPier(index + 1)));
  assert.equal(new Set(piers.map(({ payload }) => payload.data.pierId)).size, 6);
  assert.equal(piers[0].payload.data.name.en, 'Central Pier 4');
  assert.equal(piers[1].payload.data.name.en, 'Central Pier 6');
  assert.equal(piers[1].payload.data.name['zh-HK'], '中環6號渡輪碼頭');
  assert.notDeepEqual(piers[0].payload.data.coordinate, piers[1].payload.data.coordinate);
});

test('matches all 324 planned departures against independent operator website columns', async () => {
  const { client } = harness();
  let total = 0;
  for (const [key, { expectedLocalTimes }] of Object.entries(fixture.schedules)) {
    const [route, direction] = key.split('/');
    const { payload } = await client.readTimetable(Number(route), direction);
    assert.equal(payload.kind, 'ready', key);
    const table = payload.data;
    assert.equal(payload.source.generatedAt, undefined, 'CSV has no published generation timestamp');
    assert.equal(payload.source.kind, 'operatorTimetable');
    assert.deepEqual([table.direction.originPierId, table.direction.destinationPierId],
      mappings[key].map((id) => 'hkkf:pier:' + id), key);
    for (const [index, dayType] of ['mondayToSaturday', 'sundayOrPublicHoliday'].entries()) {
      const entries = table.entries.filter((row) => row.dayType === dayType);
      assert.deepEqual(entries.map(({ time }) => time), expectedLocalTimes[index], key);
      assert.ok(entries.every(({ kind, rule }) => kind === 'scheduledDeparture' && rule !== 'unverified'), key);
      total += entries.length;
    }
    assert.ok(!/<|background-color/.test(table.notes.en));
  }
  assert.equal(total, 324);
});

test('retains condition and note semantics by route, and applies Saturday and public holiday rules', () => {
  const outbound = parsedSchedule('2/outbound');
  const monday = ferryServiceDaySchedule(outbound, '2026-11-23', noHoliday);
  const saturday = ferryServiceDaySchedule(outbound, '2026-11-21', noHoliday);
  const holiday = ferryServiceDaySchedule(outbound, '2026-11-23', () => true);
  const sunday = ferryServiceDaySchedule(outbound, '2026-11-22', () => undefined);
  assert.equal(monday.kind, 'ready');
  assert.ok(!monday.entries.some(({ time }) => time === '02:30'));
  assert.equal(saturday.entries[0].time, '02:30');
  assert.equal(saturday.entries[0].rule, 'saturdayOnly');
  assert.equal(holiday.entries[0].dayType, 'sundayOrPublicHoliday');
  assert.equal(holiday.entries[0].rule, 'regular');
  assert.ok(sunday.entries.every(({ dayType }) => dayType === 'sundayOrPublicHoliday'));
  assert.equal(ferryServiceDaySchedule(outbound, '2026-11-23', () => undefined).kind, 'calendarUnknown');
  assert.equal(ferryServiceDaySchedule(outbound, '2026-02-30', noHoliday).kind, 'invalidDate');

  const optional = parsedSchedule('1/inbound');
  assert.equal(optional.notes['zh-HK'], '@ 選開');
  assert.equal(optional.notes.en, '@ Optional Service');
  assert.ok(optional.entries.some(({ time, rule }) => time === '13:50' && rule === 'optional'));
  assert.ok(!ferryServiceDaySchedule(optional, '2026-11-22', noHoliday).entries.some(({ time }) => time === '13:50'));
  const pengChau = parsedSchedule('3/outbound');
  assert.equal(pengChau.entries.find(({ time }) => time === '03:00').freight, 'restricted');
  assert.ok(pengChau.entries.some(({ onwardService, freight }) => onwardService && freight === 'limited'));
});

test('sorts verified rollover times, checks the originating service day, and exposes an ended civil day', () => {
  const heiLing = parsedSchedule('4/outbound');
  const saturday = ferryServiceDaySchedule(heiLing, '2026-11-21', noHoliday);
  assert.equal(new Date(saturday.entries.at(-1).at).toISOString(), '2026-11-21T17:00:00.000Z');
  assert.equal(saturday.entries.at(-1).time, '01:00');
  assert.equal(saturday.entries.at(-1).dayOffset, 1);
  const afterMidnight = ferryDeparturesToday(heiLing, Date.parse('2026-11-22T00:30:00+08:00'), noHoliday);
  assert.equal(afterMidnight.next.serviceDate, '2026-11-21');
  assert.equal(afterMidnight.next.time, '01:00');
  const nearMidnight = ferryDeparturesToday(heiLing, Date.parse('2026-11-22T23:45:00+08:00'), noHoliday);
  assert.equal(nearMidnight.kind, 'ended');
  assert.ok(!nearMidnight.entries.some(({ time }) => time === '00:10'));
  const monday = ferryDeparturesToday(heiLing, Date.parse('2026-11-23T00:05:00+08:00'), noHoliday);
  assert.equal(monday.next.time, '00:10');
  assert.equal(monday.next.serviceDate, '2026-11-22');
  for (const key of ['2/outbound', '3/outbound']) {
    const result = ferryServiceDaySchedule(parsedSchedule(key), '2026-11-23', noHoliday);
    assert.equal(result.entries.at(-1).time, '00:30');
    assert.equal(result.entries.at(-1).dayOffset, 1);
  }
});

test('preserves unknown special marks or unaudited midnight times but omits them from computed departures', () => {
  const original = fixture.schedules['1/inbound'].csv;
  const table = parseHkkfTimetable(original.replace("'06:40'", "'!06:40'").replace("'^22:40'", "'^00:09'"), 1, 'inbound');
  assert.equal(table.entries.find(({ marker }) => marker === '!').rule, 'unverified');
  assert.equal(table.entries.find(({ time }) => time === '00:09').dayOffset, undefined);
  const calendar = ferryServiceDaySchedule(table, '2026-11-23', noHoliday);
  assert.ok(!calendar.entries.some(({ time }) => ['06:40', '00:09'].includes(time)));
  const header = original.split('\r\n')[0] + '\r\n';
  const noTable = parseHkkfTimetable(header, 1, 'inbound');
  assert.equal(ferryServiceDaySchedule(noTable, '2026-11-23', noHoliday).kind, 'noTimetable');
  assert.equal(ferryDeparturesToday(noTable, Date.parse('2026-11-23T12:00+08:00'), noHoliday).kind, 'noTimetable');
});

test('flags changed mappings explicitly and rejects unsafe CSV or malformed response fields', async () => {
  const original = fixture.schedules['1/inbound'].csv;
  assert.throws(() => parseHkkfTimetable(original, 1, 'outbound'), { kind: 'mappingMismatch' });
  assert.throws(() => parseHkkfTimetable(original.replace('Central,中環', 'Peng Chau,坪洲'), 1, 'inbound'), { kind: 'mappingMismatch' });
  assert.throws(() => parseHkkfTimetable(original.replace("'06:40'", "'26:40'"), 1, 'inbound'), { kind: 'invalidResponse' });
  assert.throws(() => parseHkkfTimetable(original.replace("'06:40'", 'function()'), 1, 'inbound'), { kind: 'invalidResponse' });
  const changed = structuredClone(fixture.routes);
  changed.data[0].route_id = 5;
  const { client, paths } = harness(() => response(changed));
  assert.equal((await client.readRoutes()).payload.kind, 'mappingMismatch');
  assert.equal((await client.readPier(7)).payload.kind, 'invalidInput');
  assert.equal((await client.readTimetable(1, '../route')).payload.kind, 'invalidInput');
  assert.deepEqual(paths, ['route']);
  const wrongPier = harness(() => response(fixture.piers[2]));
  assert.equal((await wrongPier.client.readPier(1)).payload.kind, 'mappingMismatch');
  const invalidPier = structuredClone(fixture.piers[1]);
  [invalidPier.data.lat, invalidPier.data.long] = [invalidPier.data.long, invalidPier.data.lat];
  assert.equal((await harness(() => response(invalidPier)).client.readPier(1)).payload.kind, 'invalidResponse');
  assert.equal((await harness(() => response('<html>Blocked</html>')).client.readRoutes()).payload.kind, 'invalidResponse');
});

test('ETA carries absolute arrival and a separate session context; sparse and stale data stay distinct', async () => {
  const { client, clock, advance } = harness();
  const reading = await client.readEta(3, 'outbound');
  const view = ferryEtaView(reading, clock());
  const arrival = view.arrivals[0];
  assert.equal(view.source.generatedAt, generated);
  assert.equal(arrival.kind, 'liveArrival');
  assert.equal(arrival.destinationPierId, 'hkkf:pier:4');
  assert.equal(arrival.sessionTime, '22:50:00');
  assert.equal(arrival.arrivalAt, Date.parse('2026-11-22T23:17:00+08:00'));
  assert.equal(ferryEtaView(await client.readEta(4, 'outbound'), clock()).kind, 'empty');
  assert.ok(parsedSchedule('3/outbound').entries.every(({ kind }) => kind === 'scheduledDeparture'));
  advance(120_000);
  assert.equal(ferryEtaView(reading, clock()).kind, 'stale');
  assert.equal(ferryFreshness(reading, clock(), 120_000), 'stale');
  const aged = harness(() => response(fixture.eta['3/outbound'], 200, {
    Date: new Date(generated).toUTCString(), Age: '120',
  }));
  assert.equal(ferryEtaView(await aged.client.readEta(3, 'outbound'), aged.clock()).kind, 'stale');
  const passed = structuredClone(fixture.eta['3/outbound']);
  passed.data[0].ETA = '2026-11-22T23:00:00+08:00';
  const past = harness(() => response(passed));
  assert.equal(ferryEtaView(await past.client.readEta(3, 'outbound'), past.clock()).kind, 'stale');
});

test('rejects naive and malformed ETA timestamps, wrong route or wrong direction', async () => {
  for (const [changes, expected] of [
    [{ ETA: '2026-11-22T23:17:00' }, 'invalidResponse'],
    [{ ETA: '2026-02-30T23:17:00+08:00' }, 'invalidResponse'],
    [{ date: '2026-02-30' }, 'invalidResponse'],
    [{ session_time: '24:11:30' }, 'invalidResponse'],
    [{ route_id: 2 }, 'mappingMismatch'],
    [{ direction: 'inbound' }, 'mappingMismatch'],
  ]) {
    const source = fixture.eta['3/outbound'];
    const { client } = harness(() => response({ ...source, data: [{ ...source.data[0], ...changes }] }));
    assert.equal((await client.readEta(3, 'outbound')).payload.kind, expected);
  }
});

test('distinguishes HTTP 422 and 500, network errors and disabled service', async () => {
  for (const status of [422, 500]) {
    const { client } = harness(() => response({ status: String(status) }, status));
    assert.deepEqual((await client.readEta(3, 'outbound')).payload, { kind: 'http', status });
  }
  const network = harness(() => Promise.reject(new Error('offline')));
  assert.equal((await network.client.readEta(3, 'outbound')).payload.kind, 'network');
  const disabled = harness(serverFixture, { enabled: false });
  assert.equal((await disabled.client.readRoutes()).payload.kind, 'unavailable');
  assert.equal(disabled.paths.length, 0);
  const forbidden = harness(() => response('<html>Forbidden</html>', 403));
  assert.equal((await forbidden.client.readEta(3, 'outbound')).payload.kind, 'unavailable');
  assert.equal((await forbidden.client.readRoutes()).payload.kind, 'unavailable');
  assert.deepEqual(forbidden.paths, [etaPath]);
});

test('coalesces only matching direction paths and caches static and live independently', async () => {
  const { client, paths, advance } = harness();
  await Promise.all([client.readEta(3, 'outbound'), client.readEta(3, 'outbound'), client.readEta(3, 'inbound'), client.readPier(2)]);
  assert.deepEqual(paths, [etaPath, 'eta/3/inbound', 'pier/2']);
  advance(59_999);
  await client.readEta(3, 'outbound');
  await client.readPier(2);
  assert.equal(paths.length, 3);
  advance(1);
  await client.readEta(3, 'outbound');
  await client.readPier(2);
  assert.deepEqual(paths.slice(3), [etaPath]);
  advance(14 * 60_000);
  await client.readPier(2);
  assert.equal(paths.at(-1), 'pier/2');
});

test('uses Retry-After seconds, HTTP dates or the minimum cooldown across resources', async () => {
  for (const [hint, expected] of [['90', 90_000], [new Date(generated + 90_000).toUTCString(), 90_000], ['', 60_000]]) {
    const { client, paths, advance } = harness((path) => path === etaPath
      ? response({}, 429, { 'Retry-After': hint, Date: new Date(generated).toUTCString() }) : serverFixture(path));
    const result = await client.readEta(3, 'outbound');
    assert.equal(result.payload.kind, 'rateLimited');
    assert.equal(result.retryAt, expected + 100);
    advance(expected - 1);
    assert.equal((await client.readPier(2)).payload.kind, 'rateLimited');
    assert.equal(paths.length, 1);
    advance(1);
    assert.equal((await client.readPier(2)).payload.kind, 'ready');
  }
});

for (const phase of ['connection', 'body']) {
  test('settles a hung ' + phase + ' independently of native abort, then recovers', { timeout: 2000 }, async () => {
    let calls = 0;
    let requestSignal;
    let finish;
    const hung = new Promise((resolve) => { finish = resolve; });
    const { client, advance, paths } = harness((path, { signal }) => {
      requestSignal = signal;
      if (++calls > 1) return serverFixture(path);
      return phase === 'connection' ? hung : { status: 200, text: () => hung };
    }, { timeoutMs: 25 });
    assert.equal((await client.readEta(3, 'outbound')).payload.kind, 'timeout');
    assert.equal(requestSignal.aborted, true);
    assert.equal((await client.readEta(3, 'outbound')).payload.kind, 'timeout');
    advance(60_000);
    assert.equal((await client.readEta(3, 'outbound')).payload.kind, 'ready');
    finish(phase === 'connection' ? response({}, 429, { 'Retry-After': '999' }) : '<html>late</html>');
    await new Promise(setImmediate);
    advance(60_000);
    assert.equal((await client.readEta(3, 'outbound')).payload.kind, 'ready');
    assert.equal(paths.length, 3);
  });
}

test('cancels one observer of a stalled body without cancelling the shared HTTP request', { timeout: 2000 }, async () => {
  let finish;
  let readStarted;
  const bodyStarted = new Promise((resolve) => { readStarted = resolve; });
  const body = new Promise((resolve) => { finish = resolve; });
  let providerSignal;
  const { client, paths } = harness((_path, { signal }) => {
    providerSignal = signal;
    return { status: 200, headers: new Headers(), text: () => { readStarted(); return body; } };
  });
  const abort = new AbortController();
  const cancelled = client.readEta(3, 'outbound', abort.signal);
  const surviving = client.readEta(3, 'outbound');
  await bodyStarted;
  abort.abort();
  assert.equal((await cancelled).payload.kind, 'cancelled');
  assert.equal((await client.readEta(3, 'outbound', abort.signal)).payload.kind, 'cancelled');
  assert.equal(providerSignal.aborted, false);
  finish(JSON.stringify(fixture.eta['3/outbound']));
  assert.equal((await surviving).payload.kind, 'ready');
  assert.deepEqual(paths, [etaPath]);
});

test('HKKF preview requires a development bundle and explicit opt-in', () => {
  const file = join(__dirname, '..', 'src', 'hkkf-preview.ts');
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  let enabledCreations = 0;
  for (const [dev, value, expected] of [[undefined, '1', false], [false, '1', false], [true, undefined, false], [true, '1', true]]) {
    const module = { exports: {} };
    new Function('exports', 'require', '__DEV__', 'process', source)(module.exports, () => ({
      createHkkfClient(options) {
        assert.deepEqual(options, { enabled: true });
        enabledCreations++;
        return { options };
      },
    }), dev, { env: { EXPO_PUBLIC_HKKF_PREVIEW: value } });
    assert.equal(module.exports.hkkfPreviewEnabled, expected);
    assert.equal(Boolean(module.exports.hkkfPreviewClient), expected);
  }
  assert.equal(enabledCreations, 1);
});

test('official 1823 calendar handles substitute public holidays and unknown coverage', () => {
  const { isHongKongPublicHoliday } = load('hong-kong-public-holidays');
  const table = parsedSchedule('2/outbound');
  assert.equal(isHongKongPublicHoliday('2026-04-07'), true);
  assert.equal(isHongKongPublicHoliday('2026-04-08'), false);
  assert.equal(isHongKongPublicHoliday('2028-01-03'), undefined);
  const holiday = ferryServiceDaySchedule(table, '2026-04-07', isHongKongPublicHoliday);
  assert.equal(holiday.kind, 'ready');
  assert.ok(holiday.entries.every(({ dayType }) => dayType === 'sundayOrPublicHoliday'));
  assert.equal(ferryServiceDaySchedule(table, '2028-01-03', isHongKongPublicHoliday).kind, 'calendarUnknown');
});
