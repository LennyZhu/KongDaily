# UX-02B5C1 巴士成人車費重新核驗

**2026-11-21（香港時間）重驗通過。金額變更 0 筆，新增和移除 0 筆。** 從官方實檔重建得到與倉庫逐位元組相同的離線快照。運輸署目前可下載的修訂批次仍是 **2026-11-18**，快照版本 `1`，按原有 14 天規則於 **2026-12-02 00:00 香港時間**停止顯示金額。下一個可採用的官方批次須重新通過路線、站序和收費驗證。 [UX-01C 規則與更新流程](UX-01C-BUS-FARE-DISPLAY.md)

## 核驗數量與金額

7 個路線號碼、13 個營辦商／方向／服務變體的全程價均重新核實。三家營辦商的站序與 App 快照逐項相符，共 **307 筆停站記錄、238 個按資料來源去重的車站 ID**。其中 **85 個可顯示此站價的上車位置**涵蓋 5 個變體、78 個按資料來源去重的上車站。其餘位置只在具備有效全程價時顯示全程價。下表票價均為港幣，O／I 為本 App 的方向碼。

| 營辦商、路線與變體 | 停站 | 全程成人車費 | 已核實的此站價 |
| --- | ---: | ---: | --- |
| 嶼巴 B2 `37` 元朗往深圳灣 | 20 | 15.80 | — |
| 嶼巴 B2 `38` 深圳灣往元朗 | 16 | 15.80 | — |
| 城巴 B15 O 往屯門 | 21 | 15.50 | 10.20 × 19，15.50 × 1 |
| 城巴 B15 I 往皇崗 | 19 | 15.50 | 13.90 × 7，15.50 × 11 |
| 九巴 68A O／1 | 31 | 12.60 | — |
| 九巴 68A I／1 | 29 | 12.60 | — |
| 九巴 68X I／1 | 34 | 16.20 | — |
| 九巴 258P O／1 | 32 | 18.80 | — |
| 九巴 258P I／1 | 31 | 18.80 | 5.70 × 13，18.80 × 15 |
| 九巴 261P O／1 | 13 | 15.40 | 4.30 × 3，15.40 × 8 |
| 九巴 268X O／1 | 21 | 16.20 | — |
| 九巴 268X I／1 | 24 | 16.20 | — |
| 九巴 268X O／3 | 16 | 16.20 | 5.80 × 6，16.20 × 2 |

## 官方證據及顯示邊界

