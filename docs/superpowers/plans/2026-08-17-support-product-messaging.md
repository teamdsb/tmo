# Support Product Messaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让客服在显式认领会话后，可搜索并发送任意上架商品，且客户可从小程序卡片进入正确商品详情。

**Architecture:** Commerce 作为认领所有权和商品卡片真实性的最终裁决者；admin-web 只在当前用户是会话坐席时开放发送，并用目录接口驱动搜索/分页选品器；miniapp 以 `route` 为规范跳转字段并兼容可安全转换的旧 `linkUrl`。

**Tech Stack:** Go 1.25, Gin, pgx/sqlc, React 18, TypeScript, Vite, Playwright, Taro, Jest.

---

### Task 1: Enforce explicit conversation ownership

**Files:**
- Modify: `services/commerce/internal/http/handler/support.go`
- Test: `services/commerce/internal/http/handler/support_integration_test.go`

- [x] **Step 1: Write failing integration assertions**

在集成测试中用 CS-A 对未认领会话调用 `POST /support/conversations/{id}/read` 和 `POST /support/conversations/{id}/messages`，断言 403；认领后断言 200/201；用 CS-B 重复两个请求并断言 403。

- [x] **Step 2: Run the failing integration test**

Run from `services/commerce`: `COMMERCE_DB_DSN="$COMMERCE_DB_DSN" go test ./internal/http/handler -run TestSupportExplicitClaimOwnsReadAndSend -count=1`.
Expected before implementation: the unassigned send auto-claims and succeeds, or unassigned read succeeds, so the test fails.

- [x] **Step 3: Implement the ownership rule**

在 `createSupportMessage` 的 staff 分支删除 `ClaimSupportConversation`，改为当 `AssigneeUserID` 无效或不等于 `claims.UserID` 时返回 `permission denied`。在 `PostSupportConversationsConversationIdRead` 的 staff 分支执行同样检查，客户分支不变。将 CS 的释放权限收紧为只能释放自己的会话，ADMIN/BOSS/MANAGER 保留管理权。

- [x] **Step 4: Re-run support tests**

Run: `go test ./internal/http/handler -run 'TestSupport|TestApplySupport' -count=1`.
Expected: unit tests pass; DB-backed tests pass when DSN exists or report their established skip reason.

### Task 2: Make admin controls reflect ownership

**Files:**
- Modify: `apps/admin-web/src/react/pages/admin/SupportWorkspacePage.tsx`
- Modify: `apps/admin-web/src/react/pages/admin/supportWorkspaceData.ts`
- Test: `apps/admin-web/tests/e2e/support.mock.spec.ts`

- [x] **Step 1: Write a failing Playwright test**

断言 mock 待领取会话的输入框、图片、订单和选择商品入口禁用，页面提示请先认领；点击认领后上述控件可用。把现有“成功发送后清空”测试更新为先认领再发送。

- [x] **Step 2: Run the failing Playwright test**

Run: `pnpm -C apps/admin-web test:e2e:mock -- tests/e2e/support.mock.spec.ts`.
Expected: ownership assertions fail because the current controls remain enabled.

- [x] **Step 3: Implement ownership-derived UI state**

定义当前用户 ID、`isUnassigned`、`isAssignedToCurrentUser`、`isAssignedToOtherUser` 和 `canOperateConversation`。认领按钮只在未认领时可用；mock 认领将会话和详情的坐席字段改为当前用户。只对当前用户已认领的会话调用 `markConversationRead`。发送控件统一使用 `canOperateConversation && !sending`。

- [x] **Step 4: Re-run the Playwright test and typecheck**

Run: `pnpm -C apps/admin-web typecheck` then `pnpm -C apps/admin-web test:e2e:mock -- tests/e2e/support.mock.spec.ts`.
Expected: both exit 0.

### Task 3: Add searchable, paginated product picker

**Files:**
- Create: `apps/admin-web/src/react/pages/admin/SupportProductPicker.tsx`
- Modify: `apps/admin-web/src/react/pages/admin/SupportWorkspacePage.tsx`
- Test: `apps/admin-web/tests/e2e/support.mock.spec.ts`

- [x] **Step 1: Write a failing product-selection test**

拦截 `GET /catalog/products` 并返回两个带图片与不同名称的商品。认领会话，打开选品器，输入搜索词，断言请求含 `q`，选择第二个商品。拦截消息 POST 并断言 body 含第二个 `productId` 和 `/pages/goods/detail/index?id=<id>` 的 `route`，且只发送一次。

- [x] **Step 2: Run the failing product-selection test**

Run: `pnpm -C apps/admin-web test:e2e:mock -- tests/e2e/support.mock.spec.ts -g "selects and sends a searched product"`.
Expected: fail because no product picker exists.

- [x] **Step 3: Implement `SupportProductPicker`**

组件在打开时和搜索/翻页时调用 `fetchProducts({q, page, pageSize: 12})`，显示加载、错误、空数据、商品图片、名称、当前页/总页数和前后翻页。选中调用 `onSelect(product)`，在外层发送成功后关闭。

