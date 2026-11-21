# UX-02B0 港鐵／輕鐵官方資料與交通架構審計

審計日期為 2026-11-21（香港時間）。證據來自已提交程式碼、官方文件、下載檔案及公開 GET。架構和准入門檻是後續階段的建議。

## 結論與 Git 基線

| 範圍 | 建議 |
| --- | --- |
| 重鐵靜態線路、車站和搜尋 | **技術 GO，先做 UX-02B1**。十綫有可用資料。處理共站、分支及馬場資料缺口，公開分發前確認適用條款。 |
| 輕鐵靜態常規線、站序和搜尋 | **技術 GO，待 UX-02B3**。68 個 ID 可與即時字典對照，特別班次另行處理。 |
| 重鐵與輕鐵即時預報 | **技術 GO，公開啟用有條件**。兩端點均有成功的真實預報。核對供應商授權、存取頻率及日誌後啟用。 |
| 兩種鐵路的附近排序 | **NO-GO，待座標對照**。重鐵取得官方站域樣本；兩個模式均欠按營辦商 ID 審核的座標映射。可先做離線搜尋和手動選站。 |
| 路線幾何及收藏 | 幾何尚待來源與再分發許可。首版可交付站序和官方連結，鐵路收藏延後。 |

開工時 `develop` 工作區乾淨，HEAD 與本機追蹤的 `origin/develop` 均為 `9ee44fd985daaf4135695828b745b53a0388ac07`（`feat(transport): refine nearby distance presets`）。本輪核對本機追蹤 ref。**實際提交仍使用 500／1000／2000 米、預設 500 米**，可見於 `src/app/bus/nearby.tsx` 及 `src/nearby-bus-data.ts`，定位定向套件仍為 22 項。任務背景所述的 300／500／800／1500 米未出現在此 Git 基線。進入附近整合前請開發者確認 UX-02A6 的提交範圍。

## 1. 港鐵來源與靜態完整性

