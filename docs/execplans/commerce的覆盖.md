# Commerce MVP 纵切落地计划

本 ExecPlan 是一个持续更新的文档。`Progress`、`Surprises & Discoveries`、`Decision Log`、`Outcomes & Retrospective` 这些部分在工作推进时必须同步更新。

本计划必须遵守仓库根目录的 `docs/execplans/PLANS.md`。

## Purpose / Big Picture

完成后，开发者可以在本地启动 commerce 服务，Catalog 浏览与 `POST /catalog/products` 仍保持公开；类目与 SKU 维护、购物车与意向订单使用带 JWT 的 HTTP 请求。系统支持创建类目、商品与 SKU，查询商品列表与详情（包含 SKU 与价格阶梯），对登录用户执行购物车增删改查并提交意向订单（支付保持关闭），以及通过 Excel 实现批量加购与运单号回传导入。可见性标准是：服务启动后 `/health` 返回 200；一套 curl 流程能创建类目/商品/SKU、将 SKU 加入购物车并提交订单；上传 Excel 能生成批量加购作业并可确认；上传运单号 Excel 能生成导入作业并写入追踪信息；订单状态为 `SUBMITTED` 且订单详情包含 SKU、数量与单价。

## Progress

- [x] (2026-01-22 07:15Z) 基于当前仓库状态与需求覆盖情况起草 ExecPlan。
- [x] (2026-01-22 07:54Z) 确认默认决策范围并更新 ExecPlan（1b/2b/3a/4b）。
- [ ] (2026-01-22 07:15Z) 完成里程碑 1：鉴权骨架 + Catalog 完整化（类目/SKU/价格阶梯）+ 测试。
- [ ] (2026-01-22 07:15Z) 完成里程碑 2：购物车接口与持久化 + Excel 批量加购 + 测试。
- [ ] (2026-01-22 07:15Z) 完成里程碑 3：意向订单接口与持久化 + 运单号回传/导入 + 测试与验收流程。

## Surprises & Discoveries

- Observation: `services/gateway-bff` 目前没有可执行代码，仅看到 README，说明网关鉴权链路尚未落地。
  Evidence: `rg --files services/gateway-bff` 仅返回 `services/gateway-bff/README.md`。
- Observation: `services/commerce/internal/modules/*` 仅有 `.gitkeep`，域模块还未实现。
  Evidence: `find services/commerce/internal/modules -type f` 仅列出 `.gitkeep`。

## Decision Log

- Decision: MVP 第一阶段范围选择“目录 + 购物车 + 意向订单 + Excel 批量加购/运单号回传，支付保持关闭”。
  Rationale: 先打通交易闭环并将导入作业纳入，避免后期返工接口与数据结构。
  Date/Author: 2026-01-22 / Codex

- Decision: 鉴权先落在 commerce 服务内部，由服务验证 JWT 并做最小 RBAC。
  Rationale: gateway-bff 目前为空，先在服务内完成可运行闭环，后续可将同一中间件迁移到网关。
  Date/Author: 2026-01-22 / Codex

- Decision: 类目/商品/SKU 维护先通过最小化 admin API（HTTP 接口，不做 admin-web）。
  Rationale: API 方式最小成本满足维护需要，同时不阻塞前端 UI 的推进。
  Date/Author: 2026-01-22 / Codex

- Decision: `POST /catalog/products` 暂保持公开，`GET /catalog/products` 与 `GET /catalog/categories` 继续公开访问。
  Rationale: 先保持接入门槛低，后续再评估是否需要权限收紧。
  Date/Author: 2026-01-22 / Codex

- Decision: SKU 创建采用独立接口 `POST /catalog/products/{spuId}/skus`，不改动 `CreateCatalogProductRequest` 的结构。
  Rationale: 便于后续追加 SKU 与价格阶梯，避免把大对象塞进商品创建请求。
  Date/Author: 2026-01-22 / Codex

- Decision: Excel 批量加购与运单号回传采用 import job 方式落地，先做同步解析并写入结果的最小实现。
  Rationale: 保持契约语义与可验收输出，同时避免引入异步作业调度复杂度。
  Date/Author: 2026-01-22 / Codex

## Outcomes & Retrospective

