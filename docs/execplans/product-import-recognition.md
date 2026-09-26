# 商品规格识别、预检与持续复核

This ExecPlan is a living document maintained according to docs/execplans/plans.md. Preserve the existing .agent/PLANS.md and both source worktrees.

## Purpose / Big Picture

Admin operators can upload the trial master workbook, legacy five-column workbook, or the existing standard workbook; review recognized products and up to three SKU dimensions; confirm changes; inspect independently created draft products; export and re-import without losing IDs or optional values. The initial implementation excluded production deployment. On 2026-09-26 the user additionally authorized validation, a GitHub branch and PR, squash merge to main, remote branch deletion and deployment to the ECS host configured as tmo-ecs.

## Progress

- [x] 2026-09-26: Read the prior Codex conversations, current implementation, original trial workbook and separate unfinished v2 worktree.
- [x] 2026-09-26: Created managed worktree /Users/asimov3059/.codex/worktrees/product-import-review/tmo from origin/main fd6ac85 and branch codex/product-import-review.
- [x] 2026-09-26: Implemented all three source adapters, deterministic recognition, stable references, merged-cell/header handling and original-master assertions.
- [x] 2026-09-26: Implemented persisted preview, confirmation, revisions, explicit clears, durable live review counts, lease fencing and atomic resumable group execution.
- [x] 2026-09-26: Implemented HTTP authorization, template, server pagination, filtered export/reference sheets, reports and publication guards; generated SQLC/OpenAPI clients.
- [x] 2026-09-26: Implemented Admin workbench, mock lifecycle, category batch resolution, per-group SKU pagination and product review controls.
- [x] 2026-09-26: Passed original master plus original images DB/race tests, HTTP DB tests, backend suite, mock/hybrid browser checks, 44 miniapp regressions, builds and independent review.
- [x] 2026-09-26: Passed PR 183 checks, squash-merged e927ac9 to main and confirmed remote feature branch deletion.
- [x] 2026-09-26: Released e927ac9; service health, authorization, static assets and empty-export download passed without changes to existing catalog data.

## Surprises & Discoveries

The v2 implementation exists only as uncommitted source under the original repository .worktrees/admin-product-import-v2. It lacks current catalogspec validation and conflicts with migration 00025. Reuse capabilities rather than overwrite main. The original 1110-row workbook is no longer accessible; historical conversation samples are available, but a synthetic fixture does not demonstrate full-file recognition.

## Decision Log

User approved both source formats, only anomalous rows becoming independent DRAFT products, persistent review, missing dimension units requiring review, unmatched categories going to uncategorized drafts, and blank optional fields preserving values. Complete model numbers may remain a single dimension. Existing BOSS/ADMIN permissions, inquiry pricing and ID-based round-trip remain. No REPLACE, revert, permission expansion or SKU image storefront is introduced.

## Outcomes & Retrospective

The approved implementation is complete in the isolated worktree. All original source worktrees remain unchanged. The initial implementation did not commit, merge, import production data or deploy. The subsequent release stage is authorized separately below.

The real master successfully imports 10 products and 42 SKUs, retains all 325 source attributes and source SKU codes, and writes 12 referenced original images. Re-upload skips all 42 rows without duplicates. Two real-backend browser scenarios passed: standard three-level preview/confirm/history/export/download/re-import, and ambiguous legacy rows creating durable independent drafts/reviews. Identity/bootstrap are fixtures in those hybrid tests; catalog operations and database writes are real. External font/CSS requests are excluded from functional hybrid checks; separate desktop/mobile screenshots verify the actual styled UI.

The original complete 1110-row legacy attachment remains unavailable. Its preserved real examples are covered; full-file replay is intentionally deferred as approved, not represented by generated rows with matching counts.

## Context and Orientation

services/commerce/internal/modules/productimport owns parsing and product transactions; packages/go-shared/catalogspec enforces one to three dimensions and unique actual combinations. productexport already provides a consistent complete paginated export. apps/admin-web/src/react/pages/admin/ImportPage.tsx uploads immediately today; it must become preview-first. Existing exports.html is a static shell. The source workbook is /Users/asimov3059/Downloads/首批试运行商品包_v1_20260917/首批商品试运行母表_v1.xlsx, containing 10 products, 42 SKUs, 325 attribute rows and 12 image index entries.

## Plan of Work

