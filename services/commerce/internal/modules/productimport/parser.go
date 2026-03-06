package productimport

import (
	"encoding/json"
	"fmt"
	"net/url"
	"sort"
	"strconv"
	"strings"

	"github.com/google/uuid"

	"github.com/teamdsb/tmo/services/commerce/internal/excel"
)

type priceTierInput struct {
	MinQty       int
	MaxQty       *int
	UnitPriceFen int64
}

type parsedRow struct {
	RowNumber        int
	GroupKey         string
	SkuCode          string
	ProductName      string
	SkuName          string
	CategoryID       uuid.UUID
	Description      *string
	CoverImageRef    string
	ImageRefs        []string
	Tags             []string
	FilterDimensions []string
	Spec             *string
	Attributes       map[string]string
	Unit             *string
	IsActive         bool
	PriceTiers       []priceTierInput
	RawValues        map[string]string
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
				RowNumber: rowIndex + 2,
				RawValues: buildRawValues(row, headerIndex, spec),
			},
		}
		state.Row.GroupKey = excel.CellValue(row, headerIndex, "groupkey")
		state.Row.SkuCode = excel.CellValue(row, headerIndex, "skucode")
		state.Row.ProductName = excel.CellValue(row, headerIndex, "productname")
		state.Row.SkuName = excel.CellValue(row, headerIndex, "skuname")
		if state.Row.SkuName == "" {
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
		if state.Row.SkuName == "" {
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
			if rawSpec, ok := attributes["spec"]; ok {
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

		priceTiers, err := parsePriceTiers(excel.CellValue(row, headerIndex, "pricetiers"))
		if err != nil {
			state.Error = err.Error()
			results = append(results, state)
			continue
		}
		state.Row.PriceTiers = priceTiers

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
		values[column.Key] = excel.CellValue(row, headerIndex, column.Key)
	}
	return values
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

func marshalPayload(row parsedRow) json.RawMessage {
	payload := map[string]interface{}{
		"rowNumber":         row.RowNumber,
		"groupKey":          row.GroupKey,
		"skuCode":           row.SkuCode,
		"productName":       row.ProductName,
		"skuName":           row.SkuName,
		"categoryId":        row.CategoryID.String(),
		"description":       derefString(row.Description),
		"coverImage":        row.CoverImageRef,
		"images":            row.ImageRefs,
		"tags":              row.Tags,
		"filterDimensions":  row.FilterDimensions,
		"spec":              derefString(row.Spec),
		"attributes":        row.Attributes,
		"unit":              derefString(row.Unit),
		"isActive":          row.IsActive,
		"priceTiers":        row.PriceTiers,
		"rawValues":         row.RawValues,
		"coverImageIsURL":   looksLikeURL(row.CoverImageRef),
		"imageRefsHaveURLs": anyLooksLikeURL(row.ImageRefs),
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return json.RawMessage(`{}`)
	}
	return encoded
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

func anyLooksLikeURL(values []string) bool {
	for _, value := range values {
		if looksLikeURL(value) {
			return true
		}
	}
	return false
}
