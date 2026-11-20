# REL-01C1B1 · 營運者資料與網站發佈準備

核對日期為 2026-11-19（香港時間）。分支為 `develop`，HEAD、本機 `origin/develop` 與 `git ls-remote --heads origin develop` 均為 `e542b858968dede8fa197b2687f0aaa557fbc2e4`，本機與遠端差異為 `0 / 0`。開工時工作區乾淨。C1A（`f617e80`）及 C1B0（`e542b85`）均已提交。已對照 [C0 私隱與署名審計](REL-01C0-PRIVACY-AND-ATTRIBUTION-AUDIT.md)、[C1A 實作記錄](REL-01C1A-IN-APP-PRIVACY-AND-CREDITS-IMPLEMENTATION.md)、[C1B0 部署前檢查](REL-01C1B0-WEBSITE-PUBLISH-PREFLIGHT.md) 及網站實際程式。

## 已確認的營運資訊

| 項目 | 確認內容 |
| --- | --- |
| App 與公開品牌 | KongDaily、Lenny Studio。網站以 KongDaily by Lenny Studio 顯示。 |
| 營運者 | 個人開發者，政策使用開發者確認的英文名稱 `Lenny`。 |
| 支援及私隱聯絡 | 共用 `lenny996@163.com`，使用 [mailto 連結](mailto:lenny996@163.com)。 |
| 語言 | 繁體中文（香港）及 English。 |

App 和網站從同一筆 `identity.operatorName` 及同一組政策段落讀取下列文案。驗證記錄存於網站發佈配置。現有政策資料流、公開品牌與郵箱沿用原值。

> KongDaily 由個人開發者 Lenny 以 Lenny Studio 品牌提供。

> KongDaily is provided by Lenny, an individual developer operating under the Lenny Studio brand.

## 三個發佈階段

| 階段 | 檢查及產物 | 本輪結果 |
| --- | --- | --- |
| 首次公開部署前 | `node website/build.cjs --check-release` 驗證身分與聯絡資料、雙語政策、生效及更新日期、已核准的網站及支援資料處理與保留聲明、私隱及素材審批記錄。`node website/build.cjs --release` 只在通過後產出 `website/dist/release`。`origin` 可留空，首版使用相對連結並省略 canonical 標籤。 | 營運者與聯絡資料通過。其餘待核項目令正式配置繼續拒絕輸出。 |
| 實際公開 HTTPS 位址取得後 | 將正式 HTTPS origin 填入 `website/release.json`。從相同內容版本執行 `node website/build.cjs --check-live`，確認四條路徑直接回應 HTTP 200 和 HTML，內容與核准輸出一致。接受首版無 canonical 或後續正確的 canonical。 | 真實 origin 尚未分配。只以隔離資料測試成功及拒絕路徑。 |
| App Store 送審前 | 正式候選包產出 Apple Privacy Report 後，核對 SDK 精確位置聲明、接收者、用途與保留安排，完成 App Privacy 並使用已核對的公開 URL。 | 仍待候選包及接收方證據。網站 Gate 的結果不代替候選包審核。 |

