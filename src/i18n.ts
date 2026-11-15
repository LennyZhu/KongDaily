export const languagePreferences = ['system', 'zh-HK', 'en'] as const;
export type LanguagePreference = (typeof languagePreferences)[number];

const zhHK = {
  tabs: { home: '首頁', nearby: '附近', explore: '探索', saved: '收藏' },
  home: {
    name: '港日常 · KongDaily',
    subtitle: '香港生活與城市探索',
    search: '搜尋巴士、地點、設施或地區',
    busSearch: '搜尋巴士路線或車站',
    weatherLocation: '香港',
    weatherStatus: '待接入',
    weatherEmpty: '暫未有天氣資料',
    weatherDetail: '接入香港天文台資料後顯示',
    buses: '常用巴士',
    viewAll: '查看全部',
    busEmpty: '還沒有常用巴士',
    busDetail: '收藏常用的巴士路線或車站，快速查看 ETA。',
    addBus: '新增常用巴士',
    shortcuts: '生活快捷入口',
    quickLinks: { bus: '巴士查詢', toilets: '公廁', pets: '寵物公園', parks: '公園', hiking: '行山郊遊', waterfront: '海濱景點' },
    nearby: '附近生活設施',
    openMap: '開啟地圖',
    nearbyTitle: '尋找附近的公廁與公園',
    nearbyDetail: '按所在地區或目前位置查看設施',
    featured: '精選探索',
    browseExplore: '瀏覽更多',
    places: {
      dragon: { title: '龍脊', detail: '山脊步道 · 俯瞰港島東岸' },
      westKowloon: { title: '西九文化區', detail: '海濱散步 · 文化與藝術' },
    },
  },
  nearby: {
    intro: '按類別查看香港公共設施。',
    categories: { all: '全部', toilets: '公廁', parks: '休憩用地', transport: '公共交通' },
    map: '地圖尚未提供',
    empty: '暫未有設施資料',
  },
  explore: {
    intro: '按類別探索香港。',
    categories: { parks: '公園休憩', hiking: '行山郊遊', waterfront: '海濱景點', pets: '寵物友善' },
    empty: '暫無探索地點',
    categoryEmpty: '這個分類暫無地點。',
  },
  saved: {
    categories: { all: '全部', buses: '巴士', places: '地點' },
    empty: {
      all: '暫無收藏',
      buses: '暫無收藏的巴士',
      places: '暫無收藏的地點',
    },
  },
  search: {
    title: '搜尋',
    empty: '搜尋資料尚未提供',
  },
  settings: {
    title: '設定',
    language: 'App 語言',
    options: { system: '跟隨系統', 'zh-HK': '繁體中文（香港）', en: 'English' },
    saveError: '未能儲存語言設定，請再試一次。',
    loadError: '未能載入設定',
    retry: '重試',
    loading: '正在載入設定',
  },
};

const en: typeof zhHK = {
  tabs: { home: 'Home', nearby: 'Nearby', explore: 'Explore', saved: 'Saved' },
  home: {
    name: 'KongDaily',
    subtitle: 'Hong Kong life & city exploration',
    search: 'Search buses, places, facilities or areas',
    busSearch: 'Search bus routes or stops',
    weatherLocation: 'Hong Kong',
    weatherStatus: 'Pending',
    weatherEmpty: 'Weather unavailable',
    weatherDetail: 'Shown when Hong Kong Observatory data is connected',
    buses: 'Frequent buses',
    viewAll: 'View all',
    busEmpty: 'No frequent buses yet',
    busDetail: 'Save bus routes or stops for quick access to arrival times.',
    addBus: 'Add a frequent bus',
    shortcuts: 'Quick links',
    quickLinks: { bus: 'Bus search', toilets: 'Public toilets', pets: 'Dog parks', parks: 'Parks', hiking: 'Hiking', waterfront: 'Waterfront' },
    nearby: 'Nearby facilities',
    openMap: 'Open map',
    nearbyTitle: 'Find nearby toilets and parks',
    nearbyDetail: 'Browse facilities by area or current location',
    featured: 'Featured places',
    browseExplore: 'Browse more',
    places: {
      dragon: { title: 'Dragon’s Back', detail: 'Ridge walk · Island views' },
      westKowloon: { title: 'West Kowloon Cultural District', detail: 'Waterfront walks · Arts & culture' },
    },
  },
  nearby: {
    intro: 'Browse Hong Kong’s public facilities by category.',
    categories: { all: 'All', toilets: 'Toilets', parks: 'Open spaces', transport: 'Public transport' },
    map: 'Map unavailable',
    empty: 'Facility data is unavailable',
  },
  explore: {
    intro: 'Explore Hong Kong by category.',
    categories: { parks: 'Parks & leisure', hiking: 'Hiking & outdoors', waterfront: 'Waterfront spots', pets: 'Pet-friendly' },
    empty: 'No places to explore yet',
    categoryEmpty: 'This category has no places yet.',
  },
  saved: {
    categories: { all: 'All', buses: 'Buses', places: 'Places' },
    empty: {
      all: 'Nothing saved yet',
      buses: 'No saved buses yet',
      places: 'No saved places yet',
    },
  },
  search: {
    title: 'Search',
    empty: 'Search data is unavailable',
  },
  settings: {
    title: 'Settings',
    language: 'App language',
    options: { system: 'Follow system', 'zh-HK': '繁體中文（香港）', en: 'English' },
    saveError: 'Couldn’t save your language. Try again.',
    loadError: 'Couldn’t load settings',
    retry: 'Try again',
    loading: 'Loading settings',
  },
};

export const messages = { 'zh-HK': zhHK, en };
export type Messages = typeof zhHK;
