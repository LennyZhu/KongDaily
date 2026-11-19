# KongDaily · SRCH-01B0 全域搜尋導航契約

**結論｜設施薄 Stack 方案可進入 SRCH-01B 開發。** 以虛擬路由項執行 Expo Router 狀態推演，確認能推入根 Stack、只保留原來的一個 Tab 容器，並返回同一個 `search` route key。地圖元件已可共用，實作時只需抽出選點卡及將地圖操作設成可由宿主選用。iPhone 原生返回、地圖和搜尋位置恢復列入實作驗收。

基線為 `develop` 的 `d41aee325a2595d46e9a9d52863ff0ad74a8c556`，與本機 `origin/develop` 一致。開工時前置審計為已存在的未追蹤檔案，內容保留。[SRCH-01A 審計](SRCH-01A-GLOBAL-SEARCH-AUDIT.md)

## 1. 四類結果契約

每列結果由已取得的正式資料建構穩定鍵與參數。顯示名、營辦商標籤及語言只影響呈現和比對。一般結果以 `router.push` 打開目標，用原生返回或 `router.back()` 回到原 `/search` 實例。

| 結果 | 穩定身份及路由參數 | 目的頁責任與邊界 |
| --- | --- | --- |
| 附近設施 | `source + stableFacilityId`。**擬新增**根 Stack `/search/facility-map`，例如 `{ source: 'afcd', stableFacilityId: 'afcd-toilet-0001' }`。 | 從 Registry 查回當前官方設施、座標與類別，初始化地圖及選點卡。詳見下節。 |
| 巴士路線 | `/bus/route`，`{ routeId: route.id }`。九巴／龍運 `KMB-LWB:<號碼>:<O/I>:<serviceType>`；城巴 `CTB:<號碼>`；嶼巴 `NLB:<operatorRouteId>`。 | 維持每個營辦商來源、官方方向和服務身份。九巴／龍運依現有 Catalog ID 選方向及服務類型；嶼巴依官方 routeId 選版本；城巴目錄為 `listed`，頁面提供可用方向選擇。純路線結果不帶 `stopId`、`stopSeq` 或推測的城巴方向。 |
| 巴士站 | `/bus/nearby/stop`，`{ source, stopId }`。來源限 `kmbLwb / citybus / nlb`。站點 ID 保持字串，例如 `{ source: 'citybus', stopId: '001027' }`。 | 站點頁按來源和站 ID 讀本機站名、營辦商、街道（有值時）和已核實的反向路線。全域搜尋沒有距離起點時省略 `distance`。缺關聯時保留站點資料並提示未收錄路線。使用者在站點頁選出完整停靠後，才由既有工具開 ETA。 |
| 精選地點 | `/explore/place/[id]`，`{ id: place.id }`。 | 既有詳情以正式離線 ID 取資料，沿用來源及步道導航資格。搜尋只連正式收錄的 ID。原生 Back 在有上一頁時返回搜尋；未知 ID 頁面的內文「返回探索」目前會 `dismissTo('/explore')`，若要讓失效結果的內文按鈕也回搜尋，須在實作時使其優先返回已有 Stack。 |

路線詳情目前有兩個需如實呈現的邊界。跨語言重開同一 ID 時，`lastRouteSelection` 可恢復另一個仍有效的方向或變體；指定方向的站序無法取得時，頁面也可改顯示另一個可用方向。SRCH-01B 應測試搜尋結果初次開啟時以點選的完整 `routeId` 為優先，允許使用者之後手動切換。原資料缺失時列明目前顯示的方向，便於辨識備用站序。城巴方向若要由搜尋預選，須另驗收真正有向的資料列；目前單傳 `direction` 並不足以初始化，既有附近上車流程使用完整 `stopId + stopSeq + direction`。

巴士站結果沒有一條已選路線，因而不會由搜尋直接構造 `/bus/eta`。詳情的站點路線列才有可供 ETA 使用的營辦商、路線、方向、服務類型或嶼巴 routeId、站點 ID 及停靠序號。循環同站的不同停靠要保留各自身份；Citybus 站點與反向路線覆蓋沿用既有提示。若站點已從本機快照移除，目的頁沿用現有找不到站點的狀態，保留返回。

[巴士路線模型](../src/bus-routes.ts) · [路線詳情](../src/app/bus/route.tsx) · [站序身份](../src/bus-stops.ts) · [巴士站詳情](../src/app/bus/nearby/stop.tsx) · [反向站序](../src/nearby-stop-routes.ts) · [探索詳情](../src/app/explore/place/%5Bid%5D.tsx)

