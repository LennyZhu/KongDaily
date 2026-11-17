# KongDaily · UI-04D0 設施詳情與收藏開發前審計

審計日期為 2026-11-17（香港時間）。基線為 `develop` 的 `f34fdf509ef28247a9889e468c94f3200d1acf0a`（`feat: 宠物共享公园开发`），與本地 `origin/develop` 跟蹤引用一致。開工時工作區乾淨。結論來自現有源碼、五份正式索引、三份 LCSD Registry 及獅子山公園的官方網頁，不涉及裝置內的真實用戶資料。

## 1. 現行收藏及 SQLite

`getDatabase()` 共用一個 `kongdaily.db` 開啟 Promise。開啟時在同一個 exclusive transaction 讀取 `PRAGMA user_version`，按原版本依序補跑缺少的遷移。應用目前支援 v7，遇到更高版本會拒絕開啟。初始化失敗會關閉連線並清除 Promise，讓後續請求可以重試。 [database.ts](../src/database.ts)

| 版本 | 現有資料及主要鍵 |
| --- | --- |
| v1 | `user_settings` 以固定的 `id=1` 保存語言。 |
| v2 | `bus_route_cache` 以 `source` 為鍵；`bus_search_history` 以 `history_key` 為鍵。歷史的插入 trigger 保留最近 8 筆。 |
| v3 | `bus_route_stop_cache` 以 `route_key` 為鍵；`bus_stop_cache` 以 `(source, stop_id)` 為鍵。 |
| v4 | 重建路線快取表，保留當時資料並增加 NLB 營辦商。 |
| v5 | 新增唯一持久化收藏類型 `bus_favorites`，主鍵為字串 `id`，另有唯一且可為空的 `pin_order`，值域 1–3。 |
| v6 | `nearby_bus_sources` 以 `source` 為鍵；`nearby_bus_stops` 以 `(source, stop_id)` 為鍵，帶座標索引。 |
| v7 | `weather_cache` 以 `(api_type, language)` 為鍵。 |

巴士收藏以 `stopVisitKey` 對路線身份、站序和官方站 ID 序列化。九巴／龍運使用來源、路線、方向和服務類型，城巴使用來源、路線和方向，NLB 使用來源及官方 routeId。資料列另存雙語站名、目的地、建立時間、更新時間與置頂順序。新增用 `ON CONFLICT(id) DO NOTHING`；前三筆有空位時自動置頂。取消收藏按 ID 真正刪除；若該筆已置頂，在同一交易內重新編排其餘名次。取消置頂只調整名次。已確認不相符的路線或站序只標記不可用，原收藏列保留。 [巴士收藏 Repository](../src/bus-favorites.ts) · [站點身份](../src/bus-stops.ts)

`useBusFavorites` 透過 `useSyncExternalStore` 共用狀態，讀取去重、寫入排隊、成功後發布資料，寫入錯誤回報 `failed`。首頁常用巴士、巴士查詢、ETA 頁及收藏 Tab 依賴這份資料。收藏 Tab 已有「全部／巴士／地點」；「全部」與「巴士」目前都渲染巴士收藏，「地點」只有空狀態。設施、地標、探索目前沒有收藏表或 Repository。 [巴士收藏 Hooks](../src/bus-favorite-hooks.ts) · [收藏 Tab](../src/app/%28tabs%29/saved.tsx) · [巴士收藏卡](../src/components/saved-bus-ui.tsx)

## 2. 五類正式設施欄位矩陣

共 **1,256 筆**，五類實際筆數都符合各自索引的 `recordCount`。逐筆確認 `source + officialId` 唯一、ID 為非空字串、WGS84 經緯度有限且落在 App 採用的香港邊界內。LCSD 的三份索引 ID 全數與各自 Registry 相符。下表的「雙語」表示同筆索引兩語皆有值；缺漏以現有官方原文回退或省略。

