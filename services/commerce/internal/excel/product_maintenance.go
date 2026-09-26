package excel

import "github.com/xuri/excelize/v2"

// Keep the existing wire template stable; the operator workbook is ordered for maintenance.
func ProductMaintenanceTemplate() TemplateSpec {
	return TemplateSpec{Name: "product_maintenance", SheetName: "商品维护", Required: []string{"groupkey", "productname", "categoryid"}, Columns: []TemplateColumn{
		{Key: "productname", Header: "商品名称"}, {Key: "groupkey", Header: "商品分组"},
		{Key: "skuname", Header: "SKU名称"}, {Key: "skucode", Header: "SKU编码"},
		{Key: "spec1name", Header: "一级规格名称"}, {Key: "spec1value", Header: "一级规格值"},
		{Key: "spec2name", Header: "二级规格名称"}, {Key: "spec2value", Header: "二级规格值"},
		{Key: "spec3name", Header: "三级规格名称"}, {Key: "spec3value", Header: "三级规格值"},
		{Key: "unit", Header: "单位"}, {Key: "pricetiers", Header: "阶梯价格（分）"},
		{Key: "categoryid", Header: "分类ID"}, {Key: "description", Header: "商品描述"},
		{Key: "coverimage", Header: "封面图片"}, {Key: "images", Header: "商品图片"},
		{Key: "tags", Header: "标签"}, {Key: "productstatus", Header: "商品状态"},
		{Key: "isactive", Header: "SKU启用"}, {Key: "attributes", Header: "扩展属性"},
		{Key: "spec", Header: "规格摘要"}, {Key: "filterdimensions", Header: "规格层级"},
		{Key: "productid", Header: "商品ID"}, {Key: "skuid", Header: "SKU ID"},
	}}
}

func FormatProductWorkbook(file *excelize.File, sheet string, columns int) error {
	last, err := excelize.ColumnNumberToName(columns)
	if err != nil {
		return err
	}
	style, err := file.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Color: "FFFFFF", Size: 11},
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"245C52"}, Pattern: 1},
		Alignment: &excelize.Alignment{Vertical: "center", WrapText: true},
	})
	if err != nil {
		return err
	}
	if err := file.SetCellStyle(sheet, "A1", last+"1", style); err != nil {
		return err
	}
	if err := file.SetRowHeight(sheet, 1, 32); err != nil {
		return err
	}
	if err := file.SetColWidth(sheet, "A", last, 20); err != nil {
		return err
	}
	if err := file.SetColWidth(sheet, "A", "A", 32); err != nil {
		return err
	}
	return file.SetPanes(sheet, &excelize.Panes{Freeze: true, YSplit: 1, TopLeftCell: "A2", ActivePane: "bottomLeft"})
}
