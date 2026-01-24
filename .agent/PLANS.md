# Identity v0 可运行服务（Auth + JWT + 角色）+ Gateway BFF 聚合 + Miniapp 登录地基

本 ExecPlan 是一个持续更新的文档。`Progress`、`Surprises & Discoveries`、`Decision Log`、`Outcomes & Retrospective` 这四个部分在工作推进时必须同步更新。

本计划必须遵守仓库根目录的 `docs/execplans/PLANS.md`。

## Purpose / Big Picture

目标是把 `services/identity` 从“README 占位”推进到“本地可运行、可被其他服务/小程序调用的最初版身份服务”，并同时补齐 `services/gateway-bff` 的最小聚合能力，让前端只需要配置一个 API Base URL（网关）即可访问 identity 与 commerce。完成后，一个新同学只读这一份 `.agent/PLANS.md` 就能在本机做出可验证的行为：

1) 启动本地 Postgres、identity（:8081）、commerce（:8082）、gateway-bff（:8080）后：
   - `GET http://localhost:8080/health` 返回 HTTP 200 且 body 为 `OK`。
   - `GET http://localhost:8080/ready` 在 identity 与 commerce 都就绪时返回 200；任一未就绪时返回 503（标准 ErrorResponse）。

2) 通过网关调用 `POST http://localhost:8080/auth/mini/login`（默认 dev/mock；配置平台凭证后走真实 WeChat/Alipay）拿到 `accessToken`（Bearer JWT，7 天有效期）；再用该 token 调用 `GET http://localhost:8080/me` 得到当前用户信息（`userType` + `roles`）。

3) 用“Sales（业务员）”账号调用 `GET http://localhost:8080/me/sales-qr-code` 得到可用于“客户归属绑定”的 `scene` 与 `qrCodeUrl`（scene 默认 7 天过期）；用“Customer”调用同接口得到 403。

4) 前端侧（`apps/miniapp` 的“逻辑层”而非 UI）：具备一个最小可用的 identity service 层，能完成“平台登录 -> 调用 identity -> 存 token -> 读 /me”的链路；并把 token 存储 key 统一为全局 key，让现有 `packages/commerce-services` 默认即可复用该 token（后续接入 commerce 的鉴权无需再做 token 搬运）。

5) 多角色用户的“当前角色”必须可控：当用户拥有多个系统角色时，登录请求必须显式指定 `role`；未指定时返回 409（Conflict）并在 `details` 中返回可选角色列表，客户端据此引导用户选择后重试登录。

6) 同一用户允许跨 `userType` 持有角色（例如同时拥有 `ADMIN` 与 `SALES`）。`/me.userType` 必须反映“本次 token 选择的当前 role”（role->userType 映射：`CUSTOMER`->customer，`SALES/PROCUREMENT/CS`->staff，`ADMIN`->admin）。`/me.roles` 仍返回该用户拥有的完整角色列表。

7) 为了保持安全边界：`/auth/password/login` 仅用于以 `ADMIN` 身份登录；`/auth/mini/login` 不允许选择 `ADMIN`（传 `role=ADMIN` 必须返回 400）。

本计划的“最初版”不是完整 RBAC/权限管理后台，而是先把“账号体系 + JWT 发行 + 基础角色 + 业务员绑定入口（scene）”跑通，并为后续 v1/v2 的 RBAC 权限与审计留好扩展点。

## Progress

- [x] (2026-01-23 16:10Z) 读取并对齐现有材料：`docs/需求文档.md`、`docs/rbac.md`、`contracts/openapi/identity.yaml`、仓库各 README；并记录关键技术抉择（见 `Decision Log`）。
- [x] (2026-01-23 17:06Z) 补充新增技术抉择与风险：JWT 携带 `ownerSalesUserId` 作为下单 owner 快照来源；启用 commerce 鉴权时补齐 OWNED/SELF RBAC；以及 OpenAPI 公共 schema 全量同步与前端 identity client 拆包策略。
- [x] (2026-01-23 17:32Z) 里程碑 0：新增 identity Go module 骨架（config/db/http/health/ready/main）并加入 `go.work`；完成 go mod tidy 与 `go test ./...` 验证。
- [x] (2026-01-23 17:42Z) 里程碑 1：新增 identity migrations/sqlc queries、迁移/seed/生成脚本与命令；完成 sqlc 生成与 `go test ./...` 验证。
- [x] (2026-01-23 17:46Z) 里程碑 2：新增 JWT 配置与签发/解析模块，支持 `sub`/`role` 兼容 claim 与可选 `ownerSalesUserId`；完成 `go test ./...` 验证。
- [x] (2026-01-23 17:50Z) 里程碑 3：更新 /auth 登录合约（role + 409 Conflict）并同步多份 OpenAPI 的通用 schema。
- [x] (2026-01-23 18:06Z) 里程碑 4：实现 identity 4 个端点（mini/password login、/me、/me/sales-qr-code），生成 oapi 代码并完成 `go test ./...`。
- [x] (2026-01-23 18:17Z) 里程碑 5：新增 gateway-bff 可运行骨架（反向代理 + health/ready），完成 go mod tidy 与 `go test ./...`。
- [x] (2026-01-23 18:28Z) 里程碑 6：新增 dev-bootstrap 与 gateway-verify 脚本，并补齐 identity/gateway README 与脚本目录说明。
- [x] (2026-01-23 18:56Z) 里程碑 7：落地 identity TS client/services、统一 token key，并完成 miniapp 薄接入。
- [x] (2026-01-23 18:56Z) 里程碑 8：commerce 解析 ownerSalesUserId claim，补齐 orders OWNED/SELF RBAC 并写入 owner 快照。
- [x] 里程碑 0：把 `services/identity` 变成可编译可启动的 Go 服务骨架（config + httpx router + health/ready + db pool），并加入 `go.work`，确保 `tools/scripts/test-backend.sh` 能跑通。
- [x] 里程碑 1：落地 identity 的 Postgres schema（migrations）+ sqlc（queries/ internal/db），并提供 migrate/seed/generate 脚本（对齐 commerce 的工作流）。
- [x] 里程碑 2：实现 JWT 发行与校验（HMAC），并把 claim 设计为与 `services/commerce/internal/http/middleware/auth.go` 兼容（`sub` + `role`），同时在响应中按 OpenAPI 返回 `roles[]`。
- [x] 里程碑 3：OpenAPI 合约更新：为 `/auth/mini/login` 与 `/auth/password/login` 增加可选 `role`，并定义 409（Conflict）时 `details.availableRoles` 的结构；同时全量同步 `contracts/openapi/*.yaml` 内重复的公共 schema（避免同名漂移）。
- [x] 里程碑 4：实现 OpenAPI `identity.yaml` 的 4 个端点（`/auth/mini/login`、`/auth/password/login`、`/me`、`/me/sales-qr-code`）与对应的单测/集成测。
- [x] 里程碑 5：落地 `services/gateway-bff` 最小聚合：反向代理（/auth,/me -> identity；其余 -> commerce），不做 JWT 校验，只透传 `Authorization` 与 `X-Request-ID`；并提供 gateway 自己的 /health 与 /ready。
- [x] 里程碑 6：补齐 dev 体验：一键 bootstrap（起 Postgres、创建 identity 数据库、迁移、seed）、smoke 验证脚本（走网关验证）、以及 `services/identity/README.md`/`services/gateway-bff/README.md` 指引。
- [x] 里程碑 7（前端逻辑层）：新增 `packages/identity-api-client`（orval 生成）与 `packages/identity-services`（业务逻辑层），并修改 `packages/commerce-services` 的默认 token storage key 为全局 key；在 `apps/miniapp` 做薄接入与类型检查通过（baseUrl 指向 gateway :8080）。
- [x] 里程碑 8：打通“identity 发 token -> commerce 验 token” 的本地端到端验证（开启 commerce 鉴权并复用同一 JWT secret/issuer），并通过网关访问 commerce 端点，证明 Stage 0 的服务间契约可工作。
- [ ] 里程碑 9（长线 v1/v2）：RBAC 权限码与 scope 评估、审计日志、员工账号管理/绑定、平台真机（WeChat/Alipay）登录与小程序码生成的生产化，以及 OpenAPI 中“公共 schema（MiniLoginRequest/User/ErrorResponse 等）”的去重与统一（建议抽到共享文件并由各 spec 引用）。

