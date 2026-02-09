#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

"$root_dir/tools/scripts/commerce-seed.sh"
"$root_dir/tools/scripts/identity-seed.sh"
