# 修复全栈审计发现的安全、并发与质量门禁问题

本 ExecPlan 是持续维护的文档，遵循 `docs/execplans/PLANS.md`。详细的逐文件测试驱动步骤位于 `docs/superpowers/plans/2026-08-10-audit-remediation.md`；两份文档必须随实施同步更新。

## Purpose / Big Picture

完成后，真实环境的小程序登录只能接受微信或支付宝实际验证过的身份和手机号，旧 JWT 能按 credential version 被撤销；Payment 后台只允许管理角色访问，未实现的支付渠道不能伪造成功状态；客服实时消息和商品导入不会因并发关闭或数据库自锁返回 500/永久挂起；前端慢请求有截止时间且轮询不会叠加；所有 Go、TypeScript、Lint、Jest、Playwright 与 OpenAPI 同步检查形成可重复的 CI 门禁。

## Progress

- [x] (2026-08-10 02:10+08:00) 完成前后端、契约、CI 与测试只读审计并复核关键路径。
- [x] (2026-08-10 02:20+08:00) 创建隔离 worktree `.worktrees/audit-remediation` 和分支 `codex/audit-remediation`，保留原工作区 5 个未提交文件。
- [x] (2026-08-10 02:25+08:00) 记录基线：Identity 因缺失 `CredentialVersion` 编译失败；miniapp mine suite 为 2 failed / 17 passed。
- [x] (2026-08-10 09:55+08:00) 完成 Identity 编译、credential-version JWT、mini-login 安全与默认出站超时修复；提交 `e9ffdb2`。
- [x] (2026-08-10 10:25+08:00) 修正 `credentialVersion` 超过 `2^53` 时的 JSON 浮点失真，并将 real-mode 回归测试改为断言零上游调用。
- [x] 将 Identity `/me` 的撤销检查以 3 秒有界共享客户端接入 Commerce、Payment、AI。
- [x] 完成 Payment RBAC、回调、provider 默认值与状态一致性修复。
- [x] (2026-08-10 10:05+08:00) 完成 Commerce SupportHub 与商品导入并发修复；提交 `d90227c`。
- [x] (2026-08-10 10:06+08:00) 扩展购物车 PATCH 契约，用单条 SQL 原子替换 SKU 并保留数量合并语义；提交 `0406f70`。
- [x] 完成 Gateway/browser 超时、并行和轮询防重。
- [x] 完成前端类型、Lint、测试和购物车数据恢复修复。
- [x] 完成 OpenAPI 聚合、生成漂移和全仓 CI 门禁。
- [ ] 将验证通过的提交安全集成回原工作区并处理订单页现有改动。

## Surprises & Discoveries

- Observation: 隔离 worktree 不包含未跟踪的 `node_modules`，直接借用原工作区 admin TypeScript 二进制时找不到 `vite/client`。
  Evidence: 初始 `tsc` 输出 `TS2688: Cannot find type definition file for 'vite/client'`；这是隔离依赖布局问题，不替代原工作区已确认的两个 TS2345 基线错误。
- Observation: Identity credential-version 回归不仅是结构体缺字段；数据库默认版本为 1，旧 token 或只补字段生成的零值 token 都会被正确拒绝。
  Evidence: `services/identity/migrations/00011_add_credential_version.sql` 将列默认设为 1，而当前 JWT 无该 claim。
- Observation: productimport 的现有契约是 group/row 级部分失败，不是任一 group 失败就将整个 job 标成 FAILED。
  Evidence: 现有 partial-success 测试要求失败 group 的 rows 为 `FAILED`，而含成功 group 的 job 仍可最终为 `SUCCEEDED`。
- Observation: Identity 默认平台客户端使用无超时的 `http.DefaultClient`，且 WeChat token refresh 会在 mutex 内等待该请求。
  Evidence: 构造器测试在修复前观察到全局默认 client；修复后内建 client 的 `Timeout` 为 15 秒，显式注入值保持不变。
- Observation: `credentialVersion` 只在 Identity `/me` 与数据库比较；Commerce、Payment、AI 原先只校验 JWT 签名和 issuer，停用账号、改密或改角色后的旧 token 仍可在这些服务使用至最长 168 小时。
  Evidence: 三个下游 `internal/http/middleware/auth.go` 均未读取版本或查询 Identity；独立复核将其列为 P1 阻断项。
