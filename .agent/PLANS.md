# 合并生产微信 B2B 支付并恢复体验版

本 ExecPlan 是持续维护的文档，遵循 `docs/execplans/PLANS.md`。实施中必须同步维护 `Progress`、`Surprises & Discoveries`、`Decision Log` 和 `Outcomes & Retrospective`。

## Purpose / Big Picture

当前 GitHub `main` 只保留普通 JSAPI `wx.requestPayment` 路径，但生产商户号 `1747937433` 是已开通的 B2B 门店助手商户，普通 JSAPI 会被微信以 `403 NO_AUTH` 拒绝。完成后，已在 ECS 部署并经真实 `ORDER_PAY_SUCC` 交易验证的 B2B 实现将进入最新 `main`，小程序生产构建使用 `wx.requestCommonPayment`，远端临时分支在合并后删除。微信开发者工具将用合并后产物再次验证调起路径。

## Progress

- [x] (2026-09-22 14:47+08:00) 审计本地/远端分支、worktree 和 PR；远端只剩 `main` 和 `codex/restore-b2b-payment`，开放 PR 为 0。
- [x] (2026-09-22 14:50+08:00) 确认 B2B 分支比 `origin/main` 落后 29 个提交、领先 4 个提交，tip 为 `4a6d8e817d0b0cc7632ad014e80d30a89710a897`。
- [x] (2026-09-22 14:50+08:00) 用微信开发者工具在当前普通 JSAPI 构建中创建 0.01 元支付会话并打开二维码调试弹窗；未扫码或扣款。
- [x] (2026-09-22 14:55+08:00) 核对历史计划与部署证据：普通 JSAPI 对当前商户返回 `403 NO_AUTH`；B2B 分支已部署 ECS，服务端查单发现真实 `ORDER_PAY_SUCC`。
- [x] (2026-09-22 15:00+08:00) 从 `origin/main` 创建隔离 worktree `.worktrees/integrate-b2b-payment` 和分支 `codex/integrate-b2b-payment`；Payment 全包 Go 基线与小程序支付 3 suites / 14 tests 通过。
- [x] (2026-09-22 15:01+08:00) 用 `--no-ff` 合并 `codex/restore-b2b-payment`；代码、OpenAPI 与生成物自动合并，仅 `.agent/PLANS.md` 和 `docs/CHANGELOG.md` 需人工合并。
- [x] (2026-09-22 15:12+08:00) 完成两个文档冲突解决；为 Orval 7.20 新增可复用的生成物尾随空白归一化脚本，Payment TypeScript 客户端连续生成两次 SHA-256 一致且 `git diff --check` 通过。
- [x] (2026-09-22 15:15+08:00) Payment Go 全包、miniapp 45 suites / 317 tests、miniapp 与全部 packages 类型检查、OpenAPI 同步和生产微信构建全部退出 0；产物含 `bb-plugin`、B2B API 和 `requestCommonPayment`。
- [x] (2026-09-22 15:20+08:00) 只读核对 ECS：payment 容器为 `PAYMENT_PROVIDER_MODE=b2b`，四项 B2B 核心配置均已设置，payment/gateway health/ready 均为 200；真机体验版请求旧普通接口返回 503，开发者工具的 B2B 接口返回 200。
- [x] (2026-09-22 15:25+08:00) 独立审查发现两个 Important：B2B 熔断开关未强制检查，且 WeChat 未显式指定渠道时仍默认普通 JSAPI。已先观察 2 个前端失败与 1 个后端失败，再修正为前后端同时强制 `wechatB2bEnabled`、WeApp 默认 `wechat_b2b`；复审确认无剩余 Critical/Important。
- [x] (2026-09-22 15:27+08:00) 修正后重新验证：Payment Go 全包、miniapp 45 suites / 318 tests、miniapp 与全部 packages 类型检查、OpenAPI 同步和生产微信构建均退出 0。
- [ ] 推送整合分支，通过 GitHub PR 合入 `main`，确认远端 `main` 包含 B2B 提交后删除 `origin/codex/restore-b2b-payment`。
- [ ] 用合并后生产构建刷新微信开发者工具，确认包含 `bb-plugin`、B2B API 路径与 `requestCommonPayment`，并给出上传体验版方案。

