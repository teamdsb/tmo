# Admin 线下收款与订单派发

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept current. It follows `docs/execplans/plans.md`.

## Purpose / Big Picture

后台管理员目前只能查看待支付订单，现实中的线下到账无法进入系统，因此订单也不能归属给业务员继续履约。完成后，BOSS、MANAGER、ADMIN 可以选择一名仍在职且具有 SALES 角色的员工，填写不可为空的业务备注，并在一次原子操作中确认线下收款和派单。已在线支付的订单也能直接派单；发货前可以改派。每次成功操作有持久审计记录，重复点击不会重复写事件。CS、SALES、CUSTOMER 无权操作。

## Progress

- [x] (2026-07-06 22:45+08:00) 从最新 `origin/main` 创建隔离 worktree 与 `feat/admin-offline-payment-dispatch`。
- [x] (2026-07-06 22:48+08:00) 阅读仓库规则、服务说明和 ExecPlan 规范，确认原工作区未跟踪文档不进入新分支。
- [x] (2026-07-06 22:50+08:00) Commerce、Identity、Gateway 基线测试与 Admin production build 通过。
- [x] (2026-07-06 23:00+08:00) 先观察状态转换测试编译失败，再实现契约、数据层、权限、状态机、跨服务 SALES 校验、幂等与审计。
- [x] (2026-07-06 23:07+08:00) 添加 Admin 真实付款状态、派单表单、只读详情和审计时间线；Mock 4/4、Hybrid 2/2 通过。
- [x] (2026-07-06 23:08+08:00) 更新生成代码、生产 Compose 与文档；全量后端、Go vet、Admin build、mock 同步和生成确定性通过，并完成本地审查。
- [ ] 临时 PostgreSQL 集成执行受本机 Docker daemon 无响应阻塞；测试代码已添加，`COMMERCE_DB_DSN` 缺失时按仓库约定跳过。
- [ ] 拆分 Conventional Commits 并仅推送新分支，不合并、不部署。

## Surprises & Discoveries

- Observation: 新 worktree 的 `origin/main` 已包含购物车修复和 Commerce 产品需求权限热修复。
  Evidence: HEAD 为 `b153f66`，前一提交为 `2bf5ca1`。

- Observation: 根 lint 与 Admin 全量 TypeScript 检查存在本分支未触碰的基线错误。
  Evidence: miniapp lint 在 `apps/miniapp/config/index.ts` 和 `miniapp-mode.test.ts` 报 4 个 `import/no-commonjs`；Admin `tsc --noEmit` 在 `SupportWorkspacePage.tsx` 报 4 个缺失 `normalizeSupportMessage`。这些文件均无 diff，Admin production build 成功。

- Observation: 本地 Docker Desktop 应用存在但 daemon 无响应，localhost:5432 不可达。
  Evidence: `nc -z localhost 5432` 返回 unavailable，启动 Docker Desktop 后 `docker info` 仍需中断。

## Decision Log

- Decision: Commerce 通过带当前 Bearer token 的 Identity `GET /staff/{id}` 校验目标员工，不信任前端提交的角色或状态。
  Rationale: Identity 是员工状态和角色的唯一事实来源，服务端复核可阻止绕过 UI 派给停用或非 SALES 账号。
  Date/Author: 2026-07-06 / Codex

- Decision: 线下付款确认、订单确认、负责人变更和审计事件在同一 Commerce 数据库事务中完成；外部员工校验在事务前完成。
  Rationale: 业务字段与审计必须全成或全败，同时避免数据库事务等待网络调用。
  Date/Author: 2026-07-06 / Codex

- Decision: `Idempotency-Key` 在同一订单内唯一，命中已有事件时返回当前资源，不再产生第二条审计事件。
  Rationale: 防止按钮重复点击和网络重试产生重复业务动作与审计噪音。
  Date/Author: 2026-07-06 / Codex

## Outcomes & Retrospective

功能代码与非数据库验证已完成。BOSS、MANAGER、ADMIN 的受控派单链路、Identity active SALES 复核、订单与审计事务、并发幂等、真实付款展示、只读详情和事件时间线均已落地。审查修正了“幂等查询在加锁之前”的竞态，并让 Admin 成功后重新拉取订单列表。唯一环境性缺口是本机 Docker daemon 无响应，导致带 `COMMERCE_DB_DSN` 的 PostgreSQL 集成用例未实际执行；仓库全量 Go 测试、vet、Admin production build、Mock 4/4、Hybrid 2/2、mock 同步、生成确定性和 `git diff --check` 均有成功证据。根 lint 与 Admin tsc 的既有错误已如实记录，未扩大本功能范围处理。

## Context and Orientation

Commerce 服务位于 `services/commerce`，订单 HTTP 处理器是 `services/commerce/internal/http/handler/orders.go`，SQL 源位于 `services/commerce/queries`，迁移位于 `services/commerce/migrations`。`contracts/openapi/commerce.yaml` 是 Commerce API 的源契约，生成 Go server 类型到 `services/commerce/internal/http/oapi/api.gen.go`；聚合契约与 TypeScript client 也必须通过仓库脚本重新生成。订单已有 `owner_sales_user_id`、主状态、支付状态、渠道、付款时间和最近支付 ID。

