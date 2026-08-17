# Online Support v1 Runbook

## Scope
- miniapp 提供独立在线客服页，客户可发送文本、图片、订单卡片、商品卡片。
- admin-web 提供客服工作台，客户沟通由 `CS` 负责；`SALES` 只保留在 miniapp 侧，不进入客服工作台。
- 后端域位于 `services/commerce`，会话与消息持久化在 Postgres。

## REST Endpoints
- `GET /support/conversations/current`
- `GET /support/conversations/{conversationId}/messages`
- `POST /support/conversations/{conversationId}/messages`
- `POST /support/conversations/{conversationId}/messages/image`
- `POST /support/conversations/{conversationId}/read`
- `GET /admin/support/conversations`
- `GET /admin/support/conversations/{conversationId}`
- `POST /admin/support/conversations/{conversationId}/claim`
- `POST /admin/support/conversations/{conversationId}/release`
- `POST /admin/support/conversations/{conversationId}/transfer`

## WebSocket
- URL: `GET /ws/support`
- 鉴权: Bearer JWT
- 事件 envelope:

```json
{
  "type": "message.created",
  "data": {}
}
```

- 当前事件类型:
  - `message.created`
  - `conversation.updated`
  - `conversation.claimed`
  - `conversation.transferred`
  - `conversation.read`

## Role Boundary
- `CUSTOMER` 只能访问自己的客服会话。
- `CS` 负责认领、回复、转接客户会话。坐席必须先显式调用 claim，只有 `assigneeUserId` 等于当前用户时才可标记已读、发送文本/图片/卡片或以 CS 身份释放会话。
- `ADMIN` / `BOSS` / `MANAGER` 可查看与协助管理会话，但客户沟通归口 `CS`。
- `SALES` 不进入 admin-web 客服工作台，聊天上下文中的归属销售仅用于展示客户背景。

## Product Card Flow
- admin-web 的“选择商品”打开搜索/分页选品器，数据来自 `GET /catalog/products`；不传 `status` 时后端只返回 `ACTIVE` 商品。
- `POST /support/conversations/{conversationId}/messages` 的 `PRODUCT_CARD` 请求必须在 `cardPayload.productId` 传 UUID。Commerce 重新读取目录，拒绝不存在或非 `ACTIVE` 商品，并用实际名称、封面、`productId` 和 miniapp `route` 重建卡片。
- 规范商品路由是 `/pages/goods/detail/index?id=<productId>`。miniapp 仅对历史 `/goods/<productId>` `linkUrl` 做安全转换，不导航任意外部 URL。
- 真实联调不得只验证第一个商品：至少搜索并发送一个非首页默认项，在小程序点击后核对详情 `id`。

## Dev Notes
- miniapp 只有在进入“在线客服聊天页”后才会调用 `GET /support/conversations/current` 并创建会话；停留在“客服支持”入口页不会自动建会话。
- identity mini login 会在取到手机号后复用或创建 `CUSTOMER` 用户；commerce 在建会话时会把当前客户 `displayName`、`phone` 作为会话快照写入，供 admin-web 展示来源。
- admin-web 联调客服工作台时必须使用 `pnpm -C apps/admin-web dev:real`；默认 `dev` 仍会进入 mock 模式，不能作为真实链路验收依据。
- 客服侧未读数是会话级计数；未认领坐席只查看会话不会清零该计数。
- miniapp 可通过平台 socket 能力附带 Bearer token，优先使用 WebSocket 实时收消息。
- admin-web 浏览器原生 `WebSocket` 不能稳定附带 Bearer header；当前实现以轮询兜底刷新会话与详情，后续如接入网关 token 桥接，再恢复纯实时模式。
- 图片上传限制为 `jpg/png/webp`，大小上限 `5MB`，文件落在媒体目录 `support/`。
