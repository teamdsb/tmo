# 修复客服消息发送回归与图片上传权限

本 ExecPlan 是持续维护的文档，遵循 `docs/execplans/plans.md`。

## Purpose / Big Picture

客服在后台发送文本后，输入框应立即清空且不再显示前端运行时错误；小程序发送订单卡、商品卡时，无论 WebSocket 推送和 HTTP 回包哪个先到，列表都只显示一条。小程序客服更多操作中不再提供冗余的“去支持中心”。生产部署脚本会预先创建并授权客服图片上传目录，使 commerce 容器的非 root 进程能写入图片。可通过后台 mock 端到端测试、小程序聊天回归测试、构建与脚本语法检查验证。

## Progress

- [x] (2026-07-29 12:15+08:00) 从截图和前端错误信息定位后台文本发送的运行时异常。
- [x] (2026-07-29 12:20+08:00) 检查小程序 HTTP/WebSocket 写入顺序，并确认卡片在 WebSocket 先到时仍会被 HTTP 回包重复追加。
- [x] (2026-07-29 12:25+08:00) 通过 ECS commerce 日志定位图片失败为 `/data/media/support` 无写入权限，而非客户端选图失败。
- [x] (2026-07-29 12:40+08:00) 补充失败回归测试，修复前端调用、卡片消息合并和更多菜单。
- [x] (2026-07-29 12:42+08:00) 让生产启动脚本创建客服媒体目录并赋予容器运行用户写权限。
- [x] (2026-07-29 12:50+08:00) 运行针对性测试、构建、静态检查和差异审查；准备提交。

## Surprises & Discoveries

- Observation: `SupportWorkspacePage.tsx` 调用了 `normalizeSupportMessage`，但没有从 `supportWorkspaceData` 导入它。
  Evidence: 请求成功后会先抛出 `ReferenceError`，因此 `setDraft('')` 尚未执行，截图中的输入框内容和错误提示同时出现。
- Observation: 已有 `mergeIncomingSupportMessage` 已能按 ID 去重，但订单卡和商品卡 HTTP 成功回调直接使用 `setMessages((current) => [...current, created])`，绕过了这个函数。
  Evidence: WebSocket 先追加同 ID 消息时，随后 HTTP 回包仍被直接追加。
- Observation: ECS commerce 日志显示图片接口 500 的直接原因是 `mkdir /data/media/support: permission denied`。
  Evidence: 镜像以 `nobody:nobody` 运行，生产 compose 把主机媒体目录绑定到该路径，已有主机目录不允许该用户创建 `support` 子目录。

## Decision Log

- Decision: 以服务端消息 ID 合并所有卡片发送回包，而不是按显示文本去重。
  Rationale: 同内容的不同订单或商品消息仍是合法消息；同 ID 才是同一服务端记录。
  Date/Author: 2026-07-29 / Codex
- Decision: 在部署脚本中仅创建并授权 `media/support`，不递归修改整个媒体库。
  Rationale: 图片上传只写入该子目录，可避免改变现有商品等媒体文件的所有权。
  Date/Author: 2026-07-29 / Codex

## Outcomes & Retrospective

已补齐后台遗漏的 `normalizeSupportMessage` 导入，因此成功发送会追加规范化消息、清空草稿并刷新会话。小程序订单卡、商品卡和商品咨询组合发送均改用相同的 ID 合并函数，覆盖 WebSocket 先到与 HTTP 先到的顺序。更多菜单删除“去支持中心”。生产脚本仅对 `MEDIA_HOST_DIR/support` 创建目录并设置 UID/GID 65534 所需权限，以修复 ECS 容器图片上传目录的拒绝写入。

验证结果：小程序聊天 Jest 10/10 通过；后台 mock Playwright 4/4 通过；后台 `pnpm build` 与小程序 `pnpm build:weapp:dev` 均退出码 0，后者已同步开发者工具 `dist/weapp`；`bash -n tools/scripts/prod-ecs-up.sh` 和 `git diff --check` 通过。测试输出仍包含既有 Taro `maxlength` 警告、预期失败场景的日志、Browserslist 过期提醒及后台大 chunk 提示，均不影响退出状态。

