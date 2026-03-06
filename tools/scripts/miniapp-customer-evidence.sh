#!/usr/bin/env bash
set -euo pipefail

phone="${MINIAPP_CUSTOMER_EVIDENCE_PHONE:-}"
provider="${MINIAPP_CUSTOMER_EVIDENCE_PROVIDER:-}"
gateway_base_url="${MINIAPP_CUSTOMER_EVIDENCE_GATEWAY_BASE_URL:-http://localhost:8080}"
identity_db_dsn="${MINIAPP_CUSTOMER_EVIDENCE_DB_DSN:-postgres://commerce:commerce@localhost:5432/identity?sslmode=disable}"
admin_username="${MINIAPP_CUSTOMER_EVIDENCE_ADMIN_USERNAME:-admin}"
admin_password="${MINIAPP_CUSTOMER_EVIDENCE_ADMIN_PASSWORD:-admin123}"

http_code=""
http_body=""

if [[ -z "$phone" ]]; then
  echo "[miniapp-customer-evidence] MINIAPP_CUSTOMER_EVIDENCE_PHONE is required." >&2
  exit 1
fi

if [[ -z "$provider" ]]; then
  echo "[miniapp-customer-evidence] MINIAPP_CUSTOMER_EVIDENCE_PROVIDER is required (weapp or alipay)." >&2
  exit 1
fi

provider="$(printf '%s' "$provider" | tr '[:upper:]' '[:lower:]')"
if [[ "$provider" != "weapp" && "$provider" != "alipay" ]]; then
  echo "[miniapp-customer-evidence] unsupported provider: $provider" >&2
  exit 1
fi

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

parse_json_field() {
  local expression="$1"
  node -e "const fs=require('fs');const body=JSON.parse(fs.readFileSync(0,'utf8'));const value=(${expression});if(value===undefined||value===null){process.stdout.write('');}else if(typeof value==='string'){process.stdout.write(value);}else{process.stdout.write(JSON.stringify(value));}"
}

urlencode() {
  node -e "process.stdout.write(encodeURIComponent(process.argv[1] || ''))" "$1"
}

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

  echo "[miniapp-customer-evidence] psql or docker is required for DB verification." >&2
  exit 1
}

echo "[miniapp-customer-evidence] admin login..."
request "POST" "${gateway_base_url%/}/auth/password/login" "{\"username\":\"$admin_username\",\"password\":\"$admin_password\",\"role\":\"ADMIN\"}"
if [[ "$http_code" != "200" ]]; then
  echo "[miniapp-customer-evidence] admin login failed: $http_code" >&2
  echo "$http_body" >&2
  exit 1
fi
admin_token="$(echo "$http_body" | parse_json_field 'body.accessToken')"
if [[ -z "$admin_token" ]]; then
  echo "[miniapp-customer-evidence] admin accessToken is empty." >&2
  exit 1
fi

echo "[miniapp-customer-evidence] query /admin/customers by phone..."
encoded_phone="$(urlencode "$phone")"
request "GET" "${gateway_base_url%/}/admin/customers?page=1&pageSize=20&q=${encoded_phone}" "" "$admin_token"
if [[ "$http_code" != "200" ]]; then
  echo "[miniapp-customer-evidence] /admin/customers failed: $http_code" >&2
  echo "$http_body" >&2
  exit 1
fi

customer_id="$(echo "$http_body" | parse_json_field "(() => { const items = Array.isArray(body.items) ? body.items : []; const matched = items.find((item) => String(item.phone || '').trim() === '$phone'); return matched ? String(matched.id || '') : ''; })()")"
customer_display_name="$(echo "$http_body" | parse_json_field "(() => { const items = Array.isArray(body.items) ? body.items : []; const matched = items.find((item) => String(item.phone || '').trim() === '$phone'); return matched ? String(matched.displayName || '') : ''; })()")"
if [[ -z "$customer_id" ]]; then
  echo "[miniapp-customer-evidence] no admin customer found for phone $phone." >&2
  echo "$http_body" >&2
  exit 1
fi

echo "[miniapp-customer-evidence] query DB for CUSTOMER + identity binding..."
escaped_phone="${phone//\'/\'\'}"
escaped_provider="${provider//\'/\'\'}"
db_row="$(run_sql "
SELECT u.id || '|' || COALESCE(u.display_name, '') || '|' || lower(u.user_type) || '|' ||
       COALESCE((SELECT string_agg(role, ',' ORDER BY role) FROM user_roles WHERE user_id = u.id), '') || '|' ||
       COALESCE((SELECT string_agg(provider || ':' || provider_user_id, ',' ORDER BY provider, provider_user_id) FROM user_identities WHERE user_id = u.id), '')
FROM users u
WHERE u.phone = '${escaped_phone}'
LIMIT 1;
")"
if [[ -z "$db_row" ]]; then
  echo "[miniapp-customer-evidence] DB record not found for phone $phone." >&2
  exit 1
fi

IFS='|' read -r db_user_id db_display_name db_user_type db_roles db_identities <<<"$db_row"
if [[ "$db_user_type" != "customer" ]]; then
  echo "[miniapp-customer-evidence] expected user_type=customer, got $db_user_type." >&2
  exit 1
fi
if [[ ",$db_roles," != *",CUSTOMER,"* ]]; then
  echo "[miniapp-customer-evidence] expected CUSTOMER role, got $db_roles." >&2
  exit 1
fi
if [[ "$db_identities" != *"${escaped_provider}:"* ]]; then
  echo "[miniapp-customer-evidence] expected ${provider} identity binding, got $db_identities." >&2
  exit 1
fi
if [[ "$db_user_id" != "$customer_id" ]]; then
  echo "[miniapp-customer-evidence] API/DB user mismatch: api=$customer_id db=$db_user_id." >&2
  exit 1
fi

echo "[miniapp-customer-evidence] PASS"
echo "provider=$provider"
echo "phone=$phone"
echo "customerId=$customer_id"
echo "displayName=${customer_display_name:-$db_display_name}"
echo "roles=$db_roles"
echo "identities=$db_identities"
