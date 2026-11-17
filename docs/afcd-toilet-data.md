# UI-04B2 郊野公園廁所資料審計

## 來源與版本

- 資料集為漁農自然護理署的「郊野公園的洗手間」。資料由香港特別行政區政府及空間數據共享平台（CSDI Portal）提供，相關資料權利由政府及相關機構擁有。 [CSDI 資料集](https://portal.csdi.gov.hk/csdi-webpage/dataset/afcd_rcd_1635136427551_29173) · [CSDI 使用條款](https://portal.csdi.gov.hk/csdi-webpage/doc/TNC)
- 本次使用官方目錄列出的單圖層 GeoJSON，於香港時間 **2026-11-17 15:56:33** 取得，HTTP 200。圖層為 `Toilets_Toilets_Ext_GDB`。官方目錄的修訂日期為 **2026-08-04**，GeoJSON 未提供逐筆更新時間。 [GeoJSON 直下載](https://portal.csdi.gov.hk/csdi-webpage/file-api?dataset_id=afcd_rcd_1635136427551_29173&format=geojson&layer_name=Toilets_Toilets_Ext_GDB) · [CSDI 目錄元資料](https://portal.csdi.gov.hk/geoportal/csw?service=CSW&version=2.0.2&request=GetRecordById&elementSetName=full&id=afcd_rcd_1635136427551_29173)
- [同圖層 ArcGIS 逐筆點算](https://portal.csdi.gov.hk/server/rest/services/common/afcd_rcd_1635136427551_29173/MapServer/0/query?where=1%3D1&returnCountOnly=true&f=pjson) 與 GeoJSON 同為 167 筆。[WFS `GetFeature` 的 EPSG:4326 回應](https://portal.csdi.gov.hk/server/services/common/afcd_rcd_1635136427551_29173/MapServer/WFSServer?service=WFS&version=2.0.0&request=GetFeature&typeNames=Toilets_Toilets_Ext_GDB&outputFormat=GEOJSON&srsName=EPSG%3A4326) 的 167 個 `FAC_ID` 完全一致，座標分量的最大差距低於 0.000000005°。版本固定的 ZIP 下載回應 HTTP 403，本次使用已核實完整的官方單圖層下載。公開資料目錄指出舊 CSV 自 2023-06-01 停止更新。 [DATA.GOV.HK](https://data.gov.hk/en-data/dataset/hk-afcd-afcdlist-toilet)
- 原始 GeoJSON SHA-256 為 `b019abea3087006d97c3ece710995049a646a6ece22ac5281da2cba5e842e28b`。App 索引版本為 `afcd-toilets-2026-08-04-d64371532c93`。

## 欄位及完整性

| 項目 | 審計結果 |
| --- | --- |
| 原始／有效／排除 | 167／167／0。沒有空白 ID、重複 ID、無效幾何或缺少名稱的記錄。 |
| 來源內身份 | `FAC_ID` 為官方設施代碼，167 個唯一，GeoJSON 與 WFS 一致。以字串原樣保留，包括大小寫與斜線。App 使用 `afcd + FAC_ID`，不使用資料列的 `OBJECTID`、`GmlID` 或座標作主鍵。未發現官方對跨版本永久穩定性的承諾，未來更新須留意重編、移位與臨時設施替換。 |
| 官方名稱、區域及地址 | `FACILITY_NAME_TC/EN` 及 `COUNTRY_PARK_TC/EN` 各語言皆 167/167。資料集沒有獨立街道地址欄，App 顯示官方公園／地區文字。15 筆在官方欄位標為「不在郊野公園及特別地區範圍」，其餘按官方公園文字顯示。 |
| 座標 | 官方底層為香港 1980 方格網（EPSG:2326）。CSDI GeoJSON 以 WGS84 經度、緯度輸出，與 WFS 核對一致。167 筆均為 Point，座標分量有限且在香港範圍內。經度 113.8445727527–114.4407733163，緯度 22.2045372487–22.5412840118。完整保留原始精度。 [CSDI GeoJSON 座標公告](https://portal.csdi.gov.hk/csdi-webpage/info/WhatsNew) |
| 位置及同名 | 完全同座標群組 0。相同名稱但座標有別的群組為繁中 10 組、英文 9 組。各筆均保留。 |
| 官方廁所類型 | `TYPE_TC/EN` 共 3 種，沖水式 58、旱廁 30、流動 79，兩語言配對一致。 |
| 特殊屬性 | `BARRIER_FREE_FAC` 為 Y 57、N 110。原碼保留在索引，本階段不在 UI 推斷無障礙設備或通行條件。未見供水、停車或開放時間欄。 |
| 營運狀態 | 位置圖層沒有開放、關閉或維修欄。App 只顯示能匹配到個別設施的補充公告，並標示核對日期。 |

### 與 FEHD 比對

與 App 內 2026-10-26 的 FEHD 960 筆 WGS84 座標進行全量兩兩 Haversine 比對，完全同座標、10 米、25 米、50 米和 100 米內的配對都為 0。以 Unicode NFKC、大小寫摺疊、保留字母與數字的方式正規化現有雙語名稱，完全匹配為 0。最近配對約 241.06 米，為 AFCD `SKW/TF/301` 大灘營地與 FEHD `754` 高塘下洋公廁。這些比對只用於找可能重疊，未對跨機構設施做合併。

### 停用及維修公告

以下公告及附圖於 **2026-11-17** 核對。公告附圖透過地標、設施類型、相對位置來區分永久公廁與臨時替代點。索引保留生效日期、核對日期及公告原始連結。 [漁護署「郊野樂行」最新消息](https://www.hiking.gov.hk/news) · [漁護署公廁頁](https://www.afcd.gov.hk/english/country/cou_vis/cou_vis_rec/cou_toi.html)

| FAC_ID | 匹配依據 | 公告開始日期 |
| --- | --- | --- |
| `ABD/TF/001` | 香港仔傷健樂園入口的沖水式公廁，附圖與東北側的臨時公廁分開標示。 `ABD/TH/001` 為流動廁所，保留獨立記錄。 [公告](https://www.hiking.gov.hk/console/public/uploads/news/67ae9a4e8f4c4.pdf) | 2025-02-13 |
| `PSL/TF/002` | 新娘潭自然教育徑及新娘潭路的沖水式公廁，附圖標示永久公廁在獅子亭臨時公廁的另一側。 [公告](https://www.hiking.gov.hk/console/public/uploads/news/6718b51d42dc8.pdf) | 2024-10-28 |
| `TT/TF/002` | 大潭水塘道近壩的沖水式公廁，附圖區分壩側原址與一號燒烤場附近的臨時點。 `TT/TH/002` 為近該燒烤場的流動廁所。 [公告](https://www.hiking.gov.hk/console/public/uploads/news/66bd74b8b0b61.pdf) | 2024-08-19 |

荃錦營地的工程圖只標示部分區域及另一處流動廁所，現有座標與名稱不足以把受影響點可靠分配給 `TL/TH/050` 或 `TL/TH/051`。漁護署公廁頁把三個沖水點列為「大棠」並標示其中一個暫停，缺少能與三筆 `FAC_ID` 分辨的證據。這些公告保留在官方來源，不附於個別 App 記錄。公告核對只反映當日的公開資料。

## 重建

`python3 scripts/build-afcd-toilets.py --audit-only` 下載並驗證 CSDI 元資料、GeoJSON 和官方點算，輸出審計資料。可用 `--input-dir` 指向已保存的 `afcd.geojson`、`metadata.xml`、`count.json`，同時用 `--fetched-at` 提供帶時區的原取得時間。去掉 `--audit-only` 後才寫入 `assets/data/afcd-toilets.json`。

匯入拒絕空回應、錯誤圖層、點算不符、重複或缺失 ID、非法座標與未辨識類型。已有匯入時也拒絕版本倒退，驗證完成後才原子替換。更新前須重新核對個別停用公告。設施座標或官方類型改變時，現有匹配公告不會套入新位置。
