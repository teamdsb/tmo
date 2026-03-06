package excel

type TemplateColumn struct {
	Key    string
	Header string
}

type TemplateSpec struct {
	Name        string
	SheetName   string
	Columns     []TemplateColumn
	Required    []string
	RequiredAny [][]string
}

func CartImportTemplate() TemplateSpec {
	return TemplateSpec{
		Name:      "cart_import",
		SheetName: "Cart Import",
		Columns: []TemplateColumn{
			{Key: "skuid", Header: "SKU ID"},
			{Key: "skucode", Header: "SKU Code"},
			{Key: "name", Header: "Name"},
			{Key: "spec", Header: "Spec"},
			{Key: "qty", Header: "Qty"},
		},
		Required: []string{"qty"},
		RequiredAny: [][]string{
			{"skuid", "skucode", "name"},
		},
	}
}

func ShipmentImportTemplate() TemplateSpec {
	return TemplateSpec{
		Name:      "shipment_import",
		SheetName: "Shipment Import",
		Columns: []TemplateColumn{
			{Key: "orderid", Header: "Order ID"},
			{Key: "waybillno", Header: "Waybill No"},
			{Key: "carrier", Header: "Carrier"},
			{Key: "shippedat", Header: "Shipped At"},
		},
		Required: []string{"orderid", "waybillno"},
	}
}

func ProductImportTemplate() TemplateSpec {
	return TemplateSpec{
		Name:      "product_import",
		SheetName: "Product Import",
		Columns: []TemplateColumn{
			{Key: "groupkey", Header: "Group Key"},
			{Key: "skucode", Header: "SKU Code"},
			{Key: "productname", Header: "Product Name"},
			{Key: "skuname", Header: "SKU Name"},
			{Key: "categoryid", Header: "Category ID"},
			{Key: "description", Header: "Description"},
			{Key: "coverimage", Header: "Cover Image"},
			{Key: "images", Header: "Images"},
			{Key: "tags", Header: "Tags"},
			{Key: "filterdimensions", Header: "Filter Dimensions"},
			{Key: "spec", Header: "Spec"},
			{Key: "attributes", Header: "Attributes"},
			{Key: "unit", Header: "Unit"},
			{Key: "isactive", Header: "Is Active"},
			{Key: "pricetiers", Header: "Price Tiers (Fen)"},
		},
		Required: []string{"groupkey", "productname", "categoryid"},
	}
}

func ProductRequestExportTemplate() TemplateSpec {
	return TemplateSpec{
		Name:      "product_request_export",
		SheetName: "需求导出",
		Columns: []TemplateColumn{
			{Key: "id", Header: "需求ID"},
			{Key: "createdbyuserid", Header: "提交人ID"},
			{Key: "ownersalesuserid", Header: "归属销售ID"},
			{Key: "name", Header: "商品名称"},
			{Key: "categoryid", Header: "类目ID"},
			{Key: "spec", Header: "规格"},
			{Key: "material", Header: "材质"},
			{Key: "dimensions", Header: "尺寸"},
			{Key: "color", Header: "颜色"},
			{Key: "qty", Header: "数量"},
			{Key: "note", Header: "备注"},
			{Key: "referenceimageurls", Header: "参考图片URLs"},
			{Key: "createdat", Header: "创建时间"},
			{Key: "updatedat", Header: "更新时间"},
		},
	}
}

func TemplateHeaders(spec TemplateSpec) []string {
	headers := make([]string, 0, len(spec.Columns))
	for _, column := range spec.Columns {
		headers = append(headers, column.Header)
	}
	return headers
}

func MissingRequiredHeaders(index map[string]int, spec TemplateSpec) ([]string, [][]string) {
	headerMap := headerMap(spec)
	missing := make([]string, 0)
	for _, key := range spec.Required {
		normalized := NormalizeHeaderKey(key)
		if _, ok := index[normalized]; !ok {
			missing = append(missing, headerMap[normalized])
		}
	}

	missingAny := make([][]string, 0)
	for _, group := range spec.RequiredAny {
		found := false
		for _, key := range group {
			if _, ok := index[NormalizeHeaderKey(key)]; ok {
				found = true
				break
			}
		}
		if !found {
			missingAny = append(missingAny, headersForKeys(headerMap, group))
		}
	}
	return missing, missingAny
}

func headerMap(spec TemplateSpec) map[string]string {
	headers := make(map[string]string, len(spec.Columns))
	for _, column := range spec.Columns {
		headers[NormalizeHeaderKey(column.Key)] = column.Header
	}
	return headers
}

func headersForKeys(headerMap map[string]string, keys []string) []string {
	result := make([]string, 0, len(keys))
	for _, key := range keys {
		normalized := NormalizeHeaderKey(key)
		header := headerMap[normalized]
		if header == "" {
			header = normalized
		}
		result = append(result, header)
	}
	return result
}
