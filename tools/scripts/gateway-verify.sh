#!/usr/bin/env bash
set -euo pipefail

base_url="${GATEWAY_BASE_URL:-http://localhost:8080}"

http_code=""
http_body=""

request() {
  local method="$1"
  local url="$2"
  local data="${3:-}"
  local token="${4:-}"
  local resp
  local headers=()

  if [[ -n "$data" ]]; then
    headers+=(-H 'Content-Type: application/json')
  fi
  if [[ -n "$token" ]]; then
    headers+=(-H "Authorization: Bearer $token")
  fi

  if [[ -n "$data" ]]; then
    resp=$(curl -sS -X "$method" "${headers[@]}" -d "$data" -w "\n%{http_code}" "$url")
  else
    resp=$(curl -sS -X "$method" "${headers[@]}" -w "\n%{http_code}" "$url")
  fi
  http_body="$(echo "$resp" | sed '$d')"
  http_code="$(echo "$resp" | tail -n1)"
}

parse_token() {
  if command -v python >/dev/null 2>&1; then
    python - <<'PY'
import json, sys
payload = json.load(sys.stdin)
print(payload.get("accessToken", ""))
PY
    return
  fi
  if command -v node >/dev/null 2>&1; then
    node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(data.accessToken||'');"
    return
  fi
  echo "python or node is required to parse JSON" >&2
  exit 1
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

echo "Logging in as customer..."
request "POST" "$base_url/auth/mini/login" '{"platform":"weapp","code":"mock_customer_001"}'
if [[ "$http_code" != "200" ]]; then
  echo "customer login failed: $http_code"
  echo "$http_body"
  exit 1
fi
customer_token="$(echo "$http_body" | parse_token)"
if [[ -z "$customer_token" ]]; then
  echo "customer token missing"
  exit 1
fi

echo "Fetching /me with customer token..."
request "GET" "$base_url/me" "" "$customer_token"
if [[ "$http_code" != "200" ]]; then
  echo "/me failed: $http_code"
  echo "$http_body"
  exit 1
fi

echo "Logging in as sales..."
request "POST" "$base_url/auth/mini/login" '{"platform":"weapp","code":"mock_sales_001","role":"SALES"}'
if [[ "$http_code" != "200" ]]; then
  echo "sales login failed: $http_code"
  echo "$http_body"
  exit 1
fi
sales_token="$(echo "$http_body" | parse_token)"
if [[ -z "$sales_token" ]]; then
  echo "sales token missing"
  exit 1
fi

echo "Fetching sales QR code..."
request "GET" "$base_url/me/sales-qr-code" "" "$sales_token"
if [[ "$http_code" != "200" ]]; then
  echo "sales QR code failed: $http_code"
  echo "$http_body"
  exit 1
fi

echo "Gateway verification completed."
