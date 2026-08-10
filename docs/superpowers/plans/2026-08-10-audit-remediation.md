# Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the audited authentication and payment vulnerabilities, restore all builds and tests, eliminate the confirmed request/concurrency stalls, and add CI gates that prevent the same regressions.

**Architecture:** Work in the isolated `codex/audit-remediation` worktree. Each subsystem has exclusive file ownership while active: Identity, Payment, Commerce/Gateway, frontend clients/apps, and contracts/CI. Security-sensitive behavior must fail closed: real login never accepts local proofs, production payment never defaults to unauthenticated or mock behavior, and external callbacks cannot change money state without provider verification.

**Tech Stack:** Go 1.25 workspace, Gin, pgx/sqlc, Gorilla WebSocket, Taro + React + TypeScript, Vite, Jest, Playwright, OpenAPI YAML, GitHub Actions.

---

### Task 1: Restore credential-version JWT enforcement

**Files:**
- Modify: `services/identity/internal/auth/jwt.go`
- Modify: `services/identity/internal/auth/jwt_test.go`
- Modify: `services/identity/internal/http/handler/auth.go`
- Test: `services/identity/internal/http/handler/*_test.go`

- [x] **Step 1: Write failing JWT tests**

Add tests that issue a token with credential version `3`, parse it, and assert `Claims.CredentialVersion == 3`. Add a test that parses a legacy token without the claim and asserts version `0`; the database comparison then rejects it.

- [x] **Step 2: Run the tests and preserve the baseline failure**

Run from `services/identity`:

    GOCACHE=/tmp/tmo-identity-remediation go test ./internal/auth ./internal/http/handler

Expected before implementation: build failure at `me.go` because `Claims.CredentialVersion` does not exist.

- [x] **Step 3: Implement the claim and issuance option**

Add the field and option in `jwt.go`:

    type Claims struct {
        // existing fields
        CredentialVersion int64
    }

    func WithCredentialVersion(version int64) IssueOption {
        return func(claims jwt.MapClaims) {
            claims["credentialVersion"] = version
        }
    }

Parse JSON numeric values without accepting negative or fractional versions. Every login and role-switch `Issue` call in `handler/auth.go` must pass `auth.WithCredentialVersion(user.CredentialVersion)`.

- [x] **Step 4: Verify Identity compiles and tokens revoke correctly**

Run:

    GOCACHE=/tmp/tmo-identity-remediation go test ./...

Expected: all Identity packages compile and tests pass; an old token without credential version is rejected by `requireClaims` against a migrated user whose version is `1`.

- [x] **Step 5: Commit the isolated Identity compile fix**

    git add services/identity/internal/auth services/identity/internal/http/handler
    git commit -m "fix(identity): restore credential version claims"

### Task 2: Close the mini-login account-binding bypass

**Files:**
- Modify: `services/identity/internal/platform/service.go`
- Modify: `services/identity/internal/platform/service_test.go`
- Modify: `services/identity/internal/http/handler/integration_test.go`
- Modify: `contracts/openapi/common.yaml`
- Modify: `services/identity/README.md`

- [x] **Step 1: Replace tests that currently bless real-mode mock codes**

Tests must assert:

    real mode + mock_* code => error
    real mode + PhoneProof.Phone => error
    mock mode + no platform client + mock_* code => local identity
    mock mode + direct phone => allowed for local integration only

- [x] **Step 2: Remove the unconditional local fallback**

In `Resolve`, do not branch on `isLocalMockCode` before mode validation. Local identities are accepted only when `r.mode == LoginModeMock` and the requested platform client is absent. In `ResolvePhone`, reject `proof.Phone` unless `r.mode == LoginModeMock`.

The real-mode behavior is intentionally fail closed even when real credentials are absent. The caller must receive an invalid proof/configuration error; it must never bind by caller-supplied phone.

- [x] **Step 3: Add a handler-level regression test**

Exercise `POST /auth/mini/login` with real mode, an unbound `mock_*` identity, and an existing customer's phone. Assert a 4xx response and assert that `CreateUserIdentity` is not called.

- [x] **Step 4: Correct the contract and local-development documentation**

Change the `PhoneProof.phone` description to “local mock mode only”; document that local backend integration must explicitly set `IDENTITY_LOGIN_MODE=mock`.

- [x] **Step 5: Bound default platform HTTP calls**

Add a platform unit test proving the internally constructed HTTP client has a 15-second timeout and an explicitly injected client is preserved. Replace `http.DefaultClient` with a private client carrying that timeout. Keep the existing WeChat token mutex coalescing behavior; the network wait is now bounded by both request context and client deadline.

