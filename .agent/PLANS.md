# 压缩客服工作台并消除小程序消息重复显示

本 ExecPlan 是持续维护的文档，遵循 `docs/execplans/plans.md`。

## Purpose / Big Picture

客服人员打开后台在线客服工作台时，消息记录、输入区和右侧资料卡将占用更少的垂直空间，从而能在一个屏幕内看到更多对话内容。客户在小程序发送文字或商品卡片后，同一条服务端消息只显示一次；后台可据此看到准确的消息数量。可以通过后台 mock 客服页面和小程序客服聊天单元测试验证这两个结果。

## Progress

- [x] (2026-07-29 10:20+08:00) 定位后台客服工作台组件、现有端到端测试和小程序聊天实现。
- [x] (2026-07-29 10:25+08:00) 复现路径分析完成：HTTP 成功回包替换本地占位消息后，WebSocket 的同 ID `message.created` 事件仍会被追加。
- [x] (2026-07-29 10:32+08:00) 为 WebSocket 消息合并逻辑写出失败测试，再按消息 ID 去重。
- [x] (2026-07-29 10:35+08:00) 收紧后台客服工作台消息、编辑器和侧栏的间距，并更新 mock 页面断言。
- [x] (2026-07-29 10:40+08:00) 运行小程序聊天测试、后台 mock 客服端到端测试、后台生产构建、小程序 TypeScript 检查和差异检查。
- [x] (2026-07-29 10:55+08:00) 暂存本次客服改动并创建 Conventional Commit。

## Surprises & Discoveries

- Observation: 用户提供的后台截图中“镀锌槽钢 C100”和“hello”各只有一条，而小程序截图各有两条。
  Evidence: 两张截图对比表明服务端并未重复创建消息，问题发生在小程序的本地渲染层。
- Observation: `apps/miniapp/src/pages/support/chat/index.tsx` 仅删除仍处于 `pending` 状态的同内容本地消息；HTTP 回包已经将占位项替换成正式消息后，后到的 WebSocket 消息会被无条件追加。
  Evidence: WebSocket 回调中的 `setMessages` 在过滤后执行 `return [...nextItems, nextMessage]`，未检查正式消息 ID。

## Decision Log

- Decision: 使用服务端消息 ID 作为 WebSocket 合并的唯一身份，而不是按文本或时间猜测重复。
  Rationale: 消息 ID 在同一会话中唯一，且能正确处理两条内容相同但实际不同的客户消息。
  Date/Author: 2026-07-29 / Codex
- Decision: 后台仅压缩密度，不改变客服可用能力、会话三栏结构或消息内容。
  Rationale: 用户要求更简洁的传递体验；保留现有认领、转接、卡片和图片功能可避免功能回归。
  Date/Author: 2026-07-29 / Codex

## Outcomes & Retrospective

实现、验证和提交准备均已完成。小程序聊天测试 8 项通过；后台客服 mock 端到端测试 3 项通过；后台生产构建和小程序 `tsc --noEmit` 均以退出码 0 完成。测试运行时仍输出既有 Taro `maxlength` 属性警告、预期的失败场景日志、Browserslist 过期提示及 Vite 大 chunk 提示；这些均未导致测试或构建失败，且不属于本次改动范围。

## Context and Orientation

后台客服页面位于 `apps/admin-web/src/react/pages/admin/SupportWorkspacePage.tsx`，使用 Tailwind 工具类渲染左侧会话列表、中间消息和编辑器、右侧客户与会话上下文。`apps/admin-web/tests/e2e/support.mock.spec.ts` 使用 Playwright 在 mock 模式验证页面布局与交互。

小程序客服页位于 `apps/miniapp/src/pages/support/chat/index.tsx`。它先把用户刚发送的文字放入 `messages` 状态作为“本地占位消息”，再以 HTTP `sendMessage` 的回包替换该项；WebSocket 是服务端主动推送消息事件的实时通道。`message.created` 事件中的消息与 HTTP 回包具有同一个服务端 ID，因此必须合并而非再次追加。`apps/miniapp/src/pages/support/chat/index.test.tsx` 是 Jest 测试文件。

## Plan of Work

先从 `SupportChatPage` 提取一个只依赖消息数组和新消息的合并函数。该函数保留现有的 pending 占位项替换规则，但在数组已经含有相同正式消息 ID 时返回原消息数组，确保实时事件不会把已确认消息再添加一次。测试将构造一个已确认消息和同 ID 的 WebSocket 消息，断言结果只有一条；也会保留相同文本但不同 ID 的两条消息。

随后在 `SupportWorkspacePage.tsx` 调整中间列和右栏的 Tailwind 类：缩短气泡、卡片、消息列表、工具栏、输入框和侧栏卡片的 padding/margin；输入框改为更紧凑的两行高度。保持编辑器固定在消息区底部，页面仍适用于长会话。更新 Playwright mock 检查，确认编辑器仍在可视区域并且高度符合新紧凑尺寸。

## Concrete Steps

在仓库根目录执行以下命令：

    cd apps/miniapp && pnpm test -- --runTestsByPath src/pages/support/chat/index.test.tsx
    cd ../admin-web && pnpm test:e2e:mock -- tests/e2e/support.mock.spec.ts
    pnpm build
    cd ../.. && git diff --check

小程序测试在修复前应在“同 ID 消息合并”用例失败，修复后通过。后台 mock 测试应通过且编辑器在长会话下保持可见。`pnpm build` 应以退出码 0 完成。

## Validation and Acceptance

验收时，在小程序客服聊天中发送一条文字，在 HTTP 响应之后接收同一 ID 的 `message.created` 推送，聊天列表只包含一条该 ID 的消息；不同 ID 的同文本消息仍均显示。后台 mock 客服工作台加载时，消息气泡、工具栏、文本输入框和侧栏都比此前紧凑，输入框和发送按钮始终处于页面底部可见区域。

## Idempotence and Recovery

所有测试命令只读或生成临时构建产物，可安全重复运行。若样式压缩影响长会话可见性，恢复 `SupportWorkspacePage.tsx` 中对应 Tailwind 类并重跑 mock 端到端测试；若合并测试失败，保留服务端 ID 去重条件，不使用文本去重，以免隐藏合法的重复内容。

## Artifacts and Notes

工作分支是 `codex/fix-hide-excel-import-entry`。这次变更将在该分支上以独立 Conventional Commit 提交。

## Interfaces and Dependencies

`SupportChatPage` 的 WebSocket 回调接收 `SupportSocketEnvelope`，其中 `data.message` 是 `commerceServices.support.sendMessage` 的返回消息。合并函数必须接收 `ChatMessageItem[]` 和一个该类型的消息，并返回 `ChatMessageItem[]`。后台继续使用 React、Tailwind、Lucide 图标和 Playwright；不增加依赖。

变更记录：2026-07-29，依据客服截图确认重复只存在于小程序渲染层，采用消息 ID 去重，并定义后台密度压缩与测试范围。2026-07-29，完成实现和测试，记录实际验证结果与非阻断既有警告。
