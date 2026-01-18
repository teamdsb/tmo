# 公共轮（共享包）规划

这是一个活文档。`Progress`、`Surprises & Discoveries`、`Decision Log`、`Outcomes & Retrospective` 这四个部分在实施过程中必须持续更新。

本计划必须遵循仓库内 `docs/execplans/PLANS.md` 的要求和格式。

## Purpose / Big Picture / 目的与总览

本计划的 MVP 聚焦 Go 共享中间件：在 `packages/go-shared` 下提供可复用的配置、HTTP/Gin 中间件、错误标准化、数据库连接与可观测性能力，并首先在 `services/commerce` 落地，从而把 commerce 提升到可投产的最低标准。TS 共享包（DTO、OpenAPI 客户端、平台适配）作为 Phase 2 记录在计划中，但不作为 MVP 实施目标。

验收以“可投产最低标准”为主：commerce 的 `/health` 仅表示存活，`/ready` 反映数据库就绪；请求具备 request-id、错误响应结构统一、日志具备请求级上下文，并保持现有业务接口行为不回退。

## Progress

- [x] (2026-01-18 14:52Z) 完成仓库调研并准备公共轮 ExecPlan 框架。
- [x] (2026-01-18 15:02Z) 明确 MVP 范围：Go 共享中间件 + commerce 接入，TS 共享包为 Phase 2。
- [x] (2026-01-18 16:11Z) 明确 `packages/go-shared` 目录结构、API 边界与依赖，并记录到 Decision Log。
- [x] (2026-01-18 16:11Z) 实现 Go 共享中间件（request-id、access log、recovery、统一错误、DB 连接、readiness、优雅停机、OTel）。
- [x] (2026-01-18 16:11Z) 在 `services/commerce` 完成替换接入，补齐 `/health` 与 `/ready`，并保留业务行为。
- [x] (2026-01-18 16:23Z) 补齐文档、测试/校验脚本与 CI 入口（更新 packages/go-shared 与 commerce README、扩展 test-backend 脚本与 commerce-ci）。
- [ ] (2026-01-18 15:02Z, Phase 2) 为 `packages/shared`、`packages/openapi-client`、`packages/platform-adapter` 建立 TS 包结构并接入 appvx/appali。

## Surprises & Discoveries

- Observation: `packages/` 下已有 `go-shared`、`shared`、`openapi-client`、`platform-adapter` 目录，但仅有 README，无实际代码或包配置。
  Evidence: `find packages -maxdepth 2 -type f` 仅返回 README。
- Observation: `go.work` 目前只包含 `services/commerce`，共享 Go module 尚未纳入。
  Evidence: `go.work` 内容只有 `use ./services/commerce`。
- Observation: Gin 的使用目前仅出现在 commerce 服务。
  Evidence: `services/commerce/internal/http/server.go` 使用 `github.com/gin-gonic/gin`。
- Observation: `pnpm-workspace.yaml` 已包含 `packages/*`，前端共享包可以直接作为 workspace package。
  Evidence: `pnpm-workspace.yaml` 包含 `packages/*`。
- Observation: `go mod tidy` 在 `services/commerce` 中未按 `go.work` 解析本地 `packages/go-shared`，需要显式 `replace` 指向本地路径才能继续。
  Evidence: `go mod tidy` 报错提示 `module github.com/teamdsb/tmo@latest ... does not contain package github.com/teamdsb/tmo/packages/go-shared/...`。

## Decision Log

- Decision: 复用现有目录并建立 Go/TS 共享包的正式工程结构，Go 模块名采用 `github.com/teamdsb/tmo/packages/go-shared`，TS 包名采用 `@tmo/shared`、`@tmo/openapi-client`、`@tmo/platform-adapter`。
  Rationale: 与当前 `services/commerce` 的模块命名风格一致，且便于 pnpm workspace 引用。
  Date/Author: 2026-01-18 (Codex)
