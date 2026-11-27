const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const { getRoutes } = require('expo-router/build/getRoutes');
const { getReactNavigationConfig } = require('expo-router/build/getReactNavigationConfig');
const { resolveHref } = require('expo-router/build/link/href');
const { getStateFromPath } = require('expo-router/build/react-navigation/core/getStateFromPath');
const { getActionFromState } = require('expo-router/build/react-navigation/core/getActionFromState');
const { StackRouter } = require('expo-router/build/react-navigation/routers/StackRouter');

const root = join(__dirname, '..');
const bundle = require('../assets/data/explore-places.json');
const dragon = 'dragons-back-to-tei-wan-tai-tam-gap';
const peak = 'peak-circle-walk';
const approvedUrls = new Map([
  [dragon, 'https://maps.apple.com/directions?destination=22.2270299568,114.2397903557&mode=walking'],
  [peak, 'https://maps.apple.com/directions?destination=22.2712927825,114.1494947398&mode=walking'],
]);
const approvedCopy = {
  'zh-HK': ['步道起點', '步行至起點', 'Apple 地圖僅導航至起點，非完整行山路線。'],
  en: ['Trailhead', 'Walk to trailhead', 'Apple Maps guides you to the trailhead, not along the full hike.'],
};

const native = {
  View: 'View', Pressable: 'Pressable', Image: 'Image',
  Platform: { OS: 'ios', Version: '18.4' },
  StyleSheet: { create: (styles) => styles, absoluteFill: {}, hairlineWidth: 1 },
  useWindowDimensions: () => ({ width: 390, fontScale: 1 }),
  Linking: {},
  Alert: {},
};
let locale = 'zh-HK';
let params = {};
const navigation = [];
const router = Object.fromEntries(['navigate', 'push', 'dismissTo'].map((method) =>
  [method, (href) => navigation.push({ method, href })]));
const modules = {
  'react/jsx-runtime': require('react/jsx-runtime'),
  react: { useMemo: (fn) => fn(), useRef: (current) => ({ current }), useCallback: (fn) => fn, useEffect() {} },
  'react-native': native,
  'expo-router': { Stack: { Screen: 'StackScreen' }, useFocusEffect() {},
    useLocalSearchParams: () => params, useRouter: () => router },
  'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
  '@/components/ui': { AppText: 'AppText', EmptyState: 'EmptyState', Icon: 'Icon', PageHeading: 'PageHeading', Screen: 'Screen' },
  '@/components/bus-ui': { BusAction: 'BusAction' },
  '@/components/saved-bus-ui': { HomeFavoriteBus: 'HomeFavoriteBus' },
  '@/components/weather-warning-ui': { WeatherWarningLink: 'WeatherWarningLink' },
  '@/bus-favorite-hooks': {
    useBusFavorites: () => ({ items: [], status: 'ready' }), useUnavailableFavorites: () => new Set(),
  },
  '@/components/home-favorite-gmb': { HomeFavoriteGmb: 'HomeFavoriteGmb' },
  '@/gmb-favorites': { useGmbFavorites: () => ({ items: [], status: 'ready' }) },
  '@/components/home-favorite-railway': { HomeFavoriteRailway: 'HomeFavoriteRailway' },
  '@/railway-favorite-hooks': { useRailwayFavorites: () => ({ items: [], status: 'ready' }) },
  '@/home-transport-pins': { useHomePins: () => ({ pins: [], status: 'ready' }) },
  '@/home-eta-refresh': { useHomeEtaRefresh: () => ({ refreshing: false }) },
  '@/weather': {},
  '@/weather-hooks': {},
  '../assets/data/explore-places.json': bundle,
  '../assets/explore/photos/attribution.json': require('../assets/explore/photos/attribution.json'),
};

