# Docker 本次测试前后修改明细

本 ExecPlan 是一个持续更新文档。`Progress`、`Surprises & Discoveries`、`Decision Log`、`Outcomes & Retrospective` 四个章节需要在后续迭代中继续维护。

本文件遵循仓库规范文档 `docs/execplans/plans.md` 的约束，目标是让任何第一次接触仓库的同学，仅凭本文件即可复现本次 Docker 联调整改结果。

## Purpose / Big Picture

本次工作解决的是“本地 Docker 联调路径不稳定”问题。修改前，`make dev-stack-up` 在不同机器上会因为 Go 模块拉取链路不稳定、网关图片代理超时、以及 Docker 构建磁盘空间耗尽而频繁失败，进而导致 `pnpm -C apps/miniapp dev:weapp` 在 preflight 阶段被阻断。修改后，Docker 联调默认走更稳定的参数组合，并提供清晰的失败诊断与重试路径；miniapp preflight 对外部图床不稳定场景具备软失败兜底，主链路可持续联调。

用户可见结果是：执行 `make dev-stack-up` 后，`identity/commerce/payment/gateway-bff/postgres` 五个容器能够稳定就绪，随后执行 `pnpm -C apps/miniapp preflight:weapp` 可以通过，`dev:weapp` 不再因 Docker 后端偶发问题频繁中断。

## Progress

- [x] (2026-03-05 12:20Z) 复盘本次联调失败链路，定位三类主要问题：Go 依赖拉取不稳定、图片代理超时、Docker 构建磁盘耗尽。
- [x] (2026-03-05 12:34Z) 修复 `tools/scripts/dev-bootstrap.sh` 中 identity 建库语句（避免 `CREATE DATABASE cannot be executed from a function`）。
- [x] (2026-03-05 12:45Z) 将 miniapp preflight 默认超时从 30s 提升到 120s，并更新文档。
- [x] (2026-03-05 12:58Z) 修复 gateway 服务端写超时导致的 `curl: (52) Empty reply from server`（将 gateway server 写超时提升到 2 分钟）。
- [x] (2026-03-05 13:08Z) 为 Docker build/runtime 引入稳定 Go 模块参数链路（Compose + Dockerfile + 启动脚本贯通）。
- [x] (2026-03-05 13:12Z) 将 Docker 默认 `GATEWAY_IMAGE_PROXY_TIMEOUT` 调整为 120s。
- [x] (2026-03-05 13:16Z) 为 preflight 增加图片代理软失败开关，默认 preflight 开启，严格模式可显式关闭。
- [x] (2026-03-05 13:19Z) 完成 `make dev-stack-up`、`dev-stack-health`、`pnpm -C apps/miniapp preflight:weapp` 复测通过。

## Surprises & Discoveries

- Observation: `go build` 在 Docker 容器构建阶段偶发 TLS 协议失败（访问 `proxy.golang.org`），并非代码逻辑错误。
  Evidence: `remote error: tls: protocol version not supported` 出现在 `make dev-stack-up` 的镜像构建日志中。

- Observation: gateway 图片代理耗时超过默认写超时时，客户端看到的是 `curl: (52) Empty reply from server`，而不是业务 5xx。
  Evidence: 网关日志显示 `/assets/img` 最终处理时长 30~45s；未修复前客户端连接被提前中断。

- Observation: 只提高“上游请求超时”不足以解决空响应，必须同时提高 HTTP 服务器写超时。
  Evidence: 将 `GATEWAY_IMAGE_PROXY_TIMEOUT` 提高后，仍有空响应；修改 `server.WriteTimeout` 后稳定。

- Observation: Docker 构建失败在本次测试中多次由宿主机/Builder 空间不足引起。
  Evidence: 构建日志大量出现 `no space left on device`，包括 `$WORK/...` 与 Go build cache 写入失败。

## Decision Log

