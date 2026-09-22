# Restore WeChat B2B Payment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the historically deployed WeChat B2B Store Assistant payment flow on top of the latest authenticated and hardened payment stack, then commit and deploy the payment service to ECS.

**Architecture:** Keep ordinary WeChat JSAPI code available but introduce an explicit `b2b` provider mode that is mutually exclusive in production. The backend signs opaque `wx.requestCommonPayment` parameters with server-only B2B credentials; the miniapp obtains a fresh `wx.login` code and forwards only that code and the order ID. Client success never becomes authoritative payment success.

**Tech Stack:** Go 1.26, Gin, PostgreSQL/sqlc, OpenAPI/oapi-codegen, TypeScript, Taro, Jest, Orval, Docker/Podman Compose.

---

### Task 1: Restore the B2B API contract and generated clients

**Files:**
- Modify: `contracts/openapi/payment.yaml`
- Modify: `contracts/openapi/openapi.yaml`
- Generate: `services/payment/internal/http/oapi/api.gen.go`
- Generate: `packages/payment-api-client/src/generated/payment.ts`
- Modify: `packages/payment-api-client/src/index.ts`

- [ ] Add `POST /payments/wechat/b2b/create` with `orderId`, `wechatLoginCode`, optional `Idempotency-Key`, and 200/400/403/409/503 responses.
- [ ] Add `WechatB2BPayCreateResponse` containing `paymentId`, `orderId`, `channel`, `status`, `expiresAt`, and opaque `commonPayParams`.
- [ ] Add `WECHAT_B2B` to `PaymentChannel` and reference the new path from the aggregate OpenAPI.
- [ ] Run `bash tools/scripts/payment-generate.sh` and `pnpm --dir packages/payment-api-client run generate`.
- [ ] Run `pnpm run check:openapi`; expect exit 0.

### Task 2: Restore the server-side B2B signer with strict validation

**Files:**
- Create: `services/payment/internal/http/handler/wechat_b2b_provider.go`
- Create: `services/payment/internal/http/handler/wechat_b2b_provider_test.go`
- Modify: `services/payment/internal/http/handler/handler.go`

- [ ] Write tests for missing credentials, invalid environment, missing login code, code2session errors, compact `out_trade_no`, preserved UUID attach, amount/currency, and deterministic HMAC fields.
- [ ] Run `go test ./services/payment/internal/http/handler -run 'TestWechatB2BDirectProvider' -count=1`; expect failure before implementation.
- [ ] Implement code2session with a bounded HTTP client, 1 MiB response limit, non-2xx and WeChat error rejection, compact UUID order number, and HMAC-SHA256 lowercase hexadecimal signatures.
- [ ] Run the focused tests; expect pass.

### Task 3: Add authenticated B2B payment creation without weakening state safety

**Files:**
- Modify: `services/payment/internal/http/handler/payments.go`
- Modify: `services/payment/internal/http/handler/payments_test.go`
- Modify: `services/payment/internal/http/handler/handler.go`

- [ ] Write tests proving CUSTOMER-only access, provider-required failure, offline/non-payable rejection, amount sourced from Commerce, one persisted `WECHAT_B2B` payment, idempotent replay, Commerce sync, and client SUCCESS remaining `PAY_PENDING` in `b2b` mode.
- [ ] Run focused tests and confirm they fail for the missing route/behavior.
- [ ] Add `paymentChannelWechatB2B`, `PostPaymentsWechatB2bCreate`, and a B2B-specific create helper that preserves current authorization, idempotency race handling, audit, and Commerce sync.
- [ ] Add response hydration/replay support for `WechatB2BPayCreateResponse`.
- [ ] Keep B2B recheck authoritative-state neutral.
- [ ] Run `go test ./services/payment/internal/http/handler -count=1`; expect pass.

### Task 4: Add an explicit production B2B mode

**Files:**
- Modify: `services/payment/internal/config/config.go`
- Modify: `services/payment/internal/config/config_test.go`
- Modify: `services/payment/cmd/payment/main.go`
- Modify: `services/payment/cmd/payment/main_test.go`
- Modify: `tools/scripts/prod-ecs-up.sh`
- Modify: `infra/prod/docker-compose.ecs.yml`
- Modify: `infra/prod/env.ecs.example`

