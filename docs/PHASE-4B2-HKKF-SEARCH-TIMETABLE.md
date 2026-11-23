# Phase 4B2 · 港九小轮搜索与计划开航时刻表

## 交付与文件

| 功能 | 文件 |
| --- | --- |
| 开发预览入口、目录读取和复用搜索 | `src/hkkf-preview.ts`、`src/hkkf-query-hooks.ts`、`src/hkkf-search.ts`、`src/global-search.ts` |
| 交通及首页全域搜索 | `src/app/bus/nearby.tsx`、`src/app/search.tsx`、`src/components/global-search-result-row.tsx`、`src/components/hkkf-search-notice.tsx` |
| 航线详情、导航、官方码头名称及来源链接 | `src/app/ferry/[id].tsx`、`src/app/_layout.tsx`、`src/global-search-navigation.ts`、`src/hkkf-data.ts` |
| 香港公眾假期及双语文案 | `src/hong-kong-public-holidays.ts`、`src/i18n.ts` |
| 定向与回归测试 | `scripts/test-hkkf-data.cjs`、`scripts/test-global-search-ui.cjs`、`scripts/test-nearby-bus-location.cjs` |

## 搜索和航线详情

- 开发预览复用交通页的「渡輪」分类。空查询展示港九小轮四条航线，输入航线或任一起讫码头的中英文名称即时筛选。「全部」文字搜索和首页「全域搜尋」共用同一来源；首页运输车站分类保留既有搜索。结果显示营办商和完整起讫码头，使用 `ferry_route:hkkf:route:<route_id>` 稳定键。
- 搜索结果进入 `/ferry/[id]`，参数包括 `operatorId=hkkf` 和官方 `route_id`。页面核对预览开关及参数。目录沿用 4B1 客户端的内存缓存、并发合并、总超时和退避。详情按所选航向读取一份时刻表，切换日型在本机筛选。搜索、航向和日型操作都无需查船舶 ETA。
- 航线标题下方显示营办商，方向切换使用 4B0 核实的八组码头映射。出发与目的地单独标注，中環 4 號与中環 6 號西泊位保持独立，坪洲与喜靈洲按各自方向显示。沿用现有卡片、换行选择按钮和字体 Token，并提供营办商时刻表、开放数据及假期来源链接。 [4B0 方向及数据核对](PHASE-4B0-FERRY-DATA-VALIDATION.md)

## 开航时间与服务日