尚未开始实施；在每个里程碑完成后补充达成情况、遗留与经验。

## Context and Orientation

该仓库为单体仓库，commerce 服务位于 `services/commerce`。HTTP 接入基于 Gin，OpenAPI 由 oapi-codegen 生成，生成文件是 `services/commerce/internal/http/oapi/api.gen.go`（不可手改），处理器位于 `services/commerce/internal/http/handler/`。数据库迁移在 `services/commerce/migrations/`，sqlc 查询在 `services/commerce/queries/` 并生成到 `services/commerce/internal/db/`。合约位于 `contracts/openapi/commerce.yaml`，服务边界约定在 `contracts/README.md`。已有的启动与工具链基础在 `docs/execplans/commerce初始化.md` 中建立，本计划在其基础上继续。

Commerce 现状仅覆盖 Catalog 的最小部分：`GET /catalog/products`（支持 `q` 模糊搜、`categoryId` 过滤、分页）、`POST /catalog/products`（创建 SPU）、`GET /catalog/products/{spuId}`（详情，但 `skus` 为空）、`GET /catalog/categories`（目前直接返回空列表）。实现位于 `services/commerce/internal/http/handler/catalog.go` 与 `services/commerce/internal/http/oapi/api.gen.go`。数据层只有 `catalog_products` 表，迁移为 `services/commerce/migrations/00001_create_catalog_products.sql`，查询为 `services/commerce/queries/catalog.sql`，没有类目、SKU、价格阶梯、购物车、订单、售后、追踪等表。`services/commerce/internal/modules/*` 仍为占位目录。

覆盖 `docs/需求文档.md` 的情况为：模块一“商品与下单”仅覆盖商品菜单与搜索/详情的最小后端雏形（类目空实现，详情无 SKU/价格），未覆盖购物车、地址、意向订单、收藏；模块二“需求收集 & Excel”、模块三“业务员绑定/客户归属”、模块四“售后 + AI 预留”、模块五“价格体系/议价”、模块六“支付”均未覆盖；新增的订单追踪/运单号回传与 Excel 批量加购亦未覆盖。

契约边界总体契合 `contracts/README.md`：commerce 目前只做 catalog 数据读写，没有揉进身份或支付。但契约大量接口默认 `bearerAuth`，目前没有 gateway-bff/identity 鉴权链路；同时 `contracts/openapi/commerce.yaml` 中 `POST /catalog/products` 仍是 `security: []`（公开），本计划暂不收紧。

术语说明：SPU（Standard Product Unit）是商品的基础记录；SKU（Stock Keeping Unit）是带规格的库存单元；价格阶梯指按数量区间计算的单价；意向订单是未支付、用于询价或确认的订单记录；BFF（Backend for Frontend）是面向前端的聚合服务；RBAC 是基于角色的权限控制；JWT 是带签名的用户身份令牌。

## Plan of Work

本计划选择的默认范围是“目录 + 购物车 + 意向订单 + Excel 批量加购/运单号回传（支付关闭）”，并在 commerce 内实现最小 JWT 鉴权与角色控制。售后与议价保持为后续工作；追踪仅实现运单号回传与 Excel 导入。`POST /catalog/products` 保持公开，其余管理类接口要求登录。codegen 覆盖 Catalog、Cart、Orders、Tracking 标签。

里程碑 1 需要补齐鉴权与 Catalog 数据模型。先在 `services/commerce/internal/config/config.go` 增加鉴权配置（例如 `COMMERCE_JWT_SECRET`、`COMMERCE_JWT_ISSUER`、`COMMERCE_AUTH_ENABLED`），实现一个 Gin 中间件，从 `Authorization: Bearer <token>` 解析 JWT（HMAC），把 `sub` 作为用户 ID、`role` 作为角色写入 `context.Context`。在 handler 中增加权限检查函数（例如 `requireRole`），用于保护 admin 类接口。然后扩充数据层：新增迁移创建 `catalog_categories`、`catalog_skus`、`catalog_price_tiers` 表，并在 `services/commerce/queries/` 中增加 `CreateCategory`、`ListCategories`、`CreateSku`、`ListSkusByProduct`、`ListPriceTiersBySku` 等查询。更新 `GetCatalogCategories` 为真实读库，更新商品详情返回 SKU 与价格阶梯，类目/SKU 创建接口要求登录且角色为 admin/staff，`POST /catalog/products` 保持公开。同步修改 `contracts/openapi/commerce.yaml`，新增 `POST /catalog/categories` 与 `POST /catalog/products/{spuId}/skus`，并重新运行 oapi-codegen 生成接口定义。单元测试与集成测试需补齐类目与 SKU 的创建/查询，并更新集成测试使其按顺序应用所有 migrations。

