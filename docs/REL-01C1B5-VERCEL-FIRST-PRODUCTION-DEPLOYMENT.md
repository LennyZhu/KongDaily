# REL-01C1B5 · Vercel 首次 Production 部署

**已公開，Gate A PASS，Gate B PASS。** KongDaily 的 Production 網站已在 [kongdaily-site.vercel.app](https://kongdaily-site.vercel.app/) 通過無登入 HTTPS 驗收。Gate C 待正式 iOS Archive 與 App Store 核對。

## Git 與發布批准

開工時 `develop` 工作區乾淨。本機 HEAD、本機 `origin/develop` 與 GitHub 唯讀分支查詢均為 `efe1dc844fb5ad2a3e7e5cd4ffc8dca340ea4cc6`，分歧 0／0。提交包含 B3 與 B4。開發者在 B5 批准雙語私隱政策 v1.0、保留規則、LandsD 披露、七張 JPEG 及西九純來源方案，並批准用首次公開的實際香港日期。批准依據記入 `website/release.json`。 [B3 政策及素材基線](REL-01C1B3-FINAL-POLICY-AND-PHOTO-COMPLIANCE.md) · [B4 權利矩陣](REL-01C1B4-PRODUCTION-WEBSITE-GATE-A.md)

## 首次公開日期

| 事件 | 香港時間 |
| --- | --- |
| 初次讀取並填入候選日 | 2026-11-20 19:46:54 HKT（UTC+08:00） |
| 重讀日期與真實 Gate A 通過後送出 Production 部署 | 2026-11-20 19:49:49 HKT |
| Vercel Deployment READY | 2026-11-20 19:49:55.890 HKT |
| 正式域名首次指派至該 READY Deployment | **2026-11-20 19:49:55.999 HKT（UTC+08:00）** |
| 首次獨立無登入 HTTPS 探測 | 2026-11-20 19:50:37 HKT，`/privacy/` HTTP 200，TLS 憑證驗證結果 0 |

首次公開時間以 Vercel 該部署正式 alias 的建立事件 `2026-11-20T11:49:55.999Z` 記錄，並由無登入 HTTPS 確認公開可讀。部署指令於 19:49:56 HKT 回報 READY 及已指派正式域名。App 離線私隱與網站共用 `content/compliance.json` 的 v1.0，`effectiveOn` 與首次 `updatedOn` 均為 **2026-11-20**。`website/release.json` 保存實際 origin 與 `firstPublicDeploymentAt`，兩者不影響 App 日期來源。 [共用政策](../content/compliance.json) · [公開紀錄](../website/release.json)

## Vercel 帳戶、範圍及輸出

| 項目 | 實際結果 |
| --- | --- |
| CLI 與登入 | 本機快取 Vercel CLI `65.14.0`，`vercel whoami` 為 `lennyzhu`。 |
| 範圍與方案 | `homeypaw`，`team_9K1ZOehVf8MJNL1jYmhjcHAd`，CLI 顯示 Hobby。開發者確認 KongDaily 為個人非商業項目並批准此範圍。依確認的用途，Hobby 適用。 [Vercel Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines#commercial-usage) |
| 獨立專案 | 新建 `kongdaily-site`，`prj_yDBRUuUSfMvkDr6qwLGt55lU352D`。開工時範圍內已存在的其他 App 專案未被用作目標。CLI 本機連結的兩個 ID 和遠端專案資料相符。 |
| Root Directory 與框架 | 儲存庫根目錄 `.`，Other preset。Git Integration 未連接，`git.deploymentEnabled` 為 `false`。 |
| 建置 | 安裝命令 `true`，建置命令 `node website/build.cjs --release`，網站輸出 `website/dist/release`。Vercel prebuilt 靜態輸出在 `.vercel/output/static`，讀取根目錄共用政策、正式地點及照片資料。 |
| Node | 專案設定 `22.x`。執行本機檢查使用 22.13.0。Vercel CLI 偵測根 `package.json` 的 Node engine 範圍可用 26.x 並提示其優先於專案設定。已上傳的部署只有靜態內容及路由設定，程式無伺服端 Node 執行依賴。 |
| 保護 | 專案保留 Vercel Authentication 的 Standard 類型設定。正式 alias 無登入 HTTP 200，生成的 Deployment hostname 無登入回應 302。 |
| Production | [正式 HTTPS 網域](https://kongdaily-site.vercel.app/) · [Vercel Deployment Inspector](https://vercel.com/homeypaw/kongdaily-site/5m5UbLNNMW1ocXhq2pRkiAjEbUH9)。部署 ID `dpl_5m5UbLNNMW1ocXhq2pRkiAjEbUH9`，`target=production`、`readyState=READY`。Vercel alias 清單確認正式網域指向此部署，無 alias 轉址。 |

實際執行的主要命令如下，`vercel` 使用上述本機快取版本。

```sh
node website/build.cjs --check-release
node website/build.cjs --release
node website/build.cjs --check-output website/dist/release
vercel project create kongdaily-site --scope homeypaw
vercel link --project kongdaily-site --scope homeypaw --yes
vercel project inspect kongdaily-site --scope homeypaw
vercel pull --environment=production --scope homeypaw --yes
vercel build --prod --scope homeypaw
node website/build.cjs --check-output .vercel/output/static
vercel deploy --prebuilt --prod --project prj_yDBRUuUSfMvkDr6qwLGt55lU352D --scope homeypaw
node website/build.cjs --check-live
```

上傳前已把 CLI 生成的本機診斷與建置紀錄移出上傳目錄，保留 16 個靜態檔案及 1 個 Vercel Build Output v3 路由配置。遠端部署清單共 17 項，逐檔路徑及 SHA-1 與本機待部署檔案相符。公開照片另驗 SHA-256。網站首版在尚無正式 origin 時構建，因此使用相對連結並省略 canonical。取得正式 origin 後已填入紀錄，線上 HTML 依原首版快照逐檔比對。

## Gate A 驗收

真實發布配置的 `--check-release`、`--release`、`--check-output website/dist/release`、`--check-output .vercel/output/static` 全部通過。核對營運者、品牌、郵箱、兩語共用政策、結案後最長 12 個月、法律例外、LandsD 披露、同一香港日期及逐圖發布模式。未出現開發佔位，首發前正式網址及實際公開時間留空。TypeScript、`node scripts/test-compliance.cjs` 及 `git diff --check` 通過。

## Gate B 線上驗收

| 正式路由 | 無登入 HTTPS 結果 |
| --- | --- |
| [繁中私隱政策](https://kongdaily-site.vercel.app/privacy/) | 200。KongDaily 品牌、Lenny、郵箱及兩個 2026-11-20 日期正確。 |
| [English Privacy Policy](https://kongdaily-site.vercel.app/en/privacy/) | 200。與共用英文 v1.0 一致，兩個日期及繁中切換正確。 |
| [繁中支援](https://kongdaily-site.vercel.app/support/) | 200。核准 FAQ、語系切換及 `mailto:lenny996@163.com` 正確。 |
| [English Support](https://kongdaily-site.vercel.app/en/support/) | 200。核准 FAQ、語系切換及 `mailto:lenny996@163.com` 正確。 |
| [探索照片署名](https://kongdaily-site.vercel.app/credits/explore/) · [Explore Photo Credits](https://kongdaily-site.vercel.app/en/credits/explore/) | 兩頁 200。八筆作者署名與原作資料、七個本機同款預覽及下載。西九顯示 Raymond Yeung 及 Unsplash 原作連結。 |

八頁核准 HTML、CSS 及語言切換連結通過 `--check-live`；無尾斜線路由同站 308。另一組無登入探測驗證核准頁面沒有追蹤腳本、iframe、送出表單或開發佔位。環境檔、連結資料、內部報告、測試、共用政策來源 JSON 及西九 App 資產路徑回 404。`/.git/config` 的同站 308 轉至 `/.git/config/` 後回 404。未發現未批准資源。

| HTTPS 下載檔（位於 `/credits/explore/photos/`） | 線上結果 | 線上 SHA-256 |
| --- | --- | --- |
| `dragons-back.jpg` | 200 · JPEG | `5822dbb21799c40d8e0303ace426764823eb35f75e7c4aedf8fb2be254b09f90` |
| `peak-circle-walk.jpg` | 200 · JPEG | `507f5f412bcdb32ec2813dded3976481f79809225924b84b418921607ab19b4d` |
| `avenue-of-stars.jpg` | 200 · JPEG | `0ed86502fca360f467d8d42ad9e0b75f19e1607ff687a9b8b9706889b0f3fa9c` |
| `hong-kong-park.jpg` | 200 · JPEG | `eb62e56c6c204a4de0f3eed1b26d6bb94e2fa75038f28ba61a560faf57c74add` |
| `kowloon-walled-city-park.jpg` | 200 · JPEG | `a28f9ec8fda2db702b4eaefb7f7c692eae1e3d8d23883dab0c158a8e97f2a5d8` |
| `tai-po-waterfront-park.jpg` | 200 · JPEG | `f249c8e015e62ef511580c1d2d59b956f5bc3975c76cfc6f8263eaea9967081f` |
| `victoria-peak-garden.jpg` | 200 · JPEG | `59f27e7e1e3d876e1a9c6876b1d0450c5bc1c9c32c74c435b341dbebf783f4cb` |
| `west-kowloon-art-park.jpg` | **直接 404** · 遠端部署清單零筆 | — |

七個 SHA-256 均與 App 優化原檔一致。西九另以 App 資產路徑實測 404，部署清單逐檔核對亦無第二公開副本。四個政策、支援連結的 `mailto:` 正確。**實際外部寄送及收件待開發者人工確認。**

## Gate C 與工作區

Gate C 待正式 iOS Archive 再核對 Privacy Report、SDK 精確位置及接收者安排、App Privacy 最終申報、成品照片的授權與技術措施，以及商店使用與本網站一致的政策版本和 HTTPS 連結。此次未操作 App Store Connect、EAS Build、模擬器或真機。

待提交的本機檔案只有 `.gitignore`（忽略 Vercel 連結及本機環境檔）、`content/compliance.json`（兩個共用日期）、`website/release.json`（批准、正式 origin 及實際公開時間）和本報告。核心業務與八張 App 照片維持原樣。`develop` HEAD 仍為 `efe1dc844fb5ad2a3e7e5cd4ffc8dca340ea4cc6`，沒有自行提交、推送或合併。
