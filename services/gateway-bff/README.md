# gateway-bff

Minimal API gateway that routes identity + commerce behind a single base URL.

## Quickstart

1) Ensure identity, commerce, and payment are running:

   - `cd services/identity && IDENTITY_HTTP_ADDR=":8081" ... go run ./cmd/identity`
   - `cd services/commerce && COMMERCE_HTTP_ADDR=":8082" ... go run ./cmd/commerce`
   - `cd services/payment && PAYMENT_HTTP_ADDR=":8083" ... go run ./cmd/payment`

2) Run the gateway:

   `cd services/gateway-bff && GATEWAY_HTTP_ADDR=":8080" GATEWAY_IDENTITY_BASE_URL="http://localhost:8081" GATEWAY_COMMERCE_BASE_URL="http://localhost:8082" GATEWAY_PAYMENT_BASE_URL="http://localhost:8083" go run ./cmd/gateway-bff`

## Behavior

- `/auth/*` and `/me*` are proxied to identity.
- All other paths are proxied to commerce.
- `/health` returns `OK`.
- `/ready` returns 200 only when identity, commerce, and payment are ready.
- `/assets/img?url=<encoded>` proxies allowlisted remote images (for miniapp product images).
- `/assets/media/*` serves locally migrated media files when `GATEWAY_MEDIA_LOCAL_DIR` is configured.
- `GET /catalog/products` and `GET /catalog/products/{spuId}` rewrite third-party image URLs to gateway image URLs (`/assets/img`) before returning to clients; URLs already under gateway origin (for example `/assets/media`) are preserved.

## Image proxy env

- `GATEWAY_PUBLIC_BASE_URL` (default: `http://localhost:8080`)
- `GATEWAY_MEDIA_LOCAL_DIR` (default: empty/disabled)
- `GATEWAY_IMAGE_PROXY_ALLOWLIST` (default: `images.unsplash.com`)
- `GATEWAY_IMAGE_PROXY_TIMEOUT` (default: `10s`)
- `GATEWAY_IMAGE_PROXY_MAX_BYTES` (default: `8388608`)
- `GATEWAY_IMAGE_PROXY_CACHE_MAX_AGE_SECONDS` (default: `3600`)
