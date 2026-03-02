# admin-web

`apps/admin-web` 是后台管理站点（Web）。

## 本地运行

1. 在仓库根目录安装依赖：

```bash
pnpm install
```

2. 启动后台前端：

```bash
pnpm -C apps/admin-web dev
```

3. 浏览器访问：

`http://localhost:5174`

## 说明

- 当前先集成登录页静态原型，后续可逐步接入真实接口与路由。
- 页面入口文件：`apps/admin-web/index.html`

## 统一布局规则

- 除登录页外，所有后台页面必须使用与 `dashboard` 一致的左侧边栏导航（统一菜单、统一样式、统一高亮逻辑）。
- 统一侧边栏由 `apps/admin-web/src/sidebar-layout.js` 注入，页面需在末尾引入：
  - `<script type="module" src="/src/sidebar-layout.js"></script>`
- 页面可保留各自的顶部内容区与业务主体区，但不得删除或替换统一侧边栏。
