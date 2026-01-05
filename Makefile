SHELL := /bin/sh

DATABASE_URL ?= postgres://tmo:tmo@localhost:5432/tmo?sslmode=disable
DATABASE_URL_DOCKER ?= postgres://tmo:tmo@host.docker.internal:5432/tmo?sslmode=disable
PG_CONTAINER ?= tmo-postgres
BACKEND_IMAGE ?= tmo-backend
BACKEND_CONTAINER ?= tmo-backend

.PHONY: help pg-up pg-down pg-stop pg-logs pg-migrate dev-run docker-build docker-run docker-stop test

help:
	@echo "Targets:"
	@echo "  pg-up        - Start Postgres via docker compose"
	@echo "  pg-down      - Stop Postgres via docker compose"
	@echo "  pg-stop      - Stop Postgres container (alias of pg-down)"
	@echo "  pg-logs      - Tail Postgres logs"
	@echo "  pg-migrate   - Run SQL migrations in backend/db/migrations"
	@echo "  dev-run      - Run backend locally (go run)"
	@echo "  docker-build - Build backend Docker image"
	@echo "  docker-run   - Run backend Docker container"
	@echo "  docker-stop  - Stop backend Docker container"
	@echo "  test         - Run backend tests"

pg-up:
	docker compose up -d postgres

pg-down:
	docker compose down

pg-stop: pg-down

pg-logs:
	docker compose logs -f postgres

pg-migrate:
	@set -e; \
	if command -v psql >/dev/null 2>&1; then \
		for f in backend/db/migrations/*.sql; do \
			[ -f "$$f" ] || continue; \
			echo "Applying $$f"; \
			psql "$(DATABASE_URL)" -v ON_ERROR_STOP=1 -f "$$f"; \
		done; \
	else \
		for f in backend/db/migrations/*.sql; do \
			[ -f "$$f" ] || continue; \
			echo "Applying $$f via container"; \
			docker exec -i "$(PG_CONTAINER)" psql -U tmo -d tmo -v ON_ERROR_STOP=1 -f /dev/stdin < "$$f"; \
		done; \
	fi

dev-run:
	DATABASE_URL="$(DATABASE_URL)" go run ./backend/cmd/server

docker-build:
	docker build -t "$(BACKEND_IMAGE)" -f backend/Dockerfile .

docker-run:
	docker run --rm --name "$(BACKEND_CONTAINER)" -p 8080:8080 -e DATABASE_URL="$(DATABASE_URL_DOCKER)" "$(BACKEND_IMAGE)"

docker-stop:
	@docker stop "$(BACKEND_CONTAINER)" >/dev/null 2>&1 || true

test:
	DATABASE_URL="$(DATABASE_URL)" cd backend && go test ./...
