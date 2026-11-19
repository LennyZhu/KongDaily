# KongDaily · UI-02D1 巴士站點地圖

## 基線與交付

- `develop` 的工作基線為 `00a4efb6eb533dc912babbbe7b8ac1b5ce3e6342`，與本地 `origin/develop` 及 `git ls-remote` 的 GitHub 回應一致。
- 開始時 UI-02D0 報告為未追蹤檔案。已保留原檔、未納入任何變更，核對 SHA-256 為 `63388e08f0c6386d65cf1c4efce2257bba3fd5131a857a8459679b6c1d61111f`。本輪新增實施文件、站點地圖和定向測試。[UI-02D0 核驗報告](UI-02D0-BUS-ROUTE-MAP-FEASIBILITY.md)
- 已查看原 UI-02 高保真，沿用海港青、暖白、既有 SF Symbols 及圓角卡片。沒有新增圖片或高保真稿。[原 UI-02 設計](design/ui-02-approved.png)

## 入口、身份與返回

1. 從 `/bus` 點「路線圖」會聚焦原搜尋框，提示選擇路線，再在詳情確認行車方向和服務類型。沿用同一條搜尋、歷史及結果路徑。使用者仍可取消提示並普通搜尋。
2. 在 `/bus/route` 使用現有方向和服務選項，點「查看路線圖」把正在顯示的具體路線推入獨立 Stack `/bus/route-map`。九巴／龍運帶包含 O／I 及 service type 的目錄 ID，城巴帶目錄 ID 和獨立方向，嶼巴帶營辦商原 routeId。地圖透過同一目錄驗證參數。欠缺或矛盾的方向、找不到的目錄項均導回搜尋或上一頁。隨同帶入的停靠必須同時符合 stop ID 與站序。
3. 地圖固定顯示該次已選的方向及變體。原生返回保留底層詳情的方向、上車站及捲動；換線、方向或服務使用原詳情的選擇器。由巴士查詢進入的流程是「搜尋 → 路線詳情 → 路線圖」，返回依同一 Stack 回到詳情與查詢。沿用四個主 Tab。

## 站點、MapKit 與 ETA

- `useRouteSequences` 仍提供營辦商有向站序及現有 SQLite 快取。標記使用正式序號，鍵以 `routeStopKey`、站點 ID、停靠序號組成。同一站重複停靠保留兩個身份；同座標標記重疊時，可用無障礙站序列表選中任一筆。
- 先從既有 `nearby_bus_stops` 按營辦商與唯一 stop ID 批量讀座標和名稱。缺項以同營辦商正式回應補充。嶼巴用已載入的 route-stop 座標字段；九巴／龍運、城巴只為缺項復用既有站點詳情快取、請求去重及節流。不發起全站下載。所有候選保持通過現有香港服務範圍和 WGS84 數值校驗。嶼巴 B2／B2P 站位 `152` 沿用本機及正式營辦商坐標 `22.497433, 113.950509`。
- 使用附近已採用的 `react-native-maps`／iOS MapKit 和共用錯誤邊界。首次載入以可見站點範圍定位，使用者移動地圖後避免背景座標補全把鏡頭拉回。每個有效停靠各有一個標記；選中狀態有高亮、無障礙狀態及可見的站點卡。未知坐標只保留文字列。
- 點標記或列表選站，再由底部卡打開 `/bus/eta`。路線詳情和站點圖共用停靠摘要及既有 ETA 路由。城巴保留前導零和終點站 ID，嶼巴重複停靠保留原旗標。到站查詢及收藏仍在原站點詳情完成，收藏和首頁置頂規則沿用現有 Repository。
- 線上站序更新失敗時沿用已有快取並標記快取時間。缺部分坐標時顯示可繪站數與缺項，另可重試；全線無可靠坐標時仍可在列表開 ETA。MapKit 載入逾時或渲染錯誤時可重試，站序及 ETA 入口仍可用。MapKit 的就緒事件無法證實底圖瓦片已載入，頁面提示需要網絡的可能性。

## UI-02D2 接入點

