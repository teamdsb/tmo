# Miniapp 测试说明

当前 miniapp 使用 Jest 作为单元测试框架，并提供基于 `miniprogram-automator` 的微信端 E2E 脚本（登录/退出主流程）。

## 构建命令

在仓库根目录执行，构建产物输出到 `apps/miniapp/dist/<platform>`：

    pnpm -C apps/miniapp build:weapp:dev
    pnpm -C apps/miniapp build:weapp
    pnpm -C apps/miniapp build:alipay
    pnpm -C apps/miniapp build:tt
    pnpm -C apps/miniapp build:swan
    pnpm -C apps/miniapp build:qq
    pnpm -C apps/miniapp build:jd
    pnpm -C apps/miniapp build:h5

说明：

- `build:weapp:dev` 用于本地联调（默认校验 API 基址应指向 `localhost:8080`）。
- `build:weapp` 用于生产构建，若仍使用占位域名 `api.example.com` 会直接失败。
- 如需临时允许占位域名（例如演示包），可设置 `MINIAPP_ALLOW_PLACEHOLDER_API=true`。

## 前后端联调（WeChat/Alipay）

默认通过 gateway-bff 访问 identity + commerce。建议在 `apps/miniapp/.env.development` 配置：

    TARO_APP_ID=wx8e8831fc456f019b
    TARO_APP_MOCK_MODE=off
    TARO_APP_API_BASE_URL=http://localhost:8080
    TARO_APP_ENABLE_MOCK_LOGIN=false

启动后端（本地）：

    bash tools/scripts/dev-bootstrap.sh
    bash tools/scripts/dev-seed.sh
    cd services/identity && IDENTITY_HTTP_ADDR=":8081" go run ./cmd/identity
    cd services/commerce && COMMERCE_HTTP_ADDR=":8082" go run ./cmd/commerce
    cd services/payment && PAYMENT_HTTP_ADDR=":8083" go run ./cmd/payment
    cd services/gateway-bff && GATEWAY_HTTP_ADDR=":8080" \
      GATEWAY_IDENTITY_BASE_URL="http://localhost:8081" \
      GATEWAY_COMMERCE_BASE_URL="http://localhost:8082" \
      GATEWAY_PAYMENT_BASE_URL="http://localhost:8083" \
      go run ./cmd/gateway-bff

启动前端（按平台）：

    pnpm -C apps/miniapp dev:weapp
    pnpm -C apps/miniapp dev:alipay

容器化后端（可选）：

    docker compose -f infra/dev/docker-compose.yml up -d
    bash tools/scripts/dev-bootstrap.sh
    bash tools/scripts/dev-seed.sh
    cp infra/dev/backend.env.example infra/dev/backend.env.local
    docker compose --env-file infra/dev/backend.env.local \
      -f infra/dev/docker-compose.yml \
      -f infra/dev/docker-compose.backend.yml up -d

说明：

- `TARO_APP_MOCK_MODE=isolated` 会启用“分离 mock 模式”：gateway/identity/commerce 全链路离线，不访问后端，数据本地持久化（支持设置页重置）。
- `TARO_APP_MOCK_MODE=off`（默认）时走真实后端，不再提供运行时 commerce 自动 fallback 到 mock。
- `TARO_APP_ENABLE_MOCK_LOGIN` 默认为关闭（`false`）；且仅在 `TARO_APP_MOCK_MODE=isolated` 时才会展示“测试登录”按钮。
- 如果使用容器化后端，保持 `TARO_APP_API_BASE_URL=http://localhost:8080` 即可。
- `dev:weapp` 启动前会清理 `dist/weapp`，并在 watch 构建后自动校验页面路由、tabBar 图标与 API 基址，避免旧产物导致 `demand 2`、`__route__`、`api.example.com` 类问题。
- 商品接口返回的图片 URL 默认由 gateway 服务端改写为 `${TARO_APP_API_BASE_URL}/assets/img?url=...`；若已迁移到本地媒体目录则会直接返回 `${TARO_APP_API_BASE_URL}/assets/media/...`。前端仅负责渲染与占位兜底。
- 微信环境建议使用真实 `TARO_APP_ID`；游客模式（`touristappid`）下，微信登录和手机号授权会受限。
- `IDENTITY_LOGIN_MODE=real` 时，`/auth/mini/login` 必须携带 `phoneProof`，小程序登录会触发手机号授权。

支付宝稳定模式：

