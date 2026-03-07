#!/usr/bin/env bash
set -euo pipefail

base_url="${GATEWAY_BASE_URL:-http://localhost:8080}"
require_inquiries_raw="${DEV_SEED_CHECK_REQUIRE_INQUIRIES:-true}"
require_inquiries="$(printf '%s' "$require_inquiries_raw" | tr '[:upper:]' '[:lower:]')"
expected_inquiry_id="77777777-7777-7777-7777-777777777777"
expected_inquiry_customer_id="dddddddd-dddd-dddd-dddd-dddddddddddd"
expected_inquiry_sales_id="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
expected_inquiry_sku_id="33333333-3333-3333-3333-333333333305"

http_code=""
http_body=""

require_binary() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "[seed-check] required binary missing: $name" >&2
    exit 1
  fi
}

request() {
  local method="$1"
  local url="$2"
  local data="${3:-}"
  local token="${4:-}"
  local headers=()
  local resp=""

  if [[ -n "$data" ]]; then
    headers+=(-H 'Content-Type: application/json')
  fi
  if [[ -n "$token" ]]; then
    headers+=(-H "Authorization: Bearer $token")
  fi

  if [[ ${#headers[@]} -gt 0 ]]; then
    if [[ -n "$data" ]]; then
      resp="$(curl -sS -X "$method" "${headers[@]}" -d "$data" -w "\n%{http_code}" "$url")"
    else
      resp="$(curl -sS -X "$method" "${headers[@]}" -w "\n%{http_code}" "$url")"
    fi
  else
    if [[ -n "$data" ]]; then
      resp="$(curl -sS -X "$method" -d "$data" -w "\n%{http_code}" "$url")"
    else
      resp="$(curl -sS -X "$method" -w "\n%{http_code}" "$url")"
    fi
  fi

  http_body="$(echo "$resp" | sed '$d')"
  http_code="$(echo "$resp" | tail -n1)"
}

json_eval() {
  local script="$1"
  printf '%s' "$http_body" | node -e "$script"
}

parse_token() {
  json_eval 'const fs=require("fs"); const payload=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(String(payload.accessToken || ""));'
}

assert_http_code() {
  local expected="$1"
  local label="$2"
  if [[ "$http_code" != "$expected" ]]; then
    echo "[seed-check] FAIL ${label}: expected ${expected}, got ${http_code}" >&2
    if [[ -n "$http_body" ]]; then
      echo "$http_body" >&2
    fi
    exit 1
  fi
}

assert_json() {
  local script="$1"
  local label="$2"
  if ! json_eval "$script" >/dev/null; then
    echo "[seed-check] FAIL ${label}" >&2
    if [[ -n "$http_body" ]]; then
      echo "$http_body" >&2
    fi
    exit 1
  fi
}

login_password() {
  local username="$1"
  local password="$2"
  local role="$3"
  local label="$4"

  request "POST" "${base_url%/}/auth/password/login" "{\"username\":\"${username}\",\"password\":\"${password}\",\"role\":\"${role}\"}"
  assert_http_code "200" "${label} password login"
  local token
  token="$(parse_token)"
  if [[ -z "$token" ]]; then
    echo "[seed-check] FAIL ${label} password login: token missing" >&2
    exit 1
  fi
  printf '%s' "$token"
}

verify_bootstrap_role() {
  local token="$1"
  local expected_role="$2"
  local label="$3"

  request "GET" "${base_url%/}/bff/bootstrap" "" "$token"
  assert_http_code "200" "${label} bootstrap"
  assert_json "const fs=require('fs'); const payload=JSON.parse(fs.readFileSync(0,'utf8')); if (!Array.isArray(payload?.me?.roles) || !payload.me.roles.includes('${expected_role}')) process.exit(1);" "${label} bootstrap roles"
}

mini_login() {
  local payload="$1"
  local label="$2"
  local expected_status="$3"

  request "POST" "${base_url%/}/auth/mini/login" "$payload"
  assert_http_code "$expected_status" "${label} mini login"
}

require_health() {
  request "GET" "${base_url%/}/health"
  assert_http_code "200" "gateway health"
}

require_catalog_seed() {
  request "GET" "${base_url%/}/catalog/categories"
  assert_http_code "200" "catalog categories"
  assert_json "const fs=require('fs'); const payload=JSON.parse(fs.readFileSync(0,'utf8')); const items=Array.isArray(payload) ? payload : payload?.items; if (!Array.isArray(items) || items.length === 0) process.exit(1);" "catalog categories non-empty"

  request "GET" "${base_url%/}/catalog/products?page=1&pageSize=5"
  assert_http_code "200" "catalog products"
  assert_json "const fs=require('fs'); const payload=JSON.parse(fs.readFileSync(0,'utf8')); if (!Array.isArray(payload?.items) || payload.items.length === 0) process.exit(1);" "catalog products non-empty"

  local first_product_id
  first_product_id="$(json_eval 'const fs=require("fs"); const payload=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(String(payload.items?.[0]?.id || ""));')"
  if [[ -z "$first_product_id" ]]; then
    echo "[seed-check] FAIL catalog products detail: first product id missing" >&2
    exit 1
  fi

  request "GET" "${base_url%/}/catalog/products/${first_product_id}"
  assert_http_code "200" "catalog product detail"
}

check_inquiries() {
  local token="$1"

  request "GET" "${base_url%/}/inquiries/price?page=1&pageSize=5" "" "$token"
  assert_http_code "200" "inquiries list"

  local fixture_summary
  fixture_summary="$(json_eval "const fs=require('fs'); const payload=JSON.parse(fs.readFileSync(0,'utf8')); const items=Array.isArray(payload?.items)?payload.items:[]; const hit=items.find((item)=>item?.id==='${expected_inquiry_id}'|| (item?.createdByUserId==='${expected_inquiry_customer_id}' && item?.skuId==='${expected_inquiry_sku_id}')); if(!hit){process.exit(1)} process.stdout.write(JSON.stringify({id: hit.id || '', createdByUserId: hit.createdByUserId || '', assignedSalesUserId: hit.assignedSalesUserId || '', skuId: hit.skuId || '', status: hit.status || '', message: hit.message || ''}));")"
  if [[ -z "$fixture_summary" ]]; then
    if [[ "$require_inquiries" == "true" ]]; then
      echo "[seed-check] FAIL inquiries seed missing: fixture not found" >&2
      echo "$http_body" >&2
      exit 1
    fi
    echo "[seed-check] WARN inquiries seed missing: fixture not found"
    return
  fi

  if ! printf '%s' "$fixture_summary" | node -e "const fs=require('fs'); const item=JSON.parse(fs.readFileSync(0,'utf8')); if(item.id!=='${expected_inquiry_id}') process.exit(1); if(item.createdByUserId!=='${expected_inquiry_customer_id}') process.exit(1); if(item.assignedSalesUserId!=='${expected_inquiry_sales_id}') process.exit(1); if(item.skuId!=='${expected_inquiry_sku_id}') process.exit(1); if(item.status!=='OPEN') process.exit(1); if(typeof item.message!=='string' || !item.message.includes('镀锌槽钢 C100')) process.exit(1);"; then
    echo "[seed-check] FAIL inquiries seed malformed: ${fixture_summary}" >&2
    exit 1
  fi

  echo "[seed-check] OK inquiries seed present: ${fixture_summary}"
}

require_binary "curl"
require_binary "node"

echo "[seed-check] checking gateway health..."
require_health

echo "[seed-check] checking password login fixtures..."
boss_token="$(login_password "boss" "boss123" "BOSS" "boss")"
verify_bootstrap_role "$boss_token" "BOSS" "boss"

admin_token="$(login_password "admin" "admin123" "ADMIN" "admin")"
verify_bootstrap_role "$admin_token" "ADMIN" "admin"

echo "[seed-check] checking mini login fixtures..."
mini_login '{"platform":"weapp","code":"mock_customer_001"}' "mock_customer_001" "200"
assert_json "const fs=require('fs'); const payload=JSON.parse(fs.readFileSync(0,'utf8')); if (!payload?.user || !Array.isArray(payload.user.roles) || !payload.user.roles.includes('CUSTOMER')) process.exit(1);" "mock_customer_001 role"

mini_login '{"platform":"weapp","code":"mock_sales_001","role":"SALES"}' "mock_sales_001" "200"
assert_json "const fs=require('fs'); const payload=JSON.parse(fs.readFileSync(0,'utf8')); if (!payload?.user || !Array.isArray(payload.user.roles) || !payload.user.roles.includes('SALES')) process.exit(1);" "mock_sales_001 role"

mini_login '{"platform":"weapp","code":"mock_multi_001"}' "mock_multi_001 role selection" "409"
assert_json "const fs=require('fs'); const payload=JSON.parse(fs.readFileSync(0,'utf8')); const roles=payload?.details?.availableRoles; if (!Array.isArray(roles) || !roles.includes('CUSTOMER') || !roles.includes('SALES')) process.exit(1);" "mock_multi_001 available roles"

mini_login '{"platform":"weapp","code":"mock_multi_001","role":"SALES"}' "mock_multi_001 sales login" "200"
assert_json "const fs=require('fs'); const payload=JSON.parse(fs.readFileSync(0,'utf8')); if (!payload?.user || !Array.isArray(payload.user.roles) || !payload.user.roles.includes('SALES')) process.exit(1);" "mock_multi_001 selected role"

echo "[seed-check] checking catalog seed..."
require_catalog_seed

echo "[seed-check] checking inquiry seed..."
check_inquiries "$boss_token"

echo "[seed-check] OK real-data fixtures are available."
