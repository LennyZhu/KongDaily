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

const content = require('../content/compliance.json');
const { buildSite, releaseIssues } = require('../website/build.cjs');
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
        assert.ok(view.some(({ props }) => props.children === content.locales[locale].reviewStatus));
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

function checkWebsite() {
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
    assert.equal(releaseIssues({}).length, 10);
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
      assert.ok(html.includes(`<html lang="${language}">`));
      assert.ok(html.includes('noindex, nofollow'));
      assert.match(html, /<h1>[^<]+<\/h1>/);
      assert.ok(html.includes(`datetime="${content.reviewedOn}"`));
      assert.match(html, /hreflang="(en|zh-HK)"/);
      assert.doesNotMatch(html, /mailto:|<script\b|<form\b|<iframe\b/i);
      for (const { id } of content.locales[language][page].sections ?? []) assert.ok(html.includes(`id="${id}"`));
      for (const [, href] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
        if (href.startsWith('#')) assert.ok(html.includes(`id="${href.slice(1)}"`));
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
    assert.ok(releaseIssues({ origin: 'http://localhost:4173', effectiveOn: '2026-02-30' }).length >= 2);

    // Synthetic values exercise rendering only in this temporary directory. No requests are made.
    const fixture = {
      origin: 'https://release-fixture.iana.org',
      operator: { 'zh-HK': '測試營運者', en: 'Operator fixture' },
      privacyEmail: 'privacy@release-fixture.iana.org',
      supportEmail: 'support@release-fixture.iana.org',
      effectiveOn: '2026-11-19', updatedOn: '2026-11-19',
      siteAndSupportPrivacy: { 'zh-HK': '測試網站與支援文字', en: 'Site & support fixture' },
      approvalReference: 'Test fixture only',
    };
    assert.deepEqual(releaseIssues(fixture), []);
    const release = join(temporary, 'release');
    buildSite(release, fixture);
    const releasedPrivacy = readFileSync(join(release, 'en/privacy/index.html'), 'utf8');
    assert.doesNotMatch(releasedPrivacy, /noindex|Review draft|Test fixture only/);
    assert.match(releasedPrivacy, /Site &amp; support fixture/);
    assert.ok(releasedPrivacy.includes(`href="mailto:${fixture.privacyEmail}"`));
    assert.ok(releasedPrivacy.includes(`rel="canonical" href="${fixture.origin}/en/privacy/"`));
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

checkApp().then(() => {
  checkWebsite();
  console.log('PASS: bilingual navigation and documents, Dragon’s Back attribution and failure handling, six static pages and publication gate.');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
