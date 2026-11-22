# Phase 4A1C · 专线小巴附近路线与站点

在 develop 的 6b88b8f 上实施，与本地 origin/develop 对齐。保留了 4A0、4A1A 及已经通过 iPhone 验收的 4A1B 工作区改动。

## 文件与数据来源

| 文件 | 变更 |
| --- | --- |
| [gmb-nearby.json](../assets/data/gmb-nearby.json) 与 [build-gmb-nearby.py](../scripts/build-gmb-nearby.py) | 全港官方站点、路线方向、站序及上落客属性的版本化离线快照；构建时逐项核对来源覆盖并记录 SHA-256。 |
| [nearby-gmb.ts](../src/nearby-gmb.ts) | 读取快照，离线按站名查找及按半径、直线距离查询。 |
| [交通查询](../src/app/bus/nearby.tsx)、[小巴结果卡](../src/components/gmb-nearby-rows.tsx)、[i18n](../src/i18n.ts) | 在专线小巴分类接入现有轻铁式路线／站点切换、距离、定位和地标控制，显示双语路线及展开的停靠记录。 |
| [统一导航](../src/global-search-navigation.ts)、[小巴详情](../src/app/minibus/[id].tsx) | 用同一详情路径接收官方方向及可选的精确停靠。进入时复核实时目录，已变更的方向或站序有明确提示。 |
| [附近与导航测试](../scripts/test-nearby-bus-location.cjs) | 用实际快照及固定响应检查数据覆盖、距离边界、身份、定位、搜索和详情导航。 |

使用运输署全港路线及票价 GeoJSON。实际下载为约 20.5 MB，包含 13,107 条 WGS84 Point 记录，每条都有路线、地区、线向、站序、实体站 ID、站名及上落客属性。本轮不使用路线线段推断站点。快照于 2026-11-22（香港时间）擷取，文件内最新记录日期为 2026-11-17。[运输署 GeoJSON](https://data.gov.hk/en-data/dataset/hk-td-tis_23-routes-fares-geojson/resource/ede023b4-f470-4edf-b1a0-dc6713e6021e) · [字段规范](https://static.data.gov.hk/td/routes-fares-geojson/dataspec/ptroutefare_geojson_dataspec.pdf)

| 抽查范围 | 结果 |
| --- | --- |
| 地区＋路线编号 | 572／572，港岛 107、九龙 133、新界 332，与同日运输署 ETA 编号目录逐项相符。 |
| 路线变体和方向 | 779 个 route_id，1,164／1,164 个 route_id＋route_seq 与 CSDI 批量方向目录的 ID 和编号一致。 |
| 实体站和停靠 | 4,773 个实体站、13,107 次停靠。4,713 站、11,943 次停靠可上客。只下客的 60 个独立站不出现在可上客的附近结果，站序仍保存在快照。 |
| 对照抽查 | 港岛 2 号循环方向、九龙 2 号两个方向、新界 2 号一个方向，共 63 个精确停靠，与 4A0 保存的 ETA 站序 ID 完全匹配。 |

覆盖比较基于这次官方快照，尚未逐条对照实时 ETA 站序接口，也未验证每个停靠是否有实时预报。[运输署 ETA 目录](https://data.etagmb.gov.hk/route) · [CSDI 方向目录](https://portal.csdi.gov.hk/server/rest/services/common/td_rcd_1697082463580_57453/FeatureServer/0)

## 缓存、身份与定位

- 离线索引约 1.4 MB。在首次附近查询或站名查询时载入，站点坐标只保存一次，运行时按实体站扫描距离；站名规范化索引按需创建并在会话复用。附近列表、站名搜索及展开站点都不调用小巴 API。完整编号搜索与详情继续使用 4A1A 的请求合并、缓存及超时。只在进入可核验并选中的停靠时取预报。
- 路线以 route_id＋route_seq 去重，选半径内距离最短的可上车停靠。距离相同按实体站 ID 稳定排列。地区和特别班次仍属于各自的官方 ID。GeoJSON 没有 ETA 目录的变体描述，附近卡在同号同区存在多个 variant 时显示官方服务 ID，具体班次描述在详情中继续显示。
- 站点以 stop_id 分组，不按名称或坐标合并。展开后列出路线、地区、方向及 stop_seq，循环线的不同停靠分别保留。只供落客的记录明确标记，无法选作上车。点击上车停靠会把 route_id、route_seq、stop_id 和 stop_seq 一并传给详情，只有官方详情站序双键均匹配时才自动展开。4A1B 的重复站预报保守策略继续生效。
- 采用现有 Haversine 和 500／1,000／2,000 米设置，结果只包括等于或小于所选半径的停靠。沿用已有系统定位权限、定位中／失败、设置入口、手动地标及前后台流程。位置不可用时仍可搜编号或站名。清空关键词恢复之前的小巴路线／站点模式与距离；返回复用列表滚动恢复。小巴附近结果只在小巴分类显示，「全部」的附近列表继续提供原三种交通。编号搜索仍可在「全部」及首页使用。

## 验证与风险

- TypeScript 检查、108 项定向测试、iOS Metro／Hermes 静态导出和 git diff --check 均通过。新增测试覆盖三档距离边界、合法上客点、同站多路线、循环线重复停靠、定位拒绝／失败、站名搜索及详情参数校验。既有巴士、港铁、轻铁附近及搜索、导航和实时预报回归通过。
- 使用三个固定下载重建索引，输出与打包文件逐字节一致。快照 SHA-256 为 ccfe07f25ab0b25794375a826b5fb4ad4ce405d22fe0c341e24aeb5c13672b51。重建命令是 python3 scripts/build-gmb-nearby.py GEOJSON ETA_DIRECTORY CSDI_DIRECTIONS OUTPUT --captured-on YYYY-MM-DD。CSDI 查询使用 where=1=1、outFields=ROUTE_ID,ROUTE_SEQ,ROUTE_NAME、returnGeometry=false 和 resultRecordCount=2000。若目录差异或分页截断，构建拒绝替换已有索引。
- 静态资料随版本更新，暂时改道、临时停站和班次营业时段可能与实时服务有差异。附近表示离线站点和官方上客资格，距离为直线距离。发布前核查新目录、临时变更及适用再利用条款。详情站序已变化时只按现行官方资料继续查询。
- 已有 SQLite v10、巴士与铁路业务、收藏和首页置顶保持原状。本轮未启动模拟器或创建 EAS Build，Git 未提交。

## iPhone 人工验收

1. 在香港站或手动选择中环地标，打开「專線小巴」。分别切换按路线及按站点，再切换 500 米、1 公里、2 公里。核对距离由近到远，路线卡显示地区、方向及最近上车站。
2. 打开香港站小巴总站，检查多路线、不同方向和重复停靠。港岛 2 号正常循环线的首尾停靠应分别列出，尾站只供落客。选可上车的路线组进入对应方向，返回应保留小巴模式、半径及列表。
3. 用繁中和英文搜「香港站小巴總站」／“Hong Kong Station Minibus Terminus”，再用 2 号验证跨区和运营变体。清空后恢复附近结果。拒绝定位或尝试手动地标，再检查飞航模式下的附近与站名查询。现有巴士、港铁、轻铁附近及全域搜索各抽查一次。
