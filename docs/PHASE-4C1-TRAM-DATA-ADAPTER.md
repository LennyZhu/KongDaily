# Phase 4C1 · 香港电车静态数据层与离线索引

本轮交付运输署电车离线目录、运营状态覆盖和查询接口。基于 4C0 已核实的 2026-11-18 来源批次，实测 **6 条路线、12 个方向、117 个站点、427 条停靠**，全部保留。工作区开始时已有未追踪的 4C0 报告，已原样保留。 [4C0 审计与来源核对](PHASE-4C0-TRAM-DATA-VALIDATION.md)

## 文件

| 用途 | 文件 |
| --- | --- |
| 应用随包数据 | `assets/data/tram-static.json`、`assets/data/tram-service-status.json` |
| 类型与查询接口 | `src/tram-static.ts` |
| 离线生成与坐标交叉核验 | `scripts/build-tram-static.py`、`scripts/check-tram-grid.cjs` |
| 冻结的官方输入与 SHA-256／时间清单 | `scripts/fixtures/tram/td-tram-2026-11-18.zip`、`scripts/fixtures/tram/td-tram-2026-11-18.json` |
| 定向测试 | `scripts/test-tram-data.cjs`、`scripts/test-tram-static.py` |

## 静态模型与来源

- `TramRoute` 以运输署 `ROUTE_ID` 为键，路线名保留官方繁中及英文。方向使用路线内的 `ROUTE_SEQ` 1／2；每个方向分别存站序，实际首末停靠确定 `routeTermini`。同样的方向数字在不同线路中可指向不同地理方向。
- `TramStop` 以运输署 `STOP_ID` 为站台身份，带双语名称和 WGS84 参考点。`TramVisit` 以路线、方向、`STOP_SEQ` 为键，带 `STOP_ID` 和 `STOP_PICK_DROP`。同名站、反向站台、同一站点的多条路线及未来重复停靠可独立追踪。
- 可查询的应用键带 `td:tram` 命名空间。4002／4003 保留进出跑马地的实际站序。进站末段经 99302／99303／99307 到达 99304，出站经 99308／99305／99309／99306 后分接主线。没有通过倒转数组或连接两段推定同车续乘。站名异常保留在源字段，例如 `99201` 英文拼写及 `99248/99252` 两个同名英文记录。 [官方 XML 字典](https://static.data.gov.hk/td/routes-fares-xml/dataspec/ptroutefare_xml_dataspec.pdf)
- `tramSource` 暴露 `sourceVersion=td-tram-2026-11-18-57e3ae98e234`、`sourceUpdatedAt=2026-11-18T19:03:25+08:00`、来源链接和双语署名。逐文件记录 2026-11-23 HKT 采集时间、HTTP 修改时间、XML 原始生成时间和 SHA-256。当前约 30 KB 的应用快照随包读取，原始四文件压缩样本仅用于构建及测试。 [运输署 XML 数据](https://data.gov.hk/en-data/dataset/hk-td-tis_14-routes-fares-xml) · [运输署 GeoJSON 数据](https://data.gov.hk/en-data/dataset/hk-td-tis_23-routes-fares-geojson/resource/946ffaea-e294-49b9-9ca9-60422747923b)

## 离线重建

在项目根目录执行以下命令。去掉 `--check` 可用同一份冻结输入重建文件。脚本也接收包含同名源文件的目录。更新批次时同步更新每个文件的摘要、采集时间和 HTTP `Last-Modified`。生成端验证摘要、数据类型、三语名称、路线及站点引用、站序连续性、上下车字段和 GeoJSON 逐条匹配。坐标使用官方 GeoJSON，并调用现有 HK1980 Grid 转换核验全部点位在 2 米容差内。覆盖量变化会报告基线与实际数量，可用独立 `--output` 生成完整候选供审核。资料异常时现有快照保持可用。

```sh
python3 scripts/build-tram-static.py \
  scripts/fixtures/tram/td-tram-2026-11-18.zip \
  scripts/fixtures/tram/td-tram-2026-11-18.json --check
```

## 运营状态与查询

- `getTramStopServiceStatus(99313)` 返回 `temporarily_closed`。覆盖文件按官方 ID 精确关联，保留 2026-09-09 公告、2026-11-23 核实日期和双语说明，包括东行替代上车点 07E 山道和西行调整终点 94W 屈地街电车厂。公告不改变 4004／4005 的原始运输署站序。静态搜索和详情仍能找到石塘咀总站，附近查询默认排除它。此状态没有自动到期或恢复。 [香港电车公司公告](https://www.hktramways.com/en/service-updates-detail/141/en/press-releases)
- 无审查记录的已知站点为 `unknown`。未来可凭官方证据更新覆盖为 `active`，或使用 `createTramServiceIndex` 构建一份独立、不可变的查找视图。缺少站点身份、重复覆盖、无效公告日期、来源网址或双语说明会拒绝载入该覆盖集。移除覆盖也只会回到未知状态。
- `listTramRoutes`、`getTramRoute`、`getTramDirections`、`getTramStopsForDirection`、`getTramStop`、`getTramVisitsForStop` 与 `searchTramStops` 可直接使用。名称查询走双语索引并按匹配程度与官方 ID 稳定排序。未知 ID 或无匹配返回 `undefined` 或空数组。公开对象和数组均冻结。
- `findNearbyTramStops` 支持 500／1000／2000 米，沿用现有 Haversine，按未取整的直线距离及站点 ID 排序。结果带状态、静态站序允许上车的 `scheduledBoardingVisits`，以及仅在站点状态明确为 `active` 时才有内容的 `verifiedBoardingVisits`。后者表示站点经审查且停靠允许上车，仍应按营办商公告核查路线级临时改道。当前没有新增任何站点为已验证运营。查询只读本地资料，`tramCapabilities.realtimeEta=false`。

## 验证与发布边界

TypeScript、153 项 Node 定向与现有交通回归、7 项 Python 电车生成测试、8 项 Python 铁路地理测试、原始冻结输入重建对比及 `git diff --check` 均通过。覆盖全量站点和方向、跑马地路径、同名站、绕过只下车停靠、半径边界、关站与模拟恢复、重复生成、有效新增停靠、异常输入安全失败。未启动模拟器或构建。

DATA.GOV.HK 对运输署静态数据的复制与分发提供附条件依据。应用索引已保留政府、运输署及 DATA.GOV.HK 署名和来源，正式发布前仍须复核附加条件及第三方权利。运营覆盖单独标注香港电车公司公告，带来源归属；公告改道仍须核实到实际站台与路线。第三方实时 ETA 正式 API、商用权限与配额仍未确认。 [DATA.GOV.HK 条款](https://data.gov.hk/en/terms-and-conditions) · [营办商实时资料说明](https://www.hktramways.com/en/disclaimer)

4C2 可复用现有统一搜索注册表，以路线和方向键导航。方向标签从实际目的地站取值，停靠列表按 `stopSequence` 并保留同名不同 ID。石塘咀详情显示状态和官方公告，太安街英文异常及营办商站牌号继续按 4C0 核实规则处理。4C3 在设计上车推荐时应区分静态路线与已核实运营的站点，并核实 4004／4005 的临时改道。

本机 `develop` 与本机 `origin/develop` 均为 `a085542`。新增数据层、测试和报告留在工作区，未暂存或提交。
