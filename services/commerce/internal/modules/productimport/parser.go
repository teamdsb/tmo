package productimport

import (
	"encoding/json"
	"fmt"
	"net/url"
	"sort"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/teamdsb/tmo/packages/go-shared/catalogspec"

	"github.com/teamdsb/tmo/services/commerce/internal/excel"
)

type priceTierInput struct {
	MinQty       int
	MaxQty       *int
	UnitPriceFen int64
}

type parsedRow struct {
	ProductID          uuid.UUID
	SkuID              uuid.UUID
	ProductStatus      string
	NoSKU              bool
	RowNumber          int
	GroupKey           string
	SkuCode            string
	ProductName        string
	SkuName            string
	CategoryID         uuid.UUID
	Description        *string
	CoverImageRef      string
	ImageRefs          []string
	Tags               []string
	FilterDimensions   []string
	Spec               *string
	Attributes         map[string]string
	Unit               *string
	IsActive           bool
	PriceTiers         []priceTierInput
	RawValues          map[string]string
	SourceNamespace    string
	SourceProductKey   string
	SourceSKUKey       string
	SourceFingerprint  string
	SourceSheet        string
	SourceRow          int
	SourceCategoryPath []string
	ProvidedFields     map[string]bool
	ClearFields        []string
	Issues             []Issue
	Split              bool
	Ignored            bool
}

type parsedRowState struct {
	Row   parsedRow
	Error string
}

func parseWorkbookRows(rows [][]string) ([]parsedRowState, error) {
	if len(rows) == 0 {
		return nil, fmt.Errorf("empty worksheet")
	}

	spec := excel.ProductImportTemplate()
	headerIndex := excel.HeaderIndexMap(rows[0])
	missing, missingAny := excel.MissingRequiredHeaders(headerIndex, spec)
	if len(missing) > 0 || len(missingAny) > 0 {
		return nil, fmt.Errorf("missing required headers: %s", strings.Join(buildMissingHeaderList(missing, missingAny), "; "))
	}

	results := make([]parsedRowState, 0, len(rows)-1)
	for rowIndex, row := range rows[1:] {
		if isBlankRow(row) {
			continue
		}
		state := parsedRowState{
			Row: parsedRow{
				RowNumber:      rowIndex + 2,
				RawValues:      buildRawValues(row, headerIndex, spec),
				ProvidedFields: standardProvidedFields(row, headerIndex),
			},
		}
		state.Row.GroupKey = excel.CellValue(row, headerIndex, "groupkey")
		state.Row.SkuCode = excel.CellValue(row, headerIndex, "skucode")
		state.Row.ProductName = excel.CellValue(row, headerIndex, "productname")
		state.Row.SkuName = excel.CellValue(row, headerIndex, "skuname")
		if state.Row.SkuName == "" && excel.CellValue(row, headerIndex, "productid") == "" {
			state.Row.SkuName = state.Row.ProductName
		}
		state.Row.CoverImageRef = excel.CellValue(row, headerIndex, "coverimage")
		state.Row.ImageRefs = splitMultiValue(excel.CellValue(row, headerIndex, "images"))
		state.Row.Tags = splitMultiValue(excel.CellValue(row, headerIndex, "tags"))
		state.Row.FilterDimensions = splitMultiValue(excel.CellValue(row, headerIndex, "filterdimensions"))

		description := normalizeNullableString(excel.CellValue(row, headerIndex, "description"))
		state.Row.Description = description
		unit := normalizeNullableString(excel.CellValue(row, headerIndex, "unit"))
		state.Row.Unit = unit

		if state.Row.GroupKey == "" {
			state.Error = "groupKey is required"
			results = append(results, state)
			continue
		}
		if state.Row.ProductName == "" {
			state.Error = "productName is required"
			results = append(results, state)
			continue
		}
		if state.Row.SkuName == "" && excel.CellValue(row, headerIndex, "productid") == "" {
			state.Error = "skuName is required"
			results = append(results, state)
			continue
		}

		categoryID, err := uuid.Parse(excel.CellValue(row, headerIndex, "categoryid"))
		if err != nil {
			state.Error = "categoryId must be a valid UUID"
			results = append(results, state)
			continue
		}
		state.Row.CategoryID = categoryID

		specValue := normalizeNullableString(excel.CellValue(row, headerIndex, "spec"))
		attributes, err := parseAttributes(excel.CellValue(row, headerIndex, "attributes"))
		if err != nil {
			state.Error = err.Error()
			results = append(results, state)
			continue
		}
		if specValue == nil {
			if rawSpec, ok := attributes["spec"]; ok && !containsDimension(state.Row.FilterDimensions, "spec") && excel.CellValue(row, headerIndex, "spec1name") != "spec" && excel.CellValue(row, headerIndex, "spec2name") != "spec" && excel.CellValue(row, headerIndex, "spec3name") != "spec" {
				specValue = normalizeNullableString(rawSpec)
				delete(attributes, "spec")
			}
		}
		state.Row.Spec = specValue
		state.Row.Attributes = attributes

		isActive, err := parseBoolDefaultTrue(excel.CellValue(row, headerIndex, "isactive"))
		if err != nil {
			state.Error = err.Error()
			results = append(results, state)
			continue
		}
		state.Row.IsActive = isActive

		priceTiers, err := parsePriceTiers(cellValueAny(row, headerIndex, "pricetiers", "pricetiersfen"))
		if err != nil {
			state.Error = err.Error()
			results = append(results, state)
			continue
		}
		state.Row.PriceTiers = priceTiers
		if err := parseIdentityAndLevels(&state.Row, row, headerIndex); err != nil {
			state.Error = err.Error()
		}

		results = append(results, state)
	}

	if len(results) == 0 {
		return nil, fmt.Errorf("no data rows found")
	}

	return results, nil
}

