# Miniapp 测试说明

当前 miniapp 使用 Jest 作为单元测试框架，暂未配置专门的 UI 或集成测试。

## 构建命令

在仓库根目录执行，构建产物输出到 `apps/miniapp/dist/<platform>`：

    pnpm -C apps/miniapp build:weapp
    pnpm -C apps/miniapp build:alipay
    pnpm -C apps/miniapp build:tt
    pnpm -C apps/miniapp build:swan
    pnpm -C apps/miniapp build:qq
    pnpm -C apps/miniapp build:jd
    pnpm -C apps/miniapp build:h5

说明：`build:*` 会生成对应平台的静态产物，可用于发布或在平台开发者工具中打开。

## 前后端联调（WeChat/Alipay）

默认通过 gateway-bff 访问 identity + commerce。建议在 `apps/miniapp/.env.development` 配置：

    TARO_APP_ID=wx8e8831fc456f019b
    TARO_APP_API_BASE_URL=http://localhost:8080
    TARO_APP_COMMERCE_MOCK_FALLBACK=true

启动后端（本地）：

    bash tools/scripts/dev-bootstrap.sh
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
    docker compose -f infra/dev/docker-compose.yml -f infra/dev/docker-compose.backend.yml up -d

说明：

- `TARO_APP_COMMERCE_MOCK_FALLBACK=false` 可以强制走真实后端，不再回退 mock 数据。
- 如果使用容器化后端，保持 `TARO_APP_API_BASE_URL=http://localhost:8080` 即可。
- 微信环境建议使用真实 `TARO_APP_ID`；游客模式（`touristappid`）下，微信登录相关 API 可能受限。

支付宝稳定模式：

- `pnpm -C apps/miniapp build:alipay` 会执行构建、后处理与产物完整性校验。
- `pnpm -C apps/miniapp dev:alipay` 为稳定模式入口，等价于执行一次 `build:alipay`（不提供实时 watch 发布）。

平台导入目录：

- 微信开发者工具：`apps/miniapp/dist/weapp`
- 支付宝开发者工具：`apps/miniapp/dist/alipay`

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
- 若微信端图片显示异常，请在小程序后台/开发者工具将 `images.unsplash.com`（以及你实际使用的图床域名，如 `lh3.googleusercontent.com`）加入图片下载白名单（downloadFile 合法域名）。
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
- 暂无端到端或截图测试。
- TypeScript 类型检查已包含在 `pnpm -C apps/miniapp lint` 中，命令为 `tsc -p tsconfig.json --noEmit`。
