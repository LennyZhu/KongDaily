const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { dirname, join, resolve } = require('node:path');
const ts = require('typescript');
const { getRoutes } = require('expo-router/build/getRoutes');
const { getReactNavigationConfig } = require('expo-router/build/getReactNavigationConfig');
const { getStateFromPath } = require('expo-router/build/react-navigation/core/getStateFromPath');
const { resolveHref } = require('expo-router/build/link/href');

const content = require('../content/compliance-policy');
const photoCredits = require('../assets/explore/photos/attribution.json');
const { source: mtrSource } = require('../assets/data/mtr-static.json');
const { source: lightRailSource } = require('../assets/data/light-rail-static.json');
const confirmedEmail = 'lenny996@163.com';
const contactHref = `mailto:${confirmedEmail}`;
const brand = 'KongDaily by Lenny Studio';
assert.equal(content.identity.contactEmail, confirmedEmail);
assert.equal(content.identity.operatorType, 'individual');
assert.equal(content.identity.operatorName, 'Lenny');
const operatorSentences = {
  'zh-HK': 'KongDaily 由個人開發者 Lenny 以 Lenny Studio 品牌提供。',
  en: 'KongDaily is provided by Lenny, an individual developer operating under the Lenny Studio brand.',
};
const { buildSite, releaseIssues, verifyReleaseOutput, verifyPublishedWebsite } = require('../website/build.cjs');
const { creditsCopy, loadExplorePhotos } = require('../website/explore-credits.cjs');
const vercelConfig = require('../vercel.json');
const photoPublication = require('../website/explore-photo-publication.json');
const root = join(__dirname, '..');
const src = join(root, 'src');

let locale = 'zh-HK';
let params = {};
let changeLanguage;
const pushes = [];
const alerts = [];
const opens = [];
const native = {
  ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', View: 'View',
  StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
  Platform: { OS: 'ios', Version: '18.4' },
  Linking: { async openURL(url) { opens.push(url); throw new Error('Offline'); } },
  Alert: { alert(message) { alerts.push(message); } },
};
const draftPolicy = { ...content, getPolicyPublication: () => null };
const stubs = {
  '../content/compliance-policy': draftPolicy,
  react: { useRef: (current) => ({ current }) },
  'react-native': native,
  'expo-router': { Stack: { Screen: 'StackScreen' }, useLocalSearchParams: () => params,
    useRouter: () => ({ push: (href) => pushes.push(href), dismissTo() {} }) },
  '@/language': { useLanguage: () => ({
    locale, copy: messages[locale], preference: 'system', isSaving: false,
    changeLanguage: (value) => { changeLanguage = value; },
  }) },
  '@/components/ui': Object.fromEntries(['AppText', 'EmptyState', 'Icon', 'PageHeading', 'Screen'].map((name) => [name, name])),
  '@/components/explore-artwork': { ExplorePlacePhoto: 'ExplorePlacePhoto', exploreCategoryIcons: {} },
};
const cache = new Map();
function load(base) {
  const file = ['.ts', '.tsx'].map((suffix) => base + suffix).find(existsSync);
  if (!file) return require(base);
  if (cache.has(file)) return cache.get(file);
  const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), {
    fileName: file, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', outputText)(mod, mod.exports, (id) => {
    if (Object.hasOwn(stubs, id)) return stubs[id];
    if (id.endsWith('.jpg')) return resolve(dirname(file), id);
    if (id.startsWith('@/')) return load(join(src, id.slice(2)));
    if (id.startsWith('.')) return load(resolve(dirname(file), id));
    return require(id);
  });
  cache.set(file, mod.exports);
  return mod.exports;
}

function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements);
  return node?.props ? [node, ...elements(node.props.children)] : [];
}

const { messages } = load(join(src, 'i18n'));
const settings = load(join(src, 'app/settings')).default;
const exploreDetail = load(join(src, 'app/explore/place/[id]')).default;
const { getExplorePlaces, homeFeaturedPlaceIds } = load(join(src, 'explore-places'));
const { getComplianceCredits } = load(join(src, 'compliance-credits'));
const screens = Object.fromEntries(['privacy', 'support', 'credits'].map((name) =>
  [name, load(join(src, 'app/settings', name)).default]));
const appFiles = readdirSync(join(src, 'app'), { recursive: true }).filter((file) => file.endsWith('.tsx'));
const context = Object.assign(() => ({ default() {} }), { keys: () => appFiles.map((file) => './' + file) });
const config = JSON.parse(JSON.stringify(getReactNavigationConfig(getRoutes(context)), (key, value) =>
  key === '_route' ? undefined : key === 'path' && value === '(tabs)' ? '' : value));

