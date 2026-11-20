# REL-01C1B2 · 私隱政策、資料保留與照片分發

2026-11-20（香港時間）。開工時 `develop` 工作區乾淨，本機 HEAD、本機 `origin/develop` 及 GitHub `refs/heads/develop` 均為 `fa1b4f2a0a5ccdf26c99511f65625cd7a67dfde5`，提交分歧 `0 / 0`。此提交包含 C1B1。已對照 [C0 審計](REL-01C0-PRIVACY-AND-ATTRIBUTION-AUDIT.md)、[C1A 實作](REL-01C1A-IN-APP-PRIVACY-AND-CREDITS-IMPLEMENTATION.md)、[C1B0 預檢](REL-01C1B0-WEBSITE-PUBLISH-PREFLIGHT.md)、[C1B1 發佈準備](REL-01C1B1-LEGAL-IDENTITY-AND-WEBSITE-READINESS.md) 和目前程式。

**網站部署前結論：NO-GO。** 本輪解除 App 與網站正式日期及補充政策可能分歧的技術缺口，並查實線上地點搜尋的 API、資料欄位、文件和聯絡渠道。已整理雙語審批稿。正式政策、營運方保留安排及素材放行仍待批准。

## LandsD 證據及查詢邊界

| 證據 | 可確認的範圍 |
| --- | --- |
| API 文件、資源目錄及官方例子 | CSDI 的專用文件確認 `GET https://www.map.gov.hk/gs/api/v1.0.0/locationSearch?q=…` 及 JSON 回應，並要求應用程式避免短時間大量請求。官方例子使用公共字詞 `cultural centre` 返回 JSON。CSDI 公告確認 2026-05-04 改用 `www.map.gov.hk`。文件列 `geoinfomap@landsd.gov.hk` 為 GeoInfo Map Support Team，資料目錄列 `mapapi@landsd.gov.hk` 為 Map API Support Team。 [API 文件](https://portal.csdi.gov.hk/csdi-webpage/apidoc/LocationSearchAPI) · [中](https://data.gov.hk/tc-data/dataset/hk-landsd-openmap-development-location-search-api)／[英](https://data.gov.hk/en-data/dataset/hk-landsd-openmap-development-location-search-api)資源目錄 · [CSDI 公告](https://portal.csdi.gov.hk/csdi-webpage/info/WhatsNew) |
| KongDaily 請求 | 「附近」合資格文字經正規化、400 ms 防抖及排程後，可在用戶選擇結果前經 `q` 送出。自訂應用層標頭是 `Accept: application/json`。查詢可能包含用戶自己輸入的地址。App 沒有附加原始 GPS 座標、地圖視口、定位授權狀態、帳號或自訂裝置識別碼。結果和查詢鍵只在程序記憶體重用，有效期五分鐘、最多 24 條。到期代表停止重用，程式沒有定時清除每筆到期資料。 [搜尋畫面](../src/components/nearby-search-sheet.tsx) · [請求與快取](../src/landsd-location-search.ts) |
| HTTPS 隨附資訊 | 服務端或其基礎設施可接收來源 IP、請求時間及標準連線或 HTTP 資訊。原生客戶端的實際標頭、受委託接收端及服務方記錄的欄位仍未核實。HTTPS 保護傳輸，伺服器仍會收到查詢。 |
| 使用條款及一般私隱說明 | API 文件連至 CSDI 條款，涵蓋門戶空間資料和 API 的使用、來源與權利說明。`DATA.GOV.HK` 的使用條款及私隱政策屬目錄網站；GeoInfo Map 網頁私隱聲明涵蓋網站瀏覽統計及網站定位。三者均未證明本 API 是否保留 `q`、IP 或其他日誌，也未列該端點的保留期限。MyMapHK 屬另一款 App。 [CSDI 條款](https://portal.csdi.gov.hk/csdi-webpage/doc/TNC) · [資料目錄條款](https://data.gov.hk/en/terms-and-conditions)及[私隱政策](https://data.gov.hk/en/privacy-policy) · [GeoInfo Map 網站聲明](https://www.map.gov.hk/gm/gmid/ngqhH6nO4W?lg=en) |
| 資料保護聯絡 | 地政總署的收集個人資料聲明列出查閱／改正安排及 `dpco@landsd.gov.hk`。政策提供此連結作一般聯絡，API 專用證據仍需向維護者核實。 [繁中聲明](https://www.landsd.gov.hk/tc/about-us/contact-us/collection-statement.html) · [English statement](https://www.landsd.gov.hk/en/about-us/contact-us/collection-statement.html) |

**待核實的事實：** `q`、IP、標頭及時間有沒有寫入服務、邊緣或安全日誌；誰可查取；用途；各紀錄的保存、匿名化或刪除方式；有沒有供用戶適用的查閱或刪除流程。可把確切端點及欄位清單交給官方 API 聯絡渠道核實，回覆中須能辨識適用服務。現有證據足以如實披露傳輸及公開記錄的限制。若營運者審閱後批准這種披露，審批記錄可註明沒有公開期限。政策與 App Privacy 仍須各按其目的核實，任何未取得的事實保持 **REQUIRES CONFIRMATION**。

## 實際資料流、保留與刪除

| 資料及用途 | 接收方、是否離開裝置 | 保留、刪除及待核實 |
| --- | --- | --- |
| 首頁全域搜尋文字、結果及畫面狀態，用於配對巴士、設施及探索資料 | App 畫面記憶體。只有獨立的官方巴士目錄取得請求離機，無全域關鍵詞。 | 隨畫面／程序生命週期。巴士頁最近搜尋是另一組 SQLite 記錄，可在巴士頁清除。 [首頁全域搜尋](../src/app/search.tsx) · [巴士頁](../src/app/bus.tsx) |
| 附近文字地點查詢，用於取得候選地點及座標 | `q` 及連線資訊到 LandsD。裝置 GPS 無附送，選中結果及目前位置可留在 App 記憶體。 | 本機快取如上。服務端日誌、保留及刪除仍未知。 |
| 前台精確或約略位置、水平精度，用於附近距離、站點建議及地圖定位 | iOS Core Location 回傳給 App，在裝置計算。原生地圖收到自訂標記及視口，Apple SDK／平台傳輸另看下一列。 | App 未存 GPS 歷史或提供背景定位，畫面／短期記憶體可持有。可撤回權限，或用地標及手動地圖瀏覽。 [定位](../src/nearby-bus-location.ts) |
| MapKit 底圖、視口、位置標記及外部步行導航 | App 內由 Apple MapKit 提供。外部地圖收到用戶指定的目的地及步行模式，裝置 GPS 無附於導航 URL。外部服務可依自身政策及權限取得資料。 | Apple 平台處理和第三方地圖服務各按其政策；候選包的接收方、SDK 傳輸與留存仍待證據。 [App 地圖](../src/components/nearby-facilities-map.tsx) · [導航參數](../src/facility-navigation.ts) · [Apple 定位](https://www.apple.com/legal/privacy/data/zh-hk/location-services/)及[地圖](https://www.apple.com/legal/privacy/data/zh-hk/apple-maps/) |
| 巴士目錄、站序及 ETA，天氣、預報及警告 | 巴士向九巴／龍運、城巴、嶼巴公開服務送所需路線、方向、服務類型及站點 ID 等。路線及站點可能來自收藏或附近建議。天文台查詢送資料類型和語言。兩類服務的接收端也可接收連線資料。 | 公開目錄及天氣會在本機快取，ETA 可短期重用。未核實各端點日誌保留與接收方可讀期限。 [巴士 ETA](../src/bus-eta.ts) · [巴士站序](../src/bus-stop-data.ts) · [天氣](../src/weather-data.ts) |
| SQLite 收藏、置頂、語言、巴士最近搜尋與公開資料快取 | App 容器；系統設定允許時可隨 iOS 備份。App 未有帳戶同步收藏庫，業務請求可能使用由收藏導出的個別公開站點／路線編號。 | 可移除收藏、取消置頂及清除巴士搜尋。選「刪除 App」會移除 App 本機資料；「卸載 App」保留文件及資料。已存在的 iOS 備份或第三方服務紀錄需另行管理。 [SQLite schema](../src/database.ts) · [Apple 儲存空間說明](https://support.apple.com/en-gb/108429) |
| 支援或私隱來信的地址、正文、附件，用於回覆、排查及處理請求 | 用戶主動從郵件工具發送。發件服務、收件郵件服務和營運者處理。`mailto:` 只開啟郵件工具。 | 確認實際營運做法、可讀取的人、郵箱及備份／匯出副本、垃圾桶及刪除規則。未核實郵件服務對來信及其副本的保存期限。 |
| 公開網站連線資料，用於網站傳送及服務安全 | 擬採用 Vercel。現有站點是靜態 HTML／CSS，無表單、分析指令碼或專案內日誌轉送。Vercel 公開說明表示可能處理 IP 等網站流量資料。 | 未有正式專案配置可核對日誌瀏覽權、Drains、額外分析及其保存或刪除條件。公開的 Runtime Logs 可見期只代表產品的該介面／級別。 [Vercel Privacy Notice](https://vercel.com/legal/privacy-notice) · [Runtime Logs](https://vercel.com/docs/logs/runtime) · [Log Drains](https://vercel.com/docs/drains/reference/logs) |

## 可供批准的雙語政策補充

App 和網站的審閱版已共用 LandsD、SQLite、Apple 平台服務及主動發送郵件的已核實說明。下列段落可在營運者確認採用 Vercel、認可第三方保留資料的公開邊界，以及承諾執行結案刪除做法後一併批准。若實際配置或營運流程有異，按事實修訂兩語。尤其需確認有誰能讀取主機日誌與郵件、會否匯出或轉寄、何時結案及如何刪除可控制的副本。現階段不把此承諾當成已採用政策。

**網站及支援 · zh-HK**

> 本網站由 Vercel 託管。Vercel 可能為傳送網站及維護服務安全而處理 IP 位址等連線資料，詳見 Vercel 的私隱聲明。若你發送支援或私隱查詢電郵，營運者使用來信資料及你自願提供的附件回覆、排查問題或處理你的請求；電郵會經發件及收件郵件服務處理。

**Website and support · English**

> This website is hosted by Vercel. Vercel may process connection data, such as IP addresses, to deliver the website and maintain service security. See Vercel’s Privacy Notice. If you email us for support or about privacy, the operator uses your message and any attachments you choose to provide to respond, investigate the issue or handle your request. Your message is processed by the sending and receiving email services.

**保留及刪除 · zh-HK**

> 營運者會在處理來信及作必要跟進期間保留電郵及附件，之後刪除其控制範圍內的副本，法律要求繼續保留的情況除外。你可以透過私隱聯絡電郵要求查詢或刪除營運者持有的資料。地政總署 API 的公開文件未說明查詢日誌及其保留期限。各第三方按其適用政策和程序管理其持有的紀錄及備份。刪除 App 不會同時刪除第三方持有的資料或已建立的 iOS 備份。

**Retention and deletion · English**

> The operator keeps support and privacy emails and attachments while handling the request and any necessary follow-up, then deletes copies under the operator’s control unless the law requires further retention. You can use the privacy email address to ask about or request deletion of data held by the operator. The Lands Department’s published API documentation does not specify query logging or a retention period. Third-party providers manage their own records and backups under their applicable policies and procedures. Deleting the app does not delete data held by third parties or existing iOS backups.

在定稿時可隨已核實的主機段落加入 [Vercel 私隱聲明](https://vercel.com/legal/privacy-notice)。郵件服務的適用政策及對外承諾須以實際服務或營運者可核對的紀錄作準，未確認的數字不填。App／網站共用 `publication.siteAndSupportPrivacy` 和 `publication.retentionDisclosure`，分別併入線上服務與保存刪除段落。

## 正式政策日期

`reviewedOn` 是審閱標記，App 和本機網站顯示為「審閱日期／Review date」。正式生效及更新日期只讀共用 `content/compliance.json` 的 `publication.effectiveOn` 和 `publication.updatedOn`，目前兩個均為 `null`。建議首次公開版用營運者批准的實際生效日作兩個日期，以後按實際政策修訂調整更新日期。網站輸出和 App 候選應使用同一版政策及日期。請在實際日期和兩語內容獲批後才一併填入，延期時核對兩端日期後重新輸出。構建時間不參與計算，本輪未指定生效日。

## 龍脊照片 · 保留與移除

原作為 Bjørn Christian Tørrissen（Uspn）的 *Dragons-Back-Northwards*，Commons 記錄 5,184 × 3,460 JPEG，CC BY-SA 4.0。C0 已驗證本機圖像與原作的像素關聯。這輪重新量度 `assets/home/dragons-back.jpg` 為 720 × 480、SHA-256 `8a03f2f99a28c0353f8e821692f2499b7215a56c83460e9ad23bc57f5d209a8a`，與已比對版本相同。實體 JPEG 經縮小及重壓縮，符合純技術轉換的現有證據。首頁卡片的填滿裁切和漸層是畫面處理。若以合成畫面作商店截圖等另行分發，須另外判定是否構成改作。現有龍脊詳情及 App 署名頁離線可讀作者、作品、修改和許可說明，原作與許可可使用連結查閱。 [原作及授權](https://commons.wikimedia.org/wiki/File:Dragons-Back-Northwards.jpg) · [App 署名](../src/compliance-credits.ts) · [卡片實作](../src/components/home-ui.tsx)

### A · 保留照片 · BLOCKED

1. 核對每個載體及實際分發版本，包含包內 JPEG、含照片的商店截圖，以及有否獨立分發的版本。保留作者、來源、授權連結、實際改動和授權方隨作提供的適用通知。若另行分發的版本構成改作，按相同或相容授權發行該素材。這項義務所及範圍依實際分發作品判定。 [CC BY-SA 4.0 §2(a)(4) 及 §3](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en)
2. 就實際 Apple 分發模式取得足以確認照片仍可按授權使用、複製和再散布的證據，涵蓋適用 EULA、存取照片的方法，以及包裝或 DRM 有沒有對素材施加額外條款或有效技術措施。Apple 標準 EULA 對 App 及可取用內容有通用限制，也有涉及開源元件授權的例外；未取得該例外適用於本照片及實際包裝的證據。可評估明確保留照片權利的條款及自由下載實際分發版本。平行下載本身不足以放行 App Store 副本。 [Apple Standard EULA](https://www.apple.com/legal/internet-services/itunes/dev/stdeula/) · [CC BY-SA 4.0 §2(a)(5)(C)、§3(b)](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en) · [Creative Commons 技術措施指引](https://creativecommons.org/faq/index.html#can-i-use-effective-technological-measures-such-as-drm-when-i-share-cc-licensed-material)
3. 若無法證明此分發模式符合 CC 條件，保留照片的另一條可放行路徑是取得權利人書面許可，明確涵蓋實際 App Store 包裝、適用條款／技術措施、截圖及所需改動，再按其條件核對候選與記錄。沒有該證據前不填素材批准欄。

### B · 移除照片 · 待開發者批准

保留首頁龍脊卡片的尺寸、內容、穩定地點 ID、跳轉和導航規則，僅以既有色票的純色背景接替照片。核准後移除首頁的素材引用，移除或更新專屬照片署名入口，核對 Metro 輸出及發行素材，重製含原相的商店截圖後才確認無該圖分發。正式龍脊文字及其他素材沿用現有內容。本輪照片仍隨現有 App 程式引用。

## 三段式發佈檢查及剩餘人工決策

| 階段 | 決策及放行條件 |
| --- | --- |
| 部署前 · **NO-GO** | 開發者核對 LandsD 暫無公開日誌期限是否以如實披露接受，核實網站及郵件的實際操作、批准雙語保存刪除段落和日期，擇定 A 或 B 並取得書面／實作證據。批准後將共享政策及日期和 `website/release.json` 的獨立 `approvalReference`、`assetRightsApprovalReference` 一併寫入。`--check-release` 和 `--release` 仍檢查兩種審批，可在首部署沒有正式 URL 時執行。 |
| 部署後 · **待正式 HTTPS URL** | 將已分配的公開 origin 寫入 `website/release.json`。`--check-live` 核對四個正式 HTTPS 路徑直接回 HTTP 200、HTML 及同版本核准內容。網站四條路徑及 `mailto:` 由測試核對，實際公開網址及收信仍未驗證。 |
| App Store 前 · **BLOCKED** | 本機 `react-native-maps@1.27.2` manifest 將 `PreciseLocation` 列於收集項，用途 App Functionality，`Linked=false`、`Tracking=false`。用正式 `Podfile.lock`、Archive／IPA 內 App 和各資源 bundle 的 `PrivacyInfo.xcprivacy` 與 Xcode Privacy Report 核對它是否隨包、provider 和實際用途。以有／無定位、MapKit 畫面的候選檢查輔證傳輸範圍，再用官方或供應方證據核對接收者、存取權和保留安排。區分 Apple 平台自行處理及營運者／第三方可讀取或使用的資料。完成前維持待確認，不批准整個 App「Data Not Collected」。 [Apple App Privacy](https://developer.apple.com/app-store/app-privacy-details/) |

## 修改、驗證及 Git

| 修改 | 用途 |
| --- | --- |
| `content/compliance.json`、`content/compliance-policy.js` | 同源的雙語審閱政策、正式日期與批准後補充段落。 |
| `src/compliance-content.ts`、`src/components/compliance-document.tsx`、`src/app/settings/privacy.tsx`、`src/app/settings/support.tsx` | 既有離線政策及支援頁讀同一份內容，審閱與正式日期分開。 |
| `website/build.cjs`、`website/release.json`、`website/README.md` | 正式輸出與 App 共用政策；部署及審批紀錄沿用網站設定。 |
| `scripts/test-compliance.cjs` | 加入 App／網站日期、同源文案及 Gate 正反向驗證。 |
| `docs/REL-01C1B2-PRIVACY-AND-LICENSE-RELEASE-GATE.md` | 本輪證據、供批准的政策段落和素材決策。 |

| 檢查 | 結果 |
| --- | --- |
| `npm run typecheck`、`node scripts/test-compliance.cjs` | 通過。兩語 App 及靜態頁內容、政策日期、四條正式路徑、站內連結、`mailto:`、圖片來源及相片雜湊、審批及部署後校驗路徑均有測試。正式路徑成功分支使用隔離設定及模擬的 HTTP 回應。 |
| `node website/build.cjs`；同命令加 `--check-release`、`--release`、`--check-live` | 審閱輸出成功。實際正式前置命令均如期退出 `1`，兩個日期、四項雙語補充及兩筆審批缺失。沒有產出 release 檔案；`--check-live` 因未填正式 origin 如期退出 `1`。 |
| `node scripts/test-global-search.cjs`、`node scripts/test-global-search-ui.cjs`、`node scripts/test-global-search-navigation.cjs`、`node scripts/test-facility-favorites.cjs`、`node scripts/test-explore-trailhead-navigation.cjs` | 通過。涵蓋本機搜尋與離線讀取、結果導覽、設施／SQLite／巴士收藏及探索與外部導航回歸。 |
| `CI=1 EXPO_OFFLINE=1 ./node_modules/.bin/expo export --platform ios --output-dir <臨時目錄>` | 通過。Metro 產出 iOS JavaScript bundle 與資產，仍列出原本的龍脊照片。 |
| `git diff --check` | 通過。 |

開工及完成均在 `develop`，HEAD `fa1b4f2`。工作區有 10 個修改檔案及 1 個新增報告。未部署、建立 EAS Production Build、啟動模擬器或真機、修改 App Privacy、提交、推送或合併。
