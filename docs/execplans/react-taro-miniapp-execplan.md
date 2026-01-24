# Build React + Taro Miniapp Catalog-to-Intent Flow

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan follows `docs/execplans/PLANS.md` from the repository root and must be maintained in accordance with that file.

## Purpose / Big Picture

After this change, a user can open the miniapp and complete the core workflow of browsing a catalog, searching, viewing details, adding items to a cart, selecting an address, and submitting an intent order. The same user can also access supporting flows such as “can’t find product” demand submission, bargain entry, aftersale submission, order tracking, Excel-based import and tracking updates, and payment (disabled by default). The change is visible by running the miniapp, navigating through the listed pages, and observing that each page renders, accepts input, and uses real or mocked data to complete the flow.

## Progress

- [x] (2026-01-23 08:07Z) Drafted this ExecPlan from the provided task brief.
- [ ] (2026-01-23 08:07Z) Build the project scaffolding for the new pages, shared components, stores, and services in `apps/miniapp`.
- [ ] (2026-01-23 08:07Z) Implement MVP pages and flows for catalog, search, detail, cart, address, and intent order.
- [ ] (2026-01-23 08:07Z) Implement demand collection, bargain entry, order tracking, and sales binding pages.
- [ ] (2026-01-23 08:07Z) Implement aftersale pages, Excel import/cart workflow, and tracking upload workflow.
- [ ] (2026-01-23 08:07Z) Implement payment toggles and payment result page (disabled by default).
- [ ] (2026-01-23 08:07Z) Validate flows end-to-end in Taro dev builds and document evidence in this plan.

## Surprises & Discoveries

- None yet.

## Decision Log

- Decision: Implement the miniapp inside `apps/miniapp`, using Taro pages under `apps/miniapp/src/pages` and routing via `apps/miniapp/src/app.config.ts`.
  Rationale: This repository already contains a Taro React app at `apps/miniapp` and no other frontend app is populated.
  Date/Author: 2026-01-23, Codex.

- Decision: Use Zustand for persistent client state and React Query for server data fetching, with a Taro storage adapter for persistence.
  Rationale: The task brief explicitly requires Zustand + React Query, and Taro storage provides a stable miniapp-compatible persistence API.
  Date/Author: 2026-01-23, Codex.

- Decision: Provide a mock data mode that can satisfy UI flows without backend readiness, with a clear switch to real APIs.
  Rationale: The plan must be self-contained and demonstrably working; mock data avoids blocking on backend availability.
  Date/Author: 2026-01-23, Codex.

- Decision: Define page groups as subpackages in `app.config.ts` to keep miniapp bundle size manageable.
  Rationale: The page list is large; subpackages reduce initial load and align with miniapp best practices.
  Date/Author: 2026-01-23, Codex.

## Outcomes & Retrospective

Not started. This section will be updated as milestones complete.

## Context and Orientation

The Taro miniapp lives in `apps/miniapp`. Its entrypoint is `apps/miniapp/src/app.ts`, and the global configuration for routes is in `apps/miniapp/src/app.config.ts`. Taro is a cross-platform miniapp framework that uses React but renders to miniapp components; it uses `@tarojs/components` (for example `View`, `Text`, `Input`, `Image`) instead of HTML elements. Each page is a folder under `apps/miniapp/src/pages/<name>` with `index.tsx`, optional `index.scss` for styles, and `index.config.ts` for page-specific config such as `navigationBarTitleText`.

There is currently only a placeholder home page at `apps/miniapp/src/pages/index/index.tsx`. The task requires a multi-page app with a defined route structure and shared components. This plan introduces a shared component directory (`apps/miniapp/src/components`), shared state stores (`apps/miniapp/src/store`), and service wrappers (`apps/miniapp/src/services`) so that each page can be implemented consistently. The backend contracts live under `contracts/openapi`, but this plan is self-contained and spells out the interface functions directly.

## Plan of Work

The work is organized into six milestones, each representing a usable increment of the miniapp. The milestones align with the provided iteration list, but each milestone includes concrete edits, commands, and observable outcomes. When implementing, keep each milestone independently verifiable before continuing.

