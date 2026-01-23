#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "Applying commerce migrations..."
(
  cd "$root_dir"
  go run ./services/commerce/cmd/commerce-migrate
)
