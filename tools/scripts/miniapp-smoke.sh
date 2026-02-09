#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
miniapp_dir="$root_dir/apps/miniapp"

stack_up="${MINIAPP_SMOKE_STACK_UP:-false}"
stack_up_lower="$(printf '%s' "$stack_up" | tr '[:upper:]' '[:lower:]')"

smoke_spu_id="${WEAPP_SMOKE_SPU_ID:-22222222-2222-2222-2222-222222222222}"
default_routes="/pages/index/index,/pages/category/index,/pages/goods/search/index,/pages/goods/detail/index?id=${smoke_spu_id}"
automator_routes="${WEAPP_AUTOMATOR_ROUTES:-$default_routes}"

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
echo "[miniapp-smoke] running automator smoke..."

WEAPP_AUTOMATOR_ROUTES="$automator_routes" \
pnpm -C "$miniapp_dir" run debug:weapp:collect

echo "[miniapp-smoke] done. summary: $miniapp_dir/.logs/weapp/summary.md"
