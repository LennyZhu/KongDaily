# REL-01C1B4 · Production 網站 Gate A

**結論：技術準備完成，可交開發者審批。真實 Gate A 仍為 NO-GO。** 共用私隱政策為 v1.0。網站兩語署名頁各涵蓋八張照片，其中七張提供原樣的 App 優化 JPEG。西九文化區藝術公園只列署名、作品資訊、許可及原作連結。正式生效及更新日期與人工審批紀錄仍為空。

2026-11-20（香港時間），本機 `develop`、追蹤分支和 GitHub 唯讀分支查詢同為 `57b97a69178358f96b5d3043e61ccca08de217f0`，分歧 0／0。開工時有 B3 的 9 個修改檔及 4 個新增檔，均保留。已閱讀既有報告、Gate、照片來源記錄與 B3 當時的實際靜態輸出。開工時本機審閱目錄仍有八張 JPEG，重建後移除了網站過期的西九 JPEG。 [B3 實施記錄](REL-01C1B3-FINAL-POLICY-AND-PHOTO-COMPLIANCE.md) · [App 八圖來源及處理](UI-05C4-EXPLORE-REAL-PHOTO-IMPLEMENTATION.md) · [山頂花園授權證據](UI-05C4A-PEAK-GARDEN-PHOTO-CLOSURE.md)

## 八張照片權利核對

「可」表示作品條款支持表中的特定用途，仍須落實同一行的條件。App 隨包欄評估照片著作權授權。Apple 的成品套件、EULA 及商店宣傳另列在 Gate C。網站欄的結論用於本次首發範圍，發佈批准仍由開發者記錄。

