# Miniapp Atomic CSS Integration

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `docs/execplans/PLANS.md` from the repository root.

## Purpose / Big Picture

After this change, the miniapp can use an atomic CSS framework (Tailwind CSS) by applying utility classes directly in React JSX, and those classes render correctly in WeChat miniapp and H5 builds. A small, visible utility-class change in the UI demonstrates the integration without breaking existing Taroify styling.

## Progress

- [x] (2026-01-24 07:39Z) Reviewed the current miniapp CSS stack and build configuration, confirmed no atomic CSS framework is installed, and drafted this plan.
- [x] (2026-01-24 08:10Z) Added Tailwind CSS dependencies and configuration files in `apps/miniapp` (`tailwind.config.cjs`, `postcss.config.cjs`, `package.json`, `pnpm-lock.yaml`).
- [x] (2026-01-24 08:20Z) Added Tailwind plugin config to `apps/miniapp/config/index.ts` for mini and h5 builds (later superseded by CLI generation).
- [x] (2026-01-24 07:59Z) Resolved stylelint class naming and specificity issues by renaming page modifier classes and reordering `.page-search`.
- [x] (2026-01-24 08:26Z) Replaced the smoke-test utility class using an arbitrary value (`text-[12px]`) with a WXSS-safe class to avoid escaped selectors.
- [x] (2026-01-24 08:28Z) Removed the remaining arbitrary color class in the Mine page (`bg-[#f7f8fa]`) to avoid escaped selectors in WXSS.
- [x] (2026-01-24 08:31Z) Excluded test files from Tailwind content scanning to prevent arbitrary-value utilities from leaking into WXSS output.
- [x] (2026-01-24 08:46Z) Moved the Tailwind PostCSS plugin to top-level `postcss` config so the Vite runner applied it in mini builds (later superseded by CLI generation).
- [x] (2026-01-24 09:20Z) Removed `@tailwind base` from `app.scss` to avoid WXSS parse errors from Tailwind preflight output.
- [x] (2026-01-24 09:32Z) Removed `@tailwind components/utilities` from `app.scss` and added a minimal utility class set to keep WXSS builds passing (later superseded by CLI output).
- [x] (2026-01-24 10:40Z) Switched to Tailwind CLI generation, added `src/styles/tailwind.css` input, generated `src/styles/tailwind.generated.css`, imported it in `app.scss`, removed the hand-rolled utility classes, and added `build:tailwind` + `prebuild:*` scripts.
- [ ] Add a small utility-class smoke test in a placeholder view and verify WeChat miniapp + H5 builds (completed: smoke test added; remaining: build verification).
- [ ] Update miniapp documentation and run lint/build validation (completed: README updated; remaining: successful build:weapp/build:h5).

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
- Observation: The Vite runner uses `taroConfig.postcss`, not `mini.postcss`, when building WXSS.
  Evidence: `@tailwind` remained in `app-origin.wxss` even after setting `mini.postcss`, and `@tarojs/vite-runner/dist/mini/config.js` reads `taroConfig.postcss`.
- Observation: Tailwind base/preflight emits empty custom property values (for example `--tw-pan-x: ;`) and `::backdrop`, which WXSS fails to parse.
  Evidence: `app-origin.wxss` includes `::backdrop{--tw-pan-x: ; ...}` near the reported error offset.
- Observation: WXSS still rejected `@tailwind components` and `@tailwind utilities` when Tailwind was not executed in the mini pipeline.
  Evidence: `app-origin.wxss` contained `@tailwind components;@tailwind utilities;`.
- Observation: Tailwind CLI produced an empty output when run from the repo root because the `content` globs are relative to `apps/miniapp`.
  Evidence: `warn - No utility classes were detected in your source files.`

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
  Rationale: The Vite runner's mini/h5 pipeline builds PostCSS plugins from Taro config; without this, `@tailwind` directives leak into WXSS.
  Date/Author: 2026-01-24, Codex
- Decision: Avoid Tailwind arbitrary value utilities in WXSS outputs.
  Rationale: WXSS parser does not accept the escaped selector form (e.g. `.text-\\[12px\\]`).
  Date/Author: 2026-01-24, Codex
- Decision: Exclude `*.test.*` and `__tests__` from Tailwind content scanning.
  Rationale: Tests should not influence production CSS generation and can introduce unsupported escaped selectors.
  Date/Author: 2026-01-24, Codex
- Decision: Keep Tailwind PostCSS config at top-level `postcss` and reuse it for mini/h5.
  Rationale: Vite runner only reads `taroConfig.postcss` for plugin resolution.
  Date/Author: 2026-01-24, Codex
- Decision: Drop `@tailwind base` from the miniapp stylesheet.
  Rationale: WXSS cannot parse some preflight output; utilities are sufficient for current usage.
  Date/Author: 2026-01-24, Codex
- Decision: Replace Tailwind directives with a minimal hand-rolled utility set in `app.scss`.
  Rationale: WXSS rejects unprocessed `@tailwind` directives; a small utility subset keeps the UI consistent without blocking builds.
  Date/Author: 2026-01-24, Codex
- Decision: Generate Tailwind output via the CLI into `src/styles/tailwind.generated.css` and import it from `app.scss`, removing the Tailwind PostCSS plugin and the temporary hand-rolled utilities.
  Rationale: CLI output avoids unsupported at-rules in WXSS and makes the CSS output deterministic for builds.
  Date/Author: 2026-01-24, Codex

