#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
payment_dir="$root_dir/services/payment"

mkdir -p "$payment_dir/internal/http/oapi/common"

echo "Generating shared oapi-codegen models..."
go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@v2.5.1 \
  -generate types,skip-prune \
  -package common \
  -o "$payment_dir/internal/http/oapi/common/common.gen.go" \
  "$root_dir/contracts/openapi/common.yaml"

echo "Generating oapi-codegen models..."
go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@v2.5.1 \
  -generate types,gin \
  -package oapi \
  -o "$payment_dir/internal/http/oapi/api.gen.go" \
  -include-tags Payments \
  --import-mapping="./common.yaml:github.com/teamdsb/tmo/services/payment/internal/http/oapi/common" \
  "$root_dir/contracts/openapi/payment.yaml"
