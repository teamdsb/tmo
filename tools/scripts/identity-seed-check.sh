#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
mode="${IDENTITY_SEED_CHECK_MODE:-auto}"
gateway_base_url="${IDENTITY_SEED_CHECK_GATEWAY_BASE_URL:-http://localhost:8080}"
identity_db_dsn="${IDENTITY_SEED_CHECK_DB_DSN:-postgres://commerce:commerce@localhost:5432/identity?sslmode=disable}"

http_code=""
http_body=""

run_sql() {
  local sql="$1"

  if command -v psql >/dev/null 2>&1; then
    psql "$identity_db_dsn" -At -c "$sql"
    return
  fi

  if command -v docker >/dev/null 2>&1; then
    docker exec -i tmo-postgres psql -U commerce -d identity -At -c "$sql"
    return
  fi

  echo "[identity-seed-check] psql or docker is required for DB verification." >&2
  exit 1
}

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
    resp="$(curl -sS -X "$method" "${headers[@]}" -d "$data" -w "\n%{http_code}" "$url")"
  else
    resp="$(curl -sS -X "$method" "${headers[@]}" -w "\n%{http_code}" "$url")"
  fi

  http_body="$(echo "$resp" | sed '$d')"
  http_code="$(echo "$resp" | tail -n1)"
}

parse_token() {
  node -e 'const fs=require("fs");const body=JSON.parse(fs.readFileSync(0,"utf8"));process.stdout.write(body.accessToken||"")'
}

assert_query_equals() {
  local label="$1"
  local sql="$2"
  local expected="$3"
  local actual

  actual="$(run_sql "$sql" | tr -d '\r')"
  if [[ "$actual" != "$expected" ]]; then
    echo "[identity-seed-check] ${label} failed: expected '${expected}', got '${actual}'." >&2
    exit 1
  fi
  echo "[identity-seed-check] ${label}: ok"
}

check_db() {
  echo "[identity-seed-check] checking identity DB fixtures..."

  assert_query_equals "admin password+role" \
    "SELECT EXISTS (SELECT 1 FROM user_passwords up JOIN user_roles ur ON ur.user_id = up.user_id WHERE up.username = 'admin' AND ur.role = 'ADMIN');" \
    "t"
  assert_query_equals "boss password+role" \
    "SELECT EXISTS (SELECT 1 FROM user_passwords up JOIN user_roles ur ON ur.user_id = up.user_id WHERE up.username = 'boss' AND ur.role = 'BOSS');" \
    "t"
  assert_query_equals "manager password+role" \
    "SELECT EXISTS (SELECT 1 FROM user_passwords up JOIN user_roles ur ON ur.user_id = up.user_id WHERE up.username = 'manager' AND ur.role = 'MANAGER');" \
    "t"
  assert_query_equals "cs password+role" \
    "SELECT EXISTS (SELECT 1 FROM user_passwords up JOIN user_roles ur ON ur.user_id = up.user_id WHERE up.username = 'cs' AND ur.role = 'CS');" \
    "t"
  assert_query_equals "sales password+role" \
    "SELECT EXISTS (SELECT 1 FROM user_passwords up JOIN user_roles ur ON ur.user_id = up.user_id WHERE up.username = 'sales' AND ur.role = 'SALES');" \
    "t"

  assert_query_equals "mock sales binding" \
    "SELECT EXISTS (SELECT 1 FROM user_identities ui JOIN user_roles ur ON ur.user_id = ui.user_id WHERE ui.provider = 'weapp' AND ui.provider_user_id = 'mock_sales_001' AND ur.role = 'SALES');" \
    "t"
  assert_query_equals "mock customer binding" \
    "SELECT EXISTS (SELECT 1 FROM user_identities ui JOIN user_roles ur ON ur.user_id = ui.user_id WHERE ui.provider = 'weapp' AND ui.provider_user_id = 'mock_customer_001' AND ur.role = 'CUSTOMER');" \
    "t"
  assert_query_equals "mock multi-role binding" \
    "SELECT EXISTS (SELECT 1 FROM user_identities ui JOIN user_roles ur ON ur.user_id = ui.user_id WHERE ui.provider = 'weapp' AND ui.provider_user_id = 'mock_multi_001' AND ur.role = 'CUSTOMER');" \
    "t"

  assert_query_equals "sales phone whitelist" \
    "SELECT COALESCE((SELECT string_agg(role, ',' ORDER BY role) FROM unnest(roles) AS role), '') FROM staff_phone_whitelist WHERE phone = '+15550000002' AND enabled = true;" \
    "SALES"
  assert_query_equals "multi-role phone whitelist" \
    "SELECT COALESCE((SELECT string_agg(role, ',' ORDER BY role) FROM unnest(roles) AS role), '') FROM staff_phone_whitelist WHERE phone = '+15550000004' AND enabled = true;" \
    "CS,SALES"
}

check_api() {
  echo "[identity-seed-check] checking real login + bootstrap..."

  local role username password token
  for role in ADMIN BOSS MANAGER CS; do
    case "$role" in
      ADMIN)
        username="admin"
        password="admin123"
        ;;
      BOSS)
        username="boss"
        password="boss123"
        ;;
      MANAGER)
        username="manager"
        password="manager123"
        ;;
      CS)
        username="cs"
        password="cs123"
        ;;
    esac

    request "POST" "${gateway_base_url%/}/auth/password/login" "{\"username\":\"$username\",\"password\":\"$password\",\"role\":\"$role\"}"
    if [[ "$http_code" != "200" ]]; then
      echo "[identity-seed-check] ${role} login failed: ${http_code}" >&2
      echo "$http_body" >&2
      exit 1
    fi

    token="$(echo "$http_body" | parse_token)"
    if [[ -z "$token" ]]; then
      echo "[identity-seed-check] ${role} login returned empty accessToken." >&2
      exit 1
    fi

    request "GET" "${gateway_base_url%/}/bff/bootstrap" "" "$token"
    if [[ "$http_code" != "200" ]]; then
      echo "[identity-seed-check] ${role} bootstrap failed: ${http_code}" >&2
      echo "$http_body" >&2
      exit 1
    fi

    echo "[identity-seed-check] ${role} login + bootstrap: ok"
  done
}

should_run_api=false
case "$mode" in
  db)
    should_run_api=false
    ;;
  full)
    should_run_api=true
    ;;
  auto)
    if curl -fsS --max-time 2 "${gateway_base_url%/}/health" >/dev/null 2>&1; then
      should_run_api=true
    else
      echo "[identity-seed-check] gateway is not reachable at ${gateway_base_url}; skipping API checks in auto mode."
    fi
    ;;
  *)
    echo "[identity-seed-check] unsupported mode: ${mode}. Use db, full, or auto." >&2
    exit 1
    ;;
esac

check_db
if [[ "$should_run_api" == "true" ]]; then
  check_api
fi

echo "[identity-seed-check] all checks passed."
