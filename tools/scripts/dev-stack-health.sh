#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
db_diag_script="$root_dir/tools/scripts/dev-diagnose-db.sh"

health_timeout_seconds="${DEV_STACK_HEALTH_TIMEOUT_SECONDS:-180}"
health_interval_seconds="${DEV_STACK_HEALTH_INTERVAL_SECONDS:-2}"

gateway_base_url="${GATEWAY_BASE_URL:-http://localhost:8080}"
identity_base_url="${IDENTITY_BASE_URL:-http://localhost:8081}"
commerce_base_url="${COMMERCE_BASE_URL:-http://localhost:8082}"
payment_base_url="${PAYMENT_BASE_URL:-http://localhost:8083}"
smoke_auth_token="${COMMERCE_SMOKE_AUTH_TOKEN:-}"
smoke_admin_username="${COMMERCE_SMOKE_ADMIN_USERNAME:-admin}"
smoke_admin_password="${COMMERCE_SMOKE_ADMIN_PASSWORD:-admin123}"

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required for health checks." >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "node is required for health checks." >&2
  exit 1
fi

request_code() {
  local url="$1"
  curl -sS -o /dev/null -w "%{http_code}" "$url" || true
}

request_with_body() {
  local url="$1"
  curl -sS -w "\n%{http_code}" "$url" || true
}

request_upload() {
  local url="$1"
  local file_path="$2"
  local headers=()
  if [[ -n "$smoke_auth_token" ]]; then
    headers=(-H "Authorization: Bearer $smoke_auth_token")
  fi
  curl -sS -X POST "${headers[@]}" -F "file=@${file_path};type=image/png" -w "\n%{http_code}" "$url" || true
}

extract_json_token() {
  local body="$1"
  printf '%s' "$body" | node -e '
const fs = require("node:fs")
const body = fs.readFileSync(0, "utf8")
try {
  const payload = JSON.parse(body)
  if (typeof payload?.accessToken === "string") {
    process.stdout.write(payload.accessToken.trim())
  }
} catch {}
'
}

ensure_smoke_auth_token() {
  if [[ -n "$smoke_auth_token" ]]; then
    return
  fi

  local resp
  local body
  local code
  resp="$(curl -sS -X POST \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$smoke_admin_username\",\"password\":\"$smoke_admin_password\",\"role\":\"ADMIN\"}" \
    -w "\n%{http_code}" \
    "${gateway_base_url%/}/auth/password/login" || true)"
  body="$(echo "$resp" | sed '$d')"
  code="$(echo "$resp" | tail -n1)"
  if [[ "$code" != "200" ]]; then
    echo "[dev-stack-health] admin login for authenticated upload failed: ${code}" >&2
    echo "$body" >&2
    return 1
  fi

  smoke_auth_token="$(extract_json_token "$body")"
  if [[ -z "$smoke_auth_token" ]]; then
    echo "[dev-stack-health] admin login returned empty accessToken." >&2
    return 1
  fi
}

write_probe_png() {
  local file_path="$1"
  node -e '
const fs = require("node:fs")
const out = process.argv[1]
const data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5XfS8AAAAASUVORK5CYII="
fs.writeFileSync(out, Buffer.from(data, "base64"))
' "$file_path"
}

extract_json_url() {
  local body="$1"
  printf '%s' "$body" | node -e '
const fs = require("node:fs")
const body = fs.readFileSync(0, "utf8")
try {
  const payload = JSON.parse(body)
  if (typeof payload?.url === "string") {
    process.stdout.write(payload.url.trim())
  }
} catch {}
  '
}

run_db_diagnose() {
  if [[ ! -x "$db_diag_script" ]]; then
    echo "[dev-stack-health] DB diagnose script unavailable: $db_diag_script" >&2
    return
  fi
  echo "[dev-stack-health] running DB diagnosis..."
  bash "$db_diag_script" || true
}

should_diagnose_by_status() {
  local status="${1:-}"
  if [[ -z "$status" || "$status" == "000" ]]; then
    return 0
  fi
  if [[ "$status" =~ ^[0-9]+$ && "$status" -ge 500 ]]; then
    return 0
  fi
  return 1
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
  if should_diagnose_by_status "$code"; then
    run_db_diagnose
  fi
  return 1
}

