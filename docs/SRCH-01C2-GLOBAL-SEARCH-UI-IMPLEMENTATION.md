# KongDaily · SRCH-01C2 全域搜尋頁面與真實結果

## 基線與修改檔案

開工時 `develop` 工作區乾淨。已執行 `git fetch origin develop`，HEAD、`origin/develop`、`FETCH_HEAD` 均為 `fb339675a2fff68c2b44aebfa6287d170a605988`，分歧 0／0。該提交包含 C1 資料層、定向測試及三張 SRCH-01B 高保真。[SRCH-01A 審計](SRCH-01A-GLOBAL-SEARCH-AUDIT.md) · [SRCH-01B0 導航契約](SRCH-01B0-SEARCH-NAVIGATION-CONTRACT.md) · [SRCH-01C1 實作](SRCH-01C1-GLOBAL-SEARCH-DATA-IMPLEMENTATION.md)

| 檔案 | 變更 |
| --- | --- |
| [搜尋頁](../src/app/search.tsx) | 單一受控搜尋框、初始頁、狀態、分組虛擬列表、查看全部、返回混合結果及每類捲動位置。 |
| [結果列](../src/components/global-search-result-row.tsx) | 四類正式資料的圖示、名稱與副資訊。組件直接接原型別 `GlobalSearchResult`。 |
| [巴士目錄 Hook](../src/bus-hooks.ts) | 增加可選的啟用參數，讓全域搜尋在首個有效查詢才啟用目錄。巴士專頁的預設呼叫方式繼續載入目錄。 |
| [雙語字串](../src/i18n.ts)、[主題](../src/theme.ts) | 新增搜尋所需的兩語文案和暖白色背景 token。 |
| [搜尋 UI 定向測試](../scripts/test-global-search-ui.cjs) | 以實際 C1 搜尋、正式打包資料、目錄 Hook 和受控原生替身驗證完整畫面狀態。 |

## 高保真對照

| 已實際查閱的檔案 | 採用與差異 |
| --- | --- |
| [搜尋初始頁](design/srch-01b-search-initial-review.png) | 沿用原生 Stack 標題、單一白色圓角搜尋框、置中導言及四類淺色說明卡。專案現有相片資產與插畫風格不同，採小型 SF Symbols 組合呈現巴士、建築、海港與樹木，圖形高度 76pt。四類介紹以靜態文字呈現。 |
| [混合結果頁](design/srch-01b-search-results-review.png) | 沿用輸入後的淺青搜尋框、左側分組圖示、右側查看全部，以及白色圓角輕量結果列。圖稿示例由 C1 實際命中取代。結果列採靜態呈現，省略會暗示跨頁導航的箭頭。車站以營辦商、街道或官方 ID 區分；設施沒有搜尋起點時以正式地區／地址補充。 |
| [設施地圖](design/srch-01b-facility-map-review.png) | 已查閱地圖針點、底部卡與原生返回的版面。本階段交付設施搜尋列及原 Registry 識別。地圖與定位互動由 SRCH-01C3 的薄 Stack 接入。 |

## 資料、狀態與列表

- 空白查詢顯示導言。有效搜尋詞在 180 ms 防抖後交給 `searchGlobal`。畫面以輸入編號隔離當前結果，輸入一改即停止展示舊結果。輸入上限取自 C1 的 80 個字元單位，正規化、排名與比對全部沿用 C1。鍵盤搜尋鍵可立刻送出當前詞，清除後回初始頁。
- 目錄在首次需要巴士路線時啟用 `useBusCatalogue`，沿用 24 小時快取、在途去重及失敗營辦商重試。首次需要站點時才呼叫 `loadGlobalBusStops`，並保留該搜尋頁實例的索引。設施及探索沿用離線包；輸入文字不會重新發出營辦商查詢。
- 混合結果在 C1 回傳的順序中每組取前五筆，只有有結果的組別才產生標題及卡片。`totalMatches > 5` 顯示該組「查看全部」。切換至 C1 單類搜尋可顯示最多 30 筆路線或站點、15 筆設施、8 筆探索；超出單類上限時顯示已顯示／命中總數與縮窄搜尋提示。結果以穩定 `key` 在單一虛擬化 `FlatList` 呈現。
- 目錄未載入、資料準備中、部分營辦商可用、使用舊目錄、失敗及完全無匹配各有兩語狀態。巴士或站點失敗仍顯示其他命中。若有資料來源未能提供結果，零筆提示只描述已載入的資料；服務失敗訊息不推斷裝置連線狀態。
- 關鍵詞、輸入版本、分類及本地索引都保存在既有 `/search` 實例。相同關鍵詞內按分類記錄 `FlatList` 偏移，切入單類後可從搜尋框下方返回混合結果，恢復其偏移；遲到的舊列表捲動事件不覆寫已保存的位置。清除或改詞重新開始列表位置。兩語切換重新呈現現有結果及身份。原生鍵盤避讓、列表實際位置及大字版面仍需 iPhone 檢查。

