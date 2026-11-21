# REL-05A · KongDaily 1.0.0 Git 发布归档

**可交开发者执行归档。** `main` 可以快进到正式 Build 2 的源码提交 `f35d593f538e02803082e13dfb71b906c1b2675e`。`v1.0.0` 应为指向同一提交的注解标签。App Store Connect 显示 1.0.0 已审核通过、可分发，由开发者确认。本轮核对 Git 与成品证据，保留隐私和素材后续事项。

## Git 与正式构建

| 核对项 | 2026-11-21（香港时间） |
| --- | --- |
| 当前分支及 HEAD | `develop` · `f35d593f538e02803082e13dfb71b906c1b2675e` |
| `origin/develop` | 本地跟踪引用及 GitHub 分支均为 `f35d593f538e02803082e13dfb71b906c1b2675e`。 |
| `main`／`origin/main` | 两者均存在；本地 `main`、跟踪引用和 GitHub `main` 均为 `aaa86b186bbd032da59798dee5bb553fb221d585`。当前唯一工作树检出 `develop`。 |
| 分支关系 | `main...发布SHA` 为 `0 / 48`。合并基点为 `aaa86b1`，`main` 是发布提交的祖先，可快进；没有 `main` 专属提交。 |
| `v1.0.0` | 本地和 GitHub 均尚无该标签。 |
| 开工工作区 | 无已修改跟踪文件或暂存文件。唯一未跟踪文件为 `docs/REL-03D1-APP-PRIVACY-GATE-C.md`。 |
| 交付工作区 | 两份未跟踪报告，原有 REL-03D1 和本报告。分支及标签引用与开工一致。 |

