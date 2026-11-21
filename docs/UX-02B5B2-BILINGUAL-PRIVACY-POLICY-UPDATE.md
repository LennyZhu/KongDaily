# UX-02B5B2 · 雙語私隱政策候選版

**兩語候選稿完成，待開發者審閱。下一版本公開發布仍為 NO-GO。** 兩份全文已按相同資料流及保留安排核對，均標示 2026-11-21 香港時間修訂，正式生效日期待確認。

- [繁體中文（香港）候選政策全文](privacy/UX-02B5B2-PRIVACY-POLICY.zh-HK.md)
- [English candidate Privacy Policy](privacy/UX-02B5B2-PRIVACY-POLICY.en.md)

## 版本與網站基線

開工時 `develop` 工作區乾淨。HEAD、本機 `origin/develop` 及透過 `git ls-remote origin refs/heads/develop` 核實的 GitHub 分支均為 `98b9cc43fd1ce25c2701c2798c66573fa680d503`。該提交含 UX-02B5B1 歸檔，B5B1 的 iPhone 連結與大字驗收仍由開發者確認。公開的 iOS 1.0.0 (Build 2) 對應標籤 `v1.0.0` 的提交 `f35d593f538e02803082e13dfb71b906c1b2675e`。B5B 已核對該版 IPA 不含兩個鐵路即時端點。下表中的鐵路行為以本次 `develop` 為準。 [B5B 審計](UX-02B5B-DATA-LICENSING-ATTRIBUTION-PRIVACY-AUDIT.md) · [B5B1 歸檔](UX-02B5B1-RAILWAY-DATA-ATTRIBUTION.md)

