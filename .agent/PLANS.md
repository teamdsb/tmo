# Commerce v0 Demo 纵切计划（目录读 + 购物车 + 意向订单 + 追踪/回传）

本 ExecPlan 是一个持续更新的文档。`Progress`、`Surprises & Discoveries`、`Decision Log`、`Outcomes & Retrospective` 这四个部分在工作推进时必须同步更新。

本计划必须遵守仓库根目录的 `docs/execplans/PLANS.md`。

## Purpose / Big Picture

完成 v0 后，本地可以跑通一个“可演示的最小业务闭环”：用户浏览目录（Catalog 读）、手动加购或 Excel 批量加购（Cart + import job）、提交意向订单（Orders，状态固定为 `SUBMITTED`）、采销回传运单号并让下单人可查（Tracking + Excel 批量回传作业）。该闭环不涉及客户归属/业务员绑定、不涉及支付、不涉及售后/议价/找不到商品等扩展模块（这些进入 v1）。

同时，v0 要把“接口对齐”作为硬约束：OpenAPI 合约（`contracts/openapi/*.yaml`）是唯一真相来源；后端 Go 代码通过 sqlc/oapi-codegen 生成物与业务 handler 对齐；前端侧通过 OpenAPI 自动生成 TypeScript client/types，避免手写漂移；尽量不要求改动前端组件，组件只通过 service 层调用。

## Progress

- [x] (2026-01-22 17:05Z) 对齐 `docs/需求文档.md` 的关键开放问题，并锁定 v0/v1 边界与交互决策（v0=目录读+购物车+意向订单+追踪/回传；v1=其余）。
- [x] (2026-01-22 17:58Z) 补充 v0/v1 的前端 TS 业务逻辑与交互设计规划（miniapp 视角，不涉及组件实现），并明确 `/packages` 的地基拆包方案与 v0 鉴权策略。
- [ ] 修复当前 `services/commerce` 无法编译的问题，恢复 `go test ./...` 绿色（先对齐生成物与 handler 的类型/签名）。
- [ ] 落地 v0 行为：下单清购物车（同 SKU）、Idempotency-Key 重复 409、追踪写入不改订单状态、Excel 解析与错误提示完善，并补齐单测/集成测。
- [ ] 补齐本地 devops 地基：一键起 Postgres、迁移、seed（不依赖外部 goose/sqlc 安装）、以及可复现的验证脚本/README。
- [ ] 落地 TS OpenAPI 生成：新增 `packages/api-client`（orval 配置 + 生成脚本 + 导出入口），并通过 TypeScript 编译。
- [ ] 落地 TS 业务逻辑地基：新增 `packages/commerce-services`（use-cases + 交互状态机 + 错误归一化 + 幂等 key 生命周期），并通过 TypeScript 编译（可用 mock requester 验证主流程）。
- [ ] 补齐平台适配能力：在 `packages/platform-adapter` 增加 v0 必要的 `storage`/`uploadFile`/`chooseFile` 等能力接口与实现（用于 token 与 Excel 导入）。
- [ ] 在本计划中补充 v1 backlog 的接口/数据/交互假设，确保 v0 的命名与数据结构不会阻塞 v1。

## Surprises & Discoveries

- Observation: 当前仓库 `services/commerce` 编译失败，主要是“sqlc 生成的参数结构”与“handler 期望字段”不一致，以及“oapi-codegen 生成的类型变更”导致的指针/数值类型不匹配。
  Evidence: `cd services/commerce && go test ./...` 报错包含 `ListSkusByNameAndSpecParams` 字段不匹配、`productDetailFromModel` 调用参数数量不匹配、`IdempotencyKey` 指针类型不匹配、`PriceTier` 数值类型不匹配等。

- Observation: OpenAPI 的 `ErrorResponse`（包含 `requestId`、`details`）与现有 Go 返回的错误结构（`code/message/detail`）不一致；`services/commerce/README.md` 也以旧结构为准。
  Evidence: `contracts/openapi/openapi.yaml#/components/schemas/ErrorResponse` vs `packages/go-shared/errors/errors.go`。

- Observation: 仓库已有 `apps/miniapp`（Taro + React + TypeScript）但目前仅是最小壳（主要只有 `src/app.ts` 与 `src/pages/index/*`）；因此 v0 的 TS 对齐优先落在 `packages/*`（生成 client/types + requester + 业务 service 层），再由 miniapp 通过 service 层接入，不要求改动 UI 组件。
  Evidence: `ls apps` 包含 `miniapp`；`find apps/miniapp/src -maxdepth 3 -type f` 仅少量文件。

