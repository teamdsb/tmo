# Miniapp Image Ratio Optimization Design

## Goal

Improve the visual proportions shown in the cart and category screenshots without redesigning the app shell or replacing assets.

## Scope

- Cart empty state: reduce the oversized empty hero, keep the recommendation section visible earlier, and reserve enough scroll space above the fixed checkout bar and tab bar.
- Cart bottom bar: make the summary and actions fit in a stable, compact row on narrow phone widths.
- Category page: tighten the primary and secondary category controls, keep the empty-result panel closer to the active filters, and leave stable bottom safe-area padding.

## Approach

Use the existing Taro/React structure and adjust layout through the page styles already owning these areas:

- `apps/miniapp/src/app.scss` owns the cart empty state, cart recommendations, shared product card grid, and cart bottom bar.
- `apps/miniapp/src/pages/category/index.scss` owns the category page navigation, product grid, and empty state.

No new image assets are needed for option A. The current cart icon stays, but its container and typography are scaled down so the screenshot reads as an app screen rather than a hero landing page.

## Testing

Add stylesheet-focused regression assertions in existing Jest suites before changing styles:

- Cart tests assert the new compact empty-state, recommendation spacing, and bottom-bar sizing tokens.
- Category tests assert the tightened navigation and empty-state spacing tokens.

Run the targeted Jest files first, then the miniapp Jest suite or lint/type checks if time allows.
