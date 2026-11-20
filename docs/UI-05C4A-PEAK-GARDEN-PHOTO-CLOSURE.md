# UI-05C4A · 山頂花園照片與最終驗收

**照片技術驗收 8／8 PASS。App Store 素材分發仍待放行。** 山頂花園已用 Wpcpey 的實景照片補齊。探索列表與詳情共享 `victoria-peak-garden` 的本機照片。整個 UI-05C4 工作區及原有七筆照片、署名和下載雜湊均保留。 [UI-05C4 八處照片及來源清單](UI-05C4-EXPLORE-REAL-PHOTO-IMPLEMENTATION.md)

## 原圖、場地與授權版本

作品為 Wpcpey 自行拍攝的 *Victoria Peak Garden Lawn Plants 201607*，拍攝日期為 2016-07-22。完整 JPEG 及本機兩種 `cover` 版框均已查看。畫面為山頂花園的草坪、對稱花圃及中央涼亭，與旅發局所示場地景觀相符。 [Commons 作品頁](https://commons.wikimedia.org/wiki/File:Victoria_Peak_Garden_Lawn_Plants_201607.jpg) · [旅發局場地資料](https://www.discoverhongkong.com/eng/place-to-go/travel.guide-victoria-peak-garden.html)

- Commons Revisions API 的最早檔案版 `202529515`，由 **Wpcpey** 於 2016-07-27 12:49:56 UTC 上載，原始 wiki 內容同時有作者自己的作品聲明和 `Licensing` 下的 `{{self|cc-by-4.0}}`。八份可查的檔案歷史修訂，包括目前 `1279883312`，均保留這個 4.0 標記。這是對該 JPEG 由原作者作出的明確 4.0 授權證據。 [作者首個版本](https://commons.wikimedia.org/wiki/Special:PermanentLink/202529515) · [現行版本](https://commons.wikimedia.org/wiki/Special:PermanentLink/1279883312)
- 同頁的 **CC BY 3.0** 說明及署名要求是 `{{WiNG/Licensing}}` 通用模板的內容。Commons 修訂查詢會由 `Template:WiNG/Licensing` 跟隨至 `User:Wpcpey/Licensing`。現行模板版 `880186713` 保留 3.0 字樣及靠近圖像顯示署名的要求。採用該檔案獨立標明的 **CC BY 4.0**，並遵照模板的署名位置及作者名稱格式。現有證據未確認作者意圖另外為這一張照片提供 3.0 選項。 [通用署名模板版本](https://commons.wikimedia.org/wiki/Special:PermanentLink/880186713) · [CC BY 4.0 授權條文](https://creativecommons.org/licenses/by/4.0/legalcode.en)

## 實際下載和處理

| 項目 | 結果 |
| --- | --- |
| 全尺寸來源 | 2026-11-20 從 Commons 原始檔下載，2656 × 1768 JPEG，4,145,495 bytes。 [直接下載原圖](https://upload.wikimedia.org/wikipedia/commons/6/6b/Victoria_Peak_Garden_Lawn_Plants_201607.jpg) |
| 原圖校驗 | SHA-1 `8db5b0c70a14a089544460e8746a584dca9e720e` 與 Commons 相符。下載檔與已核對的全尺寸原圖 SHA-256 同為 `ef999bc776a7acd4757f679793b0d66fe6152cdfd796114f10e895c4bf2a3ccb`。 |
| App 資源 | [victoria-peak-garden.jpg](../assets/explore/photos/victoria-peak-garden.jpg) · 1480 × 985，735,374 bytes，SHA-256 `59f27e7e1e3d876e1a9c6876b1d0450c5bc1c9c32c74c435b341dbebf783f4cb`。 |
| 處理 | 依原方向解碼，等比例縮至 1480 px 長邊，macOS Core Graphics／Image I/O 輸出 sRGB JPEG、品質參數 0.73，省略來源 EXIF。JPEG 保留完整畫幅。列表及詳情用現有 `cover` 視覺裁切。以本機 66 × 66 與 372 × 142 版框查看，中央涼亭、花圃和草坪仍可辨識。 |

原來七張照片的實體檔逐份通過開工前 SHA-256 清單核對，七份署名物件與開工快照完全相同。六份原始全尺寸 SHA-256 仍標記未取得，下載衍生檔的 SHA-256 原值已保留。 [完整八張照片記錄](../assets/explore/photos/attribution.json)

## 圖旁署名及發佈待決事項

山頂花園縮圖旁顯示 `維基百科用戶-Wpcpey` 或 `Wikipedia user -Wpcpey`。詳情沿用既有「照片署名」路由，將這一處的入口移到主圖下方並顯示同一名稱。完整署名頁列作者、作品、CC BY 4.0、處理紀錄，以及 Commons 作品和可直接下載的全尺寸原圖。原圖下載連結由用戶主動開啟，App 的圖片顯示始終使用本機 JPEG。

CC BY 4.0 允許商用、縮放及再分發，須保留署名、許可及變更說明，並避免以附加條款或有效技術措施限制收件人行使已授予的權利。獨立的 Commons 原圖及授權均已可查閱。正式發佈前，另可提供與包內 JPEG **相同 SHA-256** 的公開 HTTPS 優化副本及其雙語署名、授權與處理說明。該副本仍是部署待辦，目前沒有聲稱它已有公開 URL。 [Commons 原圖](https://upload.wikimedia.org/wikipedia/commons/6/6b/Victoria_Peak_Garden_Lawn_Plants_201607.jpg) · [CC BY 4.0 §2、§3](https://creativecommons.org/licenses/by/4.0/legalcode.en)

**App Store 待確認。** Commons 的獨立原圖和擬發佈的優化副本提供額外取得方式。正式成品仍需核對 Apple 適用條款及實際包裝，確認收件人能按 CC BY 4.0 使用、複製及再散布該照片。若需要自訂 EULA，條文應明確保留照片的 CC 權利，並核對成品是否對圖片施加了影響該權利的技術限制。如成品條款和技術措施仍無法確認相容，需另獲 Wpcpey 書面許可或選用已確認可隨包分發的素材後才放行。使用這張圖的商店截圖也須履行署名及修改說明。網站 Gate 和其他私隱項目沿用既有設定。 [Creative Commons 的技術保護說明](https://creativecommons.org/faq/index.html#can-i-use-effective-technological-measures-such-as-drm-when-i-share-cc-licensed-material) · [Apple 標準 EULA](https://www.apple.com/legal/internet-services/itunes/dev/stdeula/) · [自訂 EULA 官方流程](https://developer.apple.com/help/app-store-connect/manage-app-information/provide-a-custom-license-agreement/)

## 最終驗證

| 檢查 | 結果 |
| --- | --- |
| `npm run typecheck` | PASS。 |
| `node scripts/test-explore-photos.cjs` | **PASS 8／8**。八份已解碼的 JPEG、唯一 SHA-256、正式 ID、下載與署名記錄通過。山頂花園另核對原始檔雜湊、作者首版及署名模板修訂。既有完整性斷言保留。 |
| `node scripts/test-explore-places.cjs`、`node scripts/test-explore-trailhead-navigation.cjs` | PASS。8 個地點、四個分類、相同列表與詳情映射、繁中／English、首頁龍脊、離線資料、原有導航。正式資料中的介紹、18 條看點、39 個官方來源及導航規則維持原值。 |
| `node scripts/test-compliance.cjs` | PASS。i18n、列表和詳情的署名路由、主圖下方入口、作者名稱、許可及修改資料、原圖下載連結、發布 Gate 定向用例。 |
| `node scripts/test-global-search-navigation.cjs`、`node scripts/test-global-search-ui.cjs` | PASS。全域搜尋進入現有探索詳情及返回。 |
| iOS Metro／Hermes | PASS。離線 `expo export --platform ios` 有 `.hbc`。對匯出資產逐一查八個本機 SHA-256，並確認首頁維港、西九仍在。舊龍脊和四張探索插畫未匯出。 |
| `node website/build.cjs --check-release`、`git diff --check` | 實際發佈配置按預期攔截，Git 空白檢查通過。 |

## iPhone 人工驗收

1. 進入探索，切換四個分類。確認山頂花園在「公園休憩」及「寵物友善」內使用同一張圖，縮圖旁可辨認作者。抽查其餘七張及首頁龍脊。
2. 開啟山頂花園詳情，在繁中及 English 下查看涼亭和草坪、主圖下方的作者入口及完整署名。用較大字體及 VoiceOver 確認署名能換行、入口可操作。開網絡時抽查原圖與授權連結。
3. 開飛航模式，從探索及全域搜尋開啟詳情，確認照片和署名內容本機可讀，列表及返回順序正常。抽查兩條既有步道導航的入口。

## 修改文件與 Git

- 新增 `assets/explore/photos/victoria-peak-garden.jpg`，只在 `assets/explore/photos/attribution.json` 加入山頂花園一筆。
- `src/explore-place-images.ts` 加入正式 ID；`src/app/(tabs)/explore.tsx`、`src/app/explore/place/[id].tsx`、`src/compliance-credits.ts` 接入山頂花園的近圖署名及原圖連結。
- `scripts/test-explore-photos.cjs`、`scripts/test-explore-trailhead-navigation.cjs`、`scripts/test-compliance.cjs` 補充山頂花園定向驗證。更新 [UI-05C4 主報告](UI-05C4-EXPLORE-REAL-PHOTO-IMPLEMENTATION.md) 及本文件。

開工與結束均在 `develop`，HEAD `1b71e1ebdadea79a6124a1a2de44fffdc9a768d8`。開工以唯讀 GitHub 查詢確認遠端同一 SHA，與本機追蹤分支差異 `0 / 0`。UI-05C4 原有變更和本輪修改均保留在工作區。未啟動模擬器或真機，未建立 Production Build，未部署、提交、推送或合併。
