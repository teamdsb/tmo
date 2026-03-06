# payment

WeChat/Alipay payment, callbacks, idempotency, and feature flags.
Implemented layout:
- `cmd/payment`: service bootstrap, config loading, DB startup.
- `internal/http`: payment creation, detail, recheck, admin transactions/webhooks/audit APIs.
- `internal/db`: pgx/sqlc data access and migrations bootstrap.
- `migrations/`: payment tables for payments, webhooks, and audit logs.
- `queries/`: sqlc query sources.

Current scope:
- miniapp-facing payment session creation for WeChat and Alipay
- payment status recheck and provider callback ingestion
- payment-to-commerce order status sync
- admin transaction/audit/webhook query and webhook replay
