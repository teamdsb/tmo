# tmo-monorepo

本仓库用于统一协作者与 agent 的工具链约定与协作方式。

## 版本策略
- 语言与工具版本不写死，默认使用 stable 或 stable LTS。
- 若仓库已有配置（如 `go.work`、`pnpm-workspace.yaml`、各应用 `package.json`），以其为准。

## 项目结构
- `apps/miniapp/`：小程序（业务逻辑统一，Taro + React + TypeScript + Sass，可构建 WeChat/Alipay 等平台）
- `apps/admin-web/`：后台管理控制台（预留）
- `services/`：后端服务（Go）
- `contracts/openapi/`：API 合约（OpenAPI）
- `docs/`：产品与权限文档
- `infra/`：本地基础设施与环境

## 工具链总览（按 commerce 服务对齐）
### 后端
- 语言与框架：Go、Gin
- 基础设施：PostgreSQL、Redis、Nginx（本地 Postgres 见 `infra/dev/docker-compose.yml`）
- API 合约：OpenAPI（`contracts/openapi/*.yaml`）
- API 生成：oapi-codegen（生成到 `services/commerce/internal/http/oapi`，生成文件不手改）
- 核心依赖：oapi-codegen/runtime、google/uuid
- 数据访问：pgx/v5、sqlc（`services/commerce/sqlc.yaml`）
- 迁移工具：goose（`services/commerce/migrations`）
- 测试：Go testing/httptest；`go test`（覆盖率/竞态/fuzz）、`go tool cover`，统一入口 `tools/scripts/test-backend.sh` 或 `pnpm run test:backend`
- 静态检查：gofmt、golangci-lint（`./.golangci.yml` 启用 govet/errcheck/staticcheck/ineffassign/unused/misspell/unconvert/gocritic/prealloc/bodyclose/nilerr/gosec）

### 前端
- 框架：Taro CLI + React + TypeScript + Sass
- 构建与开发：`apps/miniapp` 的 Taro scripts（如 `dev:weapp`、`dev:alipay`）
- 静态检查：ESLint（taro config）、Stylelint（standard）
- 包管理：pnpm workspace

## 协作与 Agent 约定
- 新增/替换工具链需先与负责人确认，并更新本 README。
- 需求不明确时，Agent 先使用 `ask-questions-if-underspecified` 澄清，再开始实现。
- 生成目录与迁移文件按工具规范维护（sqlc/goose/oapi-codegen）。

## 常用命令
```bash
pnpm install
pnpm -C apps/miniapp dev:weapp
pnpm -C apps/miniapp dev:alipay
pnpm run test:backend
make db-up
make db-down
```
