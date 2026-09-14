# 订单线上/线下付款方式选择

本 ExecPlan 是持续维护的文档，遵循 `docs/execplans/plans.md`。

## Purpose / Big Picture

客户可在小程序确认订单时选择线上或线下付款，订单保存该选择且提交后不可切换。线上订单沿用现有微信支付链路，线下订单等待 admin 确认收款；admin 订单列表同时显示付款方式和到账状态。

## Progress

- [x] (2026-09-14) 核对现有 commerce、payment、miniapp 和 admin 支付数据链路。
- [x] (2026-09-14) 增加 `paymentMethod` 契约、数据库字段与后端状态约束。
- [x] (2026-09-14) 完成小程序付款方式选择与订单列表/详情行为。
- [x] (2026-09-14) 完成 admin 组合状态显示与正确的派单限制。
- [x] (2026-09-14) 更新文档并完成定向验证。

## Surprises & Discoveries

- Observation: admin 当前会根据订单 ID 拼出并不存在的 `TXN-*` 交易号，并对所有未支付订单提供“确认线下收款”。
  Evidence: `apps/admin-web/src/react/pages/admin/OrdersPage.tsx` 中的 `getPaymentMeta` 和 `confirmOfflinePayment`。
- Observation: commerce 的增量迁移要求 `ADD COLUMN IF NOT EXISTS`。
  Evidence: 首次全量 Go 测试由 `TestIncrementalAddColumnMigrationsAreReplaySafe` 报错；迁移改为可重放写法后全量 commerce 测试通过。

## Decision Log

- Decision: 新增独立 `paymentMethod=ONLINE|OFFLINE`，不复用 `paymentStatus` 或 `paymentChannel`。
  Rationale: 付款方式是客户意图，到账状态和实际渠道是不同维度。
  Date/Author: 2026-09-14 / Codex
- Decision: 线下选择不等于已付款，且订单提交后付款方式锁定。
  Rationale: 避免未到账订单被当作已支付，并保持 admin 展示与资金链路一致。
  Date/Author: 2026-09-14 / User + Codex

## Outcomes & Retrospective

已完成订单付款方式的契约、持久化、后端锁定、小程序选择和 admin 展示。commerce/payment 全量 Go 测试、小程序定向 Jest、admin 订单页 Playwright、前端类型检查与 OpenAPI 同步检查均通过。未使用真实商户号资金链路做本次验收。

## Context and Orientation

`services/commerce` 创建订单并保存支付摘要，`services/payment` 创建线上支付会话并回写 commerce。`apps/miniapp/src/pages/order/confirm` 现在提交订单后自动尝试线上支付，`apps/admin-web/src/react/pages/admin/OrdersPage.tsx` 读取 commerce 订单列表展示支付状态。

## Plan of Work

先在 OpenAPI 和 commerce 订单表增加付款方式，再让 payment 服务拒绝线下订单的线上会话，同时让 commerce 只允许线下订单执行线下收款确认。随后修改小程序选择、列表与详情行为，最后调整 admin 文案、真实交易 ID 和派单控件。

## Concrete Steps

修改源 YAML 和 SQL 后运行 `bash tools/scripts/commerce-generate.sh` 与 `pnpm -C packages/api-client generate`。执行定向 Go、Jest 和 Playwright 用例，再运行 OpenAPI 同步与两个前端类型检查。

## Validation and Acceptance

小程序选择线上时会调用现有支付，选择线下时只创建未付订单。线下订单不出现线上继续支付入口，线上订单不能被 admin 确认成线下收款。admin 支付列显示方式与状态，且只展示真实 `latestPaymentId`。

## Idempotence and Recovery

迁移、生成和检查命令可重复执行。不重置当前工作区，不覆盖订单列表/详情中的现有未提交修改。

## Artifacts and Notes

历史数据回填规则：`payment_channel=OFFLINE` 为线下，存在微信/支付宝渠道或支付 ID 为线上，其余旧订单为线下。

## Interfaces and Dependencies

`CreateOrderRequest.paymentMethod` 和 `Order.paymentMethod` 为必填 `OrderPaymentMethod`，值只能为 `ONLINE` 或 `OFFLINE`。`paymentStatus` 继续表示到账状态，`paymentChannel` 继续表示 `WECHAT` / `ALIPAY` / `OFFLINE` 实际渠道。