## Surprises & Discoveries

- Observation: 开发者工具能打开普通支付二维码，但这不证明体验版可完成交易。
  Evidence: 仓库历史预检已证明微信普通 JSAPI 下单对当前商户返回 `403 NO_AUTH`，而小程序平台有 B2B 已结算订单。
- Observation: 问题确实与分支整理有关。
  Evidence: B2B 后端在 ECS 已部署且健康，但生产小程序所需的插件、API 路径和 `requestCommonPayment` 只存在远端未合并分支；该分支的原计划明确记录“尚未上传新小程序版本”。
- Observation: 线上请求日志直接证明体验版与 payment 容器协议不一致。
  Evidence: 2026-09-22 14:43+08:00 真实 iPhone/MicroMessenger 连续请求 `POST /payments/wechat/create` 并获得 503；14:50+08:00 微信开发者工具请求 `POST /payments/wechat/b2b/create` 获得 200，后续 `POST /payments/:paymentId/recheck` 也获得 200。容器镜像为 `localhost/tmo/payment:preserved-f5e3a2b`，provider mode 为 `b2b`。
- Observation: 最新 `main` 与 B2B 分支的代码冲突很小。
  Evidence: Git 仅在两个纯文档文件产生冲突，Payment 源码、测试、OpenAPI 与生成客户端均自动合并。
- Observation: 最新依赖中的 Orval 7.20 会在新生成的 endpoint 模板行留下尾随空格，使新 B2B 生成段在 `git diff --check` 失败。
  Evidence: 未归一化时四处新行被报告 trailing whitespace；`tools/scripts/normalize-generated-whitespace.mjs` 接入 Payment generate 后，连续两次生成得到 `36a70bd77b0b511239992810ac758fdced47b35e9ca6c13e96b88415b6011658` 且差异检查通过。

## Decision Log

- Decision: 合并 B2B 分支，不删除或改成普通 JSAPI。
  Rationale: 当前商户的可用产品是 B2B 门店助手；普通 JSAPI 是账户权限错误，无法通过前端或签名代码规避。
  Date/Author: 2026-09-22 / Codex
- Decision: 在独立整合分支保留 B2B 的四个原始提交和一个 merge commit，不 squash。
  Rationale: 这保留实现、ECS 部署和真实查单修复的审计链，同时使 `main` 明确包含远端分支 tip，可安全删除来源分支。
  Date/Author: 2026-09-22 / Codex
- Decision: 不在主工作区上合并。
  Rationale: 主工作区有 72 项未提交商品规格改动；隔离 worktree 避免任何覆盖或错误提交。
  Date/Author: 2026-09-22 / Codex

## Outcomes & Retrospective

工作进行中。已确定根因为“生产需要的 B2B 小程序代码未合入 `main`，当前体验版仍使用未开通权限的普通 JSAPI”。后端 B2B provider 已在生产运行，所以修复重点是合并、构建和上传正确的小程序代码，不需要再修改商户密钥或回退 ECS。

## Context and Orientation

`packages/payment-services/src/index.ts` 决定小程序使用普通 `wechat` 还是 `wechat_b2b`。B2B 创建时先通过平台适配层获取一次性 `wx.login` code，调用 `POST /payments/wechat/b2b/create`，再把后端生成的 `commonPayParams` 交给 `wx.requestCommonPayment`。`services/payment/internal/http/handler/wechat_b2b_provider.go` 调用 code2session、生成 B2B 签名并通过微信 `getorder` 查单。客户端 success 不是资金凭据，只有完整核对商户号、订单号、attach、环境、币种和金额后的 `ORDER_PAY_SUCC` 才将 payment 与 Commerce 订单收敛为 `PAID`。

GitHub 默认分支是 `main`，审计时 tip 为 `9b65fd2`。来源分支 `codex/restore-b2b-payment` 基于 `a0b6140`，包含 `5f93747`、`78a4f43`、`0c931ed` 和 `4a6d8e8`。主工作区不参与合并；所有写操作在 `.worktrees/integrate-b2b-payment` 进行。

## Plan of Work

