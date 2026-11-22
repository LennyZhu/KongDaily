# Phase 4A1A · 绿色专线小巴数据适配器

基线为 develop 的 6b88b8f，与本地 origin/develop 相差 0／0。开工时已有未跟踪的 [4A0 审计报告](./PHASE-4A0-TRANSPORT-DATA-SOURCE-AUDIT.md)，继续保留。本轮新增独立数据层和定向测试。

## 文件与接口

| 文件 | 职责 |
| --- | --- |
| [src/gmb-client.ts](../src/gmb-client.ts) | 官方请求、按路径缓存及在途合并，处理超时、调用方取消和 HTTP 429 退避。提供 gmbClient 单例和可注入请求／时钟的 createGmbClient。 |
| [src/gmb-data.ts](../src/gmb-data.ts) | 官方响应校验、静态领域类型、ETA 解析和按时钟计算展示状态的纯函数 gmbEtaView。 |
| [scripts/test-gmb-data.cjs](../scripts/test-gmb-data.cjs) 与 [scripts/fixtures/gmb-api.json](../scripts/fixtures/gmb-api.json) | 通过固定响应测试客户端及解析器。夹具取自 4A0 和本轮只读抽样，路线目录与班距记录经过裁样。异常和边界由测试合成。 |

| 方法 | 官方路径与结果 |
| --- | --- |
| readDirectory()、readRegionalDirectory(region) | /route、/route/{region}。按 HKI／KLN／NT 区分编号目录，保留生成及更新时间。 |
| readRoutesByCode(region, routeCode)、readRouteById(routeId) | /route/{region}/{route_code}、/route/{route_id}。两种官方响应均为数组。GmbRoute 保留变体、多语起讫站及说明、方向及班距。按 ID 查询验证响应中的 ID。 |
| readRouteStops({ routeId, routeSeq }) | /route-stop/{route_id}/{route_seq}。GmbRouteStops 提供按 stopSeq 排列的 GmbVisit 及更新时间，保留每次停靠的官方站名。 |
| readStop(stopId) | /stop/{stop_id}。GmbStop 保留 WGS84、站点是否在役、官方备注和更新时间。使用现有附近站索引的香港范围，拒绝对调、缺失及明显越界坐标。站名按路线停靠记录读取。 |
| readEta(visit) | /eta/route-stop/{route_id}/{route_seq}/{stop_seq}。请求使用精确停靠，通过目录的 stopId 核对响应。 |

路线编号以地区分组，实际服务以 routeId 标识，方向使用官方 routeSeq 1／2，停靠至少需要 routeId＋routeSeq＋stopSeq。同一 stopId 在同一循环线可出现多次。普通、短程、特别班次按官方 ID 和说明保留。双向站序分别读取。API 规范和 4A0 实测作为解析依据，本轮另外通过两次只读 GET 验证分区目录及按 route_id 查询的实际结构。[运输署 API 规范](https://data.etagmb.gov.hk/static/GMB_ETA_API_Specification.pdf) · [官方目录](https://data.gov.hk/en-data/dataset/hk-td-sm_7-real-time-arrival-data-of-gmb)

## ETA 和请求策略

- GmbReading<T> 沿用既有读数契约，提供 payload、接收时钟、服务器参考时钟和最早重试时间。成功时由 GmbResult<T> 携带生成时间及类型化数据。异常区分 invalidInput、invalidResponse、network、timeout、cancelled、rateLimited 和带状态码的 http。
- gmbEtaView 区分实时预报、即将到站、计划班次、官方备注、空预报、停用和过期。官方 Scheduled／未開出归为计划，仅保留绝对时间及备注。未确认的其他备注单独保留，不推断倒计时。实时倒计时以官方 timestamp 为准，用生成时间与 diff 核对合理性，允许分钟舍入误差。已过时点及负 diff 不显示倒计时，少于一分钟用 imminent 标记，不产生负数或假零分钟。
- 预报时效初始设为两分钟，结合官方生成时间、响应 Date／Age 及现有单调时钟判定。静态成功缓存 15 分钟、失败冷却 10 秒。ETA 同一路径成功或失败均有 60 秒请求间隔。缓存仅在内存且有容量上限，静态缓存按资源最多 256 项、ETA 最多 64 项。没有自动轮询、预取或列表 ETA 扇出。
- 与现有铁路前台刷新共用读数／时钟接口，并沿用现有客户端的超时、合并与退避做法。绿小巴需要分别表示网络、HTTP、格式错误和取消，因此请求封装独立，不改其他交通客户端。8 秒总时限覆盖连接与响应体读取，即使底层 fetch 忽略 abort，调用也会结束。取消当前订阅立即返回 cancelled，其他订阅可继续共用请求，实际请求最迟由总时限终止。晚到响应无法覆盖结果或改变退避。429 作用于当前小巴客户端，对秒数或 HTTP 日期的 Retry-After 取至少 60 秒。只有 4A1B 消费端在聚焦和前台联动时才会开始刷新。

## 4A1B 接入及待确认事项

1. 用 readDirectory／readRegionalDirectory 发现编号，按地区＋编号读取变体。经验证的目录可用作后续两处搜索及附近静态快照的输入。适配器的内存缓存不提供跨重启离线目录。
2. 路线详情按 routeId＋routeSeq 获取站序。站点详情将 visit.name 与 readStop 的坐标、在役信息配合使用。仅对用户选中的精确 visit 调用 readEta，使用包含 routeId、routeSeq、stopSeq 和 stopId 的消费端身份。可用稳定回调接入现有 useNextTrainReading，按 retryAt 和前台／焦点刷新，用 gmbEtaView 根据当前读数判定状态。
3. 上游精确 ETA 响应回传 stopId，不回传请求的 routeId／routeSeq／stopSeq。客户端按完整请求路径合并并核对 stopId，仍依赖上游正确路由同一个实体站的多次停靠。待确认 ID 退役规则、服务停用实况、其他备注及首站时间语义、源更新时间与公开配额。当前 TTL 和两分钟时效属于客户端策略，后续可按覆盖实证调整。
4. 正式上线前验证全量官方目录、设备上的网络及生命周期，确认离线再分发、署名和设备端访问条件。此阶段未接入 UI、索引、首页、收藏、SQLite v10、渡轮或电车。

## 验证

- TypeScript 类型检查通过。
- 定向测试共 94 项通过，其中 15 项为新增绿小巴测试。既有回归涵盖巴士路线图、车费与首页 B2 ETA，港铁／轻铁 ETA 和前后台刷新、统一搜索／导航与附近定位。运行命令为 node --test scripts/test-gmb-data.cjs scripts/test-bus-route-map.cjs scripts/test-global-search*.cjs scripts/test-mtr-next-train.cjs scripts/test-nearby-bus-location.cjs。
- git diff --check 与新文件空白检查均通过。工作区保留已有 4A0 报告及本轮五个新文件，分支及提交保持原状。
