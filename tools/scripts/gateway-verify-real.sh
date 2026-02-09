#!/usr/bin/env bash
set -euo pipefail

base_url="${GATEWAY_BASE_URL:-http://localhost:8080}"

http_code=""
http_body=""

request() {
  local method="$1"
  local url="$2"
  local data="${3:-}"
  local resp

  if [[ -n "$data" ]]; then
    resp=$(curl -sS -X "$method" -H 'Content-Type: application/json' -d "$data" -w "\n%{http_code}" "$url")
  else
    resp=$(curl -sS -X "$method" -w "\n%{http_code}" "$url")
  fi
  http_body="$(echo "$resp" | sed '$d')"
  http_code="$(echo "$resp" | tail -n1)"
}

echo "Checking gateway health..."
request "GET" "$base_url/health"
if [[ "$http_code" != "200" ]]; then
  echo "health check failed: $http_code"
  echo "$http_body"
  exit 1
fi

echo "Checking gateway readiness..."
request "GET" "$base_url/ready"
if [[ "$http_code" != "200" ]]; then
  echo "ready check failed: $http_code"
  echo "$http_body"
  exit 1
fi

echo "Verifying real-mode login requires phone proof..."
request "POST" "$base_url/auth/mini/login" '{"platform":"weapp","code":"probe_without_phone"}'
if [[ "$http_code" != "400" ]]; then
  echo "expected 400 for missing phone proof, got: $http_code"
  echo "$http_body"
  exit 1
fi
if ! echo "$http_body" | grep -q '"code":"phone_required"'; then
  echo "expected error code phone_required, got:"
  echo "$http_body"
  exit 1
fi

echo "Verifying invalid phone proof is rejected..."
request "POST" "$base_url/auth/mini/login" '{"platform":"weapp","code":"probe_invalid_phone","phoneProof":{"code":"invalid-phone-proof"}}'
if [[ "$http_code" != "400" ]]; then
  echo "expected 400 for invalid phone proof, got: $http_code"
  echo "$http_body"
  exit 1
fi
if ! echo "$http_body" | grep -q '"code":"invalid_phone_proof"'; then
  echo "expected error code invalid_phone_proof, got:"
  echo "$http_body"
  exit 1
fi

echo "Gateway real-mode verification completed."