- 「計劃開航時間 / Scheduled departures」统一使用香港时间。支持今日、周一至周六（公众假期除外）、周日及公众假期。固定日型视图保留选开、周六限定、尾班、货运、续程及营办商备注，并标出经核实的服务日翌日尾班。未核实条件保留提示。
- 今日视图用香港自然日判断班次，计入前一服务日跨午夜进入今日的已核实尾班，并单独标记。只从规则明确的班次选出今日下一班。状态区分加载、请求失败及重试、没有适用班次、今日可确认班次已结束、日型无法核实。未知或选开班次可从日型视图查阅。UI 只展示计划开航，船舶实时预计抵达留在 4B1 数据层。 [运输署班次与跨日资料](https://www.td.gov.hk/en/transport_in_hong_kong/public_transport/ferries/service_details/index.html)
- 1823 公开日历保存了 2025–2027 年的 51 个全日事件日期，逐年核对 17 条。源 JSON 的 `Last-Modified` 为 2026-05-18 02:06:33 UTC，SHA-256 为 `8d797fb380825eec3f53fe456cc85ad30e2f91635675081abb671eca3bfd757d`。更新时按 `vcalendar[0].vevent[].dtstart[0]` 提取全日日期，核对公布覆盖年，再更新日期表与覆盖边界。超出覆盖时，星期日仍可按星期日规则判断，其他日期提示无法确认；前一天的日型会影响跨午夜尾班时同样保守处理。 [1823 数据集资源](https://data.gov.hk/en-data/dataset/hk-dpo-statistic-cal/resource/7ce98bb9-6330-414d-83fa-48aa4f253789) · [官方 JSON](https://www.1823.gov.hk/common/ical/en.json)

## 生产开关与授权

- 预览要求 React Native 开发构建且启动 Metro 时设置 `EXPO_PUBLIC_HKKF_PREVIEW=1`。发布构建即使设了该变量也会关闭客户端。渡轮分类继续使用现有未开通提示，全域搜索及详情直达同样受限。开关独立于 App 用户设置。
- DATA.GOV.HK 第 1.2 版条款涵盖商业再利用，同时要求使用者处理适用权利、注明来源并遵守第三方条件。数据目录列出港九小轮为资料版权拥有人，并标注 ETA 每分钟更新。营办商数字服务条款第 13 节对复制、改编、公开展示及分发设有书面许可要求，现有公开资料无法确认该 API 是否有例外。 [DATA.GOV.HK 条款](https://data.gov.hk/en/terms-and-conditions) · [港九小轮数据集](https://data.gov.hk/en-data/dataset/hkkf-hkkfdata-hkkf-eta-data) · [营办商数字服务条款](https://hkkf.com.hk/en/hkkf-digital-services-terms-and-privacy-policy/)
- **授权仍待关闭。** 正式启用前应取得港九小轮确认第三方商业 App 使用范围、署名格式、额外 API 配额及缓存期限、离线打包及分发权。4B1 现有时刻表固定测试样本仅供离线测试。预览读取官方目录和班次并短时缓存于内存。官方假期日期来自独立的政府日历。

## 验证、限制和 Git

- TypeScript 通过，定向自动化 130 项通过，iOS Metro／Hermes 生产静态导出与 `git diff --check` 通过。导出时主动设置预览变量为 1，反汇编确认生产字节码仍将预览开关求值为 false，客户端为 undefined。
- 测试覆盖四航线、八方向、324 条已核对的计划时间、双语名称与码头搜索、全域搜索导航与返回、分区错误及空结果、补假、星期六限定、跨午夜、选开、备注、今日完结、日历超出范围、生产默认关闭及详情直达拦截。既有巴士、港铁、轻铁及专线小巴搜索与相关交通入口纳入回归。
- 官方时刻表可能因天气、停航或特别安排临时调整。今日列表依据当前设备时钟和已公布的日历及规则。未核实的临时运营变更由用户查阅营办商。
- 本机 `develop` 与本机记录的 `origin/develop` 均在 `c388bb5`。开始时已有 8 个 4B0／4B1 未追踪文件，保留全部，其中 `src/hkkf-data.ts` 与 `scripts/test-hkkf-data.cjs` 增补本阶段内容。工作树保留未提交改动，未暂存。

## iPhone 人工验收

1. 以开发 App 连接 `EXPO_PUBLIC_HKKF_PREVIEW=1 npm start` 启动的 Metro。选择「渡輪」，核对空查询有 4 条港九小轮航线。分别查询「中環4號渡輪碼頭」及 `Central Pier 6`。在首页全域搜索查询「坪洲」或 `Peng Chau Pier`，打开结果后返回并核对搜索词和位置。
2. 打开中環↔坪洲，切换双向并核对中環 6 號西泊位。打开坪洲↔喜靈洲核对各方向。翻到资料来源并尝试打开营办商时刻表。
3. 切换今日及两个日型。用中環↔索罟灣检查选开标记，用中環↔榕樹灣检查周六限定，用中環→坪洲检查 00:30 已标为服务日翌日。查看今日是否与当前香港日期一致。
4. 在繁中、英文及大字号核对方向按钮、码头全称及班次备注可完整阅读。断网后打开未缓存的航线，确认错误提示和重试入口；恢复流动网络后重试。以未设预览变量的开发启动方式确认渡轮仍为未开通。

## 4B3 附近码头建议

保留同一预览门控。从 4B1 六个已核实的营办商码头 ID 和参考坐标起步，沿用现有定位及半径筛选。按码头 ID 和泊位身份关联官方出发方向，继续区分中環 4 號与 6 號西泊位。距离标明为到码头参考点的直线距离。按距离排序无需查 ETA，生产开放继续取决于授权。
