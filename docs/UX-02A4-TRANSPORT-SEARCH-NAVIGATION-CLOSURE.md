# UX-02A4 交通查詢入口、頁內搜尋與切換樣式

實作與自動化驗證已完成。iPhone 排版、鍵盤與原生手勢待開發者人工驗收。

## 問題及調整

| 反饋 | 原因 | 本輪結果 |
| --- | --- | --- |
| 首頁新增常用路線開啟舊入口 | 首頁兩個「新增常用路線」按鈕共用指向 `/bus` 的連結。 | 兩處皆用既有 Expo Router `navigate` 開啟 `/transport?intent=add-frequent-route`。 |
| 交通頁搜尋需要再跳一頁 | 白色搜尋欄實際是開啟 `/bus` 的可點按卡片。 | 在同頁輸入路線編號、起點、終點或營辦商。只有點按結果才推入路線詳情。 |
| 路線／車站切換使用深色實心 | 交通頁直接繼承共用巴士頁的實心選中樣式。 | 交通頁使用既有淺灰青軌道及薄荷青選中底色；選中字和圖標用海港青，其餘用灰青。保留膠囊、選中狀態及觸控尺寸。舊 `/bus/nearby` 使用原樣式。 |

## 首頁收藏流程及返回

- 「新增常用路線」開啟巴士篩選並要求輸入框首次聚焦。附近結果狀態顯示「搜尋路線並選擇上車站，即可加入常用。」一般「交通查詢」捷徑開啟全部篩選，沿用普通入口的焦點和文案。
- 搜尋 → 點按現有巴士結果行 → `/bus/route`（原路線 ID）→ 選服務方向及上車站 → 使用原有車站收藏或全量 ETA 內收藏。現有收藏和首頁置頂規則繼續生效，車站快捷收藏後可在原收藏管理頁置頂。
- 「查看全部」沿用 `/saved?category=buses`。詳情返回原交通頁實例，查詢保持。交通頁返回首頁。舊 `/bus`、附近巴士、站點、ETA、路線圖及深層連結保留。

## 搜尋與附近狀態

- 「全部」和「巴士」的輸入提示分別為「搜尋交通路線」和「搜尋巴士路線」。兩者結果標題均明示為巴士路線。其他五個方式保留未接入狀態，隱藏輸入及結果。切回支援方式可繼續先前輸入。
- 首次有效輸入啟用既有 `useBusCatalogue`。它沿用 `bus-data.ts` 的 SQLite 目錄快取、有效期、既有官方目錄 URL 及下載去重。查詢詞在本機以 `normalizeBusQuery` 和 `matchBusRoutes` 作比對及排序。結果用原 `BusRouteRow`，保留營辦商、方向和服務變體身份。
- 匹配沿用舊搜尋的記憶化同步計算，以當前正規化查詢和當前目錄決定結果。輸入變更不啟動獨立網絡查詢。目錄尚未取得時顯示載入，來源失敗時保留可用資料並提供重試，目錄載入後才顯示無相符結果。
- 頁內搜尋暫時取代附近列表，停止為可見附近路線輪詢 ETA。清空或取消後復原原地標、按路線／按車站和距離篩選。取消及開啟詳情會收起鍵盤。
- 搜尋欄與交通篩選置於列表外，GPS、範圍或結果列表更新時輸入框保持掛載。結果列表採用 iOS 鍵盤 inset 及可點按結果的設定。輸入不觸發 GPS，原有回焦與回前景定位仍按原方式運作。

## 修改文件

| 文件 | 變更 |
| --- | --- |
| `src/app/(tabs)/index.tsx` | 僅調整首頁新增常用路線目的地。 |
| `src/app/transport.tsx` | 讀取新增常用路線的入口意圖。 |
| `src/app/bus/nearby.tsx` | 接入目錄搜尋，分離搜尋和附近結果，調整交通頁專用切換樣式。 |
| `src/components/transport-ui.tsx` | 真實輸入框、清空、取消、鍵盤及交通篩選點按。 |
| `src/i18n.ts` | 港式繁中及英文的入口指引和巴士結果標題。 |
| `scripts/test-nearby-bus-location.cjs` | 頁內搜尋、定位隔離、狀態恢復、雙語和切換樣式。 |
| `scripts/test-global-search-ui.cjs`、`scripts/test-bus-route-map.cjs` | 首頁入口、路由參數、避免重複導航及返回回歸。 |
| 本報告 | 實施與驗收紀錄。 |

## 自動化驗證

| 命令 | 結果 |
| --- | --- |
| `npm run typecheck` | PASS |
| `node scripts/test-nearby-bus-location.cjs` | 18/18 PASS。包括雙語焦點配置和指引、實際匹配與排序函式、快速輸入、延遲目錄和模式切換、按鍵行為、清空和取消恢復、定位及距離。 |
| `node scripts/test-bus-route-map.cjs` | PASS。原生 Stack 路由狀態、既有路由、方向及變體身份、路線圖、ETA、限定服務及成人車費。 |
| `node scripts/test-global-search-ui.cjs` | PASS。首頁兩種新增入口、既有查看全部、置頂 B2 及全域搜尋 UI。 |
| `node scripts/test-global-search-navigation.cjs`、`node scripts/test-global-search.cjs` | PASS。全域搜尋身分、資料和四類導航。 |
| `node scripts/test-facility-favorites.cjs` | PASS。收藏、首頁置頂、車站快捷收藏及 SQLite。 |
| `node scripts/test-native-link-security.cjs` | PASS。深層連結及現有路由。 |
| `python3 scripts/test-nearby-bus-fares.py` | 2/2 PASS。 |
| `git diff --check` | PASS，另核對本輪涉及的未追蹤文字檔案。 |

搜尋定向測試使用營辦商格式的路線樣本和控制式目錄載入，定位回歸使用測試環境的真實站點快照。原生鍵盤時序、VoiceOver 及原生返回手勢須在 iPhone 驗收。

## iPhone 人工驗收

1. 從首頁的空狀態及已有置頂卡片的狀態點「新增常用路線」。確認只進入一個交通頁、巴士已選、鍵盤可用及指引清楚。從一般「交通查詢」進入時核對全部篩選及兩種文案。
2. 在 iPhone 17 Pro 及較小 iPhone 以繁中、英文和大字搜尋 `B2`、`268X`、地名及無相符字詞。滑動鍵盤上方結果，點按詳情及用原生手勢返回。核對清空、取消、快速改詞、未接入方式及返回巴士。
3. 選擇服務方向及上車站並收藏。核對「查看全部」、首頁置頂及 ETA，包含從完整到站頁保存的流程。
4. 關閉搜尋後核對淺色按路線／按車站切換、原距離範圍和 ⓘ。在定位中及權限被拒絕時核對搜尋仍可用。用 VoiceOver 檢查輸入欄、清空按鈕及選中狀態。

## Git

`develop` HEAD 為 `b323e6a024a1c75b17e9fa679096903b60d6796e`，與本機追蹤的 `origin/develop` 一致。工作區共 8 個已修改和 9 個未追蹤檔案，無暫存。未追蹤檔案包括 UX-02A 至 A4 五份報告、兩張原設計圖及 `src/app/transport.tsx`、`src/components/transport-ui.tsx`。

前四輪已有工作保留。未執行提交、合併、推送、模擬器、真機、EAS Build、部署或 App Store 上傳。