里程碑 2 实现购物车与 Excel 批量加购。新增 `cart_items` 表（含 `owner_user_id`、`sku_id`、`qty` 等字段）与对应 sqlc 查询（`UpsertCartItem`、`ListCartItems`、`UpdateCartItemQty`、`DeleteCartItem`），并实现 `GET /cart`、`POST /cart/items`、`PATCH /cart/items/{itemId}`、`DELETE /cart/items/{itemId}`。同时新增 `cart_import_jobs` 与 `cart_import_rows` 表，支持 `POST /cart/import-jobs` 上传 Excel、`GET /cart/import-jobs/{jobId}` 查看结果、`POST /cart/import-jobs/{jobId}/confirm` 确认待匹配行。Excel 解析采用 `.xlsx`，表头定义为 `skuId`、`skuCode`、`name`、`spec`、`qty`，匹配规则为优先 `skuId`/`skuCode`，否则以 `name+spec` 匹配 SKU 名称与属性；多匹配记为 `AMBIGUOUS`，无匹配记为 `NOT_FOUND`，并存入 `pendingItems`。导入作业在上传时同步解析，状态设置为 `SUCCEEDED`，`progress=100`，确认接口仅对 `pendingItems` 写入购物车。所有 cart 接口要求登录，返回的 `CartItem` 需嵌入 SKU 与价格阶梯信息。对“同一用户同一 SKU”的新增逻辑使用 UPSERT 合并数量，避免重复行。补齐 handler 测试与 DB 集成测试，验证增删改查、导入作业与权限校验。

里程碑 3 实现意向订单与运单号回传/导入。新增 `orders` 与 `order_items` 表（包含 `status`、`address` JSONB、`remark`、`customer_id`、`owner_sales_user_id`、`idempotency_key`），并增加 `CreateOrder`、`CreateOrderItem`、`ListOrders`、`CountOrders`、`GetOrder`、`ListOrderItems` 查询。`POST /orders` 根据请求体生成订单（默认 `SUBMITTED`），按 SKU 价格阶梯计算 `unit_price`，并在提供 `Idempotency-Key` 时实现幂等性（重复 key 返回 409）。`GET /orders` 根据角色做最小范围过滤：customer 仅能看到自身订单，staff/admin 可按 `customerId`/`ownerSalesUserId` 过滤。`GET /orders/{orderId}` 返回订单详情。\n\n追踪部分新增 `order_tracking_shipments` 表，支持 `GET /orders/{orderId}/tracking` 和 `POST /orders/{orderId}/tracking`，以 `waybillNo` 为唯一键做合并更新。实现 `POST /shipments/import-jobs` 上传 Excel（`.xlsx`），表头定义为 `orderId`、`waybillNo`、`carrier`、`shippedAt`，上传时同步解析并写入追踪信息，返回 `ImportJob`（`type=SHIPMENT_IMPORT`、`status=SUCCEEDED`、`progress=100`）。更新测试覆盖订单与追踪路径。支付与售后/议价仍保持未实现。

## Concrete Steps

在仓库根目录执行以下步骤（路径以仓库根目录为基准，命令示例可按实际环境调整）。

生成或更新数据库迁移与 sqlc 代码（工作目录 `services/commerce`，若缺少工具可先安装）：

    go install github.com/sqlc-dev/sqlc/cmd/sqlc@v1.30.0
    go install github.com/pressly/goose/v3/cmd/goose@v3.26.0
    cd /Users/asimov3059/工作代码/tmall/tmo/services/commerce
    # 新增 migrations/00002_create_catalog_categories.sql、00003_create_catalog_skus.sql、00004_create_cart_orders.sql、00005_create_cart_import_jobs.sql、00006_create_tracking_shipments.sql 等迁移文件
    sqlc generate

