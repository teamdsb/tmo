# 本地跨端联调与 E2E 收口计划（admin-web + miniapp + backend + real DB）

本 ExecPlan 是一个持续更新的文档。`Progress`、`Surprises & Discoveries`、`Decision Log`、`Outcomes & Retrospective` 这四个部分在工作推进时必须同步更新。

本计划必须遵守仓库根目录的 `docs/execplans/PLANS.md`。

## Purpose / Big Picture

完成本计划后，仓库应当具备一条可以由新同学在本地重复跑通的跨端联调与端到端验证路径。执行者可以在一台开发机上启动本地真实后端服务，连接本地真实 Postgres 数据库，执行统一的通用 seed，然后分别运行 `apps/admin-web` 与 `apps/miniapp` 的真实联调验证，确认两端消费的是同一套身份、目录和询价数据，而不是各自漂移的 mock 数据。

这项工作的用户可见结果不是“多了一些脚本”，而是“本地真的能稳定复现联调闭环”。执行完成后，执行者应当能够看到：gateway、identity、commerce 等服务启动成功；固定的 dev 账号可以登录；admin-web 在真实模式下读到真实列表；miniapp 在真实模式下完成登录并读取真实 catalog；用于联调的身份和商品数据与文档约定一致；real e2e 与 hybrid e2e 的边界被明确，不再把接口 stub 的测试误算成真实联调。

## Progress

- [x] (2026-03-07 10:35Z) 起草并落盘本 ExecPlan，作为后续实现与维护的唯一入口文档。
- [x] (2026-03-07 10:52Z) 固定本地联调的推荐入口：新增 `tools/scripts/e2e-local-stack.sh` 统一编排后端起栈、seed 校验、smoke 和真实 e2e。
- [x] (2026-03-07 10:52Z) 定义“real e2e”与“hybrid e2e”的仓库内标准，并把 `apps/admin-web/tests/e2e/import.real.spec.ts` 重新归类为 hybrid。
- [x] (2026-03-07 14:10Z) 建立一套跨 `identity`、`commerce`、`gateway`、`admin-web`、`miniapp` 共用的真实联调用 seed 合同，补齐固定 inquiry fixture 并纳入默认 seed-check。
- [x] (2026-03-07 10:52Z) 增加 `tools/scripts/dev-seed-check.sh`，在 e2e 前验证真实登录、bootstrap、catalog 和多角色 mini login fixture。
- [x] (2026-03-07 13:46Z) 收口 `admin-web` 的真实模式 e2e，真实链路已覆盖登录 + 用户运营 + 询价 + 支付 + 供应商读取，`pnpm -C apps/admin-web run test:e2e:real` 在当前工作区代码下通过。
- [x] (2026-03-07 13:15Z) 收口 `miniapp` 的真实模式 e2e，新增 `weapp-catalog-real-e2e.js` 覆盖“登录 + bootstrap + 首页/分类/商品详情 + 询价动作”的最小闭环。
- [x] (2026-03-07 12:11Z) 提供统一的本地一键验证命令 `tools/scripts/e2e-local-stack.sh`，并完成到 seed-check / smoke / admin-web real / miniapp auth 的阶段编排。
- [x] (2026-03-07 13:15Z) 补齐 README / runbook 说明，补充 miniapp catalog real e2e、统一脚本默认强制重建镜像，以及 payment smoke 失败的定位入口。
- [x] (2026-03-07 14:02Z) 验证统一编排链路：在复用当前工作区本地服务、跳过 docker 起栈的前提下，`E2E_LOCAL_STACK_UP=false E2E_LOCAL_BUILD_WEAPP_DEV=false bash tools/scripts/e2e-local-stack.sh` 全阶段通过。

## Surprises & Discoveries

- Observation: 当前仓库已经具备 `dev-stack-up.sh`、`dev-seed.sh`、`admin-web` Playwright real 配置和 `miniapp` automator 脚本，但这些能力尚未被收口成一条统一的联调路径。
  Evidence: `tools/scripts/dev-stack-up.sh` 可起 `postgres + identity + commerce + payment + ai + gateway-bff`；`apps/admin-web/package.json` 已有 `test:e2e:real`；`apps/miniapp/package.json` 已有 `test:e2e:weapp:auth` 与 `debug:weapp:smoke`。

