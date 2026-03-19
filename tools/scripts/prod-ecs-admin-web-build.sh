#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
env_file="${ENV_FILE:-$root_dir/infra/prod/env.ecs.local}"

if [[ ! -f "$env_file" ]]; then
  echo "env file not found: $env_file" >&2
  echo "copy infra/prod/env.ecs.example to infra/prod/env.ecs.local and edit it first" >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required to build admin-web" >&2
  exit 1
fi

set -a
source "$env_file"
set +a

admin_public_base_url="${ADMIN_WEB_PUBLIC_BASE_URL:-https://admin.example.com}"
admin_api_base_url="${ADMIN_WEB_API_BASE_URL:-${GATEWAY_PUBLIC_BASE_URL:-https://api.example.com}}"
admin_base_path="${ADMIN_WEB_BASE_PATH:-/}"
admin_dist_dir="${ADMIN_WEB_DIST_DIR:-/var/www/tmo-admin}"

echo "[prod-ecs-admin-web-build] building admin-web..."
(
  cd "$root_dir"
  VITE_ADMIN_WEB_MODE=dev \
  VITE_ADMIN_WEB_API_BASE_URL="$admin_api_base_url" \
  VITE_ADMIN_WEB_BASE_PATH="$admin_base_path" \
  pnpm -C apps/admin-web build
)

echo "[prod-ecs-admin-web-build] syncing dist to $admin_dist_dir ..."
mkdir -p "$admin_dist_dir"
rm -rf "$admin_dist_dir"/*
cp -R "$root_dir/apps/admin-web/dist"/. "$admin_dist_dir"/

cat <<EOF
[prod-ecs-admin-web-build] admin-web is ready.
  public url: $admin_public_base_url
  api base:   $admin_api_base_url
  base path:  $admin_base_path
  dist dir:   $admin_dist_dir
EOF
