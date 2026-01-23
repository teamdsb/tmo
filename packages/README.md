# packages

Shared packages for frontend and backend.

## Go packages

- `go-shared`: common infrastructure for Go services (config, db, httpx, errors, observability).
  Tests: `cd packages/go-shared && go test ./...`

## Frontend packages

- `shared`: DTOs, enums, validators, and constants.
- `openapi-client`: OpenAPI client utilities and shared request helpers.
- `api-client`: generated OpenAPI client (orval output) for commerce.
- `commerce-services`: business logic layer wrapping the generated client.
- `platform-adapter`: platform-specific API adapters (wx/my).
