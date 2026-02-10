#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "[catalog-image-audit] auditing catalog image references..."
(
  cd "$root_dir"
  go run ./services/commerce/cmd/catalog-image-audit
)
