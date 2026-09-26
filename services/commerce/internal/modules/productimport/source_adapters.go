package productimport

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"

	"github.com/teamdsb/tmo/packages/go-shared/catalogspec"
	"github.com/teamdsb/tmo/services/commerce/internal/excel"
)

const (
	sourceStandard         = "STANDARD"
	sourceTrialMaster      = "TRIAL_MASTER"
	sourceLegacyFiveColumn = "LEGACY_FIVE_COLUMN"
)

type sourceRecord struct {
	Sheet  string
	Line   int
	Values map[string]string
}

type sourceTable struct {
	Sheet      string
	HeaderLine int
	Headers    []string
	Index      map[string]int
	Rows       [][]string
}

func parseSourceWorkbook(excelPath string) (string, []parsedRowState, error) {
	// #nosec G304 G703 -- Enqueue persists this path beneath its UUID job/input directory after sanitizing the filename with filepath.Base.
	file, err := os.Open(excelPath)
	if err != nil {
		return "", nil, err
	}
	defer func() { _ = file.Close() }()
	sheets, err := excel.ReadWorkbook(file)
	if err != nil {
		return "", nil, err
	}
	return parseSourceSheets(sheets)
}

func parseSourceSheets(sheets []excel.Worksheet) (string, []parsedRowState, error) {
	products := findSourceTable(sheets, []string{"商品编号", "规范商品名称"}, "SKU编号")
	skus := findSourceTable(sheets, []string{"商品编号", "SKU编号", "SKU显示名称"}, "")
	if products != nil || skus != nil {
		if products == nil || skus == nil {
			return sourceTrialMaster, nil, fmt.Errorf("试运行母表需要商品表和SKU规格表")
		}
		attributes := findSourceTable(sheets, []string{"商品编号", "SKU编号", "属性名称", "数值", "文本值", "单位"}, "")
		images := findSourceTable(sheets, []string{"图片编号", "相对文件路径"}, "")
		references := findSourceTable(sheets, []string{"来源编号", "资料名称", "来源链接或文件"}, "")
		if attributes == nil {
			return sourceTrialMaster, nil, fmt.Errorf("试运行母表缺少独立属性表")
		}
		for _, table := range []*sourceTable{products, skus, attributes, images, references} {
			if table != nil {
				if err := validateSourceHeaders(*table, false); err != nil {
					return sourceTrialMaster, nil, err
				}
			}
		}
		rows, err := parseTrialMaster(*products, *skus, *attributes, images, references)
		return sourceTrialMaster, rows, err
	}
	var standard []parsedRowState
	for _, sheet := range sheets {
		table := findStandardTable(sheet)
		if table == nil {
			continue
		}
		if err := validateSourceHeaders(*table, true); err != nil {
			return sourceStandard, nil, err
		}
		headers := append([]string{}, table.Headers...)
		for index, header := range headers {
			headers[index] = canonicalStandardHeader(header)
		}
		rows := append([][]string{headers}, table.Rows...)
		parsed, err := parseWorkbookRows(rows)
		if err != nil {
			return sourceStandard, nil, err
		}
		for index := range parsed {
			row := &parsed[index].Row
			physical := row.RowNumber + table.HeaderLine - 1
			row.SourceSheet, row.SourceRow = table.Sheet, physical
			row.RowNumber = len(standard) + index + 2
			if physical-table.HeaderLine-1 < len(table.Rows) {
				values := table.Rows[physical-table.HeaderLine-1]
				row.SourceNamespace = sourceCell(values, table.Index, "Source Namespace", "来源命名空间")
				row.SourceProductKey = sourceCell(values, table.Index, "Source Product Key", "来源商品键")
				row.SourceSKUKey = sourceCell(values, table.Index, "Source SKU Key", "来源SKU键")
				if row.SourceNamespace != "" {
					row.SourceFingerprint = sourceFingerprint(row.RawValues)
				}
			}
			if row.SourceNamespace != "" && (row.SourceProductKey == "" || row.SourceSKUKey == "") {
				parsed[index].Error = "来源关联需要同时填写命名空间、商品键和SKU键"
			}
		}
		standard = append(standard, parsed...)
	}
	if len(standard) > 0 {
		return sourceStandard, standard, nil
	}
	var legacy []parsedRowState
	for _, sheet := range sheets {
		table := findSourceTable([]excel.Worksheet{sheet}, []string{"物资", "规格型号", "单位", "分类"}, "")
		if table == nil {
			continue
		}
		if err := validateSourceHeaders(*table, false); err != nil {
			return sourceLegacyFiveColumn, nil, err
		}
		parsed := parseLegacySource(*table)
		for index := range parsed {
			parsed[index].Row.RowNumber = len(legacy) + index + 2
		}
		legacy = append(legacy, parsed...)
	}
	if len(legacy) > 0 {
		markSourceDuplicates(legacy)
		markDuplicateCombinations(legacy)
		return sourceLegacyFiveColumn, legacy, nil
	}
	return "", nil, fmt.Errorf("未识别文件表头，请使用商品标准模板、试运行母表或序号/物资/规格型号/单位/分类原表")
}

