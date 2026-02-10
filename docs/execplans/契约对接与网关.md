# 小程序 v1 契约对接与 Gateway BFF 编排

本计划要把 `apps/miniapp` 从“页面 demo + mock 数据”推进为严格遵循 OpenAPI 契约的可用业务闭环，并让单一小程序覆盖 CUSTOMER/SALES/PROCUREMENT/CS 四类角色的核心流程。完成后，开发者只需配置网关 baseUrl 即可登录并完成浏览、下单、售后、询价、物流与批量导入等流程，同时 `services/gateway-bff` 具备 `/bff/bootstrap` 聚合、`/admin/*` 编排以及多上游路由能力。验证方式是访问 `GET /health`、`GET /ready`、`GET /bff/bootstrap` 并完成典型业务调用来观察可运行行为。

本 ExecPlan 是一个持续更新的文档。推进时必须同步更新 `Progress`、`Surprises & Discoveries`、`Decision Log`、`Outcomes & Retrospective` 这四个部分。本计划必须遵守 `docs/execplans/PLANS.md`。目标分支为 `feat-miniapp-v0`，所有执行与提交以该分支为准。

## Progress

- [x] (2026-01-24 11:58Z) 完成对需求、RBAC 与 OpenAPI 契约的调研，定位 miniapp 逻辑层与 gateway-bff 的现状差异。
- [x] (2026-01-24 13:48Z) 对齐“网关优先”的 baseUrl 解析策略，完成 pnpm patch 配置清理，并本地补充 `apps/miniapp/.env.*` 的 `TARO_APP_API_BASE_URL`（这些文件被 git ignore）。
- [x] (2026-01-24 13:48Z) 将 OpenAPI `servers` 基础路径从 `/v1` 改为根路径以匹配当前网关路由布局。
- [x] (2026-01-24 18:29Z) 里程碑 0：完成 miniapp 启动与鉴权底座（匿名 bootstrap、登录恢复、角色选择、scene 绑定、权限加载）。
- [x] (2026-01-24 14:33Z) 里程碑 1：完成契约迁移与客户端生成（`/customers` 迁移至 identity，新增 `/bff/bootstrap` 与 gateway client，更新生成脚本并运行生成）。
- [x] (2026-01-24 18:29Z) 里程碑 2：补齐 commerce 端模块（Wishlist/ProductRequests/AfterSales/Inquiries 与 Excel 流程联动）。
- [x] (2026-01-24 20:10Z) 里程碑 3：完成 gateway-bff 路由与 `/admin/*` 编排。
- [x] (2026-01-24 20:10Z) 里程碑 4：落地 payment 服务（可运行但默认关闭）。
- [ ] (2026-01-24 13:48Z) 里程碑 5：miniapp 页面逐一替换为真实 API，并完成最小验证。
- [ ] (2026-01-24 21:10Z) 里程碑 5 推进：已对接 catalog/search/detail、cart import、orders、demand、support、tracking batch、mine；address/settings 仍待契约补齐。

## Surprises & Discoveries

- Observation: gateway-bff 目前只路由 `/auth*` 和 `/me*` 到 identity，其余全部转发 commerce，导致 `/rbac*`、`/staff*`、`/audit-logs*` 等错路由。
  Evidence: `services/gateway-bff/internal/http/server.go`.

- Observation: OpenAPI 过去使用 `/v1` 但 gateway 只有根路径路由，为避免契约与实际不一致，本计划将 `servers` 统一为根路径。
  Evidence: `contracts/openapi/openapi.yaml` 与 `services/gateway-bff/internal/http/server.go`.

- Observation: miniapp 逻辑层仍以 mock 为主，页面几乎不调用 `packages/*-services`。
  Evidence: `apps/miniapp/src/pages` 与 `apps/miniapp/src/app.ts`.

- Observation: pnpm workspace 曾引用缺失 patch 文件，已移除 workspace patch 配置并清理 lockfile。
  Evidence: `pnpm-workspace.yaml` 与 `pnpm-lock.yaml`.

