package productimport

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/teamdsb/tmo/services/commerce/internal/excel"
	"github.com/xuri/excelize/v2"
)

func trialFixtureSheets() []excel.Worksheet {
	return []excel.Worksheet{
		{Name: "商品", Rows: [][]string{{"试运行商品母表"}, {"一级分类", "二级分类", "三级分类", "规范商品名称", "商品编号", "商品说明", "主图编号", "主图文件"}, {"五金", "紧固件", "螺钉", "内六角螺钉", "P-1", "保留商品说明", "IMG-1", "images/screw.png"}}},
		{Name: "SKU规格", Rows: [][]string{{"商品编号", "SKU编号", "SKU显示名称", "需求数量单位", "销售单价", "图片编号", "原始行号"}, {"P-1", "S-1", "M5x16", "个", "", "IMG-1", "100"}, {"P-1", "S-2", "M5x20", "个", "", "IMG-1", "101"}}},
		{Name: "独立属性", Rows: [][]string{{"商品编号", "SKU编号", "属性名称", "数值", "文本值", "单位", "依据", "来源编号"}, {"P-1", "S-1", "螺纹直径", "", "M5", "", "目录", "SOURCE-1"}, {"P-1", "S-1", "长度", "16", "", "mm", "目录", "SOURCE-1"}, {"P-1", "S-1", "螺距", "0.8", "", "mm", "目录", "SOURCE-1"}, {"P-1", "S-1", "性能等级", "", "8.8", "", "目录", "SOURCE-1"}, {"P-1", "S-2", "螺纹直径", "", "M5", "", "目录", "SOURCE-1"}, {"P-1", "S-2", "长度", "20", "", "mm", "目录", "SOURCE-1"}, {"P-1", "S-2", "螺距", "0.8", "", "mm", "目录", "SOURCE-1"}}},
		{Name: "图片索引", Rows: [][]string{{"图片编号", "相对文件路径", "适用商品编号", "适用SKU编号", "使用边界"}, {"IMG-1", "images/screw.png", "P-1", "S-1;S-2", "仅示意"}}},
	}
}

func TestTrialMasterJoinAndActualCombinations(t *testing.T) {
	format, rows, err := parseSourceSheets(trialFixtureSheets())
	if err != nil {
		t.Fatal(err)
	}
	if format != sourceTrialMaster || len(rows) != 2 {
		t.Fatalf("%s %+v", format, rows)
	}
	for i, row := range rows {
		if row.Error != "" || row.Row.Split || row.Row.SourceProductKey != "P-1" || row.Row.SourceSheet != "SKU规格" || row.Row.SourceRow != i+2 || len(row.Row.PriceTiers) != 0 || row.Row.ProvidedFields["priceTiers"] || row.Row.ProductStatus != "" {
			t.Fatalf("unexpected row: %+v", row)
		}
		if !reflect.DeepEqual(row.Row.FilterDimensions, []string{"螺纹直径", "长度", "螺距"}) || !reflect.DeepEqual(row.Row.SourceCategoryPath, []string{"五金", "紧固件", "螺钉"}) {
			t.Fatalf("wrong join: %+v", row)
		}
		if row.Row.CoverImageRef != "" || len(row.Row.ImageRefs) > 0 || !strings.Contains(row.Row.RawValues["sourceImages"], "仅示意") {
			t.Fatalf("unresolved image path published or provenance lost: %+v", row)
		}
	}
	if derefString(rows[0].Row.Spec) != "M5 / 16mm / 0.8mm" || derefString(rows[1].Row.Spec) != "M5 / 20mm / 0.8mm" || rows[0].Row.Attributes["性能等级"] != "8.8" {
		t.Fatalf("wrong recognized options: %+v", rows)
	}
	var attrs []map[string]string
	if err := json.Unmarshal([]byte(rows[0].Row.RawValues["sourceAttributes"]), &attrs); err != nil || len(attrs) != 4 || attrs[1]["单位"] != "mm" || attrs[1]["来源编号"] != "SOURCE-1" {
		t.Fatalf("attribute provenance lost: %+v %v", attrs, err)
	}
}

