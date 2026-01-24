#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

"$root_dir/tools/scripts/commerce-bootstrap.sh"

echo "Creating identity database..."

create_identity_db() {
  if command -v psql >/dev/null 2>&1; then
    psql "postgres://commerce:commerce@localhost:5432/commerce?sslmode=disable" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'identity') THEN
    CREATE DATABASE identity OWNER commerce;
  END IF;
END $$;
SQL
    return
  fi

  if command -v docker >/dev/null 2>&1; then
    docker exec -i tmo-postgres psql -U commerce -d commerce <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'identity') THEN
    CREATE DATABASE identity OWNER commerce;
  END IF;
END $$;
SQL
    return
  fi

  echo "psql or docker is required to create identity database." >&2
  exit 1
}

create_identity_db

"$root_dir/tools/scripts/identity-migrate.sh"
"$root_dir/tools/scripts/identity-seed.sh"
