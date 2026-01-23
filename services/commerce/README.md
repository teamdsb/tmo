# commerce

Catalog, pricing, cart, order, and after-sales (initially here).
Go version: 1.25.6.
Planned layout: cmd/, internal/modules (catalog, pricing, cart, order, aftersale), events, db.

## Run locally

```bash
export COMMERCE_DB_DSN="postgres://commerce:commerce@localhost:5432/commerce?sslmode=disable"
go run ./cmd/commerce
```

## Health checks

- `GET /health`: always 200 with body `OK`.
- `GET /ready`: 200 when the database is reachable; otherwise 503 with a JSON error.

## Error responses

Errors are returned as JSON in the shape:

```json
{"code":"invalid_request","message":"name is required","detail":"optional"}
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
