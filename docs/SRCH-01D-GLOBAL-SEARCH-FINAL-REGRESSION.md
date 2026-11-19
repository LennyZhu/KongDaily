# KongDaily · SRCH-01D 全域搜尋與核心功能最終回歸

**SRCH-01 結論：GO，建議凍結。** 搜尋範圍內未發現 P0／P1，既有回歸和 iOS Metro 匯出通過，開發者亦確認 C2／C2A／C3 的 iPhone 人工驗收均通過。KongDaily 1.0 的 App Store 發布門檻仍有獨立未結事項，見末節。

## 1. Git 基線及人工驗收

- 2026-11-19（香港時間），`develop` 開工時沒有已修改或未追蹤檔案。執行 `git fetch origin develop` 後，HEAD、`origin/develop`、`FETCH_HEAD` 同為 `a0aac2a3402d71bbb0e693e74f226122ccd922c0`，雙向差異 0／0。C3 提交為 `a0aac2a`，C2／C2A 在 `e00c39c`，C1 在 `fb33967`。三張 SRCH-01B 圖及 SRCH-01A 至 C3 實施文件均在版控內。[C2 實施](SRCH-01C2-GLOBAL-SEARCH-UI-IMPLEMENTATION.md) · [C2A 插圖](SRCH-01C2A-SEARCH-ILLUSTRATION-TUNING.md) · [C3 導航](SRCH-01C3-GLOBAL-SEARCH-NAVIGATION-IMPLEMENTATION.md)
- **人工驗收來源為開發者本輪確認。** SRCH-01C2 初始頁及結果、C2A 插圖、C3 四類結果導航及設施地圖均已通過 iPhone 人工驗收。本輪只執行本機測試、路由狀態推演、靜態核對及 Metro 匯出。未取得人工逐項截圖、測試機型、iOS 版本或候選包識別，故無法從本輪證據追溯每一項原生操作或簽名包驗收結果。

## 2. 四類搜尋及導航

| 類別 | 正式資料及查詢驗證 | 導航與安全驗證 |
| --- | --- | --- |
| 巴士路線 | 三個既有營辦商目錄來源（九巴／龍運、城巴、嶼巴）。路線號精確排在前綴之前，保留同號營辦商及服務變體。測試用可重現的目錄回應覆蓋狀態與排序；實際營辦商全量目錄和在線可用性取決於已取得的目錄。 | `/bus/route` 接收完整 `routeId`。九巴／龍運按方向和服務類型、嶼巴按營辦商 route ID。城巴目錄未提供方向，由使用者在既有頁選擇。指定站序未成功載入時，搜尋入口仍維持點選的身份。 |
| 巴士站 | 以真實打包快照匯入臨時 SQLite 並核對 **7,841** 個鍵。九巴／龍運 6,757、城巴 752、嶼巴 332。同名異站獨立，城巴前導零保留。 | `/bus/nearby/stop` 接收 `source + stopId`，沿用正式反向站序。無已核實路線時產生零個 ETA 查詢任務，搜尋頁亦省略 ETA 及距離。 |
| 附近設施 | **1,256** 筆 Registry 身份可雙向解析，FEHD 960、AFCD 167、LCSD 公園 48、寵物專用 36、寵物共享 45。五份索引和五份 Registry 與凍結提交 `8bdc652e` 一致。 | 根 Stack `/search/facility-map` 接收 `source + stableFacilityId`，從當前可用記錄取官方座標。核對缺參數、陣列、未知或退役身份，以及衝突拒絕。起始標記和卡片一致，點選、新選點與取消只影響該 Stack 實例。 |
| 精選地點 | **8** 個正式離線 ID。雙語名稱和分類等欄位可查，跨分類結果按 ID 去重。原有 18 條雙語看點和 39 條官方來源仍通過校驗。 | `/explore/place/[id]` 使用正式內容 ID，未知 ID 受防護。兩處已核實步道起點、iOS 18.4 門檻及其餘六處隱藏照舊。 |

- C1 通過 zh-HK／English、大小寫及空白正規化、完整／前綴／包含匹配、同級穩定順序及輸入上限。C1 混合每類回傳最多 8 筆，C2 畫面每組預覽最多 5 筆；單類上限為巴士路線 30、巴士站 30、設施 15、探索 8。UI 定向檢查用正式站點、設施和探索資料；合成項目只用於邊界，零請求、失敗及速率條件採受控測試。
- C2／C3 通過「查看全部」及混合返回、清除、180 ms 防抖和舊輸入隔離。首次離線無巴士路線目錄時，顯示來源狀態；三類本機資料可獨立搜尋。部分目錄或 SQLite 存取失敗保留可用來源並提供對應重試。
- 實際 Expo Router 檔案樹與 Stack reducer 對四類目的頁都驗證 `(tabs) → search → 目的頁`，原 Tab route key 留在堆疊，pop 到同一 `search` route key。搜尋頁替身測試驗證關鍵詞、混合及單類資料和捲動偏移、快速點擊防重、再開與兩語錯誤。資料重新排序時優先使用原可見列鍵；該列不再可用或未量測時以像素偏移回退。實際邊緣返回和鍵盤重排的驗收證據來自開發者。 [搜尋資料](../src/global-search.ts) · [結果導航](../src/global-search-navigation.ts) · [搜尋畫面](../src/app/search.tsx) · [C3 測試](../scripts/test-global-search-navigation.cjs)

