# 支付配置

## 适用范围

本文档适用于当前仓库的真实支付接入与联调，支付主入口在 `services/payment`：

- miniapp 在确认订单时选择 `ONLINE` 或 `OFFLINE`；只有 `ONLINE` 订单会在下单后直接调用 `payment` 服务创建支付会话。
- `commerce` 仅接收 `payment` 的内部支付状态回写，并在订单列表/详情里展示支付摘要。
- admin-web 直接调用 `payment` 服务查询交易、审计日志和 webhook，并执行 webhook replay。

当前仓库提供两种互斥的微信 provider：`b2b` 恢复 B2B 门店助手 `wx.requestCommonPayment`，`wechat`/`real` 提供普通直连 JSAPI `wx.requestPayment`。生产必须显式选择一种，不能为同一订单同时生成两种支付会话。支付宝正式 provider 尚未实现，其 create/notify 均固定返回 `501 not_implemented` 且不写支付状态；`PAYMENT_PROVIDER_MODE=mock` 只能在本地开发环境显式配置，服务代码与生产默认均为 `disabled`。

## 总体接入要求

- 支付服务必须有独立公网可达域名，供微信/支付宝异步通知调用。
- `services/payment` 需要可访问 `services/commerce`，用于读取订单金额与回写支付结果。
- miniapp 和 admin-web 都必须把支付请求直接指向 `payment` 服务，不复用 commerce API。
- 创建支付必须携带 `Idempotency-Key`，避免前端重试导致重复下单。
- `paymentMethod` 是提交后锁定的客户选择；`paymentStatus` 表示到账状态，`paymentChannel` 表示实际渠道，三者不互相代替。
- `OFFLINE` 订单保持 `UNPAID`，由 admin 确认到账后更新为 `PAID` 和 `paymentChannel=OFFLINE`；payment 服务必须拒绝为其创建线上会话。
- 客户端支付成功提示不能直接作为最终支付成功依据，必须以支付渠道异步通知或主动查单收敛为准。

## 微信支付

### 当前生产：B2B 门店助手支付

当前生产小程序使用 B2B 商户号 `1747937433`。后端 `POST /payments/wechat/b2b/create` 接收业务订单 ID 和一次性 `wx.login` code，使用服务器端的 AppSecret 调用 code2session，再用 B2B AppKey 和 session key 生成 `commonPayParams`。miniapp 将参数原样传给 `wx.requestCommonPayment`；AppSecret、AppKey 和 session key 不进入小程序包、仓库或日志。

B2B 生产配置为 `PAYMENT_PROVIDER_MODE=b2b`，必需变量为 `PAYMENT_WECHAT_B2B_APP_ID`、`PAYMENT_WECHAT_B2B_APP_SECRET`、`PAYMENT_WECHAT_B2B_MCH_ID`、`PAYMENT_WECHAT_B2B_APP_KEY`、`PAYMENT_WECHAT_B2B_ENV` 和 code2session URL。小程序必须声明 provider 为 `wx69b7451feb427f0e` 的 `bb-plugin`。

`wx.requestCommonPayment` 的客户端 success 只表示客户端流程完成，不能直接把本地 payment 或 commerce order 写成 `PAID`。B2B mode 的 recheck 会以 AppSecret 调用微信稳定版 `POST /cgi-bin/stable_token`（`force_refresh=false`）获取 access token，避免影响同 AppID 的其他服务 token，再请求微信 B2B `POST /retail/B2b/getorder`；只有微信返回 `ORDER_PAY_SUCC`，且商户号、紧凑订单号、attach、环境、币种和金额全部与本地记录一致时，才会把 payment 和 commerce order 写为 `PAID`。其余状态保持 `PAY_PENDING`。

### 可选：普通直连商户小程序支付

普通直连模式仍保留在代码中。支付服务调用 `POST /v3/pay/transactions/jsapi` 创建真实预支付单，小程序调用 `wx.requestPayment`。只有目标商户号已经开通普通 JSAPI/小程序支付并完成 AppID 绑定时，才能把生产模式切换为 `wechat`。

当前 miniapp 的 WeChat 可用通道明确选择 `wechat_b2b`。若未来把后端切换为 `wechat`，必须同时把 `apps/miniapp/src/services/payment-availability.ts` 的 WeChat 通道改为 `wechat`，重新构建、上传并发布小程序；只改 ECS provider mode 会让客户端继续请求 B2B 接口。

