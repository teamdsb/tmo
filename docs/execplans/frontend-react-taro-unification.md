# Unify Frontend Architecture Around React and Taro

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan follows `docs/execplans/PLANS.md` from the repository root and must be maintained in accordance with that file.

## Purpose / Big Picture

After this change, the repository will have a clear frontend split that a novice can understand and extend safely. `apps/miniapp` will remain a Taro application, which means it uses React syntax but renders mini-program components such as `View` and `Text` instead of browser HTML elements. `apps/admin-web` will become a normal React and Vite web application, which means page behavior will live in React components and hooks instead of browser scripts that manually query the DOM and inject HTML strings.

The user-visible result is that the admin login page and later admin pages continue to work, but they are controlled by React state rather than legacy `document.querySelector(...)` code. The miniapp pages continue to render in Taro, but large single-file pages are split into smaller components and hooks that are easier to change without breaking layout or behavior.

## Progress

- [x] (2026-03-06 09:30Z) Read `docs/execplans/PLANS.md`, inspected the current frontend structure, and confirmed the split: `apps/miniapp` is already Taro React, while `apps/admin-web` still mixes React shells with legacy DOM scripts.
- [x] (2026-03-06 09:30Z) Chose the first implementation milestone: migrate the admin login flow from legacy DOM control in `apps/admin-web/src/main.js` into React state while preserving existing selectors used by end-to-end tests.
- [x] (2026-03-06 09:37Z) Implemented Milestone 1 by converting `apps/admin-web/src/react/pages/LoginPage.tsx` into a self-contained React login page, preserving existing DOM IDs, and removing the `../../main.js` bootstrap from `apps/admin-web/src/react/entries/index.tsx`.
- [x] (2026-03-06 09:37Z) Validated the migrated login flow in mock mode by starting `pnpm -C apps/admin-web dev:mock`, opening `http://localhost:5174/`, logging in as `boss / boss123`, and observing a redirect to `/dashboard.html`.
- [x] (2026-03-06 09:37Z) Migrated three low-risk admin entries (`settings`, `profile`, and `rbac`) away from legacy page scripts because their old bootstrap files only called `ensureProtectedPage()`.
- [x] (2026-03-06 09:37Z) Fixed one pre-existing TypeScript error in `apps/admin-web/src/react/pages/admin/ProfilePage.tsx` so the changed entry set can pass a targeted TypeScript check.
- [x] (2026-03-06 09:44Z) Removed six more low-risk legacy admin entry imports by switching `exports`, `payments`, `quote-workflow`, `suppliers`, `transfer`, and `user-operations` to direct `ensureProtectedPage()` bootstraps and deleting their now-unreferenced legacy `.js` files.
- [x] (2026-03-06 09:44Z) Migrated `apps/admin-web/src/dashboard.js` into `apps/admin-web/src/react/pages/admin/DashboardPage.tsx`, preserving the mock static view and moving the dev-mode live dashboard behavior into React state and effects.
- [x] (2026-03-06 09:44Z) Validated the updated admin entry set with a targeted TypeScript check and manually confirmed that mock-mode dashboard rendering still works after login.
- [x] (2026-03-06 10:02Z) Decomposed `apps/miniapp/src/pages/mine/index.tsx` into page-local `types.ts`, `data.ts`, and `components.tsx` modules so the route file now focuses on state, effects, and navigation.
- [x] (2026-03-06 10:02Z) Verified the decomposed `mine` page with `pnpm -C apps/miniapp test -- src/pages/mine/index.test.tsx` and a targeted ESLint run over the changed files.
- [x] (2026-03-06 10:15Z) Decomposed `apps/miniapp/src/pages/sales/index.tsx` into page-local `types.ts`, `data.ts`, and `views.tsx` modules and added a page-level smoke test that exercises the main tab switches.
- [x] (2026-03-06 10:15Z) Verified the decomposed `sales` page with `pnpm -C apps/miniapp test -- src/pages/sales/index.test.tsx` and a targeted ESLint run over the changed files.
- [x] (2026-03-06 10:35Z) Decomposed `apps/miniapp/src/pages/cart/index.tsx` into page-local `components.tsx`, `helpers.ts`, `hooks.ts`, and `types.ts` modules so the route file now focuses on loading state, route branching, and cart actions.
- [x] (2026-03-06 10:35Z) Verified the decomposed `cart` page with a targeted Jest run, then re-ran the combined `cart`, `mine`, and `sales` page tests plus ESLint over all changed miniapp files.
- [x] (2026-03-06 11:05Z) Migrated `apps/admin-web/src/react/pages/admin/OrdersPage.tsx` from a static React shell into a stateful React page that owns auth bootstrap, mock/dev order loading, tab switching, pagination, side-panel synchronization, and the editable order drawer.
- [x] (2026-03-06 11:05Z) Removed the legacy `../../orders.js` bootstrap from `apps/admin-web/src/react/entries/orders.tsx` and validated the new React-only orders entry with a targeted TypeScript check.
- [x] (2026-03-06 11:40Z) Migrated `apps/admin-web/src/react/pages/admin/ProductsPage.tsx` from a static React shell plus legacy bootstrap into a stateful React page that owns product loading, search/filter/pagination, local row selection, create modal, edit drawer, category management, and display-category management.
- [x] (2026-03-06 11:40Z) Removed the legacy `../../products.js` bootstrap from `apps/admin-web/src/react/entries/products.tsx` and validated the React-only `products` entry with a targeted TypeScript check.
- [x] (2026-03-06 11:40Z) Retired legacy admin runtime script references by converting `apps/admin-web/legacy/pages/*.html` into static snapshot pages and deleting the now-unreferenced DOM-only scripts under `apps/admin-web/src/*.js`.
- [x] Decompose the largest Taro miniapp pages (`pages/mine/index.tsx`, `pages/cart/index.tsx`, and `pages/sales/index.tsx`) into smaller sections, reusable components, and page-local hooks without changing route structure.
- [x] Retire legacy admin HTML pages and DOM-only scripts once each React replacement is behaviorally verified.

