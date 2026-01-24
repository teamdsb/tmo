#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "Applying identity migrations..."
(
  cd "$root_dir"
  go run ./services/identity/cmd/identity-migrate
)
