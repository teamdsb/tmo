#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ai_dir="$root_dir/services/ai"

mkdir -p "$ai_dir/internal/http/oapi/common"

echo "Generating shared oapi-codegen models..."
go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@v2.5.1 \
  -generate types,skip-prune \
  -package common \
  -o "$ai_dir/internal/http/oapi/common/common.gen.go" \
  "$root_dir/contracts/openapi/common.yaml"

echo "Generating oapi-codegen models..."
go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@v2.5.1 \
  -generate types,gin \
  -package oapi \
  -o "$ai_dir/internal/http/oapi/api.gen.go" \
  -include-tags AI \
  --import-mapping="./common.yaml:github.com/teamdsb/tmo/services/ai/internal/http/oapi/common" \
  "$root_dir/contracts/openapi/ai.yaml"
