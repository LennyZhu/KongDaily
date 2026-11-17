# KongDaily · UI-04D1 設施穩定身份與收藏資料層

KongDaily 1.0 的設施收藏將使用「附近生活設施」地圖預覽、列表展開卡及現有「收藏」Tab。UI-04D0 的獨立詳情頁提案已由後續產品決定取代。本輪交付身份、SQLite 及 Repository。 [前期審計](UI-04D0-DETAIL-FAVORITES-AUDIT.md)

## 身份與索引基線

| 來源 | 記錄數 | 上游身份 | App 顯示 ID | 收藏穩定 ID |
| --- | ---: | --- | --- | --- |
| FEHD 公廁 | 960 | 當期 XML `mapID` | `mapID` | 一次性分配的 `fehd-toilet-NNNN` |
| AFCD 郊野公廁 | 167 | 當期圖層 `FAC_ID` | `FAC_ID`，保留斜線及大小寫 | 一次性分配的 `afcd-toilet-NNNN` |
| LCSD 普通公園 | 48 | PARKS `OBJECTID` | `park-NNN` | 同既有 Registry |
| LCSD 寵物專用公園 | 36 | PETG `OBJECTID` | `pet-garden-NNN` | 同既有 Registry |
| LCSD 寵物共享公園 | 45 | IPPET `OBJECTID` | `inclusive-pet-NNN` | 同既有 Registry |

兩份新增 Registry 各保留機構、上游欄位、官方來源及取得資訊、索引日期、版本和原檔 SHA-256。每筆記錄保留內部 ID、現行官方 ID、雙語名稱、可取得的地區／地址或區域、類別、WGS84 參考點和來源版本證據。FEHD 有 145 筆名稱或地址只有有效英文；AFCD 保留官方區域名稱。兩者照索引保留已有欄位，避免從另一筆資料補入名稱或地址。 [FEHD Registry](../assets/data/fehd-toilet-identity-registry.json) · [AFCD Registry](../assets/data/afcd-toilet-identity-registry.json)

FEHD 初始快照為 2026-10-26、AFCD 為 2026-08-04。序號只在初始建檔及確認新設施時分配，後續依已發布 Registry 保存。它們不隨官方排序、重編、App 顯示 ID 或內容雜湊而變。初始建檔只證明目前核實索引的一對一映射；FEHD 過往重編及 AFCD 未證實的跨期改碼，須有相應官方證據方可確認身份延續。

### 候選快照更新

以現有構建器把新資料輸出到暫存檔，再驗證候選索引。這個檢查器不會改寫正式索引。使用發行中的 Registry 做比較，並在發布新版資料前把成功驗證的索引和 Registry 一起納入同一版本。

```sh
python3 scripts/check-toilet-identities.py fehd
python3 scripts/check-toilet-identities.py afcd
python3 scripts/check-toilet-identities.py fehd --index /path/to/staged-index.json
```

- 驗證候選索引的來源、日期、筆數、內容 SHA-256、ID 唯一性和座標。相同上游 ID 且名稱、官方類型、地區、區域、地址、坐標、服務公告標記相符時保留原 ID。任何身份欄位變動、新記錄、缺項或重複主張都會阻擋更新並列出差異；僅在附近或同名從來不足以確認身份。既存服務安排仍留在官方索引，`serviceNotice` 本身也不代表設施已退役。
- 對確有來源的改號、搬遷、文字修訂、停用、拆分或合併，由維護者核對官方記錄後提供 review manifest。頂層欄位是 `indexSha256`（整個候選檔的 SHA-256）及 `decisions`。每項需有 `action`、`reason` 和 `evidenceUrl`。`continue` 指定舊 `stableFacilityId` 和新 `officialRecordId`；`retire` 保留舊穩定 ID 及證據，解除活躍映射；`add` 為新 `officialRecordId` 分配下一個從未使用的穩定 ID。官方代碼重用時，原設施應用核實的新碼延續，或先退役，再為新設施分配新 ID。工具驗證引用形態、快照雜湊和一對一約束，證據本身的場地對應需要人工核對。
- 加上 `--review /path/to/review.json` 先預檢。通過後由單一維護者以 `--apply` 原子替換指定的 Registry。校驗出錯保留舊檔。舊 ID 和歷次已審核證據仍可追溯。 [檢查及更新腳本](../scripts/check-toilet-identities.py)

