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
- `dev-bootstrap.sh`: start Postgres, run commerce + identity migrations and seed.
- `gateway-verify.sh`: smoke-check gateway health/ready and auth flows.
- `gateway-verify-real.sh`: verify real-mode auth rejects missing/invalid phone proof.
