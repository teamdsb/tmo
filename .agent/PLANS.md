# 在最新代码上恢复微信 B2B 支付并部署 ECS

本 ExecPlan 是持续维护的文档，遵循 `docs/execplans/plans.md`。详细的逐文件测试驱动步骤位于 `docs/superpowers/plans/2026-09-19-restore-wechat-b2b-payment.md`；实施期间两份文档必须同步更新。

## Purpose / Big Picture

完成后，生产小程序将重新使用商户号 `1747937433` 已开通的 B2B 门店助手支付能力。小程序调用 `wx.requestCommonPayment`，支付服务用服务器保存的 B2B AppKey 和 AppSecret 生成签名参数，而不再把该专用商户号错误地当作普通 JSAPI/APIv3 商户。用户可以从订单页拉起原来的 B2B 收银台；服务端继续保留最新代码的鉴权、订单归属校验、金额计算、幂等和状态单调性保护。

## Progress

- [x] (2026-09-19 12:20+08:00) 创建隔离 worktree `.worktrees/restore-b2b-payment` 和分支 `codex/restore-b2b-payment`，基于最新业务分支提交 `a0b6140`，未触碰原工作区脏文件。
- [x] (2026-09-19 12:25+08:00) 运行后端全量基线，所有 Go 包通过；运行支付相关小程序基线，5 suites / 38 tests 通过。
- [x] (2026-09-19 12:30+08:00) 定位历史边界：8 月 11 日 ECS 实际代码 HEAD 为 `bb47c7f`，生产环境为 `PAYMENT_PROVIDER_MODE=live`、B2B 商户号 `1747937433`；`5590803` 是随后对 B2B 参数和订单号格式的兼容修复。
- [x] (2026-09-19 12:34+08:00) 确认旧 B2B 配置不使用 APIv3 Key；AppKey 与 AppSecret 仍在权限受控的 ECS 备份 `/opt/tmo-main-deploy/backups/predeploy-20260811230506/env.ecs.local` 中。
- [x] (2026-09-19 12:50+08:00) 为 B2B OpenAPI、后端签名 provider、鉴权创建接口和生产配置补充失败测试并实现。
- [x] (2026-09-19 13:05+08:00) 在最新 Payment 代码上实现显式 `b2b` provider mode，保留普通 JSAPI 代码但生产只启用一个模式。
- [x] (2026-09-19 13:12+08:00) 恢复小程序插件声明、`wx.requestCommonPayment` 平台适配和 B2B payment service 调用。
- [x] (2026-09-19 13:15+08:00) 重新生成 Payment Go/TypeScript 客户端并同步聚合 OpenAPI。
- [x] (2026-09-19 13:20+08:00) 更新支付 canonical 文档、ECS runbook 和变更记录。
- [x] (2026-09-19 13:35+08:00) 后端全量、小程序 44 suites / 307 tests、TypeScript 类型、OpenAPI 同步和生产 WeChat 构建通过；产物含 B2B 插件、API 路径和 `requestCommonPayment`。
- [x] (2026-09-19 13:48+08:00) 独立代码复核完成；修复 AppSecret 错误泄漏、普通幂等重签和并发唯一键重签后，复核结论为无剩余 Critical/Important、可提交。
- [x] (2026-09-19 13:52+08:00) 提交 `5f93747 feat(payment): restore wechat b2b payment` 并推送 `origin/codex/restore-b2b-payment`。
- [x] (2026-09-19 14:50+08:00) 备份 ECS env 和 payment 镜像，从提交 `5f93747` 的干净 archive 构建 `localhost/tmo/payment:b2b-5f937472d1c5`，恢复受控 B2B 凭据并切换 provider mode。
- [x] (2026-09-19 14:52+08:00) 验证 ECS payment/gateway 本地及公网 health/ready 为 200，新 B2B 路由未认证请求为 401，运行镜像匹配候选镜像，启动日志无 ERROR；回滚 env 位于 `/opt/tmo-backups/b2b-restore-20260919T044143Z/env.ecs.local`，回滚镜像为 `localhost/tmo/payment:rollback-20260919T044143Z`。
- [x] (2026-09-20) B2B recheck 接入微信 `getorder` 服务端查单：已发现一笔本地待付款但微信返回 `ORDER_PAY_SUCC` 的真实交易；实现后仅接受完整金额、商户和订单关联校验均一致的成功状态。

