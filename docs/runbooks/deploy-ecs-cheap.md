# ECS 最省钱部署 Runbook

本文档对应“单台 ECS 上部署 tmo 后端”的最低成本方案。目标是尽快在生产环境跑通：

- `gateway-bff`
- `identity`
- `commerce`
- `payment`
- `postgres`
- `admin-web`

`ai` 当前不部署。

## 目录约定

建议在 ECS 使用以下目录：

```text
/opt/tmo
/opt/tmo/data/postgres
/opt/tmo/data/media
```

本文默认仓库根目录是 `/opt/tmo`。

## 机器规格

- ECS：`2C4G`
- 系统盘：`40GB`
- 带宽：`3Mbps` 起步
- 安全组仅开放：`22`、`80`、`443`

不要开放：

- `5432`
- `8080`
- `8081`
- `8082`
- `8083`

## 首次部署

1. 安装 `git`、`docker`、`docker compose`、`nginx`。
2. 拉取代码到 `/opt/tmo`。
3. 复制环境变量模板：

```bash
cd /opt/tmo
cp infra/prod/env.ecs.example infra/prod/env.ecs.local
```

4. 编辑 `infra/prod/env.ecs.local`，至少替换：

- `POSTGRES_PASSWORD`
- `IDENTITY_JWT_SECRET`
- `COMMERCE_JWT_SECRET`
- `COMMERCE_INTERNAL_SYNC_TOKEN`
- `PAYMENT_COMMERCE_SYNC_TOKEN`
- `GATEWAY_PUBLIC_BASE_URL`
- `MEDIA_PUBLIC_BASE_URL`
- `ADMIN_WEB_PUBLIC_BASE_URL`
- `ADMIN_WEB_API_BASE_URL`

5. 启动服务：

```bash
cd /opt/tmo
bash tools/scripts/prod-ecs-up.sh
```

这一步会同时：

- 启动 `postgres`、`identity`、`commerce`、`payment`、`gateway-bff`
- 应用迁移
- 构建 `admin-web` 并发布到 `ADMIN_WEB_DIST_DIR`（默认 `/var/www/tmo-admin`）

6. 做基础验收：

```bash
cd /opt/tmo
bash tools/scripts/prod-ecs-smoke.sh
```

## Nginx

API 域名复制模板：

```bash
sudo cp infra/prod/nginx.api.conf /etc/nginx/conf.d/tmo-api.conf
```

然后替换文件中的 `api.example.com` 为真实域名，再执行：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Admin 域名复制模板：

```bash
sudo cp infra/prod/nginx.admin.conf /etc/nginx/conf.d/tmo-admin.conf
```

然后替换文件中的 `admin.example.com` 为真实域名，并确认 `root /var/www/tmo-admin;` 与 `ADMIN_WEB_DIST_DIR` 一致，再执行：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## HTTPS

如果使用 Let’s Encrypt，可以先开放 80 端口并申请证书：

```bash
sudo mkdir -p /var/www/certbot
sudo certbot certonly --webroot -w /var/www/certbot -d api.example.com
```

后台域名同理：

```bash
sudo certbot certonly --webroot -w /var/www/certbot -d admin.example.com
```

证书签发完成后再次：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 常用命令

查看状态：

```bash
docker compose --env-file infra/prod/env.ecs.local -f infra/prod/docker-compose.ecs.yml ps
```

查看日志：

```bash
docker compose --env-file infra/prod/env.ecs.local -f infra/prod/docker-compose.ecs.yml logs -f gateway-bff identity commerce payment postgres
```

重跑迁移：

```bash
bash tools/scripts/prod-ecs-migrate.sh
```

更新后重建：

```bash
docker compose --env-file infra/prod/env.ecs.local -f infra/prod/docker-compose.ecs.yml up -d --build
```

## 上线后检查

- `https://你的域名/health`
- `https://你的域名/ready`
- `https://你的域名/bff/bootstrap`
- `https://你的域名/catalog/products?page=1&pageSize=5`
- `https://你的后台域名/`
- `https://你的后台域名/dashboard.html`

## 备份

至少做三件事：

- 每天备份 Postgres 数据目录或定时 `pg_dump`
- 每天备份 `/opt/tmo/data/media`
- 保留上一个可用镜像 tag，避免代码回滚时重新临时构建