## Surprises & Discoveries

- Observation: `contracts/openapi/identity.yaml` 目前只定义了 4 条 identity 路径，但 components.schemas 中包含大量与 catalog/cart/orders 等相关的 schema（与 identity 端点无直接关系）。
  Evidence: `contracts/openapi/identity.yaml` 中 `Category`/`ProductSummary`/`ProductDetail`/`SKU` 等 schema；而 paths 仅有 `/auth/*` 与 `/me*`。

- Observation: 本地 Postgres 由 `infra/dev/docker-compose.yml` 提供，默认只创建了 `commerce` 数据库；identity 若要独立数据库，需要额外创建（或改 compose）。
  Evidence: `infra/dev/docker-compose.yml` 仅设置 `POSTGRES_DB: commerce`。

- Observation: 目前 `go.work` 只包含 `services/commerce` 与 `packages/go-shared`；如果直接在 `services/identity` 下运行 `go test`，在启用 go.work 的环境下会报 “directory prefix does not contain modules listed in go.work”，因此 identity 需要被加入 go.work。
  Evidence: `go.work` 的 `use (...)` 列表不包含 `./services/identity`。

- Observation: `packages/api-client` 的 runtime 配置是全局单例（`setApiClientConfig`）。在“网关统一 baseUrl”为前提时问题不大；但如果绕过网关直连多个服务，就会出现“配置被后一次 set 覆盖”的隐蔽问题。
  Evidence: `packages/api-client/src/runtime.ts` 的 `apiClientConfig` 是单个变量；而本计划采用 gateway 统一 baseUrl（:8080）来规避该冲突。

- Observation: `services/gateway-bff` 当前只有 README 与占位目录，没有任何可运行代码；若要实现“前端单 baseUrl”，必须把该服务从零实现出来（至少反向代理 + health/ready）。
  Evidence: `services/gateway-bff` 目录下只有 `README.md` 与 `.gitkeep`。

- Observation: `contracts/openapi/openapi.yaml` 与 `contracts/openapi/commerce.yaml` 中也包含 `MiniLoginRequest`/`PasswordLoginRequest`/`User` 等 schema 的重复定义；若只更新 `contracts/openapi/identity.yaml`，容易导致 “聚合文档与服务文档不一致”。
  Evidence: `contracts/openapi/openapi.yaml#/components/schemas/MiniLoginRequest` 与 `contracts/openapi/identity.yaml#/components/schemas/MiniLoginRequest` 同名但不同文件。

- Observation: 上述“登录/用户 schema 重复定义”不仅存在于 `openapi.yaml/commerce.yaml/identity.yaml`，在 `contracts/openapi/admin.yaml`、`contracts/openapi/payment.yaml`、`contracts/openapi/ai.yaml` 也存在；如果未来为这些域生成 TS client 或落地服务实现，必须统一这些 schema，否则会再次出现“同名不同义”。
  Evidence: `contracts/openapi/*.yaml` 中都有 `components/schemas/MiniLoginRequest`（可用 `rg -n \"MiniLoginRequest\" contracts/openapi/*.yaml` 验证）。

- Observation: `oapi-codegen` 在生成 identity 接口时提示 OpenAPI 3.1 仍在支持中，需留意未来兼容性。
  Evidence: 生成 `services/identity/internal/http/oapi/api.gen.go` 时出现 “OpenAPI 3.1.x specification is not yet supported” 警告。

- Observation: 如果未来在 commerce 中开启鉴权并签发 `SALES` token，当前 commerce 的订单读接口没有正确实现 `docs/rbac.md` 的 OWNED 约束（存在越权风险）。同时，commerce 下单时目前把 `orders.owner_sales_user_id` 写为 NULL，导致“客户归属到业务员后，下单算在业务员下面”的业务目标无法成立。
  Evidence: `services/commerce/internal/http/handler/orders.go` 中 `GetOrders` 对 `SALES` 分支没有设置 `ownerFilter`；`GetOrdersOrderId` 仅在 `owner_sales_user_id` 非空时才限制；`PostOrders` 创建订单时 `OwnerSalesUserID: pgtype.UUID{}`（即 NULL）。

## Decision Log

- Decision: `/auth/mini/login` 平台对接采用 “1c 混合策略”：默认 dev/mock；若配置平台凭证则走真实对接。
  Rationale: v0 要可跑可测，不被外部平台凭证阻塞；但也要能在配置就绪时无缝切换到真实 WeChat/Alipay，不返工接口形态。
  Date/Author: 2026-01-23 / Codex + User

- Decision: identity 从第一天就使用 Postgres + migrations + sqlc（2a），不做长期内存实现。
  Rationale: identity 是跨服务的“源数据域”，必须有可迁移、可回放、可测试的数据层；否则后续 RBAC/审计会反复推倒重来。
  Date/Author: 2026-01-23 / Codex + User

- Decision: JWT claim 兼容现有 commerce 资源服务解析（3a）：`sub=<uuid>` + `role=<string>`；同时可增加 `roles`/`userType` 等扩展 claim，但不得破坏兼容。
  Rationale: 让 identity 作为 issuer 后，commerce 可以直接开启鉴权并复用 token，不需要同步大改 commerce 的 middleware。
  Date/Author: 2026-01-23 / Codex + User

- Decision: 前端 token 存储 key 采用全局单 key（4a）：修改 `packages/commerce-services` 的默认 token storage key，使其默认读取 identity token。
  Rationale: 避免“identity 登录 token”和“commerce 调用 token”两套存储导致的漂移；让 miniapp 只需做一次登录即可访问所有受保护资源。
  Date/Author: 2026-01-23 / Codex + User

- Decision: staff/admin 不允许首次登录自动创建（5a）：customer 可通过 mini login 自动创建；staff/admin 必须预置（seed 或未来后台管理）并通过绑定外部身份或密码登录。
  Rationale: 内部账号属于权限边界，必须可控；避免任何人通过猜测 code/scene 获得 staff/admin 身份。
  Date/Author: 2026-01-23 / Codex + User

- Decision: v0 范围内纳入 `services/gateway-bff`（1a），通过最小反向代理把 identity 与 commerce 聚合到同一个 baseUrl，前端只配置网关地址即可联调。
  Rationale: 直接解决“多 baseUrl + TS runtime 全局单例”的冲突，并提前落地 Stage 0 runtime 的最小形态。
  Date/Author: 2026-01-23 / Codex + User

- Decision: gateway-bff 不做 JWT 校验（2a），只透传 `Authorization`（Bearer token）以及 `X-Request-ID`，由下游服务各自校验并返回错误。
  Rationale: v0 优先把链路打通；把鉴权逻辑集中到网关会引入重复解析/信任边界/headers 注入等安全复杂度，适合在后续 v1 再评估。
  Date/Author: 2026-01-23 / Codex + User

- Decision: 本地端口与路径约定（3a）：gateway=:8080、identity=:8081、commerce=:8082；网关不加 `/v1` 前缀，不做路径裁剪。
  Rationale: 降低初期心智负担与代理规则复杂度；同时避免与 commerce 默认 :8080 端口冲突（通过运行时 env 覆盖）。
  Date/Author: 2026-01-23 / Codex + User

- Decision: 多角色用户在登录时必须显式选择当前 role（5c/4a）：登录请求增加可选 `role`；当用户拥有多个角色且未指定 role 时，返回 409 并在 `details.availableRoles` 给出可选列表；成功登录时 JWT 的 `role` claim 使用所选 role。
  Rationale: commerce 侧鉴权当前只解析单值 `role` claim；通过“登录时选定角色”可以在不改 commerce middleware 的前提下支持多角色用户，同时把选择交互留给客户端。
  Date/Author: 2026-01-23 / Codex + User

