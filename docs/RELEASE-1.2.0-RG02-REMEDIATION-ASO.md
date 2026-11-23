# KongDaily 1.2.0 · RG-02 发布候选与商店资料

核查日期 2026-11-23（香港时间）。**Production Build · NO-GO。** 候选代码与商店资料已准备好供审阅。远端构建号、政策签核、数据使用的剩余条件和生产环境仍需确认。签名 IPA 与真机原地升级安排在获准创建候选后执行。

## RG-01 三项 P1

| 项目 | 结论 | 证据及剩余事项 |
| --- | --- | --- |
| RG01-01 候选版本 | **PASS（本地）／UNKNOWN（远端）** | Expo 及 iOS introspection 的 `CFBundleShortVersionString` 均为 1.2.0。无本地 `ios.buildNumber`；introspection 生成的默认 `CFBundleVersion` 为 `1`，仅适用于本地配置解析。EAS 与 Apple 构建号未确认。 |
| RG01-02 双语披露及定位 | **PASS（候选文案和自动验证）／BLOCKED（发布）** | 应用内离线政策和支援、同源网站、双语前台定位用途已更新。候选政策 v1.1 标记为审阅，待批准日期及引用；现行网站未部署新版本。App Privacy、原生隐私清单和第三方留存待签核。 |
| RG01-03 小巴来源及授权 | **PASS（署名及快照出处）／UNKNOWN（额外条件）** | 设置的「資料來源與圖片署名」新增双语小巴条目，链接 ETA、GeoJSON 和 CSDI 图层，注明权利归属、采集日期及独立应用身份。公开条款提供有条件商用、复制和分发依据；服务级配额、额外限制和最终发布签核待确认。小巴功能和快照继续保留。 |

RG01-04 签名与原生证据仍 **BLOCKED**，等获得构建授权后才能验证。RG01-05 商店文字已完成，真实截图和 ASC 写入待办。RG01-06 真机冷启动、内存、无障碍和真实网络抽样仍 **UNKNOWN**。

## 版本与构建号

