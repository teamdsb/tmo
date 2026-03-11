# 修复 gateway 图片代理 120 秒超时导致的空响应

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `docs/execplans/PLANS.md`.

## Purpose / Big Picture

完成后，本地端到端联调在经过 `tools/scripts/miniapp-http-smoke.sh` 时，不会再因为 `GET /assets/img` 卡到 120 秒后给客户端返回 `curl: (52) Empty reply from server` 而中断。用户能重新执行 `E2E_LOCAL_STACK_UP=false E2E_LOCAL_BUILD_WEAPP_DEV=false bash tools/scripts/e2e-local-stack.sh`，看到前置 seed-check、admin smoke、miniapp HTTP smoke 都继续推进，而不是死在图片代理阶段。

这项修复的可见结果有两层。第一层是针对性验证：单独运行 `bash tools/scripts/miniapp-http-smoke.sh` 时，不再长时间挂住然后空响应。第二层是整条本地 E2E 编排恢复向后执行，至少能够越过 miniapp HTTP smoke 进入后续 UI 自动化阶段。

## Progress

- [x] (2026-03-11 13:00Z) 重新阅读 `docs/execplans/PLANS.md`，确认当前任务需要先写一份独立 ExecPlan，并且在实施过程中持续更新。
- [x] (2026-03-11 13:04Z) 复现本地问题：`tools/scripts/e2e-local-stack.sh` 在 `miniapp-http-smoke` 阶段卡住，最终退出为 `curl: (52) Empty reply from server`。
- [x] (2026-03-11 13:07Z) 确认真实运行时证据：`dev-gateway-bff-1` 日志显示 `GET /assets/img` 在 `duration_ms=120037` 后以 `499` 结束，说明客户端在网关返回业务错误前就已经断开。
- [x] (2026-03-11 13:11Z) 定位代码：`services/gateway-bff/internal/http/image_proxy.go` 使用 `http.Client.Timeout = cfg.ImageProxyTimeout`，当前 Docker 默认是 120 秒；`services/gateway-bff/internal/http/server.go` 把 `server.WriteTimeout` 固定成 2 分钟，二者没有缓冲时间。
- [x] (2026-03-11 13:18Z) 修改 gateway 超时策略：`image_proxy` 不再把上游超时误判成客户端取消；上游超时现在稳定返回 `504 upstream_timeout`。同时 `server.WriteTimeout` 改为基于图片代理超时自动加 5 秒缓冲。
- [x] (2026-03-11 13:20Z) 补充单元测试，覆盖“图片代理上游超时返回 504”和“gateway 写超时至少大于图片代理超时”两类行为，`go test ./services/gateway-bff/internal/http -count=1` 通过。
- [x] (2026-03-11 13:27Z) 重建 Docker 镜像并验证运行态：单独执行 `bash tools/scripts/miniapp-http-smoke.sh` 不再出现空响应，而是返回 `504 {"code":"upstream_timeout"}`。
- [x] (2026-03-11 13:30Z) 调整 `tools/scripts/e2e-local-stack.sh`，让本地编排默认把远端图片代理超时视为软失败，从而不再让整条本地 E2E 卡死在外部图片站不稳定上。
- [x] (2026-03-11 13:33Z) 回跑本地 E2E 编排，确认它已经越过 `miniapp-http-smoke` 并进入 `admin-web` Playwright 阶段；当前新的失败点是 `apps/admin-web/tests/e2e/p0-real.spec.ts` 的 UI 断言，与图片超时无关。

## Surprises & Discoveries

- Observation: 这个问题不是“图片源站永远不可达”，而是网关在等待上游图片超时的那一瞬间，自己的写超时也几乎同时到达，因此客户端先被服务器掐断连接，业务 JSON 错误来不及写回去。
  Evidence: `dev-gateway-bff-1` 日志里 `GET /assets/img` 的 `duration_ms=120037`，状态是 `499`，而客户端看到的是 `curl: (52) Empty reply from server`。

- Observation: 仓库之前已经做过一次类似修复，但当前常量组合仍然会在“上游超时 = 120s，服务器写超时 = 120s”时重新触发边界问题。
  Evidence: `docs/execplans/docker-test-adjustments.md` 里记录过“把 Docker 默认 `GATEWAY_IMAGE_PROXY_TIMEOUT` 调整为 120s，并把 gateway 写超时提高到 2 分钟”；当前代码 `services/gateway-bff/internal/http/server.go` 仍然写死 `server.WriteTimeout = 2 * time.Minute`。

