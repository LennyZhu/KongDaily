# KongDaily 1.0 · REL-01B iOS ATS 與依賴安全整改

核對日期為 2026-11-19（香港時間）。基線為 `develop` 的 `7be11e7b5b8561e6917764efa782b72a4c3e93dd`。開始時工作區乾淨，`origin/develop...HEAD` 為 `0 0`，`git ls-remote --heads origin develop` 回傳同一提交。REL-01A 已隨該提交納入，UI-02D 和 SRCH-01 仍沿用既有驗收結果。 [REL-00](REL-00-PROJECT-COMPLETENESS-AUDIT.md) · [REL-01A](REL-01A-RELEASE-BLOCKER-REVALIDATION.md) · [SRCH-01D](SRCH-01D-GLOBAL-SEARCH-FINAL-REGRESSION.md)

## 1. 整改結果

| REL-01A 項目 | 狀態 | 證據與發行門檻 |
| --- | --- | --- |
| SEC-01 · ATS | **FIXED** | 最終 Expo 配置和實際生成的原生 `Info.plist` 只保留 `NSAllowsArbitraryLoads=false`。候選 archive 及 iOS 實際連線屬 REL-03 驗證。 |
| SEC-02 · URI 解碼依賴 | **FIXED** | 運行時使用正式修正 `decode-uri-component@0.5.1`。乾淨安裝、實際套件解析、原生收件流程的 Node 定向測試、iOS Hermes 導出均通過。iPhone 原生開啟與返回待驗。 |
| SEC-03 · 構建端 minimatch | **MITIGATED** | 仍鎖定受影響版本。現行 fingerprint 呼叫只採用預設優化級別 1，且兩個模組均未進入 iOS App bundle。條件是使用受信任的構建來源及設定。 |
| SEC-04 · 正式環境及構建來源 | **UNVERIFIED** | 乾淨 npm 安裝及本機構建工具已通過。遠端 EAS 環境、CI 安裝方式、正式簽名與 archive 仍待 REL-02／03 核實。 |