- `pnpm -C apps/miniapp build:alipay` 会执行构建、后处理与产物完整性校验。
- `pnpm -C apps/miniapp dev:alipay` 为稳定模式入口，等价于执行一次 `build:alipay`（不提供实时 watch 发布）。

平台导入目录：

- 微信开发者工具：`apps/miniapp/dist/weapp`
- 支付宝开发者工具：`apps/miniapp/dist/alipay`

## 微信 DevTools CDP 自动抓包调试

该方案用于“无 mock 的联调抓错”：会校验开发环境变量、构建 weapp（`NODE_ENV=development`）、通过 `miniprogram-automator` 连接微信 DevTools，并采集 console/network/截图到 `apps/miniapp/.logs/weapp/`。

执行方式（在仓库根目录）：

    pnpm -C apps/miniapp debug:weapp:auto
    pnpm -C apps/miniapp debug:weapp:smoke

说明：

- `debug:weapp:auto` 会先执行 `tools/scripts/dev-stack-up.sh`（拉起 postgres + backend 容器、migrate/seed、健康检查），再执行采集脚本。
- `dev-stack-up.sh` 默认不强制重建镜像；如需重建可加 `DEV_STACK_BUILD_IMAGES=true`。
- `debug:weapp:smoke` 默认执行 4 条核心路由（首页/分类/搜索/商品详情）的 automator 烟测，并把每条路由的日志单独归档到 `apps/miniapp/.logs/weapp/routes/`。
- 若只想快速验证后端核心接口和图片代理，不启用微信 DevTools，可执行：

      bash tools/scripts/miniapp-http-smoke.sh
- 如果你只想采集（后端已在运行），执行：

      pnpm -C apps/miniapp debug:weapp:collect

关键环境变量：

- `WEAPP_DEVTOOLS_CLI_PATH`：微信开发者工具 CLI 路径（可选）。
- `WEAPP_AUTOMATOR_PORT`：automator websocket 端口，默认 `9527`。
- `WEAPP_AUTOMATOR_CONNECT_TIMEOUT_MS`：automator 连接等待超时，默认 `45000`（兼容旧变量 `WEAPP_CDP_CONNECT_TIMEOUT_MS`）。
- `WEAPP_AUTOMATOR_ROUTE`：采集前自动跳转路由，默认 `/pages/index/index`。
- `WEAPP_AUTOMATOR_ROUTES`：多路由采集矩阵（逗号或换行分隔）；设置后会按顺序执行并汇总结果。
- `WEAPP_AUTOMATOR_FORCE_RELAUNCH`：采集前是否强制 `reLaunch` 到目标路由，默认 `true`。
- `WEAPP_AUTOMATOR_ACCOUNT`：指定 automator 启动账号（可选）。
- `WEAPP_AUTOMATOR_TRUST_PROJECT`：是否信任项目，默认 `true`。
- `WEAPP_SMOKE_SPU_ID`：烟测详情页使用的 `spuId`，默认 `22222222-2222-2222-2222-222222222222`。
- `WEAPP_SMOKE_ASSERT_MIN_PRODUCTS`：首页最小商品数断言，默认 `1`。
- `WEAPP_SMOKE_ASSERT_CATEGORY_MIN`：分类最小数量断言，默认 `1`。
- `WEAPP_SMOKE_ASSERT_IMAGE_SUCCESS_MIN`：图片请求成功数最小断言，默认 `1`。
- `WEAPP_SMOKE_ASSERT_NO_CONSOLE_ERROR`：是否要求 `console.error` 必须为 0，默认 `true`。
- `WEAPP_SMOKE_ROUTE_WAIT_MS`：路由稳定等待时长（毫秒），默认 `8000`。
- `WEAPP_DEBUG_TIMEOUT_MS`：采集超时，默认 `90000`。
- `WEAPP_BASE_URL_EXPECTED`：期望接口基准地址，默认 `http://localhost:8080`。
- `WEAPP_FAIL_ON_ERROR`：遇到错误是否退出非 0，默认 `true`。
- `WEAPP_STRICT_P1`：是否将 P1 问题按阻断处理，默认 `true`。
- `WEAPP_SKIP_LAUNCH`：跳过自动拉起 DevTools，仅连接已有 automator 端口（默认 `false`）。
- `MINIAPP_SMOKE_STACK_UP`：仅 `debug:weapp:smoke` 使用；为 `true` 时先执行 `tools/scripts/dev-stack-up.sh` 再采集。

