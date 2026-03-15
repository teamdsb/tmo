#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

run_stack_up_raw="${SUPPORT_REAL_E2E_STACK_UP:-true}"
build_weapp_dev_raw="${SUPPORT_REAL_E2E_BUILD_WEAPP_DEV:-true}"
run_admin_smoke_raw="${SUPPORT_REAL_E2E_RUN_ADMIN_SMOKE:-true}"
run_support_smoke_raw="${SUPPORT_REAL_E2E_RUN_SUPPORT_SMOKE:-true}"

lower_bool() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

run_stack_up="$(lower_bool "$run_stack_up_raw")"
build_weapp_dev="$(lower_bool "$build_weapp_dev_raw")"
run_admin_smoke="$(lower_bool "$run_admin_smoke_raw")"
run_support_smoke="$(lower_bool "$run_support_smoke_raw")"

phase() {
  echo "[support-real-e2e] $1"
}

artifact_file="${SUPPORT_REAL_E2E_ARTIFACT:-$(mktemp "${TMPDIR:-/tmp}/tmo-support-real-e2e.XXXXXX.json")}"
customer_message="${SUPPORT_REAL_E2E_CUSTOMER_MESSAGE:-REAL_E2E_CUSTOMER_MESSAGE_$(date +%s)}"
reply_text="${SUPPORT_REAL_E2E_REPLY_TEXT:-REAL_E2E_CS_REPLY_$(date +%s)}"

cleanup() {
  if [[ "${SUPPORT_REAL_E2E_KEEP_ARTIFACT:-false}" != "true" && -f "$artifact_file" ]]; then
    rm -f "$artifact_file"
  fi
}
trap cleanup EXIT

export SUPPORT_REAL_E2E_ARTIFACT="$artifact_file"
export SUPPORT_REAL_E2E_CUSTOMER_MESSAGE="$customer_message"
export SUPPORT_REAL_E2E_REPLY_TEXT="$reply_text"
export IDENTITY_ENABLE_PHONE_PROOF_SIMULATION="${IDENTITY_ENABLE_PHONE_PROOF_SIMULATION:-true}"
export TARO_APP_WEAPP_PHONE_PROOF_SIMULATION="${TARO_APP_WEAPP_PHONE_PROOF_SIMULATION:-true}"
export COMMERCE_AUTH_ENABLED="${COMMERCE_AUTH_ENABLED:-true}"
export COMMERCE_JWT_SECRET="${COMMERCE_JWT_SECRET:-${IDENTITY_JWT_SECRET:-dev-secret}}"
export COMMERCE_JWT_ISSUER="${COMMERCE_JWT_ISSUER:-${IDENTITY_JWT_ISSUER:-tmo-identity}}"

phase "artifact file: $artifact_file"
phase "customer message: $customer_message"
phase "cs reply text: $reply_text"
phase "weapp phone proof simulation: $TARO_APP_WEAPP_PHONE_PROOF_SIMULATION / identity simulation: $IDENTITY_ENABLE_PHONE_PROOF_SIMULATION"
phase "commerce auth: $COMMERCE_AUTH_ENABLED issuer=$COMMERCE_JWT_ISSUER"

if [[ "$run_stack_up" == "true" ]]; then
  phase "bringing up backend stack..."
  DEV_STACK_BUILD_IMAGES="${SUPPORT_REAL_E2E_FORCE_BUILD_IMAGES:-true}" bash "$root_dir/tools/scripts/dev-stack-up.sh"
else
  phase "skipping backend stack startup"
fi

phase "re-applying shared dev seed..."
bash "$root_dir/tools/scripts/dev-seed.sh"

phase "verifying shared dev seed..."
bash "$root_dir/tools/scripts/dev-seed-check.sh"

if [[ "$run_admin_smoke" == "true" || "$run_support_smoke" == "true" ]]; then
  phase "running admin-web smoke..."
  if [[ "$run_support_smoke" == "true" ]]; then
    ADMIN_WEB_SMOKE_CHECK_SUPPORT=true bash "$root_dir/tools/scripts/admin-web-smoke.sh"
  else
    bash "$root_dir/tools/scripts/admin-web-smoke.sh"
  fi
fi

if [[ "$build_weapp_dev" == "true" ]]; then
  phase "building miniapp weapp dev bundle..."
  pnpm -C "$root_dir/apps/miniapp" run build:weapp:dev
fi

phase "miniapp sends customer message via real UI..."
WEAPP_SUPPORT_REAL_E2E_MODE=send pnpm -C "$root_dir/apps/miniapp" run test:e2e:weapp:support-real

phase "admin-web CS claims conversation and replies via real UI..."
pnpm -C "$root_dir/apps/admin-web" run test:e2e:real:support

phase "miniapp verifies CS reply via real UI..."
WEAPP_SUPPORT_REAL_E2E_MODE=verify-reply pnpm -C "$root_dir/apps/miniapp" run test:e2e:weapp:support-real

phase "support real e2e passed."
