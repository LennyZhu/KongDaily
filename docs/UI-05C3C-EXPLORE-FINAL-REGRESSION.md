# KongDaily · UI-05C3-C 探索模組最終回歸

**結論：PASS WITH NOTES。** 在 2026-11-19（香港時間）執行的資料、程式、路由、定向回歸及 iOS Metro 檢查均通過，未發現阻塞問題。iPhone 原生互動、無障礙朗讀及即時服務仍待人工抽查。本報告供探索 1.0 最終審核。

## Git 基線與範圍

- 工作分支為 `develop`，實際 HEAD 為 `7b743a94cf74927478fc1da37a267587e9491f42`。
- `git fetch origin develop` 成功。HEAD、`origin/develop`、`FETCH_HEAD` 指向同一提交，分歧為 0／0。初始 `git status --short` 無輸出。
- UI-05C3-D、UI-05C3-E 報告、正式導航資料、詳情實作與定向測試均已納入 `7b743a9`。UI-05C3-A 及 UI-05C3-B 分別在 `4aa8452`、`c30845f`。[座標複核](UI-05C3D-NAVIGATION-POINT-VERIFICATION.md) · [正式導航實施](UI-05C3E-TRAILHEAD-NAVIGATION-IMPLEMENTATION.md)
- 本輪審計探索離線資料、列表、詳情、首頁聯動、兩處起點導航、兩語及無障礙接線，並對巴士、天氣、附近、收藏、四個主 Tab 和 SQLite 做輕量回歸。交付差異限於本報告。

## 正式資料完整性

| 核對 | 結果 |
| --- | --- |
| 正式地點及穩定 ID | 8 筆、8 個唯一 ID，繁中及英文名稱、地區、簡介、看點、交通、注意事項齊全 |
| 看點及既有來源 | 18 條雙語看點、39 個唯一官方 HTTPS 來源 URL。證據引用可解析，URL 以靜態規則校驗 |
| 全部與分類 | 全部 8、`parks` 4、`hiking` 2、`waterfront` 3、`pets` 2 |
| 跨分類身份 | 西九藝術公園共用 `west-kowloon-art-park`（`waterfront`／`pets`）。大埔海濱公園共用 `tai-po-waterfront-park`（`parks`／`waterfront`）。山頂花園共用 `victoria-peak-garden`（`pets`／`parks`）。每類及全部列表內各 ID 均唯一 |
| 與 UI-05C3-B 資料逐欄比對 | 只有核准的兩個 `navigation` 物件有差異。分類、排序、原文、證據及其餘六筆狀態均一致 |
| 離線 | 列表、分類與詳情直接讀取隨 App 打包的 JSON。Node 定向測試使用本機資料並限制執行期匯入。官方資料網頁及 Apple Maps 路線由外部服務處理 |

正式 JSON SHA-256 為 `4fe0b53ccc89843ca557b2af738e81bc9d3e579d2d772d1575b26fc8740f62d2`。兩個 GPX 位於導航資料的證據欄位，獨立於原有 39 個來源 URL。[正式資料](../assets/data/explore-places.json) · [探索資料測試](../scripts/test-explore-places.cjs)

## 探索與首頁回歸

| 項目 | 結果及證據 |
| --- | --- |
| 分類及清除 | 實際列表元件在兩語重現 8／4／2／3／2 筆。「查看全部／View all」只在分類選中時出現，點按會清除篩選。重按相同分類也能清除，未知分類回到全部 |
| 進入詳情與返回 | 實際卡片按下後以穩定 ID 推入根 Stack 的 `explore/place/[id]`。檔案路由和 Stack reducer 驗證返回時原 Tab 與分類狀態保留。列表的捲動重置只依賴分類變更，另有原卡片的 VoiceOver 焦點恢復程式 |
| 詳情內容與無效 ID | 八處都有正確的兩語名稱、簡介、正式看點、交通及注意事項。未知 ID 顯示「此地點資料暫不可用」及返回探索，沒有導航入口 |
| 官方資料 | 實際來源區塊每頁 1–2 條、不重複。每語各共 14 個顯示連結，首要來源為當前語言或雙語。英文龍脊的補充山徑公告標註繁中，標註同時出現在可見文字和無障礙名稱。替身驗證點按把所選官方 URL 交給系統 |
| 首頁精選卡 | 兩語實際卡片讀取同一正式資料。龍脊為 `dragons-back-to-tei-wan-tai-tam-gap`，西九為 `west-kowloon-art-park`。全卡點按進入正確詳情，返回保留首頁 Tab。兩張照片與 UI-05 前基線的檔案內容一致，漸層、裁切方式及原有最小高度樣式仍相同 |
| 首頁快捷入口 | 行山郊遊開啟 `hiking`（2 筆），海濱景點開啟 `waterfront`（3 筆），瀏覽更多傳入空分類（8 筆）。巴士、公廁、寵物公園、普通公園快捷入口仍解析到既有路由 |
| UI-05B 規格 | 已實際查看三張列表、行山詳情、海濱詳情稿，並對照程式結構。原四分類、圓角卡、抽象分類圖及四 Tab 保留。詳情依正式規格加入看點，合資格的緊湊導航區隨內容捲動，未核實的海濱詳情沿用資料及官方來源 |

