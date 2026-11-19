const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { createRequire } = require('node:module');
const { join, resolve } = require('node:path');
const ts = require('typescript');

const src = join(__dirname, '../src');
const routerRequire = createRequire(require.resolve('expo-router/package.json'));
const appDir = join(src, 'app');

function load(code, requireModule) {
  const mod = { exports: {} };
  new Function('exports', 'require', 'module', code)(mod.exports, requireModule, mod);
  return mod.exports;
}

function loadApp(file, requireModule = require) {
  const { outputText } = ts.transpileModule(readFileSync(join(src, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  return load(outputText, requireModule);
}

const nativeIntent = loadApp('app/+native-intent.tsx');
const { readEtaTarget } = loadApp('bus-eta.ts', (id) => {
  // The ETA identity reader is pure. This test has no bus network or SQLite.
  assert.ok(['@/bus-data', '@/bus-routes'].includes(id), id);
  return {};
});
const nativeNavigation = {
  ...routerRequire('./build/react-navigation/core/validatePathConfig'),
  ...routerRequire('./build/react-navigation/core/getActionFromState'),
};
const nativeModules = new Map([
  ['react-native', { Platform: { OS: 'ios' } }],
  ['expo-modules-core', { Platform: { OS: 'ios' } }],
]);

let receiveURL;
nativeModules.set('expo-linking', {
  addEventListener(event, callback) {
    assert.equal(event, 'url');
    receiveURL = callback;
    return { remove() { receiveURL = undefined; } };
  },
});

// Run the installed Expo routing code with only the native event boundary stubbed.
const routerPaths = new Set([
  'getLinkingConfig', 'link/linking', 'getRoutesRedirects',
  'fork/getStateFromPath', 'fork/getPathFromState', 'fork/getPathFromState-forks',
]);
const loadedModules = new Map();
function routerModule(path) {
  if (loadedModules.has(path)) return loadedModules.get(path);
  const file = routerRequire.resolve(`./build/${path}`);
  const localRequire = createRequire(file);
  const exports = load(readFileSync(file, 'utf8'), (id) => {
    if (nativeModules.has(id)) return nativeModules.get(id);
    if (/(^|\/)react-navigation\/native$/.test(id)) return nativeNavigation;
    if (id === '../fork/useLinking') return {};
    if (id.startsWith('.')) {
      const relative = resolve(file, '..', id).split('/expo-router/build/').at(-1);
      if (routerPaths.has(relative)) return routerModule(relative);
    }
    return localRequire(id);
  });
  loadedModules.set(path, exports);
  return exports;
}

const context = Object.assign((key) =>
  key === './+native-intent.tsx' ? nativeIntent : { default() {} }, {
  keys: () => readdirSync(appDir, { recursive: true })
    .filter((file) => file.endsWith('.tsx')).map((file) => './' + file),
});
const routes = routerRequire('./build/getRoutes').getRoutes(context);
const linkingFor = (url) => routerModule('getLinkingConfig')
  .getLinkingConfig(routes, context, () => ({ segments: [] }), { serverUrl: url });
const { findFocusedRoute } = routerRequire('./build/fork/findFocusedRoute');
const scheme = 'kongdaily:///';
const stop = 'bus/eta?source=kmbLwb&number=268X&direction=inbound&serviceType=1&stopId=5A6B7C8D9E0F1234&stopSeq=2';
const normalURL = scheme + stop;
const localeURL = scheme + 'search?q=' + encodeURIComponent('香港 Hong Kong') + '&filter=stop&filter=park';
const repeatedURL = scheme + 'search?q=%252F&literal=%25';
const malformedURLs = ['%', '%ZZ', '%E0%A4'].map((query) => scheme + 'search?q=' + query);
const base = scheme + 'search?q=';
const atLimitURL = base + 'a'.repeat(8192 - base.length);
const overLimitURL = atLimitURL + 'a';
const unknownURL = scheme + 'missing-release-test-screen';

for (const url of [normalURL, localeURL, repeatedURL, unknownURL, atLimitURL]) {
  assert.equal(linkingFor(url).getInitialURL(), url);
}
for (const url of [...malformedURLs, overLimitURL]) {
  assert.equal(linkingFor(url).getInitialURL(), null);
}

const linking = linkingFor(normalURL);
const { extractExpoPathFromURL } = routerRequire('./build/fork/extractPathFromURL');
const routeFor = (url) => findFocusedRoute(linking.getStateFromPath(extractExpoPathFromURL(linking.prefixes, url), linking.config));
const eta = routeFor(normalURL);
assert.equal(eta.name, 'bus/eta');
assert.deepEqual(readEtaTarget(eta.params), {
  source: 'kmbLwb', number: '268X', stopId: '5A6B7C8D9E0F1234',
  stopSeq: 2, direction: 'inbound', serviceType: '1',
});
assert.equal(readEtaTarget(routeFor(normalURL + '&direction=outbound').params), undefined);
assert.equal(readEtaTarget(routeFor(normalURL.replace('stopSeq=2', 'stopSeq=0')).params), undefined);
assert.equal(readEtaTarget(routeFor(normalURL.replace('source=kmbLwb', 'source=unknown')).params), undefined);
assert.equal(routeFor(localeURL).params.q, '香港 Hong Kong');
assert.deepEqual(routeFor(localeURL).params.filter, ['stop', 'park']);
assert.equal(routeFor(unknownURL).name, '+not-found');

// Exercise the fixed decoder via its installed CommonJS consumer as well.
const queryEntry = routerRequire.resolve('query-string');
const queryRequire = createRequire(queryEntry);
const decoder = queryRequire('decode-uri-component');
assert.equal(typeof decoder.default, 'function');
const queryString = routerRequire('query-string');
assert.equal(queryString.parse('q=' + encodeURIComponent('香港 & Hong Kong')).q, '香港 & Hong Kong');
assert.deepEqual({ ...queryString.parse(new URL(repeatedURL).search) }, { q: '%2F', literal: '%' });
for (const malformed of ['%', '%ZZ']) {
  assert.equal(queryString.parse('q=' + malformed).q, malformed);
}

async function verifyForeground() {
  const received = [];
  const dispose = linking.subscribe((url) => received.push(url));
  for (const url of [normalURL, ...malformedURLs, overLimitURL, repeatedURL]) await receiveURL({ url });
  assert.deepEqual(received, [normalURL, repeatedURL]);
  dispose();
  assert.equal(receiveURL, undefined);
}
verifyForeground().then(() => {
  console.log('Native link security passed: cold and foreground inputs, routing, ETA identity and installed decoder.');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
