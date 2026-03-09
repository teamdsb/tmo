# 小程序真实手机号登录与 Admin 手机号账号台账

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `docs/execplans/plans.md`.

## Purpose / Big Picture

完成后，微信小程序不再依赖“手机号证明模拟”按钮来登录，而是可以在微信开发者工具和真机环境中走真实的微信手机号授权链路，把真实手机号写入 identity 用户账号，并在 admin 侧清楚地看到“这个手机号对应哪个账号、当前是什么角色、通过什么登录身份绑定进来”。这项改动的直接价值是把本地联调从“假手机号流程”推进到“接近生产的真实登录流程”，同时让运营和管理员能追踪手机号与账号的绑定结果，避免登录成功但后台查不到账号归属。

观察方式分为两条。第一条是小程序侧：启动 identity、gateway、miniapp，使用真实 `AppID`、`AppSecret`，在登录页点击微信手机号授权后成功进入首页，并且 `/bff/bootstrap` 返回的账号信息与当前手机号绑定一致。第二条是 admin 侧：登录 `admin-web` 后，在用户运营页面按手机号搜索，能查到刚刚登录产生或更新的账号记录，至少看到手机号、用户 ID、用户类型、角色，以及需要时的业务员归属信息。

## Progress

- [x] (2026-03-09 11:34Z) 重新阅读 `docs/execplans/PLANS.md` 与仓库规则，确认当前执行中的 ExecPlan 应写入 `.agent/PLANS.md`，且必须是完整、自洽、面向新人的单文件说明。
- [x] (2026-03-09 11:38Z) 核对 miniapp 登录入口、identity mini login 处理器、admin 用户与客户列表能力，确认真实手机号登录与 admin 查询都已有一部分基础设施，不需要从零建模。
- [x] (2026-03-09 11:41Z) 本地事实确认：`apps/miniapp/.env.development` 当前仍是 `touristappid` 场景，`TARO_APP_WEAPP_PHONE_PROOF_SIMULATION` 需要手动开启才能稳定联调；这说明“真实手机号登录”当前不是代码完全缺失，而是配置、环境校验、后台可观测性三方面尚未闭环。
- [x] (2026-03-09 11:45Z) 本地事实确认：identity 后端已支持 `phoneProof`、真实 `jscode2session` / `getuserphonenumber` 解析、手机号写入 `users.phone`、以及手机号冲突保护；admin 后端与前端已有 `/admin/customers`、`/admin/users` 与手机号字段，但没有明确的“手机号账号台账”视图。
- [ ] 把“真实手机号登录”从“依赖人工记忆的配置组合”改成可执行、可验证、失败时可诊断的联调路径，包括环境变量校验、开发模式提示和最小 smoke 验证。
- [ ] 补齐 identity 对真实微信手机号链路的回归测试，覆盖首次登录、重复登录、手机号冲突、绑定已有 customer、以及未配置真实微信凭证时的明确失败信息。
- [ ] 在 admin 侧补一个清晰的手机号账号查询视图，或者在现有用户运营页中增加足够的字段与筛选，让管理员可以按手机号追踪账号与绑定状态。
- [ ] 用真实联调步骤完成一次“微信手机号授权登录 -> admin 搜到该手机号账号”的端到端验证，并把观察结果记录回本文档。

## Surprises & Discoveries

- Observation: identity 服务已经在 `real` 模式下要求手机号证明，而且处理器会把手机号归一化后写入 `users.phone`；这说明登录后的“手机号落库”并不是新需求，而是现有能力需要被稳定验证和暴露出来。
  Evidence: `services/identity/internal/http/handler/auth.go` 中 `resolveMiniLoginPhone`、`findOrCreateMiniLoginCustomer`、`bindMiniLoginPhone` 三段逻辑已经覆盖“解析手机号 -> 查已有用户 -> 绑定手机号”。

- Observation: 当前 miniapp 本地联调默认仍然容易落入游客模式或手机号模拟模式，因为 `apps/miniapp/.env.development` 没有真实 `TARO_APP_ID`，而 README 也明确写了游客模式下微信登录和手机号授权会受限。
  Evidence: `apps/miniapp/.env.development` 只有 `TARO_APP_MOCK_MODE=off` 和 `TARO_APP_API_BASE_URL=http://localhost:8080`；`apps/miniapp/README.md` 明确说明“微信环境建议使用真实 `TARO_APP_ID`；游客模式（`touristappid`）下，微信登录和手机号授权会受限。”

