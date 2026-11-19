# KongDaily · REL-01C1B0 公開網站發佈前檢查

2026-11-19（香港時間）。`develop`、本機 `origin/develop` 和透過 `git ls-remote` 核實的 GitHub `refs/heads/develop` 均為 `f617e80974c98559baa28e05791c6b87a139e4bf`，相差 `0 0`。開工時工作區乾淨，REL-01C1A 已提交並推送。 [REL-01C0](REL-01C0-PRIVACY-AND-ATTRIBUTION-AUDIT.md) · [REL-01C1A](REL-01C1A-IN-APP-PRIVACY-AND-CREDITS-IMPLEMENTATION.md)

## 1. 品牌、聯絡與法定營運者

| 項目 | 結果 |
| --- | --- |
| **VERIFIED** · 產品及品牌 | 開發者確認產品為 KongDaily（港日常），網站標題、頁首、頁尾統一顯示 **KongDaily by Lenny Studio**。中英文政策及網站首頁說明它是由個人開發者以 Lenny Studio 品牌提供的獨立 App。政策範圍限於 KongDaily。 |
| **VERIFIED** · 聯絡 | 開發者確認 Privacy 和 Support 均使用 `lenny996@163.com`。單一共用設定供 App 與網站使用，兩語政策和支援頁各在聯絡段顯示真實的 `mailto:`。測試只驗證連結和 iOS 交接參數；正式對外前另驗實際收件。 |
| **BLOCKED** · 法定姓名 | `website/release.json` 的 `operator.zh-HK`、`operator.en` 及 `operatorVerificationReference` 仍為空。待開發者核實精確法定姓名及兩語呈現。檢查會拒絕單獨填入 Lenny Studio、KongDaily 或完整品牌標語作法定營運者。審閱版只寫已確認的營運類型。 |
| **REQUIRES CONFIRMATION** · 公開網址及生效日 | 正式 origin 未分配及核實。發佈設定的 `origin`、`effectiveOn` 及 `updatedOn` 仍空白。審閱版使用內容更新日期，App 及 App Store Connect 沒有接上任何猜測的網址。 |

## 2. 網站路由與 App 一致性

| 語言 | 私隱政策 | 支援 |
| --- | --- | --- |
| 繁體中文（香港） | `/privacy/` | `/support/` |
| English | `/en/privacy/` | `/en/support/` |

沿用 `/` 和 `/en/` 導覽首頁及現有純 HTML／CSS 排版，兩語切換留在相同頁類。App 仍在「收藏 → 設定 → 關於 KongDaily」離線讀取同一份政策及支援文案，使用既有原生外部開啟及失敗提示。審閱版同時顯示已確認郵箱及審閱狀態。

- 首頁全域搜尋在裝置上比對。附近地點搜尋會將合資格文字自動發給地政總署，可能包括用戶輸入的地址。該請求沒有附送 GPS。
- 兩語同樣保留地政總署日誌期限尚未核實，以及地圖 SDK 精確位置聲明待正式歸檔核對的說明。資料來源、圖片署名和現有 App 路由沿用已驗收的實作。

## 3. 尚未解除的私隱及素材阻塞