- Decision: access token 有效期为 7 天（3c），并强校验 issuer（2a）；`/me/sales-qr-code` 生成的 scene 默认 7 天过期（5a）。
  Rationale: v0 开发期希望减少频繁登录；同时通过 issuer 强校验避免不同环境/服务之间 token 混用；scene 过期减少长期可用的绑定入口被滥用的风险。
  Date/Author: 2026-01-23 / Codex + User

- Decision: 允许同一用户同时拥有跨 `userType` 的系统角色（1b），并且 `User.userType` 由“本次登录选择的当前 role”推导，而不是固定字段。
  Rationale: 业务上同一人可能同时承担管理与一线角色；通过“token 当前 role”派生 userType，既保持 OpenAPI 的 userType 字段语义（当前身份），也不要求引入更复杂的会话模型。
  Date/Author: 2026-01-23 / Codex + User

- Decision: `/auth/password/login` 只允许登录为 `ADMIN`（2a）；请求若显式传 `role` 则必须为 `ADMIN`，否则返回 400。
  Rationale: admin 是高权限入口，先保持最小可控面；员工角色的登录与切换通过 mini login（或后续 staff miniapp）承载。
  Date/Author: 2026-01-23 / Codex + User

- Decision: `/auth/mini/login` 不允许选择 `ADMIN`（3a）；当用户拥有 `ADMIN` 与其他角色时，mini login 的 `details.availableRoles` 必须过滤掉 `ADMIN`。
  Rationale: 防止通过小程序登录路径进入管理员身份；并避免客户端误展示不可用的选项。
  Date/Author: 2026-01-23 / Codex + User

- Decision: `users.user_type` 字段仍然落库（1b），但它只表示“账号创建来源/默认类型”，不作为鉴权依据；API 的 `User.userType` 永远由 token 当前 role 推导。
  Rationale: 允许同一 user 跨 userType 持有角色后，固定 userType 会产生歧义；但保留一个落库字段对运营与后续后台管理仍有价值。
  Date/Author: 2026-01-23 / Codex + User

- Decision: TypeScript OpenAPI client 为 identity 单独新建 workspace 包 `packages/identity-api-client`（2b），以避免与现有 `@tmo/api-client`（commerce）在类型/operation 名称上的冲突。
  Rationale: `@tmo/api-client` 当前生成物里已经包含 `User/AuthResponse/MiniLoginRequest` 等类型；继续把 identity 生成物合并进去会引入命名冲突与“import 指向哪个 User”的困惑。拆包可以让依赖关系更清晰，且不阻塞后续把 openapi 聚合成单一 spec 的可能性。
  Date/Author: 2026-01-23 / Codex + User

- Decision: 同步更新 `contracts/openapi/*.yaml` 中重复定义的 `MiniLoginRequest/PasswordLoginRequest/User/AuthResponse/ErrorResponse` 等公共 schema（3b），确保跨域规范一致（至少包含新增的 `role` 字段与相关描述）。
  Rationale: 当前这些同名 schema 在 `identity.yaml/openapi.yaml/commerce.yaml/admin.yaml/payment.yaml/ai.yaml` 都存在；只改其中一部分会导致“同名不同义”，后续生成与联调极易漂移。
  Date/Author: 2026-01-23 / Codex + User

- Decision: customer 的归属业务员信息通过 JWT claim 下发给 commerce（1a）：identity 在 `role=CUSTOMER` 的 token 中增加可选 `ownerSalesUserId`（UUID 字符串）；commerce 在下单时读取该 claim 写入 `orders.owner_sales_user_id` 作为快照。
  Rationale: 避免 commerce 下单时额外调用 identity（降低耦合与运行时依赖）；同时让“客户归属到业务员后，下单算在该业务员下面”的归属快照在订单创建时就落库，便于 OWNED scope 查询。
  Date/Author: 2026-01-23 / Codex + User

- Decision: 启用 commerce 鉴权（里程碑 8）时必须立刻补齐 OWNED/SELF RBAC（2a），至少修复 orders 列表与详情的 SALES 越权读取问题，并确保 CUSTOMER 只能读自己的订单。
  Rationale: 在 Stage 0 就让 token 参与鉴权后，任何 “filter 未加” 都会变成真实越权风险；先在最核心的订单域把 scope 约束做对，后续再扩展到 tracking/after-sales 等域。
  Date/Author: 2026-01-23 / Codex + User

## Outcomes & Retrospective

- (2026-01-23) 里程碑 0：identity 服务骨架可编译与启动（config/db/http/health/ready/main），go.work 已加入 identity，`go test ./...` 通过。
- (2026-01-23) 里程碑 1：identity 数据库 schema + sqlc 生成完成，新增迁移/seed/生成脚本与命令，`go test ./...` 通过。
- (2026-01-23) 里程碑 2：identity JWT 配置与 TokenManager 完成，claim 兼容 `sub`/`role` 并支持扩展字段，`go test ./...` 通过。
- (2026-01-23) 里程碑 3：更新 identity/openapi/auth schema 的 role 与 409 定义，并同步到 openapi/commerce/admin/payment/ai。
- (2026-01-23) 里程碑 4：identity handler 实现登录与 /me 端点，补齐平台 code 解析、QR 码生成与 JWT 响应，新增 handler 集成测试并完成 `go test ./...`。
- (2026-01-23) 里程碑 5：gateway-bff 服务骨架与反向代理就绪，/health 与 /ready 可用，并通过 `go test ./...`。
- (2026-01-23) 里程碑 6：新增 dev-bootstrap 与 gateway-verify 脚本，补齐 identity/gateway README 与 scripts README。
- (2026-01-23) 里程碑 7：新增 identity TS client/services、统一 token key，并完成 miniapp 薄接入。
- (2026-01-23) 里程碑 8：commerce 支持 ownerSalesUserId claim、下单写入 owner 快照，并修复 orders OWNED/SELF RBAC。
- (TBD) 全部完成后：miniapp 具备最小登录逻辑层；identity token 可用于调用 commerce；为 RBAC/审计/员工管理留出扩展路径。

## Context and Orientation

仓库是单体仓库（monorepo）。当前唯一可运行的 Go 服务是 `services/commerce`，其实现模式（config/db/http/server/生成代码/脚本）是 identity v0 的对齐目标。identity 目前只有占位：`services/identity/README.md`、`services/identity/migrations/.gitkeep`、`services/identity/api/.gitkeep`。

关键目录与约定（新同学需要知道的“术语解释”）：

1) OpenAPI 合约：`contracts/openapi/identity.yaml` 定义了 identity 的 HTTP 接口与 JSON schema。Go 侧将用 `oapi-codegen` 根据该文件生成 Gin handler 接口与类型（生成到 `services/identity/internal/http/oapi/api.gen.go`），生成文件不可手改。

2) SQL 迁移（migrations）：`services/identity/migrations/*.sql` 用于创建/演进 Postgres 表结构。这里使用 goose 风格的 `-- +goose Up/Down` 注释，但本仓库不依赖安装 goose；commerce 已实现了一个“读取 migration 文件并执行 Up 段 SQL”的 Go runner（见 `services/commerce/internal/db/migrations.go`）。identity 需要同等能力（可复用/抽取）。

3) sqlc（查询生成）：`services/identity/queries/*.sql` 描述结构化 SQL 查询，`sqlc` 会生成 Go 代码到 `services/identity/internal/db/*.go`（不可手改）。该层用于避免手写 SQL 绑定与类型漂移。

4) JWT（JSON Web Token）：一种签名字符串，客户端用 `Authorization: Bearer <token>` 发送；资源服务用同一个 secret 校验签名，解出 claim（如 user id / role）。本仓库 commerce 的解析逻辑在 `services/commerce/internal/http/middleware/auth.go`，它要求 `sub` 是 UUID 字符串，`role` 是角色名。

