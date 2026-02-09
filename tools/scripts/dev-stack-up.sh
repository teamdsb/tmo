#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

compose_base="$root_dir/infra/dev/docker-compose.yml"
compose_backend="$root_dir/infra/dev/docker-compose.backend.yml"
backend_env_example="$root_dir/infra/dev/backend.env.example"
backend_env_local="$root_dir/infra/dev/backend.env.local"
build_images="${DEV_STACK_BUILD_IMAGES:-false}"
build_images_lower="$(printf '%s' "$build_images" | tr '[:upper:]' '[:lower:]')"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required." >&2
  exit 1
fi

if [[ ! -f "$compose_base" || ! -f "$compose_backend" ]]; then
  echo "docker compose files not found under infra/dev." >&2
  exit 1
fi

if [[ ! -f "$backend_env_local" ]]; then
  if [[ ! -f "$backend_env_example" ]]; then
    echo "backend env template not found: $backend_env_example" >&2
    exit 1
  fi
  cp "$backend_env_example" "$backend_env_local"
  echo "[dev-stack-up] created $backend_env_local from template"
fi

mkdir -p "$root_dir/infra/dev/media"

echo "[dev-stack-up] starting postgres container..."
docker compose -f "$compose_base" up -d postgres

echo "[dev-stack-up] bootstrapping databases (migrate + seed)..."
bash "$root_dir/tools/scripts/dev-bootstrap.sh"
bash "$root_dir/tools/scripts/dev-seed.sh"

echo "[dev-stack-up] starting backend containers (identity/commerce/payment/gateway)..."
compose_args=(
  --env-file "$backend_env_local"
  -f "$compose_base"
  -f "$compose_backend"
  up -d
)

if [[ "$build_images_lower" == "true" ]]; then
  compose_args+=(--build)
  echo "[dev-stack-up] DEV_STACK_BUILD_IMAGES=true, forcing image rebuild."
fi

docker compose "${compose_args[@]}"

echo "[dev-stack-up] waiting for service readiness..."
bash "$root_dir/tools/scripts/dev-stack-health.sh"

echo "[dev-stack-up] backend stack is ready."
