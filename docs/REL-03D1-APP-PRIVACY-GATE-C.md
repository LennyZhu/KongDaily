# REL-03D1 · Build 2 App Privacy 与 Gate C

审计日期为 2026-11-21（香港时间）。

## 第一题结论

**NO-GO，暂不保存「是」或「否」。** 对同版签名 IPA 和源码的核对表明，App 的前台 GPS 和全域搜索词没有直接发送给 KongDaily 后端或业务 API。Apple 自己通过 MapKit、定位服务等收集的数据有明确的申报边界。与此同时，Nearby 会向 LandsD 发送实际搜索文字，巴士和天气会发送功能请求。可取得的资料未确认这些端点或网关能否在实时响应后继续读取相关日志。包内空的收集数组不足以支持「否」，目前也没有足够的端点证据支持把某一类写成已证实的 App 内收集。

Apple 的 Collection 要求资料离开装置，并可由开发者或适用的第三方在完成实时请求所需时间之后访问。仅本机处理不计入。Apple 对 MapKit、CloudKit 等服务另有说明，Apple 自己收集的数据无需代称为本 App 收集，开发者从这些服务取得并收集的数据仍须按实际使用披露。是否关联身份与是否用于追踪是独立问题。App 上传处理和 TestFlight 安装通过属于开发者已确认的构建状态。 [Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)

## 正式候选包证据

| 核对项 | 结果 |
| --- | --- |
| EAS 来源 | `@homeypaw/kongdaily` 的 iOS `production / STORE / FINISHED`，Build ID `20a0f92e-04b0-463c-97cc-93b52cb958de`。记录的提交为 `f35d593f538e02803082e13dfb71b906c1b2675e`，与项目源码基线一致。Apple App ID `6837312302` 由开发者提供。 |
| IPA 身份 | 下载 EAS 提供的现有 IPA，在隔离目录解包。SHA-256 为 `c836db69b4f92fbb87929fc1c6fc08f4de3089f4af9e62985741fa0f0b119a92`。主 plist 为 `com.lennystudio.kongdaily`、`1.0.0 (2)`、iPhone 家族 1、SDK `iphoneos26.5`；嵌入签名的 Team Identifier 为 `8SSF5V63H9`。 |
| 定位与 Motion | 主 plist 包含 `NSLocationWhenInUseUsageDescription` 与 `NSMotionUsageDescription`；两项均在包内 `en.lproj`、`zh-HK.lproj`。无 Always Location、后台模式或 ATT 用途字符串。签名 entitlement 键检查未见推送、HealthKit 或 Associated Domains。Motion 字符串说明定位库包含可选侦测而 KongDaily 不使用动作与健身资料。 |
| 核验方法 | 对 IPA ZIP 中全部 `.xcprivacy` 解析 plist。检查动态 framework、主执行档链接／符号、Xcode 构建日志、Hermes 成品中的运行时端点与政策文案，再核对对应提交的代码和依赖锁。未安装、运行、修改、签署或上传 IPA。 |
| Xcode Privacy Report | EAS 可取得 IPA 与构建日志，未取得原始 `.xcarchive`。Xcode Organizer 的原始归档综合 Privacy Report 未生成。本报告是包内实际文件、依赖源码、构建日志和供应方公开资料的审计，不替代该报告。 [Apple Privacy Manifest](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files) |

## 九份实际入包的隐私清单

路径相对于 `Payload/KongDaily.app/`，每行目录下的文件均为 `PrivacyInfo.xcprivacy`。九份的 `NSPrivacyCollectedDataTypes` 均为空，`NSPrivacyTracking` 均为 `false`，无非空追踪域名。Required Reason API 解释本地 API 使用，不能从这些理由推出服务器收集或留存情况。

| 包内目录 | 实际 Required Reason API 与理由 |
| --- | --- |
| App 根目录 | UserDefaults `CA92.1`，File Timestamp `C617.1`，System Boot Time `35F9.1` |
| `React-Core_privacy.bundle` | File Timestamp `C617.1`，UserDefaults `CA92.1` |
| `React-cxxreact_privacy.bundle` | File Timestamp `C617.1` |
| `React-timing_privacy.bundle` | System Boot Time `35F9.1` |
| `ExpoConstants_privacy.bundle` | UserDefaults `CA92.1` |
| `ExpoLocalization_privacy.bundle` | UserDefaults `CA92.1` |
| `Frameworks/ReactNativeDependencies.framework/ReactNativeDependencies_folly.bundle` | File Timestamp `C617.1` |
| `Frameworks/ReactNativeDependencies.framework/ReactNativeDependencies_glog.bundle` | File Timestamp `C617.1` |
| `Frameworks/ReactNativeDependencies.framework/ReactNativeDependencies_boost.bundle` | File Timestamp `C617.1`，System Boot Time `35F9.1` |

