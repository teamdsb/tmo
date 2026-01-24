# gateway-bff

Minimal API gateway that routes identity + commerce behind a single base URL.

## Quickstart

1) Ensure identity and commerce are running:

   - `cd services/identity && IDENTITY_HTTP_ADDR=":8081" ... go run ./cmd/identity`
   - `cd services/commerce && COMMERCE_HTTP_ADDR=":8082" ... go run ./cmd/commerce`

2) Run the gateway:

   `cd services/gateway-bff && GATEWAY_HTTP_ADDR=":8080" GATEWAY_IDENTITY_BASE_URL="http://localhost:8081" GATEWAY_COMMERCE_BASE_URL="http://localhost:8082" go run ./cmd/gateway-bff`

## Behavior

- `/auth/*` and `/me*` are proxied to identity.
- All other paths are proxied to commerce.
- `/health` returns `OK`.
- `/ready` returns 200 only when both identity and commerce are ready.