## Decision Log

- Decision: v0 范围固定为“目录读 + 购物车（含 Excel 批量加购作业）+ 意向订单（状态仅 SUBMITTED）+ 追踪/回传（含 Excel 批量回传作业）”。Wishlist/ProductRequests/AfterSales/Inquiries/Customers 归属/转移、支付等进入 v1。
  Rationale: 先把采购场景的主闭环跑通并可演示，避免把 v1 的流程复杂度拖入 v0。
  Date/Author: 2026-01-22 / Codex

- Decision: `Idempotency-Key` 在 v0 不强制必填；当请求携带 `Idempotency-Key` 且与历史订单冲突时返回 409（Conflict）。
  Rationale: 满足“防重复提交”的核心需求，同时不阻塞早期调用方（可逐步要求必填）。
  Date/Author: 2026-01-22 / Codex

- Decision: v0 下单成功后自动清理购物车中“本次下单涉及的 SKU”条目（同一用户），并尽量在同一事务内完成（创建订单/订单明细/清购物车）。
  Rationale: 贴合用户心智（加购 -> 下单即转化），避免重复下单与购物车脏数据。
  Date/Author: 2026-01-22 / Codex

- Decision: v0 追踪信息（运单号）写入与导入不改变订单状态；订单状态仍保持 `SUBMITTED`。
  Rationale: 追踪只作为信息回传；订单状态机与履约闭环放到 v1 统一设计。
  Date/Author: 2026-01-22 / Codex

- Decision: v0 不提交 Excel 模板文件到仓库；但在代码中集中维护“模板列定义/表头规范”，并提供“可生成模板文件”的脚本/工具，为 v1 的“模板存放/下载”打地基。
  Rationale: 当前阶段先保证表头一致与可测试性，避免把二进制模板纳入版本管理，同时不阻塞未来模板上架。
  Date/Author: 2026-01-22 / Codex

- Decision: TS OpenAPI 采用自动生成（v0 选择 `orval`），并通过自定义 requester 适配小程序（wx/my）与普通 fetch 环境；生成物放入独立 workspace 包（建议 `packages/api-client`），`packages/openapi-client` 继续作为通用 runtime 工具。
  Rationale: 生成 “typed operations + models” 可以最大程度减少手写漂移；`orval` 的 mutator 机制适合接入平台适配器。
  Date/Author: 2026-01-22 / Codex

- Decision: 客服聊天（微信/支付宝）在 v0 只做“平台适配层骨架”（例如 `packages/platform-adapter` 增加 API 占位与 types），具体接入规范在实施时再补齐。
  Rationale: 不阻塞 v0 主链路，同时为 v1 的“议价/售后入口”提前预留调用面。
  Date/Author: 2026-01-22 / Codex

- Decision: 前端规划范围（v0/v1）仅覆盖 `apps/miniapp` 的业务流程与 TS 业务逻辑层（service/use-case），不涉及 `apps/admin-web`，且不实现/改动组件 UI。
  Rationale: 先把业务闭环与接口对齐跑通；UI 可以后置迭代，避免在 v0 把实现成本耗在组件细节上。
  Date/Author: 2026-01-22 / Codex

- Decision: v0 鉴权不做登录流程；请求层从环境变量或本地存储读取 dev token，若存在则添加 `Authorization: Bearer <token>`；没有 token 时按匿名调用（由后端策略决定）。
  Rationale: v0 优先演示业务闭环与接口对齐；鉴权与账号体系属于 v1 的完整用户域建设。
  Date/Author: 2026-01-22 / Codex

- Decision: TS 拆包新增 `packages/api-client`（OpenAPI 生成物）与 `packages/commerce-services`（手写业务逻辑/use-cases + 交互状态机），其余能力分别复用/补齐 `packages/openapi-client`、`packages/platform-adapter`、`packages/shared`。
  Rationale: 生成物与手写逻辑分离可控；业务逻辑沉到 `/packages` 便于多端复用，且让 `apps/miniapp` 保持“薄接入”。
  Date/Author: 2026-01-22 / Codex

- Decision: v1 前端优先把“议价消息（Inquiries + messages）/售后（AfterSales + messages）/支付与订单状态机”三条主链的交互与 TS 业务逻辑设计清楚，再补其余模块。
  Rationale: 这三条链条决定请求与状态机形态（消息一致性、幂等、支付回跳/回调），提前明确可避免 v0 数据/命名阻塞 v1。
  Date/Author: 2026-01-22 / Codex

