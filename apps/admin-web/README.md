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

4. 一键启动 backend + admin-web（dev 模式）：

```bash
pnpm run dev:admin-web:stack
```

5. 浏览器访问：

`http://localhost:5174`

## React 迁移说明

- 页面入口已切换为 React + TypeScript 多入口（仍保持 `*.html` URL 不变）。
- 原生版本完整快照保留在 `legacy/pages/`，页面 DOM 片段保留在 `legacy/fragments/`。
- 迁移阶段 React 入口会渲染 legacy 片段并加载原页面脚本，以保证行为一致与可回滚。

## 模式说明

- `mock`：保持现有纯前端原型行为，不请求后端。
- `dev`：严格真实鉴权，登录走 `POST /auth/password/login`，业务数据通过 gateway 获取。
  - 不展示固定示例数字/示例记录；没有后端数据时展示空态。
  - 暂未接入的 dashboard 扩展区块会明确标记为不可用，而不是展示 mock 卡片。

默认 gateway 基址通过 Vite 代理 `/api -> http://localhost:8080`。
可通过环境变量 `ADMIN_WEB_PROXY_TARGET` 覆盖代理目标。

## 快速验收

```bash
pnpm run smoke:admin-web
```

默认测试账号：

- username: `admin`
- password: `admin123`

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
- `apps/admin-web/src/sidebar-layout.js` 仅用于 legacy 快照页面对照，不再作为主入口布局依赖。