部署真实支付前，企业必须在微信支付侧完成普通直连商户入驻；此前特约商户/服务商模式下的证书、APIv3 密钥和商户号不能直接复用。部署环境只从 Secret 注入普通商户的 APIv3 密钥和商户私钥，绝不将这些值写入小程序、仓库或日志。

### 官方依据

- 小程序拉起支付：<https://developers.weixin.qq.com/miniprogram/dev/api/payment/wx.requestPayment.html>
- 微信支付小程序下单（JSAPI/小程序支付）：<https://pay.weixin.qq.com/doc/v3/merchant/4012791856>
- 微信支付通知：<https://pay.weixin.qq.com/doc/v3/merchant/4012791861>

### 开通与前置条件

- 已开通普通直连微信支付商户号 `mchid` 和 JSAPI/小程序支付产品。
- 小程序 `appid` 已和目标商户号完成绑定。
- 已在微信支付商户平台配置 APIv3 Key。
- 已生成商户 API 证书与商户私钥，并记录商户证书序列号。
- 已为 `payment` 服务准备公网 `notify_url`。
- 已确认小程序支付目录、服务器域名等基础配置满足微信平台要求。

### 服务端必备资料

- `appid`：微信小程序 AppID。
- `mchid`：微信支付商户号。
- `apiv3Key`：用于回调资源解密与平台证书验签。
- `merchantPrivateKey`：商户私钥，用于服务端签名。
- `merchantCertificateSerialNumber`：商户证书序列号。
- 微信支付平台证书：用于验证微信签名，需支持轮换。

### 服务端创建订单

按微信支付“小程序下单”文档，服务端需要调用 JSAPI/小程序支付下单接口，至少提供：

- `appid`
- `mchid`
- `description`
- `out_trade_no`
- `notify_url`
- `amount.total`
- `payer.openid`

关键要求：

- `payer.openid` 必须属于当前小程序用户。
- `notify_url` 必须是公网 HTTPS 地址。
- 下单成功后会返回 `prepay_id`。
- 订单号 `out_trade_no` 使用去掉连字符的 UUID：32 个字符、全局唯一，且支付回调可映射回业务订单。

### 小程序拉起支付

前端调用 `wx.requestPayment`，字段以微信官方文档为准：

- `timeStamp`
- `nonceStr`
- `package`，格式为 `prepay_id=xxx`
- `signType`
- `paySign`

本仓库建议流程：

1. miniapp 先向 `commerce` 提交订单。
2. miniapp 再向 `payment` 调用 `/payments/wechat/create`。
3. `payment` 调用微信支付下单接口，返回 `prepay_id` 与拉起支付所需签名参数。
4. miniapp 调用 `@tmo/platform-adapter` 的 `pay()`，内部再转到 `wx.requestPayment`。

### 异步通知与验签

微信支付通知文档要求校验这些请求头：

- `Wechatpay-Signature`
- `Wechatpay-Timestamp`
- `Wechatpay-Nonce`
- `Wechatpay-Serial`

通知体中的 `resource.algorithm` 为 `AEAD_AES_256_GCM`。服务端需要：

- 使用 APIv3 Key 解密回调资源。
- 使用微信支付平台证书校验回调签名。
- 校验 `mchid`、交易状态、金额和业务订单号。
- 幂等更新 `payments` 与订单支付摘要。

### 主动查单补偿

微信客户端返回成功或取消都不能替代最终落账。必须保留主动查单补偿能力，用于这些场景：

- 客户端提示成功，但异步通知未到达。
- 用户关闭支付页，前端无法确认最终状态。
- 回调验签失败后需要人工定位与重试。

本仓库对应接口为 `POST /payments/{paymentId}/recheck`，真实 provider 接入后应调用微信官方查单接口进行状态收敛。

## 支付宝

### 官方依据

- 小程序支付拉起：<https://opendocs.alipay.com/mini/api/tradepay>
- 小程序支付接入文档：<https://opendocs.alipay.com/mini/03a9co>
- 支付宝开放平台文档中心：<https://open.alipay.com/develop/manage>

如果需要补充接口细节，统一以 `opendocs.alipay.com` 下对应 API 文档为准，重点是：

- `alipay.trade.create`
- `alipay.trade.query`
- 异步通知与签名验签文档

### 开通与前置条件

- 已创建并通过审核的支付宝开放平台应用，取得 `appId`。
- 已完成小程序与支付能力开通，并确认应用具备目标支付产品权限。
- 已配置应用私钥、支付宝公钥与签名算法。
- 已为 `payment` 服务准备公网 `notify_url`。
- 已在支付宝开放平台正确配置回调、应用网关与关联小程序。

