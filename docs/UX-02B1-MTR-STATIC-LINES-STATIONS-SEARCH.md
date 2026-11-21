# UX-02B1 港鐵靜態路線、車站與離線搜尋

## 驗收狀態

| 範圍 | 結果 |
| --- | --- |
| 靜態港鐵查詢 | **自動化 PASS**。十條重鐵綫、雙語站點、站序及離線搜尋已接入 `/transport`，待開發者 iPhone 人工驗收。 |
| 資料分發與商業上架 | **待確認，未放行**。門戶有一般再利用條款，仍需確認港鐵資料集在正式 App、離線副本及衍生快照的適用條件。 |
| 即時 ETA、附近排序 | **未實作**。此版使用靜態快照。站點座標覆蓋未核實。 |

## Git 基線

`develop` 開工 HEAD、本機 `origin/develop` 及 `git ls-remote --exit-code origin refs/heads/develop` 均為 `9ee44fd985daaf4135695828b745b53a0388ac07`。開工時只有一份未追蹤的 [UX-02B0 審計報告](./UX-02B0-MTR-LIGHT-RAIL-DATA-ARCHITECTURE-AUDIT.md)，原樣保留。此輪用開發者已確認的距離基線，預設 500 米，選項為 500／1000／2000 米。

## 官方資料、版本及轉換

