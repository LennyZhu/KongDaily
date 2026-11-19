# KongDaily · SRCH-01C2A 搜尋初始頁插圖精修

## 修改檔案

- [`src/app/search.tsx`](../src/app/search.tsx) 在空白搜尋的導引頁替換中央插圖。
- [`src/components/search-harbour-illustration.tsx`](../src/components/search-harbour-illustration.tsx) 使用 React Native `View` 繪製本地向量插圖，沿用既有海港青與暖白色系，對 VoiceOver 隱藏裝飾圖形。插圖為 224 × 88 pt，比原本的 76 pt 插圖區高 12 pt，保留原有周圍間距。

## 設計對照

以雙層巴士及天星小輪建立前景，背後用港島山線、圓頂 IFC 與帶斜線的中銀大廈勾出維港輪廓。巴士和小輪採用較深的海港青，遠景顏色保持較淡，讓搜尋框及四類指引維持原有層級。

已查看[獲批准的初始頁高保真](design/srch-01b-search-initial-review.png)。新版延續巴士、海港、小輪及天際線的構圖，將樹叢、雲朵、窗格與紋理簡化為較小的扁平插畫。插圖使用本地程式繪製，無新增圖片來源、依賴或網路請求。搜尋結果、展開列表、文案及導航沿用原有實作。

## 驗證

- `npm run typecheck` 通過。
- `node scripts/test-global-search-ui.cjs` 通過，涵蓋首頁入口、初始頁、雙語查詢、分組展開及來源狀態。
- `git diff --check` 通過，另檢查本輪新增檔案的空白格式。
- 離線 iOS Metro 匯出通過，共 1,277 個模組。
- 已查看以目前初始頁元件及插圖樣式產生的桌面瀏覽器靜態預覽。Stack 標題列與周圍圖示為預覽替代，iOS 的實際呈現待人工確認。

## Git 狀態

`develop` 的 HEAD 為 `fb339675a2fff68c2b44aebfa6287d170a605988`，與本機 `origin/develop` 追蹤參照相同。原有未提交的 SRCH-01C2 變更與本輪三個檔案的調整均留在工作區，等待開發者驗收。
