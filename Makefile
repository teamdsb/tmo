.PHONY: help docker-build docker-push docker-up docker-down docker-logs docker-clean db-up db-down db-clean all-up all-down

IMAGE_REPO ?= tmo
IMAGE_TAG ?= dev
PLATFORM ?= linux/amd64
SERVICES := commerce identity payment gateway-bff

help:
	@echo "Common targets: dev-up, dev-down, lint, test, gen, db-up, db-down, docker-build, docker-push, docker-up, docker-down, all-up, all-down"

docker-build: $(SERVICES:%=docker-build-%)

docker-build-%:
	docker build --platform $(PLATFORM) -f services/$*/Dockerfile -t $(IMAGE_REPO)/$*:$(IMAGE_TAG) .

docker-push: $(SERVICES:%=docker-push-%)

docker-push-%:
	docker push $(IMAGE_REPO)/$*:$(IMAGE_TAG)

docker-up:
	docker compose -f infra/docker/docker-compose.yml up -d --build

docker-down:
	docker compose -f infra/docker/docker-compose.yml down

docker-logs:
	docker compose -f infra/docker/docker-compose.yml logs -f

docker-clean:
	docker compose -f infra/docker/docker-compose.yml down -v

all-up: docker-up

all-down: docker-down

db-up:
	docker compose -f infra/dev/docker-compose.yml up -d

db-down:
	docker compose -f infra/dev/docker-compose.yml down

db-clean:
	docker compose -f infra/dev/docker-compose.yml down -v
