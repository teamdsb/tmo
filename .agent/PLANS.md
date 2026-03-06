# 商品 Excel 导入（含图片、多规格）落地

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document must be maintained in accordance with `docs/execplans/PLANS.md`.

## Purpose / Big Picture

完成后，管理员可以在 `admin-web` 的 `/import.html` 页面上传商品 Excel 和可选图片 ZIP，系统会创建真实可执行的导入任务，在 `commerce` 服务内异步处理商品、SKU、价格梯度与图片，并在任务查询接口中看到进度、成功结果和错误报告。`mock` 模式也会支持相同的上传和结果展示，并把成功导入的商品写入本地持久化，使导入结果在商品页可见。

观察方式分为两条。`real` 模式下启动 `commerce` 与 `admin-web`，上传 Excel 后查询 `/admin/import-jobs/{jobId}`，应看到状态从 `PENDING` 进入 `RUNNING` 再进入 `SUCCEEDED` 或 `FAILED`。`mock` 模式下打开 `/import.html` 上传同样的文件，页面应展示本地任务进度，随后在 `/products.html` 看到新增或更新后的商品。

## Progress

- [x] (2026-03-06 14:28Z) 核实现状，确认契约已声明 `/admin/products/import-jobs` 支持 `excelFile`、`imagesZip`、`imageBaseUrl`，但 `services/commerce/internal/http/handler/admin.go` 仅创建 `PENDING` 任务。
- [x] (2026-03-06 14:31Z) 确认仓库现有能力：`catalog_products`、`catalog_skus`、`catalog_price_tiers` 已支持新增；缺少商品导入模板、SKU 更新与价格梯度替换写库能力。
- [x] (2026-03-06 14:34Z) 锁定实现决策：`real` 采用服务内真实异步任务，更新主键为 `skuCode`，图片同时支持 URL 与 ZIP，坏行按“部分成功”处理并输出错误报告。
- [x] (2026-03-06 01:52Z) 完成 `commerce` 后端落地：新增 `product_import_jobs` / `product_import_rows` 持久化、商品导入模板、文件保存、行级解析、图片解析、任务 worker、错误报告与结果摘要输出。
- [x] (2026-03-06 02:08Z) 完成 `admin-web` React 导入页改造：接入 real 商品导入任务创建与轮询，补齐 mock Excel/ZIP 解析、本地任务存储，以及商品页读取本地导入结果。
- [x] (2026-03-06 02:19Z) 完成回归验证：`go test ./services/commerce/...` 通过，`pnpm -C apps/admin-web build` 通过，并补齐 mock 下物流导入/需求导出任务的本地可查询行为。

## Surprises & Discoveries

- Observation: 当前真正上线的 `/import.html` 入口是 React 页面 `apps/admin-web/src/react/entries/import.tsx`，它挂载的是静态的 `ImportPage.tsx`，并没有加载 legacy `apps/admin-web/src/import.js`。
  Evidence: `apps/admin-web/import.html` 只引用 `/src/react/entries/import.tsx`；`ImportPage.tsx` 内容是“物流与发货管理”静态表格。

- Observation: `commerce` 已经具备本地媒体输出目录配置，可直接复用于导入文件、ZIP 图片和错误报告落盘。
  Evidence: `services/commerce/internal/config/config.go` 暴露 `MEDIA_LOCAL_OUTPUT_DIR` 与 `MEDIA_PUBLIC_BASE_URL`，`product_requests.go` 已使用这套配置保存上传文件。

- Observation: 当前后台导入页面的生产入口已经完全切到 React，因此 legacy `apps/admin-web/src/import.js` 即使已有少量 API 封装，也不会影响真实页面行为。
  Evidence: `apps/admin-web/import.html` 仅挂载 `src/react/entries/import.tsx`；本次改动后页面行为全部由 `ImportPage.tsx` 驱动。

- Observation: sqlc 现有生成约束要求避免在查询目录里重复定义同名 `UpdateSku`、`DeletePriceTiersBySku` 等语句，否则代码生成会失败。
  Evidence: 初次生成时报 query name duplicated，移除重复定义后 `bash tools/scripts/commerce-generate.sh` 成功。

## Decision Log

- Decision: 商品导入任务不引入独立队列或外部 worker，先在 `commerce` 服务进程内启动轮询 worker。
  Rationale: 现有服务没有任务基础设施，且 `import_jobs` 已在同库；单实例 in-process worker 能最小化改动并保持任务状态可恢复。
  Date/Author: 2026-03-06 / Codex

- Decision: Excel 模板按“每行一个 SKU”设计，用 `groupKey` 聚合同一商品的多规格。
  Rationale: 现有表结构以商品/SPU 和 SKU 分层，SKU 是可更新的最小单元；显式分组比用商品名聚合更稳定。
  Date/Author: 2026-03-06 / Codex

- Decision: 任务成功状态沿用现有 `SUCCEEDED`，部分坏行不引入新状态，而是通过 `errorReportUrl` 表达。
  Rationale: `ImportJob` 契约当前只有 `PENDING/RUNNING/SUCCEEDED/FAILED` 四种状态，新增状态会扩大契约与客户端改动面。
  Date/Author: 2026-03-06 / Codex

