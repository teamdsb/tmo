#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

run_stack_up_raw="${E2E_LOCAL_STACK_UP:-true}"
run_admin_smoke_raw="${E2E_LOCAL_RUN_ADMIN_SMOKE:-true}"
run_miniapp_http_smoke_raw="${E2E_LOCAL_RUN_MINIAPP_HTTP_SMOKE:-true}"
miniapp_http_allow_proxy_failure_raw="${E2E_LOCAL_MINIAPP_HTTP_ALLOW_PROXY_FAILURE:-true}"
run_admin_real_raw="${E2E_LOCAL_RUN_ADMIN_REAL:-true}"
run_admin_hybrid_raw="${E2E_LOCAL_RUN_ADMIN_HYBRID:-false}"
run_miniapp_auth_raw="${E2E_LOCAL_RUN_MINIAPP_AUTH:-true}"
run_miniapp_catalog_real_raw="${E2E_LOCAL_RUN_MINIAPP_CATALOG_REAL:-true}"
build_weapp_dev_raw="${E2E_LOCAL_BUILD_WEAPP_DEV:-true}"
force_build_raw="${E2E_LOCAL_FORCE_BUILD_IMAGES:-true}"
weapp_phone_sim_raw="${E2E_LOCAL_WEAPP_PHONE_SIMULATION:-true}"

lower_bool() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

run_stack_up="$(lower_bool "$run_stack_up_raw")"
run_admin_smoke="$(lower_bool "$run_admin_smoke_raw")"
run_miniapp_http_smoke="$(lower_bool "$run_miniapp_http_smoke_raw")"
miniapp_http_allow_proxy_failure="$(lower_bool "$miniapp_http_allow_proxy_failure_raw")"
run_admin_real="$(lower_bool "$run_admin_real_raw")"
run_admin_hybrid="$(lower_bool "$run_admin_hybrid_raw")"
run_miniapp_auth="$(lower_bool "$run_miniapp_auth_raw")"
run_miniapp_catalog_real="$(lower_bool "$run_miniapp_catalog_real_raw")"
build_weapp_dev="$(lower_bool "$build_weapp_dev_raw")"
force_build="$(lower_bool "$force_build_raw")"
weapp_phone_sim="$(lower_bool "$weapp_phone_sim_raw")"

phase() {
  echo "[e2e-local] $1"
}

phase "starting local e2e orchestration..."

if [[ "$run_stack_up" == "true" ]]; then
  phase "bringing up backend stack..."
  if [[ "$force_build" == "true" ]]; then
    phase "forcing backend image rebuild to avoid stale local containers..."
    DEV_STACK_BUILD_IMAGES=true bash "$root_dir/tools/scripts/dev-stack-up.sh"
  else
    bash "$root_dir/tools/scripts/dev-stack-up.sh"
  fi
else
  phase "skipping backend stack startup because E2E_LOCAL_STACK_UP=false"
fi

phase "re-applying shared dev seed..."
bash "$root_dir/tools/scripts/dev-seed.sh"

phase "verifying real-data seed..."
bash "$root_dir/tools/scripts/dev-seed-check.sh"

if [[ "$run_admin_smoke" == "true" ]]; then
  phase "running admin-web smoke..."
  bash "$root_dir/tools/scripts/admin-web-smoke.sh"
fi

if [[ "$run_miniapp_http_smoke" == "true" ]]; then
  phase "running miniapp HTTP smoke..."
  if [[ "$miniapp_http_allow_proxy_failure" == "true" ]]; then
    MINIAPP_HTTP_SMOKE_ALLOW_PROXY_FAILURE=true bash "$root_dir/tools/scripts/miniapp-http-smoke.sh"
  else
    bash "$root_dir/tools/scripts/miniapp-http-smoke.sh"
  fi
fi

if [[ "$run_admin_real" == "true" ]]; then
  phase "running admin-web real e2e..."
  pnpm -C "$root_dir/apps/admin-web" run test:e2e:real
fi

if [[ "$run_admin_hybrid" == "true" ]]; then
  phase "running admin-web hybrid e2e..."
  pnpm -C "$root_dir/apps/admin-web" run test:e2e:hybrid
fi

if [[ "$run_miniapp_auth" == "true" ]]; then
  if [[ "$weapp_phone_sim" == "true" ]]; then
    export TARO_APP_WEAPP_PHONE_PROOF_SIMULATION=true
  fi

  if [[ "$build_weapp_dev" == "true" ]]; then
    phase "building miniapp weapp dev bundle..."
    pnpm -C "$root_dir/apps/miniapp" run build:weapp:dev
  fi

  phase "running miniapp auth e2e..."
  pnpm -C "$root_dir/apps/miniapp" run test:e2e:weapp:auth
fi

if [[ "$run_miniapp_catalog_real" == "true" ]]; then
  if [[ "$weapp_phone_sim" == "true" ]]; then
    export TARO_APP_WEAPP_PHONE_PROOF_SIMULATION=true
  fi

  if [[ "$build_weapp_dev" == "true" && "$run_miniapp_auth" != "true" ]]; then
    phase "building miniapp weapp dev bundle..."
    pnpm -C "$root_dir/apps/miniapp" run build:weapp:dev
  fi

  phase "running miniapp catalog real e2e..."
  pnpm -C "$root_dir/apps/miniapp" run test:e2e:weapp:catalog-real
fi

phase "all enabled stages passed."
