#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "$root_dir"

bash tools/scripts/dev-stack-up.sh

# Run admin-web in real/dev mode after backend is ready.
pnpm -C apps/admin-web dev:real
