# commerce

Catalog, pricing, cart, order, and after-sales (initially here).
Go version: 1.25.x stable.
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

## Catalog image audit & migration (no CDN stage)

审计当前商品图片来源分布：

```bash
bash tools/scripts/catalog-image-audit.sh
```

将外链图片下载到本地媒体目录并回写商品 URL（默认 dry-run）：

```bash
CATALOG_IMAGE_MIGRATE_DRY_RUN=true bash tools/scripts/catalog-image-migrate.sh
CATALOG_IMAGE_MIGRATE_DRY_RUN=false bash tools/scripts/catalog-image-migrate.sh
```

默认会将图片写入 `infra/dev/media`，并将 URL 回写为 `http://localhost:8080/assets/media/...`（由 gateway-bff 提供静态访问）。

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
- `CATALOG_IMAGE_AUDIT_TIMEOUT` (default `30s`)
- `CATALOG_IMAGE_MIGRATE_DRY_RUN` (default `true`)
- `CATALOG_IMAGE_MIGRATE_LIMIT` (default `0`, means all products)
- `CATALOG_IMAGE_MIGRATE_TIMEOUT` (default `30s`)
- `CATALOG_IMAGE_MIGRATE_HTTP_TIMEOUT` (default `20s`)
- `CATALOG_IMAGE_MIGRATE_MAX_BYTES` (default `8388608`)
- `CATALOG_IMAGE_SOURCE_ALLOWLIST` (default `images.unsplash.com`)
- `MEDIA_LOCAL_OUTPUT_DIR` (default `./infra/dev/media`)
- `MEDIA_PUBLIC_BASE_URL` (default `http://localhost:8080/assets/media`)

## Observability

Tracing is enabled when standard OTLP env vars are set (for example
`OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_PROTOCOL`).
Requests always include an `X-Request-ID` header in the response.

## Conventions

See `docs/commerce-conventions.md` for pricing units, SKU spec rules, and order transaction/idempotency expectations.