- Decision: Docker 联调默认启用稳定 Go 模块参数 `DEV_STACK_GOPROXY=https://goproxy.cn,direct`、`DEV_STACK_GOSUMDB=off`、`DEV_STACK_GONOSUMDB=*`。
  Rationale: 目标是优先保障本地联调可用性；严格校验链路仍允许通过环境变量覆盖恢复。
  Date/Author: 2026-03-05 / Codex

- Decision: 将 Docker 默认 `GATEWAY_IMAGE_PROXY_TIMEOUT` 提升到 120s。
  Rationale: 外部图床响应抖动明显，10s 在本地网络场景下过于激进。
  Date/Author: 2026-03-05 / Codex

- Decision: `preflight` 默认允许“图片代理失败软通过”（`MINIAPP_HTTP_SMOKE_ALLOW_PROXY_FAILURE=true`），但保留显式严格模式。
  Rationale: preflight 目标应优先验证后端主链路可用，避免外部图床可用性导致开发阻断。
  Date/Author: 2026-03-05 / Codex

- Decision: `make dev-stack-up` 在 `docker compose up` 失败时输出磁盘与重试建议。
  Rationale: 本次真实失败中磁盘不足占比高，脚本需提供可执行恢复路径。
  Date/Author: 2026-03-05 / Codex

## Outcomes & Retrospective

本次整改已将 Docker 联调路径从“依赖个人环境偶然成功”提升为“有默认稳定参数、有明确失败诊断、有可执行恢复步骤”的状态。`make dev-stack-up` 与 miniapp preflight 已在本机复测通过，满足本地联调最低可用性目标。

仍需关注的剩余风险是宿主机 Docker 空间不足，它不是代码问题但会导致构建失败；本次已在文档与脚本中加入提示，后续可考虑增加自动化磁盘阈值检测并在启动前预警。

## Context and Orientation

本次“前后修改明细”覆盖的核心区域如下：

- Docker 启动入口脚本：`tools/scripts/dev-stack-up.sh`
- Docker Compose 配置：`infra/dev/docker-compose.yml`、`infra/dev/docker-compose.backend.yml`、`infra/dev/docker-compose.dev.yml`
- Docker 构建镜像入口：`services/*/Dockerfile` 与 `services/*/Dockerfile.dev`
- miniapp preflight 链路：`apps/miniapp/scripts/preflight-weapp.js`、`tools/scripts/miniapp-http-smoke.sh`
- gateway HTTP 服务超时设置：`services/gateway-bff/internal/http/server.go`
- 文档与示例环境变量：`README.md`、`apps/miniapp/README.md`、`tools/scripts/README.md`、`infra/dev/backend.env.example`

术语说明：

- preflight：前端启动前的“门禁检查”，用于验证关键后端接口与基础资源可用性。
- image proxy：网关对外部图片 URL 的转发代理能力，对应接口 `/assets/img`。
- Air overlay：开发容器热更新模式，使用 `docker-compose.dev.yml` 叠加配置。

## 前后修改明细

修改前，`dev-stack-up` 对 Go 模块拉取链路没有统一稳定默认值，镜像构建直接依赖容器内默认 `proxy.golang.org`，在部分网络环境下会失败。修改后，启动脚本会导出稳定默认值，并通过 Compose 构建参数与运行环境统一传递到所有 backend 服务。

修改前，Docker 路径下 gateway 的图片代理超时默认是 10 秒，且 gateway server 写超时不足，导致在慢图或抖动网络下 preflight 阶段出现 499 或空响应。修改后，Docker 默认图片代理超时提高到 120 秒，gateway server 写超时提高到 2 分钟，避免连接过早断开。

修改前，preflight 对外部图片代理失败采取硬阻断，开发阶段经常被第三方图床波动影响。修改后，preflight 默认对图片代理失败采用软通过（仅 preflight 默认），并保留严格模式可显式关闭，兼顾联调效率与可控性。

