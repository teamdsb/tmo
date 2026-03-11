#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "$root_dir"
go run ./services/commerce/cmd/support-history-backfill
