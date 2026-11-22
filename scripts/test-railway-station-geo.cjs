const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { createRequire } = require('node:module');
const { dirname, join, resolve } = require('node:path');
const { test } = require('node:test');
const { gunzipSync } = require('node:zlib');
const ts = require('typescript');

const root = resolve(__dirname, '..');
const modules = new Map();
function load(name) {
  if (modules.has(name)) return modules.get(name).exports;
  const path = join(root, 'src', name + '.ts');
  const file = existsSync(path) ? path : path + 'x';
  const module = { exports: {} };
  modules.set(name, module);
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
  } }).outputText;
  const local = createRequire(file);
  new Function('module', 'exports', 'require', 'fetch', code)(module, module.exports, (id) => {
    if (id === '@/database') return { getDatabase: () => assert.fail('Geography must not open SQLite') };
    if (id === '@/bus-data') return { requestBusJson: () => assert.fail('Geography must not request a network feed') };
    if (id.startsWith('@/')) return load(id.slice(2));
    if (id.startsWith('.')) return JSON.parse(readFileSync(resolve(dirname(file), id), 'utf8'));
    return local(id);
  }, () => assert.fail('Geography must work offline'));
  return module.exports;
}

const geo = load('railway-station-geo');
const { distanceBetween } = load('nearby-bus-data');
const { hkGridToWgs84 } = load('hk-grid');
const { mtrLines, mtrStations, findMtrStation } = load('mtr-static');
const { lightRailRoutes, lightRailStops, findLightRailStop, findLightRailRoute } = load('light-rail-static');
const raw = JSON.parse(gunzipSync(readFileSync(join(root, 'scripts/fixtures/railway-geo/igeocom-railway-source.json.gz'))));
const byId = new Map(raw.features.map((feature) => [String(feature.properties.GEONAMEID), feature]));
const center = { latitude: 22.3, longitude: 114.15 };
const northAt = (metres) => ({ latitude: center.latitude + metres / 6_371_008.8 * 180 / Math.PI, longitude: center.longitude });
function stationFixture(id, positions, extra = {}) {
  return { ...geo.getRailwayStationGeo('mtr', 'ADM'), stationId: id, positions, ...extra };
}
const position = (metres, kind = 'entrance') => ({ kind, coordinate: northAt(metres), sourceRecordIds: ['test-only'] });

test('offline geography maps every existing official MTR and Light Rail ID without changing catalogue memberships', () => {
  assert.equal(mtrLines.length, 10);
  assert.equal(mtrStations.length, 98);
  assert.equal(lightRailRoutes.length, 11);
  assert.equal(lightRailStops.length, 68);
  assert.equal(geo.railwayStationGeographies.length, 166);
  for (const [mode, stations, type] of [['mtr', mtrStations, 'RSN'], ['lightRail', lightRailStops, 'LRA']]) {
    const records = geo.railwayStationGeographies.filter((station) => station.mode === mode);
    assert.deepEqual(new Set(records.map(({ stationId }) => stationId)), new Set(stations.map(({ id }) => id)));
    for (const { id } of stations) {
      const record = geo.getRailwayStationGeo(mode, id);
      assert.equal(record.status, 'verified');
      assert(geo.hasRailwayStationGeo(mode, id));
      assert.equal(byId.get(record.stationRecordId).properties.TYPE, type);
      assert(record.positions.length > 0);
    }
  }
  assert.equal(findMtrStation('RAC').supplemental, true);
  assert.deepEqual(findLightRailStop('250'), {
    kind: 'light-rail-stop', id: '250', code: 'TSP', zh: '海皇路', en: 'Hoi Wong Road', routes: ['507', '614', '614P'],
  });
});

test('Hoi Wong Road 250 and named Light Rail stops use LRA station-level references, never heavy rail or platforms', () => {
  const hoiWong = geo.getLightRailStopPositions('250');
  assert.equal(hoiWong.length, 1);
  assert.deepEqual(hoiWong[0].sourceRecordIds, ['529462']);
  assert.deepEqual(hoiWong[0].coordinate, { latitude: 22.38116, longitude: 113.97041 });
  for (const id of ['250', '380', '295', '600', '430', '100']) {
    const positions = geo.getLightRailStopPositions(id);
    assert.equal(positions.length, 1);
    assert.equal(positions[0].kind, 'station-reference');
    assert.equal(byId.get(positions[0].sourceRecordIds[0]).properties.TYPE, 'LRA');
  }
  for (const route of ['705', '706']) {
    for (const pattern of findLightRailRoute(route).patterns) {
      for (const { stopId } of pattern.visits) assert(geo.hasRailwayStationGeo('lightRail', stopId));
    }
  }
});