| 類別 | 來源內身份及官方類別 | 名稱／位置 | WGS84 | 官方時段／設施資料 | 電話／官方公告 | 寵物規則及範圍 |
| --- | --- | --- | ---: | --- | --- | --- |
| FEHD 公廁（960） | `fehd + mapID`；公廁 806、旱廁 32、長期流動 122，類別譯名來自 `typeLabels` | 名稱及地址都是 815 筆雙語、145 筆只有英文；地區 960 筆雙語 | 960 | 時段 801（雙語 663、英文 138），159 缺；無結構化 `details` | 索引沒有獨立電話；備註 161（雙語 122、英文 39），其中服務標記 38 | 無 |
| AFCD 郊野公廁（167） | `afcd + FAC_ID`；沖水式 58、旱廁 30、流動 79，類別雙語 | 167 筆雙語名稱、區域 `area`；沒有街道地址及行政區欄 | 167 | 無時段及 `details`；原始 `barrierFreeCode` 為 Y 57、N 110 | 無電話；3 筆雙語停用公告，附生效日、核對日和官方連結 | 無 |
| LCSD 普通公園（48） | `lcsd-parks + park-NNN`；`parks` 類別來自審核後圖層，現有索引未給逐筆 `officialType` | 48 筆雙語名稱、地區、地址 | 48 | 17 筆雙語時段、29 筆雙語設施資料 | 無獨立 `phone`、`remarks` 或 `serviceNotice`；部分工程資訊內嵌時段或設施資料 | 無已核證的普通公園寵物規則 |
| LCSD 寵物專用公園（36） | `lcsd-pet-gardens + pet-garden-NNN`；36 筆 `PET GARDEN` | 36 筆雙語名稱、地區、地址 | 36 | 36 筆雙語時段及設施資料 | 36 筆雙語查詢電話；3 筆雙語入口文字提示，沒有服務公告標記 | 可顯示專用類型及現場守則提醒。入口文字可引用已核實的 3 筆；無已驗證入口座標、活動區邊界或除繩權限 |
| LCSD 寵物共享公園（45） | `lcsd-inclusive-pet-parks + inclusive-pet-NNN`；45 筆 `inclusive_pet_park` | 45 筆雙語名稱、地區、地址；6 筆另有官方別名（5 筆雙語、1 筆英文） | 45 | 45 筆雙語時段、44 筆雙語設施資料 | 45 筆雙語查詢電話；1 筆雙語局部關閉公告，涉及石硤尾公園第二期部分範圍 | 45 筆均須牽繩，40 筆僅限指定範圍、4 筆全場、1 筆列明排除；均有雙語範圍文字，無已驗證邊界或入口 |

