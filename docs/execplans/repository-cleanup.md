# 分支瘦身与依赖 PR 清理

遵循 docs/execplans/plans.md。用户授权按盘点顺序清理。

## Purpose / Big Picture

减少已完成分支和重复工作区，保留仍在使用的支付代码及未提交工作；修复阻碍四个依赖 PR 的真实 CI 问题，验证通过后合并并删除来源分支。

## Progress

- [x] 备份全部 Git 引用及 7 个脏工作区，另保存 2 个待删除干净工作区的源文件和本地配置。
- [x] 删除 9 个已合并且无工作区占用的本地分支，以及 2 个补丁等价且工作区干净的历史分支/worktree。
- [x] 删除已合并远端分支，开启合并后自动删除分支。
- [x] 修复分页初始计时器、生成物漂移和 lint 配置/问题；本地数据库测试、315 项 Jest 与完整 lint 通过。
- [x] PR 180 的五项适用 CI 检查全部通过；合并为 51c8e36，PR 175–178 同时被 GitHub 标记为 MERGED，来源分支自动删除。
- [x] 最终：本地分支 34→10，远端 7→2，worktree 12→10，开放 PR 4→0。24 个移除/归档分支均在独立仓库恢复并通过 fsck。

## Context and Orientation

GitHub 仓库 teamdsb/tmo 初始有 7 个远端分支、34 个本地分支、12 个 worktree。开放 PR 175–178 是 commerce/payment/identity/go-shared 依赖升级。初始 .worktrees 占约 6.9 GB。codex/restore-b2b-payment 是线上支付代码来源且有 4 个 main 未包含的提交，必须保留。

## Plan of Work

先用 git bundle --all 和每工作区 patch/tar 保存状态，逐项用 ancestry 或 git cherry 检查后删除。CI 旧分支迁移错误在 main 已修复；修复需求列表初次 debounce 导致分页回跳，迁移 golangci-lint 配置且修复发现的问题，重新生成过期客户端与样式，并停止跟踪 pnpm/Playwright 缓存。随后在一条保留全部原始提交的整合分支中验证四个升级，只有实际 CI 全部通过后才合并。

## Concrete Steps

备份目录 /Users/asimov3059/tmo-cleanup-backups/20260921-170927，包含 repository.bundle、refs.txt、manifest.json、removed-branches.json 及工作区补丁/文件归档。工作在 .worktrees/main-ecs-deploy 的临时 codex/repository-cleanup-ci 分支。执行 pnpm -C apps/admin-web typecheck、相关 Playwright、全套生成命令、miniapp lint/test 和对应 Go tests/lint；通过后推送并检查 GitHub Actions。

## Validation and Acceptance

Git bundle verify 成功；删除前工作区必须干净，未合并独立代码不丢失。分页回归必须在初始 300ms 计时器后仍保持用户选中的页码。生成两次不产生额外差异，全部启用 linter 保留。四个依赖 PR 实际检查通过，main 接收更新，远端来源分支清理完成。

## Idempotence and Recovery

不触碰 ECS。需要恢复分支时从 bundle 中原 refs/heads 路径 fetch；未提交内容可从对应 patch 和 files.tar.gz 恢复。对脏工作区不执行 reset、clean 或 worktree remove。合并 PR 不使用绕过检查的管理员参数。

## Surprises & Discoveries

旧依赖 PR 的后端因 00024 重放约束失败；main 已修复。main 的最新 CI 只因 Tailwind 和两个客户端生成物陈旧失败。需求页初次挂载仍会安排一个清空查询的 debounce，可能将刚选择的第二页重置为第一页。golangci-lint v2 正在读取 v1 格式配置。

## Decision Log

保留完整 lint/生成检查，修复具体问题；不通过关闭规则或跳过测试使 PR 变绿。保留生产 B2B 分支与所有脏工作区。四个依赖升级共享 Go workspace，在一条整合分支验证最终组合；保留原 PR 的提交祖先关系，使用 merge commit 合入 main，不以 squash 丢失来源。

## Outcomes & Retrospective

完成。11 个已合并/补丁等价分支已删除，13 个无工作区的历史分支已归档后移除，2 个干净 worktree 已移除。其余 10 个本地分支与 10 个 worktree 保留，其中 7 个工作区有原有未提交改动。远端只剩 main 与 codex/restore-b2b-payment，开放 PR 为 0。worktree 目录约 6.9→5.9 GB，Git 对象库约 74→11 MB，外部完整备份约 14 MB。分支自动删除设置已开启。ECS 未部署本轮仓库维护改动。

2026-09-21：独立审查发现 private input 目录的 MkdirAll 会使公开报告祖先目录也变为 0750；已明确先创建可供 Nginx 遍历的 jobRoot 0755，再创建 private input 0750，并添加先失败后通过的集成回归。Go 1.26 是 PR 177 的模块最低要求；工作区和 CI 同步升级。缓存从 Git 索引移除，不删除其他工作区的文件。

2026-09-21 CI 实跑发现开发容器 nobody 无法写入 runner 拥有的媒体挂载，上传健康检查返回 500。开发脚本现传递宿主 UID/GID，仅开发 commerce 容器按该身份写媒体；不放宽目录权限，不修改生产配置。

2026-09-21 全栈后续探针错误地用无效登录码断言 invalid_phone_proof，但服务按安全顺序先返回 invalid_request。改用明确的 mock_ 登录码，严格断言 real 模式拒绝它且不返回 token；手机号凭证分支仍由有效会话的 provider/handler 测试覆盖。

最终独立审查发现开发 UID 覆盖也会继承到 Air 模式，导致其 /root Go 缓存不可写。Air overlay 显式保持原有 root 身份，编译镜像模式使用宿主 UID/GID；两种 Compose 解析配置已分别验证，生产配置不变。

最终验证：完整 PostgreSQL 后端测试、315 项 miniapp Jest、38 个 admin mock 场景及全部启用的 Commerce lint 通过；GitHub backend、frontend-contracts、lint-test、fullstack-smoke、preflight-fault-injection 均 SUCCESS，weapp-smoke 按原有条件 SKIPPED。本轮创建的本地测试服务和专用数据库容器已停止。
