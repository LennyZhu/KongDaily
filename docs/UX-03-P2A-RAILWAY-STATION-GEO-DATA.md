# UX-03-P2A · 港铁／轻铁离线地理数据

**数据基础已完成，可在开发者验收后进入 Phase 2B。** 本轮仅新增数据、显式映射、生成／读取模块与测试，没有接入交通 UI。

## 覆盖与未确认资料

| 范围 | 已核实覆盖 | 边界 |
| --- | --- | --- |
| 港铁 | **98／98 站**，全部有官方站点参考位置及至少一个已核实入口位置；其中 93 站有多个不同入口点。 | 98 包括既有目录的 97 个 CSV 站点代码和补充的马场 `RAC`；不改变其线路身份。站点覆盖完整，不代表已覆盖每个现存或正在开放的入口。 |
| 港铁入口 | **610 笔已核实来源记录，609 个不同入口点**。 | 香港大学 A1／A2 的官方坐标完全相同，合为一个点并保留 `560348`、`560349` 两个来源 ID；没有平均坐标。 |
| 轻铁 | **68／68 站**，每站一个官方 `LRA` 站点参考位置。 | 不宣称站点中心、出入口或具体月台位置，不从站点坐标推断乘车月台。 |
| 未匹配站点 | **港铁 0、轻铁 0**。 | 生成器仍支持 `unresolved` 及空位置；未知 ID／无坐标不会参与附近排序，原目录查询不受影响。 |
| 未确认来源记录 | **1 笔**：钻石山 D 入口 `21279579`。 | 官方 `E_SITENAME`、`C_SITENAME` 均为空。暂不按名称独自认定所属车站，保留于隔离清单；不影响钻石山其他已核实入口。 |
| 冲突 | **0 笔被接受的冲突**。 | 重复来源 ID、跨交通类型、错误所属站、未审查新记录或来源漂移均使生成检查失败。 |

## 官方来源、映射与坐标