- Observation: 当前 `admin-web` 的一部分 “real” 测试并不是真正意义上的真实联调，因为业务接口仍通过 `page.route()` 被 stub。
  Evidence: `apps/admin-web/tests/e2e/import.real.spec.ts` 对 `/api/bff/bootstrap`、`/api/admin/products/import-jobs`、`/api/admin/import-jobs/*` 做了拦截和伪造响应。

- Observation: 当前仓库存在两套“数据真相来源”。一套是真实数据库 seed，另一套是 `packages/shared/src/mock-data/*` 中的 canonical mock 常量。
  Evidence: `services/commerce/cmd/commerce-seed/main.go` 与 `services/identity/cmd/identity-seed/main.go` 会写真实库；`packages/shared/src/mock-data/catalog.js`、`auth.js` 同时定义了另一套分类、商品、账号和身份 fixtures。

- Observation: 询价数据现在已经纳入 repo 内统一 seed，`dev-seed-check.sh` 也已从“仅校验连通性”升级为默认验证固定 fixture 的关键字段。
  Evidence: `services/commerce/cmd/commerce-seed/main.go` 新增固定 inquiry `77777777-7777-7777-7777-777777777777` 及其 message fixture；执行 `bash tools/scripts/dev-seed-check.sh` 会默认校验 `createdByUserId=dddd...`、`assignedSalesUserId=bbbb...`、`skuId=333...3305`、`status=OPEN` 与固定 message 片段。

- Observation: `apps/admin-web/playwright.e2e.real.config.mjs` 原先使用 `/.*\.real\.spec\.ts/`，实际上匹配不到仓库里现有的 `p0-real.spec.ts` 命名。
  Evidence: 执行 `pnpm -C apps/admin-web exec playwright test -c playwright.e2e.real.config.mjs --list` 返回 `No tests found`，修正为同时支持 `-real` 与 `.real` 后该问题消失。

- Observation: 当前 `infra/dev/backend.env.local` 的默认值虽然启用了 `IDENTITY_LOGIN_MODE=real`，但没有同时开启手机号模拟，导致 mini 登录在本地默认栈下会被 `phone_required` 拦截。
  Evidence: 执行 `bash tools/scripts/dev-seed-check.sh` 时，`mock_customer_001` 返回 `400 {"code":"phone_required","message":"phone proof is required"}`。

- Observation: 仅修改 `infra/dev/backend.env.local` 还不够，因为 `infra/dev/docker-compose.backend.yml` 先前并没有把 `IDENTITY_ENABLE_PHONE_PROOF_SIMULATION` 与 `IDENTITY_PHONE_PROOF_SIMULATION_PHONE` 透传进 `identity` 容器。
  Evidence: `docker inspect dev-identity-1` 只看到 `IDENTITY_LOGIN_MODE=real`，没有看到手机号模拟相关环境变量。

- Observation: 即使手机号模拟已启用，当前 real 模式下如果没有真实微信/支付宝凭证，`mock_*` code 仍会在平台解析阶段被判定为 `invalid login code`，这与 README 中的本地联调夹具约定不一致。
  Evidence: `services/identity/internal/platform/service.go` 先前只在 `LoginModeMock` 且平台 client 为空时才把 code 直接作为 `ProviderUserID`；在 `LoginModeReal` 下相同请求会返回 `weapp is not configured`，经 handler 转为 `invalid_request`。

- Observation: `dev-seed-check.sh` 第一轮实跑暴露了两个与真实接口不一致的脚本假设：一是 `set -u` 下空数组直接展开会报错；二是 `/catalog/categories` 返回的是带 `items` 的对象而不是裸数组。
  Evidence: 首轮执行分别报出 `headers[@]: unbound variable` 与 `FAIL catalog categories non-empty`，而实际返回体为 `{"items":[...]}`。

- Observation: `/admin/users` 404 并不是当前源码里还缺路由，而是本地联调容易命中旧容器/旧镜像；切到当前 gateway 镜像后该接口已恢复为 200，真实失败点随即前移到 `payment` 后台路由。
  Evidence: 当前源码中的 `services/gateway-bff/internal/http/server.go` 已显式注册 `router.Any("/admin/users", handlers.Identity)`；重新起栈后 `curl http://localhost:8080/admin/users?page=1&pageSize=20` 返回 200，而 `pnpm -C apps/admin-web run test:e2e:real` 下一失败改为 `/payment-api/admin/payments/transactions` 404。

