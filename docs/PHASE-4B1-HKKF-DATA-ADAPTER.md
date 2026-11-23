# Phase 4B1 · 港九小轮数据层与时刻表 Adapter

在 develop 的 c388bb5 实施，与本地 origin/develop 相差 0／0。开工时已有未跟踪的 [4B0 渡轮审计](./PHASE-4B0-FERRY-DATA-VALIDATION.md)，已原样保留。实现依据该审计中的八个已核实方向，及保存的实际响应与营办商独立班次表。

## 文件

| 文件 | 内容 |
| --- | --- |
| [ferry-data.ts](../src/ferry-data.ts) | 渡轮路线、方向、码头、班次、票价预留类型、到达预报、来源及新鲜度。提供香港服务日和自然日纯函数。 |
| [hkkf-data.ts](../src/hkkf-data.ts) | 港九小轮来源与双语署名、路线码头映射、JSON 包装及字段校验。 |
| [hkkf-timetable.ts](../src/hkkf-timetable.ts) | 安全读取 BOM CSV、引号及单引号时分列表，解析日型和例外，整理备注为纯文本。 |
| [hkkf-client.ts](../src/hkkf-client.ts) | 可注入 fetch／时钟的只读客户端，提供来源信息、总时限、缓存、并发合并、取消和退避。 |
| [固定样本](../scripts/fixtures/hkkf-api.json) 与 [定向测试](../scripts/test-hkkf-data.cjs) | 保留 4B0 路线、码头、方向和 ETA 数据格式，以独立网页时分逐项校验 324 条班次。CSV 的自由文本备注缩为最小解析样例。样本仅在测试目录。 |

## 接口及路向