func TestTrialMasterSplitsOnlyMissingUnitAndKeysSurviveReorder(t *testing.T) {
	sheets := trialFixtureSheets()
	sheets[2].Rows[6][5] = ""
	_, rows, err := parseSourceSheets(sheets)
	if err != nil {
		t.Fatal(err)
	}
	if rows[0].Row.Split || !rows[1].Row.Split || rows[0].Row.GroupKey == rows[1].Row.GroupKey || rows[1].Row.ProductStatus != "DRAFT" || rows[1].Row.Issues[0].Code != "DIMENSION_UNIT_MISSING" {
		t.Fatalf("unexpected split: %+v", rows)
	}
	first := map[string]parsedRow{}
	for _, row := range rows {
		first[row.Row.SourceSKUKey] = row.Row
	}
	sheets[1].Rows[1], sheets[1].Rows[2] = sheets[1].Rows[2], sheets[1].Rows[1]
	sheets[1].Rows[1][6] = "999"
	sheets[2].Rows[1], sheets[2].Rows[7] = sheets[2].Rows[7], sheets[2].Rows[1]
	_, reordered, err := parseSourceSheets(sheets)
	if err != nil {
		t.Fatal(err)
	}
	for _, state := range reordered {
		previous := first[state.Row.SourceSKUKey]
		if previous.SourceProductKey != state.Row.SourceProductKey || previous.SourceFingerprint != state.Row.SourceFingerprint {
			t.Fatalf("source identity changed after reorder: %+v %+v", previous, state.Row)
		}
	}
}

func TestTrialMasterRejectsOrphanAttributesAndConflictingIdentity(t *testing.T) {
	sheets := trialFixtureSheets()
	sheets[2].Rows[1][1] = "missing"
	if _, _, err := parseSourceSheets(sheets); err == nil {
		t.Fatal("accepted unknown SKU attribute")
	}
	sheets = trialFixtureSheets()
	sheets[1].Rows[2][1] = "S-1"
	_, rows, err := parseSourceSheets(sheets)
	if err == nil && rows[0].Error == "" {
		t.Fatal("accepted conflicting SKU identity")
	}
}

func TestTrialMasterDoesNotGuessUnrecognizedQuantityUnits(t *testing.T) {
	for _, unit := range []string{"GK", "ge", "9"} {
		sheets := trialFixtureSheets()
		sheets[1].Rows[1][3] = unit
		_, rows, err := parseSourceSheets(sheets)
		if err != nil {
			t.Fatal(err)
		}
		if !rows[0].Row.Split || rows[1].Row.Split || derefString(rows[0].Row.Unit) != unit || rows[0].Row.Issues[0].Code != "UNIT_UNRECOGNIZED" {
			t.Fatalf("unit %s inferred or wrong row split: %+v", unit, rows)
		}
	}
	for _, unit := range []string{"㎡", "m²", "m2", "平方米"} {
		sheets := trialFixtureSheets()
		sheets[1].Rows[1][3] = unit
		_, rows, err := parseSourceSheets(sheets)
		if err != nil {
			t.Fatal(err)
		}
		if rows[0].Row.Split || derefString(rows[0].Row.Unit) != unit {
			t.Fatalf("explicit area unit %s was changed: %+v", unit, rows[0].Row)
		}
	}
}

func TestTrialDuplicateCombinationHasDeterministicIsolatedIdentity(t *testing.T) {
	sheets := trialFixtureSheets()
	sheets[2].Rows[6][3] = "16"
	_, rows, err := parseSourceSheets(sheets)
	if err != nil {
		t.Fatal(err)
	}
	if !rows[0].Row.Split || !rows[1].Row.Split || rows[0].Row.Issues[0].Code != "SPEC_COMBINATION_DUPLICATE" || rows[1].Row.Issues[0].Code != "SPEC_COMBINATION_DUPLICATE" {
		t.Fatalf("ambiguous combo accepted: %+v", rows)
	}
	splitKeys := map[string]string{rows[0].Row.SourceSKUKey: rows[0].Row.SourceProductKey, rows[1].Row.SourceSKUKey: rows[1].Row.SourceProductKey}
	sheets[1].Rows[1], sheets[1].Rows[2] = sheets[1].Rows[2], sheets[1].Rows[1]
	_, rows, err = parseSourceSheets(sheets)
	if err != nil {
		t.Fatal(err)
	}
	for _, row := range rows {
		if !row.Row.Split || row.Row.SourceProductKey != splitKeys[row.Row.SourceSKUKey] {
			t.Fatalf("reordering changed isolated identity: %+v", rows)
		}
	}
}

