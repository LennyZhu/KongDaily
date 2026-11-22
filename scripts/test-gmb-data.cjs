const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
const fixture = require('./fixtures/gmb-api.json');

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

const { createGmbClient } = load('gmb-client');
const { gmbEtaView } = load('gmb-data');
const stop = { routeId: 2009246, routeSeq: 1, stopSeq: 1, stopId: 20000418 };
const etaPath = '/eta/route-stop/2009246/1/1';
const generated = Date.parse(fixture.forecast.generated_timestamp);
const response = (body, status = 200, headers) => new Response(JSON.stringify(body), { status, headers });

function harness(request, options) {
  let offset = 0;
  const clock = () => ({ wall: generated + offset, monotonic: 100 + offset });
  const paths = [];
  const client = createGmbClient({ clock, ...options, request: (address, options) => {
    const url = new URL(address);
    assert.equal(url.origin, 'https://data.etagmb.gov.hk');
    paths.push(url.pathname);
    return request(url.pathname, options);
  } });
  return { client, clock, paths, advance: (ms) => { offset += ms; } };
}

function exactForecast(entries, overrides = {}) {
  return { ...fixture.forecast, data: { enabled: true, stop_id: stop.stopId, eta: entries }, ...overrides };
}

function entry(diff = 4, overrides = {}) {
  return { eta_seq: 1, diff, timestamp: new Date(generated + diff * 60_000).toISOString(),
    remarks_tc: null, remarks_sc: null, remarks_en: null, ...overrides };
}

test('catalogue distinguishes all regions and resolves the same code without merging service variants', async () => {
  const payloads = {
    '/route': fixture.directory, '/route/HKI': fixture.regional,
    '/route/HKI/2': fixture.hki2, '/route/KLN/2': fixture.kln2, '/route/NT/2': fixture.nt2,
    '/route/2009246': fixture.kln2,
  };
  const { client } = harness((path) => response(payloads[path]));
  const all = (await client.readDirectory()).payload.data.routes;
  assert.ok(Object.values(all).every((routes) => routes.includes('2')));
  assert.deepEqual((await client.readRegionalDirectory('HKI')).payload.data.routes, all.HKI);
  const hki = (await client.readRoutesByCode('HKI', '2')).payload.data;
  const kln = (await client.readRoutesByCode('KLN', '2')).payload.data;
  const nt = (await client.readRoutesByCode('NT', '2')).payload.data;
  assert.deepEqual(hki.map((route) => route.routeId), [2006474, 2006475]);
  assert.deepEqual(nt.map((route) => route.routeId), [2002342, 2002344, 2002349]);
  assert.equal(nt[2].description.tc, '特別班次');
  assert.equal(nt[2].description.en, 'Special Departure');
  assert.deepEqual(hki[0].directions.map((direction) => direction.routeSeq), [1]);
  assert.deepEqual(kln[0].directions.map((direction) => direction.routeSeq), [1, 2]);
  assert.equal(kln[0].directions[0].destination.en, 'Festival Walk Public Transport Interchange');
  assert.equal(kln[0].directions[1].destination.tc, '黃埔花園公共運輸交匯處');
  assert.deepEqual((await client.readRouteById(2009246)).payload.data, kln);
  assert.equal((await client.readRouteById(2009247)).payload.kind, 'invalidResponse');
});

test('circular visits preserve each stop sequence and original names for a repeated physical stop', async () => {
  const { client, paths } = harness((path) => path.startsWith('/route-stop') ? response(fixture.circular)
    : response({ ...fixture.empty, data: { ...fixture.empty.data, stop_id: 20014492 } }));
  const { payload } = await client.readRouteStops({ routeId: 2006474, routeSeq: 1 });
  const visits = payload.data.visits.filter((visit) => visit.stopId === 20014492);
  assert.deepEqual(visits.map((visit) => visit.stopSeq), [1, 11]);
  assert.equal(visits[0].name.tc, '香港站小巴總站');
  assert.equal(visits[0].name.en, 'Hong Kong Station Minibus Terminus');
  await Promise.all(visits.map((visit) => client.readEta(visit)));
  assert.deepEqual(paths.slice(1), ['/eta/route-stop/2006474/1/1', '/eta/route-stop/2006474/1/11']);
});