- Observation: 旧 `payment` 容器会让 `admin-web` real e2e 在 payments 页收到 404，但这一问题可以通过更早的 smoke 检查和统一脚本默认强制重建镜像来前移暴露。
  Evidence: 直接请求 `http://localhost:8083/admin/payments/transactions?page=1&pageSize=20` 返回 `404 page not found`，而当前源码 `services/payment/internal/http/server.go` 已注册 `/admin/payments/transactions`、`/admin/payments/webhooks`；本次已把这两个接口加入 `tools/scripts/admin-web-smoke.sh`，并让 `tools/scripts/e2e-local-stack.sh` 默认携带 `DEV_STACK_BUILD_IMAGES=true`。

- Observation: `admin-web` real e2e 最终能通过，但前提是 8080/8081/8082/8083 上跑的是当前工作区源码；若 Docker 容器仍是旧版本，依次会表现为 `/admin/users`、`/admin/payments/transactions`、`/admin/suppliers` 这类 404。
  Evidence: 本次排障中，切换到本地 `go run` 的 `identity`、`payment`、`commerce`、`gateway-bff` 后，`bash tools/scripts/admin-web-smoke.sh` 与 `pnpm -C apps/admin-web run test:e2e:real` 均通过。

- Observation: miniapp auth 与 catalog real E2E 不能并发执行，因为默认共用 `WEAPP_AUTOMATOR_PORT=9527`；并发时会误报“停留在登录页”，但串行执行后登录与业务链路均可通过。
  Evidence: 并发运行 `test:e2e:weapp:auth` 与 `test:e2e:weapp:catalog-real` 时，两者都报 `login.route.left.login failed`；单独调试同一 `dist/weapp` 产物可成功从登录页进入首页，并在串行重跑后得到 `WEAPP_AUTH_E2E:PASS` 与 `WEAPP_CATALOG_REAL_E2E:PASS`。

- Observation: miniapp catalog real E2E 不能依赖 `page.data()` 直接读 React 运行时状态，因为在当前 Taro + automator 组合下首页/分类页只暴露 `root` 节点。
  Evidence: 首轮 `weapp-catalog-real-e2e.js` 读取到的 `homeDataKeys=["root"]`，误判 `products=0`；改为“页面路由断言 + Node 侧真实 HTTP 接口校验”后通过。

## Decision Log

- Decision: 本计划的第一阶段只收口“登录 + 目录 + 询价”跨端联调，不把导入、支付、供应商、视觉回归纳入强依赖。
  Rationale: 这些功能要么仍含 hybrid 路径，要么依赖更多尚未统一的数据准备。先把跨端共享最核心的数据与身份链路收口，能更快形成稳定基线。
  Date/Author: 2026-03-07 / Codex

- Decision: 本地 miniapp 联调默认采用 `IDENTITY_LOGIN_MODE=real`，同时开启 `IDENTITY_ENABLE_PHONE_PROOF_SIMULATION=true` 作为审核前和本地自动化的手机号证明兜底。
  Rationale: 这样最接近最终真实链路，同时避免把本地自动化完全绑定到真实平台凭证。
  Date/Author: 2026-03-07 / Codex

- Decision: 本计划中的 “real e2e” 定义为“真实数据库 + 真实后端 + 不 stub 业务接口”。任何仍通过前端测试框架伪造业务接口响应的用例必须归类为 hybrid，而不是 real。
  Rationale: 只有先把术语定义清楚，联调结果才不会被误判。
  Date/Author: 2026-03-07 / Codex

- Decision: `packages/shared/src/mock-data/*` 继续服务 mock 模式和纯前端测试，但不作为真实联调的事实来源。真实联调事实以数据库 seed 与 seed 校验脚本为准。
  Rationale: mock 数据可以存在，但不能反向定义真实库应当长什么样，否则两端会继续漂移。
  Date/Author: 2026-03-07 / Codex

- Decision: inquiry seed 已落地后，`tools/scripts/dev-seed-check.sh` 改为默认严格校验固定 inquiry fixture，仅在显式设置 `DEV_SEED_CHECK_REQUIRE_INQUIRIES=false` 时降级。
  Rationale: 既然联调链路中的 inquiry 实体已经可重复生成，就应该把它提升为默认门禁，而不是继续允许“无询价数据”的软通过。
  Date/Author: 2026-03-07 / Codex