- [x] **Step 6: Run Identity tests and commit**

    GOCACHE=/tmp/tmo-identity-remediation go test ./...
    git add services/identity contracts/openapi/common.yaml
    git commit -m "fix(identity): reject unverified mini login proofs"

- [x] **Step 7: Preserve BIGINT credential versions and strengthen the real-mode regression**

Parse JWT payload numbers with `jwt.WithJSONNumber()` and convert `credentialVersion` with strict base-10 `strconv.ParseInt`, so values above JavaScript's `2^53` boundary do not round. Add a round-trip test for `9007199254740995`. Replace the configured-real mock-code test's invalid URL with a recording `RoundTripper` and assert the resolver rejects before making any upstream request.

### Task 2A: Enforce revocation in every downstream JWT consumer

**Files:**
- Create: `packages/go-shared/authn/credential_validator.go`
- Create: `packages/go-shared/authn/credential_validator_test.go`
- Modify/Test: `services/{commerce,payment,ai}/internal/http/middleware/auth*.go`
- Modify: `services/{commerce,payment,ai}/cmd/*/main.go`
- Modify: `services/ai/internal/config/config.go`
- Modify: `infra/dev/docker-compose.backend.yml`

- [x] **Step 1: Add a bounded shared Identity validator**

Call Identity `GET /me` with the original Authorization header using a private HTTP client whose default timeout is three seconds. Map Identity 401/403 to an invalid credential sentinel and network/5xx/configuration failures to an unavailable sentinel. Unit tests must avoid live sockets and cover status mapping, context cancellation, header forwarding, and the hard timeout.

- [x] **Step 2: Wire Commerce and AI fail closed**

After local signature, issuer, and claim checks, call the validator before returning claims. Revoked credentials return 401; validator outages return 503 rather than granting access or hanging. Production constructors pass the Identity base URL; unit constructors may inject a deterministic stub.

- [ ] **Step 3: Wire Payment with the same behavior**

Use the same shared validator and error mapping in Payment. Keep callbacks public because provider verification, not user JWT, authenticates them; all user/admin routes that call `RequireUser` must validate revocation.

- [ ] **Step 4: Run all four Go modules and commit**

    (cd packages/go-shared && GOCACHE=/tmp/tmo-authn-remediation go test -count=1 ./...)
    (cd services/commerce && GOCACHE=/tmp/tmo-commerce-authn go test -count=1 ./...)
    (cd services/payment && GOCACHE=/tmp/tmo-payment-authn go test -count=1 ./...)
    (cd services/ai && GOCACHE=/tmp/tmo-ai-authn go test -count=1 ./...)
    git commit -m "fix(auth): enforce downstream token revocation"

### Task 3: Enforce Payment admin authorization and safe production defaults

**Files:**
- Modify: `services/payment/internal/http/handler/handler.go`
- Modify: `services/payment/internal/http/handler/admin_payments.go`
- Modify: `services/payment/internal/http/handler/admin_payments_test.go`
- Modify: `services/payment/internal/config/config.go`
- Modify: `infra/prod/docker-compose.ecs.yml`
- Modify: `docs/context/payment-setup.md`

- [ ] **Step 1: Add authorization regression tests**

Build signed JWTs for CUSTOMER, SALES, CS, MANAGER, BOSS, and ADMIN. Assert CUSTOMER and SALES receive 403 for all five `/admin/payments/**` handlers; assert CS, MANAGER, BOSS, and ADMIN are accepted. Add a configuration test that the default authentication setting is enabled.

- [ ] **Step 2: Add a dedicated admin guard**

Implement:

    func (h *Handler) requireAdminUser(c *gin.Context) (middleware.Claims, bool)

It calls `requireUser`, uppercases the role, allows only `ADMIN`, `BOSS`, `MANAGER`, and `CS`, and writes a standard 403 otherwise. Replace the five admin handlers' calls to `requireUser`.

- [ ] **Step 3: Fail closed in production configuration**

Set Payment's code default and ECS Compose default for `PAYMENT_AUTH_ENABLED` to true. Set the ECS provider default to `disabled`, not `mock`; local Compose remains explicitly mock. Update the payment setup runbook to say mock mode is never a production default.

- [ ] **Step 4: Verify and commit**

    GOCACHE=/tmp/tmo-payment-remediation go test ./...
    git add services/payment infra/prod/docker-compose.ecs.yml docs/context/payment-setup.md
    git commit -m "fix(payment): enforce admin authorization"

### Task 4: Prevent forged payments and make status synchronization retryable