| 來源 | 索引中的日期與官方網址 |
| --- | --- |
| FEHD | 主快照 2026-10-26（英文），繁中 XML 2026-03-02；兩語同於 2026-11-17 13:17:48 HKT 取得。960 筆有帶時區的逐筆 `updatedAt`。目前 runtime 的 `sourceUrl` 一律取主語言英文 XML，詳情可提供按語言開啟的目錄／原始資料，標示各語快照日期差異。 [資料目錄](https://data.gov.hk/en-data/dataset/hk-fehd-fehdlocatn-fehd-facility-and-service-locations) · [繁中 XML](https://www.fehd.gov.hk/tc_chi/map/fehd_map_c.xml) · [英文 XML](https://www.fehd.gov.hk/english/map/fehd_map_e.xml) |
| AFCD | 索引快照採官方目錄修訂日 2026-08-04，取得於 2026-11-17 15:56:33 HKT，無逐筆更新時間。3 筆服務公告另有 2026-11-17 核對日。 [CSDI 資料集](https://portal.csdi.gov.hk/csdi-webpage/dataset/afcd_rcd_1635136427551_29173) · [AFCD 索引審計](afcd-toilet-data.md) |
| LCSD 普通公園 | 快照 2026-10-25，官方修訂 2026-10-15，取得於 2026-11-17 19:03:08 HKT，48 筆有逐筆 `updatedAt`。 [CSDI 資料集](https://portal.csdi.gov.hk/csdi-webpage/dataset/lcsd_rcd_1629267205215_19292) |
| LCSD 寵物專用 | 快照 2026-10-25，官方修訂 2026-10-13，取得於 2026-11-17 19:24:40 HKT，36 筆有逐筆 `updatedAt`。 [CSDI 資料集](https://portal.csdi.gov.hk/csdi-webpage/dataset/lcsd_rcd_1670384486075_71092) · [專用公園索引審計](lcsd-pet-garden-data.md) |
| LCSD 寵物共享 | 快照 2026-10-25，官方修訂 2026-10-08，取得於 2026-11-17 21:11:16 HKT，45 筆有逐筆 `updatedAt`。規則及附表是另行核對的來源。 [CSDI 資料集](https://portal.csdi.gov.hk/csdi-webpage/dataset/lcsd_rcd_1670384557490_22821) · [共享公園索引審計](lcsd-inclusive-pet-parks-data.md) |

資料顯示準則

- 正式詳情直接使用現有雙語名稱、類別、地區或官方區域、地址、位置、官方時段、配套、查詢電話和公告。缺地址的 AFCD 顯示 `area`；其中 15 筆官方區域文字表示不在郊野公園及特別地區範圍。FEHD 原資料字典有聯絡欄，但正式索引未匯入，詳情不補造電話。AFCD 無障礙原碼先作稽核用途，未核實設備、入口及路徑前不作通行承諾。 [FEHD 資料字典](https://www.fehd.gov.hk/datagovhk/data_dictionary/english/datadict_locations.pdf) · [AFCD 資料審計](afcd-toilet-data.md)
- 把逐筆更新時間、官方目錄修訂日、快照日、取得時間和公告核對日分別標示。LCSD 的 `updatedAt` 字串沒有時區偏移，首版顯示原始日期即可，在未確認來源解析方式前避免按裝置時區自動轉換。24 小時只標示官方時段；保留例外與原始換行。青衣公園兩個網球場的階段性停用寫在 `openingHours`，佐敦谷公園的歷史工程寫在 `details`，不能改成整座公園關閉或正在施工。零公告標記也不代表開放。
- 詳情保留 CSDI 署名與部門連結。現有 `Facility` 已正規化常用欄位，但 AFCD 的公告證據欄、共享範圍的證據／名單參照及部分來源日期未納入公共型別。建議在詳情資料層補明確型別和來源回退，避免用型別斷言讀取。共享場地中 **22 筆**的 `petAccess.scopeEvidence` 含 `null`，**1 筆**（獅子山公園）沒有可用網址；現有 builder 只驗證陣列 truthiness。詳情生成連結時需要逐一驗證非空 HTTPS URL，獅子山案例使用下節核實的雙語場地官方連結。這一輪保留正式索引原樣。 [設施模型](../src/facilities.ts) · [共享公園構建器](../scripts/build-lcsd-inclusive-pet-parks.py)

## 3. 詳情路由與返回狀態

現有 Expo Router 於 [根 Stack](../src/app/_layout.tsx) 顯式配置巴士、天氣等功能頁，由 [Tab layout](../src/app/%28tabs%29/_layout.tsx) 管理四個主頁。建議新增根 Stack 的 **`src/app/facilities/detail.tsx`，以 `/facilities/detail?source=…&officialId=…` 開啟**。動態方案 `/facilities/[source]/[officialId]` 也可由安裝中的 Expo Router 編碼；本次實測 AFCD 的 167 個 ID 均含斜線，採固定路徑及查詢參數，可避免編碼斜線進入路徑分段的相容性問題。用已安裝的 `resolveHref` 驗證 `ABD/TF/001`、前導零字串和 LCSD ID 的查詢參數可無損往返，尚待原生導覽驗收。

- 各入口共用一個物件形式 href 產生器，直接傳原始字串。詳情用 `useLocalSearchParams` 接收，檢查受支援來源及單一非空 ID，拒絕重複、陣列、空值與不符合格式的參數。避免手動再解碼、轉數字、改大小寫或用名稱當鍵。只以現有 `facilityId` 和同一份已驗證本地資料查找；不把來源、地址、電話、座標或外部網址從任意連結直接當成設施資料。
- 詳情由同一索引供應資料，毋須網絡或第二套設施快取。以現有 `facilityText` 做語言回退，未提供的欄位省略或顯示明確狀態。有參數但無資料時顯示「此設施暫不可用」；如有收藏，顯示保存的名稱及移除操作。冷啟動直連沒有返回堆疊時，提供明確的附近頁返回入口。正常頁面使用現有 `showFacilityDirections` 的 Apple／Google 步行選單；有效查詢電話可因應當前場地提供 `tel:`，從已核對的官方電話生成，模糊或多號備註保留為文字。
- 附近頁已將 `category`／`view` 放在路由參數，搜尋中心、選中身份、視口和每分類列表 offset 由頁面持有。日常使用 `router.push`／返回保留來源頁實例；避免 `replace` 或進出時重設參數。MapKit 原生視圖若重建，從已保存的 `visibleRegion` 恢復，同時保留搜尋中心與拖動狀態。現行 blur 會取消定位並關閉搜尋 Modal，這也是直接詳情入口需先收起搜尋層的原因。 [附近頁狀態](../src/app/%28tabs%29/nearby.tsx) · [地圖事件及視口](../src/components/nearby-facilities-map.tsx) · [外部導航](../src/facility-navigation.ts)

| 入口 | 建議交互 |
| --- | --- |
| 地圖 | 點標記仍只選中、聚合仍先放大；在既有底部預覽加小型「詳情 ›」行內入口，與導航、關閉、同點選擇分開。 |
| 列表 | 點列仍展開／收合；在已展開資訊中加同一行內入口，採兄弟 Pressable，點擊不再次收合。 |
| 附近搜尋 | 點搜尋結果主列仍選中並移到該設施，所選預覽可直接進詳情。若需要少一步，可為本地設施結果提供獨立的小型「詳情」按鈕，先關閉鍵盤和 Modal，待 dismiss 後 push，保留原附近位置。地標、地政總署結果維持定位；首頁全局 `/search` 目前仍是獨立佔位頁。 |
| 收藏 Tab | 點設施收藏列 push 同一詳情，返回保持「全部／地點」分類。暫不可用項只提供簡要紀錄和取消收藏。 |

小型入口採現有海港青文字和箭頭，保留至少 44×44pt 的觸控區、雙語 VoiceOver 名稱及大字體換行。 [附近搜尋面板](../src/components/nearby-search-sheet.tsx) · [全局搜尋現況](../src/app/search.tsx)

## 4. 設施收藏資料與向前遷移方案

建議 **v8 增加獨立的 `facility_favorites` 表**，在現有 exclusive transaction 內建立後設置 `PRAGMA user_version = 8`。不回填巴士收藏，不改舊表、鍵、置頂或現有快取。以下為提案，尚未執行。

```sql
CREATE TABLE facility_favorites (
  source TEXT NOT NULL,
  official_id TEXT NOT NULL,
  name_zh TEXT,
  name_en TEXT,
  type_key TEXT NOT NULL,
  saved_at INTEGER NOT NULL,
  CHECK (length(trim(source)) > 0 AND length(trim(official_id)) > 0),
  CHECK (coalesce(length(trim(name_zh)), 0) > 0 OR coalesce(length(trim(name_en)), 0) > 0),
  PRIMARY KEY (source, official_id)
);
```

- `type_key` 保存收藏時的展示類別，與身份無關。兩語名稱僅在無法解析到現行索引時回退；有索引時顯示最新官方資料。收藏表不放完整地理索引、用戶座標、規則、公告或網站地址。沒有依賴外部索引的 SQL foreign key 或級聯刪除。
- 建議 `facility-favorites.ts` 透過 `getDatabase()` 參數化讀／存／刪。按 `saved_at DESC, source, official_id` 穩定排序；`INSERT … ON CONFLICT(source, official_id) DO NOTHING` 避免重複且保留第一次保存日期，`DELETE … WHERE source = ? AND official_id = ?` 僅刪指定項。另建獨立的 `useFacilityFavorites`，依現有 Hooks 模式共用已提交狀態及排隊寫入，成功才發布，失敗保留上一狀態並提供重試；不耦合巴士的置頂與 ETA 狀態。索引與收藏均在本機，無網絡亦可用。
- 索引失配或經審核暫時停用時保留收藏列，顯示保存名稱與「此設施暫不可用」，停用導航、電話及舊服務狀態，允許使用者移除。原身份經核實恢復後自動以同一鍵解析；同名、接近或同座標均不觸發自動重掛。若收到新版 DB 但 App 回滾至只識別 v7 的舊二進位，現有 version guard 會拒絕開啟，遷移發布前須確認回滾版本也能處理 v8；用戶資料繼續保留。

### 索引更新的身份要求

| 來源 | 跨版本風險及防止錯掛 |
| --- | --- |
| LCSD 三類 | 已有永久內部 ID 和獨立 Registry，現行 App 的 `officialId` 即內部 ID。只在同一已核實身份下更新上游 `OBJECTID`。不同用途即使同名同址仍各自收藏；例如 `lcsd-parks/park-030` 和 `lcsd-inclusive-pet-parks/inclusive-pet-018`。 |
| FEHD | `mapID` 是上游快照身份，官方目錄確認 2022-03-01 曾重編。現有 builder 檢查雙語身份及快照倒退，但沒有守住跨快照同 ID 不被改配的條件。設施收藏開放前，把此 960 筆的發布鍵固定在可追溯的身份對照，用於攔截已發布 ID 被重用。 [FEHD 官方目錄](https://data.gov.hk/en-data/dataset/hk-fehd-fehdlocatn-fehd-facility-and-service-locations) · [FEHD 構建器](../scripts/build-fehd-toilets.py) |
| AFCD | `FAC_ID` 是官方設施代碼，沒有跨版本永久承諾，亦可能遇到移位或臨時點替換。沿用現有鍵作基線並建立同樣的跨版本保護，保留大小寫與斜線。 `ABD/TF/001` 與 `ABD/TH/001` 是原設施與獨立臨時點，收藏不能互換。 [AFCD 資料審計](afcd-toilet-data.md) |

建議只在**索引發布**時核對新舊資料，以現有已發布的 `source + officialId` 建立 FEHD／AFCD 基線對照，另保留原始代碼和人工核實證據。對原 ID 的名稱、類型、區域和座標發生可疑變化，以及消失／新增的相近記錄，輸出差異與阻擋發布；只有人工確認同一實體的改號才將新上游代碼映射回原發布鍵。若原代碼被另一筆設施重用，新實體分配新發布鍵，舊鍵保留退役或暫不可用；拆分、合併或無法確認時留給人工復核。這是 v8 收藏上線的資料門檻，不能只靠資料庫主鍵阻止錯掛。

## 5. 獅子山公園官方紅色排除範圍

**查核結果（2026-11-17）**。康文署雙語場地名單可確認棒球場、射箭場及社區園圃的排除限制，文字指及紅色範圍。已找到官方公園圖與官方地理服務，尚無證據將所見圖像或點位對應為該排除範圍。此次查核不能判定現場圖或未公開圖不存在。

| 證據 | 實測內容及適用限制 |
| --- | --- |
| 康文署 CLPSS 黃大仙區寵物共享公園名單 | 繁中與英文均 HTTP 200。兩語引用同一場地記錄 `op_2888`，附官方查詢電話 2351 7525。位置圖和 GeoInfo Map 兩個連結都使用 `P05hIo12Ew`。 [繁中場地說明](https://www.lcsd.gov.hk/clpss/tc/webApp/Facility/Details.do?did=16&ftid=165) · [英文場地說明](https://www.lcsd.gov.hk/clpss/en/webApp/Facility/Details.do?did=16&ftid=165) |
| 康文署獅子山公園地圖 | 兩語頁及同一張放大 JPG 均 HTTP 200。已實際查看圖像，圖例雙語、編號 4 為社區園圃，明示不按比例；紅色箭頭用作入口提示，圖例和圖面均未標註該共享公園紅色排除範圍。 [繁中公園地圖頁](https://www.lcsd.gov.hk/tc/parks/lrp/map.html) · [英文公園地圖頁](https://www.lcsd.gov.hk/en/parks/lrp/map.html) · [官方放大圖](https://www.lcsd.gov.hk/en/parks/lrp/common/graphics/lrp_map_l.jpg) |
| 康文署場地連接的地政總署地圖 | 從官方網頁引用的 JavaScript 解出靜態和進階連結，兩語各回 HTTP 200。靜態頁內嵌該場地的一個 `Point`，`add_graphic` 為空；進階版原始回應為地圖應用頁，未提供可辨認的場地排除圖層證據。連結有效只證明可到官方地圖，不能驗證排除邊界。 [官方連結定義](https://www.map.gov.hk/static/gihs_interface.js) · [靜態繁中](https://www.map.gov.hk/mapviewer/map.do?gmid=P05hIo12Ew&lg=tc) · [靜態英文](https://www.map.gov.hk/mapviewer/map.do?gmid=P05hIo12Ew&lg=en) · [進階繁中](https://www.map.gov.hk/gm/gmid/P05hIo12Ew?lg=tc) · [進階英文](https://www.map.gov.hk/gm/gmid/P05hIo12Ew?lg=en) |
| 官方附表 | 現行雙語附表第 83 項標記為指定位置，2023 年新增場地附表第 21 項亦指定範圍。兩者只列場地和分類，未附可對照排除邊界的圖。 [康文署現行附表](https://www.lcsd.gov.hk/en/common/pdf/Annex_IPP_Venue.pdf) · [政府 2023 年公告附表](https://gia.info.gov.hk/general/202306/08/P2023060700206_421377_1_1686192418588.pdf) |

UI-04D1 在 `lcsd-inclusive-pet-parks + inclusive-pet-018` 顯示完整雙語排除文字、牽繩規則、簡短「請以現場告示確認可攜寵範圍」，並以語言對應的 CLPSS 頁做 **「查看官方說明」** 外鏈。只有康文署日後提供可直接追溯至同一場地及此排除規則的現行圖，才設 **「查看官方範圍圖」**，優先開啟官方網頁。若只有單語官方圖，清楚標示官方原文語言。場地點仍作導航參考，範圍不繪 Polygon。

康文署網站版權告示要求複製、改編或再分發站內圖像前獲書面授權。本案採外鏈，圖片未加入 App 或在 App 內嵌入。CSDI 的授權及署名條款適用於該平台發布的資料，不能直接援引作康文署站內 JPG 的再利用依據。 [康文署重要告示繁中](https://www.lcsd.gov.hk/tc/notice.html) · [英文](https://www.lcsd.gov.hk/en/notice.html) · [CSDI 條款](https://portal.csdi.gov.hk/csdi-webpage/doc/TNC)

## 6. 建議施工分段及驗收

| 階段 | 交付邊界 |
| --- | --- |
| UI-04D1 · 設施詳情 | 根 Stack 路由及五類本地資料、附近地圖／列表／本地搜尋入口、雙語欄位、公告和獅子山官方說明、外部地圖及有效電話。確認返回狀態，暫無收藏寫入或按鈕。 |
| UI-04D2 · 設施收藏 | 先驗證 FEHD／AFCD 跨快照身份保護，再實施 v8、獨立 Repository／Hooks、詳情收藏與取消、離線及重啟持久化。保證巴士收藏獨立。 |
| UI-04D3 · 收藏 Tab 及回歸 | 以現有「地點」承載五類設施；「全部」把既有巴士和地點分區，讓兩組載入／錯誤狀態獨立；加入直達詳情、不可用快照和移除。驗證跨入口及版本升級。 |

- **資料與身份**。重編 LCSD OBJECTID、核實 FEHD 改號及模擬代碼被重用、AFCD 臨時設施與原設施、同名／同點跨類別。收藏鍵不得丟失或換指。驗證移除索引後離線仍顯示保存摘要，恢復同一身份後可再次開啟。
- **遷移與收藏**。用測試資料驗證全新 v0、既有 v7 及一次較舊版本升級，並核對巴士收藏、三個置頂順序、搜尋歷史、各快取和語言。驗證遷移失敗回滾、快速雙擊、兩入口並行更新、單筆刪除和裝置重啟。獨立確認巴士 ETA 導航和首頁置頂照舊。
- **導航及外鏈**。地圖點選及聚合仍照常；驗證各入口返回同一視口、搜尋中心、分類、選中項和列表滾動。驗證 AFCD 帶斜線 ID、未知來源、重複參數、遺失資料、冷啟動及外鏈失敗。無網絡時可開詳情和收藏資料；外部地圖、電話交給 iOS。
- **顯示及無障礙**。核對 FEHD 只有英文的記錄、AFCD 無地址／時段、普通公園無時段、專用／共享類型區分、共享全場／指定／排除三態、服務公告保留原語義，以及雙語 Dynamic Type 與 VoiceOver。
- **獅子山公園必驗**。從「寵物公園」選 `inclusive-pet-018`，查閱兩語的三項排除與牽繩規則；外鏈落到對應語言的官方場地說明。普通公園的 `park-030` 保持獨立。範圍圖未核實時，必須見到現場確認提示及正確命名的官方說明。日後若加入「查看官方範圍圖」，驗收連結有效、圖例明確對應紅色排除範圍、所適用場地及資料版本可追溯，並保留入口與場地參考點區別。

## 7. 本輪核驗及 Git

已讀現行 App 架構及索引，完成 1,256 筆離線欄位、唯一身份和座標檢查，核對三份 Registry、Expo Router 參數序列化，以及官方範圍資料的 HTTP 回應與圖像。未執行 SQLite 遷移或原生互動測試。

分支 `develop`，HEAD 仍為 `f34fdf509ef28247a9889e468c94f3200d1acf0a`，與本地 `origin/develop` 一致。工作區只有本審計文件為新增未跟蹤檔。