// Run the shipped components and press handlers with native services stubbed and no network.
function load(file) {
  const { outputText } = ts.transpileModule(readFileSync(join(root, 'src', file), 'utf8'), {
    fileName: file,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const exports = {};
  runInNewContext(outputText, { exports, URL, require(id) {
    if (id.endsWith('.jpg')) return id;
    assert.ok(Object.hasOwn(modules, id), 'Unexpected runtime dependency: ' + id);
    return modules[id];
  } }, { filename: file });
  return exports;
}

function elements(node) {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node?.props) return [];
  return [node, ...elements(node.props.children)];
}

const { messages } = load('i18n.ts');
modules['@/language'] = { useLanguage: () => ({ copy: messages[locale], locale }) };
modules['@/theme'] = load('theme.ts');
const placeModule = modules['@/explore-places'] = load('explore-places.ts');
const { getExplorePhoto } = modules['@/explore-place-images'] = load('explore-place-images.ts');
const { ExplorePlacePhoto } = modules['@/components/explore-artwork'] = load('components/explore-artwork.tsx');
modules['@/explore-sources'] = load('explore-sources.ts');
const homeUi = modules['@/components/home-ui'] = load('components/home-ui.tsx');
const home = load('app/(tabs)/index.tsx').default;
const explore = load('app/(tabs)/explore.tsx').default;
const detail = load('app/explore/place/[id].tsx').default;
const { getExplorePlace, getExploreTrailhead } = placeModule;

const appFiles = readdirSync(join(root, 'src/app'), { recursive: true }).filter((file) => file.endsWith('.tsx'));
const context = Object.assign(() => ({ default() {} }), { keys: () => appFiles.map((file) => './' + file) });
// Adapt the generated Expo config for the pure React Navigation parser.
const routeConfig = JSON.parse(JSON.stringify(getReactNavigationConfig(getRoutes(context)), (key, value) =>
  key === '_route' ? undefined : key === 'path' && value === '(tabs)' ? '' : value));
const stack = StackRouter({ initialRouteName: '(tabs)' });
const stackOptions = { routeNames: Object.keys(routeConfig.screens), routeParamList: {}, routeGetIdList: {} };
const stateFor = (href) => getStateFromPath(resolveHref(href), routeConfig);
const tabStack = (href) => stack.getRehydratedState(stateFor(href), stackOptions);
const trailheadFrom = (tree) => tree.find(({ type }) => type.name === 'TrailheadDirections');
const tick = () => new Promise((resolve) => setImmediate(resolve));

function showDetailFrom(origin, action, type, id) {
  const opened = stack.getStateForAction(origin, {
    ...getActionFromState(stateFor(action.href), routeConfig), type,
  }, stackOptions);
  assert.equal(opened.routes.at(-1).name, 'explore/place/[id]');
  params = opened.routes.at(-1).params;
  assert.equal(params.id, id);
  const tree = elements(detail());
  assert.equal(tree.find(({ type }) => type === 'StackScreen').props.options.headerLeft({ canGoBack: true }), null);
  const popped = stack.getStateForAction(opened, { type: 'GO_BACK' }, stackOptions);
  assert.equal(popped.routes[0], origin.routes[0], 'The underlying Tab and params must survive pop');
  return tree;
}

async function main() {
  for (const place of bundle.places) assert.equal(getExploreTrailhead(place)?.url, approvedUrls.get(place.id));
  const trail = getExplorePlace(dragon);
  const { destination } = trail.navigation;
  for (const coordinate of [
    { ...destination.coordinate, latitude: NaN }, { ...destination.coordinate, longitude: 842762.88 },
    { ...destination.coordinate, latitude: 114.2397903557, longitude: 22.2270299568 },
    { ...destination.coordinate, crs: 'HK1980' },
  ]) {
    assert.equal(getExploreTrailhead({ ...trail, navigation: { status: 'verified',
      destination: { ...destination, coordinate } } }), undefined);
  }
  assert.equal(getExploreTrailhead({ ...trail, id: 'third-place' }), undefined);
  assert.equal(getExploreTrailhead({ ...trail, navigation: { status: 'verified',
    destination: { ...destination, role: 'venue-entrance' } } }), undefined);
  assert.equal(getExploreTrailhead(getExplorePlace('unknown-id')), undefined);

  for (locale of Object.keys(approvedCopy)) {
    const [label, action, hint] = approvedCopy[locale];
    params = {};
    const allCards = elements(explore()).filter(({ type }) => type.name === 'PlaceCard');
    assert.equal(allCards.length, bundle.places.length);
    for (const place of bundle.places) {
      params = { id: place.id };
      const tree = elements(detail());
      const banner = tree.find(({ type }) => type === ExplorePlacePhoto);
      const card = allCards.find(({ props }) => props.place.id === place.id);
      const renderedCard = card.type(card.props);
      const cardElements = elements(renderedCard);
      const tile = cardElements.find(({ type }) => type === ExplorePlacePhoto);
      assert.equal(tile.props.placeId, place.id);
      assert.equal(banner.props.placeId, place.id);
      const asset = getExplorePhoto(place.id);
      const tileView = tile.type(tile.props);
      const bannerView = banner.type(banner.props);
      const creditLine = asset?.creditLine?.[locale];
      if (creditLine) {
        assert.ok(cardElements.some(({ props }) => props.children === creditLine));
        assert.ok(renderedCard.props.accessibilityLabel.includes(creditLine));
      }
      if (asset) {
        const tileImage = elements(tileView).find(({ type }) => type === 'Image');
        const bannerImage = elements(bannerView).find(({ type }) => type === 'Image');
        assert.equal(tileImage.props.source, asset.source);
        assert.equal(bannerImage.props.source, asset.source);
        assert.equal(tileImage.props.accessible, false);
        assert.equal(bannerImage.props.accessibilityLabel, asset.description[locale]);
        assert.equal(bannerImage.props.resizeMode, 'cover');
      } else {
        assert.equal(tileView, null);
        assert.equal(bannerView, null);
      }
      for (const key of ['title', 'summary', 'transport', 'cautions']) {
        assert.ok(tree.some(({ props }) => props.children === place[key][locale] || props.body === place[key][locale]),
          place.id + ' is missing offline ' + key);
      }
      const section = trailheadFrom(tree);
      if (!approvedUrls.has(place.id)) {
        assert.equal(section, undefined);
        continue;
      }
      assert.ok(tree.indexOf(section) > tree.findIndex(({ type }) => type.name === 'OfficialSources'));
      const name = place.navigation.destination.name[locale];
      const rendered = elements(section.type(section.props));
      const heading = rendered.find(({ props }) => props.accessibilityRole === 'header');
      const [inlineLabel, destinationName] = heading.props.children;
      assert.equal(inlineLabel.props.children, label + ' · ');
      assert.equal(destinationName, name);
      assert.equal(heading.props.numberOfLines, undefined, 'The combined heading must be allowed to wrap');
      for (const text of [action, hint]) assert.ok(rendered.some(({ props }) => props.children === text));
      const button = rendered.find(({ type }) => type === 'Pressable');
      assert.equal(button.props.accessibilityRole, 'button');
      assert.equal(button.props.accessibilityLabel, action + ' · ' + name);
      assert.equal(button.props.accessibilityHint, hint);
      assert.ok(button.props.style({ pressed: false })[0].minHeight >= 44);

      const opened = [];
      let pendingReject;
      let alert;
      native.Linking.openURL = (url) => {
        opened.push(url);
        return opened.length === 1 ? new Promise((_, reject) => { pendingReject = reject; }) : Promise.resolve();
      };
      native.Alert.alert = (...args) => { alert = args; };
      const beforePress = navigation.length;
      button.props.onPress();
      button.props.onPress();
      assert.deepEqual(opened, [approvedUrls.get(place.id)], 'Rapid taps must share the pending open');
      pendingReject(new Error('Apple Maps handoff failed'));
      await tick();
      assert.equal(alert[0], messages[locale].explore.trailhead.openFailed);
      assert.equal(alert[1], messages[locale].explore.linkFailedDetail);
      assert.equal(alert[2][0].text, messages[locale].explore.cancel);
      assert.equal(alert[2][1].text, messages[locale].explore.retryLink);
      alert[2][1].onPress();
      await tick();
      assert.deepEqual(opened, [approvedUrls.get(place.id), approvedUrls.get(place.id)]);
      assert.equal(navigation.length, beforePress, 'External handoff and retry must not change the internal route');
    }

    params = { id: 'unknown-id' };
    const unavailable = elements(detail());
    assert.ok(unavailable.some(({ type, props }) => type === 'EmptyState' && props.title === messages[locale].explore.placeUnavailable));
    assert.equal(trailheadFrom(unavailable), undefined);
    unavailable.find(({ type }) => type === 'Pressable').props.onPress();
    assert.equal(navigation.at(-1).href, '/explore');

    const homeCard = elements(home()).find(({ type, props }) =>
      type === homeUi.FeaturedCard && props.href.params.id === dragon);
    assert.equal(homeCard.props.source, getExplorePhoto(dragon).source, 'Home must use the current Dragon’s Back photo');
    const homeLink = homeUi.FeaturedCard(homeCard.props);
    homeUi.HomeLink(homeLink.props).props.onPress();
    assert.equal(navigation.at(-1).method, 'navigate');
    assert.ok(trailheadFrom(showDetailFrom(tabStack('/'), navigation.at(-1), 'NAVIGATE', dragon)));

    const filtered = tabStack('/explore?category=hiking');
    params = filtered.routes[0].state.routes.at(-1).params;
    assert.equal(params.category, 'hiking');
    const cards = elements(explore()).filter(({ type }) => type.name === 'PlaceCard');
    assert.equal(cards.length, 2);
    cards[1].type(cards[1].props).props.onPress();
    assert.equal(navigation.at(-1).method, 'push');
    assert.ok(trailheadFrom(showDetailFrom(filtered, navigation.at(-1), 'PUSH', peak)));

    for (const [os, version, supported] of [
      ['ios', '18.3.2', false], ['ios', '18.4', true], ['ios', '18.10', true], ['ios', '26.0', true], ['web', '26.0', false],
    ]) {
      Object.assign(native.Platform, { OS: os, Version: version });
      params = { id: dragon };
      assert.equal(Boolean(trailheadFrom(elements(detail()))), supported);
    }
    Object.assign(native.Platform, { OS: 'ios', Version: '18.4' });
    console.log('PASS · ' + locale + ' trailhead UI, offline details, eligibility, Apple Maps retry, Home and Explore return');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