排错：

- 若 `summary.md` 中出现 `request:fail url not in domain list`，脚本会自动把 `dist/weapp/project.config.json` 的 `setting.urlCheck` 置为 `false`；请重跑一次采集并确认微信开发者工具“详情 -> 本地设置 -> 不校验合法域名”也已开启。
- 若 `summary.md` 中出现连接失败，先确认微信开发者工具可执行文件路径正确（`WEAPP_DEVTOOLS_CLI_PATH`），并检查 `WEAPP_AUTOMATOR_PORT` 是否被占用。
- `summary.md` 会输出 `P0/P1/P2` 分级：`P0`（启动/请求阻断）必失败，`P1`（核心流程失败）默认阻断，`P2`（平台告警/弃用提示）仅告警。

产物：

- `apps/miniapp/.logs/weapp/console.jsonl`
- `apps/miniapp/.logs/weapp/network.jsonl`
- `apps/miniapp/.logs/weapp/summary.md`
- `apps/miniapp/.logs/weapp/routes/*/{summary.md,console.jsonl,network.jsonl}`（多路由模式）
- `apps/miniapp/.logs/weapp/failures/*.png`

## 微信登录/退出 E2E（Auth）

该 E2E 用于固定验证“快速登录 + mine 页退出登录”主链路，脚本在 `apps/miniapp/scripts/weapp-auth-e2e.js`。

执行方式（在仓库根目录）：

    pnpm -C apps/miniapp test:e2e:weapp:auth:dev

如果你已经提前构建好 `dist/weapp`，可仅执行：

    pnpm -C apps/miniapp test:e2e:weapp:auth

脚本覆盖的断言：

- 进入登录页，勾选协议并点击“快速登录”。
- 登录后必须离开 `/pages/auth/login/index`。
- `tmo:auth:token` 必须写入，`tmo:bootstrap` 必须包含 `me`。
- 进入 mine 页点击 `#mine-logout-btn` 后，`tmo:auth:token` 与 `tmo:bootstrap` 必须清空。
- 控制台不得出现以下错误：`Headers is not defined`、`identity login failed`、`logout failed`，且 runtime exception 必须为 0。

前置条件：

- 已安装微信开发者工具，且可用 CLI（默认自动探测；必要时设置 `WEAPP_DEVTOOLS_CLI_PATH`）。
- 本地后端可用（通常为 `http://localhost:8080`），并完成基础 seed。
- 建议使用 `test:e2e:weapp:auth:dev`，会以 `NODE_ENV=development` 构建，便于审核期模拟手机号链路联调。

可用环境变量：

- `WEAPP_DEVTOOLS_CLI_PATH`：微信开发者工具 CLI 路径（可选）。
- `WEAPP_AUTOMATOR_PORT`：automator websocket 端口，默认 `9527`。
- `WEAPP_AUTH_E2E_TIMEOUT_MS`：E2E 执行超时，默认 `90000`。

输出与退出码：

- 成功时输出 `WEAPP_AUTH_E2E:PASS`。
- 失败时输出 `WEAPP_AUTH_E2E:FAIL`，并返回非 0 退出码（可直接接入本地脚本或 CI 的阻断条件）。

## 支付宝 Web 调试器 console 采集

该脚本会使用 minidev 启动 DevServer，并打开 Web 模拟器来采集 console 日志，输出到 `apps/miniapp/.logs/`。

准备工作（首次执行）：

    npm i -g minidev --registry=https://registry.npmmirror.com
    minidev login

执行采集（在仓库根目录）：

    pnpm -C apps/miniapp test:alipay-console

可用环境变量：

- `ALIPAY_PROJECT_DIR`：默认 `apps/miniapp/dist/alipay`
- `ALIPAY_CONSOLE_TIMEOUT_MS`：采集超时，默认 60000
- `ALIPAY_CONSOLE_EXIT_ON_ERROR`：遇到 error 是否失败，默认 true
- `ALIPAY_WEB_URL`：手动指定 Web 模拟器 URL
- `CHROME_EXECUTABLE_PATH`：本机 Chrome 路径（macOS 默认自动探测）

日志输出：

- `apps/miniapp/.logs/alipay-console.jsonl`
- `apps/miniapp/.logs/alipay-devserver.log`

文档参考：

- https://opendocs.alipay.com/mini/02q17j?pathHash=c8856bdf

排错：