- Decision: Go 共享包覆盖配置、HTTP/Gin 中间件、错误标准化、数据库连接与观测能力；TS 共享包（DTO、校验器、OpenAPI 客户端、平台适配）作为 Phase 2 规划。
  Rationale: MVP 先满足服务端可投产最低标准，前端复用能力延后以降低首轮投入。
  Date/Author: 2026-01-18 (Codex)
- Decision: 先在 `services/commerce` 试点接入 Go 共享包；TS 共享包 Phase 2 再接入 `apps/appvx` 与 `apps/appali`。
  Rationale: commerce 是当前唯一可运行的服务，先稳定后端能力再推进前端共享包。
  Date/Author: 2026-01-18 (Codex)
- Decision: MVP 仅覆盖 Go 共享中间件并在 commerce 试点接入，TS 共享包作为 Phase 2 规划。
  Rationale: 以可投产最低标准为目标，先确保服务端具备可复用的基础能力。
  Date/Author: 2026-01-18 (Codex)
- Decision: commerce 作为业务服务，鉴权由 gateway-bff 统一处理；commerce 仅校验来自网关的内部标识（或在未启用网关时跳过）。
  Rationale: 避免在单服务重复实现鉴权，同时保持内网可控调用路径。
  Date/Author: 2026-01-18 (Codex)
- Decision: readiness 独立于 liveness，`/health` 仅表示进程存活，`/ready` 需要验证数据库连接与关键依赖。
  Rationale: 生产环境下需要准确区分“存活”与“可服务”。
  Date/Author: 2026-01-18 (Codex)
- Decision: Go 版本使用最新稳定版（CI 使用 setup-go stable），不固定在 1.22。
  Rationale: 避免因固定版本错过安全与性能修复，同时与依赖的最新版本兼容。
  Date/Author: 2026-01-18 (Codex)
- Decision: OTel 采用标准环境变量驱动（支持 OTLP gRPC / HTTP，根据 `OTEL_EXPORTER_OTLP(_TRACES)_PROTOCOL` 自动选择），仅在显式配置端点/协议/导出器时启用，并通过 `otelgin` 注入 Gin 请求链路。
  Rationale: 兼容主流 Collector 配置与现有环境变量规范，避免未配置时无意义的导出开销。
  Date/Author: 2026-01-18 (Codex)
- Decision: 在 `services/commerce/go.mod` 增加 `replace github.com/teamdsb/tmo/packages/go-shared => ../../packages/go-shared`，以确保 `go mod tidy`/`go test` 在本地解析共享模块。
  Rationale: 解决 go tooling 未按 workspace 解析本地嵌套模块导致的解析失败。
  Date/Author: 2026-01-18 (Codex)
- Decision: 扩展 `tools/scripts/test-backend.sh` 以覆盖 `packages/go-shared`，并在 `commerce-ci` 中新增 go-shared 测试与路径触发规则。
  Rationale: 共享包变更需要在本地与 CI 中被稳定验证，避免只测 commerce 服务导致的回归。
  Date/Author: 2026-01-18 (Codex)

## Outcomes & Retrospective

已完成 `packages/go-shared` 共享模块落地并接入 `services/commerce`：新增 request-id、统一错误、readiness、OTel 初始化与优雅停机等能力，`/health` 与 `/ready` 已接入；`go test ./...` 已验证编译通过。文档、测试脚本与 CI 入口已补齐。

## Context and Orientation / 背景与现状

仓库已有共享包占位目录 `packages/go-shared`、`packages/shared`、`packages/openapi-client`、`packages/platform-adapter`，但没有实际代码或模块配置。Go 服务目前只有 `services/commerce` 可运行，Gin（Go 的 HTTP 框架）在 `services/commerce/internal/http/server.go` 里用于路由与中间件。本轮目标是先在 `packages/go-shared` 落地共享中间件并接入 `services/commerce`，以满足可投产最低标准；TS 共享包属于 Phase 2。前端是 Taro 4 的小程序项目，位于 `apps/appvx` 与 `apps/appali`，workspace 管理由 `pnpm-workspace.yaml` 控制，已包含 `packages/*`。

