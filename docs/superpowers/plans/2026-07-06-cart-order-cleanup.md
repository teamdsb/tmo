# Cart Order Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the quantities selected from the cart as soon as order creation succeeds, while preserving unrelated items and any quantity not included in the order.

**Architecture:** The Commerce order transaction already locks and validates every selected cart row before creating the order. Reuse those locked rows to decrement or delete the selected quantities in the same transaction, so an order and its cart cleanup cannot diverge. Keep isolated mock mode behavior aligned by removing the submitted quantities from persisted mock cart state when its order is created.

**Tech Stack:** Go 1.25, Gin, pgx/sqlc, PostgreSQL integration tests, TypeScript, Jest, pnpm.

---

### Task 1: Lock the real order/cart contract with a regression test

**Files:**
- Modify: `services/commerce/internal/http/handler/orders_integration_test.go`

- [ ] **Step 1: Change the existing order/cart integration test to require cleanup after HTTP 201**

Rename `TestPostOrdersKeepsCartItemsUntilPaymentSucceeds` to `TestPostOrdersRemovesOrderedCartItemsAfterOrderSucceeds`. Keep two seeded cart rows, submit only the first row, and assert that only the second row remains with its original quantity.

- [ ] **Step 2: Run the focused test and verify the current implementation fails**

Run: `go test ./internal/http/handler -run TestPostOrdersRemovesOrderedCartItemsAfterOrderSucceeds -count=1 -v` from `services/commerce` with `COMMERCE_DB_DSN` pointing at the repository test database.

Expected: FAIL because the ordered cart row still exists after the 201 response.

### Task 2: Remove submitted quantities atomically

**Files:**
- Modify: `services/commerce/internal/http/handler/orders.go`
- Modify: `services/commerce/internal/http/handler/internal_payments.go`
- Modify: `services/commerce/internal/http/handler/internal_payments_test.go`

- [ ] **Step 1: Reuse validated locked cart rows after order item creation**

For each submitted order item, subtract its submitted quantity from the locked cart row. Call `UpdateCartItemQty` when a positive remainder exists; otherwise call `DeleteCartItem`. Perform this inside the existing `WithTx` callback after all order items are created.

Remove the old payment-success cart deduction from `syncOrderPaymentSummary`; payment synchronization must only update payment/order state after order creation owns cart cleanup. Update its integration tests to assert that pending, failed, cancelled, paid, and repeated paid events never mutate cart quantities.

- [ ] **Step 2: Run the focused integration test and verify it passes**

Run the Task 1 command again.

Expected: PASS; the submitted row is gone and the unrelated row remains.

### Task 3: Keep isolated mock checkout consistent

**Files:**
- Modify: `apps/miniapp/src/services/isolated-mock-mode.test.ts`
- Modify: `apps/miniapp/src/services/mock/commerce.ts`

- [ ] **Step 1: Add a failing mock regression assertion**

After `commerceServices.orders.submit`, load the cart and assert that the submitted item is absent.

- [ ] **Step 2: Run the focused Jest test and verify it fails**

Run: `pnpm -C apps/miniapp test -- --runTestsByPath src/services/isolated-mock-mode.test.ts`

Expected: FAIL because mock order creation currently only persists the order.

- [ ] **Step 3: Update mock order creation state atomically**

Within the existing `updateIsolatedMockState` call, decrement each matching `cartEntries` row by the submitted quantity and remove rows whose remainder is zero.

- [ ] **Step 4: Run the focused Jest test and verify it passes**

Run the Task 3 focused command again.

Expected: PASS.

### Task 4: Verify and publish

**Files:**
- Review only the six implementation/test files above and this plan.

- [ ] **Step 1: Run relevant suites**

Run the Commerce handler tests with the test database, the full miniapp Jest suite, and the repository miniapp lint command.

- [ ] **Step 2: Review repository state**

Confirm the pre-existing untracked privacy plan remains untouched and is not staged. Review `git diff --check`, the task diff, and staged file names.

- [ ] **Step 3: Commit only task files**

Run: `git commit -m "fix(cart): remove ordered items after checkout"`.

- [ ] **Step 4: Push the current branch**

Run: `git push origin feat/product-multi-image-gallery` and report any GitHub repository-rule rejection verbatim with the retained local commit hash.