### 服务端必备资料

- `appId`
- 应用私钥
- 支付宝公钥
- 支付宝网关地址
- 签名算法
- `notify_url`

### 服务端创建交易

本仓库默认采用“小程序服务端先创建交易，再由客户端 `my.tradePay` 拉起”的模式，优先使用 `tradeNO`，不把 App 场景的 `orderStr` 当作默认主链路。

服务端应基于官方 API 文档调用 `alipay.trade.create`，核心要求：

- 每次交易必须有可追踪的商户订单号。
- 必须配置 `notify_url` 用于异步通知。
- 下单金额、标题、买家标识等业务字段要和本仓库订单信息一致。
- 交易创建成功后返回 `trade_no`，前端使用该值拉起支付。

### 小程序拉起支付

前端调用 `my.tradePay`，本仓库建议只透出 `tradeNO` 给 miniapp：

1. miniapp 向 `payment` 调用 `/payments/alipay/create`。
2. `payment` 创建交易并返回 `tradeNo`。
3. miniapp 调用 `@tmo/platform-adapter` 的 `pay()`，内部再转到 `my.tradePay`。

注意：

- 支付宝客户端返回只表示拉起结果或客户端侧处理结果，不应直接作为最终到账依据。
- 最终支付状态仍以支付宝异步通知或服务端主动查单为准。

### 异步通知与验签

支付宝真实接入时必须完成：

- 验证通知来源与签名。
- 校验交易状态、交易金额、商户订单号和应用 `appId`。
- 幂等更新本地 `payments`、webhook 记录和订单支付摘要。

### 主动查单补偿

需要保留 `alipay.trade.query` 补偿逻辑，处理：

- 客户端拉起后结果不确定。
- 异步通知延迟或失败。
- 运营在 admin-web 触发重查或 replay 后需要重新收敛状态。

本仓库对应接口仍为 `POST /payments/{paymentId}/recheck`，正式 provider 接入后应以支付宝官方查单结果为准。

## 仓库内配置映射

### `services/payment` 现有环境变量

这些变量已经在代码中生效，来源见 `services/payment/internal/config/config.go`：

| 变量 | 说明 |
| --- | --- |
| `PAYMENT_HTTP_ADDR` | payment 服务监听地址 |
| `PAYMENT_LOG_LEVEL` | 日志级别 |
| `PAYMENT_AUTH_ENABLED` | 是否开启鉴权；代码与生产默认均为 `true` |
| `PAYMENT_DB_DSN` | payment 数据库连接串 |
| `PAYMENT_JWT_SECRET` | JWT 验签密钥；鉴权开启时不能为空，生产 Compose 将其设为必填，本地 Compose 显式回退到 identity 的开发密钥 |
| `PAYMENT_JWT_ISSUER` | JWT issuer；生产默认 `tmo-identity` |
| `PAYMENT_IDENTITY_BASE_URL` | identity 服务地址；用于 feature flags 及已签名 JWT 的撤销/账号状态复核，复核不可用时鉴权请求返回 503 |
| `PAYMENT_COMMERCE_BASE_URL` | commerce 服务地址 |
| `PAYMENT_COMMERCE_SYNC_TOKEN` | payment 回写 commerce 内部接口时使用的 token |
| `PAYMENT_PROVIDER_MODE` | provider 模式；代码与生产默认 `disabled`，本地联调才显式设为 `mock` |
| `PAYMENT_MIGRATIONS_DIR` | payment migrations 路径 |
| `PAYMENT_FEATURE_FLAGS_TIMEOUT` | feature flag 超时 |
| `PAYMENT_ENABLED` | 支付总开关 |
| `PAYMENT_WECHAT_PAY_ENABLED` | 微信支付开关 |
| `PAYMENT_WECHAT_B2B_APP_ID` | B2B 关联的小程序 AppID |
| `PAYMENT_WECHAT_B2B_APP_SECRET` | 小程序 AppSecret，仅服务端保存 |
| `PAYMENT_WECHAT_B2B_MCH_ID` | B2B 商户号 |
| `PAYMENT_WECHAT_B2B_APP_KEY` | B2B AppKey，仅服务端保存 |
| `PAYMENT_WECHAT_B2B_ENV` | B2B 环境，正式环境为 `0` |
| `PAYMENT_WECHAT_B2B_SESSION_URL` | 微信 code2session 地址 |
| `PAYMENT_ALIPAY_PAY_ENABLED` | 支付宝支付开关 |

