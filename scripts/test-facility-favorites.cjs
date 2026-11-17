// Exercise the actual App repository and migration SQL against temporary SQLite files.
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { createRequire } = require('node:module');
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
    const testExports = {
      'app/(tabs)/nearby': 'FacilitySummary, FacilityListRow',
      'app/(tabs)/saved': 'SavedBuses, SavedFacilities',
      'app/bus/route': 'SelectedStopCard',
      'app/bus/eta': 'EtaDetails',
    }[name];
    const filename = join(root, 'src', name + (testExports ? '.tsx' : '.ts'));
    const module = { exports: {} };
    loaded.set(name, module);
    const source = readFileSync(filename, 'utf8') + (testExports ? `\nexport { ${testExports} };` : '');
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

function elements(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(elements);
  return [node, ...elements(node.props?.children)];
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
    if (failReadback && /FROM facility_favorites WHERE source =/.test(sql) && !sql.startsWith('SELECT 1')) {
      throw new Error('Readback unavailable');
    }
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

async function testSavedFacilityIntegration() {
  const { TabRouter } = require('expo-router/build/react-navigation/routers/TabRouter');
  const parsePathFile = require.resolve('expo-router/build/fork/getStateFromPath');
  const requireFromRouter = createRequire(parsePathFile);
  const pathParser = {};
  // Load Expo Router's actual parser without importing the native rendering entry point in Node.
  new Function('exports', 'require', readFileSync(parsePathFile, 'utf8'))(pathParser, (id) =>
    id === '../react-navigation/native' ? { validatePathConfig: requireFromRouter('./validatePathConfig').default } : requireFromRouter(id));
  const { resolveHref } = require('expo-router/build/link/href');
  const file = join(scratch, 'saved-facilities.db');
  const router = TabRouter({});
  const routeConfig = { routeNames: ['index', 'nearby', 'explore', 'saved'], routeParamList: {}, routeGetIdList: {} };
  let navigationState = router.getInitialState(routeConfig);
  const nearbyKey = navigationState.routes.find(({ name }) => name === 'nearby').key;
  const nearbyRoute = () => navigationState.routes.find(({ key }) => key === nearbyKey);
  const actions = [];
  let focusEffect;
  let effects;
  let hookSlots;
  let cursor;
  let locale = 'zh-HK';
  let completeLocation;
  let locationSignal;
  let locationCalls = 0;
  const slots = { nearby: [], saved: [] };
  const navigation = {
    isFocused: () => navigationState.routes[navigationState.index].key === nearbyKey,
    getState: () => navigationState,
    dispatch(action) { navigationState = router.getStateForAction(navigationState, action, routeConfig); },
  };
  const navigate = (href) => {
    const parsed = pathParser.getStateFromPath(resolveHref(href), {
      screens: { '(tabs)': { path: '(tabs)', screens: { nearby: 'nearby' } } },
    });
    const { name, params } = parsed.routes[0].state.routes[0];
    actions.push({ name, params });
    navigation.dispatch({ type: 'NAVIGATE', payload: { name, params } });
  };
  const stubs = {
    react: {
      useCallback: (fn) => fn,
      useMemo: (fn) => fn(),
      useEffect: (fn) => effects.push(fn),
      useRef(initial) { const index = cursor++; return hookSlots[index] ??= { current: initial }; },
      useState(initial) {
        const index = cursor++;
        if (!(index in hookSlots)) hookSlots[index] = typeof initial === 'function' ? initial() : initial;
        const state = hookSlots;
        return [state[index], (next) => { state[index] = typeof next === 'function' ? next(state[index]) : next; }];
      },
      useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
    },
    'expo-router': {
      Link: 'Link',
      useRouter: () => ({ navigate }),
      useLocalSearchParams: () => navigationState.routes[navigationState.index].params ?? {},
      useRoute: nearbyRoute,
      useNavigation: () => navigation,
      useFocusEffect: (fn) => { focusEffect = fn; },
    },
    'react-native': {
      View: 'View', ScrollView: 'ScrollView', Pressable: 'Pressable', ActivityIndicator: 'ActivityIndicator',
      StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
      AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
      useWindowDimensions: () => ({ width: 320, height: 710, fontScale: 2 }),
    },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ bottom: 34 }) },
    '@/components/ui': {
      AppText: 'AppText', Icon: 'Icon', EmptyState: 'EmptyState', Filters: 'Filters', PageHeading: 'PageHeading', Screen: 'Screen',
    },
    '@/components/bus-ui': { BusAction: 'BusAction' },
    '@/components/saved-bus-ui': { FavoriteAction: 'FavoriteAction', FavoriteBusRow: 'FavoriteBusRow', savedBusStyles: { card: {} } },
    '@/components/nearby-facilities-map': {
      NearbyFacilitiesMap: 'NearbyFacilitiesMap',
      facilityVisuals: { toilets: { icon: 'toilet' }, pets: { icon: 'pawprint' }, parks: { icon: 'tree' } },
    },
    '@/components/nearby-search-sheet': {},
    '@/nearby-bus-location': {
      locateNearbyBusStops(signal) {
        locationCalls += 1;
        locationSignal = signal;
        return new Promise((resolve) => { completeLocation = resolve; });
      },
    },
    '@/facility-navigation': {},
    '@/bus-favorite-hooks': {
      useBusFavorites: () => ({ status: 'ready', items: [{
        id: 'bus', pinOrder: 1, target: { source: 'nlb', number: 'B2' },
      }] }),
      useUnavailableFavorites: () => new Set(),
    },
    '@/language': { useLanguage: () => ({ locale, copy: app.load('i18n').messages[locale] }) },
  };
  const app = loadApp(file, { stubs });
  const { nearbyFacilities, facilityId, facilityText, visibleFacilityMarkers } = app.load('facilities');
  const { resolveFacilityIdentity } = app.load('facility-identity');
  const { loadFacilityFavorites, useFacilityFavorite } = app.load('facility-favorite-hooks');
  const { SavedBuses, SavedFacilities, default: SavedScreen } = app.load('app/(tabs)/saved');
  const NearbyScreen = app.load('app/(tabs)/nearby').default;
  const facilities = [
    nearbyFacilities.find((facility) => facility.source === 'fehd' && facility.name['zh-HK'] && facility.name.en),
    ...[['afcd', 'ABD/TF/001'], ['lcsd-parks', 'park-035'], ['lcsd-pet-gardens', 'pet-garden-028'],
      ['lcsd-inclusive-pet-parks', 'inclusive-pet-001']].map(([source, id]) =>
      nearbyFacilities.find((facility) => facility.source === source && facility.officialId === id)),
  ];
  const [toilet, afcd, park, garden, shared] = facilities;
  const copy = () => app.load('i18n').messages[locale];
  const effectsOf = (screen, component, runEffects = false) => {
    hookSlots = slots[screen];
    cursor = 0;
    effects = [];
    const tree = elements(component());
    if (runEffects) for (const effect of effects) effect();
    return tree;
  };
  const saved = (screen = SavedFacilities) => effectsOf('saved', screen);
  const nearby = () => effectsOf('nearby', NearbyScreen, true);
  const map = (tree) => tree.find(({ type }) => type === 'NearbyFacilitiesMap')?.props;
  const entries = (tree) => tree.filter(({ props }) => props?.accessibilityHint === copy().saved.facilities.locateHint);
  const name = (facility) => facilityText(facility.name, locale);
  const entry = (facility) => entries(saved()).find((row) =>
    elements(row).some(({ type, props }) => type === 'AppText' && props.children === name(facility))
    && elements(row).some(({ type, props }) => type === 'Icon' && props.name === stubs['@/components/nearby-facilities-map'].facilityVisuals[facility.category].icon));
  const remove = (tree, displayName) => tree.find(({ props }) => props?.accessibilityLabel === copy().saved.facilities.remove(displayName));
  const selectTab = (tab, params) => navigation.dispatch({ type: 'NAVIGATE', payload: { name: tab, params } });
  const tick = () => new Promise(setImmediate);

  try {
    selectTab('saved');
    assert.ok(saved().some(({ type, props }) => type === 'EmptyState' && props.title === copy().nearby.facilityFavorites.loading));
    await loadFacilityFavorites();
    assert.ok(saved().some(({ type, props }) => type === 'EmptyState' && props.title === copy().saved.facilities.emptyTitle));
    const all = saved(SavedScreen);
    assert.ok(all.findIndex(({ type }) => type === SavedBuses) < all.findIndex(({ type }) => type === SavedFacilities));
    assert.ok(saved(() => SavedBuses({ emptyTitle: '' })).some(({ type, props }) => type === 'FavoriteBusRow' && props.favorite.pinOrder === 1));
    selectTab('saved', { category: 'buses' });
    assert.equal(saved(SavedScreen).some(({ type }) => type === SavedFacilities), false);
    selectTab('saved', { category: 'places' });
    assert.equal(saved(SavedScreen).some(({ type }) => type === SavedBuses), false);

    const clock = Date.now;
    let time = clock();
    try {
      Date.now = () => ++time;
      for (const facility of facilities) await useFacilityFavorite(facility).onPress();
    } finally { Date.now = clock; }
    assert.equal(entries(saved()).length, 5);
    assert.deepEqual(saved().filter(({ type, props }) => type === 'AppText' && props.variant === 'homeCardTitle')
      .map(({ props }) => props.children), [...facilities].reverse().map(name));
    locale = 'en';
    assert.ok(entry(park) && entry(garden) && entry(shared));
    assert.equal(entry(afcd).props.accessibilityHint, 'Show this facility on the Nearby map');
    assert.ok(saved().some(({ type, props }) => type === 'AppText' && props.children === name(toilet)));

    selectTab('nearby', { category: 'all', view: 'map' });
    nearby();
    const cleanup = focusEffect();
    const devicePoint = { latitude: 22.32, longitude: 114.16 };
    completeLocation({ kind: 'position', point: devicePoint });
    await tick();
    const original = map(nearby());
    assert.deepEqual(original.devicePoint, devicePoint);
    original.onAreaBrowsed();
    void original.onLocate();
    const oldSignal = locationSignal;

    // Switch from a different category and list mode before the map imperative handle exists.
    selectTab('nearby', { category: 'pets', view: 'list' });
    nearby();
    selectTab('saved');
    entry(afcd).props.onPress();
    assert.equal(actions.at(-1).params.savedFacilityId, resolveFacilityIdentity(afcd).identity.stableFacilityId);
    assert.equal(nearbyRoute().key, nearbyKey);
    nearby();
    const focused = map(nearby());
    assert.equal(focused.selectedId, facilityId(afcd));
    assert.equal(focused.initialRegion.latitude, afcd.coordinate.latitude);
    assert.equal(focused.initialRegion.longitude, afcd.coordinate.longitude);
    assert.equal(nearbyRoute().params.category, 'toilets');
    assert.equal(nearbyRoute().params.savedFacilityRequest, undefined);
    assert.equal(focused.areaPending, false);
    assert.deepEqual(focused.devicePoint, devicePoint);
    assert.equal(oldSignal.aborted, true);
    completeLocation({ kind: 'position', point: { latitude: 22.27, longitude: 114.2 } });
    await tick();
    assert.equal(map(nearby()).selectedId, facilityId(afcd));
    assert.deepEqual(map(nearby()).devicePoint, devicePoint);
    assert.equal(map(nearby()).items.find(({ id }) => id === facilityId(afcd)).distance,
      original.items.find(({ id }) => id === facilityId(afcd)).distance);
    assert.equal(visibleFacilityMarkers(focused.items, focused.initialRegion, { width: 320, height: 340 }, focused.selectedId)
      .some((marker) => marker.kind === 'facility' && marker.item.id === focused.selectedId), true);
    assert.equal(useFacilityFavorite(afcd).saved, true);
    assert.equal(locationCalls, 2);

    // Two official facilities share a Chinese name but remain different categories and identities.
    assert.equal(park.name['zh-HK'], garden.name['zh-HK']);
    selectTab('saved');
    const choosePark = entry(park).props.onPress;
    const chooseGarden = entry(garden).props.onPress;
    choosePark();
    chooseGarden();
    nearby();
    assert.equal(map(nearby()).selectedId, facilityId(garden));
    const token = actions.at(-1).params.savedFacilityRequest;
    map(nearby()).onDismiss();
    nearby();
    focusEffect()();
    assert.equal(map(nearby()).selectedId, undefined);
    chooseGarden();
    assert.notEqual(actions.at(-1).params.savedFacilityRequest, token);
    nearby();
    assert.equal(map(nearby()).selectedId, facilityId(garden));

    // A saved request may arrive while another tab is taking focus. Ignore it offscreen
    // and handle the newest request on return, even before local params re-render.
    choosePark();
    selectTab('explore');
    nearby();
    assert.equal(nearbyRoute().params.savedFacilityRequest, actions.at(-1).params.savedFacilityRequest);
    chooseGarden();
    focusEffect()();
    assert.equal(map(nearby()).selectedId, facilityId(garden));
    navigate({ pathname: '/(tabs)/nearby', params: {
      view: 'map', category: 'pets', savedFacilitySource: afcd.source, savedFacilityId: afcd.officialId, savedFacilityRequest: 'bad-id',
    } });
    assert.equal(actions.at(-1).params.savedFacilityId, 'ABD/TF/001');
    nearby();
    assert.equal(map(nearby()).selectedId, facilityId(garden));
    assert.equal(nearbyRoute().params.savedFacilityRequest, undefined);
    cleanup();

    selectTab('saved');
    const db = new DatabaseSync(file);
    const routeChanges = actions.length;
    const pause = db.prepare(`CREATE TRIGGER reject_saved_remove BEFORE DELETE ON facility_favorites
      BEGIN SELECT RAISE(ABORT,'simulated deletion failure'); END`);
    pause.run();
    remove(saved(), name(toilet)).props.onPress();
    await tick();
    assert.ok(saved().some(({ props }) => props?.accessibilityRole === 'alert'));
    assert.ok(entry(toilet));
    assert.equal(useFacilityFavorite(toilet).saved, true);
    db.exec('DROP TRIGGER reject_saved_remove');
    db.close();
    const removeToilet = remove(saved(), name(toilet)).props.onPress;
    removeToilet();
    removeToilet();
    await tick();
    assert.equal(entry(toilet), undefined);
    assert.equal(useFacilityFavorite(toilet).saved, false);
    assert.equal(actions.length, routeChanges);
    app.close();

    const reopenForMissing = loadApp(file, { stubs, changeCatalog: (items) => items.flatMap((facility) => {
      if (facilityId(facility) === facilityId(afcd)) return [];
      return facilityId(facility) === facilityId(garden) ? [facility, facility] : [facility];
    }) });
    const reopenedHook = reopenForMissing.load('facility-favorite-hooks');
    await reopenedHook.loadFacilityFavorites();
    const reopened = saved(reopenForMissing.load('app/(tabs)/saved').SavedFacilities);
    assert.equal(entries(reopened).length, 2);
    for (const [facility, status] of [[afcd, copy().saved.facilities.unavailable], [garden, copy().saved.facilities.needsReview]]) {
      assert.ok(reopened.some(({ type, props }) => type === 'AppText' && props.children === name(facility)));
      assert.ok(reopened.some(({ type, props }) => type === 'AppText' && props.children === status));
      assert.ok(remove(reopened, name(facility)));
    }
    remove(reopened, name(afcd)).props.onPress();
    await tick();
    assert.equal(reopenedHook.useFacilityFavorites().items.length, 3);
    reopenForMissing.close();
  } finally {
    app.close();
  }
}

