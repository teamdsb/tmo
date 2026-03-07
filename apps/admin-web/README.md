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

mock/dev 常用账号如下（dev 仅支持 `BOSS/MANAGER/ADMIN/CS` 密码登录）：

- username: `admin` / password: `admin123`（最高权限，兼容）
- username: `boss` / password: `boss123`（最高权限）
- username: `manager` / password: `manager123`
- username: `cs` / password: `cs123`
- username: `sales` / password: `sales123`（仅 mock；dev 下不支持密码登录）

这些 dev 账号依赖 identity seed 基线。`dev-stack-up` 现在会在 backend 启动后强制校验这批账号能否真实登录；校验失败时会直接中断，而不是继续让前端连到坏环境。

默认 gateway 基址通过 Vite 代理 `/api -> http://localhost:8080`。
可通过环境变量 `ADMIN_WEB_PROXY_TARGET` 覆盖代理目标。

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

```bash
pnpm -C apps/admin-web test:e2e:real
```

- 默认会连接 `http://127.0.0.1:5174`（`dev:real`）并执行 P0 页面端到端脚本。
- Playwright 自启 real E2E 默认使用独立端口 `http://127.0.0.1:5175`，避免复用本地已开启的 `5174` mock/dev 服务器。
- 如已手动启动前端，可设置 `ADMIN_WEB_BASE_URL` 复用现有服务。
- `real` 口径要求真实数据库 + 真实后端 + 不 stub 业务接口。

## Fullstack Real Check

```bash
pnpm run test:fullstack:real
```

- 会串行执行：`dev-stack-up`、`smoke:admin-web`、`test:e2e:real`、miniapp weapp real build、miniapp auth E2E、miniapp automator smoke。
- 默认开启 identity 手机号证明模拟（本地 real 联调），并要求本机已安装微信开发者工具 CLI。

## Hybrid E2E

```bash
pnpm -C apps/admin-web test:e2e:hybrid
```

- `hybrid` 用于真实前端流程但仍需通过 Playwright stub 业务接口的联调补充场景。
- 当前商品导入/导出轮询类场景归在 `hybrid`，不计入 `real` 联调通过口径。

## 视觉回归

```bash
pnpm -C apps/admin-web test:visual
```

- 对比对象：`/legacy/pages/*.html` vs `/*.html`
- 视口：桌面与移动端
- 默认阈值：单页像素差异率 `<= 1%`

## 统一布局规则

- 除登录页与仪表盘页外，后台页面统一由 React 渲染侧边栏导航（统一菜单、统一样式、统一高亮逻辑）。
- 统一侧边栏由 `apps/admin-web/src/react/runtime/mountAdminPage.tsx` + `apps/admin-web/src/react/layout/AdminSidebar.tsx` 提供。
- `legacy/pages/*.html` 不再执行旧脚本，仅用于视觉对照和历史留档。
