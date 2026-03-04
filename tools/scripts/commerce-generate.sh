#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
commerce_dir="$root_dir/services/commerce"

echo "Generating sqlc models..."
(cd "$commerce_dir" && go run github.com/sqlc-dev/sqlc/cmd/sqlc@v1.30.0 generate)

echo "Generating shared oapi-codegen models..."
go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@v2.5.1 \
  -generate types,skip-prune \
  -package common \
  -o "$commerce_dir/internal/http/oapi/common/common.gen.go" \
  "$root_dir/contracts/openapi/common.yaml"

echo "Generating oapi-codegen models..."
go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@v2.5.1 \
  -generate types,gin \
  -package oapi \
  -o "$commerce_dir/internal/http/oapi/api.gen.go" \
  -include-tags Catalog,Wishlist,Cart,Orders,Addresses,Tracking,ProductRequests,AfterSales,Inquiries \
  --import-mapping="./common.yaml:github.com/teamdsb/tmo/services/commerce/internal/http/oapi/common" \
  "$root_dir/contracts/openapi/commerce.yaml"
