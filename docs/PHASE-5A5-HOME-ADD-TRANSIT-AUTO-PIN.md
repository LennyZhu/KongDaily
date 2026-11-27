# Phase 5A5 · 首页新增交通自动收藏及置顶

## 实现与修改文件

首页「＋新增常用交通」使用 `/transport?intent=add-home-transit`。该参数只经交通查询、路线、站点及巴士路线图的 push 导航传递，保留各服务原有身份参数。普通入口不带此参数，离开这些路由后，新普通入口没有继承的全局开关。

- [首页](../src/app/(tabs)/index.tsx)与[意图及导航辅助](../src/home-transit-intent.ts)设置和传递意图。
- 路由传递涉及 [交通查询](../src/app/bus/nearby.tsx)、[巴士路线](../src/app/bus/route.tsx)、[巴士 ETA](../src/app/bus/eta.tsx)、[巴士站](../src/app/bus/nearby/stop.tsx)、[巴士地图](../src/app/bus/route-map.tsx)、[港铁行](../src/components/mtr-ui.tsx)、[轻铁行](../src/components/light-rail-ui.tsx)与[小巴附近卡片](../src/components/gmb-nearby-rows.tsx)。
- [首页流程保存操作](../src/components/home-transit-save.tsx)、[铁路收藏操作](../src/components/railway-favorite-action.tsx)、[小巴收藏操作](../src/components/gmb-favorite-action.tsx)和上述巴士详情接入紧凑操作及反馈。
- [共享置顶](../src/home-transport-pins.ts)、[巴士收藏](../src/bus-favorites.ts)、[铁路收藏](../src/railway-favorites.ts)、[铁路状态](../src/railway-favorite-hooks.ts)、[小巴收藏](../src/gmb-favorites.ts)扩展事务及提交后的状态发布。[收藏页](../src/app/(tabs)/saved.tsx)兼容扩展结果类型。
- [双语文案](../src/i18n.ts)提供成功、满额反馈。
- 测试涉及 [收藏及 Repository](../scripts/test-facility-favorites.cjs)、[导航](../scripts/test-global-search-navigation.cjs)、[首页 UI](../scripts/test-global-search-ui.cjs)、[附近交通](../scripts/test-nearby-bus-location.cjs)、[巴士 ETA](../scripts/test-bus-route-map.cjs)、[探索导航](../scripts/test-explore-trailhead-navigation.cjs)。

## 收藏、满额与事务

特殊流程中，未收藏的服务点击原收藏入口后，创建正常收藏并尝试置顶，成功时追加到已有顺序末尾。保留现场浏览，不自动跳回首页。

已收藏但未置顶的服务额外显示小型「置頂首頁」操作。原有书签仍可取消收藏，已置顶记录不会重复创建。港铁继续以线路＋车站、轻铁以路线＋站点、小巴以 route_id＋route_seq＋stop_seq＋stop_id、巴士以原有精确停靠身份保存。

四类收藏与共享置顶沿用统一写队列。保存和置顶在同一个独占事务内执行，收藏读回也在提交前完成。满四项返回 limit，允许收藏提交，原置顶集合及顺序保持。异常写入或读回错误触发回滚；提交成功后才发布收藏和置顶状态。共享排序写入逻辑复用原有有界集合重排，兼容删除留下的位置间隙。SQLite v12 Schema 无变更，无 v13 迁移。

普通收藏 API 的自动置顶选项默认关闭。首页全域搜索、生活快捷入口及其他普通导航继续只收藏。参数采用当前路由局部状态，符合格式的明确新增意图可在流程内继续传递。

## 文案与反馈

| 结果 | 繁中 | English |
| --- | --- | --- |
| 新增并置顶 | 已收藏並置頂首頁 | Saved and pinned to Home |
| 已收藏服务置顶 | 已置頂首頁 | Pinned to Home |
| 满额而仅收藏 | 已收藏，首頁置頂已滿（最多四項） | Saved. Home pins are full (maximum 4). |

数据库失败使用既有保存错误文案。轻量状态文字和 VoiceOver 公告反馈实际提交结果；不同服务的反馈按稳定身份隔离。普通流程和没有状态文字时不渲染额外占位。

## 验证

TypeScript、188 项完整 CJS 回归、SQLite Repository 回归、iOS Metro／Hermes 生产静态导出与 `git diff --check` 通过。最后的反馈占位调整另重跑了收藏 Repository 套件。

新增测试使用实际 SQLite 和生产 Repository，覆盖四种交通的新建并置顶、普通保存、已收藏直接置顶、重复保存、第四项、第五项仅收藏、并发争用、巴士／铁路置顶写入失败、小巴读回失败、状态发布、顺序及重启。导航测试覆盖首页专属入口、四类结果的意图及业务参数、普通路由恢复。Phase 5A1–5A4、旧库升级和生产门禁回归通过。

## iPhone 人工验收

1. 首页有空位时点击新增入口，分别从路线、站点及搜索找到巴士、港铁、轻铁和小巴服务。收藏后确认反馈及页面不跳转，返回首页直接看到新增卡片，收藏页置顶状态也应正确。
2. 在此流程打开已收藏未置顶服务，点击「置頂首頁」；重新进入已置顶服务，检查没有重复操作和记录。用原书签取消收藏，确认首页释放名额。
3. 由第三项增加第四项，再在尚未退出的流程中收藏第五项，确认提示仅收藏成功。返回首页核对四项及顺序，新增按钮隐藏。重新启动核对持久化。
4. 从首页顶部搜索、生活快捷入口和普通交通查询分别收藏新服务，确认只收藏。退出新增流程后再从普通入口收藏，核对意图已自然结束。
5. 抽查港铁换线、轻铁同站不同路线、小巴双向及循环停靠、巴士路线图到 ETA 的导航身份。连续点击时核对没有重复项，四项首页 ETA 自动刷新及下拉仍正常。
6. 切换繁中、英文及 VoiceOver，核对反馈、取消收藏和直接置顶操作。抽查 300 米默认范围及 Tab 滑动。

原生手势、VoiceOver 朗读时机及视觉布局待设备验收。基线为 develop 的 `9ad73f0`，开工时与本地 origin/develop 对齐且工作区干净。改动未提交，未启动模拟器或创建 EAS Build。
