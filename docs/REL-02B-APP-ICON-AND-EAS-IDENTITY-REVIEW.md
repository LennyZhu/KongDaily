# REL-02B · App Icon 候選與 EAS 發布身分預檢

2026-11-20（香港時間）。`develop`、本機 `origin/develop` 和 GitHub 唯讀查詢均為 `efe1dc844fb5ad2a3e7e5cd4ffc8dca340ea4cc6`，分歧 0／0。B5 的 `.gitignore`、`content/compliance.json`、`website/release.json` 和部署報告仍未提交。REL-02A 的 `app.json`、`eas.json` 和報告也未提交。開工時四個修改檔與三個新增檔的 SHA-256 均已留作結束核對。 [B5 部署紀錄](REL-01C1B5-VERCEL-FIRST-PRODUCTION-DEPLOYMENT.md) · [REL-02A 發布配置](REL-02A-IOS-RELEASE-CONFIG-READINESS.md)

## 圖示設計與預覽

![維港剪影與街區路牌並列評審圖](design/rel-02b-app-icon/side-by-side-review.png)

**推薦 A 維港剪影。** 暖白底上以淺青山脊襯托港灣青天際線和兩道水線。香港地標輪廓經幾何化，在 60 pt 主畫面及 29 pt 小尺寸下，仍可分辨山、樓與水。它適合作為同時包含天氣、巴士、日常設施與探索的 KongDaily 主圖示。

**B 街區路牌** 以同樣的暖白底及港灣青，將街角折線放進兩層實體路牌及立柱的輪廓。形狀集中、清楚，也適合小尺寸。其語義更偏街區出行和本地資訊。兩稿採用原創的實色向量形狀，沒有內文、照片、商標、外部素材或水印。

![60 pt 主畫面與 29 pt 小尺寸對比](design/rel-02b-app-icon/iphone-home-size-review.png)

| 檔案 | 交付內容 |
| --- | --- |
| A 維港剪影 | [可編輯 SVG](design/rel-02b-app-icon/option-a-harbour.svg) · [1024 × 1024 PNG](design/rel-02b-app-icon/option-a-harbour.png) |
| B 街區路牌 | [可編輯 SVG](design/rel-02b-app-icon/option-b-street-sign.svg) · [1024 × 1024 PNG](design/rel-02b-app-icon/option-b-street-sign.png) |
| 並列評審 | [1440 × 1000 PNG](design/rel-02b-app-icon/side-by-side-review.png) |
| iPhone 尺寸參照 | [1440 × 970 PNG](design/rel-02b-app-icon/iphone-home-size-review.png)。兩稿以相同深淺背景比較，60 pt 與 29 pt 分別以 @3× 的 180 px 和 87 px 渲染。 |