## Outcomes & Retrospective

Current outcome: Tailwind configuration is in place, CLI generation is wired with `build:tailwind` and `prebuild:*` hooks, and the generated CSS is imported in `apps/miniapp/src/app.scss`. The placeholder page still demonstrates utility classes, and the hand-rolled utility fallback has been removed. Build verification for WeChat miniapp and H5 is still pending.

## Context and Orientation

The miniapp lives in `apps/miniapp` and uses Taro with React and the Vite compiler, configured in `apps/miniapp/config/index.ts`. Global styles are in `apps/miniapp/src/app.scss`, imported by `apps/miniapp/src/app.ts`. UI widgets come from Taroify, and its base CSS is imported at the top of `apps/miniapp/src/app.scss`. Linting for styles is controlled by `apps/miniapp/stylelint.config.mjs`, which allows Tailwind-specific at-rules in the Tailwind input file.

Tailwind is generated from `apps/miniapp/src/styles/tailwind.css` (input) into `apps/miniapp/src/styles/tailwind.generated.css` (output). The generated file is imported by `apps/miniapp/src/app.scss` so the utility classes are available in all pages. Tailwind preflight is disabled in `apps/miniapp/tailwind.config.cjs` to avoid WXSS parsing issues.
The Taro PostCSS config no longer enables the Tailwind plugin because the CSS is generated ahead of time via the CLI.

In this plan, "atomic CSS framework" means a utility-first stylesheet where small, single-purpose classes like `px-4` or `text-sm` are applied directly in JSX to compose a UI.

## Plan of Work

Use the Tailwind CLI to generate a WXSS-safe utility stylesheet from `apps/miniapp/src/styles/tailwind.css`, and import the generated CSS into the global stylesheet. Keep the Tailwind config focused on the `src` tree and disable preflight to avoid WXSS parser errors. Add scripts in `apps/miniapp/package.json` so all platform builds regenerate the Tailwind output before Taro runs. Preserve existing custom SCSS and Taroify styles, and keep a small utility-class smoke test to verify the integration.

## Concrete Steps

1) Ensure Tailwind dependencies remain in `apps/miniapp/package.json` and are installed via `pnpm`.

    pnpm -C apps/miniapp install

2) Create `apps/miniapp/src/styles/tailwind.css` with the Tailwind entry directive:

    @tailwind utilities;

3) Generate the output file by running the CLI from the miniapp directory:

    pnpm -C apps/miniapp build:tailwind

   This produces `apps/miniapp/src/styles/tailwind.generated.css` based on the classes found in `apps/miniapp/src`.

4) Import the generated CSS in `apps/miniapp/src/app.scss` after the Taroify imports, and remove any temporary hand-rolled utility classes to avoid duplicates.

5) Remove the Tailwind PostCSS plugin from `apps/miniapp/config/index.ts` and `apps/miniapp/postcss.config.cjs` so the build pipeline relies only on the generated CSS.

6) Add build scripts in `apps/miniapp/package.json` so `build:*` targets run `build:tailwind` via `prebuild:*`. Optionally use `dev:tailwind` in a second terminal when running `dev:weapp` to regenerate classes during watch mode.

7) Keep the utility-class smoke test in `apps/miniapp/src/components/placeholder-page/index.tsx` (for example `className="text-blue-600"`) to visually confirm Tailwind output.

8) Update `apps/miniapp/README.md` to document the Tailwind generation flow and the scripts to run.

## Validation and Acceptance

Run the following from the repository root and confirm each expected outcome:

    pnpm -C apps/miniapp build:tailwind

Expect `apps/miniapp/src/styles/tailwind.generated.css` to contain classes like `.text-blue-600` and `.text-sm`.

    pnpm -C apps/miniapp build:weapp
    pnpm -C apps/miniapp build:h5

Open the WeChat miniapp build and confirm the placeholder view shows the Tailwind-styled label (blue text). Ensure no WXSS parse errors occur and that `dist/weapp/app-origin.wxss` contains no `@tailwind` directives.

## Idempotence and Recovery

All steps are safe to re-run. Regenerating Tailwind output overwrites `apps/miniapp/src/styles/tailwind.generated.css` with a fresh build. To roll back, remove `apps/miniapp/src/styles/tailwind.css` and `apps/miniapp/src/styles/tailwind.generated.css`, delete the Tailwind scripts from `apps/miniapp/package.json`, and remove the generated CSS import from `apps/miniapp/src/app.scss`.

## Artifacts and Notes

Capture small proof artifacts once the work is done, such as the successful Tailwind build output and the WeChat miniapp view showing the Tailwind-styled label. Keep them short and focused on verifying the integration.

## Interfaces and Dependencies

Use Tailwind CSS via the CLI (`tailwindcss`) as a dev dependency in `apps/miniapp/package.json`. Tailwind configuration lives in `apps/miniapp/tailwind.config.cjs`, the input file is `apps/miniapp/src/styles/tailwind.css`, and the generated output is `apps/miniapp/src/styles/tailwind.generated.css`. The only runtime-facing change should be the additional CSS generated from Tailwind utilities; no new runtime JavaScript modules are required.

Revision note (2026-01-24): updated the plan to generate Tailwind utilities via the CLI, import the generated CSS, and document the new build hooks.
