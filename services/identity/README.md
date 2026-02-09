# identity

Identity service for authentication, JWT issuing, and sales binding.

## Quickstart

1) Bootstrap databases (starts Postgres + migrates + seeds):

   `bash tools/scripts/dev-bootstrap.sh`

2) Run the service:

   `cd services/identity && IDENTITY_HTTP_ADDR=":8081" IDENTITY_DB_DSN="postgres://commerce:commerce@localhost:5432/identity?sslmode=disable" IDENTITY_LOGIN_MODE="real" go run ./cmd/identity`

## Dev login fixtures

- Customer: `POST /auth/mini/login` with `{"platform":"weapp","code":"mock_customer_001"}`
- Sales: `POST /auth/mini/login` with `{"platform":"weapp","code":"mock_sales_001","role":"SALES"}`
- Multi-role: `mock_multi_001` returns 409 with `details.availableRoles`, retry with `role`.
- Admin password: `POST /auth/password/login` with `{"username":"admin","password":"admin123"}`
- Staff binding: create staff + binding token (admin), then `POST /auth/mini/login` with `{"platform":"weapp","code":"mock_staff_001","bindingToken":"<token>","role":"SALES"}`

## Environment variables

- `IDENTITY_HTTP_ADDR` (default `:8081`)
- `IDENTITY_DB_DSN` (default `postgres://commerce:commerce@localhost:5432/identity?sslmode=disable`)
- `IDENTITY_LOG_LEVEL` (default `info`)
- `IDENTITY_JWT_SECRET` / `IDENTITY_JWT_ISSUER`
- `IDENTITY_ACCESS_TOKEN_TTL` (default `168h`)
- `IDENTITY_LOGIN_MODE` (`mock` or `real`, default `mock`)
- `IDENTITY_WEAPP_APPID` / `IDENTITY_WEAPP_APPSECRET` (empty + `mock` = dev/mock)
- `IDENTITY_WEAPP_TOKEN_URL` / `IDENTITY_WEAPP_SESSION_URL` / `IDENTITY_WEAPP_QRCODE_URL`
- `IDENTITY_WEAPP_PHONE_NUMBER_URL`
- `IDENTITY_WEAPP_SALES_QR_PAGE` / `IDENTITY_WEAPP_QR_WIDTH`
- `IDENTITY_ALIPAY_APP_ID` / `IDENTITY_ALIPAY_PRIVATE_KEY` / `IDENTITY_ALIPAY_PUBLIC_KEY`
- `IDENTITY_ALIPAY_GATEWAY_URL` / `IDENTITY_ALIPAY_SIGN_TYPE` / `IDENTITY_ALIPAY_SALES_QR_PAGE`

## Real-mode mini login

- 当 `IDENTITY_LOGIN_MODE=real` 时，`POST /auth/mini/login` 必须携带 `phoneProof`。
- `phoneProof.code` 用于服务端向平台换取手机号；`phoneProof.phone` 仅作为极端兼容兜底。
- 新手机号默认自动注册为 `CUSTOMER`；员工角色不会自动创建（需现有员工绑定流程）。

## Scripts

- `tools/scripts/identity-generate.sh`: sqlc + oapi-codegen
- `tools/scripts/identity-migrate.sh`: apply migrations
- `tools/scripts/identity-seed.sh`: seed dev users/roles
- `tools/scripts/gateway-verify-real.sh`: verify gateway + identity real-mode login constraints
