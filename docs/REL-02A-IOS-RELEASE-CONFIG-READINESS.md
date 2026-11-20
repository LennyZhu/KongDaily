# REL-02A · iOS 1.0 發布配置

2026-11-20（香港時間）。本機 `develop`、`origin/develop` 和 GitHub 唯讀查詢均為 `efe1dc844fb5ad2a3e7e5cd4ffc8dca340ea4cc6`，分歧 0／0。REL-01C1B5 的 `.gitignore`、`content/compliance.json`、`website/release.json` 和部署報告在開工時仍未提交，本輪保留原內容。REL-02A 修改 `app.json`，新增 `eas.json` 和本報告。 [B5 部署與 Gate A／B](REL-01C1B5-VERCEL-FIRST-PRODUCTION-DEPLOYMENT.md)

## A. 已完成、可直接保留的發布配置

| 項目 | 核對結果 |
| --- | --- |
| `expo.name`／`expo.slug` | `KongDaily`／`kongdaily`。暫存原生顯示名稱為 KongDaily，網站品牌為 KongDaily by Lenny Studio。 |
| `expo.version` | 設為 `1.0.0`。Expo Production 解析及暫存原生 `CFBundleShortVersionString` 均一致。私有 npm 套件版本仍為 `0.1.0`。 |
| `ios.bundleIdentifier` | 保留 `com.lennystudio.kongdaily`。暫存 Xcode Debug／Release 設定均相符。Apple 註冊狀態及歸屬待核對。 |
| `ios.buildNumber` | 源碼留空，交由 EAS 遠端管理。暫存 prebuild 的 `CFBundleVersion=1` 為本機預設值，正式號碼待核實。 |
| `ios.supportsTablet` | `false`，暫存 Xcode `TARGETED_DEVICE_FAMILY=1`，維持 iPhone 裝置家族。暫存 `IPHONEOS_DEPLOYMENT_TARGET=16.4`，候選 Archive 再核對。 |
| `scheme`／`runtimeVersion` | 保留 `kongdaily`，未設定 `runtimeVersion`，生成的 `EXUpdatesEnabled=false`。 |
| `ios.infoPlist` | 保留混合本地化、en／zh-HK、前台定位及嚴格 ATS。 |

### EAS Production Profile

