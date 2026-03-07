# 后端任务清单（Admin 对齐，细颗粒度执行版）

本 ExecPlan 是活文档。`Progress`、`Surprises & Discoveries`、`Decision Log`、`Outcomes & Retrospective` 四个章节必须随着推进持续更新。

本文件遵循仓库规范 `/docs/execplans/plans.md`，目标是持续回答并落地“后端相较于 Admin 前端还缺少什么，以及按什么顺序补齐”。

## Purpose / Big Picture

Admin 前端页面已覆盖用户运营、询价协同、支付审计、供应商、报价工作流、客服工作台、系统设置等运营场景。若后端缺口不补齐，页面会长期停留在“静态壳 + mock + TODO 注释 + 真实模式降级提示”的状态。该计划要把这些页面逐步转为“真实接口驱动的可操作系统”，并且给出可重复执行、可验证、可回退的实现路径。

当本计划的每个里程碑完成后，管理员应能看到可观测行为变化，而不是仅看到代码提交：
用户运营页面能真实查询管理员并执行客户提权；询价页面右侧画像来自后端；支付页能检索交易并操作 webhook 重放；后续里程碑继续覆盖供应商、报价、客服与设置。

## Progress

- [x] (2026-03-05 16:11 +0800) 阅读 `/docs/execplans/plans.md` 并确认文档结构与约束。
- [x] (2026-03-05 16:18 +0800) 对照 `apps/admin-web` 页面与 API 调用，整理 Admin 页面能力现状。
- [x] (2026-03-05 16:23 +0800) 对照 `services/*/internal/http` 与 `contracts/openapi/*.yaml`，确认后端已实现与未实现范围。
- [x] (2026-03-05 16:28 +0800) 输出“后端缺口清单 + 优先级 + 接口建议”。
- [x] (2026-03-05 22:16 +0800) 完成 P0-用户运营闭环：新增 `GET /admin/users`、`POST /admin/customers/{customerId}/promote-to-sales`，并完成前端接线。
- [x] (2026-03-05 22:16 +0800) 完成 P0-询价画像闭环：新增 `GET /admin/inquiries/{inquiryId}/requirement-profile`，替换前端 TODO 兜底路径。
- [x] (2026-03-05 22:16 +0800) 完成 P0-支付运营闭环：新增交易/审计/Webhook 查询与 `replay` 接口，替换支付页静态壳。
- [x] (2026-03-05 22:16 +0800) 同步 OpenAPI 聚合契约、网关显式路由，并补充后端测试覆盖。
- [x] (2026-03-06 00:18 +0800) 完成 P1-供应商域：新增 `/admin/suppliers*` 契约、Gateway 显式分流、Commerce 持久化表与接口、Admin 前端真实接线、e2e 覆盖。
- [ ] (下一里程碑) 完成 P1-报价工作流域（版本流、状态流转、审批动作）。
- [ ] (下一里程碑) 完成 P1-客服工作台域（会话聚合、分配、关闭、消息联动）。
- [ ] (下一里程碑) 完成 P1-系统设置持久化域（general/security/notifications/history）。

## Surprises & Discoveries

- Observation: 初次盘点时“后端缺失”与“前端未接线”混在一起，导致优先级易被误判。
  Evidence: `identity` 已有 `admin/customers`、`admin/customer-tags`、`admin/customers/transfer`，但部分页面仍展示 mock。

- Observation: 用户运营页的“客户提权为业务员”历史路径是调用 `PATCH /staff/{id}`，这会把“客户 ID 当员工 ID”导致真实模式下常见 404。
  Evidence: `apps/admin-web/src/react/pages/admin/UserOperationsPage.tsx` 旧逻辑调用 `patchStaffRoles(customer.id, ...)`。

- Observation: 支付服务已有支付创建与回调最小能力，但 Admin 运营视图缺少查询与运维接口，导致页面只能做静态展示。
  Evidence: 旧 `contracts/openapi/payment.yaml` 仅覆盖 `/payments/*/create` 与 `/payments/wechat/notify`。

- Observation: 网关如果不做显式 `/admin/*` 分流，容易让新增路径落入默认转发，出现“接口存在但请求发错服务”的隐式故障。
  Evidence: `services/gateway-bff/internal/http/server.go` 路由顺序决定了 `/admin/*` 的上游归属。

- Observation: Payment Admin 接口首版实现目前是运行时内存数据，满足页面闭环但不满足长期审计落库要求。
  Evidence: `services/payment/internal/http/handler/admin_payments.go` 当前存储为进程内结构体。