function keysOf(value, prefix = '') {
  return value && typeof value === 'object'
    ? Object.keys(value).sort().flatMap((key) => keysOf(value[key], prefix + '.' + key))
    : [prefix + ':' + typeof value];
}
assert.deepEqual(keysOf(messages['zh-HK']), keysOf(messages.en), 'i18n parity');

const dragonId = homeFeaturedPlaceIds.dragon;
const dragonPhoto = photoCredits[dragonId];
assert.equal(createHash('sha256').update(readFileSync(join(root, dragonPhoto.asset))).digest('hex'), dragonPhoto.sha256);

function checkRailwayCredits(sections, language) {
  const { mtr, lightRail } = messages[language];
  const railwayResources = {
    'mtr-offline': ['mtr-data-routes-fares-barrier-free-facilities/resource/8daba4fe-b879-4a51-8962-27b4cffdc61c', mtr.dataset],
    'light-rail-offline': ['mtr-data-routes-fares-barrier-free-facilities/resource/d0662909-9919-4f01-b4f9-eccc4b2acbb5', lightRail.dataset],
    'mtr-realtime': ['mtr-data2-nexttrain-data/resource/103472ed-01be-4dda-92c6-30530dee022f', mtr.nextTrains.dataset],
    'light-rail-realtime': ['mtr-lrnt_data-light-rail-nexttrain-data/resource/d26e774b-b5ef-409f-8d4d-e61a3d323f9d', lightRail.nextTrains.dataset],
  };
  const byId = new Map(sections.map((section) => [section.id, section]));
  assert.deepEqual([...byId.keys()], ['bus', ...Object.keys(railwayResources), 'weather', 'facilities', 'geometry', 'explore', 'terms',
    ...Object.keys(photoCredits), 'other-photos']);
  const attribution = language === 'en' ? /MTR Corporation Limited.*provides.*owns its intellectual property rights.*DATA\.GOV\.HK.*HKSAR Government/
    : /香港鐵路有限公司提供.*知識產權屬香港鐵路有限公司.*香港特別行政區政府.*DATA\.GOV\.HK/;
  for (const [id, [resource, label]] of Object.entries(railwayResources)) {
    const section = byId.get(id);
    assert.ok(section.title.match(language === 'en' ? /^(Offline|Real-time) (MTR|Light Rail)/ : /^(港鐵|輕鐵)(離線|即時)/));
    assert.match(section.paragraphs[0], attribution);
    assert.deepEqual(section.links[0], { url: `https://data.gov.hk/en-data/dataset/${resource}`, label });
    if (id.endsWith('-realtime')) {
      assert.deepEqual(section.paragraphs.slice(1), [mtr.forecastDisclaimer]);
      assert.ok(!section.paragraphs.some((paragraph) => /\d{4}-\d{2}-\d{2}/.test(paragraph)));
    }
  }
  const mtrOffline = byId.get('mtr-offline');
  const lightRailOffline = byId.get('light-rail-offline');
  assert.deepEqual(mtrOffline.paragraphs.slice(1), [mtr.offlineUpdated(mtrSource.resourceUpdatedOn), mtr.disclaimer, mtr.racecourseSourceNote]);
  assert.deepEqual(lightRailOffline.paragraphs.slice(1), [mtr.offlineUpdated(lightRailSource.resourceUpdatedOn), lightRail.coverage]);
  assert.match(mtr.racecourseSourceNote, language === 'en' ? /CSV omits Racecourse \(RAC\).*public data dictionary/ : /主 CSV 未收錄馬場站（RAC）.*公開資料字典/);
  assert.deepEqual(mtrOffline.links.slice(1), [
    { url: mtrSource.racecourseCodeSource, label: mtr.racecourseDictionary },
    { url: mtrSource.racecourseHours, label: mtr.serviceHours },
  ]);
  assert.match(byId.get('terms').paragraphs.join(' '), language === 'en' ? /independent developer.*solely as data sources/ : /獨立開發者.*僅作資料來源署名/);
}