| 官方資源 | 核驗 |
| --- | --- |
| [重鐵線路及車站資源](https://data.gov.hk/en-data/dataset/mtr-data-routes-fares-barrier-free-facilities/resource/8daba4fe-b879-4a51-8962-27b4cffdc61c) 和 [CSV](https://opendata.mtr.com.hk/data/mtr_lines_and_stations.csv) | 線、站碼、數值站 ID、雙語名、方向、站序。入口標示每月更新、最後更新 2023-06-25；下載 HTTP Last-Modified 為 2023-11-21 GMT。 |
| [靜態資料字典 ZIP](https://opendata.mtr.com.hk/doc/DataDictionary.zip) 和 [港鐵系統／站圖](https://www.mtr.com.hk/en/customer/services/system_map.html) | ZIP 內重鐵字典仍列舊 `MOL`、漏列 `SIL`。以實際 CSV、現役系統圖和即時字典校對。 |
| [重鐵即時資料](https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data)、[API v1.7](https://opendata.mtr.com.hk/doc/Next_Train_API_Spec_v1.7.pdf)、[字典 v1.7](https://opendata.mtr.com.hk/doc/Next_Train_DataDictionary_v1.7.pdf) | 十綫，資料標示每 10 秒更新。規格列出有效線／站組合。 |
| [運輸署鐵路網絡](https://www.td.gov.hk/en/transport_in_hong_kong/public_transport/railways/) 和 [馬場站服務時間](https://www.mtr.com.hk/en/customer/services/service_hours_search.php?query_type=search&station=70) | 確認九條本地重鐵綫、機場快綫及高鐵 XRL 的範圍；馬場按特別安排運作。 |

CSV 為 UTF-8 BOM，14,161 bytes，SHA-256 `e0e781152e2e6c5f6d7763262acbae76577b71ca4c66b4b7b72a97252175e0c3`。273 筆中有 3 個全空尾列；270 筆有效雙語站序包含 24 個線路／方向圖式、120 組線／站碼、100 個數值站 ID、97 個站碼。各圖式內站序和站 ID 均無重複。欄位為 `Line Code, Direction, Station Code, Station ID, Chinese Name, English Name, Sequence`，無座標。讀取時保留 UTF-8 及官方雙語字元，按字典核對香港增補字元編碼。

| 綫 | CSV 唯一站碼 | 即時 UP 常見終點 | 即時 DOWN 常見終點 |
| --- | ---: | --- | --- |
| AEL 機場快綫 | 5 | AIR／AWE | HOK |
| TCL 東涌綫 | 8 | TUC | HOK |
| TML 屯馬綫 | 27 | TUM | WKS |
| TKL 將軍澳綫 | 8 | POA／LHP | TIK／NOP |
| EAL 東鐵綫 | 15 | LOW／LMC、短途或經 RAC | ADM、短途 |
| SIL 南港島綫 | 5 | SOH | ADM |
| TWL 荃灣綫 | 16 | TSW | CEN |
| ISL 港島綫 | 17 | CHW | KET |
| KTL 觀塘綫 | 17 | TIK | WHA |
| DRL 迪士尼綫 | 2 | SUN | DIS |

- 靜態 `UT/DT` 另有 `LMC-UT/DT` 及 `TKS-UT/DT`。東鐵 LOW/LMC 各雙向 14 項，TKL 主段雙向各 7 項及 TIK–LHP 支段各 3 項。每班目的地以 `dest` 解析；TKO 的同一即時方向可有兩種終點。羅湖及落馬洲各自是東鐵終點，勿合併跨境通關或高鐵服務。 [重鐵規格](https://opendata.mtr.com.hk/doc/Next_Train_API_Spec_v1.7.pdf)
- AEL 和 TCL 共用 `HOK/KOW/TSY`，但數值 ID 分別為 44／39、45／40、46／42；官方系統圖為每對提供同一站圖。金鐘 `ADM` 在 EAL、ISL、SIL、TWL 共用 ID 2。保留獨立線／站服務身份，轉乘用經核實的邊或站域分組。中環 `CEN` 與香港 `HOK`、尖沙咀 `TST` 與尖東 `ETS` 保持不同記錄。 [港鐵系統與站圖](https://www.mtr.com.hk/en/customer/services/system_map.html)
- **馬場 `RAC`** 在 CSV 缺席，v1.7 即時字典和官方站圖列有該站。本輪官方 `EAL/RAC` 回傳正常空清單。B1 可用官方資料補入明確標明來源的搜尋項，支線停站序及特別服務另核對。 [即時字典](https://opendata.mtr.com.hk/doc/Next_Train_DataDictionary_v1.7.pdf) [馬場站時間](https://www.mtr.com.hk/en/customer/services/service_hours_search.php?query_type=search&station=70)

## 2. 輕鐵來源與靜態完整性

| 官方資源 | 核驗 |
| --- | --- |
| [輕鐵路綫和站點資源](https://data.gov.hk/en-data/dataset/mtr-data-routes-fares-barrier-free-facilities/resource/d0662909-9919-4f01-b4f9-eccc4b2acbb5) 和 [CSV](https://opendata.mtr.com.hk/data/light_rail_routes_and_stops.csv) | 每月更新，最後更新 2026-07-05。下載的 Last-Modified 為 2026-07-04 16:58:02 GMT，即香港 7 月 5 日。 |
| [靜態資料字典](https://opendata.mtr.com.hk/doc/DataDictionary.zip) 和 [港鐵輕鐵時間表](https://www.mtr.com.hk/ch/customer/services/schedule_index.html) | CSV 結構、常規路綫及特別服務；特別班次可受學校假期影響。 |
| [輕鐵即時資料](https://data.gov.hk/en-data/dataset/mtr-lrnt_data-light-rail-nexttrain-data)、[API v1.1](https://opendata.mtr.com.hk/doc/LR_Next_Train_API_Spec_v1.1.pdf)、[字典 v1.2](https://opendata.mtr.com.hk/doc/LR_Next_Train_DataDictionary_v1.2.pdf) | 資料標示每 10 秒更新。v1.2 記錄改名，附站 ID、月台和預報欄位。 |

CSV 為 UTF-8 BOM，14,204 bytes，SHA-256 `f2fec60de38b72f38d3478fcdeecea4e3332b300b73c23bf41b22d412a2c2066`。382 筆有效雙語站序、68 個唯一 `Stop ID`，與即時字典 v1.2 附錄完全相符。11 條常規路綫為 **505、507、610、614、614P、615、615P、705、706、751、761P**，共 22 個路綫／方向圖式。`Line Code, Direction, Stop Code, Stop ID, Chinese Name, English Name, Sequence` 沒有座標或月台欄位。

- **海皇路**自 2026-07-05 取代屯門泳池。CSV 與 v1.2 的數值 ID 仍為 `250`，CSV 站碼 `TSP`。舊名可作搜尋別名；畫面用 `海皇路 / Hoi Wong Road`。 [改名公告與釋出](https://data.gov.hk/en-data/dataset/mtr-lrnt_data-light-rail-nexttrain-data)
- 705／706 用 `TSL` 與 `TWI` 分成相接的兩段循環，保留來源分段與方向 1／2。507-2 重複 Tin King（140），751-1 和 761P-2 重複 Tin Yat（550），方向 505 亦非反序。以 `routeNo + directionLiteral + sequence` 識別一次停靠。保留重複站序，勿用去重後的站清單重建路綫。常規 CSV 無完整特別車、短途或改綫的站序。 [輕鐵 CSV](https://opendata.mtr.com.hk/data/light_rail_routes_and_stops.csv) [輕鐵時間表](https://www.mtr.com.hk/ch/customer/services/schedule_index.html)

## 3. 官方座標候選與軌跡

| 來源 | 核驗與限制 |
| --- | --- |
| 港鐵兩份 CSV | 無座標。可用於靜態搜尋及站序。 |
| [地政總署 3D Indoor MTR Station Map API](https://static.csdi.gov.hk/csdi-webpage/apidoc/3d-indoor-mtr-station-map) | 官方單站 WFS 樣本 HTTP 200，`venue_id=d47477e8-81bb-4400-943a-e2541261bf4b` 為宋皇臺。`crs=EPSG:4326`，多邊形頂點樣本為 lon 114.19030123、lat 22.32537068。這是站域的**頂點**，用途與站入口或月台不同。營辦商 CSV 為 `TML/SUW`、ID 92；WFS 無此代碼。外層 bbox 的軸序和幾何頂點不同，須按實際欄位驗證。全面列表下載觸及本輪 1.5 MB 下載上限，未計全站覆蓋。 |
| [地政總署 iGeoCom](https://www.landsd.gov.hk/en/survey-mapping/mapping/other-products/iGeoCom.html) 和 [GeoJSON 資源](https://data.gov.hk/en-data/dataset/hk-landsd-openmap-development-hkms-digital-geocom/resource/2d7f57de-1b8e-4aa0-b6d8-c8a324fe22cb) | 官方描述含鐵路出入口，資源標示季度、2026-09-04。本環境直下載 TLS 發行者驗證失敗，未確認座標系、輕鐵覆蓋或營辦商 ID 欄位。可從官方渠道再取可驗證檔案。 |
| [地政總署 iB5000](https://data.gov.hk/en-data/dataset/hk-landsd-openmap-development-hkms-digital-b5k) | 另有 [GML 要素規格](https://www.landsd.gov.hk/doc/en/mapping/digital-map/common/feature/ib5_gml_mf.pdf) 列出地形圖分類 `RSN`（鐵路站）及 `LRA`（輕鐵站），資料原生採香港 1980 方格網。可優先取得小範圍樣本查驗點位和欄位。尚未驗到站點記錄、營辦商 ID、覆蓋及可再分發條款。 [座標系和下載說明](https://www.landsd.gov.hk/en/survey-mapping/mapping/multi-scale-topographic-mapping/digital-map.html) |
| [運輸署 GTFS](https://data.gov.hk/en-data/dataset/hk-td-tis_11-pt-headway-en) 和 [規格](https://static.data.gov.hk/td/pt-headway-en/dataspec/ptheadway_dataspec.pdf) | 查驗 2026-11-19 版本英語 ZIP 的 `agency.txt` 和 `routes.txt`。下載為 13,774,300 bytes，SHA-256 `b5161970654452fc133b6e3a949c68218c77c8d7505d279ede2e936ddf3ec0f6`。`LRTFeeder` 的 32 條為類型 3 巴士。兩種目標鐵路模式均缺席，ZIP 無 `shapes.txt`。規格有 WGS84 欄位，但不能用其巴士或電車資料當鐵路座標及線形。 |

附近排序的前置為可重現的「官方空間記錄 → 經審核交叉表 → 營辦商站 ID」。用官方站圖、位置及身份交叉核對，保留來源 ID、日期、CRS 和點位語義。GeoJSON 幾何按已核對的 `[lon, lat]` 解析；若後續取得 HK1980 Grid，在 CRS 明確後按官方轉換並測試。可用站域代表點做局部附近排序，標明「直線距離」及站域語義；站口步行距離及月台位置須另查。輕鐵月台應先沿用即時 `platform_id`，座標用核實的站點代表位置。

本輪未驗到可隨 App 使用且可匹配線路／支線的官方鐵路軌跡。B5 可採用站序或官方圖連結，授權和座標完成後再顯示站點圖。系統示意圖、法定圖則和站點間連線不作實際行車折線。 [重鐵系統圖](https://www.mtr.com.hk/en/customer/services/system_map.html) [輕鐵路綫圖](https://www.mtr.com.hk/archive/ch/services/LR_routemap.pdf)


## 4. 即時接口及實測

### 重鐵

GET `https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php`。`line` 和 `sta` 為必填且須符合 v1.7 線／站矩陣。`lang=EN|TC` 可選，用於供應商訊息。以 `data["LINE-STA"].UP/DOWN` 讀取單一線站的各方向預報，方向是線內約定，不能用全港一致的地理朝向或用英文站名推斷。`dest` 是終點站碼，`plat` 為月台字串，允許 `1/3`。`seq` 是方向內的預報次序（最多四班）。`time` 為供應商的預測到達／開出時間。東鐵部分站有到站／開出標記（字典用 `timetype`，實測為 `timeType`，值為 `A|D`），`route=RAC` 表示經馬場而非火炭；未有足夠訊號時，文案使用「預計時間」。v1.7 字典將 `ttnt`、`valid`、`source` 定義為佔位欄位，倒數、取消或資料可信狀態均不用這些欄位推算。`curr_time` 與 `sys_time` 分開處理，並容許字典中的 `-`。

`status=0` 可能是參數錯誤、沒有服務或供應商狀況，先解析 `message`、`url` 和錯誤碼。`isdelay` 或經校驗的供應商訊息可提示服務受影響。文件提及尾班車開出後方向陣列可為空，也載有東鐵暫停服務例子。一般空陣列沒有足夠證據判斷尾班、停駛或非營運時間。現行接口未證實有可靠的逐班取消、尾班或實際到站標記。高鐵及上述十綫以外的服務沒有已核實的預報覆蓋。 [重鐵規格與回應例子](https://opendata.mtr.com.hk/doc/Next_Train_API_Spec_v1.7.pdf) [重鐵欄位字典](https://opendata.mtr.com.hk/doc/Next_Train_DataDictionary_v1.7.pdf)

### 輕鐵

GET `https://rt.data.gov.hk/v1/transport/mtr/lrt/getSchedule`，`station_id` 為 v1.2 附錄所列站 ID，`with_special` 可選，`0` 為預設，`1` 要求包括特別班次。成功讀取 `system_time` 和 `platform_list[]`，以每個 `platform_id` 屬下的 `route_list[]` 取得路綫與班次。`arrival_departure=A|D` 區分到站／開出；`dest_ch`、`dest_en` 為終點，`route_no` 為號碼，`train_length` 為車卡數，`stop` 是文件所述的停駛指示。實測只見 `stop=0`，應在 B4 驗證非零值及範圍。`time_en`／`time_ch` 可能是分鐘文本、即將到站／開出文字，或 `-`。僅解析規格和樣本支持的數字格式，保留開出／到站語義，`-` 不轉成零。先保留同月台的來源次序，切勿用路綫號碼去重。可跨月台顯示分組；有可靠可比較的時間才合併排序。

`special=1` 的顯示路綫須看 `additionalInfo1`；依文件處理 `901/902` 內部碼、`SPR` 及 `routeRemarkEng2`／`routeRemarkChi2`，特別班次不強配常規站序。遇特殊或未識別值，保留可核實的備註和月台資訊。`status=0`、沒有 `platform_list`、空月台或空班次分開處理。沒看見列車不能確定停駛或已過尾班。輕鐵的月台、目的地和班次狀態均由同一回應決定，沒有重鐵的 UP／DOWN 模型。 [輕鐵規格](https://opendata.mtr.com.hk/doc/LR_Next_Train_API_Spec_v1.1.pdf) [輕鐵欄位與站 ID](https://opendata.mtr.com.hk/doc/LR_Next_Train_DataDictionary_v1.2.pdf)

### 公開 GET 樣本

2026-11-21 香港時間。時間欄取 HTTP Date，香港時間換算後呈現。快取秒數另列，狀態欄為 HTTP／JSON `status`。查詢只使用公開的線站識別碼。

| 時間 | 端點參數 | 狀態 | 實際摘要 |
| --- | --- | --- | --- |
| 16:53:03 | 重鐵 `line=TKL&sta=TKO` | 200／1 | 每方向四班。UP 月台 1，終點 POA／LHP；DOWN 月台 2，終點 TIK／NOP。`curr_time` 16:52:53、`sys_time` 16:53:00。 |
| 16:54:28 | 重鐵 `line=AEL&sta=AIR` | 200／1 | 每方向四班，終點 AWE 或 HOK，月台為 `1/3` 及 `2/4`。`sys_time` 16:54:23，HTTP `Age: 9`。 |
| 16:54:37 | 重鐵 `line=EAL&sta=ADM&lang=TC` | 200／1 | 四班 UP，先後有 LOW 與 LMC，前兩班月台 7，`timeType=D`。樣本沒有 DOWN，符合金鐘終點。 |
| 16:54:37 | 重鐵 `line=AEL&sta=ADM` | 200／0 | `NT-204`，無班次。兩個代碼各自有效但組合無效。 |
| 16:54:37 | 輕鐵 `station_id=250` | 200／1 | 海皇路，`system_time` 16:54:38，月台 1／2 分別五／四班，有 507、614、614P；時間包括 `2 mins` 和 `-`。 |
| 16:54:38 | 輕鐵 `station_id=920&with_special=1` | 200／1 | 月台 1 的兩班 505 為 `D`，`Departing` 和 `9 mins`。此次沒有特別車。 |
| 16:54:38 | 輕鐵 `station_id=9999` | 200／0 | 有 `system_time`，沒有月台清單。 |
| 16:57:19 | 重鐵 `line=EAL&sta=RAC` | 200／1 | 服務接受該線站組合，兩個方向皆空，`curr_time` 16:57:17。 |

最初 Python TLS 探測在 HTTP 前中止；以上樣本來自通過憑證驗證的 macOS `curl`。兩端點均無需 API key 或登入。兩份規格列 HTTP 200、429、500，資料入口標示每 10 秒更新，未找到明確客戶端配額。非營運時段、臨時停駛、真正特別車、HTTP 429／500 沒有自然出現在這批樣本中，後續依規格製作固定測例並在人工驗收補查。 [重鐵發布入口](https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data) [輕鐵發布入口](https://data.gov.hk/en-data/dataset/mtr-lrnt_data-light-rail-nexttrain-data)

### 用戶狀態和香港時間

| 狀態 | 判定和畫面 |
| --- | --- |
| 載入 | 本次有效站點請求未完成。保留站名及靜態站序。 |
| 即時可用 | 有當前且可解析的預報。重鐵按 API 預計時間和明確 A／D 語義顯示；輕鐵以官方分鐘或到站／開出文字顯示。 |
| 暫無預報 | 成功請求且合法可用的站點沒有預報。可使用「暫無列車預報／No train predictions available」。 |
| 非營運時間 | 僅有足夠的官方線路、站點、日期、方向和特別服務規則時顯示。否則使用空預報狀態。 |
| 服務受影響 | 信任經校驗的官方通知或延誤欄位；官方連結使用受信的 HTTPS 主機。有效預報和延誤提示可並存。 |
| 更新失敗或過期 | HTTP／逾時／格式錯誤可重試。獨立標示過期，停止倒數。辨別 429 並遵守可用的 `Retry-After`，缺少時採退避。 |
| 未覆蓋 | 線／站組合無公開支援或未獲確認，提供靜態資訊及合適官方連結。 |

以香港時間（UTC+08:00）解析無時區的完整日期時間，使用 `time` 的日期跨午夜，勿以裝置時區或只比較時分。重鐵以同一份有效快照的預測時間和來源時間計算，再扣經過時間。輕鐵分鐘值以 `system_time` 為基準，時間文字保留官方語義。驗證系統及班次時間、快取回應的 `Age`、缺失／異常時間戳和裝置時鐘偏移。倒數可用本機計時器更新，快照到期即停。數字失效時不顯示 0 分鐘。靜態首尾班或計劃時刻需明標「時間表」，與「即時預計」分開。

建議 B2／B4 先提供焦點內按需載入和手動重新整理，同一線站／站 ID 的並行請求共用，離頁取消或忽略過時回應。不要按整個附近列表發請求。若後續開啟自動刷新，先取得適用限制，只在前景可見時運作，間隔不得短於來源更新節奏；依供應商規範設定新鮮度、快取和退避，不持久化即時資料。

## 5. 授權、來源與私隱

| 範圍 | 可證實 | 公開出貨前 |
| --- | --- | --- |
| 港鐵靜態 CSV 與兩個即時 API | 由 DATA.GOV.HK 列出並指向供應商檔案／端點。門戶條款 v1.2 與 FAQ 說明在適用條件下可作商業或非商業再用、複製及分發，須標示資料來源及相關提供者，並留意個別資料及連結網站規則。門戶通用條款不能解決供應商網站上一切資源的使用條件。 [門戶條款](https://data.gov.hk/en/terms-and-conditions) [門戶 FAQ](https://data.gov.hk/en/faq) | 核對 MTR 對兩份 CSV 離線打包、上架 App（含商業情境）、提供即時資料、署名格式、暫存、批量下載和輪詢的適用條款。保存網址、版本、日期或書面回覆。 |
| 港鐵網站及文件 | `www.mtr.com.hk` 的網站條款包含網站材料的非商業使用條件。API 規格和資料字典文件有權利聲明；其文檔權利和公開供數權利須分開查明。舊公開資料入口 PDF 路徑實測 404。 [港鐵網站條款](https://www.mtr.com.hk/en/customer/main/terms_of_use.html) [港鐵資料集聯絡資訊](https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data) | 可向 `opendata@mtr.com.hk` 要求確認哪些條款適用於 CSV、API 及地圖。保留來源連結，不複製系統圖或未獲許可的圖檔。 |
| 地政總署／運輸署座標 | 官方樣本、資料字典及資料集入口已查。其開放資料、站圖和地圖圖層的使用條件可各自適用。 [CSDI 站圖規格](https://static.csdi.gov.hk/csdi-webpage/apidoc/3d-indoor-mtr-station-map) [iGeoCom](https://www.landsd.gov.hk/en/survey-mapping/mapping/other-products/iGeoCom.html) | 先選到可對照的點位，再逐來源驗證坐標衍生、打包及署名條款。保留官方資料機構、DATA.GOV.HK（如適用）、資源版本和連結。 |

現有 `content/compliance.json` 和 `src/compliance-credits.ts` 可延續雙語資料來源結構。新模式應揭示哪部分來自港鐵（靜態／即時），哪部分來自其他官方座標提供者，以及數據查閱或更新日期。

計劃中的靜態搜尋、座標和距離全在裝置處理。重鐵請求送出 `line`、`sta` 及選用語言，輕鐵送出 `station_id` 和可選 `with_special`。不送原始 GPS、地標、搜尋詞、位置歷史、帳戶或自訂設備 ID。接收方可取得一般 HTTPS 請求資訊（如 IP、時間、標準標頭），從附近點選的站碼也可能透露粗略區域。未找到這兩端點的查詢日誌保留期限，不將港鐵一般網站聲明當作 API 保留證據。發布前核對供應商的接收、留存及用途，並評估 App 與網站雙語私隱政策、資料來源、App Store Connect App Privacy 的變動。Apple 將實時完成請求所需時間以外的可存取性納入收集判定，僅有公開接口和無自建伺服器的證據不足以決定申報。 [港鐵私隱聲明](https://www.mtr.com.hk/en/customer/main/cust_privacy.html) [Apple App Privacy](https://developer.apple.com/app-store/app-privacy-details/)

## 6. KongDaily 接入方案

| 功能 | 方案 A 的最小接法 |
| --- | --- |
| 路由與篩選 | 延續 `src/app/transport.tsx` → `NearbyBusScreen`。`src/components/transport-ui.tsx` 已有七種篩選 UI，可沿用。`src/app/bus/nearby.tsx` 目前以 `showBuses` 判斷全部／巴士，未有多來源聚合。增加模式級可用性及分發，保護舊路由的維持巴士模式。未覆蓋的模式繼續顯示未接入。 |
| 內嵌搜尋 | 延續單一輸入、清除、取消、搜尋／附近模式和現有列表。當前巴士結果經 `useBusCatalogue` 與 `normalizeBusQuery`／`matchBusRoutes` 在 memo 中同步比對，未見需沿用的遠端 debounce。巴士匹配照舊；新增四種標記結果（港鐵線／站、輕鐵線／站），本機索引雙語名、代碼、路號及有來源的別名，按精確、前綴及包含排序，使用統一列表殼與結果識別。 |
| 前台定位 | 延續 `src/nearby-bus-location.ts` 的權限、焦點及前台恢復，手動地標優先和請求範圍保護。重用 `src/nearby-bus-data.ts` `distanceBetween` 計算本機直線距離，不擴寫巴士的路線評分。沒有核實座標時提供手動選站和靜態搜尋；對已核實但範圍內無站的模式提供擴大範圍和搜尋入口，部分覆蓋需明示。附近段在 A6 基線釐清後沿用最終範圍設定。 |
| 按線／按站 | 延續附近卡片的資訊層級、滾動和狀態元件。港鐵卡顯示線名、站名、方向／終點，缺少月台時省略；輕鐵卡顯示站名、路綫、真實月台及終點。以附近站或用戶選站作查詢上下文，月台只來自預報。即時載入和失敗保持卡片結構。 |
| 導航及回程 | 維持 Stack push／pop 與 `useTransportListPosition` 的按模式清單、穩定鍵及返回行為。新增薄的鐵路詳情路由，先驗證具類型的線站或站點鍵。保留巴士 `/bus/route`、`/bus/nearby/stop`、`/bus/eta`、`/bus/route-map` 及原參數和原資料層。零座標下仍可開詳情看站序及官方連結。 |
| 詳情、地圖、收藏 | 沿用通用頁面層、原生返回、卡片、站序及雙語狀態文案。鐵路詳情按模式渲染，倒數和月台按各自接口；官方圖連結及站序為最小方案。保持 `src/bus-favorites.ts` 及現有首頁置頂身份／資料庫。鐵路收藏建議延後成獨立功能，屆時另定站點／線站鍵和遷移。 |

**身份和欄位邊界。** 建議用 TypeScript 帶 `kind` 的聯合型別，而非路號或站名作通用身份。重鐵線 `lineCode`、服務站 `lineCode + stationCode`、靜態順序 `lineCode + directionLiteral + sequence`，保留供應商 `stationId` 和獨立、有證據的轉乘關係。輕鐵站 `stopId`、路綫 `routeNo`、停靠 `routeNo + directionLiteral + sequence`，即時月台 `stopId + platformId`，保留同路綫多班結果。巴士項繼續使用營辦商、原路線、行車方向、服務類型及站序的現有身份。混合清單鍵加模式前綴，避免巴士和輕鐵的相同路號碰撞。共用部分只包含顯示所需資訊、來源、測距及可共用狀態，不擴張巴士的 `service_type`。

**預計改動範圍。** 建議修改 `src/app/bus/nearby.tsx`、`src/components/transport-ui.tsx`（共用模式 UI 若需）、`src/i18n.ts`，以及待披露確認的資料來源檔。新建各自獨立的小型靜態資料和 TypeScript 查詢／解析模組、薄 Stack 詳情頁及定向測試。`src/app/transport.tsx` 只有在需傳遞篩選／入口狀態時才改。保護首頁、既有巴士路由、巴士 Repository、ETA、票價、收藏及 SQLite。`/transport` 與首頁全域搜尋是兩項功能，本建議只加入前者。

**更新策略。** 以官方按月發布節奏為檢查起點，每次發行前比對兩份 CSV、即時字典和現役系統圖，不以 HTTP Last-Modified 代替內容生效日。可借鑑 `scripts/build-nearby-bus-fares.py` 的來源、SHA-256、時間和資料驗證流程，鐵路維持獨立資料檔和腳本。CI／本地需核對 UTF-8、識別碼、方向站序、轉乘斷言、坐標 CRS／覆蓋和異常增刪，未通過需人工處理。即時請求用官方端點按需取得，離線保留搜尋及站序，無即時預報時按其狀態顯示。無需自建後端或 Supabase。

| 方案 | 成本、收益及風險 |
| --- | --- |
| **A 小型適配層（推薦）** | B1 可只加靜態資料、搜尋及最薄詳情。後續按模式擴增資料及渲染，保留定位和列表，降低巴士／ETA／票價回歸。宿主需要少量中立的篩選與清單分發。 |
| B 重建通用多交通框架 | 可統一全部模式的生命週期和將來的收藏模型，但會一次重構已上線的巴士搜尋、身份、定位、詳情及導航。重鐵分支、輕鐵月台和巴士服務體系差異仍需各自處理，成本及回歸範圍較大。現有元件足以支援 A。 |

## 7. 分階段准入與人工驗收

| 階段 | 實作及准入 | 人工驗收要點 |
| --- | --- | --- |
| **UX-02B1 港鐵靜態路綫、站點及搜尋** | 首選。用獨立快照與查詢適配器，在現有港鐵篩選呈現已覆蓋的站和線。處理 RAC 資料差異、轉乘及分支。允許技術開發，公開打包前確認供應商條款。 | 飛行模式，中英搜尋金鐘和香港／九龍／青衣，重鐵共站不誤配；羅湖、落馬洲、TKL 支線和馬場限制清楚。巴士搜尋、返回及滾動回歸。 |
| **UX-02B2 港鐵即時列車與附近** | 已有真實 ETA 的技術證據。先做選站式 ETA，確認條款、速率和私隱後公開。附近區塊待官方座標交叉表及 UX-02A6 基線確認。 | TKO 多終點；AIR 組合月台；RAC 或終點空方向；離線、切站、過期、限流、香港跨日，以及經審核點位的直線距離。 |
| **UX-02B3 輕鐵靜態路綫、站點及搜尋** | 加獨立 CSV 快照及搜尋適配器。識別 68 站和 11 條常規線，循環分段使用原始序列。公開打包前確認適用條款。 | `250` 在雙語均顯示海皇路，舊名稱別名仍同一 ID；705／706 循環、重複停站及巴士同號保持獨立；離線可查。 |
| **UX-02B4 輕鐵即時到站與附近** | 按 `stopId` 一次載入該站月台，視可用的文件、樣本和授權加入特別班次。附近留待輕鐵座標核實。 | 月台及多路綫、到站和總站開出、`-`、過期、錯誤、特別車真實樣本或可核實案例、跨日與前台切換。 |
| **UX-02B5 全部篩選及交付** | 聚合已啟用且覆蓋明確的來源。保留 zh-HK／English、詳情站序與官方地圖連結，座標和許可通過才放站點圖。 | 混合搜尋和距離排序，同號隔離，切換不重複定位，縮放字級及 VoiceOver；巴士 ETA／票價／收藏、返回及手動位置完整回歸。核對雙語資料來源、私隱及上架申報。 |

**需開發者確認。** 確認以方案 A 與 B1 開工，並接受零座標的靜態搜尋先行。確認 A6 實際提交範圍，避免帶舊預設進入附近整合。公開發布前，按階段審批適用授權、可接受的座標來源／點位語義及覆蓋率，以及官方 API 資料實踐對私隱與申報的影響。未核實的附近站點、特別班次、鐵路軌跡和收藏可分開決策。

### 驗證及範圍

| 檢查 | 結果 |
| --- | --- |
| `npm run typecheck` | PASS |
| `node scripts/test-nearby-bus-location.cjs` | 22／22 PASS（本次基線） |
| `node scripts/test-bus-route-map.cjs` | PASS |
| `node scripts/test-global-search-navigation.cjs` | PASS |
| `git diff --check` 及本新增 Markdown 的空白檢查 | PASS |

報告是唯一工作區新增檔案。沒有運行模擬器、真機或構建。未開始 UX-02B1。
