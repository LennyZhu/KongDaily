# UX-03-P3B · 铁路收藏及统一收藏页

Phase 3B 已完成实现及自动化验证，等待开发者 iPhone 验收。Phase 3C 首页铁路预报未实施。

## 修改文件

| 文件 | 改动 |
| --- | --- |
| `src/database.ts` | 同一 `kongdaily.db` 增量升级 v8→v9，只新增 `railway_favorites`。 |
| `src/railway-favorites.ts`（新增） | 官方线路／站点组合校验、稳定 ID、持久化读写、快照及安全详情导航。 |
| `src/railway-favorite-hooks.ts`（新增） | 沿用既有收藏的 external-store／加载／写入队列模式，提供列表及单项收藏 hook。 |
| `src/components/railway-favorite-action.tsx`（新增）、`src/components/saved-bus-ui.tsx` | 复用原收藏按钮；共享按钮仅增加可选的无障碍名称及选中状态，巴士调用与行为保留。 |
| `src/components/mtr-next-trains.tsx` | 收藏跟随当前预报所选线路；无上下文的换乘站须先选线，拒绝不属于本站的初始线路。 |
| `src/app/light-rail/[kind].tsx`、`src/components/light-rail-ui.tsx` | 站点详情增加官方路线选择；从路线站序进入站点时携带路线上下文。 |
| `src/components/light-rail-next-trains.tsx` | 保留全站月台分组，用文字及主色标记所选常规路线；查询、解析、刷新依赖不变。 |
| `src/app/(tabs)/saved.tsx`、`src/i18n.ts` | 原收藏 Tab 加入两铁卡片及「全部／巴士／港铁／轻铁／地点」筛选，zh-HK／English 同步。 |
| `scripts/test-facility-favorites.cjs` | 复用真实临时 SQLite 与既有 UI loader，补迁移、身份、写入失败、重启、快照副本及双语收藏测试。 |
| `scripts/test-global-search-navigation.cjs`、`scripts/test-mtr-next-train.cjs`、`scripts/test-nearby-bus-location.cjs`、`scripts/test-global-search.cjs` | 补收藏详情 push/pop、路线标记及上下文断言；同步 schema 版本和原详情测试 mock。 |
| `docs/KONGDAILY_1_2_0_PRD.md` | 同步 3A 人工通过、当前 3B 及 3C 边界；冻结需求不变。 |
| 本报告（新增） | 交付、验证及人工验收说明。 |

## 模型与兼容

- 主键为 `(mode, line_id, station_id)`，`mode=mtr / light_rail`；TypeScript 使用 `lineId` 同时承载港铁官方线路代码或轻铁官方路线编号，`stationId` 保持官方字符串 ID。例：`mtr / ISL / ADM` 与 `mtr / EAL / ADM`、`light_rail / 610 / 380` 与 `light_rail / 614 / 380` 独立。
- 可复用 ID 为 `railway_favorite:${JSON.stringify([mode, lineId, stationId])}`。搜索的物理站点 ID 继续保留；收藏额外加入线路身份，不以站名、数组序号、临时终点或月台作主键。705／706 不合并，海皇路保持 ID `250`。
- 保存双语线路／站名显示快照及 `createdAt / updatedAt`。重复插入不新增记录、不改变原时间；铁路列表按收藏时间倒序，同时间按 mode／lineId／stationId 稳定排序。
- **本轮不保存方向。** 收藏代表整条线路／路线在该站的服务，详情继续显示原有方向或全部月台。Phase 3C 可凭这些 ID 调用原站点预报，再按轻铁路线识别结果，无需从临时目的地推断方向。
- 迁移沿用原数据库的独占事务及失败回滚，仅增加新表，不修改、清空或重建巴士／设施表。原巴士 ID、时间、去重、三项首页置顶及排序完整保留。旧 v7、v8 数据升级和 v8→v9 失败重试均有断言。
- 当前没有 App 内用户备份／恢复功能。本轮验证的是关闭数据库后复制 SQLite 文件、重新打开副本及旧版数据升级；未宣称验证 iCloud 或整机备份恢复。

## 入口、列表与导航

- 港铁车站详情直接复用现有线路选择；金钟可分别收藏港岛线、东铁线等。从全局搜索进入换乘站时，先明确选线，再显示该组合的收藏按钮。切线即显示对应收藏状态。
- 轻铁站点详情仅列本站官方常规路线。可分别保存同站 610／614、705／706；特别班次不会生成新的常规收藏。选择路线只改变收藏上下文及标记，不改变实时请求的站点 ID、月台分组或刷新节奏。
- 按钮写入时立即进入忙碌状态，完成后同步所有订阅者；快速连点不重复。写入失败会读取实际记录；若无法读回，重试先确认状态，避免把不确定的成功写入再次反向切换。
- 原收藏 Tab 的「全部」仍显示巴士及设施，并加入铁路分区；巴士置顶管理和设施地图导航保留。现有精选地点没有独立收藏存储，本轮未虚构新的地点收藏功能。
- 铁路卡片显示类型、线路／路线、站名、取消及详情操作。失效组合使用名称快照和不可用提示，保留取消按钮，不生成可点击的错误详情入口。列表不启动铁路 ETA。
- 港铁收藏进入 `/mtr/[kind]?kind=station&code=ADM&line=ISL` 等原详情。轻铁进入 `/light-rail/[kind]?kind=stop&id=430&route=705` 等原详情，显示所选路线，并保留其他月台；同编号的特别服务不会标记成所选常规服务。
- 导航沿用根 Stack push，分类放在原 Tab 的参数内；自动化已确认返回保留同一 Tab route/state。实际原生滚动位置和返回手势仍需 iPhone 验收。