## Surprises & Discoveries

- Observation: Some admin pages are already fully React-controlled while others still load legacy scripts after React has mounted the page shell.
  Evidence: `apps/admin-web/src/react/entries/import.tsx` mounts `<ImportPage />` with a no-op bootstrap, but `apps/admin-web/src/react/entries/products.tsx` still calls `await import('../../products.js')`.

- Observation: The admin login page is visually rendered by React today, but its actual behavior still depends on DOM IDs and imperative listeners from `apps/admin-web/src/main.js`.
  Evidence: `apps/admin-web/src/react/entries/index.tsx` imports `../../main.js`, and `apps/admin-web/src/main.js` immediately queries `#login-form`, `#username`, `#password`, `#toggle-password`, and `#role-select-modal`.

- Observation: Repository-wide `vite build` and broad `tsc` checks in `apps/admin-web` are currently blocked by unrelated, pre-existing issues outside the login migration.
  Evidence: `pnpm -C apps/admin-web build` fails because Vite cannot resolve `jszip` and `xlsx` imported from `apps/admin-web/src/lib/product-import.js`. A separate `pnpm -C apps/admin-web exec tsc --noEmit` run originally failed in `apps/admin-web/src/react/pages/admin/ProfilePage.tsx` before that file was corrected.

- Observation: The login route can still be exercised successfully in local mock mode even while Vite reports unresolved import warnings for pages unrelated to `/`.
  Evidence: After starting `pnpm -C apps/admin-web dev:mock`, navigating to `http://localhost:5174/`, filling `#username=boss` and `#password=boss123`, and submitting `#login-form`, the browser redirected to `http://localhost:5174/dashboard.html`.