func TestChineseMaintenanceHeadersPreserveStandardIDs(t *testing.T) {
	template := excel.ProductMaintenanceTemplate()
	headers := excel.TemplateHeaders(template)
	values := map[string]string{"groupkey": "group", "productid": uuid.NewString(), "skuid": uuid.NewString(), "productname": "螺钉", "skuname": "M5 16", "categoryid": uuid.Nil.String(), "spec1name": "直径", "spec1value": "M5", "spec2name": "长度", "spec2value": "16mm", "pricetiers": "1-:1234", "isactive": "true", "coverimage": "https://example.com/front.png", "attributes": "{\"来源\":\"原始证据\"}"}
	row := make([]string, len(template.Columns))
	for index, column := range template.Columns {
		row[index] = values[column.Key]
	}
	format, parsed, err := parseSourceSheets([]excel.Worksheet{{Name: "说明", Rows: [][]string{{"如何填写"}}}, {Name: "商品维护", Rows: [][]string{{"中文标题"}, headers, row}}})
	if err != nil {
		t.Fatal(err)
	}
	if format != sourceStandard || len(parsed) != 1 || parsed[0].Error != "" {
		t.Fatalf("unexpected parse: %+v %s", parsed, format)
	}
	actual := parsed[0].Row
	if actual.ProductID.String() != values["productid"] || actual.SkuID.String() != values["skuid"] || derefString(actual.Spec) != "M5 / 16mm" || len(actual.PriceTiers) != 1 || actual.PriceTiers[0].UnitPriceFen != 1234 || actual.Attributes["来源"] != "原始证据" || actual.CoverImageRef != values["coverimage"] {
		t.Fatalf("Chinese header mapping lost values: %+v", actual)
	}
}

func TestLegacyRowsUseStableBusinessKeysAndDoNotInferUnits(t *testing.T) {
	sheet := excel.Worksheet{Name: "采购数据", Rows: [][]string{{"采购资料"}, {"序号", "物资", "规格型号", "单位", "分类"}, {"1", "纸箱", "620*600*340", "个", "低耗"}, {"2", "纸箱", "62*42*45CM", "只", "低耗"}, {"3", "纸箱", "620*600*340", "个", "低耗"}, {"4", "轴承", "30309", "个", "五金"}, {"5", "轴承", "30309", "GK", "五金"}, {"6", "辅料", "3722p", "kg", "原材料"}}}
	format, rows, err := parseSourceSheets([]excel.Worksheet{sheet})
	if err != nil {
		t.Fatal(err)
	}
	if format != sourceLegacyFiveColumn || len(rows) != 6 || !rows[0].Row.Split || rows[1].Row.Split || !rows[2].Row.Ignored || rows[3].Row.Split || !rows[4].Row.Split || !rows[5].Row.Split {
		t.Fatalf("unexpected legacy recognition: %+v", rows)
	}
	if rows[0].Row.SourceRow != 3 || rows[0].Row.SourceProductKey != rows[2].Row.SourceProductKey || rows[0].Row.SourceSKUKey != rows[2].Row.SourceSKUKey || rows[0].Row.SourceFingerprint != rows[2].Row.SourceFingerprint || derefString(rows[1].Row.Spec) != "62cm / 42cm / 45cm" {
		t.Fatalf("identity or dimensions wrong: %+v", rows)
	}
	if rows[1].Row.ProductStatus != "" || rows[3].Row.ProductStatus != "" {
		t.Fatal("normal source rows must preserve existing product status")
	}
}

func TestSourceWorkbookMergedCellsAndBlankStandardFields(t *testing.T) {
	file := excelize.NewFile()
	defer func() { _ = file.Close() }()
	_ = file.SetCellValue("Sheet1", "A1", "三级规格模板")
	rows := [][]interface{}{{"商品分组", "商品ID", "SKUID", "商品名称", "分类ID", "SKU名称", "单位", "规格1名称", "规格1值", "规格2名称", "规格2值", "价格"}, {"same", uuid.NewString(), uuid.NewString(), "螺钉", uuid.Nil.String(), "M5 16", "个", "直径", "M5", "长度", "16mm", ""}, {"", "", uuid.NewString(), "", "", "M5 20", "", "", "M5", "", "20mm", ""}}
	for index, row := range rows {
		cell, _ := excelize.CoordinatesToCellName(1, index+2)
		_ = file.SetSheetRow("Sheet1", cell, &row)
	}
	for _, column := range []string{"A", "B", "D", "E", "H", "J"} {
		_ = file.MergeCell("Sheet1", column+"3", column+"4")
	}
	path := filepath.Join(t.TempDir(), "merged.xlsx")
	if err := file.SaveAs(path); err != nil {
		t.Fatal(err)
	}
	format, parsed, err := parseSourceWorkbook(path)
	if err != nil {
		t.Fatal(err)
	}
	if format != sourceStandard || len(parsed) != 2 {
		t.Fatalf("unexpected rows: %+v", parsed)
	}
	if parsed[0].Error != "" || parsed[1].Error != "" || parsed[1].Row.Unit != nil || parsed[1].Row.ProvidedFields["unit"] || parsed[1].Row.ProvidedFields["priceTiers"] || parsed[1].Row.SourceRow != 4 || parsed[1].Row.ProductID != parsed[0].Row.ProductID {
		t.Fatalf("unexpected standard parse: %+v", parsed)
	}
}

