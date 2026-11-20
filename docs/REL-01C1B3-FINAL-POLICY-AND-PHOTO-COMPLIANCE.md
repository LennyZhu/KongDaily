# REL-01C1B3 · 私隱政策、照片授權資源與網站部署準備

2026-11-20（香港時間）。開工時 `develop` 工作區乾淨，本機 HEAD、本機 `origin/develop` 及唯讀查詢取得的 GitHub `develop` 均為 `57b97a69178358f96b5d3043e61ccca08de217f0`，分歧 0／0。該提交包含 UI-05C4／C4A，REL-01C1B2 在其前一個提交。開發者已確認照片通過 iPhone 人工驗收，本輪驗證未使用 iPhone 或模擬器。 [私隱審計](REL-01C0-PRIVACY-AND-ATTRIBUTION-AUDIT.md) · [B2 發佈基線](REL-01C1B2-PRIVACY-AND-LICENSE-RELEASE-GATE.md) · [八張相片來源](UI-05C4-EXPLORE-REAL-PHOTO-IMPLEMENTATION.md) · [山頂花園原圖核驗](UI-05C4A-PEAK-GARDEN-PHOTO-CLOSURE.md)

## 共用雙語政策與支援作業

**PASS** · App 內離線政策及靜態網站共用政策版本 `1.0`，支援和私隱聯絡連結讀取同一配置。兩語均披露營運者可接收用戶主動提供的姓名、電郵地址、問題描述及附件，以處理來信及回覆。一般個案由解決日起最多保留 **12 個月**，適用法律要求更長時間者除外。用戶可使用私隱電郵提出刪除要求。刪除作業涵蓋營運者控制的副本，電郵服務商獨立管理的備份、日誌及保留安排不在營運者承諾範圍。 [共用文案](../content/compliance.json) · [手動結案、每月清理與法律保留 SOP](operations/SUPPORT-EMAIL-RETENTION.md)