Add deterministic source adapters before the existing strict row validation. Recognize explicit standard columns, trial master joins and legacy business columns. Retain source values and full metadata; only expand actual merged cells. Category mapping is by unique full path, with missing/ambiguous paths assigned uuid.Nil (existing uncategorized convention) and reviewed. Trial profiles: screws diameter/length/pitch; nuts diameter; flanges DN/pipe diameter; EPE width/thickness/roll length; hook-and-loop width/color/face; binding width/yarn label/color; pipe wrench nominal size; hex key nominal spec; tape width/roll length; notebook paper size. Box dimensions require explicit units. Opaque model numbers remain intact. Incomplete or ambiguous new rows become separate draft products; invalid prices and identity conflicts remain errors.

Introduce migration 00026 for persisted job preview/revision/phase/lease/summary, source refs and independent reviews. Source keys exclude filename and row position; legacy keys fingerprint original four business columns. Source refs preserve previous operator corrections on identical replay and link new master SKUs to the existing source product. Product writes, refs, results and review creation commit together. Confirmation uses expectedRevision and Idempotency-Key, validates the preview target snapshot, and runs per product group. Worker claims use 60-second leases, 10-second heartbeat and token-fenced writes. Restart only expired work and skip groups already committed.

Admin uses tabs for import, export and history. Preview tables expand SKU rows, allow category/units/spec/group resolution and explicit clears, show source evidence and persistent warning/error reasons. Confirmation is disabled for unresolved hard errors. Export and product pages link to task/review details. Keep shipment and product-request batch actions in a secondary area. Real backend is authoritative; mock follows the same states and fixtures.

## Interfaces and Dependencies

Use existing excelize, pgx/sqlc, Gin, React, lucide-react and Playwright. Extend POST /admin/products/import-jobs to preview-first. Add GET /admin/products/import-jobs/:jobId/preview, PUT .../preview-resolution, POST .../confirm and .../cancel; GET /admin/import-jobs; GET /admin/products/import-reviews and PATCH /admin/products/import-reviews/:reviewId. All catalog operations require BOSS/ADMIN. Job status adds AWAITING_CONFIRMATION, PARTIALLY_SUCCEEDED and CANCELLED; successful warnings remain SUCCEEDED with needsReview counts. HTTP DTOs are explicitly camelCase and never raw db structs.

Preview shape: {jobId,revision,sourceFormat,summary,items,total,page,pageSize}. Each item is a group {key,productName,productId,categoryId,dimensions,action,rows,issues}; rows include {rowId,sourceSheet,sourceRow,skuCode,skuName,spec,attributes,unit,action,issues,rawValues}. Issues {code,message,severity} use WARNING/ERROR. Summary {totalRows,successRows,failedRows,skippedRows,splitProducts,reviewCount,productCreates,productUpdates,skuCreates,skuUpdates}. Resolution {expectedRevision,groups:[{key,productName?,categoryId?,dimensions?,rows:[{rowId,unit?,attributes?,groupKey?,ignored?,clearFields?}]}]}. Confirm {expectedRevision}. Review list uses {items,total,page,pageSize}; review {id,jobId,productId,skuId,productName,sourceSheet,sourceRow,code,message,status,rawValues,createdAt,resolvedAt}. PATCH {status:"RESOLVED"}. Job details and history include fileName,sourceFormat,revision,summary in addition to existing fields.

## Concrete Steps

Implement source SQL and OpenAPI first, then regenerate with bash tools/scripts/commerce-generate.sh and pnpm -C packages/api-client generate. Run gofmt on changed Go source. Use the new managed worktree explicitly for every edit and command. Read-only old worktrees remain source references.

## Validation and Acceptance

Run Go parser/catalogspec tests, independent PostgreSQL integration tests, admin typecheck/build and relevant mock/hybrid Playwright, pnpm check:openapi and check:mock-sync, and miniapp specification Jest regressions. Verify original master cardinalities and actual relationships, repeat import, append SKU, rollback, blank-preserving update, explicit clear, stale confirmation, duplicate confirm and worker recovery. Browser acceptance covers real preview-to-confirm import, durable history/review, export and roundtrip, authorization, many SKUs and desktop/narrow screenshots. Full legacy 1110-row replay is deferred until source recovery and must be reported explicitly.

## Idempotence and Recovery

