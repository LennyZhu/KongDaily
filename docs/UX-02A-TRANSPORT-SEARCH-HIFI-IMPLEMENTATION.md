# UX-02A 多交通查詢與巴士流程復用

## 高保真對照

已開啟並檢視 `docs/design/UX-02/` 內兩張實際參考圖。原文件使用中文檔名，與任務列出的英文名不同。首頁參考是 [kongdaily香港生活交通界面.png](design/UX-02/kongdaily香港生活交通界面.png)，附近交通參考是 [kongdaily附近交通導航介面.png](design/UX-02/kongdaily附近交通導航介面.png)。兩張原檔均保留。

| 區域 | 本輪落地 |
| --- | --- |
| 首頁交通快捷卡 | 雙語名稱改為「交通查詢 / Transport Search」。沿用卡片尺寸、底色、位置和圓角，使用現有 SF Symbols 的巴士及隧道列車圖示，點按開啟 `/transport`。 |
| 首頁常用區 | 標題改為「常用公共交通 / Frequent transport」。原有巴士置頂、B2 卡片、管理入口與「新增常用巴士 / Add a frequent bus」維持原產品流程。 |
| 首頁其他內容 | 沿用正式版的維港、天氣及警告、全域搜尋、五個其他快捷卡、探索內容及 Tab。 |
| 附近交通 | 延續維港背景、海港青／淡青與白卡、位置卡、橫向圖示篩選和按路線／按車站。Stack 使用原生返回。篩選下增加可直接進入原巴士路線搜尋的入口。 |
| 路線卡片及頁面底部 | 延續已驗收的巴士卡片，包括真實班次資料、建議上車站和兩種車費語義。交通頁使用既有根 Stack，底部四個 Tab 繼續屬於主頁面。 |

高保真內的示例路線、位置、班次、車費及混合排序只作為視覺參考。畫面使用 App 的本機站點、現有營辦商資料與已核實的費用快照。篩選有選中語義及至少 44pt 的觸控高度，英文與大字可自然換行。

## 路由、模式與復用邊界

新增根 Stack `/transport`，以薄入口啟用同一個 `NearbyBusScreen` 的交通介面。 `/bus` 繼續處理路線查詢、最近搜尋、收藏入口和路線圖選擇。舊 `/bus/nearby` 繼續呈現原附近巴士介面。路線詳情、路線圖、完整 ETA、車站詳情、收藏、首頁置頂與全域搜尋保留原有路徑及身分參數。

| 篩選 | 可用狀態 |
| --- | --- |
| 全部 / All | 顯示現時已接入的巴士。沿用直線距離排序和按路線／按車站。 |
| 巴士 / Bus | 可搜尋路線，使用附近路線、車站、ETA、營辦商備註、限定服務提醒及有效成人票價。詳情、路線圖及收藏均走原流程。 |
| 港鐵 / MTR | 可選擇。顯示港鐵資料未接入。 |
| 輕鐵 / Light Rail | 可選擇。顯示輕鐵資料未接入。 |
| 渡輪 / Ferry | 可選擇。顯示渡輪資料未接入。 |
| 電車 / Tram | 可選擇。顯示電車資料未接入。 |
| 專線小巴 / Green Minibus | 可選擇。顯示專線小巴資料未接入。 |

篩選由同一頁狀態管理，保留定位結果、已選地標、距離範圍及列表模式。選擇未接入的交通方式時，清單顯示對應狀態，暫停本頁的巴士路線 ETA 工作。返回「全部」或「巴士」後復用原列表及 ETA 策略。篩選不在定位焦點回呼的依賴中。UX-01A 只在符合原條件的進頁／回焦／回前景時自動定位，手動選地標仍取消並忽略遲到的 GPS。UX-01C 票價有效期維持原資料包設定，到期時整行隱藏。

本輪未新增執行時交通 API、GPS 傳送、地理編碼或後端。後續各方式可在篩選接自己的資料適配，按已核實結果決定何時加入「全部」。巴士資料、Expo 權限及持久化邏輯繼續由原模組管理。

## 後續官方資料清單