async function testRouteStopQuickFavorite() {
  const file = join(scratch, 'route-stop-favorites.db');
  let locale = 'zh-HK';
  let opened;
  let holdInsert = false;
  let failReads = false;
  let inserts = 0;
  let reads = 0;
  let enterInsert;
  let releaseInsert;
  const insertStarted = new Promise((resolve) => { enterInsert = resolve; });
  const blocked = new Promise((resolve) => { releaseInsert = resolve; });
  const stubs = {
    react: {
      useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
      useRef: (initial) => ({ current: initial }),
      useEffect: () => {},
      useCallback: (fn) => fn,
      useMemo: (fn) => fn(),
      useSyncExternalStore: (_subscribe, read) => read(),
    },
    'expo-router': { useFocusEffect: () => {}, useRouter: () => ({ push: (href) => { opened = href; } }) },
    'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
    'react-native': {
      Pressable: 'Pressable', View: 'View', ActivityIndicator: 'ActivityIndicator',
      StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
    },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    '@/components/ui': { AppText: 'AppText', Icon: 'Icon', Screen: 'Screen' },
    '@/components/bus-ui': { BusAction: 'BusAction' },
    '@/components/nearby-facilities-map': {},
    '@/components/saved-bus-ui': { FavoriteAction: 'FavoriteAction', FavoriteBusRow: 'FavoriteBusRow', savedBusStyles: { card: {} } },
    '@/bus-stop-hooks': { useRouteStopNames: () => ({ names: {} }) },
    '@/route-stop-recommendation': {},
    '@/bus-eta-hooks': { useBusEta: () => ({ now: Date.now(), loading: false }) },
    '@/language': { useLanguage: () => ({ locale, copy: app.load('i18n').messages[locale] }) },
  };
  const app = loadApp(file, { stubs, beforeQuery: (sql) => {
    if (sql.startsWith('SELECT * FROM bus_favorites')) {
      reads += 1;
      if (failReads) throw new Error('Cannot read bus favorites');
    }
    if (sql.includes('INSERT INTO bus_favorites')) {
      inserts += 1;
      if (holdInsert) {
        enterInsert();
        return blocked;
      }
    }
  } });
  const bus = app.load('bus-favorites');
  const { readEtaTarget } = app.load('bus-eta');
  const { loadBusFavorites, useBusFavorites } = app.load('bus-favorite-hooks');
  const { SelectedStopCard } = app.load('app/bus/route');
  const { EtaDetails } = app.load('app/bus/eta');
  const { SavedBuses } = app.load('app/(tabs)/saved');
  const labels = () => app.load('i18n').messages[locale];
  const visit = (target) => ({
    target, station: { zh: '測試站', en: 'A long station name for Dynamic Type' }, destination: { zh: '總站', en: 'Terminus' },
    destinationStopId: target.source === 'citybus' ? '000999' : undefined,
  });
  const a = visit({ source: 'citybus', number: '1', direction: 'outbound', stopId: '000123', stopSeq: 2 });
  const b = visit({ ...a.target, direction: 'inbound' });
  const legacy = visit({ ...a.target, stopId: '000456' });
  const kmb = visit({ source: 'kmbLwb', number: '5', direction: 'inbound', serviceType: '2', stopId: '0123456789ABCDEF', stopSeq: 3 });
  const nlb = visit({ source: 'nlb', number: 'B2', routeId: '413', stopId: '214', stopSeq: 4, repeatedStop: true });
  const tree = (v) => elements(SelectedStopCard({ visit: v, name: v.station[locale === 'en' ? 'en' : 'zh'],
    direction: 'Terminus', cooldowns: new Map() }));
  const button = (v) => tree(v).find(({ type, props }) => type === 'Pressable' && props.accessibilityLabel);
  const icon = (v) => elements(button(v)).find(({ type }) => type === 'Icon')?.props.name;
  const etaButton = (v) => elements(EtaDetails({ initialTarget: v.target, station: v.station, destination: v.destination,
    destinationStopId: v.destinationStopId })).find(({ type, props }) => type === 'Pressable'
    && [labels().busFavorites.save, labels().busFavorites.remove].includes(props.accessibilityLabel));
  const rows = () => elements(SavedBuses({ emptyTitle: '' })).filter(({ type }) => type === 'FavoriteBusRow')
    .map(({ props }) => props.favorite);
  const tick = () => new Promise(setImmediate);

  try {
    assert.equal(button(a).props.accessibilityState.selected, undefined);
    assert.equal(button(a).props.disabled, true);
    assert.ok(elements(button(a)).some(({ type }) => type === 'ActivityIndicator'));
    await loadBusFavorites();
    assert.equal(icon(a), 'bookmark');
    assert.equal(button(a).props.accessibilityLabel, '測試站 · 未收藏 · 收藏此站');
    assert.equal(button(a).props.accessibilityState.selected, false);
    const buttonStyle = button(a).props.style({ pressed: false })[0];
    assert.equal(buttonStyle.width, 44);
    assert.equal(buttonStyle.height, 44);
    assert.ok(elements(button(a)).every(({ type }) => type !== 'AppText'));
    assert.ok(tree(a).some(({ type, props }) => type === 'AppText' && props.children === labels().busEta.nextArrival));
    etaButton(legacy).props.onPress();
    await tick();
    assert.equal(rows()[0].pinOrder, 1);

    holdInsert = true;
    const firstPress = button(a).props.onPress;
    const savingA = firstPress();
    await insertStarted;
    await firstPress();
    assert.equal(button(b).props.accessibilityState.selected, false);
    assert.equal(button(a).props.accessibilityState.busy, true);
    assert.equal(button(a).props.onPress, undefined);
    const savingB = button(b).props.onPress();
    holdInsert = false;
    releaseInsert();
    await Promise.all([savingA, savingB]);
    assert.equal(inserts, 3);
    assert.equal(opened, undefined);
    assert.equal(icon(a), 'bookmark.fill');
    assert.equal(icon(b), 'bookmark.fill');
    assert.equal(button(a).props.accessibilityLabel, '測試站 · 已收藏 · 取消收藏');
    assert.equal(etaButton(a).props.accessibilityState.selected, true);
    assert.ok(rows().filter(({ id }) => id !== bus.busFavoriteId(legacy.target)).every(({ pinOrder }) => pinOrder === null));

    etaButton(a).props.onPress();
    await tick();
    assert.equal(button(a).props.accessibilityState.selected, false);
    assert.equal(button(b).props.accessibilityState.selected, true);
    assert.equal(rows().length, 2);
    for (const v of [kmb, nlb]) {
      await button(v).props.onPress();
      const link = tree(v).find(({ type, props }) => type === 'Pressable' && !props.accessibilityLabel);
      link.props.onPress();
      assert.equal(opened.pathname, '/bus/eta');
      assert.deepEqual(readEtaTarget(opened.params), v.target);
      assert.equal(etaButton(v).props.accessibilityState.selected, true);
    }

    const sql = new DatabaseSync(file);
    sql.exec(`CREATE TRIGGER reject_bus_delete BEFORE DELETE ON bus_favorites
      BEGIN SELECT RAISE(ABORT, 'test rejected deletion'); END;`);
    const readsBeforeFailure = reads;
    await button(b).props.onPress();
    assert.equal(reads - readsBeforeFailure, 2);
    assert.equal(button(b).props.accessibilityState.selected, true);
    assert.ok(tree(b).some(({ props }) => props?.children === labels().busFavorites.saveError));
    assert.equal(tree(kmb).some(({ props }) => props?.accessibilityRole === 'alert'), false);
    sql.exec('DROP TRIGGER reject_bus_delete');
    sql.close();

    failReads = true;
    await button(b).props.onPress();
    assert.equal(button(b).props.accessibilityState.selected, undefined);
    assert.equal(icon(b), 'arrow.clockwise');
    assert.match(button(b).props.accessibilityLabel, new RegExp(labels().bus.retry));
    assert.equal(useBusFavorites().status, 'error');
    failReads = false;
    await button(b).props.onPress();
    assert.equal(button(b).props.accessibilityState.selected, true);

    locale = 'en';
    assert.match(button(a).props.accessibilityLabel, /long station name.*Not saved.*Save stop/);
    assert.match(button(b).props.accessibilityLabel, /long station name.*Saved.*Remove from saved/);
    assert.ok(elements(button(b)).every(({ type }) => type !== 'AppText'));
    await button(b).props.onPress();
    assert.equal(etaButton(b).props.accessibilityState.selected, false);
    app.close();

    const reopened = loadApp(file, { stubs });
    const current = await reopened.load('bus-favorites').readBusFavorites();
    assert.deepEqual(new Set(current.map(({ id }) => id)), new Set([legacy, kmb, nlb].map(({ target }) => bus.busFavoriteId(target))));
    assert.deepEqual(bus.pinnedBuses(current).map(({ id }) => id), [bus.busFavoriteId(legacy.target)]);
    reopened.close();
  } finally {
    app.close();
  }
}

test().then(testNearbyFavoriteButtons).then(testSavedFacilityIntegration).then(testRouteStopQuickFavorite)
  .then(() => console.log('PASS: registry, SQLite v8, facility favorites, bus pins and route stop quick favorites'))
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => rmSync(scratch, { recursive: true, force: true }));