### Milestone 1: MVP catalog to intent order

Create the core infrastructure for the miniapp and make the catalog-to-order flow functional. Update `apps/miniapp/src/app.config.ts` to include the new routes and subpackages, and add the new pages under `apps/miniapp/src/pages`:

The goods and ordering pages are `pages/goods/index`, `pages/goods/search`, `pages/goods/detail`, `pages/cart/index`, `pages/address/list`, `pages/address/edit`, and `pages/order/confirm`. The order listing and detail pages are `pages/order/list` and `pages/order/detail`. Each page should render a basic layout and accept input using Taro components. Implement shared components (`PageContainer`, `SearchBar`, `CategoryTabs`, `GoodsCard`, `SkuSelector`, `PriceLadder`, `CartItemRow`, `OrderItemList`, `AddressCard`, and `EmptyState`) under `apps/miniapp/src/components` and use them in pages.

Add the Zustand stores under `apps/miniapp/src/store` with `userStore`, `cartStore`, `addressStore`, and `configStore` and a storage adapter using Taro’s `getStorageSync` and `setStorageSync` so that data persists across sessions. Add React Query setup in `apps/miniapp/src/app.ts` using a `QueryClient` and provider. Add a request wrapper in `apps/miniapp/src/services/http.ts` that uses `Taro.request`, attaches auth tokens, and performs basic error-to-toast handling. The goods list, goods detail, cart, address, and order pages should work with mock data through services in `apps/miniapp/src/services` if the backend is not available.

Acceptance for this milestone is that a user can open the miniapp, browse categories, search, open a product detail, select a SKU, add to cart, select an address, and submit an intent order. The search page must show an empty state that prominently routes to the demand submission page when no results are found.

### Milestone 2: Price ladder, bargain entry, and demand collection

Enhance the goods detail page to show a price ladder (`PriceLadder`) and a configurable bargain entry (`BargainEntry`) that can route to an in-app form or external channel later. Add demand collection pages at `pages/demand/create`, `pages/demand/list`, and `pages/demand/detail` so that users can submit “can’t find product” needs and review past requests. The demand creation route should accept `kw` as a query param and prefill the product name when coming from the empty state.

Acceptance for this milestone is that the detail page displays tiered pricing and the demand submission flow is reachable and saves data via the service layer.

### Milestone 3: Sales binding and order tracking

Implement the binding entry page `pages/bind/entry` to parse `scene` or `q` parameters (miniapp QR entry parameters), call the sales binding API, and then navigate to `pages/bind/result`. Add `pages/mine/sales` to display the bound sales representative in the personal center area. Add the order tracking page `pages/order/track` to display shipping tracking information and a “pending return” placeholder when tracking is missing.

Acceptance for this milestone is that scanning a QR code path results in a binding call, the user can see their sales binding, and the tracking page renders proper empty or populated states.

### Milestone 4: Aftersale module

Add the aftersale entry page `pages/aftersale/index`, the submission page `pages/aftersale/create`, and list/detail pages at `pages/aftersale/list` and `pages/aftersale/detail`. Implement `ImageUploader` and `Timeline` components. The submission page must allow selecting a type, entering text, uploading images, and optionally associating an order. The detail page must reserve space for AI responses and follow-up records.

Acceptance for this milestone is that users can submit aftersale requests and see them listed with status and detail views.

### Milestone 5: Excel import and tracking upload

Implement the Excel import for cart with two pages: `pages/excel/import-cart` and `pages/excel/confirm-sku`. The flow is upload Excel, create a task, show results split into “confirmed” and “unconfirmed,” auto-add confirmed items to cart, and route unconfirmed items to SKU confirmation. Implement tracking number return for purchasers at `pages/tracking/update` and bulk Excel tracking upload at `pages/excel/upload-tracking`, with a task result page showing successes and failures.

Acceptance for this milestone is that Excel tasks can be created and the UI shows task outcomes; confirmed import items land in the cart; unconfirmed items can be resolved and then added.

### Milestone 6: Payment (disabled by default)