func buildMissingHeaderList(missing []string, missingAny [][]string) []string {
	items := make([]string, 0, len(missing)+len(missingAny))
	items = append(items, missing...)
	for _, group := range missingAny {
		items = append(items, strings.Join(group, " / "))
	}
	return items
}

func buildRawValues(row []string, headerIndex map[string]int, spec excel.TemplateSpec) map[string]string {
	values := make(map[string]string, len(spec.Columns))
	for _, column := range spec.Columns {
		if column.Key == "pricetiers" {
			values[column.Key] = cellValueAny(row, headerIndex, "pricetiers", "pricetiersfen")
			continue
		}
		values[column.Key] = excel.CellValue(row, headerIndex, column.Key)
	}
	return values
}

func cellValueAny(row []string, headerIndex map[string]int, keys ...string) string {
	for _, key := range keys {
		if value := excel.CellValue(row, headerIndex, key); value != "" {
			return value
		}
	}
	return ""
}

func isBlankRow(row []string) bool {
	for _, cell := range row {
		if strings.TrimSpace(cell) != "" {
			return false
		}
	}
	return true
}

func splitMultiValue(raw string) []string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil
	}

	if strings.HasPrefix(trimmed, "[") {
		var values []string
		if json.Unmarshal([]byte(trimmed), &values) == nil {
			return values
		}
	}
	separator := "|"
	if !strings.Contains(trimmed, separator) && strings.Contains(trimmed, ",") {
		separator = ","
	}
	parts := strings.Split(trimmed, separator)
	values := make([]string, 0, len(parts))
	for _, part := range parts {
		value := strings.TrimSpace(part)
		if value == "" {
			continue
		}
		values = append(values, value)
	}
	return values
}

func normalizeNullableString(raw string) *string {
	value := strings.TrimSpace(raw)
	if value == "" {
		return nil
	}
	return &value
}