## Context and Orientation

后台客服工作台在 `apps/admin-web/src/react/pages/admin/SupportWorkspacePage.tsx`，其 mock Playwright 测试在 `apps/admin-web/tests/e2e/support.mock.spec.ts`。小程序聊天在 `apps/miniapp/src/pages/support/chat/index.tsx`，对应 Jest 测试在同目录 `index.test.tsx`。生产 ECS 启动入口为 `tools/scripts/prod-ecs-up.sh`，并加载 `infra/prod/docker-compose.ecs.yml` 的 `MEDIA_HOST_DIR` 绑定目录。

## Plan of Work

先扩展小程序测试：捕获测试 WebSocket，在订单卡 HTTP 请求仍未完成时投递同一消息的实时事件，再完成 HTTP 请求，断言卡片只出现一次；同时断言更多操作仅有三项发送功能。扩展后台 Playwright mock 测试，发送一条客服回复后检查输入框清空且没有错误提示。这些用例在修复前分别暴露回归。

随后导入缺失的 `normalizeSupportMessage`，让文本发送的正常链路走到清空草稿。订单卡、商品卡以及组合意图的成功回包改为使用已有的按 ID 合并函数。删除更多菜单中的支持中心导航分支。

最后在生产启动脚本里解析 compose 文件相对的 `MEDIA_HOST_DIR`，创建其 `support` 子目录并将该目录交给 commerce 镜像的 `nobody` UID/GID（65534）写入；脚本不递归 chown 既有媒体目录。运行测试、构建和 `bash -n` 后再提交。

## Concrete Steps

在仓库根目录执行：

    cd apps/miniapp && pnpm test -- --runTestsByPath src/pages/support/chat/index.test.tsx
    cd ../admin-web && pnpm test:e2e:mock -- tests/e2e/support.mock.spec.ts
    pnpm build
    cd ../.. && bash -n tools/scripts/prod-ecs-up.sh && git diff --check

小程序和后台新增用例在修复前应失败，修复后均通过。`pnpm build`、脚本语法检查和差异检查均应以退出码 0 结束。

## Validation and Acceptance

后台发送文本后，服务端 201 回包不再触发 `normalizeSupportMessage` 未定义异常，文本域为空。小程序在 WebSocket 先推送订单/商品卡、HTTP 随后回包的时序下只渲染一条卡片。更多菜单没有“去支持中心”。生产脚本在默认或 `MEDIA_HOST_DIR` 指定路径下预建可写的客服上传目录。

## Idempotence and Recovery

测试、构建和语法检查可安全重复。生产脚本的 `mkdir -p`、`chown` 和 `chmod` 对单个客服媒体目录重复执行安全。若容器用户将来变化，应同步更新脚本中的 UID/GID，并用 ECS 图片上传冒烟测试确认。若卡片仍重复，保留 ID 合并逻辑并检查服务端是否生成了不同 ID 的重复记录。

## Artifacts and Notes

工作分支是 `codex/fix-hide-excel-import-entry`。本次会作为独立 Conventional Commit 提交；部署不在本次请求范围内，提交后可通过既有 ECS 发布流程使媒体目录权限修复生效。

## Interfaces and Dependencies

`commerceServices.support.sendMessage` 与 WebSocket 的 `message.created` 都返回含 `id` 的客服消息。`mergeIncomingSupportMessage` 接收 `ChatMessageItem[]` 和该消息，返回合并后的数组。生产脚本依赖 Bash、Docker Compose 与镜像的 `nobody` 运行用户；不新增第三方依赖。

变更记录：2026-07-29，依据后台运行时错误、聊天时序代码与 ECS 日志制定此次修复和验证范围。2026-07-29，完成回归测试、构建和脚本验证。
