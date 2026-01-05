# Repository Guidelines

This repository is in an early, requirements-first stage. Use this guide to keep new work consistent as code is added.

## Project Structure & Module Organization
- Current structure is documentation-focused: `doc/requirements.md` is the primary requirements/design reference.
- When adding code, keep clear top-level modules (example layout: `backend/` for Go services, `frontend/` for React TS, `miniapp/` for Taro). Update this file if you choose a different layout.
- Co-locate tests with their modules where possible (e.g., Go package tests next to source).

## Build, Test, and Development Commands
- No build/test scripts are committed yet. Add exact commands here once scaffolding exists.
- Example placeholders to replace later: `go test ./...`, `npm run dev`, `npm test`. Do not rely on these until the actual toolchain is added.

## Coding Style & Naming Conventions
- Follow formatter outputs over manual styling; add formatters/linters once scaffolding is created.
- Go: standard `gofmt`, package names in lowercase, exported identifiers in PascalCase.
- React/TS: components in PascalCase, hooks as `useXxx`, files as `ComponentName.tsx`.

## Testing Guidelines
- Go tests should use `*_test.go` and table-driven patterns where helpful.
- Frontend tests (if added) should use `*.test.ts(x)` or `__tests__/` folders.
- No coverage target is defined yet; aim to cover core flows (ordering, binding, payments toggle) once implemented.

## Commit & Pull Request Guidelines
- No commit convention is established (current history is only “Initial commit”). Use concise, imperative messages, one logical change per commit.
- PRs should include: a short description, linked issue (if any), testing notes, and screenshots for UI changes.

## Security & Configuration Tips
- Never commit secrets. Use `.env` locally and keep `.env.example` updated for required keys.
- Payment and AI integrations should remain feature-flagged per `doc/requirements.md` until enabled.

## ExecPlans
- When implementing complex features or significant refactors, write an **ExecPlan** from design → implementation, as described in `.agent/PLANS.md`.
- Example ExecPlan: `docs/execplans/PLANS.md`.
