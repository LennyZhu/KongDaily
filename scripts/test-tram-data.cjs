'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { dirname, resolve } = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');

const modules = new Map();
function load(name) {
  if (modules.has(name)) return modules.get(name).exports;
  const file = resolve(__dirname, '..', 'src', name + '.ts');
  const module = { exports: {} };
  modules.set(name, module);
  const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
  } });
  const local = createRequire(file);
  new Function('module', 'exports', 'require', 'fetch', outputText)(module, module.exports, (id) => {
    if (id === '@/database') return { getDatabase: () => assert.fail('The tram index must not open SQLite') };
    if (id === '@/bus-data') return { requestBusJson: () => assert.fail('The tram index must not request a feed') };
    if (id.startsWith('@/')) return load(id.slice(2));
    if (id.startsWith('.')) return JSON.parse(readFileSync(resolve(dirname(file), id), 'utf8'));
    return local(id);
  }, () => assert.fail('The tram index must work offline'));
  return module.exports;
}

const tram = load('tram-static');
const { distanceBetween, isNearHongKong } = load('nearby-bus-data');
const {
  listTramRoutes, getTramRoute, getTramDirections, getTramStopsForDirection, getTramStop, getTramVisitsForStop,
  searchTramStops, getTramStopServiceStatus, findNearbyTramStops, createTramServiceIndex,
} = tram;
const closure = require('../assets/data/tram-service-status.json')[0];

test('six route IDs, twelve direction IDs, 117 stop IDs and 427 visit keys are complete and distinct', () => {
  const routes = listTramRoutes();
  assert.deepEqual(routes.map(({ routeId }) => routeId), [4001, 4002, 4003, 4004, 4005, 4007]);
  const directions = routes.flatMap((route) => getTramDirections(route.routeId));
  assert.deepEqual(directions.map(({ visits }) => visits.length), [40, 41, 30, 31, 31, 33, 25, 26, 33, 32, 54, 51]);
  assert.equal(new Set(directions.map(({ key }) => key)).size, 12);
  const visits = directions.flatMap(({ visits }) => visits);
  assert.equal(visits.length, 427);
  assert.equal(new Set(visits.map(({ key }) => key)).size, 427);
  const stops = new Set(visits.map(({ stopId }) => stopId));
  assert.equal(stops.size, 117);
  for (const stopId of stops) {
    assert.ok(isNearHongKong(getTramStop(stopId)));
    assert.deepEqual(getTramVisitsForStop(stopId), visits.filter((visit) => visit.stopId === stopId));
  }
  directions.forEach(({ visits, routeTermini, routeId, directionId }) => {
    assert.equal(getTramStopsForDirection(routeId, directionId), visits);
    assert.equal(routeTermini.fromStopId, visits[0].stopId);
    assert.equal(routeTermini.toStopId, visits.at(-1).stopId);
    assert.equal(visits[0].pickDrop, 2);
    assert.equal(visits.at(-1).pickDrop, 1);
    assert.ok(visits.every(({ stopSequence }, i) => stopSequence === i + 1));
  });
  assert.equal(tram.tramCapabilities.realtimeEta, false);
  assert.match(tram.tramSource.sourceVersion, /^td-tram-2026-11-18-/);
  assert.equal(tram.tramSource.sourceUpdatedAt, '2026-11-18T19:03:25+08:00');
});

test('official directions preserve separately sited east and west stops and multi-line visits', () => {
  const west = getTramStopsForDirection(4001, 1);
  const east = getTramStopsForDirection(4001, 2);
  assert.equal(west[1].stopId, 99101);
  assert.equal(east.at(-2).stopId, 99251);
  assert.notDeepEqual(west[1].stop, east.at(-2).stop);
  assert.equal(west.at(-1).stopId, 99140);
  assert.equal(east[0].stopId, 99212);
  assert.ok(getTramVisitsForStop(99310).some(({ routeId, directionId }) => routeId === 4007 && directionId === 2));
  assert.ok(getTramVisitsForStop(99310).some(({ routeId, directionId }) => routeId === 4002 && directionId === 1));
  assert.equal(getTramRoute(4006), undefined);
  assert.deepEqual(getTramStopsForDirection(4006, 1), []);
});

