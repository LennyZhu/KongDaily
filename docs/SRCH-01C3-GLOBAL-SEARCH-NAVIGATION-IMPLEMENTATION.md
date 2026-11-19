# KongDaily · SRCH-01C3 全域搜尋結果導航

## Git 基線

開工時 `develop` 工作區乾淨。執行 `git fetch origin develop` 後，HEAD、`origin/develop` 及 `FETCH_HEAD` 均為 `e00c39ccbcaa8db2138fa3eaf24fbefdf79b8633`，分歧為 0／0。該提交包含已驗收的 SRCH-01C2 及 C2A。

## 四類結果

| 結果 | 根 Stack 路由及全部參數 | 身份與目的頁行為 |
| --- | --- | --- |
| 巴士路線 | `/bus/route`，`{ routeId }` | 驗證目錄身份。九巴／龍運使用 `KMB-LWB:<號碼>:<O/I>:<serviceType>`，嶼巴使用 `NLB:<operatorRouteId>`。有指定方向或變體時維持所點選的服務，即使該站序未能載入。城巴使用 `CTB:<號碼>`，目錄列只代表雙語起訖，進入既有路線頁後由使用者選已載入的方向。同號的營辦商及服務各自獨立。 |
| 巴士站 | `/bus/nearby/stop`，`{ source, stopId }` | 來源限 `kmbLwb / citybus / nlb`，站點 ID 保持字串及前導零。既有站點頁再按兩欄讀站名、營辦商、街道及正式反向路線。搜尋列顯示官方 ID 供同名站辨識。從全域搜尋省略 `distance`，也省略路線與 ETA 參數。只有站點頁讀到可驗證的路線及停靠時，沿用其 ETA 行為；缺關聯時顯示既有覆蓋提示。 |
| 附近設施 | `/search/facility-map`，`{ source, stableFacilityId }` | 結果點按及目的頁分別解析 Registry。只傳穩定身份，由當前正式設施提供分類、名稱、官方 WGS84 座標及地圖顯示 ID。 |
| 精選地點 | `/explore/place/[id]`，`{ id }` | 先核對正式離線 ID，再開啟既有詳情。同名設施與探索內容保有各自身份，原有官方來源及導航限制維持。 |

巴士路線頁以根 Stack 的上一頁辨識全域搜尋入口，路由仍只接收 B0 約定的 `routeId`。搜尋進入時以該 ID 為準，跳過跨語言記憶及自動選擇其他有站序方向的舊入口行為。方向選擇仍使用原路線頁的選項及站序 Hook，非搜尋入口維持原初始化規則。失效的目錄或車站身份由目的頁原有不可用狀態處理。無效結果留在搜尋頁顯示雙語提示。

## 設施薄 Stack 與返回

- 根 Stack 直接登記 `search/facility-map`。該葉路由自行管理一個選中 ID，MapKit 元件持有本畫面的視口及重試狀態。路由樹及 Stack reducer 測試證實 push 得到 `(tabs) → search → search/facility-map`，Tab route key 和其既有分類／列表狀態保留，pop 回到同一個 `search` route key。
- 共用 `NearbyFacilitiesMap` 及 `FacilitySelectionCard`。初始相機和高亮標記對準 Registry 資料，使用者可縮放、平移、點選其他有效設施、切換同座標記錄或關閉選點。卡片保留官方資料、公告、現有寵物規則、收藏及外部導航。薄 Stack 省略距離及需要宿主操作的定位、搜尋此區域和列表按鈕。附近 Tab 仍提供原本操作及收藏跳轉。地圖載入錯誤保留卡片並可重試。
- 缺參數、多值、未知或已退休身份顯示「設施暫未能定位」，有 Registry 衝突或錨點不符時顯示「設施資料待核實」。原生 Back 回上一頁，若由獨立入口開啟則提供返回搜尋。
- 結果列使用 Pressable、右箭頭及包含名稱與區分資訊的 VoiceOver 標籤。點按時關閉鍵盤，同一轉場只接受一次 push；搜尋重新取得焦點時解鎖。原搜尋實例保留詞、資料、分類及各類捲動紀錄。返回時使用原像素偏移；若資料重新排序且原可見列仍在，優先按該列的穩定鍵定位。該列已移除或尚未量測時，回到可用的原偏移。首次讀入資料和重試仍由 C2 原有流程負責。

## 修改檔案