| 事項 | 狀態及所需證據 |
| --- | --- |
| 地政總署地點搜尋 | **REQUIRES CONFIRMATION**。待核對日誌、接收者、可存取期間與用途。現有 C0 和共用文案保留這項證據界線。 |
| 私隱保留聲明 | **BLOCKED**。待確認託管和支援郵件服務的日誌、收件內容及附件、處理目的、保留與刪除方式。補兩語 `siteAndSupportPrivacy`、`retentionDisclosure` 和私隱審核引用。 |
| MapKit／SDK | **REQUIRES CONFIRMATION**。`react-native-maps` 的精確位置收集聲明仍要比對正式 Archive、實際接收者及保留情形。SDK manifest 維持現狀。 |
| App Privacy | **BLOCKED**。等待供應方和 Archive 證據，由授權人核對最終申報；本輪不能批准整個 App 的「Data Not Collected」。 [Apple App Privacy](https://developer.apple.com/app-store/app-privacy-details/) |
| 龍脊照片及需要清權的素材 | **BLOCKED**。已核實來源、CC BY-SA 4.0 與 App 內署名，正式分發方式須獨立確認。照片 SHA-256 仍為 `8a03f2f99a28c0353f8e821692f2499b7215a56c83460e9ad23bc57f5d209a8a`。留待確認 App／商店素材使用和分發條件，或批准替代／移除，再填入獨立 `assetRightsApprovalReference`。網站 HTML 無照片資產，正式 Gate 按此階段要求仍須取得適用範圍的素材放行記錄。 [CC BY-SA 4.0 第 2–3 節](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en) |

## 4. Gate 與 Vercel 部署順序

`node website/build.cjs` 產生 `website/dist/review`，不依賴域名、法定姓名或正式保留文案，保留審閱標籤和 `noindex, nofollow`。兩個正式命令 `node website/build.cjs --check-release` 和 `node website/build.cjs --release` 共用同一驗證，兩者現時均返回 1。未生成 `website/dist/release`。

Gate 核對品牌、個人開發者類型、共用聯絡郵箱格式、兩語政策及 FAQ 必要段落、有效日期、已批准 HTTPS origin、具名法定營運者與核實引用、兩語保留及刪除文案，以及私隱與素材的獨立審核引用。正式頁的 canonical URL 由有證據的 origin 與實際路徑生成。Gate 可核對格式、欄位和頁面對應；域名控制權、收件、審核事實及已部署回應另行驗證。

| 階段 | 作法 |
| --- | --- |
| 本地內容驗證 | 使用本機審閱輸出及定向測試。由開發者核對兩語文案、法定姓名及郵箱。 |
| 非正式預覽 | 可繼續使用本機審閱頁。若另行授權遠端預覽，只使用 `website/dist/review`，並限制瀏覽者。預覽網址只供審閱。 |
| 正式公開發佈 | 由開發者確認並授權獨立 Vercel 專案。先完成法定姓名、資料保留及素材決定，實際分配並核實 HTTPS origin 後才填入發佈配置。同一 revision 通過兩個正式 Gate。 |
| 已部署 HTTPS 驗證 | 公開環境逐一核實四條路由、免登入讀取、HTTPS 及 canonical origin，確認雙語切換、正式版本及實際收件。記錄實際 URL 和日期。 |
| App／App Store Connect 接入 | 在獨立階段使用已驗證的四個 HTTPS URL。App 離線文案與正式網站對齊後，才調整審閱標籤。ASC 由授權人使用已驗證的 Privacy／Support URL。 |

建議的正式 Vercel 設定為 **Other**，Root Directory 為儲存庫根目錄以讀取 `content/compliance.json`，Install Command 可覆寫為 `true` 以跳過 App 依賴，Node 用支援的 22.x，Build Command 用 `node website/build.cjs --release`，Output Directory 為 `website/dist/release`。四條路由使用目錄 `index.html` 及結尾斜線。在已授權環境驗證主機的斜線及重導行為。 [Vercel Build 設定](https://vercel.com/docs/builds/configure-a-build) · [Vercel 域名設定](https://vercel.com/docs/domains/working-with-domains/add-a-domain)

## 5. 測試與檔案

| 驗證 | 結果 |
| --- | --- |
| `npm run typecheck`、`node --check website/build.cjs` | 通過。 |
| `node scripts/test-compliance.cjs` | 通過。涵蓋 i18n parity、四條路由、兩語首頁、站內連結、語言切換的對應路徑、品牌位置、App 和 HTML 共用文案、四頁與 App 聯絡入口的 `mailto:`、照片雜湊與既有署名。 |
| 發佈 Gate 正反向 | 通過。以隔離臨時目錄驗證完整輸出與 canonical，逐項移除或損壞營運者、origin、保留或素材證據來確認拒絕行為。實際配置維持 BLOCKED，測試資料沒有寫入正式配置或產物。 |
| 探索步道導航、全域搜尋導航、設施收藏 | 既有定向測試通過。 |
| `git diff --check`、正式資料與依賴比較 | 通過。 |

實際變更包括 [共用文案](../content/compliance.json)、[App 文案與聯絡讀取](../src/compliance-content.ts)、[App 文件畫面](../src/components/compliance-document.tsx)、[網站生成器](../website/build.cjs)、[頁尾樣式](../website/site.css)、[正式 Gate 欄位](../website/release.json)、[網站說明](../website/README.md)、[測試](../scripts/test-compliance.cjs) 及本報告。

`develop` 的 HEAD 與 `origin/develop` 均為 `f617e80`。工作區為上述八個已追蹤檔案變更及一份新增報告。沒有操作模擬器／真機、建立 Vercel 項目、部署或修改 ASC，沒有 commit、push 或 merge。
