# SAE Stage-0 Go 服务部署手册（gateway-bff / identity / commerce / payment）

## 1. 目标与架构边界

- 本手册用于将 Stage-0 四个 Go 服务部署到阿里云 SAE：
  - `gateway-bff`（公网入口）
  - `identity`（内网）
  - `commerce`（内网）
  - `payment`（内网）
- 部署策略：
  - 仅 `gateway-bff` 对公网暴露访问地址。
  - `identity`/`commerce`/`payment` 仅内网访问，由 `gateway-bff` 通过内网地址调用。
  - 数据库迁移采用“独立迁移应用先执行，成功后再发主服务”。

官方参考（仅 SAE 官方）：
- [在 SAE 控制台使用镜像部署应用](https://help.aliyun.com/zh/sae/user-guide/deploy-an-application-by-using-an-image)
- [设置启动命令](https://help.aliyun.com/zh/sae/user-guide/configure-a-startup-command)
- [设置环境变量和启动参数](https://help.aliyun.com/zh/sae/user-guide/set-environment-variables)
- [设置健康检查](https://help.aliyun.com/zh/sae/user-guide/set-health-check)
- [设置应用生命周期管理](https://help.aliyun.com/zh/sae/user-guide/configure-lifecycle-management)
- [配置应用对 RDS 数据库的访问](https://help.aliyun.com/zh/sae/user-guide/access-an-apsaradb-rds-instance)
- [CreateApplication OpenAPI](https://next.api.aliyun.com/api/sae/20190506/CreateApplication)

## 2. 前置环境

上线前需要准备：

1. 阿里云账号与权限
- 具备 SAE、VPC、RDS、ACR（镜像仓库）操作权限。
- 推荐为 CI/CD 准备最小权限 RAM 用户。

2. 资源准备
- 已创建 SAE 命名空间（Namespace）。
- 已创建 VPC、交换机（VSwitch）、安全组（Security Group）。
- 已创建 ACR 企业版实例或使用个人版镜像仓库。
- 已创建 RDS PostgreSQL 实例（至少 identity/commerce 可连接）。

3. 网络连通
- SAE 所在网络可访问 RDS（白名单/安全组放行）。
- `identity`/`commerce`/`payment` 应用互访可达（同 VPC/路由可达）。

4. 本地工具
- Docker（用于构建与推送镜像）。
- `aliyun` CLI（如需走 OpenAPI/CLI 流程）。
- `curl`（验收）。

## 3. 镜像构建与推送

仓库根目录执行（按你们仓库/地域替换占位符）：

```bash
export REGISTRY="<acr-registry>"          # 例如: registry.cn-hangzhou.aliyuncs.com
export REPO_NS="<acr-namespace>"          # 例如: teamdsb
export TAG="$(git rev-parse --short HEAD)"

docker build -f services/identity/Dockerfile -t "${REGISTRY}/${REPO_NS}/tmo-identity:${TAG}" .
docker build -f services/commerce/Dockerfile -t "${REGISTRY}/${REPO_NS}/tmo-commerce:${TAG}" .
docker build -f services/payment/Dockerfile -t "${REGISTRY}/${REPO_NS}/tmo-payment:${TAG}" .
docker build -f services/gateway-bff/Dockerfile -t "${REGISTRY}/${REPO_NS}/tmo-gateway-bff:${TAG}" .

docker push "${REGISTRY}/${REPO_NS}/tmo-identity:${TAG}"
docker push "${REGISTRY}/${REPO_NS}/tmo-commerce:${TAG}"
docker push "${REGISTRY}/${REPO_NS}/tmo-payment:${TAG}"
docker push "${REGISTRY}/${REPO_NS}/tmo-gateway-bff:${TAG}"
```

说明：
- `identity` 与 `commerce` 镜像中已包含：
  - 主服务二进制 `/app/identity`、`/app/commerce`
  - 迁移二进制 `/app/identity-migrate`、`/app/commerce-migrate`
  - 迁移目录 `/app/migrations`

## 4. SAE 控制台部署步骤（主服务）

建议先部署内网服务，再部署网关：
- 顺序：`identity` -> `commerce` -> `payment` -> `gateway-bff`

每个应用都执行：

1. SAE 控制台创建应用（镜像部署）
- 选择命名空间、VPC、交换机、安全组。
- 镜像地址填对应镜像 tag。
- 设置实例规格、副本数（建议先单副本验证）。

2. 环境变量
- 按第 7 节环境变量矩阵填写。
- 建议将密钥参数放入 SAE 配置或密文参数。

3. 启动命令
- 主服务保持镜像默认 `ENTRYPOINT`（不覆盖）。

4. 健康检查与生命周期
- 按第 6 节推荐参数配置。

5. 发布
- 发布后确认实例进入 Running/Ready。

## 5. SAE 控制台迁移步骤（独立迁移应用）

为 `identity` 和 `commerce` 各创建一个“迁移应用”（推荐命名：`identity-migrate`、`commerce-migrate`）：

1. 使用与主服务相同镜像
- `identity-migrate` 使用 `tmo-identity:<tag>`
- `commerce-migrate` 使用 `tmo-commerce:<tag>`

2. 覆盖启动命令
- `identity-migrate`：`/app/identity-migrate`
- `commerce-migrate`：`/app/commerce-migrate`

3. 迁移应用环境变量
- 至少配置对应 DB DSN：
  - `IDENTITY_DB_DSN`
  - `COMMERCE_DB_DSN`
- 可选显式配置迁移目录：
  - `IDENTITY_MIGRATIONS_DIR=/app/migrations`
  - `COMMERCE_MIGRATIONS_DIR=/app/migrations`

4. 执行并确认日志
- 成功标志日志包含 `migrations applied from ...`。
- 成功后再发布主服务版本。

建议：
- 迁移应用副本保持 1。
- 迁移成功后可缩容至 0 或保留但不自动触发。

## 6. 健康检查与生命周期推荐参数

按服务统一设置：

1. Startup Probe
- Path: `/ready`
- Period: `10s`
- Timeout: `2s`
- Failure Threshold: `30`

2. Liveness Probe
- Path: `/health`
- Initial Delay: `30s`
- Period: `10s`
- Timeout: `2s`
- Failure Threshold: `3`

3. Readiness Probe
- Path: `/ready`
- Initial Delay: `5s`
- Period: `10s`
- Timeout: `2s`
- Failure Threshold: `3`

4. 生命周期
- 开启 preStop 等待，建议上限 `60s`。
- 本仓库服务收到 `SIGTERM` 时支持优雅停机，preStop 与优雅停机时间应一致。

## 7. 环境变量矩阵（Stage-0）

### gateway-bff（公网入口）

| 变量 | 必填 | 示例 |
| --- | --- | --- |
| `GATEWAY_HTTP_ADDR` | 是 | `:8080` |
| `GATEWAY_IDENTITY_BASE_URL` | 是 | `http://identity.inner:8081` |
| `GATEWAY_COMMERCE_BASE_URL` | 是 | `http://commerce.inner:8082` |
| `GATEWAY_PAYMENT_BASE_URL` | 是 | `http://payment.inner:8083` |
| `GATEWAY_PUBLIC_BASE_URL` | 是 | `https://gateway.example.com` |
| `GATEWAY_AI_BASE_URL` | 否 | 留空 |
| `GATEWAY_LOG_LEVEL` | 否 | `info` |
| `GATEWAY_IMAGE_PROXY_ALLOWLIST` | 否 | `images.unsplash.com` |
| `PORT` | 否 | SAE 注入时可不手填 |

### identity

| 变量 | 必填 | 示例 |
| --- | --- | --- |
| `IDENTITY_HTTP_ADDR` | 是 | `:8081` |
| `IDENTITY_DB_DSN` | 是 | `postgres://user:pass@rds-host:5432/identity?sslmode=disable` |
| `IDENTITY_JWT_SECRET` | 是 | `<secret>` |
| `IDENTITY_JWT_ISSUER` | 是 | `tmo-identity` |
| `IDENTITY_LOGIN_MODE` | 建议 | `real` |
| `IDENTITY_LOG_LEVEL` | 否 | `info` |
| `PORT` | 否 | SAE 注入时可不手填 |

### commerce

| 变量 | 必填 | 示例 |
| --- | --- | --- |
| `COMMERCE_HTTP_ADDR` | 是 | `:8082` |
| `COMMERCE_DB_DSN` | 是 | `postgres://user:pass@rds-host:5432/commerce?sslmode=disable` |
| `COMMERCE_LOG_LEVEL` | 否 | `info` |
| `COMMERCE_AUTH_ENABLED` | 否 | `false` |
| `MEDIA_LOCAL_OUTPUT_DIR` | 按需 | `/data/media` |
| `MEDIA_PUBLIC_BASE_URL` | 按需 | `https://gateway.example.com/assets/media` |
| `PORT` | 否 | SAE 注入时可不手填 |

### payment

| 变量 | 必填 | 示例 |
| --- | --- | --- |
| `PAYMENT_HTTP_ADDR` | 是 | `:8083` |
| `PAYMENT_IDENTITY_BASE_URL` | 是 | `http://identity.inner:8081` |
| `PAYMENT_LOG_LEVEL` | 否 | `info` |
| `PAYMENT_AUTH_ENABLED` | 否 | `false` |
| `PORT` | 否 | SAE 注入时可不手填 |

## 8. OpenAPI / aliyun-cli 模板流程（占位符）

说明：以下是模板级流程，实际字段以 [CreateApplication OpenAPI](https://next.api.aliyun.com/api/sae/20190506/CreateApplication) 最新文档为准。

1. 准备参数映射（建议统一在 `.env`）

```bash
REGION_ID="<region-id>"
NAMESPACE_ID="<sae-namespace-id>"
VPC_ID="<vpc-id>"
VSWITCH_ID="<vswitch-id>"
SECURITY_GROUP_ID="<sg-id>"
IMAGE_URL="<acr-registry>/<ns>/tmo-identity:<tag>"
APP_NAME="identity"
```

2. 示例：通过 CLI 调用 OpenAPI 创建应用（模板）

```bash
aliyun sae CreateApplication \
  --RegionId "${REGION_ID}" \
  --NamespaceId "${NAMESPACE_ID}" \
  --AppName "${APP_NAME}" \
  --PackageType Image \
  --ImageUrl "${IMAGE_URL}" \
  --VpcId "${VPC_ID}" \
  --VSwitchId "${VSWITCH_ID}" \
  --SecurityGroupId "${SECURITY_GROUP_ID}" \
  --Replicas 1
```

3. 迁移应用模板（覆盖启动命令）

```bash
aliyun sae CreateApplication \
  --RegionId "${REGION_ID}" \
  --NamespaceId "${NAMESPACE_ID}" \
  --AppName "identity-migrate" \
  --PackageType Image \
  --ImageUrl "${IMAGE_URL}" \
  --Command "/app/identity-migrate" \
  --Replicas 1
```

若你的 CLI 版本参数名不一致，先执行：

```bash
aliyun sae CreateApplication --help
```

## 9. 验收清单

1. 迁移验证
- `identity-migrate` 日志出现 `migrations applied from ...`
- `commerce-migrate` 日志出现 `migrations applied from ...`

2. 应用就绪验证
- `identity`、`commerce`、`payment`、`gateway-bff` 在 SAE 控制台均为 Ready。

3. 外部验收（gateway）
- 本地执行：

```bash
GATEWAY_BASE_URL="https://<gateway-domain>" \
bash tools/scripts/sae-smoke.sh
```

- 可选内网验收（若可直连内网）：

```bash
GATEWAY_BASE_URL="https://<gateway-domain>" \
IDENTITY_BASE_URL="http://<identity-inner>:8081" \
COMMERCE_BASE_URL="http://<commerce-inner>:8082" \
PAYMENT_BASE_URL="http://<payment-inner>:8083" \
bash tools/scripts/sae-smoke.sh
```

## 10. 回滚与常见故障

### 回滚

1. 镜像回滚
- 将应用镜像 tag 回退到上一个稳定版本，重新发布。

2. 配置回滚
- 恢复上一个已验证的环境变量集合，再发布。

3. 迁移回滚
- 若迁移不可逆，不直接在线回退库结构；优先按备份/恢复策略执行。

### 常见故障

1. `/ready` 一直失败
- 检查 `*_DB_DSN` 是否正确。
- 检查 RDS 白名单与安全组。
- 检查 SAE 与 RDS 是否同 VPC 可达。

2. gateway 返回上游连接错误
- 检查：
  - `GATEWAY_IDENTITY_BASE_URL`
  - `GATEWAY_COMMERCE_BASE_URL`
  - `GATEWAY_PAYMENT_BASE_URL`
- 确认上游应用的 `*_HTTP_ADDR` 与服务端口一致。

3. 迁移应用执行失败
- 检查启动命令是否为 `/app/identity-migrate` 或 `/app/commerce-migrate`。
- 检查迁移目录（可显式设置 `*_MIGRATIONS_DIR=/app/migrations`）。
- 检查迁移应用是否具备正确 DB 访问权限。

4. 探针误杀
- 冷启动较慢时先增大 Startup Probe `failureThreshold`。
- 确认 `/health` 仅用于存活，`/ready` 用于就绪。
