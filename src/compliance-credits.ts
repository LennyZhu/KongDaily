import type { ComplianceLocale, ComplianceSection } from './compliance-content';
import { getExplorePlace, homeFeaturedPlaceIds } from './explore-places';
import photoCredits from '../assets/explore/photos/attribution.json';

const text = (zh: string, en: string) => ({ 'zh-HK': zh, en });
const source = (url: string, zh: string, en = zh) => ({ url, label: text(zh, en) });

const explorePhotoCredits = Object.entries(photoCredits).map(([id, credit]) => {
  const place = getExplorePlace(id);
  const dimensions = credit.processing.pixels.join(' × ');
  const crop = credit.processing.cropPixels;
  const catalogueTitle = place?.title ?? text(credit.title, credit.title);
  const attribution = 'creditLine' in credit ? credit.creditLine : text(credit.author, credit.author);
  return {
    id,
    title: text(`${catalogueTitle['zh-HK']} · 照片`, `${catalogueTitle.en} · Photo`),
    paragraphs: [
      text(`《${credit.title}》由 ${attribution['zh-HK']} 拍攝。授權：${credit.license}。`,
        `“${credit.title}” by ${attribution.en}. Licence: ${credit.license}.`),
      'summary' in credit.processing ? credit.processing.summary : crop
        ? text(`隨 App 提供的照片取原圖上方的山脊，縮放至 ${dimensions} 並重新壓縮。首頁卡片另加漸層。`,
          `The bundled photo is cropped to the upper ridgeline, resized to ${dimensions} and recompressed. The Home card adds a gradient.`)
        : text(`隨 App 提供 ${dimensions} 的 JPEG 版本，已重新壓縮。列表和詳情按版框裁切顯示。`,
          `The bundled ${dimensions} JPEG was recompressed. The list and detail views crop the display to fit their frames.`),
      ...('notice' in credit ? [credit.notice] : []),
    ],
    links: [
      source(credit.sourcePage, '原作與攝影者', 'Original work and photographer'),
      source(credit.licenseUrl, '授權及使用條款', 'Licence and usage terms'),
      ...('independentOriginalUrl' in credit ? [source(credit.independentOriginalUrl, '下載 Commons 原圖', 'Download original from Commons')] : []),
      ...('originalPublication' in credit ? [source(credit.originalPublication, '原始發佈頁', 'Original publication')] : []),
    ],
  };
});