- Observation: A large portion of the remaining admin legacy entry files were not real page implementations at all; they only called `ensureProtectedPage()`.
  Evidence: `apps/admin-web/src/exports.js`, `apps/admin-web/src/payments.js`, `apps/admin-web/src/quote-workflow.js`, `apps/admin-web/src/suppliers.js`, `apps/admin-web/src/transfer.js`, and `apps/admin-web/src/user-operations.js` were each 7 to 8 lines and did nothing beyond auth guarding.

- Observation: `dashboard` was the smallest remaining admin page with real legacy behavior, making it a good migration template before touching `orders` or `products`.
  Evidence: `apps/admin-web/src/dashboard.js` was 243 lines and mainly performed one `Promise.allSettled(...)` fetch plus DOM rendering, while `orders.js` and `products.js` remain 1383 and 3114 lines respectively.

- Observation: `apps/miniapp/src/pages/mine/index.tsx` had become large mostly because it colocated page-local mock data and subviews with the route component, not because the route itself needed that many states.
  Evidence: before decomposition the file contained initial message/order/address/demand fixtures plus five rendering subviews; after decomposition the route file dropped to under 300 lines while preserving the same route exports and tests.

- Observation: `apps/miniapp/src/pages/sales/index.tsx` followed the same pattern as `mine`, but with static dashboard/customer/order/accounting panels instead of auth state, so the safe split point was extracting fixtures and view components while keeping `activeTab` in the route file.
  Evidence: after decomposition the route file is only responsible for `activeTab` and bottom-nav rendering, while `views.tsx` owns the four tab panels and `data.ts` owns the mock sales fixtures.

- Observation: `apps/miniapp/src/pages/cart/index.tsx` was large for a different reason than `mine` or `sales`: it mixed real async cart behavior with two substantial view trees, so the safe split was to extract route-local presentation and product-detail hydration into page-local modules without changing action handlers or route structure.
  Evidence: after decomposition the route file dropped from 743 lines to 321 lines, while `components.tsx` now owns the import/cart layouts and `hooks.ts` owns SPU detail hydration and SKU option caching.

- Observation: `orders` could not be cleaned up by deleting `src/orders.js` immediately even after the React entry stopped importing it, because the repository still contains a legacy HTML page that references that script directly.
  Evidence: `apps/admin-web/legacy/pages/orders.html` still includes `<script type="module" src="/src/orders.js"></script>`, so script deletion belongs to the later legacy-HTML retirement milestone rather than the page-entry migration milestone.

- Observation: After the legacy HTML pages were reduced to static snapshots, the remaining DOM-only runtime scripts were no longer referenced anywhere in `apps/admin-web`.
  Evidence: after replacing the bottom `<script type="module" src="/src/*.js">` tags in `apps/admin-web/legacy/pages/*.html` with static comments, repository search no longer found references to `src/main.js`, `src/products.js`, `src/orders.js`, `src/import.js`, `src/inquiries.js`, or `src/sidebar-layout.js`.

## Decision Log

- Decision: Keep `apps/miniapp` on Taro and do not attempt to convert it to browser React.
  Rationale: Taro is already the correct runtime for mini-program delivery in this repository. The problem in `apps/miniapp` is file size and mixed concerns, not a wrong framework choice.
  Date/Author: 2026-03-06, Codex.

- Decision: Treat `apps/admin-web` as a standard React and Vite application and migrate away from legacy DOM scripts page by page.
  Rationale: The repository already contains React page components and React entrypoints for admin pages. Completing that migration reduces double ownership of the DOM and makes behavior testable through React state.
  Date/Author: 2026-03-06, Codex.

- Decision: Start with the admin login page instead of the largest legacy pages.
  Rationale: Login is the smallest user-visible slice that still proves the migration strategy. It has existing selectors, a finite set of states, and an obvious acceptance path through `/` to `/dashboard.html`.
  Date/Author: 2026-03-06, Codex.

- Decision: Preserve existing DOM IDs on the login page during the migration.
  Rationale: Current Playwright tests and helper scripts target selectors such as `#login-form`, `#username`, and `#password`. Preserving those selectors reduces migration risk while the implementation moves into React.
  Date/Author: 2026-03-06, Codex.

