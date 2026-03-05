#!/usr/bin/env bash
set -euo pipefail

base_url="${ADMIN_WEB_SMOKE_BASE_URL:-http://localhost:8080}"
admin_username="${ADMIN_WEB_SMOKE_ADMIN_USERNAME:-${ADMIN_WEB_SMOKE_USERNAME:-admin}}"
admin_password="${ADMIN_WEB_SMOKE_ADMIN_PASSWORD:-${ADMIN_WEB_SMOKE_PASSWORD:-admin123}}"
boss_username="${ADMIN_WEB_SMOKE_BOSS_USERNAME:-boss}"
boss_password="${ADMIN_WEB_SMOKE_BOSS_PASSWORD:-boss123}"
manager_username="${ADMIN_WEB_SMOKE_MANAGER_USERNAME:-manager}"
manager_password="${ADMIN_WEB_SMOKE_MANAGER_PASSWORD:-manager123}"
cs_username="${ADMIN_WEB_SMOKE_CS_USERNAME:-cs}"
cs_password="${ADMIN_WEB_SMOKE_CS_PASSWORD:-cs123}"

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

login_with_role() {
  local username="$1"
  local password="$2"
  local role="$3"
  local label="$4"

  echo "[admin-web-smoke] ${label} password login..." >&2
  request "POST" "$base_url/auth/password/login" "{\"username\":\"$username\",\"password\":\"$password\",\"role\":\"$role\"}"
  if [[ "$http_code" != "200" ]]; then
    echo "${label} login failed: $http_code" >&2
    echo "$http_body" >&2
    exit 1
  fi
  local token
  token="$(echo "$http_body" | parse_token)"
  if [[ -z "$token" ]]; then
    echo "${label} token missing" >&2
    exit 1
  fi
  printf "%s" "$token"
}

verify_bootstrap() {
  local token="$1"
  local label="$2"

  echo "[admin-web-smoke] ${label} bootstrap..."
  request "GET" "$base_url/bff/bootstrap" "" "$token"
  if [[ "$http_code" != "200" ]]; then
    echo "${label} bootstrap failed: $http_code" >&2
    echo "$http_body" >&2
    exit 1
  fi
}

verify_admin_sales_users_status() {
  local token="$1"
  local expected="$2"
  local label="$3"

  echo "[admin-web-smoke] ${label} /admin/sales-users expect ${expected}..."
  request "GET" "$base_url/admin/sales-users?page=1&pageSize=5" "" "$token"
  if [[ "$http_code" != "$expected" ]]; then
    echo "${label} /admin/sales-users expected ${expected}, got ${http_code}" >&2
    echo "$http_body" >&2
    exit 1
  fi
}

echo "[admin-web-smoke] checking gateway health..."
request "GET" "$base_url/health"
if [[ "$http_code" != "200" ]]; then
  echo "health check failed: $http_code" >&2
  echo "$http_body" >&2
  exit 1
fi

admin_token="$(login_with_role "$admin_username" "$admin_password" "ADMIN" "admin")"
boss_token="$(login_with_role "$boss_username" "$boss_password" "BOSS" "boss")"
manager_token="$(login_with_role "$manager_username" "$manager_password" "MANAGER" "manager")"
cs_token="$(login_with_role "$cs_username" "$cs_password" "CS" "cs")"

verify_bootstrap "$admin_token" "admin"
verify_bootstrap "$boss_token" "boss"
verify_bootstrap "$manager_token" "manager"
verify_bootstrap "$cs_token" "cs"

verify_admin_sales_users_status "$admin_token" "200" "admin"
verify_admin_sales_users_status "$boss_token" "200" "boss"
verify_admin_sales_users_status "$manager_token" "200" "manager"
verify_admin_sales_users_status "$cs_token" "403" "cs"

echo "[admin-web-smoke] admin list products..."
request "GET" "$base_url/catalog/products?page=1&pageSize=5" "" "$admin_token"
if [[ "$http_code" != "200" ]]; then
  echo "catalog query failed: $http_code" >&2
  echo "$http_body" >&2
  exit 1
fi

echo "[admin-web-smoke] admin list orders..."
request "GET" "$base_url/orders?page=1&pageSize=5" "" "$admin_token"
if [[ "$http_code" != "200" ]]; then
  echo "orders query failed: $http_code" >&2
  echo "$http_body" >&2
  exit 1
fi

echo "[admin-web-smoke] admin list inquiries..."
request "GET" "$base_url/inquiries/price?page=1&pageSize=5" "" "$admin_token"
if [[ "$http_code" != "200" ]]; then
  echo "inquiries query failed: $http_code" >&2
  echo "$http_body" >&2
  exit 1
fi

echo "[admin-web-smoke] admin get feature flags..."
request "GET" "$base_url/admin/config/feature-flags" "" "$admin_token"
if [[ "$http_code" != "200" ]]; then
  echo "feature flags query failed: $http_code" >&2
  echo "$http_body" >&2
  exit 1
fi

echo "[admin-web-smoke] all checks passed."