## Outcomes & Retrospective

实现已完成。

后端方面，`/admin/products/import-jobs` 不再只是创建静态 `PENDING` 记录。处理器现在会把 Excel 和可选 ZIP 保存到媒体目录，写入通用 `import_jobs` 与商品导入专用表，并由 `commerce` 进程内 worker 异步领取执行。导入器支持按 `groupKey` 聚合同一商品的多规格 SKU，按 `skuCode` 更新已有 SKU，替换价格梯度，并按“绝对 URL -> imageBaseUrl 相对路径 -> ZIP 文件命中”的优先级解析图片。任务结束后会写入结果摘要与错误报告 URL；存在坏行时任务保持 `SUCCEEDED`，但会附带 `errorReportUrl`。

前端方面，`/import.html` 已从物流占位改为导入工作台。real 模式支持商品 Excel、图片 ZIP 和 `imageBaseUrl` 提交，并自动轮询 `/admin/import-jobs/{jobId}`。mock 模式会在浏览器内解析 Excel/ZIP，按与后端一致的模板语义生成本地任务、保存导入商品，并在 `/products.html` 中可见。物流导入和需求导出在 mock 下也会进入同一套本地任务存储，因此查询面板行为保持一致。

测试结果如下：

- `go test ./services/commerce/...`
- `pnpm -C apps/admin-web build`

本次没有完成浏览器端手工 smoke，也没有跑真实 Postgres 上的交互式上传验证；这仍是剩余风险，但至少编译、单测与集成测试覆盖了多规格、ZIP 图片、`skuCode` 更新、部分成功与错误报告路径。

## Context and Orientation

本仓库的商品目录归 `services/commerce` 服务。`services/commerce/internal/http/server.go` 注册了 `/admin/products/import-jobs` 和 `/admin/import-jobs/:jobId`，实现目前在 `services/commerce/internal/http/handler/admin.go`。商品主数据分为 `catalog_products`（商品/SPU）和 `catalog_skus`（规格/SKU），建表文件分别是 `services/commerce/migrations/00001_create_catalog_products.sql` 和 `services/commerce/migrations/00003_create_catalog_skus.sql`。价格梯度存放在 `catalog_price_tiers`。

“导入任务”指 `import_jobs` 表中的一条记录。这个表建于 `services/commerce/migrations/00006_create_tracking_shipments.sql`，当前只支持创建与按 ID 查询。为了实现可恢复的商品导入，需要新增商品导入专用表保存源文件位置、逐行结果和统计信息，并补上任务状态更新能力。

前端管理台位于 `apps/admin-web`。`apps/admin-web/import.html` 当前挂载 React 页面 `apps/admin-web/src/react/pages/admin/ImportPage.tsx`，但该页面仍是物流占位界面。仓库里另有 legacy `apps/admin-web/src/import.js`，它已经有一套 real API 调用，但没有被当前页面入口使用，也没有 mock 商品导入能力。

`mock` 模式和 `real` 模式由 `apps/admin-web/src/lib/env.js` 控制。`mock` 模式不会调用后端，而是在浏览器内用本地状态模拟业务，因此本次需要在浏览器里新增 Excel/ZIP 解析和本地商品持久化逻辑。当前 `products.js` 已有类目和展示类目的本地存储能力，可作为导入商品持久化的接入点。

## Plan of Work

先改后端。第一步新增数据库结构和查询：给 `import_jobs` 增加更新时间，新增 `product_import_jobs` 与 `product_import_rows` 表，配套 sqlc 查询用于创建商品导入任务、claim 待处理任务、更新进度、写逐行结果、列举作业行和回置异常 `RUNNING` 任务。第二步新增 Excel 模板与解析逻辑，在 `services/commerce/internal/excel/templates.go` 中加入商品导入模板，并在新的导入模块中把每一行归一化为商品字段、SKU 字段、图片字段和价格梯度字段。

第三步实现图片与文件落盘。`POST /admin/products/import-jobs` 需要保存 Excel 文件、可选 ZIP 文件以及请求中的 `imageBaseUrl`，创建 `import_jobs` 与 `product_import_jobs` 记录并返回 `202`。保存目录统一放到 `MEDIA_LOCAL_OUTPUT_DIR/import-jobs/<jobId>/`。错误报告与结果摘要也放在该目录，并通过 `MEDIA_PUBLIC_BASE_URL/import-jobs/<jobId>/...` 暴露可下载 URL。

第四步实现服务内异步 worker。`services/commerce/cmd/commerce/main.go` 启动时创建一个轮询器，定期 claim 一条 `PENDING` 商品导入任务，把通用任务状态更新为 `RUNNING`，然后执行解析与写库。写库按 `groupKey` 一组一事务处理：找到同组内所有行，先用 `skuCode` 判断更新还是新建，再写 `catalog_products`、`catalog_skus`，替换 `catalog_price_tiers`。若某一行校验失败或图片解析失败，只记录该行错误，不影响其他组。任务结束后生成错误报告并把通用任务更新为 `SUCCEEDED` 或系统级 `FAILED`。