test('Happy Valley approaches and exits retain independent loop geometry and boarding rules', () => {
  for (const routeId of [4002, 4003]) {
    const into = getTramStopsForDirection(routeId, 1).slice(-4);
    const out = getTramStopsForDirection(routeId, 2).slice(0, 5);
    assert.deepEqual(into.map(({ stopId }) => stopId), [99302, 99303, 99307, 99304]);
    assert.deepEqual(out.map(({ stopId }) => stopId), [99304, 99308, 99305, 99309, 99306]);
    assert.equal(into.at(-1).pickDrop, 1);
    assert.equal(out[0].pickDrop, 2);
  }
  assert.equal(getTramStopsForDirection(4002, 2)[5].stopId, 99227);
  assert.equal(getTramStopsForDirection(4003, 2)[5].stopId, 99126);
});

test('bilingual search preserves duplicate official label identities and source spellings', () => {
  const ids = (query) => searchTramStops(query).map(({ stopId }) => stopId);
  assert.deepEqual(ids('Western Market Terminus'), [99140, 99212]);
  assert.deepEqual(ids('  禮頓道  '), [99302, 99309]);
  assert.deepEqual(ids('Ｎｏｒｔｈ　Ｐｏｉｎｔ　Ｒｏａｄ (East bound)'), [99237, 99311]);
  assert.deepEqual(ids('Tai Hong Street (East bound)'), [99248, 99252]);
  assert.deepEqual(ids('太安街'), [99252]);
  assert.deepEqual(ids('Kennnedy Town Terminus'), [99201]);
  assert.deepEqual(ids('...'), []);
  assert.deepEqual(ids('不存在的電車站'), []);
});

test('radius is inclusive using unrounded distance and results are sorted with stable identities', () => {
  const stop = getTramStop(99304);
  const shifted = (distance) => ({ latitude: stop.latitude + distance / 6_371_008.8 * 180 / Math.PI, longitude: stop.longitude });
  for (const radius of [500, 1000, 2000]) {
    const within = shifted(radius - 0.01);
    const beyond = shifted(radius + 0.01);
    const rows = findNearbyTramStops(within, radius);
    assert.equal(rows.find(({ key }) => key === stop.key).distance, distanceBetween(within, stop));
    assert.ok(!findNearbyTramStops(beyond, radius).some(({ key }) => key === stop.key));
    assert.ok(rows.every((row, index) => index === 0 || rows[index - 1].distance <= row.distance));
  }
  assert.deepEqual(findNearbyTramStops({ latitude: NaN, longitude: 114.2 }, 500), []);
  assert.deepEqual(findNearbyTramStops(stop, 250), []);
});

test('known closure stays visible in the catalogue but outside nearby results', () => {
  const stop = getTramStop(99313);
  assert.equal(searchTramStops('石塘咀總站')[0], stop);
  assert.equal(getTramRoute(4004).directions[0].routeTermini.fromStopId, stop.stopId);
  const status = getTramStopServiceStatus(stop.stopId);
  assert.equal(status.serviceStatus, 'temporarily_closed');
  assert.equal(status.notice.publishedOn, '2026-09-09');
  assert.equal(status.notice.checkedOn, '2026-11-23');
  assert.match(status.notice.description.en, /07E.*94W/);
  assert.ok(!findNearbyTramStops(stop, 2000).some((row) => row.stop === stop));
  assert.ok(!getTramStopsForDirection(4004, 1).some(({ stopId }) => stopId === 99205));
});

test('unknown stays unverified, and only explicit reopening restores boarding eligibility', () => {
  const stop = getTramStop(99313);
  const omitted = createTramServiceIndex([]);
  assert.equal(omitted.getTramStopServiceStatus(stop.stopId).serviceStatus, 'unknown');
  const candidate = omitted.findNearbyTramStops(stop, 500).find((row) => row.stop === stop);
  assert.ok(candidate.scheduledBoardingVisits.length > 0);
  assert.deepEqual(candidate.verifiedBoardingVisits, []);
  const supplied = structuredClone({ ...closure, serviceStatus: 'active' }); // Simulated reviewed replacement.
  const reopened = createTramServiceIndex([supplied]);
  supplied.notice.description.en = 'mutated by caller';
  const active = reopened.findNearbyTramStops(stop, 500)[0];
  assert.equal(active.serviceStatus.serviceStatus, 'active');
  assert.notEqual(active.serviceStatus.notice.description.en, supplied.notice.description.en);
  assert.deepEqual(active.verifiedBoardingVisits.map(({ routeId, directionId }) => [routeId, directionId]), [[4004, 1], [4005, 2]]);
  assert.equal(getTramStopServiceStatus(stop.stopId).serviceStatus, 'temporarily_closed');
  assert.equal(getTramStopServiceStatus(0), undefined);
});

