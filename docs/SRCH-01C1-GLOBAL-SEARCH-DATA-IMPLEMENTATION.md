# KongDaily · SRCH-01C1 全域搜尋資料層

## 開發基線與改動

`develop` 開工時乾淨，HEAD 與本機 `origin/develop` 均為 `dc3c4b3c23cd29828621bec1d7f5200574a621fe`，相差 0／0。SRCH-01A 與 SRCH-01B0 已在此提交。[搜尋審計](SRCH-01A-GLOBAL-SEARCH-AUDIT.md) · [導航契約](SRCH-01B0-SEARCH-NAVIGATION-CONTRACT.md)

| 檔案 | 變更 |
| --- | --- |
| [src/global-search.ts](../src/global-search.ts) | 統一搜尋、四類獨立搜尋、正規化與排序、準備站點索引、來源狀態及有界結果。 |
| [src/bus-routes.ts](../src/bus-routes.ts) | 共用既有路線端點、營辦商關鍵詞及排序。專項巴士頁的原匹配行為由回歸測試核對。 |
| [src/nearby-bus-data.ts](../src/nearby-bus-data.ts) | 以現有站點快照匯入和 SQLite 表讀取六個搜尋所需欄位。 |
| [scripts/test-global-search.cjs](../scripts/test-global-search.cjs) | 真實打包資料及暫存 SQLite 的定向測試，另以合成目錄測試載入狀態、排序及數量邊界。 |

## 讀取方式及身份

| 類型 | 正式資料、可搜欄位及結果身份 | SRCH-01C3 所需參數 |
| --- | --- | --- |
| `bus_route` | 接受現有 `useBusCatalogue()` 的 `feeds/loading/failed`。用營辦商目錄的 `BusRoute`、正式路線號、雙語起訖、嶼巴全名及既有營辦商關鍵詞。每筆保存完整 `route`。九巴／龍運的目錄 ID 保留方向與服務類型，嶼巴另有原生 `route.routeId`，城巴保留 `listed` 方向。 | `/bus/route` 使用 `{ routeId: result.route.id }`。城巴在原詳情選方向。 |
| `bus_stop` | `loadGlobalBusStops()` 使用原 `prepareNearbyBusIndex()` 匯入打包種子，從 `nearby_bus_stops` 讀來源、站 ID、雙語站名與街道。首次安裝以正式種子取得 7,841 站；已有資料庫時沿用當前站點索引。以 `source + stopId` 區分，保留城巴前導零及所有同名獨立站。 | `/bus/nearby/stop` 使用 `{ source, stopId }`。結果帶 `etaContext: 'route_required'`，需在站點頁選定路線及停靠才能開 ETA。 |
| `facility` | 逐筆以既有 `resolveFacilityIdentity` 核對正式的 1,256 筆設施。可搜兩語名稱、官方別名、地區、區域、地址，以及現有 i18n 類別和設施類型。結果含顯示資料及 `identity: { source, stableFacilityId }`。只有 Registry 可定位的項目進入索引。 | 薄 Stack 使用 `result.identity`，目的頁以 `resolveStableFacilityIdentity` 重新校驗並取得官方座標。 |
| `explore_place` | 由 `getExplorePlaces()` 讀 8 筆正式離線內容。查找雙語標題、地區、主／附加類別的現有兩語標籤。每個正式 `place.id` 只有一筆，西九藝術公園可匹配兩種分類。 | `/explore/place/[id]` 使用 `{ id: result.place.id }`。 |

所有結果有分組種類 `kind` 及可供虛擬列表使用的 `key`。不同營辦商同號、同線不同變體、不同官方身份的同名站及設施，各自獨立；搜尋詞、名稱和語言均不參與結果身份。資料層可直接沿用 SRCH-01B0 的身份契約。

## 匹配、排序與上限

