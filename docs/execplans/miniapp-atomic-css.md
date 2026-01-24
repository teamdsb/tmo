# Miniapp Atomic CSS Integration

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `docs/execplans/PLANS.md` from the repository root.

## Purpose / Big Picture

After this change, the miniapp can use an atomic CSS framework (Tailwind CSS) by applying utility classes directly in React JSX, and those classes render correctly in WeChat miniapp and H5 builds. A small, visible utility-class change in the UI demonstrates the integration without breaking existing Taroify styling.

## Progress

- [x] (2026-01-24 07:39Z) Reviewed the current miniapp CSS stack and build configuration, confirmed no atomic CSS framework is installed, and drafted this plan.
- [ ] Add Tailwind CSS dependencies and configuration files in `apps/miniapp` (completed: `tailwind.config.cjs`, `postcss.config.cjs`, `package.json` updates; remaining: install deps and update `pnpm-lock.yaml`).
- [ ] Wire Tailwind into PostCSS and the global stylesheet while preserving existing Taroify styling (completed: `@tailwind` directives in `app.scss`; remaining: ensure Taro uses `tailwindcss` plugin for mini and h5 builds).
- [x] (2026-01-24 08:20Z) Add Tailwind plugin config to `apps/miniapp/config/index.ts` for mini and h5 builds with an explicit config path.
- [x] (2026-01-24 07:59Z) Resolve stylelint class naming and specificity issues by renaming page modifier classes and reordering `.page-search`.
- [x] (2026-01-24 08:26Z) Replace the smoke-test utility class using an arbitrary value (`text-[12px]`) with a WXSS-safe class to avoid escaped selectors.
- [x] (2026-01-24 08:28Z) Remove the remaining arbitrary color class in the Mine page (`bg-[#f7f8fa]`) to avoid escaped selectors in WXSS.
- [x] (2026-01-24 08:31Z) Exclude test files from Tailwind content scanning to prevent arbitrary-value utilities from leaking into WXSS output.
- [ ] Add a small utility-class smoke test in a placeholder view and verify WeChat miniapp + H5 builds (completed: smoke test added; remaining: build verification).
- [ ] Update miniapp documentation and run lint/build validation (completed: README updated; lint passed; remaining: successful build:weapp/build:h5).

## Surprises & Discoveries

- Observation: `pnpm add` could not reach the registry and also reported a store-location mismatch.
  Evidence: `ERR_PNPM_UNEXPECTED_STORE` and `getaddrinfo ENOTFOUND registry.npmjs.org`.
- Observation: writing a global pnpm config failed due to permissions.
  Evidence: `EPERM: operation not permitted, mkdir '/Users/asimov3059/Library/Preferences/pnpm'`.
- Observation: `taro build --type weapp` panicked in a Rust dependency.
  Evidence: `system-configuration-0.5.1 ... Attempted to create a NULL object.`
- Observation: WeChat devtools reported a WXSS parse error because `@tailwind` directives leaked into `app-origin.wxss`.
  Evidence: `unexpected token ';'` and `app-origin.wxss` contains `@tailwind base;@tailwind components;@tailwind utilities;`.
- Observation: WXSS parsing fails on escaped selectors produced by Tailwind arbitrary value utilities.
  Evidence: `unexpected '\\'` and `app-origin.wxss` contains `.text-\\[12px\\]`.
- Observation: Tailwind content scanning included test files, generating escaped selectors like `.text-\\[\\#137fec\\]`.
  Evidence: `app-origin.wxss` contains `.text-\\[\\#137fec\\]`, and the class appears only in `*.test.tsx`.

## Decision Log

- Decision: Use Tailwind CSS as the atomic CSS framework and disable Tailwind preflight (global resets).
  Rationale: Tailwind is well-known and integrates through PostCSS; disabling preflight reduces the risk of overriding existing Taroify and custom styles.
  Date/Author: 2026-01-24, Codex
- Decision: Proceed with Tailwind config and code changes even though dependency installation is blocked by registry access.
  Rationale: The integration can be staged in code and completed once dependencies can be installed.
  Date/Author: 2026-01-24, Codex
- Decision: Rename `.page--home`/`.page--compact-navbar` to `.page-home`/`.page-compact-navbar` and reorder `.page-search`.
  Rationale: Stylelint treats `--` as non-kebab-case and flagged descending specificity; renaming and reordering keeps lint passing without changing behavior.
  Date/Author: 2026-01-24, Codex
- Decision: Configure Tailwind in `apps/miniapp/config/index.ts` instead of relying solely on `postcss.config.cjs`.
  Rationale: The Vite runner’s mini/h5 pipeline builds PostCSS plugins from Taro config; without this, `@tailwind` directives leak into WXSS.
  Date/Author: 2026-01-24, Codex
- Decision: Avoid Tailwind arbitrary value utilities in WXSS outputs.
  Rationale: WXSS parser does not accept the escaped selector form (e.g. `.text-\\[12px\\]`).
  Date/Author: 2026-01-24, Codex
- Decision: Exclude `*.test.*` and `__tests__` from Tailwind content scanning.
  Rationale: Tests should not influence production CSS generation and can introduce unsupported escaped selectors.
  Date/Author: 2026-01-24, Codex

## Outcomes & Retrospective

Partial outcome: Tailwind config files are in place, `@tailwind` directives are added, Taro config now includes the Tailwind plugin, a utility-class smoke test is present, and README guidance is updated. Lint passes. Dependency installation and build validation are still pending due to registry access errors and a build-time panic.

## Context and Orientation

