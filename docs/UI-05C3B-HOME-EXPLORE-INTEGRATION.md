# KongDaily · UI-05C3-B 首頁精選內容正式聯動

## 實作

首頁「精選探索」的兩張圖片卡以現有 `homeFeaturedPlaceIds` 解析本機探索資料。卡片使用同一筆地點的雙語正式名稱，副標題沿用探索篩選按鈕的短分類文案，配合既有單行版位。兩張卡沿用原照片、漸層、圓角、尺寸規則及順序。整張卡可點按，VoiceOver 使用完整地點名稱及分類。重複的首頁地點文案已從雙語字典移除。

| 首頁卡片 | 正式內容 ID | 路由 |
| --- | --- | --- |
| 龍脊／Dragon’s Back | `dragons-back-to-tei-wan-tai-tam-gap` | `/explore/place/[id]` |
| 西九文化區藝術公園／Art Park (West Kowloon Cultural District) | `west-kowloon-art-park` | `/explore/place/[id]` |

首頁透過既有 `HomeLink` 呼叫 Expo Router `navigate`，以路由參數傳入解析後的地點 ID。詳情繼續從 UI-05C1 的離線資料讀取內容，不需要網絡。西九在海濱及寵物分類共用同一 ID。八筆正式資料的導航欄位均為 `unverified`，此階段只接通 App 內頁。[首頁](../src/app/%28tabs%29/index.tsx) · [卡片組件](../src/components/home-ui.tsx) · [資料讀取](../src/explore-places.ts) · [正式 JSON](../assets/data/explore-places.json)

首頁「行山郊遊」及「海濱景點」繼續傳入 `hiking`、`waterfront` 分類，分別顯示 2、3 筆。「瀏覽更多」繼續傳入空分類，顯示全部 8 筆，亦可清掉上次在探索 Tab 的篩選。[探索列表](../src/app/%28tabs%29/explore.tsx)

## 返回行為

詳情頁位於根 Stack 的 Tabs 之上。從首頁開啟時，原首頁 Tab 留在堆疊中，由原生返回按鈕或 iOS 邊緣手勢回到原 Tab。探索列表仍採用自身既有 `push`、分類和焦點恢復邏輯，返回時保留原列表。在可返回的有效詳情使用原生返回。未知 ID 仍顯示既有地點不可用提示與「返回探索」入口，直接進入而沒有歷史記錄時也保留它的返回入口。[根 Stack](../src/app/_layout.tsx) · [探索詳情](../src/app/explore/place/%5Bid%5D.tsx)

## 修改文件

- [首頁](../src/app/%28tabs%29/index.tsx) 將兩張原有圖片卡綁定穩定 ID、正式名稱、短分類及詳情路由。
- [首頁卡片](../src/components/home-ui.tsx) 使用既有可點按容器及完整無障礙名稱。
- [探索資料讀取](../src/explore-places.ts) 保留兩個既有 ID，移除它們對首頁重複字典的型別依賴。
- [雙語字典](../src/i18n.ts) 移除原來兩張卡的重複名稱與摘要。
- [探索資料測試](../scripts/test-explore-places.cjs) 核對首頁 ID 能對應正式資料，兩種語言皆有可用的短分類，並保留原有清單測試。
- 本實施記錄。

## 驗證

| 檢查 | 結果 |
| --- | --- |
| `npm run typecheck` | 通過 |
| `node scripts/test-explore-places.cjs` | 通過。涵蓋 8 筆正式資料、四個篩選、雙語內容、穩定 ID、39 個官方 HTTPS 來源及 0 個正式導航點 |
| 首頁與探索路由定向檢查 | 通過。用 Node 呼叫實際 TSX 點按處理，配合從檔案路由產生的連結配置及已安裝的 Stack reducer，核對兩張卡片的精確 ID、原有圖片、雙語名稱及詳情摘要、分類入口數量、首頁及探索返回時的原 Tab／分類，以及未知 ID 提示 |
| `git diff --check` 及新增文件空白檢查 | 通過 |
| 正式離線 JSON | SHA-256 與 HEAD 一致，八筆仍為 `unverified` |

定向檢查未掛載 iOS 原生畫面。實際邊緣手勢、ScrollView 位置、VoiceOver、飛航模式及英文長標題排版由下列步驟驗收。

## iPhone 人工驗收

1. 在首頁滑到精選探索，分別點按龍脊和西九圖片，核對詳情名稱、內容和既有圖片位置。由一頁按原生返回，由另一頁用左側邊緣手勢，確認均回到首頁原來位置。
2. 由首頁點按「行山郊遊」及「海濱景點」，確認正確篩選及各自 2、3 筆結果。從篩選列表開啟詳情再返回，確認原篩選及滾動位置。以「瀏覽更多」進入時確認顯示全部 8 筆。
3. 切換 English，核對卡片短分類、詳情原文，以及 VoiceOver 能朗讀完整地點名稱。以較大系統字級檢查西九長標題和卡片識別。
4. 在飛航模式下，從首頁開啟兩個詳情，應可閱讀正式內容，且沒有外部地圖導航按鈕。

## Git 狀態

`develop` 的 HEAD 為 `7eb269acfccba6fa47e7762ce6f39e85c15a962d`，與本機 `origin/develop` 追蹤參照一致。工作區含五個本輪修改的追蹤文件、本實施記錄，以及開始前已存在的未追蹤 [UI-05C3-A 審計報告](UI-05C3A-NAVIGATION-AUDIT.md)。
