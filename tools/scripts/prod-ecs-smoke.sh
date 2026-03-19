#!/usr/bin/env bash
set -euo pipefail

gateway_base_url="${GATEWAY_BASE_URL:-http://127.0.0.1:8080}"
identity_base_url="${IDENTITY_BASE_URL:-http://127.0.0.1:8081}"
commerce_base_url="${COMMERCE_BASE_URL:-http://127.0.0.1:8082}"
payment_base_url="${PAYMENT_BASE_URL:-http://127.0.0.1:8083}"
admin_web_base_url="${ADMIN_WEB_BASE_URL:-}"

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required" >&2
  exit 1
fi

check_status() {
  local name="$1"
  local url="$2"
  local expected="$3"
  local code
  code="$(curl -sS -o /dev/null -w "%{http_code}" "$url" || true)"
  if [[ "$code" != "$expected" ]]; then
    echo "[prod-ecs-smoke] ${name} failed: expected ${expected}, got ${code} (${url})" >&2
    exit 1
  fi
  echo "[prod-ecs-smoke] ${name} ok (${code})"
}

check_status "identity /health" "${identity_base_url%/}/health" "200"
check_status "commerce /health" "${commerce_base_url%/}/health" "200"
check_status "payment /health" "${payment_base_url%/}/health" "200"
check_status "gateway /health" "${gateway_base_url%/}/health" "200"

check_status "identity /ready" "${identity_base_url%/}/ready" "200"
check_status "commerce /ready" "${commerce_base_url%/}/ready" "200"
check_status "payment /ready" "${payment_base_url%/}/ready" "200"
check_status "gateway /ready" "${gateway_base_url%/}/ready" "200"

check_status "gateway /bff/bootstrap" "${gateway_base_url%/}/bff/bootstrap" "200"
check_status "gateway /catalog/products" "${gateway_base_url%/}/catalog/products?page=1&pageSize=5" "200"

if [[ -n "$admin_web_base_url" ]]; then
  check_status "admin-web /" "${admin_web_base_url%/}/" "200"
  check_status "admin-web /dashboard.html" "${admin_web_base_url%/}/dashboard.html" "200"
fi

echo "[prod-ecs-smoke] all checks passed."