- Decision: admin-web 的 Playwright real/hybrid 配置统一采用“同时兼容 `-real`/`.real` 与 `-hybrid`/`.hybrid`”的命名匹配规则。
  Rationale: 仓库内已存在 `p0-real.spec.ts` 这种短横线命名，如果只匹配 `.real` 会导致 real 测试组静默为空。
  Date/Author: 2026-03-07 / Codex

- Decision: 本地 Docker 后端默认配置改为 `IDENTITY_LOGIN_MODE=real` + `IDENTITY_ENABLE_PHONE_PROOF_SIMULATION=true`。
  Rationale: 这与本计划确定的本地联调基线一致，既保留真实模式行为，又避免 miniapp 自动化因平台手机号证明而无法在本地稳定复现。
  Date/Author: 2026-03-07 / Codex

- Decision: identity 平台解析器在“real 模式但未配置平台凭证”时，对显式 `mock_*` code 开启本地联调回退；非 `mock_*` code 仍保持失败。
  Rationale: 这让本地 e2e 可以继续使用真实数据库与真实后端，同时不会把任意字符串误当成合法平台 code。
  Date/Author: 2026-03-07 / Codex

- Decision: `dev-seed-check.sh` 以真实 HTTP 接口为准，不再假设接口返回体形状与脚本作者记忆一致；一旦形状不符，优先修脚本而不是放宽校验。
  Rationale: 本计划的核心是让本地联调门禁贴近真实行为，如果校验脚本自己脱离接口真相，就会重新制造“假通过”。
  Date/Author: 2026-03-07 / Codex

- Decision: `tools/scripts/e2e-local-stack.sh` 默认强制设置 `DEV_STACK_BUILD_IMAGES=true`，必要时再通过 `E2E_LOCAL_FORCE_BUILD_IMAGES=false` 关闭。
  Rationale: 一键联调入口的目标是验证当前代码，而不是复用可能已经漂移的本地旧容器；这里优先 correctness，而不是本地速度。
  Date/Author: 2026-03-07 / Codex

- Decision: miniapp 本地真实 E2E 默认带 `TARO_APP_WEAPP_PHONE_PROOF_SIMULATION=true`，并保持串行执行。
  Rationale: 这与本地 identity 的手机号模拟约定一致，且能避免共享 DevTools 端口导致的伪失败。
  Date/Author: 2026-03-07 / Codex

## Outcomes & Retrospective

- (2026-03-07 10:35Z) 完成 ExecPlan 首版落盘，明确了 real e2e / hybrid e2e 边界、第一阶段联调范围，以及后续实现的优先级。
- (2026-03-07 10:52Z) 完成第一批基线收口：新增本地统一 e2e 编排脚本、真实 seed 校验脚本，并将 admin-web 的 stub 型导入用例从 real 重新归类为 hybrid。
- (2026-03-07 12:11Z) 完成第二批联调修复：本地 Docker 配置补齐手机号模拟环境，identity 支持在无平台凭证的 real 模式下使用显式 `mock_*` code 进行本地回退，`dev-seed-check.sh` 实跑通过（询价仍为 warning）。
- (2026-03-07 13:15Z) 完成第三批收口：新增 miniapp `catalog-real` 业务 E2E、把 payment admin 接口前移到 smoke 阶段、统一总入口默认强制重建后端镜像，以避免把旧容器误判为源码缺陷。
- (2026-03-07 13:46Z) 完成第四批收口：通过本地 `go run` 当前源码替换旧 `identity/payment/commerce/gateway` 容器后，`admin-web real e2e` 已通过；miniapp auth 与 catalog real E2E 也已在串行执行下通过。
- (2026-03-07 14:02Z) 完成第五批验收：复用当前本地源码服务运行统一编排脚本，seed-check、admin-web smoke、miniapp HTTP smoke、admin-web real、miniapp auth、miniapp catalog real 均通过。
- (2026-03-07 14:10Z) 完成第六批收口：`commerce-seed` 补齐固定 inquiry fixture 与 inquiry message，`dev-seed-check` 默认严格校验 inquiry 合同，计划中最后一个“询价种子仍缺”的未完成项关闭。

## Context and Orientation

这是一个 monorepo。当前真实可运行的后端栈通过 `tools/scripts/dev-stack-up.sh` 启动，底层依赖 `infra/dev/docker-compose.yml`、`infra/dev/docker-compose.backend.yml` 和可选的 `infra/dev/docker-compose.dev.yml`。默认会启动本地 Postgres，并运行 `identity`、`commerce`、`payment`、`ai` 和 `gateway-bff`。对前端而言，唯一推荐的后端入口应当是 gateway，也就是 `http://localhost:8080`。

