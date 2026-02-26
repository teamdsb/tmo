#!/usr/bin/env bash
set -euo pipefail

gateway_base_url="${GATEWAY_BASE_URL:-}"
identity_base_url="${IDENTITY_BASE_URL:-}"
commerce_base_url="${COMMERCE_BASE_URL:-}"
payment_base_url="${PAYMENT_BASE_URL:-}"

if [[ -z "$gateway_base_url" ]]; then
  echo "[sae-smoke] GATEWAY_BASE_URL is required, for example: https://gateway.example.com" >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "[sae-smoke] curl is required." >&2
  exit 1
fi

request_code() {
  local url="$1"
  curl -sS -o /dev/null -w "%{http_code}" "$url" || true
}

assert_status() {
  local name="$1"
  local url="$2"
  local expected="$3"
  local code

  code="$(request_code "$url")"
  if [[ "$code" != "$expected" ]]; then
    echo "[sae-smoke] FAIL ${name}: expected ${expected}, got ${code}, url=${url}" >&2
    exit 1
  fi

  echo "[sae-smoke] PASS ${name}: ${url} -> ${code}"
}

assert_optional_ready() {
  local service_name="$1"
  local base_url="$2"
  if [[ -z "$base_url" ]]; then
    return
  fi
  assert_status "${service_name} /health" "${base_url%/}/health" "200"
  assert_status "${service_name} /ready" "${base_url%/}/ready" "200"
}

echo "[sae-smoke] validating public gateway..."
assert_status "gateway /health" "${gateway_base_url%/}/health" "200"
assert_status "gateway /ready" "${gateway_base_url%/}/ready" "200"
assert_status "gateway /bff/bootstrap" "${gateway_base_url%/}/bff/bootstrap" "200"
assert_status "gateway /catalog/categories" "${gateway_base_url%/}/catalog/categories" "200"
assert_status "gateway /catalog/products" "${gateway_base_url%/}/catalog/products?page=1&pageSize=20" "200"
assert_status "gateway /assets/img validation" "${gateway_base_url%/}/assets/img" "400"

echo "[sae-smoke] validating internal services (if URLs provided)..."
assert_optional_ready "identity" "$identity_base_url"
assert_optional_ready "commerce" "$commerce_base_url"
assert_optional_ready "payment" "$payment_base_url"

echo "[sae-smoke] all checks passed."
