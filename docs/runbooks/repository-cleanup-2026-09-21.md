# 仓库瘦身记录（2026-09-21）

## 结果

| 项目 | 清理前 | 清理后 |
| --- | --- | --- |
| 本地分支 | 34 | 10 |
| GitHub 远端分支 | 7 | 2 |
| Worktree | 12 | 10 |
| 开放 PR | 4 | 0 |
| .worktrees 目录 | 约 6.9 GB | 约 5.9 GB |
| .git 目录 | 约 74 MB | 约 11 MB |

删除了 11 个已合并或补丁等价的本地分支，并移除两个干净工作区 audit-remediation、support-product-messaging。另有 13 个无工作区的历史分支完整归档后移除本地名称。保留所有原有脏工作区和生产支付来源分支 codex/restore-b2b-payment。

## 依赖与 CI

PR 175、176、177、178 的原始提交通过整合 PR 180 合入 main（51c8e36），GitHub 均标记为 MERGED；没有只为减少数量而关闭升级。所有来源分支已自动删除，仓库已开启合并后自动删除分支。

工作区与 CI 最低 Go 版本对齐到 1.26；修复了过期生成物、初始搜索计时器重置分页、静态检查问题、开发媒体写入身份以及真实登录探针的错误验证顺序。开发编译镜像按宿主 UID/GID 写媒体，Air overlay 保持原有 root 缓存身份；生产配置未改变。

适用的五项 GitHub 检查全部通过。真实微信自动化仍按原配置跳过。没有执行 ECS 部署。

## 备份与恢复

本机完整备份在 /Users/asimov3059/tmo-cleanup-backups/20260921-170927（约 14 MB，父目录仅本用户可访问）。repository.bundle 保存清理前全部可达 Git 历史及引用；manifest.json 对应未提交文件与本地配置归档；removed-branches.json、archived-history-branches.json 记录分支 SHA 和恢复命令。

已在独立临时仓库实际恢复全部 24 条被移除/归档分支，并通过 git fsck --full。恢复单个历史分支示例：

    git fetch /Users/asimov3059/tmo-cleanup-backups/20260921-170927/repository.bundle refs/heads/前端:refs/heads/前端

未提交内容先将对应 files.tar.gz 解压到独立目录，再对照 working.patch/staged.patch 恢复。不要删除备份目录，除非已确认这些历史工作不再需要。

## 后续约定

main 不再跟踪 .pnpm-store、Playwright 测试结果和 ESLint 缓存。后续任务完成后及时移除干净的临时 worktree；有未提交工作先保存。删除工作区/分支前分别检查工作区状态、提交是否已合并或已归档，不能仅凭远端分支消失判断可删除。