`createHkkfClient({ enabled: true })` 是显式启用入口，默认禁用。提供 `readRoutes(signal?)`、`readPier(pierId, signal?)`、`readTimetable(routeId, direction, signal?)`、`readEta(routeId, direction, signal?)`。分别读取 `/opendata/route`、`/opendata/pier/{pier_id}`、`/opendata/time_table/{route_id}/{direction}`、`/opendata/eta/{route_id}/{direction}`。返回既有读数契约的 payload、接收时钟、服务器参考时刻及 retryAt。结果数据含来源类型、URL、抓取时刻及上游实际提供的版本与 generated_timestamp。根据实际成功内容解析 JSON，即使营办商响应声明 text/html。真正的 HTML、无效字段和与已核定身份不符的响应分别走错误状态。 [官方 API](https://www.hkkfeta.com/datagovhk/HKKF_ETA_API_Specification.pdf)

| 官方 route_id | inbound | outbound |
| --- | --- | --- |
| 1 | 索罟灣 5 → 中環4號 1 | 中環4號 1 → 索罟灣 5 |
| 2 | 榕樹灣 3 → 中環4號 1 | 中環4號 1 → 榕樹灣 3 |
| 3 | 坪洲 4 → 中環6號 2（西泊位） | 中環6號 2（西泊位）→ 坪洲 4 |
| 4 | 喜靈洲 6 → 坪洲 4 | 坪洲 4 → 喜靈洲 6 |

内部路线及码头键为 hkkf:route:{id}、hkkf:pier:{id}。方向身份使用 operatorId、operatorRouteId、directionId。两个中环码头分别保存，港九小轮码头坐标标为码头参考点。CSV 的起讫栏位作为路线级别校验字段，独立映射决定实际方向。新增、缺少、重复的路线或变化的 ID／双语端点返回 mappingMismatch。无效时刻、坐标或结构返回 invalidResponse。未来如上游更正 CSV 语义，先核对官方出发港再更新解析契约。

## 时刻表及到达预报

- 静态条目统一为 scheduledDeparture，保留官方周一至周六／周日及公众假期两栏、标记及备注。营办商未提供 CSV 生成时刻，来源只记录抓取时间。以调用方提供的香港公众假期查询决定日型，非星期日且日期覆盖未知时返回 calendarUnknown。
- 条目明确区分已核定的星期六限定、选开、尾班、船货限制及续程标记。每条线路用各自规则，不从 HTML 推断新规则。未识别标记和未核实的凌晨时分保留原值，选开或未核实班次不进入默认下一班。原始备注是纯文本，喜靈洲通行限制日后应继续随来源展示。续程标记不会生成新的航线或自动承诺接驳。
- 依据运输署明确的跨日尾班说明，为路线 2／3 outbound 的 00:30 及路线 4 outbound 的 01:00／00:10 设置 +1 日。其他经核实的凌晨首段保留在表列服务日。ferryServiceDaySchedule 计算指定服务日及其跨日尾班。ferryDeparturesToday 只返回当前香港自然日，按实际时刻排序，考虑前一服务日跨入今天的尾班，并区分 ready、ended、noTimetable 或 calendarUnknown。ended 指可确认的计划班次已完结。 [独立班次与跨日说明](https://www.td.gov.hk/en/transport_in_hong_kong/public_transport/ferries/service_details/index.html)
- 实时条目统一为 liveArrival，目的港来自已核定方向。严格解析带时区的 ETA，保留 generated_timestamp，另存 date／session_time 作为营办商班次上下文。ferryEtaView 区分有效、无预报、过期、错误、不可用。HTTP 422／500 分别保留对应状态码，429 返回 rateLimited。空数组不代表停航，计划时间也不会成为实时预报。现有时刻表仅提供计划开航及营办商说明。 [官方数据字典](https://www.hkkfeta.com/datagovhk/HKKF_ETA_Data_Dictionary.pdf)

## 请求与发布门槛

静态成功缓存 15 分钟，静态失败冷却 10 秒，ETA 每方向最短 60 秒重复请求间隔，初始有效期 120 秒。缓存只在内存中。上游时间、HTTP Date／Age、单调经过时间共同用于时效判断。每个请求 8 秒总时限覆盖连接和响应体，底层忽略 abort 时调用仍会结束。相同资源的请求合并，单个调用方取消只结束该方等待。已超时的晚到响应不会更新缓存或退避状态。429 对 HKKF 客户端生效，支持秒数及 HTTP 日期 Retry-After，最低 60 秒。一旦收到 403，实例停用后续请求。客户端仅按需读，没有后台或其他自动轮询。

**第三方再利用授权仍待确认。** 公开可访问与 DATA.GOV.HK 收录并未确认 App Store 分发、离线打包或设备端轮询获许可。保留营办商与 DATA.GOV.HK 双语署名。4B2 应在明确适用条件后才启用 Provider，并确认缓存期限、配额及署名形式。未导入应用入口或打包生产班次。票价仅有预留类型，未发送票价请求，坪洲↔喜靈洲在 4B0 核实的票价不同，待营办商确认。也未验证逐班取消、临时改道或全时段 ETA 覆盖。 [港九小轮条款](https://hkkf.com.hk/en/hkkf-digital-services-terms-and-privacy-policy/) · [开放数据目录](https://data.gov.hk/en-data/dataset/hkkf-hkkfdata-hkkf-eta-data)

## 4B2 接入建议

先以 `readRoutes` 与已核实码头建立搜索及详情键，使用原有统一搜索注册表，以官方起讫港和泊位支持双语检索。详情按 directionId 调用 `readTimetable`，接入有年份覆盖的香港公众假期读取。把 `ferryDeparturesToday` 用于「下一班開航」，明确显示结束、无适用表及来源覆盖。只有采用已经获批且有实测覆盖的方向，才接入 `readEta` 和 `ferryEtaView` 显示「船舶預計抵達」，沿用现有焦点、前台和生命周期约束。4B2 前重新核对两份中环泊位及跨日例外。冻结快照、节假日或条件标记不足时仅显示有依据的条目并提供官方来源。

## 验证

新增测试以固定样本覆盖四路线、六码头、八方向、324 条核对时分、日型、午夜、异常字段、HTTP 422／429／500、403、缓存合并、超时恢复与单边取消。没有在线测试依赖。

- TypeScript 通过。定向测试共 122 项通过，其中新增港九小轮测试 14 项。原有巴士、港铁、轻铁、小巴、搜索、附近及收藏测试均通过。
- 在 America/Los_Angeles 时区重跑港九小轮测试，14 项均通过。新文件空白、相对链接及 git diff --check 通过。
- Git 保持 c388bb5，只有原 4B0 报告及本轮新增的七个文件未跟踪。未启动模拟器或创建 EAS Build。