- [x] **Step 4: Replace quick product buttons and harden card send**

删除 `productOptions.slice(0, 2)` 和初始化时的商品预加载。使用单一“选择商品”按钮打开组件。`handleSendProductCard` 和 `handleSendOrderCard` 使用 `try/catch/finally`、`sending`、用户可见的发送状态与防重复。卡片使用 `route` 而不是 `linkUrl`。

- [x] **Step 5: Re-run admin tests**

Run: `pnpm -C apps/admin-web typecheck && pnpm -C apps/admin-web build && pnpm -C apps/admin-web test:e2e:mock -- tests/e2e/support.mock.spec.ts`.
Expected: commands exit 0 and product request assertions pass.

### Task 4: Validate product cards on the server

**Files:**
- Modify: `services/commerce/internal/http/handler/support.go`
- Test: `services/commerce/internal/http/handler/support_integration_test.go`

- [x] **Step 1: Write failing product-card integration cases**

创建 ACTIVE 商品后以已认领 CS 发送仅含 `productId` 的卡片，断言 201 且响应的 `title`/`imageUrl`/`route` 来自商品目录。分别用非 UUID、不存在 UUID 和 INACTIVE 商品发送，断言 400 且消息数不增加。

- [x] **Step 2: Run the failing cases**

Run: `COMMERCE_DB_DSN="$COMMERCE_DB_DSN" go test ./services/commerce/internal/http/handler -run TestSupportProductCardUsesCatalogSnapshot -count=1`.
Expected before implementation: arbitrary JSON is accepted and assertions fail.

- [x] **Step 3: Implement catalog-backed snapshot construction**

解析 `productId` 为 UUID，调用 `CatalogStore.GetProduct`，检查 `Status == ACTIVE`，并编码 `{title, subtitle, productId, imageUrl, route}` 替换客户端传入的 payload。将不存在或状态非法统一映射为 `invalid request` 400。`ORDER_CARD` 保持当前行为。

- [x] **Step 4: Re-run Commerce tests**

Run: `gofmt -w internal/http/handler/support.go internal/http/handler/support_integration_test.go` and `go test ./internal/http/handler -run 'TestSupport' -count=1` from `services/commerce`.
Expected: pass or only established DSN skips.

### Task 5: Make miniapp card navigation compatible and testable

**Files:**
- Create: `apps/miniapp/src/pages/support/chat/card-route.ts`
- Create: `apps/miniapp/src/pages/support/chat/card-route.test.ts`
- Modify: `apps/miniapp/src/pages/support/chat/index.tsx`
- Test: `apps/miniapp/src/pages/support/chat/index.test.tsx`

- [x] **Step 1: Write failing route resolver tests**

断言 `route: /pages/goods/detail/index?id=<id>` 原样返回；`linkUrl: /goods/<id>` 转换为 `goodsDetailRoute(id)`；`https://evil.example` 和未知路径返回空字符串。

- [x] **Step 2: Run tests to verify failure**

Run: `pnpm -C apps/miniapp test -- --runInBand src/pages/support/chat/card-route.test.ts`.
Expected: fail because resolver does not exist.

- [x] **Step 3: Implement and adopt the resolver**

实现 `resolveSupportCardRoute(payload)`，只允许以 `/pages/` 开头的规范 route，或格式严格为 `/goods/<non-empty-id>` 的旧 linkUrl。`handleCardClick` 使用该函数。

- [x] **Step 4: Re-run miniapp support tests**

Run: `pnpm -C apps/miniapp test -- --runInBand src/pages/support/chat/card-route.test.ts src/pages/support/chat/index.test.tsx`.
Expected: pass.

### Task 6: Document and verify the complete behavior

**Files:**
- Modify: `docs/runbooks/online-support-v1.md`
- Modify: `docs/context/product-requirements.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/execplans/support-product-messaging-2026-08-17.md`

- [x] **Step 1: Update canonical behavior documentation**

写明显式认领后才可已读/发送，商品选择只包含 ACTIVE 目录，卡片点击使用 miniapp `route`，客服真实联调必须验证选择非首个商品。在 CHANGELOG 记录对后续 agent 判断有影响的规则变化。

- [x] **Step 2: Run final verification**

Run from repository root:

    pnpm -C apps/admin-web typecheck
    pnpm -C apps/admin-web build
    pnpm -C apps/admin-web test:e2e:mock -- tests/e2e/support.mock.spec.ts
    pnpm -C apps/miniapp test -- --runInBand src/pages/support/chat/card-route.test.ts src/pages/support/chat/index.test.tsx
    pnpm run lint
    go test ./services/commerce/internal/http/handler -run 'TestSupport|TestApplySupport' -count=1
    git diff --check

Expected: every command exits 0; DB-backed tests may only skip with the repository's explicit missing-DSN message.

- [x] **Step 3: Update the living ExecPlan**

将实际命令结果、发现和最终行为写入 `Progress`、`Surprises & Discoveries` 和 `Outcomes & Retrospective`，并在文档底部追加完成日期与变更原因。
