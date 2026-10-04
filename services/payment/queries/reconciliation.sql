-- name: ClaimPaymentReconciliation :one
WITH candidate AS (
    SELECT p.id
    FROM payments p
    WHERE (p.state_version > p.commerce_synced_version
        OR (p.channel = 'WECHAT_B2B' AND p.status = 'PAY_PENDING'))
      AND (sqlc.arg('query_b2b')::boolean OR p.state_version > p.commerce_synced_version)
      AND p.reconcile_after <= now()
      AND (p.reconcile_lease_until IS NULL OR p.reconcile_lease_until <= now())
    ORDER BY p.reconcile_after, p.id
    FOR UPDATE SKIP LOCKED
    LIMIT 1
)
UPDATE payments p
SET reconcile_lease_token = sqlc.arg('lease_token')::uuid,
    reconcile_lease_until = now() + sqlc.arg('lease_duration_ms')::bigint * interval '1 millisecond'
FROM candidate
WHERE p.id = candidate.id
RETURNING p.*;

-- name: MarkPaymentCommerceSynced :exec
UPDATE payments
SET commerce_synced_version = greatest(commerce_synced_version, sqlc.arg('sent_version')::bigint)
WHERE id = sqlc.arg('id')
  AND state_version >= sqlc.arg('sent_version')::bigint;

-- name: FinishPaymentReconciliation :execrows
UPDATE payments
SET reconcile_after = CASE WHEN state_version <> sqlc.arg('observed_version')::bigint
        THEN now() ELSE now() + sqlc.arg('retry_after_ms')::bigint * interval '1 millisecond' END,
    reconcile_attempts = CASE WHEN state_version <> sqlc.arg('observed_version')::bigint
        THEN 0 ELSE sqlc.arg('attempts')::integer END,
    reconcile_last_error = CASE WHEN state_version <> sqlc.arg('observed_version')::bigint
        THEN NULL ELSE sqlc.narg('last_error')::text END,
    reconcile_lease_token = NULL,
    reconcile_lease_until = NULL
WHERE id = sqlc.arg('id')
  AND reconcile_lease_token = sqlc.arg('lease_token')::uuid;