- 不要让微信和支付宝共用同一个导入目录，必须分别导入 `dist/weapp` 与 `dist/alipay`。
- 如果微信工具报 `ENOENT ... pages/demand 2/index.wxml` 或 `__route__ is not defined`：
  1) 关闭项目并清除微信开发者工具编译缓存；
  2) 在 `apps/miniapp` 目录重新执行 `pnpm run build:weapp:dev`（已内置清理、路由产物校验、API 基址校验）；
  3) 重新导入 `apps/miniapp`（不要导入仓库根目录或 `dist/weapp` 本身）。
- 如果构建报 `[verify-weapp-api-base] ... api.example.com`：
  - 优先检查 `apps/miniapp/.env.development` 与终端环境变量 `TARO_APP_API_BASE_URL`；
  - 本地联调请使用 `pnpm -C apps/miniapp build:weapp:dev` 或 `pnpm -C apps/miniapp dev:weapp`。
- 如果首页仍显示 mock 商品，先确认 `.env.development` 中 `TARO_APP_MOCK_MODE=off`，然后删除 `apps/miniapp/dist/weapp` 并重新执行 `pnpm -C apps/miniapp dev:weapp` 后重新导入开发者工具。
- 若微信端图片显示异常，先检查 gateway 的 `GATEWAY_PUBLIC_BASE_URL` 与 `GATEWAY_IMAGE_PROXY_ALLOWLIST`；默认通过 `/assets/img` 代理时不需要把第三方图床直接加入小程序图片白名单。
- 如果支付宝开发者工具导入 `apps/miniapp/dist/alipay` 后出现 `ENOENT ... dist/dist/app.json`，请检查 `apps/miniapp/dist/alipay/mini.project.json` 中的 `miniprogramRoot`，应为 `./`。
- 如果出现 `CE1000.01 cannot resolve module ...*.axml`，先执行 `pnpm -C apps/miniapp build:alipay`，再根据 `verify-alipay-dist` 输出补齐缺失文件后重试导入。

## 导航栏高度约定

自定义导航栏高度通过 `apps/miniapp/src/utils/navbar.ts` 动态计算（综合状态栏、safeArea.top、微信胶囊按钮），并在各页面的 `Navbar` 上注入 `--navbar-top`、`--navbar-height`、`--navbar-line-height`、`--navbar-total-height`。

约定：

- 主标签页（首页/分类/购物车/我的）与二级页面统一使用 `safeArea='top'`。
- `app-navbar--primary` 仅作为视觉变体类，不应覆盖导航栏高度。
- 当微信开发者工具返回异常胶囊参数时，导航栏使用 `44px` 作为内容高度兜底，避免顶部重叠。

## 原子 CSS (Tailwind)

miniapp 已启用 Tailwind CSS 作为原子 CSS 框架。配置位于 `apps/miniapp/tailwind.config.cjs`（已关闭 preflight），并通过 CLI 生成 `apps/miniapp/src/styles/tailwind.generated.css`，该文件由 `apps/miniapp/src/app.scss` 引入。

使用方式：在 JSX 中直接添加 utility 类（例如 `className="text-sm text-blue-600"`），与现有 SCSS 可以并存。

生成 Tailwind CSS（在 `apps/miniapp` 目录执行）：

    pnpm run build:tailwind

本地开发时如果需要实时更新 Tailwind 输出，可在另一个终端启动监听：

    pnpm run dev:tailwind

说明：所有 `build:*` 脚本通过 `prebuild:*` 自动执行 `build:tailwind`，`dev:weapp` 只会先生成一次，如需热更新请额外运行 `dev:tailwind`。

## 测试命令

在仓库根目录执行：

    pnpm -C apps/miniapp test

执行 lint（eslint + stylelint + 类型检查）：

    pnpm -C apps/miniapp lint

仅执行类型检查：

    pnpm -C apps/miniapp lint:types

## 测试覆盖情况

- 单元测试由 Jest 执行，配置文件在 `apps/miniapp/jest.config.cjs`。
- 已提供微信登录/退出主流程 E2E（`test:e2e:weapp:auth` / `test:e2e:weapp:auth:dev`），用于回归验证 token/bootstrap 写入与清理。
- 已提供基于 `miniprogram-automator` 的 WeChat 多路由烟测脚本（`debug:weapp:smoke`），并输出路由级别日志与截图。
- TypeScript 类型检查已包含在 `pnpm -C apps/miniapp lint` 中，命令为 `tsc -p tsconfig.json --noEmit`。
