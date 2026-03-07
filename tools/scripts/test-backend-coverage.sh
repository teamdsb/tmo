#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
services_dir="$root_dir/services"
packages_dir="$root_dir/packages"
coverage_dir="${BACKEND_COVERAGE_DIR:-$root_dir/.logs/backend-coverage}"

if [[ -z "${GOCACHE:-}" ]]; then
  export GOCACHE="${TMPDIR:-/tmp}/tmo-go-build-cache"
fi
mkdir -p "$GOCACHE"
mkdir -p "$coverage_dir"

modules=()

collect_modules() {
  local base_dir="$1"
  if [[ ! -d "$base_dir" ]]; then
    return
  fi

  local entry
  for entry in "$base_dir"/*; do
    [[ -d "$entry" ]] || continue
    [[ -f "$entry/go.mod" ]] || continue
    modules+=("$entry")
  done
}

collect_modules "$services_dir"
collect_modules "$packages_dir"

if [[ "${#modules[@]}" -eq 0 ]]; then
  echo "No Go modules found under services or packages; skipping backend coverage."
  exit 0
fi

combined_profile="$coverage_dir/combined.coverprofile"
combined_func="$coverage_dir/combined.func.txt"
summary_file="$coverage_dir/summary.txt"

rm -f "$combined_profile" "$combined_func" "$summary_file"
printf 'mode: atomic\n' > "$combined_profile"

run_module() {
  local module_dir="$1"
  local module_name
  module_name="$(basename "$module_dir")"
  local profile_file="$coverage_dir/${module_name}.coverprofile"
  local func_file="$coverage_dir/${module_name}.func.txt"

  echo "[backend-coverage] running go test with coverage in ${module_name}..."
  (
    cd "$module_dir"
    go test -covermode=atomic -coverprofile="$profile_file" ./...
  )

  go tool cover -func="$profile_file" | tee "$func_file"
  tail -n +2 "$profile_file" >> "$combined_profile"
}

for module_dir in "${modules[@]}"; do
  run_module "$module_dir"
done

go tool cover -func="$combined_profile" | tee "$combined_func"

{
  echo "[backend-coverage] coverage artifacts written to $coverage_dir"
  echo
  for module_dir in "${modules[@]}"; do
    module_name="$(basename "$module_dir")"
    total_line="$(tail -n 1 "$coverage_dir/${module_name}.func.txt")"
    printf '%s %s\n' "$module_name" "$total_line"
  done
  echo
  printf 'combined %s\n' "$(tail -n 1 "$combined_func")"
} | tee "$summary_file"
