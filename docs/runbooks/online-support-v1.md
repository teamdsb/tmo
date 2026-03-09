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
- `CS` 负责认领、回复、转接客户会话。
- `ADMIN` / `BOSS` / `MANAGER` 可查看与协助管理会话，但客户沟通归口 `CS`。
- `SALES` 不进入 admin-web 客服工作台，聊天上下文中的归属销售仅用于展示客户背景。

## Dev Notes
- miniapp 可通过平台 socket 能力附带 Bearer token，优先使用 WebSocket 实时收消息。
- admin-web 浏览器原生 `WebSocket` 不能稳定附带 Bearer header；当前实现以轮询兜底刷新会话与详情，后续如接入网关 token 桥接，再恢复纯实时模式。
- 图片上传限制为 `jpg/png/webp`，大小上限 `5MB`，文件落在媒体目录 `support/`。
