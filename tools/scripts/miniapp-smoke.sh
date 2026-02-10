#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
miniapp_dir="$root_dir/apps/miniapp"

stack_up="${MINIAPP_SMOKE_STACK_UP:-false}"
stack_up_lower="$(printf '%s' "$stack_up" | tr '[:upper:]' '[:lower:]')"

smoke_spu_id="${WEAPP_SMOKE_SPU_ID:-22222222-2222-2222-2222-222222222222}"
default_routes="/pages/index/index,/pages/category/index,/pages/goods/search/index,/pages/goods/detail/index?id=${smoke_spu_id}"
automator_routes="${WEAPP_AUTOMATOR_ROUTES:-$default_routes}"
assert_min_products="${WEAPP_SMOKE_ASSERT_MIN_PRODUCTS:-1}"
assert_category_min="${WEAPP_SMOKE_ASSERT_CATEGORY_MIN:-1}"
assert_image_success_min="${WEAPP_SMOKE_ASSERT_IMAGE_SUCCESS_MIN:-1}"
assert_no_console_error="${WEAPP_SMOKE_ASSERT_NO_CONSOLE_ERROR:-true}"
route_wait_ms="${WEAPP_SMOKE_ROUTE_WAIT_MS:-8000}"
summary_path="$miniapp_dir/.logs/weapp/summary.md"

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

echo "[miniapp-smoke] done. summary: $summary_path"
