# REL-03A1 · Apple Motion 用途说明修复

**GO，建议开发者批准创建 `1.0.0 (2)` 并重新上传。** 已确认 Build 1 触发检查的原生 API、生成后的双语用途说明及 EAS 下一编号。Apple 是否解除 ITMS-90683，须以 Build 2 的实际上传处理结果为准。

## Build 1 与 Apple 通知

EAS 将 Build ID `6d9215f8-db77-4520-af2d-1bee61fa5167` 记录为 `FINISHED`、iOS `production`、`STORE`、`1.0.0 (1)`，实际使用提交 `f331262eb59cfc8fcda515cabfa87f4214f577ba`。Apple App ID `6837312302`。开发者确认 EAS Submit 已传输成功，Apple 上传验证失败。

从 EAS 取得原始 IPA 后，在隔离目录只读提取 Info.plist、语言资源和 Mach-O。IPA SHA-256 为 `e6c008bd67ff6025ef57f13b0d0fc3621ed87075776f987be7398bf6a544b435`。旧 IPA 未修改或重新签名。

| Apple 通知 | 严重程度与证据 |
| --- | --- |
| ITMS-90683 | **上传阻塞**。原始 `KongDaily.app/Info.plist` 及 `en`／`zh-HK` 的 `InfoPlist.strings` 都缺少 `NSMotionUsageDescription`。旧 `expo-location` 插件配置的 `motionUsagePermission: false` 明确删除这个键，仍会编入原生 Motion 实现。 [Apple 受保护资源用途说明](https://developer.apple.com/documentation/uikit/requesting-access-to-protected-resources) |
| ITMS-90725 | **NON-BLOCKING / FUTURE REQUIREMENT**。IPA 的 `DTSDKName=iphoneos26.5`，Mach-O `LC_BUILD_VERSION` 同为 SDK 26.5。Apple 已公告 2027 年 4 月起上传需使用 iOS 27 SDK 或更新版本，引用公告未指定具体日期。后续发布维护须在该期限前验证相容的 EAS 镜像与 SDK，本轮保留现有工具链。 [Apple 2027 年 4 月 SDK 要求](https://developer.apple.com/news/?id=k1mtkt1k) |

## Motion API 来源与实际触发路径

**分类 C，必要的第三方原生库包含静态引用。** IPA 的主执行档与 9 个内嵌 framework 均进行了只读链接扫描。

- `ExpoLocation.framework/ExpoLocation` 链接 CoreMotion，导入 `CMMotionActivityManager`，并包含历史活动查询和持续活动更新的 selector。已锁定的 `expo-location@57.0.23` 在 `LocationModule.swift` 定义独立的 Motion 权限和订阅入口。权限 requester 的历史查询和 streamer 的订阅只在相应入口运行。模块加载时注册 requester 不执行活动查询。
- `KongDaily` 主执行档另有 Reanimated 的 `ReanimatedSensor`、`CMMotionManager` 和装置传感器更新引用。已锁定的 `react-native-reanimated@4.5.1` 在显式注册传感器时才创建传感器对象并启动更新。其余 8 个内嵌 framework 未发现直接 CoreMotion 链接。Apple 邮件未指定具体触发符号，无法将警告归因到单个类。
- App 代码、相关导航代码及目前地图适配层未调用 Motion 权限、活动订阅或 Reanimated 传感器入口。`src/nearby-bus-location.ts` 通过 Core Location 请求前台定位及单次坐标，用于查找附近设施、巴士站和推荐上车站。未安装 `expo-sensors` 或独立的 `expo-device-motion`；`react-native-maps@1.27.2` 的已检查原生源码未出现相关 Motion 调用。
- `expo-location` Pod 将必需的前台定位与活动侦测编在同一个 framework，当前版本没有受支持的 Config Plugin 或 Pod 开关可去掉活动实现。`motionUsagePermission` 只控制 plist。移除该依赖会破坏已验收的定位；只移除 Reanimated 仍会留下已证实的 Expo Location 引用。拆分或补丁依赖会改变本轮以外的原生实现。

## 修复与数据处理

采用方案 B。在 `app.json` 的现有 `expo-location` 插件设置 `motionUsagePermission`，确保原生主 `Info.plist` 含非空用途说明。使用现有 `assets/locales/` 机制提供两种语言。

| 语言 | `NSMotionUsageDescription` |
| --- | --- |
| English 默认值与 `en` | KongDaily's location library includes optional motion activity detection. KongDaily does not use your Motion & Fitness data. |
| `zh-HK` | KongDaily 使用的定位程式庫包含可選的活動偵測功能。KongDaily 不會使用你的動作與健身資料。 |

这次配置变更没有增加调用、权限请求、数据收集、储存或传送路径。目前没有因本次修复而调整 App Privacy 的事实依据，隐私政策和 SDK manifest 保留。最终仍应在候选 Archive 核对 Privacy Report 和实际入包 SDK 声明。

## 核验结果

| 检查 | 结果 |
| --- | --- |
| TypeScript 与 Expo Production Config | **PASS**。 `npm run typecheck`，以及在 Production 环境执行 `expo config --type introspect --json`。 |
| 隔离 iOS Prebuild 与权限 | **PASS**。 `expo prebuild --platform ios --no-install`。生成的主 `Info.plist` 含英文默认用途说明，`Supporting/en.lproj/InfoPlist.strings` 与 `Supporting/zh-HK.lproj/InfoPlist.strings` 含匹配语言文本，均列入 Xcode 资源并通过 `plutil -lint`。ATS 保持全局任意加载关闭；仅有原前台定位和本次用途字符串，无背景模式、Push 或额外 App entitlements。 |
| 定位与地图 | **PASS**。定向执行前台定位流程，覆盖单次定位、权限拒绝／封锁、低精度、取消，测试替身拒绝任何 Motion API 调用。巴士路线图、全域搜索的设施地图和原生深链测试通过。 |
| iOS Metro／Hermes | **PASS**。Production `expo export --platform ios` 生成一个 `.hbc`，共 1,294 个模块。 |
| 资料与范围 | **PASS**。合规脚本通过；正式 Icon、Splash、八张 Explore 照片、隐私政策、业务源码、依赖锁文件和 `eas.json` 与 HEAD 一致。`git diff --check` 通过。 |

## Build 2 与工作区

EAS 只读构建列表只见 `1.0.0 (1)`，`eas build:version:get --platform ios --profile production --json --non-interactive` 返回 `{"buildNumber":"1"}`。现有 `appVersionSource: remote` 和 iOS `autoIncrement: buildNumber` 已保留。实装 EAS CLI 的 iOS 递增函数将 `1` 计算为 `2`。下次以修复后的明确提交执行 Production Store Build，保持 `1.0.0`、`com.lennystudio.kongdaily`、Team `8SSF5V63H9`、Project ID `46b3f4a1-36a6-4a62-aebf-2a65b795e9fd` 和正式资源。若开发者开始构建前远端值已改变，需重查实际下一编号。

Git 开工时为干净的 `develop`。HEAD、本机 `origin/develop` 及 GitHub 只读查询均为 `58536acd52ad5b943d603c1958768927609b03c1`。交付修改 `app.json`、`assets/locales/en.json`、`assets/locales/zh-HK.json`，新增本报告。

**是否可以批准创建 KongDaily 1.0.0 Build 2 并重新上传 Apple？可以。** 开发者批准并提交修复后，检查 Build 2 正式 IPA 的主 plist 与双语资源，再上传 Apple 并确认处理结果。本轮未创建构建、写入远端版本、上传或修改 Apple 签名。
