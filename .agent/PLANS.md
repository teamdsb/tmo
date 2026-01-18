# 启动 Commerce 服务 v0

本 ExecPlan 是一个持续更新的文档。`Progress`、`Surprises & Discoveries`、`Decision Log`、`Outcomes & Retrospective` 这些部分在工作推进时必须同步更新。

本计划必须遵守仓库根目录的 `docs/execplans/PLANS.md`。

## Purpose / Big Picture（目标/概览）

完成后，开发者可以在本地启动 commerce 服务，通过 HTTP 创建商品并查询商品列表，数据会写入 Postgres。这个最小闭环验证了 goose 迁移、sqlc 的类型安全查询、以及 oapi-codegen + Gin 的 HTTP 接入。可见性标准是：服务启动后 `/health` 返回 200；`POST /catalog/products` 创建商品成功；`GET /catalog/products` 返回包含该商品的列表。

## Progress（进度）

- [x] (2026-01-18 06:20Z) 将 `contracts/openapi/openapi.yaml` 拆分为按服务划分的 OpenAPI，并用路径级 `$ref` 聚合。
- [x] (2026-01-18 06:28Z) 修正错放的 Inquiries PATCH 操作，归位到 `/inquiries/price/{inquiryId}` 并移出 AI 规范。
- [x] (2026-01-18 06:34Z) 在 `contracts/openapi/commerce.yaml` 增加 `POST /catalog/products` 及所需的 schema。
- [ ] (2026-01-18 06:20Z) 搭建 `services/commerce` 的 Go 模块、入口、配置、日志与健康检查。
- [ ] (2026-01-18 06:20Z) 增加本地 Postgres（Docker Compose）并打通连接配置。
- [ ] (2026-01-18 06:20Z) 增加 goose 迁移与 sqlc 查询文件，生成对应 Go 代码。
- [ ] (2026-01-18 06:20Z) 用 oapi-codegen 生成 OpenAPI 服务器接口并实现产品创建/查询处理器。
- [ ] (2026-01-18 06:20Z) 通过 curl 完成端到端验证并记录预期输出。

## Surprises & Discoveries（意外与发现）

- Observation: 原始 OpenAPI 将“更新询价”的 `PATCH` 操作放在 `/ai/after-sales/suggestions` 下，且带有 `inquiryId` 路径参数，语义与路径不匹配。Evidence: 旧的 `contracts/openapi/ai.yaml` 曾在该路径下声明 `patch`。

## Decision Log（决策记录）

- Decision: 按服务拆分 OpenAPI（`identity.yaml`、`commerce.yaml`、`payment.yaml`、`admin.yaml`、`ai.yaml`），保留 `contracts/openapi/openapi.yaml` 作为聚合入口并使用路径级 `$ref`。
  Rationale: 既保留单一入口，又允许各服务独立演进与生成代码。
  Date/Author: 2026-01-18 / Codex

- Decision: commerce v0 以“商品创建 + 列表查询”作为最小闭环，验证迁移、sqlc 与 OpenAPI HTTP 生成链路。
  Rationale: 最小可运行闭环可以快速验证工具链，不必一次覆盖全域模型。
  Date/Author: 2026-01-18 / Codex

- Decision: 使用按服务的 Go 模块，并在根目录建立 `go.work`；commerce module 路径为 `github.com/teamdsb/tmo/services/commerce`。
  Rationale: git remote 为 `https://github.com/teamdsb/tmo.git`，按服务拆分模块可隔离依赖。
  Date/Author: 2026-01-18 / Codex

- Decision: HTTP 采用 Gin，OpenAPI 生成采用 oapi-codegen，数据访问采用 sqlc，迁移采用 goose。
  Rationale: 与仓库技术栈一致，且链路清晰可复用。
  Date/Author: 2026-01-18 / Codex

- Decision: v0 不添加鉴权占位，接口暂不强制身份信息。
  Rationale: 早期交付更快，避免提前锁定调用约束。
  Date/Author: 2026-01-18 / Codex

- Decision: 将“更新询价”的 `PATCH` 操作归位至 `contracts/openapi/commerce.yaml` 的 `/inquiries/price/{inquiryId}`。
  Rationale: Inquiries 属于 commerce，路径参数与资源语义必须匹配。
  Date/Author: 2026-01-18 / Codex

- Decision: 使用 `CreateCatalogProductRequest` 作为创建商品的请求体，并让 `POST /catalog/products` 返回 `ProductDetail`。
  Rationale: 避免与既有 `CreateProductRequest`（“找不到商品”的需求提交）命名冲突，同时复用既有详情结构。
  Date/Author: 2026-01-18 / Codex

- Decision: 本地开发提供 Docker Compose 的 Postgres。
  Rationale: 降低本地环境差异，使验证步骤可复现。
  Date/Author: 2026-01-18 / Codex

## Outcomes & Retrospective（结果与复盘）

已完成 OpenAPI 拆分、错误 PATCH 归位，并补齐 `POST /catalog/products` 与 `CreateCatalogProductRequest`。尚未开始 commerce 服务代码实现，下一阶段进入模块脚手架与数据库链路。

## Context and Orientation（上下文与导航）