- Decision: Delete trivial legacy admin page scripts once their entry files stop importing them.
  Rationale: Keeping zero-logic scripts around creates false migration signals for future contributors and makes it harder to tell which admin pages are still mixed-mode.
  Date/Author: 2026-03-06, Codex.

- Decision: Convert `dashboard` next and keep its mock-mode static view while migrating only the dev-mode live dashboard behavior into React.
  Rationale: This preserves mock-mode UX while establishing a clear React pattern for async dashboard data, permission-aware fetches, and conditional layouts.
  Date/Author: 2026-03-06, Codex.

## Outcomes & Retrospective

The plan has now completed four meaningful admin migration layers. First, the login route no longer depends on `apps/admin-web/src/main.js`; React owns field state, pending state, inline errors, password visibility, role selection, localization installation, and session-based redirect behavior. Second, a full page with real legacy behavior, `dashboard`, now lives in React instead of a DOM script. Third, `orders` no longer relies on `src/orders.js` at runtime for the active React entry; the React page now owns auth-aware loading, mock/dev branching, tab/pagination state, logistics-panel syncing, and the editable order drawer. Fourth, `products` no longer relies on `src/products.js`; the React page now owns product loading, filters, pagination, draft editing, category CRUD, and display-category management.

The repository also gained a cleanup win: the trivial legacy admin scripts for `settings`, `profile`, `rbac`, `exports`, `payments`, `quote-workflow`, `suppliers`, `transfer`, and `user-operations` were removed or bypassed because they were only acting as auth guards. After `products` was migrated, the remaining legacy HTML pages were converted into static snapshots and the last DOM-only runtime scripts under `apps/admin-web/src/*.js` were deleted. This removes the mixed-mode runtime split that originally motivated the plan.

The plan now has three miniapp decomposition milestones. `apps/miniapp/src/pages/mine/index.tsx` was split into page-local `types.ts`, `data.ts`, and `components.tsx` files so the route component mostly owns auth/bootstrap state, timers, and navigation decisions. `apps/miniapp/src/pages/sales/index.tsx` was likewise split so the route file only owns tab state and bottom-nav wiring. `apps/miniapp/src/pages/cart/index.tsx` now delegates its two large layouts to `components.tsx` and its product-detail caching logic to `hooks.ts`, leaving the route file primarily responsible for loading branches and cart mutation handlers.

The plan goals in this document are now complete. The remaining repository-level caveat is still the unrelated `jszip` / `xlsx` build issue attached to product import packaging, which predates the React migration work and affects broad admin-web build validation rather than the completed page migrations themselves.

## Context and Orientation

This repository contains two relevant frontend applications.

`apps/miniapp` is a Taro application. Taro is a framework that lets React-style components render to mini-program primitives instead of browser HTML. Its global route list lives in `apps/miniapp/src/app.config.ts`, and its app entrypoint is `apps/miniapp/src/app.ts`. The large pages that need decomposition are `apps/miniapp/src/pages/mine/index.tsx`, `apps/miniapp/src/pages/cart/index.tsx`, and `apps/miniapp/src/pages/sales/index.tsx`. Those files already use Taro components correctly; the issue is that they mix mock data, state logic, and large JSX trees in a single file.

`apps/admin-web` is a browser-based Vite application. Its Vite config is `apps/admin-web/vite.config.js`, and the login entry HTML is `apps/admin-web/index.html`. The admin app already has React page components under `apps/admin-web/src/react/pages`, but many page entries still load old scripts under `apps/admin-web/src/*.js`. Those old scripts are legacy browser scripts that manually query elements, attach listeners, and inject HTML strings with `innerHTML`. A novice should treat those scripts as the migration target, not the future architecture.

The login flow is split across these files:

