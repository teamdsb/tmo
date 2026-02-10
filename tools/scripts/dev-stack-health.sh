#!/usr/bin/env bash
set -euo pipefail

health_timeout_seconds="${DEV_STACK_HEALTH_TIMEOUT_SECONDS:-180}"
health_interval_seconds="${DEV_STACK_HEALTH_INTERVAL_SECONDS:-2}"

gateway_base_url="${GATEWAY_BASE_URL:-http://localhost:8080}"
identity_base_url="${IDENTITY_BASE_URL:-http://localhost:8081}"
commerce_base_url="${COMMERCE_BASE_URL:-http://localhost:8082}"
payment_base_url="${PAYMENT_BASE_URL:-http://localhost:8083}"

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required for health checks." >&2
  exit 1
fi

request_code() {
  local url="$1"
  curl -sS -o /dev/null -w "%{http_code}" "$url" || true
}

wait_for_status() {
  local name="$1"
  local url="$2"
  local expected_status="$3"
  local deadline
  local code=""

  deadline=$((SECONDS + health_timeout_seconds))
  while (( SECONDS < deadline )); do
    code="$(request_code "$url")"
    if [[ "$code" == "$expected_status" ]]; then
      echo "[dev-stack-health] ready: ${name} (${url})"
      return 0
    fi
    sleep "$health_interval_seconds"
  done

  echo "[dev-stack-health] timeout waiting for ${name}: expected ${expected_status}, got ${code} (${url})" >&2
  return 1
}

echo "[dev-stack-health] checking service readiness..."

wait_for_status "identity /ready" "${identity_base_url%/}/ready" "200"
wait_for_status "commerce /ready" "${commerce_base_url%/}/ready" "200"
wait_for_status "payment /ready" "${payment_base_url%/}/ready" "200"
wait_for_status "gateway /ready" "${gateway_base_url%/}/ready" "200"

echo "[dev-stack-health] checking service health endpoints..."

wait_for_status "identity /health" "${identity_base_url%/}/health" "200"
wait_for_status "commerce /health" "${commerce_base_url%/}/health" "200"
wait_for_status "payment /health" "${payment_base_url%/}/health" "200"
wait_for_status "gateway /health" "${gateway_base_url%/}/health" "200"
wait_for_status "gateway /assets/img (validation)" "${gateway_base_url%/}/assets/img" "400"
wait_for_status "gateway /assets/media (validation)" "${gateway_base_url%/}/assets/media/catalog/non-existent.jpg" "404"

echo "[dev-stack-health] all checks passed."
