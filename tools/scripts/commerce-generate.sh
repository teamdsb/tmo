#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
commerce_dir="$root_dir/services/commerce"

echo "Generating sqlc models..."
(cd "$commerce_dir" && go run github.com/sqlc-dev/sqlc/cmd/sqlc@v1.30.0 generate)

echo "Generating oapi-codegen models..."
go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@v2.5.1 \
  -generate types,gin \
  -package oapi \
  -o "$commerce_dir/internal/http/oapi/api.gen.go" \
  -include-tags Catalog,Cart,Orders,Tracking \
  "$root_dir/contracts/openapi/commerce.yaml"
