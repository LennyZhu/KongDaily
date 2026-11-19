# KongDaily 1.0 · REL-01C0 私隱與素材署名證據審計

核對日期為 2026-11-19（香港時間）。`develop`、本機 `origin/develop` 和透過 `git ls-remote` 核對的 GitHub `refs/heads/develop` 均為 `30fe7b853a08f617c9dfb398a59aa854998de464`，差異 `0 0`。開始時工作區乾淨，REL-01B 已納入該提交。引用 REL-01B 的安全結果，正式 archive、iOS 深連結和遠端構建仍待原階段驗證。產品範圍沿用 SRCH-01D。 [REL-00](REL-00-PROJECT-COMPLETENESS-AUDIT.md) · [REL-01A](REL-01A-RELEASE-BLOCKER-REVALIDATION.md) · [REL-01B](REL-01B-IOS-SECURITY-REMEDIATION.md) · [SRCH-01D](SRCH-01D-GLOBAL-SEARCH-FINAL-REGRESSION.md)

本報告的 **VERIFIED** 限於所列證據，**REQUIRES CONFIRMATION** 需要供應方、候選包或營運者補證，**BLOCKED** 表示未具備該項交付或分發條件，**NOT APPLICABLE** 表示目前版本沒有該行為。代碼、供應方公開說明、SDK 檔案與最終候選的證據分別列明。

## 1. 真實資料流

### 1.1 位置、權限及本機資料

