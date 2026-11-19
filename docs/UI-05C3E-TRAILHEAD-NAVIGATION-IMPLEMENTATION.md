# KongDaily · UI-05C3-E 行山起點步行導航

2026-11-19（香港時間）。本輪為龍脊及山頂環迴步行徑接入「步行至起點」。使用者已確認兩個 Apple Maps 測試連結的定位針和步行路線均人工驗收 PASS，已補記到 UI-05C3-D。以下自動化結果只涵蓋 KongDaily 的整合，iPhone 端整合仍待使用者驗收。[導航目的地審計](UI-05C3A-NAVIGATION-AUDIT.md) · [座標複核與使用者人工回報](UI-05C3D-NAVIGATION-POINT-VERIFICATION.md)

## 核准目的地

| 穩定 ID | 正式目的地（繁中／English） | WGS84（緯度、經度） | Apple Maps |
| --- | --- | --- | --- |
| `dragons-back-to-tei-wan-tai-tam-gap` | 石澳道土地灣港島徑入口／To Tei Wan Trailhead, Shek O Road | `22.2270299568, 114.2397903557` | [步行至起點](https://maps.apple.com/directions?destination=22.2270299568,114.2397903557&mode=walking) |
| `peak-circle-walk` | 凌霄閣西側盧吉道入口／Lugard Road Trailhead, near The Peak Tower | `22.2712927825, 114.1494947398` | [Walk to trailhead](https://maps.apple.com/directions?destination=22.2712927825,114.1494947398&mode=walking) |

兩筆使用 `navigation.status: 'verified'`，`destination` 保存雙語起點名稱、`role: 'trailhead'`、帶 WGS84 及原始官方 GPX URL 的座標、既有官方證據 ID、核驗報告路徑及本次核准記錄日期。官方 GPX 放在導航物件作座標出處，既有 39 個公開來源 URL 保持原樣。八個穩定 ID、18 條雙語看點、所有分類、排序及正文均與原版一致。導航 URL 由兩個正式座標值直接產生，精度未調整，路線名稱及終點仍留在各自的介紹和交通資料中。[正式資料](../assets/data/explore-places.json) · [資料模型與 URL 產生](../src/explore-places.ts)

## 顯示與外部開啟

- 詳情把導航區放在官方資料之後，隨內容捲動。整合使用現有海港青主按鈕、圓角、44 pt 最小高度及可換行文字。VoiceOver 的按鈕名稱包含動作與具名起點，提示 Apple Maps 的用途。
- 僅在 iOS 18.4 以上，且 ID、行山分類、`verified`、`trailhead`、WGS84 與座標範圍檢查均通過時顯示。六個 `unverified` 地點不渲染整個區塊。未知 ID 仍顯示原有不可用提示。兩個精確座標由資料測試固定比對，執行時直接從本機 JSON 讀取。[Apple Unified Maps URLs](https://developer.apple.com/documentation/mapkit/unified-map-urls)
- 按下後只呼叫 `Linking.openURL`，並防止開啟中的重複點按。例外或拒絕會在原詳情顯示本地化提示，可取消或重試相同 URL。兩種操作都保留原詳情與分類。Apple Maps 負責起點及路線規劃，可能需要網絡。KongDaily 的文字詳情仍可離線閱讀。Apple Maps 開啟後的路線錯誤由 Apple Maps 顯示，KongDaily 無法得知其規劃結果。[詳情頁](../src/app/explore/place/%5Bid%5D.tsx)

## 檔案

- [正式資料](../assets/data/explore-places.json) 只更新兩筆 `navigation`。
- [探索資料模型](../src/explore-places.ts) 記錄原始官方 GPX 與報告路徑，限制兩個已核准 ID 並產生步行 URL。
- [探索詳情](../src/app/explore/place/%5Bid%5D.tsx) 加入原生版本門檻與可捲動的導航區，沿用官方連結的錯誤及重試流程。
- [雙語字典](../src/i18n.ts) 加入繁中及英文的目的地、按鈕、提示與錯誤標題。
- [探索資料測試](../scripts/test-explore-places.cjs) 固定兩個核准目的地及其他六筆的未核實狀態。
- [導航定向測試](../scripts/test-explore-trailhead-navigation.cjs) 驗證 TSX 呈現、點按、錯誤重試及堆疊返回。
- [UI-05C3-D 既有報告](UI-05C3D-NAVIGATION-POINT-VERIFICATION.md) 保留原始核驗，補記使用者手動驗收。新增本實施記錄。

## 自動檢查

| 檢查 | 結果 |
| --- | --- |
| `npm run typecheck` | 通過 |
| `node scripts/test-explore-places.cjs` | 通過。8 地點、18 條雙語看點、39 個來源、2 處已核實起點及 6 處未核實 |
| `node scripts/test-explore-trailhead-navigation.cjs` | 通過。兩條固定 URL、中英文標籤與 VoiceOver、平台門檻、無效座標及未知 ID、離線正文、快速點按和模擬開啟失敗後重試、首頁及探索分類返回 |
| 正式 JSON 對照 HEAD | 通過。除兩個 `navigation` 物件外，解析後的正式 JSON 完全相同 |
| iOS Metro 靜態匯出 | 通過。使用 Expo 離線匯出至暫存目錄 |
| `git diff --check` | 通過。新增報告與定向測試另做空白檢查 |

定向測試使用 Node 呼叫實際元件與點按處理，並以 Expo Router 的檔案路由及堆疊 reducer 模擬返回。原生 Apple Maps 交接、VoiceOver 朗讀和 Dynamic Type 排版需在 iPhone 驗收。

## iPhone 驗收清單

1. 在 iOS 18.4 以上，從首頁龍脊卡進入詳情，捲到官方資料之後，核對「石澳道土地灣港島徑入口」。按「步行至起點」，確認 Apple Maps 為步行模式及土地灣入口。切回 KongDaily，確認原詳情及捲動位置，再返回首頁。
2. 從「行山郊遊」篩選進入山頂環迴步行徑，核對目的地為凌霄閣西側室外盧吉道入口。切回 App 並返回，確認原分類及列表位置。
3. 以 English、較大字級及 VoiceOver 核對按鈕、完整地點名稱與 Apple Maps 提示。任一未核實地點（例如西九）應無整個導航區。
4. 飛航模式下確認離線詳情仍可讀。若系統拒絕開啟連結，確認本地化提示，取消或恢復連線重試後仍處於原詳情。若 Apple Maps 已開啟而路線計算失敗，分別記錄外部地圖狀態。

## Git 狀態

`develop` 的 HEAD 為 `c30845f005ad239b37accb7887a1ef24f98e9896`，與本機 `origin/develop` 追蹤參照一致。工作區有五個本輪修改的追蹤文件及三個未追蹤文件，包含本輪開始前已存在的 UI-05C3-D 核驗報告。沒有暫存或提交。