身份数据由 `services/identity/cmd/identity-seed/main.go` 写入。商品目录数据由 `services/commerce/cmd/commerce-seed/main.go` 写入。两者的包装脚本分别是 `tools/scripts/identity-seed.sh` 和 `tools/scripts/commerce-seed.sh`，合并入口是 `tools/scripts/dev-seed.sh`。这些 seed 已经具备“可重复执行”的特点，也就是重复运行时会收敛到稳定结果，而不是不断插入脏数据。

`apps/admin-web` 是后台管理站点。真实模式入口是 `pnpm -C apps/admin-web dev:real`，通过 Vite 代理把 `/api` 转发到 `http://localhost:8080`。`apps/admin-web/tests/e2e/p0-real.spec.ts` 已经是真实后端读取型测试的雏形，但 `apps/admin-web/tests/e2e/import.real.spec.ts` 仍是 hybrid 路径。

`apps/miniapp` 是小程序跨端工程。它已经有基于微信开发者工具和 `miniprogram-automator` 的自动化基础脚本，包括 `apps/miniapp/scripts/weapp-auth-e2e.js` 与 `tools/scripts/miniapp-smoke.sh`。miniapp 当前默认通过 `http://localhost:8080` 访问 gateway，相关解析逻辑在 `apps/miniapp/src/services/api-base-url.ts`。这意味着 miniapp 真实联调的关键不是新增一套访问方式，而是固定环境变量、seed 和验证顺序。

本计划中会使用三个术语。`real e2e` 指真实数据库、真实后端、真实前端页面，不伪造业务接口响应。`hybrid e2e` 指前端流程是真实运行，但部分业务接口由测试代码伪造响应。`seed 校验` 指一个只读脚本，用来读取真实数据库或真实后端接口，确认联调用的账号、角色、分类、商品、询价等实体已按约定存在。

## Plan of Work

第一步是收口环境入口。执行者需要把当前分散的“起后端”“seed”“跑 admin-web”“跑 miniapp”整合成单一路径，并把所有约定写死到文档和脚本里。这里的目标不是新增很多入口，而是规定唯一推荐入口。后端统一用 `tools/scripts/dev-stack-up.sh`，数据库统一用本地 Postgres，前端统一通过 gateway `http://localhost:8080` 联调，miniapp 联调统一说明开发者工具依赖、构建命令和 automator 前置条件。

第二步是定义真实联调数据合同。执行者需要明确哪些数据是所有端共享的。身份侧至少要包括：`admin`、`boss`、`manager`、`cs`、`mock_customer_001`、`mock_sales_001`、`mock_multi_001` 这些账号或身份码及其角色含义。目录侧至少要包括一组稳定的分类、商品、SKU 和价格阶梯，保证 admin-web 与 miniapp 都能看到。询价侧至少要包括一条能被后台查询到、同时能与 miniapp 身份形成用户故事闭环的数据记录。这里不要求一开始追求全量业务实体，但要求联调链路中的实体全部稳定、可重复、可验证。

第三步是增加 seed 校验门。执行者应新增一个只读脚本，优先通过 gateway/服务接口验证，也可以在必要时直接查数据库。这个脚本必须在 e2e 之前运行，并明确失败原因，例如“boss 账号不存在”“mock_multi_001 未绑定多角色”“catalog 产品为空”“询价种子缺失”。这个脚本的目标不是替代 e2e，而是提前阻断无意义的失败。

第四步是整理 admin-web e2e。执行者需要把现有测试分成真实联调与 hybrid 两组。像 `p0-real.spec.ts` 这种真实读取型测试，应扩展为明确覆盖登录、bootstrap、用户运营列表读取、询价列表读取和必要的权限校验。像 `import.real.spec.ts` 这种仍依赖 `page.route()` 的用例，应改名或改目录，明确归入 hybrid，避免误导。第一阶段不要求覆盖后台所有页面，只要求跨端相关的后台路径稳定。

第五步是整理 miniapp e2e。现有的 `weapp-auth-e2e.js` 已经证明可以做真实登录链路验证，但它还没有把 catalog 和询价链路一起拉通。执行者需要在现有 automator 基础上新增一条业务型 e2e，用真实登录后的 token 和 bootstrap 继续访问首页、分类页、商品详情页，并在询价相关页面完成至少一个对用户有意义的动作。这里的关键是页面读到的内容要来自真实后端和真实 seed，而不是 isolated mock runtime。

