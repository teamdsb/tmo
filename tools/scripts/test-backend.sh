#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
services_dir="$root_dir/services"

found=0

if [ -d "$services_dir" ]; then
  for service in "$services_dir"/*; do
    [ -d "$service" ] || continue
    if [ -f "$service/go.mod" ]; then
      found=1
      echo "Running go test in $(basename "$service")"
      (cd "$service" && go test ./...)
    fi
  done
fi

if [ "$found" -eq 0 ]; then
  echo "No Go modules found under services; skipping backend tests."
fi
