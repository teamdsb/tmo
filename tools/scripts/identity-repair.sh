#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
gateway_base_url="${IDENTITY_SEED_CHECK_GATEWAY_BASE_URL:-http://localhost:8080}"
check_mode="db"

echo "[identity-repair] applying identity migrations..."
bash "$root_dir/tools/scripts/identity-migrate.sh"

echo "[identity-repair] resetting and reseeding identity fixtures..."
IDENTITY_SEED_RESET=true bash "$root_dir/tools/scripts/identity-seed.sh"

if curl -fsS --max-time 2 "${gateway_base_url%/}/health" >/dev/null 2>&1; then
  check_mode="full"
else
  echo "[identity-repair] gateway is not reachable at ${gateway_base_url}; running DB-only verification."
fi

IDENTITY_SEED_CHECK_MODE="$check_mode" bash "$root_dir/tools/scripts/identity-seed-check.sh"

echo "[identity-repair] identity fixtures are healthy."
