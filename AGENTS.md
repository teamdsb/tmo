# 仓库指南

## 项目结构与模块组织
- `apps/` 是前端工作区；当前包含 `apps/miniapp/`（单小程序工程，业务逻辑统一，Taro + React + TypeScript + Sass，可构建 WeChat/Alipay 等平台）与 `apps/admin-web/`（后台管理控制台，占位）。
- `services/commerce/` 是唯一可运行的 Go 服务：入口 `cmd/commerce/main.go`，配置在 `internal/config`，HTTP 在 `internal/http`，DB 在 `internal/db`，SQL 在 `queries/`，迁移在 `migrations/`，生成代码在 `internal/db/*.go`（sqlc）与 `internal/http/oapi/api.gen.go`（oapi-codegen）。
- `services/identity/`、`services/payment/`、`services/gateway-bff/` 目前仅有 README 占位。
- `packages/go-shared/` 提供 Go 共享基础设施（config/db/errors/httpx/observability），被 commerce 引用。
- `packages/shared/`、`packages/openapi-client/`、`packages/platform-adapter/` 为 TypeScript 工作区包（DTO、OpenAPI 工具、平台适配）。
- `contracts/openapi/` 存放 OpenAPI 规范；`contracts/openapi/openapi.yaml` 聚合各服务规范；`contracts/events/` 存放事件负载 Schema。
- `infra/dev/docker-compose.yml` 提供本地 Postgres；`infra/docker/` 与 `infra/nginx/` 为占位。
- `docs/` 包含产品、RBAC 与 ExecPlan 文档（`docs/需求文档.md`、`docs/rbac.md`、`docs/execplans/`）。
- `tools/scripts/test-backend.sh` 会遍历 `services/*` 与 `packages/*` 执行 Go 测试。

## 构建、测试与开发命令
除非特别说明，命令在对应模块目录执行。
- Go workspace：`go.work` 使用 Go `1.25`（建议保持 `1.25.x stable`），包含 `services/commerce`、`services/identity`、`services/payment`、`services/gateway-bff` 与 `packages/go-shared`。
- 启动本地 Postgres（用于 commerce）：`docker compose -f infra/dev/docker-compose.yml up -d`。
- 前端 miniapp（在 `apps/miniapp/` 执行）：
  - 微信开发：`pnpm dev:weapp`
  - 支付宝开发：`pnpm dev:alipay`
- 本地运行 commerce（在 `services/commerce/` 执行）：
  - `COMMERCE_DB_DSN="postgres://commerce:commerce@localhost:5432/commerce?sslmode=disable" go run ./cmd/commerce`
  - 可选环境变量：`COMMERCE_HTTP_ADDR`、`COMMERCE_LOG_LEVEL`。
- 后端测试：
  - `pnpm run test:backend`（根目录）或 `bash tools/scripts/test-backend.sh`。
  - `services/commerce` 与 `packages/go-shared` 中执行 `go test ./...`。
  - 集成测试需要 `COMMERCE_DB_DSN`，未设置时会跳过。
- 根目录 `pnpm run lint` 目标为 `apps/miniapp`。

## 编码规范与命名约定
- Go：必须 `gofmt`；使用 `.golangci.yml` 配置的 `golangci-lint`。
- TypeScript 包以源码为入口（`main`/`exports` 指向 `src/`），`tsconfig.json` 开启 `strict`。
- 保持 Go 服务目录约定（`cmd/`、`internal/`、`migrations/`、`queries/`）与 TS 包约定（`src/` + `index.ts` 汇总导出）。

## 测试指南
- 目前仅有 Go 自动化测试；如需集成覆盖，请为 `services/commerce/internal/db/integration_test.go` 提供 Postgres。
- 前端尚未配置测试框架；若新增测试，请就近放置并补充运行说明。

## 提交与 PR 规范
- 提交信息遵循 Conventional Commits（已配置 commitlint）。
  示例：`feat(cart): add bulk import confirmation`。
- PR 需包含：简要说明、UI 截图（如小程序页面）、以及 API 或权限变更的文档更新。

## 项目阶段与兼容性说明
- 当前处于开发期/快速迭代阶段，允许对数据结构与接口进行大幅调整或重构。
- 在进入稳定期之前，一般不要求兼容旧数据或旧接口；如需兼容请在 PR 说明中明确。

## 文档与 API 更新
- 功能变更需同步更新 `contracts/openapi/openapi.yaml` 与对应服务规范。
- 产品变更更新 `docs/需求文档.md`；角色/权限变更更新 `docs/rbac.md`。
- OpenAPI 约定（见 `contracts/openapi/openapi.yaml`）：JSON 使用 camelCase、时间为 RFC3339、ID 为 UUID、鉴权为 Bearer JWT、下单与创建支付需 `Idempotency-Key`。

## 代码生成与生成文件
- SQLC：`services/commerce/sqlc.yaml` 使用 `services/commerce/queries/*.sql` 与 `services/commerce/migrations/` 生成 `services/commerce/internal/db/*.go`。
- OpenAPI：`contracts/openapi/commerce.yaml` 通过 oapi-codegen 生成 `services/commerce/internal/http/oapi/api.gen.go`。
- 请勿直接编辑生成文件；修改源规范/SQL 后重新生成。

## 公用中间件/轮子的维护与使用提醒
- 由于 Go/Gin 微服务与前端跨端架构需要持续复用能力，请优先在 `packages/` 内建设、维护并使用公用中间件/轮子。
- 新增或调整通用能力时，先更新 `packages/` 中对应包，再在服务/应用侧引用；避免在业务代码中重复实现。

## ExecPlans
- ExecPlan 规范在 `docs/execplans/PLANS.md`；当前执行中的计划在 `.agent/PLANS.md`，必须符合该规范。
- 复杂功能或重大重构需使用 ExecPlan。
