# KongDaily 1.0 · REL-00 全項目完成度與發布缺口審計

**圖片現況更新。** UI-05C4 已將七處探索地點的類別插畫換成離線實景照。山頂花園現況圖仍待分發權確認。舊 CC BY-SA 4.0 龍脊照片已退出首頁及 Metro 資源，這次採用的素材、署名和留待審批的項目以實作紀錄為準。 [UI-05C4 實作紀錄](UI-05C4-EXPLORE-REAL-PHOTO-IMPLEMENTATION.md)

**結論｜可凍結主要功能，尚未達到 App Store 送審條件。** 首頁、巴士查詢／ETA／收藏、天氣、附近設施及探索已有可追溯的實作。發布前仍要補上 App 內的 KongDaily 隱私政策入口，核對公開政策與支援頁、製作並驗收簽名包、完成商店資料，並處理首頁全域搜尋與巴士「路線圖」兩個可見缺口。UI-02D 尚待產品決定是否納入 1.0。

## 1. 審計基線

- 2026-11-19（香港時間）。分支 `develop`，HEAD `03c6c3a2669782af29932640bff0452af4c23cd6`。與本地 `origin/develop` 及 `git ls-remote --heads origin refs/heads/develop` 的實際遠端回應相同。開始時工作區乾淨。本地 `main`／`origin/main` 跟蹤引用在 `aaa86b1`，相對 `develop` 為 0／27；本地無標籤。UI-05 功能在 `7b743a9` 等提交，HEAD 的新增內容為最終回歸報告。
- 倉庫可追溯的總需求依據是開發路線圖，未找到獨立完整 PRD。以各階段實施規格、資料及驗收報告與本輪使用者確認補足。用現行頁面、資料、Git 與測試判斷完成度。README 仍是 UI-04A+2 ZIP 交接說明，未涵蓋目前整個 App。[開發路線圖](KongDaily_Development_Roadmap_2026-11-17_v2.md) · [README](../README.md)
- UI-01B／C、UI-02A～C、UI-03A～C+ 依各階段驗收紀錄及實際源碼核對，主要提交包括 `7feebc9`、`0c52cd7`、`450ebd6`、`8c53b9a`、`1f53aa1`、`745a1c0`、`61f95f4`。UI-04 以 `27195eb`、`9971339` 等及 D3 報告為基礎；D3 的原生最終簽核仍無獨立紀錄。UI-05C3-C 的自動回歸有提交記錄，使用者另確認最終六項 iPhone 人工回歸全部 PASS。這項人工結果採使用者回報，REL-00 重新執行本地檢查，簽名包另行驗收。[UI-04A 規格](KongDaily_UI-04A_Codex_Instruction.md) · [UI-04A+1](UI-04A-PLUS-1-CODEX.md) · [UI-04A+2](UI-04A-PLUS-2-CODEX.md) · [UI-04D3 回歸](UI-04D3-NEARBY-FAVORITES-FINAL-GATE.md) · [UI-05C3-C 回歸](UI-05C3C-EXPLORE-FINAL-REGRESSION.md)
- 實際路由為四個 Tab「首頁／附近／探索／收藏」和獨立 Stack。根 Stack 包括 `/search`、`/settings`、`/weather`、`/weather/forecast`、`/weather/warnings`、`/bus`、`/bus/route`、`/bus/eta`、`/bus/nearby`、`/bus/nearby/stop`、`/explore/place/[id]`。沒有獨立設施詳情、巴士路線圖、關於或隱私政策路由。[根 Stack](../src/app/_layout.tsx) · [Tab 配置](../src/app/%28tabs%29/_layout.tsx)
- 狀態採 **DONE** 已交付、**PARTIAL** 部分已交付、**MISSING** 應有項目在所審範圍內確實沒有、**UNVERIFIED** 外部／原生狀態證據不足、**DEFERRED** 有明確 1.0 範圍決定。P0 為必備合規、交付或嚴重風險；P1 為主要體驗或須驗證的發布門檻；P2 可隨版本管理。表中「條件」指須作產品決策、收齊特定證據或證實風險才決定是否阻塞。「人工」指仍需使用者、帳號管理者或真機完成的驗證。已完成項以 P2 記錄追蹤優先級。

## 2. 首頁、巴士與天氣

