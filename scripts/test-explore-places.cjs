const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

const root = join(__dirname, '..');
const catalog = require('../assets/data/explore-places.json');
const parks = require('../assets/data/lcsd-parks.json');
const petParks = require('../assets/data/lcsd-inclusive-pet-parks.json');
const officialHosts = new Set([
  'www.hiking.gov.hk', 'www.discoverhongkong.com',
  'webmedia.westkowloon.hk', 'hkp.lcsd.gov.hk', 'www.lcsd.gov.hk',
  'www.amo.gov.hk', 'www.info.gov.hk',
]);
const approvedPlaces = [
  ['dragons-back-to-tei-wan-tai-tam-gap', '龍脊', 'Dragon’s Back', 'hiking', []],
  ['peak-circle-walk', '山頂環迴步行徑', 'Peak Circle Walk', 'hiking', []],
  ['west-kowloon-art-park', '西九文化區藝術公園', 'Art Park (West Kowloon Cultural District)', 'waterfront', ['pets']],
  ['avenue-of-stars', '星光大道', 'Avenue of Stars', 'waterfront', []],
  ['hong-kong-park', '香港公園', 'Hong Kong Park', 'parks', []],
  ['kowloon-walled-city-park', '九龍寨城公園', 'Kowloon Walled City Park', 'parks', []],
  ['tai-po-waterfront-park', '大埔海濱公園', 'Tai Po Waterfront Park', 'parks', ['waterfront']],
  ['victoria-peak-garden', '山頂花園', 'Victoria Peak Garden', 'pets', ['parks']],
];
const approvedTrailheads = new Map([
  ['dragons-back-to-tei-wan-tai-tam-gap', [
    '石澳道土地灣港島徑入口', 'To Tei Wan Trailhead, Shek O Road', 22.2270299568, 114.2397903557,
    'DragonsBack.gpx',
  ]],
  ['peak-circle-walk', [
    '凌霄閣西側盧吉道入口', 'Lugard Road Trailhead, near The Peak Tower', 22.2712927825, 114.1494947398,
    'HongKongTrail%28Section1%29ThePeaktoPokFuLamReservoirRoad.gpx',
  ]],
]);

