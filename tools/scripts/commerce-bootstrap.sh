#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

export COMMERCE_DB_DSN="${COMMERCE_DB_DSN:-postgres://commerce:commerce@localhost:5432/commerce?sslmode=disable}"

echo "Starting local Postgres..."
docker compose -f "$root_dir/infra/dev/docker-compose.yml" up -d

"$root_dir/tools/scripts/commerce-migrate.sh"
"$root_dir/tools/scripts/commerce-seed.sh"