| 資料／操作 | 使用及保留 | 狀態與證據 |
| --- | --- | --- |
| 前台位置（經緯度、水平精度） | Expo Location 向 Core Location 要求單次高精度讀取，驗證香港範圍，以及水平精度不超過 150 米。這是 App 的可用性門檻，和 iOS 精確位置開關各自獨立。iOS 可回傳約略位置，精度不足時提示使用手動方式。附近設施頁首次進入、巴士路線最近站推薦，可在已有授權時讀取一筆。未授權的系統提示由用戶點擊定位或推薦操作觸發；附近巴士也由「使用目前位置」觸發。 | **VERIFIED** · 代碼及本地 Expo 內省。 [定位](../src/nearby-bus-location.ts) · [附近設施](../src/app/(tabs)/nearby.tsx) · [附近巴士](../src/app/bus/nearby.tsx) · [路線推薦](../src/route-stop-recommendation.ts) · [Apple 定位服務](https://www.apple.com/legal/privacy/data/zh-hk/location-services/) |
| 位置留存、距離及拒絕 | 只見畫面記憶體中的位置／搜尋中心，以及推薦流程可重用約 30 秒的一筆座標。位置用於在裝置上算距離及選擇站點。附近巴士可把算出的距離傳給 App 內站點頁。無位置歷史表、背景定位任務或 App 定位診斷上傳接線。拒絕後可用手動地標、地圖中心、本地及線上地點搜尋，巴士仍可手動選站。用戶可在 iOS 設定管理授權，可用的舊畫面狀態按現有頁面生命週期處理。 | **VERIFIED** · 目前代碼與配置。候選包的兩語權限提示、粗略／拒絕行為另驗。 [定位用途配置](../app.json) · [繁中用途字串](../assets/locales/zh-HK.json) · [英文用途字串](../assets/locales/en.json) |
| 巴士收藏與首頁置頂 | SQLite `bus_favorites` 保存營辦商、路線、方向／服務、站點 ID 及站序、雙語名稱快照、時間與最多三個 `pin_order`。取消置頂調整首頁，取消收藏刪除該筆。首頁依所選站點取得 ETA，請求由本機收藏導出站點／路線，再按第 1.2 節發往營辦商。 | **VERIFIED** · 未發現整張收藏表同步或自有帳號。 [資料庫](../src/database.ts) · [巴士收藏](../src/bus-favorites.ts) · [收藏頁](../src/app/(tabs)/saved.tsx) |
| 設施收藏 | SQLite `facility_favorites` 保存來源、穩定設施 ID、名稱與分類快照、建立／更新時間。移除按鈕刪除記錄。現有列不存 GPS 或設施座標；地圖重新由官方 Registry 解決設施身份。 | **VERIFIED** · [資料庫](../src/database.ts) · [設施收藏](../src/facility-favorites.ts) |
| 語言、搜尋與畫面狀態 | 語言偏好 `system`／`zh-HK`／`en` 存 `user_settings`，跟隨系統時讀取系統 locale。首頁全域搜尋的輸入字詞、結果、類別與捲動位置存在頁面記憶體；所需巴士目錄可另行下載，請求沒有輸入字詞。巴士查詢自己的最近搜尋另用 `bus_search_history` 保存字詞、可選路線 ID 和時間，最多八筆，可在巴士頁清除。附近的合資格地名輸入會作線上查詢，地政總署結果可在程序內以輸入詞為鍵重用五分鐘，最多 24 條，沒有 SQLite 搜尋紀錄。 | **VERIFIED** · [語言](../src/language.tsx) · [全域搜尋](../src/app/search.tsx) · [巴士搜尋與清除](../src/app/bus.tsx) · [地政總署查詢](../src/landsd-location-search.ts) |
| 其他本機儲存 | SQLite v8 `kongdaily.db` 包含營辦商目錄、站序、站點、官方巴士站點座標／時間及按語言保存的 HKO 公共資料快取。ETA 可短期在記憶體重用。隨包設施、巴士折線、探索地點與圖片是公開或內容素材。程式內的資料新鮮度控制不代表固定日期刪除。SQLite 在 iOS 使用 App 容器的 `Documents/SQLite`，現有設定無 SQLCipher，程式未見自行排除 iOS 備份。 | **VERIFIED** · 本機寫入方式。把「保存在裝置」寫成 App 的儲存方式，並說明可能隨用戶的 iOS 備份或還原。 [資料庫](../src/database.ts) · [天氣快取](../src/weather-data.ts) · [Expo SQLite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/) · [Apple 備份目錄規則](https://developer.apple.com/documentation/foundation/using-the-file-system-effectively) |
| 刪除與重設 | 可逐筆取消巴士或設施收藏、單獨取消置頂、清除巴士歷史、在設定改回跟隨系統。沒有全域資料重設或帳號刪除功能。iOS 的「刪除 App」移除本機 App 資料；「卸載 App」保留文件和資料，僅從主畫面移除也不等同刪除。裝置備份、平台或供應方服務中的既有副本由相關設定或流程管理。 | **VERIFIED** · 現有刪除行為。實際候選的備份、還原及版本遷移屬 **REQUIRES CONFIRMATION**。 [設定頁](../src/app/settings.tsx) · [Apple iPhone 儲存空間](https://support.apple.com/en-la/108429) |

### 1.2 裝置外的請求和交接

下表列出 App 業務程式顯式傳送的欄位。連線接收端通常可見來源 IP、時間及標準 HTTP／TLS 連線資訊。四個 API 的呼叫未見自訂裝置識別、帳號令牌、廣告 ID 或附加 GPS 欄位。實際 HTTP 原生標頭、IP／查詢日誌、服務供應鏈和保留期限不能靠 TypeScript 或 HTTPS 成功狀態判定。REL-01A 的 22 個 HTTPS 樣本只作可達及傳輸證據。 [REL-01A 網絡證據](REL-01A-RELEASE-BLOCKER-REVALIDATION.md)

| 接收端 | 主機及實際資料 | 狀態 |
| --- | --- | --- |
| 九巴／龍運 | `data.etabus.gov.hk`。目錄、站點大表、站點明細、站序、路線及單站 ETA。按端點傳公開站點 ID、路線號碼、方向、服務類型。附近功能在本地選出候選站點後，相關站點 ID 仍可出現在 ETA 請求，可能反映使用者關注的區域。 | **VERIFIED** · 請求形狀。具體 API 日誌及保存 **REQUIRES CONFIRMATION**；九巴官網私隱政策適用範圍為官網。 [巴士目錄](../src/bus-data.ts) · [ETA](../src/bus-eta.ts) · [站點 ETA](../src/nearby-stop-routes.ts) · [官網私隱政策](https://www.kmb.hk/en.policy.html) |
| 城巴／嶼巴 | `rt.data.gov.hk`。城巴請求按路徑包含 `CTB`、路線、方向或站點 ID。嶼巴 V2 用 API `action`、路線 ID、站點 ID、ETA 語言 `en`／`zh`。顯式用途為目錄、站點、站序和到站資料。 | **VERIFIED** · 欄位。門戶或營辦商實際 API 日誌與留存 **REQUIRES CONFIRMATION**。 [站序](../src/bus-stop-data.ts) · [ETA](../src/bus-eta.ts) |
| 香港天文台 | `data.weather.gov.hk`，`dataType=rhrread/fnd/warnsum/warningInfo` 及 `lang=tc/en`。天氣以香港公開觀測和預報服務為基礎，毋須讀取用戶位置。 | **VERIFIED** · 請求形狀。HKO 有一般網站及 MyObservatory 的日誌說明，未得到此 Open Data API 專屬保存證據，屬 **REQUIRES CONFIRMATION**。 [天氣服務](../src/weather-data.ts) · [HKO 私隱說明](https://www.hko.gov.hk/en/privacy/policy.htm) · [一般網站用途說明](https://www.hko.gov.hk/en/forms/files/AnnexII.pdf) |
| 地政總署 | `www.map.gov.hk/gs/api/v1.0.0/locationSearch?q=...`。附近地點搜尋在前台接收合資格輸入（至少兩個字母或數字，可含漢字，最長 80 個 UTF-16 code units），防抖 400 毫秒後可自動送出正規化文字，包含用戶自行輸入的地址。只用 `q` 和 JSON Accept，現有 GPS、地圖視口及定位授權均不附加。無需點擊搜尋結果才送出。首頁全域搜尋沒有此請求。 | **VERIFIED** · 文字會離開裝置。未找到涵蓋此端點的可引用保留／可存取期或刪除承諾，**REQUIRES CONFIRMATION**。MyMapHK 的政策是另一款 App。 [搜尋畫面](../src/components/nearby-search-sheet.tsx) · [請求實作](../src/landsd-location-search.ts) · [官方 API 目錄及維護者](https://data.gov.hk/en-data/dataset/hk-landsd-openmap-development-location-search-api) |
| App 內 Apple MapKit | 路線圖、附近及搜尋設施圖均用 `react-native-maps` 的 iOS 預設 MapKit，JS 沒有指定 Google provider 或自訂 tile server，兩個共用地圖組件均設 `showsUserLocation={false}`。Nearby 已定位時仍會將位置交給原生地圖作自訂 marker 與鏡頭中心。其他視口可來自手動探索、官方設施或站點。底圖網絡由 Apple 管理，App 鎖檔和 JS 沒有配置該系統服務的實際 host 或欄位。 | **VERIFIED** · 位置交給原生地圖與 Apple 服務邊界。自訂 marker 座標是否隨底圖服務傳出、哪些欄位會留存、實際候選流量均 **REQUIRES CONFIRMATION**。Apple Maps App 政策列出的資料不能直接套用到 KongDaily 的 MapKit。 [附近地圖](../src/components/nearby-facilities-map.tsx) · [巴士地圖](../src/components/bus-stop-map.tsx) · [Apple MapKit 私隱說明](https://developer.apple.com/videos/play/wwdc2022/102/?time=1823) · [Apple Maps 服務協議](https://developer.apple.com/support/terms/apple-developer-program-license-agreement/) |
| 外部導航與官方網站 | 用戶點按後，App 把官方設施或兩處核實步道起點的目的地座標和步行模式交給 `maps.apple.com` 或設施可選的 `www.google.com/maps/dir/`。不附上用戶 GPS、家中地址或路線起點。探索及官方資料連結用固定 HTTPS URL，無 App 自訂識別欄位。外部 App 或瀏覽器依自身授權取位置、處理網絡資料、帳號及 Cookie。搜尋返回與收藏仍在 KongDaily 畫面。 | **VERIFIED** · KongDaily 的交接參數。外部服務行為依各自政策。 [設施導航](../src/facility-navigation.ts) · [探索導航](../src/explore-places.ts) · [探索來源開啟](../src/app/explore/place/[id].tsx) · [Apple 地圖私隱](https://www.apple.com/legal/privacy/data/zh-hk/apple-maps/) · [Google 地圖 URL 規格](https://developers.google.com/maps/documentation/urls/get-started) · [Google 私隱權政策](https://policies.google.com/privacy?hl=zh-HK) |
| 其他網絡、診斷及遙測 | 四個直接業務 API 以外，未見 KongDaily 後端、App 業務代理、OTA `expo-updates`、登入、付費、廣告或分析／崩潰 SDK 接線。巴士的 `console.info` 受 `__DEV__` 保護，語言設定讀寫錯誤可反映在本機 console。Expo CLI／EAS 管道屬構建端。Apple 平台診斷與 TestFlight 回饋是另外的資料流，ASC 可能讓授權人員讀取；未查到營運者是否存取、下載或另行保留。 | **VERIFIED** · 源碼與鎖檔中的 App 接線。遠端工具／Apple 平台資料及營運存取 **REQUIRES CONFIRMATION**。 [套件鎖檔](../package-lock.json) · [巴士記錄](../src/bus-data.ts) · [語言錯誤](../src/language.tsx) · [Apple TestFlight 資料](https://developer.apple.com/help/app-store-connect/test-a-beta-version/view-build-status-and-metrics/) |

## 2. iOS SDK、Privacy Manifest 與用途理由

`app.json` 與 Expo Production 內省顯示 iOS bundle ID `com.lennystudio.kongdaily`，只見前台位置用途鍵，無 Always 標籤、背景定位、Motion、ATT 用途鍵或 App 自訂 `ios.privacyManifests`。內省 entitlements 為空。專案未提交 `ios/`、`Podfile.lock`、`.xcprivacy` 或 EAS 設定。掃描本機鎖定安裝找到 11 份 `PrivacyInfo.xcprivacy`。以下是本機清單與 Apple 分析應比對的項目，實際發行二進位及資源需看 archive。 [Expo App 配置](../app.json) · [Expo Manifest 指引](https://docs.expo.dev/guides/apple-privacy/) · [Apple Required Reason APIs](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api)

| 組件與版本 | 本機證據 | 狀態 |
| --- | --- | --- |
| Expo 57.0.33、RN 0.86.3、Hermes | RN 的 `React/Resources`、`ReactCommon`、RCT-Folly、boost、glog 共六份來源 manifest，資料收集陣列為空且 Tracking 為 false。用途理由聯集為檔案時間戳 `C617.1`、UserDefaults `CA92.1`、System Boot Time `35F9.1`。RN CocoaPods 腳本可將 pod **用途理由**聚合入 App，不能據此假定收集類型也已聚合。REL-01B 的 Hermes bytecode 證實 JS 引擎產物，Hermes 列於 Apple SDK 名單，候選的原生版本／manifest、二進位來源與簽章及其他列名 SDK 要核對。 | **VERIFIED** · 本機理由與腳本。**REQUIRES CONFIRMATION** · archive、聚合、適用 SDK 簽章。 [Apple 第三方 SDK 要求](https://developer.apple.com/support/third-party-SDK-requirements/) |
| Expo Constants 57.0.24、Localization 57.0.2、FileSystem 57.0.7（Expo 傳遞依賴） | 這三個 podspec 各有 privacy 資源 bundle。Constants、Localization 為 UserDefaults `CA92.1`。FileSystem 為檔案時間戳 `0A2A.1`、`3B52.1` 與磁碟空間 `E174.1`、`85F4.1`。本機清單均無收集項、追蹤或追蹤網域。 | **VERIFIED** · 本機聲明及打包規則。**REQUIRES CONFIRMATION** · 候選實際包含與用途。 |
| Expo Router 57.0.31、Linking 57.0.14、Location 57.0.23、SQLite 57.0.5 | Expo autolinking 全部辨識為 iOS pods。Router／Linking 處理路由及系統開啟，Location 使用 Core Location 讀取前台位置，SQLite 使用本機資料庫，現有設定未開遠端 LibSQL 或 SQLCipher。在已裝套件目錄未見這四項的獨立 manifest，缺少檔案不能推導出沒有 Required Reason API 或沒有任何資料收集。 | **VERIFIED** · 版本、autolinking 與現有接線。**REQUIRES CONFIRMATION** · 候選原生用途碼及隱私報告。 [SQLite SDK](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/) · [Location SDK](https://docs.expo.dev/versions/v57.0.0/sdk/location/) |
| `react-native-maps@1.27.2` · iOS MapKit | 套件 `ios/PrivacyInfo.xcprivacy` 明列 `NSPrivacyCollectedDataTypePreciseLocation`，用途 App Functionality，`Linked=false`、`Tracking=false`。另有 File Timestamp `C617.1`，Tracking Domains 為空。這是 SDK 作者在**收集**欄位的聲明。podspec 預設 `Maps` subspec 與 `Generated` 的資源規則未明列該 plist，不能僅因 npm 目錄有檔案便預期一定隨包，也不能以 archive 看不到該檔案判定沒有資料流。 | **VERIFIED** · 本機聲明內容及 podspec 差異。**REQUIRES CONFIRMATION** · 是否隨包、SDK 是否有 Apple 服務以外的接收者／保留、File Timestamp 理由與實際使用。 [Apple 收集欄位說明](https://developer.apple.com/documentation/technotes/tn3184-adding-data-collection-details-to-your-privacy-manifest) |
| Google Maps Native | 同一 npm 套件還帶有 `ios/AirGoogleMaps/Resources/GoogleMapsPrivacy.bundle/PrivacyInfo.xcprivacy`。Google subspec 宣告 GoogleMaps 9.4.0／Google-Maps-iOS-Utils 6.1.0，manifest 有 Crash Data、Device ID、Performance Data、Product Interaction、User ID 與四組用途理由。App 配置及 RN autolink 未接通 Google subspec，`Linking.openURL` 的 Google Maps 動作是外部連結。 | **NOT APPLICABLE** · 按目前配置不適用 Google Native manifest 的申報。**REQUIRES CONFIRMATION** · `Podfile.lock`、實際資源與 native 連結，確認沒有該 subspec 或其他 Google SDK。 |
| 其他 UI native／Expo 傳遞 pods | React 19.2.3，Symbols、Font、LinearGradient、Asset、ExpoUI、DomWebView、LogBox 等出現在 App／自動連結目錄。RN autolinking 還列了 Gesture Handler 2.32.0、Screens 4.26.2、Safe Area 5.7.0、Masked View 0.3.2、Reanimated 4.5.1、Worklets 0.10.1。本輪未在這組套件目錄發現獨立 privacy 檔案。候選仍需核對轉接／傳遞 pod、資源、API 與簽章，開發用工具的存在或自動連結候選皆不能單獨推導實際 App 資料收集。 | **VERIFIED** · 本機安裝及 autolink 結果。**REQUIRES CONFIRMATION** · 正式包與 Apple 清單對照。 [鎖檔](../package-lock.json) |

**SDK 在裝置上的行為。** Expo Constants 的 `EXConstantsService.m` 建立程序 session UUID，App 的請求未讀取或附加該值。安裝 ID provider 也有 Keychain 及舊 UserDefaults 遷移程式，已裝版本及 App 審查未找到該 provider 的業務呼叫或傳送證據；不以套件能力推定寫入、上傳或卸載後的清除狀態。Expo Localization 則會讀取系統語言及觸及 UserDefaults。Maps pod 內有可讀檔案時間戳的自訂 tile cache 程式（`AIRMapUrlTileCachedOverlay.m`），現有畫面未使用自訂 tile 元件。這些本機程式證據為 **VERIFIED**，候選連結和適用用途理由仍 **REQUIRES CONFIRMATION**。 [Apple Required Reason APIs](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api)

**精確位置的判定。** KongDaily 用本機位置作距離計算、畫面標記和視口，Apple 可在 Core Location 和 Maps 系統服務內處理資料。Apple 的 App Privacy FAQ 明確將 Apple 自行收集的 framework／服務資料，和開發者從 Apple 取得並使用的資料分開。MapKit 供應方聲明 `PreciseLocation` 的接收者與保留尚未明確，現階段維持 **REQUIRES CONFIRMATION**。向 `react-native-maps` 上游核對該宣告是否只描述 Apple 服務、各 provider 和 location 選項的範圍。用候選 `Podfile.lock`、IPA 中 App／frameworks／資源 bundle 的 plist、Xcode Privacy Report 與只讀連線觀察交叉核對。連線觀察可佐證目的端與觸發條件，保留／可讀期限仍以供應方可追溯證據為準。不能把上游資料收集聲明直接複製成 KongDaily 的 App Privacy 答案，也不能在未證實用途前刪除或通用化 manifest。 [Apple App Privacy 及 MapKit FAQ](https://developer.apple.com/app-store/app-privacy-details/) · [Apple Maps 使用說明](https://www.apple.com/legal/privacy/data/en/apple-maps/)

## 3. App Privacy 建議申報矩陣

Apple 以裝置外傳送及開發者／第三方合作方能否在處理即時請求所需期限以外存取來定義「收集」。傳出文字、IP 可見、Apple 原生位置權限和 Apple 所指的 tracking 是不同判斷。以下僅作候選填寫依據，最終選項由營運者按實際收集項、用途、是否連結身份和是否用於追蹤核對。 [Apple 資料類型及 FAQ](https://developer.apple.com/app-store/app-privacy-details/) · [Apple Tracking 定義](https://developer.apple.com/app-store/user-privacy-and-data-use/)

| ASC 數據類型／選項 | 建議與依據 | 狀態 |
| --- | --- | --- |
| Precise Location ／ Coarse Location | 目前沒有 KongDaily GPS 寫入或直接發到巴士／天文台／地政總署的證據。本機距離及位置判斷不應單列為收集。若證實只有 Apple 自身處理 MapKit／Core Location 資料，按 Apple 框架 FAQ 排除該部分。若發現 App 或已整合第三方能在即時請求外存取位置，依實際精度填報及核對 App Functionality、Linked、Tracking。 | **REQUIRES CONFIRMATION** · 特別是 maps SDK 聲明與 Apple／供應方責任邊界。 |
| Search History／Other User Content | 首頁全域搜尋、巴士歷史確認只保存在裝置範圍，這兩部分不填收集。附近 `q` 送往地政總署。若證實可於即時查詢後存取，優先核對 Search History。若保留可辨識住址或非搜尋性自由文字，依留存內容另外評估 Physical Address 或 Other User Content。不要由欄位類型推定身份關聯。 | **VERIFIED** · 本機搜尋部分。**REQUIRES CONFIRMATION** · 地政總署的保留、可讀性、合作關係與使用。 |
| Identifiers、IP、Product Interaction／Other Usage Data | 無自訂帳戶 ID、廣告 ID 或 App 層裝置 ID 傳送。公開站點、路線或語言欄位不等同人／裝置識別。核對供應方是否保留含 IP、User-Agent、站點、查詢的可讀紀錄及用途，再按 Apple 定義判斷標籤。 | **REQUIRES CONFIRMATION** · 業務 API、候選及未來網站日誌。 |
| Diagnostics（Crash／Performance／Other）、Analytics | Repo 未見 App 自行上報的服務。平台自身收集按 Apple FAQ；營運者實際從 ASC 取得和使用的 App Analytics／diagnostics、後續保留及接收者須獨立核對，TestFlight 回饋另列。 | **REQUIRES CONFIRMATION** · 營運流程及候選。 |
| 收藏、置頂、語言、離線快取 | 裝置內資料不以「收集」申報，Apple 系統備份單獨說明。由本機收藏觸發的公開站點 ETA 和語言請求按上行資料項另評估。沒有 App 自建同步。 | **VERIFIED** · 目前儲存路徑。 |
| Contact Info、Email、支援內容 | 現行 App 無客服表單或帳戶欄位。使用者將來主動發信可能提供 Email、文字、版本和自願附件。依正式支援運作核對是否為 App 內採集或 App 外、是否可適用 Apple 可選申報的所有條件，以及網站和信箱的獨立私隱說明。 | **NOT APPLICABLE** · 目前 App 內表單。**REQUIRES CONFIRMATION** · 未來支援工作流。 |
| 付款／健康／通訊錄／相機／使用者照片 | 無該等取用、帳戶、付款或上載功能，隨包 JPEG／PNG 為 App 素材。 | **NOT APPLICABLE** · 目前版本。 |
| Tracking／Data Not Collected | 目前無廣告跨服務追蹤、ATT 接線或資料經紀交接的證據。維持 Tracking 執行路徑檢查。全 App「Data Not Collected」選項待上列收集事實、網站／客服範圍和原生候選確認後決定。 | **VERIFIED** · 未找到 App 追蹤接線。**REQUIRES CONFIRMATION** · 最終標籤及營運流程。 |

## 4. 繁中及英文私隱政策內容契約

下列是寫作大綱和可用事實。未完成的欄位須由營運者填寫並審核，網站或 App 不顯示未填標記。政策需在 App 內容易找到，並使用與 App Store Connect 一致的公開網址。兩語版本的條件、保存期限、接收者及修訂日期應等義。 [Apple App Review 5.1.1](https://developer.apple.com/app-store/review/guidelines/#privacy) · [香港私隱專員公署的查閱及改正指引](https://www.pcpd.org.hk/english/resources_centre/publications/guidance/files/DAR_e.pdf)

| 段落 | zh-HK／私隱政策 | English / Privacy Policy |
| --- | --- | --- |
| 名稱與營運者 | 「港日常 · KongDaily」及其法定營運者、適用範圍（1.0 iOS 與公開網站各自負責的服務）。法定名稱、聯絡資料、服務地區 **REQUIRES CONFIRMATION**。 | Identify KongDaily, its legal operator and the scope of the iOS app and public website. Operator details and jurisdictions are pending confirmation. |
| 使用目的 | 巴士目錄、即時到站、天氣及警告、附近搜查、精選資料、收藏、語言、主動支援。清楚指出基本 App 使用不需帳戶。 | Explain route catalogues, arrivals, weather and warnings, nearby lookup, guides, bookmarks, language preferences and support. Basic app use requires no account. |
| 位置與控制 | 定位獲准後用於比較附近設施及巴士站距離，已有授權時開啟相關畫面可單次讀取。說明前台定位、精確位置開關、關閉或拒絕後仍可手動選地標或搜尋。位置亦可用作附近 MapKit 畫面的標記與視口，iOS 平台流程連至 Apple 說明。 | Explain on-demand location, including a single reading on eligible screens after authorization, approximate or precise settings, manual browsing after denial, and how a location marker or region can be shown on the Apple map. Link to Apple for system handling. |
| 本機儲存與保留 | 收藏與置頂、語言、最多八筆巴士最近搜尋、官方快取留在 App 容器。全域關鍵詞、附近結果及位置畫面狀態在記憶體使用。快取可更新或替換。iOS 備份可能包含 App 資料。 | Describe local bookmarks, pinned stops, language, up to eight recent bus searches and cached public data. Explain in-memory search and location state and possible iOS backup or restoration. |
| 網絡、第三方及用途 | 分別列巴士、天文台及地政總署的請求。提醒附近線上地點搜尋可能提交地址，在外部地圖／網站打開後適用其政策。說明目的地交接，以及供應方、日誌及保存的已確認範圍。公開網站及支援要分開說明。 | Identify transit, weather and Lands Department requests. Eligible Nearby search text may include an address. Explain destination hand-off to maps, external site policies, and the confirmed scope of provider logs and retention. Cover site and support flows separately. |
| 移除及刪除 | 在收藏內移除項目、巴士頁清除歷史；iOS「刪除 App」移除本機資料，卸載保留資料，備份或第三方端依其服務另處理。只公布已確認的支援／網站日誌期限和刪除方式。 | Explain individual removal and clearing recent bus searches. Deleting the app removes its local data. Offloading keeps it. Cover backups, external services and confirmed support and hosting retention separately. |
| 安全措施 | 可寫 App 業務請求使用 HTTPS、設定啟用 ATS、資料用 iOS App 容器。正式候選再核對有效 ATS。沒有 SQLCipher 配置、未作端到端加密或完全匿名承諾。 | Describe HTTPS for app requests, configured ATS and the iOS app container. Confirm candidate settings before publishing stronger claims. |
| 查閱、改正、同意與聯絡 | 寫明如何修改／取消定位授權及向營運者查詢、要求查閱或改正其持有的個人資料、要求刪除，列真實聯絡渠道。先核對接收人、處理程序及適用規則。 | Explain location controls and how to contact the operator about access, correction and deletion of personal data it holds, subject to applicable rules. Use verified contact details. |
| 日期與版本 | 標明實際生效日期、最近更新日期及如何通知重大更改。日期及負責人 **REQUIRES CONFIRMATION**。 | Give the actual effective date, last updated date and change-notice process once approved. |

可寫入政策的已核實句子應留在其範圍內，例如「KongDaily 沒有用戶帳戶。在附近搜尋地點時，合資格的查詢文字會傳送至地政總署的地點搜尋服務。」英文可用 “KongDaily does not require an account. Eligible text entered in Nearby place search is sent to the Lands Department’s Location Search API.” 第三方資料保護程度、是否留存及處理期限應以可追溯的適用聲明確認。本輪政策內容契約 **VERIFIED** 於已描述的功能，公開政策及正式聯絡 **BLOCKED** 於 §8 的資料與交付。

## 5. Support 與公開網站契約

建議同一個由開發者確認的公開 HTTPS 網域採用靜態 HTML，免登入、兩語可互換，最小結構如下。這些是相對路徑方案，實際網址 **REQUIRES CONFIRMATION**。

| 路徑 | 最小內容 |
| --- | --- |
| `/`、`/zh-hk/`、`/en/` | 根目錄有可直接選語言的入口。各語言 App 基本頁列 App 正式名稱、版本範圍、營運者、私隱與支援連結和更新日期。 |
| `/zh-hk/privacy`、`/en/privacy` | 兩語私隱政策、實際負責人與聯絡方法、指定語言與切換、有效／更新日期。 |
| `/zh-hk/support`、`/en/support` | 實際可收件的支援 Email 及適用的營運聯絡資料、常見問題、重現問題指引與更新日期。 |

支援 FAQ 用兩語說明巴士路線、ETA 時效與置頂，附近地圖／列表、手動地標與定位拒絕、探索離線內容與外部導航、收藏刪除。說明網絡失效時哪些是離線正式資料，哪些可能過期、需網絡地圖或政府端點。列清除巴士搜尋歷史、逐筆收藏移除，以及「刪除 App」和「卸載 App」的差異。回報問題可自願提供 App／iOS 版本、介面語言、路線／站點或地點名稱及可重現步驟，提醒先遮蓋截圖中的位置和聯絡資料，避免要求精確 GPS、裝置 ID 或完整資料庫。

建議首版靜態部署以使用者主動 Email 聯絡，網站毋須帳戶、表單、追蹤腳本、廣告、外部字體或地圖嵌入。上線前確認託管商與郵件供應方、TLS、預設 access logs／IP／cookies、保留期與收件權限，政策依實際設定描述。若沿用既有 Vercel 帳戶，也須由開發者確認帳戶、網域與所採設定。本輪只訂契約。上線後實測兩語 URL 能用公開、無登入 HTTPS 打開，以及支援收件。 [Apple Support URL 規格](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/)

## 6. 官方資料及素材署名清單

DATA.GOV.HK 和 CSDI 的公開資料均有附條件的商用及再分發依據，需識別來源、門戶與政府和相關權利人，並遵守發布條件。這些權利按實際資源對照，官網的一般照片、圖文及資料集外公告應查各自條款。建議每項附名稱、機構、門戶、授權／條款頁、版本或日期、KongDaily 整理方式及資料時效說明。 [DATA.GOV.HK 條款](https://data.gov.hk/en/terms-and-conditions) · [CSDI 條款](https://static.csdi.gov.hk/csdi-webpage/doc/TNC)

| 發行項目 | 證據、現有署名與 REL-01C1 處理 | 狀態 |
| --- | --- | --- |
| 九巴／龍運、城巴、嶼巴即時資料及離線巴士索引 | 各營辦商 API 與政府門戶資料集可對應，現有 UI 會標識營辦商。離線站點快照合計 7,841 筆，另有反向站點路線索引。集中列出權利人、政府門戶、資料包及來源，對照站點／站序／ETA 資源、原 API 路徑及資料包生成記錄，避免只列營辦商簡稱。 [九巴／龍運](https://data.gov.hk/en-data/dataset/hk-td-tis_21-etakmb) · [城巴](https://data.gov.hk/tc-data/dataset/ctb-eta-transport-realtime-eta) · [嶼巴 V2](https://data.gov.hk/en-data/dataset/nlb-bus-nlb-bus-service-v2) · [快照文件](nearby-bus-data.md) | **VERIFIED** · 門戶來源與通用重用條件。**REQUIRES CONFIRMATION** · 個別資源條件及完整用戶可見署名。 |
| 天氣與警告 | HKO Open Data 目錄對應目前觀測、九天預報、警告摘要和警告詳細 JSON；天氣頁已有來源和條款入口。使用的 Open Data 端點須以資源發佈及鍵值匹配。保留政府／HKO、門戶與警告資料來源提示；一般 HKO 官網其他素材商用須另取得書面授權。現有天氣圖示由數據代碼映射原生符號。 [HKO 開放資料](https://www.hko.gov.hk/en/abouthko/opendata_intro.htm) · [預報資源](https://data.gov.hk/en-data/dataset/hk-hko-rss-9-day-weather-forecast/resource/aadb43df-64cf-4b78-93bc-8753f8db3b2a) · [警告摘要](https://data.gov.hk/en-data/dataset/hk-hko-rss-weather-warning-summary/resource/68418278-6d92-4206-98ec-08a8b5b64eea) · [警告詳細](https://data.gov.hk/en-data/dataset/hk-hko-rss-weather-warning-information) · [一般網站商用條件](https://www.hko.gov.hk/en/appweb/commercial.htm) | **VERIFIED** · API 的 Open Data 來源及官網素材區分。**REQUIRES CONFIRMATION** · 用戶可見條款及任何超出 Open Data 的摘錄再分發。 |
| FEHD 公廁（960 筆） | 已核對政府門戶繁中及英文資源的精確下載 URL，分別等於本地 `fehd_map_c.xml`／`fehd_map_e.xml` 來源，資料版本 2026-10-26（繁中 feed 另列 2026-03-02）。Nearby 已顯示機構、版本及目前主 feed 原址。集中附兩份門戶資源與 FEHD 權利／政府署名。FEHD 一般網站要求書面授權，若要分發超出該開放 XML 的內容需取得另外依據。 [索引](../assets/data/fehd-toilets.json) · [繁中資源](https://data.gov.hk/en-data/dataset/hk-fehd-fehdlocatn-fehd-facility-and-service-locations/resource/00cb62a1-1ffc-4163-ac54-7703e5822041) · [英文資源](https://data.gov.hk/en-data/dataset/hk-fehd-fehdlocatn-fehd-facility-and-service-locations/resource/161df8ea-b91a-46bf-b703-817a1aadbdcb) · [一般官網條款](https://www.fehd.gov.hk/english/department/copyright.html) | **VERIFIED** · 精確開放資源與本地來源相符。**REQUIRES CONFIRMATION** · 發行署名完整性與資源範圍外使用。 |
| AFCD 郊野廁所（167 筆） | 官方 CSDI 郊野公園廁所 layer，快照 2026-08-04。Nearby 有政府、AFCD、CSDI 及資料權利說明。三筆服務公告來自另外的郊野樂行消息，應確認實際隨包摘要、附日期與原始連結，不把消息 PDF 或文字授權視為已隨 CSDI 座標取得。 [索引](../assets/data/afcd-toilets.json) · [CSDI 資料集](https://portal.csdi.gov.hk/csdi-webpage/dataset/afcd_rcd_1635136427551_29173) · [AFCD 服務消息](https://www.hiking.gov.hk/news) | **VERIFIED** · CSDI 資料出處與現有 Nearby 署名。**REQUIRES CONFIRMATION** · 個別服務公告摘要的適用範圍。 |
| LCSD 公園（48）、寵物專用（36）、寵物共享（45） | 三個獨立 CSDI 來源，快照均為 2026-10-25；原索引及 Nearby 說明已有政府、LCSD、CSDI 署名。寵物規則和附錄依 LCSD 頁面保留針對場地的外連和摘要，核對任何非 CSDI 官網文字／圖表的用法。不在 App 新增原圖或把授權附錄作離線素材。 [公園](https://portal.csdi.gov.hk/csdi-webpage/dataset/lcsd_rcd_1629267205215_19292) · [專用](https://portal.csdi.gov.hk/csdi-webpage/dataset/lcsd_rcd_1670384486075_71092) · [共享](https://portal.csdi.gov.hk/csdi-webpage/dataset/lcsd_rcd_1670384557490_22821) · [LCSD 共享規則](https://www.lcsd.gov.hk/en/facilities/otherinfo/petpark.html) · [LCSD 重要告示](https://www.lcsd.gov.hk/en/notice.html) | **VERIFIED** · 正式資料集與既有來源入口。**REQUIRES CONFIRMATION** · 非 CSDI 官網內容再分發的界線。 |
| 地政總署 Location Search API | 官方目錄及 CSDI 入口支撐資源身份，線上地點搜尋與 MapKit 是不同服務。集中來源清單宜列地政總署、該 API 和適用門戶條款，保留此資料由線上服務返回的區別。 [官方目錄](https://data.gov.hk/en-data/dataset/hk-landsd-openmap-development-location-search-api) | **REQUIRES CONFIRMATION** · 使用條件及現有 App 統一署名補齊。 |
| 運輸署巴士路線折線 | 九條已核實幾何、版本 2026-11-11、精確 CSDI 資源，包內保留 rights credit 和 terms，路線圖有已核實幾何的來源提示。繼續顯示政府、運輸署、CSDI 署名並保留處理說明與版本。 [正式折線](../assets/data/bus-route-geometry.json) · [CSDI 路線](https://portal.csdi.gov.hk/csdi-webpage/dataset/td_rcd_1638844988873_41214) · [實施記錄](UI-02D2-BUS-ROUTE-GEOMETRY-IMPLEMENTATION.md) | **VERIFIED** · 包內來源及資料版次、UI 有來源提示。候選須檢查署名可讀。 |
| 探索內容 | 8 處本地雙語整理、39 個官方 HTTPS 來源，詳情按語言展示最多兩個，沒有從來源頁抓取景點照片。保留內容與來源證據，官網原文／圖片再分發要另查條件。 [內容資料](../assets/data/explore-places.json) · [實施與來源](UI-05C1-EXPLORE-DATA-IMPLEMENTATION.md) | **VERIFIED** · 正式內容、來源與離線讀取。**REQUIRES CONFIRMATION** · 如日後另引用原篇或圖片的授權。 |
| 維港及西九照片 | 本地 credits 與原始資源頁相符。維港為 Kevin Huynh／Pexels，西九為 Jeanne Rose Gomez／Unsplash，公開授權容許 App 內用途，署名非強制，建議保留作者及連結。不得用於暗示認可或作為素材庫原樣販售，品牌標誌、第三方肖像、正式商店宣傳另核對。 [本機記錄](../assets/home/credits.md) · [維港原頁](https://www.pexels.com/photo/hong-kong-skyline-across-victoria-harbour-34127349/) · [Pexels](https://www.pexels.com/license/) · [西九原頁](https://unsplash.com/photos/a-boat-is-in-the-water-with-a-city-in-the-background-f4TcefPunWg) · [Unsplash](https://unsplash.com/license) | **VERIFIED** · 所列原頁身份及公開授權允許目前嵌入用途。 |
| 龍脊照片 | 詳見 §7。 | **BLOCKED** · 來源授權已核實，隨成品署名及 CC 相容分發尚未完成。 |
| 系統圖示、圖案、字體、品牌及依賴通知 | `expo-symbols` 用 SF Symbols，本機無隨包自訂字體檔。搜尋香港插畫在 RN 程式碼中繪製。探索四張類別抽象 PNG 隨 `7eb269a` 入庫，尚未見獨立製作／授權記錄。應取得營運者對既有品牌圖案及 PNG 附帶素材權利的記錄。App Icon、截圖及商店素材另查，原生 pods 和實際隨包 JS 的各開源通知列入發行清單。 [SF Symbols](https://developer.apple.com/sf-symbols/) · [探索圖案](../src/components/explore-artwork.tsx) · [搜尋插畫](../src/components/search-harbour-illustration.tsx) | **VERIFIED** · 素材類別和位置。**REQUIRES CONFIRMATION** · 圖案來源／權利及候選的 notices。 |
| Apple MapKit | 目前兩個共用原生地圖組件使用 Apple 地圖底圖，不自行下載或打包地圖資料。Apple marks、法律連結和權利告示須保持原樣及可見。REL-03 在 Nearby、搜尋設施、巴士路線圖驗選點卡與小屏／大字不覆蓋署名。 [MapKit 指引](https://developer.apple.com/design/human-interface-guidelines/maps) · [Apple Developer Program Agreement，Attachment 6](https://developer.apple.com/support/terms/apple-developer-program-license-agreement/) | **REQUIRES CONFIRMATION** · 原生顯示及發行權利告示。 |

## 7. 龍脊照片 · 原圖及分發決定

- **VERIFIED · 身份及權利。** `assets/home/dragons-back.jpg` 為 720 × 480，SHA-256 `8a03f2f99a28c0353f8e821692f2499b7215a56c83460e9ad23bc57f5d209a8a`。Wikimedia 由作者 Bjørn Christian Tørrissen（Uspn）以自己的作品發布，註明 CC BY-SA 4.0 International。以只讀下載取得 5,184 × 3,460 原圖，SHA-1 `4ed1a6b9383f01b03a1fa65d18e659dc6e276383` 與 Wikimedia 元資料一致。同法縮至 64 × 64 比對像素，RGB 相關係數 0.998743、平均絕對差 2.462／255，與倉庫記載的縮圖及再壓縮相符。照片在首頁卡片透過 `resizeMode="cover"` 裁視並加漸層。 [原始檔案及授權](https://commons.wikimedia.org/wiki/File:Dragons-Back-Northwards.jpg) · [本地 credits](../assets/home/credits.md) · [首頁引用](../src/app/(tabs)/index.tsx) · [卡片](../src/components/home-ui.tsx)
- **VERIFIED · 離線授權框架。** CC BY-SA 4.0 允許商用、公開再分發及改編，遵循 §3 的合理署名。保留作者和原來源、隨原作提供的權利／授權及免責提示、授權連結，說明實際縮放、再壓縮與畫面裁視／漸層。純技術性變更本身不構成改編，若再分發的照片衍生版本構成改編，要以相同或相容授權提供該衍生版本。授權及改動標記針對照片及其衍生素材，允許用戶按同一條款行使權利。 [CC BY-SA 4.0 §2–3](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en)
- **BLOCKED · 目前成品。** 本地 `credits.md` 有作者及修改紀錄，但首頁、探索詳情、設定及導覽無用戶可見的照片署名。離線 App 分發需把雙語權利資料隨 App 保存，原圖及授權連結可在網絡可用時查閱。另要核對商店分發條款或內容保護會否限制用戶對照片及衍生素材行使授權權利。可評估同時在公開來源頁提供帶同一授權、無額外限制的實際分發版本，這不能單獨證明另一路 App 分發沒有施加限制。截圖如包含此素材，也需保留合理署名與分享條件。 [CC BY-SA 4.0 §2(a)(5)、§3(b)](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en) · [Creative Commons 關於 DRM 的 FAQ](https://creativecommons.org/faq/index.html)
- **REQUIRES CONFIRMATION · 放行決定。** 如保留照片，實作 App 內離線可見署名，確認 App／商店截圖分發方式及改編權利，或取得作者另行書面許可。若無法證明分發方式相容，以核准且有明確分發權的照片、既有授權圖案或原卡片的純色底替代。保留龍脊卡片尺寸、文字與跳轉；替換時從實際 Metro 資產和商店截圖移除舊圖。署名不能代替欠缺的使用權。

可供後續「資料來源及署名」使用的內容契約。繁中「龍脊照片《Dragons-Back-Northwards》由 Bjørn Christian Tørrissen（Uspn）拍攝，經 Wikimedia Commons 按 CC BY-SA 4.0 提供。隨 App 的版本已縮小及重新壓縮，首頁卡片有裁視及漸層。」英文 “Dragon’s Back photograph, *Dragons-Back-Northwards*, by Bjørn Christian Tørrissen (Uspn), via Wikimedia Commons under CC BY-SA 4.0. Resized and recompressed for the app, with cropping and a gradient in the home card.” 連同原作及授權連結一起呈現。分發衍生檔時另核對相關授權標記。

## 8. 開發者需提供的事實及 REL-01C1 範圍

| 項目 | 所需資料及驗收 | 狀態 |
| --- | --- | --- |
| 發布者、政策負責人及可用聯絡方式 | 法定營運者及公開名稱、適用聯絡地址和電話（如需）、實際支援及私隱 Email、收件和請求負責人、服務地區、生效與更新日期。Bundle ID、倉庫帳號及政府資料集的維護電郵都不能作為 KongDaily 的營運證據。 | **REQUIRES CONFIRMATION** |
| 正式網站與營運安排 | 確認域名／託管、網址決策、站點訪問日誌和 Cookie、實際資料接收者、支援信件／附件保存期限、權限及刪除流程。核實 Google／Apple 外部服務指引及供應方保留，優先詢問地政總署公開 API 維護者。 | **REQUIRES CONFIRMATION** |
| 平台、供應方與申報 | 確認 Maps manifest 所述接收者、ASC 讀取的 Analytics／diagnostics 和 beta 回饋、匯出及清除策略。比對候選 native SDK、Reasons 與採用的 App Privacy 選項後由授權人審核。 | **REQUIRES CONFIRMATION** |
| 照片及發行素材權利 | 決定龍脊照片的 CC 相容分發途徑或批准替代素材，保存品牌、探索插畫及商店素材的來源證明。核對 API／非開放資料摘錄及 CSDI、政府門戶、SDK 署名。 | **BLOCKED** · 現有龍脊成品。其他資料依 §6。 |
| 最小 App 接線 | 沿用根 Stack 的 `/settings`。在現有語言設定區之後加入輕量「關於／About」段落，提供「私隱政策／Privacy Policy」和「支援／Support」的正式已核實 HTTPS 連結及原生開啟失敗處理。加一個可離線讀取的「資料來源及署名／Data Sources & Credits」入口，可用現有 Stack 的簡單文字頁，或現有設定內展開。原有 Nearby 及天氣／探索來源入口保留。標識和文案兩語一致，避免為來源拆出複雜管理功能。 | **BLOCKED** · 現行設定只有語言；待正式資訊、路徑及授權驗證後在 REL-01C1 實作。 [設定](../src/app/settings.tsx) · [根 Stack](../src/app/_layout.tsx) |

REL-01C1 交付建議為雙語文案與網站檔、既有設定連結和離線署名、小範圍合法素材處理，以及可追溯的 App Privacy 草案。候選前原生理由補充與鎖定依賴由 REL-02 處理，正式 Archive 的 manifest、SDK 簽章、前台權限提示與地圖署名由 REL-03 驗收，App Store Connect 紀錄及送審由授權營運者在 REL-04 完成。

## 9. TestFlight／App Store 待完成門檻

| 項目 | 目前結論 |
| --- | --- |
| TestFlight 候選包 | **BLOCKED** · REL-01A／01B 的 EAS 正式配置、簽名與安全實機核對未有新候選證據。先核實歸檔隱私清單、Required Reasons、適用 SDK 簽章及素材分發權。此為專案放行門檻；內測與外測的 Apple 流程分開處理。 |
| 外部 TestFlight | **BLOCKED** · 在分發前完成必要的政策與署名、確認真實 Feedback Email、Beta 測試資訊及 Apple 外測審核，保存測試者回饋使用與留存說明。 [Apple 外測資料](https://developer.apple.com/help/app-store-connect/test-a-beta-version/provide-test-information/) |
| App Store 提交 | **BLOCKED** · 需可公開的雙語政策及支援頁和 App 入口、正式申報和合法素材分發證明。確認正確 ASC App 記錄、所有素材及截圖、Apple 地圖標誌、SDK 隱私報告與用途理由，並結清 REL-01A 其餘構建、簽名、版本及商店項目。 [Apple 審核指引](https://developer.apple.com/app-store/review/guidelines/) · [REL-01A 發布門檻](REL-01A-RELEASE-BLOCKER-REVALIDATION.md) |
| 帳號刪除、背景定位、App 內廣告追蹤 | **NOT APPLICABLE** · 現在的 App 沒有帳號、背景定位或廣告追蹤功能。 |

## 10. 證據檢查及 Git

- **VERIFIED** · `git status --short --branch`、`git rev-list --left-right --count origin/develop...HEAD`、`git ls-remote --heads origin develop` 及 REL-01B 的提交存在性。
- **VERIFIED** · 使用 Node 22.13.0 執行本機 Expo Production `config --type introspect --json`，讀取 SDK `PrivacyInfo.xcprivacy`、podspec 與 React Native 的 privacy aggregation。驗證 `expo-modules-autolinking resolve --platform apple --json` 以及 `react-native-config --platform ios --json`。這些結果屬 API 及包裝來源證據。
- **VERIFIED** · 以官方門戶、Apple SDK／App Privacy 說明、原相片及授權條文和當前代碼交叉核對。比對原相只用暫存檔。仍缺供應方日誌保留、營運資料及已簽名候選包，相關發行結論已標記。
- **VERIFIED** · `npm run typecheck`、設施收藏／SQLite、全域搜尋正式資料、探索資料及官方折線定向校驗通過。工作區只新增本報告，`git diff --check` 與新報告的空白及本地連結檢查通過。分支與 HEAD 仍為 `develop` 和 `30fe7b8`。

本輪未修改業務程式、配置、依賴、設計或正式資料。未建立或部署網站，亦無 App Store Connect 修改、EAS Build、原生模擬器或裝置操作、提交、推送或合併。REL-01C0 審計已交付，等待人工審核。
