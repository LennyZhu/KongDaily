# REL-02C1 · iOS 品牌啟動畫面

## 視覺與資源

啟動畫面使用 KongDaily 暖白 `#FAF9F5`（`colors.searchBackground`），中央只顯示正式圖示的深綠 HK 路牌。由已驗收的 `app-icon-ios.png` 擷取路牌及一小段支柱，保留原像素的字樣、箭頭方向和配色。透明遮罩移除了天空、電車、維港和夕陽，並清理路牌邊緣的原底色。

| 資源 | 規格 |
| --- | --- |
| [splash-logo.png](../assets/branding/splash-logo.png) | 736 × 736、sRGB、每通道 8-bit RGBA。路牌非透明範圍為 675 × 494 px，置於透明畫布中央。 |
| [靜態視覺示意](design/rel-02c1-splash-preview.png) | 393 × 852。按生成的 storyboard 尺寸和底色，由原生 @3x 圖合成。實際原生啟動效果待 Release 候選包驗收。 |

## Expo 與啟動生命週期

- `app.json` 配置 iOS 專用 `expo-splash-screen` Config Plugin，資源為 `./assets/branding/splash-logo.png`，`imageWidth: 164`，`resizeMode: contain`。164 pt 方形容器內，實際路牌約 150 × 110 pt。App 使用淺色樣式，配置只提供一套外觀。 [Expo SDK 57 SplashScreen](https://docs.expo.dev/versions/v57.0.0/sdk/splash-screen/)
- `package.json` 新增 SDK 57 推薦的 `expo-splash-screen`（`~57.0.11`）。`package-lock.json` 鎖定 `57.0.11`，其餘鎖檔條目與開工基線一致，Expo 仍為 `57.0.33`。
- 正常啟動由 Expo Router 在導航就緒後解除 Splash。目前首頁的天氣及巴士請求不參與啟動條件。`src/language.tsx` 只在本機語言讀取失敗、既有錯誤文案完成布局時呼叫 Router 的 `SplashScreen.hide`。此時根 Stack 尚未掛載，Router 的正常就緒回呼無法觸發。重試仍使用現有 SQLite 讀取路徑。本次未引入人工等待、額外動畫或 React Native Splash。

## 驗證

| 檢查 | 結果 |
| --- | --- |
| `npm run typecheck` | PASS。 |
| Expo Production `config --type introspect --json` 與 `config --type prebuild --json` | PASS。插件版本及資源路徑可解析，沒有舊式 Splash 配置。Bundle ID `com.lennystudio.kongdaily`、scheme `kongdaily`、版本 `1.0.0`、iPhone-only 與淺色外觀相符。 |
| 隔離 iOS `prebuild --platform ios --no-install` 和 Apple autolinking | PASS。生成的 `SplashScreen.storyboard` 引用 `SplashScreenLogo.imageset` 和暖白 `SplashScreenBackground.colorset`。圖像以 164 × 164 pt 居中並等比例顯示，原生 PNG 為 164、328、492 px 正方形，三個比例皆透明。Autolinking 找到 `ExpoSplashScreen` Pod。 |
| ATS、權限與原生 Release 設定 | PASS。`plutil -lint` 通過。本輪的 `Info.plist` 與 entitlements 和 REL-02C0 隔離生成檔逐位元組相同，保留 `NSAllowsArbitraryLoads=false`、前台定位及 en／zh-HK。Xcode Release 設定為裝置家族 1。 |
| 正式 App Icon | PASS。源檔 SHA-256 為 `c153aa5ca06b1b21ff19c1aa725a2f3085050fdf38e4e9de835996a1258adb7d`，與 REL-02C0 驗收版本相同。兩輪生成的原生 `AppIcon` PNG 亦逐位元組相同。 |
| 啟動錯誤路徑 | PASS。以現有 `LanguageProvider` 進行 JS 定向測試，注入讀取失敗，驗證錯誤布局才解除 Splash，重試成功後渲染原 Root Stack。測試中的 SQLite 拒絕與原生 hide 為替身。 |
| iOS Production Metro／Hermes | PASS。`expo export --platform ios` 匯出單一 `.hbc`，共 1,294 個模組。Splash 圖由原生資產目錄載入。 |
| 深連結、私隱合規與 Git | PASS。`node scripts/test-native-link-security.cjs`、`node scripts/test-compliance.cjs`、`git diff --check`。 |

## Release 候選包人工驗收

1. 結束 App 後冷啟動，檢查暖白底、中央 HK 路牌的尺寸和清晰度。
2. 檢查畫面沒有 Expo 圖案、方形底塊、多餘圓角、邊框或明顯閃白、閃黑。
3. 檢查正常進入首頁。切換飛航模式後再冷啟動，確認天氣與巴士離線不會卡住 Splash。

上述原生驗收待正式候選包。此次只生成暫存原生專案與本機匯出。

## Git 基線與工作區

開工和交付均在 `develop`。HEAD、本機 `origin/develop` 與 GitHub 的只讀分支查詢皆為 `efe1dc844fb5ad2a3e7e5cd4ffc8dca340ea4cc6`，分歧 0／0。B5、REL-02A、REL-02B 與 REL-02C0 仍在工作區，原有改動及未追蹤資源均已保留。

本輪修改 `app.json`、`package.json`、`package-lock.json`、`src/language.tsx`，新增 Splash PNG、靜態預覽和本報告。含先前工作，交付工作區為 7 個已修改的追蹤檔案及 15 個未追蹤檔案。