func findSourceTable(sheets []excel.Worksheet, required []string, forbidden string) *sourceTable {
	for _, sheet := range sheets {
		for row, values := range sheet.Rows {
			if row >= 30 {
				break
			}
			index := excel.HeaderIndexMap(values)
			if forbidden != "" {
				if _, exists := index[excel.NormalizeHeaderKey(forbidden)]; exists {
					continue
				}
			}
			matched := true
			for _, name := range required {
				if _, exists := index[excel.NormalizeHeaderKey(name)]; !exists {
					matched = false
					break
				}
			}
			if matched {
				return &sourceTable{sheet.Name, row + 1, values, index, sheet.Rows[row+1:]}
			}
		}
	}
	return nil
}

func findStandardTable(sheet excel.Worksheet) *sourceTable {
	for row, values := range sheet.Rows {
		if row >= 30 {
			break
		}
		canonical := make([]string, len(values))
		for i, value := range values {
			canonical[i] = canonicalStandardHeader(value)
		}
		index := excel.HeaderIndexMap(canonical)
		if _, ok := index["groupkey"]; !ok {
			continue
		}
		if _, ok := index["productname"]; !ok {
			continue
		}
		if _, ok := index["categoryid"]; !ok {
			continue
		}
		return &sourceTable{sheet.Name, row + 1, values, excel.HeaderIndexMap(values), sheet.Rows[row+1:]}
	}
	return nil
}

func canonicalStandardHeader(header string) string {
	aliases := map[string]string{
		"商品分组": "Group Key", "分组键": "Group Key", "商品ID": "Product ID", "SKUID": "SKU ID", "商品状态": "Product Status",
		"商品名称": "Product Name", "SKU编码": "SKU Code", "SKU名称": "SKU Name", "分类ID": "Category ID", "类目ID": "Category ID",
		"商品描述": "Description", "主图": "Cover Image", "图片": "Images", "标签": "Tags", "规格层级": "Filter Dimensions",
		"规格摘要": "Spec", "属性": "Attributes", "单位": "Unit", "启用": "Is Active", "阶梯价分": "Price Tiers (Fen)",
		"一级规格名称": "Spec 1 Name", "一级规格值": "Spec 1 Value", "二级规格名称": "Spec 2 Name", "二级规格值": "Spec 2 Value", "三级规格名称": "Spec 3 Name", "三级规格值": "Spec 3 Value",
		"阶梯价格（分）": "Price Tiers (Fen)", "封面图片": "Cover Image", "商品图片": "Images", "SKU启用": "Is Active", "扩展属性": "Attributes",
		"规格1名称": "Spec 1 Name", "规格1值": "Spec 1 Value", "规格2名称": "Spec 2 Name", "规格2值": "Spec 2 Value", "规格3名称": "Spec 3 Name", "规格3值": "Spec 3 Value",
	}
	key := excel.NormalizeHeaderKey(header)
	for alias, value := range aliases {
		if excel.NormalizeHeaderKey(alias) == key {
			return value
		}
	}
	return header
}

