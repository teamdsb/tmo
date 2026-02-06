# docker

Local dev compose files and service configs.

## Local stack

Start all services (uses existing images):

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

Build images with Makefile (optional):

```bash
make docker-build
```

## Migrations

Apply commerce + identity migrations:

```bash
bash tools/scripts/commerce-migrate.sh
bash tools/scripts/identity-migrate.sh
```

## Health checks

```bash
curl -sf http://localhost:8080/health && echo " gateway-bff /health OK"
curl -sf http://localhost:8080/ready && echo " gateway-bff /ready OK"
curl -sf http://localhost:8081/health && echo " identity /health OK"
curl -sf http://localhost:8081/ready && echo " identity /ready OK"
curl -sf http://localhost:8082/health && echo " commerce /health OK"
curl -sf http://localhost:8082/ready && echo " commerce /ready OK"
curl -sf http://localhost:8083/health && echo " payment /health OK"
curl -sf http://localhost:8083/ready && echo " payment /ready OK"
```

## Cleanup

Stop services:

```bash
docker compose -f infra/docker/docker-compose.yml down
```

Reset local database (destructive):

```bash
docker compose -f infra/docker/docker-compose.yml down -v
docker compose -f infra/docker/docker-compose.yml up -d
bash tools/scripts/commerce-migrate.sh
bash tools/scripts/identity-migrate.sh
```

Free Docker space (use with care):

```bash
docker builder prune -f
docker image prune -a -f
```