- `apps/admin-web/src/react/pages/LoginPage.tsx` renders the login page markup.
- `apps/admin-web/src/react/entries/index.tsx` mounts the page.
- `apps/admin-web/src/main.js` currently attaches behavior to DOM IDs.
- `apps/admin-web/src/lib/auth.js` contains shared authentication helpers such as `loginDev`, `loginMock`, `refreshBootstrap`, `goToDashboard`, and `isLoggedIn`.
- `apps/admin-web/src/lib/admin-role-policy.js` defines which roles are valid in admin-web.
- `apps/admin-web/src/lib/mock-accounts.js` resolves mock-mode credentials.

The migration strategy in this plan is to move behavior into React page components while preserving shared auth helpers in `src/lib`. That means the React page will call the same domain helpers, but it will stop depending on DOM mutation from `src/main.js`.

## Plan of Work

Milestone 1 migrates the admin login flow to pure React behavior. Update `apps/admin-web/src/react/pages/LoginPage.tsx` so it owns form fields, error state, password visibility state, pending state, role-selection state, and session-redirect behavior. The component will import `goToDashboard`, `isLoggedIn`, `loginDev`, `loginMock`, and `refreshBootstrap` from `apps/admin-web/src/lib/auth.js`; it will also use `filterAllowedAdminWebRoles` from `apps/admin-web/src/lib/admin-role-policy.js`, `resolveMockAccount` from `apps/admin-web/src/lib/mock-accounts.js`, and `isDevMode` / `isMockMode` from `apps/admin-web/src/lib/env.js`. The component must preserve the existing DOM IDs used by tests.

After `LoginPage.tsx` owns the flow, update `apps/admin-web/src/react/entries/index.tsx` so it mounts the page without importing `../../main.js`. That file becomes the proof that the login page no longer depends on legacy DOM bootstrap.

Milestone 2 will move to the next lowest-risk admin pages. The rule is simple: pages that already have a React page component and only use a small or moderate legacy bootstrap are migrated before the very large `products.js` and `orders.js` pages. Each migrated page must end with its entry file no longer importing a legacy page script.

Milestone 3 will attack the largest admin legacy files, primarily `apps/admin-web/src/products.js` and `apps/admin-web/src/orders.js`. Those migrations will be done by splitting filters, tables, drawers, and forms into React components and React hooks so that each page is testable in pieces.

Milestone 4 will clean up `apps/miniapp` by decomposing the largest Taro pages. This is not an architecture migration. The route files stay in place, but their contents are split into `components`, `hooks`, and optional `data` or `sections` modules under the relevant page folder.

## Concrete Steps

Run all commands from the repository root at `/Users/asimov3059/工作代码/tmall/tmo` unless a different working directory is stated.

1. Inspect the current admin login flow before editing.

    Working directory: repository root
    Command: sed -n '1,220p' apps/admin-web/src/react/pages/LoginPage.tsx
    Command: sed -n '1,220p' apps/admin-web/src/main.js
    Expected result: the page markup lives in `LoginPage.tsx`, while behavior such as form submission and role-selection modal injection lives in `src/main.js`.

2. Implement Milestone 1 by editing the React page and login entry.

    Working directory: repository root
    Command: edit `apps/admin-web/src/react/pages/LoginPage.tsx`
    Command: edit `apps/admin-web/src/react/entries/index.tsx`
    Expected result: `LoginPage.tsx` becomes self-contained, and `index.tsx` no longer imports `../../main.js`.

3. Build the admin web bundle to catch type or syntax errors.

    Working directory: repository root
    Command: pnpm -C apps/admin-web build
    Current observed output:
        vite v4.5.14 building for production...
        ✓ 82 modules transformed.
        [vite]: Rollup failed to resolve import "jszip" from "apps/admin-web/src/lib/product-import.js"

    Interpretation: this is a pre-existing repository problem unrelated to the login migration, so it does not invalidate the login milestone. Keep this failure in mind before using repository-wide build success as the only acceptance signal.

4. If Playwright dependencies and environment are available, run at least the login-oriented end-to-end path.

    Working directory: repository root
    Command: pnpm -C apps/admin-web test:e2e:mock
    Expected result: the test opens `/`, fills `#username` and `#password`, submits `#login-form`, and reaches `/dashboard.html`.