func parseAttributes(raw string) (map[string]string, error) {
	result := map[string]string{}
	if strings.TrimSpace(raw) == "" {
		return result, nil
	}

	if strings.HasPrefix(strings.TrimSpace(raw), "{") {
		if err := json.Unmarshal([]byte(raw), &result); err != nil {
			return nil, fmt.Errorf("attributes must be a JSON string map: %w", err)
		}
		return result, nil
	}
	for _, part := range splitMultiValue(raw) {
		key, value, ok := strings.Cut(part, ":")
		if !ok {
			return nil, fmt.Errorf("attributes must use key:value pairs")
		}
		normalizedKey := strings.TrimSpace(key)
		normalizedValue := strings.TrimSpace(value)
		if normalizedKey == "" || normalizedValue == "" {
			return nil, fmt.Errorf("attributes must use non-empty key:value pairs")
		}
		if _, exists := result[normalizedKey]; exists {
			return nil, fmt.Errorf("duplicate attribute key %q", normalizedKey)
		}
		result[normalizedKey] = normalizedValue
	}
	return result, nil
}

func parseBoolDefaultTrue(raw string) (bool, error) {
	trimmed := strings.ToLower(strings.TrimSpace(raw))
	switch trimmed {
	case "", "1", "true", "yes", "y":
		return true, nil
	case "0", "false", "no", "n":
		return false, nil
	default:
		return false, fmt.Errorf("isActive must be one of true/false/1/0/yes/no")
	}
}

func parsePriceTiers(raw string) ([]priceTierInput, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, nil
	}

	result := make([]priceTierInput, 0)
	for _, segment := range splitMultiValue(raw) {
		rangePart, pricePart, ok := strings.Cut(segment, ":")
		if !ok {
			return nil, fmt.Errorf("priceTiers must use range:price format")
		}
		rangePart = strings.TrimSpace(rangePart)
		pricePart = strings.TrimSpace(pricePart)
		if rangePart == "" || pricePart == "" {
			return nil, fmt.Errorf("priceTiers must use non-empty range:price format")
		}

		unitPriceFen, err := strconv.ParseInt(pricePart, 10, 64)
		if err != nil || unitPriceFen < 0 {
			return nil, fmt.Errorf("priceTiers price must be a non-negative integer fen value")
		}

		minQty, maxQty, err := parseQtyRange(rangePart)
		if err != nil {
			return nil, err
		}
		result = append(result, priceTierInput{
			MinQty:       minQty,
			MaxQty:       maxQty,
			UnitPriceFen: unitPriceFen,
		})
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].MinQty < result[j].MinQty
	})
	for index := 1; index < len(result); index++ {
		if result[index].MinQty <= result[index-1].MinQty {
			return nil, fmt.Errorf("priceTiers ranges must have strictly increasing minQty")
		}
		if result[index-1].MaxQty != nil && *result[index-1].MaxQty >= result[index].MinQty {
			return nil, fmt.Errorf("priceTiers ranges must not overlap")
		}
	}

	return result, nil
}

func parseQtyRange(raw string) (int, *int, error) {
	rangeValue := strings.TrimSpace(raw)
	if !strings.Contains(rangeValue, "-") {
		minQty, err := strconv.Atoi(rangeValue)
		if err != nil || minQty <= 0 {
			return 0, nil, fmt.Errorf("priceTiers range must use positive integer quantities")
		}
		return minQty, nil, nil
	}

	minRaw, maxRaw, _ := strings.Cut(rangeValue, "-")
	minQty, err := strconv.Atoi(strings.TrimSpace(minRaw))
	if err != nil || minQty <= 0 {
		return 0, nil, fmt.Errorf("priceTiers range must use positive integer quantities")
	}
	maxRaw = strings.TrimSpace(maxRaw)
	if maxRaw == "" {
		return minQty, nil, nil
	}
	maxQty, err := strconv.Atoi(maxRaw)
	if err != nil || maxQty < minQty {
		return 0, nil, fmt.Errorf("priceTiers maxQty must be >= minQty")
	}
	return minQty, &maxQty, nil
}

