package productimport

import (
	"testing"

	"github.com/google/uuid"

	"github.com/teamdsb/tmo/services/commerce/internal/excel"
)

func TestParseWorkbookRowsSupportsNormalizedPriceTierHeaders(t *testing.T) {
	categoryID := uuid.New().String()
	rows := [][]string{
		{
			"Group Key",
			"SKU Code",
			"Product Name",
			"SKU Name",
			"Category ID",
			"Description",
			"Cover Image",
			"Images",
			"Tags",
			"Filter Dimensions",
			"Spec",
			"Attributes",
			"Unit",
			"Is Active",
			"Price-Tiers(Fen)",
		},
		{
			"group-a",
			"SKU-A",
			"Bolt A",
			"Bolt A M6",
			categoryID,
			"desc",
			"main.png",
			"main.png|detail.png",
			"fastener|steel",
			"material|size",
			"M6",
			"material:steel|size:M6",
			"pcs",
			"true",
			"1-9:1200|10-:1000",
		},
	}

	parsed, err := parseWorkbookRows(rows)
	if err != nil {
		t.Fatalf("parseWorkbookRows returned error: %v", err)
	}
	if len(parsed) != 1 {
		t.Fatalf("expected 1 parsed row, got %d", len(parsed))
	}
	if parsed[0].Error != "" {
		t.Fatalf("expected no row error, got %q", parsed[0].Error)
	}
	if len(parsed[0].Row.PriceTiers) != 2 {
		t.Fatalf("expected 2 price tiers, got %d", len(parsed[0].Row.PriceTiers))
	}
	if parsed[0].Row.RawValues["pricetiers"] != "1-9:1200|10-:1000" {
		t.Fatalf("expected raw price tiers to be preserved, got %q", parsed[0].Row.RawValues["pricetiers"])
	}
}

func TestParseWorkbookRowsMarksInvalidPriceTierRow(t *testing.T) {
	spec := excel.ProductImportTemplate()
	rows := [][]string{
		excel.TemplateHeaders(spec),
		parserTestRow(map[string]string{
			"groupkey":    "broken",
			"skucode":     "BROKEN-1",
			"productname": "Broken",
			"skuname":     "Broken SKU",
			"categoryid":  uuid.New().String(),
			"attributes":  "material:steel",
			"pricetiers":  "oops",
		}),
	}

	parsed, err := parseWorkbookRows(rows)
	if err != nil {
		t.Fatalf("parseWorkbookRows returned unexpected error: %v", err)
	}
	if len(parsed) != 1 {
		t.Fatalf("expected 1 parsed row, got %d", len(parsed))
	}
	if parsed[0].Error != "priceTiers must use range:price format" {
		t.Fatalf("unexpected row error: %q", parsed[0].Error)
	}
}

func TestValidateGroupRowsRejectsInconsistentProductFields(t *testing.T) {
	rows := []*rowExecutionState{
		{Parsed: parsedRow{
			GroupKey:         "group-a",
			SkuCode:          "SKU-A",
			ProductName:      "Bolt A",
			SkuName:          "Bolt A M6",
			CategoryID:       uuid.New(),
			CoverImageRef:    "main.png",
			ImageRefs:        []string{"main.png"},
			Tags:             []string{"steel"},
			FilterDimensions: []string{"size"},
		}},
		{Parsed: parsedRow{
			GroupKey:         "group-a",
			SkuCode:          "SKU-B",
			ProductName:      "Bolt B",
			SkuName:          "Bolt B M8",
			CategoryID:       uuid.New(),
			CoverImageRef:    "main.png",
			ImageRefs:        []string{"main.png"},
			Tags:             []string{"steel"},
			FilterDimensions: []string{"size"},
		}},
	}

	message := validateGroupRows(rows)
	if message != "rows in the same groupKey must share identical product-level fields" {
		t.Fatalf("unexpected validation message: %q", message)
	}
}

func TestValidateGroupRowsRejectsDuplicateSkuCode(t *testing.T) {
	categoryID := uuid.New()
	rows := []*rowExecutionState{
		{Parsed: parsedRow{
			GroupKey:         "group-a",
			SkuCode:          "DUP-1",
			ProductName:      "Bolt A",
			SkuName:          "Bolt A M6",
			CategoryID:       categoryID,
			CoverImageRef:    "main.png",
			ImageRefs:        []string{"main.png"},
			Tags:             []string{"steel"},
			FilterDimensions: []string{"size"},
		}},
		{Parsed: parsedRow{
			GroupKey:         "group-a",
			SkuCode:          "DUP-1",
			ProductName:      "Bolt A",
			SkuName:          "Bolt A M8",
			CategoryID:       categoryID,
			CoverImageRef:    "main.png",
			ImageRefs:        []string{"main.png"},
			Tags:             []string{"steel"},
			FilterDimensions: []string{"size"},
		}},
	}

	message := validateGroupRows(rows)
	if message != `duplicate skuCode "DUP-1" in the same group` {
		t.Fatalf("unexpected validation message: %q", message)
	}
}