The miniapp lives in `apps/miniapp` and uses Taro with React and the Vite compiler, configured in `apps/miniapp/config/index.ts`. Global styles are in `apps/miniapp/src/app.scss`, imported by `apps/miniapp/src/app.ts`. UI widgets come from Taroify, and its base CSS is imported at the top of `apps/miniapp/src/app.scss`. Linting for styles is controlled by `apps/miniapp/stylelint.config.mjs`, which currently allows only standard CSS at-rules. There is no Tailwind configuration or PostCSS plugin configuration in the miniapp today.

In this plan, “atomic CSS framework” means a utility-first stylesheet where small, single-purpose classes like `px-4` or `text-sm` are applied directly in JSX to compose a UI.

## Plan of Work

Add Tailwind CSS to the miniapp as a dev dependency, configure it with a `tailwind.config.cjs` that scans the `src` tree, and enable it through both the Taro config (for mini/h5 builds) and a `postcss.config.cjs` (for Vite defaults) so builds process the `@tailwind` directives. Update `apps/miniapp/src/app.scss` to include Tailwind’s base/components/utilities after the Taroify imports, keeping existing custom SCSS intact. Update Stylelint to ignore Tailwind-specific at-rules. Add a small utility-class smoke test in the placeholder page so the integration is visibly verifiable. Update `apps/miniapp/README.md` to document where Tailwind is configured and how to apply utilities alongside existing SCSS. Keep class names in `app.scss` single-hyphen (for example, `page-home`) and ensure `.page-search` is declared before page-specific overrides to satisfy stylelint.

## Concrete Steps

1) Add Tailwind dependencies from the repository root:

    pnpm -C apps/miniapp add -D tailwindcss postcss autoprefixer

   If pnpm reports an "Unexpected store location", rerun with `pnpm --store-dir <path from the error>` or run `pnpm install` once to relink `node_modules`, then retry.

2) Create `apps/miniapp/tailwind.config.cjs` with a minimal configuration and preflight disabled:

    module.exports = {
      content: ["./src/**/*.{ts,tsx,js,jsx}", "./index.html"],
      theme: {
        extend: {},
      },
      corePlugins: {
        preflight: false,
      },
    }

3) Create `apps/miniapp/postcss.config.cjs` so Vite and the Taro pipeline use Tailwind:

    module.exports = {
      plugins: {
        tailwindcss: {},
        autoprefixer: {},
      },
    }

4) Update `apps/miniapp/stylelint.config.mjs` to allow Tailwind at-rules:

    export default {
      extends: "stylelint-config-standard",
      rules: {
        "at-rule-no-unknown": [
          true,
          {
            ignoreAtRules: ["tailwind", "apply", "layer", "variants", "responsive", "screen"],
          },
        ],
      },
    };

5) Update `apps/miniapp/src/app.scss` to insert Tailwind directives after the Taroify imports:

    @import url("@taroify/core/index.css");
    @import url("@taroify/icons/index.css");

    @tailwind base;
    @tailwind components;
    @tailwind utilities;

    ...keep existing styles below...

6) Add a visible smoke test by applying a Tailwind utility class in `apps/miniapp/src/components/placeholder-page/index.tsx`. For example, add a small `View` with a label and `className="text-sm text-blue-600"` so the color and font size are obviously controlled by Tailwind.

7) Update `apps/miniapp/config/index.ts` to add a `tailwindcss` entry in both `mini.postcss` and `h5.postcss`, with `config` pointing to `apps/miniapp/tailwind.config.cjs`.

8) Update `apps/miniapp/README.md` with a short section explaining that Tailwind is enabled, which config files control it, and how to add new utilities safely.

## Validation and Acceptance

Current status: `pnpm -C apps/miniapp lint` passes. `pnpm -C apps/miniapp build:weapp` failed with a `system-configuration` panic, and `build:h5` has not been run yet. WeChat devtools reported a WXSS parse error because Tailwind was not executed in the build.

Run lint and confirm it passes:

    pnpm -C apps/miniapp lint

Build both miniapp and H5 outputs to confirm Tailwind is processed:

    pnpm -C apps/miniapp build:weapp
    pnpm -C apps/miniapp build:h5

Open the WeChat miniapp build in the developer tool and confirm the placeholder view shows the Tailwind-styled label (blue text, small font size). The existing Taroify UI should remain visually unchanged beyond the intentional smoke test.

## Idempotence and Recovery

All steps are safe to re-run. If the Tailwind integration causes issues, remove `apps/miniapp/tailwind.config.cjs` and `apps/miniapp/postcss.config.cjs`, delete the Tailwind dependencies from `apps/miniapp/package.json`, and revert the `@tailwind` directives in `apps/miniapp/src/app.scss`. The miniapp should then build as before.

## Artifacts and Notes

Capture small proof artifacts once the work is done, such as the successful lint output and the WeChat miniapp view showing the Tailwind-styled label. Keep them short and focused on verifying the integration.

## Interfaces and Dependencies

Use the Tailwind CSS toolchain via `tailwindcss`, `postcss`, and `autoprefixer` as dev dependencies in `apps/miniapp/package.json`. Tailwind configuration must live in `apps/miniapp/tailwind.config.cjs`, and PostCSS configuration in `apps/miniapp/postcss.config.cjs`. The only runtime-facing change should be the additional CSS generated from Tailwind utilities; no new runtime JavaScript modules are required.

Revision note (2026-01-24): updated progress and plan details to reflect Tailwind config changes, lint fixes, and the current dependency install/build blockers (registry access and build panic).
Revision note (2026-01-24): added the Taro config Tailwind plugin step and documented the WXSS parse error caused by unprocessed `@tailwind` directives.
Revision note (2026-01-24): recorded the WXSS failure from Tailwind arbitrary value selectors and the mitigation.
Revision note (2026-01-24): excluded test files from Tailwind content scanning to prevent escaped selectors from appearing in WXSS.