- Observation: 契约中已包含 `/ai/*` 路径，但仓库内暂无 AI 服务实现，需要明确网关处理策略。
  Evidence: `contracts/openapi/ai.yaml`.

- Observation: oapi-codegen 对 OpenAPI 3.1 仍有兼容性警告，生成时提示降级到 3.0.x。
  Evidence: `bash tools/scripts/identity-generate.sh` 与 `bash tools/scripts/commerce-generate.sh` 输出警告。

- Observation: commerce 侧已有 `00008_create_support_modules.sql` 迁移草稿，与新增 wishlist/售后/询价表存在重复；已在该迁移内对齐表名与字段并删除重复迁移。
  Evidence: `services/commerce/migrations/00008_create_support_modules.sql`.

- Observation: identity 原本缺少 feature flags 存储与 `/admin/*` 实现，需要新增表与手动路由以承接网关 admin 调用。
  Evidence: `services/identity/migrations/00003_add_feature_flags.sql` 与 `services/identity/internal/http/handler/admin.go`.

## Decision Log

- Decision: payment 服务必须可运行，但默认关闭（feature flag `paymentEnabled=false`）。
  Rationale: 保证契约完整可用，同时不触发真实支付链路。
  Date/Author: 2026-01-24 用户

- Decision: `/admin/*` 由 `services/gateway-bff` 对外提供并负责编排。
  Rationale: admin 操作跨域聚合，网关是统一出口。
  Date/Author: 2026-01-24 用户

- Decision: 单一 `apps/miniapp` 覆盖 CUSTOMER/SALES/PROCUREMENT/CS 四类角色，基于 `/me/permissions` 做入口控制。
  Rationale: 统一交付入口，减少多端维护成本。
  Date/Author: 2026-01-24 用户

- Decision: `/customers*` 从 commerce 迁移到 identity，identity 成为唯一归属与查询来源。
  Rationale: 客户归属与身份体系耦合，集中在 identity 更易授权与审计。
  Date/Author: 2026-01-24 用户

- Decision: commerce 每次请求调用 identity `/rbac/authorize` 进行鉴权，并使用进程内短 TTL 缓存；identity 不可用时拒绝请求（fail-closed）。
  Rationale: 权限源唯一且需要安全兜底，同时降低频繁调用开销。
  Date/Author: 2026-01-24 用户

- Decision: miniapp 采用“网关优先”的 baseUrl 策略，优先读取 `TARO_APP_API_BASE_URL`，仅在缺失时直连 identity/commerce。
  Rationale: 线上路径统一，直连仅用于排障或临时对比。
  Date/Author: 2026-01-24 用户

- Decision: `/bff/bootstrap` 允许匿名访问；未登录时返回 `featureFlags`，登录后追加 `me` 与 `permissions`。
  Rationale: 启动页需要在登录前拿到功能开关与初始化配置。
  Date/Author: 2026-01-24 用户

- Decision: `/bff/bootstrap` 必须纳入 OpenAPI 契约并生成 TS client。
  Rationale: 对外 API 需要可生成客户端以降低对接成本。
  Date/Author: 2026-01-24 用户

- Decision: feature flags 存储在 identity，并通过 `/admin/config/feature-flags` 读写。
  Rationale: 权限与配置集中化，避免多服务配置漂移。
  Date/Author: 2026-01-24 用户

- Decision: customer `displayName` 优先使用手机号后四位；手机号缺失时回退到 `userId` 后四位。
  Rationale: 在未采集手机号时仍提供稳定的可识别展示名。
  Date/Author: 2026-01-24 用户

- Decision: 扫码绑定仅在 `ownerSalesUserId` 为空时写入；客户归属变更只能通过 admin transfer。
  Rationale: 防止重复扫码覆盖归属关系。
  Date/Author: 2026-01-24 用户

- Decision: 产品导入图片默认采用 URL；zip/相对路径仅作为后续扩展。
  Rationale: 先打通主链路，降低导入复杂度。
  Date/Author: 2026-01-24 用户

