# 修复客服认领与商品消息链路

本 ExecPlan 是持续维护的文档，遵循 `docs/execplans/plans.md`。详细的测试驱动步骤位于 `docs/superpowers/plans/2026-08-17-support-product-messaging.md`，实施期间两份文档必须保持同步。

## Purpose / Big Picture

完成后，客服必须先认领会话才能将其标记已读或发送消息，其他坐席不会看到可操作但最终被后端拒绝的按钮。客服可在带图片、名称和分页的选品器中搜索并选择任意上架商品，发送后客户在小程序点击卡片能打开对应商品详情。文本、图片、订单和商品发送共享一致的防重复和错误反馈。

## Progress

- [x] (2026-08-17 17:20+08:00) 完成认领、已读、商品加载、卡片发送和小程序跳转的数据流定位。
- [x] (2026-08-17 17:30+08:00) 建立隔离 worktree `.worktrees/support-product-messaging` 与分支 `codex/support-product-messaging`。
- [x] (2026-08-17 17:45+08:00) 用后端失败测试锁定“未认领不得已读或发送”及商品卡片服务端校验。
- [x] (2026-08-17 18:05+08:00) 实现显式认领和当前坐席所有权规则，已读、图片上传、发送、释放与 CS 转接均受所有权约束。
- [x] (2026-08-17 18:20+08:00) 用 Playwright 失败测试锁定可搜索、可分页、可识别的商品选择与发送行为。
- [x] (2026-08-17 18:40+08:00) 实现 admin-web 商品选择器和统一的卡片发送状态。
- [x] (2026-08-17 18:50+08:00) 统一 `route` 卡片协议，保留小程序对旧数据 `linkUrl` 的安全兼容。
- [x] (2026-08-17 19:05+08:00) 补齐后端、admin-web 与 miniapp 回归测试，同步 OpenAPI/生成客户端，更新客服 runbook、产品要求和近期变更记录。
- [x] (2026-08-17 19:20+08:00) 完成定向与模块级验证；数据库集成用例因本机无 `COMMERCE_DB_DSN` 明确 skip。

## Surprises & Discoveries

- Observation: admin-web 发送商品卡片时写入 `linkUrl: /goods/<id>`，miniapp 点击卡片只读取 `route`。
  Evidence: `apps/admin-web/src/react/pages/admin/SupportWorkspacePage.tsx` 的 `handleSendProductCard` 与 `apps/miniapp/src/pages/support/chat/index.tsx` 的 `handleCardClick` 使用不同字段。
- Observation: admin-web 只把商品列表第一页的前两项渲染成文案完全相同的按钮。
  Evidence: `productOptions.slice(0, 2)` 和固定文案“发商品卡片”。
- Observation: 后端在坐席对未认领会话发送时自动认领，但前端同时提供显式“认领”按钮，导致业务规则不唯一。
  Evidence: `services/commerce/internal/http/handler/support.go` 的 `createSupportMessage` 在 `AssigneeUserID` 无效时调用 `ClaimSupportConversation`。
- Observation: 会话所有权还影响图片上传、释放与转接；若只收紧最终消息 POST，非坐席仍可创建孤立图片资产或转走他人会话。
  Evidence: 原图片上传只检查 `canAccessSupportConversation`，原 `canManageSupportTransfer` 对任意 CS 返回 true；已统一复用 `canOperateSupportConversation`。
- Observation: Playwright 1.58.2 需要 Chromium headless shell revision 1208，本机原缓存版本不匹配。
  Evidence: 初次 E2E 报 `Executable doesn't exist ... chromium_headless_shell-1208`；安装匹配版本后在沙箱外执行 6 个客服 Playwright 用例全部通过。

## Decision Log

- Decision: 采用“显式认领后才可已读和发送”的单一规则，移除首次发送自动认领。
  Rationale: 认领是用户可见的责任转移动作，不应由另一个发送接口隐式完成；单一规则也能使前后端权限一致。
  Date/Author: 2026-08-17 / Codex
- Decision: 商品卡片的规范跳转字段为 miniapp 内部路由 `route`，小程序仅对可安全转换的旧 `linkUrl` 提供兼容。
  Rationale: 商品详情是小程序内部页面，现有小程序发送端已使用 `route`，这是已验证的实现。
  Date/Author: 2026-08-17 / Codex
