# REL-02D0 · EAS 项目初始化

## 结果

**BLOCKED，发布基线尚未提交。** 当前分支为 `develop`，HEAD、本地 `origin/develop` 及 GitHub 只读查询均为 `efe1dc844fb5ad2a3e7e5cd4ffc8dca340ea4cc6`，提交差异 0／0。开工时有 7 个已修改的跟踪文件和 15 个未跟踪文件，暂存区为空。B5、REL-02A、REL-02B、REL-02C0 与 REL-02C1 的本地交付仍在工作区。

本轮在 Git 检查后停止初始化。Expo 登录身份、`homeypaw` 当前权限及远端同名项目留待基线提交后重新核对。批准目标为 KongDaily，Expo Owner 为 `homeypaw`，slug 为 `kongdaily`。本轮未写入 `expo.owner` 或 `extra.eas.projectId`，没有新 Project ID 或已核实的 Expo 项目 URL。

## 开发者待提交文件

| 阶段 | 工作区文件 |
| --- | --- |
| REL-01C1B5 官网上线记录 | `.gitignore`、`content/compliance.json`、`website/release.json`、`docs/REL-01C1B5-VERCEL-FIRST-PRODUCTION-DEPLOYMENT.md` |
| REL-02A 发布配置 | `app.json`、`eas.json`、`docs/REL-02A-IOS-RELEASE-CONFIG-READINESS.md` |
| REL-02B 设计评审 | `docs/REL-02B-APP-ICON-AND-EAS-IDENTITY-REVIEW.md`、`docs/design/rel-02b-app-icon/` 下 6 个评审文件 |
| REL-02C0 正式图标 | `assets/branding/app-icon-ios.png`、`docs/design/KongDaily-approved-HK-street-sign-source.png`，以及 `app.json` 内的图标引用 |
| REL-02C1 原生 Splash | `assets/branding/splash-logo.png`、`package.json`、`package-lock.json`、`src/language.tsx`、`docs/design/rel-02c1-splash-preview.png`、`docs/REL-02C1-IOS-SPLASH-BRAND-CLOSURE.md`，以及 `app.json` 内的 Splash 配置 |

建议基线提交信息为 `chore(release): prepare KongDaily iOS 1.0 baseline`。提交前核对正式资源、资源引用和依赖锁文件一起纳入。否则从已提交修订生成的候选包可能缺少已验收图标或 Splash，甚至无法解析原生配置。独立保留后续 EAS 项目关联变更，可以清楚核对唯一的 Owner 和 Project ID。

## 本地配置和已验证事项

- 直接读取 `app.json`。App 名称为 `KongDaily`、slug 为 `kongdaily`、Bundle ID 为 `com.lennystudio.kongdaily`、版本 `1.0.0`、scheme 为 `kongdaily`，`ios.supportsTablet=false`，ATS 全局任意加载关闭。
- 直接读取 `eas.json`。Production 使用 `distribution: store`、iOS `Release`、`simulator: false`、`developmentClient: false`、`appVersionSource: remote` 和 `ios.autoIncrement: buildNumber`。这是本地 JSON 核对，正式 Profile 解析待恢复后执行。
- 正式 Icon SHA-256 为 `c153aa5ca06b1b21ff19c1aa725a2f3085050fdf38e4e9de835996a1258adb7d`，Splash 为 `24d59105ff68dff978b27e7b6f02d602bb71712a2af9c6ea222174afb0e01cab`。均与上一轮已验收基线一致。`git diff --check` 通过。
- TypeScript、Expo Production Config、EAS Profile 解析及远端身份一致性检查留待 Git 基线通过后执行。

## Build Number 与 Apple 待核对

`app.json` 未配置 `ios.buildNumber`。EAS 项目历史 Build 和远端版本初始化记录尚未核实，当前不能给定首包编号。若后续确认 EAS 和 Apple 均无历史、占用或已初始化的更高编号，可将 `1` 作为首包候选。在构建前还需确认首次自动递增实际会分配的编号。

**PENDING APPLE VERIFICATION**。Apple Developer Team、Bundle ID 注册、Distribution Certificate、Provisioning Profile、App Store Connect App 记录、历史 Build 及 KongDaily 专用签名均待只读核对。

## 恢复 REL-02D0 与 REL-02D1 前置条件

1. 开发者提交上述发布基线后，重新核对 HEAD、远端和工作区。
2. 只读核对当前 Expo 登录、`homeypaw` 权限及现有项目。按实装 CLI 帮助选择初始化命令，确认不存在冲突后创建独立项目。
3. 核对远端项目 URL 与 Project ID，用正式配置验证身份、资源、ATS 和 Store Profile。REL-02D1 前还须核实 Apple Team、签名及安全可用的首个 Build Number。

完成时 HEAD 未变。工作区保留原有 7 个已修改文件及 15 个未跟踪文件，另新增本报告。未触发 EAS Build、远端版本写入、Apple 操作或 Git 提交。
