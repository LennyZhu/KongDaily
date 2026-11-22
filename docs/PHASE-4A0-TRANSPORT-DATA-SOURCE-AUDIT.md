# Phase 4A0 · 交通数据源与架构审计

2026-11-22（香港时间）。审计基线为 develop 的 6b88b8f，与本地 origin/develop 引用相差 0／0，开工时工作区干净。依据 [1.2.0 PRD](./KONGDAILY_1_2_0_PRD.md) 的 UX-03-03，**建议先进入绿小巴 4A1，渡轮分营办商逐步验证，电车先做静态查询。** 绿小巴发布前仍须验证全量目录和再利用条件。电车的第三方实时 ETA 接入仍阻塞。

**实测**指本轮只读 GET 或实际文件检查。**文档**指官方说明。**待确认**指样本不足、来源不一致或适用授权未确认。一组成功响应只证明该样本。

## 1. 官方数据源矩阵

| 来源 | 字段与覆盖 | 验证及使用条件 |
| --- | --- | --- |
| 运输署绿小巴 | 港岛、九龙、新界的编号、营运变体、线向、站序、站点坐标及 ETA。目录列 ETA 每分钟更新，其他数据按需更新。 | **实测**跨区同号、双向、循环重复站、WGS84、有效预报、计划班次、空列表、HTTP 500。**待确认**每站实时覆盖、数值配额、ID 退役规则。平台条款提供有条件的商用及再分发依据，核实来源特定条件并署名香港特区政府／运输署／DATA.GOV.HK。[官方目录](https://data.gov.hk/en-data/dataset/hk-td-sm_7-real-time-arrival-data-of-gmb) · [API v1.1](https://data.etagmb.gov.hk/static/GMB_ETA_API_Specification.pdf) |
| 运输署渡轮静态资源 | 码头坐标 STOP_ID/X/Y、路线与站序 ROUTE_ID/ROUTE_SEQ/STOP_SEQ/STOP_ID 和多语站名。服务详情有营办商、上船地点、班次和票价。 | **实测**11 月 18 日 XML 中 273 次停靠引用的 72 个站点 ID 全部连上坐标。**待确认**泊位与各营办商 ETA 服务的对应。运输署公开数据按平台条件署名。网页适合交叉核对，复制网页内容须另核条款。[码头 XML](https://static.data.gov.hk/td/routes-fares-xml/STOP_FERRY.xml) · [站序 XML](https://static.data.gov.hk/td/routes-fares-xml/RSTOP_FERRY.xml) · [渡轮服务详情](https://www.td.gov.hk/en/transport_in_hong_kong/public_transport/ferries/service_details/index.html) |
| 港九小轮 HKKF | 4 条航线，规范列 6 个码头。站点、航线、航行中渡轮预计抵达为 JSON，按方向的静态班次和票价为 CSV。 | **实测**航线目录、码头坐标、实际 ETA、班次与票价。班次方向与起讫港字段有冲突。权利人为 Hong Kong & Kowloon Ferry Limited。发布前核对外部 API、缓存及离线分发条件并署名。[官方目录](https://data.gov.hk/en-data/dataset/hkkf-hkkfdata-hkkf-eta-data) · [接口规范](https://www.hkkfeta.com/datagovhk/HKKF_ETA_API_Specification.pdf) · [数据字典](https://www.hkkfeta.com/datagovhk/HKKF_ETA_Data_Dictionary.pdf) |
| 新渡轮 Sun Ferry | **文档**方向码覆盖中环↔长洲、中环↔梅窝、北角↔红磡、北角↔九龙城及横水渡分段。预计抵达按航程查询。静态码头、班次、票价来源另见运输署及营办商。 | **实测**中环↔长洲双向返回变体及无日期的 ETA。**待确认**覆盖、跨日、变体及权限。规范直连 HTTP 404，仍查阅到已索引的营办商 PDF。权利人为 Sun Ferry Services Company Limited，须核实接口访问／缓存及静态资料复用，保留署名。[官方目录](https://data.gov.hk/en-data/dataset/sunferry-eta-eta) · [官方规范](https://www.sunferry.com.hk/eta/SunFerry_ETA_API_Specification_and_Data_Dictionary.pdf) · [营办商班次与票价](https://www.sunferry.com.hk/en/route-and-fare/timetable) |
| 富裕小轮及香港水上的士 | 营办商列中环↔红磡、北角↔启德↔观塘、屯门↔东涌↔沙螺湾↔大澳，以及水上的士。运输署可核对码头、计划班次及票价。两份 ETA 资源均指向带 route 参数的 JSON 服务。 | **实测**官方字典和 ETA 基础路径均返回 HTTP 403／HTML。本轮无有效路线代码样本。**待确认**有效代码及每条线的覆盖、字段、时刻语义。权利人为 Fortune Ferry Company Limited，须确认可稳定访问及复用后再上线实时。[富裕小轮 ETA](https://data.gov.hk/en-data/dataset/ff-fortune-schedule2) · [水上的士 ETA](https://data.gov.hk/en-data/dataset/ff-watertaxi-schedule2) · [营办商覆盖](https://www.fortuneferry.com.hk/index.php/en/home/about_us) |
| 香港电车公司静态资料 | 站表有方向、站牌号和站名，另有主线路资料。营办商列六条主线路。 | **实测**英文 CSV 共 120 行，有东、西、南、北四种方向及多个重复的总站代码 T。**待确认**繁中 CSV 及跨来源映射。适用 DATA.GOV.HK 条款时署名香港电车公司及平台，并核对营办商补充条件。[站表目录](https://data.gov.hk/en-data/dataset/hktramways-hktramways-tram-stops) · [英文 CSV](https://static.data.gov.hk/tramways/datasets/tram_stops/summary_tram_stops_en.csv) · [主线路](https://data.gov.hk/en-data/dataset/hktramways-hktramways-main-routes) · [班次与票价](https://www.hktramways.com/en/schedules-fares/) |
| 运输署电车空间数据 | 电车坐标、方向、路线与站序、三语站名。另有路线 GeoJSON。 | **实测**11 月 18 日 XML 有 117 个坐标记录、427 次停靠、12 个线路＋线向组合，117 个唯一站序站点均连上坐标。**待确认**转换抽查、站牌号映射。空间 XML 的 X/Y 为香港 1980 方格网，导入时转 WGS84，按运输署资料署名。[坐标](https://static.data.gov.hk/td/routes-fares-xml/STOP_TRAM.xml) · [站序](https://static.data.gov.hk/td/routes-fares-xml/RSTOP_TRAM.xml) · [路线](https://static.data.gov.hk/td/routes-fares-geojson/JSON_TRAM.json) · [XML 规范](https://static.data.gov.hk/td/routes-fares-xml/dataspec/ptroutefare_xml_dataspec.pdf) |
| 香港电车公司实时资讯 | **文档**官方 App 提供接下来三班电车的预计到达及目的地。营办商曾公布与 Moovit 合作。 | **待确认／阻塞**未找到可供 KongDaily 使用的第三方 ETA 规范、访问条件、配额或书面授权。须由营办商确认授权后再接入。[官方 App 公告](https://www.hktramways.com/media/files/press-releases/20260414_Press%20Release_Hong%20Kong%20Tramways%20Unveils%20Official%20Mobile%20App.pdf) · [Moovit 合作公告](https://www.hktramways.com/media/files/press-releases/20180129%20HK%20Tramways%20x%20Moovit%20Press%20Release_EN.pdf) |

**非官方资料**。社区项目记录了按方向和站牌查询的旧网站及手机后端技术形态。本轮只阅读文档。其发布许可与上游数据授权独立，生产候选仅使用官方数据及获授权接口。[旧版社区文档](https://github.com/hongkongkiwi/node-hongkong-trams) · [手机后端社区文档](https://github.com/ByteLandTechnology/hktramways-openapi)

## 2. 绿小巴只读实测

香港时间 22:01–22:07，针对 [官方主机](https://data.etagmb.gov.hk/route) 做有限单次 GET，单次设置 10–12 秒总超时。路径可用 curl 重查。结果会随班次变化。

| GET 路径 | 实际响应 |
| --- | --- |
| /route | HTTP 200，data.routes.HKI/KLN/NT 分别 107／133／332 个显示编号。三区均有 2、3、20M 等编号。变体数量另计。 |
| /route/HKI/2、/route/KLN/2、/route/NT/2 | HTTP 200。港岛 2006474 为正常循环线、2006475 为早班变体。九龙 2009246 有 route_seq 1／2，黄埔花园↔又一城。新界 2002342 为西贡↔蚝涌，另有短程 2002344、特别班次 2002349。返回 route_id、地区、编号、方向、三语起讫站、备注、headways（包含日型、时段及班距）和 data_timestamp。 |
| /route-stop/2006474/1、/stop-route/20014492 | HTTP 200。香港站小巴总站 stop_id 20014492 同时出现于站序 1、11。反查共 14 条停靠记录，保留这两次停靠。 |
| /route-stop/2009246/1、/route-stop/2009246/2、/route-stop/2002342/2 | HTTP 200，分别 26、22、4 次停靠。站序行包含 stop_id、stop_seq、name_tc/sc/en，双向停站数可不同。 |
| /stop/20000418 | HTTP 200，黄埔花园公共运输交汇处 WGS84 约 22.305158,114.190888，另有 hk80、enabled、三语备注和 data_timestamp。站名来自站序或反查资源。 |
| /eta/route-stop/2009246/1/1、/eta/route-stop/2009246/2/1 | HTTP 200，分别对应 20000418 与 20013966。22:03 左右各得 2／3 项，第一项为 22:10／22:20，备注为未開出／Scheduled。中途站 /eta/route-stop/2009246/1/8 也出现 Scheduled。 |
| /eta/stop/20000418 | HTTP 200，6 个停靠上下文。2009246/2/22 有无计划备注的时间与 Scheduled 班次。生成时间 22:03:11，响应头 Age 为 11 秒。 |
| /eta/route-stop/2006474/1/1、/eta/route-stop/2006474/1/11、/eta/route-stop/2002342/2/1 | HTTP 200，enabled 为 true，eta 为空数组，查询成功且当前无预报。 |
| /eta/route-stop/2009246/1/9999 | 无效站序返回 HTTP 500，正文为 {"code":500,"message":"ETA unavailable"}。 |
| /last-update/ | HTTP 200，data 为空对象。另有分项更新端点。本轮未测分项；总表缺日期时保留已验证快照。[官方更新资源](https://data.gov.hk/en-data/dataset/hk-td-sm_7-real-time-arrival-data-of-gmb/resource/761e387b-cdbd-4917-a3de-b1505b4f0e45) |

站级预报摘录，原 generated_timestamp 为 2026-11-22T22:03:11.388+08:00。

~~~json
{
  "route_id": 2009246,
  "route_seq": 2,
  "stop_seq": 22,
  "enabled": true,
  "eta": [
    {"eta_seq": 1, "diff": 13, "timestamp": "2026-11-22T22:16:21.076+08:00", "remarks_en": null},
    {"eta_seq": 2, "diff": 38, "timestamp": "2026-11-22T22:40:43.818+08:00", "remarks_en": "Scheduled"}
  ]
}
~~~

用 region＋route_code 做展示分组，route_id＋route_seq 标识线向，加入 stop_seq 标识具体停靠，stop_id 标识物理站点并用于交叉验证。方向和变体均由发布方明确提供。未来保存收藏时同时保留 stop_id，数据更新后如站序已指向其他站，将原记录标为待重新选择。全港搜索索引路线编号、地区、繁中／英文站名及终点，结果保留营运变体。附近查询按站点 WGS84 计算。

按照绝对 timestamp、生成时间、响应年龄和收到时间判定时效，diff 用于辅助核对。保留来源备注，Scheduled 单独标为计划班次。首站需核实预计开出与到站语义。**文档**另有 enabled:false 及停用说明，按 (route_id, stop_id) 查询也可能返回多个停靠。**待确认**停用实况及数值配额，本轮未触发 429。按目录的每分钟更新频率设客户端初始刷新策略，避免从成功样本推定单站覆盖或 SLA。[官方规范](https://data.etagmb.gov.hk/static/GMB_ETA_API_Specification.pdf)

## 3. 渡轮时间与营运例外

- **港九小轮实测**。/opendata/route 当前列 1 中环↔索罟湾、2 中环↔榕树湾、3 中环↔坪洲、4 坪洲↔喜灵洲。/opendata/pier/3 返回榕树湾码头约 22.22652,114.109105。响应头为 text/html，正文为 JSON。缺码头 ID 时 HTTP 422。/opendata/eta/3/inbound HTTP 200，生成于 22:05:13，date 为 2026-11-22，session_time 为 22:00:00，ETA 为 2026-11-22T22:25:00+08:00。班次时刻与目的港抵达预报分别显示。
- **港九小轮方向冲突**。/opendata/time_table/1/inbound 与 /outbound 的 CSV 分别从 06:40、07:20 开始，但均把中环填为起点、索罟湾填为终点。规范及营办商班次表所示 06:40 由索罟湾开出。逐线逐向交叉确认后才显示时间。CSV 有 BOM、分日型列表、选开与尾班标记、HTML 备注，须按白名单解析为纯文本。/opendata/fare_table/1 实测按票种及日型列价，套餐行可能只有一列价格。[接口规范](https://www.hkkfeta.com/datagovhk/HKKF_ETA_API_Specification.pdf) · [营办商班次对照 PDF](https://hkkf.com.hk/wp-content/uploads/2025/08/2021_2026-HKKF-Fare-Timetable_revised_SKW-0640_Coloured.pdf)
- **新渡轮实测**。/eta/?route=CECC HTTP 200 返回 CECC 与 CECCH，首行 depart_time 为 21:30，eta 为 22:20，date_timestamp 为 2026-11-22T22:05:07+08:00。反向 CCCE 返回 CCCE 与 CCCEH。实测 v1.1 还有船只代码、lat/lng、备注；规范示例为 ISO ETA 且记录时标名为 data_timestamp。须核实午夜所属服务日、变体、空值以及定位字段含义；未确认的时间不生成倒计时。计划开航用对应日型时刻表。[官方规范](https://www.sunferry.com.hk/eta/SunFerry_ETA_API_Specification_and_Data_Dictionary.pdf)
- **富裕小轮实测边界**。公开字典和 ETA 基础路径返回 Cloudflare 403，未取得有效 route 值，无法据此判定任何具体航线的实时可用性。待营办商提供合法访问方式、有效参数和样本。[官方字典入口](https://www.hongkongwatertaxi.com.hk/csv/Watertaxi_FortuneFerry_ETA_API_Specification_and_Data_Dictionary.pdf)
- **节假日与停航**。按香港服务日处理午夜、周末及公众假期，保留指定日、选开、临时替船信息。港九小轮发布航班调整，新渡轮有替船及横水渡调整，富裕小轮可能因天气、海况或交通调整及停航。尚未验证统一或完备的机器可读通知覆盖。保留来源日期和营办商公告入口，只有明确适用范围和有效期的官方通知才能标记停航。预计到达、预计开出、计划开航、预报不可用分别呈现。抵达目的港的预报不可用作上船倒计时。[港九小轮公告](https://hkkf.com.hk/en/) · [新渡轮横水渡](https://www.sunferry.com.hk/en/route-and-fare/timetable?route=inter-islands) · [富裕小轮天气安排](https://www.fortuneferry.com.hk/en/home/weather_arrangements)

## 4. KongDaily 最小接入

| 当前代码 | 接入建议 |
| --- | --- |
| [统一搜索](../src/global-search.ts) 的 transportSearchSources 与 [搜索导航](../src/global-search-navigation.ts) | 每个数据源加薄适配器、结果类型、稳定键和详情跳转。复用既有双语匹配、排序和分组。渡轮服务键携带营办商与线路／方向，码头保持泊位身份。电车用运输署线路＋线向与站点 ID，站牌号通过显式映射补充，T 并不唯一。电车同向共用路段，目的地及支线决定实际停靠，按官方站序匹配。 |
| [交通入口](../src/app/transport.tsx)、[附近](../src/app/bus/nearby.tsx)、[交通控件](../src/components/transport-ui.tsx)、[附近铁路](../src/nearby-railway.ts) | 已有 minibus、ferry、tram 模式标签和图标。复用定位／手动地点、500／1000／2000 米、滚动恢复与 [Haversine](../src/nearby-bus-data.ts)。在设备上以 WGS84 离线计算至车站或上船参考点的直线距离。坐标无法确认时保留搜索与详情，跳过附近排序。附近与搜索不扇出 ETA 请求。 |
| [巴士数据](../src/bus-data.ts)、[巴士 ETA 生命周期](../src/bus-eta-hooks.ts)、[铁路请求](../src/next-train-client.ts)、[铁路生命周期](../src/next-train-hooks.ts) | 巴士已有 20 秒超时、60 秒轮询、10 秒手动冷却。铁路已有 8 秒超时、20 秒短缓存／在途合并、429 退避、[60 秒时效](../src/next-train-time.ts)。复用生命周期机制或薄包装，按提供者独立实例及解析器配置，避免一方限流拖累其他交通。 |
| [港铁详情](../src/app/mtr/[kind].tsx)、[轻铁详情](../src/app/light-rail/[kind].tsx)、[i18n](../src/i18n.ts) | 沿用站序、站点详情、来源和状态的组件模式。提供 zh-HK／English 的 Estimated arrival、Estimated departure、Scheduled departure、暂无班次、停用、网络失败、离线、过期和限流提示。先验证所选停靠再请求，过期记录不显示当前倒计时。 |
| [SQLite v10](../src/database.ts)、[铁路收藏](../src/railway-favorites.ts)、[首页共享置顶](../src/home-transport-pins.ts) | 现有巴士 source、铁路 mode、置顶 mode 均有明确 CHECK。置顶位置 1–3，收藏删除时触发清理。目录、搜索、附近、详情、ETA **无需迁移**。新增收藏和置顶获批后用 forward migration 扩展服务身份和置顶关联，维持全局三席、旧顺序、删除联动及备份／恢复。 |

建议构建版本化离线目录，保存来源、采集时间、源更新时间、SHA-256、计数和未匹配清单。采集失败、异常缩水或身份冲突时保留已有版本。优先使用绿小巴站级 ETA 合并同站多个上下文，按 route_id／route_seq／stop_seq 严格过滤。仅一处停靠时可以使用精确接口，优先复用已有合格站级缓存。绿小巴前台刷新初始不快于 60 秒，手动刷新共享冷却与在途请求，限制并发。按 Retry-After 或至少现有 60 秒默认值退避，结合源时间及缓存年龄判断过期。只有页面聚焦且 App 前台时刷新，失焦／后台停刷，忽略过时回调。用户坐标留在设备端，官方实时请求只带必要的站点或服务 ID。

## 5. 权限和发布风险

- DATA.GOV.HK 条款 v1.2 允许符合条件的数据商用及再分发，要求明确来源、承认政府及相应权利人并给予署名，含赔偿条件。外部网站适用其自身条款，需分别核对。为每个离线包、接口及适用更新保留许可证据，在资源清单和 App 来源页加双语署名。[DATA.GOV.HK 条款](https://data.gov.hk/en/terms-and-conditions)
- Apple 5.2.2 要求第三方服务及内容的使用符合第三方服务条款，可能要求出示授权。绿小巴可继续开发，正式发布前由负责人核实平台条款是否覆盖离线再分发及设备端访问，向营办商核查外部接口、访问频率、缓存、保留及署名条件。电车实时仍缺明确第三方授权。[Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/#intellectual-property)
- 主要技术风险为同号变体、重复停站、源数据延迟、渡轮方向冲突、资料格式变动及不完整的临时停航覆盖。将真实样本和人工核对结果用作回归证据。发布前确认官方服务网络日志与保留范围，并按实际调用更新隐私披露。

## 6. 建议 1.2.0 范围与 4A1 拆分

| 阶段 | 推荐范围 |
| --- | --- |
| 4A | 绿小巴官方目录、路线及车站详情、附近、两处统一搜索。只在核实的停靠范围显示官方 ETA，并区分计划班次。 |
| 4B | 先做已核对的航线、码头、静态时刻表和公告入口。HKKF 作为 ETA 首选试点，先逐向解决冲突并确认条款。Sun Ferry 待核实格式、午夜、变体及条件。Fortune／水上的士待有效参数、访问和覆盖核实。票价先链接官方票表，待日型、优惠和有效期可准确呈现后展示。 |
| 4C | 以运输署静态资料做主线路、站序、附近及搜索。保留方向与官方总站，验证重复站牌号及跨来源映射。电车 ETA 暂缓，待获得授权接口。 |
| 后续另批 | 新三类收藏和首页置顶仍可基于稳定键扩展，当前不纳入 MVP。暂缓全港渡轮实时覆盖、自动推断停航及新增后端。 |

1. **采集**。核对运输署静态采集方式、现行条款、请求配额及 ID 变更政策。建立三区版本化快照，验证变体、线向、循环停靠、坐标区域及缺失项。
2. **查询**。接入统一搜索和附近列表，重点验收三区同号、双语终点、重复站序及 500／1000／2000 米。验证离线搜索、位置拒绝／手动地点及旧交通结果。
3. **详情与预报**。实现官方 ETA 适配、详情导航和来源文案。用真实样本验证预报、Scheduled、空数组和 HTTP 500，用模拟响应验证停用、格式异常、超时、过期、429、前后台恢复、并发合并与旧请求隔离。
4. **发布前验证**。补验三区、多方向和无预报的 iPhone 样本，回归巴士及两铁的搜索、附近、详情、收藏和首页置顶。

**需人工决定**。确定 4A1 首批范围和目录更新责任；安排与各营办商核实访问、署名及数据保留条款；确认是否接受 4B／4C 静态优先以及何时增加新交通收藏与置顶。

## 7. 验证与 Git

- 官方接口已验证绿小巴目录、跨区重号、站序、坐标、反查、ETA 及异常。已抽查 HKKF 和 Sun Ferry 有效响应、Fortune 访问障碍、运输署渡轮及电车站序与坐标联结。
- npm run typecheck 通过。运行 node --test scripts/test-global-search*.cjs scripts/test-mtr-next-train.cjs scripts/test-nearby-bus-location.cjs scripts/test-facility-favorites.cjs，79 项通过，覆盖搜索、导航、铁路请求生命周期、附近与定位、SQLite v10 及首页共享置顶。
- Git 工作区只有此未跟踪报告。现有文件与提交保持原状。git diff --check 及新报告的独立空白检查通过。