func validateSourceHeaders(table sourceTable, standard bool) error {
	seen := map[string]bool{}
	for _, header := range table.Headers {
		canonical := header
		if standard {
			canonical = canonicalStandardHeader(header)
		}
		key := excel.NormalizeHeaderKey(canonical)
		if key == "" {
			continue
		}
		if seen[key] {
			return fmt.Errorf("%s第%d行存在重复表头%s", table.Sheet, table.HeaderLine, header)
		}
		seen[key] = true
	}
	return nil
}

func sourceCell(row []string, index map[string]int, names ...string) string {
	for _, name := range names {
		if value := excel.CellValue(row, index, excel.NormalizeHeaderKey(name)); value != "" {
			return value
		}
	}
	return ""
}

func (table sourceTable) records() []sourceRecord {
	result := []sourceRecord{}
	for index, row := range table.Rows {
		if isBlankRow(row) {
			continue
		}
		values := map[string]string{}
		for column, header := range table.Headers {
			if strings.TrimSpace(header) != "" && column < len(row) {
				values[header] = strings.TrimSpace(row[column])
			}
		}
		result = append(result, sourceRecord{table.Sheet, table.HeaderLine + index + 1, values})
	}
	return result
}

func recordCell(record sourceRecord, names ...string) string {
	for _, name := range names {
		key := excel.NormalizeHeaderKey(name)
		for header, value := range record.Values {
			if excel.NormalizeHeaderKey(header) == key && value != "" {
				return value
			}
		}
	}
	return ""
}