- 工作起点 `develop` 的 `8039bf6` 与本机 `origin/develop` 相差 0／0；工作区开工时干净。已发布标签 `v1.1.0` 与本机 `main` 指向 `796a719`。线上 1.1.0 (Build 3) 以用户记录为准，本轮未能查询 ASC。
- Expo SDK 57，React Native 0.86.3。iPhone-only，Bundle ID `com.lennystudio.kongdaily`，scheme `kongdaily`，既有图标及品牌。本地 introspection 验证 ATS 禁止任意明文加载，无 Always Location 用途或后台定位模式；en／zh-HK 本地化仍接入。
- `eas.json` 仍为 Store／Release production、无 dev client、无模拟器，`cli.appVersionSource=remote`，iOS `autoIncrement=buildNumber`。本机缓存的 EAS CLI 执行下列两个只读命令均遇到 `api.expo.dev` 的 DNS `ENOTFOUND`。从具备权限、网络正常的会话重跑，并核对项目 `@homeypaw/kongdaily` 的待构建及历史 iOS 记录。[Expo 版本管理](https://docs.expo.dev/build-reference/app-versions/) · [EAS CLI](https://docs.expo.dev/eas/cli/)

```sh
eas build:version:get --platform ios --profile production --non-interactive --json
eas build:list --platform ios --limit 10 --non-interactive --json
```

在 App Store Connect 选择 KongDaily → TestFlight → iOS → Build Uploads，查看全部状态、1.1.0 和 1.2.0 的既有及处理中上传，必要时翻查更早的 EAS 构建。记录核对时间、EAS 计数器、Apple 已占版本／构建号及尚未完成任务。任何冲突由发布负责人另行处理；本轮没有写入计数器。获准构建后再从签名 IPA 验证 `CFBundleVersion` 与 EAS/Apple 记录一致。[Apple Build Uploads](https://developer.apple.com/help/app-store-connect/manage-builds/view-builds-and-metadata/)

## 隐私与支援同步

| 表面 | 候选结果与同步步骤 |
| --- | --- |
| App 内离线政策与支援 | 设置内现有入口继续可离线打开。同源文案说明 Nearby 首次前台授权及地标替代、四种交通与设施收藏及三个首页置顶的本机储存、系统备份、交通 ID 请求及小巴编号和地区查询、地政总署地点搜索、MapKit 和外部导航、天气、Vercel 及支援邮件。保留 Lenny／Lenny Studio、既有邮箱和经批准的支援邮件留存规则。 |
| iOS 用途提示 | 英文默认值和两个本地化文件均覆盖公共交通站点、生活设施及距离。实际提示语言由 iOS 系统设置验证。 |
| 官网 Privacy／Support | 仓库内同源文案由网站静态生成器读取。待用户批准两种语言、核对服务商及邮箱的处理条件后，保留最初生效日 2026-11-20，把 `publication.updatedOn` 设置为实际获批更新日期（香港时间），在 `website/release.json` 写入本次批准记录。运行 `node website/build.cjs --check-release` 和 `--release`；授权部署后运行 `--check-live`，核对四路径与应用所用版本。当前 release 校验按预期阻止未批准政策发布。域名、路径、联系人、原始首次部署时间和图片批准均沿用。 |
| ASC App Privacy | **UNKNOWN／BLOCKED**。签核前查阅实际表单、聚合 Privacy Manifest 和第三方证据。对照定位（本机计算与 Apple 原生服务分开）、地政总署的地址文字和端点日志、交通服务的查询标识和 IP、Vercel 网站日志及主动发送的支援邮件；逐项确认接收方、是否超过实时服务需要而留存、用途、关联身份及可用例外。确认 MapKit／FileSystem 及依赖的 Required Reason API。公开政策文案、定位用途和 App Privacy 问卷各自独立核对。 [Apple App Privacy](https://developer.apple.com/app-store/app-privacy-details/) |

既有 ASC URL，发布时逐一确认字段及页面语言：

| 语言 | Privacy Policy | Support |
| --- | --- | --- |
| 繁中 | [私隱政策](https://kongdaily-site.vercel.app/privacy/) | [支援](https://kongdaily-site.vercel.app/support/) |
| English | [Privacy Policy](https://kongdaily-site.vercel.app/en/privacy/) | [Support](https://kongdaily-site.vercel.app/en/support/) |

## 小巴数据与授权

| 输入／用途 | 结论及依据 |
| --- | --- |
| 运输署 ETA 及路线路径，目录校验 | **PASS（官方出处）**。运输署数据集列路线列表、详情、站点、站序、ETA 等 API；规范 v1.1 描述公开 GET 和生成时间。ETA 每分钟更新、其他数据按需更新。项目设备直连 HTTPS，以公开路线、地区、站点等标识查询；同键合并、8 秒总超时、ETA 60 秒最短重读间隔及 429 退避。**UNKNOWN**。未从所阅公开资料验证额外商业条款、固定配额、登记要求、日志留存或缓存上限。更新周期无从证明调用配额。[运输署资料集](https://data.gov.hk/en-data/dataset/hk-td-sm_7-real-time-arrival-data-of-gmb) · [API 规范](https://data.etagmb.gov.hk/static/GMB_ETA_API_Specification.pdf) |
| 运输署 GeoJSON，离线安装包主要输入 | **PASS（来源和公开条款依据）**。下载资源列运输署为提供者，门户标注 2026-11-19 更新、双周更新。现有快照记录内部最新数据日 2026-11-17 和实际 2026-11-22 采集，三个日期分别保留。DATA.GOV.HK 条款允许符合条件的商用复制及分发（包括数字副本），要求来源、权利人及门户署名，并有赔偿义务和外链范围。未发现该资源页面另列注册或专属许可。**UNKNOWN**。发布负责人仍须核对额外权利保留及是否有其他适用条件，确认含派生索引的安装包版式和条款接受记录。[GeoJSON 资源](https://data.gov.hk/en-data/dataset/hk-td-tis_23-routes-fares-geojson/resource/ede023b4-f470-4edf-b1a0-dc6713e6021e) · [DATA.GOV.HK 条款](https://data.gov.hk/en/terms-and-conditions) |
| 运输署 CSDI 方向图层，覆盖比对 | **PASS（官方出处与公开条款）**。同一运输署数据集直接链接该图层。CSDI 第 3 条允许符合条件的商用下载、复制、分发，要求标明政府与 CSDI、承认政府及相关机构知识产权，并承担适用赔偿义务。生成器用 ID、方向和编号核对覆盖，不把 CSDI 原始几何图层随包分发。**UNKNOWN**。未确认服务级访问频率或额外缓存限制。[官方方向图层](https://portal.csdi.gov.hk/server/rest/services/common/td_rcd_1697082463580_57453/FeatureServer/0) · [CSDI 使用条款](https://static.csdi.gov.hk/csdi-webpage/doc/TNC) |
| 派生范围与再生成 | **PASS（随包数据）**。只见上述运输署输入。索引含 572 个地区＋路线编号（港岛 107／九龙 133／新界 332）、779 个路线 ID、1,164 个方向、4,773 站和 13,107 次停靠，其中 4,713 站及 11,943 次停靠可上客。采集日为 2026-11-22，输入 SHA-256 随资产版本保存。用保存的三个原始输入和采集日重跑生成器，核对哈希、编号与方向覆盖、变化及署名后随未来版本发布；无启动时全量下载。若原始样本丢失，以新下载建立新一版，重新记录三份哈希和差异。 [快照](../assets/data/gmb-nearby.json) · [生成器](../scripts/build-gmb-nearby.py) · [覆盖证据](PHASE-4A1C-GMB-NEARBY.md) |

**未关闭时的处理**。发布负责人保留条款版本及核查日，必要时向运输署公开联系渠道确认设备直连、真实调用规模、短时缓存、App Store 包含派生索引及是否有第三方权利或额外条件。若只有某一来源的再分发受限，先核实可替代的获许可官方输入；若只有调用能力待确认，独立评估更保守的请求策略与用户影响。需要缩减小巴覆盖或功能时另行取得用户批准，更新文案与截图并重新验收。RG-01 对巴士／铁路缓存与配额、铁路坐标派生数据的剩余事项仍需一并签核。没有官方合作或认可声明。

## App Store ASO 可粘贴资料

品牌 **KongDaily** 在两种名称开首。繁中名称及副标题沿用批准稿。关键词逗号分隔、UTF-8 字节数包含逗号。省略品牌、公司名、其他 App 名和重复的完整词条；运营商名称只在描述实际功能时使用。遵循名称／副标题各 30 字符、关键词 100 bytes 的限制。此方案优先增强品牌精确匹配与产品页理解，排名仍受 storefront、索引和其他因素影响。上架后用香港 storefront 分别检查精确品牌词及两个语言产品页。 [Apple 字段与限制](https://developer.apple.com/help/app-store-connect/reference/app-information/app-and-compliance-information) · [平台字段](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information) · [App Store Search](https://developer.apple.com/app-store/search/)

| 字段 | 繁中 | English |
| --- | --- | --- |
| App Name | `KongDaily - 香港交通生活` · 18 字符 | `KongDaily - Hong Kong Transit` · 29 字符 |
| Subtitle | `巴士到站・港鐵輕鐵・天氣公廁` · 14 字符 | `Bus & Rail Arrivals, Weather` · 28 字符 |
| Keywords | `專線小巴,車站搜尋,路線查詢,寵物公園,行山地點,即時班次,附近設施` · **90 bytes** | `minibus,metro,light rail,nearby stops,route search,public toilets,parks,hiking,commute` · **86 bytes** |

### App Description · 繁中

```text
在香港出門，先看看附近有甚麼車、下一班幾時到。KongDaily 把巴士、港鐵、輕鐵和綠色專線小巴放在同一個交通查詢入口。

• 查路線與站點：查看附近可乘搭的路線，或搜尋其他地區的路線和站點。你可使用目前位置，亦可手動選擇地標。
• 看即時預報：查看營辦商或運輸署提供的預報。資料因路線、站點及服務狀況而異。
• 收藏常搭服務：收藏指定路線和上車站，任選最多三項置頂到首頁。
• 找生活設施：查閱天文台天氣及警告，在地圖或清單找公廁、公園和寵物公園，或瀏覽精選探索地點。

提供繁體中文和英文。收藏存於裝置，毋須開設帳戶。部分路線及站點資料可離線查看，即時預報需要網絡。
```

### App Description · English

```text
See what’s nearby and when the next service is due. KongDaily brings Hong Kong buses, MTR, Light Rail and green minibuses into one transport search.

• Find routes and stops near you, or search across Hong Kong. Use your location or choose a landmark.
• Check live predictions from the relevant operators and the Transport Department, where available.
• Save the services you take often and pin up to three to Home for quick access.
• Check Observatory weather and warnings, find public toilets, parks and pet parks on a map or in a list, and browse selected places to explore.

Available in Traditional Chinese and English. Favourites stay on your device and no account is required. Selected route and stop information is available offline. Live predictions require a connection.
```

### What's New · 繁中

```text
• 新增綠色專線小巴路線查詢、附近站點、站序及到站預報。
• 港鐵和輕鐵加入附近查詢及全域搜尋，方便比較附近站點和可乘搭路線。
• 巴士、港鐵、輕鐵及小巴共用最多三個首頁置頂位置，可在「收藏」調整順序。
• 簡化附近生活設施及交通介面。首次使用附近功能時可允許定位，也可手動選擇地標。
```

### What's New · English

```text
• Find green minibus routes and nearby stops, see the full stop sequence, and check arrival predictions where available.
• Find MTR and Light Rail routes and stops through Nearby and Global Search.
• Save buses, MTR, Light Rail and minibuses in one place. Pin up to three services to Home and reorder them in Saved.
• A simpler Nearby layout makes facilities and transport easier to browse. Use your location or choose a landmark.
```

### 前三张截图

| 顺序 | 繁中标题／English headline | 真实页面和卖点 |
| --- | --- | --- |
| 1 | 常搭交通，一眼看預報／Your rides, at a glance | 首页「常用公共交通」，用真实服务置顶巴士、港铁、轻铁或小巴中的三项，显示自然取得的有效预报，突出混合置顶。 |
| 2 | 附近有甚麼車？／Find transport nearby | 附近交通的专线小巴分类，用已选的公开地标展示真实附近线路、方向及实际直线距离。 |
| 3 | 路線與車站，一次搜尋／Search routes and stops | 首页全域搜寻，用实测关键词选择可见的交通路线或车站结果，显示明确类别，体现四种交通共用入口。 |

同一签名候选分别捕获繁中及英文的真实 iPhone 页面。隐去个人位置及状态栏私人信息。外框可加相应短标题，保留可读的实际界面与状态。截图与其他公开元数据仅宣传已开放功能；上载前以 ASC 当前要求核对实际尺寸。 [Apple 截图规格](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications)

**Review Notes 草稿**。No account is required. Open Transport from Home to search for buses, MTR, Light Rail and green minibuses. If location is denied, choose a landmark to view Nearby results. Save a service from its details, then pin or reorder up to three services in Saved. This update migrates existing local favourites and Home pins. Tram and ferry features are unavailable in the App Store build. Review Settings for the Privacy Policy and Data Sources.

## 验证、修改文件与验收

| 项目 | 结果 |
| --- | --- |
| TypeScript、全量 CJS、Python | **PASS**。TypeScript 无错误。CJS 182／182，含合规、4D3／4D4、缺省门禁、超时与断网恢复、四种收藏和共享置顶等；三套未改动的 Python 测试在隔离快照运行，17／17。 |
| SQLite v8 → v11 | **PASS（自动）**。新增可重跑的标签测试，逐字对比 `v1.1.0` 的原始八段 SQL，用原标签 Schema 和合成旧数据验证旧表完整、置顶相对顺序、完整性、注入 v11 失败后回滚、重试、重开及关闭库文件副本恢复。v10 孤立置顶、三槽及排序回归通过。真机原地升级和 iOS 系统备份恢复 **UNKNOWN**。 |
| iOS Metro／Hermes | **PASS（静态）**。以默认生产模式、禁用本地 dotenv 并显式设 `EXPO_PUBLIC_HKKF_PREVIEW=1` 导出并反汇编 7,138,253 bytes Hermes 文件。渡轮预览模块／码头查找文案和抽查独有坐标无命中；近站索引来源哈希及新署名可见。抽查无测试样本路径、`.env.local` 或常见凭据形态。正式配置、路由与搜索回归证明渡轮禁用、电车分类及搜索隐藏并拦截直接详情。适配器和不可用界面字符串仍可随包保留，电车静态索引继续保留。EAS 远端注入、签名归档资源和真机生产隔离仍 **UNKNOWN**。 |
| 官网与配置 | **PASS（候选）**。合规套件覆盖本地双语预览、静态路由及内容、审核后页面生成、发布校验。真实网站 release 检查保留审批门禁。Expo iOS introspection 和 `git diff --check` 通过。 |

本轮修改 [app.json](../app.json)、[en.json](../assets/locales/en.json)、[zh-HK.json](../assets/locales/zh-HK.json)、[双语隐私及支援](../content/compliance.json)、[网站发布签核配置](../website/release.json)、[数据署名](../src/compliance-credits.ts)、[合规回归](../scripts/test-compliance.cjs)、[迁移回归](../scripts/test-facility-favorites.cjs)及本报告。SQLite Schema、业务逻辑、源快照、EAS Profile 和门禁无变更。工作区改动未提交。

### iPhone 人工验收

1. 用可控制设备保留线上 1.1.0 的巴士收藏、置顶顺序、设施收藏和偏好。获准建立并核验签名候选后原地升级，检查数据及顺序、冷启和重启。可行时在控制设备测试系统备份／恢复，避免覆盖主力机数据。
2. 在权限未决定时分别检查 Nearby 设施和交通的系统提示；拒绝后使用手动地标并检查结果。切换两种语言，打开设置内政策、支援及小巴三项官方来源；同步官网后对照版本与公开 URL。
3. 混合收藏四类交通，验证三项上限、2 → 3 隐藏新增、3 → 2 恢复、返回及冷启无闪现。抽查港铁方向、轻铁路线和小巴循环停靠，断网及重连后留意 ETA 状态、真实时效及前后台停刷。
4. 检查电车分类及全域结果隐藏、已知旧电车／渡轮链接无法进入可用详情。以 VoiceOver、大字号和较旧 iPhone 检查导航、冷启动、地图和并发刷新。
5. 通过后抓取实际截图，确认两个语言的 ASC 文案、URL 与 App Privacy。检查现有巴士车费资料在 2026-12-02 00:00 HKT 到期的自动隐藏行为，发布负责人决定是否另行刷新。

**解除 NO-GO 的条件**。发布负责人签核远端计数器与 ASC Build Uploads 对照、生产环境与签名归属、双语披露及官网同步安排、数据授权与提供商条件。取得用户明确授权后才创建生产候选。归档阶段再检查实际构建号、entitlements、聚合 Privacy Manifest、Required Reason API、生产门禁与资源清单，并完成真机原地升级。之后才决定内部 TestFlight；公开分发另须通过 App Privacy、官网、截图和审核资料核验。

本轮未生成 EAS Build、未启动模拟器、未部署网站、未修改 ASC，亦未执行 Git 写操作。