## Outcomes & Retrospective

尚未开始实施；在每个里程碑完成后补充达成情况、遗留与经验。

## Context and Orientation

仓库为单体仓库。当前唯一可运行的后端服务是 `services/commerce`，入口为 `services/commerce/cmd/commerce/main.go`。HTTP 使用 Gin，路由组装在 `services/commerce/internal/http/server.go`，handler 在 `services/commerce/internal/http/handler/*`。数据库为 Postgres，开发环境由 `infra/dev/docker-compose.yml` 提供。数据库 schema 迁移在 `services/commerce/migrations/*.sql`，查询在 `services/commerce/queries/*.sql`，由 sqlc 生成到 `services/commerce/internal/db/*.go`。OpenAPI 规范在 `contracts/openapi/*.yaml`，Go 侧由 oapi-codegen 生成到 `services/commerce/internal/http/oapi/api.gen.go`（生成文件不可手改）。

前端侧目前以 `apps/miniapp/` 作为跨端小程序工程（Taro + React + TypeScript）。同时仓库已有若干 TS workspace 包：`packages/shared`（DTO/enums/validators）、`packages/openapi-client`（URL/query 构造与 requester 抽象）、`packages/platform-adapter`（wx/my 的 request/pay/login 等平台 API 适配）。本计划的前端部分不涉及组件实现，目标是把业务逻辑与交互状态机沉淀到 `packages/`，让 `apps/miniapp` 只做薄接入。

目前仓库存在一个重要现实：生成物与业务代码已经发生漂移，导致 `services/commerce` 无法编译。v0 的第一步必须先恢复编译与测试为绿，再做功能行为对齐。

## Plan of Work

里程碑 0（止血）：让仓库重新可编译、可测试。做法是先修正 SQL 里容易导致 sqlc 生成字段名错误的部分（例如 `ListSkusByNameAndSpec` 用 `sqlc.arg('spec')` 命名参数），重新生成 sqlc 输出；再对齐 handler 里因 oapi-codegen 类型变更导致的指针/数值类型问题；同时补充一个“固定的生成脚本”，把 sqlc/oapi-codegen 的命令固化，避免未来再次漂移。

里程碑 1（v0 行为）：在编译通过的基础上，把 v0 必要行为补齐并写测试。重点是下单清购物车、Idempotency-Key 冲突 409、追踪导入/更新不改订单状态、Excel 表头/行校验与可解释错误。这里会新增少量 sqlc query（例如按 owner+skuIDs 批量删除购物车行），并在 handler 中使用事务保证一致性。

里程碑 2（devops 地基）：提供一组新同学可直接照做的本地启动与验证路径。包括：起 Postgres、应用迁移、seed 最小数据集、生成 JWT（可选）、启动服务、跑一套 curl 验收脚本。优先用 repo 内已有逻辑（例如复用集成测试里迁移解析思路），减少外部工具依赖。

里程碑 3（前端 TS 对齐 + 业务逻辑地基）：引入 OpenAPI -> TS 自动生成，并把请求层统一封装为“一个 requester 入口”（支持 wx/my 与 fetch）。新增 `packages/api-client`（仅生成代码）与 `packages/commerce-services`（手写业务逻辑/use-cases + 交互状态机），并给出不依赖组件的最小调用示例（README 或 scripts）。v0 不做登录流程，但 requester 需要支持注入 dev token（可配置）与 `Idempotency-Key`（下单时使用）。

里程碑 4（v1 规划落笔）：在本计划中明确 v1 的接口与数据对象扩展（找不到商品、收藏、议价、售后、客户归属、支付等），并检查 v0 的命名/表结构不会阻塞 v1（例如错误结构、job 类型、message senderType 等）。

## Frontend TS Business Logic & Interaction Design (Miniapp)

本节描述 v0/v1 在“TS 业务逻辑层”（service/use-case）与“业务流程交互”（页面流转/状态机/错误与重试）上的规划，不涉及任何组件实现与样式。这里的“交互”指：用户触发动作后，前端如何调用接口、如何组织 loading/error/retry、如何处理幂等与失败恢复，以及跨页面数据如何一致。

### /packages 地基（推荐拆分）