Integration tests use dedicated local databases only. Preserve uncommitted original worktrees. Keep finished job metadata and source/review records across retries. Scope rollback to failed product groups. Use additive migrations 00026 and 00027 and generated SQL; never replace deployed migration 00025. The user has now authorized deployment, but not importing the sample catalog into production. Production verification must use read-only queries or an uncommitted preview that is cancelled.

## Artifacts and Notes

Verification completed on 2026-09-26:

    env -u COMMERCE_DB_DSN GOCACHE=/tmp/tmo-import-review-gocache bash tools/scripts/test-backend.sh
    go test -race -count=1 ./internal/modules/productimport
    go test -count=1 ./internal/http/handler ./internal/modules/productexport ./internal/excel
    go vet ./internal/modules/productimport
    pnpm -C apps/admin-web typecheck
    pnpm -C apps/admin-web build
    pnpm -C apps/admin-web build:mock
    node tools/scripts/check-openapi-sync.mjs
    node tools/scripts/check-mock-sync.mjs
    pnpm -C apps/miniapp test -- --runInBand src/pages/goods/detail/index.test.tsx src/pages/cart/index.test.tsx src/services/mocks/catalog.test.ts

The database commands used dedicated databases in a newly initialized local cluster on port 55439, never a inherited DSN. Original-file validation used TMO_TRIAL_MASTER_WORKBOOK and TMO_TRIAL_IMAGE_ROOT. Final HTTP/database tests passed, the importer race suite passed including the real 42-SKU/12-image fixture, and miniapp tests reported 3 suites / 44 tests passed.

Mock checks cover preview-before-write, history/reload, dimensions, ambiguous drafts, unit editing, clear-intent persistence, batch category resolution, role visibility and review counts across repeated tasks. Passing run evidence is in /private/tmp/tmo-import-mock-role-results and /private/tmp/tmo-import-mock-review-count-results. The two hybrid scenarios passed with output /private/tmp/tmo-import-hybrid-final. The updated commerce-product-import-smoke.sh passed against the same isolated service.

Reviewed desktop/mobile screenshots: /private/tmp/tmo-product-import-review/import-overview-desktop.png and import-overview-mobile.png. The 390px page has no horizontal document overflow; a 12-SKU product pages its rows 10 + 2. The mock preview remains available at http://127.0.0.1:5188/import.html. Temporary real API, static server and database were stopped after verification; their local files remain available for inspection.

Independent review found and verified fixes for competing CREATE identity takeover, imported publication bypass, forgotten clear selections, non-head SKU product clears, and manually split source-family reassignment. No remaining P1/P2 issues were reported in the final limited re-review. Reports use random artifact IDs, not lease tokens, while database publication remains lease-fenced. Source image paths are provenance, not remotely usable URLs. No missing commercial fields are changed to zero.

Revision 2026-09-26: Initial execution record and shared API contract based on the user-approved plan.

Revision 2026-09-26: Completed implementation, review fixes and verification. Added immutable result XLSX, explicit group clear intents and live pending-review counts. Preserved the approved full legacy-file validation limitation.

## Authorized Release

The GitHub repository is teamdsb/tmo. Publish codex/product-import-review, create a PR, wait for required checks, squash merge to main and delete only that remote feature branch. Before deployment, retain a custom commerce database dump, static admin archive, media archive, container inspection and private runtime/rollback compose at the ECS host. The existing release is f5e3a2b and server disk space is limited, so compile Linux amd64 binaries and Admin locally.

Deploy only the final main source with matching binary/archive hashes. Apply only migration 00026 and 00027 Up sections in one database transaction after draining the old import worker. Preserve existing environment, ports, networks and mounts. Build light runtime images for commerce/gateway from the currently running images; keep identity/payment container IDs unchanged. Verify container revision and health/ready before publishing hashed static assets and atomically replacing HTML/current. Roll back application images and static files if verification fails; never restore the entire database over subsequent transactions.

Pre-merge review added legacy task state migration, a configurable template download API base, and real proxy forwarding coverage. Legacy interrupted tasks retain committed rows and source audit rather than being silently re-imported. The release deployment receipt will record actual revision, checks and backup paths after execution.

Release completed on 2026-09-26. The deployed feature revision is e927ac91ae501da50ed67004b0ee3ed9b618ed0a. Public verification is recorded in docs/runbooks/deploy-product-import-2026-09-26.md; detailed operational receipts remain private. All source changes were committed and PR 183 was merged; original worktrees were preserved. Verification did not change catalog data.
