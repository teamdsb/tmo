#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
base_url="${COMMERCE_API_BASE_URL:-http://localhost:8080}"
auth_token="${COMMERCE_PRODUCT_REQUEST_EXPORT_SMOKE_AUTH_TOKEN:-${COMMERCE_SMOKE_AUTH_TOKEN:-}}"
poll_seconds="${COMMERCE_PRODUCT_REQUEST_EXPORT_SMOKE_POLL_SECONDS:-45}"
admin_username="${COMMERCE_PRODUCT_REQUEST_EXPORT_SMOKE_ADMIN_USERNAME:-admin}"
admin_password="${COMMERCE_PRODUCT_REQUEST_EXPORT_SMOKE_ADMIN_PASSWORD:-admin123}"

http_code=""
http_body=""

request() {
  local method="$1"
  local url="$2"
  local data="${3:-}"
  local token="${4:-}"
  local headers=()

  if [[ -n "$data" ]]; then
    headers+=(-H "Content-Type: application/json")
  fi
  if [[ -n "$token" ]]; then
    headers+=(-H "Authorization: Bearer $token")
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

json_get() {
  local path="$1"
  if command -v node >/dev/null 2>&1; then
    node -e '
const fs = require("fs");
const path = process.argv[1] || "";
const body = JSON.parse(fs.readFileSync(0, "utf8"));
let current = body;
for (const segment of path.split(".")) {
  if (!segment) continue;
  if (current == null) break;
  if (/^\d+$/.test(segment)) {
    current = current[Number(segment)];
  } else {
    current = current[segment];
  }
}
if (current === undefined || current === null) {
  process.stdout.write("");
} else if (typeof current === "object") {
  process.stdout.write(JSON.stringify(current));
} else {
  process.stdout.write(String(current));
}
' "$path"
    return
  fi

  python -c '
import json, sys
path = sys.argv[1]
body = json.load(sys.stdin)
current = body
for segment in path.split("."):
    if not segment:
        continue
    if current is None:
        break
    if segment.isdigit():
        current = current[int(segment)]
    else:
        current = current.get(segment) if isinstance(current, dict) else None
if current is None:
    print("", end="")
elif isinstance(current, (dict, list)):
    print(json.dumps(current), end="")
else:
    print(str(current), end="")
' "$path"
}

parse_token() {
  if command -v node >/dev/null 2>&1; then
    node -e 'const fs=require("fs");const body=JSON.parse(fs.readFileSync(0,"utf8"));process.stdout.write(body.accessToken||"")'
    return
  fi

  python - <<'PY'
import json,sys
body=json.load(sys.stdin)
print(body.get("accessToken",""), end="")
PY
}

login_admin() {
  echo "[commerce-product-request-export-smoke] logging in as admin..." >&2
  request "POST" "$base_url/auth/password/login" "{\"username\":\"$admin_username\",\"password\":\"$admin_password\",\"role\":\"ADMIN\"}"
  if [[ "$http_code" != "200" ]]; then
    echo "admin login failed: $http_code" >&2
    echo "$http_body" >&2
    echo "set COMMERCE_PRODUCT_REQUEST_EXPORT_SMOKE_AUTH_TOKEN or COMMERCE_SMOKE_AUTH_TOKEN when hitting commerce directly." >&2
    exit 1
  fi

  auth_token="$(echo "$http_body" | parse_token)"
  if [[ -z "$auth_token" ]]; then
    echo "admin login returned empty accessToken" >&2
    exit 1
  fi
}

poll_job() {
  local job_id="$1"
  local start_ts
  start_ts="$(date +%s)"

  while true; do
    request "GET" "$base_url/admin/import-jobs/${job_id}" "" "$auth_token"
    if [[ "$http_code" != "200" ]]; then
      echo "poll export job failed: $http_code" >&2
      echo "$http_body" >&2
      exit 1
    fi

    local status
    status="$(echo "$http_body" | json_get 'status')"
    if [[ "$status" != "PENDING" && "$status" != "RUNNING" ]]; then
      printf "%s" "$http_body"
      return
    fi

    if (( "$(date +%s)" - start_ts > poll_seconds )); then
      echo "poll export job timed out after ${poll_seconds}s" >&2
      echo "$http_body" >&2
      exit 1
    fi
    sleep 1
  done
}

create_product_request() {
  local name="$1"
  request "POST" "$base_url/product-requests" "$(printf '{"name":"%s","spec":"M8","qty":"200 pcs","note":"smoke export request","referenceImageUrls":["https://example.com/smoke-a.png"]}' "$name")" "$auth_token"
  if [[ "$http_code" != "201" ]]; then
    echo "create product request failed: $http_code" >&2
    echo "$http_body" >&2
    exit 1
  fi
}

download_file() {
  local url="$1"
  local destination="$2"

  local resp
  resp="$(curl -sS -L -o "$destination" -w "%{http_code}" "$url")"
  if [[ "$resp" != "200" ]]; then
    echo "download export file failed: $resp" >&2
    echo "url: $url" >&2
    exit 1
  fi
}

inspect_workbook() {
  local workbook_path="$1"
  local validator_path="$tmp_dir/inspect_export.go"

  cat >"$validator_path" <<'GO'
package main

import (
	"fmt"
	"os"
	"strings"

	"github.com/xuri/excelize/v2"
)

func main() {
	if len(os.Args) != 2 {
		panic("usage: inspect_export <xlsx>")
	}
	file, err := excelize.OpenFile(os.Args[1])
	if err != nil {
		panic(err)
	}
	defer file.Close()

	sheet := file.GetSheetName(0)
	if sheet == "" {
		panic("workbook has no sheets")
	}
	rows, err := file.GetRows(sheet)
	if err != nil {
		panic(err)
	}
	if len(rows) < 2 {
		panic(fmt.Sprintf("expected header plus >=1 data row, got %d rows", len(rows)))
	}
	header := strings.Join(rows[0], ",")
	if !strings.Contains(header, "需求ID") || !strings.Contains(header, "商品名称") {
		panic(fmt.Sprintf("unexpected header row: %s", header))
	}
	fmt.Printf("rows=%d\n", len(rows))
}
GO

  (
    cd "$root_dir/services/commerce"
    go run "$validator_path" "$workbook_path"
  )
}

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

echo "[commerce-product-request-export-smoke] checking health..." >&2
request "GET" "$base_url/health"
if [[ "$http_code" != "200" ]]; then
  echo "health check failed: $http_code" >&2
  echo "$http_body" >&2
  exit 1
fi

echo "[commerce-product-request-export-smoke] checking readiness..." >&2
request "GET" "$base_url/ready"
if [[ "$http_code" != "200" ]]; then
  echo "ready check failed: $http_code" >&2
  echo "$http_body" >&2
  exit 1
fi

if [[ -z "$auth_token" ]]; then
  login_admin
fi

unique_suffix="$(date +%s)"
request_name="Smoke Export Request ${unique_suffix}"

echo "[commerce-product-request-export-smoke] creating product request fixture..." >&2
create_product_request "$request_name"

echo "[commerce-product-request-export-smoke] creating export job..." >&2
request "POST" "$base_url/admin/product-requests/export-jobs" '{}' "$auth_token"
if [[ "$http_code" != "202" ]]; then
  echo "create export job failed: $http_code" >&2
  echo "$http_body" >&2
  exit 1
fi

job_id="$(echo "$http_body" | json_get 'id')"
if [[ -z "$job_id" ]]; then
  echo "export job id missing" >&2
  exit 1
fi

job_json="$(poll_job "$job_id")"
job_status="$(echo "$job_json" | json_get 'status')"
result_url="$(echo "$job_json" | json_get 'resultFileUrl')"
if [[ "$job_status" != "SUCCEEDED" ]]; then
  echo "expected export job SUCCEEDED, got ${job_status}" >&2
  echo "$job_json" >&2
  exit 1
fi
if [[ -z "$result_url" ]]; then
  echo "expected export resultFileUrl" >&2
  echo "$job_json" >&2
  exit 1
fi

download_path="$tmp_dir/product-requests.xlsx"
echo "[commerce-product-request-export-smoke] downloading export workbook..." >&2
download_file "$result_url" "$download_path"

echo "[commerce-product-request-export-smoke] validating workbook..." >&2
inspect_workbook "$download_path" >/dev/null

echo "[commerce-product-request-export-smoke] all checks passed."