**Files:**
- Modify: `services/payment/internal/http/handler/payments.go`
- Modify: `services/payment/internal/http/handler/payments_test.go`
- Modify: `services/payment/queries/payments.sql`
- Regenerate: `services/payment/internal/db/payments.sql.go`
- Modify: `contracts/openapi/payment.yaml`

- [ ] **Step 1: Add failing forged-callback tests**

Assert that an unsigned Alipay callback cannot mark any payment paid, an empty callback status is rejected, and an Alipay callback cannot mutate a WeChat payment. Assert provider mode `disabled` cannot create a payment session and cannot accept client `SUCCESS` as money truth.

- [ ] **Step 2: Disable the unimplemented Alipay provider**

`PostPaymentsAlipayCreate` and `PostPaymentsAlipayNotify` must return a documented 501 `not_implemented` response until a real provider exists. Remove the generic unsigned callback path for Alipay. Keep mock-only test behavior behind explicit `ProviderMode == mock`; never reach it from `disabled`, `wechat`, or `real`.

- [ ] **Step 3: Make payment state updates monotonic**

Change `UpdatePaymentState` so a non-PAID update cannot overwrite a row already in PAID state. If the conditional update returns `pgx.ErrNoRows`, reload and return the current row. Move Commerce synchronization to a helper that is called even when the Payment row already has the requested state; this makes retry repair a previous cross-service sync failure.

- [ ] **Step 4: Make idempotent create replay repair synchronization**

When an idempotency lookup returns an existing payment, re-run the Commerce synchronization before returning it. When insert loses a unique-key race, load and return the existing record instead of returning 500.

- [ ] **Step 5: Regenerate sqlc output, verify, and commit**

    cd services/payment
    sqlc generate
    GOCACHE=/tmp/tmo-payment-remediation go test ./...
    git diff --check
    git add services/payment contracts/openapi/payment.yaml
    git commit -m "fix(payment): verify and serialize payment state"

### Task 5: Remove Commerce concurrency stalls

**Files:**
- Modify: `services/commerce/internal/http/handler/support_hub.go`
- Modify: `services/commerce/internal/http/handler/support_hub_test.go`
- Modify: `services/commerce/internal/modules/productimport/service.go`
- Modify: `services/commerce/internal/modules/productimport/service_integration_test.go`

- [x] **Step 1: Add race and import-failure regression tests**

Add a SupportHub test that repeatedly disconnects a client while another goroutine publishes and completes without panic under `go test -race`. Add an import test that injects a failure after the first row update and asserts every row in that failed group reaches row status `FAILED` and `RunNext` returns within a bounded context instead of hanging. Preserve the existing partial-success contract: a job containing other successful groups may still finish as `SUCCEEDED`.

- [x] **Step 2: Keep channel sends under the hub read lock**

Iterate registered clients while `RLock` is held, use non-blocking sends, collect slow clients, release the read lock, then unregister collected clients. No goroutine may send to `client.send` after releasing the lock because `unregister` closes that channel under the write lock.

- [x] **Step 3: Move import failure marking after rollback**

Return a structured group error from the transaction. Let the transaction rollback, then call `markGroupFailed` using the pool. Do not acquire a second connection to update a row still locked by the current transaction.

- [x] **Step 4: Verify and commit**

    GOCACHE=/tmp/tmo-commerce-remediation go test -race ./internal/http/handler ./internal/modules/productimport
    git add services/commerce
    git commit -m "fix(commerce): remove support and import races"

### Task 6: Bound and coalesce gateway and browser requests

**Files:**
- Modify: `services/gateway-bff/internal/http/admin_summary.go`
- Modify: `services/gateway-bff/internal/http/bootstrap.go`
- Modify/Test: matching `*_test.go` files
- Modify: `apps/admin-web/src/lib/api.js`
- Modify: `apps/admin-web/src/lib/guard.js`
- Modify: `apps/admin-web/src/react/support/adminSupportNotifications.ts`
- Modify: `apps/admin-web/src/react/pages/admin/ImportPage.tsx`
- Modify/Test: `packages/*-services/src/requester.ts`

- [ ] **Step 1: Add timing and coalescing tests**

Gateway tests use delayed `httptest` servers and assert independent upstream requests overlap. Frontend requester tests use a never-resolving fetch and fake timers to assert timeout abort. Notification tests assert multiple refresh triggers share one in-flight promise.

- [ ] **Step 2: Parallelize independent BFF calls**

Use `errgroup.Group` or a `sync.WaitGroup` with index-owned result slots. Admin summary launches five independent requests concurrently. Authenticated bootstrap launches feature flags, `/me`, and `/me/permissions` concurrently while preserving existing error forwarding for required user and permission calls.

