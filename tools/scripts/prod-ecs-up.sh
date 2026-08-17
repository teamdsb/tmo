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

set -a
source "$env_file"
set +a

run_compose() {
  docker compose --env-file "$env_file" -f "$compose_file" "$@"
}

payment_auth_enabled="$(printf '%s' "${PAYMENT_AUTH_ENABLED:-true}" | tr '[:upper:]' '[:lower:]')"
if [[ "$payment_auth_enabled" != "true" ]]; then
  echo "PAYMENT_AUTH_ENABLED must be true for an ECS production deployment" >&2
  exit 1
fi

payment_provider_mode="$(printf '%s' "${PAYMENT_PROVIDER_MODE:-disabled}" | tr '[:upper:]' '[:lower:]')"
case "$payment_provider_mode" in
  disabled)
    ;;
  mock)
    echo "PAYMENT_PROVIDER_MODE=mock is forbidden for an ECS production deployment" >&2
    exit 1
    ;;
  wechat|real)
    payment_key_host_path="${PAYMENT_WECHAT_MERCHANT_PRIVATE_KEY_HOST_PATH:-}"
    if [[ -z "$payment_key_host_path" || ! -f "$payment_key_host_path" || -L "$payment_key_host_path" || ! -s "$payment_key_host_path" ]]; then
      echo "real WeChat payment requires a non-empty regular PAYMENT_WECHAT_MERCHANT_PRIVATE_KEY_HOST_PATH" >&2
      exit 1
    fi
    payment_key_owner="$(stat -c "%u:%g" "$payment_key_host_path")"
    payment_key_mode="$(stat -c "%a" "$payment_key_host_path")"
    if [[ "$payment_key_owner" != "65534:65534" || "$payment_key_mode" != "400" ]]; then
      echo "WeChat merchant private key must be owned by 65534:65534 with mode 0400" >&2
      exit 1
    fi
    ;;
  *)
    echo "unsupported PAYMENT_PROVIDER_MODE for ECS production: $payment_provider_mode" >&2
    exit 1
    ;;
esac

media_host_dir="${MEDIA_HOST_DIR:-../../data/media}"
if [[ "$media_host_dir" != /* ]]; then
  media_host_dir="$(cd "$(dirname "$compose_file")" && pwd)/$media_host_dir"
fi
postgres_host_dir="${POSTGRES_DATA_DIR:-../../data/postgres}"
if [[ "$postgres_host_dir" != /* ]]; then
  postgres_host_dir="$(cd "$(dirname "$compose_file")" && pwd)/$postgres_host_dir"
fi
media_writable_dirs=(
  "$media_host_dir/catalog/products"
  "$media_host_dir/product-requests"
  "$media_host_dir/support"
)

echo "[prod-ecs-up] ensuring data directories exist..."
mkdir -p "$postgres_host_dir" "${media_writable_dirs[@]}"
for media_writable_dir in "${media_writable_dirs[@]}"; do
  chown 65534:65534 "$media_writable_dir"
  chmod u+rwx,go+rx "$media_writable_dir"
done

echo "[prod-ecs-up] building application images..."
run_compose build identity commerce payment gateway-bff

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
