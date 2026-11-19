# KongDaily · REL-01C1A App 內私隱、支援及署名

2026-11-19（香港時間）。基線為 `develop` 的 `53c278ba29e4d8af86621e07d2a6eb91a5231a7e`。開始時工作區乾淨，`origin/develop...HEAD` 為 `0 0`，GitHub `refs/heads/develop` 回傳同一 SHA。REL-01C0 已提交。本輪交付可審閱材料，正式政策發佈及素材分發維持 **BLOCKED**。 [REL-01A](REL-01A-RELEASE-BLOCKER-REVALIDATION.md) · [REL-01B](REL-01B-IOS-SECURITY-REMEDIATION.md) · [REL-01C0](REL-01C0-PRIVACY-AND-ATTRIBUTION-AUDIT.md)

## 1. App 內入口和內容

沿用「收藏 → 設定」，在現有語言區之後加入「關於 KongDaily／About KongDaily」。三個文字入口使用現有根 Stack、原生返回、暖白／海港青色彩和 44pt 最小觸控高度。頁面可捲動，標題和連結可隨系統字級換行。按目前 App 語言選擇內容，無須使用網絡才能讀取。

| 入口 | 實作 |
| --- | --- |
| 私隱政策／Privacy Policy | `/settings/privacy`。說明前台權限、位置用途與手動替代，巴士／設施收藏及置頂、語言與巴士最近搜尋的本機儲存，iOS 備份與刪除，HTTPS、撤回權限及個人資料查詢。區分首頁全域搜尋的本機比對與「附近」文字查詢。後者可在輸入符合條件時自動送往地政總署，不附 GPS。列出巴士、天文台、MapKit 與外部地圖的不同資料流。 |
| 支援／Support | `/settings/support`。六項 FAQ 涵蓋 ETA、天氣、定位、離線可用範圍、移除本機收藏／搜尋，以及回報建議。沒有未核實電郵或報錯表單。 |
| 資料來源與圖片署名／Data Sources & Credits | `/settings/credits`。離線保留九巴／龍運、城巴、嶼巴、香港天文台、食環署、漁護署、康文署、公廁、公園及兩種寵物公園、運輸署折線、精選探索、地政總署與 MapKit 的來源說明。附相應原始來源和開放數據條款。附近、天氣、巴士路線圖與探索詳情的現有來源仍各自可查。外部來源只有在點按時開啟，開啟失敗會顯示相應語言提示。 |

正式政策與 Support URL 尚未存在於本地基線。兩個 App 文件清楚標示「審閱版／Review draft」，顯示內容更新日期 2026-11-19，沒有生效日期或虛構聯絡方式。詳細待填資料由本報告及網站發佈設定管理。App 頁與網站審閱版共用 [雙語文案](../content/compliance.json)。

## 2. 龍脊照片及授權

「龍脊」詳情的官方來源區之後新增「龍脊照片署名／Dragon’s Back photo credit」。入口只匹配正式內容 ID `dragons-back-to-tei-wan-tai-tam-gap`，打開 `/settings/credits?photo=dragons-back`，將完整龍脊照片記錄置於首節，方便返回原詳情。其他探索地點、官方來源選擇與步道導航沿用既有行為。

