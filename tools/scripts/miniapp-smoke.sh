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
assert_image_scope="${WEAPP_SMOKE_ASSERT_IMAGE_SCOPE:-}"
assert_no_console_error="${WEAPP_SMOKE_ASSERT_NO_CONSOLE_ERROR:-true}"
route_wait_ms="${WEAPP_SMOKE_ROUTE_WAIT_MS:-8000}"
automator_connect_timeout_ms="${WEAPP_AUTOMATOR_CONNECT_TIMEOUT_MS:-}"
route_port_base="${WEAPP_MULTI_ROUTE_PORT_BASE:-19527}"
smoke_build="${WEAPP_SMOKE_BUILD:-true}"
smoke_build_lower="$(printf '%s' "$smoke_build" | tr '[:upper:]' '[:lower:]')"
summary_path="$miniapp_dir/.logs/weapp/summary.md"
run_json_path="$miniapp_dir/.logs/weapp/run.json"
route_logs_root="$miniapp_dir/.logs/weapp/routes"

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
echo "[miniapp-smoke] assert image scope: ${assert_image_scope:-auto}"
echo "[miniapp-smoke] automator connect timeout: ${automator_connect_timeout_ms:-default}"
echo "[miniapp-smoke] assert no console error: $assert_no_console_error"
echo "[miniapp-smoke] route port base: $route_port_base"

if [[ "$smoke_build_lower" == "true" ]]; then
  echo "[miniapp-smoke] building weapp bundle once before route checks..."
  pnpm -C "$miniapp_dir" run build:weapp:dev
fi

mkdir -p "$route_logs_root"

route_index=0
IFS=',' read -r -a route_array <<< "$automator_routes"

for route in "${route_array[@]}"; do
  route_index=$((route_index + 1))
  route_trimmed="$(printf '%s' "$route" | xargs)"
  if [[ -z "$route_trimmed" ]]; then
    continue
  fi

  route_slug="$(printf '%s' "$route_trimmed" | sed 's#^/##; s#[?=&/]#-#g')"
  route_dir="$route_logs_root/$(printf '%02d' "$route_index")-$route_slug"
  route_port=$((route_port_base + route_index - 1))

  mkdir -p "$route_dir"
  echo "[miniapp-smoke] route[$route_index/${#route_array[@]}]: $route_trimmed (port=$route_port)"
  pkill -f 'wechatwebdevtools.*miniapp' || true
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti "tcp:$route_port" | xargs kill -9 2>/dev/null || true
  fi
  sleep 2

  set +e
  WEAPP_AUTOMATOR_ROUTE="$route_trimmed" \
  WEAPP_AUTOMATOR_ROUTES="" \
  WEAPP_AUTOMATOR_PORT="$route_port" \
  WEAPP_SKIP_BUILD=true \
  WEAPP_FORCE_EXIT=true \
  WEAPP_SMOKE_ASSERT_MIN_PRODUCTS="$assert_min_products" \
  WEAPP_SMOKE_ASSERT_CATEGORY_MIN="$assert_category_min" \
  WEAPP_SMOKE_ASSERT_IMAGE_SUCCESS_MIN="$assert_image_success_min" \
  WEAPP_SMOKE_ASSERT_IMAGE_SCOPE="${assert_image_scope:-route}" \
  WEAPP_SMOKE_ASSERT_NO_CONSOLE_ERROR="$assert_no_console_error" \
  WEAPP_SMOKE_ROUTE_WAIT_MS="$route_wait_ms" \
  pnpm -C "$miniapp_dir" run debug:weapp:collect
  status=$?
  set -e

  for artifact in console.jsonl network.jsonl summary.md run.json; do
    if [[ -f "$miniapp_dir/.logs/weapp/$artifact" ]]; then
      cp "$miniapp_dir/.logs/weapp/$artifact" "$route_dir/$artifact"
    fi
  done

  if [[ $status -ne 0 ]]; then
    print_structured_summary || true
    echo "[miniapp-smoke] failed route: $route_trimmed" >&2
    exit $status
  fi
done

print_structured_summary
echo "[miniapp-smoke] done. summary: $summary_path"
