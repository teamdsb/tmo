#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

: "${COMMERCE_DB_DSN:?COMMERCE_DB_DSN is required}"

echo "Applying commerce migrations..."
(
  cd "$root_dir"
  go run ./services/commerce/cmd/commerce-migrate
)
