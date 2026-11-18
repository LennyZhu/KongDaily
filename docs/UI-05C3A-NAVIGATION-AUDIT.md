# KongDaily · UI-05C3-A 導航目的地獨立核驗

核驗日期為 **2026-11-18（香港時間）**。範圍為 KongDaily 1.0 探索模組已批准的八個穩定內容 ID。Git 基線為 `develop` 的 `7eb269acfccba6fa47e7762ce6f39e85c15a962d`，開始時工作區乾淨，HEAD 與本機 `origin/develop` 追蹤參照一致。

**結論：2 個 `eligible`、6 個 `needs_more_evidence`、0 個 `not_eligible`。** 龍脊和山頂環迴步行徑可列入下一階段候選。兩處均以具名的公眾步行起點為目的地。其餘六處有合理的公眾到達位置，但尚未取得能固定所選入口的座標證據。八筆正式資料仍為 `unverified`，八個詳情頁現時均無導航入口。

## 1. 範圍與方法

1. 以正式資料、程式碼和 UI-05C1 已審閱的來源為起點。逐一比對場地管理方、地圖及交通營運商指引，確認候選位置的名稱、路線版本、步行可達性和用途。官方來源名稱相同時，仍須核對該來源描述的實際設施或旅程路段。
2. 分開判斷「入口身分」與「精確坐標」。管理方指引、入口照片、有明確起點標註的官方路線和獨立官方地圖可組成證據鏈。場地搜尋結果、古蹟點位、車站、泊車場以及平面圖中的像素只能提供位置背景。
3. 核對兩處官方 GPX 的 XML、軌跡順序、數值及坐標基準，再以地政總署地形圖和其他部門的入口資料交叉核對。GPX 1.1 使用 WGS84。HK1980 格網值分清東距 `E`、北距 `N`，比較時才轉為 WGS84。下文的經緯度依「緯度、經度」次序列出，小數位保留以重現核驗，並無對現場測量精度的保證。[GPX 1.1 規格](https://www.topografix.com/GPX/1/1/) · [地政總署地形圖 API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/TopographicMapAPI) · [地政總署格網轉換依據](https://www.geodetic.gov.hk/en/gi/refdoc.htm) · [地政總署地點搜尋資料目錄](https://data.gov.hk/en-data/dataset/hk-landsd-openmap-development-location-search-api)
4. `eligible` 表示入口和坐標證據足以供開發者審核下一階段。`needs_more_evidence` 表示已有可追查的到達位置，仍欠入口、行人連接或坐標證據。`not_eligible` 適用於無法識別合理而安全的公眾候選位置。核驗的是靜態地點及步行入口，現時開放、山徑安全、施工、活動和公共交通安排須按管理方最新資訊處理。[漁護署設施最新消息](https://www.hiking.gov.hk/news) · [運輸署香港出行易](https://www.hkemobility.gov.hk/)

## 2. 現有程式與資料

- `assets/data/explore-places.json` 包含 8 筆離線地點、39 個唯一官方 HTTPS 來源 URL，以及雙語交通與注意事項。全部 `navigation` 都只有 `{ "status": "unverified" }`，正式資料已有入口文字、交通指引和部分官方地圖連結。西九藝術公園的 `waterfront`／`pets` 分類共用 `west-kowloon-art-park`。[正式資料](../assets/data/explore-places.json) · [UI-05C1 實作與來源紀錄](UI-05C1-EXPLORE-DATA-IMPLEMENTATION.md)
- TypeScript 模型的 `unverified`／`not_applicable` 分支為 `destination?: never`。`verified` 分支要求雙語目的地名稱、`WGS84` 經緯度與 `sourceId`、目的地 `role`（`trailhead`、`venue-entrance` 或 `pedestrian-arrival`）、`evidenceSourceIds` 及 `reviewedAt`。正式 JSON 靜態載入，型別轉換本身不會在執行時驗證資料。現有測試另外對八筆逐一嚴查無 `destination`。詳情頁的來源連結使用 HTTPS 網域允許清單與 `Linking.openURL`，目前所有資料分支都未接上導航按鈕。[資料模型](../src/explore-places.ts) · [來源選擇與網址檢查](../src/explore-sources.ts) · [探索詳情頁](../src/app/explore/place/%5Bid%5D.tsx) · [資料驗證腳本](../scripts/test-explore-places.cjs)
- 探索列表以穩定 ID 開啟 `/explore/place/[id]`。首頁「行山郊遊」「海濱景點」帶入分類，資料模型已將首頁龍脊及西九候選對應到同一批穩定內容 ID。目前首頁兩張圖片卡仍作靜態展示。附近設施 iOS 地圖使用 `react-native-maps` 的 Apple Maps；設施外部導航驗證坐標後，以原生選單開啟 Apple Maps `daddr=LAT,LON&dirflg=w` 或 Google Maps `travelmode=walking`，交由外部地圖處理起點。這是既有設施導航能力；探索目的地仍須以其自身入口證據驗證。[探索列表](../src/app/%28tabs%29/explore.tsx) · [首頁](../src/app/%28tabs%29/index.tsx) · [附近地圖](../src/components/nearby-facilities-map.tsx) · [設施導航工具](../src/facility-navigation.ts)

## 3. 逐地點核驗總表

| 穩定 ID | 地點／English | 建議用途與候選位置 | 入口文字 | 精確坐標 | 審計結論 |
| --- | --- | --- | --- | --- | --- |
| `dragons-back-to-tei-wan-tai-tam-gap` | 龍脊／Dragon’s Back | `trailhead` · 石澳道土地灣港島徑第八段起點／Hong Kong Trail Section 8 trailhead at To Tei Wan, Shek O Road | 已核實 | WGS84 `22.2270299568, 114.2397903557` | `eligible` |
| `peak-circle-walk` | 山頂環迴步行徑／Peak Circle Walk | `trailhead` · 凌霄閣旁盧吉道起點／Lugard Road trailhead beside The Peak Tower | 已核實 | WGS84 `22.2712927825, 114.1494947398` | `eligible` |
| `west-kowloon-art-park` | 西九文化區藝術公園／Art Park (West Kowloon Cultural District) | `pedestrian-arrival` · 西閘公眾步行入口／West Gate pedestrian entrance | 已核實 | 西閘行人通道未核實 | `needs_more_evidence` |
| `avenue-of-stars` | 星光大道／Avenue of Stars | `pedestrian-arrival` · 梳士巴利花園一側的星光大道入口／Avenue of Stars entrance on the Salisbury Garden side | 已核實 | 從花園接上長廊的入口點未核實 | `needs_more_evidence` |
| `hong-kong-park` | 香港公園／Hong Kong Park | `venue-entrance` · 正義道、金鐘道政府合署對面的公園行人入口／Supreme Court Road entrance opposite Queensway Government Offices | 已核實 | 正義道入口未核實 | `needs_more_evidence` |
| `kowloon-walled-city-park` | 九龍寨城公園／Kowloon Walled City Park | `venue-entrance` · 向賈炳達道的現今南門／Present-day South Gate facing Carpenter Road | 已核實 | 現今南門未核實 | `needs_more_evidence` |
| `tai-po-waterfront-park` | 大埔海濱公園／Tai Po Waterfront Park | `venue-entrance` · 大景街公眾入口／Dai King Street public entrance | 已核實 | 大景街行人出入口未核實 | `needs_more_evidence` |
| `victoria-peak-garden` | 山頂花園／Victoria Peak Garden | `venue-entrance` · 柯士甸山道的公眾行人入口／Public pedestrian entrance from Mount Austin Road | 已核實到達道路，確切的現今閘口未核實 | 未核實 | `needs_more_evidence` |

### 龍脊 · `dragons-back-to-tei-wan-tai-tam-gap`

- **已核實。** 正式內容採漁護署的土地灣至大潭峽版本。漁護署分別標示土地灣巴士站、石澳道路旁起點、步道終點及歌連臣角巴士站；起點照片可認出港島徑指示牌及石砌步道。園方建議乘公共交通到土地灣再沿指示步行。港島徑第八段繼續往大浪灣的版本可佐證共用起點，終點與回程仍用大潭峽版本。[漁護署路線和交通](https://www.hiking.gov.hk/trail/info/id/UWgvZytZSlRrcnBJSU5DWVZUa2pyUT09) · [指定起點照片](https://www.hiking.gov.hk/console/public/uploads/trail/watermark/685e3bef9d130.jpg) · [漁護署雙語路線圖](https://www.hiking.gov.hk/console/public/uploads/others/file/68f933da5236fcc578458846059ce109ce87b211.pdf) · [環島徑第八段](https://www.roundislandtrail.gov.hk/en/exploring-the-trail/route-suggestions/hong-kong-trail-section-8-to-tei-wan-to-tai-long-wan)
- **坐標核驗。** 已下載的官方 GPX 1.1 有 1 段、2,685 個 `trkpt`，無獨立 `wpt`。依官方起點照、路線圖及軌跡順序，第一個 `trkpt` 對應石澳道土地灣起點；末點 `22.2550479979, 114.2319452858` 為另一端的軌跡點。首點轉為 WGS84 UTM 50N 約為 `E 215465.45 / N 2460550.32 m`，落在康文署所列 `50Q KK 154 605` 的 100 米方格內。地政總署地形圖另核對到石澳道旁的步道接點；地點搜尋在同一交界傳回的公廁相距約 3.8 米，標籤明列石澳道及港島徑第八段交界。採用 GPX 首點，格網和公廁點只用作交叉定位。[漁護署 GPX](https://www.hiking.gov.hk/console/public/uploads/others/file/gpx/DragonsBack.gpx) · [康文署 B1 起點格網](https://www.lcsd.gov.hk/en/healthy/hiking/road_sky/road_sky1.html) · [漁護署港島徑格網基準](https://www.afcd.gov.hk/english/country/cou_wha/files/distance_post_hk_trail.pdf) · [地政總署圖磚](https://mapapi.hkmapservice.gov.hk/gs/api/v1.0.0/xyz/basemap/WGS84/20/857035/457859.png) · [地政總署土地灣查詢](https://www.map.gov.hk/gs/api/v1.0.0/locationSearch?q=To%20Tei%20Wan)
- **排除與限制。** 漁護署活動總覽另有 HK1980 地圖點，按 `N=811463.68 / E=842762.88` 轉得約 `22.2419021, 114.2398787`，距 GPX 起點約 **1.65 公里**。它只用於活動概覽。土地灣巴士站只作下車指引，山脊觀景位置及大潭峽側也有不同用途。建議 1.0 只開放到具名起點的步行目的地，保留接駁交通及出發前核對通知的提示。未核驗車輛上落客點、跨路方式或即時行山狀況。[漁護署活動網站](https://enjoyleisure.afcd.gov.hk/en-US/activities/fisheries/dragons-back-79) · [漁護署最新消息](https://www.hiking.gov.hk/news)

### 山頂環迴步行徑 · `peak-circle-walk`

- **已核實。** 旅發局描述由盧吉道及夏力道組成的環線；選定面向盧吉道開始、沿夏力道返回的走法。漁護署港島徑第一段和爐峰自然步道西高山段共用凌霄閣旁、帶有「盧吉道」路牌的起點。官方交通資訊列出山頂纜車及山頂公共交通總站，兩者再步行接上起點。康文署的盧吉道路線圖獨立標示山頂一側的起步位置。盧吉道西端與夏力道的接駁處、山峰、凌霄閣建築點和纜車月台各有不同用途。[旅發局環線](https://www.discoverhongkong.com/eng/place-to-go/travel.guide-peak-circle-walk.html) · [旅發局戶外指南](https://www.discoverhongkong.com/eng/outdoors/family-friendly-hikes-in-hong-kong.html) · [漁護署港島徑第一段](https://www.hiking.gov.hk/trail/info/id/MkpYc3Jud1ZjS2RFbzE1Qkhza0htdz09/map_type/1) · [漁護署起點照片](https://www.hiking.gov.hk/console/public/uploads/trail/watermark/6913f38c357f3.jpg) · [康文署盧吉道路線圖](https://www.lcsd.gov.hk/en/healthy/common/download/running.pdf)
- **坐標核驗。** 港島徑第一段 GPX 有 1,614 個軌跡點，首點為表列 WGS84；西高山段 GPX 有 807 個軌跡點，首點 `22.2712965126, 114.1494912225`，相差約 **0.55 米**。兩份 GPX 皆無獨立 `wpt`，且由同一機構發布，差距反映兩份檔案相符，無法據此推算實地誤差。另以地政總署地形圖核對兩點位於凌霄閣西側室外的道路接點，與獨立的康文署路線圖及入口照片吻合。選用第一段的首點，只借用兩條路線的共用起點。爐峰自然步道松林砲台段雖有相同文字交通指引，但實際下載的 GPX 從松林砲台一帶開始（`22.2771135191, 114.1363658893`），已排除。地政總署以 `Lugard Road` 搜到的道路索引點也欠起點語義。[港島徑第一段 GPX](https://www.hiking.gov.hk/console/public/uploads/others/file/gpx/HongKongTrail%28Section1%29ThePeaktoPokFuLamReservoirRoad.gpx) · [西高山段 GPX](https://www.hiking.gov.hk/console/public/uploads/others/file/gpx/PeakTrail%28HighWestSection%29.gpx) · [松林砲台段 GPX](https://www.hiking.gov.hk/console/public/uploads/others/file/gpx/PeakTrail%28PinewoodBatterySection%29.gpx) · [地政總署圖磚](https://mapapi.hkmapservice.gov.hk/gs/api/v1.0.0/xyz/basemap/WGS84/20/856772/457720.png) · [北側鄰接圖磚](https://mapapi.hkmapservice.gov.hk/gs/api/v1.0.0/xyz/basemap/WGS84/20/856772/457719.png)
- **限制。** 只建議步行至起點。山頂交通及部分道路可能受車輛通行安排影響，外部地圖不能保證走的是正確的一層、可通行道路或整段環線。C3-B 應核對從總站和纜車到站後的最後一段均落到盧吉道入口。纜車營運方的 Nature Walks 頁本輪直接存取回傳 HTTP 403；上述起點結論使用已讀取的旅發局、康文署、漁護署與地政總署證據。[交通管理文件](https://www.districtcouncils.gov.hk/central/doc/2012_2015/en/dc_meetings_doc/78/20131010-DC-Paper-114-2013-Annex-IV-R1.pdf) · [本輪無法直接取得的營運方頁](https://www.thepeak.com.hk/en/the-peak-experience/nature-walks)

### 西九文化區藝術公園 · `west-kowloon-art-park`

- **已核實。** 管理局把西閘、東面及藝術廣場天橋列為不同公眾到達位置。西閘鄰近西隧收費廣場往九龍方向的巴士接駁，亦靠近指定的 WestK Pet Club。選擇西閘的公眾行人通道作為一般到達候選，同一地點 ID 維持兩個分類。九龍站經圓方及藝術廣場天橋是另一路徑，不能由園內的寵物規則推論港鐵、商場或接駁交通允許攜寵。在適用戶外公眾休憩用地，指定範圍以外須牽繩或使用合適容器，並遵從現場安排。[管理局藝術公園指引（本輪可讀中文版）](https://webmedia.westkowloon.hk/documents/Art-Park-Access-Guide-202601-SC-tagged.pdf) · [由九龍站前往](https://webmedia.westkowloon.hk/documents/BFA-route-MTR-Kowloon-Station-EN-tagged-20250219.pdf) · [雙語公眾休憩用地守則](https://webmedia.westkowloon.hk/documents/WKCD%20POS%20Rules%20%26%20Regulations_TC%20%26%20ENG.pdf?VersionId=kNunCAKhd9bJ6OclDS9UdLdWWJTJuVIm)
- **證據缺口。** 指引圖能區分西閘、落客區、會址和園內設施，未提供西閘行人通道的地理坐標。地政總署查詢返回文化區或辦事處等點位。還需管理局地理定位或可地理配準的行人通道資料，核對進場位置與道路層級，避開收費廣場車道、停車場和寵物區閘門。本輪英文 202601 PDF 直接存取回傳 HTTP 403，以已讀取的同批中文版及英文步行圖佐證。維持隱藏導航。[地政總署西閘查詢](https://www.map.gov.hk/gs/api/v1.0.0/locationSearch?q=West%20Kowloon%20Cultural%20District%20West%20Gate%20Entrance) · [本輪未直接取得的英文 PDF](https://webmedia.westkowloon.hk/documents/Art-Park-Access-Guide-202601-EN-tagged.pdf)

### 星光大道 · `avenue-of-stars`

- **已核實。** 場地方的無障礙及到達指引提到梳士巴利花園一側的入口和附近的服務櫃位；場地方建議從尖東站 J 出口沿梳士巴利道步行。港鐵地圖亦列 E、J 作為可到達出口，旅發局則提供由天星碼頭沿海濱步行的方案。候選應設在梳士巴利花園一側接入星光大道的公眾步道。港鐵出口、海濱長廊其他出入口、李小龍像、商場及落客車道均有各自用途。[營運方訪客與無障礙資訊](https://dev.avenueofstars.com.hk/en/contact-us-faq/) · [營運方交通指引](https://dev2.avenueofstars.com.hk/en/transportation/) · [港鐵街道圖](https://www.mtr.com.hk/archive/en/services/maps/ets.pdf) · [旅發局海濱步行指引](https://www.discoverhongkong.com/eng/attractions/top-things-to-see-and-do-around-tsim-sha-tsui-promenade.html)
- **證據缺口。** 地政總署分別返回「AVENUE OF STARS」和「Salisbury Garden」地名點，兩筆都未識別兩者之間的特定行人入口。港鐵圖的索引格可佐證由哪一側步行，但不足以鎖定室外入口或導航層級。待管理方提供接駁入口的點位、可地理配準地圖，或同時證明位置及通行的獨立實測資料。維持隱藏導航。[地政總署星光大道查詢](https://www.map.gov.hk/gs/api/v1.0.0/locationSearch?q=Avenue%20of%20Stars) · [地政總署梳士巴利花園查詢](https://www.map.gov.hk/gs/api/v1.0.0/locationSearch?q=Salisbury%20Garden)

### 香港公園 · `hong-kong-park`

- **已核實。** 康文署有正式公園地圖，參觀指引列出金鐘站 B、C1 及中環站 J2、K。政府工程附件區分天橋入口、人行及無障礙出入口，古樹名冊獨立定位正義道、金鐘道政府合署對面的公園入口。本審計建議這個具名行人入口，沒有將它認定為園方唯一或指定主入口。園方亦說明園內沒有公眾停車位。[康文署參觀指引](https://hkp.lcsd.gov.hk/tc/visit) · [公園地圖](https://hkp.lcsd.gov.hk/tc/map) · [政府出入口平面圖附件](https://www.legco.gov.hk/yr19-20/english/panels/ajls/papers/ajls20200525cb4-583-2-e.pdf) · [古樹位置記錄](https://ovt.greening.gov.hk/map.aspx?id=500&lang=en-us)
- **證據缺口。** 索引及地點搜尋提供的是園址、正義道或園內設施參考點。古樹名冊證明入口附近有該樹，無法把古樹本身的點位視為入口。需取得行人出入口本身的數值點位，並核對斜坡、步道或行人天橋的接駁層級。維持隱藏導航。[地政總署香港公園查詢](https://www.map.gov.hk/gs/api/v1.0.0/locationSearch?q=Hong%20Kong%20Park) · [LCSD 公園索引](../assets/data/lcsd-parks.json)

### 九龍寨城公園 · `kowloon-walled-city-park`

- **已核實。** 康文署列宋皇臺站 B3 和公共交通為到達方式，園內無公眾停車場。康文署園圖配合香港傷殘青年協會的無障礙路線記錄，足以辨識面向賈炳達道的現今南門及由賈炳達道公園方向步行到達的走法。古蹟辦名單另把南門遺跡、衙門列為遺址／建築物；園址東正道亦只是另一側參考。步行目的地選現今南門，保留賈炳達道公園的行人接駁說明。[康文署園圖](https://www.lcsd.gov.hk/en/parks/kwcp/layout.html) · [康文署交通](https://www.lcsd.gov.hk/tc/parks/kwcp/access.html) · [香港傷殘青年協會無障礙路線與南門照片](https://e-cgo.org.hk/travel/en/trip-detail?id=23) · [古蹟辦雙語名單](https://www.amo.gov.hk/filemanager/amo/common/form/list_government-owned_DM_open.pdf)
- **證據缺口。** 以南門搜尋得到兩筆「Remnants of the South Gate of Kowloon Walled City」，第一筆為 HK1980 `E 837704 / N 821416 m`，標的是古蹟。尚未找到可與現今閘口及連接步道交叉驗證的數值點位。康文署園圖的 HTML 可讀，英文 PDF 直連本輪曾逾時，亦有可讀的官方 PDF 索引；結論依園圖入口頁和實際步行記錄。維持隱藏導航。[地政總署南門查詢](https://www.map.gov.hk/gs/api/v1.0.0/locationSearch?q=South%20Gate%20of%20Kowloon%20Walled%20City%20Park) · [康文署英文園圖 PDF](https://www.lcsd.gov.hk/en/parks/kwcp/common/attachment/kwcp_leaflet_english.pdf)

### 大埔海濱公園 · `tai-po-waterfront-park`

- **已核實。** 康文署列出大喜街及大景街公園出入口，另有巴士、大埔墟站 B 出口步行、收費泊車及須事先聯絡的團體旅遊巴上落客安排。審計選大景街公眾入口，供日後驗證東側的最後一段步行進場。完善路入口另有大埔區議會文件，可確認是另一個入口。公園有多個公眾到達位置，無證據指定大景街為唯一或最便捷入口。[康文署交通](https://www.lcsd.gov.hk/tc/parks/tpwp/access.html) · [康文署公園地圖](https://www.lcsd.gov.hk/en/parks/tpwp/map.html) · [大埔區議會完善路入口工程及位置圖](https://www.districtcouncils.gov.hk/tp/doc/2020_2023/sc/working_groups_doc/WGDW/20961/WGDW_15_2021.pdf)
- **證據缺口。** 官方地點搜尋的候選為大景街道路、公園、園內廁所或觀景台等。仍需核對大景街行人入口本身的位置，區分路旁停車位、旅遊巴上落區、園內設施及指定寵物位置。維持隱藏導航。[地政總署大景街入口查詢](https://www.map.gov.hk/gs/api/v1.0.0/locationSearch?q=Dai%20King%20Street%20entrance) · [地政總署公園查詢](https://www.map.gov.hk/gs/api/v1.0.0/locationSearch?q=Tai%20Po%20Waterfront%20Park)

### 山頂花園 · `victoria-peak-garden`

- **已核實。** 康文署場地資料指向柯士甸山道 40 號對面，旅發局也以柯士甸山道識別山頂花園。共享名單涵蓋該場地，康文署要求寵物繫牽繩及受妥善控制。前山頂別墅守衛室是歷史標記，古蹟辦確認其歷史用途；這些資料不足以確定現今行人由哪道閘進場。交通上以到達山頂後上行柯士甸山道為方向，攜寵的上山交通另須核對營運方規則。[康文署場地資料](https://www.lcsd.gov.hk/clpss/en/webApp/Facility/Details.do?did=1&fcid=&ftid=165) · [旅發局山頂花園](https://www.discoverhongkong.com/eng/place-to-go/travel.guide-victoria-peak-garden.html) · [康文署共享名單](https://www.lcsd.gov.hk/en/common/pdf/Annex_IPP_Venue.pdf) · [共享守則](https://www.lcsd.gov.hk/en/facilities/otherinfo/petpark.html) · [古蹟辦守衛室資料](https://www.amo.gov.hk/en/historic-buildings/monuments/hong-kong-island/monuments_52/index.html)
- **證據缺口。** 地政總署搜尋區分 40 號職員宿舍和地址為其對面的花園。後者的 HK1980 `E 832885.6 / N 814990.1 m` 仍以場地命名；公園一般地名搜尋也回傳另一個位置。現有寵物共享設施點、守衛室及園內涼亭均無當代行人入口身分。需補園方入口圖及相應地理坐標，並核對沿柯士甸山道的公眾步行連接和園規。維持隱藏導航。[地政總署 40 號及對面場地查詢](https://www.map.gov.hk/gs/api/v1.0.0/locationSearch?q=40%20Mount%20Austin%20Road) · [地政總署山頂花園查詢](https://www.map.gov.hk/gs/api/v1.0.0/locationSearch?q=Victoria%20Peak%20Garden) · [LCSD 寵物共享索引](../assets/data/lcsd-inclusive-pet-parks.json)

## 4. 可重現性與不確定性

| 原始檔（下載日期 2026-11-18 HKT） | GPX 1.1 檢查 | SHA-256 |
| --- | --- | --- |
| `DragonsBack.gpx` | 1 段、2,685 點、0 `wpt` | `be2198317eb54984b10438bd98462b3103a7c474c36c723c2ba4b196d98eabfe` |
| `HongKongTrail(Section1)ThePeaktoPokFuLamReservoirRoad.gpx` | 1 段、1,614 點、0 `wpt` | `728565fd15663eb405ca9d5274cdc9f36262a64b73648cc36051891bb05b5a3b` |
| `PeakTrail(HighWestSection).gpx` | 1 段、807 點、0 `wpt` | `37abbc379f6fb0294a48ddef1a6b2538d3d4d2b43b2113d39cea14ec5abdf172` |
| `PeakTrail(PinewoodBatterySection).gpx` | 1 段、155 點、0 `wpt` | `069c3fae365da9a6f23bd7ebaec39e505a2f9da6566745ba8ce3a1598619d4a1` |

重現方法：以 XML 解析各 URL 的 GPX 1.1 `trkseg`，讀取首尾 `trkpt` 的 `lat`／`lon`。地形圖用已取得的 WGS84 源點投影到標準 XYZ 圖磚。第 20 級 256 px 圖磚中，龍脊首點約在 `(130, 86)`，盧吉道首點約在 `(128, 10)`，左上角為原點；可結合上面的原圖檢查道路與步道位置。圖磚只用作獨立地物核對，坐標出自 GPX。土地灣公廁及活動總覽的 HK1980 對照點，以專案現有逆橫麥卡托及 EPSG:1825 轉換核對後，用球面直線距離計算。LCSD 書面格網的核對採 WGS84 UTM 50N（EPSG:32650）及六位格網的 100 米解析度。[現有轉換實作](../src/hk-grid.ts) · [地政總署坐標轉換](https://www.geodetic.gov.hk/en/services/tform/tform.aspx) · [MGRS 格網說明](https://earth-info.nga.mil/?action=coordsys&dir=coordsys)

地政總署 HTTPS 查詢以字面位置和指定入口名稱抽樣；只記錄能用作辨別身分的結果。搜尋回傳與官方索引可能有不同點位，欠精確入口語義的結果均保留為背景。需注意地形圖有測繪時間、比例及渲染限制；GPX 起點有數值，亦無現場精度、輪椅通行、道路過境或 Apple／Google 路由結果的保證。兩處 `eligible` 均使用多重證據，並無以單一搜尋結果或螢幕畫面產生坐標。

## 5. UI-05C3-B 前置條件與驗證

- **可提交下階段審核。** 龍脊土地灣起點、山頂盧吉道起點。須先批准具名的步行目的地及對應證據，再將必要的雙語證據引用和核驗日期寫入資料。實作時須可區分 `trailhead`、景點和交通接駁點，確保任何未核實／缺證據的資料都不能開啟導航。若共用既有外部地圖開啟邏輯，應保留探索專用的目的地檢查。
- **維持隱藏。** 西九文化區藝術公園、星光大道、香港公園、九龍寨城公園、大埔海濱公園、山頂花園。依上表補足入口坐標及必要的行人連接證據後再審。兩處已核實的步道仍須確認回程資訊及外部導航實際落點，讓開發者驗收 Apple Maps／Google Maps 步行目的地有沒有被路由吸附到車道、不同樓層、錯誤入口或另一端。
- **驗證紀錄。** `node scripts/test-explore-places.cjs` 通過，確認 8 筆正式離線地點、4 個分類、39 個唯一官方 HTTPS 來源及 0 筆正式導航點。正式 JSON 的 SHA-256 為 `e40effee19d1b9fa1090ba0c93d4d8c76548e634dcf673874f4d41ddfa824c8c`，與審計前相同。Git 工作區只有本報告為新增未追蹤文件；App 程式碼和正式資料均維持原樣。
