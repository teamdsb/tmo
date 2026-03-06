# ai

AI suggestion service for after-sales collaboration.

## Quickstart

1) Ensure commerce is running:

   `cd services/commerce && COMMERCE_HTTP_ADDR=":8082" ... go run ./cmd/commerce`

2) Run the AI service:

   `cd services/ai && AI_HTTP_ADDR=":8084" AI_COMMERCE_BASE_URL="http://localhost:8082" AI_AUTH_ENABLED=true AI_JWT_SECRET="dev-secret" AI_JWT_ISSUER="tmo-identity" go run ./cmd/ai`

## Behavior

- `POST /ai/after-sales/suggestions` returns 2-3 draft replies for an after-sales ticket.
- The service reads ticket detail and message history from commerce over HTTP.
- Product knowledge is built from the commerce catalog and refreshed in memory on a timer.
- Local SOP templates are embedded in the binary and participate in retrieval.
- `AI_PROVIDER=mock` is the only implemented provider in this iteration.

## Environment variables

- `AI_HTTP_ADDR` (default `:8084`)
- `AI_LOG_LEVEL` (default `info`)
- `AI_AUTH_ENABLED` (default `false`)
- `AI_JWT_SECRET` / `AI_JWT_ISSUER`
- `AI_COMMERCE_BASE_URL` (default `http://localhost:8082`)
- `AI_REQUEST_TIMEOUT` (default `10s`)
- `AI_PROVIDER` (default `mock`)
- `AI_PROVIDER_BASE_URL` / `AI_PROVIDER_API_KEY` / `AI_PROVIDER_MODEL` (reserved)
- `AI_KNOWLEDGE_REFRESH_INTERVAL` (default `5m`)

## Scripts

- `tools/scripts/ai-generate.sh`: generate oapi-codegen files