async function checkApp() {
  for (locale of ['zh-HK', 'en']) {
    const links = elements(settings()).filter(({ props }) => props.accessibilityRole === 'link');
    assert.equal(links.length, 3);
    for (const [index, page] of ['privacy', 'support', 'credits'].entries()) {
      assert.ok(links[index].props.style({ pressed: false })[0].minHeight >= 44);
      links[index].props.onPress();
      assert.equal(getStateFromPath(resolveHref(pushes.at(-1)), config).routes.at(-1).name, 'settings/' + page);
      params = {};
      const doc = screens[page]();
      const view = elements(doc.type(doc.props));
      if (page === 'credits') {
        assert.equal(doc.props.title, messages[locale].compliance.credits);
        checkRailwayCredits(doc.props.sections, locale);
        assert.ok(doc.props.sections.some(({ id, paragraphs }) => id === 'other-photos'
          && paragraphs.some((line) => line.includes('Kevin Huynh') && line.includes('Jeanne Rose Gomez'))));
      } else {
        const document = page === 'privacy' ? content.getPrivacyDocument(locale, null) : content.locales[locale][page];
        assert.deepEqual(doc.props.sections, document.sections);
        if (page === 'privacy') {
          assert.ok(view.some(({ props }) => typeof props.children === 'string' && props.children.includes(operatorSentences[locale])));
        }
        assert.ok(view.some(({ props }) => props.children === content.locales[locale].reviewStatus));
        assert.ok(view.some(({ props }) => Array.isArray(props.children)
          && props.children.includes(content.locales[locale].draftReviewDate) && props.children.includes(content.reviewedOn)));
        assert.ok(!view.some(({ props }) => Array.isArray(props.children)
          && props.children.includes(content.locales[locale].effectiveDate)));
        const contacts = view.filter(({ props }) => props.accessibilityRole === 'link'
          && elements(props.children).some((node) => node.props.children === confirmedEmail));
        assert.equal(contacts.length, 1);
        contacts[0].props.onPress();
        await new Promise(setImmediate);
        assert.equal(opens.at(-1), contactHref);
      }
    }
    elements(settings()).filter(({ props }) => props.accessibilityRole === 'radio')[1].props.onPress();
    assert.equal(changeLanguage, 'zh-HK');

    for (const place of [...getExplorePlaces(), { id: 'unknown' }]) {
      params = { id: place.id };
      const photo = photoCredits[place.id];
      const creditLine = photo?.creditLine?.[locale];
      const linkText = [messages[locale].compliance.photoCredit, creditLine].filter(Boolean).join(' · ');
      const detailNodes = elements(exploreDetail());
      const credit = detailNodes.find(({ props }) =>
        props.accessibilityRole === 'link' && elements(props.children).some((node) =>
          node.props.children === linkText));
      assert.equal(Boolean(credit), Boolean(photo));
      if (credit) {
        if (creditLine) {
          const hero = detailNodes.find(({ type, props }) => type === 'ExplorePlacePhoto' && props.banner);
          assert.equal(detailNodes[detailNodes.indexOf(hero) + 1], credit, 'Place credit immediately after its image');
          assert.ok(credit.props.style({ pressed: false })[0].minHeight >= 44);
        }
        credit.props.onPress();
        const route = getStateFromPath(resolveHref(pushes.at(-1)), config).routes.at(-1);
        assert.equal(route.name, 'settings/credits');
        assert.equal(route.params.photo, place.id);
        const first = getComplianceCredits(locale, route.params.photo)[0];
        assert.equal(first.id, place.id);
        assert.ok(first.paragraphs[0].includes(photo.author));
        assert.ok(first.paragraphs[0].includes(photo.license));
        assert.ok(first.paragraphs[1].includes(photo.processing.pixels.join(' × ')));
        assert.deepEqual(first.links.slice(0, 2).map(({ url }) => url), [photo.sourcePage, photo.licenseUrl]);
        if (photo.independentOriginalUrl) {
          assert.equal(first.links[2].url, photo.independentOriginalUrl);
          assert.ok(first.paragraphs.includes(photo.processing.summary[locale]));
        }
      }
    }
    params = { photo: 'dragons-back' };
    const credits = screens.credits();
    const record = credits.props.sections[0];
    assert.equal(record.id, dragonId);
    assert.ok(record.paragraphs.includes(dragonPhoto.notice[locale]));
    assert.ok(!JSON.stringify(credits.props.sections).includes('Dragons-Back-Northwards'));
    assert.deepEqual(getComplianceCredits(locale, ['dragons-back', 'invalid']), getComplianceCredits(locale));
    const docLinks = elements(credits.type(credits.props)).filter(({ props }) => props.accessibilityRole === 'link');
    assert.ok(docLinks.every(({ props }) => props.style({ pressed: false })[0].minHeight >= 44));
    docLinks[0].props.onPress();
    await new Promise(setImmediate);
    assert.equal(opens.at(-1), record.links[0].url);
    assert.equal(alerts.at(-1), messages[locale].compliance.linkFailed);
  }
}

