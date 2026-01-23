# scripts

Bootstrap and local dev scripts.

- `commerce-bootstrap.sh`: start local Postgres, apply migrations, seed dev data.
- `commerce-migrate.sh`: apply migrations via Go runner (no goose install).
- `commerce-seed.sh`: seed catalog data for v0 demo.
- `commerce-verify.sh`: smoke-check health + catalog endpoints.
- `commerce-generate.sh`: regenerate sqlc + oapi-codegen outputs.
