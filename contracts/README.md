# contracts

此目录包含服务契约与事件规范，按服务拆分以便独立演进与生成代码。聚合入口为 `contracts/openapi/openapi.yaml`，其他 `*.yaml` 为各服务自有契约。

## 契约边界（OpenAPI）

### identity.yaml
- 负责：登录/鉴权、用户与角色权限（RBAC）、令牌与会话、审计等身份域能力。
- 不负责：商品/订单/售后等业务数据归属（归 commerce），支付执行与回调（归 payment）。
- 交互：为 commerce、admin、payment 提供身份与权限上下文。

### commerce.yaml
- 负责：客户、目录（商品/类目）、询价/报价、购物车、订单、售后与追踪等交易与履约链路。
- 不负责：身份认证（归 identity）、支付通道与回调签名（归 payment）、AI 建议生成（归 ai）。
- 交互：调用 identity 获取用户与权限信息；与 payment 对接支付状态；必要时调用 ai 获取建议。

### payment.yaml
- 负责：支付下单、支付状态查询、退款/撤销与回调验签等支付域能力。
- 不负责：订单业务规则与状态流转（归 commerce）、用户身份与权限（归 identity）。
- 交互：由 commerce 触发支付与退款；回调结果回推 commerce；需要身份上下文时走 identity。

### admin.yaml
- 负责：面向管理端的业务管理入口（如商品、客户、订单、售后等后台管理操作）。
- 不负责：鉴权与角色定义（归 identity）、支付执行（归 payment）、交易业务主流程（归 commerce）。
- 交互：管理端鉴权走 identity；业务操作最终落到 commerce 或 payment。

### ai.yaml
- 负责：AI 辅助能力（例如内容建议、回复草案或智能检索等）。
- 不负责：直接修改业务数据或替代业务流程（归 commerce）、身份与权限（归 identity）。
- 交互：由 commerce/admin 触发或消费 AI 建议；不直接写入交易数据。
