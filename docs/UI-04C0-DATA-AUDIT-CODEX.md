# KongDaily · UI-04C0 官方公園及寵物公園資料可行性審計

**本指令只讀分析，禁止改動 App 源碼或寫入正式資料索引。**

項目 `/Users/zhushunli/Desktop/project/KongDaily`，分支 `develop`。

## 0. 開始前
- `git branch --show-current && git status --short && git rev-parse HEAD`；不 reset、不 clean。
- 完整閱讀 `docs/UI-04C-DESIGN-REVIEW.md`，實際查看四張 `docs/design/ui-04c-*-review.png` 圖稿。
- 閱讀現有 `src/facilities.ts`、`src/app/(tabs)/nearby.tsx`、`src/components/nearby-facilities-map.tsx`、`src/nearby-place-search.ts`、`src/facility-navigation.ts` 及 FEHD/AFCD 建置腳本（以實際倉庫檔名為準）。

## 1. 正式來源驗證
- LCSD CSDI Parks, Zoos and Gardens：從官方 DATA.GOV.HK 資源頁開啟當前 CSDI 下載／WFS／ArcGIS API，實測完整資料、頁數、原始筆數、日期、圖層、欄位、資料型態、ID 穩定性、WGS84 或其他 CRS。禁止猜 URI。
- LCSD 狗公園／寵物公園官方 `ftid=47`、寵物共享公園 `ftid=165` TC/EN 明細與官方規則頁，核對實際範圍、類型、地址、時間、備註及更新日期。
- 檢查是否有官方穩定 ID／精確場地坐標（尤其 `指定範圍`）。如果沒有，明確列為阻塞／待人工核實，不能用未驗證的地點搜尋結果當寵物區入口。
- 對疑似同名／重疊的公園與寵物場地，統計候選匹配但不自動合併。記錄跨語言配對策略及來源證據。
- 審計著作權／商業 App 使用／來源署名／素材下載條款；本階段不下載官方照片到 App。

## 2. 資料品質要求
報告各來源原始筆數、有坐標筆數、雙語配對筆數、有效 ID 筆數、缺失地址／時間筆數、重複／衝突及不明區域筆數。只填實測數字，不預設已收錄多少公園或寵物園。

按類型提出模型：`park`、`dedicated_pet_garden`、`inclusive_park_for_pets`、`designated_area_only`、官方來源／身份／更新時間／標籤證據；保留現有 `source + officialId` 模型並提出兼容方式。

明確區分「場地坐標」、「指定寵物區」、「入口坐標」，三者不可混同；導航僅用經核驗的官方參考點。

## 3. 交付與停止
只允許新增 `docs/ui-04c-official-data-audit.md`（若此文檔已存在則另名避免覆寫）。必要的只讀暫存數據可存 `/tmp`，不得把其混入倉庫或修改 `assets/data/`。

輸出：官方來源 URL、實際日期、欄位、測試記錄數、採集許可與限制、與現有 FEHD/AFCD 的兼容性、UI-04C1/2 可實施／阻塞事項、建議先後順序、Git 狀態。

**完成後停止；不要開始 UI-04C1/2，不修改正式數據、App、依賴或 Schema，不啟動模擬器，不提交或推送。**
