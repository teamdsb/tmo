#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
base_url="${COMMERCE_API_BASE_URL:-http://localhost:8080}"
auth_token="${COMMERCE_SMOKE_AUTH_TOKEN:-}"
poll_seconds="${COMMERCE_PRODUCT_IMPORT_SMOKE_POLL_SECONDS:-45}"

http_code=""
http_body=""

request() {
  local method="$1"
  local url="$2"
  local data="${3:-}"
  local extra_args=("${@:4}")
  local headers=()
  local curl_args=(-sS -X "$method")

  if [[ -n "$auth_token" ]]; then
    headers+=(-H "Authorization: Bearer $auth_token")
  fi
  if [[ -n "$data" ]]; then
    headers+=(-H "Content-Type: application/json")
  fi
  if ((${#headers[@]})); then
    curl_args+=("${headers[@]}")
  fi
  if ((${#extra_args[@]})); then
    curl_args+=("${extra_args[@]}")
  fi

  local resp
  if [[ -n "$data" ]]; then
    resp="$(curl "${curl_args[@]}" -d "$data" -w "\n%{http_code}" "$url")"
  else
    resp="$(curl "${curl_args[@]}" -w "\n%{http_code}" "$url")"
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
for segment in path.split('.'):
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

ensure_category_id() {
  echo "[commerce-product-import-smoke] loading categories..." >&2
  request "GET" "$base_url/catalog/categories"
  if [[ "$http_code" != "200" ]]; then
    echo "list categories failed: $http_code" >&2
    echo "$http_body" >&2
    exit 1
  fi

  local category_id
  category_id="$(echo "$http_body" | json_get 'items.0.id')"
  if [[ -n "$category_id" ]]; then
    printf "%s" "$category_id"
    return
  fi

  echo "[commerce-product-import-smoke] creating category..." >&2
  request "POST" "$base_url/catalog/categories" '{"name":"Smoke Import Category","sort":999}'
  if [[ "$http_code" != "201" ]]; then
    echo "create category failed: $http_code" >&2
    echo "$http_body" >&2
    exit 1
  fi

  category_id="$(echo "$http_body" | json_get 'id')"
  if [[ -z "$category_id" ]]; then
    echo "category id missing from create response" >&2
    exit 1
  fi
  printf "%s" "$category_id"
}

generate_fixture() {
  local mode="$1"
  local xlsx_path="$2"
  local zip_path="$3"
  local product_name="$4"
  local category_id="$5"
  local sku_prefix="$6"
  local generator_path="$tmp_dir/generate-fixture.go"

  cat >"$generator_path" <<'GO'
package main

import (
	"archive/zip"
	"fmt"
	"os"

	"github.com/xuri/excelize/v2"
)

func must(err error) {
	if err != nil {
		panic(err)
	}
}

func main() {
	if len(os.Args) != 7 {
		panic("usage: <mode> <xlsx> <zip> <productName> <categoryID> <skuPrefix>")
	}
	mode := os.Args[1]
	xlsxPath := os.Args[2]
	zipPath := os.Args[3]
	productName := os.Args[4]
	categoryID := os.Args[5]
	skuPrefix := os.Args[6]

	headers := []string{
		"Group Key",
		"SKU Code",
		"Product Name",
		"SKU Name",
		"Category ID",
		"Description",
		"Cover Image",
		"Images",
		"Tags",
		"Filter Dimensions",
		"Spec",
		"Attributes",
		"Unit",
		"Is Active",
		"Price Tiers (Fen)",
	}

	rows := [][]string{
		{
			fmt.Sprintf("%s-group", skuPrefix),
			fmt.Sprintf("%s-A", skuPrefix),
			productName,
			productName + " A",
			categoryID,
			"smoke import product",
			"",
			"",
			"smoke|import",
			"material|size",
			"M6",
			"material:steel|size:M6",
			"pcs",
			"true",
			"1-9:1200|10-:1000",
		},
	}
	if mode == "partial" {
		rows = append(rows, []string{
			fmt.Sprintf("%s-bad-group", skuPrefix),
			fmt.Sprintf("%s-BAD", skuPrefix),
			productName + " Partial",
			productName + " Broken",
			categoryID,
			"broken row",
			"",
			"",
			"",
			"",
			"",
			"material:steel",
			"pcs",
			"true",
			"oops",
		})
	} else {
		rows[0][6] = "main.png"
		rows[0][7] = "main.png|detail.png"
	}

	file := excelize.NewFile()
	sheet := file.GetSheetName(0)
	allRows := append([][]string{headers}, rows...)
	for rowIndex, row := range allRows {
		for columnIndex, value := range row {
			cell, err := excelize.CoordinatesToCellName(columnIndex+1, rowIndex+1)
			must(err)
			must(file.SetCellValue(sheet, cell, value))
		}
	}

	must(file.SaveAs(xlsxPath))
	if mode != "success" {
		return
	}

	zipFile, err := os.Create(zipPath)
	must(err)
	defer zipFile.Close()
	archive := zip.NewWriter(zipFile)
	for _, name := range []string{"main.png", "detail.png"} {
		entry, err := archive.Create(name)
		must(err)
		_, err = entry.Write([]byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D})
		must(err)
	}
	must(archive.Close())
}
GO

  (
    cd "$root_dir/services/commerce"
    go run "$generator_path" "$mode" "$xlsx_path" "$zip_path" "$product_name" "$category_id" "$sku_prefix"
  )
}

upload_product_import() {
  local xlsx_path="$1"
  local zip_path="$2"
  local image_base_url="${3:-}"
  local curl_args=(-sS -X POST)
  if [[ -n "$auth_token" ]]; then
    curl_args+=(-H "Authorization: Bearer $auth_token")
  fi
  curl_args+=(-F "excelFile=@${xlsx_path}")
  if [[ -f "$zip_path" ]]; then
    curl_args+=(-F "imagesZip=@${zip_path}")
  fi
  if [[ -n "$image_base_url" ]]; then
    curl_args+=(-F "imageBaseUrl=${image_base_url}")
  fi

  local resp
  resp="$(curl "${curl_args[@]}" -w "\n%{http_code}" "$base_url/admin/products/import-jobs")"
  http_body="$(echo "$resp" | sed '$d')"
  http_code="$(echo "$resp" | tail -n1)"
}

poll_job() {
  local job_id="$1"
  local start_ts
  start_ts="$(date +%s)"
  while true; do
    request "GET" "$base_url/admin/import-jobs/${job_id}"
    if [[ "$http_code" != "200" ]]; then
      echo "poll import job failed: $http_code" >&2
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
      echo "poll import job timed out after ${poll_seconds}s" >&2
      echo "$http_body" >&2
      exit 1
    fi
    sleep 1
  done
}

assert_product_visible() {
  local product_name="$1"
  local resp
  resp="$(curl -sS -G -w "\n%{http_code}" --data-urlencode "page=1" --data-urlencode "pageSize=20" --data-urlencode "q=${product_name}" "$base_url/catalog/products")"
  http_body="$(echo "$resp" | sed '$d')"
  http_code="$(echo "$resp" | tail -n1)"
  if [[ "$http_code" != "200" ]]; then
    echo "query products failed: $http_code" >&2
    echo "$http_body" >&2
    exit 1
  fi

  local first_name
  first_name="$(echo "$http_body" | json_get 'items.0.name')"
  if [[ "$first_name" != "$product_name" ]]; then
    echo "expected imported product ${product_name}, got ${first_name}" >&2
    echo "$http_body" >&2
    exit 1
  fi
}

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

echo "[commerce-product-import-smoke] checking health..."
request "GET" "$base_url/health"
if [[ "$http_code" != "200" ]]; then
  echo "health check failed: $http_code" >&2
  echo "$http_body" >&2
  exit 1
fi

echo "[commerce-product-import-smoke] checking readiness..."
request "GET" "$base_url/ready"
if [[ "$http_code" != "200" ]]; then
  echo "ready check failed: $http_code" >&2
  echo "$http_body" >&2
  exit 1
fi

category_id="$(ensure_category_id)"
unique_suffix="$(date +%s)"

success_name="Smoke Import Product ${unique_suffix}"
success_sku="SMOKE-${unique_suffix}"
success_xlsx="$tmp_dir/success.xlsx"
success_zip="$tmp_dir/images.zip"
generate_fixture "success" "$success_xlsx" "$success_zip" "$success_name" "$category_id" "$success_sku"

echo "[commerce-product-import-smoke] creating success import job..."
upload_product_import "$success_xlsx" "$success_zip" "https://cdn.example.com/catalog"
if [[ "$http_code" != "202" ]]; then
  echo "create success import job failed: $http_code" >&2
  echo "$http_body" >&2
  exit 1
fi

success_job_id="$(echo "$http_body" | json_get 'id')"
if [[ -z "$success_job_id" ]]; then
  echo "success import job id missing" >&2
  exit 1
fi

success_job_json="$(poll_job "$success_job_id")"
success_status="$(echo "$success_job_json" | json_get 'status')"
success_result_url="$(echo "$success_job_json" | json_get 'resultFileUrl')"
success_error_url="$(echo "$success_job_json" | json_get 'errorReportUrl')"
if [[ "$success_status" != "SUCCEEDED" ]]; then
  echo "expected success job SUCCEEDED, got ${success_status}" >&2
  echo "$success_job_json" >&2
  exit 1
fi
if [[ -z "$success_result_url" ]]; then
  echo "expected success job resultFileUrl" >&2
  echo "$success_job_json" >&2
  exit 1
fi
if [[ -n "$success_error_url" ]]; then
  echo "expected success job to have empty errorReportUrl, got ${success_error_url}" >&2
  exit 1
fi
assert_product_visible "$success_name"

partial_name="Smoke Partial Product ${unique_suffix}"
partial_sku="SMOKE-PARTIAL-${unique_suffix}"
partial_xlsx="$tmp_dir/partial.xlsx"
partial_zip="$tmp_dir/partial.zip"
generate_fixture "partial" "$partial_xlsx" "$partial_zip" "$partial_name" "$category_id" "$partial_sku"

echo "[commerce-product-import-smoke] creating partial-success import job..."
upload_product_import "$partial_xlsx" "$partial_zip"
if [[ "$http_code" != "202" ]]; then
  echo "create partial import job failed: $http_code" >&2
  echo "$http_body" >&2
  exit 1
fi

partial_job_id="$(echo "$http_body" | json_get 'id')"
if [[ -z "$partial_job_id" ]]; then
  echo "partial import job id missing" >&2
  exit 1
fi

partial_job_json="$(poll_job "$partial_job_id")"
partial_status="$(echo "$partial_job_json" | json_get 'status')"
partial_result_url="$(echo "$partial_job_json" | json_get 'resultFileUrl')"
partial_error_url="$(echo "$partial_job_json" | json_get 'errorReportUrl')"
if [[ "$partial_status" != "SUCCEEDED" ]]; then
  echo "expected partial job SUCCEEDED, got ${partial_status}" >&2
  echo "$partial_job_json" >&2
  exit 1
fi
if [[ -z "$partial_result_url" ]]; then
  echo "expected partial job resultFileUrl" >&2
  echo "$partial_job_json" >&2
  exit 1
fi
if [[ -z "$partial_error_url" ]]; then
  echo "expected partial job errorReportUrl" >&2
  echo "$partial_job_json" >&2
  exit 1
fi
assert_product_visible "$partial_name"

echo "[commerce-product-import-smoke] all checks passed."