[探索列表](../src/app/%28tabs%29/explore.tsx) · [地點詳情](../src/app/explore/place/%5Bid%5D.tsx) · [首頁](../src/app/%28tabs%29/index.tsx) · [UI-05B 設計及參考圖](UI-05B-EXPLORE-DESIGN-REVIEW.md)

## 導航安全

| 核准 ID | WGS84（緯度、經度） | 場景及固定 URL |
| --- | --- | --- |
| `dragons-back-to-tei-wan-tai-tam-gap` | `22.2270299568, 114.2397903557` | 土地灣港島徑步道入口。[Apple Maps 步行](https://maps.apple.com/directions?destination=22.2270299568,114.2397903557&mode=walking) |
| `peak-circle-walk` | `22.2712927825, 114.1494947398` | 凌霄閣西側盧吉道入口。[Apple Maps 步行](https://maps.apple.com/directions?destination=22.2712927825,114.1494947398&mode=walking) |

- 腳本固定核對兩筆座標、WGS84、`trailhead`、完整 URL 及 `mode=walking`；無效範圍、經緯度互換、錯誤 CRS、非起點類別及其他 ID 都被攔截。座標直接取自隨 App 發佈的資料。六處 `unverified` 和未知 ID 均完全隱藏導航區。
- 平台替身驗證 iOS 18.3.2 隱藏，18.4、18.10、26.0 顯示。非 iOS 隱藏。雙語核對「步道起點／Trailhead」「步行至起點／Walk to trailhead」及已批准的精簡說明。按鈕為 44 pt 最小高度，VoiceOver 標籤包含操作及目的地。
- 模擬系統開啟失敗後收到雙語提示，快速連點只發出一次開啟，重試使用相同 URL。開啟與重試均無內部路由操作，App 只傳目的地。使用者已於早前驗收 Apple Maps 的兩處針點和步行路線，本輪以程式驗證發出的資料相同。[正式導航測試](../scripts/test-explore-trailhead-navigation.cjs) · [使用者早前回報](UI-05C3D-NAVIGATION-POINT-VERIFICATION.md)

## 雙語與無障礙

- 兩語測試使用實際字典。英文篩選鍵顯示 Parks、Hiking、Waterfront、Pet-friendly，探索列表卡片及詳情使用完整分類名稱。全局 `LanguageProvider` 仍使用 SQLite 語言偏好與系統語言解析。原生設定切換列入人工回歸。
- 英文長標題、詳情正文與緊湊起點行保留自然換行及字體縮放。定向測試核對窄屏 320 pt 及大字倍率 1.55 時分類改為單欄、卡片採緊湊插畫。列表以最小高度而非固定高度排版。首頁照片卡沿用既有兩行標題、單行分類與倍率上限，其完整名稱保留於無障礙標籤，顯示效果待 iPhone 抽查。
- 靜態核對分類勾選及 VoiceOver 選中狀態、列表全卡操作名稱、官方連結的名稱及外開提示。浮動 Tab 保留獨立安全區及名稱／選中狀態，列表底部保留 Tab 避讓間距，詳情使用原生標題列及底部安全區。[全局語言](../src/language.tsx) · [共用頁面](../src/components/ui.tsx) · [浮動 Tab](../src/components/floating-tab-bar.tsx)

## 既有模組回歸

| 範圍 | 已核對 |
| --- | --- |
| 首頁巴士與快捷操作 | 首頁依然將置頂巴士交給同一個 `HomeFavoriteBus`／ETA hook。SQLite 回歸驗證巴士收藏、快捷收藏、取消、置頂上限及順序獨立，保存不自動置頂。首頁與巴士實際網絡 ETA 待在線抽查 |
| 天氣及警告 | 兩語定向檢查實際首頁天氣入口、三天預覽開啟九天天氣、測試資料下三筆預覽與九筆完整列表，以及天氣警告路由。亦驗證首頁無警告狀態隱藏、未能確認時可開啟警告頁。原解析、請求與快取從 UI-05 前基線至今相同，即時官方回應未測 |
| 附近設施 | 960 FEHD、167 AFCD、48 普通公園、36 寵物專用、45 寵物共享，共 1,256 筆及 1,256 個唯一身份。五份索引和五份 Registry 與凍結提交 `8bdc652e` 逐檔相同。已執行實際分類／距離排序（1,256／1,127／48／81）、聚合預算最多 100、保留選中標記、離線雙語搜尋、手勢與程式鏡頭移動區分及 GPS 定向替身檢查。GPS 權限、MapKit 操作及地政總署線上搜尋待 iPhone 抽查 |
| 收藏與 SQLite | 既有實體臨時 SQLite 測試覆蓋 v8 初始化、v7 升級及回滾、離線持久化、設施書籤、收藏 Tab 到附近定位選中、巴士快捷收藏及置頂。資料庫 Schema 仍為 v8，沒有新增 Migration |
| 架構與四 Tab | 從實際路由檔解析首頁、附近、探索、收藏及 Stack 詳情，雙語 Tab 數及名稱正確。套件、鎖定檔、Expo 設定、語言持久化、資料庫、巴士及天氣和附近業務程式與 UI-05 前的 `8c53b9a` 相同。未引入後端或新的執行期外部資料依賴 |

[SQLite 與收藏回歸測試](../scripts/test-facility-favorites.cjs) · [設施前次凍結報告](UI-04D3-NEARBY-FAVORITES-FINAL-GATE.md)

## 執行命令及結果

| 命令／方法 | 結果 |
| --- | --- |
| `git fetch origin develop` 及 Git 基線核對 | PASS |
| `npm run typecheck` | PASS |
| `node scripts/test-explore-places.cjs` | PASS，8 筆、4 分類、18 條雙語看點、39 來源、2 核准、6 未核實 |
| `node scripts/test-explore-trailhead-navigation.cjs` | PASS，兩語、固定座標及平台門檻、外開失敗重試、首頁及分類堆疊 |
| `node scripts/test-facility-favorites.cjs` | PASS，Node SQLite、v8 遷移、設施與巴士收藏 |
| `python3 scripts/check-toilet-identities.py fehd`、`python3 scripts/check-toilet-identities.py afcd` | PASS，960／167 筆 |
| 臨時 Node 定向探針 | PASS，兩張首頁卡與各入口、四分類、每處來源語言、窄屏與大字分支、天氣路由、四 Tab、附近距離／聚合／定位及對照資料 |
| `CI=1 EXPO_OFFLINE=1 EXPO_NO_TELEMETRY=1 ./node_modules/.bin/expo export --platform ios --output-dir <暫存目錄> --max-workers 2` | PASS，產出 iOS Hermes bundle |
| `git diff --check`、`git diff --check 8c53b9a..HEAD`、新增文件空白核對 | PASS |

## iPhone 尚待驗收

1. 從首頁開啟龍脊和西九卡，分別用返回鍵及邊緣手勢返回，確認原頁捲動位置。探索分類列表中選中地點後返回，確認篩選、原位置及 VoiceOver 焦點。
2. 逐一由 KongDaily 開啟兩條 Apple Maps 路線，再切回 App，確認原頁捲動與焦點。實際交接、地圖針點及路由為原生行為，本輪自動化只核對輸入 URL 和內部堆疊。
3. 切換繁中、English 及跟從系統，以窄屏、較大字級及 VoiceOver 抽查長標題、精簡起點資訊、官方連結語言、四個 Tab 及底部安全區。
4. 飛航模式確認八處內容仍可讀。恢復網絡後抽查官方連結、附近定位／地圖與地政總署搜尋、收藏定位、首頁巴士 ETA、天氣及九天預報和警告。即時服務結果與本機探索內容分開判定。

## 問題與簽核

| 嚴重度 | 結果 |
| --- | --- |
| P0／資料或安全阻塞 | 0。已執行的資料、座標、資料庫及其他檢查未見損毀或錯置 |
| P1／主要功能回歸 | 0。已執行檢查未見首頁、探索、導航或收藏路徑阻塞 |
| P2／非阻塞缺陷 | 0 個可重現問題。原生外觀、系統返回與即時服務屬待驗範圍，建議按前述清單完成抽查 |

**最終審計結論為 PASS WITH NOTES。** 本輪靜態與自動化回歸完成，探索 1.0 的最終人工簽核待確認。
