# UX-02B5B1 港鐵及輕鐵資料來源與署名

**App 內來源署名技術驗收 PASS。下一版本公開發布維持 NO-GO。** iPhone 的大字及連結操作仍待開發者驗收。

開工時 `develop` 工作區乾淨，HEAD、本機 `origin/develop` 及 GitHub `refs/heads/develop` 均為 `b8a21a4488c22785de7cc83f7bc95ec51a8c8372`，已包含[UX-02B5B 審計](UX-02B5B-DATA-LICENSING-ATTRIBUTION-PRIVACY-AUDIT.md)。按 DATA.GOV.HK v1.2（2025-05-26）第 3 段及資源頁標示，四項資源均注明提供者及權利人香港鐵路有限公司、來源 DATA.GOV.HK 和香港特別行政區政府。主站素材、衍生離線副本及即時使用的適用範圍沿用 B5B 審計判定。 [繁中使用條款](https://data.gov.hk/tc/terms-and-conditions) · [English terms](https://data.gov.hk/en/terms-and-conditions)

## App 內呈現

設定的「資料來源」以既有內容元件分列四項資源。每項都有雙語標題、提供者及權利歸屬和可點擊的官方來源名稱。巴士、天氣、設施、探索、照片和相關條款仍可在原入口查閱。

| 繁中標題 | English title | 資料日期與使用說明 | 官方來源 |
| --- | --- | --- | --- |
| 港鐵離線綫路及車站 | Offline MTR lines and stations | 顯示打包 metadata `resourceUpdatedOn` 的 **2023-06-25**，說明官方 CSV 快照可能與現行服務不同。 | [重鐵靜態資源](https://data.gov.hk/en-data/dataset/mtr-data-routes-fares-barrier-free-facilities/resource/8daba4fe-b879-4a51-8962-27b4cffdc61c) |
| 輕鐵離線路線及車站 | Offline Light Rail routes and stops | 顯示打包 metadata `resourceUpdatedOn` 的 **2026-07-05**，說明快照範圍為官方 CSV 常規路線，並指向官方特別服務及變動資訊。 | [輕鐵靜態資源](https://data.gov.hk/en-data/dataset/mtr-data-routes-fares-barrier-free-facilities/resource/d0662909-9919-4f01-b4f9-eccc4b2acbb5) |
| 港鐵即時列車預報 | Real-time MTR train predictions | 說明即時預報可延遲、暫停提供或與實際服務有差異；沒有靜態資料日期，實際資料時間在預報卡查看。 | [港鐵即時資源](https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data/resource/103472ed-01be-4dda-92c6-30530dee022f) |
| 輕鐵即時列車預報 | Real-time Light Rail train predictions | 同一即時說明，連至輕鐵獨立資源；實際資料時間在輕鐵預報卡查看。 | [輕鐵即時資源](https://data.gov.hk/en-data/dataset/mtr-lrnt_data-light-rail-nexttrain-data/resource/d26e774b-b5ef-409f-8d4d-e61a3d323f9d) |

共用署名為「資料由香港鐵路有限公司提供，知識產權屬香港鐵路有限公司。來源為香港特別行政區政府開放數據平台 DATA.GOV.HK。」英文為 “MTR Corporation Limited provides the data and owns its intellectual property rights. The source is DATA.GOV.HK, the HKSAR Government’s open data portal.” 開放數據條款段中英文均指明 KongDaily 由獨立開發者營運，港鐵及政府僅以資料來源身份獲署名。

車站詳情的來源區共用即時說明「即時列車預報可能延遲、暫時不可用或與實際服務不同。出行前請查閱港鐵官方資訊。」英文為 “Live train predictions may be delayed, temporarily unavailable or differ from actual service. Check official MTR information before travelling.” 綫路／路線詳情使用既有靜態來源。港鐵詳情同時列出離線資料更新日期 **2023-06-25** 和獨立的下載日期 **2026-11-21**。兩種車站詳情保留原有即時資料集入口，預報卡仍以官方回應時間顯示即時更新。詳情及中央來源使用可換行的文字標籤和現有最小觸控尺寸。

### 馬場站補錄

B5B 保存的 `mtr_lines_and_stations.csv` 未找到 `RAC`、`Racecourse` 或「馬場」列。現有快照將馬場標為 `supplemental: true`，其東鐵綫 `stationId` 為 `null`，常規站序未加入該站。港鐵 Next Train 資料字典 v1.7 在 `EAL` 清單列出 `RAC Racecourse`。港鐵主站的服務資料及系統圖提供另一路官方佐證。中央港鐵離線項目和馬場站詳情明示補錄邊界並連往字典及服務資訊。原資料及站序維持現有快照。這些連結提供出處，補錄事實及衍生 JSON 隨包分發的授權適用範圍仍待核實。 [資料字典](https://opendata.mtr.com.hk/doc/Next_Train_DataDictionary_v1.7.pdf) · [馬場站服務資料](https://www.mtr.com.hk/en/customer/services/service_hours_search.php?query_type=search&station=70) · [港鐵系統圖頁](https://www.mtr.com.hk/en/customer/services/system_map.html)

## 修改檔案

- `src/compliance-credits.ts` 新增四項來源及獨立營運說明。
- `src/i18n.ts` 提供共用雙語權利聲明、離線日期標籤、即時提醒及馬場補錄說明。
- `src/app/mtr/[kind].tsx`、`src/app/light-rail/[kind].tsx` 更新既有來源區，保留列車預報及詳情導航流程。
- `scripts/test-compliance.cjs`、`scripts/test-nearby-bus-location.cjs` 驗證四個官方資源身份、雙語法律文案、其餘來源、日期語義及詳情入口。
- 本報告記錄驗收和發布交接。

## 自動化核驗

| 檢查 | 結果 |
| --- | --- |
| `npm run typecheck`、`node scripts/test-compliance.cjs` | PASS。四項分類、來源／權利人、雙語鍵值、快照日期及既有來源均通過。 |
| `node --test scripts/test-nearby-bus-location.cjs scripts/test-mtr-next-train.cjs` | **60/60 PASS**，交通 36、鐵路即時 24。含兩項既有官方即時樣本的離線重播。核對港鐵／輕鐵詳情來源及馬場連結。 |
| `node scripts/test-bus-route-map.cjs`、`python3 scripts/test-nearby-bus-fares.py`、`node scripts/test-facility-favorites.cjs` | PASS。巴士 ETA、票價、路線圖及收藏回歸。 |
| `node scripts/test-global-search.cjs`、`node scripts/test-global-search-ui.cjs`、`node scripts/test-global-search-navigation.cjs` | PASS。 |
| 公開來源連結唯讀 HTTPS GET | 13/13 回傳 HTTP 200。涵蓋兩語條款、四個具體資源、兩個即時資料集入口、馬場字典／服務／系統圖頁及兩語輕鐵時間表。網頁可達性以直接 HTTPS 回應核對，沒有操作生產即時端點。 |
| iOS Metro／Hermes 離線匯出、`git diff --check` | PASS。已在 Hermes 產物核對新增來源標題，匯出位於暫存目錄。 |

## iPhone 驗收步驟

1. 在設定開啟「資料來源」，以繁中及 English 核對四項鐵路資料、權利人及獨立營運說明。點開各項官方來源，返回後確認既有來源仍可查閱。
2. 開啟港鐵金鐘與輕鐵海皇路車站詳情。核對預報卡的實際資料時間與來源區的離線更新日期分別顯示；開啟綫路／路線詳情時確認只顯示靜態來源說明。
3. 從東鐵綫打開馬場站，開啟字典及官方服務資料，再返回原詳情。在小屏幕及系統大字下確認中英文段落、連結標題與按鈕可讀及可操作。

## 合規交接與 Git

- **離線分發授權仍未完全解決。** CSV 有條件再利用的依據仍適用；衍生 JSON 的隨包分發與 `RAC` 補錄事實的適用範圍待核實。
- **即時 API 限制仍未完全解決。** 供應方快取上限、配額以及網關和供應方的日誌留存待確認。
- **B5B2 Privacy Policy 待修改。** 應在候選發布前補足雙語鐵路資料流，並按批准流程更新 App 與官網。
- **B5B3 App Privacy 待核實。** 仍需實際候選 Archive、SDK manifest、接收方和留存證據。下一版本 **NO-GO**。

`develop` HEAD 仍為 `b8a21a4`。六個已追蹤檔案修改及本報告留在工作區。未啟動模擬器或真機，未建立 EAS Build、部署網站、發出求證電郵或操作 App Store Connect，未提交、推送或合併。