- Observation: 供应商页是“重 UI 壳但零数据契约”，不先裁剪页面结构就很难以低风险完成真实接线。
  Evidence: `apps/admin-web/src/react/pages/admin/SuppliersPage.tsx` 原文件无任何接口调用且所有指标硬编码。

- Observation: `/admin` 默认兜底转发虽可工作，但新增能力不做显式路由时难以通过测试证明“请求一定命中预期上游”。
  Evidence: 为 `/admin/suppliers*` 新增显式路由后，可在 `services/gateway-bff/internal/http/server_routes_test.go` 稳定断言 upstream。

## Decision Log

- Decision: 采用“按页面闭环”推进，而非按服务分层一次性铺开。
  Rationale: 页面闭环能更快暴露契约问题并产生可见价值，便于产品与前端同步验收。
  Date/Author: 2026-03-05 / Codex

- Decision: P0 范围锁定用户运营、询价画像、支付运营三块，不把 P1 域建模混入同一实现批次。
  Rationale: 控制变更面，优先打通阻塞性能力。
  Date/Author: 2026-03-05 / Codex

- Decision: 客户提权接口采用幂等语义，重复调用返回成功且不重复副作用。
  Rationale: Admin 操作常见重复提交，幂等可降低误操作风险。
  Date/Author: 2026-03-05 / Codex

- Decision: 支付运营接口首版接受“最小可用 + 可联调”，后续再演进为持久化审计模型。
  Rationale: 先满足页面真实化和接口稳定，再做数据模型升级。
  Date/Author: 2026-03-05 / Codex

- Decision: 所有新增 Admin 能力先进入 `contracts/openapi/admin.yaml`，再由 `contracts/openapi/openapi.yaml` 聚合。
  Rationale: 保证前后端契约来源唯一，避免散落定义。
  Date/Author: 2026-03-05 / Codex

- Decision: 供应商域首版在 `commerce` 侧采用专用表（`admin_suppliers`、`admin_supplier_contacts`、`admin_supplier_scorecards`）直接落库，不等待跨服务拆分。
  Rationale: 该域当前仅用于 Admin 运营，先保证页面闭环和数据可持久，再评估是否抽离独立服务。
  Date/Author: 2026-03-06 / Codex

- Decision: 供应商写接口 `PATCH /admin/suppliers/{supplierId}` 限制为 `MANAGER/BOSS/ADMIN`，读接口放宽到运营相关角色。
  Rationale: 降低误改风险，同时保持客服/销售对供应商信息可见。
  Date/Author: 2026-03-06 / Codex

## Outcomes & Retrospective

本轮已经完成 P0 + P1(供应商) 四个页面域的闭环：用户运营、询价画像、支付运营、供应商管理均可真实请求并执行关键动作。当前主要风险继续收敛到“域模型深度不足”：支付运营仍是内存模型，P1 中报价/客服/设置三域仍待建立。

下一阶段应进入 Milestone 2（报价工作流域），继续按“契约冻结 -> 网关分流 -> 服务实现 -> 前端接线 -> 行为验收 -> 回归测试”推进，避免并行扩散多个未闭环域。

## Context and Orientation

仓库是多服务结构，和本计划相关的核心位置如下：

- Admin 前端入口：`apps/admin-web/src/react/pages/admin/*.tsx` 与 `apps/admin-web/src/lib/api.js`。
- 网关路由与转发：`services/gateway-bff/internal/http/server.go`、`services/gateway-bff/internal/http/proxy.go`。
- 身份与用户运营：`services/identity/internal/http/handler/*.go`、`services/identity/queries/identity.sql`。
- 询价相关：`services/commerce/internal/http/handler/inquiries*.go`。
- 支付相关：`services/payment/internal/http/handler/*.go`。
- API 契约：`contracts/openapi/admin.yaml` 与 `contracts/openapi/openapi.yaml`。

术语约定（本计划内统一含义）：

- 页面闭环：同一页面所需能力在契约、网关、服务、前端全部连通并可操作。
- 幂等：重复提交相同意图，不产生重复副作用，返回可接受结果。
- 可见验收：通过页面行为或接口响应证明功能生效，而非仅证明“代码已写”。

## 现状分层（已完成 / 未完成）

### 已完成（P0）

