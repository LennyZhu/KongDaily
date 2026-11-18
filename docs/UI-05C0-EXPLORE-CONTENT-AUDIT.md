# KongDaily · UI-05C0 探索精選地點官方資料審計

核對日為 **2026-11-18（香港時間）**。本報告的 A 級是可交開發者審閱的收錄建議。場地、交通及山徑安排須於發佈前複核。審計日未確認任何可交予地圖 App 的目的地座標，首批可先以雙語離線內容和官方連結交付。

## 1. Git 與現有實作

`develop` 的 HEAD 是 `8c53b9ad85e74faf418559d51b87e8078edf2028`，與本機 `origin/develop` 一致。開始時有五份未追蹤檔案，包括 UI-05A、UI-05B 文件及三張 UI-05B 高保真。已閱讀兩份文件並實際檢視三張圖。這輪新增本報告，並在 UI-05B 規格補記已批准的「查看全部」和「精選看點」。既有 UI-05A 報告與三張高保真保留原樣。[UI-05A](UI-05A-EXPLORE-AUDIT.md)、[UI-05B](UI-05B-EXPLORE-DESIGN-REVIEW.md)

探索現有四類透過 `category` 路由參數切換，目前仍是空狀態。首頁行山、海濱捷徑沿用 `/explore?category=hiking` 和 `/explore?category=waterfront`。龍脊和西九精選卡目前為靜態展示。現有 `useLanguage` 提供 `zh-HK`、`en` 及跟從系統。附近的 `showFacilityDirections` 接受既有 `Facility` 參考座標，提供 Apple 地圖／Google Maps 選單。後續探索可復用選單行為及外鏈失敗處理，目的地仍須通過本模組的身份及用途校驗。天氣警告已有 `Linking.openURL` 及雙語錯誤提示可供參考。[探索頁](../src/app/%28tabs%29/explore.tsx)、[首頁](../src/app/%28tabs%29/index.tsx)、[字典](../src/i18n.ts)、[語言狀態](../src/language.tsx)、[設施導航](../src/facility-navigation.ts)、[官方外鏈用例](../src/app/weather/warnings.tsx)

## 2. 候選總表

| 級別 | 正式名稱／English | 穩定內容 ID 候選 | 主類 · 其他分類 | 地區 | 與附近或候選的關係 | 導航 |
| --- | --- | --- | --- | --- | --- | --- |
| A | 龍脊／Dragon’s Back | `dragons-back-to-tei-wan-tai-tam-gap` | hiking | 南區 / Southern | 路線與沿途觀景點、巴士站是不同身份。 | unverified |
| B | 菠蘿壩自然教育徑／Pineapple Dam Nature Trail | `pineapple-dam-nature-trail` | hiking | 城門水塘一帶 / Shing Mun Reservoir area | 只審教育徑。城門畔塘徑、遊客中心及周邊廁所各自獨立。行政區待分段核對。 | unverified |
| A | 山頂環迴步行徑／Peak Circle Walk | `peak-circle-walk` | hiking | 中西區 / Central and Western | 盧吉道及夏力道環線。山頂花園是另一次郊遊，非此環線。 | unverified |
| A | 藝術公園（西九文化區）／Art Park (West Kowloon Cultural District) | `west-kowloon-art-park` | waterfront · pets | 油尖旺區 / Yau Tsim Mong | 同一筆內容提供海濱與攜寵資訊。西九其他場地與室內設施各有規則。 | unverified |
| A | 星光大道／Avenue of Stars | `avenue-of-stars` | waterfront | 油尖旺區 / Yau Tsim Mong | 指尖沙咀海濱的電影主題段，與整段海濱花園範圍有重疊。附近沒有同名星光大道記錄。 | unverified |
| C | 尖沙咀海濱花園／Tsim Sha Tsui Promenade | `tsim-sha-tsui-promenade`（未採用） | waterfront | 油尖旺區 / Yau Tsim Mong | 首批選電影主題段。附近 `inclusive-pet-035` 對應海濱花園指定共享位置，身份有別。 | not_applicable |
| A | 香港公園／Hong Kong Park | `hong-kong-park` | parks | 中西區 / Central and Western | 附近 `park-040`。探索著重舊軍營文物及水景。 | unverified |
| A | 九龍寨城公園／Kowloon Walled City Park | `kowloon-walled-city-park` | parks | 九龍城區 / Kowloon City | 附近 `park-003`。探索介紹衙門及南門遺址。 | unverified |
| A | 大埔海濱公園／Tai Po Waterfront Park | `tai-po-waterfront-park` | parks · waterfront | 大埔區 / Tai Po | 附近一般公園 `park-012`、共享指定位置 `inclusive-pet-031` 各自維持。本文只介紹公園及海濱。 | unverified |
| B | 中山紀念公園（指定位置）／Sun Yat Sen Memorial Park (Designated Areas) | `sun-yat-sen-memorial-park`（本輪暫留） | pets | 中西區 / Central and Western | 附近 `inclusive-pet-030`。確認共享範圍前，整園看點只作審計背景。 | unverified |
| C | 西九藝術公園的寵物區／Art Park’s designated pet area (WestK Pet Club) | 沿用 `west-kowloon-art-park` | pets（合入藝術公園） | 油尖旺區 / Yau Tsim Mong | 官方新版英文指引命名 WestK Pet Club。以同一藝術公園詳情承載範圍及規則。 | not_applicable |
| A | 山頂花園／Victoria Peak Garden | `victoria-peak-garden` | pets · parks | 中西區 / Central and Western | 附近 `inclusive-pet-040`。以園景及前總督山頂別墅的歷史位置提供額外遊覽價值。 | unverified |

附近重疊以本機索引、官方場地名及範圍交叉查核。普通公園與其寵物指定位置在附近仍保有獨立身份。探索使用自己的固定內容 ID，只有證據支持時才記錄關聯。公廁、車站或接駁點的空間鄰近關係不構成同一場地。[一般公園索引](../assets/data/lcsd-parks.json)、[寵物共享索引](../assets/data/lcsd-inclusive-pet-parks.json)、[設施身份審計](ui-04c-official-data-audit.md)

