# KongDaily · UI-02D2 官方巴士路線折線與站號

## 開發基線

`develop` 的 HEAD 為 `0ae65a981d18e3158d511a98ea25e8f094b05269`。開發前工作區乾淨，本機 `origin/develop` 與 GitHub 遠端均指向同一提交。開發者在本輪對話確認 UI-02D1 必要人工驗收已通過。地圖延續原有 iOS MapKit、站點卡片和站序；路線詳情、ETA、收藏及首頁置頂沿用原有流程。[UI-02D0 核驗](UI-02D0-BUS-ROUTE-MAP-FEASIBILITY.md) · [UI-02D1 實作](UI-02D1-BUS-STOP-MAP-IMPLEMENTATION.md)

## 資料來源及擷取

折線來自香港特別行政區政府運輸署的 CSDI Bus Route 圖層 `FB_ROUTE_LINE`。使用 UI-02D0 在 2026-11-19 取得的官方快照，ISO 元資料修訂日期為 2026-11-11。原圖層為 HK1980 Grid（EPSG:2326），REST 以路線號查詢並指定 `f=geojson&outSR=4326`，按 WGS84 的 `[經度, 緯度]` 解讀；圖層要素由公司碼、官方 route ID、route seq 及路線號精確選取。另用 TD 站序 GeoJSON、營辦商有向 route-stop 回應及 App 已有官方站點索引交叉驗證。TD 站序檔的 HTTP Last-Modified 為 2026-11-18 11:03:14 UTC；各線個別的 TD 站序日期和營辦商回應時間寫在資料包內。[CSDI 資料集](https://portal.csdi.gov.hk/csdi-webpage/dataset/td_rcd_1638844988873_41214) · [ISO 元資料](https://portal.csdi.gov.hk/csdi-webpage/metadata/td_rcd_1638844988873_41214/html) · [REST 圖層](https://portal.csdi.gov.hk/server/rest/services/common/td_rcd_1638844988873_41214/MapServer/0?f=pjson) · [TD 站序目錄](https://data.gov.hk/en-data/dataset/hk-td-tis_23-routes-fares-geojson/resource/455c92d8-cb7e-4aec-8deb-5ef769b19037) · [TD 站序原檔](https://static.data.gov.hk/td/routes-fares-geojson/JSON_BUS.json)

CSDI 條款允許在規定條件下作商業及非商業使用、重製及分發。資料包及已繪線畫面均標明政府、運輸署及 CSDI Portal，並確認資料權利屬政府及相關機構。畫面提示實際行車安排以營辦商公告為準。[CSDI 使用條款](https://static.csdi.gov.hk/csdi-webpage/doc/TNC) · [DATA.GOV.HK 使用條款](https://data.gov.hk/en/terms-and-conditions)

### 已核實的九個選項

| App 身份 | 官方公司碼、route ID／seq | 站數 | 原始分段／頂點 | 營辦商首站／末站距線端點 |
| --- | --- | ---: | ---: | ---: |
| 九巴 1 去程 · 服務 1 | KMB 1001／1 | 25 | 25／391 | 23.66／26.62 m |
| 九巴 1 回程 · 服務 1 | KMB 1001／2 | 25 | 24／422 | 26.62／23.66 m |
| 九巴 268X 回程 · 服務 1 | KMB 8203／2 | 24 | 25／1,339 | 35.59／26.70 m |
| 九巴 268X 去程 · 服務 3 | KMB 1000333／1 | 16 | 15／1,022 | 30.23／35.59 m |
| 九巴 10 去程 · 服務 1（循環） | KMB 1002／1 | 48 | 47／1,222 | 10.59／10.59 m |
| 九巴 296A 去程 · 服務 1（循環） | KMB 1157／1 | 11 | 10／640 | 20.91／20.91 m |
| 九巴 275X 回程 · 服務 1 | KMB 1000392／2 | 19 | 18／1,020 | 35.55／43.39 m |
| 城巴 23 去程 | CTB 1520／1 | 28 | 28／1,031 | 18.76／14.61 m |
| 城巴 23 回程 | CTB 1520／2 | 28 | 27／775 | 14.61／18.76 m |

九筆的營辦商停靠順序與既有索引相符，TD 的正式起終站 ID 與同線的站序相符。兩套站序可沿同一折線有向投影，每站門檻 50 米；營辦商與 TD 同位序站差均不超過 100 米，最大值為 296A 的 93.9 米。程式維持營辦商站位。循環線首末同座標的兩次停靠維持各自站序和選取身份。

九巴 268X 常規去程、275X 去程、城巴 1／11、待核實的龍運與聯營線，以及其餘未審批選項沿用站點圖。B2／B2P 四個選項維持站點圖，深圳灣口岸 `152` 保留嶼巴座標 `22.497433, 113.950509`，與 TD 站位約 655 米的差異仍待核實。完全缺少可靠站座標時，保留文字站序及 ETA 入口。[逐項未繪線原因](UI-02D0-BUS-ROUTE-MAP-FEASIBILITY.md#3-代表路線與匹配方法)

## 構建及畫面行為

- [擷取腳本](../scripts/build-bus-route-geometry.py) 以[審批清單](../assets/data/bus-route-geometry-approvals.json)固定官方身份、原幾何 SHA-256、有序營辦商停靠與座標 SHA-256，以及打包內容校驗碼。當 TD 站序版本、折線、營辦商身份或站序不符時，停止擷取。完整校驗後才原子替換本機索引。
- 建置使用 `python3 scripts/build-bus-route-geometry.py --snapshot-dir <UI-02D0 快照目錄>`。`--snapshot-dir <目錄> --download` 可下載欠缺的官方輸入。上游更新時先重新核驗，保留正式資料直到批准新映射。純離線檢查用 `--check`。加上原始快照路徑可驗證逐位元重現，無須下載整個 CSDI 圖層。
- [本機折線包](../assets/data/bus-route-geometry.json)保留全部 7,862 個頂點及 219 段，支援 `LineString` 和 `MultiLineString`。輸出以百萬分之一度整數儲存，實測最大位移 0.0751 米。每段獨立用 MapKit `Polyline` 繪製，保留原段界和站序。
- [折線讀取](../src/bus-route-geometry.ts)先核實精確路線鍵，再按需讀取小型本機包。只有公司、官方線身份、方向、服務類型、有序停靠 ID、站序及百萬分之一度座標全部相符，並通過格式與內容校驗，才把折線轉成 MapKit 的 `{ latitude, longitude }`。無審批、站序或座標變動、包遺失或損壞會直接使用站點圖。折線由當前資料同步產生，換線時隨路線鍵卸載。
- [路線地圖頁](../src/app/bus/route-map.tsx)保留站點覆蓋數，並在實際繪線的地圖下方加雙語來源。點擊既有站序會選中同一筆停靠，並將相機置中於有效站位。原站點卡、ETA 路由和返回行為沿用既有實作。[雙語文案](../src/i18n.ts)
- [MapKit 站點元件](../src/components/bus-stop-map.tsx)先畫 4pt 海港青折線，再畫每個站點的原標記。[站號優先級](../src/bus-route-map.ts)以地圖移動完成後的區域和實際版面尺寸估算重疊，先給選中站號、再給始末站和依站序的空間足夠站號。其餘以小圓點顯示，保留原座標、獨立標記身份、44pt 標記容器及無障礙標籤。放大能分開鄰近站號，完全同座標的停靠可從站序列表逐一選取。地圖載入或渲染失敗時，底下站序和 ETA 仍可使用。

### 體積與效能

六份官方路線號查詢共 1,484,575 bytes；抽出核實的九筆完整 GeoJSON 要素後為 313,456 bytes。打包折線和其來源資料為 178,754 bytes，gzip 52,027 bytes，審批清單另有 3,853 bytes。最大單線 1,339 個頂點。App 首次需要核實折線時才初始化小型包，每次只轉換當前路線的座標，不下載或解析上游大型檔案。站號只在選站或視口等實際輸入改動時重算。已下載的站序、座標與打包折線能離線讀取，MapKit 底圖仍可能需要網絡。首次地圖顯示、連續切換的原生記憶體及手勢表現留待 iPhone 驗收。

## 自動化驗證

| 命令或檢查 | 結果 |
| --- | --- |
| `npm run typecheck` | 通過。 |
| `python3 scripts/build-bus-route-geometry.py --check --snapshot-dir <UI-02D0 快照目錄>` | 九筆重新驗證並重現相同內容，SHA-256 `b36819e9595cabdd1ce76bd8a1c8e628730a03e3a20aef4684964201bc03020c`。 |
| 截斷官方折線回應後重新構建 | 正確拒絕，原本有效包的 SHA-256 一致。 |
| [`node scripts/test-bus-route-map.cjs`](../scripts/test-bus-route-map.cjs) | 通過。覆蓋九筆映射、異公司同號、方向、服務、循環、B2／B2P、275X 去程、缺損和竄位資料、換線清除、B2 放大、站點數、選站、雙語及 ETA 路由。 |
| `node scripts/test-facility-favorites.cjs` | 通過。包括 SQLite v8、巴士站點快捷收藏及首頁置頂。 |
| `node scripts/test-explore-trailhead-navigation.cjs` | 通過。兩語、首頁與探索返回及既有外部地圖流程。 |
| `EXPO_OFFLINE=1 CI=1 npx --no-install expo export --platform ios --output-dir <臨時目錄>` | 通過。1,274 模組，Hermes bundle 5,512,221 bytes。 |
| `git diff --check` 及檢查新增檔空白 | 通過。既有站點、反向路線索引、ETA、收藏、SQLite Schema 及套件清單的 Git 差異為空。 |

## iPhone 人工驗收

1. 比較九巴 1、城巴 23 的雙方向，核對起終站和官方線的走向，切換後確認畫面只有當前方向。另開城巴 1，確認它只有站點。
2. 比較 268X 常規回程、去程服務 3 和去程服務 1，再比較 275X 雙方向。268X 去程服務 1 和 275X 去程應只有站點。
3. 以九巴 10 或 296A 的站序分別選首、末次停靠，檢查相同地點的不同序號、選中樣式、底部站點及 ETA。
4. 打開 B2 routeId 37，在 11–19 站附近縮放。核對縮小時仍有每個站的標記、放大後相鄰站號恢復、選中站號位於上層。B2／B2P 的深圳灣站仍沿用營辦商站位，且各方向只有站點。
5. 在中文、English、大字與 VoiceOver 下，檢查來源說明、標記點擊、站序選站置中、ETA 收藏與原生返回。已有快取時可離線比較折線與站序，確認底圖載入失敗時仍可選站。
6. 往返多條路線，觀察首次繪圖、縮放和反覆切換的流暢度。本輪未執行模擬器或真機，原生標記命中、MapKit 線層、VoiceOver 與記憶體表現待人工確認。

## Git 工作區

本機 `develop` 與 `origin/develop` 仍指向 `0ae65a981d18e3158d511a98ea25e8f094b05269`。工作區有上述資料包、腳本、畫面及測試和本報告的開發變更。未執行 commit、push 或 merge。