- Decision: Excel 批量加购匹配优先 SKU/编码；匹配不唯一则进入确认页面。
  Rationale: 降低下单人工作量并控制误加购风险。
  Date/Author: 2026-01-24 用户

- Decision: 售后与询价优先按 `ownerSalesUserId` 归属路由，CS 具备 ALL scope。
  Rationale: 业务员跟进为主、客服兜底。
  Date/Author: 2026-01-24 用户

- Decision: OpenAPI `servers` 统一改为根路径（不使用 `/v1`）。
  Rationale: 当前网关路由在根路径，契约需与实际一致。
  Date/Author: 2026-01-24 用户

- Decision: `/ai/*` 暂无服务实现时，gateway-bff 对 `/ai/*` 返回 501 并记录日志。
  Rationale: 契约已包含 AI 路径，但仓库暂无实现，避免隐式误路由。
  Date/Author: 2026-01-24 Codex

- Decision: `admin` 导入/导出任务复用 commerce 的 `import_jobs` 表结构与查询，不新增独立 job service。
  Rationale: 复用现有 schema 与查询，减少新迁移与维护成本。
  Date/Author: 2026-01-24 Codex

- Decision: payment feature flag 关闭时 `/payments/*/create` 返回 403，但 `/payments/*/notify` 仍保持可达。
  Rationale: 回调需要落账/清理，不能被开关阻断。
  Date/Author: 2026-01-24 Codex

- Decision: `/admin/config/feature-flags` 允许匿名读取，PATCH 仍需管理员权限。
  Rationale: bootstrap 在未登录时仍需 feature flags 以驱动入口展示。
  Date/Author: 2026-01-24 Codex

- Decision: payment 服务优先从 identity `/admin/config/feature-flags` 读取配置，失败时回退到环境变量。
  Rationale: 保持配置中心一致性，同时支持本地开发无需依赖 identity。
  Date/Author: 2026-01-24 Codex

- Decision: 本计划以 `feat-miniapp-v0` 作为实现与集成分支。
  Rationale: 与现有开发分支策略一致，便于回滚与并行推进。
  Date/Author: 2026-01-24 用户

- Decision: 仓库不引入 sample app，示例小程序仅作为本地参考。
  Rationale: 避免增加无维护价值的示例工程。
  Date/Author: 2026-01-24 用户

## Outcomes & Retrospective

当前已完成启动与鉴权底座、契约迁移、commerce 端 wishlist/需求单/售后/询价模块补齐，以及 gateway-bff 路由编排与 payment 服务最小落地，并新增 gateway bootstrap 客户端与 miniapp 角色选择页面。后续重点转向小程序页面逐一替换真实 API，补齐端到端链路可运行与验证。

## Context and Orientation

仓库结构要点：`apps/miniapp` 是小程序前端（Taro + React + TypeScript + Sass）；`services/commerce` 是可运行的 Go 业务服务；`services/identity` 负责认证与 RBAC；`services/gateway-bff` 是统一网关；`services/payment` 目前为占位；`packages/commerce-services` 与 `packages/identity-services` 是前端逻辑层封装；`packages/*-api-client` 为 orval 生成的 OpenAPI client；`contracts/openapi` 存放契约，`contracts/openapi/openapi.yaml` 聚合入口。

术语说明：BFF 指 `services/gateway-bff` 提供的前端聚合层；RBAC 是基于角色与权限码的访问控制，权限源在 identity 的 `/rbac/*`；feature flag 是运行时开关配置，存储在 identity；scene 是小程序扫码入口的场景值，用于绑定客户归属；scope 分为 SELF（仅自身）、OWNED（归属客户/订单）、ALL（全量），这些 scope 在授权与查询过滤中起作用；fail-closed 表示鉴权依赖不可用时拒绝请求；JWT 是 Bearer Token 认证格式；Idempotency-Key 是订单与支付创建接口的幂等请求头；OpenAPI 是 `contracts/openapi/*.yaml` 的接口契约；orval 是 TypeScript OpenAPI client 生成器（`packages/*-api-client/orval.config.ts`）；sqlc 是把 `services/*/queries/*.sql` 生成 `services/*/internal/db/*.go` 的工具；oapi-codegen 是把 OpenAPI 生成 Go HTTP types/handlers 的工具（`tools/scripts/*-generate.sh`）；Taro 是小程序跨端框架（`apps/miniapp`）；pnpm 是仓库包管理器，用于 `pnpm -C <dir> ...` 命令。