- Observation: admin 侧并不是完全没有手机号可看。现有 `/admin/customers`、`/admin/users` 契约里已经有 `phone` 字段，前端用户运营页面也已经展示手机号，只是它还不是围绕“手机号账号追踪”设计的主路径。
  Evidence: `contracts/openapi/admin.yaml` 中 `/admin/users` 与 `/admin/customers` 相关 schema 都包含 `phone`；`apps/admin-web/src/react/pages/admin/UserOperationsPage.tsx` 已按手机号搜索并展示客户手机号。

- Observation: 仓库里现有的微信自动化 E2E 不是当前功能真失败的直接证据，因为它先被本机微信开发者工具与 `miniprogram-automator` 版本兼容问题拦住了。
  Evidence: 运行 `pnpm -C apps/miniapp run test:e2e:weapp:auth` 时，脚本在 `MiniProgram.checkVersion` 阶段报 `Cannot read properties of undefined (reading 'split')`，崩溃点在 automator 启动期，不在业务登录接口。

- Observation: 我们刚修过 miniapp 的退出登录逻辑，统一清理了 token、bootstrap 和待选角色缓存，并强制回登录页。这会减少真实手机号登录验证时的“旧登录态残留”噪音。
  Evidence: `apps/miniapp/src/utils/auth.ts` 现在会在 `clearAuthSession()` 中同时清理 `gateway`、`commerce`、`identity` token 与 `tmo:bootstrap`、`tmo:auth:role-selection`；`apps/miniapp/src/pages/mine/index.tsx` 在退出后会 `switchTabLike(ROUTES.authLogin)`。

## Decision Log

- Decision: 这项工作拆成两个必须同时完成的结果来设计：一是小程序真实手机号登录稳定可用，二是 admin 能按手机号查账号。两者不拆开交付。
  Rationale: 如果只把真实登录链路配通而没有后台可见性，排障时仍然无法确认“手机号落到了哪个用户”；如果只做 admin 台账而真实登录仍依赖模拟手机号，台账的业务价值也不足。
  Date/Author: 2026-03-09 / Codex

- Decision: admin 侧优先复用现有 `/admin/customers` 与 `/admin/users` 接口和 `UserOperationsPage.tsx`，必要时在该页上增强，而不是先新建一套完全独立的后台模块。
  Rationale: 当前接口和页面都已具备手机号字段与查询能力，先增强展示和筛选可以最小化范围；只有当现有接口无法暴露 provider 绑定等关键信息时，再新增专用接口或页面。
  Date/Author: 2026-03-09 / Codex

- Decision: 真实手机号登录的第一目标环境是“微信开发者工具 + 本地 real backend + 真实 AppID/AppSecret”，不把游客模式或手机号证明模拟视作验收通过。
  Rationale: 用户明确要“真实电话号码登录”。模拟模式仍保留用于开发兜底，但不能作为这项工作的主验收结果。
  Date/Author: 2026-03-09 / Codex

- Decision: 文档和脚本里必须把“缺少真实 `TARO_APP_ID` / `IDENTITY_WEAPP_APPID` / `IDENTITY_WEAPP_APPSECRET`”视为可诊断的错误，不允许继续默默回退到难以分辨的半真半假状态。
  Rationale: 当前最大的问题不是代码没有接口，而是环境与模式切换太隐蔽，导致开发者以为自己在测真实登录，实际却在游客模式或模拟模式。
  Date/Author: 2026-03-09 / Codex

## Outcomes & Retrospective

当前仍处于规划与环境梳理阶段，尚未进入功能落地。已经明确的正向结果是：仓库并不缺少真实手机号登录的核心后端能力，也不缺少 admin 的基础手机号字段；真正缺的是一条从环境配置、登录触发、落库验证到后台查询都能稳定重复执行的“闭环路径”。