func parserTestRow(values map[string]string) []string {
	spec := excel.ProductImportTemplate()
	row := make([]string, len(spec.Columns))
	for index, column := range spec.Columns {
		row[index] = values[column.Key]
	}
	return row
}

func TestThreeLevelImportAndConflicts(t *testing.T) {
	base := map[string]string{"groupkey": "a", "productname": "螺丝", "categoryid": uuid.NewString(), "spec1name": "材质", "spec1value": "钢", "spec2name": "长度", "spec2value": "10mm", "spec3name": "直径", "spec3value": "M6", "attributes": `{"备注":"a|b:c"}`}
	for _, tc := range []struct {
		name, key, value string
		valid            bool
	}{
		{"three levels", "", "", true}, {"gap", "spec2name", "", false}, {"duplicate", "spec2name", "材质", false}, {"legacy conflict", "spec", "M6", false}, {"attribute conflict", "attributes", `{"材质":"铝"}`, false}, {"status", "productstatus", "PUBLISHED", false}, {"id", "skuid", "not-a-uuid", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			values := map[string]string{}
			for k, v := range base {
				values[k] = v
			}
			if tc.key != "" {
				values[tc.key] = tc.value
			}
			rows, err := parseWorkbookRows([][]string{excel.TemplateHeaders(excel.ProductImportTemplate()), parserTestRow(values)})
			if err != nil {
				t.Fatal(err)
			}
			if (rows[0].Error == "") != tc.valid {
				t.Fatalf("unexpected error %q", rows[0].Error)
			}
			if tc.valid && (rows[0].Row.Spec == nil || *rows[0].Row.Spec != "钢 / 10mm / M6" || rows[0].Row.Attributes["备注"] != "a|b:c") {
				t.Fatalf("unexpected parsed row %+v", rows[0].Row)
			}
		})
	}
}

func TestProductOnlyExportRowDoesNotCreateSKU(t *testing.T) {
	row := parserTestRow(map[string]string{"groupkey": "a", "productid": uuid.NewString(), "productname": "draft", "categoryid": uuid.NewString(), "productstatus": "DRAFT", "spec1name": "规格"})
	rows, err := parseWorkbookRows([][]string{excel.TemplateHeaders(excel.ProductImportTemplate()), row})
	if err != nil || rows[0].Error != "" || !rows[0].Row.NoSKU {
		t.Fatalf("unexpected row %#v, err %v", rows, err)
	}
}

func TestInvalidRowFailsWholeGroup(t *testing.T) {
	states := []*rowExecutionState{{Parsed: parsedRow{GroupKey: "a", ProductID: uuid.New(), ProductName: "x", RowNumber: 2}}, {Parsed: parsedRow{GroupKey: "a", ProductName: "x", RowNumber: 3}, Error: "bad dimensions"}}
	groups := (&Service{}).buildGroups(states)
	if len(groups) != 0 || states[0].Error == "" {
		t.Fatal("invalid row must reject the entire product")
	}
}

func TestRejectsFourthExplicitLevelAndKeepsSpecNamedAttribute(t *testing.T) {
	fields := map[string]string{"groupkey": "a", "productname": "x", "categoryid": uuid.NewString(), "spec1name": "spec", "spec1value": "M6", "attributes": `{"spec":"M6"}`}
	headers := excel.TemplateHeaders(excel.ProductImportTemplate())
	rows, err := parseWorkbookRows([][]string{headers, parserTestRow(fields)})
	if err != nil || rows[0].Error != "" || rows[0].Row.Attributes["spec"] != "M6" {
		t.Fatalf("spec dimension lost: %+v %v", rows, err)
	}
	rows, err = parseWorkbookRows([][]string{append(headers, "Spec 4 Name"), append(parserTestRow(fields), "Color")})
	if err != nil || rows[0].Error == "" {
		t.Fatalf("fourth level accepted: %+v %v", rows, err)
	}
}

func TestInactiveHistoricalSpecificationsKeepOriginalAttributes(t *testing.T) {
	rows := [][]string{excel.TemplateHeaders(excel.ProductImportTemplate()), parserTestRow(map[string]string{
		"groupkey": "history", "productname": "History", "skuname": "old SKU", "categoryid": uuid.New().String(),
		"spec1name": "New Level", "spec": "old value", "attributes": "{\"Old Level\":\"old value\"}", "isactive": "false",
	})}
	parsed, err := parseWorkbookRows(rows)
	if err != nil || len(parsed) != 1 || parsed[0].Error != "" {
		t.Fatalf("parse: %v %+v", err, parsed)
	}
	row := parsed[0].Row
	if len(row.Attributes) != 1 || row.Attributes["Old Level"] != "old value" || row.Spec == nil || *row.Spec != "old value" {
		t.Fatalf("historical snapshot changed: %+v", row)
	}
}
