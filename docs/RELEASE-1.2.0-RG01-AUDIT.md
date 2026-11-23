# KongDaily 1.2.0 · Release Gate RG-01

**结论：暂缓进入 TestFlight。** 本轮未发现已证实的 P0。已确认的 P1 是候选版本仍为 1.1.0、双语隐私披露及定位用途未覆盖当前功能、小巴离线资料的署名链不完整。生产候选的远端构建号、最终原生隐私材料及新增使用场景的授权证据仍待确认。审计未改 App、数据库、依赖、网站内容或发布配置。

本报告中 **PASS** 表示证据支持所述范围，**FAIL** 表示已复现或已核实的不一致，**UNKNOWN** 表示证据尚不足，**BLOCKED** 表示需要发布负责人、数据提供方或候选构建等外部条件。

## 1. Git、版本及构建基线

| 检查 | 状态与证据 |
| --- | --- |
| 开工基线 | **PASS**。`develop` HEAD 为 `8da65aa`，与本机 `origin/develop` 相差 0／0，开工工作区干净。本轮未 fetch。用户报告同一阶段 4D2 iPhone 检查 8/8 PASS。 |
| 线上对照 | **PASS**。本机 `main` 和 `v1.1.0` 均解引用至 `796a719b93e08bf4fb540d9ef9a07b6510efbf25`。线上 1.1.0 (Build 3) 沿用用户的发布确认。App Store Connect 未在本轮查询。 |
| Expo／原生配置 | **PASS**。配置入口是 `app.json`，无受跟踪的 iOS 原生工程或动态 App 配置。Expo ~57.0.33、RN 0.86.3。Expo introspection 得到 iPhone-only、Bundle ID `com.lennystudio.kongdaily`、`kongdaily` URL scheme、en／zh-HK 本地化、ATS 禁用任意明文加载、无项目声明的后台定位或额外 entitlement。选定的 EAS iOS image 在 Expo 官方 SDK 57 列表中。[Expo 构建环境](https://docs.expo.dev/build-reference/infrastructure/) |
| 版本及构建号 | **FAIL**。当前 `expo.version=1.1.0`，introspection 同值，无法按 1.2.0 分发候选。 `package.json` 的版本是内部包版本。**UNKNOWN**。本地无 `ios.buildNumber`，EAS 设为 remote，生产 iOS 自动递增 `buildNumber`。本机没有 EAS CLI，远端计数及待处理的 Apple 上传未核实，不能预定下一号。 |
| EAS Production Profile | **PASS（配置）**。Store、Release、production 环境、关闭 dev client 和 simulator，沿用已有 Expo 项目。**UNKNOWN（成品）**。签名、身份、最终 entitlements、SDK 隐私清单聚合、Required Reason API 及实际 `CFBundleVersion` 只能在合法候选归档中核验。 |

以 `v1.1.0` 对比，配置及锁文件未变。主要增量是两铁地理查询、全域搜索、铁路和小巴收藏、共享首页槽位和小巴正式查询。天气、设施、探索等以当前回归和原有上线行为作对照。

## 2. 功能与回归矩阵

| 功能 | 结论与证据 |
| --- | --- |
| 巴士路线、站点、附近及 ETA | **PASS**。路线／地图、定位及半径、车费证据、精准上车停靠；首页 B2 连接与响应体超时、恢复及请求交错均有定向测试。13 条路线变体的车费快照源于 2026-11-18，在香港时间 2026-12-02 00:00 后安全隐藏，发布前需刷新快照或明确接受隐藏。 |
| 港铁、轻铁 | **PASS**。离线路线和站点、坐标与半径、官方方向、月台、轻铁严格路线匹配、循环与特别班次、过期及后退恢复均有固定样本。 |
| 专线小巴 | **PASS**。路线号与运营变体、全域路线搜索、交通页站名搜索、离线附近、详情、方向和准确停靠。实时、计划、无预报、超时、重复停靠歧义及 429 有回归。附近覆盖由快照支持，实时可用性随官方端点而异。 |
| 四交通收藏、共享置顶及排序 | **PASS**。收藏和置顶分离，最多三项、首尾边界、混合排序、重启与并发、删除释放置顶、小巴写入重读失败回滚。用户报告 4D2 真机 8/8。 |
| SQLite v11 | **PASS（标签夹具及定向测试）**。详见第 4 节。**UNKNOWN**。实际 iOS 系统备份／恢复链未实测。 |
| 全域搜索、收藏及设置 | **PASS**。稳定身份与四交通结果、双语分类及导航、用语、分类空状态、语言偏好与设置入口有测试。电车结果过滤，渡轮生产搜索不读禁用源。 |
| 天气、警告、附近设施 | **PASS（现有自动覆盖）**。来源合规检查、附近分类、定位拒绝、手动地点、地图及列表适配、设施收藏。**UNKNOWN**。未现场测实时天气或原生地图渲染。 |
| 探索、地图、外部导航 | **PASS（现有自动覆盖）**。探索内容、版权图件对应、步行起点、URL 白名单、导航及返回验证。地图渲染和外部 App 行为待候选设备抽查。 |
| 繁中、英文及无障碍 | **PASS（静态／组件级）**。混合置顶不超过三张、铁路与小巴首页无手刷按钮、轻铁正文对齐、状态与标题的换行属性、44 pt 点击目标和 VoiceOver 操作语义。**UNKNOWN**。当前签名候选的真机朗读、大字号、触控及视觉仍未采样。 |

## 3. 数据来源、授权与标识

DATA.GOV.HK v1.2 和 CSDI 的公开条款允许符合条件的商用复制及分发，并要求清楚标识来源和权利人。数据门户对外链服务另有范围限制。用官方数据集和技术规范核对各实际端点及快照输入，资料更新时间只作为来源时效信息。接口公开、数据更新频率和应用调用配额是独立事项。[DATA.GOV.HK 条款](https://data.gov.hk/en/terms-and-conditions) · [CSDI 条款](https://static.csdi.gov.hk/csdi-webpage/doc/TNC) · [App Review Guidelines §5.2.2](https://developer.apple.com/app-store/review/guidelines/#intellectual-property)

| 来源／权利人 | 门户、调用及发布结论 |
| --- | --- |
| 运输署绿色专线小巴 ETA | **PASS（来源与技术）**。运输署公开数据集列明官方端点，目录称 ETA 每分钟更新。规范 v1.1 使用公开 GET，项目无 API Key。客户端 8 秒总超时、同键合并、ETA 60 秒冷却、内存缓存及 Retry-After；首页回到前台按既有机制刷新。**UNKNOWN（外部条件）**。已阅规范未提供可核实的数值配额或额外登记流程，未见另外许可证明，发布责任人须记录对设备直连、短时缓存及商业用途的条款判断，条件不清才向提供方确认。[官方数据集](https://data.gov.hk/en-data/dataset/hk-td-sm_7-real-time-arrival-data-of-gmb) · [规范](https://data.etagmb.gov.hk/static/GMB_ETA_API_Specification.pdf) |
| 运输署小巴离线快照 | **PASS（出处）**。GeoJSON、官方 ETA 目录和 CSDI 方向层生成筛选索引，未见第三方地图 POI 输入。采集 2026-11-22 HKT，最新记录日 2026-11-17，记录了目录和三个生成输入的哈希，可按脚本重建。4,773 个实体站、13,107 次停靠；生成工具比对目录覆盖。随安装包发布，无启动下载。**FAIL（发布署名）**。详情链接已指向官方 ETA 数据集，附近可见采集日，集中署名未独立列出小巴及离线 GeoJSON／CSDI 输入和双语所有权说明。门户条款为有条件离线分发依据，当前成品证据尚未闭环。[GeoJSON 资源](https://data.gov.hk/en-data/dataset/hk-td-tis_23-routes-fares-geojson/resource/ede023b4-f470-4edf-b1a0-dc6713e6021e) · [CSDI 方向层](https://portal.csdi.gov.hk/server/rest/services/common/td_rcd_1697082463580_57453/FeatureServer/0) |
| 九巴／龙运、城巴、新大屿山巴士 | **PASS（技术与署名）**。官方 HTTPS feed、既有双语营办商署名与离线索引来源；九巴／龙运和城巴目录写每分钟更新，新大屿山巴士写实时。首页约 60 秒轮询并处理失败及超时。**UNKNOWN**。本轮未取得各营办商确切数值配额或针对再分发、保留期的完整条件。官方目录可读，九巴及新大屿山巴士的两份链接规范通过网页审计未能读取。巴士截图及功能文案需明确覆盖和车费有效性。[九巴／龙运](https://data.gov.hk/en-data/dataset/hk-td-tis_21-etakmb) · [城巴](https://data.gov.hk/en-data/dataset/ctb-eta-transport-realtime-eta) · [新大屿山巴士](https://data.gov.hk/en-data/dataset/nlb-bus-nlb-bus-service-v2) |
| 港铁公司静态及实时、两铁坐标 | **PASS（出处与语义）**。门户目录列两铁实时权利人为港铁公司，更新频率 10 秒；应用客户端最小刷新 20 秒，时效 60 秒，支持合并、限流退避和有效时间状态。已有四项双语铁路署名，坐标来自地政总署及官方空间数据，显示直线距离。**UNKNOWN（新增使用）**。既有审计支持门户资料集有条件商用和离线再分发，新首页持续预报、各来源限额和坐标派生物仍应逐项签核。既有 App 已上架不代替签核。[港铁实时](https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data) · [轻铁实时](https://data.gov.hk/en-data/dataset/mtr-lrnt_data-light-rail-nexttrain-data) · [地政总署 iGeoCom](https://data.gov.hk/en-data/dataset/hk-landsd-openmap-development-hkms-digital-geocom) · [既有铁路核对](UX-02B5B-DATA-LICENSING-ATTRIBUTION-PRIVACY-AUDIT.md) |
| 港九小轮 | **PASS（生产隔离）**。生产端点受门控制，保留不可用入口，正式搜索、附近、旧链接和收藏不能开启。生产 Hermes 未发现码头预览的坐标标记或测试时刻表标记。仍有基础适配器、路线／码头标识和端点字符串。**BLOCKED（重新开放）**。营办商数字服务条款 §13 设书面许可条件，仍须确认开放 ETA 数据集的适用范围及商业接入、缓存和分发。[官方目录](https://data.gov.hk/en-data/dataset/hkkf-hkkfdata-hkkf-eta-data) · [营办商条款](https://hkkf.com.hk/en/hkkf-digital-services-terms-and-privacy-policy/) |
| 香港电车 | **PASS（既有门禁）**。分类和搜索隐藏，直接路线／站点链接不可用，静态索引仍在包内，符合 4C4 保留方案。无电车实时 ETA 客户端接入。石塘咀关闭信息仅在受保护实现及数据层内，测试验证闭站剔除且生产没有公开电车推荐。**BLOCKED（正式开放）**。待书面实时 ETA 授权和服务接入。候选复核保留的静态资料出处及 Review Notes 的门禁说明。[4C4](PHASE-4C4-TRAM-FEATURE-GATE.md) · [4E0](PHASE-4E0-TRAM-ETA-LICENSING.md) |

## 4. 从实际发布标签验证 SQLite

- **PASS。** `git show v1.1.0:src/database.ts` 的发布 Schema 版本为 8。本轮用该标签的八段原始 SQL 在临时文件创建结构，逐字核对当前前八段迁移 SQL 一致。之后写入合成但合法的三条巴士收藏（两条置顶，旧位置 1／3，创建顺序与置顶顺序不同）、设施收藏、语言设置和最近搜索。见 [数据库迁移入口](../src/database.ts)。
- **PASS。** 用当前应用迁移入口运行 v8 → v11，断言四张旧表逐行相等，两项置顶的原相对顺序保留，小巴收藏初始为空，`PRAGMA integrity_check` 为 `ok`。v11 故障注入后仍为 v8，旧四表及数据一致，新表回滚。取消注入可成功重试。重复开库及从升级前关闭副本恢复后重新升级均通过。
- **PASS。** 正式定向套件另覆盖 v9／v10，三种孤立置顶、审计记录、不可新增无目标关联、无效 mode、最大 3 项、快速去重和跨类型持久顺序。4D2 的小巴保存及删除读回失败证明有效收藏和已发布状态完整保留。迁移失败会关闭连接及清除开库 Promise 供重试，未发现自动清库逻辑。 [迁移与收藏回归](../scripts/test-facility-favorites.cjs)
- **UNKNOWN。** 这些是发布标签的真实 Schema 加合成数据，没有取得线上用户数据库，也没有跑 iOS 系统备份／恢复或真机首次升级。RG-02 将这项标签夹具留作可持续重跑的回归，候选阶段在控制设备做原地升级、冷启、发布版升级失败后的可恢复行为与系统备份恢复记录。若原生环境不提供可用回退路径，仅记录测试，避免承诺新库可由旧版读取。

## 5. 生产输出与性能

| 检查 | 结论与证据 |
| --- | --- |
| Hermes 生产检查 | **PASS（静态）**。用 `EXPO_NO_DOTENV=1 EXPO_PUBLIC_HKKF_PREVIEW=1 expo export --platform ios` 导出，获得 7,135,866 byte 的 HBC。反汇编中不存在渡轮附近预览模块／码头搜索文案、抽查码头坐标、渡轮实测时刻样本标记或巴士开发日志前缀，存在受保护路由的不可用文案、TD 电车索引和小巴快照哈希。受保护的适配器域名存在并不等于启用。 |
| 安全、环境及资产 | **PASS（静态范围）**。应用请求端点为 HTTPS、静态 ATS 禁用任意明文；生产模式没有 Expo 开发客户端。导出目录没有测试夹具文件，HBC 未命中测试路径、已知本机变量名或常见凭据格式抽查。结果只适用于本次本地静态导出。**UNKNOWN**。EAS 远端环境变量、签名成品的原生资源和打包上传清单未取得。RG-02 确认仅提供必要的生产变量，检查构建归档内的环境痕迹、原生插件及意外文件。 |
| 首页并发、超时及生命周期 | **PASS（夹具）**。三槽上限、前台按需请求、并发合并、过期判定、超时覆盖响应体、取消及退避测试通过。铁路和小巴 Home 无手动刷新按钮，详情保留刷新。GPS 拒绝／失败可改用手动地标，离线和错误状态有回归。 |
| 搜索与数据量 | **PASS（本机 Node 单次采样）**。全域搜索套件报告首次巴士停靠 SQLite／索引约 259.8 ms，设施初次索引／搜索 16.3 ms，200 次热查询中位 3.42 ms、P95 23.04 ms。这些不是 iOS 结论。小巴 JSON 为 1,519,656 bytes（约 1.45 MiB），近站索引按需建立，随包保留。 |
| 原生冷启动、内存和地图 | **UNKNOWN**。未测候选 iPhone 的冷启动、SQLite 升级耗时、长时间 ETA 并发、GPS／MapKit RSS、电量及内存告警。应在支持的实机选取至少一台较旧机型记录冷启及空闲/三置顶/离线近站切换。 |

## 6. App Store、支持及隐私

| 检查 | 状态与处理 |
| --- | --- |
| Privacy／Support URL | **PASS（公开可达）**。四个繁中及英文 URL 的直接 HTTPS GET 均为 HTTP 200，页面标题匹配。**UNKNOWN**。实际 App Store Connect 字段和审核账号没有访问。 [繁中私隱](https://kongdaily-site.vercel.app/privacy/) · [English privacy](https://kongdaily-site.vercel.app/en/privacy/) · [繁中支援](https://kongdaily-site.vercel.app/support/) · [English support](https://kongdaily-site.vercel.app/en/support/) |
| 披露及原生用途 | **FAIL**。应用与公开页仍为政策 v1.0，定位只描述设施／巴士站，本机数据仅描述巴士及设施收藏，线上服务段未覆盖当前港铁、轻铁和小巴端点。代码中的小巴全域路线查询会用识别出的线路编号与地区请求官方 API，亦须把这种处理与纯本机匹配区分。更新 App 和官网同源内容、双语 `NSLocationWhenInUseUsageDescription`、App Privacy 与支持说明。保持无后台定位，披露实际网络接收者、承载字段、留存及系统备份。**UNKNOWN**。第三方实际留存、App Privacy 当前表单、最终签名归档中 MapKit／FileSystem 及其他依赖 Required Reason API 的归类待核验。 [政策源码](../content/compliance.json) · [Apple 隐私要求](https://developer.apple.com/app-store/review/guidelines/#privacy) |
| 来源及版权 | **FAIL（小巴新增署名）**。补全 ETA／GeoJSON／CSDI 的双语权利链和采集标记。**PASS（既有来源检查）**。应用铁路、巴士、天气、设施与图件来源有自动检查；签核仍应覆盖此次包内新增数据和截图素材。 |
| ASO 名称、副标题、关键词 | **PASS（候选长度）**。PRD 繁中候选名称 18 字符、副标题 14 字符，均低于 30 字符。**FAIL（候选关键词）**。原串为 73 个码点、173 个 UTF‑8 bytes，超官方 100 bytes；需减少重复和限制内写入，按实际功能选择小巴及其他交通用词，复核商标。**UNKNOWN**。英文最终案和 ASC 字段未确认。 [Apple 产品页](https://developer.apple.com/app-store/product-page/) · [ASC 字段限制](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information) |
| 截图、What's New、Review Notes | **BLOCKED**。须用 RG-02 后签名候选的真实可用界面，制作繁中／英文前三张图及文字。更新说明描述两铁附近、统一收藏、小巴、三个位置和设施精简。Review Notes 交代定位拒绝后可选地标、搜寻及收藏入口、旧库升级和功能门禁。截图及宣传避开未开放的电车、渡轮实时服务。现有材料未确认可直接复用。 [Apple 准确元数据与 Review Notes](https://developer.apple.com/app-store/review/guidelines/#accurate-metadata) |

## 7. 优先级及 RG-02 最小范围

| 优先级 | 状态 | 问题与关闭证据 |
| --- | --- | --- |
| P0 | **PASS（本轮范围）** | 无已证实的不可恢复收藏丢失、生产门禁绕过或凭据外泄。此结论限现有测试及本地静态包。 |
| P1 RG01-01 | **FAIL／UNKNOWN** | 1.2.0 候选版本仍是 1.1.0，远端号未知。RG-02 经用户批准更新营销版本，构建前只读核对 EAS 及 ASC 已占序列与待处理上传，确认生产签名归属。 |
| P1 RG01-02 | **FAIL** | 隐私及定位用途落后。更新双语政策、用途文案与支持页，统一生效信息，核对真实 App Privacy 和在 App 内可访问。做生产 URL 清单和语言回归。 |
| P1 RG01-03 | **FAIL／UNKNOWN** | 小巴来源署名链缺项，新增用途适用条件未闭环。补集中及包内双语出处，给 ETA、GeoJSON、CSDI 分开留证；复核两铁坐标派生物与新首页请求。同一套台账记录巴士／铁路缓存和限流依据。未查明的条件如实记录，存在适用限制时取得书面确认或缩减覆盖。 |
| P1 RG01-04 | **BLOCKED** | 签名候选的隐私清单、Required Reason API、权限、实际版本号和 IPA 生产门禁尚未验证。先关闭前三项的候选输入问题，经批准才建立候选。检查最终归档、真机安装和旧版升级后再分发。 |
| P2 RG01-05 | **FAIL／UNKNOWN** | 压缩繁中关键词，完成英文和双语商店资料。此项及最终截图是公开提交条件，与内部技术验收分开记录。 |
| P2 RG01-06 | **UNKNOWN** | 补 iPhone 性能、VoiceOver 和真实网络样本，记录小巴快照重建、上线时点与车费有效边界。若经复测出现启动阻塞、严重误报或关键操作不可达，升级为 P1。 |

**进入内部 TestFlight 的条件**。RG01-01 至 03 的候选输入和授权范围签核，保留现有门禁。用户确认允许创建生产候选，核验签名归档的版本、权限、Manifest、Required Reason API、生产隔离及夹具结果。以受控设备完成升级与联网／离线验收，无未解决 P0/P1 后才对内分发。外部 TestFlight 和正式上架还须按 Apple 要求完成相应隐私表单、双语截图、元数据和审核说明。

**暂缓**。电车及港九小轮正式接入与收藏、未获授权 ETA、非必要视觉改动，保留现有门禁。运营商未给出配额数字时不得声明无限额度。

## 8. 验证记录

- **PASS** `npm run typecheck`，全量 `node --test scripts/test-*.cjs` 179／179；3 个 Python 生成或验证套件共 17／17（临时 Git 快照，通过本机 `node_modules` 只读解析 TypeScript）。测试以固定样本为主。
- **PASS** 发布标签 v8 隔离升级测试、Expo iOS introspection、带预览变量的生产 Metro／Hermes 静态导出、反汇编抽查、四 URL 的 HTTPS GET、`git diff --check`。没有生成 IPA、运行模拟器、写入 Git 或部署网站。