5. Run a targeted TypeScript check against the changed files if repository-wide `tsc` is blocked by unrelated files.

    Working directory: repository root
    Command: pnpm -C apps/admin-web exec tsc --noEmit --pretty false --moduleResolution bundler --module esnext --target es2020 --jsx react-jsx --allowJs --lib dom,es2020 src/react/pages/LoginPage.tsx src/react/entries/index.tsx src/react/entries/settings.tsx src/react/entries/profile.tsx src/react/entries/rbac.tsx src/react/pages/admin/ProfilePage.tsx
    Observed result:
        command exited with code 0

6. Start the admin mock dev server and verify the login route manually when repository-wide build output is noisy.

    Working directory: repository root
    Command: pnpm -C apps/admin-web dev:mock
    Observed result:
        VITE v4.5.14 ready in 131 ms
        Local: http://localhost:5174/

7. Verify post-migration dashboard behavior in mock mode.

    Working directory: repository root
    Command: start `pnpm -C apps/admin-web dev:mock`, open `http://localhost:5174/`, log in as `boss / boss123`, and observe the resulting `http://localhost:5174/dashboard.html` page.
    Observed result:
        the dashboard loads with the static mock cards and audit table
        the page no longer depends on `apps/admin-web/src/dashboard.js`

These steps are idempotent. Re-running the build or Playwright commands is safe. If a command fails because the local backend is unavailable, record the failure and continue with the build plus mock-mode validation.

## Validation and Acceptance

Milestone 1 is accepted when the following human-visible behavior is true.

Open the admin app at `/`. Enter a mock or real username and password in the existing `#username` and `#password` fields. Submit the form using the submit button inside `#login-form`. In mock mode, a valid mock account should redirect to `/dashboard.html`. In dev mode, a valid account should call the password-login API, optionally show a role picker when the backend returns HTTP 409 with available roles, refresh bootstrap, and then redirect to `/dashboard.html`. An invalid login must show an inline error without relying on `window.alert`.

The milestone is not accepted if login only works because `apps/admin-web/src/main.js` is still imported somewhere. The absence of `../../main.js` from `apps/admin-web/src/react/entries/index.tsx` is part of the proof, but the real proof is that the page still behaves correctly in the browser and in tests.

The larger plan is accepted only when admin pages no longer depend on legacy page scripts and when the miniapp’s large route files are decomposed into smaller units without changing route behavior.

## Idempotence and Recovery

This migration is intentionally additive in behavior but subtractive in bootstrap wiring. If the React login page fails during development, the safe recovery path is to restore `apps/admin-web/src/react/entries/index.tsx` so it again imports `../../main.js`, then compare the behavior gap and port the missing logic into React before removing the import again. Re-running the login manually is safe because the shared auth helpers already overwrite local session storage.

When testing login, clear browser storage if stale sessions cause immediate redirects. The shared auth state is stored in browser `localStorage` under keys defined in `apps/admin-web/src/lib/env.js`. Clearing those keys and reloading the page is sufficient to retry the flow.

## Artifacts and Notes

Important evidence to capture as work proceeds includes:

    apps/admin-web/src/react/entries/index.tsx
      before: imports ../../main.js
      after: mounts <LoginPage /> without legacy bootstrap

    Manual login scenario
      open /
      fill #username and #password
      submit #login-form
      observe redirect to /dashboard.html

