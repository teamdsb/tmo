# 启动 Commerce 服务 v0

本 ExecPlan 是一个持续更新的文档。`Progress`、`Surprises & Discoveries`、`Decision Log`、`Outcomes & Retrospective` 这些部分在工作推进时必须同步更新。

本计划必须遵守仓库根目录的 `docs/execplans/PLANS.md`。

## Purpose / Big Picture（目标/概览）

完成后，开发者可以在本地启动 commerce 服务，通过 HTTP 创建商品并查询商品列表，数据会写入 Postgres。这个最小闭环验证了 goose 迁移、sqlc 的类型安全查询、以及 oapi-codegen + Gin 的 HTTP 接入。可见性标准是：服务启动后 `/health` 返回 200；`POST /catalog/products` 创建商品成功；`GET /catalog/products` 返回包含该商品的列表。

## Progress（进度）

- [x] (2026-01-18 06:20Z) 将 `contracts/openapi/openapi.yaml` 拆分为按服务划分的 OpenAPI，并用路径级 `$ref` 聚合。
- [x] (2026-01-18 06:28Z) 修正错放的 Inquiries PATCH 操作，归位到 `/inquiries/price/{inquiryId}` 并移出 AI 规范。
- [x] (2026-01-18 06:34Z) 在 `contracts/openapi/commerce.yaml` 增加 `POST /catalog/products` 及所需的 schema。
- [x] (2026-01-18 07:05Z) 搭建 `services/commerce` 的 Go 模块、入口、配置、日志与健康检查，并创建根目录 `go.work`。
- [x] (2026-01-18 07:08Z) 新增 `infra/dev/docker-compose.yml` 作为 Postgres 本地方案，补充默认 DSN 配置。
- [x] (2026-01-18 07:12Z) 增加 goose 迁移与 sqlc 查询文件，生成对应 Go 代码。
- [x] (2026-01-18 07:15Z) 用 oapi-codegen（Catalog tag）生成 OpenAPI 服务器接口并实现商品创建/列表/详情处理器。
- [x] (2026-01-18 07:20Z) 使用本机 Postgres 完成 `/health`、`POST /catalog/products`、`GET /catalog/products` 的端到端验证并记录输出。
- [ ] (2026-01-18 08:04Z) 补齐 commerce 的 lint/test 规范与命令（gofmt、go vet、golangci-lint、go test）。
- [ ] (2026-01-18 08:04Z) 添加最小可运行的自动化测试（handler 单元测试 + 存储层接口 mock）。
- [ ] (2026-01-18 08:04Z) 增加 CI workflow，自动执行 lint/test，并记录在文档中。

## Surprises & Discoveries（意外与发现）

- Observation: 原始 OpenAPI 将“更新询价”的 `PATCH` 操作放在 `/ai/after-sales/suggestions` 下，且带有 `inquiryId` 路径参数，语义与路径不匹配。Evidence: 旧的 `contracts/openapi/ai.yaml` 曾在该路径下声明 `patch`。
- Observation: 本机 Docker daemon 未运行，`docker` 无法连接守护进程，无法使用 Docker Compose 启动 Postgres。Evidence: `docker: failed to connect to the docker API ... connect: no such file or directory`。
- Observation: 使用 Go proxy 拉取 sqlc/goose 依赖时出现 `modernc.org/libc` 与压缩库下载 EOF。Evidence: `modernc.org/libc@v1.66.3 ... EOF`。
- Observation: oapi-codegen 对 OpenAPI 3.1 发出不完全支持警告。Evidence: `WARNING: You are using an OpenAPI 3.1.x specification...`。

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

- Decision: oapi-codegen 仅生成 Catalog tag 的 types 与 Gin server，并实现 `/catalog/categories` 与 `/catalog/products/{spuId}` 处理器。
  Rationale: commerce.yaml 覆盖大量未实现接口，限定 tag 可保持最小闭环同时完整编译。
  Date/Author: 2026-01-18 / Codex

- Decision: 保留 Docker Compose 方案，但在本机验证阶段改用 Homebrew Postgres。
  Rationale: Docker daemon 不可用，需要替代方案完成迁移与接口验证。
  Date/Author: 2026-01-18 / Codex