Integrate the config toggle `paymentEnabled` in `configStore` and `config.get` service call, so payment UI and entry points render only when enabled. Add a payment result page at `pages/pay/result` and render a payment block in order detail that shows status and records even when payment is disabled (in a disabled or placeholder state).

Acceptance for this milestone is that payment UI is hidden by default, can be enabled via config, and the payment result page renders for success, failure, or cancellation.

### Pending confirmations and tech-debt pool

The following items must be tracked as explicit “pending confirmation / technical debt” tasks before implementation is finalized: the SKU hierarchy schema and UI (multi-level spec selection such as material → length → size), the ownership override rules for repeated QR bindings, the bargain entry channel and navigation rules, the tracking detail depth (tracking number only vs carrier and timeline), the criteria for “confirmed vs unconfirmed” Excel import results, and the payment state machine including retry and idempotency behavior. Each item should be recorded as a task and resolved with explicit UI copy and data model notes before its milestone is closed.

## Concrete Steps

Run the following commands from the repository root unless a different working directory is stated. These steps should be updated as work proceeds and as milestones complete.

1) Install dependencies for the miniapp.

    Working directory: repository root
    Command: pnpm -C apps/miniapp install
    Expected output (example):
        Scope: all 1 workspace projects
        Packages: +<N>
        Done in <X>s

2) Start a development build for WeChat or Alipay, and keep the console open.

    Working directory: repository root
    Command: pnpm -C apps/miniapp dev:weapp
    Expected output (example):
        ✔ Compiled successfully
        Listening at http://127.0.0.1:<port>/

3) Optionally build the H5 output for quick browser verification if desired.

    Working directory: repository root
    Command: pnpm -C apps/miniapp build:h5
    Expected output (example):
        ✓ Built in <X>ms

## Validation and Acceptance

Validation must be done by running the miniapp and manually exercising each critical flow. The minimum acceptance criteria are: the goods index shows categories and product lists; search supports keyword entry and shows a clear empty state with a “can’t find product” entry; detail pages display SKU selection, price ladder, bargain entry, and add-to-cart; the cart allows updating quantities and removing items; address management supports CRUD and default selection; intent order submission includes item list, address, remark, and succeeds with a confirmation state; order list and detail pages render status tags, address, and payment block; tracking pages show tracking information or a “pending return” placeholder; demand submission is reachable and saves data; sales binding works via `scene` or `q` and is reflected in user state; aftersale pages allow submission and list records; Excel import flow splits confirmed and unconfirmed results and updates the cart; tracking uploads show task results; payment UI hides by default and displays only when config enables it.

When backend endpoints are unavailable, use the mock service layer to simulate these behaviors and document which mocks were used and what data values were shown. If any flow is blocked, record it in `Surprises & Discoveries` with the exact error output or missing dependency.

## Idempotence and Recovery

All file additions should be additive and can be applied multiple times without breaking existing code. Re-running dependency installation or dev builds should be safe. If a milestone must be reworked, revert only the specific page or component folder that is incorrect and restore the previous working state before moving forward. Clear the miniapp storage (through `Taro.clearStorageSync()` or the miniapp developer tools) when validating persistence changes to avoid stale data.

## Artifacts and Notes

As milestones complete, include small excerpts that prove success. Examples to include here are updated route lists or key store definitions. Avoid large dumps. Example route listing excerpt for `apps/miniapp/src/app.config.ts`:

    pages: [
      'pages/goods/index',
      'pages/goods/search',
      'pages/goods/detail',
      'pages/cart/index',
      'pages/address/list',
      'pages/address/edit',
      'pages/order/confirm',
      'pages/order/list',
      'pages/order/detail',
      'pages/order/track',
      'pages/demand/create',
      'pages/demand/list',
      'pages/demand/detail',
      'pages/bind/entry',
      'pages/bind/result',
      'pages/mine/sales',
      'pages/aftersale/index',
      'pages/aftersale/create',
      'pages/aftersale/list',
      'pages/aftersale/detail',
      'pages/excel/import-cart',
      'pages/excel/confirm-sku',
      'pages/tracking/update',
      'pages/excel/upload-tracking',
      'pages/pay/result'
    ]

