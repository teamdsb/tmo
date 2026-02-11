#!/usr/bin/env bash
set -euo pipefail

base_url="${GATEWAY_BASE_URL:-http://localhost:8080}"

http_code=""
http_body=""
products_body=""
upload_asset_url=""

request() {
  local method="$1"
  local url="$2"
  local data="${3:-}"
  local resp

  if [[ -n "$data" ]]; then
    resp="$(curl -sS -X "$method" -H 'Content-Type: application/json' -d "$data" -w "\n%{http_code}" "$url")"
  else
    resp="$(curl -sS -X "$method" -w "\n%{http_code}" "$url")"
  fi

  http_body="$(echo "$resp" | sed '$d')"
  http_code="$(echo "$resp" | tail -n1)"
}

request_upload_probe() {
  local url="$1"
  local file_path
  local resp

  file_path="$(mktemp "${TMPDIR:-/tmp}/tmo-upload-probe-XXXXXX.png")"
  node -e '
const fs = require("node:fs")
const out = process.argv[1]
const data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5XfS8AAAAASUVORK5CYII="
fs.writeFileSync(out, Buffer.from(data, "base64"))
' "$file_path"
  resp="$(curl -sS -X POST -F "file=@${file_path};type=image/png" -w "\n%{http_code}" "$url" || true)"
  rm -f "$file_path"

  http_body="$(echo "$resp" | sed '$d')"
  http_code="$(echo "$resp" | tail -n1)"

  upload_asset_url="$(printf '%s' "$http_body" | node -e '
const fs = require("node:fs")
const body = fs.readFileSync(0, "utf8")
try {
  const payload = JSON.parse(body)
  if (typeof payload?.url === "string") {
    process.stdout.write(payload.url.trim())
  }
} catch {}
')"
}

require_200() {
  local label="$1"
  if [[ "$http_code" != "200" ]]; then
    echo "[miniapp-http-smoke] ${label} failed: ${http_code}" >&2
    echo "$http_body" >&2
    exit 1
  fi
}

require_201() {
  local label="$1"
  if [[ "$http_code" != "201" ]]; then
    echo "[miniapp-http-smoke] ${label} failed: ${http_code}" >&2
    echo "$http_body" >&2
    exit 1
  fi
}

echo "[miniapp-http-smoke] checking bootstrap..."
request "GET" "${base_url%/}/bff/bootstrap"
require_200 "bootstrap"

echo "[miniapp-http-smoke] checking categories..."
request "GET" "${base_url%/}/catalog/categories"
require_200 "categories"

echo "[miniapp-http-smoke] checking products..."
request "GET" "${base_url%/}/catalog/products?page=1&pageSize=20"
require_200 "products"
products_body="$http_body"

echo "[miniapp-http-smoke] checking demand image upload and media readback..."
request_upload_probe "${base_url%/}/product-requests/assets"
require_201 "product-requests/assets upload"

if [[ -z "$upload_asset_url" ]]; then
  echo "[miniapp-http-smoke] product-requests/assets upload response does not contain url." >&2
  echo "$http_body" >&2
  exit 1
fi

if [[ "$upload_asset_url" != http://* && "$upload_asset_url" != https://* ]]; then
  upload_asset_url="${base_url%/}${upload_asset_url}"
fi

request "GET" "$upload_asset_url"
require_200 "product-requests/assets readback"

proxy_url="$(printf '%s' "$products_body" | node -e '
const fs = require("node:fs")
const content = fs.readFileSync(0, "utf8")
let payload = null
try {
  payload = JSON.parse(content)
} catch {
  process.exit(0)
}
const items = Array.isArray(payload?.items) ? payload.items : []
for (const item of items) {
  const value = typeof item?.coverImageUrl === "string" ? item.coverImageUrl.trim() : ""
  if (!value) {
    continue
  }
  process.stdout.write(value)
  process.exit(0)
}
')"

if [[ -z "$proxy_url" ]]; then
  echo "[miniapp-http-smoke] could not extract coverImageUrl from products response." >&2
  echo "$products_body" >&2
  exit 1
fi

if [[ "$proxy_url" != http://* && "$proxy_url" != https://* ]]; then
  proxy_url="${base_url%/}${proxy_url}"
fi

if [[ "$proxy_url" == *"/assets/img?url="* ]]; then
  echo "[miniapp-http-smoke] checking gateway image proxy url..."
  request "GET" "$proxy_url"
  require_200 "image proxy"
elif [[ "$proxy_url" == *"/assets/media/"* ]]; then
  echo "[miniapp-http-smoke] checking gateway local media url..."
  request "GET" "$proxy_url"
  require_200 "local media"
else
  echo "[miniapp-http-smoke] unsupported coverImageUrl source: $proxy_url" >&2
  exit 1
fi

echo "[miniapp-http-smoke] smoke checks passed."
