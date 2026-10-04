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

## Durable payment reconciliation

The service starts a PostgreSQL-backed reconciliation worker by default. It
queries pending WeChat B2B payments even if the miniapp closes, and retries
Commerce synchronization after network failures or service restarts. Provider
queries use the same merchant, order, currency and amount validation as HTTP
rechecks; a client success callback is never proof of payment.

| Configuration | Default | Purpose |
| --- | --- | --- |
| `PAYMENT_RECONCILIATION_ENABLED` | `true` | Emergency worker switch; disabling it preserves queued work. |
| `PAYMENT_RECONCILIATION_POLL_INTERVAL` | `2s` | Wait between empty/error scans. |
| `PAYMENT_RECONCILIATION_JOB_TIMEOUT` | `30s` | Bounds each provider/query/sync attempt. |
| `PAYMENT_RECONCILIATION_LEASE_DURATION` | `90s` | Must exceed the job timeout; crashed workers' tasks become claimable after this period. |

`PAYMENT_COMMERCE_BASE_URL` and `PAYMENT_COMMERCE_SYNC_TOKEN` must be configured
when the worker is enabled. Existing paid payments still synchronize when the
provider mode is disabled. The feature flags that block new payments do not
block reconciliation of existing transactions. Pending B2B queries require the
B2B provider credentials and mode; keep them configured while settling old B2B
transactions.

Payment creation and state changes persist a version and next-attempt time in
the same database write. A partial index includes only unsynchronized versions
or pending B2B payments. Workers claim one due row with `SKIP LOCKED` and a lease
token; stale workers cannot clear a replacement lease. Successful Commerce
responses acknowledge only the version actually sent. A newer saved version
remains pending. Confirmed `PAID` state, paid time and trade number do not regress.

Internal Commerce synchronization carries `stateVersion` and `paymentCreatedAt`
as a pair. Commerce persists their ordering with the order summary under its row
lock: versions order updates to the same payment; `(createdAt, paymentId)` orders
different attempts, across channels. Stale non-paid updates return success
without changing the order. Payment also suppresses non-paid attempts superseded
by a newer attempt before sending. A late PAID always wins over non-paid state,
and an already-paid order retains its first confirmed payment and paid time.

Upgrade Commerce before enabling the upgraded Payment worker. Legacy messages
without ordering metadata are accepted until a watermark exists; afterward only
legacy PAID may promote the order. Older Payment writes remain dirty through the
migration trigger/defaults and can be resent by the new worker. The original order
of versionless historical messages cannot be reconstructed before bootstrapping
the watermark.

Failures retry after 10, 20, 40, 80, 160, then 300 seconds without discarding the
task. Normal pending queries run every 30 seconds, every 5 minutes after one
hour, and hourly after one day. Expired frontend session timestamps do not
change payment state. The worker retains uncertain payments until the provider
supplies an authoritative result; it does not infer failure or trigger refunds.

Inspect `reconcile_last_error`, `reconcile_attempts`, `reconcile_after`,
`state_version` and `commerce_synced_version` on a payment when investigating a
delayed order update. Logs identify failed payment IDs. The migration initially
queues existing saved states, including paid payments, and replaying migrations
preserves completed acknowledgements and active leases. A database trigger also
marks writes by older deployed binaries for reconciliation during rollout.

Run integration tests with a dedicated PostgreSQL database and
`PAYMENT_INTEGRATION_REQUIRED=true`; the tests use fake provider/Commerce servers
and never create a real merchant payment.