本文中的“公共轮子/共享包”指复用的基础能力模块，例如配置读取、错误模型、HTTP 中间件、数据库连接、观测（日志、指标、追踪）。DTO 是“数据传输对象”，即在接口和前端之间共享的数据结构。平台适配指统一不同小程序平台（如微信与支付宝）在登录、支付、文件等能力上的调用差异。

## Plan of Work / 工作计划

第一步（MVP 基础）是明确 `packages/go-shared` 的目录结构、命名与依赖边界，并在仓库中落地 Go 共享模块框架。Go 共享包包含 `config/`、`httpx/`、`errors/`、`db/`、`observability/` 等基础目录，创建 `go.mod` 并加入 `go.work`。Go 版本以最新稳定版为准，不固定在 1.22。

第二步（MVP 能力）是实现共享中间件与基础能力：request-id（读取或生成并回写响应头）、access log（含耗时、状态码、request-id）、recovery（panic 转 500）、统一错误响应（结构化 JSON）、pgxpool 连接池与 readiness 检查、优雅停机（signal + context）、日志初始化（slog）以及可选的 OTel 初始化。API 边界仅覆盖通用能力，不引入业务类型。

第三步（MVP 接入）是在 `services/commerce` 完成替换接入：配置加载、日志初始化、数据库连接、Gin 路由与中间件全部切换到 `packages/go-shared`。新增 `/health`（仅存活）与 `/ready`（依赖 DB 就绪），并确保错误响应结构统一、请求响应具备 request-id。鉴权假设维持 gateway-bff 统一处理，commerce 只校验内部标识（未启用网关时允许跳过）。

第四步（质量与发布）补齐测试、lint、CI 与文档。为 `packages/go-shared` 和 commerce 增加单测/集成测试，纳入 lint/test/CI（可包含覆盖率与 race 检查），更新 `packages/README.md` 与共享包 README，明确接入方式、运行命令与验收标准。

Phase 2：为 `packages/shared`、`packages/openapi-client`、`packages/platform-adapter` 建立 TS 包结构与脚本，后续在 `apps/appvx` 与 `apps/appali` 接入。

## Concrete Steps / 具体步骤

从仓库根目录确认共享包与 commerce 现状：

    ls packages
    find packages -maxdepth 2 -type f
    cat go.work
    rg -n "gin|slog|pgxpool|config" services/commerce

为 Go 共享包创建模块与目录结构，并纳入 `go.work`：

    mkdir -p packages/go-shared/{config,httpx,errors,db,observability}
    (cd packages/go-shared && go mod init github.com/teamdsb/tmo/packages/go-shared)
    go work use ./packages/go-shared
    go work sync

实现共享中间件与基础能力，并补齐单测：

    # request-id、access log、recovery、统一错误、readiness、优雅停机
    # 按 Plan of Work 创建包与测试

在 `services/commerce` 中接入共享包并新增健康检查：

    rg -n "config|logger|db|gin|health|ready" services/commerce
    # 替换为 packages/go-shared 的实现，并新增 /health 与 /ready
    (cd services/commerce && go mod edit -require=github.com/teamdsb/tmo/packages/go-shared@v0.0.0)
    (cd services/commerce && go mod edit -replace=github.com/teamdsb/tmo/packages/go-shared=../../packages/go-shared)

运行构建、测试与 lint：

    (cd packages/go-shared && go mod tidy)
    (cd services/commerce && go mod tidy)
    (cd packages/go-shared && go test ./...)
    (cd services/commerce && go test ./...)
    golangci-lint run ./...
    bash tools/scripts/test-backend.sh

## Validation and Acceptance / 验证与验收

MVP 通过验收需满足：

