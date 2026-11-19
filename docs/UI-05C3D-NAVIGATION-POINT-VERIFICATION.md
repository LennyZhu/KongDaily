# KongDaily · UI-05C3-D 導航座標最終核驗

官方資料重新取得於 2026-11-18（香港時間）。開工時 `develop` 工作區乾淨，HEAD 為 `c30845f005ad239b37accb7887a1ef24f98e9896`，與 `git ls-remote` 查得的 GitHub `refs/heads/develop` 一致。UI-05C3-A（`4aa8452`）及 UI-05C3-B（`c30845f`）均已在該遠端歷史中。[UI-05C3-A 審計](UI-05C3A-NAVIGATION-AUDIT.md) · [UI-05C3-B 實施記錄](UI-05C3B-HOME-EXPLORE-INTEGRATION.md)

## 核驗結果與 Apple Maps 測試連結

| 穩定內容 ID | 目標步道入口 | WGS84（緯度、經度） | Apple Maps 測試 |
| --- | --- | --- | --- |
| `dragons-back-to-tei-wan-tai-tam-gap` | 石澳道土地灣，港島徑第八段步道入口 | `22.2270299568, 114.2397903557` | [龍脊步行路線測試](https://maps.apple.com/directions?destination=22.2270299568,114.2397903557&mode=walking) |
| `peak-circle-walk` | 凌霄閣西側室外，盧吉道與港島徑起點 | `22.2712927825, 114.1494947398` | [盧吉道步行路線測試](https://maps.apple.com/directions?destination=22.2712927825,114.1494947398&mode=walking) |

兩個值均從本輪重新下載的官方 GPX 重現。Apple 官方 Unified Maps URLs 的 `/directions` 支援座標形式的 `destination` 與 `mode=walking`。連結以十進制度依緯度、經度的順序傳入，起點留給測試者在地圖中選擇。Unified Maps URLs 適用於 iOS 18.4 或以上。[Apple 官方文件](https://developer.apple.com/documentation/mapkit/unified-map-urls#Request-directions)

本階段的自動檢查只涵蓋連結語法與座標。兩處 Apple Maps 定位針及步行路線獲使用者人工確認 PASS，結果記在下表。這份座標複核原先以八筆資料均為 `unverified` 的版本為基線。正式 App 接入另見實施記錄。[UI-05C3-E 實施記錄](UI-05C3E-TRAILHEAD-NAVIGATION-IMPLEMENTATION.md)

## 龍脊：石澳道土地灣入口

- **入口及版本。** 漁護署的「龍脊」路線由土地灣港島徑第八段入口出發，往大潭峽作結。頁面把土地灣下車巴士站、步道起點、大潭峽方向終點及歌連臣角回程巴士站各自列明。已查看的起點照片可辨識石砌步道、港島徑／龍脊指示牌及入口導覽牌。康文署 B1 和漁護署港島徑第八段資料均描述同一帶的入口，兩份的行程均往大浪灣。[漁護署龍脊路線](https://www.hiking.gov.hk/trail/info/id/UWgvZytZSlRrcnBJSU5DWVZUa2pyUT09) · [指定起點照片](https://www.hiking.gov.hk/console/public/uploads/trail/watermark/685e3bef9d130.jpg) · [康文署 B1](https://www.lcsd.gov.hk/tc/healthy/hiking/road_sky/road_sky1.html) · [漁護署第八段土地灣至大浪灣](https://www.hiking.gov.hk/trail/info/id/QVVxLzJWeGxNUndtYUNXY2VpK3QxUT09)
- **兩條官方軌跡實測。** 大潭峽版本首點為表列座標，末點為 `22.2550479979, 114.2319452858`。大浪灣版本首點為 `22.2271144752, 114.2397291110`，末點為 `22.2448412104, 114.2455920216`。首點相距約 11.32 米，末點相距約 1.81 公里。兩個首點均在同一幅官方地形圖的入口一帶，兩條軌跡隨後向步道延伸。連結直接用與 App 內容相符的大潭峽版本首點。[龍脊 GPX](https://www.hiking.gov.hk/console/public/uploads/others/file/gpx/DragonsBack.gpx) · [第八段 GPX](https://www.hiking.gov.hk/console/public/uploads/others/file/gpx/HongKongTrail%28Section8%29ToTeiWantoTaiLongWan.gpx) · [土地灣地形圖磚](https://mapapi.hkmapservice.gov.hk/gs/api/v1.0.0/xyz/basemap/WGS84/20/857035/457859.png)
- **獨立格網交叉核對。** 地政總署座標轉換 API 將大潭峽版本首點轉成 WGS84 UTM，回傳 `50Q`、東距 `215465 m`、北距 `2460550 m`（整米）以及 `50Q-KK / 154 / 605` 格網，吻合康文署的起點格網 `KK154605`。地政總署搜尋的「石澳道及港島徑第八段交界」公廁點轉成 WGS84 為 `22.227019661, 114.239825170`，距 GPX 首點約 3.76 米，只作地物對照。[轉換 API v2 說明](https://www.geodetic.gov.hk/transform/v2/tformAPI_manual.pdf) · [格網 API 結果](https://www.geodetic.gov.hk/transform/v2/?inSys=wgsgeog&outSys=utmref&lat=22.2270299568&long=114.2397903557) · [土地灣地點搜尋](https://www.map.gov.hk/gs/api/v1.0.0/locationSearch?q=To%20Tei%20Wan)
- **排除活動概覽點。** 漁護署活動頁刊載的 HK1980 格網點為北距 `811463.68 m`、東距 `842762.88 m`。以官方轉換 API 傳入 `e=842762.88`、`n=811463.68`，回傳 WGS84 `22.241902112, 114.239878701`，距候選入口約 1,653.74 米。活動概覽點、巴士站、沿途山脊以及兩線終點均已排除。[漁護署活動概覽](https://enjoyleisure.afcd.gov.hk/en-US/activities/fisheries/dragons-back-79) · [概覽點轉換 API 結果](https://www.geodetic.gov.hk/transform/v2/?inSys=hkgrid&outSys=wgsgeog&e=842762.88&n=811463.68)

## 山頂環迴步行徑：凌霄閣旁盧吉道入口

- **入口及版本。** 旅發局資料以盧吉道與夏力道組成環線。漁護署港島徑第一段及爐峰自然步道西高山段均指明由山頂沿山頂道步行至凌霄閣附近的盧吉道起點。已查看的官方入口照片可辨識白底盧吉道路牌、港島徑指示牌、室外欄杆及步行道路。康文署的盧吉道路線圖獨立標出山頂一側的起步位置。兩條漁護署路線的其餘路段各有終點，本輪只採共用起點。[旅發局環線](https://www.discoverhongkong.com/eng/place-to-go/travel.guide-peak-circle-walk.html) · [漁護署港島徑第一段](https://www.hiking.gov.hk/trail/info/id/MkpYc3Jud1ZjS2RFbzE1Qkhza0htdz09/map_type/1) · [起點照片](https://www.hiking.gov.hk/console/public/uploads/trail/watermark/6913f38c357f3.jpg) · [康文署盧吉道路線圖](https://www.lcsd.gov.hk/en/healthy/common/download/running.pdf)
- **座標交叉核對。** 港島徑第一段 GPX 的首點為表列座標；西高山段 GPX 首點為 `22.2712965126, 114.1494912225`，相距約 0.55 米。兩份檔案同屬漁護署，差距只顯示軌跡首點相符。獨立地政總署地形圖及相鄰圖磚把該點對應到凌霄閣西側室外路口。太平山頂山峰、凌霄閣或商場的中心、纜車月台、盧吉道觀景點與西端接駁處均已排除。松林砲台段雖有相近的文字指引，重下載的軌跡首點為 `22.2771135191, 114.1363658893`，亦已排除。[港島徑第一段 GPX](https://www.hiking.gov.hk/console/public/uploads/others/file/gpx/HongKongTrail%28Section1%29ThePeaktoPokFuLamReservoirRoad.gpx) · [西高山段 GPX](https://www.hiking.gov.hk/console/public/uploads/others/file/gpx/PeakTrail%28HighWestSection%29.gpx) · [松林砲台段 GPX](https://www.hiking.gov.hk/console/public/uploads/others/file/gpx/PeakTrail%28PinewoodBatterySection%29.gpx) · [起點圖磚](https://mapapi.hkmapservice.gov.hk/gs/api/v1.0.0/xyz/basemap/WGS84/20/856772/457720.png) · [北側相鄰圖磚](https://mapapi.hkmapservice.gov.hk/gs/api/v1.0.0/xyz/basemap/WGS84/20/856772/457719.png)

## 重現方法與精度

1. 以 XML parser 驗證 GPX 1.1 namespace 及版本，依檔案順序讀取 `trk/trkseg/trkpt` 的首尾。以下五份檔案均為一條軌跡、一段、無獨立 `wpt`。按命名屬性取 `lat` 再取 `lon`，檢查數值及香港地理範圍。GPX 1.1 使用 WGS84，兩個目的地直接取原始十進制度。[GPX 1.1 規格](https://www.topografix.com/GPX/1/1/)
2. HK1980 米制東距、北距只用於轉換對照點。以官方 API 的 `wgsLat` 和 `wgsLong` 計算，並使用半徑 6,371,008.8 米的 Haversine 球面距離。第 20 級 XYZ 地形圖磚以標準 Web Mercator 公式投影後，龍脊參考像素約為 `(130, 86)`，大浪灣版本首點同一圖磚的 `(84, 18)`，盧吉道約為 `(128, 10)`。像素以各幅 256 px 圖磚左上角為原點。[官方地形圖 API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/TopographicMapAPI) · [地政總署轉換 API v2](https://www.geodetic.gov.hk/transform/v2/tformAPI_manual.pdf)
3. 鏈接保留原始數值以便重現。小數位數、軌跡差距或有相符的格網，均不能用作現場絕對誤差。入口照片與地形圖提供靜態地物對照。它們沒有核驗即時開放、道路過境或步行可達性。

| 官方 GPX | 軌跡點 | SHA-256 |
| --- | ---: | --- |
| `DragonsBack.gpx` | 2,685 | `be2198317eb54984b10438bd98462b3103a7c474c36c723c2ba4b196d98eabfe` |
| `HongKongTrail(Section8)ToTeiWantoTaiLongWan.gpx` | 5,361 | `21eeacf6a21a648335941ce0f2188178801c05c40fc5aaded9256661b66b2310` |
| `HongKongTrail(Section1)ThePeaktoPokFuLamReservoirRoad.gpx` | 1,614 | `728565fd15663eb405ca9d5274cdc9f36262a64b73648cc36051891bb05b5a3b` |
| `PeakTrail(HighWestSection).gpx` | 807 | `37abbc379f6fb0294a48ddef1a6b2538d3d4d2b43b2113d39cea14ec5abdf172` |
| `PeakTrail(PinewoodBatterySection).gpx` | 155 | `069c3fae365da9a6f23bd7ebaec39e505a2f9da6566745ba8ce3a1598619d4a1` |

UI-05C3-A 已核對的四個 GPX 檔案 SHA-256 全部相符。土地灣至大浪灣 GPX 是本輪另行下載的比較檔。

## iPhone 人工驗收表

**2026-11-19 補記。** 使用者在 UI-05C3-E 啟動指示確認兩處 Apple Maps 的定位針及步行路線均人工驗收 PASS。這是使用者回報，Codex 並未執行 iPhone 或模擬器驗收。使用者未提供裝置版本、個別測試起點、道路吸附量測或截圖，本報告未推定這些細節。

用支援 Unified Maps URLs 的 iPhone 開啟兩條測試連結，逐項核對**地圖針點**與**步行路線最後落點**。記錄測試日期、iOS 版本、所用公開起點、截圖和各項 PASS／FAIL。若 Apple Maps 無法規劃步行路線，記錄未能出路線的結果。

| 地點 | 驗收項目 | 通過條件 | 結果 |
| --- | --- | --- | --- |
| 龍脊 | 目的地針點 | 對到石澳道旁有港島徑／龍脊路牌的入口，可與官方照片辨認。巴士站牌、馬路、山脊和大潭峽端均與入口區分。 | PASS（使用者回報） |
| 龍脊 | 步行及道路吸附 | 從對應的土地灣巴士下車位置或已確認同側公眾行人位置預覽，檢查最後一段是否到入口，沒有指向車道、錯誤道路側或另一端。 | 步行路線 PASS（使用者回報） |
| 山頂環迴步行徑 | 目的地針點 | 對到凌霄閣旁的室外盧吉道路牌，核對正確的行人層。 | PASS（使用者回報） |
| 山頂環迴步行徑 | 步行及道路吸附 | 分別從山頂公共運輸總站及纜車上站的公眾出口預覽，檢查最後一段是否落在室外入口，沒有吸附到車道、商場內部或觀景設施。 | 步行路線 PASS（使用者回報） |

如有錯誤道路側、樓層或最後一段無法步行，記錄差異供下一次核對。人工回報的範圍是 Apple Maps 標記及路線，實地通行和臨時封路仍以管理方的現場安排為準。[漁護署設施最新消息](https://www.hiking.gov.hk/news)

## UI-05C3-D 階段靜態驗證及工作區

- 五份官方 GPX 成功解析，四份既有摘要相符。兩條測試 URL 通過 HTTPS 主機、路徑、座標方向、座標字串及步行模式回讀核對。
- `node scripts/test-explore-places.cjs` 通過，八筆正式資料均只有 `status: 'unverified'`。正式 JSON SHA-256 為 `e40effee19d1b9fa1090ba0c93d4d8c76548e634dcf673874f4d41ddfa824c8c`，與 HEAD 一致。
- `git diff --check` 及新增文件空白檢查通過。工作區只新增本報告，App 程式碼及正式資料維持原樣。
