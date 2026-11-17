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

function loadApp(file, { failAfterV8 = false, changeCatalog, registry, beforeQuery, stubs = {} } = {}) {
  const loaded = new Map();
  let connection;
  function databaseAdapter(db, afterExec) {
    return {
      async execAsync(sql) {
        db.exec(sql);
        afterExec?.(sql);
      },
      async getAllAsync(sql, ...params) {
        await beforeQuery?.(sql);
        return db.prepare(sql).all(...params);
      },
      async getFirstAsync(sql, ...params) {
        await beforeQuery?.(sql);
        return db.prepare(sql).get(...params) ?? null;
      },
      async runAsync(sql, ...params) {
        await beforeQuery?.(sql);
        return db.prepare(sql).run(...params);
      },
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
    const isNearby = name === 'app/(tabs)/nearby';
    const filename = join(root, 'src', name + (isNearby ? '.tsx' : '.ts'));
    const module = { exports: {} };
    loaded.set(name, module);
    const source = readFileSync(filename, 'utf8') + (isNearby ? '\nexport { FacilitySummary, FacilityListRow };' : '');
    const script = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    new Function('module', 'exports', 'require', script)(module, module.exports, (id) => {
      if (id === 'expo-sqlite') return { openDatabaseAsync };
      if (id === registryRelPath && registry) return registry;
      if (Object.hasOwn(stubs, id)) return stubs[id];
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

// Render the affected card components as element trees while exercising the real Repository.
async function testNearbyFavoriteButtons() {
  const file = join(scratch, 'nearby-controls.db');
  let locale = 'zh-HK';
  let fontScale = 1;
  let notifications = 0;
  let unsubscribe;
  let listReads = 0;
  let failReadback = false;
  let releaseInitialRead;
  let releaseFirstWrite;
  let insertAttempts = 0;
  let chooseDirection;
  const openedUrls = [];
  const initialRead = new Promise((resolve) => { releaseInitialRead = resolve; });
  const firstWrite = new Promise((resolve) => { releaseFirstWrite = resolve; });
  const react = require('react');
  const stubs = {
    react: {
      ...react,
      useSyncExternalStore(subscribe, getSnapshot) {
        unsubscribe ??= subscribe(() => { notifications += 1; });
        return getSnapshot();
      },
    },
    'react-native': {
      View: 'View', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator',
      StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
      useWindowDimensions: () => ({ width: 320, height: 710, fontScale }),
      ActionSheetIOS: { showActionSheetWithOptions: (options, choose) => { chooseDirection = { options, choose }; } },
      Alert: { alert: () => { assert.fail('Unexpected alert'); } },
      Linking: { openURL: async (url) => { openedUrls.push(url); } },
    },
    'expo-router': {},
    'react-native-safe-area-context': {},
    '@/components/ui': { AppText: 'AppText', Icon: 'Icon' },
    '@/components/nearby-facilities-map': { facilityVisuals: {
      toilets: { icon: 'figure', color: '#246F69', surface: '#E6F3F1' },
      parks: { icon: 'tree', color: '#246F69', surface: '#E6F3F1' },
      pets: { icon: 'pawprint', color: '#246F69', surface: '#E6F3F1' },
    } },
    '@/components/nearby-search-sheet': {},
    '@/nearby-bus-location': {},
    '@/language': { useLanguage: () => ({ locale, copy: app.load('i18n').messages[locale] }) },
  };
  const app = loadApp(file, { stubs, beforeQuery: async (sql) => {
    if (sql.includes('FROM facility_favorites ORDER BY') && ++listReads === 1) {
      await initialRead;
      throw new Error('Initial read interrupted');
    }
    if (sql.includes('INSERT INTO facility_favorites') && ++insertAttempts === 1) await firstWrite;
    if (failReadback && sql.startsWith('SELECT 1 AS found FROM facility_favorites')) throw new Error('Readback unavailable');
  } });

  const sources = ['fehd', 'afcd', 'lcsd-parks', 'lcsd-pet-gardens', 'lcsd-inclusive-pet-parks'];
  const sampleFacilities = sources.map((source) => app.load('facilities').nearbyFacilities.find((f) => f.source === source));
  const [fehd, afcd] = sampleFacilities;
  const { FacilitySummary, FacilityListRow } = app.load('app/(tabs)/nearby');
  const { loadFacilityFavorites } = app.load('facility-favorite-hooks');
  const { isFacilityFavorite } = app.load('facility-favorites');
  const { resolveFacilityIdentity } = app.load('facility-identity');
  const messages = () => app.load('i18n').messages[locale].nearby;
  let cardChanges = 0;
  const closeOrExpand = () => { cardChanges += 1; };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Network disabled during favorite tests'); };

  function elements(node) {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(elements);
    return [node, ...elements(node.props?.children)];
  }
  function row(facility, expanded) {
    return FacilityListRow({ item: { facility, distance: 10 }, expanded, onPress: closeOrExpand });
  }
  function details(facility, mode = 'map') {
    const card = mode === 'map' ? FacilitySummary({ facility, distance: 10, onClose: closeOrExpand }) : row(facility, true);
    const component = elements(card).find((node) => node.type.name === 'FacilityDetails');
    return component.type(component.props);
  }
  function bookmark(tree) {
    return elements(tree).find((node) => node.type === 'Pressable' && node.props.accessibilityLabel);
  }
  function hasNotice(tree, text) {
    return elements(tree).some((node) => node.type === 'AppText' && node.props.children === text);
  }
  function direction(tree) {
    const component = elements(tree).find((node) => node.type.name === 'FacilityDirections');
    return component?.type(component.props);
  }

  try {
    assert.equal(elements(row(fehd, false)).some((node) => node.type.name === 'FacilityDetails'), false);
    const initial = loadFacilityFavorites();
    assert.equal(loadFacilityFavorites(), initial);
    assert.equal(bookmark(details(fehd)).props.accessibilityLabel, messages().facilityFavorites.loading);
    assert.equal(bookmark(details(fehd)).props.accessibilityState.selected, undefined);
    assert.equal(bookmark(details(fehd)).props.disabled, true);
    releaseInitialRead();
    await initial;
    const failedLoad = details(fehd);
    assert.equal(bookmark(failedLoad).props.accessibilityLabel, messages().facilityFavorites.retry);
    assert.ok(hasNotice(failedLoad, messages().facilityFavorites.read));
    await bookmark(failedLoad).props.onPress();
    assert.equal(listReads, 2);

    const unselected = bookmark(details(fehd));
    assert.equal(unselected.props.children.props.name, 'bookmark');
    assert.equal(unselected.props.accessibilityLabel, '收藏設施');
    assert.equal(unselected.props.style({ pressed: false })[0].width, 44);
    assert.equal(unselected.props.style({ pressed: false })[0].height, 44);
    const changesBeforeWrite = notifications;
    const pending = unselected.props.onPress();
    await unselected.props.onPress();
    assert.equal(bookmark(details(fehd, 'list')).props.accessibilityState.busy, true);
    assert.equal(bookmark(details(afcd)).props.accessibilityState.selected, false);
    const second = bookmark(details(afcd)).props.onPress();
    await loadFacilityFavorites(); // Same load function is reused when the App becomes active.
    releaseFirstWrite();
    await Promise.all([pending, second]);
    assert.equal(insertAttempts, 2);
    assert.equal(listReads, 2);
    assert.ok(notifications > changesBeforeWrite);
    assert.equal(bookmark(details(fehd, 'list')).props.children.props.name, 'bookmark.fill');
    assert.equal(bookmark(details(fehd, 'list')).props.accessibilityLabel, '取消收藏');
    await bookmark(details(fehd, 'list')).props.onPress();
    assert.equal(bookmark(details(fehd)).props.accessibilityState.selected, false);
    assert.equal(await isFacilityFavorite(resolveFacilityIdentity(fehd).identity), false);

    for (const facility of sampleFacilities) {
      const button = bookmark(details(facility));
      if (!button.props.accessibilityState.selected) await button.props.onPress();
      const { identity } = resolveFacilityIdentity(facility);
      assert.equal(await isFacilityFavorite(identity), true);
      assert.equal(bookmark(details(facility, 'list')).props.accessibilityState.selected, true);
      if (['fehd', 'afcd'].includes(facility.source)) assert.notEqual(identity.stableFacilityId, facility.officialId);
    }

    const db = new DatabaseSync(file);
    db.exec(`CREATE TRIGGER reject_nearby_remove BEFORE DELETE ON facility_favorites
      BEGIN SELECT RAISE(ABORT,'simulated write failure'); END;`);
    await bookmark(details(fehd)).props.onPress();
    const failedWrite = details(fehd);
    assert.equal(bookmark(failedWrite).props.accessibilityState.selected, true);
    assert.ok(hasNotice(failedWrite, messages().facilityFavorites.write));
    assert.equal(await isFacilityFavorite(resolveFacilityIdentity(fehd).identity), true);
    failReadback = true;
    await bookmark(failedWrite).props.onPress();
    const failedReadback = details(fehd);
    assert.equal(bookmark(failedReadback).props.accessibilityState.selected, undefined);
    assert.equal(bookmark(failedReadback).props.children.props.name, 'arrow.clockwise');
    failReadback = false;
    db.exec('DROP TRIGGER reject_nearby_remove');
    db.close();
    await bookmark(failedReadback).props.onPress();
    assert.equal(bookmark(details(fehd)).props.accessibilityState.selected, true);

    locale = 'en';
    fontScale = 2;
    const largeText = details(fehd, 'list');
    assert.equal(bookmark(largeText).props.accessibilityLabel, 'Remove from favorites');
    assert.ok(elements(largeText).some((node) => node.props?.style?.flexWrap === 'wrap'));
    assert.equal(cardChanges, 0);
    assert.equal(chooseDirection, undefined);
    const close = elements(FacilitySummary({ facility: fehd, distance: 10, onClose: closeOrExpand }))
      .find((node) => node.type === 'Pressable' && node.props.accessibilityLabel === messages().closeFacility);
    assert.equal(close.props.onPress, closeOrExpand);
    for (const [i, host] of ['maps.apple.com', 'www.google.com'].entries()) {
      direction(largeText).props.onPress();
      assert.deepEqual(chooseDirection.options.options, ['Apple Maps', 'Google Maps', 'Cancel']);
      chooseDirection.choose(i);
      await new Promise(setImmediate);
      const url = new URL(openedUrls.at(-1));
      assert.equal(url.host, host);
      assert.equal(url.searchParams.get(i === 0 ? 'daddr' : 'destination'),
        `${fehd.coordinate.latitude},${fehd.coordinate.longitude}`);
    }
    await bookmark(details(fehd, 'list')).props.onPress();
    assert.equal(bookmark(details(fehd)).props.accessibilityLabel, 'Add to favorites');
    assert.equal(cardChanges, 0);
    app.close();
    unsubscribe?.();
    unsubscribe = undefined;

    const reopened = loadApp(file, { stubs });
    await reopened.load('facility-favorite-hooks').loadFacilityFavorites();
    const readBookmark = reopened.load('facility-favorite-hooks').useFacilityFavorite;
    assert.equal(readBookmark(fehd).saved, false);
    assert.ok(sampleFacilities.slice(1).every((facility) => readBookmark(facility).saved));
    reopened.close();
    unsubscribe?.();
    unsubscribe = undefined;

    const conflict = loadApp(file, { stubs, changeCatalog: (facilities) => facilities.map((facility) =>
      facility.source === afcd.source && facility.officialId === afcd.officialId
        ? { ...facility, coordinate: { latitude: 0, longitude: 0 } } : facility) });
    await conflict.load('facility-favorite-hooks').loadFacilityFavorites();
    const summary = conflict.load('app/(tabs)/nearby').FacilitySummary({ facility: afcd, distance: 0, onClose: closeOrExpand });
    const component = elements(summary).find((node) => node.type.name === 'FacilityDetails');
    const invalid = component.type(component.props);
    assert.equal(bookmark(invalid).props.disabled, true);
    assert.equal(bookmark(invalid).props.onPress, undefined);
    assert.equal(direction(invalid), undefined);
    assert.ok(hasNotice(invalid, messages().facilityFavorites.unavailable));
    assert.equal(await conflict.load('facility-favorites').isFacilityFavorite(resolveFacilityIdentity(afcd).identity), true);
    conflict.close();
  } finally {
    globalThis.fetch = originalFetch;
    unsubscribe?.();
    app.close();
  }
}

test().then(testNearbyFavoriteButtons).then(() => console.log('PASS: registry, SQLite v8, bus regression and nearby favorite controls'))
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => rmSync(scratch, { recursive: true, force: true }));