- Decision: sqlc 与 goose 使用 GitHub release 预编译二进制执行生成与迁移。
  Rationale: Go proxy 拉取依赖多次 EOF，使用预编译工具更稳定。
  Date/Author: 2026-01-18 / Codex

- Decision: 将 lint/test 与自动化测试纳入 v0 的完成条件，并添加 CI workflow 进行自动执行。
  Rationale: 保证闭环不仅能运行，还能被持续验证，避免回归。
  Date/Author: 2026-01-18 / Codex

## Outcomes & Retrospective（结果与复盘）

已完成 commerce 服务模块、健康检查、Postgres 迁移与 sqlc 生成、Catalog 接口实现，并完成端到端验证。Docker Compose 方案已落地，当前仍需补齐 lint/test 规范、最小自动化测试与 CI workflow 才算正式完成；后续再扩展更多 commerce 接口。

## Context and Orientation（上下文与导航）

该仓库为单体仓库。API 合约位于 `contracts/openapi/`，后端服务位于 `services/`。commerce 服务已建立 Go 模块：`services/commerce/go.mod`，入口为 `services/commerce/cmd/commerce/main.go`，配置在 `services/commerce/internal/config/config.go`，HTTP 入口在 `services/commerce/internal/http/server.go`，处理器在 `services/commerce/internal/http/handler/`，OpenAPI 生成代码位于 `services/commerce/internal/http/oapi/api.gen.go`。数据库迁移在 `services/commerce/migrations/00001_create_catalog_products.sql`，查询定义在 `services/commerce/queries/catalog.sql`，sqlc 配置为 `services/commerce/sqlc.yaml`，生成代码在 `services/commerce/internal/db/`。本地数据库方案记录在 `infra/dev/docker-compose.yml`。根目录 `go.work` 已包含 commerce 模块。聚合入口文件为 `contracts/openapi/openapi.yaml`，各服务独立规范位于同目录下的 `*.yaml`。后续 lint/test 将补充根目录 `.golangci.yml` 与 `.github/workflows/commerce-ci.yml`，测试文件预计放在 `services/commerce/internal/http/handler/` 下的 `*_test.go`。

术语说明：Gin 是 HTTP 路由库；oapi-codegen 根据 OpenAPI 生成 Go 类型与服务接口；sqlc 读取 SQL 并生成类型安全的查询方法；goose 负责数据库迁移；`go.work` 是 Go workspace 文件，用于把多个模块组合成一个本地工作区。

## Plan of Work（工作计划）

先保持 OpenAPI 与服务边界一致。以 `contracts/openapi/commerce.yaml` 作为 codegen 的输入来源，新增 `POST /catalog/products` 和必要 schema，同时保持聚合文件路径引用稳定。

随后搭建 commerce 服务模块：创建 `services/commerce/go.mod`、入口 `services/commerce/cmd/commerce/main.go`，以及基础配置与日志。提供 `GET /health` 来验证服务启动。

然后搭建数据库链路：新增 Docker Compose 的 Postgres 配置（`infra/dev/docker-compose.yml`），如果 Docker 不可用则使用 Homebrew Postgres 作为验证替代；增加 goose 迁移创建 `catalog_products` 表，使用 sqlc 从 SQL 文件生成 Go 访问层。

接着基于 OpenAPI 生成 HTTP 层：用 oapi-codegen 仅生成 Catalog tag 的 types 与 Gin server，编写 Gin handler 调用 sqlc 的创建与查询方法，实现 `POST /catalog/products`、`GET /catalog/products`、`GET /catalog/products/{spuId}` 与 `GET /catalog/categories`。

最后执行端到端验证：跑迁移、启动服务、执行创建与查询请求，并记录输出示例作为验收凭据。

在闭环可运行后补齐质量保障：新增 `.golangci.yml`，定义 gofmt、govet 与常规静态检查；为 handler 添加最小单元测试（使用内存 mock store 覆盖分页与错误路径）；增加 CI workflow 自动执行 `go test` 与 `golangci-lint run`，并在文档中记录运行方式。

