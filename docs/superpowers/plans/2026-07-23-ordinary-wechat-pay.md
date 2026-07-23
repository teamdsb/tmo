# Ordinary WeChat Pay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Make the mini-program use ordinary direct-merchant WeChat Pay end-to-end: the server creates a JSAPI prepay order and the client invokes `wx.requestPayment`.

**Architecture:** `services/payment` owns merchant-side signing, prepay creation, notification verification, and order-state synchronization. The mini-program continues calling `POST /payments/wechat/create`, but must no longer ship or expose the B2B `requestCommonPayment` path. A UUID is converted to its 32-character hexadecimal form for `out_trade_no`; it can be parsed back to the same UUID on notification without a database migration.

**Tech Stack:** Go 1.25, Gin, wechatpay-go SDK, OpenAPI/oapi-codegen, sqlc, TypeScript, Taro/Jest.

---

### Task 1: Guard ordinary-merchant order numbers

**Files:**
- Modify: `services/payment/internal/http/handler/payments.go`
- Test: `services/payment/internal/http/handler/payments_test.go`

- [ ] Add a failing unit test asserting ordinary WeChat creation passes a 32-character, hyphen-free order number to the provider and ordinary notification resolves it to the original UUID.
- [ ] Add `wechatOutTradeNo(uuid.UUID) string`, returning the UUID without hyphens; use it when calling `Wechat.Create`.
- [ ] Keep `uuid.Parse` as the notification mapping boundary; add an explicit test for its compact order number input.
- [ ] Run `go test ./internal/http/handler` from `services/payment` and expect PASS.

### Task 2: Remove the B2B payment surface

**Files:**
- Modify: `contracts/openapi/payment.yaml`
- Regenerate: `services/payment/internal/http/oapi/api.gen.go`, `packages/payment-api-client/src/generated/payment.ts`
- Modify: `services/payment/internal/http/handler/handler.go`, `services/payment/internal/http/handler/payments.go`, `services/payment/cmd/payment/main.go`, `services/payment/internal/config/config.go`
- Delete: `services/payment/internal/http/handler/wechat_b2b_provider.go`, `services/payment/internal/http/handler/wechat_b2b_provider_test.go`
- Test: `services/payment/internal/http/handler/payments_test.go`

- [ ] Remove `/payments/wechat/b2b/create`, its request/response schema, and `WECHAT_B2B` from the payment OpenAPI source.
- [ ] Remove the B2B handler, provider dependency, startup configuration, environment-variable parsing, and B2B-only tests.
- [ ] Run `bash tools/scripts/payment-generate.sh`; do not hand-edit generated files.
- [ ] Run `go test ./...` from `services/payment` and expect PASS.

### Task 3: Keep the mini-program exclusively on `wx.requestPayment`

**Files:**
- Modify: `apps/miniapp/src/app.config.ts`
- Modify: `packages/platform-adapter/src/types.ts`, `packages/platform-adapter/src/index.ts`, `packages/platform-adapter/src/weapp/index.ts`
- Test: `apps/miniapp/src/services/payment-services.test.ts`

- [ ] Remove the B2B store-assistant plugin and the `commonPay` abstraction, so no shipped mini-program source calls `wx.requestCommonPayment`.
- [ ] Keep the existing WeChat `pay()` mapping to `wx.requestPayment`; tests must assert the ordinary `/payments/wechat/create` response is used.
- [ ] Run the focused mini-program test command and `pnpm -C apps/miniapp typecheck`; expect PASS.

### Task 4: Align the operational documentation

**Files:**
- Modify: `docs/context/payment-setup.md`
- Modify: `.agent/PLANS.md`

- [ ] Replace B2B setup claims with the ordinary-merchant prerequisites: direct merchant `mchid`, AppID binding, APIv3 key, merchant private-key path, certificate serial number, HTTPS notify URL, `PAYMENT_PROVIDER_MODE=wechat`, and feature flags.
- [ ] Record that deployment cannot use the previous special-merchant credentials; it requires the user to finish ordinary direct-merchant onboarding separately.
- [ ] Run `git diff --check` and verify no secrets are present.

### Task 5: Final verification and commit

**Files:** all changed files above.

- [ ] Run `go test ./...` in `services/payment`.
- [ ] Run `pnpm test -- --runTestsByPath src/services/payment-availability.test.ts src/services/payment-services.test.ts src/pages/order/detail/index.test.tsx` in `apps/miniapp`.
- [ ] Run `pnpm -C apps/miniapp typecheck` and `git diff --check` from repository root.
- [ ] Commit only the ordinary-direct-merchant migration with a Conventional Commit message.
