# scripts

Bootstrap and local dev scripts.

- `commerce-bootstrap.sh`: start local Postgres, apply migrations, seed dev data.
- `commerce-migrate.sh`: apply migrations via Go runner (no goose install).
- `commerce-seed.sh`: seed catalog data for v0 demo.
- `commerce-verify.sh`: smoke-check health + catalog endpoints.
- `commerce-generate.sh`: regenerate sqlc + oapi-codegen outputs.
- `identity-generate.sh`: regenerate identity sqlc + oapi-codegen outputs.
- `identity-migrate.sh`: apply identity migrations via Go runner.
- `identity-seed.sh`: seed identity dev users/roles.
- `dev-seed.sh`: run commerce + identity seed scripts in one shot.
- `dev-bootstrap.sh`: start Postgres, run commerce + identity migrations and seed.
- `dev-stack-up.sh`: start local Docker stack (postgres + backend services), run bootstrap/seed, then wait for readiness (`DEV_STACK_BUILD_IMAGES=true` to force image rebuild).
- `dev-stack-health.sh`: check local identity/commerce/payment/gateway `/ready` and `/health` endpoints.
- `miniapp-http-smoke.sh`: smoke-check miniapp core API paths via gateway (`/bff/bootstrap`, `/catalog/categories`, `/catalog/products`) and validate product images from `/assets/img` or `/assets/media`.
- `miniapp-smoke.sh`: run multi-route WeChat automator smoke on `apps/miniapp` (`MINIAPP_SMOKE_STACK_UP=true` to auto start backend stack; supports `WEAPP_SMOKE_ASSERT_*` assertion thresholds).
- `catalog-image-audit.sh`: audit `catalog_products` image refs and print domain distribution.
- `catalog-image-migrate.sh`: migrate external catalog images into local media output and rewrite DB URLs.
- `gateway-verify.sh`: smoke-check gateway health/ready and auth flows.
- `gateway-verify-real.sh`: verify real-mode auth rejects missing/invalid phone proof.
