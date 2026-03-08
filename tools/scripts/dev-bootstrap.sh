#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

"$root_dir/tools/scripts/commerce-bootstrap.sh"

echo "Creating identity database..."

create_db_if_missing() {
  local db_name="$1"

  if command -v psql >/dev/null 2>&1; then
    psql "postgres://commerce:commerce@localhost:5432/commerce?sslmode=disable" <<SQL
SELECT 'CREATE DATABASE ${db_name} OWNER commerce'
WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = '${db_name}'
)\gexec
SQL
    return
  fi

  if command -v docker >/dev/null 2>&1; then
    docker exec -i tmo-postgres psql -U commerce -d commerce <<SQL
SELECT 'CREATE DATABASE ${db_name} OWNER commerce'
WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = '${db_name}'
)\gexec
SQL
    return
  fi

  echo "psql or docker is required to create database ${db_name}." >&2
  exit 1
}

create_db_if_missing identity

echo "Creating payment database..."
create_db_if_missing payment

"$root_dir/tools/scripts/identity-migrate.sh"
"$root_dir/tools/scripts/identity-seed.sh"
