# 修复微信 B2B 支付拉起

本 ExecPlan 是持续维护的文档，遵循 `docs/execplans/plans.md`。

## Purpose / Big Picture

微信小程序的 B2B 门店助手支付不再把普通微信支付的伪造 `prepay_id` 参数传给 `wx.requestPayment`。启用并完成门店认证的用户会走 `wx.requestCommonPayment`，而支付服务只接受由真实 B2B 商户提供方生成的不透明签名参数；未配置提供方时将返回可诊断的错误，不会创建看似可支付但无法拉起的订单。

## Progress

- [x] (2026-07-13 10:00+08:00) 读取旧 Codex 对话与当前代码，确认普通微信支付假参数是拉起失败根因。
- [x] (2026-07-13 10:20+08:00) 增加 B2B API 契约、支付渠道和真实参数提供方接口的失败测试。
- [x] (2026-07-13 10:25+08:00) 实现前端 B2B 调用、门店助手插件配置和后端 fail-closed 参数提供方边界。
- [x] (2026-07-13 10:28+08:00) 生成代码并运行支付服务、小程序和类型检查验证。
- [x] (2026-07-14 09:20+08:00) 修正订单页面未传递可用性渠道的遗漏，微信订单创建与续付现均明确请求 B2B 接口。

## Surprises & Discoveries

- Observation: 当前 `buildProviderPayload` 在生产路径同样以 UUID 生成 `prepay_id` 与签名。
  Evidence: `services/payment/internal/http/handler/payments.go` 未按 `ProviderMode` 分支调用微信商户接口。

## Decision Log

- Decision: 不伪造 B2B 的 `signData`、`paySig` 或 `signature`。
  Rationale: 这些参数必须由已开通 B2B 商户号的协议和密钥生成；伪造只会把失败延后到小程序收银台。
  Date/Author: 2026-07-13 / Codex

- Decision: 订单页面将 `resolvePaymentAvailability()` 返回的渠道显式传给支付服务。
  Rationale: 虽然底层的默认检测已选择 B2B，但页面此前只传幂等键，导致可用性层选择的渠道没有进入实际请求；显式传递保证下单和续付均走 `/payments/wechat/b2b/create`。
  Date/Author: 2026-07-14 / Codex

## Outcomes & Retrospective

小程序现在使用 B2B 专用创建接口和 `wx.requestCommonPayment`；支付服务不再生成 B2B 假签名。仍需由商户按微信提供的 B2B 协议实现并注入 `WechatB2BProvider`，同时在公众平台完成插件和商户号开通；这是外部资质与密钥条件，不能用仓库代码替代。

2026-07-14 补充：订单页面原来遗漏了将已判定渠道传入 `payForOrder`，因此仍可能走普通微信支付。现已修正为 `wechat_b2b`。

## Context and Orientation

`apps/miniapp` 是 Taro 小程序。`packages/platform-adapter` 封装微信 API，`packages/payment-services` 调用生成的 Payment API。`services/payment` 建立支付会话并保存状态。微信 B2B 门店助手使用微信的 `requestCommonPayment`，其参数由服务端生成；普通微信支付使用 `requestPayment`，两者不能混用。

## Plan of Work

先以测试固定微信端选择 B2B 创建接口并原样调用 `requestCommonPayment` 的行为。接着扩展 Payment OpenAPI 与生成代码，增加 `WECHAT_B2B` 渠道和仅接收不透明支付参数的响应。支付服务引入提供方接口：测试/开发可显式注入确定的参数，生产未配置真实提供方时拒绝请求。最后配置门店助手插件，并在小程序调用前检查插件授权状态，未授权时提示用户完成认证。

## Concrete Steps

在仓库根目录运行：

    bash tools/scripts/payment-generate.sh
    go test ./services/payment/internal/http/handler
    pnpm -C apps/miniapp test -- payment-services
    pnpm -C apps/miniapp typecheck

## Validation and Acceptance

微信端支付服务测试应证明它调用 B2B 创建接口和 `commonPay`，不调用普通 `pay`。Payment handler 测试应证明 B2B 响应没有普通支付字段，未设置提供方时返回明确错误。小程序配置应包含门店助手插件。完整链路仍需在微信侧完成插件、门店认证、B2B 商户号及官方服务端协议配置后做真机验收。

## Idempotence and Recovery

生成脚本可重复执行。修改均为新增契约和 fail-closed 行为；若真实 B2B 提供方未部署，保持功能开关关闭即可回到不可支付但不产生伪支付会话的状态。

## Artifacts and Notes

旧对话在 Codex task `019f56b6-4a2f-7553-8690-71490d1cad54`，其中包含前次未提交的 B2B 骨架。该骨架的模拟参数不会直接迁入生产路径。

## Interfaces and Dependencies

新增 `POST /payments/wechat/b2b/create`，响应包含 `paymentId`、`orderId`、`channel: WECHAT_B2B`、`status`、`expiresAt` 与 `commonPayParams`。`commonPayParams` 原样传入 `wx.requestCommonPayment`。

变更记录：2026-07-13，替换已完成的旧订单派单计划，记录本次微信支付修复的根因和执行路径。
