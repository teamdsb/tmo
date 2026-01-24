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

自定义导航栏高度通过 `apps/miniapp/src/utils/navbar.ts` 动态计算（基于微信胶囊按钮与状态栏高度），并在各页面的 `Navbar` 上注入 `--navbar-height` 与 `--navbar-line-height`。这样可以保证顶部不遮挡原生区域且与胶囊按钮对齐。

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