5) RBAC（Role-Based Access Control）：基于角色的访问控制。`docs/rbac.md` 定义了系统角色（CUSTOMER/SALES/PROCUREMENT/CS/ADMIN）以及“scope”概念（SELF/OWNED/ALL）。identity v0 先把“角色出现在 JWT 与 /me 响应里”跑通；权限码与 scope 评估属于长线里程碑。

6) 前端（miniapp）现状：`apps/miniapp` 是 Taro + React + TypeScript。它当前只薄接入了 `packages/commerce-services`（见 `apps/miniapp/src/services/commerce.ts`）。该包内部通过 `@tmo/platform-adapter` 统一适配 wx/my 的 request/storage；并把 token 存入本地存储（见 `packages/commerce-services/src/token.ts`）。

## Plan of Work

本计划按“先能跑 -> 再能用 -> 再能扩展”的顺序推进。核心原则是“接口对齐优先”：OpenAPI 是唯一真相来源；Go 端通过 oapi-codegen/sqlc 生成物对齐；前端尽量通过生成 client/types + 业务逻辑 services 层接入，避免手写漂移。

### 里程碑 0：服务骨架（可启动 + health/ready）

在 `services/identity` 新增 Go module（`go.mod`），入口 `services/identity/cmd/identity/main.go`，并对齐 `services/commerce/cmd/commerce/main.go` 的结构：加载配置、初始化 logger、初始化 OpenTelemetry（`packages/go-shared/observability`）、连 Postgres（`packages/go-shared/db.NewPool`）、组装 Gin router（`packages/go-shared/httpx.NewRouter`）、注册 health/ready、注册 oapi handler。

需要显式避免与 commerce 端口冲突：identity 默认监听 `:8081`（可用 `IDENTITY_HTTP_ADDR` 覆盖）。

同时，把 `./services/identity` 加入 `go.work`，确保在该目录运行 `go test`/`go run` 时不会被 go.work 拒绝。

### 里程碑 1：数据层（migrations + sqlc + migrate/seed）

在 Postgres 中为 identity 创建独立数据库 `identity`（同一实例下多个 database），默认 DSN 为：

    postgres://commerce:commerce@localhost:5432/identity?sslmode=disable

这是为了满足“服务拥有自己的数据”的边界，即使本地仍复用同一个 docker 容器。

落地最小 schema，覆盖 v0 端点所需数据：

1) `users`：内部用户主表（UUID id、user_type、display_name、created_at）。注意：这里的 `user_type` 仅表示“创建来源/默认类型”，API 的 `User.userType` 由 token role 推导，不能把该字段当成权限依据。

2) `user_roles`：一对多角色表（user_id + role）。v0 不做权限码，只做角色。

3) `user_identities`：外部身份绑定（provider + provider_user_id -> user_id）。provider 至少支持 `weapp`、`alipay`、`password`；其中 `password` 用于 admin 用户名密码登录。

4) `credentials_password`（或合并进 `user_identities`）：存储 username 与 bcrypt hash（只用于 admin；staff 后续可加）。

5) `customer_profiles`（可选但推荐 v0 就做）：customer 的 `owner_sales_user_id` 字段，用于“首次扫码绑定业务员”，以及未来 OWNED scope 的数据同步/事件驱动。

6) `audit_logs`（v0 先落表与写入最小事件）：记录 login、bind 等事件，满足 `docs/rbac.md` 的审计方向（长线会扩展到跨服务动作）。

为上述表写出 `queries/*.sql`，并新增 `services/identity/sqlc.yaml`，生成到 `services/identity/internal/db`。同时增加两个 Go 命令：

1) `services/identity/cmd/identity-migrate`：应用 migrations（对齐 `services/commerce/cmd/commerce-migrate`）。

2) `services/identity/cmd/identity-seed`：写入 dev 预置账号（至少：1 个 ADMIN；1 个 SALES staff；必要的 identity bindings），以便验证 `/auth/password/login` 与 `/me/sales-qr-code`。

### 里程碑 2：JWT 发行与鉴权中间件（与 commerce 兼容）

新增 `services/identity/internal/auth`：

1) `SignAccessToken(userID, primaryRole, issuer, secret, ttl) -> tokenString`：签发 HMAC JWT，claim 至少包含：

   - `sub`: userID（UUID 字符串）
   - `role`: primaryRole（如 `CUSTOMER`/`SALES`/`ADMIN`）
   - `iss`: issuer（可为空；建议默认 `tmo-identity`）
   - `exp`: 过期时间（Unix 秒）
   - 可选扩展：`roles`: string[]（完整角色数组），`userType`: string（由当前 role 推导），`ownerSalesUserId`: string（仅当当前 role= CUSTOMER 且已绑定业务员时写入；UUID 字符串）

2) `ParseAndVerify(tokenString, secret, issuer) -> (userID, role, ok)`：校验签名与 issuer（如果配置了 issuer），并返回与 commerce middleware 一致的解析结果。

在 identity 的 HTTP 层实现一个最小的鉴权 helper（可以复用 `services/commerce/internal/http/middleware/auth.go` 的结构，但不要直接 import 该内部包）：

1) 未携带 Authorization -> 401（按 `contracts/openapi/openapi.yaml#/components/responses/Unauthorized` 的 ErrorResponse 结构）。

2) 角色不匹配 -> 403。

### 里程碑 3：OpenAPI 合约更新（多角色选择登录 + 全量同步公共 schema）

由于选择了“登录时选择当前角色”（Decision Log 5c/4a），必须先更新 OpenAPI 合约，避免服务实现与客户端类型漂移。

需要修改的文件（全量同步；避免同名 schema 漂移）：

1) `contracts/openapi/identity.yaml`：

   - `MiniLoginRequest` 增加可选字段 `role: string`。
   - `PasswordLoginRequest` 增加可选字段 `role: string`。

2) `contracts/openapi/openapi.yaml`：

   - 同步更新 `MiniLoginRequest` 与 `PasswordLoginRequest` 的 schema（本文件目前也定义了同名 schema）。

3) `contracts/openapi/commerce.yaml`：

   - 同步更新 `MiniLoginRequest` 与 `PasswordLoginRequest` 的 schema（本文件目前也定义了同名 schema，用于 TS 生成的 `@tmo/api-client`）。

4) `contracts/openapi/admin.yaml`、`contracts/openapi/payment.yaml`、`contracts/openapi/ai.yaml`：

   - 同步更新 `MiniLoginRequest` 与 `PasswordLoginRequest` 的 schema（这些文件目前也重复定义了同名 schema）。
   - （推荐）同步更新 `User` schema 中 `userType` 字段的描述（说明其语义是“当前 token 选择的身份”，由 role 推导），避免未来读文档误解。

同时，在本计划中规定“409（Conflict）时 details 的约定”，用于客户端做角色选择交互：

   - 当用户拥有多个角色且登录请求未带 `role` 时，返回：
     - HTTP 409
     - ErrorResponse.code = `conflict`
     - ErrorResponse.message = `role selection required`
     - ErrorResponse.details.availableRoles = string[]（例如 `["ADMIN","SALES"]`）

注意：identity 服务实现只依赖 `contracts/openapi/identity.yaml`，但前端的 `@tmo/api-client` 生成依赖 `contracts/openapi/commerce.yaml`；同时仓库里还有 `contracts/openapi/openapi.yaml` 作为聚合规范文件。公共 schema 在这些文件间不一致会导致 TS 类型与服务端真实行为漂移，且后续新增 payment/admin/ai 的生成与实现时会再次踩坑，因此本里程碑选择“一次性全量同步”。

### 里程碑 4：实现 identity OpenAPI 的 4 个端点（支持 role 选择）

用 `oapi-codegen` 从 `contracts/openapi/identity.yaml` 生成 Gin handler 接口到 `services/identity/internal/http/oapi/api.gen.go`，并在 `services/identity/internal/http/handler` 实现该接口。

