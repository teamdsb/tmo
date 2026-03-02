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

## 统一布局规则

- 除登录页外，所有后台页面必须使用与 `dashboard` 一致的左侧边栏导航（统一菜单、统一样式、统一高亮逻辑）。
- 统一侧边栏由 `apps/admin-web/src/sidebar-layout.js` 注入，页面需在末尾引入：
  - `<script type="module" src="/src/sidebar-layout.js"></script>`
- 页面可保留各自的顶部内容区与业务主体区，但不得删除或替换统一侧边栏。