## Surprises & Discoveries

- Observation: 用户所说“8 月中旬错误提交前”的运行版本不是 8 月源码提交，而是 ECS 在 8 月 11 日仍运行的 `bb47c7f`。
  Evidence: `/opt/tmo-main-deploy` 的 Git HEAD 为 `bb47c7f feat(payment): add wechat b2b payment signing`，同日备份 env 含完整 B2B 凭据。
- Observation: 当前最新 Compose 和 env 示例仍保留全部 `PAYMENT_WECHAT_B2B_*` 变量，删除的是代码路径和客户端调用。
  Evidence: `infra/prod/docker-compose.ecs.yml` 第 162-167 行仍向 payment 容器传入 B2B 配置。
- Observation: 历史普通 JSAPI 预检对 `1747937433` 返回 `403 NO_AUTH`，这不说明 B2B 产品失效，只说明该专用商户没有普通 JSAPI 产品权限。
  Evidence: 2026-09-12 微信返回“商户号该产品权限未开通”，而小程序平台存在 B2B 已结算历史订单。
- Observation: `apps/miniapp` 没有 `typecheck` script，类型检查命令是 `pnpm --dir apps/miniapp run lint:types`。
  Evidence: 基线 Jest 38 项通过，随后 `pnpm ... typecheck` 返回 `ERR_PNPM_NO_SCRIPT`。
- Observation: `http.Client.Do` 的 `*url.Error` 会包含带 `secret` 与 `js_code` 的完整 code2session URL，不能使用 `%w` 传入业务错误。
  Evidence: 独立复核发现泄漏路径；新增 sentinel AppSecret/login-code 回归测试，修复后错误字符串不含 URL 或凭据。
- Observation: B2B 签名依赖当前 session key，固定订单幂等键不能直接重放旧 `commonPayParams`。
  Evidence: 新增普通重试和唯一约束竞态测试；两次不同 login code 保持同一 payment ID，但响应签名随当前请求刷新，且 login code 每次仅消费一次。
- Observation: ECS 直接访问 `proxy.golang.org` 时 Go build 静默等待，切换 `GOPROXY=https://goproxy.cn,direct` 和 `GOSUMDB=sum.golang.google.cn` 后依赖下载及镜像构建完成。
  Evidence: 首次构建超过四分钟 CPU 为 0；第二次构建显示正常下载并产出镜像 `da53800926a...`。
- Observation: 服务器 Podman Compose 即使请求只重建 payment，也会按 depends_on 重启 Postgres、Identity、Commerce。
  Evidence: 部署后三个依赖容器 uptime 重置；持久化数据、Identity feature flags、四个服务 health/ready 和 Gateway 均验证正常。

## Decision Log

- Decision: 以 `bb47c7f` 的生产协议和 `5590803` 的紧凑订单号修复为参考，在 `a0b6140` 上手工移植，不 cherry-pick 或整仓回滚。
  Rationale: 最新代码包含 8 月后的鉴权、RBAC、回调验签、状态单调性、并发和商品页修复；直接回滚会重新引入已修复漏洞。
  Date/Author: 2026-09-19 / Codex
- Decision: 新增显式 `PAYMENT_PROVIDER_MODE=b2b`，不复用含义模糊的历史 `live`，也不让 ordinary WeChat 和 B2B 同时处理同一订单。
  Rationale: 单一生产 provider 能避免同一订单生成两种可支付会话；显式模式便于启动前校验四项 B2B 凭据。
  Date/Author: 2026-09-19 / Codex
- Decision: B2B 客户端返回成功后仅 recheck 并保持 `PAY_PENDING`，不把客户端结果直接写为 `PAID`。
  Rationale: 客户端回调不是资金最终凭证。恢复收银台不应撤销最新支付状态安全规则；真实结算状态后续需要微信 B2B 服务端能力或运营对账收敛。
  Date/Author: 2026-09-19 / Codex
- Decision: ECS 部署从已提交 Git SHA 构建独立 release，保留原镜像回滚标签和 env 备份，不在服务器脏工作树上 pull 或 checkout。
  Rationale: `/opt/tmo` 是脏工作树且分支落后，直接更新会覆盖现网文件或混入无关代码。
  Date/Author: 2026-09-19 / Codex

## Outcomes & Retrospective

