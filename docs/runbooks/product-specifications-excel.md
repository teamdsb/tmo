# 商品规格与 Excel 导入导出

## 维护与购买

在 admin 商品列表打开商品编辑器。规格区域默认一级“规格”，可以添加至三级，并修改每层名称。每行是一个真实 SKU 组合，填写各级值、编码、启用状态与基础售价。删除末级后如果两个有效 SKU 变成相同组合，系统会指出冲突行，需要先调整组合再保存。重命名不会重建 SKU；删除 SKU 行会将原记录停用。

小程序详情和购物车换规格使用相同的逐级选择方式。上级未选不能选择下级，切换上级后需要重新选择后续值；只有实际有效组合可以加购。

## 模板与导出

在 admin 导入页下载商品模板，只接受 .xlsx，读取第一张工作表。第一行是英文表头，第二行起每行一个 SKU；同一商品使用相同 Group Key。导出当前筛选结果会处理所有匹配页，完成后下载 products.xlsx。

新增列为 Product ID、SKU ID、Product Status、Spec 1 Name、Spec 1 Value、Spec 2 Name、Spec 2 Value、Spec 3 Name、Spec 3 Value。例如三级行填写“材质 / 钢、长度 / 20mm、直径 / M6”。同一商品各行的层级名称与顺序必须相同；后续级别可以整级留空，不得跳级。

保留 Group Key、Product Name、Category ID、SKU Code、SKU Name、Description、Cover Image、Images、Tags、Unit、Is Active、Price Tiers (Fen) 等原有列。Category ID 填真实分类 UUID。Price Tiers (Fen) 示例为 1-9:1200|10-:1000，价格单位是分；空价格单元格会清除该 SKU 的原阶梯价。Attributes 支持 JSON 对象以完整保留包含分隔符的扩展属性；导出使用 JSON。Images、Tags 和 Filter Dimensions 同时接受 JSON 数组或原有竖线分隔格式。

旧文件可继续使用 Filter Dimensions 与 Attributes，或无维度的 Spec 列。六列显式规格和旧字段同时填写时必须一致，冲突会明确报错。Spec 是系统生成的完整路径摘要，修改名称/值时建议清空旧 Spec 和 Filter Dimensions，并同步移除 Attributes 中旧规格属性，保留扩展属性即可。

## 回导与错误处理

导出文件中的 Product ID 和 SKU ID 保持不变，系统优先按 ID 定位，再匹配 SKU Code。不要将现有 SKU ID 移到另一个商品；编码命中另一 SKU 时会拒绝。缺少 ID 和编码的新行会作为新 SKU，因此回导时保留导出 ID。重复导入原导出文件不会新增商品或 SKU。

Product Status 为 DRAFT、ACTIVE 或 INACTIVE。空状态在新建时默认 DRAFT，更新时保留已有状态。Is Active 控制 SKU 启用状态，与商品状态独立。无 SKU 商品导出商品行，其 SKU 字段全部留空，回导仍无 SKU。

导入不会删除文件中未列出的 SKU，但会检查最终所有有效 SKU 的组合。修改层级时应完整导出该商品后再编辑回导，避免未列出的 SKU 缺少新层级值。任一行出错会使该商品组整体失败；其他合法商品组继续处理，通过错误报告修正失败组后重试。

图片导出为原始 URL；本地图片仍可在 ZIP 中与 Excel 一起上传。导出不把图片转换成临时网关代理 URL。

## 验证

后端运行 go test ./...（services/commerce 目录），数据库集成需要 COMMERCE_DB_DSN 指向独立测试库；测试会清理业务表，不能使用生产库。admin 的 product-specs.mock.spec.ts 覆盖三级编辑与 mock 导出回导，小程序商品详情与购物车 Jest 测试覆盖逐级选择。异步商品导出使用 POST /admin/products/export-jobs，GET /admin/import-jobs/{jobId} 查询状态和结果下载地址。