test('duplicate stop sequences and mismatched regions fail validation', async () => {
  const bad = structuredClone(fixture.circular);
  bad.data.route_stops[1].stop_seq = bad.data.route_stops[0].stop_seq;
  const { client } = harness((path) => response(path.startsWith('/route-stop') ? bad : fixture.hki2));
  assert.equal((await client.readRouteStops({ routeId: 2006474, routeSeq: 1 })).payload.kind, 'invalidResponse');
  assert.equal((await client.readRoutesByCode('NT', '2')).payload.kind, 'invalidResponse');
});

test('reads official WGS84 and rejects swapped, missing and out-of-area positions', async () => {
  const { client } = harness(() => response(fixture.stop));
  const result = (await client.readStop(stop.stopId)).payload.data;
  assert.deepEqual(result.coordinates, fixture.stop.data.coordinates.wgs84);
  assert.equal(result.stopId, stop.stopId);
  for (const wgs84 of [{ latitude: 114, longitude: 22 }, { latitude: 25, longitude: 115 }, undefined]) {
    const { client } = harness(() => response({ ...fixture.stop,
      data: { ...fixture.stop.data, coordinates: { wgs84 } } }));
    assert.equal((await client.readStop(stop.stopId)).payload.kind, 'invalidResponse');
  }
});

test('exact ETA paths use distinct line directions and validate returned stop identity after coalescing', async () => {
  const { client, paths } = harness(() => response(exactForecast([entry()])));
  const [wrong, correct, reverse] = await Promise.all([
    client.readEta({ ...stop, stopId: 999 }),
    client.readEta(stop),
    client.readEta({ ...stop, routeSeq: 2 }),
  ]);
  assert.equal(wrong.payload.kind, 'invalidResponse');
  assert.equal(correct.payload.kind, 'ready');
  assert.equal(reverse.payload.kind, 'ready');
  assert.deepEqual(paths, [etaPath, '/eta/route-stop/2009246/2/1']);
  assert.equal((await client.readEta({ ...stop, stopSeq: 0 })).payload.kind, 'invalidInput');
  assert.equal((await client.readRoutesByCode('HKI', '../../stop')).payload.kind, 'invalidInput');
  assert.equal(paths.length, 2);
});

test('live countdown and imminent use absolute time, with no countdown on planned or remark-only entries', async () => {
  const { client, clock, advance } = harness(() => response(exactForecast([
    entry(), { ...fixture.forecast.data.eta[0], eta_seq: 2, remarks_en: null },
    { eta_seq: 3, timestamp: null, diff: null, remarks_tc: '服務改動', remarks_en: 'Service alteration' },
  ])));
  const reading = await client.readEta(stop);
  let view = gmbEtaView(reading, clock());
  assert.equal(view.entries[0].remainingMinutes, 4);
  assert.equal(view.entries[1].kind, 'scheduled');
  assert.equal(view.entries[1].remarks.tc, '未開出');
  assert.equal(view.entries[1].remainingMinutes, undefined);
  assert.equal(view.entries[2].kind, 'notice');
  assert.equal(view.entries[2].timestamp, null);

  const imminent = harness(() => response(exactForecast([entry(0, {
    timestamp: new Date(generated + 40_000).toISOString(),
  })])));
  const snapshot = await imminent.client.readEta(stop);
  assert.equal(gmbEtaView(snapshot, imminent.clock()).entries[0].imminent, true);
  imminent.advance(41_000);
  assert.equal(gmbEtaView(snapshot, imminent.clock()).kind, 'stale');
});

test('separates empty, disabled and HTTP 500 responses', async () => {
  const empty = harness(() => response(exactForecast([])));
  assert.equal(gmbEtaView(await empty.client.readEta(stop), empty.clock()).kind, 'empty');
  const disabled = harness(() => response({ ...fixture.forecast, data: {
    enabled: false, stop_id: stop.stopId, description_tc: '暫停提供', description_en: 'Temporarily disabled',
  } }));
  assert.deepEqual(gmbEtaView(await disabled.client.readEta(stop), disabled.clock()), {
    kind: 'disabled', generatedAt: generated, description: { tc: '暫停提供', sc: null, en: 'Temporarily disabled' },
  });
  const failure = harness(() => response(fixture.http500, 500));
  assert.deepEqual(gmbEtaView(await failure.client.readEta(stop), failure.clock()), { kind: 'http', status: 500 });
});

