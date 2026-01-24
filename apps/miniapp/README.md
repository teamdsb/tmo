# Miniapp 测试说明

当前 miniapp 使用 Jest 作为单元测试框架，暂未配置专门的 UI 或集成测试。

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