实现与 ECS 后端部署已经完成：最新代码恢复了显式 B2B provider、客户鉴权创建接口、历史签名协议、每次 login code 重签、插件和 `wx.requestCommonPayment`；普通 JSAPI 代码仍保留但不会与 B2B 同时运行。后端全量测试退出 0，小程序 44 suites / 307 tests、miniapp 与全部 packages 类型检查、OpenAPI 同步、shell 检查和 `git diff --check` 全部退出 0；生产构建验证包含插件 provider ID、B2B API、`requestCommonPayment` 和正式域名。提交 `5f93747` 已推送，ECS payment 运行该提交构建镜像，公网健康与路由检查通过。当前尚未完成的是把本次 miniapp 生产构建上传到微信开发者工具并发布；用户本轮只要求 ECS 部署，因此未代为上传。

## Context and Orientation

仓库是 Go 微服务与 Taro/React 小程序组成的 monorepo。`services/payment` 保存支付记录并向 `services/commerce` 同步订单支付状态。`packages/payment-services` 把 Payment API 和平台支付面板组合成统一接口；`packages/platform-adapter` 封装 `wx.requestPayment` 等平台调用；`apps/miniapp` 调用这些共享包。`contracts/openapi/payment.yaml` 是 Payment 的源规范，Go 服务器代码由 `tools/scripts/payment-generate.sh` 生成，TypeScript 客户端由 `packages/payment-api-client` 的 Orval 脚本生成；生成文件不能手改。

B2B 门店助手支付与普通微信 JSAPI 支付是两套协议。普通 JSAPI 使用商户 API 证书、APIv3 Key 和 `wx.requestPayment`；本任务恢复的 B2B 协议使用小程序 AppSecret、B2B AppKey、商户号和一次性 `wx.login` code，服务端从 code2session 获得 session key 后返回 `wx.requestCommonPayment` 的不透明参数。生产 B2B 商户号是 `1747937433`，AppID 是 `wx8e8831fc456f019b`。

## Plan of Work

首先修改 Payment OpenAPI，新增 `POST /payments/wechat/b2b/create`、`WechatB2BPayCreateResponse` 和 `WECHAT_B2B` channel，然后运行生成脚本。后端新增 `WechatB2BProvider` 接口和签名实现，使用紧凑的 32 字符 UUID 作为 `out_trade_no`、原 UUID 作为 attach，并严格验证 code2session 响应。B2B 创建接口必须调用 `requireCustomer`、读取 Commerce 订单、拒绝线下或不可支付订单、使用当前用户作为 payer、复用数据库幂等约束，并把签名参数作为 provider payload 持久化。

随后为配置增加 B2B 字段和 `b2b` mode 校验。在该模式下启动缺少 AppID、AppSecret、商户号或 AppKey 时必须失败；普通 `wechat` mode 的 APIv3 校验保持不变。`tools/scripts/prod-ecs-up.sh` 接受 `b2b`，但禁止 mock，并验证 B2B 配置非空。

前端恢复 `bb-plugin` 声明、`CommonPayOptions`、`commonPay` 适配器和 B2B service 分支。WeChat 平台默认选择 `wechat_b2b`，每次创建支付前调用 `wx.login` 获取新 code，把后端返回的 `commonPayParams` 原样传给 `wx.requestCommonPayment`。取消和失败仍报告给 recheck，但 `b2b` 服务端模式不以客户端结果更新资金状态。

最后更新 `docs/context/payment-setup.md`、`docs/runbooks/deploy-ecs-cheap.md` 和 `docs/CHANGELOG.md`，运行完整验证与代码复核。提交后在 ECS 建立 env 和镜像备份，把 B2B 密钥从既有受控备份复制回当前 env，不在命令输出中显示值；从提交 SHA 的 clean archive 构建新 payment 镜像并只重建 payment 服务。

## Concrete Steps

所有开发命令在 `.worktrees/restore-b2b-payment` 执行。先写失败测试，再实现并复跑：

    go test ./services/payment/internal/http/handler ./services/payment/internal/config ./services/payment/cmd/payment -count=1
    pnpm --dir apps/miniapp test -- --runInBand --runTestsByPath src/services/payment-services.test.ts src/services/payment-availability.test.ts
    pnpm --dir packages/platform-adapter exec tsc --noEmit

修改契约后运行：

    bash tools/scripts/payment-generate.sh
    pnpm --dir packages/payment-api-client run generate
    pnpm run check:openapi

