# Workflows

- `commerce-ci.yml`
  - Go-only CI for `services/commerce` and `packages/go-shared`.
  - Runs unit/integration/race/fuzz/lint checks.

- `gateway-miniapp-ci.yml`
  - Full-stack smoke for local containerized backend + miniapp test suite.
  - Starts `infra/dev` stack, runs miniapp preflight gate (`preflight:weapp`), verifies gateway core endpoints, then runs miniapp typecheck + unit tests.
  - Includes DB fault-injection job: force-stop postgres and assert preflight must fail with diagnosis output.
  - Works on GitHub-hosted Ubuntu runners.

- `weapp-automator-smoke.yml`
  - WeChat DevTools automator smoke for route matrix capture.
  - Requires a self-hosted macOS runner with WeChat DevTools installed and automator-capable environment.
  - On PR, job runs only when repository variable `ENABLE_WEAPP_AUTOMATOR=true`; otherwise it is skipped.
  - `workflow_dispatch` supports `quality_profile`:
    - `standard`: network-first gate (`assert_*_min=0`)
    - `strict`: render/image thresholds enabled (`assert_*_min=1`)
  - `workflow_dispatch` still supports assertion overrides (`assert_min_products`, `assert_category_min`, `assert_image_success_min`, `assert_no_console_error`).
  - Smoke run includes preflight (`WEAPP_SMOKE_PREFLIGHT=true`) and prints structured `run.json` summary.
  - Always uploads `apps/miniapp/.logs/weapp` artifacts.