EAS Build ID `20a0f92e-04b0-463c-97cc-93b52cb958de` 为 `@homeypaw/kongdaily` 的 iOS Production Store 成品。已保存的 EAS 构建记录标明 `1.0.0 (2)` 和完整 Git SHA，上述 SHA 在仓库存在。原始 IPA SHA-256 为 `c836db69b4f92fbb87929fc1c6fc08f4de3089f4af9e62985741fa0f0b119a92`，本轮重新计算一致。 [EAS 构建记录](https://expo.dev/accounts/homeypaw/projects/kongdaily/builds/20a0f92e-04b0-463c-97cc-93b52cb958de)

直接读取发布 Git 树并对照原始 IPA，核验了以下内容。

- `expo.owner=homeypaw`、Project ID `46b3f4a1-36a6-4a62-aebf-2a65b795e9fd`、Bundle ID `com.lennystudio.kongdaily`、scheme `kongdaily`、版本 `1.0.0`、iPhone-only 及 EAS Production Store 配置。IPA 主 plist 实际版本为 `1.0.0 (2)`，装置家族为 1。
- 已批准 Icon 和 Splash 的提交内容 SHA-256 均与审批记录一致。提交中的英文默认 Motion 用途及繁中／英文资源，与 IPA 主 plist 和 `en`／`zh-HK` 的原生语言文件相符。
- 发布 Git 树含巴士、天气、附近地图、探索和全域搜索路由，以及 App 内离线政策。IPA 的 Hermes bundle 包含同一提交的双语定位、储存、第三方服务和保留政策段落；政策版本 1.0，生效日 2026-11-20。
- 八张 Explore 原始随包 JPEG 与同一提交的 `attribution.json` 及 IPA 逐张进行 SHA-256 比对，8/8 一致。 [图片分发记录](REL-01C1B4-PRODUCTION-WEBSITE-GATE-A.md)

REL-03D1 App Privacy 报告与 REL-05A 发布记录均形成于 Build 2 构建之后。它们未进入 Build 2 对应的 Git 树。

## 开发者归档命令

以下命令从项目根目录执行。先归档 1.0.0，再提交审计记录。核对失败时命令会退出。若 GitHub 拒绝直接推送 `main` 或新标签，保留现场并审阅分支规则；如只允许生成合并提交的流程，需先解决与 `main` 指向已发布 SHA 的要求之间的冲突。

### 快进远端 main 并创建注解标签

```sh
(
  set -eu
  kd_release=f35d593f538e02803082e13dfb71b906c1b2675e
  kd_main_before=aaa86b186bbd032da59798dee5bb553fb221d585

  test "$(git branch --show-current)" = develop
  git diff --quiet
  git diff --cached --quiet
  test "$(git rev-parse refs/heads/main)" = "$kd_main_before"
  git merge-base --is-ancestor "$kd_main_before" "$kd_release"
  if git show-ref --verify --quiet refs/tags/v1.0.0; then
    printf '%s\n' '本地已存在 v1.0.0，停止并核对其对象及目标。' >&2
    exit 1
  fi

  kd_remote=$(git ls-remote origin refs/heads/main refs/heads/develop refs/tags/v1.0.0 'refs/tags/v1.0.0^{}')
  test "$(printf '%s\n' "$kd_remote" | awk '$2=="refs/heads/main" {print $1}')" = "$kd_main_before"
  test "$(printf '%s\n' "$kd_remote" | awk '$2=="refs/heads/develop" {print $1}')" = "$kd_release"
  test -z "$(printf '%s\n' "$kd_remote" | awk '$2 ~ /^refs\/tags\// {print $2}')"

  git tag -a v1.0.0 "$kd_release" \
    -m "KongDaily 1.0.0 (2)" \
    -m "App Store release. EAS Build 20a0f92e-04b0-463c-97cc-93b52cb958de."
  test "$(git cat-file -t refs/tags/v1.0.0)" = tag
  test "$(git rev-parse 'v1.0.0^{commit}')" = "$kd_release"

  git -c push.followTags=false push --atomic origin \
    "$kd_release:refs/heads/main" refs/tags/v1.0.0:refs/tags/v1.0.0

  kd_remote=$(git ls-remote origin refs/heads/main refs/tags/v1.0.0 'refs/tags/v1.0.0^{}')
  test "$(printf '%s\n' "$kd_remote" | awk '$2=="refs/heads/main" {print $1}')" = "$kd_release"
  test "$(printf '%s\n' "$kd_remote" | awk '$2=="refs/tags/v1.0.0^{}" {print $1}')" = "$kd_release"
  printf '%s\n' '已确认远端 main 和 v1.0.0 指向正式发布提交。'
)
```

该推送用完整 SHA 更新 `main`，使用原子推送同时发布注解标签。若推送失败，本地标签可能已经存在；先检查本地标签对象和远端两条引用再续做，勿重建或强制覆盖。若重新核对发现 `main` 有发布提交之外的历史，停止同步。

### 快进本地 main，保留当前 develop 工作树

远端确认后，可在隔离工作树快进本地 `main`。当前目录里的两份未跟踪报告不参与切换。

```sh
(
  set -eu
  kd_release=f35d593f538e02803082e13dfb71b906c1b2675e
  git fetch --no-tags origin
  test "$(git rev-parse refs/remotes/origin/main)" = "$kd_release"
  git merge-base --is-ancestor refs/heads/main "$kd_release"
  kd_tmp=$(mktemp -d)
  git worktree add "$kd_tmp/main" main
  git -C "$kd_tmp/main" merge --ff-only "$kd_release"
  test "$(git rev-parse refs/heads/main)" = "$kd_release"
  git worktree remove "$kd_tmp/main"
  rmdir "$kd_tmp"
  git status --short --branch
)
```

## 未提交审计记录

| 分类 | 处理 |
| --- | --- |
| A · 应保留 | REL-03D1 签名 IPA 隐私核验与本报告，审核后独立提交到 `develop`。其中的 NO-GO 为当时 App Privacy 证据结论，保留时间背景，并另行补档实际向 Apple 提交的答案及证据。 |
| B · 跟进 | LandsD、巴士及天气网关的查询、IP 和连接日志留存，App Privacy 申报依据，MapKit 与第三方 SDK 数据接收边界。继续核查 Build 2 的 Required Reason API、ExpoFileSystem 缺失的理由文件和 Maps 声明未入包的差异，取得正式 Archive／Privacy Report 或可验证的等效证据。 |
| B · 素材 | 保留八图的实际版本、哈希、署名和分发记录。西九艺术公园的网站版本只提供原来源，继续保留该下载限制。山顶花园 CC BY 4.0 保留近图署名、原图和改动说明，并继续核对 App Store 成品、适用 EULA 与技术措施。审核通过的事实不补足这些证据。 [素材分发边界](REL-01C1B4-PRODUCTION-WEBSITE-GATE-A.md) · [Build 2 隐私审计](REL-03D1-APP-PRIVACY-GATE-C.md) |
| C · 不入 Git | 本次工作区没有此类候选。原始 IPA／Archive、临时解包、完整 Xcode 日志、带签名下载 URL、本地环境文件及签名凭证留在项目之外，发布文档只记录非敏感 ID 和必要哈希。 |

开发者在 `develop` 上明确暂存这两份报告。审核文案后单独提交，避免收录其他文件。

```sh
(
  set -eu
  test "$(git branch --show-current)" = develop
  git diff --cached --quiet
  git add -- docs/REL-03D1-APP-PRIVACY-GATE-C.md docs/REL-05A-APPSTORE-1.0-GIT-RELEASE-CLOSURE.md
  git diff --cached --check
  git diff --cached --name-only
  git commit -m "docs(release): archive KongDaily App Store 1.0 audit" \
    -- docs/REL-03D1-APP-PRIVACY-GATE-C.md docs/REL-05A-APPSTORE-1.0-GIT-RELEASE-CLOSURE.md
  git push origin develop:refs/heads/develop
)
```

## 下一版本与检查

- `main` 保持 1.0.0 稳定基线，`v1.0.0` 保留发布时的准确源码。后续开发继续使用 `develop`。紧急修复可由 `main` 开始，安排为 1.0.1 并将修复整合回 `develop`；较大的体验优化和新功能可规划为 1.1.0。
- 本轮保留 Marketing Version。`eas build:version:get --platform ios --profile production --json --non-interactive` 实际返回 `{"buildNumber":"2"}`。继续由现有 EAS 项目以 Remote Version Source 递增；构建前重查远端编号与 App Store Connect 已使用和处理中记录。既有 1、2 均保留。
- `npm run typecheck`、Explore 照片 8/8、全域搜索导航、巴士路线图及 ETA、合规脚本和 `git diff --check` 均通过。

本轮只新增本报告。等待开发者审阅并执行归档。