- `packages/go-shared` 与 `services/commerce` 编译与测试通过，lint 通过（Go 版本使用最新稳定版）。
- `/health` 始终 200 且不依赖外部；`/ready` 在 DB 不可用时返回非 200，在可用时返回 200。
- 请求与响应包含 `X-Request-ID`（若请求未提供则生成），日志包含 request-id、状态码、耗时。
- 错误响应结构统一（code/message/detail），不影响既有成功响应结构。
- 服务可优雅停机：收到 SIGTERM 后停止接入新请求，等待 in-flight 完成并关闭 DB 连接池。
- 文档与 README 说明接入方式、命令与运行要求。

## Idempotence and Recovery / 可重复与恢复

新增的 Go 共享包目录与脚本可重复执行，`go.work` 与模块初始化可回滚。若接入失败，可暂时恢复 commerce 原实现并保留共享包代码，不影响现有服务运行。本轮 MVP 不引入自动生成代码，如后续加入生成产物需补充清理说明。

## Artifacts and Notes / 产物与记录

预期输出示例：

    $ (cd packages/go-shared && go test ./...)
    ok   github.com/teamdsb/tmo/packages/go-shared/httpx  0.00s

    $ curl -i http://localhost:8080/ready
    HTTP/1.1 200 OK

## Interfaces and Dependencies / 接口与依赖

Go 共享包建议暴露以下稳定接口（示例签名，具体实现需与 commerce 行为一致）：

    // packages/go-shared/config
    func String(key, fallback string) string
    func Int(key string, fallback int) int
    func Bool(key string, fallback bool) bool
    func Duration(key string, fallback time.Duration) time.Duration

    // packages/go-shared/httpx
    func NewRouter(opts ...Option) *gin.Engine
    func NewServer(addr string, router http.Handler) *http.Server
    func RequestID() gin.HandlerFunc
    func AccessLog(logger *slog.Logger) gin.HandlerFunc
    func Recovery(logger *slog.Logger) gin.HandlerFunc
    func Health() gin.HandlerFunc
    func Ready(check func(context.Context) error) gin.HandlerFunc

    // packages/go-shared/errors
    type APIError struct {
        Code    string `json:"code"`
        Message string `json:"message"`
        Detail  string `json:"detail,omitempty"`
    }
    func Write(c *gin.Context, status int, err APIError)

    // packages/go-shared/db
    func NewPool(ctx context.Context, dsn string) (*pgxpool.Pool, error)
    func Ready(ctx context.Context, pool *pgxpool.Pool) error

    // packages/go-shared/observability
    type Config struct {
        ServiceName string
        Environment string
        OtelEndpoint string
    }
    func Setup(ctx context.Context, cfg Config, logger *slog.Logger) (shutdown func(context.Context) error, err error)

Phase 2 的 TS 共享包建议采用 workspace package 形式，`packages/shared` 导出 DTO、枚举与校验器；`packages/openapi-client` 提供 OpenAPI 生成脚本与可导入的客户端；`packages/platform-adapter` 导出统一的 `login`、`request`、`pay`、`chooseImage` 接口并在内部根据运行时选择 `wx` 或 `my` 实现。建议使用 `exports` 字段固定 API 面向应用侧的导入路径，并在 `tsconfig` 中开启 `declaration` 以生成类型声明。

## Plan Revision Note

2026-01-18：基于仓库调研创建公共轮 ExecPlan，覆盖 Go 与 TS 共享包的结构、接口与接入路径。
2026-01-18 15:02Z：更新 MVP 目标为 Go 共享中间件 + commerce 接入，补充 readiness、中间件范围与验收标准，TS 共享包为 Phase 2。
2026-01-18 16:11Z：完成 go-shared 落地与 commerce 接入的执行记录，更新进度/决策/发现并补充本地 replace 说明与测试步骤。
2026-01-18 16:23Z：补齐文档、测试脚本与 CI 入口的执行记录，并更新决策与进度。
