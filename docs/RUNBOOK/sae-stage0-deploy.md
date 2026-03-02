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
- [SAE 产品计费（含试用额度）](https://help.aliyun.com/zh/sae/serverless-app-engine-upgrade/product-billing)
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

## 2.1 试用额度与计费优先级

依据 SAE 官方计费文档，当前采用“试用额度优先”部署策略：

1. 计费优先级
- 若账号存在 SAE 试用资源包，实例使用会先消耗试用额度。
- 试用额度耗尽或过期后，实例继续运行将转入按量计费。
- 试用不会自动停机，需自行降配/停服/释放资源以控制费用。

2. 本账号当前试用窗口（已核实）
- 试用包：`Serverless 应用引擎免费试用套餐包`
- 总额度：`4320000 CU`
- 状态：`试用中`
- 生效时间：`2026-02-26 14:34:31`（北京时间）
- 结束时间：`2026-05-26 13:59:59`（北京时间）

3. 试用期推荐资源策略（本次选型）
- 区域固定：`cn-guangzhou`
- 主服务资源规格：`1C2G`
- 主服务副本数：`2`（稳妥档）
- 迁移应用副本数：`1`，迁移成功后立即缩容至 `0` 或释放。
- 对外仅暴露 `gateway-bff`，避免无效外网资源消耗。

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

推荐直接使用仓库脚本（更稳，自动停在失败点）：

```bash
REGISTRY="<acr-registry-host>" \
REPO="<acr-repo-path>" \
SHA="$(git rev-parse --short HEAD)" \
bash tools/scripts/sae-push-stage0.sh
```

推送完成后，先做部署前预检（避免发布后才发现拉取或镜像内容问题）：

```bash
REGISTRY="<acr-registry-host>" \
REPO="<acr-repo-path>" \
SHA="$(git rev-parse --short HEAD)" \
bash tools/scripts/sae-image-preflight.sh
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

4. 费用验收（试用额度消耗）
- 进入：`费用与成本 -> 我的试用 -> 产品试用`
- 确认 SAE 条目仍为 `试用中`，并观察“周期内试用进度”持续增长。
- 若进度不增长，优先排查是否创建到不参与试用的产品或错误地域。

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

### 实操问题记录（2026-03-02）

以下为本账号在 `cn-guangzhou`、`identity-migrate` 实际部署时遇到的问题与处理方式，后续可直接按此排查。

1. 现象：迁移应用持续 `ImagePullBackOff`
- 变更记录会长时间显示“执行中”，随后“执行失败”。
- 应用事件关键报错：`insufficient_scope: authorization failed`（拉取镜像鉴权失败）。

2. 高概率根因
- SAE 使用的镜像拉取 Secret 与镜像仓库权限不匹配（账号/密码错误或仓库作用域不足）。
- 镜像地址域名与网络类型不一致：
  - 镜像地址使用 `*-vpc.cn-*.personal.cr.aliyuncs.com`，但部署链路不是按内网拉取。
  - 或镜像地址使用公网域名，但应用出网能力未准备（NAT/EIP）。
- 发布单执行期间，控制台会锁定“部署应用”按钮，无法立即改配置。

3. 处置步骤（优先执行）
- 新建一个干净的 ACR 拉取 Secret（建议单独命名，如 `acr-user-public`），并确认仓库域名与账号凭证可用。
- 部署时保证“镜像地址域名”与“镜像网络类型”成对一致：
  - 方案 A：`vpc` 域名 + 内网拉取。
  - 方案 B：公网域名 + 出网能力（NAT/EIP）。
- 若当前发布单仍在执行，先等待该单结束（本次实测约 7 分钟级），再重新部署。
- 重发后在“应用事件”中确认错误从 `insufficient_scope` 消失，出现正常拉取与启动日志。

4. 事件验收关键字（成功路径）
- `Pulling image`
- `Pulled image`
- `Created container`
- `Started container`
- 迁移程序日志：`migrations applied from ...`

5. 备选镜像源策略（当 ACR 鉴权持续异常时）
- 可临时切换到其他可访问镜像仓库（例如 GHCR）发布同一镜像，再在 SAE 更新镜像地址与拉取凭证。
- 使用外部公网镜像仓库时，需先确认 SAE 应用具备稳定出网能力，否则同样会拉取失败。

6. 本次复现证据补充（第二次发布仍失败）
- 发布单：`0dd21f82-a26a-4ef7-a4fd-9b4c1aa265a6`
- 新实例：`identity-migrate-b9d413c0-01c4-4325-a3c5-423b7cea701-xm466`
- 事件窗口（北京时间）：`2026-03-02 02:06:44` 到 `2026-03-02 02:07:18`
- 关键报错：
  - `Error: ErrImagePull`
  - `Error: ImagePullBackOff`
  - `insufficient_scope: authorization failed`

7. 止损规则（避免反复兜圈）
- 同一应用在“已确认镜像 tag 存在”的前提下，若连续 2 次发布都出现 `insufficient_scope`：
  - 立即停止在同一 ACR 路径继续重试。
  - 直接切换到 GHCR（或其他已验证可拉取仓库）完成发布。
  - 待业务恢复后再回头修复 ACR 权限体系。

8. 控制台排障观察补充（2026-03-02 02:16）
- 在实例列表已出现 `ErrImagePull` 的情况下，应用事件页可能短时显示 `总计 0 项记录`。
- 该场景下优先以“实例状态 + 实例事件/日志”作为判据，不要仅依赖应用事件总览。

9. 新证据补充（2026-03-02 02:33~02:35，北京时间）
- `DeployApplication` 请求已确认带入：
  - `ImageUrl=crpi-6nb4b2ouii3kt9mo.cn-guangzhou.personal.cr.aliyuncs.com/...:identity-26eb4cc`（公网域名）
  - `ImagePullSecrets=654`（新建 `acr-user-public-v2`）
  - `CustomImageNetworkType=internet`
- 但同次发布的新实例 `identity-migrate-...-hlkh9` 事件仍显示实际拉取：
  - `Pulling image "crpi-6nb4b2ouii3kt9mo-vpc.cn-guangzhou.personal.cr.aliyuncs.com/...:identity-26eb4cc"`
  - 随后 `ErrImagePull / ImagePullBackOff / insufficient_scope: authorization failed`
- 结论：当前路径下，运行时实际走 `-vpc` 拉取链路；仅改“公网镜像 + 公网 Secret”不足以恢复。

10. 当前最稳执行路径（不再兜圈）
- 优先改为“显式 VPC 路径”重发：
  - 镜像地址改为 `*-vpc.cn-guangzhou.personal.cr.aliyuncs.com/...`
  - 镜像拉取 Secret 也使用同 `-vpc` 域名创建并绑定
  - 部署页镜像网络改为私网（与 `-vpc` 域名一致）
- 若按上述一致化后仍出现 `insufficient_scope`，立即执行止损规则第 7 条，切换 GHCR 完成发布，不再在当前 ACR 路径重复重试。

11. 当前执行状态（2026-03-02 02:36+）
- 已创建 VPC 专用拉取密钥：`acr-user-vpc`（ID `655`，`-vpc` 域名）。
- `identity-migrate` 当前仍被上一发布单锁定（控制台提示“应用有变更流程正在执行”），在发布单结束前“部署应用”按钮不可用。
- 下一步固定动作：
  - 等按钮解锁后，立刻将镜像地址切到 `-vpc` 域名，并绑定 `655` 重发。
  - 若仍失败，直接执行止损规则第 7 条切 GHCR。

12. 新根因补充（2026-03-02 02:52~02:53，北京时间）
- 现象：镜像已成功拉取（事件含 `Pulled` / `Created`），但实例进入 `CrashLoopBackOff`。
- 事件关键报错：
  - `Error: failed to create containerd task ... exec: "/bin/sh": stat /bin/sh: no such file or directory`
- 结论：发布配置中的启动命令链路依赖 `/bin/sh`，而 distroless 运行时镜像不包含 shell，导致容器进程无法启动。

13. 对应修复策略（已落地）
- 镜像层修复（稳定优先）：
  - `identity` 与 `commerce` 运行时基础镜像从 distroless 调整为 `alpine:3.20`，保留非 root 用户运行，并内置 `/bin/sh`。
  - 迁移二进制与 `/app/migrations` 保持不变。
- 配置层约束：
  - 迁移应用启动命令优先使用可执行文件绝对路径（`/app/identity-migrate`、`/app/commerce-migrate`）。
  - 若控制台参数以 shell 包装执行，确保镜像运行时具备 `/bin/sh`，避免同类故障复现。

14. 发布面与镜像仓库内容不一致（Tag 复用导致兜圈）
- 现象：本地已覆盖推送同名 tag（示例 `identity-26eb4cc`），并验证镜像内存在 `/bin/sh`，但 SAE 新实例事件仍报：
  - `exec: "/bin/sh": stat /bin/sh: no such file or directory`
- 结论：发布面在同名 tag 上可能仍命中旧 digest（节点缓存/拉取策略），继续复用同一 tag 会反复失败。

15. 强制止损规则（固定执行）
- 迁移或主服务一旦出现镜像内容不一致问题，禁止继续复用失败 tag 重试。
- 立即切换到“新且未使用”的不可复用 tag（示例：`identity-cbb248a`、`commerce-cbb248a`）并重发。
- 重发前执行 `tools/scripts/sae-image-preflight.sh`，确认目标 tag 具备：
  - `/app/<service>`
  - `identity`/`commerce` 还需具备 `/app/<service>-migrate` 与 `/app/migrations`
- SAE 验收以实例事件为准：必须出现 `Pulled image`、`Started container`，且不再出现 `/bin/sh` 报错后，再进入迁移日志验收。

16. 迁移应用必填环境变量缺失（会直接失败）
- 复盘时间：`2026-03-02`（北京时间）。
- 现象：
  - `identity-migrate` 的 SAE 配置仅有 `IDENTITY_MIGRATIONS_DIR=/app/migrations`，未配置 `IDENTITY_DB_DSN`。
  - `commerce-migrate` 的 SAE 配置 `Envs=[]`，未配置 `COMMERCE_DB_DSN`。
- 代码事实（仓库内）：
  - `services/identity/cmd/identity-migrate/main.go` 明确要求 `IDENTITY_DB_DSN`，缺失会报 `IDENTITY_DB_DSN is required`。
  - `commerce` 迁移同理，必须提供数据库连接串。
- 结论：
  - 迁移应用未配置 `*_DB_DSN` 时，不应进入“继续重试发布”，应先补齐变量再发布。
- 固定处置动作：
  - `identity-migrate` 至少配置：
    - `IDENTITY_DB_DSN=<rds-dsn>`
    - `IDENTITY_MIGRATIONS_DIR=/app/migrations`
  - `commerce-migrate` 至少配置：
    - `COMMERCE_DB_DSN=<rds-dsn>`
    - `COMMERCE_MIGRATIONS_DIR=/app/migrations`（可选但建议显式）
  - 变量补齐后再执行迁移发布与日志验收（关键字：`migrations applied from`）。

17. 迁移应用资源参数固定值（避免并发迁移）
- 迁移应用实例数强制为 `1`，禁止使用默认 `2` 副本，避免并发执行迁移带来的锁冲突或重复执行风险。
- 主服务仍按稳妥档 `1C2G + 2 副本` 执行。

18. 控制台“复制应用”页面输入串写问题（2026-03-02 13:20+，北京时间）
- 现象：
  - 在“复制应用”页面反复编辑 `应用名称/应用描述` 时，文本会发生拼接串写，出现多段内容叠加。
  - 结果是可能创建出非预期应用名（例如 `identity-copycommercecommerccommerce`）。
- 影响：
  - 容易误创建应用，影响后续服务发现与环境变量映射，增加人工修正成本。
- 固定规避策略（本仓库后续默认执行）：
  - 主服务创建优先走“应用列表 -> 创建应用（非复制）”路径。
  - 若必须复制应用，先只改镜像并立即创建，应用名改动放到后置步骤处理，避免在同页多次编辑文本框。
  - 关键生产发布优先使用 OpenAPI/CLI 模板创建，避免控制台交互态异常导致的非预期参数。

19. 最新进度与阻塞快照（2026-03-02，供新会话接续）
- 已完成（控制台实操）：
  - `identity` 应用已创建，镜像使用 `identity-cbb248a`。
  - 创建了一个镜像为 `commerce-26eb4cc` 的应用，但应用名发生串写，当前名称为 `identity-copycommercecommerccommerce`。
  - 两个迁移应用已存在：`identity-migrate`、`commerce-migrate`。
- 当前应用清单（最近一次控制台读取）：
  - `identity`
  - `identity-copycommercecommerccommerce`
  - `identity-migrate`
  - `commerce-migrate`
- 未完成项（必须继续）：
  - `payment` 主服务未创建。
  - `gateway-bff` 主服务未创建（公网入口与域名绑定未开始）。
  - `identity-copycommercecommerccommerce` 需要按目标命名收敛为 `commerce`（重建或重命名后统一环境变量）。
- 关键阻塞：
  - Chrome MCP 通道异常（`Transport closed`），导致无法继续自动化控制台操作。
  - 本机 `aliyun` CLI 尚未配置 AK/SK，无法切换到 OpenAPI/CLI 路径兜底。
- 已验证状态：
  - ACR 公网登录成功（`docker login` 返回 `Login Succeeded`）。
- 下一会话固定首步（防止重复兜圈）：
  - 优先恢复一种可执行通道：`Chrome MCP` 或 `aliyun CLI 凭证` 二选一。
  - 若 `Chrome MCP` 未恢复，立即改走 `aliyun configure set --mode AK` + OpenAPI/CLI 创建剩余应用，不再等待控制台交互恢复。
  - 若继续走控制台，禁止再用“复制应用”创建主服务，统一改“创建应用（镜像部署）”。

20. CLI 接管后的实操落地（2026-03-02 23:30+，北京时间）
- AK/SK 与 CLI 已打通：
  - 本机 `aliyun` profile `default` 已配置为 `AK` 模式，区域 `cn-guangzhou`。
  - 验证命令 `aliyun sts GetCallerIdentity` 已成功返回主账号身份。
- 实际线上失败根因（已定位）：
  - `identity`、`commerce`、`payment`、`gateway-bff` 的失败实例日志均指向未注入关键环境变量（服务默认回落到 `localhost:5432`）。
  - 其中 `identity`/`commerce` 核心阻塞是 `*_DB_DSN` 缺失。
- RDS 现状与修复：
  - 实例不在广州，位于 `cn-hangzhou`：`pgm-bp106pcbun3uo9qp`（PostgreSQL 18）。
  - 已开启公网连接地址：`tmostage0pg.pg.rds.aliyuncs.com:5432`。
  - 已创建账号与库：
    - 账号：`commerce`
    - 库：`commerce`、`identity_app`（`identity` 为 RDS 关键字不可用，改为 `identity_app`）
  - 已完成权限授权：账号 `commerce` 对上述两个库均为 `ALL/DBOwner`。
  - 已完成迁移（本地直连 RDS 执行）：
    - `services/identity/cmd/identity-migrate`：成功
    - `services/commerce/cmd/commerce-migrate`：成功
- SAE 实际发布结果（`cn-guangzhou:tmo-stage0`）：
  - `identity`（AppId: `53547887-a98d-4e00-8a3e-7484b9058f2b`）已重发并注入 `IDENTITY_DB_DSN`，实例运行正常。
  - `commerce`（AppId: `17ec9a7e-1a45-4092-bb4d-e9ceba313d7e`）已按正确名称新建并运行正常。
  - `payment`（AppId: `266c1b79-bc7e-4f1d-941d-5d65b19ac71d`）已新建并运行正常。
  - `gateway-bff`（AppId: `82980fc8-d327-481e-9697-453ce6e7d616`）已新建并运行正常。
  - 旧错误应用已执行停服（防止持续 CrashLoop）：
    - `identity-copycommercecommerccommerce`
    - `identity-migrate`
    - `commerce-migrate`
- 公网入口推进状态：
  - 已发起 `gateway-bff` 的公网 SLB 绑定（80 -> 8080），变更单 `9fa9bf18-4f35-45cd-af58-839fb8dab42c`。
  - 绑定完成后应立即补做：
    - 获取公网访问地址
    - 执行 `tools/scripts/sae-smoke.sh` 的网关验收
    - 回写 `GATEWAY_PUBLIC_BASE_URL` 为真实公网地址（当前为占位值）。

21. 广州 RDS 切换与线上联调收敛（2026-03-03 00:15+，北京时间）
- 新增同城 RDS（广州）并完成初始化：
  - 实例：`pgm-7xvimd5x7ver5r74`（PostgreSQL 18，`cn-guangzhou`，同 VPC）。
  - 账号：`commerce`。
  - 库：`commerce`、`identity_app`。
  - 权限：`commerce` 对两库均为 `ALL/DBOwner`。
- 迁移执行（已成功）：
  - 由于本机无法直连 RDS 私网地址，临时开启公网连接与白名单，仅用于迁移窗口。
  - 执行：
    - `go run ./services/identity/cmd/identity-migrate`
    - `go run ./services/commerce/cmd/commerce-migrate`
  - 日志均返回：`migrations applied from ...`。
- 应用配置切换（已完成）：
  - `identity` 改为广州私网 DSN，变更单 `50a6f491-1b05-4b1b-a16d-7d14e5d6e19a`（成功）。
  - `commerce` 改为广州私网 DSN，变更单 `60ac4c81-2c39-47d6-bcb2-05b73ea6dcde`（成功）。
- 新问题与修复（已收敛）：
  - 现象：`gateway` 访问 `commerce` 返回 502，日志报 `lookup commerce ... no such host`。
  - 根因：`gateway`/`payment` 使用了 `http://commerce:8082`、`http://identity:8081` 这类不可解析主机名。
  - 修复：改为服务内网 SLB 地址：
    - `GATEWAY_IDENTITY_BASE_URL=http://172.20.72.192`
    - `GATEWAY_COMMERCE_BASE_URL=http://172.20.72.191`
    - `GATEWAY_PAYMENT_BASE_URL=http://172.20.72.193`
    - `PAYMENT_IDENTITY_BASE_URL=http://172.20.72.192`
  - 变更单：
    - `gateway-bff`：`4d3e7529-70c0-4efe-a11a-6f7316b015e6`（成功）
    - `payment`：`90fda2c8-c4a9-44ac-acab-049f6d1c17c2`（成功）
- 验收结果（公网入口 `http://8.166.134.148`）：
  - `/health` -> `200`
  - `/ready` -> `200`
  - `/bff/bootstrap` -> `200`
  - `/catalog/categories` -> `200`
  - `/catalog/products?page=1&pageSize=20` -> `200`
  - `/assets/img` -> `400`（预期）
  - `tools/scripts/sae-smoke.sh` 全量通过。
- 安全收尾（已完成）：
  - 迁移完成后已回收公网暴露：
    - 释放广州 RDS 公网地址 `tmostage0gz.pg.rds.aliyuncs.com`
    - 白名单收敛回 `172.20.0.0/16`
  - 当前仅保留 RDS 私网连接地址：`pgm-7xvimd5x7ver5r74.pg.rds.aliyuncs.com:5432`。

### 试用到期前处置

1. 继续使用
- 在到期前确认预算与告警，接受转按量计费后继续运行。

2. 降配运行
- 先将非核心服务副本降到 `1`，必要时降低实例规格，减少后续成本。

3. 暂停/释放
- 对临时环境优先停服或释放非必要应用与公网资源，避免到期后持续计费。