### `services/commerce` 相关变量

| 变量 | 说明 |
| --- | --- |
| `COMMERCE_INTERNAL_SYNC_TOKEN` | commerce 内部支付回写 token，必须与 `PAYMENT_COMMERCE_SYNC_TOKEN` 对齐 |

### miniapp 现有环境变量

来源见 `apps/miniapp/src/config/runtime-env.ts`：

| 变量 | 说明 |
| --- | --- |
| `TARO_APP_PAYMENT_BASE_URL` | miniapp 调用 payment 服务的基础地址 |
| `TARO_APP_PAYMENT_DEV_TOKEN` | miniapp 开发 token |
| `TARO_APP_API_BASE_URL` | 若已统一配置，会作为 payment 的兜底 base URL |

### admin-web 现有环境变量

来源见 `apps/admin-web/src/lib/env.js`：

| 变量 | 说明 |
| --- | --- |
| `VITE_ADMIN_WEB_PAYMENT_API_BASE_URL` | admin-web 调用 payment 服务的基础地址 |
| `ADMIN_WEB_PAYMENT_PROXY_TARGET` | Vite dev proxy 的 payment 目标地址 |

### 真实商户配置

微信变量已由 payment 服务消费；支付宝变量仍是后续 provider 的预留命名：

| 变量 | 说明 |
| --- | --- |
| `PAYMENT_WECHAT_APP_ID` | 微信小程序 `appid` |
| `PAYMENT_WECHAT_MCH_ID` | 微信支付商户号 |
| `PAYMENT_WECHAT_API_V3_KEY` | 微信 APIv3 Key |
| `PAYMENT_WECHAT_MERCHANT_PRIVATE_KEY_PATH` | 微信商户私钥路径 |
| `PAYMENT_WECHAT_MERCHANT_SERIAL_NUMBER` | 微信商户证书序列号 |
| `PAYMENT_WECHAT_NOTIFY_URL` | 微信支付异步通知地址 |
| `PAYMENT_ALIPAY_APP_ID` | 支付宝应用 `appId` |
| `PAYMENT_ALIPAY_PRIVATE_KEY_PATH` | 支付宝应用私钥路径 |
| `PAYMENT_ALIPAY_PUBLIC_KEY_PATH` | 支付宝公钥路径 |
| `PAYMENT_ALIPAY_GATEWAY_URL` | 支付宝网关地址 |
| `PAYMENT_ALIPAY_NOTIFY_URL` | 支付宝异步通知地址 |
| `PAYMENT_ALIPAY_SIGN_TYPE` | 支付宝签名算法 |

## 回调与状态回写

### payment 服务职责

- 校验订单是否允许支付。
- 创建支付记录与渠道会话。
- 保存 webhook 原文、审计日志和状态流转。
- 处理微信/支付宝异步通知。
- 主动查单并收敛状态。
- 通过内部接口把支付结果回写到 commerce。

### commerce 服务职责

- 提供订单读取能力给 payment 使用。
- 接收 payment 内部回写接口。
- 在订单详情/列表中返回 `paymentStatus`、`latestPaymentId`、`paidAt` 等摘要。

### 回写配置要求

- `PAYMENT_COMMERCE_BASE_URL` 必须指向 commerce。
- `PAYMENT_COMMERCE_SYNC_TOKEN` 与 `COMMERCE_INTERNAL_SYNC_TOKEN` 必须一致。
- 只有 payment 可以调用 commerce 的内部支付同步接口。

## 联调步骤

### 本地开发

1. 启动数据库与 commerce、payment 服务。
2. miniapp 配置 `TARO_APP_PAYMENT_BASE_URL`。
3. admin-web 配置 `VITE_ADMIN_WEB_PAYMENT_API_BASE_URL`。
4. 在本地环境显式设置 `PAYMENT_PROVIDER_MODE=mock`，验证下单、支付拉起、回写、后台查看和 replay 是否正常。不得将该值作为生产默认值。

### 真实商户联调