- Observation: 默认 JWT JSON 解码把数据库 `BIGINT` 版本变成 `float64`，合法值超过 `2^53` 后会取整失真。
  Evidence: 新增 `9007199254740995` 精确往返测试；解析改用 `jwt.WithJSONNumber()` 与 `strconv.ParseInt` 后通过。

## Decision Log

- Decision: 使用独立 worktree 和按模块独占文件归属，再以子系统提交集成。
  Rationale: 原工作区有订单详情、订单列表及生成 CSS 的未提交改动；隔离可避免子代理覆盖用户工作。
  Date/Author: 2026-08-10 / Codex
- Decision: 第一批并行处理 Identity、Payment、Commerce 三个互不重叠的后端模块，完成评审后才派发前端和 CI。
  Rationale: 这些是阻断级或会产生资金/数据错误的问题，并行不违反严重度顺序，也减少同文件冲突。
  Date/Author: 2026-08-10 / Codex
- Decision: 未实现的 Alipay 入口返回 501，不保留宣称验签但实际未验签的伪实现。
  Rationale: 在真实 provider 完成前，失败关闭比生成假 trade number 或接受匿名 PAID 更安全。
  Date/Author: 2026-08-10 / Codex
- Decision: 真实登录模式完全禁止本地 mock code 和 caller-supplied phone；本地联调必须显式使用 mock mode。
  Rationale: 环境默认值或凭证是否存在不能作为身份所有权证明。
  Date/Author: 2026-08-10 / Codex
- Decision: 购物车换规格扩展现有 `PATCH /cart/items/{itemId}`，后端用数据修改 CTE 在一条 SQL 中删除旧行并 upsert 目标 SKU。
  Rationale: 前端补偿回滚仍可能二次失败；单语句原子替换能从数据层消除丢商品窗口。目标 SKU 已存在时累加本次换入数量，保留原 `UpsertCartItem` 的合并语义；只改数量的 PATCH 也保持不变。
  Date/Author: 2026-08-10 / Codex
- Decision: productimport 修复保持现有 partial-success 语义，验收失败 group 的行在回滚后被标记且 worker 有界返回，不改整个 job 状态规则。
  Rationale: 审计根因是事务内第二连接等待自身行锁，修复不需要同时改变用户可见的部分导入成功契约。
  Date/Author: 2026-08-10 / Codex
- Decision: 下游服务在本地验签后调用 Identity `GET /me` 校验当前账号状态与 credential version；默认请求硬截止为 3 秒，401/403 映射为 401，其余上游故障映射为 503。
  Rationale: 仅凭自包含 JWT 无法知道数据库版本是否已递增；短超时且失败关闭能满足立即撤销，同时避免 Identity 故障形成无限请求堵塞或鉴权绕过。
  Date/Author: 2026-08-10 / Codex

## Outcomes & Retrospective

实现里程碑已完成。Identity、Commerce、Payment、Gateway 与共享包的 `go test`、`go vet` 及定向 `go test -race` 均通过；后端脚本全量退出码为 0。Payment/Identity/Commerce 的数据库集成测试在本地因未提供独立 DSN 明确跳过，CI 已新增三库服务并将缺 DSN skip 变为失败。前端隔离安装后，miniapp lint 及 41 suites/275 tests、admin typecheck/build、27 个 Chromium mock E2E、4 个韧性 E2E、11 个 TypeScript 包类型检查、OpenAPI 结构/同步测试均通过；小程序 mock build 仅因隔离 worktree 缺少被忽略的 `apps/miniapp/.env.mock` 未执行编译。生成脚本已同步 Identity/Payment/AI 的 oapi-codegen 输出，`git diff --check` 通过。当前唯一待办是将隔离分支提交安全应用回原工作区并保留其 5 个用户未提交文件。

## Context and Orientation

仓库是 Go 微服务与 Taro/React 前端组成的 monorepo。Identity 位于 `services/identity`，签发所有服务共享的 JWT；Payment 位于 `services/payment`，负责支付记录、渠道回调及同步 Commerce 订单状态；Commerce 位于 `services/commerce`，其中 SupportHub 通过 WebSocket 推送客服事件，productimport worker 处理 Excel/ZIP 导入；Gateway 位于 `services/gateway-bff`，向 admin 和 miniapp 聚合或代理上游请求。`apps/miniapp` 是小程序，`apps/admin-web` 是后台。`contracts/openapi/openapi.yaml` 是聚合契约，单服务规范位于同目录的 identity、commerce、payment、admin 和 AI 文件。

