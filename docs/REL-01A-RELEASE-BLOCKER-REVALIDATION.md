# KongDaily 1.0 · REL-01A 發布阻塞復核與整改基線

**TestFlight：NO-GO。目前缺可重現的已簽名候選包與帳號證據，原生 ATS 及 App 內可達的深連結解析依賴亦未完成處置。** **App Store Submission：NO-GO。** 除上述項目，仍欠 App 內的獨立隱私政策入口、外部發布資料確認，以及素材署名落地。

## 1. Git 基線與已結案功能

2026-11-19（香港時間）核對 `develop`。開工時工作區乾淨。HEAD、本機 `origin/develop` 與 GitHub 的 `git ls-remote --heads origin develop` 全部為 `92a9bd8813e154c40bd9333b7b470749d8a77308`，分歧 0／0。該提交包含 SRCH-01D。與 REL-00 提交 `00a4efb` 比較，App 配置、npm 鎖檔、SQLite 結構、設定頁與首頁圖檔及權利記錄相同。 [REL-00](REL-00-PROJECT-COMPLETENESS-AUDIT.md) · [SRCH-01D](SRCH-01D-GLOBAL-SEARCH-FINAL-REGRESSION.md)

| REL-00 項目 | 本輪狀態 |
| --- | --- |
| 全域搜尋 PARTIAL、路線圖 MISSING | **兩項 PASS，關閉功能缺口。** SRCH-01 四組搜尋、導航與 iPhone 人工驗收已記錄。UI-02D 的站點地圖、九條已核實折線及地圖 ETA 均已接線並通過回歸。正式候選包驗收另列。 |
| ATS、npm 公告、環境和依賴 | **FAIL／UNVERIFIED。** 靜態生成的 ATS 過寬，兩條依賴鏈仍受公告影響。正式包的 ATS、外部 EAS 環境及依賴佐證待驗。 |
| 隱私政策、Support 及 App Privacy | **FAIL／UNVERIFIED。** App 內入口缺失屬已確認。對外網址、聯絡、Apple 申報及 SDK 歸檔屬待核。 |
| Bundle ID、裝置意圖、前台定位 | **PASS（repo／生成預覽）**。已簽名包的原生設定另待核實。 |
| 版本、EAS、品牌 Icon 和發行、簽名、App Store 資料 | **FAIL／UNVERIFIED。** repo 無正式候選版本策略、EAS production profile 或品牌 Icon 設定。遠端 Apple／EAS／TestFlight／商店紀錄未取得。 |
| 官方資料、照片及地圖 | CSDI 已有條款依據，TD 折線已在畫面署名。其餘來源授權與署名按資料級復核。龍脊照片的成品可見署名仍缺，MapKit 標誌與 Legal link 待候選包驗證。 |
| 關於、分享、整體本機資料清除及長期維護 | 仍屬原有 P2 缺口。描述現有清除方式及制定維護責任，不將分享、備份／還原或新管理頁列為 1.0 發布依賴。 |

## 2. 安全與發布技術證據

### ATS、網絡和構建