角色与核心能力：CUSTOMER 浏览、收藏、加购、提交意向订单、查询物流、提交需求、售后与询价；SALES 获取二维码并处理归属客户的询价与售后；PROCUREMENT 负责物流与批量运单导入；CS 可处理所有售后与询价；ADMIN 拥有全量权限并通过 `/admin/*` 操作。

当前逻辑层现状：`apps/miniapp/src/app.ts` 只做 token 恢复与 `/me` 请求，未处理角色选择与绑定；页面大多为 mock 数据，未调用 `packages/commerce-services` 与 `packages/identity-services`。网关路由目前仅覆盖 `/auth*` 与 `/me*`，需要扩展到 identity/commerce/admin/payment/ai 全量路径。`import_jobs` 表与查询位于 `services/commerce/migrations/00006_create_tracking_shipments.sql` 与 `services/commerce/queries/import_jobs.sql`。

网关优先策略：miniapp 通过 `TARO_APP_API_BASE_URL` 连接网关，只有当该值为空时才读取 `TARO_APP_IDENTITY_BASE_URL` 与 `TARO_APP_COMMERCE_BASE_URL` 直连。`apps/miniapp/.env.*` 在 `.gitignore` 中，初次使用需自行创建并填写 `TARO_APP_API_BASE_URL`。

## Plan of Work

里程碑 0 聚焦启动与鉴权底座。需要在 `apps/miniapp/src/app.ts` 引入 bootstrap 流程，新增 `apps/miniapp/src/services/bootstrap.ts` 或 `apps/miniapp/src/services/gateway.ts` 封装 `/bff/bootstrap` 调用，并把 role 冲突与选择流程落到具体页面（例如新增 `apps/miniapp/src/pages/auth/role-select/index.tsx`，并在 `apps/miniapp/src/app.config.ts` 注册页面）。当启动时获取到 `scene`，必须传入 `identityServices.auth.miniLogin` 以完成绑定；若返回 409 则引导用户选择 role 后重试登录。登录成功后调用 `/me` 与 `/me/permissions` 并更新本地状态，失败时记录可观察日志。该里程碑必须同时更新 `packages/identity-services/src/index.ts` 以提供 `me.getPermissions`，并保证 miniapp 默认使用网关 baseUrl。

里程碑 1 处理契约迁移与代码生成。将 `/customers*` 从 `contracts/openapi/commerce.yaml` 迁移到 `contracts/openapi/identity.yaml`，并在 `contracts/openapi/openapi.yaml` 更新对应路径引用；新增 `contracts/openapi/gateway.yaml` 定义 `/bff/bootstrap`。随后更新 `tools/scripts/identity-generate.sh` 的 tag 过滤，确保 customers 与 feature flags 生成；更新 `tools/scripts/commerce-generate.sh` 的 tag 范围包含 Wishlist/ProductRequests/AfterSales/Inquiries；新增 `packages/gateway-api-client` 的 orval 配置并生成 TypeScript client。完成后在 `packages/identity-services`、`packages/commerce-services` 与新增 `packages/gateway-services` 中提供对应 wrapper。

里程碑 2 补齐 commerce 服务端模块与数据模型。扩展 migrations 与 sqlc queries，补齐 wishlist、product_requests、after_sales、inquiries 与消息表，并补齐 handlers 与 RBAC 过滤逻辑。Excel 批量加购与物流批量导入已有接口，需要补齐权限控制、错误码与 UI/网关编排联动，而不是重复实现。完成后，`services/commerce/internal/http/handler` 中应有对应模块的可运行实现。

