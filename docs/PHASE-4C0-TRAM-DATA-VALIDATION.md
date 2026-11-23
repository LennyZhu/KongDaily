# Phase 4C0 · 香港电车官方数据复核与实施方案

**结论（2026-11-23 香港时间）**　运输署快照有 6 条路线、12 个方向、117 个站点 ID、427 条停靠记录，足以开展静态数据层、双语搜索和附近查询。**石塘咀总站仍在静态快照，但营办商公告列为关闭，附近上车推荐须先处理临时安排。** 实时 ETA 缺少获授权的第三方接口，本轮仅核实营办商面向乘客的实时能力。 [运输署数据目录](https://data.gov.hk/en-data/dataset/hk-td-tis_14-routes-fares-xml) · [石塘咀服务公告](https://www.hktramways.com/en/service-updates-detail/141/en/press-releases)

## 1. 来源与快照

以下官方数据在 2026-11-23 10:29–10:30 HKT 实际下载，均成功读取。三份 XML 的 HTTP 文件修改时间为 2026-11-18 11:03 UTC 左右。XML 根节点 `generated` 为当地时间格式、未带时区。目录标示每月更新两次，路线资源页标示 2026-11-19 更新。根节点、HTTP 元数据、资源页发布日期和每行 `LAST_UPDATE_DATE` 分别记录。 [数据目录](https://data.gov.hk/en-data/dataset/hk-td-tis_14-routes-fares-xml) · [路线资源更新时间](https://data.gov.hk/en-data/dataset/hk-td-tis_14-routes-fares-xml/resource/c90ea742-7044-4262-9e61-05d5eb1fe2a7)

| 实测来源 | 内容及版本依据 | SHA-256 |
| --- | --- | --- |
| [ROUTE_TRAM.xml](https://static.data.gov.hk/td/routes-fares-xml/ROUTE_TRAM.xml) | 6 条路线，`generated=2026-11-18T13:39:58` | `311dc3f492d181c5d20eb99cbc90baa1d83e7a166ab4c90275b23a1af1e2d36d` |
| [RSTOP_TRAM.xml](https://static.data.gov.hk/td/routes-fares-xml/RSTOP_TRAM.xml) | 427 条停靠，`generated=2026-11-18T13:40:14` | `eba013a05842725038afea0092d671a893142e81b0316377a0f9ec78491066d5` |
| [STOP_TRAM.xml](https://static.data.gov.hk/td/routes-fares-xml/STOP_TRAM.xml) | 117 个坐标，`generated=2026-11-18T13:40:03` | `9b4a9d36dbd77fc01ac7ee6043f8047c1b248d7a0ed08e83abcc0fa90ee3c8bd` |
| [运输署 XML 字典](https://static.data.gov.hk/td/routes-fares-xml/dataspec/ptroutefare_xml_dataspec.pdf) | 文件标注 2026-07-06 | `f062d2bdb6cdc27705ea81028a300f8126554dad147e12e11eb9cb2ba3f8aa17` |
| [JSON_TRAM.json](https://static.data.gov.hk/td/routes-fares-geojson/JSON_TRAM.json) | 427 个停靠 Point，交叉核对用 | `529c8a2b00e6cc6e55281d65a482ed3490913d930c2ebdc911869239897fc780` |

4A0 的站序与坐标原始样本和本轮各自 SHA-256 相同，**117 个运输署站点与 4A0 一致**。本轮另下载营办商英文及繁中站表，均为 120 条、无完全重复行，各有西行 57、东行 54、南行 5、北行 4。两个资源页均标示 2021-04-17 更新，字段为行车方向、站牌号、站名，缺少运输署站点 ID 和坐标。每份有 8 条 `T`，其中西行四条、东行三条、南行一条，所以连「方向＋代号」也不能全局唯一。两套数据分属不同年份及标识口径，并已观察到营办商有仅下车站和车厂记录（如 `94W`、`D`）。尚无完整逐站交叉表，无法把 120 与 117 的差额逐条归因。保留全数 117 个经过运输署引用核验的站点，营办商站牌号仅作待审别名。 [4A0 审计](PHASE-4A0-TRANSPORT-DATA-SOURCE-AUDIT.md) · [营办商英文站表](https://data.gov.hk/en-data/dataset/hktramways-hktramways-tram-stops/resource/a69613a2-4a7d-4e21-8135-9cf4739be362) · [营办商繁中站表](https://data.gov.hk/en-data/dataset/hktramways-hktramways-tram-stops/resource/e4edb251-9a2a-4c4f-8cd1-0ff4bb85d139)

## 2. 关联、方向与站序

| 层级 | 官方键和字段 | 处理 |
| --- | --- | --- |
| 路线 | `ROUTE.ROUTE_ID`，`COMPANY_CODE`，`ROUTE_TYPE`，三语 `ROUTE_NAME*`／`LOC_*_NAME*`，`SERVICE_MODE`、`SPECIAL_TYPE`、`FULL_FARE`、`HYPERLINK_*` | 限 `TRAM` 与 `ROUTE_TYPE=4`。山顶缆车路线类型为 5，排除。4006 未出现在本批，无须补号。ID 用于内部关联。 |
| 方向及停靠 | `RSTOP.(ROUTE_ID, ROUTE_SEQ, STOP_SEQ)`，`STOP_ID`，三语 `STOP_NAME*`，`STOP_PICK_DROP` | 每方向独立按数值站序排列。上落限制 1 只下车、2 只上车、3 上下车均可。站名来自停靠记录，经同 ID 一致性校验后才建立站点词典。 |
| 站点 | `STOP.STOP_ID`，`STOP_TYPE=5`，`X`／`Y` | 独立轨旁参考点，不能从名称推断身份、方向或可上车路线。路线方向通过停靠记录关联。 |

427 个复合键唯一，均可联结路线与坐标，无孤立站点；各方向站序从 1 连续递增。首站 12 条只上车、尾站 12 条只下车，其余 403 条可上下车。三语站名全有值，同一站点 ID 在各路线的三语名称一致。当前同一方向内无重复停靠 ID，模型仍应保留每次停靠记录，以支持未来官方重复停站或环线。字典的 `ROUTE_SEQ=1/2` 指路线级编码，六条线均不能用倒转站序生成反向。 [运输署 XML 字典](https://static.data.gov.hk/td/routes-fares-xml/dataspec/ptroutefare_xml_dataspec.pdf)

### 实际 12 个方向

方向文字按首末停靠及干线站名核实。跑马地的「主线东／西行」只指干线段，支线仍按官方站序展示。

| 路线 ID／官方线路 | `ROUTE_SEQ=1` 出发 → 终点（停靠数） | `ROUTE_SEQ=2` 出发 → 终点（停靠数） |
| --- | --- | --- |
| 4001 筲箕灣—上環（西港城）／Shau Kei Wan–Western Market | 西行 99310 → 99140（40） | 东行 99212 → 99310（41） |
| 4002 筲箕灣—跑馬地／Shau Kei Wan–Happy Valley | 主线西行进支线 99310 → 99304（30） | 离开支线转东行 99304 → 99310（31） |
| 4003 堅尼地城—跑馬地／Kennedy Town–Happy Valley | 主线东行进支线 99201 → 99304（31） | 离开支线转西行 99304 → 99201（33） |
| 4004 石塘咀—銅鑼灣／Shek Tong Tsui–Causeway Bay | 东行 99313 → 99225（25） | 西行 99225 → 99313（26） |
| 4005 北角—石塘咀／North Point–Shek Tong Tsui | 西行 99312 → 99313（33） | 东行 99313 → 99312（32） |
| 4007 筲箕灣—堅尼地城／Shau Kei Wan–Kennedy Town | 西行 99310 → 99201（54） | 东行 99201 → 99310（51） |

### 跑马地、同名站和异常清单

- **跑马地支线。** 4002／4003 进总站的尾段为 99302 禮頓道 → 99303 樂活道 → 99307 黃泥涌道 → 99304 跑馬地總站。离开则为 99304 → 99308 天主教墳場 → 99305 皇后大道東 → 99309 禮頓道 → 99306 軒尼詩道，然后分往主线东、西行。两个方向在同一个总站 ID 分别下车、上车。保留进出站序，详情以目的地标注方向。快照没有独立的跑马地循环路线 ID，也没有两段同车续乘的依据。 [运输署站序](https://static.data.gov.hk/td/routes-fares-xml/RSTOP_TRAM.xml)
- **同名站。** 繁中有 3 组、英文有 4 组名称完全相同的不同 ID；去掉括号行车方向后，两种语言各有 36 组重复基础名。完全同名例外为西港城总站 `99140/99212`、北角道东行 `99237/99311`、礼顿道 `99302/99309`，另有下面的英文太康／太安异常。西港城两个点约隔 4 米，尤其不能按同名或近距离合并。详情及搜索用实际可乘方向或终点区分。 [运输署站序](https://static.data.gov.hk/td/routes-fares-xml/RSTOP_TRAM.xml) · [运输署 GeoJSON](https://static.data.gov.hk/td/routes-fares-geojson/JSON_TRAM.json)
- **名称纠错。** `99201` 的英文站名为 `Kennnedy Town Terminus`，路线及营办商站表支持用 `Kennedy Town Terminus` 作显示别名。 `99248`（太康街）与 `99252`（太安街）在 XML／GeoJSON 都写成 `Tai Hong Street (East bound)`，两个点分离。营办商双语站表分别列东行 `91E`／太康街／Tai Hong Street，以及 `93E`／太安街／Tai On Street，支持英文异常的判断。保留运输署原字段与两个 ID。将运输署 ID 与营办商站牌号绑定前，仍须审查坐标及站序证据。路线 `LOC_END_NAME*` 六条均夹带乐悠咭票价注记，详情终点取实际首末停靠。 [路线 XML](https://static.data.gov.hk/td/routes-fares-xml/ROUTE_TRAM.xml) · [营办商英文站表](https://data.gov.hk/en-data/dataset/hktramways-hktramways-tram-stops/resource/a69613a2-4a7d-4e21-8135-9cf4739be362)
- **石塘咀及短途。** 4004／4005 的四个方向仍连到官方静态总站 `99313`。营办商 2026-09-09 公告列明关闭直至另行通知，东行改从山道 `07E` 搭往铜锣湾／北角，相关西行改在屈地街车厂 `94W` 终止。对照静态 XML，山道东行 `99205` 存在于 4003／4007，4004／4005 均未列；西行屈地街 `99147` 是普通站，不能替代公告写明的 `94W`。保留原始记录，发行前重新核实公告、站牌映射和受影响方向的可上车记录。公告有效或恢复状态未核实时，已知关闭的站点不进入上车推荐；只凭终点公告不能生成完整临时站序。4004、4007 分别标有 `SERVICE_MODE=T`、`SPECIAL_TYPE=1`，其它四条为 `R/0`。无完整临时短途服务集合。 [石塘咀服务公告](https://www.hktramways.com/en/service-updates-detail/141/en/press-releases) · [营办商站表](https://data.gov.hk/en-data/dataset/hktramways-hktramways-tram-stops)

## 3. 坐标、班次及 ETA

- **坐标实测。** `STOP` 的 X/Y 是香港 1980 方格网（EPSG:2326）的米制东距／北距，范围 X 831057–841765、Y 814554–817024。用现有 `src/hk-grid.ts` 转换后，与运输署 GeoJSON 的 427 条记录按复合键比对；停靠 ID、三语名、上下车限制 427/427 相符，同 ID 在 GeoJSON 的坐标一致，两个来源的 117 个点均在港岛范围。转换差平均约 0.040 米、最大约 0.072 米（99145），表示两份官方表示相符，并非站台实地精度。建议 4C1 取官方 GeoJSON 的 WGS84 `[longitude, latitude]`，XML 网格转换用于验证。附近查询沿用现有 Haversine 与 500／1000／2000 米，仅把有可上车停靠的方向列为可乘搭结果。 [XML 字典](https://static.data.gov.hk/td/routes-fares-xml/dataspec/ptroutefare_xml_dataspec.pdf) · [运输署 GeoJSON 数据](https://data.gov.hk/en-data/dataset/hk-td-tis_23-routes-fares-geojson/resource/946ffaea-e294-49b9-9ca9-60422747923b)
- **静态营运资料。** 三份 XML 提供服务类型、行程字段、全程价及班次网页链接，首末班与班距由正式网页分开公布。营办商列六线按平日／周六／周日及公众假期的首末班，例如 4007 两向在公布服务时段内每小时 2 班。运输署另列基本班距。XML 六线全程 `3.3` 与两方公布的成人常规票价 HK$3.30 一致。上述时间为总站的服务概况，不能据此算出中途站到达、当前在营或下一班车。首版建议只链接营办商班次及票价；未来展示数值时独立核实来源、生效日期、日型、跨午夜与临时安排。本轮未验 GTFS 的线路、日历或班距映射。 [营办商班次及票价](https://www.hktramways.com/en/schedules-fares/) · [运输署电车服务详情](https://www.td.gov.hk/en/transport_in_hong_kong/public_transport/tram/tram_service_details/index.html)
- **实时 ETA。** 官方 2026-04-14 App 公告确认提供接下来三班的预计到达及目的地；官方历史资料还记录网页「Next Tram」与站牌二维码。Moovit 是公布的合作个案。公开检索运输署、电车公司和 DATA.GOV.HK，未找到向独立开发者正式开放的 ETA 授权、合约、访问资格、商用许可、缓存／分发条件或配额。开源 SDK 由第三方自行整理，不能证明营办商许可；本轮仅查看公开项目声明，未调用、抓取或试探 App 后端。4C1–4C3 不接入实时 ETA，未来须取得营办商可核验的准入及数据条款，再独立验证站牌映射、新鲜度、限流和故障回退。 [官方 App 公告](https://www.hktramways.com/media/files/press-releases/20260414_Press%20Release_Hong%20Kong%20Tramways%20Unveils%20Official%20Mobile%20App.pdf) · [营办商历史](https://www.hktramways.com/en/our-story) · [Moovit 合作公告](https://www.hktramways.com/media/files/press-releases/20180129%20HK%20Tramways%20x%20Moovit%20Press%20Release_EN.pdf) · [非官方项目声明](https://github.com/ByteLandTechnology/hktramways-openapi)

## 4. 类型草案与更新

```ts
type LocalizedNames = Readonly<{ 'zh-HK': string; en: string }>;
type TramRouteId = `td:tram:route:${number}`;
type TramStopId = `td:tram:stop:${number}`;
type TramDirectionId = 1 | 2; // Scoped to tramRouteId.
type TramVisit = {
  stopId: TramStopId;
  stopSequence: number;
  pickDrop: 1 | 2 | 3;
};
type TramDirection = {
  tramRouteId: TramRouteId;
  directionId: TramDirectionId;
  routeTermini: { fromStopId: TramStopId; toStopId: TramStopId };
  visits: readonly TramVisit[];
};
type TramStop = {
  stopId: TramStopId;
  localizedNames: LocalizedNames;
  coordinates: { latitude: number; longitude: number; kind: 'stopReference' };
};
type TramRoute = {
  tramRouteId: TramRouteId;
  localizedNames: LocalizedNames;
  directions: readonly TramDirection[];
};
type TramSnapshot = {
  schemaVersion: 1;
  snapshotVersion: string;
  snapshotUpdatedAt: string;
  dataSource: readonly {
    url: string;
    sha256: string;
    fetchedAt: string;
    lastModified?: string;
    sourceGeneratedAt?: string;
    attribution: LocalizedNames;
  }[];
  routes: readonly TramRoute[];
  stops: readonly TramStop[];
};
```

草案只收 App 所需双语字段；原始文件可在构建审计保留简中及其余元数据。用户可见的路线与停靠使用名称；导航和索引用官方键。方向内单次停靠的身份为 `tramRouteId + directionId + stopSequence`。上车资格属于单次停靠，关闭和变动属于另审的运营记录。运营记录可带官方链接、人工核对时间、有效期及受影响键，由其抑制误导的上车推荐，同时保留静态路线可查。

复用轻铁生成脚本的版本化结构及小巴离线索引的 SHA-256、覆盖统计和阻断式校验。构建机在运输署更新周期及重大发布前重新下载完整来源，校验三份 XML 和 GeoJSON 为可一致联结的同批次，再原子生成 JSON。版本串由批次与源哈希导出，`snapshotUpdatedAt` 使用带时区的已核实源更新时间，另记下载时间。CSV 更新记录可辅助审查增删，完整数据仍是重建依据。记录数或映射变化应人工审查，基线的 6／12／117／427 用作本批回归，未来可信新增数据不因数量改变被丢弃。混批、引用断裂、未核实差异或坐标异常阻止发布替换；保留上次通过的静态快照并显示来源日期。已知停站限制在核实解除前保留。 [轻铁生成脚本](../scripts/build-light-rail-static.py) · [小巴索引生成脚本](../scripts/build-gmb-nearby.py) · [运输署资料及更新机制](https://data.gov.hk/en-data/dataset/hk-td-tis_14-routes-fares-xml)

## 5. 4C1–4C3 与发布条件

| 阶段 | 可直接实施 | 验收 |
| --- | --- | --- |
| **4C1 静态数据层** | 构建端解析三份 XML 与 GeoJSON，产出经版本化的轻量离线索引；按路线、方向、站点或停靠身份查找；保留原始字段出处和已核验别名。 | 本批计数、全量引用及坐标回归。固定负例覆盖山顶缆车、坏坐标、重复复合键、缺站、缺译、站序空缺和不同 ID 同名。 |
| **4C2 搜索与详情** | 在 `transportSearchSources` 接电车，沿用 `global-search-navigation.ts` 的稳定键及分类行为。繁中、英文搜索可按路线、站名和目的地；方向详情按官方顺序，展开完整首末站并提供营办商链接。 | 中英文查找、同名站不合并、正确方向直达及返回状态。四个跑马地相关方向使用其实际停靠。4004／4005 明示受影响总站和公告。 |
| **4C3 附近** | 复用铁路／小巴有效位置、半径和手动地标；站点按 ID、路线按路线＋方向去重，只用 `pickDrop=2/3` 的有效停靠选最近上车点，距离标为直线。 | 三个半径边界、距近排序、站点方向准确、只下车点排除、已知停用上车点不推荐；临时安排未获证实时保守显示。 |

安装包有静态索引时，搜索、方向、站序、手动地标及本地距离可离线，当前位置仍须设备能够取得定位；运行时无需下载数据集或发送位置。手动打开官方班次或服务公告需要联网。静态索引根据发布计划更新，后续如需联网数据更新再另行审查。

**授权结论。** DATA.GOV.HK 条款为运输署发布的数据提供商用与非商用复制及分发依据。由此可在遵守平台条款、适用权利、知识产权标注及赔偿条件的前提下，把从运输署数据生成的静态索引随 App 分发。建议 App 的资料来源与离线索引元数据均保留「資料來源：香港特別行政區政府運輸署及 DATA.GOV.HK」及英文对应说明、来源链接和批次。运输署数据目录及 XML 字典未见这三份文件另列营办商专属授权条件；发布前仍应复核资源级附加条款及第三方权利。营办商站表、线路 CSV 的权利人另列为香港电车有限公司，本阶段仅作交叉核对。营办商网站、图片、实时资料及私有接口不属于本次运输署静态资料再利用结论。 [DATA.GOV.HK 条款](https://data.gov.hk/en/terms-and-conditions) · [运输署数据目录](https://data.gov.hk/en-data/dataset/hk-td-tis_14-routes-fares-xml) · [营办商数据权利声明](https://data.gov.hk/en-data/dataset/hktramways-hktramways-tram-stops) · [营办商实时资讯免责声明](https://www.hktramways.com/en/disclaimer)

**发布前待处理。** 复核石塘咀临时安排及 `07E/94W` 对照、英文太安街异常、营办商站牌号的逐站核验及适用条款。静态 4C1 可开展；当前可乘搭推荐须通过 4C3 的停用站保护验收。ETA 保持阻塞，直到获得正式接口、书面许可、配额和缓存／分发条件。

## 6. 验证与 Git

以临时脚本读取官方原始文件，完成唯一键、引用、三语名称、连续站序、上下车分布、方向非镜像、同名与重复 ID、427 条 GeoJSON 停靠逐条比对和 117 个网格坐标转换核验。现有铁路地理定向测试 12 项通过。下载与审计中间件留在临时目录，仓库只新增本报告。开工时 `develop` HEAD `a085542` 与本机 `origin/develop` 对齐，工作区干净；验证后留下报告待用户审查。