## 2. 設施薄 Stack 的實作邊界

### 2.1 身份、路由及返回

1. 結果點按時以 `resolveFacilityIdentity` 將該列的 `source + officialId` 轉成 Registry 身份。只有 `available` 可 push。目的頁再讀取兩個非空的單值字串並執行 `resolveStableFacilityIdentity`，核對資料來源、現行紀錄及香港座標。地圖的 `selectedId` 仍用解析後的現行 `facilityId(facility)`。顯示 ID／舊官方 mapID、名稱、座標及搜尋詞均留在原有用途。
2. 在 `src/app/search/facility-map.tsx` 提供一個葉路由，在根 `src/app/_layout.tsx` 註冊 `search/facility-map` 與雙語原生標題。該頁正常 push 後 Back 直接 pop；若以獨立入口到達且沒有上一頁，可用明確的「搜尋」操作回 `/search`。Stack 畫面獨立保存地圖狀態，同一搜尋畫面在下方保留。
3. 缺參數、多值參數、未知或退休的 ID 顯示「設施暫未能定位」；Registry 衝突或版本錨點不符顯示「設施資料待核實」。從搜尋點按遇到失效則留在列表提示，直接到達失效路由則顯示帶返回的空態。暫停服務的設施如身份仍可用，照常顯示官方公告。
4. 一次點按推入一個新 Stack 實例，快速連點可鎖住同一轉場。返回後可以重新點選同一設施。進入後以實例身份初始化相機和選中狀態；重新聚焦時保留使用者在該畫面的操作。收藏 Tab 的 `savedFacilityRequest` 仍供同一個已掛載 Tab 多次接收聚焦請求。

[Registry](../src/facility-identity.ts) · [設施顯示身份](../src/facilities.ts) · [收藏入口](../src/app/%28tabs%29/saved.tsx) · [Root Stack](../src/app/_layout.tsx)

### 2.2 最小共享範圍

| 現有程式 | 建議共用方式 |
| --- | --- |
| `NearbyFacilitiesMap` | 直接共用，沿用 MapKit、相機移動、選中標記、聚合、點按、錯誤邊界及重試。Stack 以經核對的座標給 `initialRegion`，以現行顯示身份給 `selectedId`；必要的寬高由該畫面量測。可沿用現有設施資料和類別計算候選標記，點按其他標記也以當前正式資料校驗。 |
| `FacilitySummary`、`FacilityDetails` 及外層選點卡 | 目前為 `(tabs)/nearby.tsx` 的內部元件，須抽出共用的選點面板及詳情顯示。共用限高可捲動卡、同座標選擇、官方開放時間／服務公告、寵物規則、收藏及外部導航；保留原列表展開的詳情組件。Stack 沒有已確認的距離起點時隱藏距離。現有 `FacilitySummary` 的距離必填，且 `FacilityDetails` 用 `distance === undefined` 推斷寵物詳情程度；抽取時以明確的地圖預覽／列表展開模式和可選距離拆開兩個概念。 |
| 地圖操作及錯誤 | 現有定位按鈕會無條件顯示，錯誤卡亦要求 `onShowList`。把定位、搜尋此區域和切換列表留為宿主可選操作；只有接上真實操作才顯示。薄 Stack 最小版本顯示地圖及選點卡，沿用地圖重試。地圖失敗時有效的官方資料卡持續可讀。 |
| `NearbyScreen` 與收藏跨 Tab | 避免抽取整頁容器。附近 Tab 持有類別／地圖列表參數、GPS、已確認搜尋中心、視口、列表偏移、LandsD 搜尋 Modal 及浮動 Tab 留白，繼續由 Tab 宿主擁有。Stack 只有自己的選中、視口及地圖事件狀態，使用原生標題和 Stack 安全區。收藏資料仍經現有共用 Hook 和 SQLite v8，同一設施可同步收藏狀態。 |

**主要風險。** 直接在 Stack 掛整個附近 Tab 畫面，會引入初次定位、Tab 路由參數及底部留白等額外行為。設定選中時只須聚焦相機，Registry 座標可用於初始視口，使用者位置及原附近 Tab 的搜尋中心留在各自原有狀態。所需抽取在卡片與宿主層級，地圖 SDK、標記演算法和設施資料模型已有可用邊界。

**最小替代方案。** 如果經原型驗證 MapKit 仍無法安全於根 Stack 宿主工作，使用同一個根 Stack 路由顯示已驗證的共用設施資料卡，保留原本適用的導航行為和返回搜尋。此方案少了 App 內地圖，需產品確認後才可採用。單次 MapKit 載入失敗可使用同一卡片並提供原來的地圖重試。