1) `packages/api-client`（生成层）：由 `contracts/openapi/commerce.yaml`（或聚合后的 `contracts/openapi/openapi.yaml` 中的 commerce 部分）通过 `orval` 生成 typed client 与 models。该包只包含生成代码与极薄的入口导出，不包含任何“业务默认值/缓存/状态机”。

2) `packages/commerce-services`（业务逻辑层）：手写封装 v0/v1 的 use-cases（例如 catalog/cart/orders/tracking），并把“交互状态机”与“错误归一化”作为该包的核心职责。该包对上提供稳定的函数/接口，对下依赖 `@tmo/api-client` 与 requester，避免 UI 直接触达生成 client。

3) 复用与补齐现有包：
   - `packages/openapi-client`：继续提供 URL/query 拼装与请求抽象（`Requester`）。如后续需要文件上传/非 JSON body，可在此包增加“能力接口”（例如 `UploadRequester`）而不把平台细节塞进生成层。
   - `packages/platform-adapter`：作为 wx/my 的“运行时适配层”，除 `request` 外，补齐 v0 需要的 `uploadFile`/`chooseFile`/`storage`（token 读写）等能力；保持 API 形式一致（同名函数，不同平台实现）。
   - `packages/shared`：放置跨端共享的 enums、输入校验、以及前端侧通用的错误码/错误结构（与 OpenAPI 对齐）。

### v0 请求、鉴权与错误模型（不含登录）

- Base URL：由 `apps/miniapp/.env.*` 注入（例如 `COMMERCE_API_BASE_URL`），在 `packages/commerce-services` 初始化时传入。
- Token：优先级建议为（1）本地存储（便于真机调试热切换）>（2）环境变量默认值；以 `Authorization: Bearer <token>` 注入每个请求。
- Error 归一化：在 requester/业务层把网络错误、非 2xx、以及后端 `ErrorResponse` 统一映射为同一种 `ApiError`（至少包含 `statusCode`、`requestId`、`message`、`details?`），并在交互状态机里基于 `statusCode` 做分支（尤其是 409）。
- Retry 策略：只对 GET 与幂等读接口进行自动重试（指数退避 + 上限）；写接口（加购/下单/确认导入）不自动重试，只暴露“用户可控的重试按钮”，并在下单时通过 `Idempotency-Key` 保证可恢复。

### v0 业务流程（交互 + 关键调用顺序）

1) 目录读（Catalog）：
   - 进入目录页：并行请求 `GET /catalog/categories` 与首屏 `GET /catalog/products`（带分页与筛选）；任何一个失败都要能单独重试，不影响另一个的已有数据展示。
   - 商品详情：`GET /catalog/products/{spuId}`；若 404/空数据，给出“返回列表/刷新”的可恢复路径。
   - 缓存：categories 可做会话级缓存（内存 + TTL），减少重复请求；products 列表按查询条件 key 做去重（inflight dedupe），避免快速切换筛选时回包覆盖。

2) 购物车（Cart）：
   - 进入购物车页：`GET /cart`；展示 loading/空态/错误态，并支持手动刷新。
   - 加购：`POST /cart/items` 成功后触发一次 `GET /cart` 刷新，确保服务端为准；如需“乐观更新”，也必须以刷新结果最终校正。
   - 数量修改/删除：优先走明确的写接口（若 OpenAPI 尚无则在 v0 补齐）；并在失败时回滚到刷新结果。

3) Excel 批量加购（Cart import job）：
   - 选择文件：通过 `packages/platform-adapter` 暴露统一的 `chooseFile`，限制扩展名与大小（尽早在客户端报错）。
   - 上传：用 `uploadFile` 上传到 `POST /cart/import-jobs`（multipart），拿到 jobId 与解析结果（`autoAddedItems/pendingItems/errors` 等）。
   - 预览与确认：展示“自动加购 vs 待确认”的差异（不要求 UI 细节），用户确认后调用 `POST /cart/import-jobs/{jobId}/confirm`，成功后刷新 `GET /cart`。
   - 错误提示：把服务端返回的“行号/列名/原因”结构化展示；允许用户在不改动购物车的情况下重新上传新文件。