1. 在微信/支付宝平台完成商户、应用、小程序与支付能力开通。
2. B2B 模式设置 `PAYMENT_PROVIDER_MODE=b2b` 并配置全部 `PAYMENT_WECHAT_B2B_*` 变量；普通模式才设置 `PAYMENT_PROVIDER_MODE=wechat` 并配置 APIv3、商户私钥和回调变量。
3. 确认生产小程序包包含 `bb-plugin`、`requestCommonPayment`，且不包含开发假支付开关。
4. B2B 生产发布时，Identity 功能开关 `paymentEnabled`、`wechatPayEnabled` 和 `wechatB2bEnabled` 必须同时为 `true`。`wechatB2bEnabled` 是前后端都强制检查的独立熔断开关；回滚或异常时先关闭它，即可阻止新的 B2B 支付会话。
5. 设置 `PAYMENT_AUTH_ENABLED=true`，并确保 payment 与 identity 的 JWT secret/issuer 一致。
6. 让用户重新登录，使 JWT 携带其微信 `openid`，再完成一次微信小程序真实支付联调。
7. 支付宝需先实现正式 provider，再开展支付宝真实联调。
8. 普通 JSAPI 模式可断开回调链路，验证 `recheck` 是否能把订单状态收敛；B2B 模式在接入可信服务端状态来源前保持 `PAY_PENDING`。
9. 在 admin-web 验证交易详情、审计日志、webhook 与 replay。

## 常见问题与排障

### 客户端提示成功，但订单仍未支付

- 先查 `payment` 的 webhook 是否到达。
- 再查 `recheck` 是否已触发。
- 检查 `PAYMENT_COMMERCE_SYNC_TOKEN` 和 `COMMERCE_INTERNAL_SYNC_TOKEN` 是否一致。
- 检查真实回调 URL 是否可被外部平台访问。

### 微信下单成功但前端拉不起支付

- B2B 模式先检查当前构建是否调用 `wx.requestCommonPayment`，以及 `commonPayParams` 是否包含 `signData`、`mode`、`paySig`、`signature`。
- B2B 模式检查 code2session 是否收到当前点击生成的新 `wx.login` code。
- 检查返回给 `wx.requestPayment` 的 `package` 是否为 `prepay_id=...`。
- 检查 `signType`、`timeStamp`、`nonceStr`、`paySign` 是否完整。
- 检查 `appid`、`mchid` 与小程序用户 `openid` 是否匹配。

### 支付宝客户端回调成功但状态不稳定

- 不以客户端回调直接认定支付成功。
- 检查异步通知是否已到达并完成验签。
- 必要时调用 `alipay.trade.query` 对应的 `recheck` 流程。

### admin-web 看不到真实支付数据

- 检查 `VITE_ADMIN_WEB_PAYMENT_API_BASE_URL` 是否指向 payment，而不是 commerce。
- 检查 dev proxy 是否配置 `ADMIN_WEB_PAYMENT_PROXY_TARGET`。

## 上线前检查清单

- 微信/支付宝商户与应用已完成开通。
- `services/payment` 已切换到正式 provider，不再是 `PAYMENT_PROVIDER_MODE=mock`；未完成真实 provider 配置时必须保持 `disabled`。
- 支付总开关、微信开关、支付宝开关已按环境开启。
- B2B 模式的 AppID、AppSecret、商户号和 AppKey已配置，或普通模式的 APIv3 Key、商户私钥和平台验签材料已配置；不得混用两套商户资料。
- 支付宝 `appId`、应用私钥、支付宝公钥、网关地址、签名算法已配置完成。
- 微信/支付宝异步通知 URL 都是公网可达 HTTPS 地址。
- `PAYMENT_COMMERCE_BASE_URL`、`PAYMENT_COMMERCE_SYNC_TOKEN`、`COMMERCE_INTERNAL_SYNC_TOKEN` 已正确配置。
- miniapp 的 `TARO_APP_PAYMENT_BASE_URL` 已指向 payment。
- admin-web 的 `VITE_ADMIN_WEB_PAYMENT_API_BASE_URL` 已指向 payment。
- 已完成真实支付成功、取消、失败、延迟回调和主动查单补偿演练。

## 验证命令

文档配置完成后，仓库内自动化验证至少应通过：

```bash
cd services/payment && go test ./...
cd services/commerce && go test ./...
cd apps/miniapp && pnpm test -- src/pages/order/confirm/index.test.tsx src/pages/order/detail/index.test.tsx src/services/payment-services.test.ts
cd apps/admin-web && pnpm test:e2e:mock -- payments.mock.spec.ts
```

自动化测试只验证仓库内部调用、状态机和页面接线。真实微信/支付宝证书、签名、资金流与回调可达性，仍需要按本文档执行手工联调与上线前检查。
