#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

compose_base="$root_dir/infra/dev/docker-compose.yml"
compose_backend="$root_dir/infra/dev/docker-compose.backend.yml"
compose_dev="$root_dir/infra/dev/docker-compose.dev.yml"
backend_env_example="$root_dir/infra/dev/backend.env.example"
backend_env_local="$root_dir/infra/dev/backend.env.local"
use_air="${DEV_STACK_AIR:-false}"
use_air_lower="$(printf '%s' "$use_air" | tr '[:upper:]' '[:lower:]')"
build_images_set="${DEV_STACK_BUILD_IMAGES+x}"
build_images="${DEV_STACK_BUILD_IMAGES:-false}"
if [[ "$use_air_lower" == "true" && -z "$build_images_set" ]]; then
  build_images="true"
fi
build_images_lower="$(printf '%s' "$build_images" | tr '[:upper:]' '[:lower:]')"
dev_stack_goproxy="${DEV_STACK_GOPROXY:-https://goproxy.cn,direct}"
dev_stack_gosumdb="${DEV_STACK_GOSUMDB:-off}"
dev_stack_gonosumdb="${DEV_STACK_GONOSUMDB:-*}"

export DEV_STACK_GOPROXY="$dev_stack_goproxy"
export DEV_STACK_GOSUMDB="$dev_stack_gosumdb"
export DEV_STACK_GONOSUMDB="$dev_stack_gonosumdb"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required." >&2
  exit 1
fi

if [[ ! -f "$compose_base" || ! -f "$compose_backend" ]]; then
  echo "docker compose files not found under infra/dev." >&2
  exit 1
fi
if [[ "$use_air_lower" == "true" && ! -f "$compose_dev" ]]; then
  echo "docker compose dev overlay not found: $compose_dev" >&2
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

echo "[dev-stack-up] using Go module proxy settings:"
echo "  - DEV_STACK_GOPROXY=${DEV_STACK_GOPROXY}"
echo "  - DEV_STACK_GOSUMDB=${DEV_STACK_GOSUMDB}"
echo "  - DEV_STACK_GONOSUMDB=${DEV_STACK_GONOSUMDB}"
if [[ "$DEV_STACK_GOSUMDB" == "off" ]]; then
  echo "[dev-stack-up] note: DEV_STACK_GOSUMDB=off prioritizes local build stability for dev containers."
fi

echo "[dev-stack-up] starting postgres container..."
docker compose -f "$compose_base" up -d postgres

echo "[dev-stack-up] waiting for postgres health..."
postgres_timeout_seconds="${DEV_STACK_POSTGRES_TIMEOUT_SECONDS:-60}"
postgres_interval_seconds=2
postgres_deadline=$((SECONDS + postgres_timeout_seconds))
while (( SECONDS < postgres_deadline )); do
  postgres_status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' tmo-postgres 2>/dev/null || true)"
  if [[ "$postgres_status" == "healthy" || "$postgres_status" == "running" ]]; then
    break
  fi
  sleep "$postgres_interval_seconds"
done

postgres_status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' tmo-postgres 2>/dev/null || true)"
if [[ "$postgres_status" != "healthy" && "$postgres_status" != "running" ]]; then
  echo "[dev-stack-up] timeout waiting for postgres health; current status=$postgres_status" >&2
  exit 1
fi

echo "[dev-stack-up] bootstrapping databases (migrate + seed)..."
IDENTITY_SEED_RESET=true bash "$root_dir/tools/scripts/dev-bootstrap.sh"
bash "$root_dir/tools/scripts/dev-seed.sh"
IDENTITY_SEED_CHECK_MODE=db bash "$root_dir/tools/scripts/identity-seed-check.sh"

echo "[dev-stack-up] starting backend containers (identity/commerce/payment/gateway)..."
compose_args=(
  --env-file "$backend_env_local"
  -f "$compose_base"
  -f "$compose_backend"
)
if [[ "$use_air_lower" == "true" ]]; then
  compose_args+=(-f "$compose_dev")
  echo "[dev-stack-up] DEV_STACK_AIR=true, enabling Air hot reload overlay."
fi
compose_args+=(up -d)

if [[ "$build_images_lower" == "true" ]]; then
  compose_args+=(--build)
  if [[ "$use_air_lower" == "true" && -z "$build_images_set" ]]; then
    echo "[dev-stack-up] DEV_STACK_AIR=true and DEV_STACK_BUILD_IMAGES unset, defaulting to --build."
  else
    echo "[dev-stack-up] DEV_STACK_BUILD_IMAGES=true, forcing image rebuild."
  fi
fi

if ! docker compose "${compose_args[@]}"; then
  echo "[dev-stack-up] failed to start backend containers." >&2
  echo "[dev-stack-up] troubleshooting hints:" >&2
  echo "  1) inspect docker disk usage: docker system df" >&2
  echo "  2) clear build cache if disk is full: docker builder prune -f" >&2
  echo "  3) retry with stable Go proxy env (already default):" >&2
  echo "     DEV_STACK_GOPROXY=https://goproxy.cn,direct DEV_STACK_GOSUMDB=off DEV_STACK_GONOSUMDB='*' make dev-stack-up" >&2
  exit 1
fi

if [[ "$use_air_lower" == "true" && -z "${DEV_STACK_HEALTH_TIMEOUT_SECONDS+x}" ]]; then
  export DEV_STACK_HEALTH_TIMEOUT_SECONDS=420
fi

echo "[dev-stack-up] waiting for service readiness..."
bash "$root_dir/tools/scripts/dev-stack-health.sh"
IDENTITY_SEED_CHECK_MODE=full bash "$root_dir/tools/scripts/identity-seed-check.sh"

echo "[dev-stack-up] backend stack is ready."