4) 提交意向订单（Orders / SUBMITTED）：
   - 提交前：从“当前购物车快照 + 收货信息”构造请求体；校验必填字段；校验通过后进入 submitting 状态并禁止重复触发。
   - 幂等：首次提交生成一个 `Idempotency-Key` 并在“本次提交会话”内保留；若网络失败或用户点击“重试”，必须复用同一个 key，直到用户修改了关键输入（例如地址或商品集合）才生成新 key。
   - 成功：`POST /orders` 201 后跳转订单详情；并触发 `GET /cart` 刷新（预期同 SKU 被清理）。
   - 409（Conflict）：视为“可能已创建订单”。交互上提示用户“订单可能已提交”，并给出恢复路径：优先从错误 details 里解析出 `orderId`（若后端提供），否则引导用户进入订单列表/刷新最近订单（v0 可先提供一个最小的 `GET /orders` 列表接口或临时用后端日志/脚本辅助演示）。

5) 追踪查询（Tracking）：
   - 订单详情页进入时：请求 `GET /orders/{orderId}` + `GET /orders/{orderId}/tracking`；若无追踪信息，展示“待回传/可刷新”。
   - 写入追踪（回传运单号）属于 v0 的业务闭环，但不强制由 miniapp UI 承担；v0 演示可用 curl 或后续工具完成写入，前端侧只需把读取与刷新链路设计清楚。

## V1 Backlog (Not in v0)

v1 预期覆盖 `docs/需求文档.md` 的剩余模块：找不到商品（ProductRequests）+ 导出；收藏/常用清单（Wishlist）；议价入口（Inquiries + messages）并接入微信/支付宝客服聊天；售后（AfterSales + messages）并预留 AI 建议；客户归属/转移（Customers + transfer audit）；商品 Excel 导入（含图片/多规格）；支付（paymentEnabled 开关 + 真正跑通微信/支付宝支付与回调）；以及订单状态机（CONFIRMED/SHIPPED/DELIVERED 等）与更完善的运维审计。

为了让 v0 的数据/命名不阻塞 v1，前端侧在 v1 需要优先明确三条“主交互链”的 TS 业务逻辑与状态机：

1) 议价消息（Inquiries + messages）：以“会话”为聚合对象，消息发送需支持乐观 UI（先插入本地消息再确认送达）、失败重试、以及去重（按 messageId/clientMessageId）。与平台客服聊天的关系：v1 允许先走自建消息列表；若接入微信/支付宝客服，需要在 `packages/platform-adapter` 抽象“打开客服/发送消息/回调事件”，并保证不影响自建消息的记录一致性。

2) 售后（AfterSales + messages）：以“售后单”为聚合对象，交互链为“发起 -> 补充材料/沟通 -> 处理结果”。状态机需要区分“草稿/提交中/已提交/被拒绝/已完成”等，并与订单行项目绑定；消息链复用 inquiries 的消息抽象，避免重复实现。

3) 支付 + 订单状态机：支付是强副作用，需要在 TS 业务层封装“创建支付单 -> 调起支付（wx/my）-> 轮询/回查 -> 状态收敛”。交互上要区分“用户取消/支付失败/支付成功但回调延迟”，并把最终状态以服务端为准；相关接口需要幂等键与可恢复查询（paymentId/orderId）。

## Concrete Steps

从仓库根目录做一次现状验证（预期当前会失败，用于记录证据）：

    (cd services/commerce && go test ./...)

启动本地 Postgres：

    docker compose -f infra/dev/docker-compose.yml up -d

（实施里程碑 0 后）重新生成 sqlc 与 oapi-codegen（命令以最终落地的脚本为准；这里给出参考）：

    (cd services/commerce && go run github.com/sqlc-dev/sqlc/cmd/sqlc@v1.30.0 generate)

    (cd services/commerce && go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@v2.5.1 \
      -generate types,gin -package oapi \
      -o internal/http/oapi/api.gen.go \
      -include-tags Catalog,Cart,Orders,Tracking \
      ../../contracts/openapi/commerce.yaml)

（实施里程碑 3 后）生成 TS client（以最终脚本为准；这里给出参考）：

    pnpm -C packages/api-client run generate

（实施里程碑 2 后）应用迁移与 seed（以最终脚本为准）：

    bash tools/scripts/commerce-migrate.sh
    bash tools/scripts/commerce-seed.sh

启动服务（两种方式二选一）：

    export COMMERCE_DB_DSN="postgres://commerce:commerce@localhost:5432/commerce?sslmode=disable"
    go run ./services/commerce/cmd/commerce

或：

    (cd services/commerce && COMMERCE_DB_DSN="postgres://commerce:commerce@localhost:5432/commerce?sslmode=disable" go run ./cmd/commerce)

## Validation and Acceptance

以“行为可见”为验收标准：

