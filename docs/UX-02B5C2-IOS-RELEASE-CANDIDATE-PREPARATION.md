# UX-02B5C2 · iOS TestFlight 候選構建準備

**技術 GO，可在開發者核准版本後建立內部 TestFlight 候選構建。** 未發現新的 P0／P1 或必須先修的構建問題。候選包尚未歸檔或上傳。公開發布仍受 B5B 的授權、快取限制及 App Privacy 核驗約束。

## 基線與配置

`develop` 開工時乾淨。HEAD、本機 `origin/develop` 及 GitHub 分支均為 `91b7d43e471b2e46baf1b2abe30a1c567c1cdfde`。B5A2 鐵路定位範圍修正、B5B1 四項鐵路來源、B5B2 雙語候選政策及 B5C1 票價核驗均已提交。候選政策留在文件，App 內離線政策及正式網站仍以已發布版本為準。 [B5A2](UX-02B5A2-RAILWAY-LOCATION-SCOPE-FIX.md) · [B5B1](UX-02B5B1-RAILWAY-DATA-ATTRIBUTION.md) · [B5B2](UX-02B5B2-BILINGUAL-PRIVACY-POLICY-UPDATE.md) · [B5C1](UX-02B5C1-BUS-FARE-REFRESH.md)

| 檢查 | 結果 |
| --- | --- |
| App 身份 | KongDaily，`@homeypaw/kongdaily`，Project ID `46b3f4a1-36a6-4a62-aebf-2a65b795e9fd`，Bundle ID `com.lennystudio.kongdaily`，iPhone-only。現行 `expo.version` 為 `1.0.0`，未設定本機 `ios.buildNumber`。 |
| EAS Profile | 只有 `production`，沒有 `preview`。採 Store distribution、Release、非 Development Client、非模擬器，固定 `macos-tahoe-26.5-xcode-26.6`。版本來源為 remote，iOS 自動遞增 Build Number。 |
| 建議候選版本 | **1.1.0 (3)**。EAS 唯讀查詢回傳遠端 `buildNumber: "2"`，iOS 歷史只有 1.0.0 的 Build 1、2。經 EAS 唯讀查詢 App Store Connect（App ID `6837312302`），正式版是 1.0.0 (2)，TestFlight 目前只列 1.0.0 (2)，處理狀態 `VALID`。若構建前遠端值仍為 2，現有設定會自動取 Build 3。 [Expo 版本管理](https://docs.expo.dev/build-reference/app-versions/) |
| 唯一預期配置改動 | 版本獲批後，將 `app.json` 的 `expo.version` 設為 `1.1.0`。Build Number 交已配置的遠端遞增，不需新增 Preview、修改 Bundle ID 或初始化遠端編號。本輪配置未改動。 |
| Expo／iOS 靜態核對 | `expo config --type introspect --json` 通過。顯示名稱 KongDaily，ATS 禁用全局任意網絡請求，模擬生成的 entitlements 為空，未見背景模式。前台定位及 Motion 有用途文案，en 和 zh-HK 本地資源已核對。正式 Icon 為 1024×1024 且無 alpha，Splash 為 736×736、具 alpha。App 設定、EAS 設定和依賴鎖檔與 v1.0.0 基線相同。 |
| 離線資料 | iOS Hermes 匯出含港鐵、輕鐵靜態資料樣本（Racecourse、Hoi Wong Road）及兩套即時請求。目錄／搜尋測試另讀取完整官方資料快照。票價沿用 2026-11-18 批次，2026-12-02 00:00 香港時間起隱藏過期金額，這不阻塞候選測試。 |

## 驗證與候選成品交接

| 檢查 | 結果 |
| --- | --- |
| `npm run typecheck` | PASS。 |
| `node --test scripts/test-nearby-bus-location.cjs scripts/test-mtr-next-train.cjs` | 58/58 PASS。覆蓋首頁交通入口、附近巴士定位、預設 500 米及範圍切換、返回與列表狀態、三交通混合搜尋、兩鐵離線目錄及雙語即時預報。即時測試驗證請求與回應處理，原生飛航模式及真實網絡仍由開發者驗收。 |
| `python3 scripts/test-nearby-bus-fares.py`、`node scripts/test-bus-route-map.cjs` | PASS。票價匹配、到期、ETA、方向、服務變體、站點及路線圖。 |
| `node scripts/test-facility-favorites.cjs`、`node scripts/test-global-search-navigation.cjs`、`node scripts/test-compliance.cjs` | PASS。收藏與導航、雙語、資料來源及法律入口。 |
| `EXPO_OFFLINE=1 NODE_ENV=production expo export --platform ios` | PASS，使用本機 Expo CLI 在暫存目錄生成 5.7 MB Hermes `.hbc`。 |
| `git diff --check` | PASS。 |

**等正式 Archive 再驗。** 現行 Expo 設定未另外定義 `ios.privacyManifests`。Build 2 的成品已有 App 根 manifest 及 SDK manifest，候選版的原生聚合結果要另以成品核對。檢查簽名、entitlements、Bundle ID、實際版本及 Build Number、原生雙語權限與完整靜態資源。按成品 Pod／Framework 及 `PrivacyInfo.xcprivacy` 核對 Expo、React Native、Hermes、Expo Location、SQLite、FileSystem 和 MapKit／react-native-maps。用 Xcode Privacy Report 複核既有 Required Reason API（包括 UserDefaults、File Timestamp、System Boot Time）、FileSystem manifest 的打包差異及地圖 SDK 的 Precise Location 聲明。App Privacy 仍須結合實際網絡及第三方留存證據。 [Build 2 原生證據](REL-03D1-APP-PRIVACY-GATE-C.md) · [B5B2 核驗清單](UX-02B5B2-BILINGUAL-PRIVACY-POLICY-UPDATE.md)

**iPhone 驗收。** 開發者已完成主要功能驗收，本輪為自動化。候選安裝後，重點用飛航模式核對兩鐵目錄、搜尋及預報失敗提示，恢復網絡驗證即時列車與巴士 ETA，並檢查返回手勢／列表位置、大字、來源頁及雙語政策入口。

## 開發者執行順序

核准版本、設定 `expo.version`，並確認打包的是核准提交。構建前重查版本和 EAS 歷史，並核對 Apple 側編號。使用既有 Production Profile 建立候選包，取得實際 Build ID 後先驗成品。上傳須由開發者另行批准並指定該 Build ID。 [Expo EAS Submit](https://docs.expo.dev/build/automate-submissions/)

```sh
eas project:info
eas build:version:get --platform ios --profile production --json --non-interactive
eas build:list --platform ios --limit 5 --json --non-interactive
eas submit:status --platform ios --json --non-interactive
eas build --platform ios --profile production
# 成品驗證及上傳批准後，將下方值換成核准的 EAS Build ID
eas submit --platform ios --id APPROVED_EAS_BUILD_ID
```

工作區只新增本報告。未進行版本或遠端編號變更、EAS Build、上傳、部署、Git 提交、推送或模擬器／真機操作。
