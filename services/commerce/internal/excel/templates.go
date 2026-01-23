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
