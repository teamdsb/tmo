# Repository Guidelines

## Project Structure & Module Organization
- `apps/appvx/` and `apps/appali/` are Taro mini-program clients (React + TypeScript + Sass). Source lives in `src/` with pages under `src/pages/`.
- `apps/admin-web/` is reserved for the admin console (content pending).
- `services/` is reserved for backend services.
- `docs/` holds product and API references: `docs/需求文档.md`, `docs/rbac.md`, `docs/openapi.yaml`.

## Build, Test, and Development Commands
Run commands from the target app directory.
- `cd apps/appvx && npm install` (or `pnpm install` if you prefer pnpm; lockfile is `pnpm-lock.yaml`).
- `npm run dev:weapp` / `dev:alipay` to start watch builds for each platform.
- `npm run build:weapp` / `build:alipay` for production builds.
- Other supported targets: `build:h5`, `build:tt`, `build:swan`, `build:qq`, `build:jd`, `build:rn`, `build:harmony-hybrid`.

## Coding Style & Naming Conventions
- Language: TypeScript + React (Taro 4.x). Styles are Sass (`.scss`).
- Linting/formatting: ESLint (Taro config) and Stylelint (standard config). Prefer fixing lint warnings before committing.
- Naming: keep Taro page structure (`src/pages/<page>/index.tsx`, `index.config.ts`, `index.scss`).

## Testing Guidelines
- No test framework is configured yet. If you add tests, place them alongside features or under `__tests__/` and document how to run them in this file.

## Commit & Pull Request Guidelines
- Commit messages follow Conventional Commits (commitlint is configured).
  Example: `feat(cart): add bulk import confirmation`.
- PRs should include: a brief summary, any UI screenshots (mini program pages), and doc updates if APIs or roles change.

## Docs & API Updates
- Keep `docs/需求文档.md` and `docs/openapi.yaml` in sync with feature changes.
- Update `docs/rbac.md` when roles/permissions change.

## 公用中间件/轮子的维护与使用提醒
- 由于 Go/Gin 微服务与前端跨端架构需要持续复用能力，请优先在 `packages/` 内建设、维护并使用公用中间件/轮子。
- 新增或调整通用能力时，先更新 `packages/` 中对应包，再在服务/应用侧引用；避免在业务代码中重复实现。

## ExecPlans
When writing complex features or significant refactors, use an ExecPlan (as described in .agent/PLANS.md) from design to implementation.