# UX-02B4B 港鐵車站詳情預報前置

港鐵車站詳情依序顯示中英文站名、下一班列車與選線膠囊、所屬綫路、官方資料來源。金鐘及中環等轉綫站可在途經綫路之前查看預報。

## 修改範圍

- `src/app/mtr/[kind].tsx` 將整個 `MtrNextTrains` 移到站名之後。元件的 key、站點及初始綫路參數沿用原值。原有綫路卡片、導航、間距和捲動容器沿用既有實作。
- `scripts/test-mtr-next-train.cjs` 擴充香港站的選線測試，切換東涌綫及機場快綫並核對選中狀態和傳入的線站組合。
- `scripts/test-nearby-bus-location.cjs` 新增繁中及英文金鐘站測試，驗證中英文站名、預報、綫路及來源的順序、預選港島綫，以及東鐵綫、港島綫、南港島綫及荃灣綫各自的詳情導航。

## 自動化驗證

| 檢查 | 結果 |
| --- | --- |
| `npm run typecheck` | 通過。 |
| `node --test scripts/test-mtr-next-train.cjs` | 港鐵定向 13/13，連同輕鐵全套 24/24。以非香港程序時區驗證香港時間，並離線重播既有官方 HTTP 樣本。涵蓋選線、方向、月台、到站／開出、過期、429 退避、前台恢復、失敗及舊回應隔離。 |
| `node --test scripts/test-nearby-bus-location.cjs` | 34/34。涵蓋雙語金鐘站、交通搜尋及篩選、路由參數，以及焦點恢復後保留搜尋結果與列表狀態。 |
| `node scripts/test-bus-route-map.cjs`、`python3 scripts/test-nearby-bus-fares.py`、`node scripts/test-global-search-navigation.cjs` | 通過巴士路線圖、ETA、限定服務、票價及全域搜尋導航回歸。 |
| `EXPO_NO_DOTENV=1 EXPO_OFFLINE=1 node_modules/.bin/expo export --platform ios --output-dir <暫存目錄>` | 通過，產出 iOS Hermes bundle。 |
| `git diff --check` | 通過。 |

靜態檢查確認選線膠囊沿用可換行容器及系統字體縮放。原生大字排版、回到車站詳情後的實際捲動位置及返回手勢待 iPhone 人工驗收。

## iPhone 人工驗收

1. 從交通查詢搜尋金鐘或中環。確認兩種語言的站名之後即見預報標題及選線膠囊，途經綫路及資料來源位於其後。
2. 在金鐘切換東鐵綫和港島綫。核對選中狀態、方向、終點、月台、香港時間和手動刷新。從港島綫詳情開啟金鐘站，再核對港島綫預選狀態。
3. 往下捲動並開啟一張綫路卡片。分別用原生返回按鈕及邊緣手勢返回車站，確認已選綫路及原來的捲動位置保留。再返回交通查詢核對搜尋詞及列表位置。
4. 切換 English 和系統大字，確認站名、選線膠囊、時間和刷新按鈕可讀且可操作。斷網重開車站，確認預報顯示既有錯誤狀態，所屬綫路仍可使用。

## Git

開工時 `develop` 工作區乾淨，HEAD 與本機 `origin/develop` 均為 `88f477bf148c956d3a19d93617463a37fb57eef7`。本輪三個已追蹤檔案有修改，本報告為新增檔案。實作與測試留在工作區，等待人工驗收。