原工作区分支是 `codex/fix-hide-excel-import-entry`，存在 5 个未提交文件：订单详情/列表的源码与测试，以及 `tailwind.generated.css`。隔离分支基于同一 HEAD，但不包含这些未提交内容。任何最终集成都必须保留它们。

## Plan of Work

第一个里程碑恢复 Identity credential version 的签发和解析，并把 real mode 的 `mock_*` 与 direct phone 两条旁路改为拒绝。第二个里程碑为 Payment admin API 增加角色授权，生产默认启用鉴权、禁用 mock provider，关闭未实现的 Alipay 回调，并让状态更新单调且跨服务同步可重试。第三个里程碑修复 SupportHub 在已关闭 channel 上发送的竞态，以及 productimport 在事务回滚前用第二连接等待自己行锁的死锁。

第四个里程碑并行化 BFF 独立上游请求，为浏览器 requester 添加 AbortController 截止时间并合并轮询中的 in-flight 请求；同时将购物车 SKU 替换下沉为后端原子 PATCH。第五个里程碑修复 admin TS、miniapp Lint/Jest，并让购物车使用新的原子接口，再安全协调当前订单成功跳转的未提交修改。最后同步聚合 OpenAPI，扩大 CI 路径与检查矩阵，再逐提交集成回原工作区。

## Concrete Steps

每个模块先运行其定向失败测试，再实现最小修复并复跑模块全套。详细命令和预期行为在 `docs/superpowers/plans/2026-08-10-audit-remediation.md`。Go 命令必须把 `GOCACHE` 指向 `/tmp` 以适应当前沙箱；前端隔离验证需在 worktree 建立被 Git 忽略的 `node_modules` 链接或执行锁定版本的 pnpm 10 安装。

每个里程碑完成后执行 `git diff --check`，审查生成文件只由其源规范、SQL 和生成器产生。禁止直接手改 sqlc、oapi-codegen 或 Orval 输出。

## Validation and Acceptance

安全验收以负向测试为主：real-mode `mock_*` 与 raw phone 登录必须失败且不写 identity；CUSTOMER/SALES 访问 Payment admin 必须 403；匿名或未签名 Alipay 回调不能改变支付状态；PAID 不能被并发 FAILED 覆盖；Commerce 同步失败后同状态重试必须再次同步。并发验收在 `go test -race` 下运行 SupportHub 断连/发布和导入失败测试，不能 panic 或超时。

全仓验收要求 `bash tools/scripts/test-backend.sh`、miniapp lint/Jest、admin typecheck/build/mock Playwright、全部 TS package typecheck、OpenAPI sync 和 `git diff --check` 都以 0 退出。真实支付、真实微信/支付宝登录和 DB 集成只有在提供凭证与 DSN 时运行；否则必须明确列为未验证，不能用 mock 结果替代。

## Idempotence and Recovery

测试、生成、Lint 与构建均可重复。所有工作先在隔离分支提交，原工作区不做 reset、checkout 或清理。若某里程碑回归，只回退该隔离提交或继续修复，不动原工作区脏文件。sqlc 或 OpenAPI 生成失败时保留源 SQL/YAML，修复生成环境后重跑；不得手工伪造生成结果。

## Artifacts and Notes

基线证据：Identity `go test ./...` 报 `claims.CredentialVersion undefined`；miniapp `src/pages/mine/index.test.tsx` 报 2 failed / 17 passed。完整审计报告已在上一轮对话交付，实施以本计划列出的可观察验收为准。

## Interfaces and Dependencies

Identity `auth.TokenManager.Issue` 继续通过 `IssueOption` 扩展 claim，新增 `auth.WithCredentialVersion(int64)`，避免再次大范围改变签名；内建 platform HTTP client 设 15 秒 timeout，显式注入 client 保留调用方语义。Payment 新增 handler 内部 `requireAdminUser`，允许 ADMIN、BOSS、MANAGER、CS。Payment 状态更新继续通过 sqlc，但 SQL 必须阻止非 PAID 覆盖 PAID，并在无更新行时重载当前状态。Commerce `PATCH /cart/items/{itemId}` 增加可选 `skuId`，通过 sqlc `ReplaceCartItemSku` 数据修改 CTE 完成单语句原子替换。前端 deadline 使用原生 `AbortController`，不新增运行时依赖；轮询使用共享 in-flight Promise 或布尔锁合并请求。

变更记录：2026-08-10，依据只读审计建立分阶段修复计划，选择 worktree 隔离以保护原工作区未提交改动。