## SRCH-01C3 接入

搜尋列持有完整 C1 結果，後續可在既有 renderItem 上接上結果動作。巴士路線用 `route.id` 打開 `/bus/route`；巴士站用來源和 `stopId` 打開 `/bus/nearby/stop`；精選地點用 `place.id` 打開詳情；設施用 `source + stableFacilityId` 由新薄 Stack 校驗 Registry，沿用 `NearbyFacilitiesMap`。各目的頁 push 在 `/search` 上方，原生返回沿用同一搜尋實例。iOS 邊緣手勢、導航返回後的偏移與位置重排是 C3 的驗收項。[完整導航契約](SRCH-01B0-SEARCH-NAVIGATION-CONTRACT.md)

## 自動化驗證

| 檢查 | 結果 |
| --- | --- |
| `npm run typecheck` | 通過。 |
| `node scripts/test-global-search.cjs` | 通過，包含 7,841 站、1,256 設施、8 個探索地點與 SQLite 離線讀取。 |
| `node scripts/test-global-search-ui.cjs` | 通過。涵蓋首頁按鈕、初始頁、四類真實比對、五筆上限、展開至 30 筆、返回原偏移、清除、防抖競態、兩語、零命中、快取／未載入、失敗及部分可用、重試與虛擬列表。營辦商與原生介面採替身，正式比對使用 C1。 |
| `node scripts/test-bus-route-map.cjs`、`node scripts/test-facility-favorites.cjs` | 通過，包含巴士、ETA、SQLite v8 及既有收藏。 |
| `node scripts/test-explore-places.cjs`、`node scripts/test-explore-trailhead-navigation.cjs` | 通過，包含探索資料、首頁既有連接和步道導航。 |
| `git diff --check` | 通過。 |
| `EXPO_OFFLINE=1 CI=1 npx --no-install expo export --platform ios --output-dir <臨時目錄>` | 通過。1,276 模組，Hermes bundle 5,545,932 bytes。 |

## iPhone 人工驗收

1. 從首頁打開「全域搜尋」。確認原生返回、單一搜尋框、緊湊圖形與四類說明，打開畫面時呈現空白導言。
2. 查 `香港`、`268X` 及 `Dragon's Back`。核對真實匹配、營辦商及變體，快速改詞時應看到搜尋狀態後再出現當前結果。用清除鍵恢復導言。
3. 使用命中多筆的詞（如 `公園`），在不同捲動位置點「查看全部」，核對單類筆數和返回混合結果的位置。用英文及大字檢查列文字和分類按鈕換行、鍵盤收起、底部安全區及 VoiceOver。
4. 在無巴士目錄快取的離線情況查 `香港公園`。確認巴士目錄提示與本地結果可同時出現；恢復網絡後重試。使用無命中詞核對零筆狀態，以及已無營辦商錯誤時的完整空態。
5. 抽查原首頁、專項巴士搜尋和探索入口。搜尋結果跨頁及設施地圖留待 SRCH-01C3。

`develop` 的 HEAD 與 `origin/develop` 仍為 `fb33967`。修改留在工作區。Git 核對 C1 匹配核心、官方資料、核准圖片、首頁、四個 Tab、路由結構與 ETA 均與基線一致。原生畫面與手勢由開發者驗收，本輪未啟動模擬器或真機。
