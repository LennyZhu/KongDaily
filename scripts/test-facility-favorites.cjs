// Exercise the actual App repository and migration SQL against temporary SQLite files.
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { dirname, join, resolve } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');

const root = resolve(__dirname, '..');
const scratch = mkdtempSync(join(tmpdir(), 'kongdaily-favorites-'));
const registryRelPath = '../assets/data/fehd-toilet-identity-registry.json';
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
const sqlFromSource = [...readFileSync(join(root, 'src/database.ts'), 'utf8')
  .matchAll(/transaction\.execAsync\(`([^\x60]+)`\)/g)].map((match) => match[1]);
const digest = (data) => createHash('sha256').update(data).digest('hex');
const encodeIndex = (index) => JSON.stringify({ ...index, recordsSha256: digest(JSON.stringify(index.records,
  (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]])) : value)) });

function loadApp(file, { failAfterV8 = false, changeCatalog, registry } = {}) {
  const loaded = new Map();
  let connection;
  function databaseAdapter(db, afterExec) {
    return {
      async execAsync(sql) {
        db.exec(sql);
        afterExec?.(sql);
      },
      async getAllAsync(sql, ...params) { return db.prepare(sql).all(...params); },
      async getFirstAsync(sql, ...params) { return db.prepare(sql).get(...params) ?? null; },
      async runAsync(sql, ...params) { return db.prepare(sql).run(...params); },
    };
  }
  async function openDatabaseAsync(name) {
    assert.equal(name, 'kongdaily.db');
    const db = connection = new DatabaseSync(file);
    return {
      ...databaseAdapter(db),
      async closeAsync() { db.close(); connection = undefined; },
      async withExclusiveTransactionAsync(callback) {
        db.exec('BEGIN IMMEDIATE');
        try {
          await callback(databaseAdapter(db, (sql) => {
            if (failAfterV8 && sql.includes('PRAGMA user_version = 8')) {
              failAfterV8 = false;
              throw new Error('Injected failure after v8 DDL');
            }
          }));
          db.exec('COMMIT');
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
      },
    };
  }
  function load(name) {
    if (loaded.has(name)) return loaded.get(name).exports;
    const filename = join(root, 'src', name + '.ts');
    const module = { exports: {} };
    loaded.set(name, module);
    const script = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText;
    new Function('module', 'exports', 'require', script)(module, module.exports, (id) => {
      if (id === 'expo-sqlite') return { openDatabaseAsync };
      if (id === registryRelPath && registry) return registry;
      if (id.startsWith('@/')) return load(id.slice(2));
      if (id.startsWith('.')) return json(resolve(dirname(filename), id));
      return require(id);
    });
    if (name === 'facilities' && changeCatalog) {
      module.exports.nearbyFacilities = changeCatalog(module.exports.nearbyFacilities);
    }
    return module.exports;
  }
  return { load, close() { connection?.close(); connection = undefined; } };
}

function version(db) {
  return db.prepare('PRAGMA user_version').get().user_version;
}

function seedV7(file) {
  const db = new DatabaseSync(file);
  db.exec(sqlFromSource.slice(0, 7).join('\n'));
  db.exec(`
    INSERT INTO user_settings VALUES (1, 'en');
    INSERT INTO bus_route_cache VALUES ('nlb', 1, '{}');
    INSERT INTO bus_search_history VALUES ('B2', 'B2', NULL, 1);
    INSERT INTO bus_route_stop_cache VALUES ('route-key', 1, '{}');
    INSERT INTO bus_stop_cache VALUES ('citybus', '000123', 1, '{}');
    INSERT INTO nearby_bus_sources VALUES ('citybus', 'fixture', 1);
    INSERT INTO nearby_bus_stops VALUES ('citybus', '000123', '測試站', 'Test stop', '', '', 22.3, 114.1);
    INSERT INTO weather_cache VALUES ('fnd', 'en', 1, 2, '{}');
  `);
  assert.equal(version(db), 7);
  db.close();
}

function inspectV7Data(file) {
  const db = new DatabaseSync(file);
  try {
    const tables = db.prepare(`SELECT name, sql FROM sqlite_schema
      WHERE type IN ('table', 'trigger', 'index') AND sql IS NOT NULL AND name <> 'facility_favorites' ORDER BY name`).all();
    return [tables, tables.filter(({ sql }) => sql.startsWith('CREATE TABLE')).map(({ name }) =>
      db.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all())];
  } finally {
    db.close();
  }
}

function toiletRegistryTests() {
  const registryPath = join(scratch, 'fehd-registry.json');
  const indexPath = join(scratch, 'fehd-index.json');
  const reviewPath = join(scratch, 'review.json');
  const initial = readFileSync(join(root, 'assets/data/fehd-toilet-identity-registry.json'), 'utf8');
  writeFileSync(registryPath, initial);
  const orig = JSON.parse(initial);
  const baseline = json(join(root, 'assets/data/fehd-toilets.json'));
  const old = baseline.records[0];
  const firstId = orig.records.find(({ officialRecordId }) => officialRecordId === old.officialId).stableFacilityId;
  const updatedOfficialId = '99000';
  const renamed = { ...old, officialId: updatedOfficialId, name: { 'zh-HK': '已核實新名稱', en: 'Reviewed name fixture' } };
  const reused = {
    ...old, name: { 'zh-HK': '測試新設施', en: 'New facility fixture' }, officialType: 'ap',
    coordinate: { ...old.coordinate, latitude: old.coordinate.latitude + 0.001 },
  };
  const stage = { ...baseline, snapshotDate: '2026-10-27', version: baseline.version + '-fixture',
    recordCount: baseline.recordCount + 1, records: [reused, renamed, ...baseline.records.slice(1)] };
  const cli = (...flags) => spawnSync('python3', [join(root, 'scripts/check-toilet-identities.py'), 'fehd',
    '--index', indexPath, '--registry', registryPath, '--apply', ...flags], { encoding: 'utf8' });
  function rejects(input, reason, ...flags) {
    writeFileSync(indexPath, input);
    const result = cli(...flags);
    assert.notEqual(result.status, 0, result.stdout);
    assert.match(result.stderr, reason);
    assert.equal(readFileSync(registryPath, 'utf8'), initial);
  }
  const candidate = encodeIndex(stage);
  const movedCodeOnly = encodeIndex({ ...stage, recordCount: stage.recordCount - 1, records: stage.records.slice(1) });
  rejects(movedCodeOnly, /"missing":[\s\S]+"unreviewed"/);
  rejects(candidate, /"fields":[\s\S]+"coordinate"/);
  rejects(JSON.stringify({ ...stage, records: [{ ...reused, coordinate: { longitude: 3, latitude: 100 } }, ...stage.records.slice(1)] }),
    /Invalid Hong Kong WGS84/);
  rejects(JSON.stringify({ ...stage, records: [reused, { ...old }, ...stage.records.slice(2)] }), /Invalid or duplicate mapID/);
  rejects(JSON.stringify({ ...stage, records: stage.records.slice(1) }), /truncated/);
  rejects(JSON.stringify(stage), /records SHA-256 does not match/);

  const proof = { reason: 'Test fixture for an official renumber and repeat use of an old code.',
    evidenceUrl: 'https://www.fehd.gov.hk/english/map/fehd_map_e.xml' };
  const decisions = [{ ...proof, action: 'continue', stableFacilityId: firstId, officialRecordId: updatedOfficialId },
    { ...proof, action: 'add', officialRecordId: old.officialId }];
  writeFileSync(reviewPath, JSON.stringify({ indexSha256: digest(candidate + ' '), decisions }));
  rejects(candidate, /different candidate index/, '--review', reviewPath);
  const claimConflict = [...decisions, { ...proof, action: 'add', officialRecordId: updatedOfficialId }];
  writeFileSync(reviewPath, JSON.stringify({ indexSha256: digest(candidate), decisions: claimConflict }));
  rejects(candidate, /duplicateClaims/, '--review', reviewPath);
  writeFileSync(reviewPath, JSON.stringify({ indexSha256: digest(candidate), decisions }));
  const accepted = cli('--review', reviewPath);
  assert.equal(accepted.status, 0, accepted.stderr);
  const registry = json(registryPath);
  const continued = registry.records.find((r) => r.stableFacilityId === firstId);
  assert.equal(continued.officialRecordId, updatedOfficialId);
  assert.equal(continued.upstreamRecords[0].officialRecordId, old.officialId);
  assert.notEqual(registry.records.find((r) => r.officialRecordId === old.officialId).stableFacilityId, firstId);
  return { old, reused, renamed, registry };
}

async function test() {
  const { old, reused, renamed, registry } = toiletRegistryTests();
  for (const source of ['fehd', 'afcd']) execFileSync('python3', [join(root, 'scripts/check-toilet-identities.py'), source]);

  const fresh = join(scratch, 'fresh.db');
  const freshApp = loadApp(fresh);
  const freshDb = await freshApp.load('database').getDatabase();
  assert.equal((await freshDb.getFirstAsync('PRAGMA user_version')).user_version, 8);
  assert.equal(await freshApp.load('database').readLanguage(), 'system');
  freshApp.close();

  const file = join(scratch, 'upgrade.db');
  seedV7(file);
  const seedDb = new DatabaseSync(file);
  const busStopId = (number) => String(number).padStart(6, '0');
  const visit = (number) => ({
    station: { zh: '測試站', en: 'Test stop' }, destination: { zh: '總站', en: 'Terminus' },
    target: { source: 'citybus', number: String(number), direction: 'outbound', stopId: busStopId(number), stopSeq: 1 },
  });
  for (const number of [1, 2, 3]) {
    const id = JSON.stringify([JSON.stringify(['citybus', String(number), 'outbound', null]), 1, busStopId(number)]);
    seedDb.prepare(`INSERT INTO bus_favorites (id, source, route_number, direction, stop_id, stop_seq, repeated_stop,
      station_zh, station_en, destination_zh, destination_en, created_at, updated_at, pin_order)
      VALUES (?, 'citybus', ?, 'outbound', ?, 1, 0, '測試站', 'Test stop', '總站', 'Terminus', ?, ?, ?)`)
      .run(id, String(number), busStopId(number), number, number, number);
  }
  seedDb.close();
  const before = inspectV7Data(file);

  const app = loadApp(file, { failAfterV8: true });
  const db = app.load('database');
  await assert.rejects(db.getDatabase(), /Injected failure/);
  const rolledBack = new DatabaseSync(file);
  assert.equal(version(rolledBack), 7);
  assert.equal(rolledBack.prepare("SELECT 1 FROM sqlite_schema WHERE name='facility_favorites'").get(), undefined);
  rolledBack.close();
  assert.deepEqual(inspectV7Data(file), before);
  assert.equal((await (await db.getDatabase()).getFirstAsync('PRAGMA user_version')).user_version, 8);
  assert.equal(await db.readLanguage(), 'en');
  assert.deepEqual(inspectV7Data(file), before);

  const { nearbyFacilities, facilityId } = app.load('facilities');
  const identities = app.load('facility-identity');
  const favorites = app.load('facility-favorites');
  const counts = new Map();
  const stableKeys = new Set();
  for (const facility of nearbyFacilities) {
    const resolved = identities.resolveFacilityIdentity(facility);
    assert.equal(resolved.status, 'available', facilityId(facility));
    assert.equal(resolved.facility, facility);
    assert.equal(identities.resolveStableFacilityIdentity(resolved.identity).facility, facility);
    const { source, stableFacilityId } = resolved.identity;
    assert.equal(stableKeys.has(JSON.stringify([source, stableFacilityId])), false);
    stableKeys.add(JSON.stringify([source, stableFacilityId]));
    counts.set(source, (counts.get(source) ?? 0) + 1);
    if (source.startsWith('lcsd-')) assert.equal(stableFacilityId, facility.officialId);
  }
  assert.equal(stableKeys.size, 1256);
  assert.deepEqual(Object.fromEntries(counts), {
    fehd: 960, afcd: 167, 'lcsd-parks': 48, 'lcsd-pet-gardens': 36, 'lcsd-inclusive-pet-parks': 45,
  });

  const catalogEntry = nearbyFacilities.find((f) => f.source === 'fehd' && f.officialId === old.officialId);
  const { identity } = await favorites.addFacilityFavorite(catalogEntry);
  const [first] = await favorites.listFacilityFavorites();
  const calls = Array.from({ length: 8 }, () => favorites.addFacilityFavorite(catalogEntry));
  await Promise.all(calls);
  assert.deepEqual(await favorites.listFacilityFavorites(), [first]);
  assert.deepEqual(first.nameSnapshot, catalogEntry.name);
  assert.equal(await favorites.isFacilityFavorite(identity), true);
  const englishOnly = nearbyFacilities.find((f) => f.source === 'fehd' && !f.name['zh-HK']);
  const { identity: englishOnlyIdentity } = await favorites.addFacilityFavorite(englishOnly);
  assert.deepEqual((await favorites.listFacilityFavorites()).find((f) => f.stableFacilityId === englishOnlyIdentity.stableFacilityId).nameSnapshot,
    { en: englishOnly.name.en });

  const park = { source: 'lcsd-parks', officialId: 'park-035' };
  const garden = { source: 'lcsd-pet-gardens', officialId: 'pet-garden-028' };
  const afcd = { source: 'afcd', officialId: 'ABD/TF/001' };
  const [{ identity: parkIdentity, facility: parkFacility }, { identity: gardenIdentity, facility: gardenFacility }] =
    await Promise.all([favorites.addFacilityFavorite(park), favorites.addFacilityFavorite(garden), favorites.addFacilityFavorite(afcd)]);
  assert.equal(parkFacility.name['zh-HK'], gardenFacility.name['zh-HK']);
  await favorites.removeFacilityFavorite(parkIdentity);
  assert.equal(await favorites.isFacilityFavorite(parkIdentity), false);
  assert.equal(await favorites.isFacilityFavorite(gardenIdentity), true);

  const afcdIdentity = identities.resolveFacilityIdentity(afcd).identity;
  await Promise.all([favorites.addFacilityFavorite(afcd), favorites.removeFacilityFavorite(afcdIdentity),
    favorites.addFacilityFavorite(afcd), favorites.removeFacilityFavorite(afcdIdentity)]);
  assert.equal(await favorites.isFacilityFavorite(afcdIdentity), false);
  const sql = new DatabaseSync(file);
  sql.exec(`CREATE TRIGGER test_reject_favorite BEFORE INSERT ON facility_favorites BEGIN SELECT RAISE(ABORT,'simulated write failure'); END;`);
  await assert.rejects(favorites.addFacilityFavorite(afcd), /simulated write failure/);
  assert.equal(await favorites.isFacilityFavorite(afcdIdentity), false);
  sql.exec('DROP TRIGGER test_reject_favorite');
  const afcdSaved = await favorites.addFacilityFavorite(afcd);
  assert.equal(afcdSaved.status, 'available');
  sql.close();
  assert.deepEqual(inspectV7Data(file), before);

  const buses = app.load('bus-favorites');
  assert.deepEqual(buses.pinnedBuses(await buses.readBusFavorites()).map((bus) => bus.target.number), ['1', '2', '3']);
  await buses.writeBusFavorites({ type: 'save', visit: visit(4) });
  await buses.writeBusFavorites({ type: 'remove', id: buses.busFavoriteId(visit(2).target) });
  await buses.writeBusFavorites({ type: 'pin', id: buses.busFavoriteId(visit(4).target) });
  assert.deepEqual(buses.pinnedBuses(await buses.readBusFavorites()).map((bus) => bus.target.number), ['1', '3', '4']);
  const savedBeforeClose = await favorites.listFacilityFavorites();
  app.close();

  const removeOld = (f) => f.source !== 'fehd' || f.officialId !== old.officialId;
  const variants = [
    ['unavailable', (items) => items.filter(removeOld)],
    ['needs_review', (items) => items.map((f) => removeOld(f) ? f : { ...f, ...reused })],
    ['needs_review', (items) => items.map((f) => removeOld(f) ? f : { ...f, coordinate: { latitude: 0, longitude: 0 } })],
    ['needs_review', (items) => [...items, items.find((f) => !removeOld(f))]],
    ['available', (items) => items],
    ['available', (items) => items.flatMap((f) => removeOld(f) ? [f] : [
      { ...f, ...reused }, { ...f, ...renamed },
    ]), registry],
  ];
  for (const [status, changeCatalog, updateRegistry] of variants) {
    const reopened = loadApp(file, { changeCatalog, registry: updateRegistry });
    const repo = reopened.load('facility-favorites');
    assert.deepEqual(await repo.listFacilityFavorites(), savedBeforeClose);
    const resolved = repo.resolveFacilityFavorite(first);
    assert.equal(resolved.status, status);
    assert.deepEqual(resolved.favorite.nameSnapshot, first.nameSnapshot);
    if (status !== 'available') {
      assert.equal('facility' in resolved, false);
      assert.equal((await repo.addFacilityFavorite(catalogEntry)).status, status);
    } else {
      assert.equal(resolved.facility.officialId, updateRegistry ? renamed.officialId : old.officialId);
      assert.deepEqual(resolved.facility.name, updateRegistry ? renamed.name : first.nameSnapshot);
    }
    reopened.close();
  }
  const sample = { ...catalogEntry, source: 'test' };
  const entry = { source: 'test', stableFacilityId: 'fixed', displayId: sample.officialId, category: sample.category, anchor: sample };
  const duplicateClaim = identities.createFacilityIdentityResolver([sample], [entry, { ...entry, stableFacilityId: 'different' }]);
  assert.equal(duplicateClaim.resolveCurrent(sample).status, 'needs_review');
  assert.equal(duplicateClaim.resolveStable(entry).status, 'needs_review');
  const conflictingStable = identities.createFacilityIdentityResolver([sample], [entry, { ...entry, displayId: 'other' }]);
  assert.equal(conflictingStable.resolveStable(entry).status, 'needs_review');
  const retired = identities.createFacilityIdentityResolver([sample], [{ ...entry, retired: true }]);
  assert.equal(retired.resolveStable(entry).status, 'unavailable');
}

test().then(() => console.log('PASS: registry review, identities, SQLite v8 rollback, migration, favorites and bus regression'))
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => rmSync(scratch, { recursive: true, force: true }));