用 macOS AppKit 渲染 SVG，再由 Core Graphics／ImageIO 輸出。兩個候選 PNG 均為 8-bit RGB、sRGB IEC61966-2.1、無 alpha 通道和無 PNG `tRNS`。SVG 的畫布與 PNG 均為 1024 × 1024、滿版暖白、方形原稿。圓角只加在尺寸評審圖中。兩份實際評審圖已目視檢查。正式 `expo.icon`、`ios.icon` 和 Splash 引用保持未設定，候選素材只放在 `docs/design/`。 [Apple Icon 形狀與尺寸](https://developer.apple.com/design/human-interface-guidelines/app-icons.md)

## Expo／EAS 帳戶與候選 Owner

Expo CLI `whoami` 與 EAS CLI 27.7.1 `whoami` 均回傳 `homeypaw`。EAS 以下述兩個可見的 Owner 範圍查詢專案及 KongDaily 的精確 slug。現有 `app.json` 沒有 `owner` 或 `extra.eas.projectId`，也無 `app.config.*` 覆寫。忽略的本機 `.expo/` 含開發裝置、說明和日誌，沒有 KongDaily 遠端連結設定。Vercel 的網站連結與 Expo/EAS 身分獨立。

| Expo 帳戶 | 角色 | 唯讀專案清單 | KongDaily |
| --- | --- | --- | --- |
| `homeypaw` | Owner，現有登入的個人帳戶 | `homeypaw`、`ordermori`、`splitmori` | `@homeypaw/kongdaily` 查無資料 |
| `homeypaws-team` | Owner，團隊帳戶 | 0 個專案 | `@homeypaws-team/kongdaily` 查無資料 |

**建議開發者批准 `homeypaw` 作 Expo Owner，使用獨立的 `@homeypaw/kongdaily` 專案。** 目前登入已具 Owner 權限，個人帳戶與現有營運模式相符。若希望把該 App 的 Expo 管理與現有個人帳戶專案分開，空的 `homeypaws-team` 是另一個可批准選項。兩種情況均須用新確認的 KongDaily 專屬 Project ID。未搜索到的其他帳戶或其他 slug 不作推斷。Bundle ID 維持 `com.lennystudio.kongdaily`。

## Apple Team 與簽名

| 檢查項目 | 證據與狀態 |
| --- | --- |
| Apple Team／Developer 入口 | 本輪未登入 Apple。EAS `homeypaw` 存有一筆 Apple Team 元資料（ID 末四碼 `63H9`），團隊帳戶沒有紀錄。此為 EAS 儲存的 Team 資料，Apple Developer 當前可用 Team 與 KongDaily 歸屬待開發者在 Apple 核實。 |
| Apple Bundle ID、ASC App 和歷史 Build | Apple Developer 及 App Store Connect 未取得已授權的唯讀資料。註冊、歸屬、App 紀錄、TestFlight 和已使用構建號均待人工確認。 |
| Distribution Certificate | EAS 個人帳戶有一筆團隊層級憑證紀錄，元資料有效區間為 2026-08-28 至 2027-08-28。Apple 即時撤銷狀態、可用性及對 KongDaily 的適用性未核實。本機 `security find-identity -v -p codesigning` 回傳 0 個有效身分。 |
| Provisioning Profile | Xcode 本機目錄有一筆 profile，僅核對其嵌入 plist 的 application identifier，與 KongDaily 的完整 Bundle ID 不符。KongDaily 的 App Store profile 待 Apple 核實。 |
| EAS KongDaily 專用憑證 | 兩帳戶以 `com.lennystudio.kongdaily` 查詢 EAS App Identifier，均無匹配。未見專用 EAS 專案或可確認的 KongDaily 簽名關聯。團隊層級憑證紀錄未作為本 App 的簽名證明。 |

上述 EAS 查詢只讀取專案、Team 或憑證日期等預檢元資料。未取得憑證內容、私鑰或密碼。開發者可在 Apple Developer 的 Identifiers 與 Profiles、以及 App Store Connect 的 Apps／TestFlight 核對所選 Team、Bundle ID 和編號，並回報確認結果。

## 首個 iOS Build Number

`cli.appVersionSource=remote`、`build.production.ios.autoIncrement=buildNumber`。App 未定義 `ios.buildNumber`。行銷版本保留 `1.0.0`。目前沒有正確 Project ID 及 Apple build 歷史，正式首個編號 **待人工確認**。 [Expo 遠端版本規則](https://docs.expo.dev/build-reference/app-versions/#remote-version-source) · [Apple 構建識別](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/)

- **兩邊均全新時，建議首個號碼為 `1`。** 相關條件是批准後連結的 KongDaily 專案尚無遠端版本、Apple 上沒有已用過或正在處理的編號、App 仍不定義本機 build number。Expo 文件說明此條件下首次遠端版本可初始化為 `1`，無須預先手動設定遠端。後續 iOS Production 構建從遠端編號遞增。
- **有歷史時，採用大於兩邊已使用或已分配編號的下一個 Apple 可接受值。** 先在正確專案連結後唯讀讀 EAS 版本，再核對 Apple 紀錄。若 EAS 遠端序列已充分領先且下一號無重複，沿用遠端自動遞增。若無 EAS 序列或落後於 Apple，須另行批准初始化或同步。初始化為已使用的安全基線，讓首個實際構建遞增到下一號。

本輪未初始化版本、建立或連結專案，未用其他 App 的 ID 或憑證。

## 第一個 Production Build 尚需完成

1. 開發者選定 A 或 B 並批准正式資產接入，決定保留現有 Launch Screen 或另行批准品牌 Splash。
2. 批准 Expo Owner 及 KongDaily 專屬專案的建立／連結。核對 Apple Team、現有 Bundle ID、App Store Distribution Certificate、匹配的 Provisioning Profile 與 ASC App。
3. 對照 Apple 與 EAS 構建紀錄，確認起始編號及是否需初始化。核對候選修訂包含 B5 與 REL-02A 的既有配置，再另行批准實際 Build。

Gate C 保持待正式 iOS Archive。候選包須核對實際 privacy manifest、SDK 精確位置相關聲明、App Privacy、簽名及照片在 App Store 條款下的分發安排。保留已批准政策日期 2026-11-20、公開 Vercel origin、離線政策、八張 Explore 照片及現有功能。 [B5 正式網站紀錄](REL-01C1B5-VERCEL-FIRST-PRODUCTION-DEPLOYMENT.md)

## 驗證及 Git

| 檢查 | 結果 |
| --- | --- |
| TypeScript · `npm run typecheck` | PASS |
| Expo Production config 內省 | PASS。KongDaily 1.0.0、`kongdaily` scheme、`com.lennystudio.kongdaily`、iPhone-only、前台定位與 ATS 僅 `NSAllowsArbitraryLoads=false`。 |
| EAS Production Profile（本機 EAS JSON 解析器） | PASS。iOS Store Release、無 dev client／simulator、Production 環境，`remote`／`buildNumber`。 |
| 六份圖稿 | PASS。兩份獨立 SVG、兩份合規候選 PNG 及兩張實際渲染評審圖完整。 |
| 安全與政策回歸 | PASS。 `node scripts/test-native-link-security.cjs`、`node scripts/test-compliance.cjs`。 |
| Git 與既有檔案 | PASS。 `git diff --check`，開工七檔 SHA-256 相同。 |

正式 App 資產未變，本輪不重跑 Metro／Hermes。完成後 `develop` 仍在 `efe1dc8`，與 `origin/develop` 一致。原有四個修改檔和三個新增檔維持；另新增六份設計文件及本報告，共四個修改檔、十個新增檔。未建立 Build、部署網站、修改 Apple Developer／App Store Connect、啟動模擬器／真機、提交、推送或合併。