`buildBusMapStops` 回傳既有路線鍵、有序停靠、已校驗標記及本輪的 `stops_only`／`unavailable` 狀態。後續 verified／ambiguous 結果可由獨立的證據校驗接入這份資料，綁定同一路線鍵與當前有序停靠，再增加可繪類型。本輪沒有幾何資產、Provider 對照表、折線元件、站點連線或車輛位置。

## 文件與程式變更

| 路徑 | 變更 |
| --- | --- |
| [巴士查詢](../src/app/bus.tsx)、[巴士捷徑](../src/components/bus-ui.tsx) | 啟用「路線圖」及使用原搜尋選線。 |
| [路線詳情](../src/app/bus/route.tsx)、[根 Stack](../src/app/_layout.tsx)、[雙語文案](../src/i18n.ts) | 按已選方向和服務開圖、註冊原生標題、雙語提示。 |
| [站點圖頁面](../src/app/bus/route-map.tsx)、[MapKit 站點元件](../src/components/bus-stop-map.tsx)、[站點圖資料](../src/bus-route-map.ts) | 新增獨立站點圖、站序列表、選站及驗證。 |
| [巴士停靠摘要](../src/bus-favorites.ts)、[站序 Adapter](../src/bus-stops.ts)、[本地座標查詢](../src/nearby-bus-data.ts) | 共用 ETA 身份，從現有正式來源讀有欄位的點座標與名稱。 |
| [地圖錯誤邊界](../src/components/map-boundary.tsx)、[附近設施地圖](../src/components/nearby-facilities-map.tsx) | 抽出共同的錯誤邊界，附近地圖原行為沿用原程式。 |
| [定向測試](../scripts/test-bus-route-map.cjs) | 驗證三個來源的正式資料樣本、標記與選站、Expo Router 返回和兩語。 |

## 自動化驗證

| 檢查 | 結果 |
| --- | --- |
| `npm run typecheck` | 通過。 |
| `node scripts/test-bus-route-map.cjs` | 通過。從打包座標及反向站序核對 12 個有向選項、同號、特班、循環、B2／B2P、缺座標回退、地圖及文字列選站。運行實際按鈕處理及路由參數還原，核對兩語和原路線返回。 |
| `node scripts/test-facility-favorites.cjs` | 通過。SQLite v8、原站點快捷收藏、巴士收藏、首頁置頂和附近／收藏跳轉。 |
| `node scripts/test-explore-trailhead-navigation.cjs` | 通過。根 Stack 新增畫面後，首頁與探索返回、兩語及外部地圖行為定向回歸。 |
| iOS Metro `expo export --platform ios` | 離線匯出通過，1,271 模組，約 5.3 MB Hermes bundle。 |
| Git／空白與 UI-02D0 SHA-256 | 通過。工作區保留原未追蹤審計報告，新增及修改清單見上。依賴、正式資料及 SQLite Schema 無修改。 |

## iPhone 人工驗收

1. 從「巴士查詢」點「路線圖」，選九巴 1；在詳情先確認「往……」再開圖。核對第一、最後一站、官方序號及兩程的位置。返回檢查再次打開仍是同一方向。另搜尋城巴 1，確認兩個營辦商的路線不互換。
2. 對 268X 比較去程 service type 1、3 與回程。對 10／296A 循環線，用站序選始末重合站，分別進入正確的序號 ETA。
3. 從城巴 23 點地圖標記與列表行，進入 ETA 詳情檢查方向及站名，再返回核對選中狀態。從 ETA 收藏一次，檢查收藏和首頁置頂規則。
4. 分別打開 B2 routeId 37／38 與 B2P 33／34，核對深圳灣站仍用原營辦商位置。頁面應僅呈現站點與站序。
5. 用有快取的飛航模式測試站序、底圖缺失時的列表、重試及返回。用城巴索引覆蓋外的有效路線測試官方站點詳情補座標；有缺項時仍可選文字列。核對中英文、大字、VoiceOver、邊緣返回手勢、相機範圍及 Apple 地圖署名。

本輪驗證未啟動模擬器或真機。MapKit 原生手勢、底圖、版面及 VoiceOver 待上述人工驗收。沒有提交、推送或合併。