端点行为要求（与合约对齐）：

1) `POST /auth/mini/login`（dev/mock + 可选真机对接）：

   - 输入：`platform`（weapp/alipay）、`code`、可选 `scene`、可选 `role`。
   - 解析外部身份：
     - dev/mock：直接把 `code` 作为 `provider_user_id`（为了安全与可控，建议要求 `code` 以 `mock_` 开头，并在 README 说明）。
     - weapp 真机（当配置 `IDENTITY_WEAPP_APPID/IDENTITY_WEAPP_APPSECRET`）：用 `code` 调用微信 `jscode2session` 换取 `openid`（作为 provider_user_id）。失败返回 400 或 401（视错误而定），并记录 audit。
     - alipay 真机：v0 先按 dev/mock 支持；长线里程碑再补齐真实对接（见后文“长线 v1/v2”）。
   - 查找 `user_identities(provider, provider_user_id)`：
     - 若不存在：创建新 user（user_type=customer）、插入 roles（CUSTOMER）、插入 identity binding，然后签 token（不触发“多角色选择”逻辑，因为只有一个角色）。
     - 若存在：加载 user 与 roles，并按以下规则确定本次登录使用的 role：
       - 安全约束：无论用户是否拥有 `ADMIN`，mini login 都不允许选择 `ADMIN`。若 request.role=ADMIN，返回 400（invalid_request）。
       - 可选角色列表 = user.roles 过滤掉 `ADMIN` 后的集合。
       - 如果可选角色列表为空：返回 403（forbidden），表示该用户不可通过 mini login 登录。
       - 如果可选角色列表只有 1 个：允许 request.role 为空；若 request.role 非空但不在可选列表中，返回 400。
       - 如果可选角色列表多于 1 个：request.role 必填；缺失时返回 409（Conflict）并返回 `details.availableRoles`（必须是过滤后的列表）；若提供但不在列表中，返回 400。
   - token：签发 accessToken（HMAC JWT），有效期固定为 7 天；必须设置并强校验 issuer。
   - userType：登录响应里的 `user.userType` 与 `/me.userType` 必须由“本次 token 的当前 role”推导（`CUSTOMER`->customer，`SALES/PROCUREMENT/CS`->staff，`ADMIN`->admin）。
   - ownerSalesUserId：当本次登录的当前 role= CUSTOMER 时，从 `customer_profiles.owner_sales_user_id` 读取绑定关系；若存在则写入 JWT claim `ownerSalesUserId`（UUID 字符串），用于 commerce 下单写入 `orders.owner_sales_user_id` 作为快照；若不存在则不写入该 claim。
   - scene（销售绑定）处理（只对 customer 生效）：
     - scene 由 `/me/sales-qr-code` 生成，必须是“可验证的字符串”（HMAC 签名，包含 exp）。
     - 如果 customer_profile.owner_sales_user_id 为空，则写入该 salesUserId，并写 audit；如果不为空则忽略并写 audit（“only applied on first bind”）。

2) `POST /auth/password/login`（admin web）：

   - 输入：username/password、可选 role。
   - 约束：本接口仅允许以 `ADMIN` 身份登录。
     - 如果 request.role 为空：使用 `ADMIN`。
     - 如果 request.role 非空且不是 `ADMIN`：返回 400（invalid_request）。
   - 从 credentials 表查 username，bcrypt 校验密码；成功后加载对应 user 与 roles；若用户不含 `ADMIN` 角色则返回 403（forbidden）；否则签发 `role=ADMIN` 的 token；失败返回 401。
   - v0 只 seed 出 ADMIN 登录；staff 的密码登录可作为 v1 扩展。

3) `GET /me`：

   - 解析 token（401/403 同里程碑 2 的 helper），根据 sub 查 user 与 roles，返回 OpenAPI `User`。
   - `User.roles` 返回该用户拥有的完整角色列表（不是 token 的“当前 role”单值），以便客户端做角色切换（后续 v1）。
   - `User.userType` 由 token 的当前 role 推导，体现“本次登录选择的身份”。

4) `GET /me/sales-qr-code`（sales only）：

   - 要求 token 当前 role=SALES（403 其他角色）。这里用的是 JWT 的单值 `role` claim（与 commerce 兼容）。
   - 生成 `scene`：必须是无状态字符串，包含 `salesUserId` 与 `exp`（默认 7 天），并用 HMAC 签名，避免伪造。
   - 生成 `qrCodeUrl`：
     - v0 dev/mock：用二维码库生成 PNG（内容可为 `scene=<scene>` 或 `tmo://bind?scene=<scene>`），再 base64 编码为 data URL（`data:image/png;base64,...`）。
     - 若配置 weapp 平台凭证：长线可切换为微信小程序码（`getwxacodeunlimit`），同样以 data URL 返回。
   - 返回 `expiresAt`：必须返回 exp 的 RFC3339 时间（scene 有过期）。

为每个端点补齐单测（httptest）与必要的集成测（依赖 `IDENTITY_DB_DSN` 时才运行，未设置则跳过），避免“能跑但行为不可信”。

### 里程碑 5：gateway-bff 最小聚合（单 baseUrl）

目标是让前端只配置一个 baseUrl（`http://localhost:8080`），所有请求都先到网关，由网关按 path 转发到下游。

实现约束：

1) gateway-bff 不校验 JWT，只透传 `Authorization`。下游（identity/commerce）仍按各自 secret/issuer 校验。

2) gateway-bff 必须保留 `X-Request-ID`（若客户端未传，则由 gateway 的 `httpx.RequestID()` 生成并下发；下游会复用该 header）。

3) 反向代理规则（不加 /v1 前缀，不做裁剪）：

   - `/auth/*` 与 `/me*` -> identity（默认 `http://localhost:8081`）
   - 其余路径 -> commerce（默认 `http://localhost:8082`）

4) gateway-bff 自己提供：

   - `GET /health`：恒 200 `OK`
   - `GET /ready`：并行检查 identity `/ready` 与 commerce `/ready`，都 200 才返回 200；否则 503（ErrorResponse）

### 里程碑 6：脚本与文档（让新人可复现）

参考 `tools/scripts/commerce-*.sh`，新增 identity 与 gateway 对应脚本并把命令固化（以“走网关验证”为准）：

1) identity 侧脚本：

   - `tools/scripts/identity-generate.sh`：生成 sqlc 与 oapi-codegen 输出。
   - `tools/scripts/identity-migrate.sh`：应用迁移（Go runner，无需 goose 安装）。
   - `tools/scripts/identity-seed.sh`：写入 dev 数据（admin/sales 以及必要的 mock identity 绑定）。
   - `tools/scripts/identity-bootstrap.sh`：启动 Postgres（复用 `infra/dev/docker-compose.yml`），创建 identity 数据库（若不存在），迁移 + seed。

2) gateway 侧脚本（最少一个 verify；可选 run）：

   - `tools/scripts/gateway-verify.sh`：用 curl 通过 `http://localhost:8080` 验证 login -> /me -> /me/sales-qr-code；并验证网关 /ready。

3) 文档更新：

   - 更新 `services/identity/README.md`：写清楚 ports、env vars、mock 登录约定、以及 role 选择 409 的处理方式。
   - 更新 `services/gateway-bff/README.md`：写清楚上游地址配置、代理规则、如何本地启动与验证。

### 里程碑 7：前端逻辑层（miniapp）与 token key 统一（baseUrl=网关）

v0 的前端目标不是做 UI，而是让“登录态”在代码层面可用且不漂移，并且默认走网关单 baseUrl：

1) 修改 `packages/commerce-services` 的默认 token storage key 为全局 key（例如 `tmo:auth:accessToken`），并提供向后兼容的读取逻辑（优先读新 key，读不到再读旧 key `tmo:commerce:token`）。

2) 新增 `packages/identity-api-client`（orval 生成 identity client/types）。该包可以继续复用与 `@tmo/api-client` 相同风格的 runtime/requester，但不得与 `@tmo/api-client` 共享同一个全局配置变量，以避免未来绕过网关直连时出现覆盖；在当前网关单 baseUrl 前提下，两者都指向 `http://localhost:8080`。