完成实现后运行：

    bash tools/scripts/test-backend.sh
    pnpm --dir apps/miniapp test -- --runInBand
    pnpm --dir apps/miniapp run lint:types
    pnpm run typecheck:packages
    pnpm --dir apps/miniapp run build:weapp:prod
    pnpm run check:openapi
    git diff --check

提交采用 Conventional Commit，例如 `feat(payment): restore wechat b2b payment`。推送到 `origin/codex/restore-b2b-payment`。

ECS 部署不得修改或切换 `/opt/tmo` 的 Git 分支。先备份 `/opt/tmo/infra/prod/env.ecs.local` 和当前 `localhost/tmo/payment:ecs` 镜像，再把提交 archive 解压到 `/opt/tmo-releases/<sha>`，构建并标记新 payment 镜像。将 `PAYMENT_PROVIDER_MODE` 设置为 `b2b`，从 2026-08-11 备份复制四项 `PAYMENT_WECHAT_B2B_*` 凭据，然后执行：

    cd /opt/tmo
    docker compose --env-file infra/prod/env.ecs.local -f infra/prod/docker-compose.ecs.yml up -d --no-deps --force-recreate payment

## Validation and Acceptance

自动化验收要求所有上述命令退出码为 0。新增后端测试必须证明：缺 B2B 凭据拒绝启动；非 CUSTOMER 不能创建；线下/非本人订单不能创建；签名使用紧凑订单号；同一订单和幂等键只产生一个 payment；B2B recheck 不因客户端 SUCCESS 写入 PAID。新增前端测试必须证明：WeChat 选择 `wechat_b2b`；调用顺序为 `wx.login`、B2B create、`wx.requestCommonPayment`、recheck；ordinary `wx.requestPayment` 不被调用；插件声明存在。

生产验收要求 payment 容器处于 running，容器内 `PAYMENT_PROVIDER_MODE=b2b` 且四项 B2B 配置仅报告 set/长度、不打印值，`/health` 与 `/ready` 返回 200，gateway `/ready` 返回 200，启动日志没有 provider 配置错误。由于本轮没有用户授权上传新的小程序版本，ECS 部署只证明后端已就绪；真正拉起 B2B 收银台还需随后上传本次生产小程序构建并真机支付 0.01 元。

## Idempotence and Recovery

生成、测试和构建命令可重复运行。ECS 每次部署使用独立 SHA 目录，重复部署同一 SHA 不改变源码。env 修改前创建带 UTC 时间戳的 `0600` 备份；旧 payment 镜像保留 `rollback-<timestamp>` 标签。如果新容器不健康，恢复 env 备份、把 `localhost/tmo/payment:ecs` 重新指向 rollback 镜像并强制重建 payment。不得删除数据库支付记录，也不得把客户端结果人工改为 PAID。

## Artifacts and Notes

基线证据：`bash tools/scripts/test-backend.sh` 退出 0；支付相关小程序为 `5 passed, 38 tests`。历史证据：ECS `/opt/tmo-main-deploy` HEAD 为 `bb47c7f`；2026-08-11 env 备份包含 `PAYMENT_WECHAT_B2B_MCH_ID=1747937433` 和长度均为 32 的 AppKey/AppSecret，`PAYMENT_WECHAT_API_V3_KEY` 未设置。

## Interfaces and Dependencies

在 `services/payment/internal/http/handler/handler.go` 定义 `WechatB2BProvider.CreateCommonPayParams(context.Context, WechatB2BPaymentRequest) (map[string]interface{}, error)`。`WechatB2BPaymentRequest` 包含 `OrderID uuid.UUID`、`AmountFen int64`、`ExpiresAt time.Time` 和 `LoginCode string`。`Handler` 增加 `WechatB2BProvider` 字段。

在 `packages/platform-adapter` 导出 `commonPay(options: CommonPayOptions): Promise<PayResult>`；WeChat 实现调用 `wx.requestCommonPayment`，其他平台返回不支持错误。`packages/payment-services` 的 `PaymentChannel` 增加 `wechat_b2b`，`PaymentSession` 增加 `commonPayParams`，WeChat 默认通道改为 B2B。

变更记录：2026-09-19，依据用户要求恢复 8 月中旬错误切换前的支付版本建立计划；历史证据证明目标是 B2B 门店助手协议而非普通 APIv3 JSAPI。