`build.production` 使用 `distribution: store`、`developmentClient: false`、`environment: production`。iOS 使用 `simulator: false` 和 `buildConfiguration: Release`。映像固定為 Expo SDK 57 所列 `macos-tahoe-26.5-xcode-26.6`（Xcode 26.6，映像預設 Node 22.23.1），符合 Apple 目前的 SDK 提交門檻。實際映像與 SDK 尚待 EAS 日誌和正式 Archive 確認。本機 Xcode 26.6 的 iPhoneOS SDK 查詢回傳 26.5。配置未定義 Submit、OTA channel、開發或 Internal profile 繼承及額外環境變數。EAS 靜態解析顯示預設憑證來源為 `remote`。 [EAS Production Profile](https://docs.expo.dev/build/eas-json/) · [EAS SDK 57 建置映像](https://docs.expo.dev/build-reference/infrastructure/#ios-server-images) · [Apple SDK 提交要求](https://developer.apple.com/news/upcoming-requirements/)

`cli.appVersionSource=remote`，`production.ios.autoIncrement=buildNumber`，行銷版本由 `expo.version` 管理。只有在正確的 EAS 與 Apple 記錄均確認從未分配或上傳時，才採用初次分配的 `1`。如有歷史紀錄，先核對兩邊及尚未完成的上傳，保留較高的有效序列並確認下一個編號未使用。若須用 Apple 上傳紀錄初始化 EAS 遠端號碼，由獲授權發布人在後續階段處理。 [Expo 遠端版本管理](https://docs.expo.dev/build-reference/app-versions/#remote-version-source)

### 官網與離線私隱

App 設定頁維持本機可閱讀的私隱政策與支援頁。線上內容與 App 共用私隱政策 v1.0、生效及首次更新日期 2026-11-20、個人營運者 Lenny、品牌 KongDaily by Lenny Studio 和 `lenny996@163.com`。`node website/build.cjs --check-live` 核對兩語核准內容與無登入 HTTPS 回應。以下是稍後填入 App Store Connect 的資料。 [共用政策](../content/compliance.json) · [App 離線政策入口](../src/compliance-content.ts)

| 語系 | Privacy Policy URL | Support URL |
| --- | --- | --- |
| zh-HK | [私隱政策](https://kongdaily-site.vercel.app/privacy/) | [支援](https://kongdaily-site.vercel.app/support/) |
| English | [Privacy Policy](https://kongdaily-site.vercel.app/en/privacy/) | [Support](https://kongdaily-site.vercel.app/en/support/) |

### iOS 安全與權限

- Expo Production 內省和隔離暫存 prebuild 的原生 `Info.plist` 均只有 `NSAllowsArbitraryLoads=false`，沒有 localhost、網域例外或其他放寬 HTTP 的設定。暫存原生 `plutil -lint` 通過。
- 生成的 en／zh-HK `InfoPlist.strings` 與既有本地化檔案一致。唯一 App 用途說明是前台定位 `NSLocationWhenInUseUsageDescription`，用於附近設施、巴士及距離。未增加 Always、Motion、ATT、相機、背景定位或其他用途。Expo 內省及暫存 App Entitlements 為空字典，簽名後的值以 Archive 為準。
- `react-native-maps@1.27.2` 的地圖沿用 iOS MapKit，第三方 manifest 維持原樣。套件來源申報仍列 Precise Location／App Functionality、Linked=false、Tracking=false，以及 File Timestamp 用途理由。實際入包、資料處理及最終 App Privacy 留待 Gate C。 [REL-01C0 SDK 證據](REL-01C0-PRIVACY-AND-ATTRIBUTION-AUDIT.md)
- `npm ls` 確認 Expo Router URI 解碼鏈仍為 `query-string@7.1.3 → decode-uri-component@0.5.1`，深連結回歸通過。Lockfile 未改。構建端 `@expo/fingerprint → minimatch@10.2.6` 沿用 REL-01B 的受信任構建輸入與既有緩解，未宣稱修復。 [REL-01B 安全紀錄](REL-01B-IOS-SECURITY-REMEDIATION.md)

## B. 仍需要開發者批准的事項

### Expo 與 Apple 歸屬

本機配置沒有 `owner` 或 `extra.eas.projectId`。EAS CLI 27.7.1 的 `whoami` 確認 Expo 登入為 `homeypaw`。以現有登入向 Expo 唯讀查詢 `@homeypaw/kongdaily` 及 `@homeypaws-team/kongdaily`，兩者均回傳找不到。其他帳戶或不同 slug 未核實。沒有本機關聯可讀本 Bundle ID 的 EAS 版本紀錄。Apple Team、App Store Connect 既有 App、TestFlight 及編號同樣未核實。

後續須批准專用 KongDaily Expo owner 及專案（若不存在則另批准新建及連結），並由開發者確認 Apple Team 及現有 Bundle ID 的註冊、App 紀錄。完成核准的連結後，按該 Project ID 執行唯讀 `eas build:version:get --platform ios --profile production --non-interactive`，對照 Apple 的編號紀錄。此輪未建立或連結遠端 EAS 專案，也未設定遠端號碼或請求 Apple 憑證。

### App Icon 與 Splash

倉庫未找到已批准的 KongDaily App Icon 或自訂 Splash 資源與引用。暫存 prebuild 的 `AppIcon.appiconset` 是空白預設 PNG，實測 **1024 × 1024，帶 alpha 通道**。暫存 `SplashScreen.storyboard` 沿用 Expo 模板及系統底色。本輪只核對生成結果。

既有視覺使用港灣青 `#246F69`、輔色 `#3B8F87`、暖白 `#FAF9F5` 和淺青 `#E6F3F1`，配合留白及簡單幾何。 [App 色彩規範](../src/theme.ts)

1. **維港剪影。** 港灣青滿版底，以暖白山脊與單一港灣弧線構成中央標記，維持小尺寸下的香港辨識度。
2. **街區路牌。** 暖白底配原創港灣青路牌框與一條短路線，呼應巴士和附近探索。構圖以單一清楚輪廓為主。

待批准的交付規格為選定構圖、用色、可編輯原檔與可追溯權利，以及 **1024 × 1024、sRGB、無 alpha 通道的扁平 PNG**。採滿版底色，圓角由 iOS 裁切，核對小尺寸的辨識度與留白。批准後接入資源，並核對生成的原生資產目錄和候選包。若選擇品牌 Splash，另行批准底色、標記與畫面裁切。 [Apple App Icon 規格](https://developer.apple.com/design/human-interface-guidelines/app-icons) · [Expo Icon／Splash 指引](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/)

## C. 建立第一個正式 EAS Build 前的必要條件

1. 批准並接入真正的 KongDaily App Icon，核對 iOS 資產目錄。確認首版採用現有 Launch 樣式或另行批准品牌 Splash。
2. 經授權建立或連結專用 EAS 專案，核對 Expo owner、slug、Project ID、Production 環境及 Apple Team／Bundle ID。確認正確簽名及 provisioning。用正確 EAS 和 Apple 紀錄確定安全可用的構建號。
3. 核對候選修訂包含已公開的 B5 政策日期、B5 忽略規則、REL-02A 配置及核准素材，確認本機 Vercel 連結和環境檔排除於構建輸入。再核對 EAS 映像、正式環境、Store profile 及實際 Build 授權。

**Gate C 仍待候選 Archive。** 驗證成品的 Bundle ID、版本及編號、SDK／最低 iOS、有效 ATS、雙語權限、裝置家族、簽名、entitlements、圖示與 MapKit。取得 Xcode Privacy Report，核對實際隨包 SDK Manifest、Required Reason API、精確位置等資料流及最終 App Privacy 申報。另核對山頂花園 CC BY 4.0 在 Apple EULA 及成品技術措施下的分發安排，和商店的正式政策／支援網址。郵箱實際收件待開發者驗證。 [Apple App Privacy](https://developer.apple.com/app-store/app-privacy-details/) · [B4 照片權利矩陣](REL-01C1B4-PRODUCTION-WEBSITE-GATE-A.md)

## 自動化驗證

| 驗證 | 結果 |
| --- | --- |
| `npm run typecheck` | PASS。 |
| Expo Production `config --type introspect --json`、`config --type prebuild --json` | PASS。隔離暫存的 `prebuild --platform ios --no-install` 另驗實際原生 bundle 設定、ATS、權限、雙語、entitlements、iPhone 家族和圖示。 |
| EAS Profile | 靜態 PASS。使用本機 EAS CLI 27.7.1 隨附的 `@expo/eas-json` 解析 iOS Production Profile。實際遠端環境待專案連結後核實。 |
| `node scripts/test-compliance.cjs`、`node website/build.cjs --check-live` | PASS。App 離線政策與公開網站內容、正式網址及照片規則。 |
| Explore、全域搜尋及安全回歸 | PASS。 `test-native-link-security.cjs`、`test-explore-photos.cjs`、`test-explore-places.cjs`、`test-explore-trailhead-navigation.cjs`、`test-global-search.cjs`、`test-global-search-ui.cjs`、`test-global-search-navigation.cjs`。 |
| iOS Metro／Hermes | PASS。Node 22.13.0，`NODE_ENV=production EAS_BUILD_PROFILE=production EXPO_OFFLINE=1 EXPO_NO_DOTENV=1` 執行 `expo export --platform ios`。輸出單一 Hermes `.hbc`、1,294 模組、八張 App 照片的 SHA-256 一致。 |
| `git diff --check`、`git diff HEAD --exit-code -- src assets package.json package-lock.json` | PASS。App 功能、照片、依賴及鎖檔維持原樣。 |

完成後 `develop` HEAD 仍為 `efe1dc8`。既有 B5 三個修改與一份新增報告均保留。REL-02A 一個修改及兩個新增檔，合計四個修改及三個新增檔。未重新部署網站、建立 EAS Build、操作 App Store Connect、模擬器或真機，未提交、推送或合併。