应用迁移并重新生成 OpenAPI 代码（仅包含 Catalog、Cart、Orders）：

    export COMMERCE_DB_DSN="postgres://commerce:commerce@localhost:5432/commerce?sslmode=disable"
    cd /Users/asimov3059/工作代码/tmall/tmo/services/commerce
    goose -dir ./migrations postgres "$COMMERCE_DB_DSN" up
    go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen -generate types,gin -package oapi -o internal/http/oapi/api.gen.go -include-tags Catalog,Cart,Orders,Tracking ../../contracts/openapi/commerce.yaml

运行测试：

    cd /Users/asimov3059/工作代码/tmall/tmo/services/commerce
    go test ./...

启动服务并准备验证：

    export COMMERCE_JWT_SECRET="dev-secret"
    export COMMERCE_AUTH_ENABLED="true"
    go run ./cmd/commerce

## Validation and Acceptance

验收以可观测行为为准：服务启动后 `GET /health` 返回 200 且 body 为 `OK`；admin 角色可创建类目与 SKU 并在 `GET /catalog/categories`、`GET /catalog/products/{spuId}` 中看到 SKU 与价格阶梯（`POST /catalog/products` 保持公开）；customer 角色可通过 `POST /cart/items` 和 `GET /cart` 验证购物车行为；上传 Excel 到 `/cart/import-jobs` 返回 `CartImportJob`，`GET /cart/import-jobs/{jobId}` 可看到 `pendingItems`，`POST /cart/import-jobs/{jobId}/confirm` 能把选中的 SKU 写入购物车；`POST /orders` 返回 `Order` 且状态为 `SUBMITTED`，重复提交相同 `Idempotency-Key` 返回 409；上传运单号 Excel 到 `/shipments/import-jobs` 返回 `ImportJob` 并且 `GET /orders/{orderId}/tracking` 可看到对应运单号。

生成测试 JWT 的最小方法（示例输出为 bearer token）：

    cat > /tmp/gen-jwt.go <<'EOF'
    package main
    import (
        "fmt"
        "time"
        "github.com/golang-jwt/jwt/v5"
    )
    func main() {
        secret := []byte("dev-secret")
        claims := jwt.MapClaims{
            "sub": "11111111-1111-1111-1111-111111111111",
            "role": "admin",
            "exp": time.Now().Add(24 * time.Hour).Unix(),
        }
        token, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)
        fmt.Println(token)
    }
    EOF
    go run /tmp/gen-jwt.go

## Idempotence and Recovery

迁移文件按序追加且使用 `CREATE TABLE IF NOT EXISTS`，重复执行 `goose up` 或 `sqlc generate` 是安全的。若需要回滚单次迁移，可使用 `goose down` 回退最近一次迁移（会删除对应表），建议在本地开发库上执行而非生产数据。若生成的 `api.gen.go` 出现冲突，重新运行 oapi-codegen 生成即可恢复。

## Artifacts and Notes

预期的关键输出示例（截断）：

    GET /health -> 200 OK
    POST /catalog/categories -> 201 {"id":"...","name":"工业管材","parentId":null,"sort":0}
    POST /catalog/products -> 201 {"product":{"id":"...","name":"Steel Pipe","categoryId":"..."},"skus":[...]}
    POST /cart/items -> 200 {"items":[{"sku":{"id":"..."},"qty":10}],"updatedAt":"..."}
    POST /cart/import-jobs -> 202 {"id":"...","type":"CART_IMPORT","status":"SUCCEEDED","progress":100,"result":{"autoAddedCount":1,"pendingCount":1}}
    POST /orders -> 201 {"id":"...","status":"SUBMITTED","items":[{"sku":{"id":"..."},"qty":10,"unitPrice":12.5}],"createdAt":"..."}
    POST /shipments/import-jobs -> 202 {"id":"...","type":"SHIPMENT_IMPORT","status":"SUCCEEDED","progress":100}

## Interfaces and Dependencies

为保证可测试性与清晰分层，在 `services/commerce/internal/modules/` 下定义最小接口并由 `*db.Queries` 实现。接口签名使用 sqlc 生成的参数/返回类型，避免重复定义数据结构。

