# admin-web

`apps/admin-web` 是后台管理站点（Web）。

## 本地运行

1. 在仓库根目录安装依赖：

```bash
pnpm install
```

2. 启动后台前端（mock 模式，纯前端数据模拟）：

```bash
pnpm -C apps/admin-web dev:mock
```

3. 启动后台前端（dev 模式，连接真实后端）：

```bash
pnpm -C apps/admin-web dev:real
```

如果 real 模式下 `admin/admin123`、`boss/boss123` 等固定账号返回“账号或密码错误”，先在仓库根目录执行：

```bash
bash tools/scripts/identity-seed-check.sh
```

若检查失败，再执行：

```bash
bash tools/scripts/identity-repair.sh
```

4. 一键启动 backend + admin-web（dev 模式）：

```bash
pnpm run dev:admin-web:stack
```

5. 浏览器访问：

`http://localhost:5174`

## React 迁移说明

- 页面入口已切换为 React + TypeScript 多入口（仍保持 `*.html` URL 不变）。
- 原生版本完整快照保留在 `legacy/pages/`，页面 DOM 片段保留在 `legacy/fragments/`。
- 当前运行时已不再依赖 `src/*.js` 的 legacy DOM 脚本；`legacy/pages/` 仅保留为静态对照快照。

## 模式说明

- `mock`：纯前端模拟，不请求后端；登录启用固定账号校验（账号/密码必须命中预置账号），并按角色分级展示页面与权限。
- `dev`：严格真实鉴权，登录走 `POST /auth/password/login`，业务数据通过 gateway 获取。
  - 不展示固定示例数字/示例记录；没有后端数据时展示空态。
  - 暂未接入的 dashboard 扩展区块会明确标记为不可用，而不是展示 mock 卡片。

mock/dev 常用账号如下（dev 支持 `BOSS/MANAGER/ADMIN/CS` 密码登录）：

- username: `admin` / password: `admin123`（最高权限，兼容）
- username: `boss` / password: `boss123`（最高权限）
- username: `manager` / password: `manager123`
- username: `cs` / password: `cs123`

这些 dev 账号依赖 identity seed 基线。`dev-stack-up` 现在会在 backend 启动后强制校验这批账号能否真实登录；校验失败时会直接中断，而不是继续让前端连到坏环境。

默认 gateway 基址通过 Vite 代理 `/api -> http://localhost:8080`。
可通过环境变量 `ADMIN_WEB_PROXY_TARGET` 覆盖代理目标。

## ECS 部署

生产环境建议把 `admin-web` 部署到独立域名，例如 `https://admin.example.com`，后端 API 继续使用 `https://api.example.com`。

1. 在 ECS 上复制并编辑环境变量：

```bash
cd /opt/tmo
cp infra/prod/env.ecs.example infra/prod/env.ecs.local
```

至少确认这些值正确：

- `ADMIN_WEB_PUBLIC_BASE_URL`
- `ADMIN_WEB_API_BASE_URL`
- `ADMIN_WEB_DIST_DIR`
- `GATEWAY_PUBLIC_BASE_URL`

2. 构建并发布静态站点：

```bash
cd /opt/tmo
bash tools/scripts/prod-ecs-admin-web-build.sh
```

3. 配置 Nginx：

```bash
sudo cp infra/prod/nginx.admin.conf /etc/nginx/conf.d/tmo-admin.conf
```

然后把配置中的 `admin.example.com` 替换成真实域名，并确保 `root` 与 `ADMIN_WEB_DIST_DIR` 一致。

4. 验收：

```bash
ADMIN_WEB_BASE_URL=https://你的后台域名 bash tools/scripts/prod-ecs-smoke.sh
```

## 快速验收

```bash
pnpm run smoke:admin-web
```

默认 smoke 测试账号：

- username: `admin` / password: `admin123`
- username: `boss` / password: `boss123`
- username: `manager` / password: `manager123`
- username: `cs` / password: `cs123`

## Real E2E

真实套件会写入商品、导入任务及履约数据，只连接明确指定的本机隔离测试栈。数据库应为可丢弃的测试数据库，服务和前端使用独立端口。

```bash
TMO_ADMIN_REAL_ISOLATED=1 \
ADMIN_WEB_PROXY_TARGET=http://127.0.0.1:58080 \
ADMIN_WEB_PAYMENT_PROXY_TARGET=http://127.0.0.1:58083 \
pnpm -C apps/admin-web test:e2e:real
```

