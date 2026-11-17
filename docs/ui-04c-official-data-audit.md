# KongDaily · UI-04C0 官方公園及寵物公園資料可行性審計

審計日期為 **2026-11-17（香港時間）**。基線為 `develop` 的 `a470f69044361327616bcd713cbae85716048b31`，與本地 `origin/develop` 跟蹤引用一致。本次使用官方下載檔及公開網頁做離線比對，原始回應及核對腳本只存於臨時目錄。

## 1. 階段結論

| 階段 | 可實施範圍 | 仍待處理 |
| --- | --- | --- |
| UI-04C1 一般公園 | `PARKS` 的 124 筆中，49 筆有雙語 `PARK`／`公園` 類型。剔除官方場地身份為動植物公園的香港動植物公園後，**48 筆**可作首輪公園資料，包括經核對的場地參考點。 | 首次導入須建立跨快照身份對照。名稱含「公園」但類型不符的場地，以及目錄未收錄的場地，須另有官方分類證據才納入。 |
| UI-04C2 寵物公園 | 找到兩個獨立 CSDI 開放圖層。**55 筆專用、181 筆共享**有有效場地點。按同區、雙語名稱及官方名單身份交叉比對，**47 筆專用、170 筆共享**進入優先複核範圍。 | 待確認別名、較新名單的缺點位場地、跨快照身份及指定區域衝突。地理圖層只有點，指定區域邊界及入口未獲證實。可先做經複核的參考點子集，完整覆蓋及入口導航暫緩。 |

已逐張查看 [公園地圖](design/ui-04c-park-map-review.png)、[公園列表](design/ui-04c-park-list-review.png)、[寵物公園地圖](design/ui-04c-pet-map-review.png)及[寵物公園列表](design/ui-04c-pet-list-review.png)。圖中的地圖、標記及距離屬設計示意。兩類寵物場地的分類、場地規則及指定範圍以官方證據為準。

## 2. 來源及下載核驗

從 DATA.GOV.HK 資源取得資料集 ID，沿 CSDI 元數據公開的 File API 和 ArcGIS FeatureServer 核對三個圖層。三份 GeoJSON 和三組 REST 計數及座標查詢均回應 HTTP 200。每份 GeoJSON 是一個完整 `FeatureCollection`。FeatureServer 每個服務只列出圖層 0，容許每次最多 3,000 筆。本次各用一個完整的 `outSR=4326` 查詢，回應筆數與 `returnCountOnly=true` 及下載檔一致，沒有超出回傳上限。另下載 `PARKS` 靜態 ZIP，解壓後與 File API 檔案逐位元組相同。WFS `GetCapabilities` 也回應成功，列出 `csdi:PARKS` 及原始 CRS EPSG:2326。批次導入可使用 File API 整檔，REST 可用於驗收筆數。

