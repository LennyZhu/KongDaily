# UX-02B5B 官方資料授權、署名與私隱審計

核驗日期為 2026-11-21（香港時間）。本輪結論適用於這四項已核對的鐵路資源及目前 App 的使用方式。`develop` 開工時乾淨，HEAD、本機 `origin/develop`、GitHub `refs/heads/develop` 均為 `48fb34204a2f08cb170149e923b30a7b6497ab28`，已包含 UX-02B5A2。已發行 iOS 1.0.0 (2) 對應 `v1.0.0` 的 `f35d593f538e02803082e13dfb71b906c1b2675e`。本報告分別使用已發行 IPA 證據和下一版本的原始碼證據。

## 放行結論

| 問題 | 判定 | 依據與放行條件 |
| --- | --- | --- |
| 商業使用 | **CONDITIONAL GO** | DATA.GOV.HK v1.2 第 3 段明文涵蓋商業、非商業用途。四項資源由門戶直接發行並明確列出港鐵為權利人。有條件再利用的依據充分，需履行署名、遵守個別條款及處理外部材料的適用範圍。門戶 FAQ 將資料轉售另列。KongDaily 目前作獨立非商業項目，這項判定評估日後的商業 App 使用情境。 [門戶條款](https://data.gov.hk/en/terms-and-conditions) · [FAQ Q4–Q5](https://data.gov.hk/en/faq) |
| 離線分發 | **CONDITIONAL GO** | 第 3 段涵蓋分發和複製至數碼副本，兩個 CSV 是明確列出的資源。現行 JSON 快照是可驗證的欄位轉換。發布前完成隨包署名，留存對衍生副本及港鐵額外條款範圍的判斷，並單獨核對不來自 CSV 的馬場補充資料。 [重鐵資源](https://data.gov.hk/en-data/dataset/mtr-data-routes-fares-barrier-free-facilities/resource/8daba4fe-b879-4a51-8962-27b4cffdc61c) · [輕鐵資源](https://data.gov.hk/en-data/dataset/mtr-data-routes-fares-barrier-free-facilities/resource/d0662909-9919-4f01-b4f9-eccc4b2acbb5) |
| 即時 API | **CONDITIONAL GO** | 門戶列出的 GET 和規格相符，未發現資源要求另行登記或商業許可。限流、快取與文件權利的證據見下文。公開資源未證實服務端留存，也未授權取代、轉售服務或長期發布其快照。 [港鐵 API 資源](https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data/resource/103472ed-01be-4dda-92c6-30530dee022f) · [輕鐵 API 資源](https://data.gov.hk/en-data/dataset/mtr-lrnt_data-light-rail-nexttrain-data/resource/d26e774b-b5ef-409f-8d4d-e61a3d323f9d) |
| 來源署名 | **CHANGE REQUIRED** | 鐵路詳情已有港鐵、政府和門戶署名、日期與連結。中央資料來源未列四項鐵路資源；選項旁的即時預報與共用離線免責文案仍需區分。 |
| Privacy Policy | **CHANGE REQUIRED** | 已發行版的兩語政策可公開讀取，版本 1.0。下一版本新增兩項鐵路外部資料請求，現行列舉未涵蓋。 |
| App Privacy | **UNRESOLVED** | HK／US 公開頁均顯示不收集資料。下一版本的站點查詢留存、共享網關角色以及候選歸檔的 SDK 聲明尚待核實。不能據此核准沿用「否」，也不能把單次請求直接當成應申報收集。 |
| 下一版本發布總門檻 | **NO-GO** | 完成必要署名和政策更新、以實際接收者及留存證據核准 App Privacy、關閉候選成品的 manifest 核驗，再放行公開版本。各依賴的放行條件見下。 |

## 適用條款及四項鐵路資料

- **DATA.GOV.HK 通用授權。** 英文及繁中頁現行 v1.2，最後更新 2025-05-26。「General」定義適用於政府及相關機構在門戶提供的 Data；「Use of Data」第 3 段含 “distribute, reproduce” 及 “give proper attribution”，要求在所有副本識別來源、承認政府及相關機構權利、給政府、相關機構與 DATA.GOV.HK 適當署名，並履行彌償條件。「Intellectual Property Rights」保留另行標示的權利人；四項資源均列 MTR Corporation Limited，署名須準確區分港鐵資料所有權及政府門戶發布角色。「Disclaimer and Limitation of Liability」按 “AS IS” 提供，無準確、及時、更新或可用性保證；「Linked Information and other Third-Party Websites」要求參閱外部網站自身條款。FAQ Q4–Q5 將遵循相關網站條款列為條件，區分資料轉售與再利用，政府不就再利用收權利金。 [英文條款](https://data.gov.hk/en/terms-and-conditions) · [繁中條款](https://data.gov.hk/tc/terms-and-conditions) · [官方 FAQ](https://data.gov.hk/en/faq) |
- **港鐵主站與技術文件。** `www.mtr.com.hk` 條款 §1 將 Website 定在該主站，§5 及 §10 限制主站內容的複製、分發及商業利用，短句為 “personal, non-commercial use only”。據其範圍，主站地圖、素材和頁面內容的未授權再發布為 **RESTRICTED**。開放 CSV 位於 `opendata.mtr.com.hk`，即時端點位於 `rt.data.gov.hk`，皆由資源頁直接列載。未發現主站條款將其非商用限制明確延伸至這四份開放資源。兩份 API 規格和兩份即時字典封面均列 “All rights reserved” 並限制文件本身的複製及使用。權利聲明指向文件及其內容，未發現文字把相同限制明確施加到 GET 輸出。App 保留來源連結與自己解析的欄位，避免打包 PDF、範例全文、官方路線圖或 Logo。 [港鐵主站條款](https://www.mtr.com.hk/en/customer/main/terms_of_use.html) · [港鐵規格 v1.7](https://opendata.mtr.com.hk/doc/Next_Train_API_Spec_v1.7.pdf) · [港鐵字典 v1.7](https://opendata.mtr.com.hk/doc/Next_Train_DataDictionary_v1.7.pdf) · [輕鐵規格 v1.1](https://opendata.mtr.com.hk/doc/LR_Next_Train_API_Spec_v1.1.pdf) · [輕鐵字典 v1.2](https://opendata.mtr.com.hk/doc/LR_Next_Train_DataDictionary_v1.2.pdf) |
- **額外條件查找。** 核對資料集頁、四個具體資源頁、與 App 哈希一致的原 CSV 及 HTTP 標頭、靜態字典 ZIP 內兩份對應規格、即時規格及字典，並查找供應商官方開放資料條款。兩份靜態字典各一頁，列欄位、UTF-8 和字元轉換說明；沒有找到額外許可字樣、`Link: rel=license` 或隨附授權檔。即時規格只列公開 GET 參數、狀態碼與範例，資料頁未列註冊或收費步驟。`opendata.mtr.com.hk` 根網址在公開檢索未取得可用條款頁。結論為**未發現明確額外條款**；公開取用及沒有 API Key 無法證明沒有其他適用條件。 [CSV 資料集及 ZIP 入口](https://data.gov.hk/en-data/dataset/mtr-data-routes-fares-barrier-free-facilities) · [靜態資料字典 ZIP](https://opendata.mtr.com.hk/doc/DataDictionary.zip) |

| 實際資源 | 官方證據與版本 | App 用法、權利判定及待確認 |
| --- | --- | --- |
| **港鐵靜態** `opendata.mtr.com.hk/data/mtr_lines_and_stations.csv` | `MTR Lines (except Light Rail) & Stations` 的 Data Resource Details／Description 列載 CSV、港鐵公司及門戶日期 2023-06-25，HTTP Last-Modified 為 2023-11-21。資源描述短句「MTR Lines (except Light Rail) & Stations」與壓縮檔內 `mtr_lines_and_stations_dataspec.pdf` 對得上。SHA-256 `e0e781152e2e6c5f6d7763262acbae76577b71ca4c66b4b7b72a97252175e0c3`。 | **PERMITTED WITH CONDITIONS**。第 3 段明文支持商業使用、數碼複製和分發。現有欄位轉換是按這項許可作出的適用推論，條款未單獨列明衍生 JSON。App 以 `scripts/build-mtr-static.py` 產生 `assets/data/mtr-static.json`，原 CSV、字典與主站地圖未隨 App 提供。離線資料按快照更新，運行時快取與配額 **NOT APPLICABLE**。`RAC` 是從公開 API 字典及主站服務資料核實後補入的站碼、名稱及線路關係，無原 PDF 或地圖。補入資料在該授權下的涵蓋範圍 **UNRESOLVED**，應向港鐵核實或保存僅使用公開事實的審批依據。 |
| **輕鐵靜態** `opendata.mtr.com.hk/data/light_rail_routes_and_stops.csv` | `Light Rail Routes & Stops` 的 Data Resource Details／Description 列載港鐵公司、CSV 及 2026-07-05。HTTP Last-Modified 為 2026-07-04 16:58:02 GMT。字典 `light_rail_routes_and_stops_dataspec.pdf` 核對相同檔名、Stop Code、Stop ID 及站序。SHA-256 `f2fec60de38b72f38d3478fcdeecea4e3332b300b73c23bf41b22d412a2c2066`。 | **PERMITTED WITH CONDITIONS**。`scripts/build-light-rail-static.py` 將 CSV 轉為 `assets/data/light-rail-static.json` 的 11 條路線、68 站、382 筆官方站序。適用條件包括在隨包副本標示港鐵、香港特區政府及 DATA.GOV.HK，保留資料來源與快照資訊。未發現另外的書面許可、快取期限或批量規則；App 運行時請求限額 **NOT APPLICABLE**。 |
| **港鐵即時** `rt.data.gov.hk/v1/transport/mtr/getSchedule.php` | 港鐵公司供應及擁有權利。門戶資源頁標示更新頻率每 10 秒及 2025-03-13，API v1.7 §2 明示 GET、`line/sta/lang` 和 “429 Too Many Requests”。 | **PERMITTED WITH CONDITIONS**。門戶第 3 段及資源頁為商業／非商業顯示資料的正面依據。只查當前合法線站，`lang=EN`，短期記憶體使用，不隨 App 分發回應。長期離線分發不在本次用法，正式最大配額、快取政策與 API 日誌 **UNRESOLVED**。 |
| **輕鐵即時** `rt.data.gov.hk/v1/transport/mtr/lrt/getSchedule` | 港鐵公司供應及擁有權利。門戶資源頁標示每 10 秒及 2026-07-05，API 規格 v1.1 §2 列 GET、`station_id/with_special` 和 “429 Too Many Requests”。字典 v1.2（2026-07-05）包含更名。 | **PERMITTED WITH CONDITIONS**。使用 `station_id` 與已公開的 `with_special=1`；短期記憶體使用，無回應包或長期離線分發。未發現特別車的獨立許可條款，正式最大配額、快取政策與 API 日誌 **UNRESOLVED**。 |

資源連結按上表順序收錄。ZIP SHA-256 為 `0bf65d9456b6a30f07c9147a408923c784c023692ec86baadcee562bf7f12772`。兩個 CSV 與 ZIP 本輪均以 HTTPS 200 讀取，雜湊吻合 2026-11-21 快照，兩支生成器以舊採集 metadata 重跑 `--check` 均相符。雜湊證明資料來源和位元一致性。 [港鐵 CSV 資源](https://data.gov.hk/en-data/dataset/mtr-data-routes-fares-barrier-free-facilities/resource/8daba4fe-b879-4a51-8962-27b4cffdc61c) · [輕鐵 CSV 資源](https://data.gov.hk/en-data/dataset/mtr-data-routes-fares-barrier-free-facilities/resource/d0662909-9919-4f01-b4f9-eccc4b2acbb5) · [港鐵即時資源](https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data/resource/103472ed-01be-4dda-92c6-30530dee022f) · [輕鐵即時資源](https://data.gov.hk/en-data/dataset/mtr-lrnt_data-light-rail-nexttrain-data/resource/d26e774b-b5ef-409f-8d4d-e61a3d323f9d)

**即時快取及頻率。** `src/next-train-client.ts` 每 URL 合併在途請求，最多重用 20 秒的記憶體讀數，顯示有效窗 60 秒，8 秒逾時。429 尊重 `Retry-After`，無可用值預設 60 秒，每端點分開退避。只有當前站頁進入、前台恢復或手動刷新才可能發 GET，沒有週期網絡輪詢。20 秒是同 URL 抑制間隔，不是所有站點或用戶合計配額。既有港鐵 `TKL/TKO` 和輕鐵 `250` HTTP 200 樣本均為 `Cache-Control: public, must-revalidate, max-age=10`。10 秒是這些 HTTP 回應的新鮮期，`must-revalidate` 針對過期 HTTP 快取回應；當前 20 秒重用的是已解析的 UI 讀數，和平台 HTTP 快取是不同層。發布前核實港鐵／網關是否要求按同一限制處理已解析讀數。若要求上限 10 秒，應縮短重用或到時保留明示過時的讀數，維持請求節制。規格的資料更新週期和實測標頭均不能代替條款、固定配額或伺服器資料留存證據。 [RFC 9111 §5.2.2.2](https://www.rfc-editor.org/rfc/rfc9111.html#section-5.2.2.2) · [B2 樣本](UX-02B2-MTR-REALTIME-NEXT-TRAIN.md) · [B4 樣本](UX-02B4-LIGHT-RAIL-REALTIME-ARRIVALS.md)

## 來源署名與其餘官方資料

| 表面或來源 | 現況及最小處理 |
| --- | --- |
| 設定／關於／資料來源 | `src/app/settings.tsx` 提供私隱、支援及 `settings/credits`；`src/compliance-credits.ts` 已列巴士、運輸署、HKO、設施、路線折線、LandsD、MapKit、探索及照片。既有條款段已明示獨立 App。中央清單未列港鐵／輕鐵。B5B1 加一組雙語鐵路來源，串四個確切資源、門戶條款與資料權利人。顯示 App 為獨立開發，與港鐵及政府沒有營運、合作或背書關係。 |
| 港鐵與輕鐵詳情、預報卡 | `src/app/mtr/[kind].tsx`、`src/app/light-rail/[kind].tsx` 及 `src/i18n.ts` 已有資料提供者、權利人、政府、DATA.GOV.HK、靜態下載日期或資料更新日期；車站頁有即時資料集連結，列車卡有香港時間／更新標籤。港鐵下載日可清楚保留，補官方資源更新日須標明是另一項日期。來源區的離線快照免責要明確只適用於靜態資料，另加即時預報會變動、以官方公布為準的短句。集中呈現完整聲明及四個連結，詳情保留就近入口即可。日常文案用普通文字「港鐵／輕鐵」描述交通方式，代碼和名稱引用既有資料。未發現鐵路官方商標圖、官方地圖資產或背書措辭進包。 |
| 巴士、票價及折線 | 已有三營辦商官方資料頁及中央署名。巴士詳情有營辦商、資料時間、已核實限定班次官方連結。車費中央目前列 XML，B5B1 可補 UX-01C 同時用到的 GeoJSON 與資料截至日，避免將舊價當現價。折線走運輸署 CSDI 及其 §3 條件，保持運輸署／政府／CSDI 分別署名。其他快照及車費刷新歸 B5C。 [KMB／LWB](https://data.gov.hk/en-data/dataset/hk-td-tis_21-etakmb) · [城巴](https://data.gov.hk/en-data/dataset/ctb-eta-transport-realtime-eta) · [嶼巴](https://data.gov.hk/en-data/dataset/nlb-bus-nlb-bus-service-v2) · [運輸署 XML](https://data.gov.hk/en-data/dataset/hk-td-tis_14-routes-fares-xml) · [運輸署 GeoJSON](https://data.gov.hk/en-data/dataset/hk-td-tis_23-routes-fares-geojson) · [CSDI 折線資源](https://portal.csdi.gov.hk/csdi-webpage/dataset/td_rcd_1638844988873_41214) · [CSDI 條款](https://static.csdi.gov.hk/csdi-webpage/doc/TNC) |
| HKO、設施與探索 | 天氣由 HKO 開放 API 提供，現有 credits 列政府、天文台及四項來源；HKO 說明門戶機器可讀資料可商業或非商業再用，外部天氣網頁或刊物另有條款。設施為 FEHD（DATA.GOV.HK）及 AFCD／LCSD（CSDI）官方快照，沒有將經緯度送回資料發行者的搜尋請求。場地文字與連結沿用現有逐項來源。照片公開署名與獨立下載核對沿用既有政策，網站 live 檢查本輪通過；候選 App 圖片分發條件仍需保留既有證據。 [HKO 開放資料說明](https://www.hko.gov.hk/en/education/weather/data-and-technology/00740-Open-Data-of-Hong-Kong-Observatory.html) · [HKO API v1.12](https://www.hko.gov.hk/en/weatherAPI/doc/files/HKO_Open_Data_API_Documentation.pdf) · [CSDI 條款](https://static.csdi.gov.hk/csdi-webpage/doc/TNC) · [現有 App 來源](../src/compliance-credits.ts) · [公開照片署名](https://kongdaily-site.vercel.app/credits/explore/) |
| 官網 | 公開 Privacy、Support、Explore Credits 已有雙語入口。網站沒有整套交通資料鏡像或鐵路供應商整合，本輪未發現要為網站單獨建交通資料庫的需要。B5B2 應同步共用政策與公開輸出，可在支援頁補兩句鐵路離線／即時差異。 [官網](https://kongdaily-site.vercel.app/) |

## 實際資料流及接收方

下表的功能 GET 皆走 HTTPS。除特別列出，App 原始碼沒有加入帳戶、廣告或自訂裝置 ID，也沒有傳使用者原始 GPS。接收端仍可能看見 IP、請求時間、標準標頭及平台傳輸資訊。公開流量統計只證明統計存在，未證實可識別原始日誌的範圍、保留期限和重用。連線及公開交通 ID 需要分別判斷。 [DATA.GOV.HK 歷年使用統計資料](https://data.gov.hk/en-data/dataset/hk-dpo-datagovhk1-open-data-usage-stat)

| 功能與程式證據 | 接收方、請求及使用情況 | 保存證據及 App Privacy 意義 |
| --- | --- | --- |
| 巴士目錄、站序、站點及 ETA。`src/bus-data.ts`、`src/bus-stop-data.ts`、`src/bus-eta.ts`、`src/nearby-stop-routes.ts` | `data.etabus.gov.hk`（九巴／龍運）、`rt.data.gov.hk`（城巴／嶼巴）。目錄端點按營辦商，發送適用的公開 route、方向、service type、stop ID、嶼巴 routeId／語言。附近或收藏可觸發派生站點請求，沒有輸入文字、原始坐標或收藏庫；服務可觀察請求選擇。 | 本機存官方目錄及站序快取；ETA 為即時。尚無各接收者的請求後留存證據。若留存並連接 IP／會話，可涉及 Product Interaction 或 Diagnostics。若用於推斷裝置位置，另按實際精度評估 Location。 |
| 港鐵與輕鐵預報。`src/mtr-next-train-client.ts`、`src/light-rail-next-train-client.ts`、`src/next-train-client.ts` | `rt.data.gov.hk`，資料供應者為港鐵。港鐵僅 `line/sta/lang=EN`，輕鐵僅 `station_id/with_special=1`。手動選擇站頁或指定線站情境，重入、前台與刷新可再查詢；設定 `credentials: 'omit'`，不送原始位置、搜尋文字、地標、帳戶或其他識別碼。站碼描述查看的公共車站。 | 客戶端預報留在記憶體，未保存搜尋歷史。是否由網關或港鐵保存可讀站點／IP／時間、共享或可關聯、留存多久 **UNRESOLVED**。若適用接收方長期留存查閱行為，評估 Usage Data；若按記錄推算使用者位置，再依精度評估 Location。 |
| 天氣及警告。`src/weather-data.ts`、`src/weather.ts`、`src/weather-warnings.ts` | `data.weather.gov.hk/weatherAPI/opendata/weather.php`，只送 `dataType=rhrread/fnd/warnsum/warningInfo` 及 `lang=en/tc`。用戶開官方來源時另由瀏覽器造訪 `www.hko.gov.hk` 等網站。 | App 緩存官方資料。HKO 一般網站私隱說明不能確定 API 日誌欄位、留存或關聯。若有可讀保留，依實際用途而非僅依 HTTP 事實判斷。 [HKO 私隱聲明](https://www.hko.gov.hk/en/privacy/policy.htm) |
| Nearby 線上地點查詢。`src/landsd-location-search.ts` | `www.map.gov.hk/gs/api/v1.0.0/locationSearch?q=…`，符合條件的文字自動發給 LandsD，可含地址。沒有裝置 GPS、地圖視口、帳戶或設備 ID 參數。相同請求可在短期內合併，原文和回應在記憶體暫存。 | 官方規格明示不可短期大量呼叫，未載 API 可讀日誌、保存期限或再利用。若適用接收方留存原查詢，評估 Search History；只有實際收集使用者的地址資料才另評估 Physical Address。 [LandsD 規格、限制及聯絡](https://portal.csdi.gov.hk/csdi-webpage/apidoc/LocationSearchAPI) |
| 前台位置、附近巴士及設施。`src/nearby-bus-location.ts`、`src/app/bus/nearby.tsx`、`src/app/(tabs)/nearby.tsx` | Core Location 單次讀取與授權。距離、候選站／設施篩選使用本機坐標、記憶體和 SQLite。只在顯示附近巴士結果時啟用這一路前台定位，兩個鐵路目錄均無此需求。導航與地圖例外另見下列。 | App 業務層未寫 GPS 歷史或開背景定位；沒有找到把原始 GPS 附到官方交通、天氣或 LandsD 查詢的路徑。本機處理本身無 Apple Collection，GPS 派生的公開站點另查。iOS 定位服務依用戶設定管理。 [Apple Location Services](https://www.apple.com/legal/privacy/data/en/location-services/) |
| App 內地圖。`src/components/nearby-facilities-map.tsx`、`src/components/bus-stop-map.tsx` | 預設 Apple MapKit。附近頁雖 `showsUserLocation=false`，仍可能把 GPS 作自訂標記和相機中心交給 MapKit；巴士圖顯示公共站點與折線。底圖和可見區域由 Apple 地圖服務處理。 | Apple 自己保留的資料依 Apple 說明處理，依 Apple 申報指南無需代為申報。`react-native-maps` 的供應方聲明及是否有其他接收者須與候選包核對。沒有證據顯示 App 取得 Apple 地圖遙測回傳給開發者。 [Apple 地圖與私隱](https://www.apple.com/legal/privacy/data/en/apple-maps/) · [Apple App Privacy](https://developer.apple.com/app-store/app-privacy-details/#additional-guidance) |
| 用戶主動外部導航、官方資料及支援。`src/facility-navigation.ts`、`src/explore-places.ts`、`src/components/compliance-document.tsx`、鐵路及天氣來源 | Apple Maps／Google Maps URL 傳選定公共目的地經緯度和步行模式，無目前 GPS；外部 App 可按其權限自行定位。官方來源（包括港鐵公告及班次）、常見問題、私隱頁以系統外部連結開啟。`mailto:` 只帶固定收件地址；使用者可於郵件 App 主動提供姓名、地址、問題及附件。 | 外部服務按自身政策處理。支援郵件可由經營者保存至結案後 12 個月，法律例外，電郵服務商的日誌、備份及留存另行處理。核實 Apple 是否將這個外部郵件入口的經營者收件納入 App 範圍。官網 Vercel 可能處理訪客 IP；網站靜態輸出沒有追蹤腳本。 [現行私隱政策](https://kongdaily-site.vercel.app/privacy/) · [Vercel Privacy Notice](https://vercel.com/legal/privacy-notice) |
| 全域／交通搜尋、收藏、最近記錄、離線內容與偏好。`src/global-search.ts`、`src/app/bus/nearby.tsx`、`src/database.ts`、`src/bus-data.ts`、`src/bus-favorites.ts` | 搜尋在裝置比對。按需整批更新巴士目錄不帶原查詢。兩份鐵路目錄從包內快照讀取。SQLite 保存收藏、置頂、語言、舊巴士搜尋最多八筆及官方快取，沒有帳戶同步。收藏觸發個別巴士 ETA 見巴士行。附近設施的線上搜尋是獨立功能。 | 本機保存及僅由 Apple 管理的裝置備份不構成營運者收集。刪除／卸載與備份效果依現有政策分開。 |
| 診斷、廣告、識別與其他連線。`package-lock.json`、`app.json`、`src/language.tsx`、`src/bus-data.ts` | 未見產品分析、第三方崩潰上報、廣告、ATT 或帳戶 SDK。`__DEV__` 巴士日誌和語言錯誤使用本機 Console。沒有看到將 Motion/Fitness、日誌或裝置 ID 上報的功能路徑。Expo 建置服務與 iOS 自身診斷需和產品請求分開。 | 未找到 App 主動收集證據。Apple 自有診斷不代報，需另核對經營者是否取得及使用可讀診斷／TestFlight 回饋。政府及供應者的獨立運維留存仍屬未確認。 |

## Privacy Policy 與 App Privacy

- **已發行 1.0.0 (2)。** 正式 HTTPS 網址經 `node website/build.cjs --check-live` 核對，Privacy、Support 兩語均可用；兩個私隱頁與 App 共用 `content/compliance.json` 的政策 1.0 一致，生效及更新日期均為 2026-11-20。政策清楚列出前台定位、SQLite、巴士及天氣、LandsD、Apple 地圖、外部連結及自願支援。沒有用已取得證據推翻 Build 2 政策；舊有服務端留存與 SDK 缺口繼續獨立追蹤。郵箱連結正常且為已批准地址，本輪未發送郵件驗證收信。 [繁中 Privacy](https://kongdaily-site.vercel.app/privacy/) · [English Privacy](https://kongdaily-site.vercel.app/en/privacy/) · [繁中 Support](https://kongdaily-site.vercel.app/support/) · [English Support](https://kongdaily-site.vercel.app/en/support/)
- **下一版本差異。** `v1.0.0..develop` 的 `app.json`、套件清單與鎖檔、共用私隱內容沒有改動。兩個新 GET 實際存在於開發中的產品碼。B5B2 在同一共用政策的線上服務段補港鐵／輕鐵、資料由港鐵提供且經 `rt.data.gov.hk`、線路／車站編號及選項、IP 等連線資料、短期客戶端預報快取、接收者後續留存未公開的範圍。可同時補充交通搜尋在本機比對，只有查看即時預報才送所選公開代碼。說明不能把站碼說成目前位置、不能把所有 GPS 宣稱永不交付 Apple、不能填入未經核實的留存天數。由開發者核准政策版本與實際生效日期再配合候選發布。
- **已上架標籤。** HK App Store 回應標示「不收集資料」，US 回應標示 `Data Not Collected`，各自連結繁中／英文正式政策。這證明公開宣告現況，沒有登入 App Store Connect 讀取內部回答。Build 2 IPA 沒有兩個鐵路即時端點，不因開發中功能提前改寫已發行版的宣告。Apple 說明標籤為 app 層級，公開時應反映目前上架版本；若取得 1.0.0 已存在的應申報收集證據，另行更正既有版本。 [香港 App Store](https://apps.apple.com/hk/app/kongdaily/id6837312302) · [美國 App Store](https://apps.apple.com/us/app/kongdaily/id6837312302) · [Apple Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy)
- **判定標準。** Apple 的 Data Collection 指資料離開裝置，並由開發者或適用第三方在即時服務所需時間之後仍可存取。其第三方合作方定義重點為在 App 中整合的第三方工具、SDK 或供應方程式。政府公開 GET 未嵌入供應方 SDK，是否納入 App 範圍需結合實際接收、處理、角色及 Apple 說明；若仍有歧義，把精確的 data flow 提供 Apple Developer Support。即時必要且處理後無可讀保存的資料無需披露。IP 若保留，按用途映射；由 Apple 自己收集及僅裝置處理的資料有明確邊界。是否 linked 需看原文、IP、帳戶或其他可重連資料；Tracking 須看跨公司廣告、廣告衡量或資料經紀的使用，與連線及留存分開。 [Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/) · [App Review Guidelines §5.1、§5.2.2](https://developer.apple.com/app-store/review/guidelines/)

| 可能類別 | 建議與需補證據 |
| --- | --- |
| Precise Location／Coarse Location | App 的本機前台 GPS 無需因權限本身勾選。Apple 自身 MapKit 處理不代報。若適用的非 Apple 接收者保留坐標或由 IP／附近站碼推斷並留存裝置位置，依實際精度及功能用途填寫。先核實用途、接收方、保存與去識別時間。 |
| Search History／Product Interaction | LandsD 原查詢若由適用接收者可讀留存，考慮 Search History。若港鐵／巴士選站歷史被留存為使用者操作，考慮 Product Interaction，App Functionality 或 Analytics 隨證據。靜態搜尋沒有網絡字詞，開啟某站不等同用戶位於該站。 |
| Device ID／Diagnostics | IP 若僅即時服務無需申報。若保留而用來識別裝置、推算位置或提供診斷，按實際用途分類，不把所有 IP 直接勾為 Device ID。需取得網關、供應商與營運者的留存欄位和用途。 |
| Contact Info／Customer Support | 用戶自願外部郵件由經營者實際收到；如果 Apple 確認納入 App 收集範圍，按 Email Address、實際收到的 Name 與 Customer Support 評估，功能用途，可關聯電郵者。不要僅用「自願」推論符合所有可省略條件。 |
| Tracking、Fitness、其他 | App 碼未見跨公司廣告、經紀分享、Motion／Fitness 取值或外傳。接收方未確認的隱私行為列待核實。至少一項經證實須披露才有依據選「是」；所有適用路徑均不需披露才可批准「否」。 |

### 第三方 SDK 與成品證據

本輪重查既有 Build 2 IPA，主 plist 仍為 `com.lennystudio.kongdaily`、`1.0.0 (2)`，無 `UIBackgroundModes`。九份 `PrivacyInfo.xcprivacy` 的收集陣列皆空，無 Tracking。舊 IPA 查不到兩個鐵路端點。這是已發行版的檢查，下一版本的正式 Archive、Pod 清單、Required Reason API、網絡實測皆待其候選階段驗證。 [既有成品證據與清單](REL-03D1-APP-PRIVACY-GATE-C.md) · [Apple SDK 指引](https://developer.apple.com/support/third-party-SDK-requirements/) · [Apple Privacy Manifest](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)

| SDK | 已核對的事實及下一步 |
| --- | --- |
| `react-native-maps@1.27.2`／Apple MapKit | iOS 原始 manifest 宣告 `PreciseLocation`、`App Functionality`、linked=false、tracking=false，另列 File Timestamp `C617.1`。Build 2 使用 AirMaps 與 Apple MapKit，沒有 Google Maps SDK，亦無該 AirMaps manifest 入包。候選需核實供應商聲明是否涵蓋 Apple MapKit、自訂位置標記與相機聚焦，確認接收者、可讀留存及原生資源是否正確打包。 |
| `expo-location@57.0.23`／`react-native-reanimated@4.5.1` | 雙語前台與 Motion 用途在 repo 及 Build 2；`app.json` 禁止 Always 定位，未見背景定位或 ATT。SDK 的原生感應器引用無法證明 App 使用或收集 Motion。核對候選 entitlements、生成 plist 和實際應用路徑。 |
| Expo `57.0.33`、RN `0.86.3`、Expo Router `57.0.31`、SQLite `57.0.5` 等 | 已發行包及鎖檔證據見 REL-03D1。無新增分析、廣告或崩潰回報套件。App 使用本機儲存、在地化及系統導航。候選仍應核對實際入包 Required Reason 類型、理由與供應商 bundle。 |
| `expo-file-system@57.0.7` | 本機 Podspec 宣告 `ExpoFileSystem_privacy` 資源；Build 2 該 bundle 只有 `Info.plist`，未見來源 manifest 的 File Timestamp 和 Disk Space SDK 專屬理由入包。保留為待核實的打包差異，核對正式 Archive、Apple 通知及對應 SDK 版本理由。理由需依實際歸屬，避免為填表而複製 SDK 專屬理由到 App。 |

## 發布阻塞與最小實施範圍

| 級別 | 關閉條件與涉及檔案 |
| --- | --- |
| **BLOCKER** | 補齊鐵路權利及免責署名；對隨包轉換、馬場補充事實及兩個 API 產品用法保存可呈交 Apple §5.2.2 的授權依據。若官方指出明確不適用、須另得許可或限定快取，依條件處理；授權尚未閉合的必要資料可延後發布。 |
| **BLOCKER** | 候選上架前更新線上／離線雙語私隱政策，完成 API 留存與角色、App Privacy 和正式 Archive 及 manifest 的核准。對不公開的端點日誌先做精確求證，必要時向 Apple 確認涵蓋範圍。現有 App Store 標籤不可直接當候選版的結論。 |
| **REQUIRED BEFORE RELEASE／B5B1** | `src/compliance-credits.ts` 加鐵路來源，`src/i18n.ts` 與 `src/app/mtr/[kind].tsx`、`src/app/light-rail/[kind].tsx` 在必要時區分資料日期與即時免責。重用現有設定及詳情入口，增加 `scripts/test-compliance.cjs` 的雙語連結／出處核對。若官方確認現有署名足以覆蓋某個表面，可跳過該表面的修改。 |
| **REQUIRED BEFORE RELEASE／B5B2** | `content/compliance.json` 在兩語補即時鐵路實際資料流，使用同一來源生成 App 和 website 可審閱版本。僅在開發者批准版本、日期及部署後更新公開政策。若確認有保留、共享或身份關聯，依確證補用途和相關權利。Website legal 文案接受既有發布驗證。 |
| **REQUIRED BEFORE RELEASE／B5B3** | 保存供應商／網關回覆與實際候選 Archive 證據。核對 Apple 隱私報告、Required Reason APIs 與申報欄位。需要時由開發者配合發布時點更新 App Store Connect。若所有現行標籤證據閉合且答案未變，可跳過實際改表。此階段與本輪無遠端寫入。 |
| **RECOMMENDED** | B5C 更新巴士車費及所有交通資料來源日期。現有車費於 **2026-12-02 00:00 香港時間**隱藏，使用官方更新流程維持顯示；另外保留快取／限流實測與對應來源，方便後續核對。 |
| **NO CHANGE** | 目前 GPS/靜態查詢的本機處理、無背景定位、鐵路短期記憶體模式、獨立內容路由及原有資料生成方式可保留。App Privacy 尚待核實的事實不要求本輪更改政策、Location SDK 或 manifest。 |

## 官方求證郵件草稿

收件人為 `opendata@mtr.com.hk`，已核對兩個即時資料集的 Additional Information 仍公開列出該地址。若日誌由政府網關管控，另向資料門戶 Open Data Help Desk `opendata@digitalpolicy.gov.hk` 查證。LandsD 及 HKO 已有正式聯絡渠道，可平行核實既有端點。本輪只起草，未測試信箱投遞或寄出。 [港鐵資料集聯絡](https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data) · [輕鐵資料集聯絡](https://data.gov.hk/en-data/dataset/mtr-lrnt_data-light-rail-nexttrain-data) · [門戶技術聯絡](https://data.gov.hk/en-data/dataset/hk-dpo-datagovhk1-open-data-usage-stat) · [LandsD API 聯絡](https://portal.csdi.gov.hk/csdi-webpage/apidoc/LocationSearchAPI) · [HKO 聯絡](https://www.hko.gov.hk/en/privacy/policy.htm)

**繁中主旨　確認 KongDaily 使用港鐵及輕鐵開放資料的條件**

港鐵開放數據團隊您好：

我是 KongDaily 的個人開發者。KongDaily 是獨立 iOS App，擬以 DATA.GOV.HK 列出的 `mtr_lines_and_stations.csv`、`light_rail_routes_and_stops.csv` 生成精簡 JSON，隨 App 離線提供站名和站序，並使用 `rt.data.gov.hk` 上港鐵及輕鐵 Next Train GET。煩請確認門戶 v1.2 是否涵蓋上述方式及日後的商業 App 使用，是否有個別條款、書面批准、登記或費用，以及所需署名、免責與政府／門戶文字。港鐵快照另補一筆以公開字典及服務資訊核實的馬場站碼與線路關係，亦請確認這類事實的適用條件。App 只使用一般文字及公開詮釋資料，提供原資料及官方服務網頁連結。

即時請求只使用目前站頁的線路／站碼及公開選項，在手機記憶體合併與短暫重用，未做定時全站輪詢。請問每站／每裝置／每 IP 或總量有何配額、建議刷新頻率或 UI 讀數保留上限？現有 HTTP 樣本有 `max-age=10, must-revalidate`，是否同樣限制已解析且明示更新時間的 App 內讀數重用？另外，請告知政府網關與港鐵各自是否留存站碼、選項、IP、時間、標頭或任何可識別資訊，在即時回應後是否可讀、保留期限、分工、關聯、用途及是否向其他方提供。若其中事項由其他團隊負責，煩請指向廠方適用文件或聯絡窗口。謝謝。　Lenny／KongDaily

**English subject · KongDaily use of MTR and Light Rail open data**

Dear MTR Open Data team,

I am the independent developer of KongDaily, an iOS app. It would bundle compact offline JSON derived from the two DATA.GOV.HK resources `mtr_lines_and_stations.csv` and `light_rail_routes_and_stops.csv`, and display station forecasts using the listed MTR and Light Rail Next Train GET endpoints on `rt.data.gov.hk`. Could you confirm whether DATA.GOV.HK Terms v1.2 cover those uses, including in a commercial app, and identify any additional terms, written permission, registration, fees, attribution or disclaimer requirements? The MTR directory supplements the CSV with the public Racecourse station code and line association. Please also confirm the applicable terms for those facts. The app uses plain-text names and links to official sources.

The forecast requests are for the station currently viewed. They are coalesced or reused briefly in memory, with no scheduled polling across stations. Are there limits by station, device, IP or aggregate use, and recommended refresh or presentation-cache limits? Does the observed `max-age=10, must-revalidate` also govern reuse of parsed in-app readings shown with their update time? For both endpoints, please clarify what the government gateway and MTR each retain or can access after a real-time response, including line or station codes, options, IP addresses, timestamps, headers and identifiers, the retention period, purposes, linkage and any further sharing. An official document or the contact for the responsible team would be appreciated. Thank you. Lenny, KongDaily

## 驗證及 Git

- 完成 `npm run typecheck`、`node scripts/test-compliance.cjs`、兩個官方靜態快照生成器 `--check`、公開網站 `--check-live`、兩地 App Store 公開標籤、Build 2 IPA 比對及 `git diff --check`。使用既有 HTTP 樣本核對即時標頭，本輪沒有發出新的即時 API 請求。
- 本報告使用 UX-02B0／B1／B2／B3／B4／B4B／B5A／B5A2 的來源與實施記錄，B4A 驗收併見 B4／B5A，及 REL-01C0、REL-01C1B2、REL-03D1、UX-01C 的既有證據。原始碼核對涵蓋 App 權限、`package.json`／鎖檔、設定和政策頁、兩鐵詳情、各 API client、定位、MapKit、資料庫、搜尋及網站產生器。
- 交付時 `develop` 仍為 `48fb342`，本機與 GitHub 已驗證一致，工作區只新增本報告。沒有更改 App、官方資料、政策、App Store Connect、建置、網站或郵件，也未提交、推送或合併。