- **運輸署。** 重新下載巴士 GeoJSON、分段車費 XML 及兩份修訂截止日期 CSV。兩個日期檔為 2026-11-18，XML 的 `generated` 為 `2026-11-18T13:40:20`。四個實檔的 SHA-256 均與已提交快照一致。全程價以 GeoJSON 與 XML 的起站至終點價交叉比對。此站價須匹配營辦商站序、站名和坐標，且所有可下車站均有相同、無日期差別的車費。 [GeoJSON](https://data.gov.hk/en-data/dataset/hk-td-tis_23-routes-fares-geojson/resource/455c92d8-cb7e-4aec-8deb-5ef769b19037) · [分段車費 XML](https://data.gov.hk/en-data/dataset/hk-td-tis_14-routes-fares-xml/resource/67a967f6-bda3-440e-af79-8f98b8229c19) · [快照來源與雜湊](../assets/data/nearby-bus-fares.json)
- **嶼巴。** 核對 B2 雙向公開頁及路線站點 API。兩向起站 `fare` 和 `fareHoliday` 均為 15.80。深圳灣口岸的 TD／營辦商點位差異及部分下車配對價格仍限制 B2 此站價。 [元朗往深圳灣](https://www.nlb.com.hk/en/route/37) · [深圳灣往元朗](https://www.nlb.com.hk/en/route/38) · [營辦商站點 API 37](https://rt.data.gov.hk/v2/transport/nlb/stop.php?action=list&routeId=37) · [營辦商站點 API 38](https://rt.data.gov.hk/v2/transport/nlb/stop.php?action=list&routeId=38)
- **城巴。** 現行營辦商路線表的 B15 兩向全程價均為 15.50，站點 API 兩向與 App 快照順序相符。38 筆此站價由運輸署分段 XML、GeoJSON 上落客位置和城巴站序逐筆核准。城巴的互動站點收費頁在公開抓取時只返回驗證畫面，城巴部分的獨立金額核對限於全程價。 [城巴路線表](https://mobile.citybus.com.hk/nwp3/printout1.php?l=0) · [城巴站序 O](https://rt.data.gov.hk/v2/transport/citybus/route-stop/CTB/B15/outbound) · [城巴站序 I](https://rt.data.gov.hk/v2/transport/citybus/route-stop/CTB/B15/inbound)
- **九巴。** 開放數據 `route-stop` 核對 9 個變體的站序。另以九巴公開「路線及收費」查詢按方向和服務變體讀取 `AirFare`，逐一核對 9 筆起站全程價及 47 筆已准入上車價。比對上車站名時去掉網站站號後綴，按營辦商站序對回 App 站點 ID。網站所列一般登車價仍須通過運輸署 XML 的所有可下車站同價條件。 [九巴路線及收費](https://search.kmb.hk/KMBWebSite/?action=routesearch) · [九巴收費結果範例 261P](https://search.kmb.hk/KMBWebSite/Function/FunctionRequest.ashx?action=getstops&route=261P&bound=1&serviceType=1) · [九巴開放站序範例 261P](https://data.etabus.gov.hk/v1/transport/kmb/route-stop/261P/outbound/1)
- **繼續隱藏。** 九巴 68X O／1、O／3、O／4 各自的 TD 站數為 31／22／23，App 快照及九巴公開收費結果分別為 30／21／22。其站序對應仍有衝突，三個去程變體均沒有准入記錄。全程價已核實但缺少可靠上車站對應的變體只顯示全程價。依下車站、拍卡回贈、日期或優惠而變動的價目仍排除於此站成人車費。 [九巴 68X 去程正班](https://search.kmb.hk/KMBWebSite/Function/FunctionRequest.ashx?action=getstops&route=68X&bound=1&serviceType=1) · [產生器核准清單](../scripts/build-nearby-bus-fares.py)

## 驗證

| 檢查 | 結果 |
| --- | --- |
| `python3 scripts/build-nearby-bus-fares.py /tmp/kongdaily-b5c1-fares --reviewed 2026-11-21 --download --check` | PASS，重新下載並逐位元組比對現有資料包。下載獨立保存在暫存目錄。 |
| 營辦商公開金額交叉核對 | PASS，13/13 全程價，另核對九巴 47/47 已准入上車位置。運輸署及站序驗證涵蓋全部 85 筆。 |
| `npm run typecheck`、`python3 scripts/test-nearby-bus-fares.py` | PASS，金額整數分值及無條件分段費測試 2/2。 |
| `node scripts/test-bus-route-map.cjs` | PASS，成人票價、站序與方向、到期隱藏、雙語顯示、ETA 及路線圖。 |
| `node --test scripts/test-nearby-bus-location.cjs scripts/test-mtr-next-train.cjs` | 58/58 PASS，附近交通、港鐵及輕鐵目錄、搜尋和即時預報。 |
| `EXPO_OFFLINE=1 ./node_modules/.bin/expo export --platform ios --output-dir /tmp/kongdaily-b5c1-ios.FL6gM7` | PASS，Metro 在暫存目錄生成 iOS Hermes `.hbc`。 |
| `git diff --check` | PASS。 |

## 人工驗收

1. 在附近交通選「巴士」和「按路線」，透過手動地標定位洪水橋或屯門。比對顯示的建議上車站、方向和票價標籤。可核對 B2 全程 HK$15.80、B15 往屯門洪福邨（第 2 站）HK$10.20、往皇崗輕鐵藍地站（第 12 站）HK$13.90。
2. 核對 68X 往洪水橋（洪福邨）回程全程 HK$16.20，去程三個未准入變體應省略票價。切至港鐵／輕鐵，確認原有目錄和預報可操作。
3. 檢查有效期前後的票價行，截止時間為香港時間 2026-12-02 00:00。若目標發布時快照已到期，沿用隱藏行為，或取得更新官方批次後重新核實。

開工時 `develop` 工作區乾淨，HEAD、本機 `origin/develop` 及 GitHub `refs/heads/develop` 均為 `615fec10cb4b75b0970ae42f22ecde316b82263a`。本輪只新增此報告，資料包、產生器及程式未變更。沒有提交、推送、啟動模擬器或建立 EAS Build。
