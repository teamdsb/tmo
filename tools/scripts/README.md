# scripts

Bootstrap and local dev scripts.

- `commerce-bootstrap.sh`: start local Postgres, apply migrations, seed dev data.
- `commerce-migrate.sh`: apply migrations via Go runner (no goose install).
- `commerce-seed.sh`: seed catalog data for v0 demo.
- `commerce-verify.sh`: smoke-check health + catalog endpoints.
- `commerce-product-request-export-smoke.sh`: create a sample `product_requests` record, trigger `/admin/product-requests/export-jobs`, poll `/admin/import-jobs/{jobId}`, download the generated Excel, and validate it contains Chinese headers plus at least one data row.
- `commerce-generate.sh`: regenerate sqlc + oapi-codegen outputs.
- `identity-generate.sh`: regenerate identity sqlc + oapi-codegen outputs.
- `identity-migrate.sh`: apply identity migrations via Go runner.
- `identity-seed.sh`: seed identity dev users/roles.
- `identity-seed-check.sh`: verify identity DB fixtures and, when gateway is reachable, real password-login + bootstrap.
- `identity-repair.sh`: reset/reseed identity fixtures, then run `identity-seed-check.sh`.
- `dev-seed.sh`: run commerce + identity seed scripts in one shot.
- `dev-seed-check.sh`: verify real-data login/catalog/inquiry fixtures before local real e2e. Inquiry seed is mandatory by default; set `DEV_SEED_CHECK_REQUIRE_INQUIRIES=false` only when intentionally debugging pre-seed environments.
- `dev-bootstrap.sh`: start Postgres, run commerce + identity migrations and seed.
- `dev-stack-up.sh`: start local Docker stack (postgres + backend services), run bootstrap/seed, enforce identity seed DB checks before container startup, then wait for readiness and enforce real password-login + bootstrap checks (`DEV_STACK_BUILD_IMAGES=true` to force image rebuild; `DEV_STACK_AIR=true` to enable `infra/dev/docker-compose.dev.yml` overlay and run all Go services with Air hot reload; `TMO_ACTIVE_WORKTREE=/abs/path/to/worktree` to choose which worktree the Air containers mount). The script injects stable Go module env by default (`DEV_STACK_GOPROXY=https://goproxy.cn,direct`, `DEV_STACK_GOSUMDB=off`, `DEV_STACK_GONOSUMDB=*`) and you can override them per command.
- `dev-air-switch.sh`: switch the Air dev containers to a different git worktree without rebuilding images. It validates the target repo root, reuses the current compose/env setup, and runs `docker compose ... up -d --no-deps --force-recreate` for `identity commerce payment ai gateway-bff` by default.
- `e2e-local-stack.sh`: one-shot local orchestration for real-data seed verification, smoke checks, admin-web real e2e, miniapp auth e2e, and miniapp catalog real e2e. It now forces `DEV_STACK_BUILD_IMAGES=true` by default (`E2E_LOCAL_FORCE_BUILD_IMAGES=false` to opt out) so local runs do not accidentally validate stale backend containers, and enables `TARO_APP_WEAPP_PHONE_PROOF_SIMULATION=true` for miniapp local real E2E by default (`E2E_LOCAL_WEAPP_PHONE_SIMULATION=false` to opt out).
- `infra/dev/docker-compose.dev.yml`: overlay compose file for dev containers (Dockerfile.dev + source mount + Air command + Go cache volumes).
- `dev-stack-health.sh`: check local identity/commerce/payment/gateway `/ready` and `/health` endpoints, then validate gateway business endpoints (`/bff/bootstrap`, `/catalog/categories`, `/catalog/products`).
- `dev-diagnose-db.sh`: print DB failure diagnostics from container health/logs (used by stack health and preflight failure paths).
- `miniapp-http-smoke.sh`: smoke-check miniapp core API paths via gateway (`/bff/bootstrap`, `/catalog/categories`, `/catalog/products`) and validate product images from `/assets/img` or `/assets/media` (`MINIAPP_HTTP_SMOKE_ALLOW_EMPTY_PRODUCTS=true` to skip image-proxy assertion when products are empty; `MINIAPP_HTTP_SMOKE_ALLOW_PROXY_FAILURE=true` to soft-pass remote image proxy failures in unstable networks).
- `miniapp-smoke.sh`: run multi-route WeChat automator smoke on `apps/miniapp` (`MINIAPP_SMOKE_STACK_UP=true` to auto start backend stack; `WEAPP_SMOKE_PREFLIGHT=true` to run preflight gate first; supports `WEAPP_SMOKE_ASSERT_*` assertion thresholds, default all minimum-count thresholds to `0` to focus on endpoint health first).
- `miniapp-customer-evidence.sh`: verify CUSTOMER auto-provision evidence for a phone/provider pair by combining admin `/admin/customers` query and identity DB checks.
- Preflight result file: `apps/miniapp/.logs/preflight/result.json` (machine-readable status for CI and local diagnosis).
- Automator result file: `apps/miniapp/.logs/weapp/run.json` (machine-readable run summary, first failure, and assertion stats).
- Troubleshooting runbook: `docs/runbooks/miniapp-white-screen-gate.md`.
- `catalog-image-audit.sh`: audit `catalog_products` image refs and print domain distribution.
- `catalog-image-migrate.sh`: migrate external catalog images into local media output and rewrite DB URLs.
- `gateway-verify.sh`: smoke-check gateway health/ready and auth flows.
- `gateway-verify-real.sh`: verify real-mode auth rejects missing/invalid phone proof.