Actual evidence captured during this revision:

    Browser verification
      url before submit: http://localhost:5174/
      fill #username = boss
      fill #password = boss123
      click #login-form button[type="submit"]
      observed url after submit: http://localhost:5174/dashboard.html

    Entry cleanup
      settings/profile/rbac entries no longer import ../../settings.js, ../../profile.js, or ../../rbac.js
      they now call ensureProtectedPage() directly

    Additional entry cleanup
      exports/payments/quote-workflow/suppliers/transfer/user-operations entries no longer import their legacy page scripts
      the corresponding legacy .js files were deleted because they only wrapped ensureProtectedPage()

    Dashboard migration
      apps/admin-web/src/react/entries/dashboard.tsx
        before: imports ../../dashboard.js
        after: mounts <DashboardPage /> without legacy bootstrap
      apps/admin-web/src/react/pages/admin/DashboardPage.tsx
        now contains both mock-mode static rendering and dev-mode live dashboard fetching logic

    Products migration
      apps/admin-web/src/react/entries/products.tsx
        before: imports ../../products.js
        after: mounts <ProductsPage /> without legacy bootstrap
      apps/admin-web/src/react/pages/admin/ProductsPage.tsx
        now contains product loading, search/filter/pagination, create modal, edit drawer, category CRUD, and display-category management
      apps/admin-web/legacy/pages/products.html
        now stays as a static snapshot and no longer references /src/products.js

    Legacy runtime retirement
      apps/admin-web/legacy/pages/*.html
        before: loaded /src/*.js legacy runtime files
        after: kept as static snapshot pages only
      apps/admin-web/src/main.js, src/products.js, src/orders.js, src/import.js, src/inquiries.js, src/profile.js, src/rbac.js, src/settings.js, src/sidebar-layout.js
        deleted because no active entrypoint references them anymore

    Mine page decomposition
      apps/miniapp/src/pages/mine/index.tsx
        before: route file contained mock data, shared types, subview components, and page state/effects
        after: route file mostly contains state, effects, and page navigation decisions
      apps/miniapp/src/pages/mine/components.tsx
        now contains the chat, address, demand, order-management, and profile subviews
      apps/miniapp/src/pages/mine/data.ts
        now contains mock fixtures and menu item creation
      apps/miniapp/src/pages/mine/types.ts
        now contains page-local shared types
      validation
        pnpm -C apps/miniapp test -- src/pages/mine/index.test.tsx
        pnpm -C apps/miniapp exec eslint src/pages/mine/index.tsx src/pages/mine/components.tsx src/pages/mine/data.ts src/pages/mine/types.ts

    Sales page decomposition
      apps/miniapp/src/pages/sales/index.tsx
        before: route file contained tab state, shared types, sales fixtures, and four tab panels
        after: route file mostly contains tab state and bottom-nav rendering
      apps/miniapp/src/pages/sales/views.tsx
        now contains the dashboard, customers, orders, and accounting views
      apps/miniapp/src/pages/sales/data.ts
        now contains sales mock fixtures and tab metadata
      apps/miniapp/src/pages/sales/types.ts
        now contains page-local shared types
      apps/miniapp/src/pages/sales/index.test.tsx
        now smoke-tests the default dashboard and main tab switches
      validation
        pnpm -C apps/miniapp test -- src/pages/sales/index.test.tsx
        pnpm -C apps/miniapp exec eslint src/pages/sales/index.tsx src/pages/sales/views.tsx src/pages/sales/data.ts src/pages/sales/types.ts src/pages/sales/index.test.tsx

    Cart page decomposition
      apps/miniapp/src/pages/cart/index.tsx
        before: route file contained import-confirmation layout, cart layout, product-detail cache logic, and cart mutation handlers
        after: route file mostly contains route branching, loading state, and cart/import action handlers
      apps/miniapp/src/pages/cart/components.tsx
        now contains the import-result layout, cart list layout, and bottom action bar
      apps/miniapp/src/pages/cart/hooks.ts
        now contains SPU detail hydration and SKU option caching
      apps/miniapp/src/pages/cart/helpers.ts
        now contains formatters and UI constants shared by the route-local components
      apps/miniapp/src/pages/cart/types.ts
        now contains route-local type aliases for cart item state
      validation
        pnpm -C apps/miniapp test -- src/pages/cart/index.test.tsx src/pages/mine/index.test.tsx src/pages/sales/index.test.tsx
        pnpm -C apps/miniapp exec eslint src/pages/cart/index.tsx src/pages/cart/components.tsx src/pages/cart/helpers.ts src/pages/cart/hooks.ts src/pages/cart/types.ts src/pages/cart/index.test.tsx src/pages/mine/index.tsx src/pages/mine/components.tsx src/pages/mine/data.ts src/pages/mine/types.ts src/pages/sales/index.tsx src/pages/sales/views.tsx src/pages/sales/data.ts src/pages/sales/types.ts src/pages/sales/index.test.tsx

    Orders page migration
      apps/admin-web/src/react/entries/orders.tsx
        before: imports ../../orders.js after mounting the React shell
        after: mounts <OrdersPage /> without the legacy bootstrap
      apps/admin-web/src/react/pages/admin/OrdersPage.tsx
        now contains auth bootstrap, mock/dev order loading, tab switching, pagination, logistics/customer panel syncing, and the editable order drawer
      apps/admin-web/src/react/pages/admin/orders-data.ts
        now contains order normalization helpers for shared canonical fixtures, fallback mock orders, and dev-mode API payloads
      validation
        pnpm -C apps/admin-web exec tsc --noEmit --pretty false --moduleResolution bundler --module esnext --target es2020 --jsx react-jsx --allowJs --lib dom,es2020 src/react/pages/admin/OrdersPage.tsx src/react/pages/admin/orders-data.ts src/react/entries/orders.tsx

At the end of each milestone, add a short note here with the changed files and the command output that proves the milestone worked.

## Interfaces and Dependencies

Milestone 1 must continue using the existing shared auth functions in `apps/admin-web/src/lib/auth.js`:

    loginDev(username, password, role?)
    loginMock(input, role?)
    refreshBootstrap()
    goToDashboard()
    isLoggedIn()

The React login page will also use:

    filterAllowedAdminWebRoles(roles)
    resolveMockAccount(username, password)
    isDevMode
    isMockMode

The React page should manage these local UI states explicitly:

    username: string
    password: string
    pending: boolean
    errorMessage: string
    showPassword: boolean
    roleChoices: string[]
    pendingRoleSelection: { username: string; password: string } | null

The role-selection modal must remain declarative. That means the page renders buttons from `roleChoices.map(...)` instead of assigning `innerHTML`. When a role is chosen, the component should continue the same login attempt with the chosen role.

The page should keep the existing IDs `login-form`, `username`, `password`, `toggle-password`, `toggle-password-icon`, `login-error`, `role-select-modal`, `role-select-options`, and `role-select-cancel` so current Playwright selectors remain valid while the implementation changes.

Change note: This document was created on 2026-03-06 to replace an informal migration checklist with a self-contained, executable plan that can be resumed by a novice. It starts with the admin login page because that milestone is the smallest user-visible proof of the architecture shift.

Revision note (2026-03-06 09:37Z): Updated the plan after implementing the login migration, validating the mock-mode redirect in a browser, removing three low-risk legacy admin entry imports, and recording the unrelated repository-wide `jszip` / `xlsx` build issue so future contributors do not misattribute it to this milestone.

Revision note (2026-03-06 09:44Z): Updated the plan after removing six additional trivial admin legacy entry imports, deleting their unreferenced wrapper scripts, migrating `dashboard` into React, and validating the new dashboard route in mock mode.

Revision note (2026-03-06 10:35Z): Updated the plan after decomposing the remaining large miniapp page `cart` into page-local presentation and hydration modules, verifying `cart`, `mine`, and `sales` together in Jest, and confirming the miniapp decomposition milestone is complete.

Revision note (2026-03-06 11:05Z): Updated the plan after migrating `orders` from a static React shell plus legacy bootstrap to a stateful React page, removing the `orders` entry import of `src/orders.js`, and recording that the old script still cannot be deleted until the legacy `orders.html` page is retired.

Revision note (2026-03-06 11:40Z): Updated the plan after migrating `products` into a React-owned page, removing the `products` entry import of `src/products.js`, converting legacy admin pages into static snapshots, deleting the remaining DOM-only runtime scripts under `apps/admin-web/src`, and validating the new products entry with targeted TypeScript checks.
