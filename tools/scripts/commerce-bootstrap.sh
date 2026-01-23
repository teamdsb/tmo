#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "Starting local Postgres..."
docker compose -f "$root_dir/infra/dev/docker-compose.yml" up -d

"$root_dir/tools/scripts/commerce-migrate.sh"
"$root_dir/tools/scripts/commerce-seed.sh"
