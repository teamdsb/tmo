# 业务员绑定与客户归属链路

这是一个持续维护的执行计划。Progress、Surprises & Discoveries、Decision Log、Outcomes & Retrospective 必须随着实施过程持续更新。

本计划受 doc/execplans/PLANS.md 约束，必须符合其中的编写与维护要求。

## Purpose / Big Picture

完成后，客户可以通过扫描业务员二维码（以 bind_code 形式存在于链接中）绑定到该业务员名下。系统会保存归属关系，后续下单与留言都可归属到该业务员。管理员可在后台将客户从一个业务员转移到另一个业务员。该行为可以通过 HTTP 调用观察到：首次绑定成功、重复绑定幂等、转移后查询结果变化。

## Progress

- [x] (2026-01-05 08:44Z) 完成 ExecPlan 初稿。
- [x] (2026-01-05 08:46Z) 将 ExecPlan 改写为中文并保留结构要求。
- [x] (2026-01-05 09:00Z) 搭建最小可运行 Go + Gin 后端与 Postgres 连接，目录为 backend/。
- [x] (2026-01-05 09:00Z) 增加业务员与客户归属的数据表与迁移。
- [x] (2026-01-05 09:00Z) 实现绑定、查询与管理员转移接口。
- [x] (2026-01-05 09:00Z) 增加开发态鉴权占位与种子数据工具，便于链路验证。
- [x] (2026-01-05 09:06Z) 新增 Docker Compose 以容器方式启动 Postgres，并提供后端 Dockerfile。
- [x] (2026-01-05 09:14Z) 新增 Makefile 快捷命令（pg-up/pg-down/pg-migrate/dev-run/docker-run）。 
- [x] (2026-01-05 09:19Z) 补充关闭命令（pg-stop、docker-stop）以便快速停止容器。
- [ ] 用 curl 验证完整绑定与转移流程并记录输出。

## Surprises & Discoveries

- 暂无。

## Decision Log

- Decision: 用 bind_code 字符串作为业务员二维码链接参数，不直接暴露 sales_id。
  Rationale: bind_code 可轮换且不泄露内部 ID，适合快速验证分支。
  Date/Author: 2026-01-05 / codex
- Decision: 绑定为单向且幂等；仅管理员可转移客户归属。
  Rationale: 满足“归属稳定”的业务要求，避免误绑定反复变更。
  Date/Author: 2026-01-05 / codex
- Decision: 使用请求头开发态鉴权占位（X-Customer-Id 与 X-Role=admin）。
  Rationale: 当前无正式鉴权体系，先保证链路可测试，后续易替换。
  Date/Author: 2026-01-05 / codex
- Decision: UUID 在 Go 侧生成并写入数据库，不启用 pgcrypto 扩展。
  Rationale: 避免数据库扩展依赖，降低快速验证分支的初始化复杂度。
  Date/Author: 2026-01-05 / codex

## Outcomes & Retrospective

- 未开始。

## Context and Orientation

本仓库已新增 backend/ 目录，用于快速验证后端链路。核心路径包括 backend/cmd/server（服务入口）、backend/internal/config（配置）、backend/internal/db（数据库连接）、backend/internal/store（存储层）、backend/internal/handlers（HTTP 处理器）、backend/db/migrations（数据库迁移）。

术语说明：
- 业务员（Salesperson）：可归属客户的人员，在 sales_profiles 表中存储。
- 客户（Customer）：可被绑定的用户，在 customers 表中存储。
- 绑定码（Bind code）：与业务员关联的一段随机字符串，用于二维码链接。
- 绑定（Binding）：首次将客户与业务员建立归属关系。
- 归属转移（Ownership transfer）：管理员将客户归属从 A 转到 B。

## Plan of Work

先在 backend/ 下搭建一个最小 Go 服务，使用 Gin 提供 HTTP 接口。加入配置读取与数据库连接（pgxpool），并添加健康检查路由用于验证服务启动。

然后在 backend/db/migrations 中创建迁移文件，新增 sales_profiles 与 customers 表。sales_profiles 保存 id（uuid）、name、bind_code 与 created_at。customers 保存 id（uuid）、name、phone、sales_id（可为空）与 created_at。为 bind_code 建唯一索引，customers.sales_id 指向 sales_profiles.id。UUID 由 Go 生成并写入数据库。

接着在 backend/internal/store 中实现显式的存储层函数，包含创建、查询、绑定与转移。绑定必须幂等：仅在 customers.sales_id 为空时写入；若已有归属，返回“已绑定”。转移必须覆盖原有归属，并返回旧 sales_id 以便日后审计扩展。

随后实现 HTTP 处理器并在 main.go 中注册路由。必须提供如下接口：
- POST /api/admin/sales：创建业务员并返回 id 与 bind_code。
- POST /api/admin/customers：创建客户用于测试并返回 id。
- POST /api/sales/bind：根据 bind_code 绑定当前客户。
- GET /api/admin/customers/:id：查询客户归属。
- POST /api/admin/customers/transfer：管理员转移客户归属。