test('old generation, cached Age, expired observations and implausible relative minutes hide ETA', async () => {
  const fresh = harness(() => response(exactForecast([entry()])));
  const reading = await fresh.client.readEta(stop);
  fresh.advance(120_000);
  assert.equal(gmbEtaView(reading, fresh.clock()).kind, 'stale');
  const aged = harness(() => response(exactForecast([entry()]), 200, {
    Date: new Date(generated).toUTCString(), Age: '121',
  }));
  assert.equal(gmbEtaView(await aged.client.readEta(stop), aged.clock()).kind, 'stale');
  const old = harness(() => response(exactForecast([entry()], {
    generated_timestamp: new Date(generated - 150_000).toISOString(),
  })));
  assert.equal(gmbEtaView(await old.client.readEta(stop), old.clock()).kind, 'stale');
  const inconsistent = harness(() => response(exactForecast([entry(4, {
    timestamp: new Date(generated + 30 * 60_000).toISOString(),
  })])));
  assert.equal(gmbEtaView(await inconsistent.client.readEta(stop), inconsistent.clock()).kind, 'invalidResponse');
  const negative = harness(() => response(exactForecast([entry(-1)])));
  assert.equal(gmbEtaView(await negative.client.readEta(stop), negative.clock()).kind, 'stale');
});

test('keeps separate static and ETA cache lifetimes and merges concurrent ETA reads', async () => {
  const { client, paths, advance } = harness((path) => response(path === etaPath ? exactForecast([entry()]) : fixture.stop));
  await Promise.all([client.readEta(stop), client.readEta(stop), client.readStop(stop.stopId)]);
  advance(59_999);
  await client.readEta(stop);
  assert.equal(paths.length, 2);
  advance(1);
  await Promise.all([client.readEta(stop), client.readEta(stop), client.readStop(stop.stopId)]);
  assert.deepEqual(paths, [etaPath, '/stop/20000418', etaPath]);
  advance(14 * 60_000);
  await client.readStop(stop.stopId);
  assert.equal(paths.length, 4);
});

for (const phase of ['connection', 'body']) {
  test('settles a hung ' + phase + ' on timeout and recovers after the cooldown', { timeout: 2000 }, async () => {
    let calls = 0;
    let signal;
    const hung = new Promise(() => {});
    const { client, advance } = harness((_path, options) => {
      signal = options.signal;
      if (++calls > 1) return response(exactForecast([entry()]));
      return phase === 'body' ? { status: 200, text: () => hung } : hung;
    }, { timeoutMs: 25 });
    assert.equal((await client.readEta(stop)).payload.kind, 'timeout');
    assert.equal(signal.aborted, true);
    await client.readEta(stop);
    assert.equal(calls, 1);
    advance(60_000);
    assert.equal((await client.readEta(stop)).payload.kind, 'ready');
    assert.equal(calls, 2);
  });
}

test('cancelling a caller settles immediately without cancelling another body reader', { timeout: 2000 }, async () => {
  let release;
  let markBodyStarted;
  const bodyStarted = new Promise((resolve) => { markBodyStarted = resolve; });
  const body = new Promise((resolve) => { release = resolve; });
  const { client, paths } = harness(() => ({
    status: 200, headers: new Headers(), text() { markBodyStarted(); return body; },
  }), { timeoutMs: 1000 });
  const controller = new AbortController();
  const cancelled = client.readEta(stop, controller.signal);
  const survivor = client.readEta(stop);
  await bodyStarted;
  controller.abort();
  assert.equal((await cancelled).payload.kind, 'cancelled');
  assert.equal((await client.readEta(stop, controller.signal)).payload.kind, 'cancelled');
  release(JSON.stringify(exactForecast([entry()])));
  assert.equal((await survivor).payload.kind, 'ready');
  assert.deepEqual(paths, [etaPath]);
});

