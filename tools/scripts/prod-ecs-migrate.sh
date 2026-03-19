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

echo "[prod-ecs-migrate] starting postgres..."
run_compose up -d postgres

echo "[prod-ecs-migrate] running identity migrations..."
run_compose run --rm identity-migrate

echo "[prod-ecs-migrate] running commerce migrations..."
run_compose run --rm commerce-migrate

echo "[prod-ecs-migrate] migrations finished."
