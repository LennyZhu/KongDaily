# Phase 4B3 · 港九小轮附近码头与航线

## 修改文件

| 范围 | 文件 |
| --- | --- |
| 预览专用索引、计算及双语文案 | `src/nearby-hkkf.ts`、`src/hkkf-nearby-preview.ts`、`src/hkkf-nearby-copy.ts` |
| 查找和显示 | `src/app/bus/nearby.tsx`、`src/components/hkkf-nearby-rows.tsx`、`src/hkkf-search.ts` |
| 航向导航 | `src/global-search-navigation.ts`、`src/app/ferry/[id].tsx` |
| 定向回归 | `scripts/test-nearby-bus-location.cjs` |

开工时 `develop` 与本地 `origin/develop` 均在 `c388bb5`。保留工作区内 4B0 至 4B2-FIX1 的未提交内容。本轮改动留在工作区。

## 坐标来源与核实

首批覆盖港九小轮 **4 条航线、6 个码头、8 个出发方向**。索引固定使用 2026-11-22 香港时间的 4B0 官方 `/opendata/pier/{pier_id}` 样本 `lat`、`long`。六点与运输署 WGS84 GeoJSON 的对应码头交叉核对，点位差约 6–54 米，属两个来源分别提供的参考点。营办商数据字典给出经纬度字段，未另列基准。应用采用营办商坐标和已核实的码头关联；差异值仅作地理复核。中环 6 号东西泊位在运输署文件共用位置，西泊位身份取自对应航线的官方登船资料。 [4B0 实测与方向证据](PHASE-4B0-FERRY-DATA-VALIDATION.md) · [营办商数据字典](https://www.hkkfeta.com/datagovhk/HKKF_ETA_Data_Dictionary.pdf) · [运输署 GeoJSON](https://static.data.gov.hk/td/routes-fares-geojson/JSON_FERRY.json) · [运输署登船资料](https://www.td.gov.hk/en/transport_in_hong_kong/public_transport/ferries/service_details/index.html)

| HKKF ID | 码头 | 纬度，经度 | 运输署 stopId | 出发路线与方向 |
| --- | --- | --- | --- | --- |
| 1 | 中环 4 号 | 22.288007, 114.158389 | 101126 | 1 outbound、2 outbound |
| 2 | 中环 6 号西泊位 | 22.287462, 114.160330 | 101108 西泊位 | 3 outbound |
| 3 | 榕树湾 | 22.226520, 114.109105 | 101123 | 2 inbound |
| 4 | 坪洲 | 22.284587, 114.037164 | 101109 | 3 inbound、4 outbound |
| 5 | 索罟湾 2 号 | 22.206086, 114.131543 | 101348 | 1 inbound |
| 6 | 喜灵洲 | 22.2579923, 114.0277868 | 101324 | 4 inbound |

## 查询与交互

- **按航线**逐个匹配 4B0 的 `originPierId`。结果显示营办商、航线、出发与目的码头以及到出发码头的距离。只有出发码头落在范围内的方向才入列。`hkkf:route:<route_id>:<direction>` 区分同一航线的两个方向并去重。
- **按码头**按 `hkkf:pier:<pier_id>` 去重，位置接近或相同的不同 ID 保持独立。卡片展示双语名称、目的地及距离，展开后显示从该码头出发的航向。两种模式都按距离排序，同距按码头 ID 及固定航线次序排列。
- 复用现有 Haversine 计算及 500 米、1 公里、2 公里预设，按未取整的距离判断边界。显示值沿用现有取整规则，距离明确标为到码头参考点的直线距离。卡片展示目录中的可乘方向，是否开航仍以营办商为准。
- 专用渡轮分类沿用首次位置检查、定位中、权限拒绝、定位失败、手动地标、无结果及扩大范围。切换按航线／码头，或从详情返回，保留查询模式和范围。更换手动参考点沿用 500 米默认范围。
- 输入中英文关键词时切到带明确标题的「全港搜尋」，按当前航线或码头模式查离线目录。搜索结果不带附近距离。清空关键词回到同一位置和半径，详情返回复用列表恢复机制。交通「全部」文字搜索和首页全域搜索继续使用 4B2 的目录接入。
- 详情接收并验证官方方向参数，继续按选定航向读取 4B2 计划开航表及日型。附近和专用分类搜索无需码头 API、ETA 或票价请求。

## 预览门禁与授权

附近模块及坐标快照只从 `__DEV__` 和既有 HKKF 开发预览门禁同时满足的分支加载。预览关闭时，渡轮分类使用现有未开放提示。导航及详情仍受原有 Provider 门禁校验。

港九小轮商业 App 再利用、API 缓存和离线分发条件仍待营办商确认。发布前应取得可查证的书面许可及署名、缓存和配额条件。当前只供授权开发预览。 [开放资料目录](https://data.gov.hk/en-data/dataset/hkkf-hkkfdata-hkkf-eta-data) · [港九小轮条款](https://hkkf.com.hk/en/hkkf-digital-services-terms-and-privacy-policy/) · [DATA.GOV.HK 条款](https://data.gov.hk/en/terms-and-conditions)

## 自动验证

- TypeScript、135 项自动化测试、`git diff --check` 与新增文件的空白检查通过。
- iOS Metro 开发导出与 iOS Metro／Hermes 生产静态导出通过，两次都主动设置 `EXPO_PUBLIC_HKKF_PREVIEW=1`。比较开发产物和生产 Hermes 反汇编，确认 4B3 卡片模块、附近查询函数、坐标样本和全港搜索文案只出现在开发产物。生产 Provider 开关仍为 false，客户端为 undefined。

测试采用固定资料，覆盖六码头、八方向、500／1000／2000 米边界、同坐标不同 ID、重复方向、按航线及码头模式、中英文全港搜索、定位拒绝与失败、手动地标、附近无结果和扩大范围、详情方向及返回状态、生产停用、既有交通及 4B2 回归。真机字体与 VoiceOver 待人工验收。

## iPhone 人工验收

1. 以 `EXPO_PUBLIC_HKKF_PREVIEW=1 npm start` 连接开发 App。进入「附近交通 → 渡輪」，用当前位置或手动地标「中環」核对按航线及按码头结果。检查中环 4 号与 6 号西泊位分开，后者的该方向往坪洲。
2. 切换 500 米、1 公里、2 公里，核对距离排序、无结果及扩大范围。拒绝定位后确认权限提示可见，选手动地标后可以正常查询。
3. 输入 `Central Pier 6` 或「中環６號碼頭」，核对全港结果标题及无距离显示。切换按码头并展开，再进入航线。返回核对筛选、关键词和展开状态，清空后核对原附近范围。
4. 在按航线模式从坪洲出发往中环时打开详情，确认自动选中对应航向并显示计划开航。用英文和大字号检查卡片换行、触控区与 4B2-FIX1 的短方向按钮。关闭预览变量再启动时确认渡轮显示未开放。

## 下一阶段建议

授权确认后先重新校验六个码头及八个方向，建立快照更新与异常审核流程。未来收藏可用营办商、官方航线、方向和出发码头 ID。实时预计抵达继续独立于计划开航，分开审查授权与可用性。
