# Miniapp Image Ratio Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve cart and category screen proportions to match the approved option A direction.

**Architecture:** Keep React components unchanged unless a class hook is missing. Use stylesheet-only layout changes in the files that already own cart and category page spacing.

**Tech Stack:** Taro, React, Sass, Jest, Testing Library.

---

### Task 1: Cart Ratio Regression Test

**Files:**
- Modify: `apps/miniapp/src/pages/cart/index.test.tsx`
- Read: `apps/miniapp/src/app.scss`

- [ ] **Step 1: Write the failing test**

Add a Jest test that reads `src/app.scss` and asserts the compact cart layout tokens:

```ts
it('keeps empty cart and bottom bar proportions compact', () => {
  const stylesheet = fs.readFileSync(path.resolve(__dirname, '../../app.scss'), 'utf8')

  expect(stylesheet).toContain('padding: 18rpx 24rpx calc(184rpx + env(safe-area-inset-bottom));')
  expect(stylesheet).toContain('padding: 28rpx 12rpx 22rpx;')
  expect(stylesheet).toContain('width: 220rpx;')
  expect(stylesheet).toContain('height: 220rpx;')
  expect(stylesheet).toContain('font-size: 44rpx;')
  expect(stylesheet).toContain('margin-top: 8rpx;')
  expect(stylesheet).toContain('min-height: 78rpx;')
  expect(stylesheet).toContain('font-size: 46rpx;')
  expect(stylesheet).toContain('min-width: 128rpx;')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C apps/miniapp test -- src/pages/cart/index.test.tsx --runInBand`

Expected: FAIL because the compact style tokens are not present yet.

### Task 2: Cart Ratio Implementation

**Files:**
- Modify: `apps/miniapp/src/app.scss`

- [ ] **Step 1: Implement the cart style changes**

Change the cart styles so empty-state vertical rhythm, recommendation spacing, and the fixed bottom bar fit the target phone proportions.

- [ ] **Step 2: Run cart test to verify it passes**

Run: `pnpm -C apps/miniapp test -- src/pages/cart/index.test.tsx --runInBand`

Expected: PASS.

- [ ] **Step 3: Commit**

Commit message: `fix(miniapp): balance empty cart proportions`

### Task 3: Category Ratio Regression Test

**Files:**
- Modify: `apps/miniapp/src/pages/category/index.test.tsx`
- Read: `apps/miniapp/src/pages/category/index.scss`

- [ ] **Step 1: Write the failing test**

Extend the existing stylesheet test with compact category spacing tokens:

```ts
expect(stylesheet).toContain('padding: 16px 16px 14px;')
expect(stylesheet).toContain('gap: 12px;')
expect(stylesheet).toContain('height: 36px;')
expect(stylesheet).toContain('padding: 14px 0 16px;')
expect(stylesheet).toContain('padding: 8px 12px calc(24px + var(--tabbar-safe-offset));')
expect(stylesheet).toContain('padding: 22px 12px 24px;')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -C apps/miniapp test -- src/pages/category/index.test.tsx --runInBand`

Expected: FAIL because the compact category tokens are not present yet.

### Task 4: Category Ratio Implementation

**Files:**
- Modify: `apps/miniapp/src/pages/category/index.scss`

- [ ] **Step 1: Implement the category style changes**

Tighten the category navigation, overview, grid, empty state, and bottom padding.

- [ ] **Step 2: Run category test to verify it passes**

Run: `pnpm -C apps/miniapp test -- src/pages/category/index.test.tsx --runInBand`

Expected: PASS.

- [ ] **Step 3: Commit**

Commit message: `fix(miniapp): balance category page proportions`

### Task 5: Final Verification

**Files:**
- Read: git diff and test output

- [ ] **Step 1: Run targeted tests**

Run: `pnpm -C apps/miniapp test -- src/pages/cart/index.test.tsx src/pages/category/index.test.tsx --runInBand`

Expected: PASS.

- [ ] **Step 2: Run style/type verification if available**

Run: `pnpm -C apps/miniapp lint:styles`

Expected: PASS.

- [ ] **Step 3: Review git history**

Run: `git log --oneline --decorate -4`

Expected: branch contains separate checkpoint commits for design, cart, and category work.