在 `services/commerce/internal/modules/catalog/store.go` 定义：

    package catalog
    type Store interface {
        CreateProduct(ctx context.Context, arg db.CreateProductParams) (db.CatalogProduct, error)
        ListProducts(ctx context.Context, arg db.ListProductsParams) ([]db.CatalogProduct, error)
        CountProducts(ctx context.Context, arg db.CountProductsParams) (int64, error)
        GetProduct(ctx context.Context, id uuid.UUID) (db.CatalogProduct, error)
        CreateCategory(ctx context.Context, arg db.CreateCategoryParams) (db.CatalogCategory, error)
        ListCategories(ctx context.Context) ([]db.CatalogCategory, error)
        CreateSku(ctx context.Context, arg db.CreateSkuParams) (db.CatalogSku, error)
        ListSkusByProduct(ctx context.Context, spuID uuid.UUID) ([]db.CatalogSku, error)
        ListPriceTiersBySku(ctx context.Context, skuID uuid.UUID) ([]db.CatalogPriceTier, error)
    }

在 `services/commerce/internal/modules/cart/store.go` 定义：

    package cart
    type Store interface {
        UpsertCartItem(ctx context.Context, arg db.UpsertCartItemParams) (db.CartItem, error)
        ListCartItems(ctx context.Context, ownerID uuid.UUID) ([]db.CartItem, error)
        UpdateCartItemQty(ctx context.Context, arg db.UpdateCartItemQtyParams) (db.CartItem, error)
        DeleteCartItem(ctx context.Context, id uuid.UUID) error
        CreateCartImportJob(ctx context.Context, arg db.CreateCartImportJobParams) (db.CartImportJob, error)
        ListCartImportRows(ctx context.Context, jobID uuid.UUID) ([]db.CartImportRow, error)
        UpdateCartImportRowSelection(ctx context.Context, arg db.UpdateCartImportRowSelectionParams) error
    }

在 `services/commerce/internal/modules/order/store.go` 定义：

    package order
    type Store interface {
        CreateOrder(ctx context.Context, arg db.CreateOrderParams) (db.Order, error)
        CreateOrderItem(ctx context.Context, arg db.CreateOrderItemParams) (db.OrderItem, error)
        ListOrders(ctx context.Context, arg db.ListOrdersParams) ([]db.Order, error)
        CountOrders(ctx context.Context, arg db.CountOrdersParams) (int64, error)
        GetOrder(ctx context.Context, id uuid.UUID) (db.Order, error)
        ListOrderItems(ctx context.Context, orderID uuid.UUID) ([]db.OrderItem, error)
        GetOrderByIdempotencyKey(ctx context.Context, key string) (db.Order, error)
    }

在 `services/commerce/internal/modules/tracking/store.go` 定义：

    package tracking
    type Store interface {
        UpsertTrackingShipment(ctx context.Context, arg db.UpsertTrackingShipmentParams) ([]db.TrackingShipment, error)
        ListTrackingShipments(ctx context.Context, orderID uuid.UUID) ([]db.TrackingShipment, error)
        CreateImportJob(ctx context.Context, arg db.CreateImportJobParams) (db.ImportJob, error)
    }

鉴权依赖 `github.com/golang-jwt/jwt/v5`，在 `services/commerce/internal/http/middleware/auth.go` 实现 `ParseClaims(c *gin.Context) (Claims, bool)` 与 `RequireRole(roles ...string) gin.HandlerFunc`。`Claims` 至少包含 `UserID uuid.UUID` 与 `Role string`，从 `sub` 和 `role` claim 解析。所有需要登录的 handler 在进入业务逻辑前调用 `RequireRole`，未授权返回 401/403，并使用 `packages/go-shared/errors` 统一错误格式。Excel 解析使用 `github.com/xuri/excelize/v2` 并限制 `.xlsx` 输入，解析失败返回 400。

变更说明（2026-01-22 07:54Z）：根据确认的默认决策（1b/2b/3a/4b）更新范围与里程碑，纳入 Excel 批量加购与运单号回传，保持 `POST /catalog/products` 公开，并同步调整验收与接口说明。