- 用户运营：管理员列表聚合接口、客户提权幂等接口、前端真实接线。
- 询价：需求画像接口、询价页右侧画像真实化。
- 支付：交易列表/详情、审计日志、Webhook 列表、Webhook 重放、支付页真实接线。
- 契约与路由：OpenAPI 聚合新增路径，Gateway 显式分流新增 `/admin/*` 路径。

### 已完成（P1）

- 供应商域：新增 `/admin/suppliers` 列表/详情/更新与 contacts/scorecards 接口，完成 DB 持久化、网关显式分流、前端真实接线与 e2e 覆盖。

### 未完成（P1/P2）

- 报价工作流：缺版本、状态机、审批动作接口。
- 客服工作台：缺会话聚合、分配、关闭、消息管理接口。
- 系统设置：除 feature flags 外缺 general/security/notifications/history 持久化接口。
- 分析增强：RBAC 专项分析、导入任务专项分析、实时增量能力仍待决策。

## 后续里程碑（细颗粒度执行）

### Milestone 1：供应商域（P1）

状态：已完成（2026-03-06 00:18 +0800）。

目标是让 `SuppliersPage` 从静态展示转为真实列表/详情/更新能力。该里程碑结束后，管理员能看到真实供应商清单并编辑关键字段。

实现顺序：
先在 `contracts/openapi/admin.yaml` 冻结 `/admin/suppliers`、`/admin/suppliers/{id}`、`/admin/suppliers/{id}/contacts`、`/admin/suppliers/{id}/scorecards`。然后在 gateway 增加 `/admin/suppliers*` 显式转发。接着在 commerce（或新 service，按仓库策略优先复用 commerce）建立表结构、sqlc 查询、handler 与权限校验。最后替换前端页面 mock 数据并补回归。

验收行为：
管理员进入供应商页面后可看到真实分页；编辑后刷新页面数据保持一致；权限不足请求返回结构化 403。

### Milestone 2：报价工作流域（P1）

目标是把 `QuoteWorkflowPage` 的版本流与审批动作变成真实状态机，不再依赖前端硬编码状态。

实现顺序：
契约先定义 `/admin/quotes`、`/admin/quotes/{quoteId}`、`/admin/quotes/{quoteId}/versions`、`/submit`、`/approve`、`/reject`。后端实现时必须先固化状态流转规则与非法流转错误码，再开放前端按钮。网关增加 `/admin/quotes*` 显式路由。前端按状态驱动按钮可用性。

验收行为：
报价从草稿到提交到审批通过/拒绝全链路可操作，非法状态流转明确返回业务错误码。

### Milestone 3：客服工作台域（P1）

目标是让 `SupportWorkspacePage` 真实连接会话与消息聚合接口。

实现顺序：
先定义 `/admin/support/conversations`、`/{id}`、`/{id}/messages`、`/{id}/assign`、`/{id}/close`。服务侧实现会话列表过滤、消息历史、分配与关闭动作。网关新增 `/admin/support*` 路由。前端接线后删除会话 mock。

验收行为：
客服可按条件筛选会话、查看消息、分配责任人、关闭会话，刷新后状态一致。

### Milestone 4：系统设置持久化（P1）

目标是让 `SettingsPage` 不再只依赖 feature flags，而是具备真实配置中心能力。

实现顺序：
定义 `GET/PUT /admin/settings/general`、`security`、`notifications` 与 `GET /admin/settings/history`。先实现配置版本化与审计日志，再接前端表单提交。

验收行为：
设置改动可持久化，历史记录可查询，权限不足返回 403。

### Milestone 5：统计与实时增强（P2）

目标是补齐仪表盘专用分析与是否需要实时流能力的产品决策。

实现顺序：
优先补 `GET /bff/admin/analytics/rbac` 与 `GET /bff/admin/analytics/import-jobs`。实时能力（SSE 或轮询）在产品明确后再定，避免过早复杂化。

验收行为：
仪表盘不再提示“待接入”，统计数据来源单一且可复现。

## Plan of Work

本计划后续实施遵循以下固定顺序，不跳步：

1. 契约冻结：新增路径、请求参数、响应结构、错误语义、权限要求。
2. 网关分流：在 `gateway-bff` 明确新增路径的上游归属，避免默认路由误转发。
3. 服务实现：落地 DB 查询、handler、权限与审计逻辑。
4. 前端接线：替换页面 mock 分支，统一错误提示文案。
5. 验收回归：执行页面行为验收与 `go test`/前端构建。