func parseTrialMaster(productTable, skuTable, attributeTable sourceTable, imageTable, referenceTable *sourceTable) ([]parsedRowState, error) {
	products := map[string]sourceRecord{}
	for _, record := range productTable.records() {
		key := recordCell(record, "商品编号")
		if key == "" {
			return nil, fmt.Errorf("%s第%d行缺少商品编号", record.Sheet, record.Line)
		}
		if _, exists := products[key]; exists {
			return nil, fmt.Errorf("商品编号%s重复", key)
		}
		products[key] = record
	}
	attributes := map[string][]sourceRecord{}
	for _, record := range attributeTable.records() {
		attributes[recordCell(record, "SKU编号")] = append(attributes[recordCell(record, "SKU编号")], record)
	}
	images := []sourceRecord{}
	if imageTable != nil {
		images = imageTable.records()
	}
	imageByID := map[string]sourceRecord{}
	references := []sourceRecord{}
	if referenceTable != nil {
		references = referenceTable.records()
	}
	for _, record := range images {
		key := recordCell(record, "图片编号")
		if key == "" {
			return nil, fmt.Errorf("%s第%d行缺少图片编号", record.Sheet, record.Line)
		}
		if _, exists := imageByID[key]; exists {
			return nil, fmt.Errorf("图片编号%s重复", key)
		}
		imageByID[key] = record
	}
	states := make([]parsedRowState, 0, len(skuTable.Rows))
	seenProducts, seenSKUs := map[string]bool{}, map[string]bool{}
	for _, record := range skuTable.records() {
		productKey, skuKey := recordCell(record, "商品编号"), recordCell(record, "SKU编号")
		product, productExists := products[productKey]
		row := parsedRow{RowNumber: len(states) + 2, SourceSheet: record.Sheet, SourceRow: record.Line, SourceNamespace: "trial-master", SourceProductKey: productKey, SourceSKUKey: skuKey, GroupKey: productKey, SkuCode: skuKey, IsActive: true, Attributes: map[string]string{}, ProvidedFields: map[string]bool{}, RawValues: map[string]string{}}
		state := parsedRowState{Row: row}
		if productKey == "" || skuKey == "" || !productExists {
			state.Error = "SKU必须具有有效商品编号和SKU编号，且商品编号须存在于商品表"
			state.Row.RawValues = cloneStringMap(record.Values)
			states = append(states, state)
			continue
		}
		seenProducts[productKey], seenSKUs[skuKey] = true, true
		row.ProductName, row.SkuName = recordCell(product, "规范商品名称"), recordCell(record, "SKU显示名称")
		row.SourceCategoryPath = categoryPath(product)
		row.Description = normalizeNullableString(recordCell(product, "商品说明"))
		row.Unit = normalizeNullableString(recordCell(record, "销售单位", "需求数量单位", "原采购单位"))
		row.RawValues["sourceProduct"], row.RawValues["sourceSKU"] = jsonString(product.Values), jsonString(record.Values)
		row.RawValues["sourceOriginalProductKey"] = productKey
		row.RawValues["sourceAttributes"] = jsonString(recordValues(attributes[skuKey]))
		usedReferences := []sourceRecord{}
		for _, reference := range references {
			key := recordCell(reference, "来源编号")
			matched := listContains(recordCell(record, "来源编号"), key)
			for _, attribute := range attributes[skuKey] {
				matched = matched || listContains(recordCell(attribute, "来源编号"), key)
			}
			if matched {
				usedReferences = append(usedReferences, reference)
			}
		}
		row.RawValues["sourceReferences"] = jsonString(recordValues(usedReferences))
		mappedImages := []sourceRecord{}
		for _, image := range images {
			if listContains(recordCell(image, "适用SKU编号"), skuKey) || listContains(recordCell(image, "适用商品编号"), productKey) || recordCell(image, "图片编号") == recordCell(record, "图片编号") || recordCell(image, "图片编号") == recordCell(product, "主图编号") {
				mappedImages = append(mappedImages, image)
			}
		}
		row.RawValues["sourceImages"] = jsonString(recordValues(mappedImages))
		row.RawValues["sourceCoverImage"] = recordCell(product, "主图文件")
		imageRefs := []string{}
		for _, image := range mappedImages {
			if path := recordCell(image, "相对文件路径"); path != "" {
				imageRefs = appendUniqueSource(imageRefs, path)
			}
		}
		row.RawValues["sourceImageRefs"] = jsonString(imageRefs)
		inputAttrs := []catalogspec.SourceAttribute{}
		for _, attribute := range attributes[skuKey] {
			if recordCell(attribute, "商品编号") != productKey {
				state.Error = fmt.Sprintf("SKU%s的属性行指向其他商品", skuKey)
			}
			inputAttrs = append(inputAttrs, catalogspec.SourceAttribute{Name: recordCell(attribute, "属性名称"), Number: recordCell(attribute, "数值"), Text: recordCell(attribute, "文本值"), Unit: recordCell(attribute, "单位"), Basis: recordCell(attribute, "依据"), Source: recordCell(attribute, "来源编号")})
		}
		recognized := catalogspec.RecognizeAttributes(row.ProductName, row.SkuName, inputAttrs)
		row.FilterDimensions, row.Attributes, row.Spec = recognized.Dimensions, recognized.Attributes, normalizeNullableString(recognized.Spec)
		for _, issue := range recognized.Issues {
			addSourceIssue(&row, issue.Code, issue.Message)
		}
		if row.ProductName == "" {
			state.Error = "商品名称不能为空"
		}
		if row.SkuName == "" {
			row.SkuName = row.ProductName
		}
		if row.Unit == nil {
			addSourceIssue(&row, "UNIT_MISSING", "缺少销售或需求数量单位")
		} else if !knownSourceUnit(*row.Unit) {
			addSourceIssue(&row, "UNIT_UNRECOGNIZED", "原始单位“"+*row.Unit+"”无法确定，未自动替换")
		}
		if recordCell(record, "规范商品名称") != "" && recordCell(record, "规范商品名称") != row.ProductName {
			addSourceIssue(&row, "PRODUCT_METADATA_CONFLICT", "SKU表商品名称与商品表不一致")
		}
		if sourcePath := categoryPath(record); len(sourcePath) > 0 && strings.Join(sourcePath, "/") != strings.Join(row.SourceCategoryPath, "/") {
			addSourceIssue(&row, "CATEGORY_METADATA_CONFLICT", "SKU表分类与商品表不一致")
		}
		for _, imageKey := range []string{recordCell(product, "主图编号"), recordCell(record, "图片编号")} {
			if imageKey != "" {
				if _, ok := imageByID[imageKey]; !ok {
					addSourceIssue(&row, "IMAGE_REFERENCE_MISSING", "图片编号"+imageKey+"未在图片索引中找到")
				}
			}
		}
		if price := recordCell(record, "销售单价"); price != "" {
			fen, err := parseSourceYuan(price)
			if err != nil {
				state.Error = "销售单价必须是非负的两位小数金额"
			} else {
				row.PriceTiers = []priceTierInput{{MinQty: 1, UnitPriceFen: fen}}
				row.ProvidedFields["priceTiers"] = true
			}
		}
		row.SourceFingerprint = sourceFingerprint(map[string]interface{}{"product": fingerprintValues(product.Values), "sku": fingerprintValues(record.Values), "attributes": fingerprintRecords(attributes[skuKey]), "images": fingerprintRecords(mappedImages), "references": fingerprintRecords(usedReferences)})
		row.ProvidedFields["skuCode"], row.ProvidedFields["skuName"], row.ProvidedFields["attributes"], row.ProvidedFields["filterDimensions"], row.ProvidedFields["spec"] = true, true, true, len(row.FilterDimensions) > 0, row.Spec != nil
		row.ProvidedFields["description"], row.ProvidedFields["unit"] = row.Description != nil, row.Unit != nil
		if len(row.Issues) > 0 {
			splitSourceRow(&row, recordCell(record, "原始规格描述", "SKU显示名称"))
		}
		state.Row = row
		states = append(states, state)
	}
	for key := range attributes {
		if !seenSKUs[key] {
			return nil, fmt.Errorf("独立属性引用未知SKU编号%s", key)
		}
	}
	for key := range products {
		if !seenProducts[key] {
			return nil, fmt.Errorf("商品%s没有SKU行", key)
		}
	}
	for _, image := range images {
		for _, key := range sourceList(recordCell(image, "适用商品编号")) {
			if !seenProducts[key] {
				return nil, fmt.Errorf("图片索引引用未知商品编号%s", key)
			}
		}
		for _, key := range sourceList(recordCell(image, "适用SKU编号")) {
			if !seenSKUs[key] {
				return nil, fmt.Errorf("图片索引引用未知SKU编号%s", key)
			}
		}
	}
	markSourceDuplicates(states)
	markDuplicateCombinations(states)
	if len(states) == 0 {
		return nil, fmt.Errorf("母表没有SKU数据")
	}
	return states, nil
}