查閱日期為香港時間 2026-11-21。以下是介面及資料集文件層的核對，實際接入仍需以官方載荷抽樣驗證。公開資料入口不保證服務可用率或容許任意調用頻率。共用的發布前工作包括確認個別供應者及空間資料條款，保留權利與來源署名，核查請求接收方、欄位、服務方資料處理及 App Privacy 影響。附近排序應以裝置上的已驗證坐標完成。 [DATA.GOV.HK 使用條款](https://data.gov.hk/en/terms-and-conditions)

| 方式 | 已查核資料及接入工作 |
| --- | --- |
| 港鐵 | 港鐵實時資料列出十條線（含機場快綫、屯馬綫及迪士尼綫），提供最多四班列車，每 10 秒更新。官方規格使用公開 HTTPS GET `line`、`sta` 及可選語言，回應有 `UP`／`DOWN`、目的地及月台，記載 429。先用每月線站表對照線路及站碼，再驗證 iGeoCom 的鐵路站出入口 POI 和坐標系。換乘站須保留每條線的身分及方向，站碼和出入口仍待逐項對應。資料權利由港鐵擁有。 [港鐵 ETA](https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data) · [ETA 規格](https://opendata.mtr.com.hk/doc/Next_Train_API_Spec_v1.7.pdf) · [線站表](https://data.gov.hk/en-data/dataset/mtr-data-routes-fares-barrier-free-facilities) · [iGeoCom](https://data.gov.hk/en-data/dataset/hk-landsd-openmap-development-hkms-digital-geocom) |
| 輕鐵 | 港鐵公開 HTTPS GET 以 `station_id` 查詢，`with_special` 控制特別班次。回應按月台列出路線、行車目的地及到發資訊，每 10 秒更新並記載 429。使用港鐵每月路線／站點表，逐站驗證官方坐標、站碼、月台方向、同號雙向及新版站名。資料權利由港鐵擁有。 [輕鐵 ETA](https://data.gov.hk/en-data/dataset/mtr-lrnt_data-light-rail-nexttrain-data) · [ETA 規格](https://opendata.mtr.com.hk/doc/LR_Next_Train_API_Spec_v1.1.pdf) · [路線與站點](https://data.gov.hk/en-data/dataset/mtr-data-routes-fares-barrier-free-facilities/resource/d0662909-9919-4f01-b4f9-eccc4b2acbb5) |
| 專線小巴 | 運輸署公開 HTTPS JSON 有區域路線清單、`route_id`／`route_seq`、配對的 `stop_seq`／`stop_id`、站點 WGS84 與 ETA。ETA 每分鐘更新，其他欄位按需要更新。先核實循環和重複站序、同號分區、接口的 `enabled` 與資料新鮮度，官方計劃班次備註按實際語義呈現。資料按運輸署與 DATA.GOV.HK 來源署名，配額與覆蓋需抽樣。 [專線小巴 ETA](https://data.gov.hk/en-data/dataset/hk-td-sm_7-real-time-arrival-data-of-gmb) · [API 規格](https://data.etagmb.gov.hk/static/GMB_ETA_API_Specification.pdf) |
| 渡輪 | 運輸署資料有路線、碼頭坐標、方向及持牌航線時間表。天星小輪有公開中環／尖沙咀和灣仔／尖沙咀 CSV 時間表及票價，公告按需更新。港九小輪另有自營碼頭、航線、時間表及每分鐘 ETA，權利屬該公司。先逐營辦商核實碼頭坐標、停靠方向、班次／例外日與可重用條款，再決定支援範圍。計劃開船時刻應明示為時間表。 [運輸署航線時間表](https://data.gov.hk/en-data/dataset/hk-td-wcms_8-ferry-services-tt-ft) · [碼頭坐標](https://data.gov.hk/en-data/dataset/hk-td-tis_3-routes-and-fares-of-public-transport/resource/9a14de20-71b4-42b2-aae2-d7579aaa8c65) · [天星小輪資料](https://data.gov.hk/en-data/dataset/starferry-starferry-ferry-service-timetables-and-fare-tables-of-star-ferry) · [港九小輪資料](https://data.gov.hk/en-data/dataset/hkkf-hkkfdata-hkkf-eta-data) |
| 電車 | 運輸署有雙週站序和 CSDI 車站坐標，香港電車官方資料有六條主要路線、東西行首末班及服務通告。營辦商官方 App 提供實時預報，仍待確認可供 KongDaily 接入的公開端點、使用許可與更新頻率。可先審核站點定位和時間表，標明首末班及日別，並保留服務通告來源。 [運輸署站序](https://data.gov.hk/en-data/dataset/hk-td-tis_14-routes-fares-xml/resource/f632104e-81d1-4282-b779-6c8b2f10f65c) · [CSDI 車站坐標](https://data.gov.hk/en-data/dataset/hk-td-tis_23-routes-fares-geojson/resource/c0710429-a89c-406f-889b-87d6e4b739b6) · [官方時間表](https://www.hktramways.com/en/schedules-fares/) · [官方 App 實時預報公告](https://www.hktramways.com/media/files/press-releases/20260414_Press%20Release_Hong%20Kong%20Tramways%20Unveils%20Official%20Mobile%20App.pdf) |

## 修改文件

| 文件 | 變更 |
| --- | --- |
| `src/app/(tabs)/index.tsx`、`src/components/home-ui.tsx` | 指定交通卡改用雙圖示，新入口指向 `/transport`。 |
| `src/i18n.ts` | 首頁兩項文字及交通頁雙語文字。 |
| `src/app/_layout.tsx`、`src/app/transport.tsx` | 新增原生 Stack 入口及返回。 |
| `src/app/bus/nearby.tsx`、`src/components/transport-ui.tsx` | 在共用附近巴士頁切換七個篩選，維持原列表、定位和 ETA 模型。 |
| `scripts/test-global-search-ui.cjs`、`scripts/test-nearby-bus-location.cjs`、`scripts/test-bus-route-map.cjs` | 首頁、固定 B2、雙語篩選、定位競態、原生 Stack 路徑契約測試。 |
| `docs/UX-02A-TRANSPORT-SEARCH-HIFI-IMPLEMENTATION.md` | 設計對照、官方資料初核及驗收。 |

## 自動化驗證

| 命令 | 結果 |
| --- | --- |
| `npm run typecheck` | PASS |
| `node scripts/test-global-search-ui.cjs` | PASS。首頁雙語、六個快捷卡、B2 置頂、全域搜尋及原新增巴士入口。 |
| `node scripts/test-nearby-bus-location.cjs` | 10/10 PASS。七個篩選、真實巴士資料、雙語、切換時定位及站點查詢次數、地標與 GPS 競態，以及 UX-01A 回歸。 |
| `node scripts/test-bus-route-map.cjs` | PASS。新 Stack 返回、舊路徑、站序與詳情、UX-01B ETA、UX-01C 成人票價與路線圖。 |
| `python3 scripts/test-nearby-bus-fares.py` | 2/2 PASS。 |
| `node scripts/test-facility-favorites.cjs`、`node scripts/test-global-search.cjs`、`node scripts/test-global-search-navigation.cjs` | PASS。巴士收藏、首頁置頂、全域搜尋資料及導航。 |
| `node scripts/test-native-link-security.cjs` | PASS。冷啟動、前景深層連結及既有 ETA 身分。 |
| `node node_modules/expo/bin/cli export --platform ios --output-dir <臨時目錄>` | PASS。Metro／Hermes 匯出約 5.6 MB JS bytecode，使用現有 33 項資產。兩張參考稿只在文件目錄。 |
| `git diff --check` | PASS。 |

## iPhone 人工驗收

1. 在繁中和 English 模式查看首頁，核對交通快捷卡雙圖示及文字、常用區標題、B2 卡片、天氣警告、其他快捷卡和「新增常用巴士」。
2. 點按交通查詢並確認原生返回鍵和邊緣手勢可回首頁。橫向滑到專線小巴，逐個核對五種未接入狀態。用窄屏、大字和 VoiceOver 檢查每個篩選名稱及選中狀態。
3. 在已允許定位的 iPhone 進入交通查詢，確認預設「全部」自動定位。切換各交通方式再回巴士，確認選定位置、搜尋範圍及按路線／按車站狀態保留。首次未授權時，以手動定位按鈕申請，拒絕後仍可選地標。
4. 定位尚在等待時手動選地標，再切換交通方式，返回巴士時確認地標保留。用真實站點檢查距離、班次、營辦商備註、限定服務及有效期間內的成人票價。
5. 從交通頁進入巴士路線搜尋、附近車站詳情、路線詳情、路線圖及完整 ETA，逐一返回。試用既有收藏／置頂、全域搜尋與舊深層連結。

## Git 狀態

開工基線為 `develop` 的 `b323e6a024a1c75b17e9fa679096903b60d6796e`，與本機追蹤的 `origin/develop` 相同。UX-01A／01B／01C 均有提交。兩張參考圖開工時已在工作區且未被 Git 追蹤。`main` 和 `v1.0.0` 指向已發布提交 `f35d593f538e02803082e13dfb71b906c1b2675e`。本輪有 8 個修改、3 個新增檔，另有原來的兩張未追蹤圖。無暫存變更，App Marketing Version 仍為 `1.0.0`。未啟動模擬器或真機，未執行正式構建、Apple 上傳、提交、推送或合併。