## 验证结果

| 检查 | 结果 |
| --- | --- |
| `npm run typecheck` | PASS。 |
| `node scripts/test-facility-favorites.cjs` | PASS：真实 SQLite v9、迁移回滚及旧行／结构比较；两铁组合、防重复、取消、快速连点、写入／读回失败、重启；705／706、ID 250、失效组合、双语按钮及分类排序；原设施、地图／列表、巴士收藏与置顶回归；首页仍使用旧巴士置顶，交通及管理入口保留；数据库副本重开。 |
| `node --test scripts/test-nearby-bus-location.cjs scripts/test-mtr-next-train.cjs scripts/test-railway-station-geo.cjs` | **81/81 PASS**：三交通附近／搜索、距离与坐标、定位生命周期及返回恢复、铁路静态身份和实时语义、所选轻铁路线标记。 |
| `node scripts/test-global-search.cjs`、`node scripts/test-global-search-ui.cjs` | PASS：统一三交通、双语／官方代码、快速输入／清空／返回、离线、设施及精选地点。 |
| `node scripts/test-global-search-navigation.cjs` | PASS：收藏及搜索的原详情路由、选线参数、根 Stack 返回状态；原巴士、设施和地点导航。 |
| `node scripts/test-bus-route-map.cjs` | PASS：巴士路线图、站序／变体、ETA、限时服务、车费、失败与过期状态。 |
| `python3 scripts/test-nearby-bus-fares.py` | **2/2 PASS**。 |
| 本机 iOS Metro／Hermes 导出 | PASS，1324 modules，产生 `.hbc`；目录 `/private/tmp/kongdaily-p3b-ios.fAgv4v`。使用 `EXPO_OFFLINE=1`，未创建 EAS Build。 |
| `git diff --check` | PASS。 |

没有启动模拟器或真机。Node 的路由／UI 断言及离线导出不能代替原生视觉和手势验收。首页、官方静态资产、实时客户端／解析器、附近定位／距离规则及全局搜索实现未改；首页目前仍仅显示既有置顶巴士。

## Phase 3C 接入边界

后续可直接复用 `listRailwayFavorites()`、`useRailwayFavorites()`、`railwayFavoriteId()`、`resolveRailwayService()`；记录提供 mode／lineId／stationId，失效组合返回不可用。`railwayFavoriteHref()` 统一生成安全详情入口。本轮只有持久化、收藏入口、管理列表及详情上下文；**没有首页铁路卡片、铁路置顶机制、首页自动刷新或批量 ETA 请求**。3C 的展示及按需预报策略待另行授权。

## iPhone 人工验收

1. 保留现有巴士和设施收藏后升级运行，确认原巴士数量、顺序、首页置顶和设施地图入口一致。分别检查两种语言及大字模式。
2. 从全局搜索进入金钟，无线路上下文时先选线；分别收藏港岛线与东铁线，切线核对图标，取消其中一项不影响另一项；快速连点、退出再进入。
3. 轻铁洪水桥分别收藏 610、614；天水围分别收藏 705、706；核对海皇路 ID 250。检查只有官方本站路线可选，月台或特别班次不能产生虚假收藏。
4. 在原收藏 Tab 检查全部、巴士、港铁、轻铁、地点筛选及取消；分别检查无铁路、单一铁路类型、混合收藏。点击两铁卡片应选中正确线路／路线并显示原真实预报；轻铁保持全站月台和所选路线标记。
5. 向下滚动收藏，打开详情并用系统返回／边缘手势返回，检查分类及合理滚动位置；再验证交通搜索和附近结果仍正常。
6. 完全关闭再启动 App，核对每个线路＋车站收藏及取消状态、巴士置顶；飞航模式下仍能读写本机收藏，详情显示原有离线／过期状态。首页不应出现铁路预报卡片。

## Git 状态与停止点

开工工作区干净，当前 `develop` 的 HEAD 与本机 `origin/develop` 均为 `1f7924a819fb3239a5c6a63ee2acde80e96a2401`（Phase 3A 已提交）。`main`、`v1.1.0` 解引用仍为 `796a719b93e08bf4fb540d9ef9a07b6510efbf25`；未查询或变更远端。

交付共 18 个文件：14 个既有文件修改、4 个新增文件（本报告、铁路 repository、hook、按钮）。全部保留未暂存／未提交；App 版本号不变。未执行 commit／push／merge、EAS Build、网站部署或 App Store Connect 修改。**到此停止，等待开发者 iPhone 验收，不进入 Phase 3C。**
