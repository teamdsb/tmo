#!/usr/bin/env bash
set -euo pipefail

health_timeout_seconds="${DEV_STACK_HEALTH_TIMEOUT_SECONDS:-180}"
health_interval_seconds="${DEV_STACK_HEALTH_INTERVAL_SECONDS:-2}"

gateway_base_url="${GATEWAY_BASE_URL:-http://localhost:8080}"
identity_base_url="${IDENTITY_BASE_URL:-http://localhost:8081}"
commerce_base_url="${COMMERCE_BASE_URL:-http://localhost:8082}"
payment_base_url="${PAYMENT_BASE_URL:-http://localhost:8083}"

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

request_upload() {
  local url="$1"
  local file_path="$2"
  curl -sS -X POST -F "file=@${file_path};type=image/png" -w "\n%{http_code}" "$url" || true
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

  file_path="$(mktemp "${TMPDIR:-/tmp}/tmo-upload-probe-XXXXXX.png")"
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
wait_for_status "gateway /assets/img (validation)" "${gateway_base_url%/}/assets/img" "400"
wait_for_status "gateway /assets/media (validation)" "${gateway_base_url%/}/assets/media/catalog/non-existent.jpg" "404"
wait_for_upload_and_readback "gateway /product-requests/assets (multipart route)" "${gateway_base_url%/}/product-requests/assets"

echo "[dev-stack-health] all checks passed."