## Concrete Steps（具体步骤）

在仓库根目录确认 OpenAPI 拆分结果（仅需首次）：

    ls contracts/openapi
    rg "paths:" -n contracts/openapi/commerce.yaml

生成代码所需的工具（未安装时）：

    mkdir -p /tmp/sqlc-install
    curl -L https://github.com/sqlc-dev/sqlc/releases/download/v1.30.0/sqlc_1.30.0_darwin_arm64.tar.gz -o /tmp/sqlc.tar.gz
    tar -xzf /tmp/sqlc.tar.gz -C /tmp/sqlc-install
    curl -L https://github.com/pressly/goose/releases/download/v3.26.0/goose_darwin_arm64 -o /tmp/goose
    chmod +x /tmp/goose

创建 commerce 模块与工作区（如需重建）：

    mkdir -p services/commerce/cmd/commerce services/commerce/internal
    cd services/commerce
    go mod init github.com/teamdsb/tmo/services/commerce
    cd ../..
    go work init
    go work use ./services/commerce

启动本地 Postgres（二选一）：

    docker compose -f infra/dev/docker-compose.yml up -d

或（Docker 不可用时）：

    brew install postgresql@15
    brew services start postgresql@15
    /opt/homebrew/opt/postgresql@15/bin/psql -d postgres -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'commerce') THEN CREATE ROLE commerce LOGIN PASSWORD 'commerce'; END IF; END \$\$;"
    if ! /opt/homebrew/opt/postgresql@15/bin/psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='commerce'" | grep -q 1; then /opt/homebrew/opt/postgresql@15/bin/createdb -O commerce commerce; fi

应用迁移并生成代码：

    cd services/commerce
    /tmp/goose -dir ./migrations postgres "postgres://commerce:commerce@localhost:5432/commerce?sslmode=disable" up
    /tmp/sqlc-install/sqlc generate
    go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen -generate types,gin -package oapi -o internal/http/oapi/api.gen.go -include-tags Catalog ../../contracts/openapi/commerce.yaml

补齐 lint/test 与自动化测试：

    cat > .golangci.yml <<'EOF'
    run:
      timeout: 3m
    linters:
      enable:
        - govet
        - errcheck
        - staticcheck
    issues:
      exclude-use-default: false
    EOF

    cd services/commerce
    go test ./...

    go install github.com/golangci/golangci-lint/cmd/golangci-lint@v1.64.5
    golangci-lint run

    cat > ../../.github/workflows/commerce-ci.yml <<'EOF'
    name: commerce-ci
    on:
      push:
        paths:
          - "services/commerce/**"
          - ".golangci.yml"
          - ".github/workflows/commerce-ci.yml"
      pull_request:
        paths:
          - "services/commerce/**"
          - ".golangci.yml"
          - ".github/workflows/commerce-ci.yml"
    jobs:
      lint-test:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - uses: actions/setup-go@v5
            with:
              go-version: "stable"
          - run: go test ./...
            working-directory: services/commerce
          - uses: golangci/golangci-lint-action@v6
            with:
              version: v1.64.5
              working-directory: services/commerce
    EOF

## Validation and Acceptance（验证与验收）

验收标准为：服务启动后 `/health` 返回 HTTP 200；`POST /catalog/products` 返回 HTTP 201 并包含新商品信息；`GET /catalog/products` 返回 HTTP 200 且列表包含该商品；`GET /catalog/products/{spuId}` 返回对应详情且 `skus` 为空数组；`go test ./...` 与 `golangci-lint run` 均通过；CI workflow 在 push/PR 时绿色通过。