使用开发者指定的 [地政总署 iGeoCom 数据集](https://data.gov.hk/en-data/dataset/hk-landsd-openmap-development-hkms-digital-geocom)，已足以覆盖两铁，无需使用第三方 POI 或其他坐标补齐。[官方产品说明](https://www.landsd.gov.hk/en/survey-mapping/mapping/other-products/iGeoCom.html) · [官方类型表](https://www.landsd.gov.hk/doc/en/mapping/digital-map/common/feature/igeocom_mf.pdf)

- 2026-11-22 香港时间下载；最后一份来源完成于 **14:04:24 +08:00**。官方[修订日期 CSV](https://www.landsd.gov.hk/doc/en/mapping/digital-map/common/update/igeocom_update.csv)为 **2026-09-01**，DATA.GOV.HK 的 CSV／GeoJSON 资源更新日为 **2026-09-04**。获取时间不等于现场测绘日期；每笔原始 `REV_DATE` 保留在离线来源摘录中。
- CSV ZIP 内为 `iGeoCOM_POI.csv`，GeoJSON ZIP 内为 `iGeoCOM_POI.geojson`，各 **37,379 笔**。筛出 `CLASS=TRS` 的 `RSN` 98、`MTA` 611、`LRA` 68，共 **777 笔**；逐笔核对两种格式的来源 ID 和全部属性一致。
- 官方 **5.0（2026-03）数据字典第 1、3、10 页**确认：`GEONAMEID` 为主键，`RSN` 为铁路站、`MTA` 为铁路站出入口、`LRA` 为轻铁站；`E_SITENAME`／`C_SITENAME` 是所属地点字段。地理库不提供港铁业务代码或轻铁数字 ID，不能直接把两套 ID 混用。
- 显式审查表逐站锁定既有官方业务 ID → `GEONAMEID`，核对铁路类型、唯一的中英文完整站名和轻铁服务区域。入口另逐笔列出允许的来源 ID，并要求官方中英文所属地点均与站点锚点一致；生成器不执行模糊名称、邻近位置或新候选自动接受。
- 例外只有现有目录 `LAK` 的「茘景」与 `LCK` 的「茘枝角」：地理库用「荔景／荔枝角」。审查表保留原文、唯一官方英文身份及字形差异依据，不修改现有目录。海皇路 `250` 精确对应 `LRA/529462` 的「海皇路／Hoi Wong Road」，不是旧名称别名推断。
- **直接采用官方 GeoJSON WGS84 Point 的 `[longitude, latitude]`**，输出 `{ latitude, longitude }`。字典说明 `EASTING/NORTHING` 属性属于 HK1980 Grid；按项目现有 EPSG:2326／EPSG:1825 转换以米交叉检查 777 笔，最大差 **1.771 米**。没有新写转换算法，也没有对官方 WGS84 点再次转换；差值仅验证字段一致性，不是现场精度保证。
- 同一业务站点代码可供多条线路复用位置；`HOK/KOW/TSY` 仍保留机场快线与东涌线各自的业务 Station ID。`CEN/HOK`、`TST/ETS` 和两铁同名站的来源 ID、位置及业务身份分开。

以下抽样均直接对应官方记录，表中展示的是**站点参考位置**，用于复核区域与身份，不冒称入口或步行路径：

| 区域／业务 ID | GEONAMEID | WGS84 latitude, longitude |
| --- | --- | --- |
| 港岛：金钟 `ADM` | 538320 | 22.27942, 114.16435 |
| 港岛：中环 `CEN`／香港 `HOK` | 546117／550143 | 22.28215, 114.15768／22.28467, 114.15822 |
| 九龙：九龙塘 `KOT` | 544548 | 22.33712, 114.17578 |
| 新界东：马场 `RAC` | 545946 | 22.40019, 114.20278 |
| 新界西：屯门重铁 `TUM` | 559980 | 22.39511, 113.97319 |
| 轻铁海皇路 `250` | 529462 | 22.38116, 113.97041 |
| 轻铁洪水桥 `380` | 540033 | 22.43364, 113.99736 |
| 轻铁屯门 `295`／元朗 `600` | 531658／556168 | 22.39372, 113.97331／22.44572, 114.03437 |

## 离线构建与读取

新增文件共 8 个：

| 文件 | 用途 |
| --- | --- |
| `assets/data/railway-station-geo.json` | 约 192 KiB 的 WGS84 位置包；含来源、日期、校验和、映射依据、覆盖及隔离清单。 |
| `scripts/fixtures/railway-geo/igeocom-railway-source.json.gz` | 777 笔官方原始 Feature 的固定摘录，保留完整属性与原坐标，约 46 KiB；供离线重建与验证。 |
| `scripts/fixtures/railway-geo/station-mapping-review.json` | 两铁分开的显式业务 ID 对照、入口 ID 白名单、字形例外、隔离原因及来源／原目录校验和。 |
| `scripts/build-railway-station-geo.py` | 标准库生成器：官方 CSV／GeoJSON 核对、来源捕获、固定快照重建与 `--check`。 |
| `src/railway-station-geo.ts` | 静态 JSON 读取及无 React 的地理纯函数；复用既有 Haversine 与半径类型。 |
| `scripts/test-railway-station-geo.py` | 生成、来源漂移、ID／所属站冲突、字形例外及部分覆盖测试。 |
| `scripts/test-railway-station-geo.cjs` | 实际 TypeScript 模块、业务身份、坐标转换、入口距离、半径及离线回退测试。 |
| 本报告 | 覆盖、依据、验证与后续接入交接。 |

来源 SHA-256（解压后的原始成员字节；ZIP 校验和、字典及修订 CSV 校验和也保存在位置包 `source` 中）：

| 来源 | SHA-256 |
| --- | --- |
| [CSV](https://open.hkmapservice.gov.hk/OpenData/directDownload?productName=iGeoCom&sheetName=iGeoCom&productFormat=CSV) | `d9703a9717774ca6b875f076da7d1be95f8640140e5bd902691b8421befef5db` |
| [GeoJSON](https://open.hkmapservice.gov.hk/OpenData/directDownload?productName=iGeoCom&sheetName=iGeoCom&productFormat=GEOJSON) | `e96f6cc7f6b6b8941b53e93f775763806ceeeec7e9d42779eaee4cff02664563` |
| [数据字典 PDF](https://open.hkmapservice.gov.hk/OpenData/opendata_static/resources/resources_iGeoCom_GeoJSON.zip) | `76c578514760db54db919d21fa2c70cfed628a0f153f303692c66bee049ee6f0` |
| 来源摘录解压后的固定 JSON | `77ed7fa19aa9443cc6a33c15e8c466839342df1561034711d9cdd597e86feb43` |

日常离线重建：`python3 scripts/build-railway-station-geo.py`；只核对不写入：加 `--check`。从本次官方原始下载重新捕获的 gzip 摘录已验证与仓库摘录逐字节一致。

新批次先按位置包中的官方 URL 下载 CSV ZIP、GeoJSON ZIP、字典 ZIP 和修订 CSV，再执行以下命令捕获到临时文件。更新日期和下载时间必须来自新批次实际证据；审查新旧来源差异、每个业务 ID、所属字段、例外和新增记录后，才替换固定摘录并更新显式审查表及其 SHA。原数据／目录校验和变化不会自动放行。

```sh
python3 scripts/build-railway-station-geo.py --capture-source \
  --csv /tmp/igeocom-csv.zip --geojson /tmp/igeocom-geojson.zip \
  --dictionary /tmp/igeocom-dictionary.zip --revision /tmp/igeocom-revision.csv \
  --fetched-at ACTUAL_HK_ISO_TIME --resource-updated ACTUAL_YYYY_MM_DD \
  --source /tmp/igeocom-railway-source.json.gz
```

读取模块提供 `getRailwayStationGeo(mode, id)`、`getMtrStationPositions(id)`、`getLightRailStopPositions(id)`、`hasRailwayStationGeo(mode, id)` 及 `railwayStationGeographies`。每条记录保留交通方式、业务站点 ID、核实状态、来源锚点 ID、位置类型、来源记录 ID、官方来源与映射依据。

`nearestRailwayPosition` 优先计算用户至最近已核实入口的直线距离；没有入口时才使用站点参考点，并保留位置类型。`findNearbyRailwayStations` 使用现有 `500 | 1000 | 2000` 米范围及未取整的 Haversine 距离筛选、升序排序。数据通过模块的静态 JSON import 提供，Phase 2B 引用后由 Metro 一并打包；本轮没有为了强制加载而修改 App 入口。无需网络、GPS 调用、数据库、后台或启动下载，也不向地理服务传送用户位置。

## 验证与 Git 状态

| 验证 | 结果 |
| --- | --- |
| `npm run typecheck` | PASS。 |
| `PYTHONDONTWRITEBYTECODE=1 python3 scripts/test-railway-station-geo.py` | **8／8 PASS**；包括缺失映射保持 unresolved、不阻塞其他已核实站点。 |
| `python3 scripts/build-railway-station-geo.py --check` | PASS，固定位置包可重建。官方原始下载 → 摘录重建的 `cmp` 也通过。 |
| `node --test scripts/test-railway-station-geo.cjs` | **10／10 PASS**；覆盖全部两铁 ID、海皇路 250、705／706、共站复用与独立站隔离、多入口／同点去重、WGS84／HK1980、最近入口、三档半径边界、未知／无效／无坐标回退、地区样本及离线执行。 |
| `node --test scripts/test-nearby-bus-location.cjs scripts/test-mtr-next-train.cjs` | **58／58 PASS**；两铁静态目录／站序、两铁实时预报，以及巴士附近距离、范围、定位与导航回归。 |
| `git diff --check` 与新增文本空白检查 | PASS。 |

开工工作区干净；`develop` 的 HEAD 与本机 `origin/develop` 均为 `65dc478433d00512b41571988ef135c300f378c9`，该提交已包含 PRD 与通过人工验收的 Phase 1。`main` 和 `v1.1.0` 解引用仍为 `796a719b93e08bf4fb540d9ef9a07b6510efbf25`。本轮只新增上述 8 个文件，未修改现有已跟踪文件，未提交／推送／合并。未查询 Apple 或更新远端 Git 引用。

## Phase 2B 最小接入建议（尚未实施）

1. 保留 `src/app/transport.tsx` 的既有转发，在 `src/app/bus/nearby.tsx` 使用已有 `reference.point`、手动地标、`radiusMeters` 和交通筛选状态调用上述纯函数。当前铁路模式不触发附近 GPS；获批后只调整需要定位的条件，复用既有请求、取消及前后台生命周期，不重建 GPS 服务。
2. 以 `(mode, stationId)` 反查既有 `findMtrStation(...).memberships` 或 `findLightRailStop(...).routes`，生成可乘线路；沿用目录和详情导航，不改变线路业务 ID、站序、巴士结果或全港文字搜索。
3. 「全部」模式合并已计算的巴士与铁路结果；距离按返回的 `position.kind` 区分入口／站点参考点，明确直线距离。无坐标的站保留目录查询，不伪造附近位置；补齐地理来源署名。
4. 附近列表只读取离线坐标；实时预报仍仅在原有可见／详情上下文按需请求，沿用既有过期、取消及限流策略。

**本轮已停止，等待开发者验收。** 没有修改 UI、显示附近铁路结果、现有铁路目录／实时 API、巴士 GPS／ETA／票价／收藏、首页／全局搜索、数据库、权限、距离预设或版本号；没有启动模拟器／真机、创建 EAS Build、部署网站或修改发布分支／Tag。