修改前，构建失败（尤其磁盘不足）缺乏直接行动提示。修改后，`dev-stack-up` 在 `docker compose up` 失败时会输出 `docker system df`、`docker builder prune -f` 与推荐重试命令。

## Plan of Work

后续若继续演进此方案，建议按以下顺序推进：

先在 `dev-stack-up.sh` 增加 Docker 磁盘预检阈值逻辑（例如可配置的最小可用空间），在启动前提前失败并给出指令；再将 preflight 的软失败策略与 CI/本地环境区分（CI 默认严格、本地默认软）；最后补充一个 `make dev-stack-repair` 的一键修复入口，自动执行安全的非破坏性清理与重试。

## Concrete Steps

在仓库根目录执行：

    make dev-stack-up

预期输出包含：

    [dev-stack-up] backend stack is ready.
    [dev-stack-health] all checks passed.

随后执行：

    pnpm -C apps/miniapp preflight:weapp

预期输出包含：

    [miniapp-http-smoke] smoke checks passed.
    [preflight-weapp] passed.

若需要严格校验外部图片代理，不允许软通过：

    MINIAPP_HTTP_SMOKE_ALLOW_PROXY_FAILURE=false pnpm -C apps/miniapp preflight:weapp

## Validation and Acceptance

验收标准是行为级别的：

- `make dev-stack-up` 结束后，`docker compose ... ps` 可看到 `identity/commerce/payment/gateway-bff/postgres` 都是 `Up`。
- `pnpm -C apps/miniapp preflight:weapp` 结果为 `passed`，并写入 `apps/miniapp/.logs/preflight/result.json`。
- 在网络波动时，preflight 不因单次 `/assets/img` 外部代理失败阻断主联调；在严格模式下则会按预期阻断。

## Idempotence and Recovery

本方案按设计可重复执行：

- `make dev-stack-up` 可多次重入，容器会复用或按需重建。
- `pnpm -C apps/miniapp preflight:weapp` 可重复执行，结果文件会覆盖更新。

常见恢复路径：

- 构建报磁盘不足：
      docker system df
      docker builder prune -f
      make dev-stack-up

- 仅需应用网关环境变量变更而不重建全栈：
      docker compose --env-file infra/dev/backend.env.local -f infra/dev/docker-compose.yml -f infra/dev/docker-compose.backend.yml up -d gateway-bff

- 需要严格排查图片代理：
      MINIAPP_HTTP_SMOKE_ALLOW_PROXY_FAILURE=false bash tools/scripts/miniapp-http-smoke.sh

## Artifacts and Notes

关键行为证据（节选）：

    [dev-stack-up] using Go module proxy settings:
      - DEV_STACK_GOPROXY=https://goproxy.cn,direct
      - DEV_STACK_GOSUMDB=off
      - DEV_STACK_GONOSUMDB=*

    [dev-stack-health] all checks passed.
    [dev-stack-up] backend stack is ready.

    > pnpm -C apps/miniapp preflight:weapp
    [miniapp-http-smoke] smoke checks passed.
    [preflight-weapp] passed.

## Interfaces and Dependencies

本次变更不引入新第三方依赖，主要是参数与配置层面的稳定性增强：

- 新增/统一的环境接口：`DEV_STACK_GOPROXY`、`DEV_STACK_GOSUMDB`、`DEV_STACK_GONOSUMDB`
- 调整的环境默认值：`GATEWAY_IMAGE_PROXY_TIMEOUT=120s`
- preflight 行为开关：`MINIAPP_HTTP_SMOKE_ALLOW_PROXY_FAILURE`（默认在 preflight 中为 `true`）

这些接口均已在脚本与文档中显式定义，且支持通过环境变量覆盖。

---

更新记录（2026-03-05 / Codex）：
新增本文件，沉淀本次 Docker 联调“前后修改明细”、验证证据和恢复策略。原因是用户要求在 `docs/execplans` 目录下形成可复用、可交接的执行文档，以便后续成员无需回溯聊天记录即可复现与维护。