func TestSourcePriceParsing(t *testing.T) {
	for raw, want := range map[string]int64{"0": 0, "12": 1200, "12.34": 1234, "0.01": 1} {
		got, err := parseSourceYuan(raw)
		if err != nil || got != want {
			t.Fatalf("%s: %d %v", raw, got, err)
		}
	}
	for _, raw := range []string{"-1", "NaN", "1.001", "9223372036854775808", "1e3"} {
		if _, err := parseSourceYuan(raw); err == nil {
			t.Fatalf("accepted %s", raw)
		}
	}
}

func TestSourceRejectsAmbiguousDuplicateHeaders(t *testing.T) {
	sheets := trialFixtureSheets()
	sheets[1].Rows[0] = append(sheets[1].Rows[0], "SKU编号")
	if _, _, err := parseSourceSheets(sheets); err == nil {
		t.Fatal("accepted ambiguous source identity header")
	}
	_, _, err := parseSourceSheets([]excel.Worksheet{{Name: "商品", Rows: [][]string{{"商品分组", "Group Key", "商品名称", "分类ID"}, {"one", "two", "name", uuid.Nil.String()}}}})
	if err == nil {
		t.Fatal("accepted canonical duplicate standard header")
	}
}

func TestOriginalTrialMasterWorkbook(t *testing.T) {
	path := os.Getenv("TMO_TRIAL_MASTER_WORKBOOK")
	if path == "" {
		t.Skip("set TMO_TRIAL_MASTER_WORKBOOK for read-only original workbook acceptance")
	}
	format, rows, err := parseSourceWorkbook(path)
	if err != nil {
		t.Fatal(err)
	}
	if format != sourceTrialMaster || len(rows) != 42 {
		t.Fatalf("format=%s rows=%d", format, len(rows))
	}
	counts := map[string]int{}
	images := map[string]bool{}
	attributeCount := 0
	bySKU := map[string]parsedRow{}
	for _, state := range rows {
		row := state.Row
		if state.Error != "" || row.Split || row.Ignored || len(row.Issues) > 0 {
			t.Fatalf("unexpected source anomaly: %+v", state)
		}
		counts[row.ProductName]++
		bySKU[row.SourceSKUKey] = row
		var attrs []map[string]string
		if err := json.Unmarshal([]byte(row.RawValues["sourceAttributes"]), &attrs); err != nil {
			t.Fatal(err)
		}
		attributeCount += len(attrs)
		var records []map[string]string
		if err := json.Unmarshal([]byte(row.RawValues["sourceImages"]), &records); err != nil {
			t.Fatal(err)
		}
		for _, record := range records {
			images[record["图片编号"]] = true
		}
		if len(row.PriceTiers) > 0 || row.ProvidedFields["priceTiers"] {
			t.Fatal("blank source price became a price tier")
		}
	}
	if len(counts) != 10 || attributeCount != 325 || len(images) != 12 {
		t.Fatalf("products=%d attributes=%d images=%d", len(counts), attributeCount, len(images))
	}
	wants := map[string]string{"S-FS-510F6022": "M5 / 16mm / 0.8mm", "S-FS-D8E632BA": "M8 / 30mm / 1.25mm", "S-FS-2A89791F": "M4", "S-PV-29CB27F9": "DN50 / 60.3mm", "S-TX-FD476D3B": "1250mm / 4mm / 180m", "S-TX-4E4ADE7C": "50mm / 黑色 / 毛面", "S-TX-8B22537C": "22mm / 600D / 红色", "S-TL-79918CFB": "12寸", "S-TL-76864915": "6mm", "S-PK-C612316C": "16mm / 15m", "S-OF-4EFCCE3E": "A4"}
	for key, want := range wants {
		if got := derefString(bySKU[key].Spec); got != want {
			t.Errorf("%s got %q want %q", key, got, want)
		}
	}
	if bySKU["S-FS-510F6022"].Attributes["性能等级"] != "8.8" || bySKU["S-PV-29CB27F9"].Attributes["材料牌号"] != "1.4571" {
		t.Fatal("extension attributes lost")
	}
	names := make([]string, 0, len(counts))
	for name := range counts {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		t.Logf("%s: %d actual SKUs", name, counts[name])
	}
	t.Logf("accepted %d products, %d actual SKUs, %d attribute rows, %d image mappings", len(counts), len(rows), attributeCount, len(images))
}
