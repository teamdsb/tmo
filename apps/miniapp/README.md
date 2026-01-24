# Miniapp 测试说明

当前 miniapp 使用 Jest 作为单元测试框架，暂未配置专门的 UI 或集成测试。

## 构建命令

在仓库根目录执行，构建产物输出到 `apps/miniapp/dist`（按平台区分子目录）：

    pnpm -C apps/miniapp build:weapp
    pnpm -C apps/miniapp build:alipay
    pnpm -C apps/miniapp build:tt
    pnpm -C apps/miniapp build:swan
    pnpm -C apps/miniapp build:qq
    pnpm -C apps/miniapp build:jd
    pnpm -C apps/miniapp build:h5

说明：`build:*` 会生成对应平台的静态产物，可用于发布或在平台开发者工具中打开。

## 导航栏高度约定

当前页面使用 CSS 变量控制自定义导航栏高度。默认高度为 10px（与首页一致）。

如需统一压缩高度，给页面根容器添加 `page-compact-navbar` 类即可复用该高度。

## 原子 CSS (Tailwind)

miniapp 已启用 Tailwind CSS 作为原子 CSS 框架。配置位于 `apps/miniapp/tailwind.config.cjs`，并在 `apps/miniapp/config/index.ts` 的 `mini.postcss` 与 `h5.postcss` 中启用 `tailwindcss` 插件；`apps/miniapp/postcss.config.cjs` 保持与 Vite 默认配置一致。全局样式入口在 `apps/miniapp/src/app.scss`，包含 `@tailwind base/components/utilities`。已禁用 preflight 以避免覆盖现有 Taroify 样式。

使用方式：在 JSX 中直接添加 Tailwind utility 类（例如 `className="text-[12px] text-blue-600"`），与现有 SCSS 可以并存。

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
