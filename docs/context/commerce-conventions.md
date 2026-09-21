# Commerce 约定

## 价格与货币
- 所有价格字段使用 `fen`（分）为单位，类型为 `int64`，API 字段命名为 `unitPriceFen`。
- 严禁在后端与接口层使用 `float` 表示价格；展示层需要换算时在边界做转换。
- 数据库存储字段示例：`catalog_price_tiers.unit_price_fen`、`order_items.unit_price_fen`。
- 业务逻辑内部优先使用 `packages/go-shared/money` 的 `money.Fen`，边界层（HTTP/DB）再做显式转换。
- 前端/TS DTO 使用 `packages/shared` 中的 `MoneyFen` 类型，语义与后端保持一致。

## SKU 规格与层级
- 每个商品通过有序 `filterDimensions` 配置 1～3 级规格名称，名称不可为空或重复；每个有效 SKU 在 `attributes` 中填写各级值，并保证完整组合唯一。允许只维护实际存在的组合。
- 名称由商品独立设置，客户按顺序逐级选择。切换上级清空后续选择；停用或规格不完整的 SKU 不提供购买选项。
- `spec` 是从各级属性值按顺序以 ` / ` 拼接的完整路径摘要；单级保持原值。它用于展示及原有名称+规格匹配，不再是独立维护的多级规格来源。
- 无 `filterDimensions` 的历史商品按一级“规格”展示，值取 `spec` 或 SKU 名称。旧 `attributes.spec` 仅作无维度商品的读取兼容；如果管理员明确命名某层为 `spec`，则该属性属于正常规格值。
- 管理端 PATCH 可传完整 `skus` 集合，商品、规格、SKU 和价格在一个事务中保存。重命名保留 SKU ID，移除 SKU 仅停用。省略集合是普通商品更新；SKU 省略 `priceTiers` 保留原价，传空数组清空价格。
- 商品导入按 Product ID/SKU ID 优先定位，再匹配 SKU Code；ID、编码或商品归属冲突必须拒绝。未出现在文件中的 SKU 保留；导入后的全部有效组合必须合法。购物车导入仍优先 SKU ID/Code，否则名称+完整 spec 精确匹配，歧义交给用户确认。
- 商品 Excel 使用六列规格名称和值，一行一个 SKU；无 SKU 商品允许商品行。导出包含商品/SKU ID、商品状态、停用 SKU、原始图片 URL 与阶梯价，可重复回导。新商品未填状态默认 DRAFT，已有商品未填状态保持原状。

## 事务与幂等
- 订单创建必须在单一事务内完成（`orders` + `order_items`），任何校验失败不应留下部分数据。
- 幂等策略基于 `Idempotency-Key` Header，服务端在 `(customer_id, idempotency_key)` 上建立唯一约束并对重复请求返回 `409`。
- 业务侧如需返回已创建的订单，需在此基础上扩展策略（当前行为为返回冲突）。

## 生成与迁移
- 结构变更需同步更新 migrations 与 queries，并重新生成 sqlc 与 oapi-codegen 输出。
- 生成文件仅由工具生成，不直接编辑。