第五步改前端。用 React 页面重写 `ImportPage.tsx`，接入真实 API 的商品导入、物流导入、需求导出、任务查询，并在商品导入表单中支持选择 Excel、可选 ZIP 与 `imageBaseUrl`。real 模式提交后轮询任务状态，展示进度条、错误报告入口和任务结果摘要。mock 模式使用浏览器依赖解析 Excel/ZIP，复用与后端相同的模板语义，在本地生成任务对象和导入结果，并把商品数据写入本地存储。

第六步接入商品页的 mock 数据源。`apps/admin-web/src/products.js` 当前在 mock 模式直接生成种子商品，需要新增读取“导入商品本地存储”的路径，并在 `skuCode` 命中时做覆盖更新。这样导入页在 mock 模式产生的结果可以在商品页展示。

## Concrete Steps

在仓库根目录 `/Users/lifuyue/Documents/tmo` 工作。

1. 编辑后端迁移、SQL 与处理代码，然后执行：

    go test ./services/commerce/...

   预期：新增的商品导入测试通过，原有 `commerce` 测试不回归。

2. 编辑 admin-web 页面与 mock 逻辑后执行：

    pnpm -C apps/admin-web build

   预期：Vite 构建通过，没有类型或打包错误。

3. 若本地具备 Postgres，启动 `commerce` 并手动验证：

    docker compose -f infra/dev/docker-compose.yml up -d
    COMMERCE_DB_DSN="postgres://commerce:commerce@localhost:5432/commerce?sslmode=disable" go run ./services/commerce/cmd/commerce

   然后在另一个终端启动：

    pnpm -C apps/admin-web dev:real

   打开 `http://localhost:5174/import.html`，登录管理账号并上传测试 Excel。预期：页面显示新任务，短时间内从 `PENDING` 变成 `RUNNING` 再到 `SUCCEEDED`，有坏行时出现错误报告链接。

4. 验证 mock：

    pnpm -C apps/admin-web dev:mock

   打开同一页面上传测试 Excel。预期：本地任务完成后跳转或刷新商品页可看到导入数据。

## Validation and Acceptance

验收以可观察行为为准。后端验收为：`POST /admin/products/import-jobs` 不再只返回静态 `PENDING`，而是真正保存文件并驱动后台执行；`GET /admin/import-jobs/{jobId}` 会随着 worker 处理而更新状态和进度；导入完成后数据库中可看到商品、SKU、价格梯度变化；存在坏行时，成功行仍然落库，并提供错误报告下载地址。

前端验收为：`/import.html` 在 real 模式展示真实的商品导入操作而不是物流占位；商品导入支持 `excelFile`、`imagesZip`、`imageBaseUrl`；mock 模式支持相同的上传入口和结果展示；mock 导入的数据能在 `/products.html` 中可见。

测试验收至少包括新增后端单测/集成测试和 `apps/admin-web` 构建通过。若能运行浏览器测试，则补充商品导入的端到端路径。

## Idempotence and Recovery

迁移是增量式的，可重复执行。worker 设计为可恢复：服务启动时把遗留的 `RUNNING` 商品导入任务回置为 `PENDING` 再重试。重复上传同一个文件会创建新的导入任务，但写库更新仍以 `skuCode` 为锚点，避免在同一 SKU 上产生重复记录。

如果任务执行中途中断，可重新启动 `commerce`，worker 会继续领取待处理任务。若某次导入结果错误，可使用相同 `skuCode` 的修正版 Excel 再次导入覆盖数据。mock 模式的本地存储可通过浏览器清理站点数据恢复到初始状态。

## Artifacts and Notes

关键产物：

- 后端新增迁移 `services/commerce/migrations/00014_create_product_import_jobs.sql`。
- 导入执行模块位于 `services/commerce/internal/modules/productimport/`。
- 前端本地解析与 mock 持久化位于 `apps/admin-web/src/lib/product-import.js`。
- 测试文件位于 `services/commerce/internal/modules/productimport/service_integration_test.go`，覆盖多规格导入、已有 SKU 更新与部分成功错误报告。

## Interfaces and Dependencies

后端继续使用现有 `services/commerce/internal/db` 的 sqlc 查询结构和 `github.com/xuri/excelize/v2` 读取 Excel。新增导入执行模块时，需要提供一个明确的执行入口，例如在 `services/commerce/internal/modules/productimport` 中定义一个处理器，至少包含“领取任务并执行一次”的方法，以便 worker 和测试共用。

前端 `apps/admin-web` 需要新增浏览器侧 Excel 和 ZIP 解析依赖。计划使用 `xlsx` 读取 `.xlsx`，使用 `jszip` 解包图片 ZIP。页面代码继续使用 React；若仍需复用 legacy API 方法，则只复用请求层，不再复用 legacy 页面逻辑。

变更记录：2026-03-06 14:39Z，创建初版 ExecPlan。原因：该功能跨越 `commerce` 后端异步任务和 `admin-web` mock/real 双模式，必须有可恢复的执行文档支撑持续实现。