示例（以实际监听端口为准）：

    curl -s http://localhost:8080/health
    OK

    curl -s -X POST http://localhost:8080/catalog/products \
      -H 'Content-Type: application/json' \
      -d '{"name":"Steel Pipe","categoryId":"00000000-0000-0000-0000-000000000000","description":"Schedule 40","coverImageUrl":"https://example.com/steel.jpg","images":["https://example.com/steel.jpg"],"tags":["steel","pipe"],"filterDimensions":["material","length"]}'
    {"product":{"categoryId":"00000000-0000-0000-0000-000000000000","description":"Schedule 40","filterDimensions":["material","length"],"id":"<uuid>","images":["https://example.com/steel.jpg"],"name":"Steel Pipe"},"skus":[]}

    curl -s http://localhost:8080/catalog/products
    {"items":[{"categoryId":"00000000-0000-0000-0000-000000000000","coverImageUrl":"https://example.com/steel.jpg","id":"<uuid>","name":"Steel Pipe","tags":["steel","pipe"]}],"page":1,"pageSize":20,"total":1}

    curl -s http://localhost:8080/catalog/products/<uuid>
    {"product":{"categoryId":"00000000-0000-0000-0000-000000000000","description":"Schedule 40","filterDimensions":["material","length"],"id":"<uuid>","images":["https://example.com/steel.jpg"],"name":"Steel Pipe"},"skus":[]}

## Idempotence and Recovery（幂等与恢复）

OpenAPI 拆分与路径修正属于文件编辑，可重复执行。goose 迁移可安全重复运行 `goose up`；如需回滚单步，可使用 `goose down` 后再 `goose up`。Docker Compose 可用 `docker compose up -d` 重启，必要时用 `docker compose down` 清理环境。Homebrew Postgres 可用 `brew services start postgresql@15` / `brew services stop postgresql@15` 重启或关闭，必要时可手动删除 `commerce` 数据库再重建以清空数据。`golangci-lint` 与 `go test` 可重复运行，CI workflow 只读执行不会改变仓库状态。

## Artifacts and Notes（产出与备注）

聚合入口仍使用路径级 `$ref`，例如：

    /catalog/products:
      $ref: "./commerce.yaml#/paths/~1catalog~1products"

迁移输出示例：

    2026/01/18 15:19:09 OK   00001_create_catalog_products.sql (692.45ms)
    2026/01/18 15:19:09 goose: successfully migrated database to version: 1

接口验证输出示例：

    curl -s http://localhost:8080/health
    OK

## Interfaces and Dependencies（接口与依赖）

使用 Gin 作为 HTTP 路由，oapi-codegen 生成 Catalog tag 的 Gin server 与类型（依赖 `github.com/oapi-codegen/runtime`），sqlc 生成数据库访问层，goose 进行迁移。最终由 handler 实现生成的接口，并依赖 sqlc 的存储层抽象。质量保障依赖 `golangci-lint`（配置在 `.golangci.yml`）与 GitHub Actions workflow（`.github/workflows/commerce-ci.yml`）。

在 `services/commerce/internal/http/handler/handler.go` 定义：

    type Handler struct {
        Store  catalog.Store
        Logger *slog.Logger
    }

在 `services/commerce/internal/catalog/store.go` 定义接口以匹配 sqlc 输出：

    type Store interface {
        CreateProduct(ctx context.Context, arg db.CreateProductParams) (db.CatalogProduct, error)
        ListProducts(ctx context.Context, arg db.ListProductsParams) ([]db.CatalogProduct, error)
        CountProducts(ctx context.Context, arg db.CountProductsParams) (int64, error)
        GetProduct(ctx context.Context, id uuid.UUID) (db.CatalogProduct, error)
    }

在 `services/commerce/internal/http/server.go` 中创建 Gin 路由，注册 `oapi.RegisterHandlers` 并补充 `/health`。

变更说明（2026-01-18 06:28Z）：将 ExecPlan 全文改为中文，并记录 OpenAPI 拆分与询价 PATCH 归位修正，原因：用户要求以中文完成并修正规范错误。
变更说明（2026-01-18 06:34Z）：补充 `POST /catalog/products` 与 `CreateCatalogProductRequest`，同步更新进度、决策与结果。
变更说明（2026-01-18 07:21Z）：完成 commerce 模块、数据库迁移、sqlc 与 oapi-codegen 生成、HTTP 处理器与端到端验证；补充 Docker 不可用与工具下载失败的发现与替代方案记录。
变更说明（2026-01-18 08:04Z）：将 lint/test 与自动化测试纳入完成条件，新增具体步骤、验收与决策记录，回应“需要完整 lint/test 与自动化测试”的要求。