第六步是提供一条统一总入口。执行者应新增一个统一脚本，顺序固定为：启动 dev stack、运行 migrate/seed、执行 seed 校验、运行 gateway/admin/miniapp smoke、运行 admin-web real e2e、运行 miniapp real e2e。脚本失败时必须能从输出中快速看出是环境失败、seed 失败、登录失败还是页面行为失败。执行者不需要一次性把 CI 也设计好，但要保证本地结果目录和日志路径清晰可读。

## Concrete Steps

以下步骤假设执行者位于仓库根目录。

先启动本地后端栈。该命令会启动 Postgres、执行 bootstrap/seed，并等待服务 readiness：

    bash tools/scripts/dev-stack-up.sh

成功时应看到类似输出：

    [dev-stack-up] starting postgres container...
    [dev-stack-up] bootstrapping databases (migrate + seed)...
    [dev-stack-up] starting backend containers (identity/commerce/payment/gateway)...
    [dev-stack-up] waiting for service readiness...
    [dev-stack-up] backend stack is ready.

如果需要显式重跑通用 seed，可以再次执行：

    bash tools/scripts/dev-seed.sh

然后运行后端健康检查与最小 smoke，确认 gateway、catalog 与 bootstrap 都能访问：

    bash tools/scripts/dev-stack-health.sh
    bash tools/scripts/admin-web-smoke.sh
    bash tools/scripts/miniapp-http-smoke.sh

在后台前端目录启动真实模式：

    pnpm -C apps/admin-web dev:real

如果要运行 admin-web 的真实 e2e：

    pnpm -C apps/admin-web test:e2e:real

在 miniapp 目录构建微信开发版本并执行登录 e2e：

    pnpm -C apps/miniapp run build:weapp:dev
    pnpm -C apps/miniapp run test:e2e:weapp:auth

当 miniapp 业务型 e2e 落地后，执行方式也应在这里补齐，并与现有登录脚本并列给出。例如：

    pnpm -C apps/miniapp run test:e2e:weapp:catalog-real

如果需要一键运行全部联调验证，本计划要求最终提供一个统一脚本，命令形式固定为：

    bash tools/scripts/e2e-local-stack.sh

这个脚本在第一次落地时应打印每个阶段的开始、结束和失败位置，输出应足够短，但必须能让执行者判断下一步去看哪份日志。

## Validation and Acceptance

验收的重点是“能否对一个没有上下文的新同学复现成功”。

首先验收环境。执行 `bash tools/scripts/dev-stack-up.sh` 后，`http://localhost:8080/health` 应返回 HTTP 200 和 `OK`，gateway bootstrap、catalog categories、catalog products 均可通过 smoke 命令成功读取。若环境未就绪，本计划视为未完成。

其次验收通用 seed。运行 seed 校验脚本后，必须能看到固定账号、固定角色、固定商品和固定询价数据全部存在。`boss/boss123` 必须能够完成后台密码登录；`mock_customer_001`、`mock_sales_001`、`mock_multi_001` 必须能够在 miniapp 真实模式下按约定触发登录或角色选择路径；catalog 不能是空列表；用于跨端验证的询价记录不能缺失。

再次验收 admin-web。执行 `pnpm -C apps/admin-web test:e2e:real` 时，真实模式必须完成至少一条登录和业务读取闭环。页面上看到的数据必须来自后端，不允许通过 `page.route()` 伪造接口结果。若某条用例仍依赖 stub，它必须被归类为 hybrid，不得记作 real 通过。

最后验收 miniapp。执行 miniapp 登录 e2e 与业务型 e2e 时，必须能在真实模式下拿到 token 和 bootstrap，并从真实后端读到目录数据。至少一个真实业务型页面需要被证明不是 isolated mock mode。失败时日志中应能明确区分是开发者工具连接失败、登录失败、bootstrap 失败还是 catalog/询价接口失败。

当且仅当执行者能按照本文档顺序，从零完成“起环境 -> 跑 seed -> 验 seed -> 跑 admin-web real e2e -> 跑 miniapp real e2e”，并且看到两端消费同一套真实数据时，本计划才算验收通过。

## Idempotence and Recovery

