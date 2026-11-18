# KongDaily · UI-05C1 探索離線資料實作

首批內容以開發者批准的八個地點為準。資料審閱及來源複核日期為 2026-11-18（香港時間）。本輪交付靜態內容、TypeScript 讀取接口及校驗腳本。基線為 `develop` 的 `8c53b9ad85e74faf418559d51b87e8078edf2028`，當時與本機 `origin/develop` 追蹤參照一致。[UI-05C0 審計](UI-05C0-EXPLORE-CONTENT-AUDIT.md)、[已批准設計規格](UI-05B-EXPLORE-DESIGN-REVIEW.md)

## 首批正式資料

| 順序 | 地點／English | 永久內容 ID | 主類 | 次類 | 看點 |
| --- | --- | --- | --- | --- | --- |
| 10 | 龍脊／Dragon’s Back | `dragons-back-to-tei-wan-tai-tam-gap` | hiking | — | 2 |
| 20 | 山頂環迴步行徑／Peak Circle Walk | `peak-circle-walk` | hiking | — | 2 |
| 30 | 西九文化區藝術公園／Art Park (West Kowloon Cultural District) | `west-kowloon-art-park` | waterfront | pets | 3 |
| 40 | 星光大道／Avenue of Stars | `avenue-of-stars` | waterfront | — | 2 |
| 50 | 香港公園／Hong Kong Park | `hong-kong-park` | parks | — | 3 |
| 60 | 九龍寨城公園／Kowloon Walled City Park | `kowloon-walled-city-park` | parks | — | 2 |
| 70 | 大埔海濱公園／Tai Po Waterfront Park | `tai-po-waterfront-park` | parks | waterfront | 2 |
| 80 | 山頂花園／Victoria Peak Garden | `victoria-peak-garden` | pets | parks | 2 |

全部清單為 8 筆。篩選後公園休憩 4、行山郊遊 2、海濱景點 3、寵物友善 2。次類沿用主類的同一個內容 ID 與詳情。菠蘿壩及中山紀念公園留在候選審計，尖沙咀海濱花園與西九寵物區未另立條目。

既有附近索引仍以自身 `source + officialId` 識別場地。例如香港公園、九龍寨城公園及大埔海濱公園分別為 `park-040`、`park-003`、`park-012`，山頂花園為 `inclusive-pet-040`。正式探索清單使用獨立 ID，未將同名設施、共享指定位置或其中的座標合入內容包。[普通公園索引](../assets/data/lcsd-parks.json)、[寵物共享索引](../assets/data/lcsd-inclusive-pet-parks.json)

## 雙語內容與來源

每處提供香港繁中及英文名稱、地區、一句簡介、交通方式、注意事項及 2–3 條看點，共 **18 條雙語看點**。交通、注意事項和每條看點各自帶有 `sourceIds`。每個來源有機構、雙語顯示名稱、原文語言及 HTTPS URL。資料包只存原創摘要、必要地名及官方連結。開放、交通或工程等易變資訊以出發前核對官方安排的方式呈現。[正式資料](../assets/data/explore-places.json)