- **VERIFIED · 素材與處理。** 隨包 `assets/home/dragons-back.jpg` 是 720 × 480 JPEG，SHA-256 為 `8a03f2f99a28c0353f8e821692f2499b7215a56c83460e9ad23bc57f5d209a8a`，與 C0 比對記錄相同。照片已縮小及重新壓縮。首頁卡片用 `resizeMode="cover"` 裁切顯示，漸層是畫面覆層。實際文件、首頁及探索正式資料保持原狀。 [本地記錄](../assets/home/credits.md) · [首頁卡片](../src/components/home-ui.tsx)
- **VERIFIED · 離線署名。** 兩個入口共用 Bjørn Christian Tørrissen（Uspn）、作品名《Dragons-Back-Northwards》、Wikimedia Commons、CC BY-SA 4.0 International、兩個連結及實際改動說明。文字及連結標籤隨 App 保存。 [Wikimedia 原圖](https://commons.wikimedia.org/wiki/File:Dragons-Back-Northwards.jpg) · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- **BLOCKED · 正式分發。** CC BY-SA 4.0 允許技術性轉換。另行分發若構成改作的照片須用相同或相容授權。分發者不得施加會限制接收者行使授權權利的額外條款或有效技術措施。沒有候選包或 App Store 分發條件的足夠證據可以排除此衝突。若保留照片，先由開發者確認本機素材、任何另行發布的修改版和包含照片的商店截圖都可按條款分發，或取得作者另行授權。並行提供可自由下載的檔案本身不能證明 App 分發符合條款。 [授權條文 §2–3](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en)
- 若未能排除衝突，建議經人工批准將龍脊首頁卡片的背景換成同尺寸海港青底或有分發權的圖片，維持文字與點按入口，並從正式 bundle 與商店截圖移除原 JPEG。此替代本輪未實施。

## 3. 靜態網站與發佈檢查

查無 KongDaily 既有網站根目錄或部署配置。新增獨立的 `website/`，用 Node 內建模組產生純 HTML 和共用 CSS，無運行時腳本、追蹤標籤、表單、外部字體或登入。相對網址及目錄索引可在常見靜態 HTTPS 主機使用。六頁包括 `/` 和 `/en/` 基本資訊頁，以及 `/privacy/`、`/en/privacy/`、`/support/`、`/en/support/`。兩語切換保留對應頁面。

| 命令 | 行為 |
| --- | --- |
| `node website/build.cjs` | 產生 `website/dist/review`，顯示審閱通知及日期，含 `noindex, nofollow`，沒有 `mailto:` 或未核實域名。 |
| `node website/build.cjs --check-release` | 檢查真實 HTTPS origin、兩語營運者、Privacy／Support 聯絡信箱、生效與更新日期、網站／支援資料處理文案和批准記錄。現有資料未確認，命令按預期返回 1。 |
| `node website/build.cjs --release` | 使用相同檢查才可輸出 `website/dist/release`。本輪拒絕輸出正式網站。格式驗證只能擋遺漏或不合格欄位，須由發佈人核對所填事實及可用性。 |

本地操作記於 [網站說明](../website/README.md)。審閱版在只綁定 loopback 的短期 HTTP server 回傳 200，四個文件頁、兩個首頁、站內語言切換、回到首頁及 CSS 均通過靜態連結檢查。內嵌瀏覽器未能連上預覽，瀏覽器視覺和 iPhone 原生驗收待人工補做。未使用遠端網站服務。

## 4. 發佈前需要的證據

| 狀態 | 事項 |
| --- | --- |
| **VERIFIED** | 本機儲存行為、首頁全域搜尋與鄰近線上查詢的差異、官方服務請求欄位、目的地交接與已稽核的圖片來源，見 C0 及本輪共用文案。 |
| **REQUIRES CONFIRMATION** | 實際法定營運人及兩語名稱、公開 HTTPS 網域、Privacy／Support 可收件地址和聯絡人、適用聯絡資料、保留及刪除流程、生效／更新日期、網站託管商及郵件供應商的日誌、Cookie、附件和存取權限。 |
| **REQUIRES CONFIRMATION** | 地政總署 Location Search API 的日誌及保留期限。需追溯接收者、資料、用途，以及是否能在即時請求之外存取。政策保留此證據界線。 |
| **REQUIRES CONFIRMATION** | `react-native-maps` 精確位置收集聲明是否隨正式 Archive，以及相關資料由 Apple 或其他接收者如何處理及保留。以候選樹、原生 manifest、Xcode Privacy Report 和供應方證據核對。 |
| **BLOCKED** | 全 App「Data Not Collected」及 App Privacy 最終選項。待上述資料、SDK 與營運驗證，核對收集、資料類型、用途、是否連結身份與是否用於追蹤。 [Apple App Privacy](https://developer.apple.com/app-store/app-privacy-details/) |
| **BLOCKED** | 龍脊照片正式分發如 §2。TestFlight 和 App Store 亦仍有 REL-01A／B 列出的未完成候選包、簽名及 App Privacy 門檻。 |

### REL-01C1B 部署前置條件

1. 確認第 4 節的營運資料及適用供應方證據，審閱兩語文案，填入 `website/release.json`，保存批准記錄。若新證據改變內容，先同步編訂 App／網站共用文案。
2. 確認照片及預計商店素材的分發方式，或批准同尺寸替代。驗證正式包的 App 來源／署名、原生 manifest 和現有地圖 Legal 標記。
3. 由開發者授權部署後，於同一 revision 通過 `--check-release` 和 `--release`，只發佈 `website/dist/release`。測試所有公眾 HTTPS 網址、雙語、可無登入閱讀及實際收件。App 保留離線內容，在同一政策版本接上正式 URL、生效日及聯絡方式，再移除審閱標籤。Apple App Privacy 仍由有權限的人員核實和提交。 [Apple 審核指引](https://developer.apple.com/app-store/review/guidelines/#privacy)

## 5. 驗證及 iPhone 手動驗收

| 檢查 | 結果 |
| --- | --- |
| `npm run typecheck` | 通過，Node 22.13.0。 |
| `node scripts/test-compliance.cjs` | 通過。雙語鍵與內容段落 parity，三個根 Stack 入口的實際路由，龍脊專屬入口和署名資料、外部連結失敗提示、照片 SHA-256、六頁站內連結和發佈檢查。測試的完整發佈設定只用於臨時目錄的渲染測試。 |
| `node website/build.cjs`、`--check-release`、`--release` | 審閱版生成通過。後兩個命令因缺少已核實發佈欄位如預期退出 1，正式目錄未生成。 |
| `test-explore-trailhead-navigation`、`test-global-search-ui`、`test-global-search-navigation` | 通過。首頁及探索路由、雙語、步道導航重試、搜尋結果、附近設施地圖的狀態隔離和返回通過既有定向測試。 |
| `test-facility-favorites`、`test-explore-places`、`test-bus-route-map` | 通過。包括 SQLite v8 及設施／巴士收藏、首頁置頂、8 處探索正式內容、9 條核實折線與 ETA。 |
| `expo export --platform ios` | 本地 Metro／Hermes 導出通過，1,288 個模組，輸出在臨時目錄。這項核對不產生原生 archive。 |
| `git diff --check` 及新增檔空白檢查 | 通過。 |

1. 從「收藏」進入設定，確認原語言設定及下方三個新入口。分別以 zh-HK／English 打開，檢查大字換行、VoiceOver、返回及審閱標籤。
2. 離線讀取政策、FAQ 和署名。點按來源失敗時確認雙語提示，重回網絡後開啟實際官方網址。
3. 由首頁和探索列表開啟龍脊，確認署名入口在來源之後，作者、作品、授權、裁切／縮放及漸層均可見，返回原詳情再核對導航。其他探索地點不應出現該署名入口。
4. 抽查四個 Tab，首頁照片、巴士 ETA、天氣、附近選點及收藏操作沿用既有體驗。網站另外用手機寬度、放大文字及鍵盤查兩語切換和閱讀。

## 6. 修改文件與 Git

| 文件 | 說明 |
| --- | --- |
| [設定](../src/app/settings.tsx)、[根 Stack](../src/app/_layout.tsx)、[i18n](../src/i18n.ts) | 三個入口、Stack 標題與雙語輔助文案。 |
| [龍脊詳情所在路由](../src/app/explore/place/%5Bid%5D.tsx) | 龍脊專屬署名連結。 |
| [政策](../src/app/settings/privacy.tsx)、[支援](../src/app/settings/support.tsx)、[資料來源與圖片署名](../src/app/settings/credits.tsx)、[文件畫面](../src/components/compliance-document.tsx) | 離線閱讀及來源外連。 |
| [共用文案](../content/compliance.json)、[App 讀取層](../src/compliance-content.ts)、[署名資料](../src/compliance-credits.ts) | 雙語政策／支援和正式來源及圖片記錄。 |
| [網站生成器](../website/build.cjs)、[CSS](../website/site.css)、[發佈欄位](../website/release.json)、[網站說明](../website/README.md) | 審閱頁與發佈前置驗證。 |
| [定向測試](../scripts/test-compliance.cjs)、本報告 | 自動化檢查及交付證據。 |

`develop`、`origin/develop` 均為 `53c278b`。交付有四個已追蹤文件變更及十三個新增文件。未修改正式資產、依賴、SDK manifest、EAS、簽名或 App Store Connect。未執行正式構建、網站部署、模擬器或真機操作，亦未自行提交、推送或合併。
