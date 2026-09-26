package excel

import (
	"bytes"
	"testing"

	"github.com/xuri/excelize/v2"
)

func TestReadWorkbookExpandsOnlyActualMerges(t *testing.T) {
	file := excelize.NewFile()
	defer func() { _ = file.Close() }()
	_ = file.SetCellValue("Sheet1", "A1", "标题")
	_ = file.MergeCell("Sheet1", "A1", "C1")
	_ = file.SetCellValue("Sheet1", "A2", "共享商品")
	_ = file.SetCellValue("Sheet1", "B2", "sku1")
	_ = file.SetCellValue("Sheet1", "B3", "sku2")
	_ = file.MergeCell("Sheet1", "A2", "A3")
	_ = file.SetCellValue("Sheet1", "B4", "sku3")
	_, _ = file.NewSheet("附表")
	_ = file.SetCellValue("附表", "A1", "other")
	payload, err := file.WriteToBuffer()
	if err != nil {
		t.Fatal(err)
	}
	sheets, err := ReadWorkbook(bytes.NewReader(payload.Bytes()))
	if err != nil {
		t.Fatal(err)
	}
	if len(sheets) != 2 || sheets[0].Rows[2][0] != "共享商品" || sheets[0].Rows[3][0] != "" {
		t.Fatalf("unexpected merge expansion: %+v", sheets)
	}
}
