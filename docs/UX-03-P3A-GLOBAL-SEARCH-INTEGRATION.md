# UX-03-P3A · 首页全局搜索统一

已完成实现和自动化验证，等待开发者 iPhone 验收。本轮只处理搜索；没有实施 Phase 3B 收藏或 Phase 3C 首页实时预报。

## 修改文件

| 文件 | 改动 |
| --- | --- |
| `src/global-search.ts` | 在原模块内增加轻量 typed transport registry、统一查询和结果类型；组合巴士、港铁、轻铁，保留设施与精选地点来源。 |
| `src/app/search.tsx` | 四入口改用交通路线／交通车站分类，并可点击选择范围；保留布局、180 ms debounce、清空、防重复打开及返回滚动逻辑。来源提示分别读取巴士状态，不因巴士失败丢弃铁路结果。 |
| `src/components/global-search-result-row.tsx` | 复用现有卡片，增加铁路类型、名称／代码、所属线路／经过路线；巴士结果明确标记交通类型。样式未改。 |
| `src/global-search-navigation.ts` | 校验两铁条目类型及既有官方 ID，进入原线路／车站详情；原巴士、设施和地点导航保留。 |
| `src/app/bus/nearby.tsx` | `/transport` 文字搜索调用共享查询，并使用相同搜索 key；展示仍沿用原条目组件。没有修改附近计算、GPS 或距离范围。 |
| `src/i18n.ts` | zh-HK／English 四入口标题、交通示例及首页搜索提示。 |
| `scripts/test-global-search.cjs` | 共享来源、全部 187 个铁路条目 ID、双语／代码、同名身份、失败隔离与匹配规则验证。 |
| `scripts/test-global-search-ui.cjs` | 四入口点击、分类范围、双语铁路卡片、详情、快速输入／清空／返回及离线回归。 |
| `scripts/test-global-search-navigation.cjs` | 两铁根 Stack 详情路由、返回原搜索实例、未知 ID 和错误交通类型拒绝。 |
| `scripts/test-nearby-bus-location.cjs` | 两条铁路搜索 key 断言同步统一格式；原附近与定位测试保留。 |
| `docs/KONGDAILY_1_2_0_PRD.md` | 按开发者本次指令同步已完成的 2A／2B 及 3A／3B／3C 分期，四项冻结需求不变。 |
| 本报告（新增） | 接入、验证与后续边界交接。 |

## 适配层与稳定身份

`searchGlobal` 与 `/transport` 均调用 `searchTransport`。registry 只注册 `bus`、`mtr`、`lightRail`，返回有类型的路线／车站结果；铁路直接调用原 `searchMtr`、`searchLightRail`，巴士站复用原本机索引与 `searchBusStops`，没有新写铁路字符串匹配或重建 Repository。

巴士原有两种匹配规则明确保留：全局搜索继续使用原路线排名／边界规则，`surface: 'transport'` 委托已有 `matchBusRoutes` 保留子串匹配。例如 `68x` 在专用交通查询可匹配 `268X`，全局搜索仍不把它当作路线编号前缀。这是既有规则兼容，不是额外维护一套新算法。

全局展示分组为 `transport_route`、`transport_stop`、`facility`、`explore_place`；结果业务身份独立：

| 结果类型 | 稳定 key | 原详情入口 |
| --- | --- | --- |
| 巴士路线 | `bus_route:${BusRoute.id}`，沿用原值 | `/bus/route`，原 route ID。 |
| 巴士站 | `bus_stop:${JSON.stringify([source, stopId])}`，沿用原值 | `/bus/nearby/stop`，原 source／stopId。 |
| 港铁线路 | `mtr_line:ISL` 等官方线路代码 | `/mtr/[kind]`，`kind=line`、`code`。 |
| 港铁站 | `mtr_station:ADM` 等官方站点代码 | 同上，`kind=station`。 |
| 轻铁路线 | `light_rail_route:610` 等官方编号 | `/light-rail/[kind]`，`kind=route`、`id`。 |
| 轻铁站 | `light_rail_stop:250` 等官方字符串 ID | 同上，`kind=stop`。 |

`railwaySearchResult` 统一生成铁路 key，交通页列表同步使用。金钟只保留一个物理站结果并显示原四条线路；港铁元朗和轻铁元朗、不同营办商同名巴士站均保留不同 key，不按名称合并。铁路目录及 AEL／TCL 共站的线路业务身份没有改动。

混合预览在各来源原排序之间稳定轮流取结果，避免大量巴士匹配把铁路全部挤出首屏；保留原五条 UI 预览及分类三十条上限／缩窄搜索提示。设施与精选地点继续使用原索引、数量限制、稳定 ID 和导航。

未来 Phase 4 只需扩展已核实来源适配器、结果类型及其展示／导航分支，不需再写首页交通匹配算法。本轮未注册专线小巴、渡轮或电车，也没有新框架、全局状态库、数据库或网络服务。