## Interfaces and Dependencies

Use the following libraries and modules. Zustand is a lightweight state container; in this plan it persists state to miniapp storage. React Query is a data fetching library that caches server responses and handles loading states; here it wraps calls to `Taro.request` and coordinates with the UI. Taro is the miniapp framework; use `@tarojs/components` for UI primitives and `@tarojs/taro` for APIs such as storage, network, and file selection.

Dependencies to add in `apps/miniapp/package.json` include `zustand` and `@tanstack/react-query`. If a query devtool is desired, add `@tanstack/react-query-devtools` but keep it disabled in production builds.

Define shared types in `apps/miniapp/src/services/types.ts` and use them across pages and stores. The minimum type surface includes:

    export type UserRole = 'buyer' | 'sales' | 'admin'

    export type SalesBinding = {
      salesId: string
      name: string
      phone: string
      avatarUrl?: string
      boundAt: string
    }

    export type CartItem = {
      goodsId: string
      skuKey: string
      qty: number
    }

    export type Address = {
      id: string
      name: string
      phone: string
      region: string
      detail: string
      isDefault: boolean
    }

    export type GoodsCategory = { id: string; name: string }

    export type GoodsSummary = {
      id: string
      name: string
      imageUrl: string
      priceRange: string
      minQty: number
      tags?: string[]
    }

    export type GoodsDetail = {
      id: string
      name: string
      images: string[]
      description: string
      skuTree: SkuNode[]
      priceLadder: PriceTier[]
    }

    export type PriceTier = { minQty: number; price: string }

    export type SkuNode = {
      key: string
      label: string
      children?: SkuNode[]
    }

Define the service layer in `apps/miniapp/src/services` with clear function signatures and explicit responsibilities. A single file per domain is acceptable, for example `goods.ts`, `cart.ts`, `orders.ts`, `demand.ts`, `sales.ts`, `aftersale.ts`, `tracking.ts`, `excel.ts`, `config.ts`, and `pay.ts`. Each function should return typed results and should have a mock implementation available under `apps/miniapp/src/services/mock` when the backend is not ready. The required API surface is:

- Goods: `getCategories()`, `listGoods(params)`, `getGoodsDetail(id)`; optional `toggleFavorite(id)` and `listFavorites()`.
- Cart: `getCart()`, `addToCart(item)`, `updateCart(item)`, `removeFromCart(itemId)`, `clearCart()`.
- Address: `listAddresses()`, `createAddress(payload)`, `updateAddress(id, payload)`, `deleteAddress(id)`, `setDefaultAddress(id)`.
- Orders: `createIntentOrder(payload)`, `listOrders(params)`, `getOrderDetail(id)`.
- Demand: `createDemand(payload)`, `listDemands(params)`, `getDemandDetail(id)`.
- Sales: `bindSales(payload)`, `getMySales()`.
- Aftersale: `createAftersale(payload)`, `listAftersales(params)`, `getAftersaleDetail(id)`.
- Config: `getConfig()` returning `paymentEnabled`.
- Payment: `createPay(payload)`, `getPayRecords(orderId)`.
- Tracking: `getTracking(orderId)`, `updateTracking(payload)`, `uploadTrackingExcel(file)`, `getTrackingTask(taskId)`.
- Excel import for cart: `importCartExcel(file)`, `getImportTask(taskId)`, `confirmImportTask(payload)`.

Use React Query to wrap these services with stable query keys, for example `['goods', 'list', params]`, `['goods', 'detail', id]`, `['orders', 'detail', id]`, and mutations for cart updates and submissions. Use Zustand stores with `persist` for `userStore`, `cartStore`, `addressStore`, `configStore`, and an optional `excelTaskStore` that caches task status locally for better UX.

Each page should read from the store or query hooks and render the corresponding components. The Empty State component must always expose a prominent button that routes to demand creation when a search yields no results. The Excel import flow must split confirmed and unconfirmed items and clearly show reasons for unconfirmed entries, using the `ImportResultTable` and `SkuConfirmPanel` components. The payment block must render a disabled or placeholder state when `paymentEnabled` is false.
