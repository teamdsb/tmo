# Complete miniapp routing and navigation loop

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries, Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds, and it must follow docs/execplans/PLANS.md.

## Purpose / Big Picture

This change makes routing and navigation work end to end in the miniapp. After completion, a user can switch among Home, Demand, Cart, Orders, and Mine using a shared Tabbar, and can click visible entry points (order actions, profile menu items, demand CTA) to land on real pages. Demand and cart business logic remain empty for now; the goal is routability and demonstrable navigation. Success is visible by running the miniapp, tapping the Tabbar and entry points, and confirming each target page renders without errors.

## Progress

- [x] (2026-01-23 17:47Z) Audit existing pages, entry points, and app.config to identify missing routes and placeholder pages.
- [x] (2026-01-23 17:47Z) Write the routing completion plan: route constants, navigation helpers, shared Tabbar, placeholders, app.config updates.
- [x] (2026-01-23 18:03Z) Implement routing completion: add placeholder pages, update apps/miniapp/src/app.config.ts, unify Tabbar, and add navigation handlers.
- [ ] (2026-01-23 18:03Z) Run lint and manual navigation verification (completed: eslint/stylelint/tsc; remaining: manual click-through in the miniapp).

## Surprises & Discoveries

None so far.

## Decision Log

Decision: The Demand tab does not point to the search page and uses a new placeholder page at pages/demand/index. Rationale: The user explicitly requested leaving Demand empty for now. Date/Author: 2026-01-23 / Codex.

Decision: Keep the existing pages/cart/index and do not introduce a new cart list page. Rationale: The user asked to leave the cart direction undecided at this stage. Date/Author: 2026-01-23 / Codex.

Decision: Keep the in-page Taroify Tabbar and do not enable the native tabBar in app.config. Rationale: The UI already embeds a Tabbar; enabling native tabBar would create a double bar and layout conflicts. A shared Tabbar component plus navigation helpers is sufficient for routing. Date/Author: 2026-01-23 / Codex.

## Outcomes & Retrospective

Not complete yet; manual navigation verification is still pending.

## Context and Orientation

The miniapp lives in apps/miniapp. Routing entry points are defined in apps/miniapp/src/app.config.ts under pages. Existing pages are in apps/miniapp/src/pages/**/index.tsx, and several pages already render a Taroify Tabbar with static icons. There is no central route constants module and no navigation helper, so routing is inconsistent. In this plan, routing completion means every entry point in the UI maps to a declared page in app.config.ts, placeholder pages exist for flows that are not yet implemented, and navigation uses a shared Tabbar and helper functions to avoid hardcoded paths.

## Plan of Work

First, add a route constants module at apps/miniapp/src/routes.ts to define page paths and helper functions for query parameters. This avoids spreading literal paths across pages.

Second, add navigation helpers at apps/miniapp/src/utils/navigation.ts to wrap Taro.navigateTo and Taro.reLaunch, and to avoid no-op navigation when the user taps the current route.

Third, add a shared Tabbar component at apps/miniapp/src/components/app-tabbar/index.tsx that renders the five tab entries and uses reLaunch for tab-like navigation. Update existing pages that already show a tabbar to use this shared component.

Fourth, add placeholder pages for missing destinations, such as Demand, Order Detail, Order Tracking, Address List, Settings, and similar entries exposed in the Mine page or order actions. Each placeholder should show a short message and a Back to Home action so navigation is demonstrable.

Fifth, update apps/miniapp/src/app.config.ts to include the new page paths. Keep the existing main pages order, and append new pages so routing resolves.

## Concrete Steps

From the repository root:

1) Create apps/miniapp/src/routes.ts with a ROUTES object and helpers like orderDetailRoute(id) and orderTrackingRoute(id).

2) Create apps/miniapp/src/utils/navigation.ts with navigateTo(url) and switchTabLike(url) wrapping Taro navigation.

3) Add apps/miniapp/src/components/app-tabbar/index.tsx and replace the in-page tabbars in apps/miniapp/src/pages/index/index.tsx, apps/miniapp/src/pages/cart/index.tsx, apps/miniapp/src/pages/order/list/index.tsx, apps/miniapp/src/pages/mine/index.tsx, and apps/miniapp/src/pages/goods/detail/index.tsx.

4) Add a placeholder page component at apps/miniapp/src/components/placeholder-page/index.tsx and create new pages at apps/miniapp/src/pages/demand/index.tsx, apps/miniapp/src/pages/demand/list/index.tsx, apps/miniapp/src/pages/demand/create/index.tsx, apps/miniapp/src/pages/order/detail/index.tsx, apps/miniapp/src/pages/order/tracking/index.tsx, apps/miniapp/src/pages/account/address/index.tsx, apps/miniapp/src/pages/import/index.tsx, apps/miniapp/src/pages/tracking/batch/index.tsx, apps/miniapp/src/pages/settings/index.tsx, and apps/miniapp/src/pages/support/index.tsx.

5) Update apps/miniapp/src/app.config.ts to include the new pages.

6) Run lint and do a manual click-through in the miniapp.

Expected lint transcript (abbreviated):

  > pnpm -C apps/miniapp run lint:types
  > tsc -p tsconfig.json --noEmit
  (no errors)

## Validation and Acceptance

Run pnpm run lint from the repository root and expect no errors. Start the miniapp, tap each Tabbar entry, and confirm each target page renders. Clicking Mine page menu items and order action buttons should navigate to placeholder pages that display their titles and a Back to Home button.

## Idempotence and Recovery

These changes are safe to re-run. If a navigation target fails, first verify the path exists in apps/miniapp/src/app.config.ts, then confirm the corresponding constant in apps/miniapp/src/routes.ts matches the file path.

## Artifacts and Notes

Keep small diffs for app.config.ts and routes.ts, plus one placeholder page example, as evidence of routing completion.

## Interfaces and Dependencies

Use Taro navigation APIs without adding new dependencies. The required interfaces are:

  apps/miniapp/src/routes.ts exports ROUTES and helper functions such as orderDetailRoute(id: string): string.

  apps/miniapp/src/utils/navigation.ts exports navigateTo(url: string) and switchTabLike(url: string).

  apps/miniapp/src/components/app-tabbar/index.tsx exports AppTabbar with signature AppTabbar({ value }: { value: 'home' | 'demand' | 'cart' | 'orders' | 'mine' }) and calls switchTabLike on change.

Change Notes:

2026-01-23 17:46Z Initial ExecPlan created for miniapp routing completion.

2026-01-23 18:03Z Progress updated to reflect implementation completion and lint status.