| 地點 ID | 平台、攝影者與授權 | App 內使用及隨包 | 網站嵌圖 | 網站獨立 JPEG | 署名、改動及成品注意點 |
| --- | --- | --- | --- | --- | --- |
| `dragons-back-to-tei-wan-tai-tam-gap` | DVIDS／Commons，Christopher A. Veloicaza／U.S. Navy，官方作品公有領域。 [原作](https://www.dvidshub.net/image/1990058/uss-essex-visit-hong-kong) · [Commons 檔案](https://commons.wikimedia.org/wiki/File:USS_Essex_visit_to_Hong_Kong_150610-N-FV739-266.jpg) · [DVIDS 使用條件](https://www.dvidshub.net/about/copyright) | 可，保留來源與 U.S. DoW 非背書聲明 | 可，同樣顯示聲明 | 可，提供帶署名說明的既有優化版 | 顯示作者、原作、聲明及裁切、縮放和再編碼。既有裁切排除前景遠足者及可辨軍事標記，商店宣傳仍核對標記、肖像和背書。 |
| `peak-circle-walk` | Commons，Ngchikit，全球公有領域奉獻，不能放棄時有後備使用授權。 [原作及作者聲明](https://commons.wikimedia.org/wiki/File:Lugard_road.jpg) · [授權範本](https://commons.wikimedia.org/wiki/Template:PD-user) | 可 | 可 | 可 | 保留作者和來源。載入 Commons 1280 × 960 衍生檔時維持構圖及下載尺寸，再編碼及移除 EXIF。未發現此作品特有的 Apple 版權條件。 |
| `west-kowloon-art-park` | Unsplash，Raymond Yeung，免費 Unsplash License。 [原作](https://unsplash.com/photos/a-group-of-people-standing-on-top-of-a-lush-green-field-RIY7fmUzar4) · [授權](https://unsplash.com/license) · [權利申訴指引](https://help.unsplash.com/en/articles/2574041-reporting-violations-of-the-unsplash-license) | 可用於編輯式地點內容，照片隨現有 App 功能提供 | 一般編輯式展示有授權依據。本次網站採純署名，無嵌圖 | 本次排除，無獨立下載 | 保留作者、原作、條款及既有縮放和再編碼說明。獨立檔案再散布與 App 內編輯使用分開核對。商店宣傳另查人物、標記及背書。 |
| `avenue-of-stars` | Commons，EditQ，作者 CC0 1.0。 [原作](https://commons.wikimedia.org/wiki/File:2023_in_Avenue_of_Stars,_Hong_Kong_1.jpg) · [CC0 條文](https://creativecommons.org/publicdomain/zero/1.0/legalcode.en) | 可 | 可 | 可 | 自願保留來源、作者、下載尺寸 1280 × 960、再編碼及 EXIF 說明。CC0 處理著作權範圍，成品仍按實際宣傳用途核對可能涉及的其他權利。 |
| `hong-kong-park` | Flickr／Commons，lumoplank，Commons 保留 Flickr CC0 1.0 審核記錄。 [Commons 檔案及審核](https://commons.wikimedia.org/wiki/File:Hong_Kong,_Part_8_-_HongKong8568.jpg) · [原發佈](https://www.flickr.com/photos/199350666@N08/55305026400) · [CC0 條文](https://creativecommons.org/publicdomain/zero/1.0/legalcode.en) | 可 | 可 | 可 | 自願保留作者、原發佈及 Commons 記錄，說明 1280 × 960 構圖、再編碼和 EXIF。保留實際成品及宣傳用法核驗。 |
| `kowloon-walled-city-park` | Commons，Wilfredor，作者 CC0 1.0。 [原作](https://commons.wikimedia.org/wiki/File:Hong_Kong_street_01.jpg) · [CC0 條文](https://creativecommons.org/publicdomain/zero/1.0/legalcode.en) | 可 | 可 | 可 | 自願保留作者、來源及 1280 × 850 構圖、再編碼和 EXIF 說明。保留實際成品及宣傳用法核驗。 |
| `tai-po-waterfront-park` | Commons，Chong Fat，全球公有領域奉獻及後備使用授權。 [原作及作者聲明](https://commons.wikimedia.org/wiki/File:TaiPoWaterfrontPark_Promenade_1.jpg) · [授權範本](https://commons.wikimedia.org/wiki/Template:PD-user) | 可 | 可 | 可 | 保留作者和來源。維持下載檔 1280 × 960 構圖及尺寸，再編碼及移除 EXIF。未發現此作品特有的 Apple 版權條件。 |
| `victoria-peak-garden` | Commons，Wpcpey，作品專屬 CC BY 4.0。 [原作](https://commons.wikimedia.org/wiki/File:Victoria_Peak_Garden_Lawn_Plants_201607.jpg) · [首個版本](https://commons.wikimedia.org/wiki/Special:PermanentLink/202529515) · [CC BY 4.0 條文](https://creativecommons.org/licenses/by/4.0/legalcode.en) | 著作權許可容許再分發，Apple 成品條件仍待確認 | 可，近圖署名連同來源、條文及修改說明 | 可，無附加限制的 App 優化 JPEG，附許可及版本紀錄 | 保留 Wpcpey 指定署名格式，記錄縮至 1480 × 985、再壓縮、移除 EXIF 和 App 顯示裁切。檔案首版和現行 Licensing 欄指定 4.0，同頁通用署名模板的 3.0 字樣已在 C4A 分開核實。CC BY 4.0 無 ShareAlike 要求，禁下游限制對 App 簽名包、EULA 和技術保護仍須核對。 |

Unsplash 的授權正文有一般分發許可，也限制複製同類或競爭服務。其官方申訴指引把第三方網站提供圖片獨立下載列為權利申訴情境。首發採用來源連結可避免此種分發，無須把這種取捨解讀成每種網站展示都受禁。日後若需重新開放該獨立下載，先取得能覆蓋此用途的明確權利書面依據，再更新網站決定。沒有 Pexels 照片在這八張中。首頁 Kevin Huynh 的 Pexels 維港照及 Jeanne Rose Gomez 的 Unsplash 西九照與本表是不同資產，均未進入站點輸出。Pexels 容許在網站及 App 使用，另限制擅自把原檔作素材或壁紙服務再分發。舊 CC BY-SA 龍脊照也未進入網站。 [Unsplash 條款](https://unsplash.com/terms) · [Unsplash 編輯使用說明](https://help.unsplash.com/en/articles/2612315-can-i-use-unsplash-images-for-personal-or-commercial-projects) · [Pexels License](https://www.pexels.com/license/) · [首頁照片記錄](../assets/home/credits.md)

## 網站資源修正與輸出驗證

- `website/explore-photo-publication.json` 以正式地點 ID、核對的許可、準確的 App SHA-256 及網站用途分開記錄八張決定。許可、ID 或雜湊變更需重做相應審核。App 的 JPEG、署名 metadata、EXIF 和映射維持開工時原樣。
- `/credits/explore/` 及 `/en/credits/explore/` 各保留八筆署名。七張預覽與下載共用同一份 App 優化 JPEG，位於 `/credits/explore/photos/`，合共 3,359,361 bytes。原西九路徑 `/credits/explore/photos/west-kowloon-art-park.jpg` 在本機回應 404。兩語 HTML 無西九的圖片嵌入、直連圖片或下載按鈕。
- 建置只移除與舊版 App JPEG SHA-256 完全相同的已退役網站副本。發現無關文件、無法識別的副本或 symlink 時中止。正式輸出核對逐一比較 **8 個 HTML、1 個 CSS、7 個 JPEG** 的路徑和位元組。不接受額外的文件、目錄或連結。套件內不會包含 Git、App 資產目錄、政策來源 JSON、操作文檔、環境文件或測試資料。 [網站建置及核對](../website/build.cjs) · [逐圖決定](../website/explore-photo-publication.json)

## 共用政策 v1.0 及 Gate A

App 離線私隱政策、雙語網站政策和支援頁沿用既有共用文案。兩語保留相同的個人營運者、品牌、電郵及 `mailto:`。一般支援電郵和附件於個案解決後最多保存 12 個月，適用法律要求更長時間的除外。用戶可經私隱電郵請求刪除。此承諾涵蓋營運者控制的郵件副本。服務商獨立管理的日誌、備份和其留存沒有新增期限保證。作業文件提供手動流程，目前沒有郵箱清理執行記錄的證據。 [共用政策與 Support](../content/compliance.json) · [保留作業](operations/SUPPORT-EMAIL-RETENTION.md)

首頁全域搜尋在裝置比對，附近線上地點搜尋的輸入文字可傳到 LandsD。該請求沒有裝置 GPS 參數。公開 API 文件未交代是否記錄查詢或保存多久。iOS 定位及 MapKit 的披露按既有資料流保留，候選包內精確位置聲明和 App Privacy 留到 Gate C。 [LandsD API 文件](https://portal.csdi.gov.hk/csdi-webpage/apidoc/LocationSearchAPI) · [資料流及證據邊界](REL-01C1B2-PRIVACY-AND-LICENSE-RELEASE-GATE.md)

| Gate A 項目 | 結果 |
| --- | --- |
| 營運者與品牌 | **PASS** · KongDaily by Lenny Studio，個人開發者 Lenny。 |
| 支援及私隱電郵 | **PASS** · 已核對四頁和 App 的 `mailto:lenny996@163.com`。真實收件另以人工驗收。 |
| 兩語政策版本與一致性 | **PASS，待正式發佈批准** · App 和網站共用 v1.0，LandsD 未知邊界如實披露。 |
| 電郵保留及刪除 | **PASS** · 兩語與已批准的 12 個月政策一致，清理 SOP 供營運者使用。 |
| 初次日期 | **待人工核准** · 候選是香港日期 **2026-11-20**。只在開發者批准且網站確實在該香港日期內首次公開時填入同一 `effectiveOn` 和 `updatedOn`。若錯過當日，重新批准實際日期。建置時間不會寫入正式政策。 |
| 八張網站分發 | **技術及證據準備完成，待人工批准** · 七個精確版本可供審批，西九原作連結方案已移除其獨立再分發風險。網站批准不涵蓋 Gate C。 |
| 無已部署 URL | **PASS** · 首次部署前允許 `origin`、`firstPublicDeploymentAt` 留空。 |
| 無開發用佔位或敏感檔案 | **PASS** · 隔離的正式輸出無草稿標籤、開發佔位、審批參照文字或額外資源。真實配置仍拒絕出正式包。 |

Gate A 的真實失敗項目是兩個正式日期，以及 `approvalReference`（雙語政策及實際營運設定）和 `assetRightsApprovalReference`（七張 JPEG 與西九純來源方案）。可交開發者核准這些輸入。上線前另需建立及核對正確的 Vercel 專案、發布保護和公開範圍。兩張不同的西九照片都沒有網站下載。Pexels 首頁照片不屬本次網站資源。現時 **不得進入 Production 發佈**。

## 首次 Vercel 發布流程

本機儲存庫根及 `website/` 均無 `.vercel` 專案連結。Vercel 唯讀連接器以 KongDaily 名稱及精確 GitHub 儲存庫查詢，當前可見預設範圍與唯一列出的團隊範圍均返回零項。本機沒有已安裝的 Vercel CLI。其他不可見帳戶的狀態未核實。批准後在確認的帳戶獨立建立 `kongdaily`（建議名稱，須以實際可用為準），以手動 CLI 發佈。首次發佈保持 Git Integration 未連接，`vercel.json` 另外把所有分支的自動 Git 部署關閉。若其他專案早已連接舊提交，仍需在 Vercel 核對目標和 Git Integration。 [Vercel Git 設定](https://vercel.com/docs/project-configuration/git-configuration)

1. 確認首次公開日期、雙語政策及照片審批已記入共用配置。由開發者處理正式修訂。用乾淨的核准 checkout，Root Directory 選儲存庫根、Other preset、Node 22、安裝命令 `true`、建置命令 `node website/build.cjs --release`、輸出 `website/dist/release`、保留路徑尾斜線。確認目標 scope、project ID 與儲存庫不同於其它 App，網站無需環境機密、Analytics 或 Speed Insights。
2. 用已核對版本的已登入 CLI 先跑本機建置和輸出核對。 `KONGDAILY_VERCEL_SCOPE` 是經批准的團隊或個人 scope。以 `vercel project list --query kongdaily --scope "$KONGDAILY_VERCEL_SCOPE"` 核對名稱。確定該 scope 未有 KongDaily 專案、名稱可用且已獲批准後，以 `vercel project create kongdaily --scope "$KONGDAILY_VERCEL_SCOPE"` 建立獨立專案。若最終名稱有變，`--project` 使用實際專案名稱。連結後再核對 `.vercel/project.json` 的專案與組織，拒絕未批准的 Git 連接提示。 `--prebuilt` 上傳 Vercel Build Output，先確認 `.vercel/output` 只含靜態輸出和路由配置，沒有 functions。 [Vercel Project](https://vercel.com/docs/cli/project) · [Vercel Build](https://vercel.com/docs/cli/build) · [Vercel Link](https://vercel.com/docs/cli/link) · [Vercel Deploy](https://vercel.com/docs/cli/deploy)

```sh
node website/build.cjs --check-release
node website/build.cjs --release
node website/build.cjs --check-output website/dist/release

vercel link --project kongdaily --scope "$KONGDAILY_VERCEL_SCOPE"
vercel pull --environment=production --scope "$KONGDAILY_VERCEL_SCOPE"
vercel build --prod --scope "$KONGDAILY_VERCEL_SCOPE"
node website/build.cjs --check-output .vercel/output/static
```

3. 建好仍不指派正式域名。已確認 Deployment Protection 保護生成地址後才執行 staging 命令。 `--skip-domain` 延後自動 alias，本身不提供登入保護。以登出瀏覽器確認生成 URL 在正式公開前受保護，再用授權帳戶驗收 staging。以命令實際返回的部署 ID 或 URL 填入 `KONGDAILY_STAGED_DEPLOYMENT`，核對範圍及狀態。 [部署保護](https://vercel.com/docs/deployment-protection) · [Production staging 和 promotion](https://vercel.com/docs/deployments/promoting-a-deployment)

```sh
vercel deploy --prebuilt --prod --skip-domain --scope "$KONGDAILY_VERCEL_SCOPE"
vercel inspect "$KONGDAILY_STAGED_DEPLOYMENT" --scope "$KONGDAILY_VERCEL_SCOPE"
```

4. 正式公開當天，先比較實際香港日期（`TZ=Asia/Hong_Kong date +%F`）與已批准 `effectiveOn`。如不同，停止、重新核准日期及建置。日期相符並且最終公開獲批准後，才用下列命令推廣同一 staging 版本。記錄正式生效的公開香港時間及真實 HTTPS origin。正式 alias 必須能以登出瀏覽器開啟，受保護的 staging 生成網址不作正式網址。

```sh
vercel promote "$KONGDAILY_STAGED_DEPLOYMENT" --scope "$KONGDAILY_VERCEL_SCOPE"
```

5. 如未推廣的版本失敗，停止 promotion，保留原 serving 狀態。首發公開後驗收失敗而無先前合格 deployment 時，在獲授權的互動終端以 `vercel project pause kongdaily --scope "$KONGDAILY_VERCEL_SCOPE"` 暫停該獨立專案，並確認正式 alias 與生成網址均不再暴露錯誤版本。有上一個已核准公開版本時，才以 `vercel rollback <已驗證的部署 ID> --scope "$KONGDAILY_VERCEL_SCOPE"` 恢復，同時重跑 Gate B。只處理 KongDaily 的專案，保留實際首次公開時間紀錄。 [Vercel 暫停專案](https://vercel.com/docs/cli/project#pause) · [Vercel Rollback](https://vercel.com/docs/cli/rollback)

## Gate B 部署後驗收

- 在 `website/release.json` 記錄實際 HTTPS origin 及首次公開時間 `firstPublicDeploymentAt`（ISO 8601 含時區）。用發布修訂與所錄的網址執行 `node website/build.cjs --check-live`。若首次公開的香港日期和共用有效日期不同，驗證失敗並停止後續發布流程。
- 確認 `/privacy/`、`/en/privacy/`、`/support/`、`/en/support/`、兩語首頁及兩條照片署名路徑均為公開 HTTPS 200。核對日期、語言互換、返回連結、電郵連結、站內資源、同站 308 及真 404。用登出瀏覽器驗收，另核對實際郵箱收件。
- 七張 JPEG 逐一驗證 200、JPEG MIME、App SHA-256 及可下載。西九已退役 JPEG 路徑須回 404，兩語頁只連 Unsplash 作品。抽查內部 docs、測試、`.env` 和 App 素材路徑 404。若發現多餘公開文件、登入限制或錯誤日期，停止發布並按上列流程處理。

## Gate C App Store 風險

**仍未放行。** 需正式 iOS Archive 的 Privacy Report、`react-native-maps` 精確位置聲明和接收者／保留實踐核對、App Privacy 填寫及核准、核對正式公開的私隱與支援網址，以及八張已隨包照片和宣傳素材的成品驗收。特別驗證山頂花園的 CC BY 4.0 權利是否受到適用 EULA 或技術保護限制。公開優化 JPEG 提供獨立取得方式。若成品仍無法確認兼容，需進一步核對 EULA、技術措施，或取得權利人可適用於成品的書面許可。其它照片仍需避免暗示攝影者、機構或被攝者背書。 [CC BY 4.0 §2、§3](https://creativecommons.org/licenses/by/4.0/legalcode.en) · [Apple 標準 EULA](https://www.apple.com/legal/internet-services/itunes/dev/stdeula/) · [Apple App Privacy](https://developer.apple.com/app-store/app-privacy-details/)

## 本輪檔案與驗證

| 檢查 | 結果 |
| --- | --- |
| Node 22.13.0 下 `npm run typecheck`、`node scripts/test-compliance.cjs` | PASS。i18n、雙語 App／網站一致性、十二個月保留與法律例外、四條 Privacy／Support、八筆署名、七份相同 JPEG、首次兩日期相同、香港跨日、Gate 正反向及靜態輸出核對。 |
| `node website/build.cjs` 與本機 HTTP | PASS。既有審閱輸出重建為 16 個文件。八個頁面 200，七個 JPEG 200 且 SHA-256 相符。西九退役下載、首頁原圖、署名 JSON、文件、測試、`.env` 和 Git 路徑 404。測試亦涵蓋拒絕陌生副本及 symlink。 |
| `node website/build.cjs --check-release`、`--release`、`--check-live` | 真實配置按預期拒絕缺正式日期、人工審批及真實 HTTPS origin。以隔離批准資料驗證輸出及 Gate B 通過，實際 Vercel build／HTTPS 待核准後驗收。 |
| `node scripts/test-explore-photos.cjs`、`test-explore-places.cjs`、`test-explore-trailhead-navigation.cjs` | PASS。App 八張照片通過驗證，分類、正式資料和雙語導航回歸通過。 |
| `node scripts/test-global-search.cjs`、`test-global-search-ui.cjs`、`test-global-search-navigation.cjs` | PASS。搜尋資料、UI、返回與正式身份。 |
| `git diff --check`、資產及政策檔開工雜湊 | PASS。B4 未修改 App 相關文件，按本輪條件沿用 B3 的 Metro／Hermes 結果。 |

本輪修改 `website/explore-credits.cjs`、`website/build.cjs`、`website/README.md`、`vercel.json`、`scripts/test-compliance.cjs`，新增 `website/explore-photo-publication.json` 和本文件。工作區相對 `HEAD` 有 9 個修改檔和 6 個新增檔，含 B3 原有內容。 `develop` HEAD 與開工核實的 `origin/develop` 仍一致。未建立、連結或部署任何 Vercel 專案，未提交、推送、合併或操作 iOS／App Store Connect。