该仓库为单体仓库。API 合约位于 `contracts/openapi/`，后端服务位于 `services/`。commerce 服务目前仍为空壳目录，计划作为独立 Go 模块存在于 `services/commerce`，并由根目录 `go.work` 统一本地工作区。聚合入口文件为 `contracts/openapi/openapi.yaml`，各服务独立规范位于同目录下的 `*.yaml`。

术语说明：Gin 是 HTTP 路由库；oapi-codegen 根据 OpenAPI 生成 Go 类型与服务接口；sqlc 读取 SQL 并生成类型安全的查询方法；goose 负责数据库迁移；`go.work` 是 Go workspace 文件，用于把多个模块组合成一个本地工作区。

## Plan of Work（工作计划）

先保持 OpenAPI 与服务边界一致。以 `contracts/openapi/commerce.yaml` 作为 codegen 的输入来源，新增 `POST /catalog/products` 和必要 schema，同时保持聚合文件路径引用稳定。

随后搭建 commerce 服务模块：创建 `services/commerce/go.mod`、入口 `services/commerce/cmd/commerce/main.go`，以及基础配置与日志。提供 `GET /health` 来验证服务启动。

然后搭建数据库链路：新增 Docker Compose 的 Postgres 配置，增加 goose 迁移创建 `products` 表，使用 sqlc 从 SQL 文件生成 Go 访问层。

接着基于 OpenAPI 生成 HTTP 层：用 oapi-codegen 生成接口与类型，编写 Gin handler 调用 sqlc 的创建与查询方法，实现 `POST /catalog/products` 与 `GET /catalog/products`。

最后执行端到端验证：跑迁移、启动服务、执行创建与查询请求，并记录输出示例作为验收凭据。

## Concrete Steps（具体步骤）

在仓库根目录确认 OpenAPI 拆分结果：

    ls contracts/openapi
    rg "paths:" -n contracts/openapi/commerce.yaml

修改 `contracts/openapi/commerce.yaml`，补充 `POST /catalog/products` 与所需 schema，确保 `contracts/openapi/openapi.yaml` 中对应路径仍引用该文件。

创建 commerce 模块：

    mkdir -p services/commerce/cmd/commerce services/commerce/internal
    cd services/commerce
    go mod init github.com/teamdsb/tmo/services/commerce
    go mod tidy

创建工作区（仓库根目录）：

    go work init
    go work use ./services/commerce

启动本地 Postgres（计划新增 `infra/dev/docker-compose.yml`）：

    docker compose -f infra/dev/docker-compose.yml up -d

应用迁移（完成 goose 配置后）：

    cd services/commerce
    goose -dir ./migrations postgres "$COMMERCE_DB_DSN" up

生成 sqlc 代码（完成 sqlc 配置后）：

    cd services/commerce
    sqlc generate

生成 OpenAPI 服务器代码（完成 oapi-codegen 配置后）：

    cd services/commerce
    oapi-codegen -generate types,server -package api -o internal/http/oapi/api.gen.go ../../contracts/openapi/commerce.yaml

## Validation and Acceptance（验证与验收）

验收标准为：服务启动后 `/health` 返回 HTTP 200；`POST /catalog/products` 返回 HTTP 201 并包含新商品信息；`GET /catalog/products` 返回 HTTP 200 且列表包含该商品。

示例（以实际监听端口为准）：

    curl -s http://localhost:8080/health
    curl -s -X POST http://localhost:8080/catalog/products -H 'Content-Type: application/json' -d '{"name":"Steel Pipe","categoryId":"00000000-0000-0000-0000-000000000000"}'
    curl -s http://localhost:8080/catalog/products

## Idempotence and Recovery（幂等与恢复）

OpenAPI 拆分与路径修正属于文件编辑，可重复执行。goose 迁移可安全重复运行 `goose up`；如需回滚单步，可使用 `goose down` 后再 `goose up`。Docker Compose 可用 `docker compose up -d` 重启，必要时用 `docker compose down` 清理环境。

## Artifacts and Notes（产出与备注）

聚合入口仍使用路径级 `$ref`，例如：

    /catalog/products:
      $ref: "./commerce.yaml#/paths/~1catalog~1products"

## Interfaces and Dependencies（接口与依赖）

使用 Gin 作为 HTTP 路由，oapi-codegen 生成服务接口与类型，sqlc 生成数据库访问层，goose 进行迁移。最终需要一个 handler 实现生成的接口，并依赖一个基于 sqlc 的存储层抽象。

在 `services/commerce/internal/http/handler/handler.go` 定义：

    type Handler struct {
        Store CatalogStore
    }

在 `services/commerce/internal/catalog/store.go` 定义接口以匹配 sqlc 输出：

    type CatalogStore interface {
        CreateProduct(ctx context.Context, arg db.CreateProductParams) (db.Product, error)
        ListProducts(ctx context.Context, arg db.ListProductsParams) ([]db.Product, error)
    }

在 `services/commerce/internal/http/server.go` 中创建 Gin 路由，注册 oapi-codegen 生成的路由，并启动 HTTP 服务器。

变更说明（2026-01-18 06:28Z）：将 ExecPlan 全文改为中文，并记录 OpenAPI 拆分与询价 PATCH 归位修正，原因：用户要求以中文完成并修正规范错误。
变更说明（2026-01-18 06:34Z）：补充 `POST /catalog/products` 与 `CreateCatalogProductRequest`，同步更新进度、决策与结果。