- [ ] **Step 3: Add browser deadlines and refresh coalescing**

Implement a shared `fetchWithTimeout` using `AbortController`; default to 15 seconds and preserve caller abort signals. Notification and import polling must not start a second request while the previous one is pending. Every fire-and-forget refresh must attach an error handler.

- [ ] **Step 4: Preserve sessions on transient bootstrap failures**

`ensureProtectedPage` logs out only when refresh cleared the session for a 401. A network error or 5xx keeps the cached session and renders the page with cached permissions while exposing a non-fatal warning.

- [ ] **Step 5: Verify and commit**

    GOCACHE=/tmp/tmo-gateway-remediation go test ./services/gateway-bff/...
    pnpm -C apps/admin-web typecheck
    pnpm -C apps/admin-web test:e2e:mock
    git commit -m "fix(api): bound and coalesce upstream requests"

### Task 6A: Make cart SKU replacement atomic

**Files:**
- Modify: `contracts/openapi/commerce.yaml`
- Modify: `services/commerce/queries/cart.sql`
- Regenerate: `services/commerce/internal/db/cart.sql.go`
- Regenerate: `services/commerce/internal/http/oapi/api.gen.go`
- Modify: `services/commerce/internal/modules/cart/store.go`
- Modify: `services/commerce/internal/http/handler/cart.go`
- Create/Test: `services/commerce/internal/http/handler/cart_integration_test.go`
- Regenerate: `packages/api-client/src/generated/commerce.ts`
- Modify: `packages/commerce-services/src/services/cart.ts`

- [x] **Step 1: Add a failing atomic-replacement integration test**

Create two SKUs and one cart row, then PATCH that row with `{ "skuId": target, "qty": 2 }`. Assert the old SKU is absent and the target SKU has quantity `2`. Add a second case where the target SKU is already in the cart and assert the rows merge to one target row whose quantity is the existing target quantity plus the requested move quantity, matching the previous `UpsertCartItem` behavior. A nonexistent item owned by another user must not be changed.

- [x] **Step 2: Extend the existing PATCH contract**

Keep `qty` required and add optional UUID `skuId` to `PATCH /cart/items/{itemId}`. No new endpoint is needed. Regenerate the Go server and TypeScript client from the contract; do not hand-edit generated files.

- [x] **Step 3: Replace the row in one SQL statement**

Add a sqlc query `ReplaceCartItemSku` implemented as a data-modifying CTE: delete the owned source row with `RETURNING`, then insert/upsert the requested target SKU in the same statement and return the resulting cart row. On target conflict, add the requested move quantity to the existing target quantity, preserving the old add-item merge semantics. If the source item does not exist, return `pgx.ErrNoRows` and map that to a 404. The existing quantity-only PATCH path remains unchanged when `skuId` is omitted.

- [x] **Step 4: Expose the atomic operation through the client service**

Add `replaceItemSku(itemId, skuId, qty)` to `CartService`, implemented by the regenerated PATCH function. The miniapp must use this operation instead of delete-then-add.

- [x] **Step 5: Generate, verify, and commit**

    cd services/commerce && sqlc generate
    # Run the repository's existing oapi-codegen and Orval generation scripts.
    GOCACHE=/tmp/tmo-commerce-remediation go test ./...
    pnpm -C packages/commerce-services exec tsc --noEmit
    git commit -m "fix(cart): replace sku atomically"

### Task 7: Fix frontend correctness and existing red gates

**Files:**
- Modify: `apps/admin-web/src/react/pages/admin/OrdersPage.tsx`
- Modify: `apps/admin-web/src/react/support/adminSupportNotifications.ts`
- Modify: `apps/miniapp/config/index.ts`
- Modify: `apps/miniapp/src/pages/mine/index.test.tsx`
- Modify: `apps/miniapp/src/pages/cart/index.tsx`
- Modify: `apps/miniapp/src/pages/cart/index.test.tsx`
- Carefully reconcile later: current-workspace order detail/list files owned by the user

- [ ] **Step 1: Make the existing type and lint failures red-to-green**

Annotate `patchedOrders` as `AdminOrderRecord[]` and `getToastCandidate` as `AdminSupportToast | null`. Replace CommonJS imports in miniapp config with TypeScript imports accepted by the Taro configuration runtime.

- [ ] **Step 2: Isolate the mine tests**

Reset queued mock implementations in `beforeEach`. Make the debug-role test explicitly load `runtimeEnv` with a localhost base URL before importing the page, rather than expecting a production-like URL to expose debug UI.