1) 目录读：`GET /catalog/categories`、`GET /catalog/products`、`GET /catalog/products/{spuId}` 返回 200，且能看到 seed 数据（含 SKU 与价格阶梯）。

2) 购物车：`POST /cart/items` + `GET /cart` 可用；上传 Excel 到 `POST /cart/import-jobs` 返回 202 并给出 `autoAddedItems/pendingItems`；确认 `POST /cart/import-jobs/{jobId}/confirm` 后购物车数量变化符合预期。

3) 下单：`POST /orders` 返回 201 且 `status=SUBMITTED`；下单成功后，`GET /cart` 不再包含本次下单涉及的 SKU；当请求携带同一个 `Idempotency-Key` 再次提交时返回 409。

4) 追踪：`POST /orders/{orderId}/tracking` 与 `POST /shipments/import-jobs` 写入运单号后，`GET /orders/{orderId}/tracking` 能读到；同时 `GET /orders/{orderId}` 仍显示 `status=SUBMITTED`（确认追踪不改状态）。

5) TS 生成：运行生成命令后，`packages/api-client`（或最终选定的包）可以被 TypeScript 编译通过，并能在 README 示例中完成一次 typed 调用（不要求连接真实服务）。

6) TS 业务逻辑：`packages/commerce-services` 可以通过 TypeScript 编译，并在 README 示例中覆盖至少一条 v0 主流程（例如：目录读 -> 加购 -> 下单 -> 处理 409 的恢复分支；不要求真实连接服务，可用 mock requester）。

## Idempotence and Recovery

迁移与 seed 必须可重复执行（脚本内应使用 `CREATE TABLE IF NOT EXISTS` 的既有迁移与 upsert/存在即跳过的 seed 策略）。若本地数据污染，可通过删除 docker volume 或重建 `commerce` 数据库恢复；重新执行迁移与 seed 后仍可验收通过。

sqlc 与 oapi-codegen 的生成过程必须可重复执行；计划要求把命令固化到脚本/Makefile，避免手工命令漂移。

## Artifacts and Notes

用于验收的关键接口示例（参数以实现为准）：

    curl http://localhost:8080/health
    curl http://localhost:8080/catalog/products?page=1&pageSize=20

    curl -H "Content-Type: application/json" \
      -H "Idempotency-Key: demo-001" \
      -d '{"address":{"receiverName":"A","receiverPhone":"1","detail":"X"},"items":[{"skuId":"<uuid>","qty":2}]}' \
      http://localhost:8080/orders

## Interfaces and Dependencies

后端依赖与边界：

1) sqlc：所有新的 DB 能力优先落在 `services/commerce/queries/*.sql` 并生成到 `services/commerce/internal/db/*.go`，业务代码只通过 `*db.Queries` 或 `WithTx` 访问数据库。

2) oapi-codegen：只修改 `contracts/openapi/*.yaml` 与生成命令/脚本；不直接修改 `services/commerce/internal/http/oapi/api.gen.go`。

3) Excel：继续使用 `github.com/xuri/excelize/v2`；模板文件不落库不入仓库，测试用例在内存生成 workbook。

前端 TS 对齐依赖：

1) `orval`：生成 typed client；通过 mutator 统一走自定义 requester。

2) requester：优先复用 `packages/openapi-client` 的 URL/query 构造能力，平台侧优先复用 `packages/platform-adapter` 的 request 能力（wx/my），并提供非小程序环境的 fallback（fetch）。

3) 包职责边界（避免耦合与漂移）：
   - `packages/api-client`：只做“生成层”（types + operations）。不写业务默认值、不做缓存、不做跨接口编排。
   - `packages/commerce-services`：只做“业务编排与交互状态机”，负责幂等 key 生命周期、错误归一化、inflight 去重、以及与本地存储的最小交互（例如 token）。
   - `apps/miniapp`：只通过 `packages/commerce-services` 调用后端；页面/组件不直接依赖生成 client。

## Plan Revision Note

2026-01-22：根据与产品方确认的 v0 决策（1a/2a/3a/4b/5c）重写 `.agent/PLANS.md`，并纠正仓库现状与生成链路的偏差，确保计划可指导“先修编译再补行为再做 TS 生成”。

2026-01-22 17:58Z：补充 v0/v1 前端（miniapp）TS 业务逻辑与交互设计规划，明确 `/packages` 地基拆包（`packages/api-client` + `packages/commerce-services`）以及 v0 的 dev token 鉴权策略。