func parseLegacySource(table sourceTable) []parsedRowState {
	states := make([]parsedRowState, 0, len(table.Rows))
	for _, record := range table.records() {
		name, spec, unit, category := recordCell(record, "物资"), recordCell(record, "规格型号"), recordCell(record, "单位"), recordCell(record, "分类")
		business := map[string]string{"material": name, "spec": spec, "unit": unit, "category": category}
		fingerprint := sourceFingerprint(business)
		group := sourceFingerprint(map[string]string{"material": name, "unit": unit, "category": category})
		row := parsedRow{RowNumber: len(states) + 2, SourceNamespace: "legacy-five-column", SourceProductKey: "legacy-" + group, SourceSKUKey: "legacy-" + fingerprint, SourceFingerprint: fingerprint, SourceSheet: record.Sheet, SourceRow: record.Line, GroupKey: "legacy-" + group, ProductName: name, SkuName: spec, Unit: normalizeNullableString(unit), IsActive: true, RawValues: cloneStringMap(record.Values), ProvidedFields: map[string]bool{"unit": unit != "", "skuName": spec != "", "attributes": true, "filterDimensions": true, "spec": spec != ""}}
		row.RawValues["sourceSKU"] = jsonString(record.Values)
		row.RawValues["sourceOriginalProductKey"] = row.SourceProductKey
		if category != "" {
			row.SourceCategoryPath = []string{category}
		}
		recognized := catalogspec.RecognizeLegacySpec(name, spec)
		row.FilterDimensions, row.Attributes, row.Spec = recognized.Dimensions, recognized.Attributes, normalizeNullableString(recognized.Spec)
		for _, issue := range recognized.Issues {
			addSourceIssue(&row, issue.Code, issue.Message)
		}
		if unit == "" {
			addSourceIssue(&row, "UNIT_MISSING", "原始采购单位为空")
		} else if !knownSourceUnit(unit) {
			addSourceIssue(&row, "UNIT_UNRECOGNIZED", "原始单位“"+unit+"”无法确定，未自动替换")
		}
		if len(row.Issues) > 0 {
			splitSourceRow(&row, spec)
		}
		state := parsedRowState{Row: row}
		if name == "" {
			state.Error = "物资名称不能为空"
		}
		states = append(states, state)
	}
	return states
}

