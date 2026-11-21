# UX-01C 附近巴士成人車費

## 資料審計及實作准入

`src/bus-routes.ts` 的營辦商路線目錄、`src/nearby-stop-routes.ts` 的隨包關聯，以及 `src/nearby-bus-data.ts` 的 SQLite 車站快取均未儲存車費。按路線結果以營辦商來源、路線、方向、服務變體、營辦商車站 ID 及實際站序連接建議上車站。營辦商涵蓋九巴／龍運、城巴及嶼巴。SQLite 快取隨包車站並按原策略更新九巴／龍運車站，站序關聯以獨立隨包快照發布。嶼巴的個別路線站點 API 確實回傳 `fare`、`fareHoliday`，現有程式只讀站序、位置及服務資訊。倉庫未有共用票價展示元件。

2026-11-21（香港時間）實際下載運輸署 GeoJSON、分段車費 XML 與 MDB，三種格式的獨立截止日 CSV 均為 **2026-11-18**。GeoJSON 與 XML 檔案的 HTTP `Last-Modified` 均為 11 月 18 日，XML 根元素 `generated` 為 `2026-11-18T13:40:20`。XML 資源網頁顯示較舊的更新標籤，本次以實際下載內容和截止日為準。GeoJSON 的 `fullFare` 提供全程價，`stopPickDrop` 描述可上落車，`specialType` 區別指定日期營運與日期差別車費。XML 另有上下車站序、`PRICE` 及可選 `DAY_CODE`。已比對 GeoJSON 的上下行線路和 XML 的首尾車費列，採用實際站序處理不同資料表的方向描述。 [原始資料及 MDB](https://data.gov.hk/en-data/dataset/hk-td-tis_3-routes-and-fares-of-public-transport) · [GeoJSON 車站與全程價](https://data.gov.hk/en-data/dataset/hk-td-tis_23-routes-fares-geojson/resource/455c92d8-cb7e-4aec-8deb-5ef769b19037) · [分段車費 XML](https://data.gov.hk/en-data/dataset/hk-td-tis_14-routes-fares-xml/resource/67a967f6-bda3-440e-af79-8f98b8229c19) · [資料字典](https://static.data.gov.hk/td/routes-fares-xml/dataspec/ptroutefare_xml_dataspec.pdf)

### 真實樣本證據矩陣

資料截止日全部為 2026-11-18。「記錄日」分別列路線 GeoJSON 與車費 XML 的 `LAST_UPDATE_DATE`。O／I 使用 App 的營辦商方向，TD 括號為 `(routeId, routeSeq)`。

| 樣本 | 營辦商、身份及運輸署對應 | 全程成人車費及記錄日 | 上車站車費結論 |
| --- | --- | --- | --- |
| B2 | 嶼巴 37 元朗→深圳灣 `(1735,1)`，38 深圳灣→元朗 `(1735,2)` | 兩向 HK$15.80。兩來源紀錄日均為 2025-01-05。嶼巴當前兩個路線頁及站點 API 的起站平日、假日價亦為 15.80。 | 保留全程價。TD 深圳灣口岸點與營辦商點相距約 655 米，部分回程上下車配對也有不同價。 [去程](https://www.nlb.com.hk/en/route/37) · [回程](https://www.nlb.com.hk/en/route/38) · [成人車費表](https://www.nlb.com.hk/assets/uploads/files/ef469-b2.pdf) |
| B15 | 城巴 O 往屯門 `(1000725,1)`，I 往皇崗 `(1000725,2)` | 兩向 HK$15.50。2026-10-10／2026-10-06。城巴現行路線表同價，列為星期六、日及公眾假期服務。 | 兩向可按已核實站序展示。TD O 分段 HK$10.20，I 分段 HK$13.90。城巴營運日不改變這些標準價。 [城巴現行路線表](https://mobile.citybus.com.hk/nwp3/printout1.php?l=0) |
| 68A | 九巴 O／1 `(1286,1)`，I／1 `(1286,2)` | 兩向 HK$12.60。路線 2026-08-14，車費 O 為 2026-08-14、I 為 2026-05-15。 | 保留全程價。去程有分站名稱差異及目的地差別收費，回程若干兩來源站點超過 100 米。 |
| 68X | 九巴 I／1 `(1288,2)`。O／1、O／3、O／4 的候選分別為 `(1288,1)`、`(1000353,1)`、`(1000332,1)` | 回程可顯示 HK$16.20。回程兩來源記錄日均為 2026-08-14。三個去程候選有金額，兩來源站序數量均不一致，暫緩顯示。 | 回程只顯示全程價，個別站有名稱及坐標差異。去程正班與兩個特別班次各自保留為未核准。 |
| 258P | 九巴 O／1 `(1090,1)`，I／1 `(8558,1)`。兩個 TD route ID 各有一個方向。 | 兩向 HK$18.80。去程兩來源記錄均為 2026-09-25，回程均為 2025-01-05。 | 去程只顯示全程價，兩處站名有差異。回程可按已核實站序顯示，其中分段 HK$5.70。指定付款方式並在下車後領取的短程回贈另計。 [已實施的去程走線調整](https://www.td.gov.hk/en/traffic_notices/index_id_88834.html) · [回贈及分段通告](https://www.td.gov.hk/filemanager/sc/content_13/TNTM2/Traffic%20Advice%20Addition%20of%20Section%20Fares%20on%20KMB%20Routes%20Serving%20Tuen%20Mun%20and%20Yuen%20Long%20Districts%20TC.pdf) |
| 261P | 九巴 O／1 `(1104,1)`。往屯門舊回程已取消。 | HK$15.40，兩來源記錄均為 2025-03-21。 | 能確認的上車站可顯示分段，例如上水站 HK$4.30。學校假期影響服務班次，未見適用票價差別。 [取消回程通告](https://www.td.gov.hk/tc/traffic_notices/index_id_89143.html) |
| 268X | 九巴 O／1 `(8203,1)`、I／1 `(8203,2)`、O／3 `(1000333,1)`。特別班次獨立匹配。 | 三個選項均 HK$16.20。三者路線記錄 2026-09-16、車費記錄 2025-01-05。 | 正班兩向只顯示全程價，部分站點位置或名稱有差異。O／3 只有已核實且全部可下車站同價的位置才顯示此站價，其餘回落全程價。 |

官方實檔具備可重建的版本證據及營辦商站序對應。本輪准入 13 個路線選項，其中 5 個可逐站驗證。日期差別收費、依落車站變動的車費、轉乘及特殊乘客優惠留待取得足夠資料再處理。

## 匹配及顯示規則

- 以已審核的 TD 公司代碼、路線 ID、方向和 App 完整路線鍵建立對應。核對從官方 API 讀到的營辦商站序和隨包站序完全相同，再核對 TD 站數、首末站及方向。`kmbLwb` 是 App 的合併來源，核准的九巴選項逐一對應 TD `KMB`，沒有龍運映射。城巴 B15 的 App O 是往屯門，I 是往皇崗。嶼巴 `routeId` 自帶方向，執行時仍核對顯示路線號碼。循環線或重複停靠需要另行審核。
- 全程價須同時符合 GeoJSON `fullFare` 及 XML 首站至尾站的單一標準價，並排除標記為日期差別收費的路線。只可顯示「全程成人車費 / Full-route adult fare」。
- 此站價還需驗證整條路線按序的雙語站名或其一、座標距離及上落客規則。實際上車站的運輸署點與營辦商點差距最多 50 米。從這一站至每個可落車站的資料必須完整相符、同一固定價格，並且是全日適用 `511` 或本批記錄未附日期差別代碼。涉及不同目的地價格、條件或缺少任何配對時，只使用已核實的全程價。執行時同時核對實際站序和營辦商站 ID。
- 13 個路線選項共保存 85 個可核實上車位置。例子包括城巴 B15 O 第 2 站 HK$10.20、B15 I 第 12 站 HK$13.90、258P I 第 16 站 HK$5.70、261P O 第 10 站 HK$4.30，以及 268X O／3 第 10 站 HK$5.80。268X O／3 在起站的費用會隨落車站改變，卡片該處顯示全程價。
- 車費以整數港幣分儲存，由十進制精確轉換，畫面固定顯示兩位小數。附近按路線卡片的價格行位於路線和 ETA 橫列下方，使用現有輔助文字樣式並允許自然換行。缺價、未核准或過期時省略整行。按車站模式與路線詳情沿用既有資訊，資料來源頁補上車費來源及知識產權署名。 [DATA.GOV.HK 使用條款](https://data.gov.hk/en/terms-and-conditions)

## 更新及有效期

App 使用 **11,959 位元組**的衍生離線資料。原始官方檔案、快照日期與逐選項的路線／價目更新日期可追溯，原始 GeoJSON 與 XML 的 SHA-256 均寫入資料包。沒有執行時票價查詢。批准日期以香港時間記錄，資料有效期為官方修訂截止日開始的 14 天，對應雙週更新週期。本包於 **2026-12-02 00:00 香港時間**停止顯示金額。該期限限制舊價展示，營辦商可能在期限內發布新收費通告。

維護者在下一次發布前，按下列流程刷新本地資料。資料有效期已到時，需取得更新的官方修訂批次才能恢復價格展示。運輸署或營辦商提早公布涉及本批的車費變更時，同樣須重新核實受影響的選項。

```sh
python3 scripts/build-nearby-bus-fares.py /tmp/kongdaily-fares --reviewed YYYY-MM-DD --download
python3 scripts/build-nearby-bus-fares.py /tmp/kongdaily-fares --reviewed YYYY-MM-DD --check
```

`--reviewed` 填入實際完成香港日期核查的日期。`--download` 只讀取官方檔並保存在指定目錄，原始檔不要放入倉庫。生成器會核對官方兩份截止日期、XML 檔生成日、營辦商實際站序、App 快照、TD 站序、全程價及分段資料。若識別或全程價發生衝突，生成會失敗並指出相關選項。保留故障證據，待更正站序對應或從核准清單移去失效選項後才重建。審查差異及官方臨時安排後，重跑校驗及回歸再發布。

## 驗證及 iPhone 人工驗收

| 命令 | 結果 |
| --- | --- |
| `npm run typecheck` | PASS |
| `python3 scripts/build-nearby-bus-fares.py /tmp/kongdaily-ux01c-audit --reviewed 2026-11-21 --check` | PASS，使用官方實檔重算得到相同資料包。 |
| `python3 scripts/test-nearby-bus-fares.py` | PASS，驗證十進制分值、落車站範圍、缺項、日期條件及相互矛盾的價格。 |
| `node scripts/test-bus-route-map.cjs` | PASS，驗證全部已核實選項、85 個上車位置、營辦商和變體隔離、過期、雙語卡片與 UX-01B 狀態。 |
| `node scripts/test-nearby-bus-location.cjs` | 7/7 PASS，驗證 UX-01A 定位、按路線／按車站、距離排序及跳轉。 |
| `node scripts/test-facility-favorites.cjs`、`node scripts/test-global-search-navigation.cjs`、`node scripts/test-compliance.cjs` | PASS，驗證收藏、首頁置頂、搜尋導航及合規頁。 |
| `git diff --check` | PASS |

雙語渲染測試檢查兩種文案、正常 ETA、限定服務提醒與原路線入口同時存在。原生排版及真實營辦商臨時調整須在 iPhone 驗收。

1. 在洪水橋或屯門用已授權定位或手動地標進入附近巴士，核對卡片的實際建議上車站。B2 應顯示全程 HK$15.80，B15 方向及站點不同可出現此站 HK$10.20、HK$13.90 或 HK$15.50。
2. 檢查 258P 雙向，以及 261P 往上水方向。確認限定服務提醒、ETA 或無預報、價格、距離及路線入口都正常。用 68A、68X 及 268X 對照全程、缺價與特別班次結果。
3. 切換按車站再切回按路線，確認排序與站點詳情正常。以繁中和 English、較大字體檢查價格行自然換行，以及右側 ETA 的位置。
4. 使用測試環境跨過已記錄的有效期，確認價格行隱藏。電話系統日期會影響 ETA，驗收價格有效期後應恢復自動日期與時間。

## 修改文件及 Git 狀態

| 文件 | 內容 |
| --- | --- |
| `assets/data/nearby-bus-fares.json` | 衍生票價、來源 URL、SHA-256、日期、路線及站點身分。 |
| `scripts/build-nearby-bus-fares.py` | 官方資料擷取、比對及驗證。 |
| `scripts/test-nearby-bus-fares.py`、`scripts/test-bus-route-map.cjs` | 資料與實際卡片的回歸測試。 |
| `src/nearby-bus-fares.ts` | 讀取已核實有效價格、整數格式化及安全回落。 |
| `src/app/bus/nearby.tsx`、`src/i18n.ts` | 附近巴士卡片的雙語車費行。 |
| `src/compliance-credits.ts` | 資料來源頁補上運輸署與 DATA.GOV.HK 的署名。 |
| `docs/UX-01C-BUS-FARE-DISPLAY.md` | 官方證據、實施及驗收記錄。 |

開工時 `develop` 工作區乾淨，HEAD 與本機 `origin/develop` 均為 `91f0eb1376626b5bbde721323c66a73d68434129`。`main` 與 `v1.0.0` 指向已發布 SHA `f35d593f538e02803082e13dfb71b906c1b2675e`。本輪留下 4 個修改檔及 5 個新增檔，無暫存變更。未啟動模擬器或真機，未執行 EAS Build、提交、推送、合併或 Apple 送審。
