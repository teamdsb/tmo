# Changelog

这个文件只记录会影响后续 agent 判断的近期仓库变化，不承担发布说明、项目周报或任务流水账职责。

## 2026-08-17

- 在线客服收紧为“显式认领后才能已读或发送”，不再由首次回复隐式认领；只有当前坐席可清除客服侧未读和回复。
  影响面：admin-web 操作状态与 Commerce 权限保持一致，自动化或旧调用方必须先调用 claim 接口。
  建议阅读：`docs/runbooks/online-support-v1.md`、`contracts/openapi/commerce.yaml`

- admin-web 商品卡片改为可搜索、分页的上架商品选择器；Commerce 用真实目录重建商品快照，miniapp 以内部 `route` 打开详情并兼容可安全转换的旧 `linkUrl`。
  影响面：`PRODUCT_CARD` 必须带有效且已上架的 UUID `productId`，伪造、下架或不存在商品不再创建消息。
  建议阅读：`docs/context/product-requirements.md`、`docs/runbooks/online-support-v1.md`

## 2026-07-09

- 用户运营中心新增 BOSS 专属后台密码账号管理，可创建、编辑、重置密码和停启单角色 `ADMIN`、`MANAGER`、`CS` 账号。
  影响面：Identity JWT 新增凭证版本并在每次鉴权时核验；停用或重置密码会立即撤销旧会话，BOSS 账号不在受管列表中。
  建议阅读：`docs/context/rbac.md`、`contracts/openapi/identity.yaml`

## 2026-07-06

- Admin 订单履约新增受控线下收款与派单：`order:manage / ALL` 仅授予 BOSS、MANAGER、ADMIN；Commerce 仍强制检查角色，并向 Identity 复核负责人是 active SALES。
  影响面：订单负责人、付款摘要和审计事件在一个事务中更新；发货及终态订单不可改派。
  建议阅读：`docs/context/rbac.md`、`docs/context/product-requirements.md`、`contracts/openapi/commerce.yaml`

## 2026-03-08

- 重组 `docs/` 为 `context/`、`runbooks/`、`decisions/`、`execplans/` 四层结构，并新增 `docs/README.md` 作为总入口。
  影响面：后续新增文档必须先归类；旧的 `docs/` 根目录散文件路径已失效。
  建议阅读：`docs/README.md`、`docs/decisions/README.md`

- 统一 `docs/` 文档文件名为 ASCII `kebab-case`，并将 `docs/RUNBOOK/` 更名为 `docs/runbooks/`。
  影响面：引用旧文件名或旧目录名的脚本、README、ExecPlan 需要使用新路径。
  建议阅读：`docs/README.md`

## 2026-03-10

- commerce 新增在线客服 v1：小程序独立客服页、`/support/*` 与 `/admin/support/*` REST 接口、图片消息上传、会话认领/转接、上下文聚合与 WebSocket 推送。
  影响面：涉及 `services/commerce` 新迁移与接口契约；前后端需按新的 `SupportConversation` / `SupportMessage` 结构接线。
  建议阅读：`docs/runbooks/online-support-v1.md`、`contracts/openapi/commerce.yaml`

- 在线客服角色边界明确为“客户 <-> CS”，`SALES` 保持 miniapp-only，不进入 admin-web 客服沟通链路。
  影响面：admin-web 登录角色、客服工作台转接目标、客服接口访问控制均不应再放宽到 `SALES`。
  建议阅读：`docs/context/rbac.md`