| 項目 | 位置及狀態 |
| --- | --- |
| 目前公開政策 | v1.0，生效及首次更新均為 2026-11-20。送審交接紀錄列出的 URL 是繁中 `/privacy/` 及英文 `/en/privacy/`，本輪實測兩頁可讀。 [繁中](https://kongdaily-site.vercel.app/privacy/) · [English](https://kongdaily-site.vercel.app/en/privacy/) · [REL-02A URL 紀錄](REL-02A-IOS-RELEASE-CONFIG-READINESS.md) |
| App 入口 | 設定 → 私隱政策（`/settings/privacy`）。離線畫面與網站同讀 `content/compliance.json`，透過共用模組產生兩語政策。 [入口](../src/app/settings/privacy.tsx) · [共用政策](../content/compliance-policy.js) |
| 網站原始碼 | KongDaily 同一 Git 工作區下的 `website/`，無獨立網站分支。既有 Vercel 專案為 `homeypaw/kongdaily-site`。`vercel.json` 設定 `git.deploymentEnabled: false`，正式構建是 `node website/build.cjs --release`，輸出是 `website/dist/release`。 [構建配置](../vercel.json) · [首發紀錄](REL-01C1B5-VERCEL-FIRST-PRODUCTION-DEPLOYMENT.md) |
| 草稿隔離 | 本次三份檔案只在 `docs/`。正式構建讀取現行共用政策及資產白名單，候選稿留在 Git 審閱範圍。實際構建的 16 個公開檔案與 HEAD 輸出逐位元組相等，線上兩語 HTML 仍符合已批准的 v1.0。 [構建器](../website/build.cjs) |

## 相對現行政策的修訂

| 章節 | 修改 |
| --- | --- |
| 範圍與日期 | 標示下一版本草稿，指向 1.0.0 (2) 的現行政策。加入日後更新時列明適用版本及日期的說明。 |
| 定位與本機搜尋 | 補上交通頁只在需要附近巴士結果時自動定位，以及港鐵／輕鐵靜態目錄的離線瀏覽與字詞比對。保留權限、手動地標、備份、暫存及清除安排。 |
| 線上服務 | 說明巴士及天氣請求的欄位邊界。附近巴士可依本機距離選取要查詢的公開站點。App 內附近地圖可使用裝置位置標記或置中，原有 Apple 平台及外部導航披露保留。 |
| 鐵路即時預報 | 加入兩個獨立請求、官方供應機構、必要欄位、可處理的連線資料、留存未知、前台／手動更新、記憶體重用及過期處理。版權及署名沿用 B5B1 資料來源頁。 |
| 核心既有條款 | 保留營運者、免帳戶使用、地政總署可能收到地址文字、Vercel 網站、支援郵件結案後最多 12 個月及法律例外、刪除、HTTPS、權利及聯絡方式。 |

## 資料流、接收者與留存

下列 App 資料查詢使用 HTTPS。App 沒有在公開資料查詢中加入帳戶、廣告或自訂裝置識別碼。網關及服務端可接收 IP、請求時間或標準標頭，是否在回應後可存取以及是否與其他資料關聯須有獨立證據。

| 功能與接收者 | 實際傳送與用途 | 本機保留和證據邊界 |
| --- | --- | --- |
| **港鐵即時** · `rt.data.gov.hk/v1/transport/mtr/getSchedule.php` | GET 只帶所選合法 `line`、`sta` 及固定 `lang=EN`。香港鐵路有限公司供應資料，香港特區政府 DATA.GOV.HK 服務發布。沒有 GPS、自由文字、帳戶、App 加入的裝置 ID 或請求 body。預報顯示語言在本機處理。 | 同 URL 併發合併，讀數在記憶體短暫重用。與輕鐵同用 `credentials: 'omit'`，約 20 秒重用窗、60 秒新鮮度判定，無 SQLite 持久化。政府網關與港鐵的後續可存取紀錄未知。 [Client](../src/mtr-next-train-client.ts) · [資料集](https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data) · [規格 v1.7](https://opendata.mtr.com.hk/doc/Next_Train_API_Spec_v1.7.pdf) |
| **輕鐵即時** · `rt.data.gov.hk/v1/transport/mtr/lrt/getSchedule` | GET 只帶所選合法 `station_id`、固定 `with_special=1`，取得該站預報及特別班次。無 GPS、搜尋字詞、帳戶或 App 加入的裝置 ID。供應機構與政府服務角色同上。 | 兩者於選定車站頁進入／重新聚焦、回前台或手動刷新時按需查詢。背景沒有定時查詢，倒數計時器只更新畫面，429 退避。過期預報不再作即時資料顯示。應用程式快取秒數不代表服務端留存。 [Client](../src/light-rail-next-train-client.ts) · [共用 client](../src/next-train-client.ts) · [更新週期](../src/next-train-hooks.ts) · [資料集](https://data.gov.hk/en-data/dataset/mtr-lrnt_data-light-rail-nexttrain-data) · [規格 v1.1](https://opendata.mtr.com.hk/doc/LR_Next_Train_API_Spec_v1.1.pdf) |
| **巴士** · `data.etabus.gov.hk`（九巴／龍運）、`rt.data.gov.hk`（城巴／嶼巴） | 查目錄、站點、站序與 ETA。使用公開路線、方向／服務類型、站碼、嶼巴路線 ID／語言等適用欄位。附近距離計算和收藏可選出站點。無原始 GPS、查詢字詞或收藏庫。 | SQLite 快取官方目錄、站序和站點。即時 ETA 按功能讀取。各接收者的可讀請求日誌、保留期限及關聯待證。 [目錄](../src/bus-data.ts) · [站點](../src/bus-stop-data.ts) · [ETA](../src/bus-eta.ts) · [附近站點](../src/nearby-stop-routes.ts) |
| **天氣及警告** · `data.weather.gov.hk` | 香港天文台接收 `dataType=rhrread/fnd/warnsum/warningInfo` 及 `lang=en/tc`。無輸入文字、GPS 或帳戶參數。另可由使用者開啟 `www.hko.gov.hk` 等官方資訊。 | 官方回應可在 SQLite 快取。一般網站私隱聲明未釐清開放數據端點的日誌。 [天氣 client](../src/weather-data.ts) · [天文台政策](https://www.hko.gov.hk/en/privacy/policy.htm) |
| **附近地點文字搜尋** · `www.map.gov.hk/gs/api/v1.0.0/locationSearch` | 地政總署接收符合條件的 `q`，可能是使用者鍵入的地址。沒有附送當時 GPS 或 App 識別碼。結果含地點坐標，供本機呈現和地圖選點。 | 查詢結果短暫留於 App 記憶體。官方接口資料未說明查詢原文、IP、時間與標頭在回應後的可讀留存。 [Client](../src/landsd-location-search.ts) · [地政總署 API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/LocationSearchAPI) |
| **GPS 與設施** · iOS Core Location、裝置本機 | 前台單次讀取及精確位置權限。手動地標可作回退，靜態鐵路目錄及內嵌搜尋跳過附近巴士定位。食環署、漁護署及康文署設施採隨包快照，在本機計算距離，無向設施發布者傳 GPS 的查詢。 | 位置暫用於記憶體，無持久位置歷史或背景定位。Apple 平台的處理另見地圖。 [定位](../src/nearby-bus-location.ts) · [交通焦點](../src/app/bus/nearby.tsx) · [設施來源](../src/compliance-credits.ts) |
| **App 內地圖／外部導航** · Apple MapKit、`maps.apple.com`、`www.google.com` 及使用者開啟的官方網站 | 即使 `showsUserLocation` 關閉，MapKit 仍可取得用作地圖中心或自訂標記的坐標。外部步行導航的 URL 只加入已選目的地坐標及步行模式，外部 App 可自行依權限定位。探索、天氣、服務提示、政策等外部連結由使用者開啟。 | Apple 和其他服務依各自安排處理。未發現開發者接收地圖遙測。實際 SDK 入包、其他接收者與留存交 B5B3。 [附近地圖](../src/components/nearby-facilities-map.tsx) · [外部導航](../src/facility-navigation.ts) · [Apple 地圖私隱](https://www.apple.com/legal/privacy/data/zh-hk/apple-maps/) |
| **全域搜尋、交通搜尋、收藏及偏好** · 裝置本機 | 兩個搜尋入口皆在裝置比對。港鐵和輕鐵的本機 JSON 由靜態 import 隨包納入，離線瀏覽及搜尋不向鐵路服務傳送字詞。巴士目錄可在搜尋時更新但無查詢字詞。 | SQLite 保存收藏、首頁置頂、語言、最多八筆舊巴士頁最近搜尋及官方快取。可取消收藏或置頂及清除巴士搜尋。刪除 App 可移除本機資料，卸載保留文件與資料，iOS 備份另管。 [SQLite](../src/database.ts) · [港鐵目錄](../src/mtr-static.ts) · [輕鐵目錄](../src/light-rail-static.ts) |
| **郵件／網站** · 外部郵件 App、營運者的 163.com 郵箱、Vercel | App 的 `mailto:` 只含收件地址。使用者寄出後，營運者與郵件服務可收到其提供的姓名、地址、描述及附件。網站無表單、帳戶或追蹤程式，Vercel 可處理交付、安全及營運所需的連線資訊。 | 營運者可控制的一般支援郵件與附件，在個案解決後最多保留 12 個月，法律例外另計。服務商獨立管理連線資訊、備份及保留安排。 [營運流程](operations/SUPPORT-EMAIL-RETENTION.md) · [網站說明](../website/README.md) · [Vercel 私隱聲明](https://vercel.com/legal/privacy-notice) |
| **SDK、日誌及診斷** · Expo、React Native、Expo Location、Expo SQLite、`react-native-maps` | 比對發布標籤和目前套件與設定，未見新增獨立 Analytics、Crash Reporting、廣告或追蹤 SDK。巴士診斷為 `__DEV__` 本機 Console，未發現上傳管道。App 無自設帳戶或上傳 API。 | 原生 SDK 及 Apple 診斷交候選 Archive 核查。政策沒有對 Apple、地圖、主機或資料來源作零收集保證。 [套件](../package.json) · [App 設定](../app.json) · [Build 2 Gate C](REL-03D1-APP-PRIVACY-GATE-C.md) |

已查的港鐵、輕鐵規格可核對 URL 及欄位。DATA.GOV.HK 的一般私隱政策無法確認兩個即時端點的留存。待核實政府網關與港鐵各自能否在即時回應後查閱線站代碼、IP、標頭及時間，以及保留期、關聯、使用目的和共享對象。現有 HTTPS 或連結可達性不能證明服務端的刪除與去識別。鐵路資料授權、配額及已解析預報的快取限制仍沿用 B5B／B5B1 待決事項。 [DATA.GOV.HK 私隱政策](https://data.gov.hk/en/privacy-policy) · [B5B 待決條件及求證範圍](UX-02B5B-DATA-LICENSING-ATTRIBUTION-PRIVACY-AUDIT.md)

## B5B3 App Privacy 核對

1. 使用相同候選 Git SHA 的正式 `.xcarchive`／IPA、Pod 鎖檔及 Xcode Privacy Report，核對實際 SDK、Privacy Manifest、Required Reason API、權限、網絡主機及欄位。以有／無定位、鐵路靜態目錄／即時站頁等場景分開取證。
2. 核對 `react-native-maps@1.27.2` 上游 manifest 的 `PreciseLocation`（App 功能、未關聯、非追蹤）在正式成品的適用範圍。Build 2 未包入該檔。需確認 MapKit 以外是否有非 Apple 的位置接收方、能否留存或關聯。亦須複查 Expo FileSystem manifest 打包差異、適用的 Required Reason 理由，以及開發者透過 Apple 或 TestFlight 取得的可識別診斷資料。 [上一版成品證據](REL-03D1-APP-PRIVACY-GATE-C.md)
3. 核實適用接收方是否在完成即時服務後仍可存取資料，再按證據評估 LandsD 的 Search History、線站查閱的 Product Interaction、IP 或其他資料的用途與關聯、可能推斷的位置精度及 Tracking。Apple 自身收集與開發者從 Apple 服務取得的資料有不同申報責任。公共 API 接收方的適用範圍如仍有疑義，向 Apple Developer Support 提供具體資料流求證。 [Apple App Privacy 定義及指引](https://developer.apple.com/app-store/app-privacy-details/)
4. 目前公開的 `No Data Collected` 按已發布版本記錄。B5B2 的文字與程式核對不足以確認下一版本答案。由開發者按 B5B3 的成品與留存證據確認，並協調申報及發行。 [App Store Connect 流程](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy)

## 正式發布檢查清單

- [ ] 確認下一版本功能、B5B1 人工驗收、鐵路資料再利用、快取和配額決策。取得候選 Archive、SDK Privacy Report 及 B5B3 申報依據，將其與本文核對。
- [ ] 批准兩語正文、正式政策版本、適用 iOS 版本、正式生效及更新日期。保留 2026-11-20 的首次上線事實。現有網站 Gate 將 `publication.effectiveOn` 與歷史 `firstPublicDeploymentAt` 的香港日期相綁。如採獨立的修訂生效日，發布變更需明確支援此日期並驗證歷史欄位。若保留首發生效日、用 `updatedOn` 公示修訂，正文應標明鐵路條款的適用版本與日期。
- [ ] 審批後才將正文同步入 `content/compliance.json`。以核准的適用範圍和生效資料取代草稿標示。如正式網址沿用，將兩稿中的 v1.0 連結改為實際可用的歷史版本連結，避免指回新政策同一頁。執行 `node scripts/test-compliance.cjs`、`node website/build.cjs --check-release`、`node website/build.cjs --release` 和 `node website/build.cjs --check-output website/dist/release`。比對候選 Archive 的 App 離線政策及核准網站內容，確認兩語日期及連結。
- [ ] 確定兩個本地化政策 URL，協調 App Store Review、App Privacy 與網站公布日期。若同時服務舊版，網站清楚指出鐵路條款適用於包含該功能的版本，讓 1.0.0 用戶可查明其適用條文。
- [ ] 經開發者明確批准後，由指定 revision 準備 Production 靜態輸出，核對 Vercel `homeypaw/kongdaily-site`、輸出與可回退的既有部署。與 App 發布協調上線。公布後執行 `node website/build.cjs --check-live`，核對兩語 HTML、語言切換、日期、支援與郵件連結。核對 App Store Connect 預覽的本地化 URL 與 B5B3 批准的申報。 [網站流程](../website/README.md) · [既有部署及回退流程](REL-01C1B4-PRODUCTION-WEBSITE-GATE-A.md)

## 驗證及 Git

| 檢查 | 結果 |
| --- | --- |
| 雙語內容 | PASS。兩語各 9 章，逐段核對現行條款、服務、離線／即時範圍與留存。機器檢查原有段落與連結、候選標記、兩個官方來源及關鍵披露。 |
| `npm run typecheck`、`node scripts/test-compliance.cjs` | PASS。驗證 i18n、App 內設定到離線私隱／支援／資料來源、網站連結及既有發布 Gate。 |
| `node --test scripts/test-nearby-bus-location.cjs scripts/test-mtr-next-train.cjs` | 58/58 PASS。涵蓋請求建構、刷新／過期、靜態目錄及定位範圍。以現有測試樣本與模擬請求核對 App 邏輯。 |
| `node website/build.cjs --check-release` 及隔離構建 | PASS。正式輸出 16 檔與 HEAD 逐位元組相同。隔離重建兩語候選 HTML，含草稿標示與 `noindex`。正式構建拒絕未核准的日期，未產出候選 Production 目錄。 |
| `node website/build.cjs --check-live` | PASS。線上雙語 HTML 與已批准輸出相符。語言導覽、郵箱連結、重定向及預期 404 均核對。 |
| 候選稿公開連結 | 17/17 唯讀 HTTPS GET 回傳 200，兩語 `mailto:` 指向既有聯絡郵箱。連結測試未向即時業務 API 發送查詢或發出郵件。 |
| `git diff --check` 與新增文件空白檢查 | PASS。 |

本輪只新增本報告及兩份候選稿。完成後 `develop` HEAD 與 `origin/develop` 均為 `98b9cc4`，工作區只有這三份未追蹤文件。公開網站及現行政策維持 v1.0，App Store Connect 沒有變更。待開發者審閱候選稿及日期，B5B3 另行核實 App Privacy。