最后增加开发态鉴权占位规则：当请求头包含 X-Role=admin 视为管理员；当请求头包含 X-Customer-Id 视为当前客户。缺少必要头时返回 401，便于定位测试问题。

## Concrete Steps

所有命令在仓库根目录执行，除非特别说明。

1) 创建后端模块与目录。

    mkdir -p backend/cmd/server backend/internal/config backend/internal/db backend/internal/store backend/internal/handlers backend/db/migrations
    cd backend
    go mod init tmo

2) 在 backend/cmd/server/main.go 建立最小服务，并提供 GET /health 返回 OK。

3) 在 backend/internal/config 与 backend/internal/db 中实现 DATABASE_URL 配置读取与 pgxpool 连接。

4) 在 backend/db/migrations 创建迁移：
   - 001_create_sales_and_customers.sql（表与索引）

5) 在 backend/internal/store 实现数据库读写函数，并与数据库连接绑定。

6) 在 backend/internal/handlers 实现处理器，并在 main.go 中注册路由。

7) 启动数据库（任选其一）：
   - 使用本地 Postgres 并设置 DATABASE_URL。
   - 使用 Docker 临时容器并导出 DATABASE_URL。

8) 启动服务。

    cd backend
    DATABASE_URL=postgres://user:pass@localhost:5432/tmo?sslmode=disable go run ./cmd/server

9) 使用 curl 验证绑定与转移链路（示例在 Artifacts and Notes）。

## Validation and Acceptance

验收标准必须可观察：
- 启动服务后访问 http://localhost:8080/health 返回 HTTP 200 且 body 为 OK。
- POST /api/admin/sales 返回包含 id 与 bind_code 的 JSON。
- POST /api/admin/customers 返回包含 id 的 JSON。
- POST /api/sales/bind 使用 X-Customer-Id 头与 bind_code 请求后返回 HTTP 200，且表示绑定成功。
- 重复绑定返回 HTTP 200，并提示已绑定，sales_id 不改变。
- POST /api/admin/customers/transfer 成功后，GET /api/admin/customers/:id 的 sales_id 变为新值。

## Idempotence and Recovery

迁移使用 IF NOT EXISTS，重复执行不造成破坏。绑定接口是幂等操作，重复调用不会创建重复数据。若迁移错误，不回滚旧迁移文件，改用新增迁移进行修复或清理，以保持历史一致性。

## Artifacts and Notes

示例调用（用真实 ID 替换占位符）：

    curl -X POST http://localhost:8080/api/admin/sales -H 'X-Role: admin' -d '{"name":"Alice"}'
    # 响应: {"id":"...","bind_code":"..."}

    curl -X POST http://localhost:8080/api/admin/customers -H 'X-Role: admin' -d '{"name":"Buyer"}'
    # 响应: {"id":"..."}

    curl -X POST http://localhost:8080/api/sales/bind -H 'X-Customer-Id: <customer_id>' -d '{"bind_code":"<bind_code>"}'
    # 响应: {"status":"bound","sales_id":"..."}

    curl -X POST http://localhost:8080/api/admin/customers/transfer -H 'X-Role: admin' -d '{"customer_id":"...","new_sales_id":"..."}'
    # 响应: {"status":"transferred","old_sales_id":"...","new_sales_id":"..."}

## Interfaces and Dependencies

依赖与接口在本计划完成时必须存在：
- Go 1.22 或更高
- github.com/gin-gonic/gin
- github.com/jackc/pgx/v5/pgxpool
- github.com/google/uuid

数据结构（建议放在 backend/internal/store/types.go）：

    type SalesProfile struct {
        ID        uuid.UUID
        Name      string
        BindCode  string
        CreatedAt time.Time
    }

    type Customer struct {
        ID        uuid.UUID
        Name      string
        Phone     string
        SalesID   *uuid.UUID
        CreatedAt time.Time
    }

存储接口（backend/internal/store/store.go）：

    type Store interface {
        CreateSales(ctx context.Context, name string) (SalesProfile, error)
        CreateCustomer(ctx context.Context, name string, phone string) (Customer, error)
        GetCustomer(ctx context.Context, id uuid.UUID) (Customer, error)
        GetSalesByBindCode(ctx context.Context, bindCode string) (SalesProfile, error)
        BindCustomerToSales(ctx context.Context, customerID uuid.UUID, salesID uuid.UUID) (bool, error)
        TransferCustomer(ctx context.Context, customerID uuid.UUID, newSalesID uuid.UUID) (uuid.UUID, error)
    }

HTTP 处理器必须对应这些路由与行为；绑定接口调用 BindCustomerToSales，返回 false 时响应 status="already_bound" 并返回现有 sales_id。

Plan change note: 增补 Makefile 快捷命令，并在 Progress 中记录该变更（2026-01-05 / codex）。