| 檔案 | 內容 |
| --- | --- |
| [搜尋頁](../src/app/search.tsx)、[結果列](../src/components/global-search-result-row.tsx)、[導航契約](../src/global-search-navigation.ts) | 點按回饋、驗證四類身份、push、轉場防重及返回後捲動恢復。 |
| [根 Stack](../src/app/_layout.tsx)、[搜尋設施地圖](../src/app/search/facility-map.tsx)、[雙語](../src/i18n.ts) | 新根 Stack 葉路由、獨立地圖宿主、錯誤及返回文案。 |
| [附近 Tab](../src/app/%28tabs%29/nearby.tsx)、[共用選點卡](../src/components/facility-selection-card.tsx)、[MapKit 元件](../src/components/nearby-facilities-map.tsx)、[相機](../src/nearby-map-motion.ts) | 抽出選點卡與詳情，讓不同宿主選用地圖操作，沿用原有標記聚合及相機移動。 |
| [巴士路線頁](../src/app/bus/route.tsx) | 搜尋入口維持所點選身份，城巴在現有控制項明確選方向。 |
| [C3 定向測試](../scripts/test-global-search-navigation.cjs)、[搜尋 UI 測試](../scripts/test-global-search-ui.cjs)、[收藏測試](../scripts/test-facility-favorites.cjs) | 覆蓋四類導航、嚴格身份、返回、防重及共用卡片回歸。 |

已查閱三張 SRCH-01B 高保真。混合結果只補上點按效果和箭頭。設施地圖用 MapKit 及官方資料呈現，共用卡片保留原有收藏和外部導航操作。Git 差異核對確認 C1 演算法、C2A 插圖、正式設施／探索資料、巴士 ETA、SQLite Schema、收藏 Tab 及核准設計檔均與基線一致。

## 自動化結果

| 命令 | 結果 |
| --- | --- |
| `npm run typecheck`、`git diff --check` | 通過，並另外檢查新增檔案的空白。 |
| `node scripts/test-global-search.cjs` | 通過。核對 7,841 個正式站點、1,256 個 Registry 設施、八個探索 ID、既有搜尋行為及 SQLite 離線讀取。 |
| `node scripts/test-global-search-ui.cjs`、`node scripts/test-global-search-navigation.cjs` | 通過。涵蓋四類路由、同號及同名身份、城巴未選方向、方向載入失敗、缺站點路線上下文、地圖錯誤／重試、失效和衝突提示、原搜尋 route key、防重、混合及單類捲動返回。測試使用實際路由樹與 Stack reducer，原生畫面使用替身。 |
| `node scripts/test-bus-route-map.cjs`、`node scripts/test-facility-favorites.cjs` | 通過。含巴士站序／方向／變體、路線圖與 ETA、SQLite v8、設施收藏及收藏跨 Tab 聚焦。 |
| `node scripts/test-explore-places.cjs`、`node scripts/test-explore-trailhead-navigation.cjs` | 通過。含八處離線內容、兩處已核實導航及原首頁／探索返回。 |
| `EXPO_OFFLINE=1 CI=1 npx --no-install expo export --platform ios --output-dir <臨時目錄>` | 通過。1,280 個模組，Hermes bundle 5,564,012 bytes。 |

## iPhone 人工驗收

1. 從首頁查 `268X`，分別開啟不同方向及服務類型，再查 `23` 抽查九巴和城巴的同號路線。核對標題、方向和服務，返回後再開另一個結果。城巴 `23` 先確認無預選方向，點選任一可用方向才顯示對應站序。
2. 查同名巴士站，依搜尋列上的營辦商與官方 ID 分別打開。確認有正式關聯才出現路線及到站能力。抽查城巴前導零 ID 和缺少反向覆蓋的情況。
3. 在附近 Tab 選好分類、視口和設施，再從首頁搜尋 `香港公園` 或一個郊野公廁。核對搜尋地圖初始標記與卡片，試縮放、點其他標記、關閉與重新選中。確認收藏同步，返回後原附近 Tab 的選點和視口仍保持。抽查地圖載入失敗時卡片和重試。
4. 在混合結果及「查看全部」各捲動一次，開啟設施或探索結果。分別用頂部返回及 iOS 左邊緣手勢返回，核對詞、分類、捲動位置。快速連點兩列應只打開一頁，返回後同一結果可再次開啟。
5. 用 English、大字及 VoiceOver 核對長名稱、結果列、卡片操作和返回。抽查離線探索詳情、無巴士目錄快取或 MapKit 瓦片無法載入時的提示。

原生邊緣手勢、鍵盤收起後位置、系統 MapKit 瓦片及 VoiceOver 實際朗讀仍需人工驗收。城巴方向可用性取決於原有站序服務，從搜尋打開的站點詳情仍受既有反向索引覆蓋限制。

`develop` 和 `origin/develop` 保持在 `e00c39c`。本輪 15 個檔案的修改與新增留在工作區，等待人工審核。
