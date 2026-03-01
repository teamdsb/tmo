#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

: "${IDENTITY_DB_DSN:?IDENTITY_DB_DSN is required}"

echo "Applying identity migrations..."
(
  cd "$root_dir"
  go run ./services/identity/cmd/identity-migrate
)