test('interchange geography is shared by station code while every line-specific business identity is preserved', () => {
  assert.equal(findMtrStation('ADM').memberships.length, 4);
  for (const code of ['ADM', 'CEN', 'HOK', 'KOW', 'TSY']) {
    const station = findMtrStation(code);
    const references = station.memberships.map(() => geo.getRailwayStationGeo('mtr', code));
    assert(references.every((record) => record === references[0]));
    assert.equal(geo.railwayStationGeographies.filter((record) => record.mode === 'mtr' && record.stationId === code).length, 1);
    assert(geo.getMtrStationPositions(code).filter(({ kind }) => kind === 'entrance').length > 1);
  }
  for (const code of ['HOK', 'KOW', 'TSY']) {
    assert.deepEqual(findMtrStation(code).memberships.map(({ lineCode }) => lineCode).sort(), ['AEL', 'TCL']);
    assert.equal(new Set(findMtrStation(code).memberships.map(({ stationId }) => stationId)).size, 2);
  }
});

test('Central/Hong Kong, Tsim Sha Tsui/East Tsim Sha Tsui and heavy/light same-name stations retain disjoint geography', () => {
  for (const [[modeA, idA], [modeB, idB]] of [
    [['mtr', 'CEN'], ['mtr', 'HOK']], [['mtr', 'TST'], ['mtr', 'ETS']],
    [['mtr', 'TUM'], ['lightRail', '295']], [['mtr', 'YUL'], ['lightRail', '600']],
    [['mtr', 'SIH'], ['lightRail', '100']], [['mtr', 'TIS'], ['lightRail', '430']],
  ]) {
    const a = geo.getRailwayStationGeo(modeA, idA);
    const b = geo.getRailwayStationGeo(modeB, idB);
    assert(a && b, `${modeA}/${idA}, ${modeB}/${idB}`);
    assert.notEqual(a.stationRecordId, b.stationRecordId);
    const aIds = new Set(a.positions.flatMap(({ sourceRecordIds }) => sourceRecordIds));
    assert(b.positions.every(({ sourceRecordIds }) => sourceRecordIds.every((id) => !aIds.has(id))));
    assert.notDeepEqual(a.positions[0].coordinate, b.positions[0].coordinate);
  }
});

test('multiple entrances retain official coordinates; co-located HKU A1/A2 retain both source identities at one point', () => {
  let entranceRecords = 0;
  for (const station of geo.railwayStationGeographies) {
    const points = new Set();
    for (const position of station.positions) {
      const key = JSON.stringify([position.kind, position.coordinate]);
      assert(!points.has(key), 'No duplicate positions of the same kind within one station');
      points.add(key);
      for (const id of position.sourceRecordIds) {
        const feature = byId.get(id);
        const [longitude, latitude] = feature.geometry.coordinates;
        assert.deepEqual(position.coordinate, { latitude, longitude }, 'Preserve the actual official point; never average');
        if (position.kind === 'entrance') {
          entranceRecords++;
          const anchor = byId.get(station.stationRecordId).properties;
          assert.equal(feature.properties.E_SITENAME, anchor.ENGLISHNAME);
          assert.equal(feature.properties.C_SITENAME, anchor.CHINESENAME);
        }
      }
    }
  }
  assert.equal(entranceRecords, 610);
  const shared = geo.getMtrStationPositions('HKU').find(({ sourceRecordIds }) => sourceRecordIds.includes('560348'));
  assert.deepEqual(shared.sourceRecordIds, ['560348', '560349']);
  assert(!geo.getMtrStationPositions('DIH').some(({ sourceRecordIds }) => sourceRecordIds.includes('21279579')));
});

test('all official WGS84 geometry agrees with the existing HK1980 metre-grid conversion within two metres', () => {
  let maximumDifference = 0;
  for (const feature of raw.features) {
    const { EASTING, NORTHING } = feature.properties;
    const converted = hkGridToWgs84(EASTING, NORTHING);
    assert(converted, String(feature.properties.GEONAMEID));
    const [longitude, latitude] = feature.geometry.coordinates;
    const error = distanceBetween(converted, { latitude, longitude });
    assert(error < 2, `${feature.properties.GEONAMEID}: ${error} m`);
    maximumDifference = Math.max(maximumDifference, error);
  }
  console.log(`Official WGS84 / existing EPSG:2326 conversion maximum difference: ${maximumDifference.toFixed(3)} m`);
  for (const point of [[NaN, 825000], [835000, null], [825000, 8350000], [114.1, 22.3], [0, 0]]) {
    assert.equal(hkGridToWgs84(...point), undefined);
  }
});