const sourceGroups = [
  {
    id: 'bus',
    title: text('巴士路線、站點及到站時間', 'Bus routes, stops and arrivals'),
    paragraphs: [
      text('路線、站點及到站資料來自九巴／龍運、城巴及新大嶼山巴士的官方資料服務。離線站點與站序索引由相關官方資料整理。資料權利屬香港特別行政區政府及相關營辦商。',
        'Route, stop and arrival information comes from the official KMB and Long Win, Citybus, and New Lantao Bus feeds. The offline stop and route–stop indexes are derived from these sources. Rights belong to the Hong Kong SAR Government and the relevant operators.'),
    ],
    links: [
      source('https://data.gov.hk/en-data/dataset/hk-td-tis_21-etakmb', '九巴及龍運 · DATA.GOV.HK', 'KMB and Long Win · DATA.GOV.HK'),
      source('https://data.gov.hk/en-data/dataset/ctb-eta-transport-realtime-eta', '城巴 · DATA.GOV.HK', 'Citybus · DATA.GOV.HK'),
      source('https://data.gov.hk/en-data/dataset/nlb-bus-nlb-bus-service-v2', '新大嶼山巴士 · DATA.GOV.HK', 'New Lantao Bus · DATA.GOV.HK'),
    ],
  },
  {
    id: 'weather',
    title: text('天氣、預報及警告', 'Weather, forecasts and warnings'),
    paragraphs: [
      text('觀測、九天預報、警告摘要及詳細警告來自香港特別行政區政府香港天文台的開放數據。請查閱天文台的最新消息。',
        'Observations, nine-day forecasts, warning summaries and warning details come from Hong Kong Observatory open data. The Observatory is part of the Hong Kong SAR Government. Check its notices for the latest information.'),
    ],
    links: [
      source('https://www.hko.gov.hk/en/abouthko/opendata_intro.htm', '香港天文台開放數據', 'Hong Kong Observatory Open Data'),
      source('https://data.gov.hk/en-data/dataset/hk-hko-rss-current-weather-report', '最新天氣報告', 'Current weather report'),
      source('https://data.gov.hk/en-data/dataset/hk-hko-rss-9-day-weather-forecast', '九天天氣預報', 'Nine-day weather forecast'),
      source('https://data.gov.hk/en-data/dataset/hk-hko-rss-weather-warning-summary', '天氣警告摘要', 'Weather warning summary'),
      source('https://data.gov.hk/en-data/dataset/hk-hko-rss-weather-warning-information', '天氣警告詳情', 'Weather warning information'),
    ],
  },
  {
    id: 'facilities',
    title: text('公廁、公園及寵物公園', 'Toilets, parks and pet parks'),
    paragraphs: [
      text('公廁資料由食物環境衞生署經 DATA.GOV.HK 發布。郊野公園廁所由漁農自然護理署提供。公園、寵物專用公園及寵物共享公園由康樂及文化事務署提供，後四項經空間數據共享平台發放。',
        'Public toilet data is published by the Food and Environmental Hygiene Department via DATA.GOV.HK. The Agriculture, Fisheries and Conservation Department provides country park toilet data. The Leisure and Cultural Services Department provides park, dog and pet garden, and inclusive pet park data. These latter datasets are distributed via the Common Spatial Data Infrastructure Portal.'),
      text('資料的知識產權由香港特別行政區政府及相關機構擁有。版本和個別設施的服務提示可在「附近」查閱。',
        'The Hong Kong SAR Government and relevant organisations own the intellectual property rights in the data. See Nearby for snapshot dates and any notices for individual facilities.'),
    ],
    links: [
      source('https://data.gov.hk/en-data/dataset/hk-fehd-fehdlocatn-fehd-facility-and-service-locations/resource/00cb62a1-1ffc-4163-ac54-7703e5822041', '食環署設施（繁中）', 'FEHD facility data (Traditional Chinese)'),
      source('https://data.gov.hk/en-data/dataset/hk-fehd-fehdlocatn-fehd-facility-and-service-locations/resource/161df8ea-b91a-46bf-b703-817a1aadbdcb', '食環署設施（英文）', 'FEHD facility data (English)'),
      source('https://portal.csdi.gov.hk/csdi-webpage/dataset/afcd_rcd_1635136427551_29173', '漁護署郊野公園廁所', 'AFCD country park toilets'),
      source('https://www.hiking.gov.hk/news', '漁護署郊野公園設施消息', 'AFCD country park facility notices'),
      source('https://portal.csdi.gov.hk/csdi-webpage/dataset/lcsd_rcd_1629267205215_19292', '康文署公園資料', 'LCSD parks data'),
      source('https://portal.csdi.gov.hk/csdi-webpage/dataset/lcsd_rcd_1670384486075_71092', '康文署寵物專用公園', 'LCSD dog and pet gardens'),
      source('https://portal.csdi.gov.hk/csdi-webpage/dataset/lcsd_rcd_1670384557490_22821', '康文署寵物共享公園', 'LCSD inclusive parks for pets'),
      source('https://www.lcsd.gov.hk/en/facilities/otherinfo/petpark.html', '康文署寵物共享公園使用規則', 'LCSD inclusive pet park rules'),
    ],
  },
  {
    id: 'geometry',
    title: text('巴士路線折線', 'Bus route geometry'),
    paragraphs: [
      text('路線折線由香港特別行政區政府運輸署提供，經空間數據共享平台發放。KongDaily 只顯示已核實的路線對應。資料的知識產權由政府及相關機構擁有。',
        'Route geometry comes from the Transport Department, Hong Kong SAR Government, via the Common Spatial Data Infrastructure Portal. KongDaily displays only verified matches. Intellectual property rights belong to the Government and relevant organisations.'),
    ],
    links: [source('https://portal.csdi.gov.hk/csdi-webpage/dataset/td_rcd_1638844988873_41214', '運輸署巴士路線折線來源', 'Transport Department bus route dataset')],
  },
  {
    id: 'explore',
    title: text('精選探索、地點搜尋及地圖', 'Explore, place search and maps'),
    paragraphs: [
      text('精選探索的離線文字由 KongDaily 依個別場地管理者及政府機構公開資料整理。各地點詳情列出相應官方連結。線上地點搜尋由地政總署提供。App 內地圖由 Apple MapKit 提供。',
        'KongDaily’s offline Explore guides are based on public information from venue operators and government departments. Each guide links to its relevant official sources. The Lands Department supplies online place search, and Apple MapKit supplies in-app maps.'),
    ],
    links: [source('https://data.gov.hk/en-data/dataset/hk-landsd-openmap-development-location-search-api', '地政總署地點搜尋服務', 'Lands Department Location Search API')],
  },
  {
    id: 'terms',
    title: text('開放數據使用條款', 'Open data terms'),
    paragraphs: [
      text('各資料來源適用其公布的條款。刊載機構及來源供查閱，KongDaily 為獨立 App。',
        'Each source is subject to its published terms. KongDaily is an independent app and lists providers so you can consult the original sources.'),
    ],
    links: [
      source('https://data.gov.hk/tc/terms-and-conditions', 'DATA.GOV.HK 使用條款', 'DATA.GOV.HK terms'),
      source('https://static.csdi.gov.hk/csdi-webpage/doc/TNC', '空間數據共享平台使用條款', 'CSDI Portal terms'),
    ],
  },
  ...explorePhotoCredits,
  {
    id: 'other-photos',
    title: text('首頁維港與西九照片', 'Home photos of Victoria Harbour and West Kowloon'),
    paragraphs: [
      text('維港照片由 Kevin Huynh 拍攝，來自 Pexels。西九照片由 Jeanne Rose Gomez 拍攝，來自 Unsplash。',
        'The Victoria Harbour photograph is by Kevin Huynh via Pexels. The West Kowloon photograph is by Jeanne Rose Gomez via Unsplash.'),
    ],
    links: [
      source('https://www.pexels.com/photo/hong-kong-skyline-across-victoria-harbour-34127349/', '維港照片原作', 'Victoria Harbour original'),
      source('https://www.pexels.com/license/', 'Pexels 授權', 'Pexels licence'),
      source('https://unsplash.com/photos/a-boat-is-in-the-water-with-a-city-in-the-background-f4TcefPunWg', '西九照片原作', 'West Kowloon original'),
      source('https://unsplash.com/license', 'Unsplash 授權', 'Unsplash licence'),
    ],
  },
];

export function getComplianceCredits(locale: ComplianceLocale, photo?: string | string[]): readonly ComplianceSection[] {
  const photoId = photo === 'dragons-back' ? homeFeaturedPlaceIds.dragon : photo;
  const selected = explorePhotoCredits.find(({ id }) => id === photoId);
  const groups = selected ? [selected, ...sourceGroups.filter(({ id }) => id !== selected.id)] : sourceGroups;
  return groups.map(({ id, title, paragraphs, links }) => ({
    id,
    title: title[locale],
    paragraphs: paragraphs.map((paragraph) => paragraph[locale]),
    links: links.map(({ url, label }) => ({ url, label: label[locale] })),
  }));
}