里程碑 3 完成 gateway-bff 路由与 `/admin/*` 编排。修改 `services/gateway-bff/internal/http/server.go` 与 `services/gateway-bff/internal/http/proxy.go`，显式覆盖 identity（`/auth*`、`/me*`、`/rbac*`、`/staff*`、`/audit-logs*`、`/customers*`）、commerce（其余 commerce paths）、payment（`/payments*`）、admin（`/admin*`）、bff（`/bff*`）与 ai（`/ai*`）路径。更新 `services/gateway-bff/internal/config/config.go` 增加 payment/ai upstream 配置与超时参数，并同步 `services/gateway-bff/internal/http/ready.go` 让 `/ready` 覆盖新增上游。`/bff/bootstrap` 实现应聚合 `me`、`permissions`、`featureFlags`；匿名访问返回 `me=null`。`/admin/config/feature-flags` 直接读写 identity 存储；导入/导出任务复用 commerce 的 `import_jobs`；`/admin/customers/{id}/transfer` 调用 identity 迁移归属并记录审计。`/ai/*` 暂未实现时返回 501。

里程碑 4 落地 payment 服务。新增 `services/payment` 的可运行 Go 服务，加入 `cmd/payment/main.go`、配置与路由，并通过 oapi-codegen 生成类型；实现 `POST /payments/wechat/create`、`POST /payments/wechat/notify` 与预留的 `POST /payments/alipay/create`。支付创建接口受 feature flag 控制，notify 保持可达。gateway-bff 在关闭时直接返回 `403 feature-disabled`。

里程碑 5 前端逐页对接。首页/搜索/详情接 catalog；收藏页接 wishlist；购物车与 Excel 导入接 cart/import-jobs；订单列表/详情与物流接 orders/tracking；需求收集接 product-requests；售后与询价接 after-sales 与 inquiries；采购员批量导入接 shipments/import-jobs。页面入口需要基于 `/me/permissions` 控制显示，避免 CUSTOMER 看到采购员入口。

## Concrete Steps

所有命令均默认在仓库根目录执行，除非单独注明。

启动数据库与基础服务：

  cwd: <repo-root>

    docker compose -f infra/dev/docker-compose.yml up -d
    bash tools/scripts/dev-bootstrap.sh

期望输出（节选）：

    Starting local Postgres...
    Applying commerce migrations...
    migrations applied from <repo>/services/commerce/migrations
    Seeding commerce data...
    Creating identity database...
    Applying identity migrations...
    migrations applied from <repo>/services/identity/migrations
    Seeding identity data...

启动服务（分别在各目录执行，端口建议避免冲突）：

  cwd: services/identity

    IDENTITY_HTTP_ADDR=":8081" go run ./cmd/identity

  cwd: services/commerce

    COMMERCE_HTTP_ADDR=":8082" COMMERCE_DB_DSN="postgres://commerce:commerce@localhost:5432/commerce?sslmode=disable" go run ./cmd/commerce

  cwd: services/gateway-bff

    GATEWAY_HTTP_ADDR=":8080" GATEWAY_IDENTITY_BASE_URL="http://localhost:8081" GATEWAY_COMMERCE_BASE_URL="http://localhost:8082" go run ./cmd/gateway-bff

  cwd: services/payment

    PAYMENT_HTTP_ADDR=":8083" PAYMENT_IDENTITY_BASE_URL="http://localhost:8081" go run ./cmd/payment

生成代码（当契约或 SQL 发生变更时）：

  cwd: <repo-root>

    bash tools/scripts/identity-generate.sh
    bash tools/scripts/commerce-generate.sh
    bash tools/scripts/payment-generate.sh
    pnpm -C packages/api-client generate
    pnpm -C packages/identity-api-client generate
    pnpm -C packages/gateway-api-client generate

小程序启动（使用网关模式）：

  cwd: apps/miniapp

    pnpm dev:weapp

## Validation and Acceptance

健康检查与就绪检查：

  cwd: <repo-root>

    curl -i http://localhost:8080/health

期望输出（节选）：

    HTTP/1.1 200 OK
    OK