当前最大风险有两个。第一个是微信开发者工具与 automator 兼容性，意味着我们不能完全依赖现有脚本证明真实登录链路。第二个是小程序本地环境容易因为 `touristappid` 或手机号模拟开关导致误判，需要把模式切换收敛得更显式。后续若执行本计划，优先级应是先把真实模式的环境判定和错误提示做清楚，再做 admin 台账增强。

## Context and Orientation

本仓库里，“真实手机号登录”不是指后台密码登录，而是指微信小程序在登录页通过微信提供的手机号授权能力，把平台返回的手机号证明（这里叫 `phoneProof`，就是一段微信发给后端验证手机号的凭据）提交给 identity 服务，再由 identity 服务向微信接口换取真实手机号。对应的小程序入口文件是 `apps/miniapp/src/pages/auth/login/index.tsx`。当运行环境是 weapp 并且 `TARO_APP_WEAPP_PHONE_PROOF_SIMULATION=false` 时，这个页面会渲染 `openType='getPhoneNumber'` 的原生按钮，点击后会把微信返回的手机号证明交给 `identityServices.auth.miniLogin(...)`。

identity 服务位于 `services/identity`。真实手机号登录的 HTTP 入口是 `services/identity/internal/http/handler/auth.go` 里的 `PostAuthMiniLogin`。这个处理器会先解析平台身份（也就是微信登录 code 换来的 openid 等信息），再调用 `resolveMiniLoginPhone` 校验 `phoneProof`，得到手机号后走两条路径：如果这个平台身份已经绑定到现有用户，则尝试把手机号绑定到该用户；如果是首次登录，则通过 `findOrCreateMiniLoginCustomer` 创建或复用 customer 账号，并把手机号写进 `users.phone`。写库的 SQL 在 `services/identity/queries/identity.sql`，其中 `UpdateUserPhone` 语句带有“手机号为空或和当前手机号一致才允许写入”的保护，用于防止一个手机号被静默绑定到多个账号。

“Admin 手机号账号台账”在这份计划里指后台管理站能按手机号查到账号信息，而不是单纯在数据库里有一列 phone。当前最接近这个能力的是 `apps/admin-web/src/react/pages/admin/UserOperationsPage.tsx`。这个页面会请求 identity 后端的 `/admin/customers` 和 `/admin/users` 等接口，已经可以展示用户名称、手机号、角色和归属业务员。相关后端实现位于 `services/identity/internal/http/handler/admin.go`，契约位于 `contracts/openapi/admin.yaml`。这说明后台数据大体是通的，但页面信息组织还没有围绕“手机号账号追踪”来做，也没有把“通过什么 provider 绑定、是不是刚通过微信手机号登录创建出来的账号”表达清楚。

本地联调时还要注意三个配置文件。`apps/miniapp/.env.development` 决定小程序是 mock 还是真实后端，以及是否打开手机号证明模拟。`infra/dev/backend.env.local` 决定 identity 是否真的校验手机号证明，以及微信 `AppID` / `AppSecret` 是否可用。`apps/miniapp/README.md` 已经写明：游客模式 `touristappid` 下，微信登录和手机号授权会受限；因此如果要做真实手机号登录验收，就必须给前端的 `TARO_APP_ID` 和后端的 `IDENTITY_WEAPP_APPID` / `IDENTITY_WEAPP_APPSECRET` 填真实值。

## Plan of Work

先收敛真实登录环境，再增强后台可见性，最后补验证。第一步只处理环境与模式判定。要在 miniapp 和 identity 两端把“真实模式”与“模拟模式”区分清楚：`apps/miniapp/.env.development`、`apps/miniapp/config/index.ts`、`apps/miniapp/src/config/runtime-env.ts`、`services/identity/internal/config/config.go` 与相关启动脚本需要统一约定，当真实模式缺少必需的微信配置时，要给出明确错误，而不是让页面落到游客模式或隐式模拟。这里还要整理 `apps/miniapp/README.md` 和 `services/identity/README.md`，把真实手机号登录的必需条件写成一条可以复现的路径。