先解决文档冲突，将最新分支清理、商品规格与 B2B 支付变更全部保留在 `docs/CHANGELOG.md`，并把本文档更新为当前整合任务。随后运行 Payment 全包测试、B2B 小程序定向测试、全量 miniapp Jest、miniapp 类型检查、packages 类型检查、OpenAPI 同步检查和生产微信构建。构建产物必须含 `bb-plugin`、`/payments/wechat/b2b/create` 和 `requestCommonPayment`，且不包含开发假支付开关。

验证通过后提交 merge commit，推送 `codex/integrate-b2b-payment` 并创建 PR。在 GitHub CI 通过后合入 `main`，确认新 `origin/main` 包含 `4a6d8e8` 后删除远端 `codex/restore-b2b-payment`。最后用合并后的生产构建刷新微信开发者工具，上传操作只在用户明确授权的范围内执行。

## Concrete Steps

在 `.worktrees/integrate-b2b-payment` 运行：

    git status --short
    go test ./services/payment/...
    pnpm -C apps/miniapp test -- --runInBand --runTestsByPath src/services/payment-services.test.ts src/services/payment-availability.test.ts
    pnpm -C apps/miniapp test -- --runInBand
    pnpm -C apps/miniapp run lint:types
    pnpm run typecheck:packages
    pnpm run check:openapi
    pnpm -C apps/miniapp run build:weapp:prod
    git diff --check

构建后在 `apps/miniapp/dist/weapp` 搜索 B2B 插件 provider ID、B2B API 路径和 `requestCommonPayment`。提交后推送分支并通过 GitHub PR 合并；不绕过必需检查。

## Validation and Acceptance

代码验收要求上述命令全部退出 0，生成命令重复执行不产生漂移，`git diff --check` 无输出。Payment 测试必须覆盖缺少 B2B 凭据拒绝启动、非 CUSTOMER 禁止创建、线下/非本人订单拒绝、紧凑订单号、幂等重放、每次 login code 重签，以及只有微信权威查单才能写入 `PAID`。小程序测试必须证明调用顺序为 `wx.login` → B2B create → `wx.requestCommonPayment` → recheck，且不调用 ordinary `wx.requestPayment`。

分支验收要求 `origin/main` 包含来源 tip `4a6d8e8`，远端不再存在 `codex/restore-b2b-payment`，GitHub 没有未处理的开放 PR。主工作区原有未提交改动必须原样保留。

## Idempotence and Recovery

测试、生成和构建可重复执行。合并失败可在隔离 worktree 执行 `git merge --abort`，不影响主工作区。删除远端分支前保留 tip `4a6d8e817d0b0cc7632ad014e80d30a89710a897`；如需恢复，可从该 SHA 重建分支。ECS 已有 env 与镜像备份，本轮不修改或输出 B2B AppSecret/AppKey。

## Artifacts and Notes

历史实现计划位于 `docs/superpowers/plans/2026-09-19-restore-wechat-b2b-payment.md`，支付配置 canonical 文档为 `docs/context/payment-setup.md`。ECS payment 已运行 B2B 镜像，后端健康检查、Gateway 就绪检查和服务端 `getorder` 查单均已验证。当前线上 feature flags 为 `paymentEnabled=true`、`wechatPayEnabled=true`、`wechatB2bEnabled=false`；合并后必须按 B2B 发布设计核对该开关，不能仅上传小程序代码却继续关闭 B2B 通道。

## Interfaces and Dependencies

Payment 契约新增 `POST /payments/wechat/b2b/create`，请求包含 `orderId` 和一次性 `wechatLoginCode`，响应包含 `paymentId`、`orderId`、`channel`、`status`、`expiresAt` 和不透明 `commonPayParams`。`packages/platform-adapter` 导出 `commonPay(options: CommonPayOptions): Promise<PayResult>`，WeChat 实现调用 `wx.requestCommonPayment`。`packages/payment-services` 的 `PaymentChannel` 增加 `wechat_b2b`，WeChat 平台默认选择 B2B。生产 payment 容器使用 `PAYMENT_PROVIDER_MODE=b2b` 与受控 `PAYMENT_WECHAT_B2B_*` 变量，普通 JSAPI 代码保留但不同时处理同一订单。

变更记录：2026-09-22，建立 B2B 分支整合计划，记录 GitHub 审计、微信开发者工具复现、历史商户权限证据与初次合并结果。
