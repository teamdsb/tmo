# 普通直连商户微信支付

本 ExecPlan 是持续维护的文档，遵循 `docs/execplans/plans.md`。

## Purpose / Big Picture

小程序将只使用普通直连商户小程序支付。用户付款时，支付服务调用微信 JSAPI 小程序下单接口取得真实 `prepay_id`，小程序调用 `wx.requestPayment`；支付服务再以回调或查单结果更新订单。用户不再看到 B2B 门店助手的 `requestCommonPayment` 签名错误。

## Progress

- [x] (2026-07-23 09:00+08:00) 核对商户开通状态和现有代码，确认 JSAPI 普通支付 Provider 已存在。
- [x] (2026-07-23 09:10+08:00) 建立隔离分支并通过 payment 后端、小程序支付相关基线测试。
- [x] (2026-07-23 09:25+08:00) 修正普通微信支付 `out_trade_no` 为 32 字符可反向映射订单号，并用回调测试覆盖。
- [x] (2026-07-23 09:30+08:00) 删除 B2B 公开接口、启动配置、插件、适配器和文档。
- [x] (2026-07-23 09:35+08:00) 生成 API 代码并通过 payment 后端、小程序支付测试和 TypeScript 类型检查。

## Surprises & Discoveries

- Observation: 现有正式 Provider 将 36 字符 UUID 直接传给微信作为 `out_trade_no`。
  Evidence: `services/payment/internal/http/handler/payments.go` 调用 `Wechat.Create` 时使用 `orderID.String()`。
- Observation: 小程序默认渠道已经是 `wechat`，但仓库仍发布 B2B API、插件和 `requestCommonPayment` 代码。
  Evidence: `contracts/openapi/payment.yaml`、`apps/miniapp/src/app.config.ts` 和 `services/payment/internal/http/handler/wechat_b2b_provider.go`。

## Decision Log

- Decision: 普通支付订单号使用去掉连字符的 UUID（32 个十六进制字符）。
  Rationale: 满足微信商户订单号长度限制，同时可用 Go UUID 解析回原业务订单 ID，无需迁移数据库。
  Date/Author: 2026-07-23 / Codex
- Decision: 删除 B2B 公开支付路径而不是保留双通道。
  Rationale: 用户已决定迁移到普通直连商户；继续发布 `requestCommonPayment` 会让小程序配置和客户端选择再次偏离真实支付产品。
  Date/Author: 2026-07-23 / Codex

## Outcomes & Retrospective

代码迁移完成。部署仍需用户完成普通直连商户入驻并将凭据安全注入环境；真机小额支付是上线前的外部验收项，不能由本地测试替代。

## Context and Orientation

`services/payment/internal/provider/wechat.go` 使用微信官方 Go SDK 创建、查询和验签普通 JSAPI 支付。`services/payment/internal/http/handler/payments.go` 把 Commerce 订单转换为支付会话。`packages/payment-services/src/index.ts` 调用 `/payments/wechat/create`，`packages/platform-adapter/src/weapp/index.ts` 将支付参数传给微信客户端 API。OpenAPI 源是 `contracts/openapi/payment.yaml`，生成文件必须通过 `tools/scripts/payment-generate.sh` 更新。

## Plan of Work

先用单元测试固定订单号映射，再用 32 字符订单号调用 Provider。随后从 OpenAPI、Go 服务、客户端适配、应用配置和文档移除 B2B 门店助手接口与插件，生成接口代码并运行后端、前端和类型检查。不会在仓库、日志或文档中写入 APIv3 密钥、商户私钥或证书内容。

## Concrete Steps

在仓库根目录执行：

    bash tools/scripts/payment-generate.sh
    (cd services/payment && go test ./...)
    (cd apps/miniapp && pnpm test -- --runTestsByPath src/services/payment-availability.test.ts src/services/payment-services.test.ts src/pages/order/detail/index.test.tsx)
    pnpm -C apps/miniapp typecheck
    git diff --check

## Validation and Acceptance

后端测试必须证明普通微信支付向 Provider 传递 32 字符订单号，支付成功回调能将它映射回原订单，且重复通知不重复完成订单。小程序测试必须证明 WeChat 平台使用 `/payments/wechat/create` 和 `wx.requestPayment`。部署后，配置普通直连商户凭据并在真机完成小额支付；最终状态以服务端回调或查单为准。

## Idempotence and Recovery

生成命令可安全重复执行。迁移不更改现有支付数据；旧 B2B HTTP 路径会被移除，因此必须与小程序普通支付版本同时部署。若普通商户资料尚未完成，保持 `PAYMENT_PROVIDER_MODE=mock` 与支付功能开关关闭即可避免创建真实微信订单。

## Artifacts and Notes

工作分支为 `codex/ordinary-wechat-pay`，工作树为 `.worktrees/ordinary-wechat-pay`。根分支新增 `.worktrees/` 忽略规则的提交为 `2676866`。

## Interfaces and Dependencies

生产环境使用 `POST /payments/wechat/create`。支付服务要求 `PAYMENT_PROVIDER_MODE=wechat`、`PAYMENT_AUTH_ENABLED=true`、`PAYMENT_WECHAT_APP_ID`、`PAYMENT_WECHAT_MCH_ID`、`PAYMENT_WECHAT_API_V3_KEY`、`PAYMENT_WECHAT_MERCHANT_PRIVATE_KEY_PATH`、`PAYMENT_WECHAT_MERCHANT_SERIAL_NUMBER`、`PAYMENT_WECHAT_NOTIFY_URL`，并由微信支付回调 `POST /payments/wechat/notify`。小程序只接收 `timeStamp`、`nonceStr`、`package`、`signType` 与 `paySign` 并调用 `wx.requestPayment`。

变更记录：2026-07-23，将已废弃的 B2B 门店助手计划替换为用户选择的普通直连商户方案；实现完成后记录订单号、接口和客户端迁移结果。