wait_for_status_with_body() {
  local name="$1"
  local url="$2"
  local expected_status="$3"
  local deadline
  local code=""
  local body=""

  deadline=$((SECONDS + health_timeout_seconds))
  while (( SECONDS < deadline )); do
    local resp
    resp="$(request_with_body "$url")"
    body="$(echo "$resp" | sed '$d')"
    code="$(echo "$resp" | tail -n1)"
    if [[ "$code" == "$expected_status" ]]; then
      echo "[dev-stack-health] ready: ${name} (${url})"
      return 0
    fi
    sleep "$health_interval_seconds"
  done

  echo "[dev-stack-health] timeout waiting for ${name}: expected ${expected_status}, got ${code} (${url})" >&2
  if [[ -n "$body" ]]; then
    echo "$body" >&2
  fi
  if should_diagnose_by_status "$code"; then
    run_db_diagnose
  fi
  return 1
}

wait_for_upload_and_readback() {
  local name="$1"
  local upload_url="$2"
  local deadline
  local upload_code=""
  local upload_body=""
  local media_url=""
  local media_code=""
  local file_path

  ensure_smoke_auth_token

  file_path="$(mktemp "${TMPDIR:-/tmp}/tmo-upload-probe-XXXXXX")"
  write_probe_png "$file_path"

  deadline=$((SECONDS + health_timeout_seconds))
  while (( SECONDS < deadline )); do
    local resp
    resp="$(request_upload "$upload_url" "$file_path")"
    upload_body="$(echo "$resp" | sed '$d')"
    upload_code="$(echo "$resp" | tail -n1)"

    if [[ "$upload_code" == "201" ]]; then
      media_url="$(extract_json_url "$upload_body")"
      if [[ -n "$media_url" ]]; then
        media_code="$(request_code "$media_url")"
        if [[ "$media_code" == "200" ]]; then
          echo "[dev-stack-health] ready: ${name} (${upload_url}) upload=201 readback=200"
          rm -f "$file_path"
          return 0
        fi
      fi
    fi
    sleep "$health_interval_seconds"
  done

  rm -f "$file_path"
  if [[ "$upload_code" == "404" ]]; then
    echo "[dev-stack-health] ${name} upload route returned 404 (${upload_url}). This usually means backend containers are stale." >&2
    echo "[dev-stack-health] run: DEV_STACK_BUILD_IMAGES=true bash tools/scripts/dev-stack-up.sh" >&2
    return 1
  fi
  if [[ "$upload_code" == "201" && "$media_code" == "404" ]]; then
    echo "[dev-stack-health] ${name} upload succeeded but media readback returned 404." >&2
    echo "[dev-stack-health] check MEDIA_LOCAL_OUTPUT_DIR, MEDIA_PUBLIC_BASE_URL and GATEWAY_MEDIA_LOCAL_DIR consistency." >&2
    echo "[dev-stack-health] media url: ${media_url}" >&2
    return 1
  fi

  echo "[dev-stack-health] timeout waiting for ${name}: upload=${upload_code}, media=${media_code:-n/a}" >&2
  if [[ -n "$upload_body" ]]; then
    echo "$upload_body" >&2
  fi
  if should_diagnose_by_status "$upload_code" || should_diagnose_by_status "${media_code:-}"; then
    run_db_diagnose
  fi
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
wait_for_status_with_body "gateway /bff/bootstrap" "${gateway_base_url%/}/bff/bootstrap" "200"
wait_for_status_with_body "gateway /catalog/categories" "${gateway_base_url%/}/catalog/categories" "200"
wait_for_status_with_body "gateway /catalog/products" "${gateway_base_url%/}/catalog/products?page=1&pageSize=20" "200"
wait_for_status "gateway /assets/img (validation)" "${gateway_base_url%/}/assets/img" "400"
wait_for_status "gateway /assets/media (validation)" "${gateway_base_url%/}/assets/media/catalog/non-existent.jpg" "404"
wait_for_upload_and_readback "gateway /product-requests/assets (multipart route)" "${gateway_base_url%/}/product-requests/assets"

echo "[dev-stack-health] all checks passed."