func standardProvidedFields(row []string, index map[string]int) map[string]bool {
	fields := map[string]string{"description": "description", "coverImage": "coverimage", "images": "images", "tags": "tags", "filterDimensions": "filterdimensions", "spec": "spec", "attributes": "attributes", "unit": "unit", "isActive": "isactive", "priceTiers": "pricetiersfen", "skuCode": "skucode", "skuName": "skuname", "productStatus": "productstatus"}
	result := map[string]bool{}
	for field, key := range fields {
		result[field] = excel.CellValue(row, index, key) != ""
	}
	result["priceTiers"] = result["priceTiers"] || excel.CellValue(row, index, "pricetiers") != ""
	for level := 1; level <= 3; level++ {
		if excel.CellValue(row, index, fmt.Sprintf("spec%dname", level)) != "" {
			result["filterDimensions"], result["attributes"], result["spec"] = true, true, true
		}
	}
	return result
}

func addSourceIssue(row *parsedRow, code, message string) {
	row.Issues = append(row.Issues, Issue{Code: code, Message: message, Severity: "WARNING"})
}

func splitSourceRow(row *parsedRow, rawSpec string) {
	row.Split = true
	row.SourceProductKey += "-split-" + sourceFingerprint(row.SourceSKUKey)[:16]
	row.GroupKey = row.SourceProductKey
	row.ProductStatus = "DRAFT"
	row.FilterDimensions = []string{"原始规格"}
	value := strings.TrimSpace(rawSpec)
	if value == "" {
		value = "待补规格"
	}
	if row.Attributes == nil {
		row.Attributes = map[string]string{}
	}
	row.Attributes["原始规格"] = value
	row.Spec = &value
	if row.SkuName == "" {
		row.SkuName = value
	}
	row.ProvidedFields["filterDimensions"], row.ProvidedFields["attributes"], row.ProvidedFields["spec"] = true, true, true
	if rawSpec != "" {
		row.ProductName += "（" + rawSpec + "）"
	}
}

func markSourceDuplicates(states []parsedRowState) {
	seen := map[string]int{}
	for index := range states {
		row := &states[index].Row
		key := row.SourceNamespace + "\x00" + row.SourceSKUKey
		if previous, exists := seen[key]; exists {
			if states[previous].Row.SourceFingerprint == row.SourceFingerprint {
				row.Ignored = true
				addSourceIssue(row, "DUPLICATE_ROW", "与同一来源中的另一行完全重复，已跳过")
			} else {
				states[index].Error = "同一来源SKU编号对应冲突内容"
				states[previous].Error = states[index].Error
			}
		} else {
			seen[key] = index
		}
	}
}