### SDK 归属及清单差异

- **Maps。** 提交锁定 `react-native-maps@1.27.2`。Xcode 日志确有 AirMaps 编译，IPA 主执行档有 `AIRMapManager`、`RNMapsAirModule` 和系统 `MKMapView`。包内未见 Google Maps SDK 或其隐私 bundle。对应源码包的 iOS manifest 确实标记 `PreciseLocation`、`App Functionality`、linked=false、tracking=false 和 File Timestamp `C617.1`，SHA-256 为 `05d0f3e830f40883cc0c8a8de19656c2c2be6c760043705096518dc86109be32`。它没有出现在 Build 2 九份清单中，主清单的 collection 也没有该条。该版默认 AirMaps podspec 没有将这份 manifest 登记为资源。源码声明不能直接解释具体接收者或留存，也不应因未入包而忽略。现有证据仅指向系统 MapKit 供应商，仍需确认此声明是否泛用于 MapKit、自定义 GPS 叠加和其他集成路径。 [该版 podspec](https://github.com/react-native-maps/react-native-maps/blob/v1.27.2/react-native-maps.podspec) · [Apple Maps 私隐说明](https://www.apple.com/legal/privacy/data/en/apple-maps/)
- **Location 与 Motion。** `expo-location@57.0.23` 在锁文件中，IPA 实含 `ExpoLocation.framework`，有 Core Location 和 Core Motion。主执行档另有 `react-native-reanimated@4.5.1` 传感器实现。App 使用前台定位获取单次坐标；Build 2 源码未发现调用 Motion 或 Reanimated 传感器入口。用途字符串和依赖引用没有证明 Fitness 收集。没有发现独立 Expo Sensors/HealthKit 模块或调用。 [Motion 证据](REL-03A1-APPLE-MOTION-PURPOSE-REMEDIATION.md)
- **Expo、React Native、Hermes。** 锁定 Expo `57.0.33`、React Native `0.86.3`、Expo Router `57.0.31`、FileSystem `57.0.7`、Constants `57.0.24`、Localization `57.0.2`、SQLite `57.0.5`、Splash `57.0.11`。IPA 的九个动态 framework 为 ExpoFileSystem、ExpoFont、ExpoLocation、ExpoModulesCore、ExpoModulesJSI、ExpoModulesWorklets、React、ReactNativeDependencies、hermesvm。版本以对应提交锁定记录和有版本的资源 bundle 为据，framework 的通用 `1.0` 不是 npm 版本。构建日志还列出 Expo Asset、Linking、UI、DomWebView、LogBox、SQLite、Splash、LinearGradient、Symbols 以及 RN Gesture Handler、Screens、Reanimated、Worklets、Safe Area 等 Pod；主执行档可见 SQLite、Splash 等符号。未将构建目标清单视为每个功能的动态执行证明。
- **FileSystem Required Reason 风险。** `ExpoFileSystem_privacy.bundle` 在 IPA 中只有 `Info.plist`。Xcode 日志记录了该 bundle 的 plist 处理，未找到其 manifest 的复制记录。已锁定 SDK 源码声明 File Timestamp `0A2A.1`／`3B52.1` 和 Disk Space `E174.1`／`85F4.1`，后两者及前述 SDK 专属理由在包内清单中均无。Build 2 framework 确有文件系统容量接口引用。此为实际打包差异，需要核对归档和适用理由，尚无证据表明 App 因此发送文件或容量信息，也未据此推断 Apple 已判定违规。SDK 专属理由应核实归属和适用性后再处理，不宜直接复制到 App 根清单。 [Expo Privacy Manifests](https://docs.expo.dev/guides/apple-privacy/) · [Apple 理由分类](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitype)
- **Analytics、Crash Reporting、广告和追踪。** 未在该提交的产品依赖、源码调用、IPA 动态链接、已检查的原生类名及 Hermes 常见供应方端点找到 Sentry、Firebase/Crashlytics、Meta、广告、ATT/IDFA 或类似的上报集成。未找到由 App 发送帐户、广告或自定义装置标识符的路径。诊断显示、OS 日志及 Apple 自己的 TestFlight／系统诊断和独立第三方服务要分别核实。本轮未做真机抓包，静态证据无法排除所有系统行为或外部日志。

## 数据处理矩阵

| 数据／用途 | 离开装置与接收方 | 实时后可读、Apple Collection | 身份关联与 Tracking |
| --- | --- | --- | --- |
| 前台 GPS、精确／近似位置，附近距离和站点候选 | App 通过 Core Location 单次读取坐标，本地计算。无后台定位或位置历史。未作为原始坐标字段发送给 LandsD、巴士、天气或自建服务。MapKit 和派生参数见下。 | 本机部分 **不收集**。iOS 系统服务可按用户设置独立处理。 | 本机坐标不因使用权限而成为 linked 收集；App 未发现追踪。 [前台定位](../src/nearby-bus-location.ts) · [Apple Location Services](https://www.apple.com/legal/privacy/data/en/location-services/) |
| 原生 MapKit，视口、附近地图聚焦与标记 | 实际使用 Apple MapKit。即使 `showsUserLocation=false`，App 仍可把 GPS 作为自定义标记或聚焦区域交给原生地图；底图及视口可能经 Apple 服务处理。 | Apple 自己收集的地图资料不计入本 App 申报。未见非 Apple 地图接收方或运营者收集地图遥测的本地证据；SDK 版本声明的接收者及作用范围待确认。 | 已检查集成未见帐户或广告关联。供应商 manifest 的 linked=false、tracking=false 仅是其声明，不能代替具体路径证据。 [附近地图](../src/components/nearby-facilities-map.tsx) · [Apple 地图例外](https://developer.apple.com/app-store/app-privacy-details/#additional-guidance) |
| Nearby 查询文字，可能含地址；来源 IP 与连接信息 | 符合条件的文字经 `GET /gs/api/v1.0.0/locationSearch?q=…` 发给 `www.map.gov.hk` 的 LandsD。应用自设 `Accept`，不附发送者 GPS、账号、视口或自定义装置 ID。接收端可见连接 IP，仍须区分系统标头、服务端可能设置的标识与 App 明确发送的资料。 | **待确认。** 本机查询及回覆暂存内存，缓存重用期限五分钟；公开 API 文件未说明查询、IP 或可关联日志是否在实时处理后仍可读取。GeoInfo Map 网站的访客政策没有证明该 API 的做法。 | 没有 KongDaily 帐户。原始地址、IP、cookie／网络标识或其他日志的组合仍可能关联个人或装置；linked 与再用途待证。未见产品追踪路径。 [请求代码](../src/landsd-location-search.ts) · [LandsD API](https://portal.csdi.gov.hk/csdi-webpage/apidoc/LocationSearchAPI) |
| 巴士路线、站点、变体、ETA；设备位置派生的附近站点 | `data.etabus.gov.hk`（九巴／龙运），`rt.data.gov.hk`（城巴及屿巴资料服务／网关）。发送公开路线、方向／服务类型、站点 ID 等；部分路线或站点请求由收藏或设备位置计算后的附近选择触发。原始 GPS 或收藏库未随请求。 | **待确认。** 公开 ID 本身是交通数据，保留与 IP／会话等连接信息可关联的选站、查询时序或推断的位置时，应另核对 Apple 数据分类。API 规格没有证实端点或网关何时清除可读日志。 | App 无用户 ID，服务端是否把请求与用户或装置关联待证；未见追踪用途。 [ETA 代码](../src/bus-eta.ts) · [九巴 API](https://data.etabus.gov.hk/datagovhk/kmb_eta_api_specification.pdf) · [城巴 API](https://www.citybus.com.hk/datagovhk/bus_eta_api_specifications.pdf) |
| 天气数据类型、语言和连接信息 | `data.weather.gov.hk/weatherAPI/opendata/weather.php`（香港天文台）。发送 `dataType`、`lang`，连接可显示 IP；不附 GPS 或帐号。 | **待确认。** 天文台一般网站政策说明有使用记录，不能直接确定 KongDaily 使用的 Open Data API 字段、用途、可读期间或去识别。天文台自己的 MyObservatory 另有说明。 | App 不附身份；若服务保留或复用 IP，需确认是否可关联及用途。无产品追踪证据。 [天气代码](../src/weather-data.ts) · [HKO API 规格](https://www.hko.gov.hk/en/weatherAPI/doc/files/HKO_Open_Data_API_Documentation.pdf) · [HKO 私隐政策](https://www.hko.gov.hk/en/privacy/policy.htm) |
| 全域搜索、SQLite 收藏、语言、浏览状态和快取 | 全域搜索本机匹配，更新巴士目录不送搜索字词。SQLite 保存收藏、置顶、语言、最多八笔巴士最近搜索和官方数据缓存；可随用户 iOS 系统备份。根据收藏刷新 ETA 时发送所需公开路线和站点 ID。 | App 的本机资料与仅由 Apple 控制的备份不作为 KongDaily Collection；个别业务请求见巴士行。 | 无 KongDaily 帐户同步或追踪。 [本机搜索](../src/global-search.ts) · [SQLite](../src/database.ts) |
| Motion／Fitness、标识符、性能、崩溃和广告 | 没有找到 App 发起的 Motion／Fitness 请求、广告身分或自主上报。服务器通常可接收 IP、时间和网络层信息；第三方独立运维日志另核对。 | **无 App 开发者／集成 SDK 主动收集证据**；不从本地 Console 或 TestFlight 成功安装推断收集。若运营者另行接收可读 Apple 诊断或测试反馈用于运营，另核对其实际范围。 | 未见跨公司广告关联、广告衡量或数据经纪。未知端点后续用途不写成已证实否定。 |
| 用户选择外部地图、官方来源、政策或支援邮件 | 外部导航 URL 传选定公共设施或步道起点坐标及步行模式，不传当前 GPS；外部地图按其权限另行定位。站点浏览由外部系统处理。App 的 `mailto:` 只有固定收件地址，不预填用户内容；用户在外部邮件程序发送后，运营者取得可能包括姓名、地址、描述和附件的来信。 | 网站、外部导航与 App 内直接查询分开。运营者对主动支援来信承诺结案后最长 12 个月，法律例外；这是已披露的运营留存，未发现 App 内表单、上传或 App 自动传送邮件内容。若 Apple 将该入口纳入 `from this app`，应按实际填写支援类别，不能仅因流程可选就套用可省略披露。 | 支援邮件可与地址或姓名关联，用于处理来信，未见用于广告追踪。第三方网站、邮件服务和外部地图的独立处理适用其政策。 [导航](../src/facility-navigation.ts) · [邮件入口](../src/compliance-content.ts) · [支援保留流程](operations/SUPPORT-EMAIL-RETENTION.md) |

## App Store Connect 字段建议

以下为取得所列证据时的映射，本轮没有提交或核准勾选。只要确认一项属于必须披露的收集，第一题即可判为「是」，其余类别仍按证据逐项完成。

| 触发证据 | 子类型与用途 | Linked／Tracking |
| --- | --- | --- |
| LandsD 等适用的接收方在完成请求后仍可查看 Nearby 原始查询 | **Search History**，功能检索为 **App Functionality**；若还明确用于使用统计或产品研究，加 **Analytics**。仅在实际处理可联系个人的住址字段等情形另评估 **Contact Info → Physical Address**。普通景点地址不可一概当作用户住址。 | 按保留下来的 IP／装置标识、原文与关联方式判断。只有能证实采集前去识别并无后续重连才选未关联。查询日志本身不代表 Tracking，须核对广告、广告衡量或经纪分享。 |
| 证实适用的非 Apple SDK／服务收集用于描述用户或装置的坐标，或由 IP／附近站点推断并留存位置 | **Location → Precise Location／Coarse Location**，按实际储存或可访问精度。地图或路线功能为 **App Functionality**。公共导航目的地和 Apple 自己的 MapKit 数据不据此自动勾选。 | 仅在供应商明确证实 Build 2 路径适用时沿用 linked=false／tracking=false；未知时保持待核实。 |
| 证实保留 IP、可串联会话的标识或业务行为及诊断 | 按用途核对 **Identifiers → Device ID**、**Diagnostics → Other Diagnostic Data**、**Usage Data → Product Interaction** 或 **Search History** 等。IP 临时用于回应无需披露；持久保存并用于定位再映射相应 Location。用途按实际运维功能或分析证据填写。 | IP 存在不等于 Device ID，也不等于 Tracking；看持久使用及接收方做法。 |
| Apple 确认为 App 范围内的可识别支援来信 | **User Content → Customer Support**、收到的 **Contact Info → Email Address**，若实际收集发送者姓名则加 **Name**；若 Apple 要求区分储存的邮件原文，复核 **Emails or Text Messages**。用途 **App Functionality**。 | 可关联邮件发送者，用途为支援，不用于 Tracking。可选披露需逐项符合 Apple 条件。 |

Apple 对单纯实时转发、IP 依用途分类、自由文本和可选客户支援有专门规则。当前不启用 ATT 或追踪标签，待确认的第三方数据不得提前标作未收集或未关联。 [Apple 数据类型、用途及追踪定义](https://developer.apple.com/app-store/app-privacy-details/)

## 双语隐私政策一致性

- **已核对。** 对 EAS 提交的 `content/compliance.json` 和正式 Hermes bundle 比对，繁中、英文的定位、本机资料、在线第三方及保留删除四组各 11 段逐字存在。执行 `node website/build.cjs --check-live`，两个正式政策页均返回 200，HTML 与核准的 v1.0 同源内容一致，生效日为 2026-11-20。
- 内容如实区分了前台定位、本机 SQLite 和全域搜索、LandsD 可能收到地址与 IP、Apple 和外部地图、独立网站与主动支援邮件。公开政策明确表示 LandsD 的公开 API 文件未说明日志或期限。巴士及天气段落已说明实际请求字段，第三方留存以适用政策处理。现有证据没有发现已批准两语政策与 Build 2 运行路径矛盾。若取得 SDK 或端点新增的实际收集、留存、关联或再用途证据，需一起复核 App Privacy 与政策内容。正式网站及 App 政策均未修改。 [繁中](https://kongdaily-site.vercel.app/privacy/) · [English](https://kongdaily-site.vercel.app/en/privacy/)

## 最小闭合事项

1. **端点留存。** 向 LandsD 的 GeoInfo Map Support Team（`geoinfomap@landsd.gov.hk`）优先核实精确端点的 `q`、IP、UA、cookie／会话等数据是否在回覆后仍可访问，确认接收者、最长期限、代理／备份、用户或装置关联，以及是否重作分析、广告或分享。请 HKO（`mailbox@hko.gov.hk`）、九巴／龙运端点运营者和 `rt.data.gov.hk` 网关／城巴／屿巴以相同口径确认连接和查询日志。只凭 API 响应或未经认证的公开页面无法核实服务端留存。 [LandsD 官方联系人](https://portal.csdi.gov.hk/csdi-webpage/apidoc/LocationSearchAPI) · [HKO 政策联系人](https://www.hko.gov.hk/en/privacy/policy.htm)
2. **SDK 及 Archive。** 取得相同提交和配置的原始 `.xcarchive` 及 Pod 版本锁，使用 Xcode Organizer 的 **Generate Privacy Report**。对照实际用途和 App Store Connect 收到的任何 Required Reason 通知，查清为什么 ExpoFileSystem 只留下资源 bundle 元数据、其 SDK 理由是否应补齐。请地图 SDK 维护方确认 `PreciseLocation` 的适用 provider、接收者、可读留存与身份关联；若确认只有 Apple MapKit，适用 Apple-only 排除，不将该字符串硬选为 App 收集。必要时由开发者另行授权使用测试设备观察目的主机并对照有／无定位；网络观察不能证明服务器不保留。
3. **外部支援范围与最终填表。** 如果仍不确定直接调用公开 API 的合作方范围或外部 `mailto:` 支援是否属于本 App，向 Apple Developer Support 以精确流程求证，并核对运营者实际读取的 Apple 诊断／反馈。确认至少一类适用收集后填写「是」及对应字段；只有证实所有 App 范围内的路径均无需披露时才能填写「否」。

## Git 状态

开工时 `develop` 干净。HEAD、本地 `origin/develop` 与 GitHub 只读查询均为 `f35d593f538e02803082e13dfb71b906c1b2675e`。工作区仅新增本报告，`git diff --check` 通过。未创建构建、部署、提交、推送或操作 App Store Connect。