// Only the bundled JSON may be imported by the actual reader at runtime.
function loadAppModule(name, importData) {
  const source = readFileSync(join(root, 'src', name + '.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  });
  const exports = {};
  runInNewContext(outputText, { exports, require: importData }, { filename: name + '.ts' });
  return exports;
}

function fields(value, expected, path) {
  assert.deepEqual(Object.keys(value).sort(), expected.split(' ').sort(), path + ' has unexpected or missing fields');
}

function bilingual(text, path, withSources = false) {
  fields(text, withSources ? 'zh-HK en sourceIds' : 'zh-HK en', path);
  for (const locale of ['zh-HK', 'en']) {
    assert.ok(typeof text[locale] === 'string' && text[locale].trim(), path + '.' + locale + ' must be non-empty');
    assert.doesNotMatch(text[locale], /https?:\/\//, path + ' must link via sources');
  }
  assert.match(text['zh-HK'], /\p{Script=Han}/u, path + ' needs Chinese copy');
  assert.match(text.en, /[a-z]/i, path + ' needs English copy');
  assert.doesNotMatch(text.en, /\p{Script=Han}/u, path + ' has untranslated Chinese copy');
}

function checkDate(value, path) {
  assert.match(value, /^\d{4}-\d{2}-\d{2}$/, path + ' must have a YYYY-MM-DD date');
  const date = new Date(value + 'T00:00:00Z');
  assert.ok(Number.isFinite(date.getTime()) && date.toISOString().startsWith(value), path + ' must have a real date');
}

const { messages } = loadAppModule('i18n', (id) => assert.fail('Unexpected i18n dependency: ' + id));
const categories = Object.keys(messages['zh-HK'].explore.categories);
assert.deepEqual(categories, Object.keys(messages.en.explore.categories));
fields(catalog, 'places schemaVersion', 'catalog');
assert.equal(catalog.schemaVersion, 1);
assert.equal(catalog.places.length, 8, 'The first release must have exactly 8 places');

const nearbyIds = new Set([parks, petParks].flatMap((index) => index.records.map((record) => record.officialId)));
const urls = new Set();
for (const place of catalog.places) {
  const label = place.id;
  fields(place, 'id category additionalCategories order title district summary highlights transport cautions sources reviewedAt navigation', label);
  assert.match(label, /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, 'Invalid stable place ID');
  assert.ok(!nearbyIds.has(label), label + ' collides with a Nearby facility ID');
  const filterKeys = [place.category, ...place.additionalCategories];
  assert.ok(filterKeys.every((category) => categories.includes(category)), label + ' has an unknown category');
  assert.equal(new Set(filterKeys).size, filterKeys.length, label + ' repeats a category');
  assert.ok(Number.isSafeInteger(place.order) && place.order > 0, label + ' has an invalid order');
  checkDate(place.reviewedAt, label + '.reviewedAt');
  for (const key of ['title', 'district', 'summary']) bilingual(place[key], label + '.' + key);
  assert.ok(place.highlights.length >= 2 && place.highlights.length <= 3, label + ' needs 2–3 highlights');

  const sourceIds = new Set();
  for (const source of place.sources) {
    const path = label + '.sources.' + source.id;
    fields(source, 'id organization title language url', path);
    assert.match(source.id, /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, path + ' has an invalid evidence ID');
    assert.ok(!sourceIds.has(source.id), path + ' duplicates a source ID');
    sourceIds.add(source.id);
    bilingual(source.organization, path + '.organization');
    bilingual(source.title, path + '.title');
    assert.ok(['zh-HK', 'en', 'bilingual'].includes(source.language), path + ' has an invalid language');
    const url = new URL(source.url);
    assert.ok(url.protocol === 'https:' && officialHosts.has(url.hostname) && !url.username && !url.password && !url.port,
      path + ' requires an official HTTPS URL');
    assert.doesNotMatch(url.pathname, /\.(avif|gif|jpe?g|png|svg|webp)$/i, path + ' cannot point to a remote image');
    urls.add(source.url);
  }
  for (const locale of ['zh-HK', 'en']) {
    assert.ok(place.sources.some(({ language }) => language === locale || language === 'bilingual'),
      label + ' has no official source for ' + locale);
  }
  for (const [key, item] of [['transport', place.transport], ['cautions', place.cautions],
    ...place.highlights.map((highlight, index) => ['highlights.' + index, highlight])]) {
    const path = label + '.' + key;
    bilingual(item, path, true);
    assert.ok(item.sourceIds.length > 0 && item.sourceIds.every((id) => sourceIds.has(id)),
      path + ' must reference existing evidence');
    assert.equal(new Set(item.sourceIds).size, item.sourceIds.length, path + ' repeats an evidence ID');
  }
  const approved = approvedTrailheads.get(place.id);
  if (approved) {
    const [zh, en, latitude, longitude, file] = approved;
    fields(place.navigation, 'status destination', label + '.navigation');
    assert.equal(place.navigation.status, 'verified');
    assert.equal(place.category, 'hiking');
    const { destination } = place.navigation;
    fields(destination, 'role name coordinate evidenceSourceIds reviewedAt verificationReport', label + '.destination');
    assert.equal(destination.role, 'trailhead');
    assert.deepEqual(destination.name, { 'zh-HK': zh, en });
    assert.notDeepEqual(destination.name, place.title, 'Trailhead and hiking route must be named separately');
    assert.deepEqual(destination.coordinate, {
      latitude, longitude, crs: 'WGS84',
      sourceUrl: 'https://www.hiking.gov.hk/console/public/uploads/others/file/gpx/' + file,
    });
    assert.ok(destination.evidenceSourceIds.length > 0 && destination.evidenceSourceIds.every((id) => sourceIds.has(id)),
      label + ' needs traceable source evidence');
    assert.equal(destination.verificationReport, 'docs/UI-05C3D-NAVIGATION-POINT-VERIFICATION.md');
    checkDate(destination.reviewedAt, label + '.destination.reviewedAt');
  } else {
    assert.deepEqual(place.navigation, { status: 'unverified' }, label + ' cannot ship a navigation destination');
  }
}
assert.equal(catalog.places.filter(({ navigation }) => navigation.status === 'verified').length, 2);
assert.equal(catalog.places.reduce((count, { highlights }) => count + highlights.length, 0), 18);
assert.equal(urls.size, 39);
assert.equal(new Set(catalog.places.map(({ order }) => order)).size, 8, 'Display order must be unique');
assert.equal(new Set(catalog.places.map(({ id }) => id)).size, 8, 'Stable IDs must be unique');

const { getExplorePlaces, getExplorePlace, homeFeaturedPlaceIds } = loadAppModule('explore-places', (id) => {
  assert.equal(id, '../assets/data/explore-places.json');
  // Reverse the file order so the test exercises sorting by the explicit order field.
  return { ...catalog, places: catalog.places.slice().reverse() };
});
const plain = (value) => JSON.parse(JSON.stringify(value));
const listed = getExplorePlaces();
assert.deepEqual(plain(listed.map(({ id, title, category, additionalCategories }) =>
  [id, title['zh-HK'], title.en, category, additionalCategories])), approvedPlaces);
for (const [category, expected] of Object.entries({ parks: 4, hiking: 2, waterfront: 3, pets: 2 })) {
  const filtered = getExplorePlaces(category);
  assert.equal(filtered.length, expected, 'Wrong number for ' + category);
  assert.deepEqual(plain(filtered), plain(listed.filter((row) => row.category === category || row.additionalCategories.includes(category))));
}
assert.equal(getExplorePlace('not-in-the-catalog'), undefined);
assert.deepEqual(plain(homeFeaturedPlaceIds), {
  dragon: 'dragons-back-to-tei-wan-tai-tam-gap',
  westKowloon: 'west-kowloon-art-park',
});
for (const id of Object.values(homeFeaturedPlaceIds)) {
  const place = getExplorePlace(id);
  assert.ok(place, 'Home featured card must resolve to a bundled Explore place: ' + id);
  for (const locale of ['zh-HK', 'en']) {
    assert.ok(messages[locale].explore.categoryButtonLabels[place.category]?.trim(),
      'Home featured card needs a compact category label: ' + id + ' (' + locale + ')');
  }
}
assert.equal(getExplorePlace(homeFeaturedPlaceIds.dragon), getExplorePlaces('hiking')[0]);
assert.equal(getExplorePlace(homeFeaturedPlaceIds.westKowloon), getExplorePlaces('waterfront')[0]);
assert.equal(getExplorePlaces('pets')[0], getExplorePlace(homeFeaturedPlaceIds.westKowloon));

for (const [contentId, nearbyId, index] of [
  ['hong-kong-park', 'park-040', parks], ['kowloon-walled-city-park', 'park-003', parks],
  ['tai-po-waterfront-park', 'park-012', parks], ['victoria-peak-garden', 'inclusive-pet-040', petParks],
]) {
  const facility = index.records.find(({ officialId }) => officialId === nearbyId);
  assert.deepEqual(plain(getExplorePlace(contentId).title), facility.name, contentId + ' has a Nearby name mismatch');
  assert.equal(getExplorePlace(nearbyId), undefined, 'Nearby identity must not resolve as an Explore ID');
}

console.log('PASS · 8 offline places, 4 filters, 18 bilingual highlights, 2 approved trailheads, 6 unverified places');
console.log(urls.size + ' unique official HTTPS sources. Reachability reviewed in the UI-05C1 report.');

async function checkLinks() {
  const links = [...urls];
  for (let offset = 0; offset < links.length; offset += 4) {
    await Promise.all(links.slice(offset, offset + 4).map(async (url) => {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        await response.body?.cancel();
        const destination = new URL(response.url);
        const type = response.headers.get('content-type') ?? '';
        if (!response.ok || destination.protocol !== 'https:' || !officialHosts.has(destination.hostname)
          || !/^(text\/html|application\/pdf)\b/i.test(type)) {
          throw new Error(`HTTP ${response.status}, ${type}, ${response.url}`);
        }
        console.log(`HTTP ${response.status} ${url}`);
      } catch (error) {
        console.error(`Unable to confirm ${url}: ${error.cause?.message ?? error.message}`);
        process.exitCode = 1;
      }
    }));
  }
}

if (process.argv.includes('--check-links')) void checkLinks();