test('a cancelled connection cannot overwrite a retry after its request deadline', { timeout: 2000 }, async () => {
  let release;
  const old = new Promise((resolve) => { release = resolve; });
  const { client, paths, advance } = harness(() => paths.length === 1 ? old
    : response(exactForecast([entry()])), { timeoutMs: 25 });
  const controller = new AbortController();
  const cancelled = client.readEta(stop, controller.signal);
  const observer = client.readEta(stop);
  controller.abort();
  assert.equal((await cancelled).payload.kind, 'cancelled');
  assert.equal((await observer).payload.kind, 'timeout');
  advance(60_000);
  assert.equal((await client.readEta(stop)).payload.kind, 'ready');
  release(response({}, 429, { 'Retry-After': '9999' }));
  await new Promise(setImmediate);
  advance(60_000);
  assert.equal((await client.readEta(stop)).payload.kind, 'ready');
  assert.equal(paths.length, 3);
});

test('network, malformed JSON and invalid envelopes always settle with distinct failures', async () => {
  const network = harness(() => Promise.reject(new Error('network error')));
  assert.equal((await network.client.readEta(stop)).payload.kind, 'network');
  const html = harness(() => new Response('<html>'));
  assert.equal((await html.client.readEta(stop)).payload.kind, 'invalidResponse');
  const bad = harness(() => response(exactForecast([entry(1, { timestamp: '2026-02-30T00:00:00+08:00' })])));
  assert.equal((await bad.client.readEta(stop)).payload.kind, 'invalidResponse');
});

test('429 Retry-After deadlines isolate the minibus host and apply across resources', async () => {
  for (const retryAfter of ['90', new Date(generated + 90_000).toUTCString()]) {
    const { client, paths, advance } = harness((path) => path === etaPath
      ? response({}, 429, { 'Retry-After': retryAfter, Date: new Date(generated).toUTCString() })
      : response(fixture.stop));
    assert.equal((await client.readEta(stop)).retryAt, 90_100);
    advance(89_000);
    assert.equal((await client.readStop(stop.stopId)).payload.kind, 'rateLimited');
    assert.equal(paths.length, 1);
    advance(1000);
    assert.equal((await client.readStop(stop.stopId)).payload.kind, 'ready');
    assert.equal(paths.length, 2);
  }
});

test('official code lookup accepts letter prefixes and digits after a suffix', async () => {
  const { gmbSearchCode, searchGmbRoutes } = load('gmb-search');
  assert.deepEqual([' Ｎ４Ａ ', 'cx1', '44a1', '20m', '2', 'Admiralty'].map(gmbSearchCode),
    ['N4A', 'CX1', '44A1', '20M', '2', '']);
  const directory = { ...fixture.directory, data: { ...fixture.directory.data, routes: {
    HKI: ['N4A'], KLN: [], NT: ['44A1'],
  } } };
  const { client, paths } = harness((path) => path === '/route' ? response(directory) : response({
    ...fixture.hki2, data: [{ ...fixture.hki2.data[0], route_code: 'N4A' }],
  }));
  const { routes } = await searchGmbRoutes('N4A', new AbortController().signal, client);
  assert.deepEqual(routes.map(({ routeCode }) => routeCode), ['N4A']);
  assert.deepEqual(paths, ['/route', '/route/HKI/N4A']);
});

test('catalogue lookup preserves successful regions, reports failures, and skips detail after cancellation', async () => {
  const { searchGmbRoutes } = load('gmb-search');
  const read = new AbortController();
  const partial = harness((path) => {
    if (path === '/route') return response(fixture.directory);
    if (path === '/route/KLN/2') return response(fixture.kln2);
    return response({}, 500);
  });
  const result = await searchGmbRoutes('2', read.signal, partial.client);
  assert.equal(result.status, 'partial');
  assert.deepEqual(result.routes.map(({ routeId }) => routeId), [2009246]);
  assert.deepEqual(partial.paths, ['/route', '/route/HKI/2', '/route/KLN/2', '/route/NT/2']);
  const offline = harness(() => response({}, 500));
  assert.equal((await searchGmbRoutes('2', read.signal, offline.client)).status, 'failed');

  let complete;
  const waiting = new Promise((resolve) => { complete = resolve; });
  const cancelled = harness(() => waiting);
  const search = searchGmbRoutes('2', read.signal, cancelled.client);
  read.abort();
  assert.equal((await search).status, 'failed');
  complete(response(fixture.directory));
  await new Promise(setImmediate);
  assert.deepEqual(cancelled.paths, ['/route']);
});