3) 新增 `packages/identity-services`（业务逻辑层），依赖 `packages/identity-api-client`：

   - `createIdentityServices({ baseUrl, devToken?, tokenStorageKey?, requester? })`
   - `auth.miniLogin({ platform, scene?, role? })`：内部调用 `@tmo/platform-adapter.login()` 获取 code，再调用 `/auth/mini/login`，并把返回的 `accessToken` 写入 token store；当收到 409 且 details.availableRoles 存在时，向上抛出“需要选择角色”的结构化错误，让 UI 决定怎么选（v0 可先不做 UI）。
   - `me.get()`、`me.getSalesQrCode()`：分别调用 `/me` 与 `/me/sales-qr-code`。

4) 在 `apps/miniapp` 做薄接入（不做 UI 大改）：

   - 新增 `apps/miniapp/src/services/identity.ts`，初始化 identityServices（读取 `TARO_APP_API_BASE_URL`，与 commerce 同一个 baseUrl，指向网关 :8080）。
   - 保留 `apps/miniapp/src/services/commerce.ts` 现有结构；只要把 `TARO_APP_COMMERCE_BASE_URL` 设置为网关地址即可（v0 不强制改代码）。
   - 在 app 启动阶段（`apps/miniapp/src/app.ts`）增加“恢复登录态”的最小逻辑：若本地已有 token，则先调用 `/me`；若 401，则触发一次 miniLogin（或留一个手动触发入口用于调试）。
   - 确保 TypeScript 检查通过（至少 `pnpm -C apps/miniapp lint` + `tsc --noEmit`）。

### 里程碑 8：identity 发 token -> commerce 验 token（通过网关访问）

把 commerce 的鉴权开关打开，并与 identity 共享 JWT secret/issuer，证明“身份域发 token、业务域验 token”的最小闭环成立。由于本计划已确认 `ownerSalesUserId` 由 identity 通过 JWT 下发给 commerce，以及必须补齐 OWNED/SELF RBAC，本里程碑还需要对 commerce 做最小修复以避免越权与缺失归属快照：

1) 在 `services/commerce/internal/http/middleware/auth.go` 扩展 JWT claims 解析：

   - 继续支持既有字段：`sub`（userID）与 `role`（当前 role）。
   - 新增可选字段：`ownerSalesUserId`（UUID 字符串）。解析失败时应返回 401（invalid token）。
   - 该字段在 token 中可以缺失；缺失时在 Claims 中用 `uuid.Nil` 表示“未绑定”。

2) 在 `services/commerce/internal/http/handler/orders.go` 下单时写入 owner 快照：

   - 当当前 role= CUSTOMER 时，从 claims 读取 `ownerSalesUserId`，若非 `uuid.Nil` 则写入 `orders.owner_sales_user_id`（作为下单时刻快照）。
   - 这一步是为了满足 `docs/需求文档.md` 的“客户扫码归属业务员后，后续下单计入该业务员下面”，以及 `docs/rbac.md` 的 OWNED scope 查询基础。

3) 补齐 orders 的 OWNED/SELF RBAC（最小必做）：

   - `GET /orders`：当 role=SALES 时必须默认过滤 `owner_sales_user_id = <sales user id>`（不允许读到 NULL owner 或其他 sales 的订单）；当 role=CUSTOMER 时必须只读自己的订单（现状已满足，但需加测试锁住）。
   - `GET /orders/{orderId}`：当 role=SALES 时必须要求 `order.owner_sales_user_id` 非 NULL 且等于当前 sales user id，否则返回 404（not_found）；不能因为 owner_sales_user_id 为 NULL 而放行。

完成上述修复后，再执行联调验证。

1) 启动 commerce 时设置：

   - `COMMERCE_HTTP_ADDR=":8082"`
   - `COMMERCE_AUTH_ENABLED=true`
   - `COMMERCE_JWT_SECRET=<same as IDENTITY_JWT_SECRET>`
   - `COMMERCE_JWT_ISSUER=<same as IDENTITY_JWT_ISSUER>`

2) 启动 gateway-bff 指向：

   - identity base url: `http://localhost:8081`
   - commerce base url: `http://localhost:8082`

3) 用 identity 登录拿到 customer token 后，通过网关调用 commerce 的 `GET /catalog/categories`、`POST /cart/items` 等接口，验证不会 401 且行为与 v0 commerce 一致。

4) 归属与 OWNED 验证（推荐写入 `tools/scripts/gateway-verify.sh` 或新增更聚焦的 `tools/scripts/gateway-verify-rbac.sh`）：

   - 用 sales 身份登录拿到 token，调用 `/me/sales-qr-code` 获取 scene。
   - 用 customer 身份登录（携带 scene）拿到 token（应在 token 中带 `ownerSalesUserId=<salesUserId>`）。
   - 用 customer token 提交一笔订单（通过网关调用 commerce `/orders`），然后：
     - 用 sales token 调用 commerce `GET /orders`（经网关）应能看到该订单。
     - 用另一个 sales token（不同用户）调用 `GET /orders` 不应看到该订单；调用 `GET /orders/{orderId}` 返回 404。

## Concrete Steps

以下命令假设从仓库根目录执行（`/Users/lifuyue/Documents/tmo`）。每一步都应可重复执行；如果某步失败，先按本计划的 “Idempotence and Recovery” 处理，再继续。

1) 启动本地 Postgres 并准备 commerce 数据（用于网关 /ready 与后续联调）：

    bash tools/scripts/commerce-bootstrap.sh

2) 创建 identity 数据库（若不存在）。如果本机有 `psql`，推荐：

    psql "postgres://commerce:commerce@localhost:5432/commerce?sslmode=disable" -c "CREATE DATABASE identity OWNER commerce;"

   如果本机没有 `psql`，则用 docker exec（容器名固定为 `tmo-postgres`）：

    docker exec -i tmo-postgres psql -U commerce -d commerce -c "CREATE DATABASE identity OWNER commerce;"

3) 生成 identity 代码（sqlc + oapi-codegen；实施后应存在脚本）：

    bash tools/scripts/identity-generate.sh

4) 迁移与 seed（实施后应存在脚本）：

    bash tools/scripts/identity-migrate.sh
    bash tools/scripts/identity-seed.sh

5) 启动 commerce（注意端口改为 :8082，避免与 gateway 冲突）：

    (cd services/commerce && COMMERCE_HTTP_ADDR=":8082" go run ./cmd/commerce)

   （里程碑 8 需要鉴权时，用下面这一组 env 重新启动 commerce；secret/issuer 必须与 identity 一致）：

    (cd services/commerce && \
      COMMERCE_HTTP_ADDR=":8082" \
      COMMERCE_AUTH_ENABLED=true \
      COMMERCE_JWT_SECRET="<same as IDENTITY_JWT_SECRET>" \
      COMMERCE_JWT_ISSUER="<same as IDENTITY_JWT_ISSUER>" \
      go run ./cmd/commerce)

6) 启动 identity：

    (cd services/identity && IDENTITY_HTTP_ADDR=":8081" IDENTITY_DB_DSN="postgres://commerce:commerce@localhost:5432/identity?sslmode=disable" go run ./cmd/identity)

7) 启动 gateway-bff（实施后应存在入口；默认监听 :8080）：

    (cd services/gateway-bff && GATEWAY_HTTP_ADDR=":8080" GATEWAY_IDENTITY_BASE_URL="http://localhost:8081" GATEWAY_COMMERCE_BASE_URL="http://localhost:8082" go run ./cmd/gateway-bff)

8) Smoke 验证（走网关；实施后应存在脚本）：

    bash tools/scripts/gateway-verify.sh

9) 后端测试：

    bash tools/scripts/test-backend.sh

