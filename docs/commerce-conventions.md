# Commerce 约定

## 价格与货币
- 所有价格字段使用 `fen`（分）为单位，类型为 `int64`，API 字段命名为 `unitPriceFen`。
- 严禁在后端与接口层使用 `float` 表示价格；展示层需要换算时在边界做转换。
- 数据库存储字段示例：`catalog_price_tiers.unit_price_fen`、`order_items.unit_price_fen`。
- 业务逻辑内部优先使用 `packages/go-shared/money` 的 `money.Fen`，边界层（HTTP/DB）再做显式转换。

## SKU 规格（spec）
- `spec` 是 SKU 的主规格字段（规范化字符串），同时持久化到 `catalog_skus.spec`，并暴露在 API 的 `SKU.spec` / `CreateSkuRequest.spec`。
- `attributes` 只保留扩展属性，不再重复写入 `spec`，避免双写和歧义。
- Excel 等匹配逻辑优先使用 `skuId`/`skuCode`，否则使用 `name + spec` 进行精确匹配。

## 事务与幂等
- 订单创建必须在单一事务内完成（`orders` + `order_items`），任何校验失败不应留下部分数据。
- 幂等策略基于 `Idempotency-Key` Header，服务端在 `(customer_id, idempotency_key)` 上建立唯一约束并对重复请求返回 `409`。
- 业务侧如需返回已创建的订单，需在此基础上扩展策略（当前行为为返回冲突）。

## 生成与迁移
- 结构变更需同步更新 migrations 与 queries，并重新生成 sqlc 与 oapi-codegen 输出。
- 生成文件仅由工具生成，不直接编辑。