## 3. 四個 Tab 及 UI-02D 回歸

| 範圍 | 核對結果及界限 |
| --- | --- |
| Home | 自動檢查首頁搜尋入口和兩張正式探索卡，SQLite 驗證巴士站收藏、置頂排序、首頁讀取與固定站點 ETA 身份。靜態核對首頁仍由 `HomeFavoriteBus` 使用原 ETA Hook，天氣膠囊進 `/weather`，九天入口進 `/weather/forecast`，警告進 `/weather/warnings`。短程模型檢查通過兩語觀測、香港日期及 PSR、警告生效／取消／過期／未知／載入。未在線驗證營辦商或 HKO 即時回應。 [首頁](../src/app/%28tabs%29/index.tsx) · [天氣](../src/app/weather.tsx) |
| Nearby | 核對 MapKit、地圖／列表、分類、聚合、官方座標及共用選點卡。C3 驗證正確初始標記、MapKit 替身失敗時保留卡片及重試。既有回歸覆蓋同座標獨立設施、外部地圖目的地／取消／失敗、Nearby 聚焦與定位競態。附近 Tab 保留原前台位置流程，搜尋地圖沒有定位操作或權限請求。 [Nearby](../src/app/%28tabs%29/nearby.tsx) · [共用卡片](../src/components/facility-selection-card.tsx) · [地圖](../src/components/nearby-facilities-map.tsx) |
| Explore | 八處、四類分類、詳情、官方來源呈現和步道導航限制通過。分類數為 Parks 4／Hiking 2／Waterfront 3／Pet-friendly 2。兩種語言皆測首頁精選與探索返回，首頁行山、海濱及更多的快捷路徑亦經靜態核對。官方連結用正式資料驗 URL 格式，本輪未逐條重查端點。 [探索資料](../src/explore-places.ts) · [步道回歸](../scripts/test-explore-trailhead-navigation.cjs) |
| Saved | 實際臨時 SQLite 通過新建、v7→v8、失敗回滾、收藏存刪、穩定鍵衝突、失效快照及巴士置頂。沿用 `savedFacilityRequest` 進原 Nearby Tab，含重複聚焦、快速 A／B 及 GPS／搜尋中心隔離。搜尋地圖與 Nearby 接同一共用卡和收藏 Hook，使用同一 SQLite 收藏鍵；導航和搜尋選點由各自宿主管理。 [收藏](../src/app/%28tabs%29/saved.tsx) · [共享收藏狀態](../src/facility-favorite-hooks.ts) |
| UI-02D2／D3 | 官方折線包離線校驗 **9 條、7,862 頂點**，SHA-256 `b36819e9595cabdd1ce76bd8a1c8e628730a03e3a20aef4684964201bc03020c`。無核實折線的服務維持站點模式。定向回歸涵蓋 B2／B2P、未核實方向、方向及變體隔離、循環線不同停靠、切換時移除舊線；已選站 ETA 正確匹配，快切、重試、過期及缺資料安全降級，保留完整 ETA 路由和既有收藏。 [地圖回歸](../scripts/test-bus-route-map.cjs) · [官方折線](UI-02D2-BUS-ROUTE-GEOMETRY-IMPLEMENTATION.md) · [地圖 ETA](UI-02D3-MAP-ETA-PREVIEW-IMPLEMENTATION.md) |

## 4. 安全、依賴及實際測試

- REL-00 至 HEAD 的差異及呼叫點掃描未見新應用網絡端點、位置請求、資料庫結構或依賴。全域搜尋詞保留在畫面記憶體，本地匹配不傳輸關鍵詞；巴士目錄載入／重試仍由既有營辦商服務處理，MapKit 瓦片及使用者主動開啟的外部地圖維持原資料邊界。Nearby 的地政總署搜尋是原有獨立流程。生產包第三方資料處理及發行權限仍按 REL-00 核對。 [目錄](../src/bus-hooks.ts) · [地圖交接](../src/facility-navigation.ts) · [App 配置](../app.json)
- 根路由只有一組 Home／Nearby／Explore／Saved Tab。TypeScript、搜尋和探索兩語測試、單獨的搜尋／Tab 字串兩語鍵核對與 SQLite v7 語言設定保留均通過。現有原生定位為前台，Expo 配置預覽顯示前台用途說明，無 Always 鍵或背景模式。原生 VoiceOver、系統語言和大字的全 App 矩陣屬候選包驗收。
- Node `v24.0.0`。SQLite 測試顯示 Node 的實驗功能提示，測試成功。