| 資料集 | 官方歸檔名及日期 | 元數據修訂 | 實測資源 |
| --- | --- | --- | --- |
| Parks, Zoos and Gardens | `PARKS_20261025_gdb_PARKS_converted.geojson`，2026-10-25 | 2026-10-15 | [DATA.GOV.HK](https://data.gov.hk/en-data/dataset/hk-lcsd-csdi-parks-zoos-gardens/resource/4eeaeac4-c93a-4168-99c1-2df99acf17eb) · [元數據](https://portal.csdi.gov.hk/csdi-webpage/metadata/lcsd_rcd_1629267205215_19292/html) · [GeoJSON](https://portal.csdi.gov.hk/csdi-webpage/file-api?dataset_id=lcsd_rcd_1629267205215_19292&format=geojson&layer_name=PARKS) · [靜態 ZIP](https://static.csdi.gov.hk/csdi-webpage/download/common/2ab9572692f09fb521468816f079908cfe76373baf74dff04332abecec213a01) · [REST](https://portal.csdi.gov.hk/server/rest/services/common/lcsd_rcd_1629267205215_19292/FeatureServer/0?f=json) · [WFS](https://portal.csdi.gov.hk/server/services/common/lcsd_rcd_1629267205215_19292/MapServer/WFSServer?service=wfs&request=GetCapabilities) |
| Dog Gardens/Pet Gardens | `PETG_20261025_gdb_PETG_converted.geojson`，2026-10-25 | 2026-10-13 | [DATA.GOV.HK](https://data.gov.hk/en-data/dataset/hk-lcsd-facility-facility-dgpg/resource/01b61fcb-14ff-415b-bf8c-750dd914f46f) · [元數據](https://portal.csdi.gov.hk/csdi-webpage/metadata/lcsd_rcd_1670384486075_71092/html) · [GeoJSON](https://portal.csdi.gov.hk/csdi-webpage/file-api?dataset_id=lcsd_rcd_1670384486075_71092&format=geojson&layer_name=PETG) · [REST](https://portal.csdi.gov.hk/server/rest/services/common/lcsd_rcd_1670384486075_71092/FeatureServer/0?f=json) |
| Inclusive Park for Pets | `IPPET_20261025_gdb_IPPET_converted.geojson`，2026-10-25 | 2026-10-08 | [DATA.GOV.HK](https://data.gov.hk/en-data/dataset/hk-lcsd-facility-facility-ipfp/resource/80181428-41e5-42a4-9d3c-6681be89d0fb) · [元數據](https://portal.csdi.gov.hk/csdi-webpage/metadata/lcsd_rcd_1670384557490_22821/html) · [GeoJSON](https://portal.csdi.gov.hk/csdi-webpage/file-api?dataset_id=lcsd_rcd_1670384557490_22821&format=geojson&layer_name=IPPET) · [REST](https://portal.csdi.gov.hk/server/rest/services/common/lcsd_rcd_1670384557490_22821/FeatureServer/0?f=json) |

香港時間約 18:39 取得 `PARKS`，約 18:42 取得 `PETG` 及 `IPPET`。資料快照日期、元數據修訂日期、記錄的 `LASTUPDATE` 及本地取得時間應分開保存。下列 SHA-256 為 File API 原始回應校驗值。

| 圖層 | 位元組 | SHA-256 |
| --- | ---: | --- |
| `PARKS` | 170060 | `6666b7785fa1c6ca7cb003cb932c6155e0befc1885c1b05e8f01c3df05fdc7df` |
| `PETG` | 81512 | `606576cff58d89dfdca94eeba2f9cb1c733627243fa745995cbfefd673b19f43` |
| `IPPET` | 246828 | `d274caa71cc7ac2181012f57a83029e77617819ce02658ae028daa8046c549e1` |

## 3. 空間檔資料品質

| 項目 | `PARKS` | `PETG` | `IPPET` |
| --- | ---: | ---: | ---: |
| GeoJSON 原始筆數／REST 計數 | 124／124 | 55／55 | 181／181 |
| 有效且在香港範圍內的場地點 | 124 | 55 | 181 |
| 同一筆具繁中及英文名稱 | 124 | 55 | 181 |
| 缺地址（繁中／英文） | 0／0 | 0／0 | 0／0 |
| 缺開放時間（繁中／英文） | 38／38 | 0／0 | 1／1 |
| 缺設施詳情（繁中／英文） | 28／28 | 0／0 | 1／1 |
| 有唯一快照內 `OBJECTID` | 124 | 55 | 181 |
| 可證實跨版本不變的官方設施 ID | 0 | 0 | 0 |
| 圖層內重複座標／重複名稱組 | 0／1 | 0／0 | 0／0 |
| 名稱明示指定範圍或例外 | 0 | 0 | 41 |
| 共享場地名稱未標明範圍 | 不適用 | 不適用 | 140 |
| 可證實的寵物區邊界／入口點 | 不適用 | 0／0 | 0／0 |

缺值統計將空字串、`null` 及 `N.A.` 等無資料值列為缺失。三個圖層均有同筆雙語地區欄，`PARKS` 有 19 個原始繁中地區字串，其中包括「粉嶺」兩筆。保留原文，不由此推定行政區覆蓋。其餘兩層各有 18 個原始地區字串。

- 名稱、地址、地區、類型、開放時間、詳情和網站為 `NameTC/EN`、`AddressTC/EN`、`DistrictTC/EN`、`FacilityTypeTC/EN`、`OpeningHoursTC/EN`、`FacilityDetailsTC/EN`、`WebsiteTC/EN` 等字串欄。部分詳情及時間含 HTML 換行或附帶公告。導入時轉安全純文字並保留時段和公告內容。`LASTUPDATE` 為 14 位字串，三層最早／最晚列日期分別為 2009-07-16／2026-10-15、2022-05-25／2026-10-13、2022-05-25／2026-10-08。
- 原生 ArcGIS 空間參考為舊代碼 102140、現行 EPSG:2326（HK1980 Grid）。原生 `EASTING/NORTHING` 為公尺。GeoJSON 是十進位 `[longitude, latitude]`，檔案未帶 `crs`。逐筆按圖層及 `OBJECTID` 比對官方 REST 的 EPSG:4326 輸出，最大差小於 0.01 毫米。數值型 `LONGITUDE/LATITUDE` 屬性與 GeoJSON 幾何最大差小於 0.07 公尺。此處比較的是官方輸出的一致性，實地精度與入口位置仍需另有證據。後續可直接採用已核對的 GeoJSON 幾何，傳給 MapKit 時明確映射為 `latitude` 與 `longitude`。
- 用繁中、英文暫停或關閉關鍵詞檢查時間和詳情，命中 `PARKS` 5 筆、`PETG` 0 筆、`IPPET` 2 筆。這是公告內容檢視，沒有即時狀態欄。例如車公廟路遊樂場的提醒只涉及一號門球場，石硤尾公園的提醒只涉及第二期部分範圍。保留涉及範圍與時段，避免把局部維修標成整個場地關閉。調景嶺花園的共享公園時間兩語皆缺。
- `PARKS` **49 筆**同時有獨立欄值 `PARK` 和 `公園`，包括名稱明確為動植物公園、但類型仍標 `PARK` 的香港動植物公園。將該筆獨立排除後為 **48 筆**，其中 17 筆有雙語開放時間、31 筆缺。另 75 筆無這組類型，包含海濱花園、休憩處和帶寵物分類的記錄。例外如啟德大道公園在檔內列的是球場及健身設備。官方公園網頁另列維多利亞公園及中山紀念公園，而本次 `PARKS` 檔未見這兩個正式名稱。首版應標示康文署開放資料的實際覆蓋。 [康文署公園場地列表](https://www.lcsd.gov.hk/en/facilities/facilitieslist/parks.html)
- `PARKS` 的兩筆灣仔峽公園，快照 ID 91／98，點距約 16 公尺。ID 91 含 `PARK` 及兩種寵物設施類型，ID 98 列共融遊樂等設施。兩筆各自留作原始證據，首輪公園篩選只會取 ID 91。`PETG` 54 筆標 `PET GARDEN`，東涌小炮台公園第 1 區一筆標 `DOG GARDENS/PET GARDENS`，兩種欄值均屬該圖層的專用分類。

| 實測例 | 快照內身份 | 官方場地參考點（經度、緯度） |
| --- | --- | --- |
| 香港公園／Hong Kong Park | `PARKS/122` | `114.1613882592, 22.2773076528` |
| 蝴蝶谷道寵物公園／Butterfly Valley Road Pet Garden | `PETG/34` | `114.1439790166, 22.3395900530` |
| 中山紀念公園（指定位置）／Sun Yat Sen Memorial Park (Designated Areas) | `IPPET/125` | `114.1455324731, 22.2904503603` |

### 快照身份核驗

三個圖層均未見可驗證為跨版本固定的官方場地 ID。ArcGIS 宣告 `objectIdField=OBJECTID`，`globalIdField` 為空。從 CSDI 歷史清單下載 2026 年第二、三季 GeoJSON，依圖層內唯一的正規化繁中名稱與地區配對，只計名稱／地區相同且雙邊唯一的記錄。

| 圖層 | 第二季檔筆數 | 第二季對現檔改號／可配對 | 第三季檔筆數 | 第三季對現檔改號／可配對 |
| --- | ---: | ---: | ---: | ---: |
| `PARKS` | 122 | 117／118 | 123 | 121／121 |
| `PETG` | 51 | 51／51 | 53 | 53／53 |
| `IPPET` | 181 | 148／181 | 181 | 4／181 |

例如海輝道海濱花園 ID 由第二季 31、第三季 6 變為現檔 1。存檔時須同時保留來源、圖層、快照和上游 ID。名單序號也隨版本與排序變動。 [公園歷史檔](https://portal.csdi.gov.hk/csdi-webpage/archivedDatasetFileListPage/lcsd_rcd_1629267205215_19292) · [專用公園歷史檔](https://portal.csdi.gov.hk/csdi-webpage/archivedDatasetFileListPage/lcsd_rcd_1670384486075_71092) · [共享公園歷史檔](https://portal.csdi.gov.hk/csdi-webpage/archivedDatasetFileListPage/lcsd_rcd_1670384557490_22821)

## 4. 寵物名單、規則與入口

康文署 CLPSS 四個全區頁面原始 HTML 均回應 HTTP 200，同頁涵蓋 18 區。頁尾繁中和英文均顯示修訂日期 2026-11-17，這只作頁面日期。有名字的場地表逐一計數如下。官方資料中附帶的地圖識別碼與 HTML 元素 ID 用於同快照雙語核對，兩者均未確認為長期場地 ID。

| 名單 | 原始場地（繁中／英文） | 缺地址（繁中／英文） | 缺時間（繁中／英文） | `op_…` 有值（繁中／英文） | 有 GeoInfo Map ID（每語） | 可用同一 ID 或地圖碼配對 | 頁面直接提供數值座標 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| [狗公園／寵物公園 TC](https://www.lcsd.gov.hk/clpss/tc/webApp/Facility/Details.do?ftid=47) · [EN](https://www.lcsd.gov.hk/clpss/en/webApp/Facility/Details.do?ftid=47) | 60／60 | 0／0 | 0／0 | 60／60 | 56 | 60 | 0 |
| [寵物共享公園 TC](https://www.lcsd.gov.hk/clpss/tc/webApp/Facility/Details.do?ftid=165) · [EN](https://www.lcsd.gov.hk/clpss/en/webApp/Facility/Details.do?ftid=165) | 192／192 | 0／0 | 7／6 | 185／186 | 180 | 190 | 0 |

- 以地區及唯一名稱配對 CSDI 與 CLPSS，先統一全半形、大小寫、空格標點和地區字尾。共有身份證據的雙語名稱完全匹配為專用 **47**、共享 **165**。若僅在比對鍵移除指定範圍括註，共享雙語候選增至 **170**，其中 41 筆由至少一份匹配名稱標明範圍。這是關聯候選，原名與限制照原文保存。
- 專用 CSDI 有 8 筆未按上述鍵對上，CLPSS 有 13 筆未對上。例如官網「民康街寵物公園」與 CSDI「民康街遊樂場」需要地址及位置佐證。官網的「大埔海濱公園（近大發街公園入口）」備註指向大發街獨立門口。一般公園點或共享公園點均不足以替代此入口。專用網頁有 12 筆「其他」欄。蝴蝶谷道寵物公園有 CSDI 和雙語名單兩方證據，可用來核對專用分類與場地點。
- 共享 CSDI 有 9 筆、CLPSS 有 20 筆未按上述繁中鍵完全對上。即使中文可對上，仍有英文別名或缺乏可配對身份的情況。「將軍澳南公園（指定位置）」和「建灣街花園（指定位置）」都有看似對應的英文記錄，兩頁未提供可用於自動配對的共同 ID。CLPSS 的獅子山公園列明棒球場、射箭場及社區園圃等例外，CSDI 名稱只標「指定位置」。上線前應採經核實的較具體限制，保留來源與日期。
- 康文署官網的地圖連結使用 `showPopupAdvancedMap(gmid, lang)`，其官方腳本指向 GeoInfo Map。抽查加多近街花園的公開地圖連結成功回應，取得的是地圖網頁，未從該頁確認寵物區的邊界或入口座標。專用和共享加多近街花園有不同的地圖碼，CSDI 兩點約相距 57 公尺，應保留兩種場地身份。 [官方地圖連結定義](https://www.map.gov.hk/static/gihs_interface.js) · [場地示例](https://www.map.gov.hk/gm/gmid/BD1t0Q26uQ?lg=en)
- 規則頁繁中、英文均於 2025-11-27 修訂。共享公園的狗隻無論大小均須牽繩，並須妥善管束、清理排泄物。專用指場地用途，個別入口、設施及使用安排以證據標示。單靠專用分類無法判定每一場地的除繩規則。 [康文署共享公園守則 TC](https://www2.lcsd.gov.hk/tc/facilities/otherinfo/petpark.html) · [EN](https://www.lcsd.gov.hk/en/facilities/otherinfo/petpark.html)
- 規則頁連結的 14 頁雙語 PDF 附表有 **194 個場地序號，45 個以星號標示指定位置**，沒有數值座標。CLPSS 名稱／例外明示限制有 47 筆，CSDI 為 41 筆。以唯一基礎中文名比對，附表另標星號的 CSDI 候選包括堅巷花園、茶果嶺海濱公園。另有「將軍澳南公園」在附表無星號而 CLPSS 明列指定位置。沒有括註或星號只能記為範圍未核實。附表序號、海濱井號及指定位置星號不能互換作身份。 [康文署雙語場地附表](https://www.lcsd.gov.hk/en/common/pdf/Annex_IPP_Venue.pdf)

### 其他官方機器可讀資源

| 資源 | 實測資料品質 | 採用判斷 |
| --- | --- | --- |
| [專用 JSON](https://www.lcsd.gov.hk/datagovhk/facility/facility-dgpg.json) | 61 筆雙語名稱，兩語地址各缺 1 筆、時間各缺 0 筆。60 筆通過嚴格 WGS84 度分秒及香港範圍校驗。牛池灣公園的緯度 `22-33-63` 秒值超界。60 筆有效點有兩組同座標。56 筆有 GIHS 地圖碼，其中 55 個不同，大窩口道遊樂場重複同碼。 | DATA.GOV.HK 顯示更新 2025-08-15；用於查找可能的名稱、地址和備註。資料字典只把 GIHS 定義為地圖識別碼。點位及重複差異應逐筆核實。 [資源登記](https://data.gov.hk/en-data/dataset/hk-lcsd-facility-facility-dgpg/resource/b0331fb4-f6ea-48c4-9c98-ededf0f25d7f) · [資料字典](https://www.lcsd.gov.hk/datagovhk/facility/facility-dgpg_data_dictionary.pdf) |
| [共享 JSON](https://www.lcsd.gov.hk/datagovhk/facility/facility-ipfp.json) | 115 筆 CRS84 點，均有雙語名稱、地址及實際回傳的時段文字，沒有重複點和可用官方設施 ID。內部 `LASTUPDATE` 最晚為 2022-06-22。實際時間出現在 `NSEARCH01`，較舊資料字典卻將該欄列作詳情。 | DATA.GOV.HK 顯示更新 2022-10-21。覆蓋明顯較少且文件與回應有欄位差異，優先採用較新的 `IPPET`。 [資源登記](https://data.gov.hk/en-data/dataset/hk-lcsd-facility-facility-ipfp/resource/003a9cfb-6393-4995-a3e0-810f8186ecf0) · [資料字典](https://www.lcsd.gov.hk/datagovhk/facility/facility-ipfp_data_dictionary.pdf) |

## 5. 公園和寵物場地關聯

以下為空間檔的候選對數。名稱配對用同區的繁中基礎名，再檢查英文基礎名一致。僅為比對而移除指定範圍括註。25 公尺用於找人工複核候選，距離為官方點的球面直線距離。

| 配對來源 | 同區同繁中名 | 同時同英文名 | 所有 25 公尺內候選 | 同區同名且 25 公尺內 | 完全同座標 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 全 `PARKS` × `PETG` | 10 | 9 | 7 | 5 | 0 |
| 全 `PARKS` × `IPPET` | 60 | 59 | 41 | 41 | 2 |
| 48 筆一般公園 × `PETG` | 3 | 3 | 1 | 1 | 0 |
| 48 筆一般公園 × `IPPET` | 14 | 14 | 6 | 6 | 0 |
| `PETG` × `IPPET` | 11 | 10 | 4 | 4 | 0 |

大埔海濱公園的一般公園與共享點相距約 141 公尺，鰂魚涌公園相距約 524 公尺。即使兩來源同名或同座標，也無法由此確定共用入口或同一範圍。保留各筆身份。要在一般公園下顯示寵物相關標籤，須以官方類型、場地明細及適用範圍核實關聯，另存關聯及其證據。一般公園分類本身不產生寵物權限。

## 6. 相容方案與上線門檻

已檢查現有 `facilities.ts`、附近頁、MapKit 元件、搜尋、外部導航，以及 FEHD／AFCD 的建置腳本。現有 `Facility.category` 已有 `parks` 和 `pets`，`facilityId` 使用 `source + officialId`。附近列表、搜尋、選中預覽及 100 節點聚合可由相同的標準化索引供應。現有導航直接接收設施官方點。公園可附加位置語義與提示。FEHD 960 筆和 AFCD 167 筆沿用現有索引、身份及服務公告。

1. **身份**。擬為三個來源分設 `lcsd-parks`、`lcsd-pet-gardens`、`lcsd-inclusive-parks`。用固定的來源內對照表分配本地持久鍵，填入現有 `officialId` 欄，同時用來源資料標記其為本地鍵。保留上游 `OBJECTID`、圖層及快照版本以供追查。下一次更新比對名稱、地址、地區、點位和可用官方連結；歧義及大幅位移暫停更新該筆。單一名稱、陣列順序、座標或本期 ID 均不足以當作自動重建鍵。
2. **類型、規則與點位**。為 `park`、`dedicated_pet_garden`、`inclusive_park_for_pets` 保留獨立類型，另以 `designated_area_only` 記錄經核實的適用範圍。範圍不明及來源衝突各自保留待核狀態。每個規則附上來源、核實日期及兩語原名或對應原文。場地座標只表示官方參考位置；指定寵物區邊界與入口座標用各自的證據欄。只有場地參考點的項目可在明確標示下顯示直線距離。精確入口導航須先核到官方入口。當場地自身身份或座標也無法核實時，暫不納入既有地圖、距離或導航索引，避免借一般公園點補位。
3. **雙語及更新**。優先用同筆 CSDI 雙語資料，補充名單只在確認同一場地和範圍後採用。缺語文可顯示可用官方原文。處理臨時服務安排及場地時間時保留涵蓋範圍，空值顯示「未提供」或省略。每次導入保存來源 URL、條款、快照、取得時間、記錄時間及校驗值。先驗證版本、筆數、圖層、CRS、欄位和身份，再以原子方式更換靜態檔。下載或校驗失敗保留上次有效檔。
4. **順序**。先用符合審計篩選的 48 筆接入 UI-04C1 公園地圖、列表、搜尋與場地參考點導航，人工驗收後再做 UI-04C2。後者先處理明確專用及共享身份、點位和限制的記錄。指定範圍缺入口時可提供官方場地指引，僅在語義清楚且無衝突時顯示場地參考點。需要精確導航的指定區域、較新名單缺定位的場地、相互矛盾的規則，留待部門資料或人工核實。

## 7. 使用條款及署名

- **CSDI 空間檔**。平台條款允許在履行條款下免費作商業和非商業用途，包括下載、複製和分發。須清楚標明香港特別行政區政府及 CSDI Portal 為來源，承認政府和相關機構的知識產權，以及遵守條款內的彌償及免責條文。App 的 Info 及再分發的索引文件宜列「香港特別行政區政府、康樂及文化事務署與空間數據共享平台（CSDI Portal）」、資料集、快照日期和條款。 [CSDI 使用條款](https://portal.csdi.gov.hk/csdi-webpage/doc/TNC)
- **DATA.GOV.HK Open Data**。平台條款亦在所列條件下准許商業和非商業使用，另要求對政府、相關機構和 DATA.GOV.HK 作適當署名。對部門網站連結仍須核對該站及相關資料的適用條款。 [DATA.GOV.HK 條款](https://data.gov.hk/en/terms-and-conditions)
- **康文署官網、附表及圖像**。官網版權告示要求事先書面授權才可複製、改編或再發布該站的版權作品。使用 CSDI 開放欄位作正式資料，場地名單及規則頁作核驗及官方連結；如需打包官網內容、原圖、官方地圖截圖或 PDF，先確認相應授權。保留 Apple Maps 本身的署名。本次只把官方文件下載到臨時目錄作核對，沒有把照片或地圖素材加入 App。 [康文署重要告示](https://www.lcsd.gov.hk/en/notice.html)

## 8. 交付狀態

本輪只新增本審計文件。原有兩份審核規範及四張設計圖在開工時已屬未跟蹤檔，予以保留。核對包括官方全量下載與計數、逐筆座標交叉比對、兩期歷史身份對照、雙語網頁配對及規則交叉核實。工作分支維持 `develop`，HEAD 未變動。App 源碼、公廁索引、依賴與資料庫未修改。