- 輸入支援 NFKC（含全形路線號）、大小寫不敏感、去首尾空白、合併連續空白和常見直彎單引號正規化。原始及正規化字串上限均為 **80 UTF-16 字元單位**。單一英數字可查路線前綴，文字名稱需要至少一個漢字或兩個字母／數字。資料中的正式雙語文字以原樣返回。
- 依完整名稱、名稱前綴、名稱包含、多欄位命中排序。多詞可跨已核准的文字欄位匹配。對數字型路線查詢，路線號精確優先，其次前綴；沿用審計對路線號中段及混合營辦商加號碼輸入的範圍。專項頁的路線號中段匹配保持其既有行為。
- 同級路線沿用巴士自然順序，站點以 SQLite 的來源和站 ID 順序，設施以 Registry 鍵順序，探索以正式內容順序。事先固定同級順序，查詢時只為每個匹配級別保留有限結果，計算完整命中數。
- 「全部」每類最多 **8** 筆。單類路線與站點最多 **30** 筆、設施 **15** 筆、探索 **8** 筆。`totalMatches` 為實際載入的資料命中數；`hasMore` 告知上限外仍有結果。「查看此類」可用相同搜尋詞切換到單類上限，單類超出上限時可提示縮窄關鍵詞。
- 設施沿用 SRCH-01A 核對的本機欄位，但全域搜尋用共用排序處理 Registry 合格資料。既有 `searchNearbyPlaces` 會在回傳前先截至 15 筆，且同時回傳地標；全域層須先驗證身份再計數，故沿用設施模型及欄位，在本層管理有界索引。附近搜尋本身維持原行為。

## 狀態、效能及 SRCH-01C2 接入

`searchGlobal(query, { category, busCatalogue, busStops, requestId })` 為同步本機匹配。回傳 `query`（正規化文字）、`queryStatus`、同一 `requestId` 及 `groups`。單類只回傳該分組；各組提供 `kind`、`status`、`results`、`totalMatches`、`hasMore`。四類專用函數也可共用 `prepareGlobalSearchQuery(query)` 的結果。

- `queryStatus` 為 `empty`、`too_short`、`too_long` 或 `ready`。用原始輸入作畫面文字，以 `requestId` 及當前搜尋狀態捨棄 UI 延後運算中的舊結果。此版本欄供呼叫端比對，沒有自行排程或取消查詢。
- 分組 `not_loaded`、`loading`、`failed` 與 `ready` 且零命中各自呈現。巴士路線另有 `partial` 表示只有部分營辦商有可查目錄，並附各營辦商的 `status`、`failure`、`freshness`、`fetchedAt` 及 `persisted`（有資料時）。刷新失敗仍可用已存目錄與狀態；首次離線且無已取得的目錄使用未載入或失敗提示，當地站點、設施及探索可獨立搜尋。
- UI 在搜尋實例第一次需要站點時呼叫 `loadGlobalBusStops()`，持有回傳的索引及狀態；等待時可傳 `{ status: 'loading' }`。同時開始的讀取共用一個 Promise，失敗可重試，正常返回可保留索引。索引建構每 512 筆讓出事件迴圈；SQLite 僅執行一次窄欄位讀取。靜態設施及探索索引按首次有效搜尋建立，巴士路線按目錄陣列引用變更才重建。任何按鍵比對皆無網絡請求。
- Apple Silicon／Node 24.0.0 的單次定向執行中，首次用暫存 SQLite 匯入及建立 7,841 站索引用 **84.8 ms**，首次設施索引加查詢用 **12.6 ms**。200 次暖索引混合查詢中位數 **0.82 ms**，p95 **1.14 ms**。測試使用正式站點、設施及探索資料和合成路線目錄。此數值供本機比較，iPhone／Hermes 載入及 UI 排版效能待 SRCH-01C2 測量。

### 已收到的 SRCH-01B 交接

已確認開發者加入的三張 PNG 存在，完整視覺檢查留待 SRCH-01C2。後續保持暖白、海港青、圓角、單一搜尋框、四組輕量列表及兩語空態／錯誤語言一致。初始頁香港城市插畫要適當縮小，正式結果由真實查詢供應。設施地圖沿用既有 MapKit 元件、官方 Registry 和薄 Stack，以核實座標選點並省去重複的「在地圖中查看」操作。[初始頁](design/srch-01b-search-initial-review.png) · [混合結果](design/srch-01b-search-results-review.png) · [設施地圖](design/srch-01b-facility-map-review.png)

## 驗證與 Git

- `npm run typecheck`、`git diff --check` 通過。
- `node scripts/test-global-search.cjs` 通過。核對全部 7,841 站的 SQLite 身份、1,256 筆 Registry 解析、八個探索 ID、四類順位及上限、空白和過長輸入、營辦商與變體、同名保留、載入錯誤隔離及重試。攔截 `fetch` 確認搜尋及站點初始化零網絡請求。
- `node scripts/test-bus-route-map.cjs`、`node scripts/test-facility-favorites.cjs`、`node scripts/test-explore-places.cjs` 通過。
- `develop` 留在 `dc3c4b3`。工作區包含上列資料層檔案、本報告及開發者加入的三個未追蹤 PNG。Git 比對顯示 App 頁面、元件、i18n、正式資料、ETA 和 SQLite Schema 與基線一致。
