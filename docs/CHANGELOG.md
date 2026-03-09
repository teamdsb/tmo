# Changelog

这个文件只记录会影响后续 agent 判断的近期仓库变化，不承担发布说明、项目周报或任务流水账职责。

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