- Decision: 选品器只从现有 `GET /catalog/products` 读取 `ACTIVE` 商品，使用服务端搜索与分页，不新增专用接口或运行时依赖。
  Rationale: 现有目录接口已包含 `q`/`page`/`pageSize` 且默认过滤上架商品，复用可保持最小改动。
  Date/Author: 2026-08-17 / Codex
- Decision: 后端对 `PRODUCT_CARD` 验证 `productId`、商品存在性和 `ACTIVE` 状态，服务端用目录数据重建标题和图片快照。
  Rationale: 不信任调用方传入的商品名称和图片，避免发送不存在、下架或被篡改的商品信息。
  Date/Author: 2026-08-17 / Codex

## Outcomes & Retrospective

实施已完成。后台待领取会话的编辑器和附件入口会保持禁用，认领后才开放；非当前 CS 不能已读、上传、发送、释放或转接。选品器可搜索与分页，发送按钮带商品名称/图片上下文并防止重复点击。Commerce 拒绝非 UUID、不存在和非上架商品，且忽略调用方伪造的名称/图片；miniapp 对新 `route` 与安全旧 `linkUrl` 都能生成正确详情路由。

验证证据：admin-web typecheck 与 production build 退出 0；客服 Playwright 为 6 passed（包含发送失败保留选品器并展示原因）；miniapp 定向 Jest 为 2 suites / 16 tests passed，ESLint 与 TypeScript 退出 0；Commerce 全模块 `go test ./services/commerce/...` 在允许 httptest 回环端口后退出 0；OpenAPI 六服务同步检查和 `git diff --check` 通过。未提供 PostgreSQL DSN，因此新增的两个真库集成用例编译通过但明确 skip；其规则另有无数据库单元测试覆盖。

## Context and Orientation

`apps/admin-web/src/react/pages/admin/SupportWorkspacePage.tsx` 是后台客服工作台，负责会话列表、认领、已读、回复和客户上下文。`apps/admin-web/src/react/pages/admin/supportWorkspaceData.ts` 负责将 API 数据归一化为页面类型并生成卡片请求。`apps/admin-web/src/lib/api.js` 提供前端 HTTP 包装。

`services/commerce/internal/http/handler/support.go` 是客服 REST 处理器。“认领”是把 `support_conversations.assignee_user_id` 设为当前坐席；“已读”是清零客服侧未读数；“商品卡片”是 `support_messages.card_payload` JSON 中的一份商品快照。`services/commerce/internal/http/handler/support_integration_test.go` 在提供 `COMMERCE_DB_DSN` 时运行真实 PostgreSQL 集成测试。

`apps/miniapp/src/pages/support/chat/index.tsx` 渲染客户聊天消息并处理卡片点击。商品详情内部路由由 `apps/miniapp/src/routes.ts` 的 `goodsDetailRoute(id)` 生成，格式为 `/pages/goods/detail/index?id=<productId>`。

## Plan of Work

第一个里程碑收紧后端所有权。先在集成测试中创建未认领会话，断言坐席已读和发送均返回 403；认领后两者成功；另一坐席仍然被拒绝。然后移除 `createSupportMessage` 的自动认领，在 staff 已读分支中复用当前坐席检查。客户侧已读规则保持不变。

第二个里程碑改造 admin-web。页面以当前会话的 `assigneeUserId` 和登录用户 ID 计算 `canOperateConversation`，只有真实认领人可已读或使用编辑器。未认领时显示明确提示；已被他人认领时显示当前坐席并禁用认领。mock 模式的认领在本地状态中完成，以保持页面演示和 E2E 可用。

第三个里程碑把前两个无名商品按钮替换为一个“选择商品”入口。弹层使用 `GET /catalog/products?q=<query>&page=<page>&pageSize=12`，渲染图片、名称与选择按钮，并提供搜索、上一页、下一页和加载/空/错误状态。选中后发送 `PRODUCT_CARD`，其 `route` 与 `goodsDetailRoute` 一致。文本、订单和商品发送都在 `sending` 为 true 时禁用，并通过 `try/catch/finally` 统一反馈。