匿名 bootstrap：

  cwd: <repo-root>

    curl -sS http://localhost:8080/bff/bootstrap

期望输出（节选）：

    {"me":null,"permissions":[],"featureFlags":{...}}

登录与权限拉取：

  cwd: <repo-root>

    curl -sS -X POST http://localhost:8080/auth/mini/login \
      -H 'Content-Type: application/json' \
      -d '{"platform":"weapp","code":"mock_customer_001"}'

    curl -sS http://localhost:8080/bff/bootstrap \
      -H "Authorization: Bearer <token>"

期望输出（节选）：

    {"me":{...},"permissions":[...],"featureFlags":{...}}

支付默认关闭验证：

  cwd: <repo-root>

    curl -i -X POST http://localhost:8080/payments/wechat/create \
      -H "Authorization: Bearer <token>" \
      -H 'Content-Type: application/json' \
      -d '{"orderId":"<uuid>"}'

期望输出（节选）：

    HTTP/1.1 403 Forbidden
    {"code":"feature-disabled",...}

后端测试与小程序构建：

  cwd: <repo-root>

    pnpm run test:backend

期望输出（节选）：

    ok   github.com/teamdsb/tmo/services/commerce ...
    ok   github.com/teamdsb/tmo/packages/go-shared ...

如果未设置 `COMMERCE_DB_DSN`，涉及数据库的集成测试会被跳过，需在本地启动 Postgres 后再运行以覆盖全部用例。

  cwd: apps/miniapp

    pnpm lint
    pnpm build:weapp
    pnpm build:alipay

期望输出（节选）：

    ✔ built in ...

## Idempotence and Recovery

数据库迁移可重复执行：`bash tools/scripts/commerce-migrate.sh` 与 `bash tools/scripts/identity-migrate.sh`。identity seed 可通过 `IDENTITY_SEED_RESET=true bash tools/scripts/identity-seed.sh` 重置。若 gateway 编排逻辑出现错误，可暂时退回“显式路由 + 无 `/bff/*` 与 `/admin/*`”的模式，以保证基本代理可用。

## Artifacts and Notes

开发期 mock 登录说明：identity 默认 `IDENTITY_LOGIN_MODE=mock`，可使用 `mock_customer_001`、`mock_sales_001` 与 `mock_multi_001` 触发不同角色与多角色冲突。生产环境需切换到真实平台登录配置。

如果需要直连模式排障，在 `apps/miniapp/.env.development` 中清空 `TARO_APP_API_BASE_URL` 并设置 `TARO_APP_IDENTITY_BASE_URL` 与 `TARO_APP_COMMERCE_BASE_URL`，即可绕过网关直连服务。

## Interfaces and Dependencies

前端逻辑层必须通过 `packages/*-services` 调用，不直接引用生成的 API client。`packages/identity-services` 需要新增 `me.getPermissions()` 与 `customers` 相关接口；`packages/commerce-services` 需要新增 wishlist、product-requests、after-sales、inquiries 的 services 及上传能力；新增 `packages/gateway-api-client` 与 `packages/gateway-services` 用于 `/bff/*` 与 `/admin/*`。所有生成代码必须通过脚本生成，禁止手工编辑 `services/*/internal/http/oapi/api.gen.go` 与 `services/*/internal/db/*.go`。

后端方面：identity 增加 feature flags 表与 `/admin/config/feature-flags` 的存取逻辑，并承载 `/customers*`；commerce 补齐 wishlist/product-requests/after-sales/inquiries 与导入任务；gateway-bff 增加路由与编排；payment 完成最小可运行接口。gateway-bff 配置需要新增 payment 与 ai upstream baseUrl，并设置超时与请求体大小上限。

## 变更说明

2026-01-24：根据用户“/v1 改根路径、网关优先、匿名 bootstrap、feature flags 存储、fail-closed 鉴权缓存”等决策重写 ExecPlan，补齐术语定义、命令工作目录与测试验证要求，并扩展 gateway 路由与 AI 处理策略说明以满足 `docs/execplans/PLANS.md` 的 self-contained 要求。