- `expo config --type introspect --json` 的 iOS 預覽出現 `NSAllowsArbitraryLoads=true` 及 `localhost.NSExceptionAllowsInsecureHTTPLoads=true`。這是預覽產出的 plist，與已安裝 Expo config plugin 的預設相符。App 業務請求全部使用 HTTPS，沒有發現正式流量需要全域或 localhost HTTP。REL-01B 應設明確的 release ATS，REL-03 逐項核對 archive 中的最終值及 iOS 實際連線。 [App 配置](../app.json) · [Apple ATS](https://developer.apple.com/documentation/security/preventing-insecure-network-connections)
- 用系統 `curl` 對既有四個正式主機發出 **22 個唯讀 GET**，限制 HTTPS 及 HTTPS 重新導向、最低 TLS 1.2、維持系統憑證驗證。22 個樣本均為 HTTP 200、憑證驗證碼 0、協商 TLS 1.3、無重新導向，回應可解析為 JSON。樣本採正式巴士站／路線 ID 和公共地名 `Central`。當次天文台警告回應為空物件，只驗證傳輸及公開接口可達。此結果支持移除 release 廣泛例外，iOS ATS 的候選包實測仍為發布門檻。
- Bundle ID `com.lennystudio.kongdaily`，預覽顯示名稱 `KongDaily`，URL schemes 含 `kongdaily` 及 Bundle ID。意圖為 iOS、iPhone 優先、直向、淺色、`supportsTablet: false`。預覽 `0.1.0`、build `1`，Launch Storyboard 為預設 `SplashScreen`。未見追蹤中的原生專案、`eas.json`、EAS project ID、production 配置、品牌 Icon 或品牌 Splash 接線。有效的 `MinimumOSVersion`、`UIDeviceFamily` 和 iPad 相容模式要看實際包。預覽的 `LSMinimumSystemVersion=12.0` 不用於推定 iOS 部署門檻。 [App 配置](../app.json) · [EAS 配置](https://docs.expo.dev/eas/json/)
- 鎖定 Expo SDK `57.0.33`、React Native `0.86.3`、Expo Router `57.0.31`。本機 Xcode `26.6 (17F113)`、`iphoneos` SDK `26.5` 符合已查到的工具門檻。Apple 自 **2026-04-28** 起要求上傳至 App Store Connect 的 iOS App 使用 Xcode 26 或以上及 iOS 26 SDK 或以上。Expo SDK 57 官方表列 Xcode 26.4+、iOS 16.4+；採用符合兩者的 EAS image，archive 的運行門檻另行核對。探索的步道導航仍按程式要求 iOS 18.4+。 [Apple SDK 提交要求](https://developer.apple.com/news/upcoming-requirements/?id=04282026a) · [Expo 支援表](https://docs.expo.dev/versions/latest/) · [EAS 構建映像](https://docs.expo.dev/build-reference/infrastructure/)
- 版控的憑證檔名、常見 token／私鑰簽名模式掃描未命中。業務源碼未見 `EXPO_PUBLIC_*`、localhost 測試 API 或金鑰綁定。鎖檔 569 個有 URL 的產物均記錄 integrity，其中 567 個 URL 指向 npm 鏡像、2 個指向官方 registry。這是構建供應鏈與重現問題。預設 npm 鏡像回傳安全公告 API 404，切到 npm 官方 registry 才取得結果。不在公開配置、manifest、JS bundle 或日誌置入私密值。REL-02 應確認允許的 registry、乾淨構建重現及 EAS profile 環境，將秘密保留在合適的憑證／秘密存放範圍。 [鎖檔](../package-lock.json) · [忽略規則](../.gitignore)

| 執行端點樣本 | 請求數 | 核對 |
| --- | ---: | --- |
| `data.etabus.gov.hk` | 6 | 九巴／龍運路線目錄、站序、站點目錄／明細、路線 ETA、站點 ETA。 |
| `rt.data.gov.hk` | 7 | 城巴路線目錄、站序、站點明細和 ETA，嶼巴 V2 路線、站序及 ETA。 |
| `data.weather.gov.hk` | 8 | `rhrread`、`fnd`、`warnsum`、`warningInfo` 各測繁中及英文。 |
| `www.map.gov.hk` | 1 | 地政總署 Nearby 地點搜尋。 |

測試僅涵蓋 App 明確呼叫的正式業務 API。MapKit 原生瓦片、外部地圖路線及瀏覽器連結由相關平台或目的 App 服務。App 沿用巴士目錄／站序 SQLite 快取、ETA 的有效期及 HKO 依語言與資料種類的 SQLite 快取。FEHD／AFCD／LCSD、探索和核實折線為隨包靜態資料，上游下載屬資料維護流程。 [巴士目錄](../src/bus-data.ts) · [巴士站序](../src/bus-stop-data.ts) · [巴士 ETA](../src/bus-eta.ts) · [天氣](../src/weather-data.ts) · [附近線上搜尋](../src/landsd-location-search.ts)

### 安全公告與實際執行面

官方 `npm audit` 全量及 `--omit=dev` 均列 **3 high、3 moderate、0 critical**。六個套件列包括父鏈繼承，對應 **三份上游公告、兩條需處理的路徑**。Node 24.0.0、npm 11.3.0，未修補或執行攻擊測試。

| Issue／公告 | 鎖定版與受影響範圍 | 利用前提、實際路徑、最小方案 |
| --- | --- | --- |
| SEC-02 · CVE-2026-118664（high） | `expo-router@57.0.31 → query-string@7.1.3 → decode-uri-component@0.2.2`。公告影響 `<=0.5.0`，修正 `0.5.1`。 | 外部來源須能將惡意格式的百分比編碼 query 送入解碼器，資源消耗可阻塞解析。Repo 已啟用自訂 scheme。已裝 Expo Router 的原生 linking 讀初始及運行中 URL，`react-navigation/core/getStateFromPath.js` 用 `queryString.parse`，鎖定的 query-string 再呼叫此解碼器。這構成靜態可達面，App 畫面內的查詢長度校驗發生在解析之後。優先採 SDK 57 相容的官方上游修補或經審閱的相容移植。 [公告](https://github.com/advisories/GHSA-qr28-fpjm-wq7f) |
| SEC-02 · CVE-2026-45822（moderate） | 同一依賴鏈與鎖定版本。影響 `<=0.4.2`，首個修正 `0.5.0`。 | 前提同為能控制進入解碼器的異常編碼文字。單用 `0.5.0` 仍落在上一公告範圍。官方 registry 的 SDK 57 相容查詢目前只給 `57.0.31`，依賴 `^7.1.3`。現行 `query-string@7.1.3` 用 CommonJS 直接取得並呼叫函數，`decode-uri-component@0.5.1` 的入口是 ESM。上游修補或相容移植須同時覆蓋兩案，驗證模組互通、Metro、Hermes 下的合法深連結、繁中／多值參數及所有搜尋返回路徑。若用緩解措施，需在原生 URL 入口、解碼前對冷啟及喚醒均生效並有證據。 [公告](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) |
| SEC-03 · CVE-2026-118764（moderate） | `expo@57.0.33 → @expo/fingerprint@0.20.16 → minimatch@10.2.6`。影響 `>=7.0.0 <11.0.1`，修正 `11.0.1`。另一條 `@expo/cli → glob@14.0.6 → minimatch@11.0.8` 已在修正範圍外。 | 需能供應不受信任的 glob pattern，且觸發受影響的優化路徑（`optimizationLevel >= 2`）。App 源碼未見執行期引用，現有證據指向構建端的 fingerprint，不把它當成已在 iPhone 可達的漏洞。優先用 SDK 相容 fingerprint 修正，或隔離的相容移植／pin，驗證 fingerprint 與構建行為。在此之前，限制構建只使用受信任的 Git 提交和設定，記錄剩餘風險。 [公告](https://github.com/advisories/GHSA-g3hv-75wg-m249) |

`expo-router`／`query-string` 的 high、`expo`／`@expo/fingerprint` 的 moderate 為父鏈繼承。npm 自動建議跨到 Router 58 或把 Expo 改為 52，均未有 SDK 57 相容證據。依賴是否隨 App 執行以 import 與歸檔為準。Expo／React Native、地圖、SQLite、定位、語言及 Router 是 App 依賴。Expo CLI、Metro、fingerprint 屬開發與構建工具，因 Expo 傳遞依賴仍出現在 `--omit=dev`。TypeScript、`@types/react` 宣告為開發用，亦可由傳遞路徑出現在鎖檔；CJS 回歸腳本在宿主 Node 用內建斷言與臨時 SQLite，未發現獨立測試 SDK 隨 App 發行。 [依賴宣告](../package.json) · [鎖檔](../package-lock.json)

## 3. 隱私政策、Support 和 App Privacy 事實表

| 資料／接收方 | 證據及目前可確立的邊界 |
| --- | --- |
| 裝置位置 | 前台需要時單次取得經緯度和精度，供 Nearby 距離、地圖定位及巴士站推薦；未授權時可改用手動查詢。目的字串與功能一致。代碼未見原始 GPS 寫入 SQLite 或加入業務 API 請求。附近畫面會將位置標記／對應視口交予原生地圖，Apple 平台處理仍須從供應方及候選包證明。全域搜尋設施地圖使用官方設施座標。 [定位](../src/nearby-bus-location.ts) · [地圖](../src/components/nearby-facilities-map.tsx) · [本地化用途](../assets/locales/zh-HK.json) · [Apple Maps 隱私](https://www.apple.com/legal/privacy/data/en/apple-maps/) |
| 本地儲存、刪除 | `kongdaily.db` v8 保存語言、專項巴士搜尋歷史、站點及設施收藏與置頂、公共資料／天氣快取、站點索引。設施收藏保存穩定 ID 和名稱／分類快照。全域搜尋詞只在當前頁記憶體，LandsD 結果短期存記憶體。可逐項取消收藏、取消置頂及清除巴士搜尋歷史；未見全 App 刪除／匯出或雲端帳號。若政策要寫刪除 App 清除或備份還原，先驗 iOS 刪除與卸載保留的差異及實際備份行為。 [SQLite](../src/database.ts) · [巴士搜尋紀錄](../src/bus-data.ts) · [設施收藏](../src/facility-favorites.ts) |
| 營辦商、天文台、地政總署 | 營辦商接收公共路線／站點 ID、服務變體，嶼巴 ETA 另有語言。HKO 接收資料種類與語言。**Nearby 線上地點搜尋會將使用者輸入文字送交 LandsD**，可能包含地址，獨立於本機全域搜尋。服務方通常可見 IP 與連線資訊，保留多久及是否作其他用途待核實。現有 App 程式未見自家資料收集端點。 [ETA](../src/bus-eta.ts) · [天氣](../src/weather-data.ts) · [LandsD](../src/landsd-location-search.ts) |
| 外部地圖與官網 | 主動開啟 Apple Maps／Google Maps 時，交付已核實的公共目的地座標。外部 App 可依其權限與政策使用裝置位置及規劃路線。官網連結交由系統外開。未發現 Google Maps 為原生預設 provider；安裝樹包含可選 Google subspec，實際是否進包仍要查 Podfile.lock／archive。 [地圖外開](../src/facility-navigation.ts) · [探索詳情](../src/app/explore/place/%5Bid%5D.tsx) |
| 日誌、分析、崩潰 | 巴士請求訊息以 `__DEV__` 保護，語言讀寫失敗仍可寫本機 console。依賴與業務碼未發現自建分析、廣告、帳號或崩潰上傳接線。Apple 系統與 TestFlight 的診斷／回饋、SDK 實際資料項、網頁未來主機的日誌或支援電郵另核實，App 政策應按實際上線狀況描述。 [日誌](../src/bus-data.ts) · [語言](../src/language.tsx) · [TestFlight 診斷與回饋](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/) |

**Privacy Manifest。** App 無顯式 `ios.privacyManifests` 或版本控制內的 `PrivacyInfo.xcprivacy`。已安裝 RN 聲明 UserDefaults `CA92.1`、FileTimestamp `C617.1`、SystemBootTime `35F9.1` 等。Expo Constants／Localization 聲明 UserDefaults，Expo FileSystem 聲明 FileTimestamp、DiskSpace。已安裝 `react-native-maps@1.27.2` 的主 manifest 聲明 **Precise Location、App Functionality、不連結、不追蹤** 及 FileTimestamp `C617.1`；獨立 Google subspec 也有自己的資源。這是本地 SDK 檔案證據，歸檔包含、實際傳輸與保留、對 App Nutrition Label 的適用性仍待證。Hermes 在 Apple 要求名單內。REL-02／03 核對 SDK native autolinking／Podfile.lock、IPA 中的 manifest、Xcode Privacy Report、實際 API 用途與各 reason，並核對適用的二進位 SDK 簽章。只補有實際呼叫依據的理由。 [SDK 及簽章要求](https://developer.apple.com/support/third-party-SDK-requirements/) · [Required Reasons](https://developer.apple.com/documentation/technotes/tn3183-adding-required-reason-api-entries-to-your-privacy-manifest) · [Expo manifest 設定](https://docs.expo.dev/guides/apple-privacy/)

**可交付內容骨架（zh-HK／English）。**

- App 內在「設定」提供可發現的「私隱政策／Privacy Policy」。正式公開頁使用可免登入讀取的 HTTPS，兩語一致，明示發布者與真實聯絡方式、生效日期、前台定位及拒絕方式、收發資料目的、第三方與保留、使用者如何刪除本機記錄或提出請求。App Store Connect 同時填相應正式政策網址。 [Apple 審核指引 5.1.1(i)](https://developer.apple.com/app-store/review/guidelines/#privacy)
- 公開「支援／Support」頁包含經開發者確認的實際聯絡方式、兩語基本說明、資料錯誤及故障回報方法、定位拒絕／離線／即時資料限制、安裝與版本資訊及政策連結。實測頁面與收件，確認網站實際使用的日誌或分析。Support URL 與團隊聯絡資訊留待開發者提供。 [App Store Connect Support URL](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/)
- App Privacy 先逐資料流記錄「有否離開裝置、接收者、可存取期限、用途、是否連結至身份或用於追蹤」。Apple 的「收集」視乎傳出之後，開發者或第三方合作方能否在即時請求所需期限以外存取。優先釐清 SDK 位置、Nearby 搜尋文字、第三方連線／診斷及將來的支援資料。核實保留與可存取性後，按實際用途評估 Precise Location、Search History、Diagnostics 及支援聯絡資料等類別，再確認是否連結或追蹤。現階段保留 UNVERIFIED，不能由「沒有自建後端」推出「不收集資料」。 [Apple App Privacy 定義](https://developer.apple.com/app-store/app-privacy-details/)

## 4. 官方資料、素材與署名

| 範圍 | 已有依據及應採行的查驗 |
| --- | --- |
| 巴士 KMB／LWB、CTB、NLB | DATA.GOV.HK 的開放資料條款提供附條件的分發與重用，須清楚標明權利人、來源和門戶。KMB／LWB 由運輸署發放並保有營辦商原資料權利，CTB／NLB 各有資料集。App 已標示營辦商，需建立包含回應、靜態站點快照、整理過的反向索引及離線再分發的權利清單，核對個別資料字典、額外條件和完整 App 內署名。 [KMB／LWB](https://data.gov.hk/en-data/dataset/hk-td-tis_21-etakmb) · [CTB](https://data.gov.hk/tc-data/dataset/ctb-eta-transport-realtime-eta) · [NLB V2](https://data.gov.hk/en-data/dataset/nlb-bus-nlb-bus-service-v2) · [門戶條款](https://data.gov.hk/en/terms-and-conditions) |
| HKO、LandsD | HKO 正式 API 有公開資料目錄及文件，天氣頁有來源及條款連結。核對 `rhrread/fnd/warnsum/warningInfo` 的資源級重用、快取和署名，並區分 HKO 一般站點素材的較嚴格商用條件。若資料集範圍與一般站點條款仍有歧義，向權利方確認。LandsD 指向官方資料集，補足 App 內可查來源，確認線上字詞保留及官方政策。 [HKO 開放資料](https://www.hko.gov.hk/en/abouthko/opendata_intro.htm) · [HKO 正式 API 資源例](https://data.gov.hk/en-data/dataset/hk-hko-rss-weather-warning-information/resource/65718d0c-b363-49f7-accb-3797e967a73f) · [HKO 網站商用條款](https://www.hko.gov.hk/en/appweb/commercial.htm) · [LandsD 資料集](https://data.gov.hk/en-data/dataset/hk-landsd-openmap-development-location-search-api) |
| 設施 Registry 與 TD 幾何 | 1,256 筆設施的來源已可查。AFCD／LCSD 及 TD 折線來自 CSDI，門戶條款涵蓋附條件的商用及分發。LCSD 索引及 TD 繪線畫面已有政府、資料機構與 CSDI 署名；核對 AFCD 的同等署名以及寵物規則／公告等另引文段。FEHD 的實際下載用 `fehd_map_c.xml`／`fehd_map_e.xml`，繁中及英文資源頁列出的直連均與打包資料註記一致，具體支持按門戶條款核對這兩個來源。FEHD 一般網站另有書面許可條款，保留此資源對照與下載批次，確認對規範化再分發及引用其他官網文字的適用邊界。Registry 是身份對照，分發依據仍隨底層資料。 [資產來源](../assets/data/fehd-toilets.json) · [FEHD 繁中 XML 資源](https://data.gov.hk/en-data/dataset/hk-fehd-fehdlocatn-fehd-facility-and-service-locations/resource/00cb62a1-1ffc-4163-ac54-7703e5822041) · [FEHD 英文 XML 資源](https://data.gov.hk/en-data/dataset/hk-fehd-fehdlocatn-fehd-facility-and-service-locations/resource/161df8ea-b91a-46bf-b703-817a1aadbdcb) · [FEHD 一般網站公告](https://www.fehd.gov.hk/english/department/copyright.html) · [CSDI 條款](https://static.csdi.gov.hk/csdi-webpage/doc/TNC) · [TD 折線](UI-02D2-BUS-ROUTE-GEOMETRY-IMPLEMENTATION.md) |
| 探索內容、地圖 | 八處為整理後的離線雙語介紹和官方連結。有可追溯的來源，未收錄外部探索照片或 Apple Maps 瓦片資料。保留來源與日期，核對借用文段和兩處獨立核實的導航證據；候選包確認附近、路線圖及搜尋地圖的 Apple 標誌與 Legal link 一直可用。 [探索資料](../assets/data/explore-places.json) · [導航審計](UI-05C3D-NAVIGATION-POINT-VERIFICATION.md) · [Apple Maps 條款](https://developer.apple.com/support/terms/apple-developer-program-license-agreement/) · [MapKit 介面署名](https://developer.apple.com/design/human-interface-guidelines/maps) |
| 首頁照片 | Pexels 維港及 Unsplash 西九有原作者和來源，查到一般授權可作 App 素材，保留限制及原始授權記錄。龍脊 Bjørn Christian Tørrissen 原圖為 CC BY-SA 4.0，現有 `credits.md` 有作者及改動，App 內未找到可見入口。分發前補作者、原圖、授權、改動與適用的相同方式分享；也可使用另有明確分發授權的替代素材。 [本地權利記錄](../assets/home/credits.md) · [Pexels](https://www.pexels.com/license/) · [Unsplash](https://unsplash.com/license) · [Wikimedia 原圖](https://commons.wikimedia.org/wiki/File:Dragons-Back-Northwards.jpg) · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| 圖示、品牌、插畫、字體與依賴通知 | 搜尋維港圖由 RN 元件繪製，探索版控中有四張類別 PNG，宜保存原始製作／使用證明。已追蹤資產無 SVG、TTF 或 OTF 的 App 字體，畫面以系統字體與 `expo-symbols` 的 SF Symbols 為主。確保新 Icon／Splash 及商店素材的獨立權利，系統符號依 Apple 使用規範。REL-02 編排實際發行的 MIT／Apache 等依賴通知，與照片及資料來源並列。 [搜尋插圖](../src/components/search-harbour-illustration.tsx) · [共用圖示](../src/components/ui.tsx) · [探索插畫](../src/components/explore-artwork.tsx) · [SF Symbols](https://developer.apple.com/sf-symbols/) |

## 5. 整改清單、階段與驗收門檻

狀態按證據記為 PASS／FAIL／UNVERIFIED／NOT APPLICABLE。TestFlight 欄為 KongDaily 候選放行建議，Apple 明確上傳要求、內測條件與外測 Beta Review 分開處理。「有條件」表示待歸檔／第三方證明或依分發對象確認。 [Apple TestFlight 流程](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)

| Issue | 狀態／級別 | 對應檔案或證據 | 阻塞 TestFlight | 阻塞 App Store | 最小整改與階段 |
| --- | --- | --- | --- | --- | --- |
| FUN-01 全域搜尋／路線圖 | PASS · P2 | SRCH-01D、UI-02D2／D3、回歸通過 | 否 | 否 | 維持凍結，REL-03 冒煙抽查。 |
| SEC-01 ATS | FAIL · P1 | `app.json` 生成預覽的全域及 localhost HTTP 例外，22 個 HTTPS 樣本通過 | 是 | 是 | REL-01B 明確設定 release 的最小 ATS，例外需證明必要；REL-03 檢查實際包。 |
| SEC-02 原生深連結解碼器 | FAIL · P1 | `package-lock.json`、自訂 scheme 與原生 URL 解析，兩個 CVE | 是 | 是 | REL-01B 完成相容修正或經驗證的解碼前緩解，重跑路由、兩語、合法參數和候選。 |
| SEC-03 構建 glob | FAIL · P2 | `@expo/fingerprint → minimatch@10.2.6` | 有條件 | 有條件 | REL-01B 修補或由發布人確認剩餘風險並限定受信任構建輸入；REL-02 驗 fingerprint。 |
| SEC-04 秘密、正式環境及構建來源 | UNVERIFIED · P1 | 版控掃描未見實際秘密；鎖檔鏡像、多處生成配置與 EAS 環境 | 有條件 | 是 | REL-01B 列允許 host／registry、加強秘密排除。REL-02 核對環境、可重現安裝、release bundle 與發行範圍。 |
| PRI-01 App 政策入口 | FAIL · P0 | `src/app/settings.tsx` 無入口，repo 無專用政策 | 外測是 | 是 | REL-01C 按事實表提供雙語政策及 App 入口，正式 URL 接線與開啟驗證。 |
| PRI-02 公開政策／Support／聯絡 | UNVERIFIED · P0 | 無已核實外部網址和可用聯絡；帳號頁未查 | 外測有條件 | 是 | REL-01C 由開發者確定主持與聯絡。公開網址免登入測試及收件測試；REL-04 填 ASC。 |
| PRI-03 App Privacy 申報 | UNVERIFIED · P0 | 設定、App 資料流及地圖 SDK 聲明，外部保留情形未確立 | 外測有條件 | 是 | REL-01C 完成雙語資料流、供應方核驗與申報草稿；REL-03／04 對準候選與 ASC。 |
| PRI-04 Privacy Manifest／SDK 簽章 | UNVERIFIED · P0 | SDK 本機有 manifest；App 無顯式配置，無 archive | 是 | 是 | REL-02 枚舉實際 native SDK、用途碼與 Hermes；REL-03 驗證歸檔與 Xcode Privacy Report。 |
| PRI-05 前台權限 | PASS · P2 | `app.json`、兩語 `assets/locales` 與預覽；沒有 Always、Motion、相機或追蹤用途鍵，沒有定位背景模式 | 否 | 否 | REL-03 驗兩語用途字串與拒權／再次定位。 |
| BLD-01 EAS production／版本 | FAIL · P1 | 無 `eas.json`／project ID，`0.1.0` 和預覽 build 1 | 是（本項目候選流程） | 是 | REL-02 綁定已授權的 project，選相容 EAS image，固定發行版本與遞增，不改現有 Bundle ID。 |
| BLD-02 品牌 Icon／啟動 | FAIL · P1 | `app.json` 無品牌 Icon／Splash，預覽預設 storyboard | 是（候選有效 Icon） | 是（有效 Icon） | REL-02 使用核准且有權利的 Icon，驗桌面與上傳；自訂 Splash 視產品決定。 |
| BLD-03 Apple／EAS 帳號、簽名、TestFlight | UNVERIFIED · P0 | 無可讀 Apple Team、App record、provisioning、協議或遠端 project／候選 | 是 | 是 | REL-02 由帳號持有人核對匹配的 Team、Bundle ID、版本／權限與出口合規；REL-03 經批准後驗分發簽名與候選。 |
| BLD-04 有效部署與候選驗收 | UNVERIFIED · P1 | 本機工具符合參考門檻，實際 archive／IPA 未取得 | 是（包與工具）；裝機驗收在其後 | 是 | REL-03 讀 IPA 的 Xcode／SDK／deployment、裝置家族、ATS、權限、privacy 與圖示。記錄 fresh install、v7→v8、弱網、兩語、大字及 VoiceOver。 |
| LIC-01 官方資料重用與署名 | UNVERIFIED · P1 | 各資料集、FEHD 及 HKO 一般官網規範、舊索引和 CSDI 證據 | 有條件（對外分發） | 是 | REL-01C 對照精確下載資源留證，逐資料集補署名／條件；未明範圍先取得澄清或使用已確認來源。 |
| LIC-02 照片署名／素材權利 | FAIL · P1 | `assets/home/credits.md` 有龍脊署名與修改記錄，App 內無可見接線 | 有條件（分發包含該素材） | 是 | REL-01C 讓署名及適用授權隨成品可查，或用已授權替代圖；鎖定版面和新商店素材權利。 |
| LIC-03 MapKit／套件通知 | UNVERIFIED · P1 | Apple 協議、三處 MapKit 宿主、已安裝 SDK | 有條件 | 是 | REL-02 整理所發行程式及 SDK 通知；REL-03 確認原生標誌／Legal link 與小屏、卡片同時可用。 |
| STORE-01 商店元資料和送審 | UNVERIFIED · P0 | 缺 ASC 已完成證據；現有高保真屬設計記錄 | 內測否，外測需 beta 資料 | 是 | REL-03 拍候選包雙語正式截圖；REL-04 完成描述、年齡分級、出口合規、內容權利、聯絡與審核資訊。 |
| OPS-01 備份、維護、延後功能 | UNVERIFIED · P2 | 已有單項刪除與維護腳本，未見統一保存週期及事件負責人 | 否 | 否 | REL-01C 如實寫現有刪除；REL-04 指定正／回退版本、來源更新與事故責任。 |
| SCOPE-01 新發行網站部署、模擬器或正式構建 | NOT APPLICABLE · P2 | 本輪為只讀審計，候選包與公開頁留給後續 | 否 | 否 | 無本輪實作。 |

**建議順序。** REL-01B 先處理 ATS、原生 URI 解析及依賴分流。REL-01C 可並行完成雙語政策／支援與署名，優先釐清 SDK 精確位置和供應方保留，再定 App Privacy 文案。REL-02 固定 EAS／iOS／版本、僅加入需要的私隱清單、品牌素材與可重現構建配置。REL-03 經開發者批准後使用簽名候選驗收並產出證據；先按內部 TestFlight 矩陣驗，再處理外測的 beta 資料與審核。REL-04 按最終候選與已核實 App Store Connect 記錄送審。

## 6. 已執行驗證及 Git 交付

| 檢查 | 結果 |
| --- | --- |
| `git branch --show-current`、`git status --short --untracked-files=all`、`git ls-remote --heads origin develop` | `develop`，開工乾淨，正式遠端 SHA 與本機一致。 |
| `npm run typecheck`、`git diff --check` | 通過。報告額外檢查空白及本地連結。 |
| `node scripts/test-global-search.cjs`、`node scripts/test-global-search-ui.cjs`、`node scripts/test-global-search-navigation.cjs` | 通過，四類搜尋、正式離線資料、導航及返回。 |
| `node scripts/test-bus-route-map.cjs`、`python3 scripts/build-bus-route-geometry.py --check` | 通過，九條折線、7,862 頂點及地圖 ETA。 |
| `node scripts/test-facility-favorites.cjs` | 通過，本地 SQLite 的 v7→v8、Registry、跨 Tab 和收藏。 |
| `node scripts/test-explore-places.cjs`、`node scripts/test-explore-trailhead-navigation.cjs` | 通過，八處、兩處目前核實步道導航及兩語。 |
| `npm ls --omit=dev … --all`、`npm audit --registry=https://registry.npmjs.org --json --ignore-scripts`（亦加 `--omit=dev`） | 依賴路徑與公告範圍相符。官方查詢有六列；`--omit=dev` 退出碼 1 表示有公告。預設鏡像 404，未採為安全結果。 |
| `EXPO_OFFLINE=1 CI=1 npx --no-install expo config --type introspect --json`、`xcodebuild -version`、`xcrun --sdk iphoneos --show-sdk-version` | 通過讀取，結果為生成預覽和本機工具版本。 |
| 預先核對正式端點路徑後使用系統 `curl` 核對 22 個樣本 | 全部有效 HTTPS／TLS 1.3。沒有候選包、即時服務矩陣或原生 ATS 驗收證據。 |

`develop` 仍在 `92a9bd8`，只有本報告新增。候選包、Apple Developer／App Store Connect／遠端 EAS 的實際完成狀態均留待授權人核實。本輪無業務、ATS、依賴、簽名或發布設定更改。
