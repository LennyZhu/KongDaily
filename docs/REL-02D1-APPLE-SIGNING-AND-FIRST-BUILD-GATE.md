# REL-02D1 · Apple 签名与首包准入（REL-02D2／REL-03A 更新）

**签名 PASS。首次 Production Build 暂为 NO-GO，仅待 App Store Connect 确认 `1.0.0 (1)` 未被占用。** EAS 当前没有 iOS 构建记录，远端 Build Number 为 `UNINITIALIZED`。

## Git 与发行身份

`develop`、本地 `origin/develop` 和 GitHub 只读查询均为 `f331262eb59cfc8fcda515cabfa87f4214f577ba`，提交差异 0／0。REL-02D0 的 EAS 关联已提交。工作区仅有本报告，暂存区为空。App 源码、发布配置和资产与 HEAD 一致。

| 项目 | 核对结果 |
| --- | --- |
| Expo 项目 | `eas project:info` 与远端元数据确认 `@homeypaw/kongdaily`，Project ID `46b3f4a1-36a6-4a62-aebf-2a65b795e9fd`，与 `app.json` 一致。 [EAS Dashboard](https://expo.dev/accounts/homeypaw/projects/kongdaily) |
| iOS 身份 | `com.lennystudio.kongdaily` · `1.0.0` · scheme `kongdaily` · iPhone Only。 |
| Production Store | EAS CLI 27.7.1 实际解析为 `distribution: store`、`environment: production`、`credentialsSource: remote`、`buildConfiguration: Release`、`developmentClient: false`、`simulator: false`。 |
| 自动化 | 仓库没有 Submit 配置或 GitHub／EAS 工作流，EAS 项目返回 `workflows: []`。没有 `expo-updates` 依赖、更新 URL、runtime version 或 Production channel。远端 `eas channel:list` 返回空列表。REL-02D1 同一发布提交的隔离 iOS Prebuild 生成 `EXUpdatesEnabled=false`。 |
| 正式资源 | Icon SHA-256 `c153aa5ca06b1b21ff19c1aa725a2f3085050fdf38e4e9de835996a1258adb7d`；Splash SHA-256 `24d59105ff68dff978b27e7b6f02d602bb71712a2af9c6ea222174afb0e01cab`。均与批准版本及 Git HEAD 逐字节一致。 |

## Apple 签名结案

开发者确认已注册 Apple Developer App ID，已创建对应的 App Store Connect KongDaily App Record，并完成 EAS CLI 的 Store 签名设置。CLI 返回 `All credentials are ready to build`。

本轮通过 EAS 只读元数据重新确认以下关联。签名状态取代 REL-02D1 首次审计时的空记录。

- KongDaily 项目精确匹配 `com.lennystudio.kongdaily`，签名类型为 `APP_STORE`，关联 Apple Team `8SSF5V63H9`。
- 绑定的 Apple Distribution Certificate 属同一 Team。开发者确认复用现有有效证书，EAS 所列有效期为 `2026-08-28T03:17:24Z` 至 `2027-08-28T03:17:23Z`。
- 专属 App Store Provisioning Profile `YKA356F2M7` 已绑定，EAS 返回 `active`，Team 为 `8SSF5V63H9`，到期时间为 `2027-08-28T03:17:23Z`。
- 签名复核只读取元数据。App Record 的存在来自开发者确认，ASC Apple ID 与构建历史本轮无法从已授权的只读接口取得。

## 首次 Build Number 与 Apple 端确认

`eas build:list --platform ios --limit 10 --json --non-interactive` 返回 `[]`，`eas build:version:get --platform ios --profile production --json --non-interactive` 返回 `{}`。当前配置为 `appVersionSource: remote`、`autoIncrement: buildNumber`，`app.json` 未设置 `ios.buildNumber`。

使用实装 CLI 所依赖的 Expo 配置插件实测 CNG 默认值为 `1`。REL-02D1 对同一提交的 CLI 实现核对确认，远端未初始化且本地默认值为 `1` 时，首次构建使用 `1`，后续才从远端版本递增。因此 `1.0.0 (1)` 在 EAS 侧可用，安全性仍取决于 Apple 端是否已有该版本的上传记录。 [Expo 远端版本管理](https://docs.expo.dev/build-reference/app-versions/#remote-version-source)

开发者在 App Store Connect 切到 Team `8SSF5V63H9` 的 KongDaily App，确认 **App Information** 的 Bundle ID 为 `com.lennystudio.kongdaily`，再到 **TestFlight → iOS** 核对两处：

1. **Builds** 展开 `1.0.0`，确认没有已接收的 Build `1` 或更高编号。
2. **Build Uploads** 使用 **All Statuses**，核对 `1.0.0` 是否存在 `Processing`、`Complete`、失败或重试中的记录，也确认没有正从其他机器上传的同版本构建。如果只有 `Failed`，查看详情，确认不存在其他已接收或仍在处理的记录。Apple 允许复用仅上传失败的编号。若已有已接收或处理中的编号，暂停使用 `1`，先对照 Apple 和 EAS 的占用情况决定下一号。 [Apple 构建与上传状态](https://developer.apple.com/help/app-store-connect/manage-builds/view-builds-and-metadata/)

## 测试与交付

- **PASS** `npm run typecheck`、Expo Production `config --type introspect --json`、`eas config --platform ios --profile production --json --non-interactive`。
- **PASS** EAS 项目与签名关联、iOS Build 历史和远端版本查询、EAS Workflows 与 Update Channels 核对。
- **PASS** ATS 保持 `NSAllowsArbitraryLoads=false`，仅前台定位权限，无背景模式与额外 App entitlements，正式图片 SHA-256 和 Git 空白检查通过。
- REL-02D1 同一提交的隔离 iOS Prebuild、plist lint、iPhone 装置家族和值为 `1` 的默认 `CFBundleVersion`、双语隐私政策 HTTPS 200 已通过，本轮沿用该基线证据。

**REL-03A 首包最终结论仍为 NO-GO。** 开发者完成上面的 TestFlight 核对且 EAS 仍未分配编号后，可使用 `1.0.0 (1)` 启动首个 Store Build。签名设置已结案。本轮未启动 EAS Build、未修改 Apple 凭证或远端版本、未上传、未运行模拟器，也未新增 Git 提交。