test('public catalogue objects and query results are immutable and malformed overrides fail closed', () => {
  const route = getTramRoute(4001);
  const stop = getTramStop(99310);
  assert.throws(() => { route.directions[0].visits[0].stop.localizedStopNames.en = 'modified'; }, TypeError);
  assert.throws(() => { getTramVisitsForStop(99310).pop(); }, TypeError);
  assert.throws(() => { findNearbyTramStops(stop, 500)[0].distance = 30; }, TypeError);
  assert.throws(() => { tram.tramSource.files['STOP_TRAM.xml'].sha256 = 'modified'; }, TypeError);
  assert.throws(() => createTramServiceIndex([closure, closure]), /Duplicate|duplicate/);
  assert.throws(() => createTramServiceIndex([{ ...closure, stopId: 0 }]), /Invalid/);
  assert.throws(() => createTramServiceIndex([{ ...closure, notice: { ...closure.notice, checkedOn: '2026-02-30' } }]), /Invalid/);
  assert.throws(() => createTramServiceIndex([{ ...closure, notice: { ...closure.notice, url: 'https://example.test' } }]), /Invalid/);
});

const { nearbyTramRows } = load('nearby-tram');
const { tramDirectionLabel } = load('tram-direction');
const tramCopy = load('i18n').messages;

test('nearby directions use their nearest scheduled pick-up in every radius', () => {
  const center = getTramStop(99304);
  let previousIds = new Set();
  for (const radius of [500, 1000, 2000]) {
    const routes = nearbyTramRows(center, radius, 'routes');
    const stops = nearbyTramRows(center, radius, 'stops');
    assert.ok([...previousIds].every((key) => stops.some((row) => row.key === key)));
    previousIds = new Set(stops.map(({ key }) => key));
    assert.equal(new Set(routes.map(({ key }) => key)).size, routes.length);
    routes.forEach(({ station, choice }, index) => {
      assert.ok(station.distance <= radius);
      assert.ok(index === 0 || routes[index - 1].station.distance <= station.distance);
      assert.equal(choice.visit.stopId, station.stop.stopId);
      assert.notEqual(choice.visit.pickDrop, 1);
      assert.equal(station.serviceStatus.serviceStatus, 'unknown');
      const eligible = stops.filter((row) => row.choices.some((candidate) =>
        candidate.direction.key === choice.direction.key && candidate.visit.pickDrop !== 1));
      assert.equal(station.distance, Math.min(...eligible.map((row) => row.station.distance)));
    });
    const happyValley = stops.find(({ station }) => station.stop.stopId === 99304);
    assert.deepEqual(happyValley.choices.map(({ visit }) => [visit.routeId, visit.directionId, visit.pickDrop]),
      [[4002, 1, 1], [4002, 2, 2], [4003, 1, 1], [4003, 2, 2]]);
    assert.deepEqual(routes.filter(({ station }) => station.stop.stopId === 99304)
      .map(({ choice }) => tramDirectionLabel(choice.direction, tramCopy.en.tram, 'en')),
    ['Eastbound on main line', 'Westbound on main line']);
  }
});

test('nearby rows keep same-name platform IDs apart and exclude the closed terminus from both modes', () => {
  const central = nearbyTramRows(getTramStop(99212), 500, 'stops');
  const westbound = central.find(({ station }) => station.stop.stopId === 99140);
  const eastbound = central.find(({ station }) => station.stop.stopId === 99212);
  assert.ok(westbound && eastbound && westbound.key !== eastbound.key);
  assert.ok(westbound.choices.some(({ visit }) => visit.routeId === 4001 && visit.directionId === 1));
  assert.ok(eastbound.choices.some(({ visit }) => visit.routeId === 4001 && visit.directionId === 2));

  const closedCenter = getTramStop(99313);
  for (const view of ['stops', 'routes']) {
    assert.ok(nearbyTramRows(closedCenter, 2000, view).every(({ station }) => station.stop.stopId !== 99313));
  }
  assert.ok(nearbyTramRows(closedCenter, 2000, 'routes').some(({ choice }) => choice.affectedTerminus));
  assert.ok(searchTramStops('石塘咀總站').some(({ stopId }) => stopId === 99313));
});