10) 前端类型与 lint（里程碑 7 后）：

    pnpm -C apps/miniapp lint
    pnpm -C apps/miniapp exec tsc -p tsconfig.json --noEmit

## Validation and Acceptance

以“行为可见”为验收标准（这部分必须在实现过程中持续补齐，避免只写代码不验证）：

1) 网关服务存活与就绪（主验收入口）：

   - `GET http://localhost:8080/health` 返回 200，body 为 `OK`。
   - `GET http://localhost:8080/ready` 在 identity 与 commerce 都就绪时返回 200；任一未就绪时返回 503（ErrorResponse）。

2) identity 自检（辅助定位；非前端入口）：

   - `GET http://localhost:8081/health` 返回 200，body 为 `OK`。
   - `GET http://localhost:8081/ready` 在数据库可用时返回 200；数据库不可用时返回 503（ErrorResponse）。

3) customer mini login（dev/mock，经由网关）：

   - 调用 `POST http://localhost:8080/auth/mini/login`（platform=weapp，code=mock_customer_001）返回 200，JSON 包含 `accessToken`、`expiresIn`、`user`；`user.userType=customer` 且 `roles` 至少包含 `CUSTOMER`。
   - `expiresIn` 约等于 7 天（推荐固定为 604800 秒）。
   - 用该 token 调用 `GET http://localhost:8080/me` 返回 200，`id` 与登录返回一致。

4) password login（经由网关；仅 ADMIN）：

   - seed 后，调用 `POST http://localhost:8080/auth/password/login`（username/password 为 README 约定的 dev 值）返回 200；`user.userType=admin` 且 `roles` 包含 `ADMIN`。
   - 错误密码返回 401（ErrorResponse）。
   - 显式传 `role` 但不是 `ADMIN` 时返回 400（invalid_request）。

5) 多角色选择登录（409 冲突，经由网关；在 mini login 上验证）：

   - seed 一个“多角色用户”，角色至少包含 `CUSTOMER` 与 `SALES`，并为该用户绑定一个可用的 mini identity（例如 provider=weapp，provider_user_id=mock_multi_001）。
   - 验证：
     - `POST http://localhost:8080/auth/mini/login`（platform=weapp，code=mock_multi_001）不带 role 时返回 409，ErrorResponse.details.availableRoles 至少包含 `CUSTOMER` 与 `SALES`（且不包含 `ADMIN`）。
     - 再次调用同接口，显式带 `role: "SALES"` 时返回 200；随后 `GET http://localhost:8080/me` 返回 `userType=staff`。
     - 再次调用同接口，显式带 `role: "CUSTOMER"` 时返回 200；随后 `GET http://localhost:8080/me` 返回 `userType=customer`。

6) sales QR code（经由网关）：

   - 用 sales 身份登录并调用 `GET http://localhost:8080/me/sales-qr-code` 返回 200，包含 `scene` 与 `qrCodeUrl`（非空），`expiresAt` 非空且晚于当前时间。
   - 用 customer token 调用同接口返回 403（ErrorResponse）。
   - 用 customer 登录携带 `scene`（`POST /auth/mini/login` requestBody.scene）时，仅在首次绑定写入 ownerSalesUserId；再次传不同 scene 不覆盖（用查询或日志/audit 证据验证）。

7) commerce 联调（里程碑 8）：

   - 开启 commerce 鉴权后，用 identity 签发的 customer token 通过网关调用 `GET http://localhost:8080/catalog/categories` 等端点不应 401。
   - 归属快照与 OWNED 验收（必须通过）：
     - 用 sales token 拿到 `scene`，再用 customer 登录携带该 scene，提交一笔订单。
     - 用该 sales token 调用 `GET http://localhost:8080/orders` 必须能看到这笔订单（证明 `orders.owner_sales_user_id` 已写入且 OWNED filter 生效）。
     - 用另一个 sales token 调用 `GET http://localhost:8080/orders` 不应看到该订单；调用 `GET http://localhost:8080/orders/{orderId}` 返回 404（证明未越权）。

## Idempotence and Recovery

1) migrations 与 seed 必须可重复执行：

   - migrations 文件应使用 `CREATE TABLE IF NOT EXISTS`、`CREATE INDEX IF NOT EXISTS` 等保证幂等；或通过“版本号 + 不可逆更改”保证不会重复创建同名对象。
   - seed 应使用 upsert 或先查再插，避免重复插入导致唯一键冲突；若发生冲突，应提供 `IDENTITY_SEED_RESET=true` 的安全重置路径（例如仅清理 identity 表，不影响 commerce 数据库）。

2) 生成代码可重复执行：

   - `identity-generate.sh` 应先 clean 生成目录（sqlc/oapi-codegen 输出），并在 README 明确“不要手改生成文件”。

3) 数据库恢复：

   - 本地开发需要完全重置时，优先使用 “drop identity database + recreate + migrate + seed”，避免误伤 commerce：

        docker exec -i tmo-postgres psql -U commerce -d commerce -c "DROP DATABASE IF EXISTS identity;"
        docker exec -i tmo-postgres psql -U commerce -d commerce -c "CREATE DATABASE identity OWNER commerce;"

4) Token/secret 轮换（v0 先留扩展点）：

   - v0 使用单一 HMAC secret。长线要支持 key rotation（多把有效 key），因此实现时应把“签发 key”与“验签 key 集合”配置化，而不是写死一把。

## Artifacts and Notes

1) 建议的 identity 环境变量（v0）：

    IDENTITY_HTTP_ADDR=":8081"
    IDENTITY_DB_DSN="postgres://commerce:commerce@localhost:5432/identity?sslmode=disable"
    IDENTITY_LOG_LEVEL="info"
    IDENTITY_JWT_SECRET="dev-secret"
    IDENTITY_JWT_ISSUER="tmo-identity"
    IDENTITY_ACCESS_TOKEN_TTL="168h"
    IDENTITY_WEAPP_APPID=""           # 空则走 dev/mock
    IDENTITY_WEAPP_APPSECRET=""       # 空则走 dev/mock

2) 建议的 gateway 环境变量（v0）：

    GATEWAY_HTTP_ADDR=":8080"
    GATEWAY_IDENTITY_BASE_URL="http://localhost:8081"
    GATEWAY_COMMERCE_BASE_URL="http://localhost:8082"

3) 建议的 commerce 环境变量（用于本计划本地联调）：

    COMMERCE_HTTP_ADDR=":8082"
    COMMERCE_AUTH_ENABLED=true
    COMMERCE_JWT_SECRET="<same as IDENTITY_JWT_SECRET>"
    COMMERCE_JWT_ISSUER="<same as IDENTITY_JWT_ISSUER>"

4) JWT claim 约定（v0）：

   - `sub`：当前用户 ID（UUID 字符串）。
   - `role`：当前会话选择的系统角色（单值；与 commerce middleware 兼容）。
   - `ownerSalesUserId`：仅当当前 role=CUSTOMER 且已绑定业务员时存在（UUID 字符串）；用于 commerce 下单写入 `orders.owner_sales_user_id` 快照。

5) dev/mock 登录约定（建议写入 README 并在代码里严格校验）：

   - customer：code 形如 `mock_customer_001`
   - sales staff：code 形如 `mock_sales_001`（seed 时将该 provider_user_id 绑定到 SALES 用户）

6) curl 示例（实现后应被 `gateway-verify.sh` 覆盖，而不是靠手工记忆）：

    curl -sS http://localhost:8080/health

    curl -sS -X POST http://localhost:8080/auth/mini/login \
      -H 'Content-Type: application/json' \
      -d '{"platform":"weapp","code":"mock_customer_001"}'

    curl -sS http://localhost:8080/me \
      -H 'Authorization: Bearer <accessToken>'

7) 重要的“范围边界”提醒：

   - v0 不实现完整 permission codes 与 scope 评估，不实现用户管理后台，不实现跨服务审计聚合；但 schema/代码结构必须为这些保留扩展点（例如 audit_logs 表与插入函数）。

## Interfaces and Dependencies

