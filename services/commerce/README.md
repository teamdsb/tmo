# commerce

Catalog, pricing, cart, order, and after-sales (initially here).
Go version: 1.25.6.
Planned layout: cmd/, internal/modules (catalog, pricing, cart, order, aftersale), events, db.

## Run locally

```bash
export COMMERCE_DB_DSN="postgres://commerce:commerce@localhost:5432/commerce?sslmode=disable"
go run ./cmd/commerce
```

## Bootstrap (local dev)

```bash
docker compose -f infra/dev/docker-compose.yml up -d
bash tools/scripts/commerce-migrate.sh
bash tools/scripts/commerce-seed.sh
```

`commerce-seed.sh` 为幂等写入：会 upsert 多个分类、商品、SKU 与阶梯价，适合反复联调执行。

Or one-shot:

```bash
bash tools/scripts/commerce-bootstrap.sh
```

如果你同时需要 identity 调试数据，可执行：

```bash
bash tools/scripts/dev-seed.sh
```

## Validation (smoke)

```bash
COMMERCE_API_BASE_URL="http://localhost:8080" bash tools/scripts/commerce-verify.sh
```

## Codegen

```bash
bash tools/scripts/commerce-generate.sh
```

## Health checks

- `GET /health`: always 200 with body `OK`.
- `GET /ready`: 200 when the database is reachable; otherwise 503 with a JSON error.

## Error responses

Errors are returned as JSON in the shape:

```json
{"code":"invalid_request","message":"name is required","requestId":"...","details":{"field":"name"}}
```

## Configuration

- `COMMERCE_HTTP_ADDR` (default `:8080`)
- `COMMERCE_DB_DSN` (default local Postgres)
- `COMMERCE_LOG_LEVEL` (`debug`, `info`, `warn`, `error`)

## Observability

Tracing is enabled when standard OTLP env vars are set (for example
`OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_PROTOCOL`).
Requests always include an `X-Request-ID` header in the response.

## Conventions

See `docs/commerce-conventions.md` for pricing units, SKU spec rules, and order transaction/idempotency expectations.
