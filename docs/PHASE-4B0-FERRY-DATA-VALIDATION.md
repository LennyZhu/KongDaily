# Phase 4B0 · 香港渡轮数据验证与实施方案

2026-11-22（香港时间）。开工时 develop 为 c388bb5，与本地 origin/develop 相差 0／0，工作区干净。依据 [4A0 审计](./PHASE-4A0-TRANSPORT-DATA-SOURCE-AUDIT.md) 和 [4A1C 离线索引](./PHASE-4A1C-GMB-NEARBY.md) 复核。接口样本为本次只读 GET，线路和船期以采样窗口为准。**实测**为本次下载和比对，**文档**为正式来源支持的结论，**待确认**为未能验证的行为、覆盖或权限。

**4B1 建议先做港九小轮四条路线的码头、附近、搜索及静态班次；正式发布须通过授权门槛。** 港九小轮 8 个静态方向已解开冲突，实时先在有非空样本的方向试点。新渡轮先做已校对的静态路线；富裕小轮实时暂缓，运输署静态数据另行审核。

## 1. 三家营办商可用性

| 营办商 | 航线／码头和静态班次 | 实时抵达 | 4B1 边界 |
| --- | --- | --- | --- |
| 港九小轮 HKKF | **实测** 4 线、6 个营办商码头、8 个方向 CSV、4 份票价 CSV。16 个方向／日型栏位共 324 个开航时分与营办商网页相符。 | **实测** 8 个方向 HTTP 200；1 inbound、3 inbound、3 outbound 有带偏移量的抵达预报，其余 5 组当时为空。**文档**每分钟更新。 | 静态方向可编码；实测方向可作 ETA 试点。路线 4 票价冲突暂缓，其他票种和限制仍按来源核实。[官方目录](https://data.gov.hk/en-data/dataset/hkkf-hkkfdata-hkkf-eta-data) · [API](https://www.hkkfeta.com/datagovhk/HKKF_ETA_API_Specification.pdf) · [数据字典](https://www.hkkfeta.com/datagovhk/HKKF_ETA_Data_Dictionary.pdf) |
| 新渡轮 Sun Ferry | **实测**五线的繁中及英文时刻表 10 份 CSV 均为 HTTP 200；长洲票价 CSV 有普通舱、豪华舱、快船分类。码头对照见 §4。梅窝有跨语言差异。 | **实测**五个公开方向查询 HTTP 200。ETA 有缺日期的 HH:mm 或 null，带日期的生成字段与计划时间同包出现。**待确认**服务日和变体规则。 | 优先静态点对点线路。梅窝须核清差异；横水渡须完成多码头及直航变体映射。HH:mm 暂不转成实时倒计时。[时刻表](https://data.gov.hk/en-data/dataset/sunferry-timetables-timetables) · [票价](https://data.gov.hk/en-data/dataset/sunferry-faretables-faretables) · [ETA](https://data.gov.hk/en-data/dataset/sunferry-eta-eta) |
| 富裕小轮 Fortune Ferry | **实测**营办商两份静态 CSV 返回 403；运输署独立下载的中环↔红磡和屯门↔大澳走廊 CSV 为 200。部分码头及航段已有官方地理依据。 | **实测** CLHH、WATERTAXI 两个规范值及文档直链均返回 403 HTML。**文档**存在正式查询路径和已发布方向代码，**待确认**登记、许可及访问方式。 | 本轮及首批实时均暂缓。政府静态资料可作为后续独立候选，须逐线核实身份、班次及再利用条件。[营办商静态目录](https://data.gov.hk/en-data/dataset/ff-fortune-schedule1) · [ETA 目录](https://data.gov.hk/en-data/dataset/ff-fortune-schedule2) · [运输署静态 CSV 目录](https://data.gov.hk/en-data/dataset/hk-td-wcms_8-ferry-services-tt-ft) |

## 2. 港九小轮 · 方向映射与 API 样本

主机为 https://www.hkkfeta.com。23:00 左右实测 GET /opendata/route、/opendata/pier/{1..6}、/opendata/time_table/{1..4}/{inbound|outbound}、/opendata/eta/{1..4}/{inbound|outbound} 和 /opendata/fare_table/{1..4} 均为 200。路线、码头、ETA 正文是 JSON，响应声明 text/html。解析必须验证成功状态、JSON 格式、包装字段及实体类型。

### 码头与方向

坐标列为纬度、经度，来自实测码头 API。所有 ID 均为 HKKF 命名空间。

| pier_id | 繁中／英文 | 坐标 |
| --- | --- | --- |
| 1 | 中環4號渡輪碼頭 / Central Pier 4 | 22.288007, 114.158389 |
| 2 | 中環6號渡輪碼頭 / Central Pier 6 | 22.287462, 114.160330 |
| 3 | 榕樹灣渡輪碼頭 / Yung Shue Wan Pier | 22.226520, 114.109105 |
| 4 | 坪洲渡輪碼頭 / Peng Chau Pier | 22.284587, 114.037164 |
| 5 | 索罟灣公衆碼頭 / Sok Kwu Wan Pier 2 | 22.206086, 114.131543 |
| 6 | 喜靈洲碼頭 / Hei Ling Chau Public Pier | 22.2579923, 114.0277868 |

**冲突原因可定位到 CSV 字段语义。** 每条线的两份 CSV 都把路线 JSON 中的起讫地名原样放进 origin/destination 列，即使请求方向不同。将每份 CSV 的两个日型栏位解析为时分清单，与营办商独立网页上明确标明出发港的栏位逐一比对，16 个栏位的时分多重集相同，共 324 个班次时间项。比较只核对时间数值，符号及例外规则须另行校验。运输署的登船码头资料也能对应这些航线。实际方向固定为以下 8 个映射，4B1 的构建程序应在每次更新时重验样本及键，冲突时隔离受影响的方向。

| route_id | inbound 实测出发→抵达（码头 ID） | outbound 实测出发→抵达（码头 ID） | 独立班次对照样例（平日表，in／out） |
| --- | --- | --- | --- |
| 1 | 索罟灣 5 → 中環4號 1 | 中環4號 1 → 索罟灣 5 | 06:40／07:20。[营办商班次](https://hkkf.com.hk/en/timetables/central-to-sok-kwu-wan/) |
| 2 | 榕樹灣 3 → 中環4號 1 | 中環4號 1 → 榕樹灣 3 | 05:30／02:30；平日栏的 02:30 带星期六限定。[营办商班次](https://hkkf.com.hk/en/timetables/central-to-yung-shue-wan/) |
| 3 | 坪洲 4 → 中環6號 2（西泊位） | 中環6號 2（西泊位）→ 坪洲 4 | 03:40／03:00；均带船货限制标记。[营办商班次](https://hkkf.com.hk/en/timetables/central-to-peng-chau/) |
| 4 | 喜靈洲 6 → 坪洲 4 | 坪洲 4 → 喜靈洲 6 | 07:05／09:45；由喜靈洲经坪洲继续往中環涉及落船及重新入闸。[营办商班次](https://hkkf.com.hk/en/timetables/peng-chau-to-hei-ling-chau/) · [运输署登船及班次](https://www.td.gov.hk/en/transport_in_hong_kong/public_transport/ferries/service_details/index.html) |

生产规则以集合中的已验证 directionId 映射起讫码头。CSV route_id／direction 与 URL 必须一致，再核对路线级名称，具体出发港从映射取得。TD GeoJSON 路线 7014 覆盖中環、坪洲、喜靈洲，但不能直接转成同船续程或覆盖 HKKF 的两条 routeId。当前坐标用于码头参考点，不用于确认实际出入口。

### 时刻、票价和异常

- 实测 /opendata/time_table/1/inbound 为 UTF-8 BOM CSV，行前缀为 `1,inbound,Central,中環,中环,Sok Kwu Wan,…`；周一至周六字段的列表由 `06:40` 开始。两列是 CSV 引号内的单引号列表，含空占位、符号及少量格式化 HTML 备注。用 CSV 解析器和受约束的列表语法读取，禁止执行表达式。路线 1 的 @ 为选开；路线 2 的花括号是星期六限定；路线 3 的花括号指船货限制。各路线分别绑定标记，未知规则保留官方备注并暂不进入可执行班次。路线 4 outbound 的 01:00／00:10 是前一服务日后的尾班，TD 表明为下一自然日。其他跨日例外逐个核对，不根据排序或符号单独推断。[API 规范](https://www.hkkfeta.com/datagovhk/HKKF_ETA_API_Specification.pdf) · [运输署班次](https://www.td.gov.hk/en/transport_in_hong_kong/public_transport/ferries/service_details/index.html)
- 实测 /opendata/eta/3/outbound 的精简结果为 `generated_timestamp=2026-11-22T23:00:12+08:00`，行包含 `{"route_id":3,"direction":"outbound","date":"2026-11-22","session_time":"22:50:00","ETA":"2026-11-22T23:17:00+08:00"}`。同一时刻反向 3/inbound 的 ETA 为 23:14，1/inbound 为 23:11，其它五组 data 为空。date 和 session_time 是班次上下文；仅 ETA 为到达估计。ETA 无独立码头 ID，方向来自上述映射。用带显式时区时间戳、路向一致性和来源时间验证；CSV 只提供计划开航。此前缺码头 ID 的请求实测为 422；429、500 由规范支持，本轮未主动触发。[数据字典](https://www.hkkfeta.com/datagovhk/HKKF_ETA_Data_Dictionary.pdf)
- 实测成人单程 CSV 值按平日／星期日及公众假期分别为 HK$30.90/43.50、24.90/34.70、31.90/46.60、21.10/21.10。第 4 线营办商网页与运输署均为 21.00，**数字票价暂不发布**，先链接官方票表。其他三个成人单程值与营办商网页相符，仍须按生效日期匹配。月票等有单值或空值，不自动补齐；优惠价、来回票、货运和船型另有条件。没有验证 HKKF API 提供每班可靠的船型键。[营办商票表](https://hkkf.com.hk/en/timetables/) · [运输署票表](https://www.td.gov.hk/en/transport_in_hong_kong/public_transport/ferries/service_details/index.html)
- 取消／临时改航优先使用营办商公告及运输署特别交通消息。营办商会按具体航线和时刻公布复航。未验证官方机器可读逐班取消接口；空预报和源错误不转成停航。只在有明确适用日期、路向及有效范围时标记运营例外。[港九小轮公告](https://hkkf.com.hk/en/) · [复航通告样例](https://hkkf.com.hk/wp-content/uploads/2025/09/%E5%BE%A9%E8%88%AA%E9%80%9A%E5%91%8A_%E5%A1%94%E5%B7%B4.pdf)

## 3. 新渡轮 · 静态及 HH:mm 处理

- 实测五线各两语 CSV 均为四列，含方向、营运日型、开航时分和数值备注。每语言的数据行数分别为长洲 164、梅窝 172、横水渡 50、北角↔红磡 90、北角↔九龙城 90。例 GET /eta/timetable/SunFerry_central_cheungchau_timetable_eng.csv 的首行班次字段为 `Central to Cheung Chau, …, 12:30 a.m.`。12:30 a.m. 解析为 00:30；梅窝另有工作日／星期六／假日三组。横水渡英文有 Chueung Chau 拼写和重复空格，使用明确别名；多个运行路线不可按文字自动拼接。梅窝工作日中環→梅窩英文 09:00、繁中 09:10，其他三行的备注编码不同，先保留原始两源并隔离冲突。不要按行号直接合并语言。[官方时刻表目录](https://data.gov.hk/en-data/dataset/sunferry-timetables-timetables) · [营办商时刻表和临时船型安排](https://www.sunferry.com.hk/en/route-and-fare/timetable)
- 取得长洲英文票价 CSV，实测同一成人日型有普通舱、豪华舱和快船三行，且时刻表只有备注字段。按航线和文件版本验证备注字典，再联结船型、舱等和票价。不可仅以船舶代码或 ETA 代码后缀推出船型和票价。两份直链说明 PDF 返回 404；已索引 ETA 规范仍能查阅。码头停靠改动及替船同时参考营办商公告。[票价 CSV](https://www.sunferry.com.hk/eta/faretable/SunFerry_central_cheungchau_faretable_eng.csv) · [新渡轮公告](https://www.sunferry.com.hk/en)
- 实测 GET https://www.sunferry.com.hk/eta/?route=CECC 的包装生成于 `2026-11-22T23:00:07+08:00`。CECC 行的 `depart_time="22:30", eta="23:20", date_timestamp="2026-11-22T23:00:07+08:00"`，另有 CECCH 行。请求 CCCE 得 CCCE／CCCEH，后一行 eta:null。CEMW 返回 CEMWH 一行。IIPECMUW 返回 23:45／null，NPHH 在 23:00 返回 08:23／null。响应的 `Cache-Control` 声明 max-age=300、s-maxage=900，单次采样无法证明准确更新频率。保留 Date/Age 及生成时间的校验，避免拿旧缓存刷新倒计时。[官方 ETA 规范](https://www.sunferry.com.hk/eta/SunFerry_ETA_API_Specification_and_Data_Dictionary.pdf)

| 字段 | 解释及 4B1 兼容 |
| --- | --- |
| depart_time | 规范为 Scheduled Departure 的时分。缺日时只存原始时分和方向；未来只有匹配已核定服务日／时刻表后才能绑定日期。NPHH 的 08:23 样本禁止从 23:00 的生成时间直接推定今天或次日。 |
| eta | 目的港的 Estimated Arrival。带显式偏移的严格 ISO 时间可以解析，仍须通过航段、船程、时效与授权门槛；本轮未看到 ISO 实机样本。HH:mm 或 null 留作未定时间，不进入倒计时。 |
| date_timestamp / data_timestamp | 两个字段名都在规范样例或字典出现；实测为 date_timestamp。作为行的来源时标，不能填作航程日期。若两者并存但冲突则拒绝作为实时读数。保留封装的 generated_timestamp 作为独立观测时钟。 |
| routecode, vesselcode, lat/lng, rmk_* | 分别为方向或供船变体、船舶、位置和备注。以明确的允许列表验证变体、航段与请求方向。位置样本包含字符串及 null，不能用于码头定点或独立证明已开船。备注可能为空。 |

**跨午夜方案。** 所有服务日运算使用 Asia/Hong_Kong。计划班次用已核实的 dayOffset，日期候选至少包含上一服务日、今天及下一服务日，先按公众假期和日型过滤，再生成绝对时间。若日后营办商确认 HH:mm 的日期规则，可按明示服务日、航段及时刻表校对 23:50→00:15 这类唯一候选，并通过新鲜度及船程上限后启用。多个候选、缺失日期合同、临时调班或无法确认的跨日行保持未定。4B1 默认只显示已验证静态计划，不自动把较小的时分滚到明天。公众假期用 1823 政府日历数据，核验覆盖至所选年份；日期覆盖外不默认为平日。[香港公众假期数据](https://data.gov.hk/en-data/dataset/hk-dpo-statistic-cal)

## 4. 码头附近查询与富裕小轮

本次下载运输署 JSON_FERRY.json，得到 260 个 WGS84 Point 停靠记录，含 routeId、routeSeq、stopSeq、stopId 和上落客字段。GeoJSON 的坐标序是经度、纬度，转换成 app 的 latitude / longitude。按官方线路及具体登船泊位显式交叉核对，近岸并同名不足以映射。HKKF 路向使用 §2 中的码头 ID 和营办商参考点。新渡轮可从下列运输署路线及码头起步。[运输署 GeoJSON](https://data.gov.hk/en-data/dataset/hk-td-tis_23-routes-fares-geojson) · [静态原始文件](https://static.data.gov.hk/td/routes-fares-geojson/JSON_FERRY.json) · [运营商与登船泊位](https://www.td.gov.hk/en/transport_in_hong_kong/public_transport/ferries/service_details/index.html)

| 新渡轮航线／方向示例 | 运输署 routeId／stopId |
| --- | --- |
| 中環5號↔長洲（CECC／CCCE） | 7005／101102↔101101 |
| 中環6號東泊位↔梅窩（CEMW／MWCE） | 7006／101108:東↔101107 |
| 北角西↔紅磡北（NPHH／HHNP） | 7019／101110↔101111 |
| 北角西↔九龍城（NPKC／KCNP） | 7020／101110↔101112 |
| 横水渡双向与支线 | 主路径 7015 的码头为 101109 坪洲、101107 梅窩、101115 芝麻灣、101101 長洲；7000008、7000009 为不同站序变体。保留方向、站序和航段。 |

101108 的东西泊位共享源坐标，使用经过验证的泊位后缀保持身份，中環6號 HKKF 使用西泊位。北角东 101349、北角西 101110 与红磡南／北分别建键。有参考坐标但未定位到实际入口时，显示「码头参考点直线距离」。附近按上船位置分组及排序，河海跨水直线距离不代表步行可达或班次正在开行。未知坐标可留在搜索与官方链接中，无需远程定位请求。

**富裕小轮。** 编目中的 2022 官方规范索引列 GET /eta/?route={route_code}、CLHH／HHCL、NPKT／KTNP 及其他分段和 WATERTAXI。实测 `?route=CLHH` 与 `?route=WATERTAXI` 都为 Cloudflare HTTP 403、HTML、no-store；不重试、不更换身份、不绕过拦截。规范未列 Key／登记；访问政策仍须营办商确认。营办商 CentralHHTimetable_eng.csv、NPKTTimetable_eng.csv 同样 403。运输署替代静态源实际 GET 为 200，例如 `ferry_c_hh_timetable_eng.csv` 的 `Hung Hom to Central, …, 7:30 a.m.`；`ferry_tm_tc_slw_to_timetable_eng.csv` 使用 Service Date／Bound／From／Time／Remarks 五列。运输署编号 7059 对应中環8號西泊位↔紅磡南站，7021、7056 有北角東和觀塘／啟德的不同停靠，须逐段联结有效班次。静态资料技术上可取得，MVP 暂缓富裕小轮正式上架，直到访问、权利和实现范围确定。[有效参数规范索引](https://www.hongkongwatertaxi.com.hk/csv/Watertaxi_FortuneFerry_ETA_API_Specification_and_Data_Dictionary.pdf) · [运输署中环红磡 CSV](https://www.td.gov.hk/datagovhk_td/ferry-tt-ft/resources/en/ferry_c_hh_timetable_eng.csv) · [运输署屯门大澳 CSV](https://www.td.gov.hk/datagovhk_td/ferry-tt-ft/resources/en/ferry_tm_tc_slw_to_timetable_eng.csv) · [营办商天气安排](https://www.fortuneferry.com.hk/en/home/weather_arrangements)

## 5. 统一类型草案

下面是 4B1 类型契约草案，保存在报告供编码使用。键不依赖翻译、地理坐标、班次时间或供应商排序。

~~~ts
type OperatorId = 'hkkf' | 'sunFerry' | 'fortuneFerry'
type LocalizedName = { 'zh-HK': string; en: string }
type DateHK = string & { readonly localDateHK: unique symbol }
type MinuteOfDay = number & { readonly minuteOfDay: unique symbol }
type Instant = number & { readonly unixMilliseconds: unique symbol }
type PierId = string
type DirectionKey = { operatorId: OperatorId; routeId: string; directionId: string }
type SourceKind = 'operatorCatalogue' | 'operatorTimetable' | 'operatorLive'
  | 'operatorFare' | 'governmentSpatial' | 'governmentTimetable' | 'governmentCalendar'
type SourceRef = { kind: SourceKind; url: string; recordKey: string; updatedAt?: Instant; fetchedAt: Instant }
type Freshness = { state: 'fresh' | 'stale' | 'unknown'; measuredAt?: Instant; expiresAt?: Instant }

type FerryPier = {
  pierId: PierId
  name: LocalizedName
  coordinate?: { latitude: number; longitude: number; type: 'pierReference' | 'boardingEntrance' }
  source: readonly SourceRef[]
}
type FerryDirection = DirectionKey & {
  name: LocalizedName
  originPierId: PierId
  destinationPierId: PierId
  stops: readonly { pierId: PierId; stopSequence: number; pickup: boolean; dropoff: boolean }[]
  source: readonly SourceRef[]
}
type ServiceCalendar = {
  id: string
  validFrom?: DateHK
  validThrough?: DateHK
  daysFromMonday: readonly [boolean, boolean, boolean, boolean, boolean, boolean, boolean]
  publicHoliday: 'required' | 'excluded' | 'any'
  addedDates: readonly DateHK[]
  removedDates: readonly DateHK[]
  source: SourceRef
}
type ServiceTime = { minuteOfDay: MinuteOfDay; dayOffset: 0 | 1 }
type VesselType = 'ordinary' | 'fast'
type Timetable = {
  id: string
  direction: DirectionKey
  calendarId: string
  stopSequence: number
  scheduledDeparture: ServiceTime
  scheduledArrival?: ServiceTime
  vesselType?: VesselType
  conditional: boolean
  notes?: LocalizedName
  source: SourceRef
  freshness: Freshness
}
type Fare = {
  direction?: DirectionKey
  route: Pick<DirectionKey, 'operatorId' | 'routeId'>
  fromPierId?: PierId
  toPierId?: PierId
  calendarId?: string
  product: 'single' | 'return' | 'pass' | 'other'
  passenger: string
  hkdCents: number
  vesselType?: VesselType
  cabin?: 'ordinary' | 'deluxe'
  source: SourceRef
}
type FerryTime =
  | { kind: 'scheduledDeparture'; pierId: PierId; at: Instant; source: SourceRef }
  | { kind: 'scheduledArrival'; pierId: PierId; at: Instant; source: SourceRef }
  | { kind: 'liveArrival'; pierId: PierId; at: Instant; generatedAt: Instant; source: SourceRef; freshness: Freshness }

type FerryEtaReading =
  | { kind: 'ready'; arrivals: readonly Extract<FerryTime, { kind: 'liveArrival' }>[] }
  | { kind: 'empty' | 'unsupported' | 'ambiguousTime' | 'stale' | 'timeout'
    | 'network' | 'invalidResponse' | 'cancelled' | 'rateLimited' }
  | { kind: 'http'; status: number }

type FerryEtaSample = {
  payload: FerryEtaReading
  receivedAt: { wall: number; monotonic: number }
  serverNow: number
  retryAt: number
}
type FerrySnapshot = {
  version: string
  piers: readonly FerryPier[]
  directions: readonly FerryDirection[]
  calendars: readonly ServiceCalendar[]
  timetable: readonly Timetable[]
  fares: readonly Fare[]
  sources: readonly SourceRef[]
}
interface FerryAdapter {
  readonly operatorId: OperatorId
  readEta?(direction: DirectionKey, signal?: AbortSignal): Promise<FerryEtaSample>
}
~~~

码头索引以经过来源验证的实体／泊位键关联，每家独立保存上游码头 ID。规范化路向使用 operatorId＋routeId＋directionId；横水渡等保留官方分段或有出处的变体。静态班次保留文件确有提供的抵达时间，缺省时留空。票价必须先核实有效时段、票种和限定，未知或冲突时显示官方入口。所有时间模型在 UI 绑定明确标签。

## 6. 接入架构、性能和权利

- **独立 Adapter。** HKKF 以 route_id/direction、ISO ETA 及列表式 CSV 为主，Sun Ferry 以方向代码、多个船型或航段、逐行 CSV 和日期可能缺失的 ETA 为主。Fortune 暂无运行时 Adapter。各自校验原结构、转同一领域类型及来源元数据。静态目录可由纯转换函数构建统一 JSON；不把一家的日型、表头、码头或退避错误套给另一家。
- **离线与附近。** 复用 4A1C 版本化生成与离线索引的做法。构建保存官方 URL、取样时间、源版本、有效期、SHA-256、覆盖与异常；验证 route/direction/stop、泊位、两语言和例外，失败保留上次通过的文件。版本随发布更新，可先建议每周及营办商公告后重建核对；正式有效期优先，过期只保留目录与官方链接。码头采用现有 Haversine、500／1,000／2,000 米、手动参考点及直线语义。App 打开附近或搜索时无需批量调用官网。 [小巴索引先例](./PHASE-4A1C-GMB-NEARBY.md) · [距离函数](../src/nearby-bus-data.ts)
- **实时及退避。** 复用现有单调时钟、来源新鲜度和前台焦点行为；渡轮以单营办商＋路向共享在途请求及短缓存。HKKF 起步值建议每方向至少 60 秒刷新间隔，8 秒总时限覆盖正文，默认 60 秒退避并遵守 Retry-After，初始预报时效 120 秒。仅在展开相应方向且前台时请求。结合时标、Date/Age 和当前绝对 ETA 判断，过期、错误、HTTP 403、429、无数据与已确认停航分别呈现。符合 403 阻塞条件则停用提供者，不自动重试。三个时态不互为替代；抵达倒计时只对通过验证的 Live ETA，计划开航用于乘船选择。 [现有读数与时钟](../src/next-train-time.ts) · [前台机制](../src/next-train-hooks.ts) · [总时限和读数契约先例](../src/gmb-client.ts)
- **统一搜索及收藏。** 在现有 transportSearchSources 注册渡轮路线／码头，使用带营办商命名空间的稳定键，检索营办商、双语地名、别名及具体码头。详情通过 operatorId、routeId、directionId 进入。将来收藏的稳定身份至少加入上船 pierId，横水渡保留分段身份。SQLite v10 的 mode 白名单、pin 外键／删除联动及共用三个位置均留到另行批准的 forward migration。 [搜索注册表](../src/global-search.ts) · [统一路由](../src/global-search-navigation.ts) · [现有 SQLite](../src/database.ts)

| 数据权属及来源 | 第三方启用、离线、频率及署名结论 |
| --- | --- |
| HKKF · Hong Kong & Kowloon Ferry Limited，DATA.GOV.HK 营办商数据集及 hkkfeta.com | 政府目录有附条件再利用依据。营办商数字服务条款第 13 条要求复制、衍生及分发内容取得书面同意，且可能限制访问。尚未确认对开放 API 域名的适用范围或是否有授权豁免。公开发布前确认设备端访问、离线打包、缓存期限及请求频率的书面允许，署名 HKKF 及 DATA.GOV.HK。目录的每分钟更新是数据频率，数值配额待确认。[HKKF 条款](https://hkkf.com.hk/en/hkkf-digital-services-terms-and-privacy-policy/) |
| Sun Ferry · Sun Ferry Services Company Limited，DATA.GOV.HK CSV 与 ETA 及 sunferry.com.hk | 其网站声明允许个人非商业打印单页，开放资源授权边界另核。CSV 离线分发、商业 App 显示及设备端实时轮询均待确认。公开署名营办商及 DATA.GOV.HK。实测 HTTP 缓存头不等于授权或 SLA；配额及保存期限待确认。[Sun Ferry 网站声明](https://www.sunferry.com.hk/en/privacy-policy-and-disclaimer) |
| Fortune Ferry · Fortune Ferry Company Limited，DATA.GOV.HK 营办商资源及 hongkongwatertaxi.com.hk | 营办商直链 403。第三方访问、鉴权、缓存、商用、离线分发均待服务方确认。政府 CSV 独立评估其来源权利和署名。暂不引入营办商数据，不将试跑可达性当作许可。[营办商数据目录](https://data.gov.hk/en-data/dataset/ff-fortune-schedule1) |
| 香港特区政府／运输署和 1823，公开码头地理、静态 CSV、公众假期 | 平台条款允许符合条件的商业及非商业再利用，包括分发，要求标识来源及知识产权、署名并承担列明的义务。逐资源核对例外和第三方权利。离线包内和 App 来源页保留政府、提供者与 DATA.GOV.HK 署名。[DATA.GOV.HK 条款](https://data.gov.hk/en/terms-and-conditions) |

Apple 5.2.2 要求第三方服务与内容具备适用授权，可能索取依据。保留营办商答复或适用条款及快照来源。静态许可和运行时接口许可分别复核，当前报告不构成上线授权。[App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/#intellectual-property)

## 7. Phase 4B1 编码任务与验收

| 顺序 | 编码任务 | 验收 |
| --- | --- | --- |
| 1 | 建 Ferry 类型、来源契约、HKKF 与 Sun Ferry 静态转换器，写固定样本。 | HKKF 4 条线、6 个码头、8 个路向键可复现。用实测的全部 16 列、324 个时分验证映射。字段冲突阻止受影响方向替换。安全解析 BOM、引号列表、条件符号、HTML 备注及错 MIME JSON。 |
| 2 | 建已确认的码头索引、服务日表、计划开航与可选计划抵达。 | 东西泊位与南北红磡不合并，半径边界及排序正确。测试平日、星期六、星期日、补假、明确 dayOffset 的凌晨尾班及不明规则。Sun Ferry 梅窝差异隔离，横水渡保留真实停靠变体。 |
| 3 | 授权后接 HKKF ETA 试点和已审核的静态目录。Sun ETA 先写诊断解析与禁用门槛。 | 正向、反向、空、错方向、过期、429／403、超时与并发取消达标。Sun 的 HH:mm、null、NPHH 08:23 及午夜不明样本不显示倒计时。票价冲突不选默认数值。 |
| 4 | 接入现有搜索及路线／码头详情，并提供双语来源与官方公告入口。 | 计划开航、计划抵达及实时抵达语义可辨。离线能看已核定的站点及有效时刻表，定位拒绝或搜索时无多余实时请求。巴士、港铁、轻铁及小巴回归通过。收藏及 SQLite v10 另批。 |

定向验证包括 8 个港九小轮方向键、3 个非空 ETA、5 个新渡轮响应、6 个富裕小轮 403 样本及香港时区跨日计算。报告类型草案及项目 TypeScript 均通过，另通过 Markdown 相对链接和空白检查。

4B0 只新增本文件。对公开源做有界 GET，未更改生产 App、数据库及依赖，未启动模拟器、创建构建、提交或推送 Git。
