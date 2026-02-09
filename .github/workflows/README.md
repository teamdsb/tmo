# Workflows

- `commerce-ci.yml`
  - Go-only CI for `services/commerce` and `packages/go-shared`.
  - Runs unit/integration/race/fuzz/lint checks.

- `gateway-miniapp-ci.yml`
  - Full-stack smoke for local containerized backend + miniapp test suite.
  - Starts `infra/dev` stack, verifies gateway core endpoints, then runs miniapp typecheck + unit tests.
  - Works on GitHub-hosted Ubuntu runners.

- `weapp-automator-smoke.yml`
  - WeChat DevTools automator smoke for route matrix capture.
  - Requires a self-hosted macOS runner with WeChat DevTools installed and automator-capable environment.
  - On PR, job runs only when repository variable `ENABLE_WEAPP_AUTOMATOR=true`; otherwise it is skipped.
  - Always uploads `apps/miniapp/.logs/weapp` artifacts.