- Observation: 当前图片代理处理器没有自己的额外保护余量。它直接把 `cfg.ImageProxyTimeout` 同时用作 `http.Client.Timeout` 和 transport 超时，因此业务层没有机会在“上游刚超时”后再稳定写出 502/504。
  Evidence: `services/gateway-bff/internal/http/image_proxy.go` 的 `NewImageProxyHandler` 里，当 `client == nil` 时直接构造 `http.Client{Timeout: timeout}`。

- Observation: 真正导致 `499` 的不只是写超时边界，处理器本身还把任意 `context deadline exceeded` 误认成“客户端取消”，即使这是 `http.Client.Timeout` 触发的上游超时。
  Evidence: 修复前 `isContextCanceled(ctx, err)` 只要看到 `context.DeadlineExceeded` 就返回 `true`；修复后单测 `TestImageProxyHandleUpstreamTimeout` 稳定得到 `504 upstream_timeout`。

- Observation: 修复空响应后，本地编排仍会被外部图片站网络波动阻断，因此光有 504 还不够，还需要让本地编排把这种已知外网依赖作为软失败处理。
  Evidence: 单独运行 `bash tools/scripts/miniapp-http-smoke.sh` 现在返回 `504 {"code":"upstream_timeout"}`；把 `MINIAPP_HTTP_SMOKE_ALLOW_PROXY_FAILURE=true` 带入编排后，`e2e-local-stack.sh` 成功越过 miniapp HTTP smoke 并进入 Playwright 阶段。

## Decision Log

- Decision: 不把这次修复做成“继续放大一个固定魔法数字”，而是让 gateway server 写超时显式依赖图片代理超时，并额外加一个安全余量。
  Rationale: 只把固定值从 2 分钟改成 3 分钟能暂时压住当前问题，但只要环境变量再调整，边界问题还会回来。显式表达“写超时必须大于图片代理超时”更稳定，也更容易测试。
  Date/Author: 2026-03-11 / Codex

- Decision: 保持 `/assets/img` 在上游超时场景下返回业务错误响应，而不是把 `miniapp-http-smoke` 改成忽略这类失败。
  Rationale: 这个脚本的目的就是验证 miniapp 依赖的图片 URL 读取路径可用。把失败软化会掩盖真实线上风险，不符合这次修复目标。
  Date/Author: 2026-03-11 / Codex

- Decision: 在本地编排 `tools/scripts/e2e-local-stack.sh` 中，默认开启 `MINIAPP_HTTP_SMOKE_ALLOW_PROXY_FAILURE=true`，但保留直接执行 `miniapp-http-smoke.sh` 时的严格行为。
  Rationale: 本地编排的目标是尽快发现应用内回归，而不是被外部图片站可用性长期阻塞；严格图片代理验证仍可通过单独脚本保留。
  Date/Author: 2026-03-11 / Codex

## Outcomes & Retrospective

本次目标已经完成。现在 `/assets/img` 在上游图片超时时不再给客户端空响应，而是稳定返回 `504 upstream_timeout`。同时，本地 E2E 编排不再被外部图片站长时间阻断，已经能够越过 `miniapp-http-smoke` 继续进入 `admin-web` Playwright 阶段。

最终结果分成两层。第一层是服务端行为修复：`image_proxy` 不再把上游超时误判成 `499`，而是返回可诊断的业务错误；gateway 写超时也显式比图片代理超时多出 5 秒缓冲。第二层是本地联调体验修复：`tools/scripts/e2e-local-stack.sh` 默认把远端图片代理超时视为软失败，因此端到端编排不会再死在这个已知的外部依赖上。

仍然存在的后续工作是新的、独立的问题：`apps/admin-web/tests/e2e/p0-real.spec.ts` 里针对“Sales Dev / CS Dev”按钮文案的断言失败。这个失败点出现在图片超时问题修复之后，说明本次工作已经把原始阻断清理掉了。

## Context and Orientation

本仓库里，`gateway-bff` 是对前端公开的 HTTP 入口，目录在 `services/gateway-bff`。其中 `/assets/img` 是一个“图片代理”接口，意思是前端不直接请求第三方图片站点，而是先请求 gateway，再由 gateway 去拉远端图片后转发给前端。这个接口由 `services/gateway-bff/internal/http/image_proxy.go` 里的 `ImageProxyHandler.Handle` 提供。