[附近畫面與選點卡](../src/app/%28tabs%29/nearby.tsx) · [可直接共用的 MapKit 元件](../src/components/nearby-facilities-map.tsx) · [相機移動](../src/nearby-map-motion.ts) · [收藏 Hook](../src/facility-favorite-hooks.ts)

## 3. 搜尋頁狀態與資料生命週期

| 要求 | 目前能力及實作契約 |
| --- | --- |
| 續用關鍵詞、篩選 | `/search` 已有獨立的 Stack 路由，現況為非受控輸入，沒有搜尋狀態。實作以該 route key 的受控文字及篩選 state 為準，首頁沿用現有搜尋入口，結果 push 及 pop 保留同一個搜尋實例。搜尋詞無須放入目的頁 URL 或寫入 SQLite。明確退出搜尋或 App 重啟可開始新一輪。 |
| 保留列表位置 | 單一虛擬列表按各類穩定鍵呈現。點結果前保存首個可見列鍵與其位移；一般 pop 先沿用既有列表位置，畫面重排或結果資料變動時才按原列鍵恢復。錨點已移除時採同一分組最近的有效位置。鍵盤收起前後的內容高度需實機驗收。 |
| 返回避免重讀 | 資料 Hook 和正規化索引綁在搜尋實例或既有共用 Repository。返回焦點不用重新掛載索引、重讀快照或強制刷新。現有 `useBusCatalogue` 的載入效果受掛載和重試控制，會合併在途請求；沿用 24 小時目錄新鮮度和失敗來源重試。點按詳情後的站序／ETA 仍由其各自快取和焦點規則負責。 |
| 雙語切換 | 使用既有根 `LanguageProvider` 的 `zh-HK / en / system`。兩語皆參與查詢，切換時重新顯示標籤，沿用原關鍵詞、篩選、穩定鍵和列表錨點。以兩語資料共同索引即可用同一組本機資料，語言變更無須重抓營辦商目錄。 |
| 離線與目錄尚未載入 | 分組辨識「尚未請求／載入中」「已取得且無命中」「較舊快取可用」「失敗且無資料」。設施及探索是打包資料；站點可離線初始化 SQLite 快照，反向路線覆蓋仍有限。巴士路線須有當前工作階段或 SQLite 目錄；冷安裝離線時提示目錄未能取得，仍顯示其他有效分組。有路線目錄也可能缺部分站序快取。可離線正文與即時 ETA／外部地圖／MapKit 瓦片各自提示。 |

[現有搜尋頁](../src/app/search.tsx) · [語言狀態](../src/language.tsx) · [巴士目錄 Hook](../src/bus-hooks.ts) · [本機站點匯入](../src/nearby-bus-data.ts)

## 4. 本輪查證與 SRCH-01B 驗收門檻

- 用已安裝 Expo Router 的路徑解析、導航狀態分歧與 Stack reducer 工具，從實際路由樹核對 `KMB-LWB:268X:O:3`、`CTB:23`、`NLB:37`、城巴站 `001027` 及探索龍脊。push 落在正確根 Stack 目的頁，pop 返回相同搜尋 route key。
- 對照收藏的 `/(tabs)/nearby` 參數。從全域搜尋發出同一個 navigate，推演得到 `(tabs) → search → (tabs)`，兩個 Tab route key 不同。以純記憶體虛擬檔案 `search/facility-map.tsx` 重新建路由樹，傳 AFCD Registry 的 `afcd-toilet-0001`，得到 `(tabs) → search → search/facility-map`。只含一個 Tab route key，返回同一搜尋 key，參數正確。虛擬檔案沒有寫入專案。
- TypeScript、現有巴士地圖、設施及巴士收藏、探索步道導航定向測試與 `git diff --check` 通過。收藏測試涵蓋 Registry 衝突、同名設施、重複定位及 GPS／搜尋中心隔離；其範圍為現有附近 Tab。
- SRCH-01B 先接薄 Stack 與共享選點卡。需覆蓋已知、未知、退休及衝突設施、同座標、快速 A／B、返回後重開、MapKit 錯誤、附近 Tab 狀態與權限隔離，再實測四類結果的 iOS 原生返回、搜尋詞、捲動錨點、雙語、VoiceOver 及離線狀態。本輪確認到路由資料層，原生行為待上述驗收。

工作區新增本契約，保留開工時已有的 SRCH-01A 報告。
