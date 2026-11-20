const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { dirname, join, resolve } = require('node:path');
const ts = require('typescript');
const { getRoutes } = require('expo-router/build/getRoutes');
const { getReactNavigationConfig } = require('expo-router/build/getReactNavigationConfig');
const { getStateFromPath } = require('expo-router/build/react-navigation/core/getStateFromPath');
const { resolveHref } = require('expo-router/build/link/href');

const content = require('../content/compliance-policy');
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
const { buildSite, releaseIssues, verifyPublishedWebsite } = require('../website/build.cjs');
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
const stubs = {
  react: { useRef: (current) => ({ current }) },
  'react-native': native,
  'expo-router': { Stack: { Screen: 'StackScreen' }, useLocalSearchParams: () => params,
    useRouter: () => ({ push: (href) => pushes.push(href), dismissTo() {} }) },
  '@/language': { useLanguage: () => ({
    locale, copy: messages[locale], preference: 'system', isSaving: false,
    changeLanguage: (value) => { changeLanguage = value; },
  }) },
  '@/components/ui': Object.fromEntries(['AppText', 'EmptyState', 'Icon', 'PageHeading', 'Screen'].map((name) => [name, name])),
  '@/components/explore-artwork': { ExploreArtwork: 'ExploreArtwork', exploreCategoryIcons: {} },
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
const expectedHash = '8a03f2f99a28c0353f8e821692f2499b7215a56c83460e9ad23bc57f5d209a8a';
assert.equal(createHash('sha256').update(readFileSync(join(root, 'assets/home/dragons-back.jpg'))).digest('hex'), expectedHash);

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
        assert.equal(doc.props.sections.length, 8);
      } else {
        assert.deepEqual(doc.props.sections, content.locales[locale][page].sections);
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
      const credit = elements(exploreDetail()).find(({ props }) =>
        props.accessibilityRole === 'link' && elements(props.children).some((node) =>
          node.props.children === messages[locale].compliance.dragonPhoto));
      assert.equal(Boolean(credit), place.id === dragonId);
      if (credit) credit.props.onPress();
    }
    const creditsRoute = getStateFromPath(resolveHref(pushes.at(-1)), config).routes.at(-1);
    assert.equal(creditsRoute.name, 'settings/credits');
    assert.equal(creditsRoute.params.photo, 'dragons-back');
    params = creditsRoute.params;
    const credits = screens.credits();
    const record = credits.props.sections[0];
    assert.equal(record.id, 'dragons-back');
    assert.match(record.paragraphs.join(' '), /Bjørn Christian Tørrissen.*CC BY-SA 4\.0.*720 × 480/);
    assert.deepEqual(record.links.map(({ url }) => url), [
      'https://commons.wikimedia.org/wiki/File:Dragons-Back-Northwards.jpg',
      'https://creativecommons.org/licenses/by-sa/4.0/',
    ]);
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
  const temporary = mkdtempSync(join(tmpdir(), 'kongdaily-compliance-'));
  const review = join(temporary, 'review');
  try {
    const blocked = join(temporary, 'must-not-write');
    assert.equal(releaseIssues({}).length, 9);
    assert.throws(() => buildSite(blocked, {}), /Publication blocked/);
    assert.throws(() => buildSite(blocked, null), /Publication blocked/);
    assert.equal(existsSync(blocked), false);
    const paths = ['index.html', 'privacy/index.html', 'support/index.html', 'en/index.html',
      'en/privacy/index.html', 'en/support/index.html'];
    buildSite(review);
    for (const path of paths) {
      const language = path.startsWith('en/') ? 'en' : 'zh-HK';
      const page = path.includes('privacy') ? 'privacy' : path.includes('support') ? 'support' : 'home';
      const file = join(review, path);
      const html = readFileSync(file, 'utf8');
      const document = content.locales[language][page];
      assert.ok(html.includes(`<html lang="${language}">`));
      assert.ok(html.includes('noindex, nofollow'));
      assert.ok(html.includes(`<h1>${escape(document.title)}</h1>`));
      assert.ok(html.includes(`<title>${escape(document.title)} · ${brand}</title>`));
      assert.match(html, /<a class="brand"[^>]*>KongDaily by Lenny Studio<\/a>/);
      assert.match(html, /<footer[^>]*>\s*<p[^>]*>KongDaily by Lenny Studio<\/p>/);
      assert.ok(html.includes(`<p>${escape(document.intro)}</p>`));
      assert.ok(html.includes(`datetime="${content.reviewedOn}"`));
      const alternate = language === 'en' ? 'zh-HK' : 'en';
      const [, switchHref] = html.match(/class="language" href="([^"]+)" lang="[^"]+" hreflang="(?:en|zh-HK)"/);
      const pageDirectory = page === 'home' ? '' : page;
      assert.equal(resolve(dirname(file), switchHref), resolve(review, alternate === 'en' ? 'en' : '.', pageDirectory));
      assert.doesNotMatch(html, /<script\b|<form\b|<iframe\b|class="operator"|\{operatorName\}/i);
      assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
      if (page === 'privacy') assert.ok(html.includes(operatorSentences[language]));
      const mailLinks = [...html.matchAll(/href="(mailto:[^"]+)"/g)].map((match) => match[1]);
      assert.deepEqual(mailLinks, page === 'home' ? [] : [contactHref]);
      for (const { id, title, paragraphs, links } of document.sections ?? []) {
        const start = html.indexOf(`<section aria-labelledby="${id}">`);
        assert.ok(start >= 0);
        const section = html.slice(start, html.indexOf('</section>', start));
        assert.ok(section.includes(`<h2 id="${id}">${escape(title)}</h2>`));
        for (const paragraph of paragraphs) assert.ok(section.includes(`<p>${escape(paragraph)}</p>`));
        for (const { label, url } of links ?? []) assert.ok(section.includes(`<a href="${escape(url)}">${escape(label)}</a>`));
        assert.equal(section.includes(`href="${contactHref}"`), id === document.contactSection);
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
      effectiveOn: '2026-11-21', updatedOn: '2026-11-22',
      siteAndSupportPrivacy: { 'zh-HK': '測試網站與支援文字', en: 'Site & support fixture' },
      retentionDisclosure: { 'zh-HK': '測試保留文字', en: 'Retention fixture' },
    };
    const approvedCopy = { ...content, publication };
    assert.deepEqual(releaseIssues(fixture, approvedCopy), []);
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
    const release = join(temporary, 'release');
    buildSite(release, fixture, approvedCopy);
    const releasedPrivacy = readFileSync(join(release, 'en/privacy/index.html'), 'utf8');
    assert.doesNotMatch(releasedPrivacy, /noindex|Review draft|Test fixture only|rel="canonical"|\{operatorName\}/);
    assert.ok(releasedPrivacy.includes(operatorSentences.en));
    assert.match(releasedPrivacy, /<p>Lenny<\/p>/);
    assert.match(releasedPrivacy, /Site &amp; support fixture/);
    assert.match(releasedPrivacy, /Retention fixture/);
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
        for (const { paragraphs } of doc.props.sections) {
          for (const paragraph of paragraphs) assert.ok(html.includes(`<p>${escape(paragraph)}</p>`));
        }
      }
    } finally {
      delete stubs['../content/compliance-policy'];
      cache.clear();
    }
    const live = { ...fixture, origin: 'https://release-fixture.iana.org' };
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
    const expected = routes.map((route) => `${live.origin}/${route}`);
    const readResponse = (output) => async (url, options) => {
      assert.ok(expected.includes(url));
      assert.equal(options.redirect, 'manual');
      return new Response(readFileSync(join(output, new URL(url).pathname, 'index.html'), 'utf8'),
        { headers: { 'content-type': 'text/html; charset=utf-8' } });
    };
    await assert.rejects(verifyPublishedWebsite(fixture, () => assert.fail('No request without an origin')), /actual deployed HTTPS origin/);
    assert.deepEqual(await verifyPublishedWebsite(live, readResponse(release), approvedCopy), expected);
    assert.deepEqual(await verifyPublishedWebsite(live, readResponse(canonicalOutput), approvedCopy), expected);
    await assert.rejects(verifyPublishedWebsite(live, async () => new Response(null, { status: 302 }), approvedCopy), /public HTTP 200 HTML/);
    await assert.rejects(verifyPublishedWebsite(live, readResponse(review), approvedCopy), /differs from the approved release/);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

checkApp().then(checkWebsite).then(() => {
  console.log('PASS: bilingual navigation and documents, Dragon’s Back attribution and failure handling, six static pages and publication gate.');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