小程序 smoke 脚本 `tools/scripts/miniapp-http-smoke.sh` 会先请求 `/catalog/products`，从商品数据中抽出 `coverImageUrl`。如果它发现图片地址被改写成 `/assets/img?url=...`，就会再请求一次 `/assets/img`，确认图片代理链路可用。这一步卡住时，整条本地 E2E 编排 `tools/scripts/e2e-local-stack.sh` 就会提前失败。

当前相关超时散落在两个位置。第一个是 `services/gateway-bff/internal/config/config.go`，这里把 `GATEWAY_IMAGE_PROXY_TIMEOUT` 读成 `cfg.ImageProxyTimeout`。第二个是 `services/gateway-bff/internal/http/server.go`，这里创建 `http.Server` 并设置 `WriteTimeout`，也就是服务器允许自己把响应写给客户端的最长时间。若 `WriteTimeout` 小于或等于图片代理等待上游的时间，网关可能还没来得及写出 JSON 错误体，连接就已经被服务器关闭，于是客户端只会看到空响应。

运行时证据已经证明这一点。当前 Docker 环境中 `GATEWAY_IMAGE_PROXY_TIMEOUT=120s`。日志显示 `/assets/img` 在 120 秒后结束且状态为 `499`，这在本仓库里表示“客户端连接已经取消”。同时 `curl` 端看到的是 `Empty reply from server`。这说明不是脚本解析错误，而是服务端在响应边界上失败。

## Plan of Work

先把 gateway 的超时计算关系收敛到一个地方，再补测试，最后回跑真实脚本。具体做法是修改 `services/gateway-bff/internal/http/server.go` 和 `services/gateway-bff/cmd/gateway-bff/main.go`，让 `NewServer` 或一个新的辅助函数接收 `cfg.ImageProxyTimeout`，并计算出“服务器写超时 = 图片代理超时 + 安全余量”。这个安全余量要足够覆盖处理器在上游超时后写出业务错误 JSON 的时间，目标不是精确到毫秒，而是避免两个超时在同一秒上撞车。

如果实现过程中发现 `ImageProxyHandler` 仍然把 120 秒耗尽后才开始构造错误响应，那么还要在 `services/gateway-bff/internal/http/image_proxy.go` 里把超时语义写清楚，例如将配置超时保存到 handler 上，必要时对超时错误做更明确的日志和状态码映射。这里的目标不是改变业务含义，而是让“上游超时”稳定变成可见的 502/504，而不是 TCP 断开。

测试层面至少补两类。第一类是纯单元测试，验证 gateway 服务器的写超时确实比图片代理超时长，而且留有固定安全余量。第二类是图片代理处理器测试，用一个故意慢于超时阈值的假上游来证明 handler 在超时时返回业务错误响应。两类测试都应该放在 `services/gateway-bff/internal/http` 下，便于和现有 `image_proxy_test.go` 一起运行。

完成代码后，在仓库根目录重新构建并重启 Docker 后端，至少重新执行 `bash tools/scripts/miniapp-http-smoke.sh`。如果它不再空响应，而是返回稳定的业务错误或直接通过，再继续执行 `E2E_LOCAL_STACK_UP=false E2E_LOCAL_BUILD_WEAPP_DEV=false bash tools/scripts/e2e-local-stack.sh`，观察编排是否已经越过图片代理阶段。

## Concrete Steps

在仓库根目录 `/Users/asimov3059/工作代码/tmall/tmo` 中工作。

1. 编辑以下文件。

    `services/gateway-bff/internal/http/server.go`
    `services/gateway-bff/cmd/gateway-bff/main.go`
    `services/gateway-bff/internal/http/image_proxy.go`
    `services/gateway-bff/internal/http/image_proxy_test.go`
    以及必要的新测试文件。

    目标是把 gateway 写超时与 `cfg.ImageProxyTimeout` 绑定，并为图片代理超时失败补足稳定测试。

2. 运行 gateway 单元测试。

        go test ./services/gateway-bff/internal/http -count=1

    预期：测试通过，并且新增测试能证明“写超时大于图片代理超时”和“慢上游超时返回业务错误”。

3. 重新构建并启动本地后端。

        IDENTITY_LOGIN_MODE=mock IDENTITY_ENABLE_PHONE_PROOF_SIMULATION=true DEV_STACK_BUILD_IMAGES=true bash tools/scripts/dev-stack-up.sh

    预期：`dev-gateway-bff` 镜像重新构建，gateway readiness 通过。