test('nearest distance selects a real entrance and ignores a closer reference point when entrances exist', () => {
  const record = stationFixture('TEST', [position(0, 'station-reference'), position(200), position(50), position(100)]);
  const nearest = geo.nearestRailwayPosition(center, record);
  assert.equal(nearest.position, record.positions[2]);
  assert(Math.abs(nearest.distance - 50) < 0.00001);
  const referenceOnly = stationFixture('REFERENCE', [position(75, 'station-reference')]);
  assert.equal(geo.nearestRailwayPosition(center, referenceOnly).position.kind, 'station-reference');
});

test('500/1000/2000 metre radius boundaries use unrounded Haversine distances and sort ascending', () => {
  for (const radius of [500, 1000, 2000]) {
    const within = stationFixture('WITHIN', [position(radius - 0.001)]);
    const outside = stationFixture('OUTSIDE', [position(radius + 0.001)]);
    const near = stationFixture('NEAR', [position(1)]);
    const found = geo.findNearbyRailwayStations(center, radius, undefined, [outside, within, near]);
    assert.deepEqual(found.map(({ station }) => station.stationId), ['NEAR', 'WITHIN']);
    assert(found[1].distance <= radius && found[1].distance > radius - 0.002);
    assert(geo.nearestRailwayPosition(center, outside).distance > radius);
  }
  assert.deepEqual(geo.findNearbyRailwayStations(center, 750), []);
});

test('missing/unresolved/invalid coordinates safely omit nearby results while catalogue lookups remain available', () => {
  assert.deepEqual(geo.getMtrStationPositions('UNKNOWN'), []);
  assert.deepEqual(geo.getLightRailStopPositions('UNKNOWN'), []);
  assert.deepEqual(geo.getLightRailStopPositions(250), [], 'Do not conflate string and numeric business IDs');
  assert.equal(geo.hasRailwayStationGeo('mtr', 'UNKNOWN'), false);
  assert.equal(geo.getRailwayStationGeo('__proto__', 'ADM'), undefined);
  const unresolved = stationFixture('RAC', [], { status: 'unresolved' });
  assert.equal(geo.nearestRailwayPosition(center, unresolved), undefined);
  const invalid = stationFixture('INVALID', [{ ...position(1), coordinate: { latitude: 114.1, longitude: 22.3 } }]);
  assert.equal(geo.nearestRailwayPosition(center, invalid), undefined);
  assert.deepEqual(geo.findNearbyRailwayStations(center, 500, undefined, [unresolved, invalid]), []);
  for (const point of [{ latitude: NaN, longitude: 114.1 }, { latitude: 22.3, longitude: Infinity }, { latitude: 0, longitude: 0 }]) {
    assert.deepEqual(geo.findNearbyRailwayStations(point, 500), []);
  }
  assert.equal(findMtrStation('RAC').id, 'RAC');
  assert.equal(findLightRailStop('250').id, '250');
});

test('real geographic samples cover Hong Kong regions and mode filters remain separate', () => {
  for (const [mode, id] of [['mtr', 'CEN'], ['mtr', 'ADM'], ['mtr', 'KOT'], ['mtr', 'RAC'], ['mtr', 'TUM'], ['lightRail', '250']]) {
    const station = geo.getRailwayStationGeo(mode, id);
    const point = station.positions.find(({ kind }) => kind === (mode === 'mtr' ? 'entrance' : 'station-reference')).coordinate;
    const found = geo.findNearbyRailwayStations(point, 500, mode);
    assert(found.some(({ station: row, distance }) => row.stationId === id && distance === 0));
    assert(found.every(({ station: row }) => row.mode === mode));
  }
  const lr = geo.getLightRailStopPositions('295')[0].coordinate;
  const both = geo.findNearbyRailwayStations(lr, 500);
  assert(both.some(({ station }) => station.mode === 'lightRail' && station.stationId === '295'));
  assert(both.some(({ station }) => station.mode === 'mtr' && station.stationId === 'TUM'));
});