| 內容 | 本輪主要核對 |
| --- | --- |
| 龍脊 | 漁護署路線為土地灣至大潭峽，起點、觀景點和接駁巴士站各有不同用途。剔除具有大浪灣行程的同名旅發局頁面作為正式路線入口，以漁護署雙語圖支援英文參考。[龍脊路線](https://www.hiking.gov.hk/trail/info/id/UWgvZytZSlRrcnBJSU5DWVZUa2pyUT09)、[雙語路線圖](https://www.hiking.gov.hk/console/public/uploads/others/file/68f933da5236fcc578458846059ce109ce87b211.pdf) |
| 山頂環迴、山頂花園 | 旅發局雙語資料區分盧吉道／夏力道環線與柯士甸山道上行至花園。花園另核對古蹟辦的守衛室資料及康文署共享名單與牽繩守則。攜寵交通以營運商條款為準。[旅發局繁中](https://www.discoverhongkong.com/tc/place-to-go/travel.guide-peak-circle-walk.html)、[環線組成](https://www.discoverhongkong.com/eng/outdoors/family-friendly-hikes-in-hong-kong.html)、[康文署守則](https://www.lcsd.gov.hk/en/facilities/otherinfo/petpark.html) |
| 西九藝術公園 | 確認海濱長廊、草坪、觀景台、由九龍站經藝術廣場天橋的人行指引，以及近西閘的指定寵物區。在適用的戶外公眾休憩用地，指定區外須繫牽繩或用合適容器。只在指定區內可解繩，按現場指示及最新安排。介面使用公園本體的同一筆內容。[管理局英文指引](https://webmedia.westkowloon.hk/documents/Art-Park-Access-Guide-202601-EN-tagged.pdf)、[步行接駁](https://webmedia.westkowloon.hk/documents/BFA-route-MTR-Kowloon-Station-EN-tagged-20250219.pdf)、[雙語守則](https://webmedia.westkowloon.hk/documents/WKCD%20POS%20Rules%20%26%20Regulations_TC%20%26%20ENG.pdf?VersionId=kNunCAKhd9bJ6OclDS9UdLdWWJTJuVIm) |
| 星光大道 | 旅發局雙語地點及海濱文獻覆蓋電影主題段、影人掌印、李小龍雕像及從碼頭沿海濱步行的方法。以尖沙咀碼頭作交通接駁說明。[地點頁](https://www.discoverhongkong.com/eng/place-to-go/travel.guide-avenue-of-stars.html)、[天星小輪碼頭](https://www.discoverhongkong.com/tc/place-to-go/travel.guide-star-ferry-pier.html) |
| 香港公園 | 康文署兩語參觀資訊與觀鳥園頁支援水景、舊軍營建築、觀鳥園及金鐘／中環站到達方式。[參觀香港公園](https://hkp.lcsd.gov.hk/tc/visit)、[尤德觀鳥園](https://hkp.lcsd.gov.hk/en/facilities/aviary) |
| 九龍寨城公園 | 康文署兩語園址及交通、衙門、南門遺址與古蹟辦的雙語名單。室內參觀安排交由園方更新。[交通](https://www.lcsd.gov.hk/tc/parks/kwcp/access.html)、[古蹟辦名單](https://www.amo.gov.hk/filemanager/amo/common/form/list_government-owned_DM_open.pdf) |
| 大埔海濱公園 | 康文署繁中年報、戶外設施及兩語交通頁核對大發街、長廊、吐露港及香港回歸紀念塔。寵物共享只見於指定位置名單，資料未給公園本體加上寵物分類。[康文署年報](https://www.lcsd.gov.hk/en/common/pdf/annual_report_2324_tc.pdf)、[戶外設施](https://www.lcsd.gov.hk/en/parks/tpwp/facilities/outdoor.html)、[寵物共享名單](https://www.lcsd.gov.hk/en/common/pdf/Annex_IPP_Venue.pdf) |

### 連結可達性紀錄

已在網頁查核中逐一比對正式資料包的 **39 個不重複官方 URL**，包括其可讀頁面、PDF 或重新開啟的官方索引結果。這是審計時的連線結果，部份取回內容來自官方的索引快照。

- **西九。** 原引用的 2025 年繁中 PDF 直取回 403。正式資料改用可開啟的管理局版本化繁中 PDF。2026 年英文 PDF 首次直取回 403，從搜尋結果重新開啟後取得全文。步行指引與雙語守則另行取得。主場地頁在 UI-05C0 受排隊頁攔截，沒有納入正式連結。[繁中版本化指引](https://webmedia.westkowloon.hk/documents/Art%20Park_Access%20Guide_TC_FINAL_tagged.pdf?VersionId=hTQaFLFDDDRDuniPkg.O3gdDisCepeZK)、[2026 英文指引](https://webmedia.westkowloon.hk/documents/Art-Park-Access-Guide-202601-EN-tagged.pdf)
- **山頂。** 營運方自然步道網頁有官方索引內容，但直取反覆回 403。正式資料採用可開啟的旅發局環迴步行徑和親子遠足資料，並以康文署及古蹟辦補充山頂花園內容。[營運方頁面](https://www.thepeak.com.hk/en/the-peak-experience/nature-walks)、[旅發局環線](https://www.discoverhongkong.com/eng/place-to-go/travel.guide-peak-circle-walk.html)
- **大埔。** 原年報 HTML 索引能核對看點，直接開啟時未取得可讀正文。正式資料換用可讀的康文署 2023–24 年報 PDF 與戶外設施頁。[年報 PDF](https://www.lcsd.gov.hk/en/common/pdf/annual_report_2324_tc.pdf)

## 讀取與導航契約

- `assets/data/explore-places.json` 採 `schemaVersion: 1`。以 `order` 排序，可改編輯順序並保留 ID。使用 `zh-HK` 和 `en` 配合既有語言狀態。內容以 Metro 的靜態 JSON import 讀取。
- `getExplorePlaces()` 回傳已排序全部地點。傳入 `ExploreCategory` 同時比對主次類。 `getExplorePlace(id)` 回傳同一筆資料，未知 ID 為 `undefined`。交通、注意事項及看點從同一地點資料取用。 `sources` 可按 `sourceIds` 對應正文。
- `homeFeaturedPlaceIds.dragon` 指向土地灣至大潭峽版龍脊，`homeFeaturedPlaceIds.westKowloon` 指向西九藝術公園；兩者都能從對應分類與 ID 讀到同一物件。現有首頁卡仍維持原有展示。下一階段接線時，西九卡應使用藝術公園標題與同一筆簡介，首頁捷徑仍開啟對應類別。
- `ExploreNavigation` 的狀態為 `unverified`、`not_applicable`、`verified`。只有 `verified` 要求 `destination`，包含雙語名稱、WGS84 經緯度及其來源 ID、用途、證據 ID、核驗日期。前兩種狀態禁帶 `destination`。本輪八筆均為 `unverified`，校驗腳本也拒絕任何首批導航座標。[TypeScript 讀取接口](../src/explore-places.ts)

香港公園、九龍寨城公園仍需把官方圖與可通行行人入口的 WGS84 點逐一核對。西九藝術公園與星光大道已有文字或步行指引，尚欠具名步行抵達點與座標的完整證據。兩條行山路線另需驗證方向及正式起點。正式內容包不沿用設施參考點或交通站，研究座標留在 UI-05C0。

## 更新與 UI-05C2 接線

1. 更新時先核對官方名稱、地點或路線身份、交通、通行限制及兩語文案，保留每條看點的來源 ID。修訂文字、語言或順序時沿用既有 ID。路線終點或場地身份改變時重新開審計項。
2. 複核連結是否仍通向同一份有效官方資料。若關鍵來源失效，先暫停該項發佈，等待可信的官方資料補足。連線失敗單獨記錄。離線包保留審閱日期和來源，外鏈由用戶按需開啟。
3. UI-05C2 可用既有分類參數讀取列表，啟用「查看全部」時清除篩選。詳情按 ID 讀取同一筆雙語內容，把 `highlights` 放在簡介與交通之間。只在導航另行核實及獲批後，才在 UI 按 `status === 'verified'` 和目的地用途啟用地圖操作。照片、路由與頁面接線均不屬本輪交付。

## 驗證

| 檢查 | 結果 |
| --- | --- |
| `npm run typecheck` | 通過。 |
| `node scripts/test-explore-places.cjs` | 通過。核對批准名單、穩定 ID、主次類去重、固定順序、雙語字段、來源引用、日期、附近身份和首頁對應。以隔離環境執行實際讀取模組，模組只讀本機 JSON。 |
| 官方來源可達性 | 如上方紀錄，採網頁查核完成。腳本另提供 `--check-links` 作後續直接 HTTP 檢查，會列出無法確認的 URL。預設校驗維持離線。 |
| iOS Metro | 通過。使用 `expo export:embed --platform ios --entry-file src/explore-places.ts` 以資料模組作隔離入口，輸出 bundle 與 source map 至暫存目錄。 |
| Git 空白與既有檔案核對 | 通過。四份 UI-05C1 新檔已另做未追蹤檔案空白檢查。原有三份探索文件及三張高保真 SHA-256 一致。 |

本輪新增本文件、[正式 JSON](../assets/data/explore-places.json)、[讀取模型](../src/explore-places.ts) 與 [校驗腳本](../scripts/test-explore-places.cjs)。
