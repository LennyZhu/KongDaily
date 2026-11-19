# KongDaily · UI-02D0 巴士路線圖開發前核驗

**結論｜可進入 UI-02D1。** 產品已確認把路線圖納入 1.0。建議以官方站點和站序作為基礎，在同一畫面按路線身份疊加已核實的運輸署折線。28 個實際路線選項中，9 個具備候選折線證據，14 個只適合顯示站點，5 個有身份歧義。B2／B2P 四個選項均可顯示官方站點，暫不繪線。這是開發前資料判定，發布前還要以相同鍵、站序、快照及實機確認。

## 1. 現有功能與設計基線

- 2026-11-19（香港時間）在 `develop` 審計。開始時 HEAD 為 `03c6c3a2669782af29932640bff0452af4c23cd6`，REL-00 報告尚未追蹤。工作期間基線更新到 `00a4efb6eb533dc912babbbe7b8ac1b5ce3e6342`，與本地 `origin/develop` 跟蹤引用一致，REL-00 已入版控。兩提交的 App、依賴、正式資料與腳本沒有變動。UI-02D0 只新增本報告。[REL-00](REL-00-PROJECT-COMPLETENESS-AUDIT.md)
- `/bus` 的 `BusLanding` 把「路線圖／稍後開放」分支渲染為靜態 `View`，無點擊處理或路線圖路由。一般搜尋會推入 `/bus/route`，附近則推入 `/bus/nearby`。原 UI-02 圖把「路線圖」列為巴士首頁捷徑，並以「搜尋 → 選方向 → 選站 → ETA」為主流程。圖及路線圖需求均未指定捷徑的目的頁或已選路線參數。[巴士入口](../src/app/bus.tsx) · [BusLanding](../src/components/bus-ui.tsx#L105) · [根 Stack](../src/app/_layout.tsx) · [開發路線圖](KongDaily_Development_Roadmap_2026-11-17_v2.md)
- 已實際查看 `ui-02-approved.png`、`ui-02c2b-approved.png`、`ui-02c2b2-plus-approved.png`。延續現行暖白底、海港青選中態、圓角路線／站點卡與原生返回。附近巴士的列表與「查看路線」仍沿用現行實作。[UI-02](design/ui-02-approved.png) · [附近巴士](design/ui-02c2b-approved.png) · [附近巴士路線優先](design/ui-02c2b2-plus-approved.png)
- 路線詳情已用 `routeSequenceChoices`、`useRouteSequences` 及 `useRouteStopNames` 提供變體、方向、站序、目前選站與推薦站。ETA 及收藏以完整停靠身份識別，`stopVisitKey` 也保留重複站的站序。現有 MapKit 容器提供 Marker、相機與回退，`react-native-maps` 1.27.2 已帶有 iOS `Polyline` 和 `fitToCoordinates`。可復用這些能力；附近設施的聚合、視口搜尋及位置權限由附近頁繼續管理。[路線詳情](../src/app/bus/route.tsx) · [站序 Hook](../src/bus-stop-hooks.ts) · [附近地圖](../src/components/nearby-facilities-map.tsx) · [Expo SDK 57 MapView](https://docs.expo.dev/versions/v57.0.0/sdk/map-view/)

| 營辦商 | 目前 App 路線及方向鍵 | 正式站點資料 |
| --- | --- | --- |
| 九巴 KMB／龍運 LWB | 共用 `kmbLwb`。目錄 ID `KMB-LWB:<號碼>:<O/I>:<service_type>`。詳情鍵使用 `source + number + outbound/inbound + serviceType`。營辦商 API 的共同命名空間不等於可用同號碼區分兩家公司。 | 16 位十六進制 stop ID；官方 route-stop 給方向、服務類型及站序，站點目錄給 `lat/long`。構建時只有合規範圍內的站點進入本機索引。 |
| 城巴 CTB | 目錄 `CTB:<號碼>`；詳情由 route-stop 的 `dir` 區分 O／I。現用目錄／站序沒有可供 App 匹配的 service type，不能憑 TD 的多個變體自建城巴班次。 | 6 碼字串，保留前導零。官方 stop 端點有 `lat/long`。本機快照目前只涵蓋抽查的 23 條路線，路線搜尋可找到更多路線。 |
| 新大嶼山巴士 NLB | 目錄 `NLB:<routeId>`，詳情按原 API routeId 選擇方向或特別服務，方向文案用官方路線名的起訖。數字 routeId 不能當作方向代碼，TD 的 `ROUTE_ID` 與 NLB routeId 也不可互用。 | stop ID 轉為字串。官方 route-stop 陣列順序即站序，有 `latitude/longitude` 和 `someDepartureObserveOnly` 等資料。 |
| 聯營及循環 | 目前聯營仍以各營辦商 Adapter 分開搜尋、收藏與 ETA。循環保留營辦商提供的方向及站序；可以只提供一個方向。 | 不能按名稱跨來源合併車站，也不能用物理位置合併同一班次的兩次停靠。 |

`RouteStop`／`BusStop` 的現行顯示型別不含座標；`nearby_bus_stops` 可批量按來源＋原 stop ID 讀 WGS84。目前附近索引九巴／龍運 6,757、城巴 752、嶼巴 332 站。附近索引缺列時，可在未來由同營辦商正式 stop／route-stop 回應補站點位置，沿用快取與節流。[路線 Adapter](../src/bus-routes.ts) · [站序身份](../src/bus-stops.ts) · [站點 Repository](../src/bus-stop-data.ts) · [座標索引](../src/nearby-bus-data.ts) · [附近索引及 ETA 範圍](nearby-bus-data.md) · [九巴／龍運資料](https://data.gov.hk/en-data/dataset/hk-td-tis_21-etakmb) · [城巴 V2 資料字典](https://www.citybus.com.hk/datagovhk/bus_eta_data_dictionary.pdf) · [嶼巴 V2 資料](https://data.gov.hk/en-data/dataset/nlb-bus-nlb-bus-service-v2)

## 2. 運輸署官方資料

本次由 REL-00 的 CSDI 資料集進入官方元資料，確認 ArcGIS、WFS 及下載網址，再以 `MapServer/0` 取欄位、屬性全集與抽樣折線。下載與分析均在暫存目錄。

| 來源 | 核驗結果 |
| --- | --- |
| CSDI「Bus Route」／`FB_ROUTE_LINE` | ISO 元資料修訂 **2026-11-11**、維護頻率標為每月。DATA.GOV.HK 路線與車費系列頁標雙週，兩個標示的資料範圍有別。底層 HK1980 Grid（EPSG:2326，ArcGIS WKID 102140），以 `f=geojson&outSR=4326` 或官方 WGS84 下載取得 `[經度, 緯度]`。匯入 MapKit 時才轉成 `{latitude, longitude}`。 |
| 折線欄位 | `COMPANY_CODE`、`ROUTE_NAMEE`、`ROUTE_ID`、`ROUTE_SEQ`、`ST_STOP_ID/NAME*`、`ED_STOP_ID/NAME*`、`Shape_Length`、`OBJECTID`。整層有 2,262 個獨立的「公司碼＋TD route ID＋TD direction」鍵。公司碼分佈 KMB 1,164、LWB 148、CTB 666、NLB 94、KMB+CTB 187、LWB+CTB 3。數量按線要素計算。 |
| 運輸署 `JSON_BUS.json` | 全檔 78,573,758 bytes，56,161 個 `Point`、2,366 個 TD 路線方向鍵。用 `companyCode + routeId + routeSeq` 連折線，以 `stopSeq` 排序，`stopId` 屬 TD 空間。另有 `serviceMode`、`specialType`、`stopPickDrop` 和 `lastUpdateDate`。`routeSeq=1` 表示去程或循環、`2` 表示回程，須按實際起訖和順序核對營辦商 O／I；`specialType` 涵蓋指定時間、日期或收費安排，沒有對應營辦商 service type。部分非專營服務亦出現在同一站序檔；發布目錄顯示 2026-11-10，實際下載 HTTP Last-Modified 為 2026-11-18 19:03:14 HKT。兩個日期及各筆最後更新不可混用。 |
| 分發及風險 | CSDI 和 DATA.GOV.HK 條款允許在指定條件下重用，需要清楚標明政府、運輸署與相應平台、保留權利聲明與資料限制。發布版應提供來源、修訂日期及官方網站，保留 Apple 地圖署名。計劃線不反映臨時改道或車輛定位；有官方通知時用已核實的新資料，避免承諾目前實際行車路徑。 |

[CSDI 資料集](https://portal.csdi.gov.hk/csdi-webpage/dataset/td_rcd_1638844988873_41214) · [CSDI 元資料及下載入口](https://portal.csdi.gov.hk/csdi-webpage/metadata/td_rcd_1638844988873_41214/html) · [官方 REST 圖層](https://portal.csdi.gov.hk/server/rest/services/common/td_rcd_1638844988873_41214/MapServer/0?f=pjson) · [CSDI WGS84 說明](https://portal.csdi.gov.hk/csdi-webpage/info/WhatsNew) · [TD 站序下載目錄](https://data.gov.hk/en-data/dataset/hk-td-tis_23-routes-fares-geojson/resource/455c92d8-cb7e-4aec-8deb-5ef769b19037) · [TD 欄位字典](https://static.data.gov.hk/td/routes-fares-geojson/dataspec/ptroutefare_geojson_dataspec.pdf) · [CSDI 條款](https://static.csdi.gov.hk/csdi-webpage/doc/TNC) · [DATA.GOV.HK 條款](https://data.gov.hk/en/terms-and-conditions)

### 重複、缺失及連續性

- 實際下載官方 CSDI 資料 ZIP 為 **26,303,933 bytes**，內部 GeoJSON **1,196,725,375 bytes**。串流解析 2,262 條，與 REST 屬性全集的鍵完全相同。類型為 2,259 個 `MultiLineString`、3 個 `LineString`，共 54,281 段、35,349,718 個頂點，無空幾何或無效樣本座標。按檔內段順序，所有相鄰段首尾距離均不超過 0.1 米。這是對該批分段接合的量測，無法判斷道路通行與行車現況。REST 抽樣與 ZIP 的段數／點數多有不同，不能把兩種輸出的頂點摘要視為同版本；首批以實際核對過的 REST 回應為準。
- 六位小數下有 24 條在同一幾何內重複整段，有 4 組（8 線）完整幾何相同，如城巴 11 的 `8445/1` 與 `8446/1`、嶼巴 11 的 `8563/1` 與 `8564/1`。兩個 TD ID 可以有相同走線和站序，不能用幾何雜湊合併班次或默選一個身份。環線重訪及重疊路段也可能是有效行程，保留原段與站序。
- 2,262 個線鍵都可在 TD 站序檔找到。反向有 104 個站序鍵無線，當中 103 個屬此 App 核對範圍外的公司碼（港鐵接駁、跨境巴士、愉景灣及珀麗灣巴士）。餘下一個是 **KMB 275X `1000392/1`**，同號查詢只回 `1000392/2`，不能反轉回程線作替代。即使兩個 TD 來源可連，仍需跟營辦商當期站序核對。[CSDI 官方 GeoJSON ZIP](https://static.csdi.gov.hk/csdi-webpage/download/common/49e8081925cc1897f44bb77edce45ac8ec8fda19cbf0903524b1565b1922081e) · [275X 官方線查詢](https://portal.csdi.gov.hk/server/rest/services/common/td_rcd_1638844988873_41214/MapServer/0/query?where=ROUTE_NAMEE%3D%27275X%27&outFields=ROUTE_ID%2CROUTE_SEQ%2CCOMPANY_CODE%2CROUTE_NAMEE&outSR=4326&f=geojson)

## 3. 代表路線與匹配方法

1. 按 App 現有 Adapter 讀當天官方 route-stop，並比對 2026-11-16 的打包索引及站點。28 個選項都有有效站序及坐標，27 個站序與兩份本機快照的交集一致，275X 去程不同。九巴／龍運樣本的站點抽查與當日官方站點目錄交叉確認，城巴 1／23／101 的六個終站與當日 stop 端點相符（保留本機六位小數）。嶼巴四個方向逐站比對 V2 與本機索引，坐標一致。
2. 線候選限於公司碼（聯營先核允許成員）、路線號碼及 TD 有向站序。把 TD 站序、原站 ID、站名、起終點和地理位置與營辦商資料並列，核對同號、反向、短途、相近分岔及同一終站的變體。App 沒有相同的 ID namespace 或可直接通用的方向 enum。
3. 本輪用局部 WGS84 公尺近似，分別量「第一／最後營辦商站至線的原始首尾頂點」及「所有站點能否按順序投影到分段折線」。表中距離是約數。候選證據需有唯一合乎語義的線、相同站數和有向站序、起終距離及每站到線 ≤50 米、連續完整；兩份站點座標的相應站偏差 >100 米、疑似移站或道路側別衝突都要人工核實。較小的站名／站位差保留證據，讓營辦商坐標繼續作顯示標記，不能藉折線重新定位站牌。這些門檻用於本輪分級，數值通過仍要有營辦商、終站、序列和變體證據。絕不反轉或補畫不明線段。
4. `verified_geometry` 表示本快照有足以審批的唯一有向匹配。 `stops_only` 表示有可靠營辦商站點，折線缺失或候選不通過核實。 `ambiguous` 表示有多條候選或營辦商與 TD 的分段／變體無法唯一對應，畫面上也只用站點。 `unavailable` 表示不足以繪製站點圖，仍給既有站序回退。本分類只在審計使用。

下表 `O/I` 為營辦商方向，`/1`、`/2`、`/3` 在 App 欄代表九巴／龍運服務類型，在 TD 欄代表 TD `ROUTE_SEQ`。嶼巴方向完全由 routeId 及起訖描述。各行「有線」指相應 TD 候選有資料。

| App 身份（公司／方向／變體） | App 站數／坐標 | TD 線候選及端點核對 | 分級 |
| --- | ---: | --- | --- |
| 九巴 `KMB-LWB:1:O:1`，竹園邨 → 尖沙咀碼頭 | 25／25 | KMB `1001/1` 有線，24／27 米，最遠站離線 26 米。同位序有「竹園南邨榮園樓／天虹小學」名稱差，兩站序及路徑吻合；保留各自名稱。 | `verified_geometry` |
| 九巴 `KMB-LWB:1:I:1`，尖沙咀碼頭 → 竹園邨 | 25／25 | KMB `1001/2` 有線，27／24 米，最遠站離線 24 米。城巴與嶼巴亦有 1 號，起訖不同，不混用。 | `verified_geometry` |
| 九巴 `KMB-LWB:268X:O:1`，洪水橋（洪福邨） → 高鐵西九龍站 | 21／21 | KMB `8203/1` 有線，23／36 米，站序可投影；營辦商與 TD 同位序的灰沙圍及屏山站位差約 156／109 米。待核實站位和資料版本才開線。 | `stops_only` |
| 九巴 `KMB-LWB:268X:I:1`，高鐵西九龍站 → 洪水橋（洪福邨） | 24／24 | KMB `8203/2` 有線，36／27 米，最遠站離線 20 米。TD「朗邊」與營辦商「朗天苑朗松閣」差約 51 米，保留營辦商站名與坐標。 | `verified_geometry` |
| 九巴 `KMB-LWB:268X:O:3`，朗屏邨悅屏樓 → 高鐵西九龍站 | 16／16 | KMB `1000333/1` 有線，30／36 米，最遠站離線 19 米。起點距 `8203/1` 原首點約 2.8 公里，不能套用常規班折線。 | `verified_geometry` |
| 九巴 `KMB-LWB:10:O:1`，彩雲起訖，往大角咀循環 | 48／48 | KMB `1002/1` 有線，11／11 米，最遠站離線 18 米。始末同一營辦商 stop ID `09680C5849BFA077`，兩個站序；城巴有同號路線。 | `verified_geometry` |
| 九巴 `KMB-LWB:296A:O:1`，尚德起訖，往牛頭角站循環 | 11／11 | KMB `1157/1` 有線，21／21 米，最遠站離線 21 米。觀塘轉車站同名站位差約 94 米，沿同方向線能按站序投影。 | `verified_geometry` |
| 九巴 `KMB-LWB:275X:O:1`，富善邨 → 紅磡紅鸞道 | 17／17（本機舊站序 18） | TD `1000392/1` 有官方站序，該方向缺線。11 月 19 日回應相較 11 月 16 日快照少了廣福街市及宏福苑，新增廣福邨。資料未提供變更生效日。 | `stops_only` |
| 九巴 `KMB-LWB:275X:I:1`，紅磡紅鸞道 → 富善邨 | 19／19 | KMB `1000392/2` 有線，36／43 米，最遠站離線 17 米。不能將這筆審批延伸至去程。 | `verified_geometry` |
| 龍運 `KMB-LWB:A33:O:1`，屯門公路轉車站 → 機場 | 35／35 | LWB `8805/1` 同站數，`8778/1` 也是同一有向起訖且能包住目前站點。兩線都約 7／124 米，機場出口／落客與 TD 總站點有差，勝出線證據不足。 | `ambiguous` |
| 龍運 `KMB-LWB:A33:O:2`，同方向另一服務 | 37／37 | LWB `8778/1` 有線、同站數及有效投影，但機場落客端約 124 米。先核實機場站位用途。 | `stops_only` |
| 龍運 `KMB-LWB:A33:I:1`，機場 → 屯門公路轉車站 | 33／33 | LWB `8805/2` 同站數，`8778/2` 也可貼合目前站點；兩者首尾約 31／7 米。首選的 TD 站位差最高約 133 米，不能以疏密判變體。 | `ambiguous` |
| 龍運 `KMB-LWB:A33:I:3`，同方向另一服務 | 35／35 | LWB `8778/2` 有線，31／7 米，但與 TD 同位序 7 站差逾 50 米，最大 133 米；先核對站位及行程。 | `stops_only` |
| 城巴 `CTB:1` O，中環港澳碼頭 → 跑馬地（上） | 20／20 | CTB `1480/1`、`1000326/1` 有線，18／19 站；首尾均約 60／6 米，有中途站離最近候選 93 米。 | `ambiguous` |
| 城巴 `CTB:1` I，跑馬地（上） → 中環港澳碼頭 | 18／18 | CTB `1480/2` 有線，6／60 米；中環末站距線約 51 米。保留營辦商編號 `001027`。 | `stops_only` |
| 城巴 `CTB:23` O，北角碼頭 → 蒲飛路 | 28／28 | CTB `1520/1` 有線，19／15 米，最遠站離線 15 米。排除了九巴與嶼巴的同號線。 | `verified_geometry` |
| 城巴 `CTB:23` I，蒲飛路 → 北角碼頭 | 28／28 | CTB `1520/2` 有線，15／19 米，最遠站離線 19 米。有向停靠順序與 O 不同。 | `verified_geometry` |
| 城巴 `CTB:11` O、I（API 兩段） | 各 31／31 | CTB 的 `1495/1`、`1000276/1` 為 48 站全環，另外有短線 `8445/1`、`8446/1`、`8447/1`。O 的現有站序末站是瑞士花園，I 首站為柏園；與 TD 全環首或末點相差約 3.6 公里。即使 O 站群在兩條全環附近，仍無法給 O／I 各自唯一整線。 | 兩筆 `ambiguous` |
| 聯營 101 九巴 `KMB-LWB:101:O:1`、`…:I:1` | 各 35／35 | TD 公司碼 `KMB+CTB`，九巴 O 候選 `1482/1`、I 候選 `1482/2`。有線，約 57／141 米及 141／57 米；堅尼地城總站有遷移公告，TD 站序記錄日期為 2025-05-16，不能以舊終點替代。 | 兩筆 `stops_only` |
| 聯營 101 城巴 `CTB:101` O、I | 各 35／35 | O（堅尼地城出發）對上 `1482/2`；I 對 `1482/1`，與九巴 O／I 的文字方向相反。約 79／20、20／79 米；城巴 `001152`、`002977` 為獨立官方站 ID。 | 兩筆 `stops_only` |
| 聯營 101 九巴 `KMB-LWB:101:O:3`，觀塘 → 卑路乍街聯邦新樓 | 33／33 | `KMB+CTB 8341/1` 有線，57／35 米。站序及短途終站支持此候選，起點超出本輪門檻，不沿用 1482，也不自建城巴特班。 | `stops_only` |
| 嶼巴 B2 `NLB:37`，元朗 → 深圳灣 | 20／20 | NLB `1735/1` 有線，41／658 米。官方兩份站位大幅不同，營辦商末站到線最近處約 446 米。 | `stops_only` |
| 嶼巴 B2 `NLB:38`，深圳灣 → 元朗 | 16／16 | NLB `1735/2` 有線，658／69 米，深圳灣首站無法順序投影到線。 | `stops_only` |
| 嶼巴 B2P `NLB:33`，天水圍 → 深圳灣 | 10／10 | NLB `8068/1` 有線，10／658 米。站點一律用 V2，畫面只做站點圖。 | `stops_only` |
| 嶼巴 B2P `NLB:34`，深圳灣 → 天水圍 | 10／10 | NLB `8068/2` 有線，658／10 米。33 與 34 的天慈邨端 ID 分別為 `203`、`162`，坐標相同但不合併。 | `stops_only` |

**深圳灣口岸的證據。** 嶼巴四個方向均以站 ID `152`、`[113.950509, 22.497433]`。TD 四個方向為 `12728`、`[113.945805, 22.501407]`，兩點約差 **655 米**。兩家資料各自內部一致。需要再確認不同站位、口岸實際上下客與資料修訂，先停用該線的 CSDI 折線，不平移、截短拼接或補畫。這四個營辦商目錄項的 `specialRoute=0`，保留實際 routeId。聯營 101 的終站偏差亦有官方遷移公告佐證，待查當期走線。[嶼巴 B2 去程 V2](https://rt.data.gov.hk/v2/transport/nlb/stop.php?action=list&routeId=37) · [嶼巴 B2 回程 V2](https://rt.data.gov.hk/v2/transport/nlb/stop.php?action=list&routeId=38) · [嶼巴 B2P 去程 V2](https://rt.data.gov.hk/v2/transport/nlb/stop.php?action=list&routeId=33) · [嶼巴 B2P 回程 V2](https://rt.data.gov.hk/v2/transport/nlb/stop.php?action=list&routeId=34) · [九巴／城巴 101 官方班次資料](https://search.kmb.hk/TD_SS/101.pdf) · [運輸署堅尼地城巴士總站遷移公告](https://www.td.gov.hk/en/traffic_notices/index_id_82667.html)

本輪所有選項都有可用站圖，`unavailable` 為 0。缺站點的其他路線、空回應或相同 stop ID 坐標衝突時，必須暫停受影響地圖或明確顯示只含部分站點，提供原路線站序及 ETA。循環途中的最後一站不可自動變成可上車站；TD `stopPickDrop` 未可靠匹配前也不改寫營辦商功能。

## 4. 技術與 UI 方案

| 呈現 | 優點 | 風險與處理 |
| --- | --- | --- |
| A · 正式站點＋站序 | 復用 Adapter、SQLite 與批量坐標查詢，易處理跨營辦商、缺折線、離線，以及臨時班次。 | 站點連同有向列表提供脈絡。地圖密集時優先顯示選中站和關鍵站，其他按縮放顯示，保留等價可選站序。 |
| B · 站點＋已核實官方線 | 可辨識走向、分岔、跨區與環線。選中方向和服務才載入該線。 | 需要明確對照、有限折線頂點和新鮮度檢查。按原段繪製，任何未核實、失效或不完整資料回到 A。線的來源說明標為「運輸署規劃走線」，不畫車輛位置。 |

### 資料與快取

- **首版建議實作 B，A 作同畫面降級。** 在構建時計算已審核映射，使用現有營辦商路線身份鍵對應 CSDI 公司、route ID、route seq、站序指紋及兩份上游版本。保留內容校驗、核實日期、實測起訖和營辦商 stop ID 做更新對照。正式點用營辦商坐標。若站序／座標指紋異動，驗證未完成期間關閉該線，既有 ETA／站序流程不中斷。TD `OBJECTID` 只作當次原始定位。
- **資料量。** 原始 ZIP 約 26.3 MB、解壓約 1.20 GB；營辦商之外的 TD 站序 GeoJSON 約 78.6 MB。首批 9 筆已核實 REST 折線，保留全部 7,862 個頂點及分段，取六位小數的輕量 JSON 實測 **179,684 bytes**，gzip **45,020 bytes**（不含索引／元資料，非 iOS 包體）。可先在 App 離線打包這小批，按鍵惰性解碼，無需自建後端。擴量前量測 Hermes／原生標記效能；可分片與受控簡化，保留首尾、環線語義及分段，對照原幾何重新驗證。
- **更新成本。** 更新由開發期批次取官方來源，再核對完整性、覆蓋變更、唯一匹配、時間、站位與署名，由版本控制追溯；取數失敗保留上一份有效快照。對新增線先審核後發布。與裝置全量打包、裝置逐次直查 CSDI 相比，初版採核實子集離線打包的風險較低。後續如需即時按需查詢，仍只能請求已核實鍵和版本，限制請求大小、頻率和快取，檢查 HTTP／429／傳輸上限，禁止拿新回應猜對照或在解碼失敗時覆蓋有效資料。
- **過期及離線。** 用打包修訂日作來源提示，將可見且尚未衝突的上次資料明確標記為快照；若超出確認窗口、當期營辦商站序改變、已知官方改道或投影檢查失敗，停止疊線並保留站點。可在首版審批制定按月複核及到期政策，勿因每次 fetch 都成功而重設資料修訂日。離線可用已下載／打包站序、站點與有效折線，Apple 地圖瓦片及 ETA 需依連線或系統快取，列表必須可獨立閱讀。

### 畫面資訊與返回

1. **入口。** 將巴士首頁「路線圖」改為可按捷徑，啟用同一個巴士搜尋的選線模式；清楚提示「選擇要查看的路線」，保留查詢及歷史行為。選中後先載入該路線／方向，再推入地圖。原路線詳情可直接以目前方向／變體及選站推入相同頁；沒有已知身份時不顯示空白全港線網。若從搜尋進來，返回回原搜尋；從詳情進來，返回原詳情。
2. **畫面。** 建議用獨立根 Stack `/bus/route-map`，維持四個 Tab。原生返回與 Safe Area，頁首路線、營辦商、起終或循環目的地及原有方向／服務選項。地圖整體取已知站點範圍，保留縮放、整理視圖和 Apple 署名。可折疊或滾動的站序表帶原有方向、序號和無障礙名稱。
3. **選站。** 地圖顯示序號標記，使用海港青高亮；列表同時定位該停靠。重合或循環兩次停靠用列表／重合站選單明確區分，不挪動官方坐標。底部圓角卡顯示站名、路線方向及現有 ETA 預覽；點擊繼續至 `/bus/eta` 使用同一完整停靠參數。保留訂閱前台可見規則、節流和過期狀態。
4. **切方向與返回。** 沿用真實方向及變體選項，NLB 按 routeId 選擇，循環只顯示有官方站序的選項。按路線方向鍵隔離快取及相機動畫，切線先移去舊覆蓋層，不把舊 ETA 套用新選站。往返 ETA 與地圖保留地圖方向及位置；用原生返回到現有詳情時保留原本的方向、站點及捲動。
5. **提示。** 用暖白卡底和海港青控件。資料載入中、只顯示站點、資料已過期、地圖瓦片未載入、站點部分缺失各有準確雙語提示。坐標不足時回站序列表，未有 ETA 照常進站點詳情。地圖標記與站序行均可用 VoiceOver 選站。

## 5. UI-02D1 前置條件、範圍與驗收

1. **資料設計與首批批准。** 確認 9 個候選的確切身份、快照、來源及分段；先由只讀構建流程以固定鍵和站序做回歸，不擴大為「全營辦商折線已覆蓋」。定向測試包括同號不同公司、方向故意反置、環線重站、268X 特班、A33 變體歧義、聯營 101 方向、275X 缺線、B2／B2P 終站偏移、GeoJSON 經緯反序、坐標缺失、舊資料及超出傳輸上限。
2. **UI-02D1 接線。** 預計改巴士首頁與捷徑組件 `src/app/bus.tsx`、`src/components/bus-ui.tsx`，路線詳情入口 `src/app/bus/route.tsx`、根 Stack `src/app/_layout.tsx`、雙語 `src/i18n.ts`；增加路線地圖頁及窄範圍地圖元件。沿用既有站序 Hook、座標查詢與 ETA。若需要官方坐標缺漏回填，限於現有站點 Adapter 或新的單一讀取層。核實折線另增一個構建／校驗腳本及輕量資料資產。站點地圖為中等工作量，批量跨源映射與維護為中高工作量。初版約五個既有接線檔、二至三個畫面／資料讀取檔及資料與定向測試；以實際選擇的 Stack 與共用層範圍為準。無需新後端、SDK 或 SQLite Schema。
3. **發布前驗收。** 由開發者在 iPhone 確認 1、268X、23 和循環線的出入口、地圖方向、標記順序、切換與返回；確認 B2／B2P、聯營 101、A33、275X 去程為站點降級且無舊線殘留。用離線、弱網、空資料、切一次班次／快速切方向、英文和大字、VoiceOver 及缺瓦片檢查。抽查站點 ETA、收藏、附近巴士、首頁置頂及第三方署名。展開折線覆蓋須逐路線審批及看地圖，不能用本次樣本加總推論全網。
4. **目前允許與停用。** 九巴 1 雙向、268X 回程常規及去程特班、10 和 296A 環線、275X 回程、城巴 23 雙向具候選折線證據。龍運 A33、嶼巴 B2／B2P、聯營 101、城巴 1／11、268X 去程常規及 275X 去程按表只提供站點圖，所有未審批線暫停疊線。需要首批有可視折線與正確降級兩種正向案例才可發布。

## 6. 可重現性與檢查

- 抽樣以官方 REST 查詢 `where=ROUTE_NAMEE='<號碼>'`、`outSR=4326`、`f=geojson` 取全候選，再按公司碼、方向及站序判斷。屬性全集用 `where=1=1&returnGeometry=false`，確認無傳輸截斷；全圖層另核官方 ZIP。TD 站序按字典連接，端點、分段及有向投影定向檢查在暫存目錄執行。 [268X 折線查詢範例](https://portal.csdi.gov.hk/server/rest/services/common/td_rcd_1638844988873_41214/MapServer/0/query?where=ROUTE_NAMEE%3D%27268X%27&outFields=ROUTE_ID%2CROUTE_SEQ%2CCOMPANY_CODE%2CROUTE_NAMEE&outSR=4326&f=geojson)
- 來源 SHA-256：官方線 ZIP `9214830f102d024ecb33500381be22f3df24adefc35952ebf0c805e0134af1e4`，官方 TD 站序 JSON `a7a91c8b78bd6044bf9673436baadd709733221091777730e1f04588e74c6f2c`。兩份不同用途、不同版本的下載均為審計輸入。
- `npm run typecheck` 通過。現有 `node scripts/test-facility-favorites.cjs` 通過，涵蓋 SQLite v8、巴士置頂、站點快捷收藏及跨頁。另以現有 TypeScript 解析器執行官方目錄和 route-stop 回應，九巴／龍運 16、城巴 8、嶼巴 4 個選項全部通過站序接受、站點 ID 座標查找及停靠鍵唯一性檢查。本輪無既有路線圖測試。新增報告 Markdown／Git 空白及相對檔案連結已檢查。未執行 iOS 模擬器、EAS、commit、push 或 merge。