## SQLite v8 與 Repository

新表 `facility_favorites` 在既有 exclusive migration transaction 中建立，主鍵為 `(source, stable_facility_id)`。其他欄位為 `name_zh_hk_snapshot`、`name_en_snapshot`、`category_snapshot`、`created_at`、`updated_at`，名稱要求至少一語有值。現有 v0–v7 遷移、巴士收藏與置頂、語言、搜尋歷史和快取全部沿用。沒有依賴設施索引的外鍵或級聯刪除，資料庫也沒有保存用戶位置或設施座標。現有版本檢查會拒絕以 v7 App 開啟 v8 資料庫。發行回滾需選擇支援 v8 的二進位。 [SQLite 遷移](../src/database.ts)

| API | 行為 |
| --- | --- |
| `resolveFacilityIdentity({ source, officialId })` | 從現行顯示位置解出穩定身份及有效設施。索引或 Registry 的重複主張、身份欄位衝突或無效坐標均不給出可導航的設施。 |
| `addFacilityFavorite({ source, officialId })` | 先用索引及 Registry 驗證，僅在 `available` 時寫入。寫入前由 Registry 決定鍵，快照從現行索引取值。衝突時不寫入。 |
| `removeFacilityFavorite({ source, stableFacilityId })` | 精確刪除該收藏；缺項或待複核的收藏也可移除。 |
| `isFacilityFavorite({ source, stableFacilityId })` | 查詢收藏列是否存在，與設施暫時可用性獨立。 |
| `listFacilityFavorites()` | 讀取本機持久資料，按建立時間倒序及身份穩定排序。重複保存保留第一次快照及時間。 |
| `resolveFacilityFavorite(favorite)` | 同時返回原收藏及解析狀態；`available` 附當前官方設施，`unavailable` 表示索引缺項或已退役，`needs_review` 表示映射、類別、名稱、地址或點位有衝突。後兩種只留快照。原身份核實後可再次解析，無需重存。 |

寫入依呼叫次序排隊；查詢等待已排隊的寫入。單筆 SQL 和資料庫唯一鍵共同保證冪等；SQLite 錯誤回傳給呼叫者且後續寫入仍可進行。UI-04D2 可透過獨立 Hook 訂閱保存、刪除及錯誤狀態。地圖預覽與列表展開卡使用顯示身份呼叫新增；「收藏」Tab 使用穩定身份移除。只有解析成功才用已驗證設施的顯示 ID 回附近頁選中。獅子山公園的官方說明與現場確認提示仍由後續 UI 階段處理。 [身份解析](../src/facility-identity.ts) · [收藏 Repository](../src/facility-favorites.ts)

## 驗證

- `npm run typecheck`、Git 空白檢查和 iOS Metro 匯出通過。
- 五份正式索引、五份原構建腳本和三份 LCSD Registry 的檔案 SHA-256 與開工前一致。所有 1,256 筆前向及反向解析成功，沒有重複收藏鍵。
- `node scripts/test-facility-favorites.cjs` 用 Node 的 SQLite 引擎及臨時實體資料庫，執行 App 的實際遷移 SQL 與 Repository。驗證全新資料庫、v7 升級前後舊表及記錄相同、v8 DDL 後故障可回滾、重新開庫後讀取正常、快速存／刪、冪等、來源隔離、語言快照、巴士置頂排序及寫入失敗後恢復。
- 同一測試使用暫存候選索引驗證官方改號、舊碼重用、衝突、座標異常、索引缺項、錯誤快照雜湊及失敗保留 Registry。核實改號後返回新官方顯示 ID 及更新名稱，原收藏鍵和快照保持。Node 介面替代 Expo SQLite 的原生橋接，實際 iOS 裝置的遷移與 UI 互動尚待驗收。 [定向測試腳本](../scripts/test-facility-favorites.cjs)