- [ ] Write config tests proving `b2b` requires AppID, AppSecret, MchID, and AppKey while `disabled` does not.
- [ ] Write startup tests proving `b2b` initializes only B2B provider and refuses disabled authentication.
- [ ] Implement config fields and fail-closed validation.
- [ ] Accept `b2b` in the ECS preflight and validate non-empty B2B variables without printing them.
- [ ] Run Payment config/cmd tests and shell syntax check.

### Task 5: Restore the miniapp B2B platform adapter

**Files:**
- Modify: `packages/platform-adapter/src/types.ts`
- Modify: `packages/platform-adapter/src/index.ts`
- Modify: `packages/platform-adapter/src/weapp/index.ts`
- Modify: `packages/platform-adapter/src/alipay/index.ts`
- Modify: `apps/miniapp/src/app.config.ts`
- Test: `apps/miniapp/src/services/payment-services.test.ts`

- [ ] Add failing tests that expect `commonPay` and that ordinary `pay` is not used for a B2B session.
- [ ] Add `CommonPayOptions` and the platform dispatch function; implement WeChat with `wx.requestCommonPayment` and Alipay as unsupported.
- [ ] Restore the `bb-plugin` declaration with provider `wx69b7451feb427f0e`.
- [ ] Run package typecheck and miniapp focused tests.

### Task 6: Route miniapp payments through B2B

**Files:**
- Modify: `packages/payment-services/src/index.ts`
- Modify: `packages/payment-api-client/src/index.ts`
- Modify: `apps/miniapp/src/services/payment-availability.ts`
- Modify: `apps/miniapp/src/services/payment-availability.test.ts`
- Modify: `apps/miniapp/src/services/payment-services.test.ts`

- [ ] Add `wechat_b2b` channel and opaque `commonPayParams` normalization.
- [ ] For B2B create, call platform login, send the code to the B2B endpoint, then call `commonPay`.
- [ ] Preserve client result recheck reporting; verify the backend does not convert it to PAID.
- [ ] Make WeChat availability return `wechat_b2b` when flags permit.
- [ ] Run focused Jest tests and all package typechecks.

### Task 7: Update canonical documentation

**Files:**
- Modify: `docs/context/payment-setup.md`
- Modify: `docs/runbooks/deploy-ecs-cheap.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `.agent/PLANS.md`

- [ ] Document the B2B versus ordinary JSAPI distinction and required server-only credentials.
- [ ] Document `PAYMENT_PROVIDER_MODE=b2b`, deployment validation, and rollback.
- [ ] State that client success is not authoritative PAID evidence.
- [ ] Update Progress, discoveries, decisions, and outcomes in the ExecPlan.

### Task 8: Verify, review, commit, and push

**Files:** all changed files.

- [ ] Run backend full test, miniapp full Jest, miniapp type lint, all package typechecks, OpenAPI sync, production WeChat build, and `git diff --check`.
- [ ] Inspect the production build for `requestCommonPayment`, the B2B route, plugin provider ID, production API base, and fake-payment disabled state.
- [ ] Request independent code review and fix all Critical/Important findings.
- [ ] Rerun the full verification commands.
- [ ] Commit with `feat(payment): restore wechat b2b payment` and push `origin/codex/restore-b2b-payment`.

### Task 9: Deploy payment backend to ECS with rollback

**Files:** ECS runtime only; do not modify the dirty `/opt/tmo` Git checkout.

- [ ] Back up current env and image with timestamped, permission-restricted artifacts.
- [ ] Stream or fetch the committed Git archive into `/opt/tmo-releases/<sha>` and build a new immutable payment image.
- [ ] Restore B2B credentials from the protected 2026-08-11 backup without printing values; set provider mode to `b2b`.
- [ ] Recreate only payment and verify container health, public readiness, config presence/length, and clean startup logs.
- [ ] Record rollback commands and deployment evidence in `.agent/PLANS.md`.
