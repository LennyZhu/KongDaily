# REL-02D0 · 独立 EAS 项目初始化

## 结果

**PASS。** KongDaily 的独立 EAS 项目已创建并链接。首次 iOS Production Build 仍待 REL-02D1 核对 Apple 端。

| 项目 | 实际结果 |
| --- | --- |
| Expo CLI／EAS CLI 登录 | `homeypaw` |
| EAS Owner | `homeypaw` |
| Expo 项目完整名称 | `@homeypaw/kongdaily` |
| 远端项目名称与 Slug | `kongdaily`。App 显示名称为 `KongDaily`。 |
| Project ID | `46b3f4a1-36a6-4a62-aebf-2a65b795e9fd` |
| 远端项目 | [KongDaily EAS Dashboard](https://expo.dev/accounts/homeypaw/projects/kongdaily) |

## Git 基线与初始化

此前 `efe1dc8` 的工作区因发布资料未提交而暂停。恢复时 `develop` 的 HEAD、本地 `origin/develop` 和 GitHub 只读查询均为 `6d44f706e055ee49b8370340e986461ed2d0db31`，提交信息为 `chore(release): prepare KongDaily iOS 1.0 baseline`。分歧 0／0，工作区和暂存区干净。B5、REL-02A、REL-02B、REL-02C0、REL-02C1 均在已提交基线。

使用本机 EAS CLI `27.7.1`。创建前，`whoami` 确认 `homeypaw` 和 `homeypaws-team` 都可访问，登录身份在两者均为 Owner。对两个范围按精确 slug 及 `com.lennystudio.kongdaily` 的 EAS App Identifier 做只读查询，未发现匹配。确认 CLI 帮助支持的参数后，交互式运行 `eas init --account homeypaw --no-icon`，仅确认创建 `@homeypaw/kongdaily`。CLI 返回新 Project ID 和 Dashboard 地址。 [EAS CLI 命令参考](https://docs.expo.dev/eas/cli/)

`eas project:info` 及按全名的远端只读查询均返回上述身份。新 ID 与 HomeyPaw、OrderMori 和 SplitMori 的远端 ID 均不同。`app.json` 最终只新增 `expo.owner` 和 `expo.extra.eas.projectId`。CLI 写出的配置格式变化及可由现有插件推导的字段已移除。

## Production 配置与验证

| 验证 | 结果 |
| --- | --- |
| `npm run typecheck` | PASS。 |
| Expo Production `config --type introspect --json` | PASS。Owner、slug、Project ID 与远端一致。Bundle ID 为 `com.lennystudio.kongdaily`，版本为 `1.0.0`，scheme 为 `kongdaily`，平台仅 iOS 且 `supportsTablet: false`。 |
| `eas config --platform ios --profile production --json --non-interactive` | PASS。解析为 Store Distribution、`environment: production`、iOS `Release`、`developmentClient: false`、`simulator: false`、`credentialsSource: remote`；构建镜像为 `macos-tahoe-26.5-xcode-26.6`。`eas.json` 与提交一致。 |
| ATS、Icon 与 Splash | PASS。ATS 仍为 `NSAllowsArbitraryLoads: false`；两张资源与 HEAD 逐字节一致。Icon SHA-256 为 `c153aa5ca06b1b21ff19c1aa725a2f3085050fdf38e4e9de835996a1258adb7d`，Splash 为 `24d59105ff68dff978b27e7b6f02d602bb71712a2af9c6ea222174afb0e01cab`。 |
| `git diff --check` | PASS。 |

## 首包编号与 Apple 只读预检

- `eas build:list --platform ios --limit 10 --json --non-interactive` 返回 `[]`，新项目无 iOS 构建记录。`eas build:version:get --platform ios --profile production --json --non-interactive` 返回 `{}`，未找到该 Bundle ID 的远端构建版本。App 配置未定义 `ios.buildNumber`。现有配置使用 `appVersionSource: remote` 与 `production.ios.autoIncrement: buildNumber`。
- **首包候选编号为 `1`，待确认。** 如果 Apple 端也无已用或正在处理的编号，且 EAS 在首次构建前仍无远端版本，Expo 的初始化规则会从 `1` 开始。如 Apple 有历史记录，应先核对两边的最高已用或已分配编号，再单独批准需要的版本设定。此次仅查询。 [Expo 远端版本规则](https://docs.expo.dev/build-reference/app-versions/#remote-version-source)
- **PENDING APPLE VERIFICATION。** EAS 个人账号有一条 Apple Team 元数据，Team ID 末四位为 `63H9`，这是账号级记录。EAS 精确查询未找到 `com.lennystudio.kongdaily` 的 App Identifier。Apple Developer 上的实际 Team、Bundle ID 注册及归属、KongDaily 适用的 Distribution Certificate 与 Provisioning Profile、App Store Connect App 记录和历史 Build 均待开发者用相应 Apple 身份直接核实。 [Apple Developer App ID 指引](https://developer.apple.com/help/account/identifiers/register-an-app-id/) · [App Store Connect 构建记录指引](https://developer.apple.com/help/app-store-connect/manage-builds/view-builds-and-metadata/)

## REL-02D1 前置条件

1. 开发者审核并提交独立 EAS 关联，确认候选提交使用此 Project ID 和 iOS Production Store profile。
2. 在 Apple Developer 核对选定 Team、精确 Bundle ID、可用证书及匹配的 App Store Provisioning Profile，并在 App Store Connect 核对相应 App 及已用或处理中编号。
3. 结合 Apple 结果和 EAS 的远端版本复查确认首包编号。取得正式构建授权后，再进入首包步骤。Gate C 仍待候选 Archive 及 Privacy Report。

交付时 `develop` HEAD 仍为 `6d44f706e055ee49b8370340e986461ed2d0db31`，与远端一致。工作区只有 `app.json` 和本报告两处未提交修改。未启动 EAS Build、写入远端版本、修改 Apple 凭证、操作 App Store Connect 或启动模拟器，未自行提交、推送或合并。
