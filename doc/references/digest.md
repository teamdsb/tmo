# 参考摘要（可执行结论）

> 基于 doc/references/source.md 中链接，用 Playwright 逐一访问后提炼。

## 工具与协议
- Codex CLI：适合本仓库的“需求/实现”迭代型开发流程；建议在日常交互中用短指令驱动变更，并将关键决定回写到 `doc/requirements.md`。
- MCP 规范：若后续需要接入工具/外部数据（如供应商、ERP），应按 MCP 的 tool/resource 模型设计接口边界，避免把外部调用写死在业务代码里。
- Playwright：后续如需端到端测试，建议新增 `e2e/` 并使用 Playwright（官方文档路径明确），与小程序端分离。

## 后端与数据库（Go + Gin + PostgreSQL）
- Effective Go：作为代码风格与组织的基线，保持包职责单一、错误显式处理、避免过度抽象。
- Gin Quickstart：最小启动方式为 `gin.Default()` + `r.GET/POST` + `r.Run()`；路由可按模块分组（如 `/api/admin`、`/api/miniapp`）。
- gin-contrib/cors：用于小程序/后台跨域；建议在路由注册前统一 `router.Use(cors.New(...))` 或 `cors.Default()`。
- PostgreSQL 16 文档：以 16.x 为目标版本；优先使用 `uuid`/`timestamptz` 等标准类型。
- pgx/v5：推荐使用 `pgxpool` 管理连接池，并采用 context 控制超时。
- sqlc：用 `sqlc.yaml` 管理 schema 与 query，生成类型安全的 DAO；目录建议 `db/schema` + `db/queries`。
- golang-migrate：迁移目录建议 `db/migrations`，配合 CI/本地启动自动执行。

## Excel 导入/导出
- Excelize：导入时用 `OpenFile` 读取并逐行校验；导出用 `NewFile` 生成模板或导出清单。
- 建议在 `doc/requirements.md` 中补齐“唯一标识字段”和“模板列顺序”，以便导入可复现。

## API 文档与规范
- Swagger/OpenAPI：建议采用 OAS 3.1+ 维护一份 `api/openapi.yaml`，由后端路由与 DTO 生成或手写同步。
- 与前端协作时以 OpenAPI 作为“协议源”，避免接口文档分叉。

## 前端（React + TS + Vite + Ant Design）
- Vite：作为默认构建器，推荐 `npm create vite@latest` 初始化。
- React：按官方 Quick Start 的组件拆分与状态提升原则组织页面。
- TypeScript：开启 `strict`（至少 `noImplicitAny`），对 API 响应建立类型。
- React Router：路由建议集中配置（`routes.tsx`），便于菜单与权限联动。
- Ant Design：适合作为后台管理 UI 组件库，注意按需引入与主题配置。

## 小程序（Taro + 微信/支付宝）
- Taro：作为跨端编译层，建议为微信/支付宝分别配置构建产物目录，避免相互污染。
- 微信小程序文档：以“开发指南/基础 API/开发工具”三类为最低查阅集。
- 微信开发者工具：后续需要在团队内约定统一版本（稳定版优先）。
- 微信支付文档（小程序支付/SDK）：采用 API v3 流程，支付能力保持“功能开关”控制。
- wechatpay-go：官方 Go SDK，推荐用于后端签名/下单/回调验签。

## 支付宝方向预留
- 支付宝小程序 IDE 与开放平台文档：建议预留独立的 appId/签名配置与支付通道抽象；后续按开放平台接入流程补齐。

## Docker 与配置
- Docker Compose 环境变量：优先 `.env` + `environment`/`env_file` 组合；区分本地/测试/生产配置。

## 可执行落地清单（建议下一步）
- 约定目录结构：`backend/`, `frontend/`, `miniapp/`, `db/`，并在 `AGENTS.md` 更新。
- 落地 OpenAPI 草稿 `api/openapi.yaml`，同步核心模块接口。
- 建立 `db/migrations` + `db/queries`，引入 sqlc + migrate + pgx 的最小可运行样例。
- 明确 Excel 模板字段与唯一键，写入 `doc/requirements.md`。
