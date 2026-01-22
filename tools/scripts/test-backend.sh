#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
services_dir="$root_dir/services"
packages_dir="$root_dir/packages"

service_found=0
package_found=0

if [ -d "$services_dir" ]; then
  for service in "$services_dir"/*; do
    [ -d "$service" ] || continue
    if [ -f "$service/go.mod" ]; then
      service_found=1
      echo "Running go test in $(basename "$service")"
      (cd "$service" && go test ./...)
    fi
  done
fi

if [ -d "$packages_dir" ]; then
  for pkg in "$packages_dir"/*; do
    [ -d "$pkg" ] || continue
    if [ -f "$pkg/go.mod" ]; then
      package_found=1
      echo "Running go test in package $(basename "$pkg")"
      (cd "$pkg" && go test ./...)
    fi
  done
fi

if [ "$service_found" -eq 0 ] && [ "$package_found" -eq 0 ]; then
  echo "No Go modules found under services or packages; skipping backend tests."
fi