## 覆盖、性能与保护

- 巴士路线编号、站点中英文名称；港铁 10 条线路／98 站的中英文及官方代码；轻铁 11 条路线／68 站的编号、中英文及官方站点 ID，均通过现有来源查询。
- `B2`、`港島綫`／`Island Line`／`ISL`、`Admiralty`／`金鐘`／`ADM`、`610`、`海皇路`／`Hoi Wong Road`／`250`、`洪水橋` 均有实际结果断言。`香港公園` 的设施和精选地点继续可查询并打开。
- 搜索不接收附近半径或用户位置，不新增 GPS。铁路查询全部离线，不请求 ETA；进入既有详情后才由原预报 hook 按需请求。巴士仍由原目录 hook 读取缓存、按需刷新及重试，不逐按键重拉目录。
- 180 ms debounce、请求序号、当前关键词派生结果、失效 cleanup 和打开锁均保留；已验证旧计时器不发布旧铁路关键词、连续点击只开一页、详情返回保留词及滚动位置。巴士目录／站点读取失败时仍能查询铁路。
- 本轮 Node 检查的 200 次预热混合查询中位数 **0.77 ms**、p95 **1.08 ms**；这是本机脚本参考，不代表 iPhone 原生帧率。
- Phase 2B 附近查询、500／1000／2000 米、定位服务、铁路静态／地理数据及实时解析、巴士 ETA／车费／地图／收藏、设施地图、精选地点、首页常用交通、版本号均未改。

## 自动化验证

| 检查 | 结果 |
| --- | --- |
| `npm run typecheck` | PASS。 |
| 三份既有全局搜索／UI／导航脚本 | PASS。覆盖全部 **187 个铁路条目**、双语和代码、三交通身份、四入口范围、根 Stack 导航、快速输入／清空／返回、巴士失败时的铁路离线结果，以及设施／地点回归。 |
| 附近交通、铁路实时及地理三份 `node --test` 脚本 | **81／81 PASS**（47＋22＋12）。 |
| `node scripts/test-bus-route-map.cjs` | PASS：巴士 ETA、方向／变体、限定服务、票价卡片、地图与导航。 |
| `python3 scripts/test-nearby-bus-fares.py` | **2／2 PASS**。 |
| `node scripts/test-facility-favorites.cjs` | PASS：旧收藏、置顶、SQLite、设施分类、地图／列表及手动位置。 |
| 离线 iOS Metro／Hermes 导出 | PASS，1321 modules、5.8 MB `.hbc`；临时目录 `/private/tmp/kongdaily-p3a-ios.uxOzsg`。 |
| `git diff --check`／新增文本空白检查 | PASS。 |

## iPhone 人工验收

1. 两种语言打开首页全域搜索，核对四入口布局与图标保持原样、标题正确；点击交通路线后依次搜索 `B2`、`港島綫`、`ISL`、`610`，应只出现路线类结果。
2. 点击交通车站，测试 `Admiralty`、`ADM`、`250`、`洪水橋`、`元朗`；核对交通标签、所属线路、同名两铁站和营办商身份未合并。
3. 分别打开港铁线路／车站、轻铁路线／车站和巴士详情，核对原预报、一次返回、查询词及滚动恢复；快速连点不重复开页。
4. 快速输入 `ADM` 后改 `250`、清空、切分类及返回混合结果，确认没有旧结果闪回。两语及大字核对较长线路／站名换行与触控。
5. 搜索 `香港公園`，分别打开设施地图和精选地点，再返回；飞航模式测试两铁名称／代码查询，巴士来源不可用时仍有铁路结果，搜索本身不触发定位或铁路 ETA。
6. 回到 `/transport` 核对原三交通搜索、附近范围、手动地标和详情返回；再检查原巴士车费／ETA／收藏与设施页面。

没有操作模拟器或真机；原生视觉、键盘及实际滚动体验待上述验收。

## Phase 3B 直接接入边界与 Git

下一阶段可复用 `TransportSearchResult`、`railwaySearchResult` 的稳定 key，以及 `entry.id`、港铁 `memberships`、轻铁 `routes` 等既有身份。搜索 key 用于识别条目，**不能单独代替「线路＋车站＋必要可核实方向」的收藏身份**；多线路车站及方向仍须在获批的收藏流程选择。巴士旧收藏 ID、持久化及置顶规则保持原状。本轮没有收藏操作、数据库 Migration、收藏页改动或首页 ETA。

开工工作区干净；Phase 2B 已提交。`develop` HEAD 与本机 `origin/develop` 均保持 **`5a94f630a4cf77658623268c97560f311ba0ec92`**；`main`、`v1.1.0` 解引用保持 **`796a719b93e08bf4fb540d9ef9a07b6510efbf25`**。本轮 **11 个已跟踪文件修改、1 个报告新增**，未提交／推送／合并，也没有 EAS Build、网站部署或 App Store Connect 操作。

**完成后停止，等待开发者人工验收。**
