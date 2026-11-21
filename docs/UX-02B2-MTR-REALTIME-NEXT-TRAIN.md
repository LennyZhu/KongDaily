# UX-02B2 港鐵即時列車預報

**實作及自動化驗證完成。iPhone 人工驗收仍待開發者完成，資料公開分發與商業再利用仍待確認。**

## 基線與官方資料

- 開工時 `develop` 工作區乾淨。本機 HEAD、本機 `origin/develop` 和 GitHub 的 `refs/heads/develop` 都是 `3fde79cc56c5a4a88442cce0b45ef6bb4836e7be`，已包含 UX-02B1 實作和報告。
- DATA.GOV.HK 的官方入口仍指向 **API 規格及資料字典 v1.7，2025-03-13**。資料提供者和知識產權持有人為香港鐵路有限公司。官方列出的更新頻率為 10 秒，響應碼包括 HTTP 200、429 和 500。規格未列 API key、固定客戶端配額或建議輪詢間隔。 [實時資料集](https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data) [實際資源與更新資料](https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data/resource/103472ed-01be-4dda-92c6-30530dee022f) [API 規格](https://opendata.mtr.com.hk/doc/Next_Train_API_Spec_v1.7.pdf) [資料字典](https://opendata.mtr.com.hk/doc/Next_Train_DataDictionary_v1.7.pdf)
- App 使用獨立的 v1.7 線站允許清單，與現有靜態目錄交叉驗證。允許 98 個有效站點、121 組線站關係，包含 `EAL/RAC`。本輪逐項核對兩份 v1.7 PDF 的參數表，均與程式內的 121 組相符。無效組合不發出網絡請求。完整站碼見 `src/mtr-realtime.ts`。以下為每線已核對的組合數。 [v1.7 參數表](https://opendata.mtr.com.hk/doc/Next_Train_DataDictionary_v1.7.pdf)

| 綫路 | 站點數 | 綫路 | 站點數 |
| --- | ---: | --- | ---: |
| 機場快綫 AEL | 5 | 東涌綫 TCL | 8 |
| 屯馬綫 TML | 27 | 將軍澳綫 TKL | 8 |
| 東鐵綫 EAL | 16 | 南港島綫 SIL | 5 |
| 荃灣綫 TWL | 16 | 港島綫 ISL | 17 |
| 觀塘綫 KTL | 17 | 迪士尼綫 DRL | 2 |

## 官方 GET 實測

2026-11-21 香港時間。每組只發一次，時間為 HTTP Date 轉換。未在這批請求中觀察到 429、500、特別安排、停站或真實尾班事件。上述情境的其餘測試使用隔離測試資料，不造成限流或故意施壓。

| 香港時間 | `line / sta / lang` | HTTP／JSON 狀態 | 回應摘要 |
| --- | --- | --- | --- |
| 19:17:11 | `TKL / TKO / EN` | 200／1 | UP 四班，終點 `POA/LHP`、月台 1。DOWN 四班，終點 `NOP/TIK`、月台 2。站點資料時間 19:17:01。 |
| 19:17:12 | `AEL / AIR / EN` | 200／1 | 每方向四班。往博覽館／香港的月台別為 `1/3` 和 `2/4`，保留成組字串。 |
| 19:17:12 | `EAL / ADM / TC` | 200／1 | UP 四班，終點 `LMC/LOW`、月台 7，實際欄位 `timeType=D`。回應未列 DOWN。 |
| 19:17:12 | `EAL / RAC / EN` | 200／1 | 合法線站，當次兩方向無列車預報。 |
| 19:17:12 | `AEL / ADM / EN` | 200／0 | 測試用不合法組合，服務回傳 `NT-204`。App 用線站清單拒絕此組合。 |

五次回應均帶 `Cache-Control: public, must-revalidate, max-age=10`。這是實測 HTTP 快取資訊。App 的刷新頻率由自身按需策略控制。原始樣本留在暫存目錄，未加入 App 或倉庫。 [API 規格與異常例子](https://opendata.mtr.com.hk/doc/Next_Train_API_Spec_v1.7.pdf)

## 顯示及欄位解讀

- 車站詳情新增「下一班列車／Next trains」。從線路打開某站，保留 `line` 路由參數。由站點目錄或搜尋開啟單線站時直接查該線，多線站先選線。例子為香港站 `AEL/HOK`、`TCL/HOK`，兩者獨立查詢及快取。線路詳情本身無預報請求。站點名稱及所屬線路仍來自既有 B1 靜態目錄。
- 只讀取所選 `data["LINE-STA"]`。照官方 `UP/DOWN` 分組，標題用回應中的終點形成，各班單列實際 `dest`、時間、可識別月台和後續班次。按 `seq` 排列，最多每方向四班。不同終點在同一方向下保持分列。無法可靠解析的終點代碼可作代碼顯示，缺失或無效月台省略。
- `time` 是供應商預計到站或開出時間。東鐵 `timetype`（字典）和 `timeType`（實測）在有一個有效值或兩欄一致為 `A/D` 時標明「預計到站／預計開出」。缺少、衝突或其他線路的結果使用「列車預報」。東鐵 `route=RAC` 標示「經馬場」。v1.7 把 `ttnt`、`valid`、`source` 列為佔位欄位，程式不採用它們判斷分鐘、取消或實測到站。 [資料字典](https://opendata.mtr.com.hk/doc/Next_Train_DataDictionary_v1.7.pdf)
- 將官方無時區時間解析為香港 UTC+08:00 日期，重視同一回應內站點的 `curr_time`，再用可驗證的 `sys_time` 或頂層時間。HTTP `Date` 加可解析的 `Age` 作伺服器時間基準，缺少 HTTP 日期時使用裝置 UTC 時鐘。倒數減去已過時間，使用單調時鐘與裝置經過時間避免倒數回升。過去的班次會隱藏。資料時間與列車日期同以香港時間寫出，可辨識跨午夜。更新標籤取資料時間到秒。
- 白色預報卡沿用品牌色、現有 `Filters`、44 pt 操作及根 Stack。手動刷新更新卡片內的資料，既有詳情 `Screen` 維持掛載。資料來源區加入港鐵即時資料連結與原有署名。技術回歸檢查頁面與導航，原生捲動、VoiceOver 及極大字體需人工確認。

## 資料狀態與請求節奏

| 狀態 | 實作 |
| --- | --- |
| 載入／有效預報 | 首次按需取得。已顯示的有效讀數在刷新等候時按自身有效期顯示。不寫入 SQLite。 |
| 暫無預報 | 成功回應沒有可用的未來班次。可只出現一個方向。空陣列、缺少某方向或文件所示的時間佔位符不推斷停駛、尾班或非營運時段。 |
| 過期 | 自擷取或站點資料時間達 60 秒、資料時間明顯在未來，或有班次但沒有可用時間戳時停止倒數。 |
| 請求失敗與不支援 | HTTP 500、網絡錯誤、逾時、錯誤資料及未辨識的 `status=0` 顯示更新失敗。線站不在已核對組合內時直接顯示不支援。 |
| 特別安排／服務暫停 | 特別安排按規格的官方告示 URL 或已知訊息判定，連結固定到港鐵官方告示地址。服務暫停辨識規格中的東鐵羅湖／落馬洲已知訊息。無法核實狀態的通知繼續視為更新失敗。有效預報可同時顯示 `isdelay=Y` 的延誤提示。 |
| 限流 | HTTP 429 暫停該 App 實例的新港鐵請求，採用 `Retry-After` 的秒數或 HTTP 日期。缺失或無效用 60 秒，並維持最少 20 秒間隔。到期可再次按需請求。 |

每個組合共用正在進行的 GET。20 秒內以記憶體內已有樣本合併重入、前台恢復和手動操作。有效期 60 秒，過期記錄在後續請求清理。進入／聚焦、回前台以及按刷新才會檢查並按需發送，沒有週期網絡輪詢。前台且已聚焦時的一秒計時器只更新本機倒數與刷新可用狀態。離頁和進入背景即停計時，組合或生命週期已改變的回應不再更新畫面。已發送的 GET 可完成並供短期合併，在 8 秒時中止並返回失敗。

## 使用條件、私隱與發布審核

- 執行 `GET https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=…&sta=…&lang=EN`。兩個交通代碼及固定的英文訊息參數是唯一查詢欄位。App 本機把已知狀態及名稱翻譯到 zh-HK 或 English。請求採用 HTTPS 和 `credentials: omit`，沒有附加 GPS、搜尋詞、自訂識別碼或位置歷史。服務方仍可接收到 IP、時間、網絡標頭和所查線站。公開文件未確認日誌存取與保留期限。
- DATA.GOV.HK 通用條款在適用條件下容許再利用，包括商業用途，並要求辨識資料來源、政府、相關組織與門戶。官方入口標示港鐵公司擁有資料的知識產權。規格文件自身有權利聲明，B1 離線資料授權條件亦仍待確認。發布前向資料提供方核實正式 App 使用、再利用及署名，並確認即時快取、刷新與可能的配額。實作驗證的通過不解除 B1 或 B2 的發布審核。 [政府開放數據條款](https://data.gov.hk/en/terms-and-conditions) [港鐵資料和聯絡方式](https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data)
- 上架前應對照 App 內及網站雙語政策，確認是否補充「港鐵即時預報、線站代碼和服務方」的說明，並把資料來源頁的港鐵即時來源納入已核准的發布署名。若服務方會在即時處理期後保留或存取請求資料，應依具體欄位、用途和身份關聯再評估 Apple 申報。站點代碼可以是用戶查閱的站，不能直接當作其位置。現有正式政策、網站和 App Store Connect 未修改。 [Apple 私隱申報指引](https://developer.apple.com/app-store/app-privacy-details/)

## 修改文件

| 文件 | 用途 |
| --- | --- |
| `src/mtr-realtime.ts`、`src/mtr-next-train-client.ts`、`src/mtr-next-train-hooks.ts` | 官方線站校驗、解析、時鐘及狀態。按需請求、快取、超時、退避和焦點生命週期。 |
| `src/components/mtr-next-trains.tsx`、`src/i18n.ts` | 預報卡及雙語文案。 |
| `src/app/mtr/[kind].tsx`、`src/components/mtr-ui.tsx`、`src/mtr-static.ts` | 車站詳情、選線上下文及官方來源。靜態模組只匯出既有 LineCode 型別。 |
| `scripts/test-mtr-next-train.cjs`、`scripts/test-nearby-bus-location.cjs` | 狀態、資料、網絡、UI、生命周期與既有交通回歸。 |
| 本報告 | 紀錄來源、驗收及上架前待確認事項。 |

## 自動化驗證

- `npm run typecheck`：PASS。
- `TZ=America/New_York MTR_PROBE_DIR=<本次公開樣本目錄> node --test scripts/test-mtr-next-train.cjs`：**13/13 PASS**。12 項使用隔離測試資料與 mock，其中包括時區跨日、回程、焦點、重複、429、500、逾時、空預報與雙語。另 1 項讀取五份實際公開回應，使用原 HTTP 捕獲時鐘重播解析。此測試命令本身不會發送網絡請求。省略環境變數時可單獨跑 12 項離線測試。
- `node --test scripts/test-nearby-bus-location.cjs`：**28/28 PASS**，含 B1 靜態、混合搜尋與回程、巴士定位及 500／1000／2000 米基線。
- `node scripts/test-bus-route-map.cjs`、`python3 scripts/test-nearby-bus-fares.py`：PASS，包含巴士 ETA、限定服務、車費及路線圖。
- `node scripts/test-facility-favorites.cjs`、`node scripts/test-native-link-security.cjs`、`node scripts/test-global-search-navigation.cjs`、`node scripts/test-global-search-ui.cjs`、`node scripts/test-global-search.cjs`、`node scripts/test-compliance.cjs`：PASS。
- Expo iOS Metro／Hermes 離線匯出：PASS。在暫存目錄檢查了正式港鐵 API URL 已編入產物。這是靜態匯出。
- `git diff --check` 及新增文檔與源碼行尾檢查：PASS。

## iPhone 人工驗收

1. 從港島綫詳情打開金鐘，確認只帶港島綫。從搜尋直接開金鐘或香港站，確認先選線，切線後只顯示對應列車。
2. 用將軍澳核對兩個方向、不同終點和後續班次。用機場核對 `1/3`、`2/4` 類月台。東鐵金鐘如官方仍提供 `timeType=D`，應看到「預計開出」。其他未指定語義的列車使用「列車預報」。
3. 停留超過 60 秒，確認預報到期、倒數停止。按刷新並試用切線、開關飛行模式、退出車站及恢復前台。確認靜態站序仍可閱讀，更新後不跳回頁頂。
4. 中英切換、小屏和大字檢查月台、時間、刷新及方向標籤的可讀性與 VoiceOver。iOS 原生返回與邊緣手勢回到原搜尋狀態。
5. 回歸巴士篩選、500／1000／2000 米距離、ETA、票價及收藏。無座標的港鐵仍只出現在搜尋與靜態目錄。即時排程未延伸到輕鐵。

## Git 狀態

`develop` HEAD 仍為 `3fde79c`。本輪五個修改檔、六個新增檔，尚未暫存或提交。沒有變更 `main`、`v1.0.0`、版本或距離配置。沒有執行模擬器、真機、EAS Build、部署或上架操作。
