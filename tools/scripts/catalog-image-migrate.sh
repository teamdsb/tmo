#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

media_output_dir="${MEDIA_LOCAL_OUTPUT_DIR:-$root_dir/infra/dev/media}"
media_public_base_url="${MEDIA_PUBLIC_BASE_URL:-http://localhost:8080/assets/media}"

mkdir -p "$media_output_dir"

echo "[catalog-image-migrate] output dir: $media_output_dir"
echo "[catalog-image-migrate] public base url: $media_public_base_url"

(
  cd "$root_dir"
  MEDIA_LOCAL_OUTPUT_DIR="$media_output_dir" \
  MEDIA_PUBLIC_BASE_URL="$media_public_base_url" \
  go run ./services/commerce/cmd/catalog-image-migrate
)
