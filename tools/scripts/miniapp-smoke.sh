#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
miniapp_dir="$root_dir/apps/miniapp"

stack_up="${MINIAPP_SMOKE_STACK_UP:-false}"
stack_up_lower="$(printf '%s' "$stack_up" | tr '[:upper:]' '[:lower:]')"
smoke_preflight="${WEAPP_SMOKE_PREFLIGHT:-true}"
smoke_preflight_lower="$(printf '%s' "$smoke_preflight" | tr '[:upper:]' '[:lower:]')"

smoke_spu_id="${WEAPP_SMOKE_SPU_ID:-22222222-2222-2222-2222-222222222222}"
default_routes="/pages/index/index,/pages/category/index,/pages/goods/search/index,/pages/goods/detail/index?id=${smoke_spu_id}"
automator_routes="${WEAPP_AUTOMATOR_ROUTES:-$default_routes}"
assert_min_products="${WEAPP_SMOKE_ASSERT_MIN_PRODUCTS:-0}"
assert_category_min="${WEAPP_SMOKE_ASSERT_CATEGORY_MIN:-0}"
assert_image_success_min="${WEAPP_SMOKE_ASSERT_IMAGE_SUCCESS_MIN:-0}"
assert_no_console_error="${WEAPP_SMOKE_ASSERT_NO_CONSOLE_ERROR:-true}"
route_wait_ms="${WEAPP_SMOKE_ROUTE_WAIT_MS:-8000}"
summary_path="$miniapp_dir/.logs/weapp/summary.md"
run_json_path="$miniapp_dir/.logs/weapp/run.json"

print_structured_summary() {
  if [[ ! -f "$run_json_path" ]]; then
    echo "[miniapp-smoke] run.json not found: $run_json_path" >&2
    return 1
  fi
  node "$miniapp_dir/scripts/print-weapp-run-summary.js"
}

if [[ ! -d "$miniapp_dir" ]]; then
  echo "miniapp directory not found: $miniapp_dir" >&2
  exit 1
fi

if [[ -z "$automator_routes" ]]; then
  echo "WEAPP_AUTOMATOR_ROUTES is empty." >&2
  exit 1
fi

if [[ "$stack_up_lower" == "true" ]]; then
  echo "[miniapp-smoke] starting backend stack..."
  bash "$root_dir/tools/scripts/dev-stack-up.sh"
fi

if [[ "$smoke_preflight_lower" == "true" ]]; then
  echo "[miniapp-smoke] running preflight gate..."
  set +e
  pnpm -C "$miniapp_dir" run preflight:weapp
  preflight_status=$?
  set -e

  if [[ $preflight_status -ne 0 ]]; then
    echo "[miniapp-smoke] preflight failed (exit=$preflight_status)" >&2
    if [[ -f "$miniapp_dir/.logs/preflight/result.json" ]]; then
      cat "$miniapp_dir/.logs/preflight/result.json" >&2
    fi
    exit $preflight_status
  fi
fi

echo "[miniapp-smoke] routes: $automator_routes"
echo "[miniapp-smoke] assert min products: $assert_min_products"
echo "[miniapp-smoke] assert min categories: $assert_category_min"
echo "[miniapp-smoke] assert min image success: $assert_image_success_min"
echo "[miniapp-smoke] assert no console error: $assert_no_console_error"
echo "[miniapp-smoke] running automator smoke..."

set +e
WEAPP_AUTOMATOR_ROUTES="$automator_routes" \
WEAPP_SMOKE_ASSERT_MIN_PRODUCTS="$assert_min_products" \
WEAPP_SMOKE_ASSERT_CATEGORY_MIN="$assert_category_min" \
WEAPP_SMOKE_ASSERT_IMAGE_SUCCESS_MIN="$assert_image_success_min" \
WEAPP_SMOKE_ASSERT_NO_CONSOLE_ERROR="$assert_no_console_error" \
WEAPP_SMOKE_ROUTE_WAIT_MS="$route_wait_ms" \
pnpm -C "$miniapp_dir" run debug:weapp:collect
status=$?
set -e

if [[ $status -ne 0 ]]; then
  print_structured_summary || true
  if [[ -f "$summary_path" ]]; then
    first_failed_line="$(grep '^|' "$summary_path" | grep 'fail(' | head -n1 || true)"
    if [[ -n "$first_failed_line" ]]; then
      first_failed_route="$(echo "$first_failed_line" | awk -F'|' '{gsub(/^ +| +$/,"",$2); print $2}')"
      first_failed_asserts="$(echo "$first_failed_line" | awk -F'|' '{gsub(/^ +| +$/,"",$8); print $8}')"
      echo "[miniapp-smoke] first failed route: ${first_failed_route:-unknown}" >&2
      echo "[miniapp-smoke] first failed assertion keys: ${first_failed_asserts:-unknown}" >&2
    fi
  fi
  exit $status
fi

print_structured_summary
echo "[miniapp-smoke] done. summary: $summary_path"