第二步处理小程序登录链路的可观测性与回归测试。`apps/miniapp/src/pages/auth/login/index.tsx` 需要在真实模式下给出更清晰的用户提示，例如“当前没有真实 AppID”或“后端未配置微信凭证”，而不仅仅是泛化的“登录失败，请重试”。`services/identity/internal/http/handler/integration_test.go` 需要补充真实手机号路径的测试，至少覆盖：缺少 `phoneProof` 时返回 `phone_required`；真实手机号首次登录创建 customer；同一个手机号再次登录复用账号；手机号已绑定到非 customer 时返回冲突；已绑定手机号的多角色场景下角色选择不要求重复手机号证明。

第三步增强 admin 侧手机号账号记录能力。优先修改 `apps/admin-web/src/react/pages/admin/UserOperationsPage.tsx`，把手机号作为更显式的查询入口与展示主轴，并评估是否要在 `services/identity/internal/http/handler/admin.go` 对 `/admin/users` 或 `/admin/customers` 补充 provider 绑定摘要、最近登录时间、当前 role 列表等字段。如果现有接口已经足够，则只改页面展示与搜索说明；如果不够，就先在 OpenAPI `contracts/openapi/admin.yaml` 补字段，再补 handler、前端适配和测试。

第四步打通端到端验证。这里的目标不是“脚本看起来能跑”，而是实际在微信开发者工具或真机里用一个真实手机号走通登录，然后立刻在 admin 页面里搜到对应账号。由于现有 `miniprogram-automator` 在本机与微信开发者工具版本不兼容，这一步需要准备两套验证手段：保留命令行 smoke 用于接口级验证，同时补一份人工验证步骤和预期观察结果，确保没有自动化也能完成验收。

## Concrete Steps

在仓库根目录工作。

1. 先梳理并修改真实登录所需配置与提示。

    编辑 `apps/miniapp/.env.development`、`apps/miniapp/src/config/runtime-env.ts`、`apps/miniapp/src/pages/auth/login/index.tsx`、`services/identity/internal/config/config.go`、必要的 README 和脚本。

    然后运行：

        pnpm -C apps/miniapp exec jest --runInBand src/pages/auth/login/index.test.tsx src/pages/mine/index.test.tsx
        go test ./services/identity/...

    预期：miniapp 登录页相关测试通过，identity 集成测试继续通过，并新增真实手机号路径的断言。

2. 启动真实联调环境，且关闭手机号模拟。

    在 `infra/dev/backend.env.local` 中填入：

        IDENTITY_LOGIN_MODE=real
        IDENTITY_ENABLE_PHONE_PROOF_SIMULATION=false
        IDENTITY_WEAPP_APPID=<真实微信小程序 AppID>
        IDENTITY_WEAPP_APPSECRET=<真实微信小程序 AppSecret>

    在 `apps/miniapp/.env.development` 中填入：

        TARO_APP_MOCK_MODE=off
        TARO_APP_API_BASE_URL=http://localhost:8080
        TARO_APP_ID=<真实微信小程序 AppID>
        TARO_APP_WEAPP_PHONE_PROOF_SIMULATION=false

    然后运行：

        pnpm run dev:admin-web:stack
        pnpm -C apps/miniapp dev:weapp

    预期：后端 `8080/8081/8082/8083` 在线，admin-web 在 `http://localhost:5174/` 可登录；微信开发者工具加载 `apps/miniapp/dist/weapp` 时，登录页不再显示模拟按钮，而是真实手机号授权按钮。

3. 完成一次真实手机号登录。

    在微信开发者工具中打开 `apps/miniapp` 项目，进入登录页，勾选协议后点击真实手机号授权按钮。预期：进入首页或“我的”页显示已登录状态，并且 identity 数据库中对应 `users.phone` 已写入真实手机号。

    可选地在终端验证：

        curl -sS http://localhost:8080/bff/bootstrap

    预期：在带 token 的小程序请求上下文里，`me` 不为空。

4. 在 admin 中验证手机号账号可见性。

    打开 `http://localhost:5174/`，使用 `admin / admin123` 登录。进入用户运营页面，按刚刚登录的手机号搜索。预期：可以看到该手机号对应的账号，至少包含手机号、用户 ID、用户类型、角色；若该账号已有业务员归属，还应同时可见。

## Validation and Acceptance

