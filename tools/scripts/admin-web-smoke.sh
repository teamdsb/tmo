#!/usr/bin/env bash
set -euo pipefail

base_url="${ADMIN_WEB_SMOKE_BASE_URL:-http://localhost:8080}"
admin_username="${ADMIN_WEB_SMOKE_USERNAME:-admin}"
admin_password="${ADMIN_WEB_SMOKE_PASSWORD:-admin123}"

http_code=""
http_body=""

request() {
  local method="$1"
  local url="$2"
  local data="${3:-}"
  local token="${4:-}"
  local headers=()

  if [[ -n "$data" ]]; then
    headers+=( -H 'Content-Type: application/json' )
  fi
  if [[ -n "$token" ]]; then
    headers+=( -H "Authorization: Bearer $token" )
  fi

  local resp
  if [[ -n "$data" ]]; then
    if ((${#headers[@]})); then
      resp="$(curl -sS -X "$method" "${headers[@]}" -d "$data" -w "\n%{http_code}" "$url")"
    else
      resp="$(curl -sS -X "$method" -d "$data" -w "\n%{http_code}" "$url")"
    fi
  else
    if ((${#headers[@]})); then
      resp="$(curl -sS -X "$method" "${headers[@]}" -w "\n%{http_code}" "$url")"
    else
      resp="$(curl -sS -X "$method" -w "\n%{http_code}" "$url")"
    fi
  fi

  http_body="$(echo "$resp" | sed '$d')"
  http_code="$(echo "$resp" | tail -n1)"
}

parse_token() {
  if command -v node >/dev/null 2>&1; then
    node -e 'const fs=require("fs");const body=JSON.parse(fs.readFileSync(0,"utf8"));process.stdout.write(body.accessToken||"")'
    return
  fi
  if command -v python >/dev/null 2>&1; then
    python - <<'PY'
import json,sys
body=json.load(sys.stdin)
print(body.get("accessToken",""), end="")
PY
    return
  fi

  echo "node or python is required to parse JSON" >&2
  exit 1
}

echo "[admin-web-smoke] checking gateway health..."
request "GET" "$base_url/health"
if [[ "$http_code" != "200" ]]; then
  echo "health check failed: $http_code" >&2
  echo "$http_body" >&2
  exit 1
fi

echo "[admin-web-smoke] admin password login..."
request "POST" "$base_url/auth/password/login" "{\"username\":\"$admin_username\",\"password\":\"$admin_password\",\"role\":\"ADMIN\"}"
if [[ "$http_code" != "200" ]]; then
  echo "admin login failed: $http_code" >&2
  echo "$http_body" >&2
  exit 1
fi

token="$(echo "$http_body" | parse_token)"
if [[ -z "$token" ]]; then
  echo "admin token missing" >&2
  exit 1
fi

echo "[admin-web-smoke] bootstrap..."
request "GET" "$base_url/bff/bootstrap" "" "$token"
if [[ "$http_code" != "200" ]]; then
  echo "bootstrap failed: $http_code" >&2
  echo "$http_body" >&2
  exit 1
fi

echo "[admin-web-smoke] list products..."
request "GET" "$base_url/catalog/products?page=1&pageSize=5" "" "$token"
if [[ "$http_code" != "200" ]]; then
  echo "catalog query failed: $http_code" >&2
  echo "$http_body" >&2
  exit 1
fi

echo "[admin-web-smoke] list orders..."
request "GET" "$base_url/orders?page=1&pageSize=5" "" "$token"
if [[ "$http_code" != "200" ]]; then
  echo "orders query failed: $http_code" >&2
  echo "$http_body" >&2
  exit 1
fi

echo "[admin-web-smoke] list inquiries..."
request "GET" "$base_url/inquiries/price?page=1&pageSize=5" "" "$token"
if [[ "$http_code" != "200" ]]; then
  echo "inquiries query failed: $http_code" >&2
  echo "$http_body" >&2
  exit 1
fi

echo "[admin-web-smoke] get feature flags..."
request "GET" "$base_url/admin/config/feature-flags" "" "$token"
if [[ "$http_code" != "200" ]]; then
  echo "feature flags query failed: $http_code" >&2
  echo "$http_body" >&2
  exit 1
fi

echo "[admin-web-smoke] all checks passed."