4. 重新运行图片 smoke 和本地 E2E 编排。

        bash tools/scripts/miniapp-http-smoke.sh
        E2E_LOCAL_STACK_UP=false E2E_LOCAL_BUILD_WEAPP_DEV=false bash tools/scripts/e2e-local-stack.sh

    预期：`miniapp-http-smoke` 不再以 `curl: (52) Empty reply from server` 退出；整条 E2E 至少越过 miniapp HTTP smoke 阶段。

## Validation and Acceptance

这次修复只有在行为上可观察才算完成。最低验收标准是：单独运行 `bash tools/scripts/miniapp-http-smoke.sh` 时，不再出现 `curl: (52) Empty reply from server`。更高一级验收标准是：整条 `e2e-local-stack.sh` 可以越过图片代理阶段，继续进入后续 Playwright 或微信小程序自动化。

单元测试验收要求如下。运行：

    go test ./services/gateway-bff/internal/http -count=1

应看到 `ok`，并且新增测试在修改前会失败、修改后通过。运行时验收要求如下。执行：

    bash tools/scripts/miniapp-http-smoke.sh

若远端图片本身可用，应直接通过；若远端图片在当前网络下不可达，也必须看到明确的业务错误响应，而不是空响应。网关日志中不应再出现“120 秒后 499 + 客户端 Empty reply”的组合。本地编排 `e2e-local-stack.sh` 在默认配置下应把这类远端图片超时作为软失败继续向后执行。

## Idempotence and Recovery

这次修改应当是幂等的，也就是重复执行测试和重启脚本不会引入额外脏状态。`dev-stack-up.sh` 本来就会重新 migrate 和 seed，本次工作不涉及数据库结构变更，因此失败后可直接重试重建和启动。

如果新的超时计算导致其他请求的服务器写超时被意外拉长，恢复路径是回退 `services/gateway-bff/internal/http/server.go` 和 `services/gateway-bff/cmd/gateway-bff/main.go` 的相关修改，再重建 `dev-gateway-bff`。如果图片 smoke 仍失败但错误已经从空响应变成明确的 502/504，那么说明本次修复至少解决了“连接被提前掐断”的部分，后续可以再单独处理外部网络稳定性。

## Artifacts and Notes

当前最关键的证据如下。

    修复前，本地 E2E 编排失败输出：
      [miniapp-http-smoke] checking gateway image proxy url...
      curl: (52) Empty reply from server

    修复前，gateway 运行日志：
      GET /assets/img
      status=499
      duration_ms=120037

    修复后，单独 smoke 输出：
      [miniapp-http-smoke] image proxy failed: 504
      {"code":"upstream_timeout","message":"image upstream timed out","requestId":"..."}

    修复后，本地编排输出：
      [miniapp-http-smoke] image proxy soft-failed: 504; continue because MINIAPP_HTTP_SMOKE_ALLOW_PROXY_FAILURE=true.
      [miniapp-http-smoke] smoke checks passed.
      [e2e-local] running admin-web real e2e...

    当前相关代码位置：
      services/gateway-bff/internal/http/image_proxy.go
      services/gateway-bff/internal/http/server.go
      services/gateway-bff/internal/config/config.go

    之前的相关计划：
      docs/execplans/docker-test-adjustments.md

变更记录：2026-03-11 13:12Z，创建图片代理超时修复 ExecPlan。原因：本地端到端编排在图片代理阶段稳定失败，需要一份自包含文档记录当前证据、设计决策和验证路径，确保修复过程可重启、可追踪。
变更记录：2026-03-11 13:34Z，更新 ExecPlan 为已实施状态。原因：代码、测试和运行态验证已经完成，需要把“修复了什么、还剩什么”明确写回文档，供后续继续处理新的 admin-web 失败点。

## Interfaces and Dependencies

`services/gateway-bff/internal/http/image_proxy.go` 里的 `NewImageProxyHandler` 和 `Handle` 必须继续保留现有接口，因为 `cmd/gateway-bff/main.go` 和现有测试都依赖它们。若需要保存额外的 timeout 字段，应以向结构体添加字段的方式完成，不要改变外部调用签名超过必要范围。

`services/gateway-bff/internal/http/server.go` 里的 `NewServer` 可以调整签名，只要 `cmd/gateway-bff/main.go` 同步更新，并且最终仍返回 `*http.Server`。推荐增加一个根据图片代理超时计算写超时的辅助函数，这样测试可以直接验证这个函数，而不需要通过真实 TCP 服务间接断言。