- [ ] **Step 3: Prevent cart data loss**

Replace the miniapp's delete-then-add SKU switch with `CartService.replaceItemSku(itemId, skuId, qty)` from Task 6A. Add a test where the replacement request rejects and assert the original item remains visible, the local selection is restored, and an error toast is shown; there must be no `removeItem` call.

- [ ] **Step 4: Reconcile the user's payment-success navigation edits**

When integrating back to the original worktree, do not overwrite its five dirty files. Replace blocking post-payment refresh waits with background refresh or navigation-first behavior, then run the existing order detail/list tests.

- [ ] **Step 5: Run all frontend gates and commit**

    pnpm -C apps/miniapp lint
    pnpm -C apps/miniapp test
    pnpm -C apps/admin-web typecheck
    pnpm -C apps/admin-web build
    pnpm -C apps/admin-web test:e2e:mock
    git commit -m "fix(frontend): restore correctness and quality gates"

### Task 8: Repair contracts and CI coverage

**Files:**
- Modify: `contracts/openapi/openapi.yaml`
- Create: `tools/scripts/check-openapi-sync.mjs`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/admin-web/package.json`
- Modify/Create: `.github/workflows/*.yml`
- Modify: `docs/CHANGELOG.md`

- [ ] **Step 1: Fix aggregate OpenAPI paths**

Remove the broken `/payments/wechat/b2b/create` reference. Add these ten service paths missing from the aggregate contract: `/auth/mini/capabilities`, `/auth/debug/switch-role`, `/admin/users/{userId}`, `/admin/users/{userId}/reset-password`, `/catalog/products/{spuId}/skus`, `/catalog/products/{spuId}/skus/{skuId}`, `/orders/{orderId}/confirm-receipt`, `/admin/orders/{orderId}/ship`, `/admin/orders/{orderId}/confirm-delivery`, and `/admin/catalog/products/assets`. Run the sync checker and require both that every service path appears in the aggregate and that every aggregate local `$ref` file plus JSON Pointer target exists.

- [ ] **Step 2: Add repository scripts and pin tooling**

Pin `packageManager` to `pnpm@10.30.3`, add `yaml@2.8.2` as a root dev dependency for the structural checker, and update the lockfile with pnpm 10. Add admin `typecheck` and root `test:admin-web`, `typecheck:packages`, and `check:openapi` scripts.

- [ ] **Step 3: Expand CI triggers and checks**

CI must trigger for `apps/admin-web/**`, `services/ai/**`, `contracts/openapi/**`, and TypeScript client packages. Run all Go modules, miniapp lint/tests, admin typecheck/build/mock E2E, package typechecks, and OpenAPI sync. Regenerate clients/code and fail on `git diff --exit-code` where deterministic generators are available.

- [ ] **Step 4: Verify and commit**

    pnpm run check:openapi
    pnpm run test
    pnpm run test:admin-web
    bash tools/scripts/test-backend.sh
    git diff --check
    git commit -m "ci: enforce full-stack quality gates"

### Task 9: Final integration into the user's dirty branch

**Files:**
- Merge all isolated commits
- Preserve: the five pre-existing miniapp order/CSS modifications in the original worktree

- [ ] **Step 1: Review each isolated commit**

Inspect `git show --stat` and file-scoped diffs. Run subsystem tests after each milestone; do not wait until the end to find cross-module breakage.

- [ ] **Step 2: Rebase the remediation branch on the original branch tip if it moved**

Do not reset or discard either worktree. Resolve only remediation-owned files. The user's dirty order/CSS files remain in the original worktree until the final reconciliation.

- [ ] **Step 3: Apply commits to the original branch safely**

Use non-destructive cherry-picks for commits that do not overlap dirty files. Apply the order navigation adjustment with `apply_patch` directly against the user's current diff.

- [ ] **Step 4: Run the full verification matrix**

Expected final state:

    bash tools/scripts/test-backend.sh        # exit 0
    pnpm -C apps/miniapp lint                 # exit 0
    pnpm -C apps/miniapp test                 # 257+ tests, 0 failed
    pnpm -C apps/admin-web typecheck          # exit 0
    pnpm -C apps/admin-web build              # exit 0
    pnpm -C apps/admin-web test:e2e:mock       # all pass
    pnpm run check:openapi                    # exit 0
    git diff --check                          # exit 0

- [ ] **Step 5: Update the living ExecPlan and report remaining environment-only checks**

Record real-provider and DB integration tests that require credentials or running PostgreSQL. Do not claim those paths passed unless they were actually run.
