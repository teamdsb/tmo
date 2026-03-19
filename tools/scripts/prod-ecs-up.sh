#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
compose_file="${COMPOSE_FILE:-$root_dir/infra/prod/docker-compose.ecs.yml}"
env_file="${ENV_FILE:-$root_dir/infra/prod/env.ecs.local}"

if [[ ! -f "$compose_file" ]]; then
  echo "compose file not found: $compose_file" >&2
  exit 1
fi

if [[ ! -f "$env_file" ]]; then
  echo "env file not found: $env_file" >&2
  echo "copy infra/prod/env.ecs.example to infra/prod/env.ecs.local and edit it first" >&2
  exit 1
fi

run_compose() {
  docker compose --env-file "$env_file" -f "$compose_file" "$@"
}

echo "[prod-ecs-up] ensuring data directories exist..."
mkdir -p "$root_dir/data/postgres" "$root_dir/data/media"

echo "[prod-ecs-up] applying schema migrations..."
"$root_dir/tools/scripts/prod-ecs-migrate.sh"

echo "[prod-ecs-up] starting application services..."
run_compose up -d identity commerce payment gateway-bff

echo "[prod-ecs-up] current status:"
run_compose ps

if [[ "${DEPLOY_ADMIN_WEB:-true}" == "true" ]]; then
  echo "[prod-ecs-up] building admin-web static site..."
  bash "$root_dir/tools/scripts/prod-ecs-admin-web-build.sh"
fi

echo "[prod-ecs-up] next step: bash tools/scripts/prod-ecs-smoke.sh"