func derefString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func looksLikeURL(raw string) bool {
	if strings.TrimSpace(raw) == "" {
		return false
	}
	parsed, err := url.Parse(strings.TrimSpace(raw))
	return err == nil && (parsed.Scheme == "http" || parsed.Scheme == "https")
}

// Explicit columns take precedence only when legacy fields agree; IDs are never silently ignored.
func parseIdentityAndLevels(result *parsedRow, row []string, headers map[string]int) error {
	for key := range headers {
		if !strings.HasPrefix(key, "spec") {
			continue
		}
		level := strings.TrimSuffix(strings.TrimSuffix(strings.TrimPrefix(key, "spec"), "name"), "value")
		if n, err := strconv.Atoi(level); err == nil && n > 3 && excel.CellValue(row, headers, key) != "" {
			return fmt.Errorf("specifications support at most 3 levels")
		}
	}
	for key, target := range map[string]*uuid.UUID{"productid": &result.ProductID, "skuid": &result.SkuID} {
		if value := excel.CellValue(row, headers, key); value != "" {
			id, err := uuid.Parse(value)
			if err != nil || id == uuid.Nil {
				return fmt.Errorf("%s must be a valid non-zero UUID", key)
			}
			*target = id
		}
	}
	result.ProductStatus = strings.ToUpper(excel.CellValue(row, headers, "productstatus"))
	switch result.ProductStatus {
	case "", "DRAFT", "ACTIVE", "INACTIVE":
	default:
		return fmt.Errorf("productStatus must be DRAFT, ACTIVE or INACTIVE")
	}
	result.NoSKU = result.ProductID != uuid.Nil && result.SkuID == uuid.Nil && result.SkuCode == "" && result.SkuName == "" && result.Spec == nil && result.Unit == nil && len(result.Attributes) == 0 && len(result.PriceTiers) == 0 && excel.CellValue(row, headers, "isactive") == ""
	dimensions := []string{}
	values := []string{}
	gap := false
	for i := 1; i <= 3; i++ {
		name := excel.CellValue(row, headers, fmt.Sprintf("spec%dname", i))
		value := excel.CellValue(row, headers, fmt.Sprintf("spec%dvalue", i))
		if name == "" && value == "" {
			gap = true
			continue
		}
		if gap || name == "" || (value == "" && !result.NoSKU && result.IsActive) {
			return fmt.Errorf("specification levels must be consecutive with both name and value")
		}
		dimensions = append(dimensions, name)
		values = append(values, value)
	}
	explicit := len(dimensions) > 0
	if explicit {
		if len(result.FilterDimensions) > 0 && !equalStrings(result.FilterDimensions, dimensions) {
			return fmt.Errorf("specification names conflict with Filter Dimensions")
		}
		result.FilterDimensions = dimensions
		if !result.NoSKU {
			for i, name := range dimensions {
				if value, ok := result.Attributes[name]; ok && strings.TrimSpace(value) != values[i] {
					return fmt.Errorf("specification value conflicts with Attributes for %q", name)
				}
				if values[i] != "" || result.IsActive {
					result.Attributes[name] = values[i]
				}
			}
		}
	}
	normalized, err := catalogspec.NormalizeDimensions(result.FilterDimensions)
	if err != nil {
		return err
	}
	result.FilterDimensions = normalized
	if result.NoSKU {
		return nil
	}
	if result.SkuName == "" {
		result.SkuName = result.ProductName
	}
	if len(normalized) > 0 {
		attrs, path, err := catalogspec.NormalizeValues(normalized, result.Attributes)
		if err != nil {
			if !result.IsActive {
				return nil
			}
			return err
		}
		if explicit && result.Spec != nil && *result.Spec != path {
			return fmt.Errorf("specification values conflict with Spec")
		}
		result.Attributes = attrs
		result.Spec = &path
	}
	return nil
}

func equalStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func containsDimension(names []string, name string) bool {
	for _, value := range names {
		if value == name {
			return true
		}
	}
	return false
}