每个里程碑都必须完成这五步才算“Done”。

## Concrete Steps

在仓库根目录 `/Users/lifuyue/Documents/tmo` 执行。

盘点与定位命令（适用于每轮开始）：

    rg -l "from '../../../lib/api'" apps/admin-web/src/react/pages/admin/*.tsx
    rg -n "TODO|待接入|mock" apps/admin-web/src/react/pages/admin/*.tsx
    rg -n "^  /admin/" contracts/openapi/openapi.yaml
    rg -n "router.Any\(" services/gateway-bff/internal/http/server.go

供应商里程碑建议起步命令：

    rg -n "SuppliersPage|supplier" apps/admin-web/src/react/pages/admin -g '*.tsx'
    rg -n "supplier" contracts/openapi/*.yaml services/* -g '*.{yaml,go,sql}'

里程碑开发完成后的统一验证命令：

    go test ./... -C services/identity
    go test ./... -C services/commerce
    go test ./... -C services/payment
    go test ./... -C services/gateway-bff
    pnpm -C apps/admin-web build

建议在每个里程碑结束后补充一段“期望输出节选”，用于下一位执行者快速对比。

## Validation and Acceptance

验收必须以“可见行为”为准：

- 用户运营：管理员 tab 显示真实数据；客户提权后刷新可见角色变化；重复点击提权不报错且无重复副作用。
- 询价：右侧画像字段来自后端接口；接口失败时前端有明确降级提示。
- 支付：交易查询、详情查看、Webhook 重放可操作；重放动作有可追踪结果。
- 后续 P1 域：每个页面至少完成“列表 + 详情/动作 + 刷新一致性”三项验收。

测试要求：

- 新增 handler 必须补最小单测或集成测。
- 网关新增路由必须补路由命中测试。
- 前端变更必须通过 `pnpm -C apps/admin-web build`。

## Idempotence and Recovery

- 接口重复调用：写操作接口优先幂等，至少保证重复调用不会造成重复写入。
- 失败恢复：接口分阶段上线时可先返回结构化 `501 not_implemented`，避免静默失败。
- 回滚策略：按页面粒度开关/回退，避免一次性回滚影响所有已完成能力。
- 数据安全：涉及状态流转的接口必须在审计日志中记录 `actor/action/target/requestId`。

## Artifacts and Notes

关键已落地能力（用于快速定位）：

- 用户运营接口实现：`services/identity/internal/http/handler/admin.go`
- 询价画像接口实现：`services/commerce/internal/http/handler/inquiries_admin.go`
- 支付运营接口实现：`services/payment/internal/http/handler/admin_payments.go`
- 供应商接口实现：`services/commerce/internal/http/handler/suppliers_admin.go`
- 供应商迁移脚本：`services/commerce/migrations/00013_create_admin_suppliers.sql`
- 供应商网关路由测试：`services/gateway-bff/internal/http/server_routes_test.go`
- 网关路由落点：`services/gateway-bff/internal/http/server.go`
- 前端接线入口：`apps/admin-web/src/lib/api.js`
- 契约聚合入口：`contracts/openapi/openapi.yaml`

## Interfaces and Dependencies

当前新增与后续新增接口统一遵循以下规则：

- 鉴权：Bearer JWT，权限由现有 RBAC 模型控制。
- 分页：统一 `items/page/pageSize/total`。
- 错误：统一结构化错误（`code/message/requestId`）。
- 审计：关键写操作必须记录审计事件，至少包含操作者与目标对象。
- 时间：RFC3339；ID：UUID（当业务天然非 UUID 时在契约中显式声明）。

---

变更记录（2026-03-05 / Codex）：首次创建本清单，目标是把“后端相较 Admin 前端缺失项”从页面现象映射到可执行任务。
变更记录（2026-03-05 / Codex）：完成 P0 细颗粒度补全实现，落地管理员聚合、客户提权、询价画像、支付运营查询与 replay，并完成网关与 Admin 前端接线。
变更记录（2026-03-05 / Codex）：将清单升级为“细颗粒度执行版”，补充里程碑顺序、验收口径、命令模板、恢复策略与下一阶段执行路径，便于连续迭代。
变更记录（2026-03-06 / Codex）：完成 P1-供应商域：新增供应商契约与聚合路径、Gateway 显式路由、Commerce 持久化与接口、Admin SuppliersPage 真实接线，并补充 gateway 路由测试与 admin-web e2e 覆盖。
