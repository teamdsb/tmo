# identity

Identity service for authentication, JWT issuing, and sales binding.

## Quickstart

1) Bootstrap databases (starts Postgres + migrates + seeds):

   `bash tools/scripts/dev-bootstrap.sh`

   若 admin-web real 登录异常，先执行 `bash tools/scripts/identity-seed-check.sh`。
   若检查失败，再执行 `bash tools/scripts/identity-repair.sh` 重置并修复 identity fixtures。

2) Run the service:

   `cd services/identity && IDENTITY_HTTP_ADDR=":8081" IDENTITY_DB_DSN="postgres://commerce:commerce@localhost:5432/identity?sslmode=disable" IDENTITY_LOGIN_MODE="real" go run ./cmd/identity`

## Dev login fixtures

- Customer: `POST /auth/mini/login` with `{"platform":"weapp","code":"mock_customer_001"}`
- Sales（业务员）: `POST /auth/mini/login` with `{"platform":"weapp","code":"mock_sales_001","role":"SALES"}`
- Multi-role: `mock_multi_001` returns 409 with `details.availableRoles`, retry with `role`.
- Boss password: `POST /auth/password/login` with `{"username":"boss","password":"boss123"}`
- Manager password: `POST /auth/password/login` with `{"username":"manager","password":"manager123"}`
- CS password: `POST /auth/password/login` with `{"username":"cs","password":"cs123"}`
- Admin password（超管）: `POST /auth/password/login` with `{"username":"admin","password":"admin123"}`
- Staff binding: create staff + binding token (admin), then `POST /auth/mini/login` with `{"platform":"weapp","code":"mock_staff_001","bindingToken":"<token>","role":"SALES"}`

说明：

- 本地未配置真实微信/支付宝凭证时，`mock_*` code 会作为本地联调回退入口；这样可以在 `IDENTITY_LOGIN_MODE=real` 下继续跑真实数据库 + 真实后端联调。

- `admin` 与 `boss` 在 admin-web 场景均视为最高层级。
- admin-web password login role whitelist: `BOSS`, `MANAGER`, `ADMIN`, `CS`；当前前端实现与此保持一致。
- `SALES` 不允许 password login（业务员仅走 miniapp 登录）。
- `tools/scripts/identity-seed.sh` 反复执行会收敛固定账号角色（删除历史多余角色并补齐缺失角色），避免本地脏数据导致角色漂移。
- `tools/scripts/identity-seed-check.sh` 会校验固定账号、密码、角色、mock 绑定和手机号白名单；若 gateway 可达，还会进一步校验 real password login 与 `/bff/bootstrap`。
- `tools/scripts/identity-repair.sh` 会重置 identity 相关 seed 数据并重新种入固定 fixtures，适合处理“admin-web real 登录失败但 seed 看似跑过”的场景。

默认 seed 还会写入以下手机号（`users.phone`）：

- Admin: `+15550000001`
- Sales: `+15550000002`
- Customer: `+15550000003`
- Multi-role: `+15550000004`
- Boss: `+15550000005`
- Manager: `+15550000006`
- CS: `+15550000007`

并写入员工手机号白名单（`staff_phone_whitelist`）：

- `+15550000002` -> `["SALES"]`
- `+15550000004` -> `["SALES","CS"]`

## Environment variables

- `IDENTITY_HTTP_ADDR` (default `:8081`)
- `IDENTITY_DB_DSN` (default `postgres://commerce:commerce@localhost:5432/identity?sslmode=disable`)
- `IDENTITY_LOG_LEVEL` (default `info`)
- `IDENTITY_JWT_SECRET` / `IDENTITY_JWT_ISSUER`
- `IDENTITY_ACCESS_TOKEN_TTL` (default `168h`)
- `IDENTITY_LOGIN_MODE` (`mock` or `real`, default `real`)
- `IDENTITY_WEAPP_APPID` / `IDENTITY_WEAPP_APPSECRET`（显式 `IDENTITY_LOGIN_MODE=mock` 时可使用 dev/mock 登录夹具）
- `IDENTITY_WEAPP_TOKEN_URL` / `IDENTITY_WEAPP_SESSION_URL` / `IDENTITY_WEAPP_QRCODE_URL`
- `IDENTITY_WEAPP_PHONE_NUMBER_URL`
- `IDENTITY_WEAPP_SALES_QR_PAGE` / `IDENTITY_WEAPP_QR_WIDTH`
- `IDENTITY_ALIPAY_APP_ID` / `IDENTITY_ALIPAY_PRIVATE_KEY` / `IDENTITY_ALIPAY_PUBLIC_KEY`
- `IDENTITY_ALIPAY_AES_KEY` (用于解密 `my.getPhoneNumber` 的密文 `response`)
- `IDENTITY_ALIPAY_GATEWAY_URL` / `IDENTITY_ALIPAY_SIGN_TYPE` / `IDENTITY_ALIPAY_SALES_QR_PAGE`
- `IDENTITY_ALIPAY_PHONE_FALLBACK_AUTH_USER` (default `true`，开启后可在 `my.getPhoneNumber` 失败时回退 `auth_user`)
- `IDENTITY_ENABLE_PHONE_PROOF_SIMULATION` (default `false`，审核前联调可开启模拟手机号)
- `IDENTITY_PHONE_PROOF_SIMULATION_PHONE` (default `+15550009999`)

## Real-mode mini login

- 当 `IDENTITY_LOGIN_MODE=real` 时，首次登录（该 identity 尚无已绑定手机号）需要手机号证明。
- `phoneProof.code` 用于服务端向平台换取手机号；`phoneProof.phone` 仅作为极端兼容兜底。
- 支付宝建议上送 `phoneProof.response/sign/signType/encryptType/charset`（`my.getPhoneNumber` 原始结果），后端会验签并解密取号。
- 已绑定手机号的 identity 可在后续仅做角色选择时不重复提交手机号证明（避免二次授权/一次性 code 失效）。
- 新手机号默认自动注册为 `CUSTOMER`；员工角色不会自动创建（需现有员工绑定流程）。
- miniapp 仅允许角色选择 `CUSTOMER` / `SALES`。

## 审核期模拟策略

- 小程序审核未通过期间，可开启 `IDENTITY_ENABLE_PHONE_PROOF_SIMULATION=true`，后端在手机号证明校验失败时回退到模拟手机号。
- 过审后建议关闭模拟开关，并确保支付宝公钥与 AES Key 配置正确，即可直接切换生产。
- 本地 dev seed 默认已存在 `mock_customer_001 -> +15550000003 -> weapp`。当未配置真实 WeChat 凭证且开启 weapp 手机号模拟时，mini login 需要复用该 customer 已有的 weapp provider 绑定，不能再为同一个 user 新建第二条 weapp identity。

## Scripts

- `tools/scripts/identity-generate.sh`: sqlc + oapi-codegen
- `tools/scripts/identity-migrate.sh`: apply migrations
- `tools/scripts/identity-seed.sh`: seed dev users/roles
- `tools/scripts/identity-seed-check.sh`: verify DB fixtures and real login baseline
- `tools/scripts/identity-repair.sh`: reset + reseed + verify identity fixtures
- `tools/scripts/dev-seed.sh`: seed commerce + identity together
- `tools/scripts/gateway-verify-real.sh`: verify gateway + identity real-mode login constraints