四條路徑為 `/privacy/`、`/en/privacy/`、`/support/`、`/en/support/`。Vercel 設定建議使用儲存庫根目錄、Other preset、Node.js 22、install command `true`、build command `node website/build.cjs --release` 和輸出目錄 `website/dist/release`。實際公開網址須容許上述路徑帶尾斜線直接讀取。首度取得的網址須核對為正式公開 origin，確認可直接讀取後才用於 App 或 App Store Connect。郵箱收信須另行由營運者確認。 [Vercel 專案設定](https://vercel.com/docs/project-configuration) · [Vercel 產生的網址](https://vercel.com/docs/deployments/generated-urls)

## 尚未解除的私隱及素材事項

| 事項 | 狀態及需要的證據 |
| --- | --- |
| 地政總署線上地點搜尋 | **REQUIRES CONFIRMATION**。既有政策已描述會向地政總署送出查詢文字。接收方的日誌、存取及保留安排仍需可追溯證據。 |
| 網站、支援郵箱及資料保留 | **BLOCKED**。部署前核實主機日誌、郵箱及附件處理、保留及刪除方式，完成各自的雙語核准段落、有效日期及審批記錄。 |
| `react-native-maps` / Apple Privacy Report | **REQUIRES CONFIRMATION**。沿用 C0 的 manifest 證據，需以正式 Archive 核對聚合聲明並核實接收者及資料實踐。 |
| App Privacy | **BLOCKED**。目前未取得推導整體申報所需證據。尤其尚未能批准 `Data Not Collected`。 [Apple App Privacy 指引](https://developer.apple.com/app-store/app-privacy-details/) |
| 正式公開 HTTPS 位址 | **UNVERIFIED**。在完成首次核准部署後測試，不先用推測域名填寫正式設定。 |
| 龍脊照片正式分發 | **BLOCKED**。現有來源與署名已核對。仍需獨立記錄相同方式共享及下游限制的分發處置，或核准替代方案。 |

### 龍脊照片

原作為 *Dragon’s Back Northwards*，作者 Bjørn Christian Tørrissen（Uspn），來源記錄授權為 CC BY-SA 4.0。App 使用的 `assets/home/dragons-back.jpg` 為 720 × 480 的縮放和重新壓縮版本，首頁使用 `cover` 顯示裁切及漸層覆蓋。該檔案的 SHA-256 為 `8a03f2f99a28c0353f8e821692f2499b7215a56c83460e9ad23bc57f5d209a8a`，與 C1A 基線一致。龍脊詳情及 App 資料來源頁均提供現有署名和連結。 [Wikimedia Commons 原作](https://commons.wikimedia.org/wiki/File:Dragons-Back-Northwards.jpg) · [庫內素材記錄](../assets/home/credits.md)

CC BY-SA 4.0 第 2(a)(4) 條允許必要的技術修改。第 2(a)(5)(C) 及 3(b) 條仍須納入正式分發審核，包括下游限制，以及分發改作時適用的相同方式共享。若無法確認正式 App 分發滿足條款，建議經人工批准後僅替換首頁龍脊照片，使用既有色票的背景，保留卡片尺寸、內容和路由，並移除打包圖片和受影響的發布截圖。此方案尚未套用。 [CC BY-SA 4.0 法律條文](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en)

## 變更與驗證

| 檔案 | 變更 |
| --- | --- |
| `content/compliance.json`、`content/compliance-policy.js` | 設定單一營運者名稱，供兩種語言的共用政策段落讀取。 |
| `src/compliance-content.ts` | App 政策使用同一共用文案輸出。 |
| `website/release.json`、`website/build.cjs` | 記錄開發者確認，分開首次輸出與公開網址檢查。 |
| `website/README.md` | 記錄發佈各階段、Vercel 構建及候選包核對條件。 |
| `scripts/test-compliance.cjs` | 驗證 App 與網站文案相同、四路徑、mailto、照片與發佈檢查。 |
| `docs/REL-01C1B1-LEGAL-IDENTITY-AND-WEBSITE-READINESS.md` | 本輪核對記錄。 |

| 檢查 | 結果 |
| --- | --- |
| `npm run typecheck`、`node --check website/build.cjs` | 通過。 |
| `node scripts/test-compliance.cjs` | 通過。涵蓋 i18n、App 頁及網站共用政策、四條路徑及郵箱、署名，以及隔離資料的正式 gate 和 HTTPS 回應校驗。 |
| `node website/build.cjs` | 成功產出本機審閱版。內置 draft 標記和 `noindex`，正式輸出測試確認不帶上述標記。 |
| 瀏覽器響應檢查 | 四頁於 390 px 和 1280 px 載入，文件與視窗寬度一致，未有橫向溢出。 |
| 實際 `--check-release`、`--release`、`--check-live` | 均按設計以退出碼 1 停止。部署前缺八項政策輸入與審批，部署後檢查缺實際 HTTPS origin，未發出請求。 |
| `node scripts/test-explore-trailhead-navigation.cjs`、`node scripts/test-global-search-navigation.cjs`、`node scripts/test-facility-favorites.cjs` | 通過。涵蓋探索起點導航、搜尋路由、SQLite v8、設施收藏及巴士置頂回歸。 |
| `git diff --check` | 通過。 |

完成時工作區包含上表八個改動檔案，HEAD 維持 `e542b85`。網站目前供本機審閱，公開部署及 App Store 送審仍待上述證據。未使用 iOS 模擬器、真機、遠端部署或 App Store Connect，未提交或推送。