未發現新增 P0／P1。現階段 **TestFlight 和 App Store 仍為 NO-GO**，正式候選包、簽名、現行隱私與支援及其他 REL-01A 發布門檻仍需核實。 [REL-01A 整改清單](REL-01A-RELEASE-BLOCKER-REVALIDATION.md#5-整改清單階段與驗收門檻)

## 2. ATS 來源及生成證據

專案以 `app.json` 和 Expo Config Plugins 按需生成 iOS 專案。版控沒有 `ios/`、`eas.json` 或其他 App Config。已裝的 `@expo/config-plugins` 在 `withIosBaseMods.js` 中有自己的內省預設，實體 `Info.plist` 尚未存在時會使用該預設。實際 iOS prebuild 則從 SDK 原生模板讀取 plist，再以 `expo.ios.infoPlist` 對頂層鍵做淺合併。本輪在 App Config 明確寫入整個 ATS 字典，兩條途徑均使用相同結果。 [App 配置](../app.json) · [Expo Config Plugin 流程](https://docs.expo.dev/config-plugins/introduction/) · [Apple ATS](https://developer.apple.com/documentation/security/preventing-insecure-network-connections)

| 證據 | 整改前 | 整改後 |
| --- | --- | --- |
| `expo config --type introspect --json` | REL-01A 與 SDK 57 內省預設均見全域 `true` 及 `localhost` HTTP 例外。 | Development、Preview、Production 三種本地環境均確認最終 `ios.infoPlist` 與 `_internal.modResults.ios.infoPlist` 只有全域 `false`。 |
| `expo config --type prebuild --json` | App Config 未指定 ATS。 | Production 環境解析到明確的全域 `false`。 |
| SDK 模板生成的 `ios/KongDaily/Info.plist` | 以基線 App Config 及 `expo-template-bare-minimum@57.0.35` 重現。全域 `false`，同時允許 `NSAllowsLocalNetworking=true`。 | 同模板重建結果只有 `NSAllowsArbitraryLoads=false`，無本機或網域例外。Debug 和 Release 均指向此 plist，`plutil -lint` 通過。去掉 ATS 鍵後，前後 plist 完全一致，包含既有定位用途聲明。 |

REL-01A 的全域 `true` 證據屬於內省預覽。用相同的 SDK 57 模板實際生成基線 iOS 專案後，確認原生模板原有的是本機網絡例外。兩次 `prebuild --platform ios --no-install --template <SDK 57 模板 tarball>` 均在各自的獨立臨時目錄進行。三種配置以 `NODE_ENV` 和 `EAS_BUILD_PROFILE` 模擬本地環境，EAS 遠端 profile 和已簽名 archive 的最終設定仍待驗。本輪統一使用嚴格 ATS，正式流量無須新增環境或域名例外。

### 正式網絡路徑

複核了 App 的 `fetch` 呼叫與 URL 組裝。沿用 REL-01A 既有的 22 筆網絡證據，該次請求全部為 HTTPS 200、TLS 1.3、系統憑證校驗成功且無重導。樣本覆蓋如下，地址與現行代碼一致。 [REL-01A 網絡樣本](REL-01A-RELEASE-BLOCKER-REVALIDATION.md#ats網絡和構建)

| 主機 | 筆數 | 核對內容 |
| --- | ---: | --- |
| `data.etabus.gov.hk` | 6 | 九巴／龍運路線目錄、站序、站點目錄及明細、路線 ETA 和站點 ETA。 [巴士資料](../src/bus-data.ts) · [站序](../src/bus-stop-data.ts) |
| `rt.data.gov.hk` | 7 | 城巴目錄、站序、站點及 ETA，嶼巴 V2 目錄、站序及 ETA。 [站序](../src/bus-stop-data.ts) · [ETA](../src/bus-eta.ts) |
| `data.weather.gov.hk` | 8 | 繁中、英文各核對 `rhrread`、`fnd`、`warnsum`、`warningInfo`。當時警告結果為空，只證明傳輸及端點可達。 [天氣](../src/weather-data.ts) |
| `www.map.gov.hk` | 1 | 地政總署線上地點搜尋。 [地點搜尋](../src/landsd-location-search.ts) |

沒有發現額外業務請求主機、正式 HTTP 路徑或新增服務。FEHD／AFCD／LCSD、探索內容和官方核實折線維持本機讀取。探索既有的 39 個來源 URL、天文台及設施官方來源、Apple Maps／Google Maps 外部導航仍採 HTTPS。原生 MapKit 底圖和目的地 App 的網絡受各平台管理，這批 HTTPS 證據只覆蓋 KongDaily 直接呼叫的業務端點。 [探索資料](../assets/data/explore-places.json) · [設施導航](../src/facility-navigation.ts) · [探索導航](../src/explore-places.ts)

## 3. URI 解碼修正

| 項目 | 鎖定路徑 |
| --- | --- |
| 整改前 | `kongdaily → expo-router@57.0.31 → query-string@7.1.3 → decode-uri-component@0.2.2` |
| 整改後 | `kongdaily → expo-router@57.0.31 → query-string@7.1.3 → decode-uri-component@0.5.1` |

`0.5.1` 同時修正 CVE-2026-118664 和 CVE-2026-45822。保留 SDK 57 的 `expo-router@57.0.31` 及它的 `query-string@7.1.3`。該版本用 CommonJS 直接呼叫解碼器，新解碼器以 ESM `default` 匯出。覆蓋範圍只限指定的 `query-string` 版本。安裝腳本從 Expo Router 的實際路徑查找依賴，核對版本與預期匯入，將一行改為使用 `.default`，重複執行無副作用。若上游版本或匯入形態改變，安裝會提示重新核對。REL-02 應以啟用 lifecycle scripts 的 `npm ci` 建構，並在導出前執行定向測試。待 SDK 相容的上游修補出現，再移除適配及覆蓋。 [依賴宣告](../package.json) · [安裝適配](../scripts/prepare-uri-decoder.cjs) · [高風險公告](https://github.com/advisories/GHSA-qr28-fpjm-wq7f) · [另一份 URI 公告](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr)

REL-01A 的可達性描述在本輪再細分。SDK 57 一般原生收件使用 Expo 自己的路由 fork，query 由 `URLSearchParams` 處理。Router 的其他路徑仍包含 `query-string`，例如路由狀態到 URL 的序列化，以及內建 Navigation Core 的 query parser。iOS 導出確實包含消費方與解碼器。原生 `+native-intent` 另在路由狀態解析前檢查冷啟及前景收件，超過 8,192 個 UTF-16 code units 或百分比編碼無效時拒絕，接受時將原字串交回 Expo Router。合規但未知路徑沿用現有找不到頁面，路由參數由原目的頁驗證。測試分別核對入口不重解碼和解碼器本身的單次解碼。Expo 既有外部 scheme 路徑抽取仍按上游規則正規化，例如 query 值的已編碼分隔符，不把測試的 `q` 參數當作 App 已支援的預填契約。 [原生收件驗證](../src/app/+native-intent.tsx) · [定向測試](../scripts/test-native-link-security.cjs)

## 4. minimatch 的實際影響

`kongdaily → expo@57.0.33 → @expo/fingerprint@0.20.16 → minimatch@10.2.6` 仍落在 GHSA-g3hv-75wg-m249 的版本範圍。相同 SDK 的另一條路徑 `expo → @expo/cli@57.0.34 → glob@14.0.6 → minimatch@11.0.8` 已在修正範圍外。現行 Expo 的 `^0.20.16` 和 fingerprint 的 `^10.2.6` 未找到可避開公告的相容版本。公告修正版本為 `11.0.1`，npm 提示的 Expo `52.0.49` 需跨主要版本倒退。保留現有版本，將上游相容修正列為獨立後續事項。 [鎖檔](../package-lock.json) · [公告](https://github.com/advisories/GHSA-g3hv-75wg-m249)

受影響的前置處理需要可控 glob pattern 且 `optimizationLevel >= 2`。已裝的 fingerprint 在 `Options.js` 及 `utils/Path.js` 確認其 ignore pattern 來自內建清單、構建選項以及專案設定或 `.fingerprintignore`，呼叫只用 `{dot: true}`，minimatch 因此採用預設 1。App 沒有傳入 glob 的業務路徑，已核對 iOS 導出不包含 fingerprint 或 minimatch。本機用受信任的工作區執行 iOS fingerprint 計算通過，共 41 個來源。這項剩餘風險按 P2 管理，在相同構建條件下本身無需阻止發布。REL-02 須限制構建只使用受信任提交、ignore 設定和 CI 輸入，若日後導入外部 glob、改 matcher 選項或更換工具版本，重新評估。遠端條件仍待發布人確認。

## 5. 自動化驗證

| 命令或核對 | 實際結果 |
| --- | --- |
| Node `22.13.0`、npm `10.9.2`，臨時目錄 `npm ci --no-audit --no-fund` | 成功安裝 559 個套件及執行 `postinstall`。工作區局部安裝只替換 1 個套件。 |
| `npm ls --all --omit=dev` 查 Expo、React Native、Router、query-string、解碼器及 minimatch | 確認上述各路徑，沒有其他舊解碼器。Expo `57.0.33`、RN `0.86.3`、Router `57.0.31` 不變。 |
| `npm audit --registry=https://registry.npmjs.org --json --ignore-scripts --no-progress` | 基線為 3 high、3 moderate。整改後全量與 `--omit=dev` 均為 0 high、3 moderate、0 critical，退出碼 1。三項 moderate 是 minimatch 的一份公告及兩個父套件列。 |
| `npm run typecheck`、`git diff --check` | 通過。 |
| `NODE_ENV=production node scripts/test-native-link-security.cjs` | 通過。使用已安裝的 Expo 路由與測試替身核對冷啟、前景收件、正常深連結、雙語編碼和多值、重複編碼、非法百分比編碼、長度邊界、未知路徑、無效及重複 ETA 身份欄位。 |
| `node scripts/test-bus-route-map.cjs`、`python3 scripts/build-bus-route-geometry.py --check` | 通過。涵蓋方向、變體、同站重訪、ETA 過期與切站、核實折線。幾何索引 9 條／7,862 點，SHA-256 `b36819e9595cabdd1ce76bd8a1c8e628730a03e3a20aef4684964201bc03020c`。 |
| `node scripts/test-facility-favorites.cjs` | 通過。Registry、真實 SQLite v8 測試及巴士收藏／首頁置頂。 |
| `node scripts/test-global-search.cjs`、`node scripts/test-global-search-ui.cjs`、`node scripts/test-global-search-navigation.cjs` | 通過。正式資料、兩語搜尋、四類結果、根 Stack push/pop、隔離地圖與單次跳轉。 |
| `node scripts/test-explore-places.cjs`、`node scripts/test-explore-trailhead-navigation.cjs` | 通過。8 處、39 個官方 HTTPS 來源、兩處行山起點與六處未核實；兩語詳情、外部開啟失敗重試，以及首頁和探索返回。 |
| Node 一次性天氣 fixture，直接執行現有 feed | 通過。四種 feed × 兩語均組裝正確的 HTTPS 請求並保存快照。模擬 TLS 失敗保留舊快照並將警告判為過期。網絡及 SQLite 接口使用測試替身。 |
| `expo export --platform ios --source-maps external --output-dir <臨時目錄>` | Production Metro 導出成功，1,281 個模組，Hermes bytecode 4,944,652 bytes。Source map 中解碼器原文與安裝的 `0.5.1` 相符，並有 CommonJS 適配和原生入口驗證。未包含 `minimatch` 或 `@expo/fingerprint`。 |
| 鎖檔及正式資產對照 | 鎖檔只有根套件 lifecycle metadata 和解碼器記錄改變。569 個產物 URL 均有 integrity，其中 566 個仍為原 npm 鏡像，3 個為 npm 官方 registry。官方資料及素材的 `git diff --exit-code HEAD -- assets` 通過。 |

## 6. iPhone 及候選包驗收

1. 在候選 archive 核對 `NSAppTransportSecurity` 只有 `NSAllowsArbitraryLoads=false`，確認無 Release 設定加回本機或其他例外。
2. 用現有 HTTPS 路徑檢查首頁 ETA 和天氣，開啟路線站序及地圖 ETA，檢查九天天氣、警告和 Nearby 地政總署搜尋。確認切至離線時沿用既有快取及錯誤狀態。
3. App 完全關閉與已開啟時，各用合法 `kongdaily://` 連結開啟路線或探索頁。核對正確目標、身份、返回與原本頁面狀態，使用兩語與正常百分比編碼。原生 Host 遇簡短無效編碼應安全返回既有狀態，合法未知路徑應顯示現有未找到頁面。
4. 從搜尋進入設施及探索詳情，再返回原搜尋。核對 Apple Maps／Google Maps 外部開啟、回到 App、收藏及首頁置頂。以上原生行為等待開發者驗收。

## 7. 修改文件與 Git

| 文件 | 原因 |
| --- | --- |
| [app.json](../app.json) | 明確覆蓋 SDK 的 ATS 字典。 |
| [package.json](../package.json)、[package-lock.json](../package-lock.json) | 精確鎖定上游修正及安裝生命週期。 |
| [scripts/prepare-uri-decoder.cjs](../scripts/prepare-uri-decoder.cjs) | 只適配已鎖定消費方的解碼器匯入。 |
| [src/app/+native-intent.tsx](../src/app/+native-intent.tsx) | 冷啟及前景外部連結的長度、編碼檢查。 |
| [scripts/test-native-link-security.cjs](../scripts/test-native-link-security.cjs) | URI、Expo 原生入口與身份解析定向回歸。 |
| [本報告](REL-01B-IOS-SECURITY-REMEDIATION.md) | 保留整改、實驗及待驗證證據。 |

交付時 `develop` 和 `origin/develop` 均為 `7be11e7`，工作區含上述三個已追蹤文件變更及四個未追蹤文件。原生生成與 Metro 導出留在臨時目錄。本輪未執行簽名、EAS 正式構建、模擬器或真機操作，也未提交、推送或合併。
