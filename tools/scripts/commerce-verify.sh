#!/usr/bin/env bash
set -euo pipefail

base_url="${COMMERCE_API_BASE_URL:-http://localhost:8080}"

echo "Checking health..."
curl -fsS "$base_url/health" >/dev/null

echo "Checking catalog categories..."
curl -fsS "$base_url/catalog/categories" >/dev/null

echo "Checking catalog products..."
curl -fsS "$base_url/catalog/products?page=1&pageSize=20" >/dev/null

echo "Smoke checks passed for $base_url"
