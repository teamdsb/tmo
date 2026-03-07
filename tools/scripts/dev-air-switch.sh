#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
compose_base="$root_dir/infra/dev/docker-compose.yml"
compose_backend="$root_dir/infra/dev/docker-compose.backend.yml"
compose_dev="$root_dir/infra/dev/docker-compose.dev.yml"
backend_env_local="$root_dir/infra/dev/backend.env.local"

default_services=(identity commerce payment ai gateway-bff)

usage() {
  cat <<'EOF'
Usage:
  bash tools/scripts/dev-air-switch.sh /absolute/path/to/worktree [services...]

Examples:
  bash tools/scripts/dev-air-switch.sh /Users/name/project-worktrees/feature-a
  bash tools/scripts/dev-air-switch.sh /Users/name/project-worktrees/feature-a identity commerce gateway-bff
EOF
}

if [[ "${1:-}" == "" ]]; then
  usage >&2
  exit 1
fi

target_worktree="$1"
shift || true

if [[ "$target_worktree" != /* ]]; then
  echo "[dev-air-switch] target worktree must be an absolute path: $target_worktree" >&2
  exit 1
fi

if [[ ! -d "$target_worktree" ]]; then
  echo "[dev-air-switch] target worktree does not exist: $target_worktree" >&2
  exit 1
fi

target_worktree="$(cd "$target_worktree" && pwd)"

required_paths=(
  "$target_worktree/go.work"
  "$target_worktree/infra/dev"
  "$target_worktree/services/identity"
)

for required_path in "${required_paths[@]}"; do
  if [[ ! -e "$required_path" ]]; then
    echo "[dev-air-switch] target does not look like a repo root, missing: $required_path" >&2
    exit 1
  fi
done

if [[ ! -f "$backend_env_local" ]]; then
  echo "[dev-air-switch] backend env file missing: $backend_env_local" >&2
  echo "[dev-air-switch] run 'make dev-stack-up-air' once before switching worktrees." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "[dev-air-switch] docker is required." >&2
  exit 1
fi

services=("$@")
if [[ "${#services[@]}" -eq 0 ]]; then
  services=("${default_services[@]}")
fi

current_worktree="${TMO_ACTIVE_WORKTREE:-$root_dir}"
current_worktree="$(cd "$current_worktree" && pwd)"

echo "[dev-air-switch] current worktree: $current_worktree"
echo "[dev-air-switch] target worktree:  $target_worktree"
echo "[dev-air-switch] services:         ${services[*]}"

export TMO_ACTIVE_WORKTREE="$target_worktree"

docker compose \
  --env-file "$backend_env_local" \
  -f "$compose_base" \
  -f "$compose_backend" \
  -f "$compose_dev" \
  up -d --no-deps --force-recreate "${services[@]}"

echo "[dev-air-switch] switched Air containers to $TMO_ACTIVE_WORKTREE"
