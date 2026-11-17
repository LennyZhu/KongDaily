# KongDaily UI-04A+2 设计与 Codex 交接包

## 本阶段目标

用户选择：**地图右下角恢复唯一的当前位置按钮，删除顶部搜索框旁的定位按钮**。顶部搜索框横向填满，并在 UI-04A+2 实现真正的本地设施 + 香港官方地点搜索。

## 交付文件

- `docs/design/ui-04a-plus-2-default-map-approved.png`
- `docs/design/ui-04a-plus-2-search-results-approved.png`
- `docs/design/ui-04a-plus-2-selected-place-approved.png`
- `docs/design/ui-04a-plus-2-list-approved.png`
- `docs/UI-04A-PLUS-2-CODEX.md`

图片是高保真**视觉参考**。地图底图、样例搜索结果及数值用于演示，开发必须由现有真实设施索引和官方 API 提供数据；图片不可替代数据真实性验证。

## 安装

在 Mac 下载 zip 到 Downloads，然后在项目根目录执行：

```bash
cd /Users/zhushunli/Desktop/project/KongDaily
unzip -n ~/Downloads/KongDaily_UI-04Aplus2_Handoff.zip -d .
ls -lh docs/UI-04A-PLUS-2-CODEX.md docs/design/ui-04a-plus-2-*.png
git status --short
```

`unzip -n` 不覆盖已有文件；如文件已存在，先人工检查内容并决定如何处理。

## 给 Codex 的首条消息

请在 `/Users/zhushunli/Desktop/project/KongDaily` 的 `develop` 分支执行 UI-04A+2：先完整阅读 `docs/UI-04A-PLUS-2-CODEX.md`，实际打开其中列出的四张 `docs/design/ui-04a-plus-2-*.png` 高保真图，审计当前 Git 未提交变更并保护既有 UI-04A+1 代码。按规范实施真实设施及香港地点搜索；地图右下角恢复唯一定位按钮、顶部搜索框占满行，搜索选择后显示地点名。静态及定向测试结束停止，不启动模拟器、不自行 commit/push/merge。
