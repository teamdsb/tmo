#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
identity_dir="$root_dir/services/identity"

echo "Generating sqlc models..."
(cd "$identity_dir" && go run github.com/sqlc-dev/sqlc/cmd/sqlc@v1.30.0 generate)

echo "Generating oapi-codegen models..."
go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@v2.5.1 \
  -generate types,gin \
  -package oapi \
  -o "$identity_dir/internal/http/oapi/api.gen.go" \
  -include-tags Auth,Me \
  "$root_dir/contracts/openapi/identity.yaml"
