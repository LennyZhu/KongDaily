# UX-02B4 輕鐵即時列車預報

## 基線與官方文件

開工時 `develop` 工作區乾淨。本機 HEAD、本機 `origin/develop` 及透過 `git ls-remote` 確認的 GitHub `develop` 均為 `d08528b1f826f04509a74b1a7b9abf82d8007b3a`，包含已提交的 UX-02B3。開工核對了 UX-02B0、UX-02B2、UX-02B3 的資料和實作。UX-02B3 的九項 iPhone 人工驗收結果由開發者提供。

DATA.GOV.HK 持續指向 **API Specification v1.1**（封面 2026-04-28）及 **Data Dictionary v1.2**（2026-07-05，包含海皇路改名）。資料提供者與知識產權持有人為香港鐵路有限公司。資料入口標示每 10 秒更新。API 規格列 HTTP 200、429、500，公開文件未找到客戶端配額、指定 App 輪詢間隔或其他數字化快取上限。 [官方資料集](https://data.gov.hk/en-data/dataset/mtr-lrnt_data-light-rail-nexttrain-data) [API v1.1](https://opendata.mtr.com.hk/doc/LR_Next_Train_API_Spec_v1.1.pdf) [資料字典 v1.2](https://opendata.mtr.com.hk/doc/LR_Next_Train_DataDictionary_v1.2.pdf)

逐項比對 v1.2 站點附錄、B3 離線資料包及即時查詢清單，**68 個 ID 完全一致**。使用官方 `Stop ID` 原值傳為 `station_id`，無需名稱或代碼推斷。海皇路沿用 `250`，`TSP` 是靜態站碼。只有同時存在於附錄和本地目錄的站點可發請求。未知站點不送出 GET。當回應包含 `station_id` 時，額外驗證其與請求一致。目前正式樣本沒有回傳站點 ID，App 以該請求的固定站點 URL、分站快取和畫面狀態隔離結果。 [官方站點附錄](https://opendata.mtr.com.hk/doc/LR_Next_Train_DataDictionary_v1.2.pdf)

## 官方 GET 實測

以下為本輪實際官方網絡請求，2026-11-21 香港時間，時間由 HTTP Date 轉換。每個組合只查一次。所有樣本均為 HTTP 200，且帶 `Cache-Control: public, must-revalidate, max-age=10`。這是服務方的 HTTP 快取指示。App 依下述策略按需查詢。 [官方端點規格](https://opendata.mtr.com.hk/doc/LR_Next_Train_API_Spec_v1.1.pdf)

| 時間 | `station_id / with_special` | JSON 狀態 | 回應摘要 |
| --- | --- | --- | --- |
| 19:57:47 | `250 / 1` 海皇路 | 1 | `system_time=19:57:48`，月台 1／2 各 4／5 筆。507、614、614P 同站。月台 2 有 614P 往屯門碼頭，`A`、時間 `-`。 |
| 19:57:47 | `920 / 0` 三聖 | 1 | 月台 1 只有 505 兩班，往兆康，`D`，3／12 分鐘。 |
| 19:57:47 | `140 / 1` 田景 | 1 | 月台 1／2／3 各 5／8／2 筆。同站包含 `A` 和 `D`，有 `Arriving`／「即將抵達」、`-` 和分鐘值。 |
| 19:57:48 | `550 / 1` 天逸 | 1 | 月台 1／2／4／5 各 2／2／2／6 筆。705 和 706 的目的地英文為官方 `TSW Circular`。 |
| 19:57:48 | `9999 / 1` 無效對照 | 0 | 有 `system_time`，沒有月台資料。正式客戶端會在發送前拒絕此 ID。 |

這次未觀察到有效站點的空預報、`special=1`、`stop` 非零、429 或 500。UX-02B0 另有三聖 `Departing` 實測。本輪的其他狀態以規格及隔離夾具驗證，待營運時間合適時補做特殊服務的實機核對。請求的原始回應、官方文件及標頭留在暫存區，沒有納入專案或 App。

## 月台、路線與資料狀態

- 只有輕鐵車站詳情顯示「下一班輕鐵／Next Light Rail trains」。以官方 `platform_list[].platform_id` 分組，逐筆呈現 `route_list`，保留同月台多路線及同一路線的後續班次。以官方 `dest_ch/dest_en` 顯示目的地，缺少一種語言時使用另一種官方值。兩者都缺時明示未提供。列車的路線與目的地不以靜態線路名稱推斷。 [資料字典](https://opendata.mtr.com.hk/doc/LR_Next_Train_DataDictionary_v1.2.pdf)
- 採用 **`with_special=1`**。常規班次 `special=0` 顯示 `route_no`，特別班次 `special=1` 顯示官方供乘客辨識的 `additionalInfo1`（例如 `507*`）及特別車標記。官方 `SPR` 及無法辨識的附加值顯示通用特別車標記。保留可用的 `routeRemarkEng2/routeRemarkChi2`、官方目的地與月台。內部代碼 `901/902` 不作特別車的乘客路線號碼，所有即時列都沒有假造站序或詳情連結。這條分支根據 v1.1 官方示例和 v1.2 規則，以合成欄位夾具驗證。 [API 特別班次示例](https://opendata.mtr.com.hk/doc/LR_Next_Train_API_Spec_v1.1.pdf) [資料字典](https://opendata.mtr.com.hk/doc/LR_Next_Train_DataDictionary_v1.2.pdf)
- `arrival_departure=A` 標示預計到站，`D` 標示預計開出。語義不明時使用「列車預報／Train information」。`time_ch/time_en` 僅辨識已核實的分鐘格式、抵達、開出和 `-`。按官方字典，`-` 表示列車正在到站或開出，可用 A／D 細分。未知或衝突文字只顯示時間未提供。分鐘是 `system_time` 當刻的官方相對預報，卡片標明香港時間與資料基準，沒有自行推算持續倒數。 [時間、位置及狀態欄位](https://opendata.mtr.com.hk/doc/LR_Next_Train_DataDictionary_v1.2.pdf)
- `stop` 是服務停止指示欄位，規格沒有完整的數值對照。實測只有 0。只在 0 時採用時間欄位，正整數異常值以中性服務提示呈現，缺失或其他值隱藏該班時間。這不推斷列車是否停靠本站。`train_length` 是列車長度欄，未加入顯示。
- 有效 `status=1`、合法空月台或空列車顯示暫無預報。官方 `status=0`（錯誤或告警）顯示港鐵暫未能提供本站預報，無效映射顯示不支援。網絡錯誤、500、逾時與格式錯誤為請求失敗。429 單列限流。載入和資料過期也各有狀態。這些狀態保留離線站名、所屬路線與官方資料連結。
- 白色圓角卡片沿用 App 色票與 44 pt 操作，資料時間及手動刷新在同一卡片。詳情仍使用同一個原生 Stack 和原本的 `Screen`。查詢、回應及刷新只改變卡片內部狀態。路線詳情保持方向、循環分段及原站序，無整線或列表預取。

## 刷新、逾時與有效期

港鐵與輕鐵共用 UX-02B2 提取出的 HTTP 請求控制、香港時間和焦點生命週期。兩個客戶端各有獨立的 URL 快取、請求去重與 429 退避，解析器及界面各自保留。港鐵的查詢欄位、解析規則、時間及有效期與 B2 一致。

- 同一站同時只發一個 GET，20 秒內可重用記憶體結果並限制手動刷新。只在進入、焦點恢復、回前台或手動刷新時按需讀取。前台的一秒計時器只更新資料是否過期及是否可刷新。沒有定期網絡請求、後台任務或 SQLite 寫入。
- HTTP 429 採用可解析的 `Retry-After` 秒數或 HTTP 日期並至少等待 20 秒，無效或缺失時等待 60 秒。逾時為 8 秒，以 AbortController 中止。畫面離開、切站或進入背景時停止計時、忽略已失效的回應。此前已發送的請求可在有界期限內完成，以便相同站點去重。
- `system_time` 以香港 UTC+08:00 解析並顯示完整日期及秒數。以 HTTP Date 加可用 Age 作參考，缺少 Date 時使用裝置 UTC；以經過時間更新新鮮度。資料時間缺失、明顯不一致或資料／擷取時間達 60 秒時隱藏預報。已知的來源時間可與過期提示一同保留。

## 資料權利與私隱

DATA.GOV.HK 通用條款在適用條件下容許商業及非商業複製、分發並要求辨識來源、署名政府、資料提供者及平台。港鐵是此資料集的知識產權持有人，港鐵的一般網站及其規格文件另有使用條件。正式分發前仍須確認適用於此實時 API 的商業再利用、署名、暫存、查詢限制，以及 B3 靜態資料分發。可向官方資料集頁所示的港鐵技術聯絡渠道確認。站點詳情已顯示港鐵來源並在資料來源區加入即時資料集連結，集中來源頁可在發布時核對是否需要補齊。 [DATA.GOV.HK 條款](https://data.gov.hk/en/terms-and-conditions) [港鐵網站條款](https://www.mtr.com.hk/en/customer/main/terms_of_use.html) [資料集及維護者](https://data.gov.hk/en-data/dataset/mtr-lrnt_data-light-rail-nexttrain-data)

輕鐵 App 請求只向 `rt.data.gov.hk` 送出 HTTPS GET，查詢欄位只有 `station_id` 及 `with_special=1`，使用 `credentials: omit`。沒有附加 GPS、搜尋詞、帳戶、自訂裝置識別碼或位置歷史。服務方可能取得站號、IP、時間及標準網絡標頭。是否保留或在實時服務所需時間後仍可存取，仍待供方確認。已發布政策列出巴士和天氣等服務，應在送審前評估加入港鐵與輕鐵預報的實際接收方、資料用途、留存與刪除說明，並依 Apple 定義評估申報。站號能表示查閱的車站，不能單憑它認定用戶當時的地理位置。本輪保留正式政策、網站與 App Store Connect 設定。 [Apple App Privacy](https://developer.apple.com/app-store/app-privacy-details/)

## 修改文件

| 文件 | 用途 |
| --- | --- |
| `src/next-train-client.ts`、`src/next-train-time.ts`、`src/next-train-hooks.ts` | 共用 B2 的 HTTP 控制、時鐘、快取和前台更新。 |
| `src/mtr-next-train-client.ts`、`src/mtr-next-train-hooks.ts`、`src/mtr-realtime.ts` | 港鐵原入口接至共用程式，保留原參數及解析。 |
| `src/light-rail-realtime.ts`、`src/light-rail-next-train-client.ts` | 68 站限制、輕鐵獨立解析及單站即時請求。 |
| `src/components/light-rail-next-trains.tsx`、`src/app/light-rail/[kind].tsx`、`src/i18n.ts` | 車站預報、來源及雙語介面。 |
| `scripts/test-mtr-next-train.cjs`、`scripts/test-nearby-bus-location.cjs` | 共享機制及輕鐵定向測試、已發布功能回歸。 |
| 本報告 | 資料事實、驗收與發布待確認清單。 |

## 自動化驗證

| 驗證 | 結果 |
| --- | --- |
| `npm run typecheck` | PASS |
| `TZ=America/New_York MTR_PROBE_DIR=<B2 公開樣本> LIGHT_RAIL_PROBE_DIR=<B4 公開樣本> node --test scripts/test-mtr-next-train.cjs` | **24/24 PASS**。22 項使用隔離測試資料及 mock，另兩項分別重播 B2 和本輪下載的官方回應。重播不發網絡請求。涵蓋 121 組港鐵、68 個輕鐵 ID、香港跨日、數字及狀態文字、特別車、月台、逾時、取消、429、切站及前台恢復。 |
| `node --test scripts/test-nearby-bus-location.cjs` | **32/32 PASS**。B3 靜態、三來源搜尋、路線無預報請求入口、車站 ID、返回與定位，距離仍為 500／1000／2000 米，預設 500 米。 |
| B3 官方 CSV `--check` 與 v1.2 站點對照 | PASS。11 條路線、68 站及 382 筆凍結站序。 |
| `node scripts/test-bus-route-map.cjs`、`python3 scripts/test-nearby-bus-fares.py`、`node scripts/test-facility-favorites.cjs` | PASS。巴士 ETA、限定服務、車費、路線圖及收藏。 |
| `node scripts/test-native-link-security.cjs`、`node scripts/test-global-search-navigation.cjs`、`node scripts/test-global-search-ui.cjs`、`node scripts/test-global-search.cjs`、`node scripts/test-compliance.cjs` | PASS。舊路由、全域搜尋、雙語及合規回歸。 |
| Expo iOS Metro／Hermes 離線匯出 | PASS。於暫存目錄核對輕鐵正式 API 端點已編入 Hermes。 |
| `git diff --check` 與新增文字檔空白核對 | PASS |

## iPhone 人工驗收

1. 從「輕鐵」按站搜尋「海皇路／Hoi Wong Road」，打開 ID 250。核對月台、不同路線、目的地、後續班次與香港資料時間。在三聖 920 檢查 505 的「預計開出」。
2. 在田景或天逸核對同站月台分組。若營運時間內有官方特別車，核對公開路線號、目的地、備註及特別車標記。真實特別車仍是待驗項。
3. 停留超過 60 秒，確認過期訊息及舊列車隱藏。手動刷新、快速換站、切換至背景後再回前台，核對資料身份與滾動位置。飛行模式時檢查錯誤提示和原靜態站序仍可使用。
4. 由輕鐵路線詳情沿站序打開車站再返回，檢查方向、循環分段和原捲動位置。從「全部」或「輕鐵」搜尋返回時核對關鍵詞、分類和位置。中英文、大字及 VoiceOver 需以實機確認。
5. 回歸港鐵預報、附近巴士距離和 ETA。檢查資料來源連結只在使用者點擊時開啟。

## 收工狀態

`develop` HEAD 為 `d08528b`。本輪七個修改檔及七個新增檔，未暫存或提交。App 版本、發布分支及標籤、靜態輕鐵、附近距離、巴士業務、SQLite、政策和生產環境保留原基線。未執行模擬器、實機、EAS Build、部署或送審。輕鐵附近排序、車費、收藏及 UX-02B5 留待後續。

- **技術實作 GO**
- **iPhone 人工驗收 PENDING**
- **正式 App Store 發布授權及私隱核驗 PENDING**
