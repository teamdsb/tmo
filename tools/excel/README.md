# Excel templates

商品模板的定义位于 `services/commerce/internal/excel/templates.go`；admin 导入页可下载同结构模板。商品导出使用相同表头，可修改后回导。

填写方法、三级规格与匹配规则见 [商品规格和 Excel 操作说明](../../docs/runbooks/product-specifications-excel.md)。不要再将单个 `Spec` 列当作多级规格的独立数据源。