Identity 服务位于 `services/identity`，`GET /staff/{id}` 返回员工状态和角色。权限由 Identity 数据库迁移及开发 mock 共同提供。Gateway 已按路径代理 `/admin` 到 Commerce、`/staff` 到 Identity；这次 Commerce 使用配置的 Identity base URL 做服务间校验。

Admin 页面是 `apps/admin-web/src/react/pages/admin/OrdersPage.tsx`。它当前能加载真实订单，但编辑抽屉只改浏览器内存，造成“已保存但后端未变”的假象。本功能把订单详情改成只读，并增加真实派单操作和审计时间线。

“原子”表示一次数据库事务中的修改要么全部提交，要么全部回滚。“幂等”表示带相同 key 重试不会重复改变订单或写第二条事件。

## Plan of Work

先在契约和测试中刻画失败行为：缺字段、角色拒绝、员工无效、终态拒绝、重复 key、并发更新与迟到回调。接着新增 Commerce 迁移 `00022` 和 sqlc 查询，建立 `order_admin_events`，实现 Identity client 与 handler 状态机。线下收款仅允许未付款订单，将支付状态置为 PAID、渠道置为 OFFLINE、付款时间置为当前时间、清空线上 payment ID，并将主状态置为 CONFIRMED。非线下确认操作要求支付已是 PAID。PAID 或 CONFIRMED 且未发货的订单可以派单或改派；SHIPPED、DELIVERED、CANCELLED、CLOSED 拒绝。

然后在 Identity 增加 `order:manage / ALL` 并授予 BOSS、MANAGER、ADMIN；Commerce 还直接检查 JWT 角色，确保 CS、SALES、CUSTOMER 即使错误获得权限也不能操作。Admin 加载 active SALES 员工、真实 `paymentStatus`、必填备注、提交禁用、错误保留、成功刷新和事件查询。Mock 与 Hybrid 测试覆盖显示、权限、校验、成功与失败。

最后运行代码生成、Go 测试、PostgreSQL 集成测试、`go vet`、Admin production build 和相关 Playwright。逐文件审查权限绕过、跨服务失败映射、状态转换、事务、幂等、审计和生成文件差异，修正后重跑验证。按 API/数据层、后端、Admin、测试文档拆分提交并推送 `origin/feat/admin-offline-payment-dispatch`。

## Concrete Steps

所有命令在本 worktree 根目录执行：

    pnpm install --frozen-lockfile
    go test ./services/commerce/... ./services/identity/... ./services/gateway-bff/...
    pnpm -C apps/admin-web build
    bash tools/scripts/commerce-generate.sh
    bash tools/scripts/identity-generate.sh
    pnpm run test:backend
    go vet ./services/commerce/... ./services/identity/... ./services/gateway-bff/...
    pnpm -C apps/admin-web test:e2e

若本机有 PostgreSQL，则以临时数据库设置 `COMMERCE_DB_DSN` 运行 Commerce 集成测试，完成后删除临时数据库。最终执行 `git diff --check`、检查生成文件无漂移、提交并 `git push -u origin feat/admin-offline-payment-dispatch`。

## Validation and Acceptance

API 测试必须证明：三个管理角色成功；其余角色 403；缺备注或负责人 400；不存在、停用、非 SALES 员工 409；线下收款、在线已付款派单、改派分别正确改变字段且各写一条事件；相同幂等 key 重试不新增事件；并发只允许一致结果；迟到线上回调不能把已确认订单回退；终态不变；派单后只有目标 SALES 的 OWNED 查询能看到订单。

UI 测试必须证明：页面使用服务端 `paymentStatus`，有权限时出现与订单状态匹配的操作，无权限时隐藏；业务员和备注必填；提交时防重复；成功刷新订单与时间线；失败保留输入并显示服务端原因；原伪编辑器不再承诺保存。Production build 必须成功。

## Idempotence and Recovery

迁移为纯新增，可重复在新数据库执行。生成脚本可重复运行且第二次不应产生 diff。测试失败时先保留失败证据再最小修正。新分支不修改或清理原工作区；不部署、不合并。若推送被 GitHub 分支规则拒绝，保留本地提交并准确报告远端响应，不改推送目标规避规则。

## Artifacts and Notes

工作目录：`/Users/asimov3059/.config/superpowers/worktrees/tmo/feat-admin-offline-payment-dispatch`。

原工作区的 `docs/superpowers/plans/2026-06-29-weapp-privacy-compliance.md` 是用户未跟踪文件，留在原工作区且不得复制、提交或删除。

变更记录：2026-07-06，替换主分支遗留的旧 ExecPlan，因为当前活跃任务已变更为 Admin 线下收款与派单，仓库要求 `.agent/PLANS.md` 始终描述当前执行中的复杂功能。

## Interfaces and Dependencies

最终存在 `PATCH /admin/orders/{orderId}/fulfillment`，请求体含 UUID `ownerSalesUserId`、非空 `note`、布尔 `confirmOfflinePayment`，请求头必须带 `Idempotency-Key`。最终存在订单管理事件查询接口，按创建时间倒序返回操作者、动作、备注、原新主状态、原新支付状态、原新负责人和时间。Commerce 配置新增 Identity base URL，并提供可在 handler 测试中替换的 SALES 校验接口。Admin API 层提供 fulfillment patch 与 event list 调用，使用生成的契约类型而非复制 DTO。