| 實際命令 | 結果 |
| --- | --- |
| `git fetch origin develop`、`git rev-list --left-right --count origin/develop...HEAD` | 通過，0／0。 |
| `npm run typecheck`、`git diff --check` | 通過。新增報告另檢查空白。 |
| `node scripts/test-global-search.cjs`、`node scripts/test-global-search-ui.cjs`、`node scripts/test-global-search-navigation.cjs` | 全部通過。包含正式離線資料、兩語、錯誤隔離及四類導航。 |
| `node scripts/test-bus-route-map.cjs`、`python3 scripts/build-bus-route-geometry.py --check` | 通過。正式折線校驗、站序、方向、ETA 及安全降級。 |
| `node scripts/test-facility-favorites.cjs` | 通過。Registry、地圖／收藏聯動、巴士置頂與 SQLite v8。 |
| `node scripts/test-explore-places.cjs`、`node scripts/test-explore-trailhead-navigation.cjs` | 通過。八個地點、兩語、首頁入口與步道導航。 |
| `node`（stdin 只讀，載入 `weather.ts`、`weather-warnings.ts`、`i18n.ts`） | 通過。使用受控 HKO 資料驗解析、香港日界、分類和警告狀態，核對兩語鍵及跟隨系統選項。 |
| `git diff --exit-code 8bdc652e20831dd2029478b34ade0fe2e65401ee HEAD -- 'assets/data/*toilet*' 'assets/data/*park*' 'assets/data/*pet-garden*'` | 通過，設施凍結檔案相同。 |
| `EXPO_OFFLINE=1 CI=1 npx --no-install expo export --platform ios --output-dir <臨時目錄>` | 通過。1,280 個模組，Hermes bundle 5,564,013 bytes。 |
| `EXPO_OFFLINE=1 CI=1 npx --no-install expo config --type introspect --json` | 成功取得預覽。Bundle ID `com.lennystudio.kongdaily`，版本 0.1.0，推導 build 1；預覽 ATS 仍有全域及 localhost 例外。正式 archive 待驗。 |

## 5. REL-00 未結發布門檻

REL-00 原列的首頁全域搜尋 PARTIAL／P1 和巴士路線圖 MISSING／P1，現已有完整接線及本輪通過的回歸。全域搜尋另有開發者 iPhone 人工 PASS，可關閉其功能缺口。巴士路線圖仍應隨簽名候選包一起驗收原生使用。以下為本輪有證據支持的剩餘發布事項。 [REL-00 原審計](REL-00-PROJECT-COMPLETENESS-AUDIT.md)

| 優先級 | 未結事項與現有證據 |
| --- | --- |
| P0 | **隱私政策。** 目前 repo 和 App 仍缺 KongDaily 專用政策／入口，外部頁及商店設定未驗證。App Privacy 披露、SDK 資料流及候選包的 Privacy Manifest／required-reason 報告仍需確認。 [Apple 隱私政策要求](https://developer.apple.com/app-store/review/guidelines/#privacy) · [App Privacy 披露](https://developer.apple.com/app-store/app-privacy-details/) |
| P0 | **支援、簽名和商店資料。** 公開 Support URL／可聯絡方式、Apple Team／協議、App record、簽名及 TestFlight，還有雙語截圖、元資料、分級、出口合規和審核資料，沒有可核對的候選或帳號證據。外部項目維持未驗證。 [App Store Connect 欄位](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/) |
| P1 | **可重現的候選包。** repo 仍欠 EAS production profile 和品牌 App Icon 設定，版本／build 遞增待定，自訂 Splash 依視覺決定。實際 archive 的最低 iOS、Xcode／SDK、原生兩語權限、裝置矩陣、首次安裝及 v7 升級、即時服務／弱網和 VoiceOver 均待候選驗收。 |
| P1 | **ATS、既有依賴分流、分發權。** 目前 Expo 預覽仍有 `NSAllowsArbitraryLoads=true` 及 localhost 不安全 HTTP 例外，需核對正式 Info.plist。鎖檔與 REL-00 相同，當時的依賴公告分類仍未在本輪重新掃描或簽核。按官方資料來源完成使用條款與署名核對，包含新增 TD 折線；確認 Apple Maps 標誌及首頁相片特別是龍脊 CC BY-SA 署名在實際分發中可查閱。 [UI-02D2 來源及署名](UI-02D2-BUS-ROUTE-GEOMETRY-IMPLEMENTATION.md) · [首頁素材權利記錄](../assets/home/credits.md) |

已知功能限制為離線冷啟動無巴士目錄、站點反向關聯的來源覆蓋、未核實折線使用站點模式，以及 MapKit 瓦片和即時服務依連線可用性。以上在 SRCH-01 驗收範圍內有清楚降級，未發現新的 P0／P1。工作區交付只新增本報告，`develop` 仍在 `a0aac2a`。