为了减少分叉与“想当然”，这里明确规定最终应存在的关键接口/文件与依赖选择。

### Go（identity 服务）

依赖与原因：

1) Gin：与 commerce 对齐，且 `packages/go-shared/httpx` 已封装 router/server。

2) `github.com/oapi-codegen/oapi-codegen/v2`：从 OpenAPI 生成 handler interface 与 types（与 commerce 对齐）。

3) Postgres/pgx + sqlc：与 commerce 对齐；避免手写 SQL 漂移。

4) `github.com/golang-jwt/jwt/v5`：与 commerce 使用同一 JWT 库，减少 claim 解析差异。

5) `golang.org/x/crypto/bcrypt`：密码 hash（admin 登录）。

6) `github.com/skip2/go-qrcode`（或同等纯 Go 库）：生成 dev/mock QR PNG，避免额外静态资源服务。

必须存在的 Go 文件（路径固定）：

1) `services/identity/cmd/identity/main.go`：服务入口。

2) `services/identity/internal/config/config.go`：读取 env（命名遵循 `IDENTITY_*`）。

3) `services/identity/internal/http/server.go`：`NewRouter` 注册 `/health`、`/ready`、并 `oapi.RegisterHandlers(router, handler)`。

4) `services/identity/internal/http/handler/handler.go`：聚合依赖（db、auth、logger）。

5) `services/identity/internal/http/oapi/api.gen.go`：生成文件（不可手改）。

6) `services/identity/internal/auth/jwt.go`：签发/解析 token。

7) `services/identity/sqlc.yaml`、`services/identity/migrations/*.sql`、`services/identity/queries/*.sql`：数据层输入。

错误响应必须遵守 OpenAPI `ErrorResponse`（`code/message/requestId/details?`），建议直接复用 `packages/go-shared/errors.Write`。

### Go（gateway-bff 服务）

依赖与原因：

1) Gin：与其他服务对齐，便于复用 `packages/go-shared/httpx` 的 request-id/日志/恢复中间件。

2) `net/http/httputil`：Go 标准库反向代理，实现“按 path 转发到上游”的最小聚合。

必须存在的 Go 文件（路径固定）：

1) `services/gateway-bff/cmd/gateway-bff/main.go`：服务入口（监听 `GATEWAY_HTTP_ADDR`，默认 `:8080`）。

2) `services/gateway-bff/internal/config/config.go`：读取 env（`GATEWAY_*`）。

3) `services/gateway-bff/internal/http/server.go`：`NewRouter` 注册 `/health`、`/ready`，以及反向代理路由。

4) `services/gateway-bff/internal/http/proxy.go`：封装“按规则选择上游 + 透传 headers/body”的代理逻辑，并确保 `Authorization` 与 `X-Request-ID` 透传。

### TypeScript（miniapp 逻辑层）

依赖与原因：

1) `@tmo/platform-adapter`：统一 wx/my 的 login/request/storage，避免业务层直接依赖平台对象。

2) `orval`（已有）：生成 typed client，减少手写漂移；identity 与 commerce 生成物分包，避免命名冲突。

3) `packages/*-services`：将“交互逻辑/状态机/缓存与 token 存储”沉淀到 workspace 包，`apps/miniapp` 保持薄接入。

必须存在的 TS 文件（路径固定）：

1) `apps/miniapp/src/services/identity.ts`：identity services 初始化入口（类似 `apps/miniapp/src/services/commerce.ts`）。

2) `packages/identity-services/src/index.ts`（新增）：对外暴露 `createIdentityServices`。

3) `packages/identity-api-client/*`（新增）：identity 的 orval 配置与生成产物（例如 `packages/identity-api-client/orval.config.ts`、`packages/identity-api-client/src/generated/identity.ts`）。

4) `packages/commerce-services/src/config.ts`（修改）：默认 token storage key 改为全局 key，并保留旧 key fallback。

本计划采用 gateway 统一 baseUrl（`http://localhost:8080`），因此前端在 v0 阶段可以把 `@tmo/api-client` 与 `packages/identity-api-client` 都配置为同一个 baseUrl；但两者仍应保持配置隔离（避免未来出现“一个包 setConfig 覆盖另一个包”的隐蔽问题）。

## Plan Revision Notes

(2026-01-23) 根据新增确认的技术抉择更新本计划：把 `services/gateway-bff` 纳入 v0 交付并定义代理规则（单 baseUrl、网关不校验 JWT、端口 8080/8081/8082、无 /v1 前缀）；补充“多角色选择登录”的合约变更与 409 details 约定；并将 access token TTL 与 sales scene 过期时间统一为 7 天。这些变更的目的都是减少前端联调复杂度（单 baseUrl）并保持与现有 commerce 鉴权解析兼容（JWT 单值 role claim）。

(2026-01-23) 根据新增确认的身份模型更新本计划：允许同一用户跨 `userType` 持有角色（例如 `ADMIN` + `SALES`），并规定 `User.userType` 由“当前 token 的 role”推导；同时收紧登录入口：`/auth/password/login` 仅用于 `ADMIN`，`/auth/mini/login` 禁止选择 `ADMIN` 且在 409 availableRoles 中过滤 `ADMIN`。这些变更的目的都是在不修改 commerce 鉴权 middleware 的前提下支持“多身份切换”，同时保持管理员入口不经由小程序路径暴露。

(2026-01-23) 根据新增确认的实现细节更新本计划：`users.user_type` 仍落库但只作为“创建来源/默认类型”，不作为鉴权依据；前端 identity OpenAPI 生成物独立拆包为 `packages/identity-api-client` 以避免与 `@tmo/api-client` 命名冲突；并把 OpenAPI 公共 schema 的同步范围扩大到 `contracts/openapi/*.yaml` 全量文件（identity/openapi/commerce/admin/payment/ai），一次性消除“同名 schema 在不同文件含义不一致”的长期隐患。

(2026-01-23) 根据新增确认的联调与安全要求更新本计划：identity 在 customer token 中增加 `ownerSalesUserId` claim，commerce 下单时写入 `orders.owner_sales_user_id` 作为归属快照；并规定在启用 commerce 鉴权的同一里程碑内必须修复 orders 的 OWNED/SELF RBAC（避免 SALES 越权读取与 NULL owner 放行）。

(2026-01-23) 执行里程碑 0：新增 identity Go module 骨架、health/ready 与 db pool，并把 identity 加入 go.work；完成 go mod tidy 与 `go test ./...` 验证。

(2026-01-23) 执行里程碑 1：新增 identity migrations/sqlc queries、迁移/seed/生成脚本与命令，运行 sqlc 生成并通过 `go test ./...`。

(2026-01-23) 执行里程碑 2：新增 JWT 配置与 TokenManager（签发/解析），并接入 handler 依赖注入；完成 `go test ./...`。

(2026-01-23) 执行里程碑 3：为 auth 登录增加 role 字段与 409 冲突说明，并同步多份 OpenAPI 公共 schema。

(2026-01-23) 执行里程碑 4：生成 identity oapi 代码并实现 auth/me handlers、platform resolver 与 sales QR code 返回；完成 `go test ./...`。

(2026-01-23) 补充里程碑 4：新增 identity handler 集成测试（无 `IDENTITY_DB_DSN` 时跳过），覆盖 login/me/qr 关键路径。

(2026-01-23) 执行里程碑 5：新增 gateway-bff 代码结构（config/http/proxy/ready/main），注册 health/ready 与反向代理路由，完成 go mod tidy 与 `go test ./...`。

(2026-01-23) 执行里程碑 6：新增 dev-bootstrap 与 gateway-verify 脚本，更新 identity/gateway README 与 scripts 说明。

(2026-01-23) 执行里程碑 7：新增 identity TS client/services、统一 token key，并完成 miniapp 薄接入。

(2026-01-23) 执行里程碑 8：commerce 解析 ownerSalesUserId claim、下单写入 owner 快照，并补齐 orders OWNED/SELF RBAC。
