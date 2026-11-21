# UX-02A2 首頁文案與附近交通首屏收尾

實作與自動化檢查已完成。UX-02A2 的 iPhone 人工驗收待開發者確認。

## 首頁文案

「常用公共交通 / Frequent transport」維持原文。首頁空狀態及其新增操作使用以下文字。

| 項目 | 原繁中 | 新繁中 | 原英文 | 新英文 |
| --- | --- | --- | --- | --- |
| 空狀態標題 | 還沒有常用巴士 | 尚未加入常用路線 | No frequent buses yet | No frequent routes yet |
| 空狀態說明 | 收藏常用的巴士路線或車站，快速查看 ETA。 | 目前支援收藏巴士路線及車站，方便快速查看到站時間。 | Save bus routes or stops for quick access to arrival times. | Save your frequent bus routes or stops for quick arrival updates. |
| 首頁新增按鈕 | 新增常用巴士 | 新增常用路線 | Add a frequent bus | Add frequent route |

首頁有置頂巴士時也使用同一新增按鈕文案。兩處都開啟既有 `/bus`，由使用者在原巴士流程選擇路線或車站。「查看全部」仍開啟 `/saved?category=buses`，收藏頁保留自己的原有文案。

## 附近交通

- 參考位置卡成為 `/transport` 列表首個模組。原生「附近交通」標題與返回按鈕仍由原 Stack 提供。移除了列表內的說明及天際線裝飾，保留首頁使用的天際線資源。
- 「定位 / Locate」與「選擇地標 / Choose a landmark」並排放入參考位置卡，窄屏與大字時可以換行，保留至少 44pt 的觸控高度。定位按鈕的無障礙名稱仍為完整的「使用目前位置」。地標選擇在卡片下方展開，沿用原清單、座標與選中邏輯。
- 「定位」繼續呼叫既有主動定位函式。重返頁面、回到前景、已授權自動定位、首次主動授權、拒絕或失敗後手動選擇、手動地標優先和 GPS 取消邏輯都沿用原實作。
- 結果標題旁的距離按鈕使用當前範圍，仍提供 500 米、1 公里及 2 公里。旁邊獨立的 ⓘ 可在同頁展開及收起直線距離和覆蓋說明。按路線顯示營辦商路線覆蓋限制，按車站顯示原有城巴站點覆蓋限制。其餘五種尚未接入的交通方式不顯示距離控制或說明。
- 七種交通方式、橫向箭頭、兩種搜尋標籤、巴士搜尋路由與底部安全區維持既有行為。舊 `/bus/nearby` 維持原有定位、地標控制及常駐說明。

## 修改文件

| 文件 | 修改 |
| --- | --- |
| `src/app/(tabs)/index.tsx` | 首頁兩處新增按鈕共用首頁專用文案，其餘程式碼與開工時一致。 |
| `src/i18n.ts` | 雙語空狀態、首頁專用按鈕及交通頁精簡操作文案。 |
| `src/app/bus/nearby.tsx` | `/transport` 位置卡、地標清單位置及可展開的距離資訊。 |
| `src/components/transport-ui.tsx` | 移除只用於交通頁的獨立裝飾。 |
| `scripts/test-global-search-ui.cjs` | 兩種語言首頁空狀態、新增、查看全部。 |
| `scripts/test-bus-route-map.cjs` | 首頁進入既有巴士搜尋的 Stack 返回。 |
| `scripts/test-nearby-bus-location.cjs` | 交通頁精簡結構、雙語距離資訊、真實範圍切換及地標競態。 |
| 本報告 | 變更、驗證與人工驗收記錄。 |

## 自動化驗證

| 命令 | 結果 |
| --- | --- |
| `npm run typecheck` | PASS |
| `node scripts/test-global-search-ui.cjs` | PASS，首頁雙語空狀態、置頂 B2、既有巴士搜尋與查看全部入口、全域搜尋 UI。 |
| `node scripts/test-nearby-bus-location.cjs` | 13/13 PASS，首屏列表結構、雙語提示、範圍切換、模式及搜尋、定位授權與回焦、重試、地標競態與距離排序。 |
| `node scripts/test-bus-route-map.cjs` | PASS，Stack 返回、站序與路線圖、ETA、限定服務與已核實成人車費。 |
| `node scripts/test-facility-favorites.cjs` | PASS，SQLite 收藏、置頂及車站快捷收藏。 |
| `node scripts/test-global-search-navigation.cjs` | PASS，四類搜尋導航。 |
| `node scripts/test-native-link-security.cjs` | PASS，原有深層連結與 ETA 身份。 |
| `python3 scripts/test-nearby-bus-fares.py` | 2/2 PASS。 |
| `git diff --check` | PASS。另檢查本輪涉及的未追蹤文字檔案。 |

## iPhone 人工驗收

1. 以繁中及 English 查看首頁空狀態。點「新增常用路線」，確認能進入原巴士路線或車站收藏流程並返回。點「查看全部」確認進入巴士收藏。已有置頂時確認首頁卡片及 ETA 正常。
2. 在 iPhone 17 Pro 及較小 iPhone 查看 `/transport`。確認原生導航下直接顯示位置卡，首頁天際線仍顯示。在大字及 VoiceOver 下檢查兩個位置操作及 ⓘ。
3. 驗收已授權自動定位、拒絕後選地標、定位失敗後重試、切換手動地標後保持選點，以及返回頁面時的位置行為。
4. 切換 500 米、1 公里及 2 公里，核對顯示與結果。點 ⓘ 核對說明可展開、可收起。切換按路線／按車站及未接入模式，確認顯示適用的說明。

## Git

`develop` HEAD 為 `b323e6a024a1c75b17e9fa679096903b60d6796e`，與本機追蹤的 `origin/develop` 一致。`main` 與 `v1.0.0` 沿用已發佈提交。原 UX-02A 與 UX-02A1 報告和設計檔內容雜湊一致。工作區保留三輪改動，合計 8 個已修改檔案、6 個未追蹤檔案，無暫存。未執行提交、推送、合併、模擬器、真機、正式構建或 Apple 上傳。
