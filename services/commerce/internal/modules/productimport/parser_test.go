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