| 模組／功能 | 原始依據 | 現況及實作證據 | 狀態／嚴重度 | 阻塞發布 | 建議與人工驗證 |
| --- | --- | --- | --- | --- | --- |
| 首頁版面、快捷入口與 Tabs | Phase 1A、UI-01B／C | 維港品牌區、天氣膠囊、六個快捷入口、常用巴士、兩張正式探索卡和浮動 Tab 已接線。首頁全域搜尋另列。[首頁](../src/app/%28tabs%29/index.tsx) · [首頁元件](../src/components/home-ui.tsx) | DONE · P2 | 否 | 人工：簽名包抽查小屏安全區、兩語及所有快捷入口。 |
| 路線搜尋、方向／服務類型、站序 | UI-02A／B／B+ | 九巴／龍運、城巴 V2、嶼巴 V2 路線；由營辦商、路線、方向、服務變體或嶼巴 route ID 識別。SQLite 保留有效目錄與站序、搜尋紀錄；失敗可提示／重試；首次離線無目錄時有降級。[路線資料](../src/bus-data.ts) · [站序資料](../src/bus-stop-data.ts) · [巴士頁](../src/app/bus.tsx) | DONE · P2 | 否 | 人工：三個來源各抽一線，驗證冷啟、斷網和恢復。 |
| ETA、時間及過期 | UI-02C1／C2、BUS-UX-01 | 查營辦商官方 ETA；站序、方向及班次變體匹配，嶼巴重複停站沿用上游 route＋stop 限制。可見／前台約 60 秒輪詢、手動 10 秒節流，依官方時間和收取時間辨識過期，達 120 秒移除倒數；真實空結果、服務備註、錯誤與過期各有狀態。首頁、路線預覽、車站及附近路線共用邏輯。[ETA 日期及狀態](../src/bus-eta.ts) · [刷新](../src/bus-eta-hooks.ts) · [附近批次 ETA](../src/nearby-stop-routes.ts) | DONE · P2 | 否 | 人工：測各營辦商實際 ETA、離線逾時、背景回來及更新時間。 |
| 巴士收藏與首頁置頂 | UI-02C2A、BUS-UX-01 | 路線詳情及 ETA 詳情按營辦商、路線、方向／服務版本、上車站、站序保存；SQLite 唯一鍵及 1～3 置頂欄位。收藏 Tab、巴士首頁「常用路線」、首頁共用 Repository；快捷收藏與置頂獨立。[Repository](../src/bus-favorites.ts) · [路線詳情](../src/app/bus/route.tsx) · [ETA 詳情](../src/app/bus/eta.tsx) | DONE · P2 | 否 | 人工：簽名包斷網存刪、重啟、置頂排序及首頁 ETA。 |
| 附近巴士、站點分組及推薦 | UI-02C2B1～B3 | 路線／車站、同名可展開、站點路線、既有上車站優先及手選保護。索引有九巴／龍運 6,757、城巴 752（23 條路線的子集）、嶼巴 332（採集時 66 個 route ID）。九巴／龍運其中兩站缺反向路線，現有覆蓋說明保留。坐標不足的路線不會自動推薦最近站。[來源與覆蓋](nearby-bus-data.md) · [推薦](../src/route-stop-recommendation.ts) · [附近巴士](../src/app/bus/nearby.tsx) | DONE · P2 | 否 | 人工：拒權、指定上車站、地標後切方向及部分覆蓋。商店避免宣稱所有城巴站點均收錄。 |
| UI-02D 巴士路線圖 | 路線圖 UI-02D、本輪補充 | 「路線圖／稍後開放」由靜態 `View` 顯示。沒有可按事件、路線圖路由、站點地圖或折線接線。坐標與 ETA 有可復用基礎，詳見第 3 節。[佔位實作](../src/components/bus-ui.tsx) | **MISSING · P1** | **條件**，交付路線圖或批准延期並移除佔位 | 人工：先決定 1.0 範圍，再驗證地圖或移除後的入口。 |
| 香港天氣、UV、觀測與預報 | UI-03A／B／B++ | HKO `rhrread`、`fnd`；目前觀測、三天預覽、九天展開，按語言及 API 類型存 SQLite。一般刷新 20 分鐘；觀測超過 90 分鐘標舊，6 小時後不突出舊數值；預報 24 小時標舊並濾掉已過香港日期。逾時、無效或網路錯誤保留有效資料並提供重試。[Feed](../src/weather-data.ts) · [時間及解析](../src/weather.ts) · [天氣畫面](../src/app/weather.tsx) · [HKO 開放數據規格](https://data.weather.gov.hk/weatherAPI/doc/HKO_Open_Data_API_Documentation_tc.pdf) | DONE · P2 | 否 | 人工：新安裝離線與有快取斷網分別測試；驗證真實更新時間。 |
| 天氣警告及首頁降級 | UI-03C／C+、UI-01C | HKO `warnsum`／`warningInfo`；分辨生效、取消／失效、已核實沒有與無法確認。約 5 分鐘核實、10 分鐘確認窗口；快取或請求失敗不得宣稱無警告或把未核實資料當即時。[狀態判定](../src/weather-warnings.ts) · [Hook](../src/weather-hooks.ts) · [警告頁](../src/app/weather/warnings.tsx) | DONE · P2 | 否 | 人工：以實際可取得狀態抽查；發不出自然警告時用既有測試資料做定向驗收。 |
| 當前服務及弱網簽名包驗證 | Release Gate A／B | 確認程式呼叫官方 HTTPS 及已有錯誤路徑。REL-00 未做全部營辦商及 HKO 即時真機矩陣。即時 ETA、天氣、網上搜尋和地圖瓦片依上游及連線。[官方九巴／龍運](https://data.gov.hk/en-data/dataset/hk-td-tis_21-etakmb) · [城巴](https://data.gov.hk/en-data/dataset/ctb-eta-transport-realtime-eta) · [嶼巴 V2 資料集](https://data.gov.hk/en-data/dataset/nlb-bus-nlb-bus-service-v2) | UNVERIFIED · P1 | 是，Gate B | 人工：候選包記錄正常網路、弱網、飛航模式、時間跳變及前後台。 |

## 3. UI-02D 巴士路線圖專項

**現況為 MISSING。** `BusLanding` 的 `map` 分支只是圖示、名稱及「稍後開放」，其他快捷入口才是 `Pressable`。`/bus/route` 有方向、變體、站序與 ETA，未繪製路線；`/bus/nearby` 目前為路線／站點列表。既有地圖及站點資料能減少 UI-02D 開發工作。是否納入 1.0 由產品決定。[巴士首頁](../src/app/bus.tsx) · [快捷入口](../src/components/bus-ui.tsx#L105) · [路線詳情](../src/app/bus/route.tsx)

### 3.1 站點坐標與官方線幾何

| 證據 | 已確認 | 涵蓋限制 |
| --- | --- | --- |
| 本機營辦商坐標 | `nearby-stops.json` 可按營辦商＋原站 ID 查 WGS84。反向索引的 6,755／752／332 個已連結站 ID 均可在同來源坐標索引找到。抽樣九巴 1、龍運 A33 的四個方向／服務組合、城巴 1 兩方向、嶼巴 B2／B2P 各兩個 route ID，已收錄的每個站序均有坐標。城巴保留 `001027` 等前導零；`stopVisitKey` 區分環線重複停站。 | 這是兩個本地快照的交集，城巴只收錄子集，亦未驗證新版營辦商站序的整體覆蓋。普通 `RouteStop`／`BusStop` 解析型別不攜帶坐標；九巴及城巴官方站點回應、嶼巴 route-stop 回應有坐標來源可補評估。跨境站點須另外核對邊界規則、落點與座標來源。 [坐標查詢](../src/nearby-bus-data.ts) · [站序型別](../src/bus-stops.ts) · [索引規格](nearby-bus-data.md) |
| 運輸署「Routes and fares」JSON_BUS | 以 HTTPS Range 取首 32 KiB。九巴 1 第一筆是 `Point`，`[114.192446, 22.345353]`；附 `routeId`、`routeSeq`、`stopId`、`stopSeq`、`stopPickDrop`。可作官方站序與上／下車用途的交叉佐證。 | 樣本及資料字典定義的是站位。當時檔案約 78.6 MB，無需在手機整檔下載。其 `stopId` 屬運輸署命名空間。 [資源](https://data.gov.hk/en-data/dataset/hk-td-tis_23-routes-fares-geojson/resource/455c92d8-cb7e-4aec-8deb-5ef769b19037) · [資料字典](https://static.data.gov.hk/td/routes-fares-geojson/dataspec/ptroutefare_geojson_dataspec.pdf) |
| 運輸署 CSDI「Bus Route」 | 官方 REST 的 `MapServer/0` 為 `FB_ROUTE_LINE`、`esriGeometryPolyline`，原圖層 HK1980 Grid（EPSG:2326）、查詢以 `outSR=4326` 取得 GeoJSON WGS84。當次 `returnCountOnly` 回應 **2,262 個線要素**。九巴 1（TD ID 1001，方向 1／2）皆為 `MultiLineString`（25／24 段）；城巴 1（1480）、龍運 A33（8778、8805）、嶼巴 B2（1735）及 B2P（8068）亦取得雙向線樣本。GeoJSON 採經度、緯度，如九巴樣本起點 `[114.1924417578885, 22.3455230059802]`。 | 官方有規劃路線線形。抽樣未驗證全圖層、臨時改道、每種服務變體或與 App 的映射。折線可多段，線數不等於路線數。 [CSDI 資料集](https://portal.csdi.gov.hk/csdi-webpage/dataset/td_rcd_1638844988873_41214) · [官方圖層](https://portal.csdi.gov.hk/server/rest/services/common/td_rcd_1638844988873_41214/MapServer/0?f=pjson) · [官方計數](https://portal.csdi.gov.hk/server/rest/services/common/td_rcd_1638844988873_41214/MapServer/0/query?where=1%3D1&returnCountOnly=true&f=pjson) |

官方線圖層以 `ROUTE_ID`、`ROUTE_SEQ`、`COMPANY_CODE`、`ROUTE_NAMEE` 和 TD 終端站 ID 為主，沒有 App 的九巴 `service_type` 或嶼巴營辦商 `routeId` 直接對照。例子是 B2 的 TD ID `1735` 涵蓋兩方向，而本機嶼巴 route ID 為 `37`、`38`。同名龍運 A33 有兩個 TD route ID、部分組合共用終端站；單靠路線號、兩端名稱或最接近的坐標皆不足以選線。聯營、特班、環線、只下車站及跨境線需要獨立樣本與見證。不能按站點坐標直接連線並稱為行車軌跡。

### 3.2 若納入 1.0，建議的最小範圍

1. **資料及身份驗證。** 以既有 `routeStopKey`／`stopVisitKey` 和 `readBusStopCoordinates(source, ids)` 接合已核實站序。先列出每條實測線的坐標覆蓋，坐標不足時可回站序頁，避免把最後一站或只有部分坐標的集合宣稱為全線可上車。把站點、方向切換、重複站序、定位拒絕列為定向驗收。若要鋪折線，另做經審查的 TD `ROUTE_ID + ROUTE_SEQ + company` 對照、來源和版本記錄與衝突處理。
2. **先交付站點圖與現有 ETA。** 在已選定路線的 `src/app/bus/route.tsx` 或其小型子畫面提供入口。新建專用元件（例如 `src/components/bus-route-map.tsx`）或從 `nearby-facilities-map.tsx` 抽取最小的 MapView 容器、鏡頭操作與錯誤回退。沿用 `react-native-maps`／iOS MapKit、標記、相機、安全區及無位置權限時的手動使用。設施專用聚合和「搜尋此區域」無需整個搬過去。相同站 ID、不同站序可由列表選對上車班次；選站使用既有 ETA Hook、更新和過期規則，地圖載入失敗保持可用站序。建議新增 `src/i18n.ts` 文案及局部定向測試；若採獨立畫面，才需要子路由及 `src/app/_layout.tsx`。巴士首頁若保留入口，應先選路線，再打開相同畫面；涉及 `src/components/bus-ui.tsx`、`src/app/bus.tsx`。站點版為**中等複雜度**，主要工作是覆蓋、鏡頭、選站與返回一致性。無須改原生 SDK 或 SQLite Schema。
3. **折線作獨立交付門檻。** 用已驗證的樣本先做查詢或預處理；必要時新增 `scripts/build-…` 和小型離線幾何索引，只顯示有唯一、可追溯匹配的路線變體。分段繪製 `MultiLineString`，按預算簡化且保留分段及經緯順序。處理缺線、舊索引與臨時改道，留源日期及限制；避免搭錯方向或誤將片段接往另一條路。再擴展全網覆蓋。此段為**中高複雜度**，成本集中在跨供應方匹配、更新與人工抽查。發布文案如果承諾「行車路線折線」，需通過這一道門檻。
4. **若產品批准延期。** 從 `BusLanding` 的快捷入口配置移除整項 `map` 與其「稍後開放」分支，保持其他三項按鈕可用並合理重排寬度；同步移除 1.0 截圖及功能描述中的路線圖。抽查繁中、English 和 VoiceOver，以及巴士搜尋、附近巴士與常用路線原入口。將 UI-02D 記入已批准的延期清單。此變更低複雜度，本輪未實施。

## 4. 附近、收藏、探索及應用級功能

| 模組／功能 | 原始依據 | 現況及實作證據 | 狀態／嚴重度 | 阻塞發布 | 建議與人工驗證 |
| --- | --- | --- | --- | --- | --- |
| 附近地圖、列表、搜尋與拒權 | UI-04A／+1／+2 | MapKit、類別、視口聚合、GPS 與搜尋中心分離，手動七地標。地政總署文字查詢，本地名稱／地區離線搜尋及列表直線距離。定位需主動要求，路線推薦只在已授權時可嘗試單次定位；拒絕仍可探索。離線保證範圍為本地資料／列表。[附近](../src/app/%28tabs%29/nearby.tsx) · [地圖](../src/components/nearby-facilities-map.tsx) · [定位](../src/nearby-bus-location.ts) · [地政總署 API](https://data.gov.hk/en-data/dataset/hk-landsd-openmap-development-location-search-api) | DONE · P2 | 否 | 人工：原生定位、拒絕／精確定位關閉、離線地圖與列表回退、MapKit 署名、A/B 選址。 |
| 官方設施、來源及寵物規則 | UI-04B／C、D3 | 1,256 筆及相同數量穩定身份。FEHD 960（2026-10-26）、AFCD 167（2026-08-04）、LCSD 普通公園 48、寵物專用 36、寵物共享 45（後三者快照 2026-10-25）。五份索引與五份 Registry SHA-256 與凍結提交 `8bdc652e` 一致。來源、官方坐標及服務／寵物規則可展示，資料不表述為實時營業，獅子山公園保持已確認的現行文字規則。[設施資料](../src/facilities.ts) · [UI-04D3 校驗](UI-04D3-NEARBY-FAVORITES-FINAL-GATE.md) | DONE · P2 | 否 | 人工：抽查來源、服務公告、原生 Info 選單與長內容。 |
| 外部地圖與失敗 | UI-04B1++、UI-04D | 按已選設施、有效坐標及穩定身份開 Apple 地圖或 Google Maps；取消不跳轉，交接拒絕提示及可再試。外部地圖打開後能否連網、規劃及步行到實際入口屬外部行為。[設施導航](../src/facility-navigation.ts) | DONE · P2 | 否 | 人工：無 Google Maps 時、兩種外開往返、正確坐標及原選中狀態。 |
| 設施收藏、跨 Tab 與失效快照 | UI-04D1～D3 | Repository 使用來源及穩定 ID，保留失效快照且阻止導航到未核實坐標。地圖／列表書籤同步，「全部／巴士／地點」及跨 Tab 聚焦，定位不改寫 GPS 或搜尋中心。來源編號重用、碰撞、A/B 快速操作、移除均有既有定向測試。[Repository](../src/facility-favorites.ts) · [收藏 Tab](../src/app/%28tabs%29/saved.tsx) · [身份](../src/facility-identity.ts) | DONE · P2 | 否 | 人工：本地刪除、無網存刪、重啟、重覆聚焦。 |
| SQLite v8 初始化／遷移 | Phase 1A、UI-04D1／D3 | `kongdaily.db`，`PRAGMA user_version`，由 v0 逐級到 v8、v7→v8 遷移、回滾與重試。重跑真實臨時 SQLite 測試通過，既有語言、巴士收藏置頂、快取保留。[資料庫](../src/database.ts) · [定向測試](../scripts/test-facility-favorites.cjs) | DONE · P2 | 否 | 人工：候選二進位做 fresh install、用 v7 快照／舊安裝實際升級再重啟。原生簽核列於下方。 |
| 探索內容、分類、首頁聯動 | UI-05A～C3-B | 8 個穩定 ID、18 條兩語看點、39 個官方來源。分類 Parks 4／Hiking 2／Waterfront 3／Pet-friendly 2，跨分類共用身份；未知 ID 安全回退。首頁龍脊／西九卡用同一離線 JSON，兩個分類及「瀏覽更多」已接線。來源每頁最多兩個，按語言選取。[正式資料](../assets/data/explore-places.json) · [列表](../src/app/%28tabs%29/explore.tsx) · [首頁聯動](UI-05C3B-HOME-EXPLORE-INTEGRATION.md) | DONE · P2 | 否 | 人工：本輪收到六項最終 PASS；簽名包只做飛航模式、返回及兩語冒煙檢查。 |
| 探索兩處步道起點導航 | UI-05C3-D／E、最終回歸 | 龍脊 `22.2270299568, 114.2397903557`、山頂環迴步行徑 `22.2712927825, 114.1494947398`。兩筆固定 WGS84、Apple Unified Maps `mode=walking`、iOS 18.4+、失敗可重試同一 URL；六處 `unverified`、未知 ID 與未支援平台隱藏。使用者已驗收兩處落點和步行路線。[核驗](UI-05C3D-NAVIGATION-POINT-VERIFICATION.md) · [座標與門檻](../src/explore-places.ts) · [Apple 官方規格](https://developer.apple.com/documentation/mapkit/unified-map-urls) | DONE · P2 | 否 | 人工：在候選包抽查 iOS 門檻和外開返回；保留六處的核驗門檻。 |
| 語言與雙語無障礙 | Phase 1A、UI-06B、Gate A | `system`／`zh-HK`／`en` 存 SQLite；設定有載入和寫失敗處理。共享 Safe Area、至少 44pt 目標、VoiceOver 標籤及選中狀態已有靜態證據；UI-05 已做窄屏和大字程式分支。原生閱讀順序、焦點與完整字級矩陣另列。[設定](../src/app/settings.tsx) · [語言](../src/language.tsx) · [共用元件](../src/components/ui.tsx) | DONE · P2 | 否 | 人工：冷啟保持語言、跟隨系統、原生 VoiceOver、大字與窄屏。 |
| UI-06A 全域搜尋 | 路線圖 UI-01B、UI-06A | 首頁搜索框進 `/search`，只有可輸入欄及固定空態，無查詢回調、資料查找和結果連結。專項巴士路線與附近地點搜尋已工作，探索有分類篩選。[全域頁](../src/app/search.tsx) · [首頁連結](../src/components/home-ui.tsx) | **PARTIAL · P1** | **是**，現行主入口承諾統一搜尋 | 人工：完成跨類搜尋及離線處理；若批准縮小 1.0 範圍，改為可工作的專項搜尋入口並以精確文案替代。 |
| UI-06B 設定後半、資料管理 | 路線圖 UI-06B、Gate A | 由收藏 Tab 進設定，現只有語言。可個別移除收藏、取消置頂、清除巴士搜尋史。未見全 App 備份／還原、統一清除，原要求為明確界定資料處理範圍。[設定](../src/app/settings.tsx) · [收藏](../src/app/%28tabs%29/saved.tsx) · [搜尋紀錄](../src/app/bus.tsx) | PARTIAL · P2 | 否，隱私政策及支援另列 | 人工：確認 1.0 的本機資料保留與刪除承諾，記錄 OS 備份及刪除 App 情境。 |
| 內建關於、全域支援／聯絡入口 | UI-06B 延伸、Gate B | 設定只有語言，App 無 About 或支援／聯絡入口；附近 Info 是資料來源說明。商店 Support URL 與可聯絡人另列。[設定](../src/app/settings.tsx) | MISSING · P2 | 否，商店聯絡資料有獨立要求 | 人工：批准後可用設定頁放版本、來源與支援；核驗外部聯絡方式。 |
| 設施分享 | 路線圖 UI-04D | 現行卡片有收藏及外部導航；未找到設施分享接線。1.0 確定採用原卡片，分享本身未獲明確範圍決定。[附近畫面](../src/app/%28tabs%29/nearby.tsx) | MISSING · P2 | 否 | 人工：確認是否保留在後續規劃。 |
| 已批准不進 1.0 的功能 | UI-04D3、UI-05B、UI-05C1／E 最終決策 | 獨立設施詳情、擴大探索約 24 處的舊目標、動態活動與購票、探索收藏、評價、AI 推薦、上傳、後端及地圖探索。六個地點的導航依原證據限制維持隱藏，日後核實再另行開放。[附近凍結決策](UI-04D3-NEARBY-FAVORITES-FINAL-GATE.md) · [探索範圍](UI-05B-EXPLORE-DESIGN-REVIEW.md) · [首批八處](UI-05C1-EXPLORE-DATA-IMPLEMENTATION.md) | DEFERRED · P2 | 否 | 人工：發布文案採已批准的八處和現有功能。 |
| 生產包首次安裝、升級、原生交互 | Gate A／B | SQLite 測試、TypeScript、Metro、UI-04D3 及 UI-05 紀錄齊全。未查看同一簽名候選包的 iPhone 整體重啟、原生 SQLite 升級、定位權限、MapKit 標誌、VoiceOver 與 Dark／大字行為。 | UNVERIFIED · P1 | 是，Gate B | 人工：建立實際候選包矩陣，含最低支持與目前 iOS、窄／大屏、兩語和飛航模式。 |

## 5. 發布技術、隱私及商店配置

| 模組／功能 | 原始依據 | 現況及實作證據 | 狀態／嚴重度 | 阻塞發布 | 建議與人工驗證 |
| --- | --- | --- | --- | --- | --- |
| Bundle ID、顯示名稱及裝置意圖 | Phase 1A、Release | `com.lennystudio.kongdaily`、`KongDaily`、`kongdaily` scheme；iOS、直向、淺色，`supportsTablet: false`。Info.plist introspection 的 `CFBundleDisplayName` 為 KongDaily。未設獨立雙語桌面名稱；iPad 兼容模式實際行為未驗證。[App 配置](../app.json) | DONE · P2 | 否，帳號及封包另查 | 人工：對照 Apple 註冊 Bundle ID、簽名包裝置家族及商店展示。 |
| Marketing Version 與 Build Number | Release、App Store Connect | `app.json`、`package.json` 為 `0.1.0`；Expo 預覽 `CFBundleVersion=1`。repo 無顯式 build number、EAS 版本來源或遞增策略；遠端已用編號無資料。[App 配置](../app.json) · [版本管理](https://docs.expo.dev/build-reference/app-versions/) | PARTIAL · P1 | 是，固定 RC 版本 | 人工：決定正式版本，確認 App Store Connect 既有編號後用遞增 build。 |
| App Icon 與品牌啟動畫面 | Gate B | 既有首頁品牌圖及設計稿。App config 無自訂 `icon` 或 `expo-splash-screen` 品牌設定，預覽有預設 `SplashScreen` 入口。缺正式品牌 Icon 接線，簽名包的實際有效 Icon 和啟動畫面未驗證。[Apple App Icon](https://developer.apple.com/help/app-store-connect/manage-app-information/add-an-app-icon) | MISSING · P1 | 是，正式 Icon；自訂 Splash 可按產品視覺決定 | 人工：在實際包確認桌面、TestFlight、首次冷啟圖示，核對素材權利。 |
| 最低 iOS、Xcode／SDK、iPad | Gate B | Expo `57.0.33`、RN `0.86.3`。Expo SDK 57 官方平台表為 iOS 16.4+、Xcode 26.4+；RN pod helper 的 15.1 是自身基線。repo 未顯式設定 iOS target，introspection 的 `LSMinimumSystemVersion` 也不能代替 iOS 歸檔的 `MinimumOSVersion`。探索步道導航另守 iOS 18.4。Apple 上傳最低 SDK 要求與使用者可安裝的最低 iOS 分開核對。[Expo SDK 平台表](https://docs.expo.dev/versions/latest/) · [Apple 上傳規則](https://developer.apple.com/news/upcoming-requirements/?id=04282026a) | UNVERIFIED · P1 | 是，候選包的有效支援未核實 | 人工：驗歸檔、實機、ASC 裝置顯示及上傳校驗，按需要提供對應設備截圖。 |
| EAS production、可重現候選 | Release | repo 無 `eas.json`、EAS project ID 或已跟蹤 native 專案。現有 npm 腳本為 Expo 開發與 typecheck，離線 Metro 產包成功。EAS 遠端帳號狀態另列。[package.json](../package.json) · [EAS 設定](https://docs.expo.dev/eas/json/) | MISSING · P1 | 是，按項目的 EAS Release 路徑 | 人工：核定 Expo project／Apple Team；以可重現 profile 固定 production image、release 版本及構建來源。 |
| Apple 帳號、簽名、TestFlight／提交 | Gate B、Release | 未存取 Apple／Expo 發布帳號；缺發行簽名、Provisioning、App Store 記錄、TestFlight 安裝／批准及上架證據。Metro bundle 是 JS 資產驗證。[Apple App 記錄](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app) | UNVERIFIED · P0 | 是 | 人工：有權限的人核對 Apple Team、協議、App record、簽名及 TestFlight build 狀態。 |
| Info.plist 定位權限 | UI-04A／+2、Gate A | 現行配置 iOS 前台用途，包含 en／zh-HK 本地化；禁用 Always 及 Motion。Expo introspect 有 `NSLocationWhenInUseUsageDescription`，沒有背景位置模式或 Always 用途鍵。未驗證實際包的兩語權限本地化和系統提示。[App 配置](../app.json) · [繁中](../assets/locales/zh-HK.json) · [English](../assets/locales/en.json) | DONE · P2 | 否，原生結果屬 Gate B | 人工：驗正式 IPA 的 InfoPlist.strings 和 iOS 允許／拒絕流程。 |
| ATS 與原生網路 | Gate A | JS 的資料端點均配置 HTTPS；Expo introspect 的預設 plist 同時產生 `NSAllowsArbitraryLoads=true` 與 localhost 不安全 HTTP 例外，和已用官方 HTTPS 無明顯產品必要性。最終 production plist 尚未取得；Apple 要求對適用的例外給出理由。[App 配置](../app.json) · [Apple ATS 規則](https://developer.apple.com/documentation/security/preventing-insecure-network-connections) | PARTIAL · P1 | 條件，例外進入簽名包且未收緊／未提供通過審核的理由 | 人工：檢查 release Info.plist，能移除的例外在發布階段移除，按候選包重新驗 HTTPS／TLS。 |
| Secrets 與依賴公告 | Gate A | 查已跟蹤檔名及常見祕鑰模式，未見發行憑證或應用 API token；未審閱所有歷史、外部 EAS 變數或帳號秘密。`.gitignore` 未明列 .env 或 signing secrets。官方 npm audit 6 項（3 high、3 moderate、0 critical），high 三筆包含同一 `expo-router → query-string → decode-uri-component` 依賴鏈的向上計算；鎖定 `57.0.31 → 7.1.3 → 0.2.2`。另有 `minimatch` 經 Expo fingerprint 鏈的 moderate。Scheme 已聲明，須評估不受信任深連結的可達性及相容修正；未做漏洞重現。 [鎖檔](../package-lock.json) · [解碼器公告](https://github.com/advisories/GHSA-qr28-fpjm-wq7f) · [其他解碼公告](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) · [minimatch 公告](https://github.com/advisories/GHSA-g3hv-75wg-m249) | PARTIAL · P1 | 條件，先完成安全分流並處置可達 high 或簽核緩解 | 人工：核對 EAS secret 邊界、最小相容修補、最終生產包；本輪不採 npm 所建議的跨 SDK 自動升級。 |
| KongDaily 獨立 Privacy Policy | Gate A／B、Apple 5.1.1(i) | 無本 App 的政策文件、已核實公開 URL 或 App 內入口。已查看《設定》、Tab、根路由及版控文件；官方來源的條款和隱私政策屬其自身服務。對帳號內已填政策則屬未驗證。 [設定](../src/app/settings.tsx) · [Apple 審核指引](https://developer.apple.com/app-store/review/guidelines/#privacy) | **MISSING · P0**（App 內和 repo） | **是** | 人工：發布針對 KongDaily 的可公開讀取政策，在 App 內及 App Store Connect 均可訪問，說明地圖、定位、站點和搜尋、快取、支援及刪除等實際行為。 |
| Support URL 與聯絡資料 | Gate B、Apple 1.5 | repo 無獨立支援頁或正式聯絡方式。無權威公共 URL、可聯絡資料或 App Store Connect 已填證據；外部狀態保留未驗證。[Apple Support URL 規格](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information) | UNVERIFIED · P0（公開及商店） | 是 | 人工：填可公開開啟、含實際聯絡方式的 URL，測試收件與兩語資訊。 |
| App Privacy 披露及 Privacy Manifest | Gate A／B | 源碼可建立資料流程，未得 Apple 表單、簽名包 Xcode Privacy Report、所含 SDK 說明／用途理由。repo 無 App 級 manifest 設定；本地 RN／Expo／react-native-maps 等存在個別 manifests，是否進入 production 與理由完整性仍待核實。[App Privacy 詳情](https://developer.apple.com/app-store/app-privacy-details/) · [Apple TN3183](https://developer.apple.com/documentation/technotes/tn3183-adding-required-reason-api-entries-to-your-privacy-manifest) · [Expo manifest](https://docs.expo.dev/guides/apple-privacy/) | UNVERIFIED · P0 | 是 | 人工：逐項核對 App、第三方、保存用途後提交披露，驗 production 依賴、Privacy Report 與 required reasons。 |
| 官方資料與地圖署名 | UI-02／03／04／05、Gate A、Apple 5.2 | FEHD／AFCD／LCSD 來源、版本與 CSDI 說明可見。天氣有 HKO／政府條款與來源，探索有原文連結，巴士有營辦商與覆蓋說明。政府門戶在條件下允許重用及要求署名；仍需核對 FEHD XML、營辦商 API、HKO 及 LandsD 各直接來源條款和署名完整性。MapKit 由 iOS 顯示，實際 Apple 標誌／Legal link 是否被浮層或卡片持續遮蓋待真機。 [DATA.GOV.HK 條款](https://data.gov.hk/en/terms-and-conditions) · [CSDI 條款](https://static.csdi.gov.hk/csdi-webpage/doc/TNC) · [Apple MapKit 條款](https://developer.apple.com/support/terms/apple-developer-program-license-agreement/) · [MapKit 署名指引](https://developer.apple.com/design/human-interface-guidelines/maps) | PARTIAL · P1 | 是，Gate A 的分發權及署名確認 | 人工：建立逐來源授權／署名清單，驗證實際 UI；任何新增 TD 折線也需列入。 |
| 首頁照片、探索插畫與商店素材 | UI-01、UI-05B、Gate A、Apple 5.2 | repo credits 有維港 Pexels、龍脊 Wikimedia CC BY-SA 4.0、西九 Unsplash。龍脊附原作者、重製及裁切記錄，App 可見範圍未找到這份署名。探索用已批准的本機抽象類別插畫；正式商店素材權利證據仍待保全。 [本地 Credits](../assets/home/credits.md) · [龍脊原圖及作者](https://commons.wikimedia.org/wiki/File:Dragons-Back-Northwards.jpg) · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) · [Pexels](https://www.pexels.com/license/) · [Unsplash](https://unsplash.com/license) | PARTIAL · P1 | 是，完成實際分發及截圖用途的權利核對 | 人工：確認署名隨分發成品可供查閱，保留作者、原文連結、授權、已作修改及適用分享條件；不合適時換素材。 |
| App Store 截圖、描述、雙語元資料及審核資料 | Gate B | repo 有 UI 設計參考，未見候選包正式截圖、雙語商店文字、分類／年齡分級、出口合規、審核聯絡和審核說明的提交證據。帳號內實際完成度未驗證。 [Apple 欄位要求](https://developer.apple.com/help/app-store-connect/reference/app-information/required-localizable-and-editable-properties) · [截圖規格](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications) · [商店本地化](https://developer.apple.com/help/app-store-connect/reference/app-information/app-store-localizations/) · [出口合規](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance/) | UNVERIFIED · P0 | 是，必填項；審核說明按實際需求補足 | 人工：按實際 iPhone 支援準備繁體中文及 English 元資料和截圖，填年齡分級、加密／內容權利等。說明無帳號、位置可拒絕、資料覆蓋與線上／離線限制。 |

### App Privacy 披露的最低證據

- **裝置內：** SQLite 存語言、巴士歷史與收藏置頂、官方路線／天氣快取、設施收藏快照。JS 以單次定位取得裝置坐標並以記憶體／本機距離查詢使用，未見把精確 GPS 加入應用層 API 或 SQLite 寫入流程。離線內容從打包 JSON 讀取。原生 SDK、系統備份或地圖請求的行為須按正式包與供應方說明核對。[資料庫](../src/database.ts) · [位置查詢](../src/nearby-bus-data.ts) · [前台定位](../src/nearby-bus-location.ts)
- **裝置外：** 營辦商收取路線／站點識別，HKO 收取 API 類型和語言；使用地政總署在線搜尋時會送出輸入文字，這個流程與 GPS 不同。使用者開啟 Apple／Google Maps 或官方網站時把目的地或連結交給外部服務；外部服務可按自身政策處理位置及網路資訊。App 目前無登入、廣告或顯式分析 SDK 的直接接線。是否符合 Apple 定義的「收集」及應填哪些類別，需看供應方存取、保留和實際 SDK；不應預填「Data Not Collected」。[地政總署查詢](../src/landsd-location-search.ts) · [地圖交接](../src/facility-navigation.ts) · [Apple 披露定義](https://developer.apple.com/app-store/app-privacy-details/)

## 6. 長期維護

| 模組／功能 | 原始依據 | 現況及實作證據 | 狀態／嚴重度 | 阻塞發布 | 建議與人工驗證 |
| --- | --- | --- | --- | --- | --- |
| 設施與巴士離線資料更新 | UI-02C2B、UI-04B／C／D、Post-launch | 現有五個設施構建器、校驗摘要及穩定 Registry；LCSD 遇未審核快照／雜湊變更會停止寫入。巴士有兩個索引構建器，九巴／龍運坐標可分來源更新；城巴、嶼巴反向索引隨發布更新。未有統一的維護日曆、負責人及異常處理手冊。[腳本](../scripts) · [巴士資料方式](nearby-bus-data.md) · [身份保護](UI-04D1-FACILITY-FAVORITES-IMPLEMENTATION.md) | PARTIAL · P2 | 否 | 人工：先暫存下載，核對來源、記錄數、雜湊與 ID 差異，需要時人工匹配；更新索引前重跑收藏遷移。審核失敗保留上一版。 |
| 探索資料及官方連結周期核對 | UI-05C1、Post-launch | 有八處審核資料、各來源、兩處獨立導航核驗、39 URL 可追溯及可選連結檢查。REL-00 重跑靜態檢查未逐條重打 39 URL。未找到定期維護紀錄或責任人。[資料維護與來源](UI-05C1-EXPLORE-DATA-IMPLEMENTATION.md) · [資料測試](../scripts/test-explore-places.cjs) | PARTIAL · P2 | 否 | 人工：發布前抽查路線、官方入口與臨時安排，其後依週期及上游公告複核失效連結和導航。 |
| ETA／天氣變動監測 | Post-launch | 已有解析校驗、快取與可見錯誤，未找到定期上游契約檢查、告警接收者與事故流程。測試腳本目前以本地為主。 | PARTIAL · P2 | 否 | 人工：指定負責人，定期低頻檢查各 API 的狀態及代表性欄位，關注運輸署／天文台公告；準備故障分級及更新／降級指引。 |
| 發布、回滾與故障紀錄 | Release Gates、Post-launch | Git 有主要階段的紀錄，`main` 本地跟蹤尚在初始基線且無本地版本標籤。README 未整理目前啟動、簽名、發布或回滾方式。外部紀錄未核實。 | PARTIAL · P2 | 條件，依 1.0 發布流程選定 RC 和回退方案 | 人工：每次記錄版本、build、Git SHA、資料快照、測試、風險負責人和上架時間；事故可追溯、可復現並能快速提供修補候選包。 |

## 7. 本輪驗證與界限

| 檢查 | 結果 |
| --- | --- |
| Git 分支及遠端 | `git status --short --branch`、`git log`、`git ls-remote --exit-code --heads origin refs/heads/develop` 通過，初始無修改，HEAD 與遠端同一提交。 |
| TypeScript、Git 空白 | `npm run typecheck` 通過。 `git diff --check` 及新增報告空白檢查通過。 |
| 探索資料和導航 | `node scripts/test-explore-places.cjs` 通過 8 筆、4 類、18 看點、39 官方 URL、兩處核准及六處未核實。 `node scripts/test-explore-trailhead-navigation.cjs` 兩語通過詳情、離線、平台門檻、失敗重試、首頁和探索返回。 |
| 設施與收藏 | `node scripts/test-facility-favorites.cjs` 通過正式 Registry、真實臨時 SQLite v8、設施收藏、巴士置頂及路線頁快捷收藏。 `python3 scripts/check-toilet-identities.py fehd`／`afcd` 通過 960／167 筆。五份索引加五份 Registry 完整檔案 SHA-256 與 `8bdc652e` 一致。 |
| Expo 與 iOS Metro | `CI=1 EXPO_OFFLINE=1 EXPO_NO_TELEMETRY=1 ./node_modules/.bin/expo config --type introspect --json` 成功並查 plist defaults。相同環境執行 `expo export --platform ios --max-workers 2 --output-dir <暫存路徑>` 通過，1,267 模組、約 5.3 MB Hermes bundle。 |
| 官方路線圖來源 | 營辦商站序及 App WGS84 索引靜態核對；官方 TD 的站點 GeoJSON 取樣、CSDI REST metadata／計數、分方向折線樣本 HTTPS 取樣成功。組合查詢曾回 HTTP 403，改用單一路線名稱查詢取得官方樣本。未全量下載或導入資料。 |
| npm security audit | 既設鏡像安全公告 API 回 404；改用 `npm audit --registry=https://registry.npmjs.org --omit=dev --ignore-scripts --audit-level=high` 成功回傳公告，退出碼 1 代表達到門檻。0 critical、3 high、3 moderate；無依賴修改。 |

沒有執行 iOS／真機、EAS build、TestFlight 上傳或 App Review，也沒有讀取發布帳號。外部 Apple／Google 落點、產品包的原生互動與 app distribution 依第 5 節獨立驗收。已知功能簽核採各階段紀錄和使用者確認，本文只對本輪確實執行的檢查標記通過。

## 8. 發布缺口與建議順序

1. **真正在 App 或 repo 中缺少。** UI-02D 路線圖本體、設施分享、關於與內建支援入口、KongDaily 隱私政策的 App 內入口與可追溯稿、品牌 Icon／Splash 配置、可重現 EAS production profile。外部政策／支援站、App Store Connect 與 TestFlight 另歸未驗證範圍。
2. **部分完成。** 首頁全域搜尋有頁無結果；UI-06B 有語言、收藏與局部清除，整體備份／清除邊界要作產品說明；已有版本、來源及授權紀錄，需固定生產版本、確保實際署名、收斂 ATS 例外與審查依賴公告；有零散資料維護腳本，需補更新與事故責任。
3. **尚未驗證。** Apple／EAS 帳號與簽名、App Store Connect 公開 URL／披露／截圖及元資料、TestFlight、release archive 的最低 iOS／SDK／原生權限／隱私清單／ATS、在線與弱網真機矩陣、安裝升級、整 App VoiceOver 與大字。UI-05 六項人工 PASS 已記，這組待驗項屬正式候選包或其他模組。
4. **可凍結的功能範圍。** UI-01 首頁版面與已接線捷徑（全域搜尋需處理）、UI-02A～C 巴士／ETA／收藏、UI-03 天氣與警告、UI-04 1,256 筆設施與 v8 收藏核心、UI-05 八處探索、兩處步道導航和首頁聯動。保留 UI-04D3 的原生簽核及全 App 候選包冒煙驗收。獨立設施詳情、探索收藏、動態活動與超出已批准名單的內容已延期，沒有發布阻塞。
5. **進 App Store 前必須完成。** 在 App 及商店提供獨立隱私政策，驗支援 URL 及聯絡方式、App Privacy、原生簽名及合規；清理仍可見的佔位、核對版權及署名、分流依賴告警、確認 ATS；候選包含有效 Icon、版本編號、App Store Connect 必填資料，通過真機、TestFlight 和 Gate A／B。
6. **執行順序。** **REL-01 產品收口**先確認 UI-06A 範圍與 UI-02D 是否做站點版／延期，可和**隱私政策、Support、素材權利**並行。**REL-02 生產配置**完成 EAS、版本、Icon、ATS、安全與原生 privacy/權限。**REL-03 候選驗收**在有權限及使用者授權後製作候選、TestFlight 和實機矩陣，對兩語正式包拍攝商店截圖。**REL-04 送審與發布**才由使用者確認發布分支、標籤、提交與上架，並記錄資料更新及故障處理責任。

本輪工作區變更只包括本報告。