- Playwright 自启前端使用 `127.0.0.1:5175`、`strictPort`，不会复用已有服务器。
- 两个代理目标必须是 HTTP(S) loopback origin，不能带凭据、路径、查询或片段；自启前端固定使用 `/api` 和 `/payment-api`，不继承外部 VITE API 地址。
- 已启动隔离前端时，可显式设置 `ADMIN_WEB_BASE_URL`；仍须设置 `TMO_ADMIN_REAL_ISOLATED=1`，且 URL 必须是 loopback。
- `import.real.spec.ts` 与 `import-workbench.real.spec.ts` 均使用真实密码登录、真实导入/确认/导出接口，不再使用假令牌或跳过 workbench 场景。
- `real-fixtures.ts` 的直接请求只向当前页面同源发送令牌，并禁止自动重定向；不可在 context 上添加全局 Authorization。
- 客服跨小程序的既有 `support-real.spec.ts` 需要 `SUPPORT_REAL_E2E_ARTIFACT` 和 `SUPPORT_REAL_E2E_REPLY_TEXT`，由客服端到端工作流准备。未准备时会显式跳过，不能计为通过。
- `real` 口径要求真实数据库、真实后端，业务接口不使用 stub。

## Fullstack Real Check

```bash
pnpm run test:fullstack:real
```

- 会串行执行：`dev-stack-up`、`smoke:admin-web`、`test:e2e:real`、miniapp weapp real build、miniapp auth E2E、miniapp automator smoke。调用前同样需要明确隔离测试栈并设置上述 real 环境变量。
- 默认开启 identity 手机号证明模拟（本地 real 联调），并要求本机已安装微信开发者工具 CLI。

## 离线回归与 CI

```bash
# 类型检查、生产构建、资源检查、全部 mock、全部 stub Hybrid、/admin/ 子路径链接
pnpm run test:admin-web

# 单独执行浏览器套件，无需后端或数据库
pnpm -C apps/admin-web test:e2e:mock
pnpm -C apps/admin-web test:e2e:hybrid
pnpm -C apps/admin-web test:e2e:prefix
```

- mock、Hybrid、子路径分别使用 `5174`、`5176`、`5178`，均启用 `strictPort` 且不复用已有服务器。显式 `ADMIN_WEB_BASE_URL` 只能指向对应模式的本机服务，并必须保留对应 `/` 或 `/admin/` 路径。
- 默认 CI 执行全部 mock、全部纯 stub Hybrid 及子路径回归；真实导入和 workbench 位于 real 套件，不混入离线结果。
- `test:config` 在不联网的情况下验证真实测试代理隔离和继承环境变量边界，并纳入默认 CI。
- `offline-fixtures.ts` 阻断未 stub 的业务接口、fetch/XHR 和未声明 WebSocket，拒绝外部运行时资源。明确列出的业务图片 host 使用本地测试图响应，不会联网。
- 新增离线用例从 `./offline-fixtures` 导入 `test/expect`；路由未匹配时使用 `route.fallback()`，让漏桩门禁接管，不能 `continue()` 穿透。
- `resources.mock.spec.ts` 验证四页的真实 FontFace loaded、同源字体响应、可用布局，并记录固定时间状态下冷加载与重载截图及差异，供人工复核；CI不设置跨平台像素golden或美术尺寸门槛。截图保存到 `test-results/mock`，不绑定旧页面的 padding/font-size 字符串。
- `check:assets` 检查构建后全部 HTML 的本地运行时引用，以及字体二进制和完整许可证是否随发布产物保留。单独调用 `test:e2e:ci` 前先执行 build。

## 视觉与资源验收

```bash
pnpm -C apps/admin-web test:visual
```

- 离线检查商品、订单、支付、客服四页的本地字体、图标字形、内容互不遮挡和无横向溢出。
- 固定 Mock 时间后保留冷加载与重载截图及差异 JSON，供人工复核；不使用跨系统截图 golden，也不把旧版 prototype 的 1% 像素差异作为门禁。
- 默认 CI 通过完整 mock 套件运行相同检查，并保存浏览器证据 artifact。

## 统一布局规则

- 除登录页与仪表盘页外，后台页面统一由 React 渲染侧边栏导航（统一菜单、统一样式、统一高亮逻辑）。
- 统一侧边栏由 `apps/admin-web/src/react/runtime/mountAdminPage.tsx` + `apps/admin-web/src/react/layout/AdminSidebar.tsx` 提供。
- `legacy/pages/*.html` 不再执行旧脚本，仅用于视觉对照和历史留档。


## 本地样式与字体

17 个 HTML 各自引入 `src/styles/pages/<page>.css`。页面的 `@config` 对应 `styles/themes/<page>.config.cjs`，保留原有颜色、字体、圆角和 darkMode 差异；共享扫描范围及 forms/container-queries 插件在 `styles/tailwind-common.cjs`。样式由 Vite、PostCSS 和 Tailwind 3 在开发与构建时生成，不依赖运行时 Tailwind CDN。

Inter Variable 与 Material Symbols Outlined Variable 的完整轴字体从固定版本的 Fontsource 包本地打包；实际 font-family 和图标连字/轴设置位于 `src/styles/fonts.css`。不要把 Symbols 字体替换成只含 wght 的默认入口。完整 OFL 和版权声明位于 `public/licenses`，Vite 自动复制到发布产物 `dist/licenses`。

普通业务图片 URL 仍来自商品/客户数据，页面样式和字体自身不请求外网。`legacy/` 仅为历史快照，其旧 CDN 引用不进入当前构建；旧 legacy 像素对比不是离线 CI 的验收依据。