本计划中的数据库初始化和 seed 必须可重复执行。`tools/scripts/dev-stack-up.sh`、`tools/scripts/dev-seed.sh`、未来新增的 seed 校验脚本都必须在重复运行时保持收敛，不因为第二次执行而制造重复数据或伪失败。

如果数据库状态被污染，优先采用“停栈、清理本地 Postgres 数据卷、重新起栈、重新 seed”的恢复路径，而不是手工修改数据库。恢复步骤应在最终脚本与 README 中写清楚。对 miniapp 而言，如果本地存储中的 token 或 bootstrap 造成脏状态，应允许自动化脚本在开始阶段主动清理 storage，而不是要求执行者手工点页面。

如果某个 real e2e 因接口尚未打通而不得不临时依赖 stub，那么执行者必须把该用例明确降级为 hybrid，并在 `Decision Log` 与测试命名中同步修改。不得保留“文件名叫 real，实际是 hybrid”的中间状态。

## Artifacts and Notes

本计划实施后，应在本节保留最关键的成功和失败证据，供后来者对照。以下是最终希望看到的最小证据形式。

环境健康检查示例：

    $ curl -i http://localhost:8080/health
    HTTP/1.1 200 OK
    ...
    OK

后台 smoke 成功示例：

    [admin-web-smoke] checking gateway health...
    [admin-web-smoke] admin password login...
    [admin-web-smoke] boss password login...
    [admin-web-smoke] admin list products...
    [admin-web-smoke] admin list orders...
    [admin-web-smoke] all checks passed.

miniapp 登录 e2e 成功示例：

    {
      "status": "pass",
      "checks": [
        { "name": "login.page.entered", "pass": true },
        { "name": "login.token.exists", "pass": true },
        { "name": "login.bootstrap.has.me", "pass": true }
      ]
    }
    WEAPP_AUTH_E2E:PASS

seed 校验失败示例应像这样清楚指出原因：

    [seed-check] FAIL identity fixture missing: mock_multi_001 roles != [CUSTOMER, SALES]
    [seed-check] FAIL commerce fixture missing: catalog products count = 0
    [seed-check] abort before e2e

## Interfaces and Dependencies

本计划依赖的后端入口必须保持稳定。后端一律通过 gateway `http://localhost:8080` 暴露给前端。执行者不得让 admin-web 直连某个服务端口，也不得让 miniapp 使用另一套 base URL 规则，否则联调将失去统一入口。

本计划依赖以下现有脚本和模块，并要求在实现时优先复用，而不是重复造轮子。`tools/scripts/dev-stack-up.sh` 是本地后端起栈入口。`tools/scripts/dev-seed.sh` 是通用 seed 入口。`tools/scripts/admin-web-smoke.sh` 和 `tools/scripts/miniapp-smoke.sh` 是现有 smoke 基础。`apps/admin-web/tests/e2e` 是后台 Playwright 测试目录。`apps/miniapp/scripts/weapp-auth-e2e.js` 是 miniapp 真实登录自动化基础。

本计划要求新增的接口或脚本名字也应尽量稳定、可读。推荐新增一个只读校验脚本，路径为 `tools/scripts/dev-seed-check.sh`，职责是检查真实数据库和真实接口中的联调前置实体。推荐新增一个统一总入口脚本，路径为 `tools/scripts/e2e-local-stack.sh`，职责是编排整个本地联调流程。推荐把 hybrid 测试与 real 测试分目录或分命名规则管理，避免后续继续混淆。

miniapp 自动化继续依赖微信开发者工具 CLI 和 `miniprogram-automator`。这是一个外部运行时前提，不是仓库内部代码可以消除的约束，因此必须在最终文档中写明。执行者在实现过程中如果发现不同机器的 CLI 路径不一致，应把差异吸收进环境变量约定，而不是要求测试代码写死多套逻辑。

文档修订说明：2026-03-07 首版起草。新增原因是当前仓库虽已有多段联调与 e2e 基础设施，但缺少一份按 `PLANS.md` 约束编写、可指导新同学从零完成本地跨端真实联调的统一执行文档。
2026-03-07 第二次修订。新增原因是第一批实现已经落地，需要把统一编排脚本、seed 校验脚本、以及 inquiry seed 尚未收口的现实状态同步回写到文档。
2026-03-07 第三次修订。新增原因是本地真实联调已经实跑，暴露并修复了 identity real-mode 本地回退与 seed-check 假设问题，同时确认了当前 admin-web real e2e 的网关阻塞点。