| 證據 | 核驗 |
| --- | --- |
| MTR Lines (except Light Rail) & Stations | 2026-11-21（香港）重新下載，14,161 bytes。UTF-8 BOM，273 筆資料記錄中 3 筆為全空尾列，270 筆有效。CSV SHA-256 為 `e0e781152e2e6c5f6d7763262acbae76577b71ca4c66b4b7b72a97252175e0c3`，與 UX-02B0 一致。頁面更新日期為 2023-06-25，資料入口標示每月更新，HTTP Last-Modified 為 `Tue, 21 Nov 2023 10:09:07 GMT`。下載日和伺服器檔案時間均獨立保存。 [官方資源](https://data.gov.hk/en-data/dataset/mtr-data-routes-fares-barrier-free-facilities/resource/8daba4fe-b879-4a51-8962-27b4cffdc61c) [原始 CSV](https://opendata.mtr.com.hk/data/mtr_lines_and_stations.csv) |
| 靜態資料字典 | ZIP 中的 `mtr_lines_and_stations_dataspec.pdf` 定義 7 個欄位，含站碼、數值 ID、雙語名稱、`UT/DT`、分支方向及站序。ZIP SHA-256 為 `0bf65d9456b6a30f07c9147a408923c784c023692ec86baadcee562bf7f12772`。字典的舊線碼表與 CSV 有差異，十條現役線和雙語名稱另用港鐵系統資料確認。 [字典 ZIP](https://opendata.mtr.com.hk/doc/DataDictionary.zip) [中文版系統資料](https://www.mtr.com.hk/ch/customer/services/system_map.html) [英文版系統資料](https://www.mtr.com.hk/en/customer/services/system_map.html) |

- 270 筆站序共形成 24 組行車方向／分支、120 組線站關係、100 個官方數值 ID、97 個唯一站碼。輸出保留所有規律站序，按連續的官方 `Sequence` 排列並以陣列位置還原。腳本校驗欄位、UTF-8、線碼與方向、序號和關聯，拒絕重複記錄、序號缺口、衝突 ID 和未審核的共享身份。
- 站點聚合以官方站碼及數值 ID 交叉驗證。香港、九龍、青衣各顯示一筆，保留機場快綫／東涌綫數值 ID `44/39`、`45/40`、`46/42`。共站的額外對照取自港鐵官方站圖。金鐘保留四線關係，中環／香港、尖沙咀／尖東仍是不同站點。這版站點詳情提供所屬線路及同站轉線關係。跨站步行轉乘、收費區及出入口資料留待另行核實。 [港鐵系統及站圖](https://www.mtr.com.hk/en/customer/services/system_map.html)
- 東鐵綫羅湖和落馬洲、將軍澳綫康城支段各保留官方方向及站序，可按首末站切換。馬場站 `EAL/RAC` 由官方 v1.7 線站表和站圖補入，目錄因此為 **98 筆**，加上此站共有 121 組線站關係。東鐵詳情在常規站序之外單列馬場及服務說明。該補充項的 CSV 數值 ID 為空，沒有編入任何方向、編號或運行時間。 [線站表 v1.7](https://opendata.mtr.com.hk/doc/Next_Train_DataDictionary_v1.7.pdf) [馬場服務資料](https://www.mtr.com.hk/en/customer/services/service_hours_search.php?query_type=search&station=70)
- 生成的本地 JSON 為 11,512 bytes，包含來源、抓取日期、兩項來源雜湊、驗證後的身份和站序。原始 CSV 與字典留在下載暫存目錄，App 只讀取轉換後的 JSON。高鐵、輕鐵及將來延綫不在此快照的產品覆蓋內。

### 重建及校驗

從官方網址下載 CSV 和字典 ZIP，保留 CSV 的 HTTP Last-Modified，另從資源頁核對更新日期。可用下列命令重現本次快照。移除 `--check` 才會寫入預設輸出，更新新版本時可先用 `--output` 指向暫存檔，檢視資料差異再替換。

```sh
python3 scripts/build-mtr-static.py /path/to/mtr.csv /path/to/DataDictionary.zip \
  --fetched-on 2026-11-21 --resource-updated 2023-06-25 \
  --last-modified 'Tue, 21 Nov 2023 10:09:07 GMT' --check
```

每次發行前比對來源版本、行／站新增移除、分支端點與轉乘 ID。若馬場出現在新版 CSV，生成器會要求先人工審核現有補充項。下載日期不作服務時刻或即時性保證。

## 接入方式與範圍

- 港鐵在原 `/transport` 內復用七類交通篩選、`TransportSearch`、按路線／按車站分段切換、FlatList 及 `useTransportListPosition`。無查詢時顯示「港鐵路線」或「港鐵車站」。項目顯示雙語名稱、官方代碼和相關線路，按現有設計 tokens 保持白色圓角、海港青和最小觸控高度。
- 搜尋沿用原輸入、清除與取消流程。靜態目錄在裝置索引繁中、英語及官方代碼，依完全、開頭、包含排序。英語不分大小寫，搜尋支援「綫／線」字形、全形字母及多餘空格。港鐵查詢詞在裝置處理。`/transport` 的巴士路線目錄仍用原快取和讀取機制。
- 「全部」只在有查詢時追加帶類型的港鐵匹配，保持巴士原有排序。巴士仍在載入或失敗時，港鐵匹配可先顯示。清除後回到真實附近巴士。港鐵無距離控制，也不需定位權限即可瀏覽。共用頁面仍有既有的附近巴士前台定位生命週期，港鐵列表與搜尋不依賴其回應。
- 詳情使用既有根 Stack 的 `/mtr/line?code=…` 與 `/mtr/station?code=…`，共用 `Screen`、`PageHeading`、`Filters` 和資料列。無效參數顯示資料不可用。搜尋、列表類型及原屏捲動位置沿用已掛載的 `/transport` 實例。巴士和港鐵各自保留按路線／按車站的選擇。
- 本輪範圍為離線目錄和站序。即時預報、車費、月台、坐標、附近距離、鐵路地圖及鐵路收藏未接入。輕鐵、渡輪、電車及專線小巴維持未接入狀態。

## 分發與私隱

官方資源列明港鐵公司為資料知識產權持有人。DATA.GOV.HK 通用條款 v1.2 在適用條件下容許商業及非商業下載、複製和分發，要求識別資料來源、適當標示政府、供應方和門戶，並包含彌償及第三方連結條款。這些條款是評估離線轉換及分發的依據。港鐵一般網站對其網站內容另有使用限制。本次使用門戶直連的公開 CSV 和少量官方事實，未找到明確針對該 CSV 的額外離線分發禁令，也未證實港鐵已對正式上架方式作出許可。發布前需保存適用條款或港鐵確認，範圍包括 CSV 衍生快照、離線隨包、商業再利用、署名格式，以及補充資料。 [資料權利人資料](https://data.gov.hk/en-data/dataset/mtr-data-routes-fares-barrier-free-facilities/resource/8daba4fe-b879-4a51-8962-27b4cffdc61c) [DATA.GOV.HK 條款](https://data.gov.hk/en/terms-and-conditions) [港鐵網站條款](https://www.mtr.com.hk/en/customer/main/terms_of_use.html)

詳情頁提供雙語資料來源、知識產權署名、下載日、條款連結，以及以港鐵公告為準的離線快照說明。頁面使用現有系統圖示。港鐵功能沒有背景網絡請求或查詢詞、原始 GPS 及設備標識傳輸。使用者主動點擊資料來源才開啟外部網站。這版沒有更改私隱政策或 App Privacy；後續如加入即時 API，仍須完成資料流及申報核對。

## 修改文件

| 文件 | 用途 |
| --- | --- |
| `assets/data/mtr-static.json`、`scripts/build-mtr-static.py` | 官方快照、可重現生成與輸入校驗 |
| `src/mtr-static.ts`、`src/components/mtr-ui.tsx` | 線站身份、離線搜尋與共用資料列 |
| `src/app/mtr/[kind].tsx`、`src/app/_layout.tsx` | 詳情頁與根 Stack 註冊 |
| `src/app/bus/nearby.tsx`、`src/components/transport-ui.tsx`、`src/components/bus-ui.tsx`、`src/i18n.ts` | 原交通頁接入、混合結果類型及雙語 |
| `scripts/test-nearby-bus-location.cjs` | 擴充原測試，覆蓋實際快照、模式、導航和巴士回歸 |
| 本報告 | 來源、實作及驗收記錄 |

## 自動化驗證

| 命令／核驗 | 結果 |
| --- | --- |
| `npm run typecheck` | PASS |
| `python3 scripts/build-mtr-static.py … --check` | PASS，逐位元組比較可重現輸出。另獨立與實際 CSV 比對全部 270 筆站序及線站記錄，並用暫存變體驗證 6 種無效輸入會被拒絕。 |
| `node --test --test-reporter=spec scripts/test-nearby-bus-location.cjs` | 28／28 PASS。含真實資料身份、共站／分支、雙語搜尋、詳情、離線及返回狀態，並覆蓋自動定位、距離控制、篩選及巴士搜尋。 |
| `node scripts/test-bus-route-map.cjs`、`python3 scripts/test-nearby-bus-fares.py` | PASS，巴士 ETA、限定服務、票價及路線圖。 |
| `node scripts/test-global-search-navigation.cjs`、`node scripts/test-global-search-ui.cjs`、`node scripts/test-global-search.cjs` | PASS，全域搜尋、雙語及回程。 |
| `node scripts/test-facility-favorites.cjs`、`node scripts/test-native-link-security.cjs`、`node scripts/test-compliance.cjs` | PASS，收藏、首頁置頂、深連結及合規回歸。 |
| Expo iOS Metro／Hermes 離線匯出 | PASS。於暫存目錄完成並在 Hermes 產物中確認 CSV 雜湊。 |
| `git diff --check` | PASS。另檢查本輪新增文字檔的行尾空白。 |

## iPhone 人工驗收

1. 在飛行模式及未授權定位時，切換到港鐵，確認可看十條線、98 個站點，沒有要求定位或顯示距離。
2. 使用「東涌線」「tUng chUng line」「金鐘」「ADM」搜尋。確認香港、九龍、青衣各只顯示一個站點，各自列兩條綫。確認金鐘列四條綫。
3. 開啟東鐵綫，切換羅湖及落馬洲方向，檢查馬場單列且未插入常規站序。開啟將軍澳綫，檢查康城支段。從線入站、從站入線，再依次返回。
4. 在港鐵站點列表及搜尋結果中向下捲動，開詳情後用原生返回及邊緣手勢，確認關鍵詞、分類與捲動位置。切換兩種語言，以 iPhone 小屏及大字檢查方向按鈕、長站名和 VoiceOver。
5. 在線輸入「Yuen Long」核對巴士和港鐵類型標示，清除後確認仍是原附近巴士。檢查 500／1000／2000 米、巴士 ETA／車費、回程、收藏，以及其餘四種模式的未接入提示。

收工時 `develop` HEAD 仍為 `9ee44fd`，工作區有本輪六個修改檔和六個新增檔，另有開工已存在的未追蹤 UX-02B0 報告。尚未提交。實機、模擬器及 EAS 構建均未執行。