## 3. 行山郊遊 · 逐筆內容與證據

### 龍脊／Dragon’s Back · A

**身份。** 採漁護署「郊野樂行」由土地灣港島徑第八段入口至大潭峽的路線版本。旅發局同名介紹包含往大浪灣的走法，其行程可供另查。英文主要證據用漁護署雙語地圖，旅發局英文頁只核對名稱、景觀及土地灣接駁。正式標題保留龍脊，詳情標明大潭峽終點。[郊野樂行路線（繁）](https://www.hiking.gov.hk/trail/info/id/UWgvZytZSlRrcnBJSU5DWVZUa2pyUT09)、[漁護署路線圖（雙語）](https://www.hiking.gov.hk/console/public/uploads/others/file/68f933da5236fcc578458846059ce109ce87b211.pdf)、[旅發局內容（英）](https://www.discoverhongkong.com/eng/place-to-go/travel.guide-dragon-s-back.html)

**簡介／Summary.** 從土地灣踏上開揚山脊，經大潭灣和石澳方向的觀景位置，最後走往大潭峽。／ Follow the ridge from To Tei Wan, with views towards Tai Tam Bay and Shek O before finishing at Tai Tam Gap.

- **看點 1。** 初段觀景點可看大潭灣與大潭港。／ The early lookout faces Tai Tam Bay and Tai Tam Harbour. [漁護署路線](https://www.hiking.gov.hk/trail/info/id/UWgvZytZSlRrcnBJSU5DWVZUa2pyUT09)
- **看點 2。** 打爛埕頂山可俯看石澳灣一帶。／ Look over the coast by Shek O from Shek O Peak. [漁護署景點（繁）](https://www.hiking.gov.hk/promote/info/id/bGxMc2FyRXQvajBqQXFSNHlHOUlTZz09/map_type/1)、[漁護署景點（雙語）](https://www.hiking.gov.hk/console/public/uploads/trail/5db6695f25c84.pdf)

**交通／Transport.** 漁護署列城巴 9 號至石澳道土地灣站。下車後循港島徑標示步行往起點。大潭峽方向的回程接駁是歌連臣角站。／ AFCD lists Citybus 9 to To Tei Wan on Shek O Road. Follow the Hong Kong Trail signs from the stop. Cape Collinson is the onward bus stop on the Tai Tam Gap side. [漁護署交通段](https://www.hiking.gov.hk/trail/info/id/UWgvZytZSlRrcnBJSU5DWVZUa2pyUT09)、[旅發局英文交通交叉核對](https://www.discoverhongkong.com/eng/place-to-go/travel.guide-dragon-s-back.html)

**注意／Before you go.** 按漁護署地圖確認大潭峽走法，出發前查看山徑公告、天氣和巴士安排。／ Check the AFCD map for the Tai Tam Gap itinerary and review trail notices, weather and bus service before setting out. [漁護署山徑公告](https://www.hiking.gov.hk/news)

### 菠蘿壩自然教育徑／Pineapple Dam Nature Trail · B

**身份。** 城門水塘旁的自然教育徑。官方頁分別標記起點、終點與小巴總站。回到起點需循林道或原路折返。立法會舊表把起終點均概括為「菠蘿壩」，不能據此將路徑繪為一個環圈。葵青／荃灣的行政區欄位尚未完成路段級核對。草案沿用「城門水塘一帶」。[漁護署教育徑（繁）](https://www.hiking.gov.hk/trail/info/id/dUNQblk0eTArL1RqVWVFWForbytaZz09)、[漁護署郊野公園（英）](https://www.afcd.gov.hk/english/country/cou_vis/cou_vis_cou/cou_vis_cou_sm/cou_vis_cou_sm.HTML)、[立法會附件](https://gia.info.gov.hk/general/201801/24/P2018012400768_276772_1_1516790904985.pdf)

**簡介／Summary.** 沿城門水塘旁的林徑認識植林與水塘景觀。／ Explore the woodland plantings and reservoir scenery along this nature trail.

- **看點 1。** 步道兩旁的植林可見楓香、紅膠木與台灣相思。／ Look for sweet gums, red gums and Taiwan acacias in the woodland. [漁護署教育徑](https://www.hiking.gov.hk/trail/info/id/dUNQblk0eTArL1RqVWVFWForbytaZz09)
- **看點 2。** 水塘岸邊的白千層林提供另一種近水景觀。／ Look for paperbark trees by the reservoir. [漁護署白千層林](https://www.hiking.gov.hk/promote/info/id/V2JJVDNVR25Lc0lnV1pZdC9NdHVBZz09)、[漁護署遊客中心（英）](https://www.afcd.gov.hk/english/country/cou_lea/cou_lea_ven/shingmun.html)

**交通／Transport.** 官方列荃灣兆和街乘專線小巴 82 至城門水塘菠蘿壩總站，再按教育徑指示步行。／ AFCD lists green minibus 82 from Shiu Wo Street, Tsuen Wan, to the Pineapple Dam terminus. Follow the nature trail signs from there. [漁護署交通（繁）](https://www.hiking.gov.hk/trail/info/id/dUNQblk0eTArL1RqVWVFWForbytaZz09)、[漁護署交通（英）](https://enjoyleisure.afcd.gov.hk/en-US/activities/fisheries/shing-mun-country-park-visitor-centre-74?page=7&pageSize=8)

**注意／Before you go.** 切勿餵飼或驚擾獼猴，先查漁護署封閉附圖和現場指示。／ Do not feed or disturb macaques. Check AFCD’s closure map and follow on-site signs. 11 月 5 日公告列城門部分林道及山徑封閉至另行通知，附件另區分施工中的大城石澗林道路段。本輪無法確認封閉線與教育徑及其回程的完整關係，先列 B，亦不宣稱整條教育徑封閉。[漁護署公告](https://www.hiking.gov.hk/news)、[雙語封閉附圖](https://www.hiking.gov.hk/console/public/uploads/news/f77bf0b3772a3efd7c0c1fb234b656efbc843ef7.pdf)、[野生獼猴](https://www.afcd.gov.hk/english/conservation/hkbiodiversity/speciesgroup/speciesgroup_mammals.html)

### 山頂環迴步行徑／Peak Circle Walk · A

**身份。** 採旅發局及山頂營運方的盧吉道、夏力道環線。官方英文路線由凌霄閣旁進入盧吉道，再經夏力道回到起步一帶。柯士甸山道通往山頂花園的支線另屬一筆體驗。[旅發局（繁）](https://www.discoverhongkong.com/tc/place-to-go/travel.guide-peak-circle-walk.html)、[旅發局（英）](https://www.discoverhongkong.com/eng/place-to-go/travel.guide-peak-circle-walk.html)、[山頂營運方步行指引（英）](https://www.thepeak.com.hk/en/the-peak-experience/nature-walks)

**簡介／Summary.** 走盧吉道和夏力道繞山頂一圈，途中可看維港和林蔭。／ Circle the Peak via Lugard Road and Harlech Road, combining harbour views with shaded stretches.

- **看點 1。** 盧吉道向維港一側可眺望港島和九龍。／ The harbour-facing stretch of Lugard Road looks across to urban Hong Kong Island and Kowloon. [旅發局（繁）](https://www.discoverhongkong.com/tc/place-to-go/travel.guide-peak-circle-walk.html)
- **看點 2。** 沿盧吉道留意保留的早期香港住宅，包括 1 號及 27 號。只介紹外觀。／ Look for early Hong Kong residences along Lugard Road, including Nos. 1 and 27, from the road. [旅發局（英）](https://www.discoverhongkong.com/eng/place-to-go/travel.guide-peak-circle-walk.html)

**交通／Transport.** 由花園道乘山頂纜車至凌霄閣，或按旅發局指引乘巴士到山頂廣場，再循盧吉道指示。／ Take the Peak Tram from Garden Road, or consult HKTB’s bus directions to Peak Galleria and follow signs for Lugard Road. [交通指引（繁）](https://www.discoverhongkong.com/tc/place-to-go/travel.guide-peak-circle-walk.html)、[交通指引（英）](https://www.discoverhongkong.com/eng/place-to-go/travel.guide-peak-circle-walk.html)

**注意／Before you go.** 運輸安排可能有變，出發前重查旅發局交通及現場告示。／ Check the visitor transport guide and on-site notices before walking the circuit. [旅發局（英）](https://www.discoverhongkong.com/eng/place-to-go/travel.guide-peak-circle-walk.html)

## 4. 海濱景點 · 逐筆內容與證據

### 藝術公園（西九文化區）／Art Park (West Kowloon Cultural District) · A

**身份。** 對象為西九藝術公園。管理局文件列海濱長廊、草坪和觀景台，另列入區路徑和寵物區位置。主站場地頁直開被排隊頁攔截，本輪以成功取得的管理局兩語 PDF 和雙語公眾休憩用地守則為證據。英文 2026 版稱 WestK Pet Club，繁中 2025 版稱寵物區。草案可先用「近西閘的指定寵物區」。[管理局藝術公園指引（繁）](https://webmedia.westkowloon.hk/documents/Access-Guide-202501_Art%20Park_TC_FINAL_tagged.pdf)、[管理局藝術公園指引（英）](https://webmedia.westkowloon.hk/documents/Art-Park-Access-Guide-202601-EN-tagged.pdf)、[管理局休憩用地守則（雙語）](https://webmedia.westkowloon.hk/documents/WKCD%20POS%20Rules%20%26%20Regulations_TC%20%26%20ENG.pdf?VersionId=kNunCAKhd9bJ6OclDS9UdLdWWJTJuVIm)

**簡介／Summary.** 在西九藝術公園沿海濱看維港，在草坪一帶停留，再登觀景台換個角度看看海旁。／ Walk along the Art Park waterfront, pause by the lawns and take in another harbour angle from the viewing terrace.

- **看點 1。** 從海濱長廊看向對岸，途中有海旁草坪。／ Follow the promenade for cross-harbour views and lawns by the water. [管理局英文指引 §1、§3](https://webmedia.westkowloon.hk/documents/Art-Park-Access-Guide-202601-EN-tagged.pdf)
- **看點 2。** 一樓觀景台提供較高的海濱視角。／ The first-floor viewing terrace offers a higher vantage point over the waterfront. [管理局繁中指引 §3.1](https://webmedia.westkowloon.hk/documents/Access-Guide-202501_Art%20Park_TC_FINAL_tagged.pdf)
- **看點 3。** 近西閘設有雙閘的指定寵物區，可把海濱散步與該處停留安排在一起。／ Pair a waterfront walk with a stop at the designated double-gated pet area near the West Gate. [管理局英文指引 §3.2](https://webmedia.westkowloon.hk/documents/Art-Park-Access-Guide-202601-EN-tagged.pdf)

**交通／Transport.** 由港鐵九龍站參考管理局地圖，經圓方和藝術廣場天橋前往。／ From MTR Kowloon Station, follow the district’s visitor map via Elements and Artist Square Bridge. [管理局英文指引 §1.2、§2.1](https://webmedia.westkowloon.hk/documents/Art-Park-Access-Guide-202601-EN-tagged.pdf)

**注意／Before you go.** 在適用的戶外公共地方，寵物區外須以牽繩或合適容器管理寵物。只有指定寵物區內可解繩，須清理便溺物並遵循告示。出發前核對場地與通行安排。／ In the applicable public outdoor areas, keep pets on a lead or in a suitable carrier outside the designated pet area. Only let them off lead in the designated area, clean up after them and follow posted instructions. Check the latest access arrangements before visiting. [雙語場地守則第 2 條](https://webmedia.westkowloon.hk/documents/WKCD%20POS%20Rules%20%26%20Regulations_TC%20%26%20ENG.pdf?VersionId=kNunCAKhd9bJ6OclDS9UdLdWWJTJuVIm)、[管理局英文指引 §3.2、§4.3](https://webmedia.westkowloon.hk/documents/Art-Park-Access-Guide-202601-EN-tagged.pdf)

### 星光大道／Avenue of Stars · A

**身份。** 定位為尖沙咀海濱的香港電影主題步道。鐘樓、碼頭及整段尖沙咀海濱花園可作周邊參考。首版只為電影主題段建立一筆海濱內容。[旅發局星光大道（繁）](https://www.discoverhongkong.com/tc/place-to-go/travel.guide-avenue-of-stars.html)、[旅發局星光大道（英）](https://www.discoverhongkong.com/eng/place-to-go/travel.guide-avenue-of-stars.html)

**簡介／Summary.** 沿維港散步，從影人掌印和雕塑認識香港電影。／ Walk beside Victoria Harbour and explore Hong Kong cinema through its handprints and sculptures.

- **看點 1。** 沿木欄找不同香港影人的掌印。／ Look for handprints of Hong Kong film figures along the railings. [旅發局海濱專題（繁）](https://www.discoverhongkong.com/tc/attractions/top-things-to-see-and-do-around-tsim-sha-tsui-promenade.html)
- **看點 2。** 李小龍雕像是電影主題段的具體停留點。／ Pause at the Bruce Lee statue, one of the film-themed stops on the promenade. [旅發局海濱專題（英）](https://www.discoverhongkong.com/eng/attractions/top-things-to-see-and-do-around-tsim-sha-tsui-promenade.html)

**交通／Transport.** 可乘天星小輪抵尖沙咀碼頭，再沿海濱步行往星光大道。／ Arrive by Star Ferry at Tsim Sha Tsui Pier and follow the waterfront to the Avenue of Stars. [旅發局步行次序（英）](https://www.discoverhongkong.com/eng/attractions/top-things-to-see-and-do-around-tsim-sha-tsui-promenade.html)、[旅發局地點（繁）](https://www.discoverhongkong.com/tc/place-to-go/travel.guide-avenue-of-stars.html)

**注意／Before you go.** 海濱步行範圍大，沿現場標示找電影主題段。乘船前查看碼頭安排。／ The waterfront covers a wide area. Follow signs to the film-themed section and check pier arrangements before taking the ferry. [旅發局海濱專題](https://www.discoverhongkong.com/tc/attractions/top-things-to-see-and-do-around-tsim-sha-tsui-promenade.html)

### 尖沙咀海濱花園／Tsim Sha Tsui Promenade · C

**身份。** 康文署雙語場地查詢列梳士巴利道場地。旅發局同名海濱遊覽文章採較長的步行敘事，包含碼頭、鐘樓及星光大道。首批選較明確的電影主題內容，避免兩張卡向用戶推薦同一路段。共享公園的指定位置繼續由附近提供，無整段可攜寵結論。[康文署場地（繁）](https://www.lcsd.gov.hk/clpss/tc/webApp/PhoneAddress.do)、[康文署場地（英）](https://www.lcsd.gov.hk/clpss/en/webApp/PhoneAddress.do)、[康文署共享名單（雙語）](https://www.lcsd.gov.hk/en/common/pdf/Annex_IPP_Venue.pdf)

**簡介／Summary.** 由碼頭沿海濱走，串連鐘樓一帶與跨海港景色。／ Start near the pier and walk along the waterfront past the Clock Tower, with views across the harbour.

- **看點 1。** 天星碼頭旁的鐘樓保留了舊鐵路總站的歷史線索。／ The Clock Tower by the Star Ferry Pier recalls the former railway terminus. [旅發局（繁）](https://www.discoverhongkong.com/tc/attractions/top-things-to-see-and-do-around-tsim-sha-tsui-promenade.html)
- **看點 2。** 海濱人行道面向維港，可看對岸港島天際線。／ The promenade overlooks Victoria Harbour and the Hong Kong Island skyline. [旅發局（英）](https://www.discoverhongkong.com/eng/attractions/top-things-to-see-and-do-around-tsim-sha-tsui-promenade.html)

**交通及注意／Transport and cautions.** 旅發局行程由尖沙咀碼頭一帶起步。不同區段及碼頭有各自安排。攜寵時只依康文署指定區及現場告示。／ HKTB starts the walk near Tsim Sha Tsui Pier. Check arrangements for individual stretches and piers, and follow LCSD’s designated pet areas and on-site signs. [旅發局路線（英）](https://www.discoverhongkong.com/eng/attractions/top-things-to-see-and-do-around-tsim-sha-tsui-promenade.html)、[康文署共享守則（繁）](https://www.lcsd.gov.hk/tc/facilities/otherinfo/petpark.html)

## 5. 公園休憩 · 逐筆內容與證據

### 香港公園／Hong Kong Park · A

**身份。** 中環與金鐘之間的康文署香港公園，和香港動植物公園是不同場地。附近 `park-040` 作為同場地參考。探索特色以水景、軍營沿革及可核實的園內景點為主。[康文署（繁）](https://hkp.lcsd.gov.hk/tc/visit)、[康文署（英）](https://hkp.lcsd.gov.hk/en/visit)

**簡介／Summary.** 從人工湖和瀑布走到舊軍營文物建築，看看一座市區公園如何利用原有地形。／ Explore a city park shaped around an artificial lake, a waterfall and buildings from the former garrison.

- **看點 1。** 人工湖與瀑布位於昔日軍營網球場一帶。／ The park’s lake and waterfall occupy the site of a former garrison tennis court. [康文署繁中參觀介紹](https://hkp.lcsd.gov.hk/tc/visit)
- **看點 2。** 園內的旗杆屋保留了維多利亞軍營時期的建築。／ Flagstaff House preserves part of the site’s garrison-era architecture. [康文署英文參觀介紹](https://hkp.lcsd.gov.hk/en/visit)
- **看點 3。** 尤德觀鳥園借用了山坡旁的天然山谷地形。／ The Edward Youde Aviary is set in a natural valley on the hillside. [康文署觀鳥園（繁）](https://hkp.lcsd.gov.hk/tc/facilities/aviary)、[康文署觀鳥園（英）](https://hkp.lcsd.gov.hk/en/facilities/aviary)

**交通／Transport.** 由港鐵金鐘站或中環站按公園官網的出口及交通指引步行前往。／ Use the park’s official visitor directions from MTR Admiralty or Central. [參觀交通（繁）](https://hkp.lcsd.gov.hk/tc/visit)、[參觀交通（英）](https://hkp.lcsd.gov.hk/en/visit)

**注意／Before you go.** 公園與觀鳥園等設施有各自安排，惡劣天氣可暫停開放。請查當天官網。／ Visitor arrangements vary by facility, and severe weather may cause closures. Check the park website on the day. [康文署開放安排（繁）](https://hkp.lcsd.gov.hk/tc/visit)

### 九龍寨城公園／Kowloon Walled City Park · A

**身份。** 九龍城東正道的公園，曾為九龍寨城所在。附近 `park-003` 是園址參考。收錄以可追溯的戶外遺址與建築為主，展覽及入場安排另走官網。[康文署園址（繁）](https://www.lcsd.gov.hk/tc/parks/kwcp/index.html)、[康文署園址（英）](https://www.lcsd.gov.hk/en/parks/kwcp/)

**簡介／Summary.** 從衙門、南門遺址和園林小徑回看九龍寨城的歷史。／ Trace the history of Kowloon Walled City through the Yamen, South Gate remnants and garden paths.

- **看點 1。** 衙門是保留下來的寨城建築，位於公園中心一帶。／ The surviving Yamen building is a focal point near the centre of the park. [康文署衙門（英）](https://www.lcsd.gov.hk/en/parks/kwcp/his/yamen.html)
- **看點 2。** 南門遺址保留出土的石碑與門基等遺存。／ At the South Gate remnants, look for the excavated stone plaques and gate foundations. [康文署南門（英）](https://www.lcsd.gov.hk/en/parks/kwcp/his/gate.html)、[古蹟辦雙語名單](https://www.amo.gov.hk/filemanager/amo/common/form/list_government-owned_DM_open.pdf)

**交通／Transport.** 參照康文署「如何前往」的巴士及專線小巴資料，到九龍城東正道一帶再按園圖選入口。／ Use LCSD’s bus or green-minibus guidance for Tung Tsing Road in Kowloon City, then follow the park map to a suitable gate. [交通（繁）](https://www.lcsd.gov.hk/tc/parks/kwcp/access.html)、[交通（英）](https://www.lcsd.gov.hk/en/parks/kwcp/access.html)

**注意／Before you go.** 園區及室內文物各有安排，有意參觀衙門內部請先查園方資料。／ Outdoor grounds and indoor heritage spaces have separate arrangements. Check the park’s guidance before planning an interior visit. [古蹟辦開放名單](https://www.amo.gov.hk/filemanager/amo/common/form/list_government-owned_DM_open.pdf)、[康文署園址（繁）](https://www.lcsd.gov.hk/tc/parks/kwcp/index.html)

### 大埔海濱公園／Tai Po Waterfront Park · A

**身份。** 大發街的公園本體。一般公園與共享指定位置在本機索引是不同標記。本篇以吐露港、香港回歸紀念塔和海濱長廊為主，既可屬公園休憩，也可列為海濱景點。[康文署（繁）](https://www.lcsd.gov.hk/tc/parks/tpwp/index.html)、[康文署（英）](https://www.lcsd.gov.hk/en/parks/tpwp/)

**簡介／Summary.** 沿着大埔海濱散步，從長廊和紀念塔一帶看吐露港。／ Walk the Tai Po waterfront and take in Tolo Harbour from the promenade and lookout area.

- **看點 1。** 海濱長廊串連公園面向吐露港的一側。／ The promenade follows the park’s Tolo Harbour frontage. [康文署年報（繁）](https://www.lcsd.gov.hk/dept/annualrpt/2022-23/tc/leisure_services/recreational_and_sports_facilities/)
- **看點 2。** 香港回歸紀念塔以螺旋形設計提供較高的觀景位置。／ The Spiral Lookout Tower offers an elevated view over Tolo Harbour. [康文署年報（英）](https://www.lcsd.gov.hk/dept/annualrpt/2022-23/en/leisure_services/recreational_and_sports_facilities/)、[康文署戶外設施（英）](https://www.lcsd.gov.hk/en/parks/tpwp/facilities/outdoor.html)

**交通／Transport.** 按康文署巴士／公共交通指引前往大埔大發街一帶，再依園圖選入口。／ Use LCSD’s public transport guidance for the Dai Fat Street area and consult the park map for your entrance. [交通（繁）](https://www.lcsd.gov.hk/tc/parks/tpwp/access.html)、[交通（英）](https://www.lcsd.gov.hk/en/parks/tpwp/access.html)

**注意／Before you go.** 登塔與其他個別設施以現場及官網安排為準。康文署名單只支持指定位置的寵物共享，本篇不延伸為整園攜寵建議。／ Check official arrangements before planning to visit the tower or other facilities. LCSD lists only designated areas for pet-inclusive access. [康文署園址](https://www.lcsd.gov.hk/tc/parks/tpwp/index.html)、[指定位置名單](https://www.lcsd.gov.hk/en/common/pdf/Annex_IPP_Venue.pdf)

## 6. 寵物友善 · 逐筆內容與規則

### 山頂花園／Victoria Peak Garden · A

**身份。** 中西區柯士甸山道的山頂花園。康文署中西區清單沒有附加「指定位置」，最新雙語總名單亦未加指定位置標記，與政府首批開放整園的答覆一致。整座山頂花園可按共享守則攜寵。規則適用範圍只到花園場地，沿途交通及附近其他場地按各自規則。附近 `inclusive-pet-040` 維持原身份。[康文署分區清單（繁）](https://www.lcsd.gov.hk/clpss/tc/webApp/Facility/Details.do?ftid=165)、[康文署分區清單（英）](https://www.lcsd.gov.hk/clpss/en/webApp/Facility/Details.do?did=1&fcid=&ftid=165)、[康文署總名單（雙語）](https://www.lcsd.gov.hk/en/common/pdf/Annex_IPP_Venue.pdf)、[政府答覆（英）](https://www.info.gov.hk/gia/general/201901/23/P2019012300383p.htm)

**簡介／Summary.** 到柯士甸山道上方的園景和亭子走一趟，也可留意前總督山頂別墅的歷史痕跡。／ Walk through the garden and pavilions above Mount Austin Road and look for traces of the former Governor’s summer residence.

- **看點 1。** 由柯士甸山道上行後，可沿園內蜿蜒小徑經過草地與亭子。／ Follow winding paths past lawns and pavilions after walking up Mount Austin Road. [旅發局山頂花園段（繁）](https://www.discoverhongkong.com/tc/place-to-go/travel.guide-peak-circle-walk.html)、[旅發局山頂花園段（英）](https://www.discoverhongkong.com/eng/place-to-go/travel.guide-peak-circle-walk.html)
- **看點 2。** 前總督山頂別墅守衛室可作為閱讀園址歷史的路標。／ The Gate Lodge is a landmark for understanding the site’s former use as a summer residence. [古物古蹟辦事處（繁）](https://www.amo.gov.hk/tc/historic-buildings/monuments/hong-kong-island/monuments_52/index.html)、[古物古蹟辦事處（英）](https://www.amo.gov.hk/en/historic-buildings/monuments/hong-kong-island/monuments_52/index.html)

**交通／Transport.** 先按官方交通資訊到山頂，從凌霄閣旁循柯士甸山道上行。攜寵者出發前先查營運商的攜寵條款。／ Reach the Peak and walk uphill along Mount Austin Road from beside the Peak Tower. If travelling with a pet, check the transport operator’s policy first. [山頂營運方步行路線（英）](https://www.thepeak.com.hk/en/the-peak-experience/nature-walks)、[旅發局（繁）](https://www.discoverhongkong.com/tc/place-to-go/travel.guide-peak-circle-walk.html)

**注意／Before you go.** 狗隻須繫牽繩並受控制，請清理便溺物並遵循現場告示。／ Keep dogs on a lead and under control, clean up after them and follow on-site signs. [共享守則（繁）](https://www.lcsd.gov.hk/tc/facilities/otherinfo/petpark.html)、[共享守則（英）](https://www.lcsd.gov.hk/en/facilities/otherinfo/petpark.html)

### 中山紀念公園（指定位置）／Sun Yat Sen Memorial Park (Designated Areas) · B

**身份。** 康文署雙語清單及共享名單均指西營盤東邊街北的指定位置。整園官方地圖標出「寵物共享公園入口」，本輪尚未取得能對應完整範圍的官方界線。園內紀念草坪和其他景點不能據此視作可攜寵的地方。[康文署指定位置（繁）](https://www.lcsd.gov.hk/clpss/tc/webApp/Facility/Details.do?ftid=165)、[康文署指定位置（英）](https://www.lcsd.gov.hk/clpss/en/webApp/Facility/Details.do?did=1&fcid=&ftid=165)、[康文署地圖，附錄頁 12](https://www.lcsd.gov.hk/en/common/pdf/eoiApp_en1.pdf)

**簡介／Summary.** 在西營盤海旁了解中山紀念公園的紀念設計，攜寵行程須依園內指定範圍。／ On the Sai Ying Pun waterfront, discover the park’s commemorative design and follow the designated boundaries if visiting with a pet.

- **看點 1。** 紀念草坪上的孫中山銅像是全園的歷史看點。／ The bronze statue on the Memorial Lawn is a point of interest in the wider park. [民政事務總署區內景點（繁）](https://www.gohk.gov.hk/tc/spots/spot_detail.php?spot=Sun+Yat+Sen+Memorial+Park)
- **看點 2。** 公園海濱長廊提供面向維港的步行空間。以上兩點屬全園資料，能否攜寵到達尚待核對。／ The park promenade provides a waterfront walk. Pet access to these two points has yet to be confirmed. [民政事務總署區內景點（英）](https://www.gohk.gov.hk/en/spots/spot_detail.php?spot=Sun+Yat+Sen+Memorial+Park)

**交通及注意／Transport and cautions.** 以東邊街北作查詢起點，按官方交通連結與園圖找指定的共享入口。狗隻須繫牽繩、保持受控並清理便溺物。／ Plan for Eastern Street North using the official visitor links and look for the signed pet-inclusive entrance on the park map. Keep dogs leashed and under control, and clean up after them. 現有附近記錄已提供指定位置，應在核實界線及至少兩項可在該範圍內體驗的看點後，才放入探索寵物類。 [康文署園址（繁）](https://www.lcsd.gov.hk/tc/parks/sysmp/index.html)、[康文署園址（英）](https://www.lcsd.gov.hk/en/parks/sysmp/index.html)、[共享守則（雙語另頁）](https://www.lcsd.gov.hk/en/facilities/otherinfo/petpark.html)

### 西九藝術公園寵物區／Art Park’s designated pet area · C 作獨立條目

草案描述為「在近西閘的指定寵物區停留，亦可在符合規例的戶外空間牽繩散步。」／ “Visit the designated pet area near the West Gate and take a leashed walk in the applicable outdoor spaces.” 兩項看點分別是有雙閘的寵物區和戶外海濱散步。可用西閘及管理局指引查找位置。離開指定區要重新繫牽繩或用合適容器。所有內容及交通方式已納入同一藝術公園 ID。這項 C 決定只適用於重複建卡。[管理局繁中指引 §3.2](https://webmedia.westkowloon.hk/documents/Access-Guide-202501_Art%20Park_TC_FINAL_tagged.pdf)、[管理局英文指引 §2.1、§3.2](https://webmedia.westkowloon.hk/documents/Art-Park-Access-Guide-202601-EN-tagged.pdf)、[雙語守則](https://webmedia.westkowloon.hk/documents/WKCD%20POS%20Rules%20%26%20Regulations_TC%20%26%20ENG.pdf?VersionId=kNunCAKhd9bJ6OclDS9UdLdWWJTJuVIm)

## 7. 導航與座標核驗

`unverified` 表示尚無足夠證據啟用 App 的地圖導航。已知地點文字或本機參考座標可以交叉核對身份。只有足以把用戶帶至具名、適合行人前往的地點才可標為 `verified`。各列 WGS84 座標若出自附近索引，表內欄序為 **緯度、經度**，僅作審計參照。官方 GeoJSON 與 WGS84 REST 比對流程由既有構建腳本記錄。[一般公園校驗](../scripts/build-lcsd-parks.py)、[寵物共享校驗](../scripts/build-lcsd-inclusive-pet-parks.py)

| 候選 | 已核對的位置及用途 | 為何未啟用導航 |
| --- | --- | --- |
| 龍脊 | 路線由土地灣至大潭峽。起步用港島徑第八段土地灣入口，終點走向大潭峽。打爛埕頂山和大潭灣觀景位置是途中景點。土地灣與歌連臣角為接駁站。 | 官方線圖能分清用途，GPX 可見連結但原檔未讀取成功。現無獨立可驗證的起點 WGS84 與進入路徑。保留官方資料。 |
| 菠蘿壩 | 漁護署交通段把菠蘿壩小巴總站、教育徑起點及終點分列。白千層是觀景內容。康文署 `KK058782` 指另一行程的城門水塘菠蘿壩集合地一帶。 | 地圖格網碼精度和用途不足以作教育徑入口。官方 GPX 未讀取成功，封閉範圍及回程尚待核對。 |
| 山頂環迴 | 盧吉道靠凌霄閣一側起步，夏力道返回起步一帶。維港視野在途中。山頂纜車站及山頂廣場為接駁點。 | 官方提供文字及路徑，缺能獨立驗證的入口座標。查圖時不可選山頂標高點、凌霄閣建築中心或纜車站。 |
| 藝術公園 | 官方圖把西閘、藝術廣場天橋、長廊、草坪和寵物區分開。 | 圖上的位置描述足以提供到達指引。尚未核實具名的公共步行抵達點及其 WGS84。整個西九和寵物區皆不能作替代。 |
| 星光大道 | 尖沙咀海濱的電影主題段。碼頭是接駁處，雕像是途中看點。 | 可按官方步行指引前往，缺已核實的具名入口或適合行人抵達的位置座標。 |
| 尖沙咀海濱花園 | 附近 `inclusive-pet-035` 為 22.2943661704, 114.1759671786，屬共享場地參考點。 | 本輪不獨立收錄。共享參考點不代表全段入口。 |
| 香港公園 | `park-040` 為 22.2773076528, 114.1613882592，屬公園場地參考。 | 尚未核對與某一可通行的行人出入口相符。可用官方門口及車站指引。 |
| 九龍寨城公園 | `park-003` 為 22.3316558889, 114.1898271393，屬公園場地參考。園圖有多閘。 | 保留東正道交通資訊。某個出入口的 WGS84 與行人進入路徑待查。 |
| 大埔海濱公園 | `park-012` 為 22.4518272522, 114.1790049317；`inclusive-pet-031` 為 22.4530427552, 114.1786027394。各屬原有用途不同的場地參考。 | 對應園區或共享位置的點均不足以確認大發街步行入口。 |
| 中山紀念公園 | `inclusive-pet-030` 為 22.2904503603, 114.1455324731。官方圖另標共享入口。 | 參考點未與實際門口或範圍核合。不可用作共享區入口。 |
| 西九寵物區 | 近西閘的雙閘區由官方圖確認。 | 隨藝術公園呈現文字路線，沒有獨立導航目標。 |
| 山頂花園 | `inclusive-pet-040` 為 22.2737569407, 114.1440555382，屬花園場地參考，文本地址為柯士甸山道 40 號對面。 | 缺參考點與可通行入口的吻合證據。守衛室是文物地標。 |

核對 GPX 時，網頁工具不支援 `application/gpx+xml`，直接讀取的重試在 TLS 握手失敗。此輪保留已讀的官方路線文字與地圖證據，沒有使用 GPX 線頭推定登山入口。後續即使能取到 GPX，仍應查 GPX 的 WGS84 與 waypoint 語義，分別核對具名入口、沿線及站點資料，再評估蘋果地圖與 Google Maps 的行人抵達結果。[龍脊官方來源，含原檔連結](https://www.hiking.gov.hk/trail/info/id/UWgvZytZSlRrcnBJSU5DWVZUa2pyUT09)、[菠蘿壩官方來源，含原檔連結](https://www.hiking.gov.hk/trail/info/id/dUNQblk0eTArL1RqVWVFWForbytaZz09)

## 8. 權利、署名與內容快照

| 資料 | 審計結果與分發方式 |
| --- | --- |
| DATA.GOV.HK 開放資料 | 有條件允許商業與非商業複製、下載及分發，須遵守來源及權利標示等條款。逐一保留漁護署雙語山徑、封閉山徑及康文署公園圖層的目錄。封閉資料只供狀態複核。首批內容不需要打包圖層。 |
| CSDI 康文署公園與寵物共享資料 | 可按平台條款使用其開放資料，清楚註明香港特區政府、CSDI 與資料提供者及權利。兩個圖層仍各自記錄版本及適用條款。附近的既有快照可供身份比對。 |
| 官方網頁與 PDF | 保留機構名和連結。首版只保存按事實自行撰寫的短段落，及識別公共地點所需的官方名稱。漁護署、旅發局、康文署和西九網頁及 PDF 中的圖文、版面、照片與地圖資料，須按各自授權處理。西九的場地守則和遊覽指引提供查證資料。素材的離線再分發權仍須另行取得。 |
| 圖片與地圖 | 沿用 UI-05B 批准的抽象插畫。這次沒有把網頁照片、官方 PDF 內影像、地圖或 GPX 帶入產品。未來取得照片才另核著作權、商用、裁切、離線再分發及署名。 |

[DATA.GOV.HK 使用條款](https://data.gov.hk/en/terms-and-conditions)、[CSDI 使用條款](https://portal.csdi.gov.hk/csdi-webpage/doc/TNC)、[漁護署遠足路線資料目錄](https://data.gov.hk/en-data/dataset/hk-afcd-afcdlist-hikingtrailscp/resource/4186314e-8a12-452c-b8c8-9d60eadce640)、[漁護署封閉資料目錄](https://data.gov.hk/en-data/dataset/hk-afcd-afcdlist-cpclosedtrailcsdi)、[康文署公園資料目錄](https://data.gov.hk/en-data/dataset/hk-lcsd-csdi-parks-zoos-gardens)、[康文署共享圖層](https://portal.csdi.gov.hk/csdi-webpage/dataset/lcsd_rcd_1670384557490_22821)、[漁護署版權](https://www.hiking.gov.hk/content/copyright_notice)、[旅發局網站條款](https://www.discoverhongkong.com/tc/terms-of-use.html)、[康文署重要告示](https://www.lcsd.gov.hk/en/notice.html)

首版用隨 App 發佈的靜態內容。建議維護一個審閱版本，記錄 `reviewedAt` 香港日期、來源 URL、網站或附件實際日期、官方身份及交通證據。禁止用抓取日推定場地即時開放。每次發佈前複核連結、交通、寵物規則和封閉公告，常設資料可每季重查。遇入口封閉或規則變更則安排修訂版本，必要時先移除受影響的導航或下架該條目。離線仍閱讀已審閱內容，官方連結與外部導航由當前網絡和外部服務處理。

## 9. 建議首批與 UI-05C1 邊界

**A 級建議 8 個獨立地點。** 主類為公園休憩 3 個（香港公園、九龍寨城公園、大埔海濱公園）、行山郊遊 2 個（龍脊、山頂環迴步行徑）、海濱景點 2 個（藝術公園、星光大道）、寵物友善 1 個（山頂花園）。加入有證據的次分類後，四類篩選分別可見 4、2、3、2 項。總覽按 ID 仍只有 8 筆。B 級 2 筆待路況或範圍核實，C 級 2 筆存在內容重疊。本輪建議 0 筆顯示導航。

### 建議資料契約

| 欄位 | 建議約束 |
| --- | --- |
| `id`、`category`、`additionalCategories` | 固定小寫 slug 與現行四類鍵。多類別共用 ID，次類不得含主類或重複鍵。名稱、語言及列表排序不參與身份運算。搬遷、拆分或行山終點變更要重新審核身份。 |
| `title`、`district`、`summary`、`transport`、`cautions` | 以 `{ 'zh-HK': string, en: string }` 配合現有語言狀態。A 級所需欄位雙語齊全。地方名稱與官方來源一致。 |
| `highlights` | 2–3 筆同義對齊的雙語項目，每筆關聯一或多個來源 ID。建議儲存成 `{ 'zh-HK': string, en: string, sourceIds: string[] }[]`，避免兩語索引錯位。 |
| `sources`、`reviewedAt` | 來源 ID、機構、語言、HTTPS URL、證據用途、出版或修訂日期（如已知），以及審閱日。來源語言不足時保留標籤與 fallback。行山終點與官方相同名稱的不同走法要在證據備註標明。 |
| `navigation` | 判別聯合。僅 `verified` 可帶 `destinationName`（雙語）、`coordinate`（WGS84 緯／經）、`role`（如 `trailhead`、`venue-entrance`、`pedestrian-arrival`）、來源與核對日。行山 CTA 僅接受 `trailhead`。 `unverified`／`not_applicable` 禁帶可用座標。原始點的用途、CRS 及驗證證據放在審計資料。 |
| `publicationStatus`、`reviewNotes` | 候選、暫緩及已核准發佈狀態獨立於導航。只有獲批內容進入正式包。疑義、附近身份關聯及未解事項放審閱備註，避免混成對外文案。 |

**UI-05C1** 只在開發者審閱首批後建立本機資料及校驗。需驗證唯一 ID、主次類、雙語內容、每條看點的來源、日期、導航狀態與字段互斥、排序，以及首頁龍脊／藝術公園和詳情對應的內容身份。B／C 級不進正式資料，UI 仍留待後續階段。

### 待人工確認

1. 確認首批 8 個與主次分類，首頁龍脊綁定漁護署大潭峽版本，西九綁定藝術公園。首頁素材用途仍沿 UI-05B 的權利審核。
2. 決定首版是否接受 8 筆均採「官方連結」而無可用導航。若要啟用導航，優先逐筆核對具名行人抵達點、座標來源、CRS 及道路側別。龍脊另外核對正式起點。
3. 複核菠蘿壩封閉與回程、跨行政區文案，中山紀念公園實際指定範圍及範圍內的遊覽看點。
4. 發版前由內容負責人校對兩語、最新交通及官方告示。對 PDF 舊版、西九場地頁及區內交通另做複核。

## 10. 本輪驗證

以 Git 空白檢查、文件及已讀官方證據連結核對、附近索引身份交叉檢查、候選 ID／分類去重、雙語草案欄位及導航狀態一致性為範圍。工作區變更限於設計規格和本審計文件。