第四个里程碑强化商品卡片的服务端可信度。`PRODUCT_CARD` 必须包含 UUID `productId`，服务端用 `CatalogStore.GetProduct` 读取商品，拒绝不存在或非 `ACTIVE` 商品，并用商品名称、封面和标准 `route` 重建卡片 JSON。后端不快照价格、库存或 SKU，因为当前 ProductSummary 契约不含这些字段，卡片点击后以实时详情为准。

第五个里程碑补齐跨端测试和文档。Playwright 必须证明认领前不能回复，认领后可搜索并发送第二个商品，且请求含标准 `route`。miniapp Jest 必须证明标准 `route` 和可转换旧 `linkUrl` 都可导航，非法外部链接不导航。更新 `docs/runbooks/online-support-v1.md`、`docs/context/product-requirements.md` 和 `docs/CHANGELOG.md`。

## Concrete Steps

在仓库根目录执行定向失败测试。Commerce 集成测试命令是 `COMMERCE_DB_DSN=<test-dsn> go test ./services/commerce/internal/http/handler -run 'TestSupport' -count=1`；未提供 DSN 时该套件应明确 skip，并辅以不需要数据库的卡片解析单元测试。admin-web 命令是 `pnpm -C apps/admin-web test:e2e:mock -- tests/e2e/support.mock.spec.ts`。miniapp 命令是 `pnpm -C apps/miniapp test -- --runInBand src/pages/support/chat/index.test.tsx`。

每个里程碑实现后重跑定向测试。最终在根目录执行 `pnpm -C apps/admin-web typecheck`、`pnpm -C apps/admin-web build`、admin support mock E2E、miniapp support Jest、`go test ./services/commerce/internal/http/handler -run 'TestSupport|TestProductCard' -count=1`、`pnpm run lint`和 `git diff --check`。

## Validation and Acceptance

人工验收时以 CS 登录 admin-web 并打开待领取会话。认领前输入框、图片、订单和商品操作不可用，页面显示“请先认领会话”。点击认领后操作可用；另一 CS 查看该会话不会清除未读，也不能发送。

点击“选择商品”后，搜索任意非首页首两个的商品，页面显示图片和名称；选中时只发送一次。客户小程序收到卡片后点击，应打开 `/pages/goods/detail/index?id=<productId>`。伪造、下架或不存在的 `productId` 应由后端返回 400，不创建消息。

## Idempotence and Recovery

所有测试、类型检查和构建命令都可重复执行。不需要数据库迁移，因为现有 JSONB `card_payload` 可保存 `route`。所有改动位于隔离 worktree，不对原工作区执行 reset、checkout 或清理。若定向测试失败，保留失败输出并只修正对应里程碑，不用删除断言的方式绕过。

## Artifacts and Notes

基线 `pnpm -C apps/admin-web typecheck` 在原工作区以退出码 0 完成。现有真实客服 E2E `apps/admin-web/tests/e2e/support-real.spec.ts` 只验证认领和文本回复；现有 mock 测试只验证历史商品卡片在 admin 端打开商品编辑抽屉，两者都没有覆盖 admin 发送后的 miniapp 点击行为。

## Interfaces and Dependencies

admin-web 不新增第三方依赖。`SupportWorkspacePage` 将定义可测试的坐席所有权辅助函数，并引入独立 `SupportProductPicker` React 组件承担搜索、分页和选择。该组件接受 `open`、`disabled`、`onClose`和 `onSelect(product)`，商品数据继续使用生成客户端的 `ProductSummary`形状。

Commerce 在 `support.go` 中增加商品卡片快照解析与构建辅助函数，使用现有 `h.CatalogStore.GetProduct(ctx, productID)`。它返回的 JSON 至少含 `title`、`subtitle`、`productId`、`imageUrl` 和 `route`。小程序使用纯函数 `resolveSupportCardRoute(payload)` 先读 `route`，再将格式为 `/goods/<productId>` 的旧 `linkUrl` 转为 `goodsDetailRoute(productId)`；不允许任意 HTTP URL 进入小程序导航。

变更记录：2026-08-17，根据客服商品消息链路定位结果创建计划，将认领所有权、商品选择、服务端校验和跨端路由视为一个端到端用户行为。

完成记录：2026-08-17，实施后将所有权范围从已读/发送扩展到图片上传、释放与转接，并记录真库集成测试因缺少 DSN 未实际运行。
