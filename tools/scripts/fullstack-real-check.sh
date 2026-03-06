#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
miniapp_dir="$root_dir/apps/miniapp"
default_weapp_cli="/Applications/wechatwebdevtools.app/Contents/MacOS/cli"

export IDENTITY_LOGIN_MODE="${IDENTITY_LOGIN_MODE:-real}"
export IDENTITY_ENABLE_PHONE_PROOF_SIMULATION="${IDENTITY_ENABLE_PHONE_PROOF_SIMULATION:-true}"
export IDENTITY_PHONE_PROOF_SIMULATION_PHONE="${IDENTITY_PHONE_PROOF_SIMULATION_PHONE:-+15550000003}"
export DEV_STACK_BUILD_IMAGES="${DEV_STACK_BUILD_IMAGES:-true}"
export TARO_APP_MOCK_MODE="${TARO_APP_MOCK_MODE:-off}"
export TARO_APP_ENABLE_MOCK_LOGIN="${TARO_APP_ENABLE_MOCK_LOGIN:-false}"
export TARO_APP_WEAPP_PHONE_PROOF_SIMULATION="${TARO_APP_WEAPP_PHONE_PROOF_SIMULATION:-true}"
export TARO_APP_API_BASE_URL="${TARO_APP_API_BASE_URL:-http://localhost:8080}"
export TARO_APP_COMMERCE_BASE_URL="${TARO_APP_COMMERCE_BASE_URL:-http://localhost:8080}"
export WEAPP_DEVTOOLS_CLI_PATH="${WEAPP_DEVTOOLS_CLI_PATH:-$default_weapp_cli}"

if [[ ! -x "$WEAPP_DEVTOOLS_CLI_PATH" ]]; then
  echo "[fullstack-real-check] wechat devtools cli not found: $WEAPP_DEVTOOLS_CLI_PATH" >&2
  exit 1
fi

cd "$root_dir"

echo "[fullstack-real-check] starting backend stack..."
bash tools/scripts/dev-stack-up.sh

echo "[fullstack-real-check] running admin-web smoke..."
pnpm run smoke:admin-web

echo "[fullstack-real-check] running admin-web real e2e..."
pnpm -C apps/admin-web test:e2e:real

echo "[fullstack-real-check] building miniapp weapp (real mode)..."
pnpm -C "$miniapp_dir" build:weapp:dev

echo "[fullstack-real-check] running miniapp preflight..."
pnpm -C "$miniapp_dir" preflight:weapp

echo "[fullstack-real-check] running miniapp auth e2e..."
pnpm -C "$miniapp_dir" test:e2e:weapp:auth

echo "[fullstack-real-check] running miniapp automator smoke..."
WEAPP_SMOKE_BUILD=false \
WEAPP_SMOKE_PREFLIGHT=false \
pnpm -C "$miniapp_dir" debug:weapp:smoke:standard

echo "[fullstack-real-check] all checks passed."
