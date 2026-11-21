# UX-02B5A2 鐵路目錄定位範圍修正

港鐵及輕鐵目錄從詳情返回或回到 App 前台時，跳過巴士定位和權限查詢。由鐵路切回「全部／巴士」附近結果時，原有位置及結果會先保留，再按既有權限流程刷新。iPhone 人工驗收仍待開發者完成。

## 根因與修正

`/transport` 復用 `NearbyBusScreen`。它原本在 `useFocusEffect` 啟動時直接呼叫 `resumeLocation`，並在 AppState 回到 `active` 時再次呼叫。這兩條路徑都進入 `requestLocation(false)`，因為 effect 未判斷畫面正在使用哪類結果，切至靜態鐵路目錄後仍會檢查定位服務、權限及取得前台定位。新增測試在改動前重現兩條路徑，每種鐵路均額外呼叫兩次。

`src/app/bus/nearby.tsx` 的定位 effect 現在只在 `showBuses && !searching` 時運作。該條件涵蓋舊附近巴士頁，以及 `/transport` 中未輸入搜尋詞、正在顯示附近結果的「全部／巴士」。港鐵、輕鐵、未接入類別和文字結果均跳過這個定位 effect。回到附近範圍或清除搜尋時，若頁面已聚焦並位於前台，會按既有流程嘗試一次刷新。直接在無搜尋詞的「全部／巴士」之間切換，或切換「按路線／按車站」，不會重新啟動定位 effect。

離開附近範圍時沿用同一 cleanup，移除 AppState 訂閱並中止 JavaScript 層的在途流程。已交給 iOS 的單次位置取得可能仍完成，遲到的結果會忽略。暫停時保留上次參考位置、巴士結果、搜尋詞、模式和範圍。手動地標仍優先，首次授權、主動定位及權限失敗恢復走原有路徑。範圍仍為 500／1000／2000 米，預設 500 米。港鐵與輕鐵預報有自己的焦點和前台刷新 hook，繼續獨立運作。

## 修改檔案

- `src/app/bus/nearby.tsx` 修改定位 effect 的啟用條件。
- `scripts/test-nearby-bus-location.cjs` 新增港鐵及輕鐵兩條定向測試，涵蓋遲到定位、詳情返回、前台恢復、列表位置與切回附近結果。既有測試仍核對資料及導航，請求次數改按各階段斷言，確認在搜尋或不需定位的類別不啟動定位，回到附近結果時只啟動一次。
- `docs/UX-02B5A2-RAILWAY-LOCATION-SCOPE-FIX.md` 記錄實作及驗收。

## 自動化驗證

| 檢查 | 結果 |
| --- | --- |
| `npm run typecheck` | 通過。 |
| `node --test` 交通定位與切換定向篩選 | 9/9。涵蓋權限及異常、手動地標、兩種鐵路返回／前台恢復、切回附近巴士及混合搜尋。 |
| `node --test scripts/test-nearby-bus-location.cjs scripts/test-mtr-next-train.cjs` | 60/60，交通 36、鐵路即時 24。包含離線目錄與混合搜尋、雙語、列表狀態、705／706、鐵路前台刷新、過期、429、月台與舊回應隔離。鐵路測試於非香港程序時區執行，包含兩項先前擷取的官方回應離線重播。 |
| `node scripts/test-bus-route-map.cjs`、`python3 scripts/test-nearby-bus-fares.py` | 通過巴士 ETA、路線圖、限定服務、車費和到期保護。 |
| `node scripts/test-global-search.cjs`、`node scripts/test-global-search-ui.cjs`、`node scripts/test-global-search-navigation.cjs`、`node scripts/test-facility-favorites.cjs`、`node scripts/test-native-link-security.cjs` | 通過全域搜尋、收藏、置頂及深層連結回歸。 |
| 離線 iOS Metro／Hermes | 通過，已於獨立暫存目錄確認 `.hbc` 產物。 |
| `git diff --check` | 通過。 |

Node 使用 22.13.0。核心測試設定 `TZ=America/New_York`，以 `MTR_PROBE_DIR` 和 `LIGHT_RAIL_PROBE_DIR` 指向既有暫存官方樣本。測試沒有發出新即時交通請求。

## iPhone 人工驗收

1. 授權前台定位，從首頁進入「全部」附近結果。核對位置及列表，切至「巴士」，把範圍設為 1 公里，從詳情返回並確認列表位置。
2. 進入港鐵及輕鐵的車站目錄，分別從站點詳情返回及將 App 送到背景再回前台。確認目錄保留，沒有新的巴士定位。已啟動的單次定位可能短暫延續系統位置指示。停留在鐵路站詳情時，另外檢查列車預報可正常刷新。
3. 從港鐵切回巴士、從輕鐵切回全部，確認先前選定範圍及結果保留，然後正常更新。拒絕定位時檢查手動地標可用，切換前後手動選擇保持優先。
4. 在「全部」搜尋「元朗」或 `Yuen Long`，核對來源及返回後的查詢狀態。清除搜尋後確認恢復附近巴士。

### 重複導航待驗

沿用 [B5A-03 審計記錄](UX-02B5A-MULTIMODAL-TRANSPORT-INTEGRATION-AUDIT.md)。港鐵、輕鐵列使用 `router.push`，兩條根 Stack 入口沒有針對相同目的地的防重複設定。測試 reducer 已知兩次事件可產生兩頁，iPhone 能否實際送出兩次仍待確認。可從交通查詢快速連點金鐘站或海皇路站的同一列，再按一次返回。若仍停在相同詳情，記錄站點、點按方式、是否要再返回一次，並用邊緣手勢重試。此項留待開發者確認後決定是否修復，本輪未觀察到新的確定性 P0／P1。

## Git 狀態

開工時 `develop` 工作區乾淨。HEAD 和本機 `origin/develop` 均為 `2ee25cef09f7570f64534b3c83b7d51c41a7e130`，已包含 UX-02B5A 審計報告。本輪共兩個已追蹤檔案修改及一份新增報告，均留在工作區等待驗收。
