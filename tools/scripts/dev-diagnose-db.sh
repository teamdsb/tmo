#!/usr/bin/env bash
set -euo pipefail

tail_lines="${DEV_STACK_DIAG_TAIL_LINES:-200}"
postgres_container="${POSTGRES_CONTAINER:-tmo-postgres}"
commerce_container="${COMMERCE_CONTAINER:-dev-commerce-1}"

if ! command -v docker >/dev/null 2>&1; then
  echo "[dev-diagnose-db] docker command unavailable, skip DB diagnosis."
  exit 0
fi

read_container_status() {
  local container="$1"
  local value
  value="$(docker inspect --format '{{.State.Status}} (health={{if .State.Health}}{{.State.Health.Status}}{{else}}n/a{{end}})' "$container" 2>/dev/null || true)"
  if [[ -z "$value" ]]; then
    echo "not-found"
    return
  fi
  echo "$value"
}

read_container_logs() {
  local container="$1"
  docker logs --tail "$tail_lines" "$container" 2>&1 || true
}

postgres_status="$(read_container_status "$postgres_container")"
commerce_status="$(read_container_status "$commerce_container")"
postgres_logs="$(read_container_logs "$postgres_container")"
commerce_logs="$(read_container_logs "$commerce_container")"
combined_logs="${postgres_logs}"$'\n'"${commerce_logs}"

disk_full_detected="false"
recovery_mode_detected="false"
connection_reset_detected="false"

if grep -Eiq 'No space left on device' <<<"$combined_logs"; then
  disk_full_detected="true"
fi
if grep -Eiq 'database system is in recovery mode|in recovery mode' <<<"$combined_logs"; then
  recovery_mode_detected="true"
fi
if grep -Eiq 'connection reset by peer|failed to connect to `user=commerce database=commerce`' <<<"$combined_logs"; then
  connection_reset_detected="true"
fi

echo "[dev-diagnose-db] postgres container: ${postgres_container} (${postgres_status})"
echo "[dev-diagnose-db] commerce container: ${commerce_container} (${commerce_status})"
echo "[dev-diagnose-db] signals: disk_full=${disk_full_detected}, recovery_mode=${recovery_mode_detected}, connection_reset=${connection_reset_detected}"

echo "[dev-diagnose-db] postgres log tail (${tail_lines} lines):"
if [[ -n "$postgres_logs" ]]; then
  echo "$postgres_logs" | tail -n 40
else
  echo "(empty)"
fi

if [[ "$disk_full_detected" == "true" ]]; then
  cat <<'EOF'
[dev-diagnose-db] diagnosis: docker host disk is likely full.
[dev-diagnose-db] suggested actions:
  1) inspect disk usage: df -h && docker system df
  2) free docker space (non-destructive first): docker builder prune
  3) after freeing space, restart postgres: docker restart tmo-postgres
  4) rerun stack health check: bash tools/scripts/dev-stack-health.sh
EOF
fi

if [[ "$recovery_mode_detected" == "true" ]]; then
  cat <<'EOF'
[dev-diagnose-db] diagnosis: postgres is stuck in recovery mode.
[dev-diagnose-db] suggested actions:
  1) fix underlying resource issue first (commonly disk full).
  2) restart postgres container: docker restart tmo-postgres
  3) if still failing, rebuild local stack: DEV_STACK_BUILD_IMAGES=true bash tools/scripts/dev-stack-up.sh
EOF
fi

if [[ "$disk_full_detected" != "true" && "$recovery_mode_detected" != "true" ]]; then
  cat <<'EOF'
[dev-diagnose-db] diagnosis: no known disk/recovery signature matched.
[dev-diagnose-db] suggested actions:
  1) verify postgres health: docker inspect tmo-postgres
  2) verify gateway/commerce DB DSN and connectivity.
  3) rerun smoke check: bash tools/scripts/miniapp-http-smoke.sh
EOF
fi