async function checkWebsite() {
  const escape = (value) => value.replace(/[&<>"']/g, (char) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  assert.deepEqual(
    Object.keys(content.locales['zh-HK']).sort(), Object.keys(content.locales.en).sort(),
  );
  for (const page of ['privacy', 'support']) {
    assert.deepEqual(content.locales.en[page].sections.map(({ id }) => id), content.locales['zh-HK'][page].sections.map(({ id }) => id));
  }
  const retention = Object.fromEntries(['zh-HK', 'en'].map((locale) => {
    const policy = content.getPrivacyDocument(locale, null);
    return [locale, policy.sections.find(({ id }) => id === 'retention').paragraphs.join(' ')];
  }));
  assert.match(retention['zh-HK'], /個案解決後最多保留 12 個月，適用法律要求保留更長時間者除外。.*刪除要求/);
  assert.match(retention.en, /up to 12 months after the case is resolved, unless applicable law requires longer retention\. You can request deletion/);
  assert.match(retention['zh-HK'], /電郵服務商獨立管理的備份、日誌及留存安排.*無法保證其刪除時間/);
  assert.match(retention.en, /email provider manages its own backups, logs and retention arrangements.*cannot guarantee/);
  assert.match(JSON.stringify(content.locales['zh-HK'].privacy), /姓名、電郵地址、問題描述及附件/);
  assert.match(JSON.stringify(content.locales.en.privacy), /name, email address, description of the issue and any attachments/);
  assert.match(JSON.stringify(content.locales['zh-HK'].privacy), /不會在該請求附送裝置 GPS 座標.*沒有說明查詢是否記入日誌或日誌會保留多久/);
  assert.match(JSON.stringify(content.locales.en.privacy), /does not attach your device’s GPS coordinates.*does not say whether queries are logged or how long any logs are kept/);
  assert.deepEqual([vercelConfig.buildCommand, vercelConfig.outputDirectory, vercelConfig.trailingSlash],
    ['node website/build.cjs --release', 'website/dist/release', true]);
  assert.equal(vercelConfig.git.deploymentEnabled, false);
  const photos = loadExplorePhotos();
  assert.equal(photos.length, 8);
  assert.equal(photos.filter(({ hosted }) => hosted).length, 7);
  const sourceOnly = photos.find(({ id }) => id === 'west-kowloon-art-park');
  assert.equal(sourceOnly.hosted, false);
  const removed = { ...photoCredits };
  delete removed[dragonId];
  assert.throws(() => loadExplorePhotos(removed), /all eight official Explore places/);
  assert.throws(() => loadExplorePhotos({ ...photoCredits,
    [dragonId]: { ...dragonPhoto, sha256: '0'.repeat(64) } }), /SHA-256 differs/);
  assert.throws(() => loadExplorePhotos({ ...photoCredits,
    [dragonId]: { ...dragonPhoto, licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' } }), /licence or processing evidence/);
  assert.throws(() => loadExplorePhotos({ ...photoCredits,
    'victoria-peak-garden': { ...photoCredits['victoria-peak-garden'], creditLine: null } }), /missing photo-side credit/);
  assert.throws(() => loadExplorePhotos(photoCredits, {
    ...photoPublication, [dragonId]: { ...photoPublication[dragonId], sha256: '0'.repeat(64) },
  }), /outdated website rights review/);
  assert.throws(() => loadExplorePhotos(photoCredits, {
    ...photoPublication, [sourceOnly.id]: { ...photoPublication[sourceOnly.id], website: 'pending' },
  }), /outdated website rights review/);
  const temporary = mkdtempSync(join(tmpdir(), 'kongdaily-compliance-'));
  const review = join(temporary, 'review');
  try {
    const blocked = join(temporary, 'must-not-write');
    assert.ok(releaseIssues({}).some((issue) => issue.startsWith('assetRightsApprovalReference')));
    assert.throws(() => buildSite(blocked, {}), /Publication blocked/);
    assert.throws(() => buildSite(blocked, null), /Publication blocked/);
    assert.equal(existsSync(blocked), false);
    const paths = ['index.html', 'privacy/index.html', 'support/index.html', 'credits/explore/index.html',
      'en/index.html', 'en/privacy/index.html', 'en/support/index.html', 'en/credits/explore/index.html'];
    buildSite(review);
    const stale = join(review, sourceOnly.route);
    writeFileSync(stale, sourceOnly.bytes);
    buildSite(review);
    assert.equal(existsSync(stale), false, 'An exact B3 generated JPEG must not survive rebuilding');
    writeFileSync(stale, 'unrecognised file');
    assert.throws(() => buildSite(review), /Unexpected static output entry/);
    assert.equal(readFileSync(stale, 'utf8'), 'unrecognised file');
    unlinkSync(stale);
    for (const path of paths) {
      const language = path.startsWith('en/') ? 'en' : 'zh-HK';
      const page = path.includes('privacy') ? 'privacy' : path.includes('support') ? 'support'
        : path.includes('credits') ? 'credits' : 'home';
      const file = join(review, path);
      const html = readFileSync(file, 'utf8');
      const document = page === 'privacy' ? content.getPrivacyDocument(language, null)
        : page === 'credits' ? creditsCopy[language] : content.locales[language][page];
      assert.ok(html.includes(`<html lang="${language}">`));
      assert.ok(html.includes('noindex, nofollow'));
      assert.ok(html.includes(`<h1>${escape(document.title)}</h1>`));
      assert.ok(html.includes(`<title>${escape(document.title)} · ${brand}</title>`));
      assert.match(html, /<a class="brand"[^>]*>KongDaily by Lenny Studio<\/a>/);
      assert.match(html, /<footer[^>]*>\s*<p[^>]*>KongDaily by Lenny Studio<\/p>/);
      assert.ok(html.includes(`<p>${escape(document.intro)}</p>`));
      assert.equal(html.includes(`datetime="${content.reviewedOn}"`), page !== 'credits');
      const alternate = language === 'en' ? 'zh-HK' : 'en';
      const [, switchHref] = html.match(/class="language" href="([^"]+)" lang="[^"]+" hreflang="(?:en|zh-HK)"/);
      const pageDirectory = page === 'home' ? '' : page === 'credits' ? 'credits/explore' : page;
      assert.equal(resolve(dirname(file), switchHref), resolve(review, alternate === 'en' ? 'en' : '.', pageDirectory));
      assert.doesNotMatch(html, /<script\b|<form\b|<iframe\b|class="operator"|\{operatorName\}/i);
      assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
      if (page === 'privacy') assert.ok(html.includes(operatorSentences[language]));
      const mailLinks = [...html.matchAll(/href="(mailto:[^"]+)"/g)].map((match) => match[1]);
      assert.deepEqual(mailLinks, ['home', 'credits'].includes(page) ? [] : [contactHref]);
      for (const { id, title, paragraphs, links } of document.sections ?? []) {
        const start = html.indexOf(`<section aria-labelledby="${id}">`);
        assert.ok(start >= 0);
        const section = html.slice(start, html.indexOf('</section>', start));
        assert.ok(section.includes(`<h2 id="${id}">${escape(title)}</h2>`));
        for (const paragraph of paragraphs) assert.ok(section.includes(`<p>${escape(paragraph)}</p>`));
        for (const { label, url } of links ?? []) assert.ok(section.includes(`<a href="${escape(url)}">${escape(label)}</a>`));
        assert.equal(section.includes(`href="${contactHref}"`), id === document.contactSection);
      }
      if (page === 'credits') {
        assert.equal([...html.matchAll(/<img /g)].length, 7);
        assert.equal([...html.matchAll(/ download>/g)].length, 7);
        for (const { id, title, photo, route, hosted } of photos) {
          const start = html.indexOf(`<section aria-labelledby="${id}">`);
          assert.ok(start >= 0);
          const section = html.slice(start, html.indexOf('</section>', start));
          assert.ok(section.includes(`<h2 id="${id}">${escape(title[language])}</h2>`));
          assert.ok(section.includes(photo.processing.pixels.join(' × ')));
          if (hosted) {
            assert.ok(section.includes(`alt="${escape(photo.description[language])}"`));
            assert.match(section, /<figure[^>]*>\s*<img[^>]*>\s*<figcaption>/);
            assert.deepEqual(readFileSync(join(review, route)), readFileSync(join(root, photo.asset)));
          } else {
            assert.doesNotMatch(section, /<img\b|\bdownload>|\.jpg\b|images\.unsplash/);
            assert.ok(section.includes(creditsCopy[language].sourceOnly));
            assert.equal(existsSync(join(review, route)), false);
          }
          for (const field of [photo.creditLine?.[language] ?? photo.author, photo.title, photo.sourcePage,
            photo.license, photo.licenseUrl, photo.notice?.[language], photo.independentOriginalUrl,
            photo.processing.summary?.[language]].filter(Boolean)) assert.ok(section.includes(escape(field)), field);
        }
      }
      for (const [, href] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
        if (href.startsWith('#')) assert.ok(html.includes(`id="${href.slice(1)}"`));
        else if (href === contactHref) continue;
        else if (href.includes(':')) assert.equal(new URL(href).protocol, 'https:');
        else {
          const target = resolve(dirname(file), href);
          assert.ok(target.startsWith(review) && existsSync(target), `${path}: ${href}`);
          if (statSync(target).isDirectory()) assert.ok(existsSync(join(target, 'index.html')), href);
        }
      }
    }
    assert.match(readFileSync(join(review, 'site.css'), 'utf8'), /flex-wrap: wrap/);
    assert.doesNotMatch(readFileSync(join(review, 'site.css'), 'utf8'), /@import|url\(/);
    assert.ok(releaseIssues({ origin: 'http://localhost:4173' }).some((issue) => issue.startsWith('origin')));

    // Synthetic values exercise rendering only in this temporary directory. No requests are made.
    const fixture = {
      origin: null,
      operatorVerificationReference: 'Verified spelling fixture',
      approvalReference: 'Test fixture only',
      assetRightsApprovalReference: 'Asset clearance fixture',
    };
    const publication = {
      version: '1.0',
      effectiveOn: '2026-11-21', updatedOn: '2026-11-21',
      siteAndSupportPrivacy: { 'zh-HK': '測試網站與支援文字', en: 'Site & support fixture' },
      retentionDisclosure: { 'zh-HK': '測試保留文字', en: 'Retention fixture' },
    };
    const approvedCopy = { ...content, publication };
    assert.deepEqual(releaseIssues(fixture, approvedCopy), []);
    const laterPolicy = { ...approvedCopy, publication: { ...publication, updatedOn: '2026-11-22' } };
    assert.throws(() => buildSite(blocked, fixture, laterPolicy), /updatedOn must equal effectiveOn/);
    assert.equal(existsSync(blocked), false);
    for (const { field, changes } of [
      { field: 'operatorVerificationReference', changes: { operatorVerificationReference: null } },
      { field: 'origin', changes: { origin: 'https://example.com.' } },
      { field: 'approvalReference', changes: { approvalReference: null } },
      { field: 'assetRightsApprovalReference', changes: { assetRightsApprovalReference: null } },
    ]) {
      const invalid = { ...fixture, ...changes };
      assert.ok(releaseIssues(invalid, approvedCopy).some((issue) => issue.startsWith(field)), field);
      assert.throws(() => buildSite(blocked, invalid, approvedCopy), /Publication blocked/);
      assert.equal(existsSync(blocked), false);
    }
    for (const { field, changes } of [
      { field: 'version', changes: { version: 'TBD' } },
      { field: 'effectiveOn', changes: { effectiveOn: '2026-02-30' } },
      { field: 'updatedOn', changes: { updatedOn: '2026-11-20' } },
      { field: 'siteAndSupportPrivacy.zh-HK', changes: { siteAndSupportPrivacy: { ...publication.siteAndSupportPrivacy, 'zh-HK': '待確認' } } },
      { field: 'retentionDisclosure.en', changes: { retentionDisclosure: { ...publication.retentionDisclosure, en: null } } },
    ]) {
      const invalid = { ...content, publication: { ...publication, ...changes } };
      assert.equal(content.getPolicyPublication(invalid.publication), null);
      assert.ok(releaseIssues(fixture, invalid).some((issue) => issue.startsWith(field)), field);
      assert.throws(() => buildSite(blocked, fixture, invalid), /Publication blocked/);
      assert.equal(existsSync(blocked), false);
    }
    for (const changes of [
      { contactEmail: null },
      { contactEmail: 'placeholder@example.com' },
      { brand: 'Another brand' },
      { operatorType: 'company' },
      { operatorName: null },
      { operatorName: ' Lenny   Studio ' },
    ]) {
      assert.equal(releaseIssues(fixture, { ...approvedCopy, identity: { ...content.identity, ...changes } }).length, 1);
    }
    const incomplete = { ...approvedCopy, locales: structuredClone(content.locales) };
    incomplete.locales.en.privacy.sections.pop();
    assert.ok(releaseIssues(fixture, incomplete).some((issue) => issue.startsWith('privacy.en')));
    const wrongRetention = { ...approvedCopy, locales: structuredClone(content.locales) };
    const section = wrongRetention.locales.en.privacy.sections.find(({ id }) => id === 'retention');
    section.paragraphs = section.paragraphs.map((paragraph) => paragraph.replace('12 months', '13 months'));
    assert.throws(() => buildSite(blocked, fixture, wrongRetention), /approved 12-month limit/);
    assert.equal(existsSync(blocked), false);
    const release = join(temporary, 'release');
    buildSite(release, fixture, approvedCopy);
    assert.equal(verifyReleaseOutput(release, fixture, approvedCopy), 16);
    assert.throws(() => verifyReleaseOutput(review, fixture, approvedCopy), /differs from the approved file/);
    for (const unwanted of ['internal.md', '.env', 'test-compliance.cjs', sourceOnly.route]) {
      const path = join(release, unwanted);
      writeFileSync(path, 'internal test material');
      assert.throws(() => verifyReleaseOutput(release, fixture, approvedCopy), /Unexpected static output entry/);
      assert.throws(() => buildSite(release, fixture, approvedCopy), /Unexpected static output entry/);
      assert.equal(readFileSync(path, 'utf8'), 'internal test material');
      unlinkSync(path);
    }
    const symlink = join(release, 'internal-link');
    symlinkSync(join(root, 'docs'), symlink);
    assert.throws(() => verifyReleaseOutput(release, fixture, approvedCopy), /Unexpected static output entry: internal-link/);
    unlinkSync(symlink);
    const releasedPrivacy = readFileSync(join(release, 'en/privacy/index.html'), 'utf8');
    assert.doesNotMatch(releasedPrivacy, /noindex|Review draft|Test fixture only|rel="canonical"|\{operatorName\}/);
    assert.ok(releasedPrivacy.includes(operatorSentences.en));
    assert.match(releasedPrivacy, /<p>Lenny<\/p>/);
    assert.match(releasedPrivacy, /Site &amp; support fixture/);
    assert.match(releasedPrivacy, /Retention fixture/);
    assert.match(releasedPrivacy, /Policy version · 1\.0/);
    assert.doesNotMatch(releasedPrivacy, /Asset clearance fixture|Verified spelling fixture/);
    // Reload the App screens with the same isolated approved policy used for static output.
    stubs['../content/compliance-policy'] = { ...approvedCopy, getPolicyPublication: () => content.getPolicyPublication(publication) };
    try {
      cache.clear();
      for (locale of ['zh-HK', 'en']) {
        const indexPath = locale === 'en' ? 'en/privacy/index.html' : 'privacy/index.html';
        const html = readFileSync(join(release, indexPath), 'utf8');
        const doc = load(join(src, 'app/settings/privacy')).default();
        const view = elements(doc.type(doc.props));
        assert.ok(!view.some(({ props }) => props.children === content.locales[locale].reviewStatus));
        for (const [label, date] of [[content.locales[locale].effectiveDate, publication.effectiveOn],
          [content.locales[locale].reviewDate, publication.updatedOn]]) {
          assert.ok(view.some(({ props }) => Array.isArray(props.children)
            && props.children.includes(label) && props.children.includes(date)));
          assert.ok(html.includes(`${label} · <time datetime="${date}">${date}</time>`));
        }
        assert.ok(view.some(({ props }) => Array.isArray(props.children)
          && props.children.includes(content.locales[locale].policyVersion) && props.children.includes(publication.version)));
        assert.ok(html.includes(`${content.locales[locale].policyVersion} · ${publication.version}`));
        for (const { paragraphs } of doc.props.sections) {
          for (const paragraph of paragraphs) assert.ok(html.includes(`<p>${escape(paragraph)}</p>`));
        }
      }
    } finally {
      stubs['../content/compliance-policy'] = draftPolicy;
      cache.clear();
    }
    // 16:30 UTC falls on the following calendar day in Hong Kong.
    const live = { ...fixture, origin: 'https://release-fixture.iana.org', firstPublicDeploymentAt: '2026-11-20T16:30:00Z' };
    assert.deepEqual(releaseIssues(live, laterPolicy), [], 'A subsequent policy revision can update Last Updated');
    const canonicalOutput = join(temporary, 'canonical');
    buildSite(canonicalOutput, live, approvedCopy);
    const routes = ['privacy/', 'support/', 'en/privacy/', 'en/support/'];
    for (const route of routes) {
      const html = readFileSync(join(release, route, 'index.html'), 'utf8');
      assert.doesNotMatch(html, /rel="canonical"/);
      assert.deepEqual([...html.matchAll(/href="(mailto:[^"]+)"/g)].map((match) => match[1]), [contactHref]);
      assert.ok(readFileSync(join(canonicalOutput, route, 'index.html'), 'utf8')
        .includes(`rel="canonical" href="${live.origin}/${route}"`));
    }
    const pagePaths = ['/', '/privacy/', '/support/', '/credits/explore/', '/en/', '/en/privacy/', '/en/support/', '/en/credits/explore/'];
    const jpegPaths = photos.filter(({ hosted }) => hosted).map(({ route }) => '/' + route);
    const excludedPath = '/' + sourceOnly.route;
    const missing = '/__kongdaily_missing_release_check__/';
    const expected = [
      ...pagePaths.flatMap((path) => path === '/' ? [path] : [path, path.slice(0, -1) + ' (HTTP 308)']),
      ...photos.map(({ route, hosted }) => '/' + route + (hosted ? '' : ' (HTTP 404)')), '/site.css', missing + ' (HTTP 404)',
    ].map((path) => live.origin + path);
    const readResponse = (output) => async (url, options) => {
      assert.equal(options.redirect, 'manual');
      const path = new URL(url).pathname;
      if (path === missing || path === excludedPath) return new Response(null, { status: 404 });
      if (path === '/site.css') return new Response(readFileSync(join(output, path)), { headers: { 'content-type': 'text/css' } });
      if (jpegPaths.includes(path)) return new Response(readFileSync(join(output, path)), { headers: { 'content-type': 'image/jpeg' } });
      if (pagePaths.includes(path + '/')) return new Response(null, { status: 308, headers: { location: path + '/' } });
      assert.ok(pagePaths.includes(path));
      return new Response(readFileSync(join(output, path, 'index.html')), { headers: { 'content-type': 'text/html; charset=utf-8' } });
    };
    await assert.rejects(verifyPublishedWebsite(fixture, () => assert.fail('No request without an origin')), /actual deployed HTTPS origin/);
    for (const invalidTime of [null, '2026-11-21T00:30:00', '2026-02-30T00:30:00+08:00']) {
      await assert.rejects(verifyPublishedWebsite({ ...live, firstPublicDeploymentAt: invalidTime },
        () => assert.fail('No request without a valid launch timestamp'), approvedCopy), /firstPublicDeploymentAt/);
    }
    await assert.rejects(verifyPublishedWebsite({ ...live, firstPublicDeploymentAt: '2026-11-20T15:59:59Z' },
      () => assert.fail('No request when the Hong Kong day differs'), approvedCopy), /launch date differs/);
    assert.throws(() => buildSite(blocked, { ...live, firstPublicDeploymentAt: '2026-11-20T15:59:59Z' }, approvedCopy),
      /launch date differs/);
    assert.equal(existsSync(blocked), false);
    assert.deepEqual(await verifyPublishedWebsite(live, readResponse(release), approvedCopy), expected);
    assert.deepEqual(await verifyPublishedWebsite(live, readResponse(canonicalOutput), approvedCopy), expected);
    await assert.rejects(verifyPublishedWebsite(live, async () => new Response(null, { status: 302 }), approvedCopy), /public HTTP 200 HTML/);
    await assert.rejects(verifyPublishedWebsite(live, readResponse(review), approvedCopy), /differs from the approved release/);
    const readRelease = readResponse(release);
    for (const [path, response, reason] of [
      ['/credits/explore', new Response(null, { status: 308, headers: { location: 'https://other.iana.org/credits/explore/' } }), /same-origin HTTP 308/],
      [jpegPaths[0], new Response(null, { status: 302 }), /public HTTP 200 JPEG/],
      [jpegPaths[0], new Response('Different bytes', { headers: { 'content-type': 'image/jpeg' } }), /SHA-256 differs/],
      [excludedPath, new Response(sourceOnly.bytes, { headers: { 'content-type': 'image/jpeg' } }), /expected HTTP 404 for a source-only photo/],
      [missing, new Response('Soft 404', { status: 200 }), /expected HTTP 404/],
    ]) {
      await assert.rejects(verifyPublishedWebsite(live, (url, options) =>
        new URL(url).pathname === path ? response : readRelease(url, options), approvedCopy), reason);
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

checkApp().then(checkWebsite).then(() => {
  console.log('PASS: bilingual policy, eight credits, seven downloadable JPEGs, source-only exclusion, static output allowlist and release gates.');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