func markDuplicateCombinations(states []parsedRowState) {
	combinations := map[string][]int{}
	for index := range states {
		row := &states[index].Row
		if row.Ignored || row.Split || states[index].Error != "" {
			continue
		}
		values := make([]string, 0, len(row.FilterDimensions))
		for _, name := range row.FilterDimensions {
			values = append(values, row.Attributes[name])
		}
		if len(values) == 0 {
			values = append(values, derefString(row.Spec))
		}
		key := row.GroupKey + "\x00" + jsonString(values)
		combinations[key] = append(combinations[key], index)
	}
	for _, indices := range combinations {
		if len(indices) < 2 {
			continue
		}
		for _, index := range indices {
			row := &states[index].Row
			addSourceIssue(row, "SPEC_COMBINATION_DUPLICATE", "不同SKU编号具有相同规格组合，已单独建商品待复核")
			splitSourceRow(row, row.SkuName)
		}
	}
}

func categoryPath(record sourceRecord) []string {
	result := []string{}
	for _, key := range []string{"一级分类", "二级分类", "三级分类"} {
		if value := recordCell(record, key); value != "" {
			result = append(result, value)
		}
	}
	return result
}

func knownSourceUnit(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "个", "只", "件", "台", "套", "支", "根", "米", "m", "卷", "张", "本", "双", "副", "包", "袋", "盒", "箱", "瓶", "桶", "kg", "公斤", "千克", "g", "克", "吨", "t", "升", "l", "平方米", "m2", "m²", "㎡", "平方", "片", "把", "块", "条", "枚":
		return true
	default:
		return false
	}
}

func sourceList(value string) []string {
	return strings.FieldsFunc(value, func(r rune) bool { return r == ';' || r == '；' || r == '|' || r == '\n' || r == ',' || r == '，' })
}
func listContains(value, key string) bool {
	for _, item := range sourceList(value) {
		if strings.TrimSpace(item) == key {
			return true
		}
	}
	return false
}
func appendUniqueSource(values []string, value string) []string {
	for _, item := range values {
		if item == value {
			return values
		}
	}
	return append(values, value)
}
func cloneStringMap(values map[string]string) map[string]string {
	copy := map[string]string{}
	for k, v := range values {
		copy[k] = v
	}
	return copy
}
func recordValues(records []sourceRecord) []map[string]string {
	values := make([]map[string]string, 0, len(records))
	for _, record := range records {
		values = append(values, record.Values)
	}
	return values
}
func jsonString(value interface{}) string { payload, _ := json.Marshal(value); return string(payload) }
func sourceFingerprint(value interface{}) string {
	sum := sha256.Sum256([]byte(jsonString(value)))
	return hex.EncodeToString(sum[:])
}
func fingerprintValues(values map[string]string) map[string]string {
	copy := cloneStringMap(values)
	for _, key := range []string{"序号", "规格数", "原来源文件", "原来源工作表", "原始行号", "底稿工作表", "底稿行号", "Source Row", "Source Sheet", "File Name"} {
		delete(copy, key)
	}
	return copy
}
func fingerprintRecords(records []sourceRecord) []string {
	values := make([]string, 0, len(records))
	for _, record := range records {
		values = append(values, jsonString(fingerprintValues(record.Values)))
	}
	sort.Strings(values)
	return values
}

func parseSourceYuan(value string) (int64, error) {
	parts := strings.Split(strings.TrimSpace(value), ".")
	if len(parts) > 2 || parts[0] == "" || strings.HasPrefix(parts[0], "-") {
		return 0, fmt.Errorf("invalid price")
	}
	fraction := "00"
	if len(parts) == 2 {
		if len(parts[1]) > 2 {
			return 0, fmt.Errorf("invalid price")
		}
		fraction = (parts[1] + "00")[:2]
	}
	var total int64
	for _, digit := range parts[0] + fraction {
		if digit < '0' || digit > '9' || total > (int64(^uint64(0)>>1)-int64(digit-'0'))/10 {
			return 0, fmt.Errorf("invalid price")
		}
		total = total*10 + int64(digit-'0')
	}
	return total, nil
}