验收分三层。第一层是配置验收：当真实模式缺失 `TARO_APP_ID` 或后端缺失 `IDENTITY_WEAPP_APPID` / `IDENTITY_WEAPP_APPSECRET` 时，系统必须给出明确错误或提示，而不是静默回退到游客模式或模拟模式。第二层是登录验收：在真实微信配置齐全时，小程序使用真实手机号授权后能成功登录；identity 服务会把手机号写入账号并避免重复或冲突绑定。第三层是后台验收：admin 可以按手机号搜索并定位到刚刚登录的账号记录，不再需要手工查库。

命令级验收至少包括：

    pnpm -C apps/miniapp exec jest --runInBand src/pages/auth/login/index.test.tsx src/pages/mine/index.test.tsx
    go test ./services/identity/...
    curl -sS http://localhost:8080/ready
    curl -sS http://localhost:8081/ready

预期：测试通过，ready 接口返回 `OK`。行为级验收则是“真实手机号登录一次后，admin 搜得到该手机号账号”。如果自动化脚本仍被微信开发者工具版本问题阻断，则必须有一份人工验证记录写回本计划的 `Artifacts and Notes`。

## Idempotence and Recovery

这项工作的配置步骤应当可重复执行。重复修改 `.env.development` 和 `backend.env.local` 后，只需重启 miniapp dev 和 backend stack 即可。若真实微信配置错误，优先看登录页提示与 identity 日志，不要直接改代码绕过。若需要临时恢复本地开发效率，可重新把：

    TARO_APP_WEAPP_PHONE_PROOF_SIMULATION=true
    IDENTITY_ENABLE_PHONE_PROOF_SIMULATION=true

打开，回退到“真实后端 + 模拟手机号证明”的联调方式。该回退不会破坏数据库结构，只会改变登录入口行为。

如果某个真实手机号错误绑定到了测试账号，恢复策略应写成显式的管理操作，而不是手工改脏数据。优先在 identity 侧补管理脚本或安全 SQL，用于解除错误的 `user_identities` 与 `users.phone` 绑定，再重新登录验证。没有这条恢复路径之前，不应在文档中鼓励直接手改生产风格数据。

## Artifacts and Notes

当前已确认的关键文件和事实如下。

    小程序登录页：
      apps/miniapp/src/pages/auth/login/index.tsx

    小程序统一清理登录态：
      apps/miniapp/src/utils/auth.ts

    identity 真实 mini login 入口：
      services/identity/internal/http/handler/auth.go

    identity SQL（手机号查询与绑定）：
      services/identity/queries/identity.sql

    admin 用户运营页：
      apps/admin-web/src/react/pages/admin/UserOperationsPage.tsx

    admin 契约：
      contracts/openapi/admin.yaml

    本地已观察到的自动化阻塞证据：
      pnpm -C apps/miniapp run test:e2e:weapp:auth
      输出：
        Cannot read properties of undefined (reading 'split')
        at MiniProgram.checkVersion

    本地已观察到的真实模式限制证据：
      apps/miniapp/README.md 明确写明游客模式 `touristappid` 下微信登录和手机号授权会受限。

变更记录：2026-03-09 11:49Z，创建“真实手机号登录与 Admin 手机号账号台账”ExecPlan。原因：当前仓库已经具备部分真实登录和后台手机号展示能力，但缺少一条可重复执行、可诊断、可在 admin 侧闭环验证的进度文档，需要用 ExecPlan 固化上下文、风险和实施顺序。

## Interfaces and Dependencies

miniapp 侧继续使用现有的 `identityServices.auth.miniLogin` 接口，不另起一套登录协议。该接口的输入定义在 `packages/identity-services/src/index.ts` 的 `MiniLoginInput`，其中 `phoneProof` 是手机号证明，`role` 是多角色时的当前登录角色。最终代码必须继续保留这个接口名和调用方式，避免影响现有 mock / real 双模式。

identity 侧继续使用 `services/identity/internal/platform/MiniLoginResolver` 作为平台解析入口，不要在 handler 中直接拼接微信 API 请求。真实手机号链路需要依赖它的 `Resolve(...)` 与 `ResolvePhone(...)`，前者解析平台身份，后者验证手机号证明。admin 侧优先依赖现有 `/admin/customers` 和 `/admin/users`，只有在这些接口不能表达手机号账号追踪所需信息时，才在 `contracts/openapi/admin.yaml` 增补字段并同步实现。