**PASS** · 保留全域搜尋在裝置配對、巴士和天氣獨立網絡請求、前台定位及 MapKit／Apple 服務的說明。附近線上搜尋會向 LandsD 傳送合資格文字，可能包括用戶輸入的地址。請求沒有裝置 GPS 欄位，服務可收到來源 IP 等連線資料。政策繼續如實披露公開 API 文件沒有說明查詢日誌或保留期限。本機段落區分 SQLite 收藏、置頂、巴士搜尋紀錄、畫面記憶體、iOS 備份，以及「刪除 App」與「卸載 App」。新增 Vercel 託管的連線資料說明及官方私隱連結。網站輸出未加入追蹤程式、帳戶或提交表格。 [LandsD API 文件](https://portal.csdi.gov.hk/csdi-webpage/apidoc/LocationSearchAPI) · [Vercel 私隱聲明](https://vercel.com/legal/privacy-notice) · [B2 資料流及待核實項目](REL-01C1B2-PRIVACY-AND-LICENSE-RELEASE-GATE.md)

**NEEDS HUMAN APPROVAL** · 核對 Vercel 實際託管選項、日誌存取與郵箱存取、轉寄、匯出設定，開始執行手動 SOP，並批准兩語政策對第三方資料的披露邊界。LandsD 實際記錄及留存未獲獨立確認。人工可批准按現有證據披露這個未知；不能把批准記錄當成服務方事實。

## 日期與首次部署

1. **NEEDS HUMAN APPROVAL** · 指定首次公開上線的香港日期。把已批准日期填入共用 `publication.effectiveOn` 和 `publication.updatedOn`，另在 `website/release.json` 記錄 `approvalReference` 及網站用途的 `assetRightsApprovalReference`。本輪的兩個正式日期均為 `null`。審閱日期獨立，建置時間不參與政策日期計算。往後保留原生效日，有實質政策修改才調整更新日。
2. **PASS** · 在乾淨的核准修訂上以 Node 22 執行 `node website/build.cjs --check-release` 和 `node website/build.cjs --release`。兩個命令都驗證雙語內容、日期、人工審批及全套素材。首次部署前 `origin` 與實際上線時間可留空。本機審閱輸出有標記及 `noindex`，應只在本機或受保護環境查閱。
3. **NEEDS HUMAN APPROVAL** · 批准後才建立或匯入 Vercel 專案，根目錄選儲存庫根目錄，Node.js 選 22。版本配置使用 Other、安裝命令 `true`、建置命令 `node website/build.cjs --release` 及輸出 `website/dist/release`。保留 HTTPS、目錄頁尾斜線及公開 Production 路徑。保護預覽環境，維持 Analytics 和 Speed Insights 關閉。使網站正式可見之前，比對香港日期與批准日期；如延期先停止並修正。 [Vercel 靜態配置](https://vercel.com/docs/project-configuration/vercel-json) · [部署防護](https://vercel.com/docs/deployment-protection)
4. **POST-DEPLOYMENT VERIFICATION** · 在 `website/release.json` 記錄實際公開 HTTPS origin 及首次公開的 ISO 8601 時間戳 `firstPublicDeploymentAt`，含時區，而非預覽建置完成時間。對相同內容修訂執行 `node website/build.cjs --check-live`。程式將實際時間轉為香港日期，若與 `effectiveOn` 不同即停止。在已公開時先暫停發布，核實實際公開事件並批准共用政策修正後再繼續。核對登入外的訪問、下載及電郵收件，再使用真實已驗證的網址接入現有 App 署名及商店欄位。 [本機及生產流程](../website/README.md) · [Vercel 網址類型](https://vercel.com/docs/deployments/generated-urls)

## 八張網站照片副本

**PASS** · 本機輸出新增 `/credits/explore/` 及 `/en/credits/explore/`。每張預覽相連的說明列作品、作者、來源、各自授權及實際處理。山頂花園署名緊接圖像，其原尺寸來源亦可另行開啟。網站建置從正式地點 ID 及 App 署名清單取得資料，以同一個 JPEG 同時提供預覽及下載。八個公開資源由建置產生，合計 3,631,704 bytes。原始 App 資產無改動，同一網址供兩語使用。網站未配置帳戶、DRM、下載限制或第三方腳本。部署後仍須核對平台的實際存取設定。 [App 圖片映射](../src/explore-place-images.ts) · [署名、處理及雜湊清單](../assets/explore/photos/attribution.json)

| 地點 | 網站 JPEG 路徑 | 攝影者及授權 | App／網站 SHA-256 | 來源 |
| --- | --- | --- | --- | --- |
| 龍脊 | `/credits/explore/photos/dragons-back.jpg` | Christopher A. Veloicaza / U.S. Navy · Public domain (U.S. Navy) | `5822dbb21799c40d8e0303ace426764823eb35f75e7c4aedf8fb2be254b09f90` | [原作](https://www.dvidshub.net/image/1990058/uss-essex-visit-hong-kong) |
| 山頂環迴步行徑 | `/credits/explore/photos/peak-circle-walk.jpg` | Ngchikit · Public domain (author dedication) | `507f5f412bcdb32ec2813dded3976481f79809225924b84b418921607ab19b4d` | [原作](https://commons.wikimedia.org/wiki/File:Lugard_road.jpg) |
| 西九文化區藝術公園 | `/credits/explore/photos/west-kowloon-art-park.jpg` | Raymond Yeung · Unsplash License | `1428e2ad4c6a97ade65e341bd761695259a538c6005f429084813ba13ed46577` | [原作](https://unsplash.com/photos/a-group-of-people-standing-on-top-of-a-lush-green-field-RIY7fmUzar4) |
| 星光大道 | `/credits/explore/photos/avenue-of-stars.jpg` | EditQ · CC0 1.0 | `0ed86502fca360f467d8d42ad9e0b75f19e1607ff687a9b8b9706889b0f3fa9c` | [原作](https://commons.wikimedia.org/wiki/File:2023_in_Avenue_of_Stars,_Hong_Kong_1.jpg) |
| 香港公園 | `/credits/explore/photos/hong-kong-park.jpg` | lumoplank · CC0 1.0 | `eb62e56c6c204a4de0f3eed1b26d6bb94e2fa75038f28ba61a560faf57c74add` | [原作](https://commons.wikimedia.org/wiki/File:Hong_Kong,_Part_8_-_HongKong8568.jpg) |
| 九龍寨城公園 | `/credits/explore/photos/kowloon-walled-city-park.jpg` | Wilfredor · CC0 1.0 | `a28f9ec8fda2db702b4eaefb7f7c692eae1e3d8d23883dab0c158a8e97f2a5d8` | [原作](https://commons.wikimedia.org/wiki/File:Hong_Kong_street_01.jpg) |
| 大埔海濱公園 | `/credits/explore/photos/tai-po-waterfront-park.jpg` | Chong Fat · Public domain (author dedication) | `f249c8e015e62ef511580c1d2d59b956f5bc3975c76cfc6f8263eaea9967081f` | [原作](https://commons.wikimedia.org/wiki/File:TaiPoWaterfrontPark_Promenade_1.jpg) |
| 山頂花園 | `/credits/explore/photos/victoria-peak-garden.jpg` | Wpcpey · CC BY 4.0 | `59f27e7e1e3d876e1a9c6876b1d0450c5bc1c9c32c74c435b341dbebf783f4cb` | [原作](https://commons.wikimedia.org/wiki/File:Victoria_Peak_Garden_Lawn_Plants_201607.jpg) |

### 網站使用與 App Store 分發

- **NEEDS HUMAN APPROVAL** · 龍脊沿用美國海軍新圖及 DVIDS 的非背書聲明，記錄取景裁切、縮放及重新編碼。山頂環迴步行徑和大埔海濱公園各有作者公有領域聲明及不能放棄權利時的使用授權。星光大道、香港公園和九龍寨城公園各以原作所列 CC0 1.0 發佈，仍提供來源及處理說明。上架宣傳時另核對實際人物、標記及背書風險。 [DVIDS 使用條件](https://www.dvidshub.net/about/copyright) · [作者公有領域聲明範本](https://commons.wikimedia.org/wiki/Template:PD-user) · [CC0 1.0 條文](https://creativecommons.org/publicdomain/zero/1.0/legalcode.en)
- **NEEDS HUMAN APPROVAL** · Raymond Yeung 的藝術公園照片沿用其 Unsplash License，作為 KongDaily 地點資料的透明署名及副本展示。Unsplash 許可分發和商用，對未經重大修改出售照片及彙集素材複製競爭服務有限制。網站僅提供隨 App 發佈的用途副本。 [Unsplash License](https://unsplash.com/license)
- **NEEDS HUMAN APPROVAL** · 山頂花園以作者於 2016 年發佈時在該檔案指定的 CC BY 4.0 為據。其通用署名模板另提 3.0，網站保留作者指定的近圖署名格式及處理說明。CC BY 4.0 授權本身無 ShareAlike 條件，仍須保留署名、許可、來源及變更說明，並避免施加限制授權權利的附加條款或有效技術措施。這八張不包含舊 CC BY-SA 龍脊圖。 [作者原始上載修訂](https://commons.wikimedia.org/wiki/Special:PermanentLink/202529515) · [作者署名模板修訂](https://commons.wikimedia.org/wiki/Special:PermanentLink/880186713) · [CC BY 4.0 條文](https://creativecommons.org/licenses/by/4.0/legalcode.en)
- **BLOCKED** · 可在網站獨立取得相同 JPEG，有利於使用者取得許可和實際分發版本。此安排未足以確認 App Store 分發相容。送審前需查看實際簽名候選包的附帶照片、技術措施、適用 EULA 及商店截圖；如有必要，核對自訂 EULA 能否保留照片原授權權利。仍有無法排除的限制時，先取得權利人另行書面許可，再放行相關分發。本輪僅準備網站副本，沒有核准商店使用。 [CC 技術措施說明](https://creativecommons.org/faq/index.html#can-i-use-effective-technological-measures-such-as-drm-when-i-share-cc-licensed-material) · [Apple 標準 EULA](https://www.apple.com/legal/internet-services/itunes/dev/stdeula/) · [Apple 自訂 EULA](https://developer.apple.com/help/app-store-connect/manage-app-information/provide-a-custom-license-agreement/)

## Gate 狀態

| 檢查 | 狀態 | 放行依據 |
| --- | --- | --- |
| A · 本機建置、保留政策、雙語及八圖 | PASS | 本機靜態輸出、App 共用政策、八張 JPEG 的署名和內容哈希已核對。 |
| A · 首次公開 | BLOCKED | 正式日期及兩個人工批准紀錄尚未填入。審批包括網站的八圖分發證據與實際營運設定。 |
| B · 公開網址、日期和八圖 | POST-DEPLOYMENT VERIFICATION | 首次公開後才填正式 origin 及首次公開時間。程式核對八頁（含兩個首頁）、同站 308、正確 404、CSS、語系及郵箱連結、無登入的 JPEG 200 及八個 SHA-256。人工另查瀏覽器行為、下載和郵箱收件。 |
| C · App Store | BLOCKED | 待正式 Archive Privacy Report、`react-native-maps` 精確位置聲明和實際接收者／保留證據、營運者的 App Privacy 決定、iOS 成品及照片分發核驗，以及 Gate B 已核對的網站網址。 [Apple App Privacy](https://developer.apple.com/app-store/app-privacy-details/) |

## 驗證結果

| 檢查 | 狀態及結果 |
| --- | --- |
| `npm run typecheck` | PASS · Node.js 22.13.0。 |
| `node scripts/test-compliance.cjs` | PASS · i18n parity、App／網站兩語文案、12 個月起算及法律例外、`mailto:`、App 合規入口、八個靜態頁路徑、圖旁署名、直接資源、SHA-256、相片缺失及錯配攔截。隔離測試通過 A／B 正反向分支，含香港跨日、轉址、404、錯誤 JPEG 回應和錯誤雜湊。 |
| `node website/build.cjs` 及本機 HTTP | PASS · 四條政策／支援及兩條照片頁 HTTP 200，八張 JPEG HTTP 200 及 SHA-256 正確，確認目錄轉址和 404。本機 Python 靜態伺服器使用 301，Vercel 所需 308 另按配置及隔離測試核對。 |
| `node website/build.cjs --check-release`、`--release`、`--check-live` | PASS · 真實未批准配置下，前兩者如期拒絕日期及審批缺口、後者如期拒絕缺少真實 HTTPS origin。真實 Vercel HTTPS 留待 Gate B。 |
| `node scripts/test-explore-photos.cjs`、`test-explore-places.cjs`、`test-explore-trailhead-navigation.cjs` | PASS · 八張 JPEG 完整解碼及與 App 映射一致，離線詳情、分類、首頁聯動、雙語及原導航規則通過。 |
| `node scripts/test-global-search.cjs`、`test-global-search-ui.cjs`、`test-global-search-navigation.cjs` | PASS · 搜尋資料、介面及跨頁返回回歸。 |
| `CI=1 EXPO_OFFLINE=1 ./node_modules/.bin/expo export --platform ios --output-dir <暫存目錄>` | PASS · Metro 1,294 模組，輸出 Hermes `.hbc`，八個照片 SHA-256 均出現在 iOS 匯出資產中。 |
| `git diff --check`、`git diff HEAD --exit-code -- assets src/explore-place-images.ts` | PASS · 既有照片、metadata、正式資料及圖片映射未改。 |

## 修改文件及工作區

- `content/compliance.json`、`content/compliance-policy.js`、`src/compliance-content.ts`、`src/components/compliance-document.tsx` 更新共用雙語政策及正式版本呈現。
- `website/build.cjs`、`website/explore-credits.cjs`、`website/site.css`、`website/release.json` 實作雙語照片頁、原始二進制副本及網站發佈檢查。
- `vercel.json`、`website/README.md` 準備靜態建置及首次部署流程。 `scripts/test-compliance.cjs` 補充共用政策、素材及 Gate 用例。
- `docs/operations/SUPPORT-EMAIL-RETENTION.md` 和本文件記錄手動保留流程、來源及剩餘公開決策。

`develop` HEAD 仍為 `57b97a69178358f96b5d3043e61ccca08de217f0`，和開工時已核實的遠端基線相同。工作區有本輪 9 個修改檔與 4 個新增檔。未操作正式部署、EAS 正式建置、App Store Connect、模擬器或真機。未提交、推送或合併。
