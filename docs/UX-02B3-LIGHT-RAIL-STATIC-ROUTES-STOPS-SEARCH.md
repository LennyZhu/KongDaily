# UX-02B3 輕鐵靜態路線、車站與離線搜尋

**實作及自動化驗證已完成，iPhone 人工驗收仍待開發者完成。** 本輪交付輕鐵靜態資料、離線瀏覽和搜尋。即時 ETA、月台、附近車站距離排序、車費及收藏尚未實作。公開分發授權獨立待確認。

## Git 基線

開工時 `develop` 工作區乾淨。本機 HEAD、本機 `origin/develop` 和由 `git ls-remote` 查得的 GitHub `develop` 均為 `a5521ad150f86c9ccc33bb4d07198cc28dcbb8bf`。該提交包含 UX-02B2 即時港鐵實作與報告。開工核對了 UX-02B0 至 UX-02B2 的資料、元件與驗收邊界。距離基線為預設 500 米，選項 500／1000／2000 米。

## 官方資料核驗

| 項目 | 結果 |
| --- | --- |
| 原始 CSV | `light_rail_routes_and_stops.csv`，UTF-8 BOM，14,204 bytes。實際下載回應時間為 **2026-11-21 19:40:08 香港時間**。SHA-256 `f2fec60de38b72f38d3478fcdeecea4e3332b300b73c23bf41b22d412a2c2066`，與 UX-02B0 相同。 [原始 CSV](https://opendata.mtr.com.hk/data/light_rail_routes_and_stops.csv) |
| 官方更新日期 | 資源頁列 **2026-07-05**，更新頻率每月。CSV HTTP Last-Modified 為 `Sat, 04 Jul 2026 16:58:02 GMT`，即香港 7 月 5 日 00:58:02。頁面日期、檔案時間與本次取得時間分開記錄。 [DATA.GOV.HK 資源](https://data.gov.hk/en-data/dataset/mtr-data-routes-fares-barrier-free-facilities/resource/d0662909-9919-4f01-b4f9-eccc4b2acbb5) |
| 資料字典 | 用 `DataDictionary.zip` 中的 `light_rail_routes_and_stops_dataspec.pdf` 核實七個欄位。ZIP SHA-256 `0bf65d9456b6a30f07c9147a408923c784c023692ec86baadcee562bf7f12772`。 [官方字典 ZIP](https://opendata.mtr.com.hk/doc/DataDictionary.zip) |
| 下載及轉換數量 | **382 筆有效站序**，加標頭為 383 筆，空記錄、解析失敗、身份衝突均為 0。共 **11 條路線、68 個官方 Stop ID、68 個 Stop Code、22 組路線與方向／分段**。重建 JSON 為 8,678 bytes。 |
| 核實站點改名 | 2026-07-05 起，海皇路站使用官方 `Hoi Wong Road`／`海皇路`，原 Stop ID **250** 和 Stop Code `TSP` 保留，仍屬 507、614、614P。68 個 ID 與 v1.2 字典附錄逐項一致。搜尋使用現名及官方代碼，舊名未加入別名。 [改名公告](https://data.gov.hk/en-data/dataset/mtr-lrnt_data-light-rail-nexttrain-data) [v1.2 站表](https://opendata.mtr.com.hk/doc/LR_Next_Train_DataDictionary_v1.2.pdf) |

### 模型與特殊情況

- 路線以官方 `Line Code` 為 ID。車站以數值 `Stop ID` 的字串表示為穩定鍵，獨立保存官方 `Stop Code` 和英中站名。名稱改動時路線關係仍由 Stop ID 對應。站點所屬路線由真實站序反向計算，每條關係只顯示一次。
- 路線的 `Direction` 及 `Sequence` 共同確定一次停靠。生成器按方向驗證連續的站序，App 由陣列次序還原序號。505 的方向 1／2 長度為 16／14，分開讀取兩組原始資料。正常路線方向的標籤使用各組首末站的官方名稱。
- **705／706** 由港鐵時間表確認為天水圍循環綫。官方 CSV 將每線分為兩組相接站序，分別保留天水圍（430）至天榮（500）以及回到天水圍的分段。705 各段 5／12 筆，706 各段 12／5 筆，介面用「第 1 段／第 2 段」。 [港鐵輕鐵時間表](https://www.mtr.com.hk/en/customer/services/schedule_index.html)
- **507 方向 2、751 方向 1、761P 方向 2** 分別重複經過田景（140）、天逸（550）、天逸（550）。這些是三組各有兩次合法停靠的原始記錄。詳情用方向和站序作列鍵，同一站點仍共用一個詳情路由。
- CSV 涵蓋 505、507、610、614、614P、615、615P、705、706、751、761P。官方另列 507P、720、751P、610P 等特別班次。CSV 缺少它們的完整關係與站序，App 的附註及中英文官方時間表連結說明其覆蓋範圍。以字尾 `P` 判定是否為特別班次會錯判 CSV 的正常路線。 [繁中時間表及特別班次](https://www.mtr.com.hk/ch/customer/services/schedule_index.html)

### 離線重建

下載官方 CSV 與字典，核對資源頁日期及 HTTP Last-Modified。以下命令逐位元組校驗本次快照。要寫入新快照可移除 `--check`，先用 `--output` 指向暫存檔檢視差異。原始 CSV 和字典下載於臨時目錄，專案使用轉換後的 JSON。

```sh
python3 scripts/build-light-rail-static.py /path/to/lr.csv /path/to/DataDictionary.zip \
  --fetched-at 2026-11-21T19:40:08+08:00 --resource-updated 2026-07-05 \
  --last-modified 'Sat, 04 Jul 2026 16:58:02 GMT' --check
```

校驗涵蓋確切欄頭、Unicode、必要欄位、路線與方向、ID／站碼一致性、重複或缺失序號，以及已確認循環的分段銜接。每月資料或發行前更新時，可按輸出差異核對增減與改名，並人工確認新方向、循環或服務變體。輸出規模來自實際源資料。

## 介面與導航

- 現有 `/transport` 保留 `TransportModePicker`、`TransportSearch`、薄荷青按路線／按車站切換與 FlatList。選「輕鐵」時主標題為「輕鐵路線」或「輕鐵車站」。雙語名稱與靜態站序可在未授權定位、無網絡時照常閱讀。輕鐵、港鐵、巴士各自保留列表模式。
- 搜尋重用輸入、清除、取消、分類和 `useTransportListPosition`。輕鐵以本機索引支援路線號碼、官方雙語站名、Stop Code 和 Stop ID，依完全、前綴、包含排序。正規化支援全形數字、空格及英語大小寫。用其他分類打開詳情及返回仍沿用原 Stack。
- 「全部」有搜尋詞時按現有巴士、港鐵之後追加輕鐵，保留各來源排序與清楚類型。例如 `Yuen Long` 的巴士路線、港鐵 YUL 和輕鐵 600 為不同結果。巴士目錄下載中或失敗，兩個鐵路來源仍可回傳本機結果。清除回到既有附近巴士列表。渡輪、電車及專線小巴維持未接入。
- 輕鐵使用同一根 Stack 的 `/light-rail/route?id=…` 與 `/light-rail/stop?id=…`。詳情復用現有及 B1 使用的 `Screen`、`PageHeading`、`Filters`、`EmptyState`、`AppText` 和系統圖示。資訊列採現有白色圓角與 44 pt 觸控 tokens，站點詳情可進入其所屬路線。無效參數顯示不可用。原生手勢與小屏字級仍需人工驗收。

## 分發、來源與私隱

資料權利人為香港鐵路有限公司。DATA.GOV.HK v1.2 通用條款在適用條件下容許商業及非商業複製和分發，要求辨識來源、署名政府、相關機構及門戶，亦包含彌償及第三方連結條款。這是轉換與離線隨包的初步依據。港鐵一般網站對其網站內容有進一步限制，其適用範圍與 `opendata.mtr.com.hk` 所供 CSV 仍須核實。現有證據沒有指明這份 CSV 禁止離線分發，也沒有確認正式商業 App 的完整使用條件。**正式分發仍待核實。** 需要保留適用條款或供應方確認，涵蓋衍生 JSON、離線隨包、商業再利用及署名。 [資料權利人](https://data.gov.hk/en-data/dataset/mtr-data-routes-fares-barrier-free-facilities/resource/d0662909-9919-4f01-b4f9-eccc4b2acbb5) [開放數據條款](https://data.gov.hk/en/terms-and-conditions) [港鐵網站條款](https://www.mtr.com.hk/en/customer/main/terms_of_use.html)

輕鐵路線及車站詳情已顯示版權、來源更新日期、目錄覆蓋、資料入口、條款及官方時間表。App 可見署名沿用現有 B1 文案，先於輕鐵使用位置呈現。整體來源頁如需集中說明，可於後續發布驗收整合。輕鐵讀取及搜尋純本機，沒有新增任何輕鐵網絡請求、權限或資料傳輸。只有點擊來源連結才開啟外部網站。共用頁面原有的巴士資料更新與定位流程仍照常運作。網站私隱政策及 App Store Connect 未更新。

## UX-02B4 接口邊界

以使用者選中的官方 Stop ID 作日後即時查詢身份，現有 ID `250` 會延續到 API。輕鐵預報應獨立解讀實際 `platform_id`、`arrival_departure`、路線號碼與終點。可另核對 `with_special`、特別班次名稱和官方備註，避免把它們強配常規路線或反推靜態月台。以單站按需查詢為起點，評估更新限制、權利與私隱。附近排序仍以取得可交叉核實的官方坐標為前置。 [輕鐵即時資料入口與規格](https://data.gov.hk/en-data/dataset/mtr-lrnt_data-light-rail-nexttrain-data)

## 自動化驗證

| 檢查 | 結果 |
| --- | --- |
| `npm run typecheck` | PASS |
| `python3 scripts/build-light-rail-static.py … --check` | PASS。獨立復原並核對所有 382 筆原始停靠資料，核對 68 個 v1.2 字典 ID；六個隔離錯誤輸入均被拒絕。 |
| `node --test --test-reporter=spec scripts/test-nearby-bus-location.cjs` | **32/32 PASS**。含兩語系離線目錄、站點改名、多方向與循環、詳情互動、返回、三來源及故障隔離。港鐵靜態和巴士定位、距離、搜尋回歸同時通過。 |
| `TZ=America/New_York MTR_PROBE_DIR=<B2 原公開樣本目錄> node --test scripts/test-mtr-next-train.cjs` | **13/13 PASS**。核對 121 組、月台、香港時間、429 及前台生命週期，重播 B2 的已下載樣本。這次回歸無即時網絡請求。 |
| `node scripts/test-bus-route-map.cjs`、`python3 scripts/test-nearby-bus-fares.py`、`node scripts/test-facility-favorites.cjs` | PASS，ETA、限時服務、車費、地圖及收藏。 |
| `node scripts/test-native-link-security.cjs`、`node scripts/test-global-search-navigation.cjs`、`node scripts/test-global-search-ui.cjs`、`node scripts/test-global-search.cjs`、`node scripts/test-compliance.cjs` | PASS，舊路由、全域搜尋、雙語及合規。 |
| Expo iOS Metro／Hermes 離線匯出 | PASS，於暫存路徑匯出並確認官方 CSV 的 SHA-256 字串已編入 Hermes。 |
| `git diff --check` 和新增檔案空白核對 | PASS |

離線驗證範圍為打包資料、無定位下的測試元件、巴士目錄失敗情境及 iOS 靜態匯出。實機飛行模式、原生返回手勢及實際捲動位置仍待開發者核實。

## iPhone 人工驗收

1. 飛行模式冷開，拒絕定位後切換輕鐵，確認可看 11 條路線及 68 個車站，沒有距離、月台或到站時間。
2. 試搜 `505`、`610`、`751`、`TSP`、`250`、海皇路、`hOi wOnG rOAd`。海皇路詳情應為 ID 250 且可分別打開 507、614、614P。
3. 505 切換兩方向，比較站序與不同車站數目。檢查 705／706 兩段及交接站。檢查 761P 方向 2 的兩次天逸。從詳情開啟官方資料與時間表，核對對應語言。
4. 捲動列表後打開詳情並返回，確認關鍵詞、分類和捲動位置。用 `Yuen Long` 跨三種交通搜尋並驗證各自導航，清除後仍回到原附近巴士。雙語和大字下檢查長站名及 VoiceOver。
5. 回歸港鐵即時預報及巴士 ETA、車費和距離。確認 500／1000／2000 米選項以及其餘三種交通的未接入提示。

## 檔案及收工 Git 狀態

| 檔案 | 用途 |
| --- | --- |
| `assets/data/light-rail-static.json`、`scripts/build-light-rail-static.py` | 可追溯離線資源與生成校驗。 |
| `src/light-rail-static.ts`、`src/components/light-rail-ui.tsx` | 站點、路線、站序及本機搜尋，輕鐵列表顯示。 |
| `src/app/light-rail/[kind].tsx`、`src/app/_layout.tsx` | 使用根 Stack 的路線／車站詳情、官方來源及標題。 |
| `src/app/bus/nearby.tsx`、`src/i18n.ts` | 既有交通頁的輕鐵目錄、三來源搜尋與雙語。 |
| `scripts/test-nearby-bus-location.cjs` | 擴充交通頁及靜態資料定向測試。 |
| 本報告 | 來源、實作、回歸及驗收記錄。 |

`develop` HEAD 仍為 `a5521ad`。本輪四個修改檔、六個新增檔，未暫存或提交。港鐵靜態及即時模組、巴士資料與權限設定、首頁、距離範圍、已發布基線及生產環境未變更。未啟動模擬器、真機或 EAS Build。
