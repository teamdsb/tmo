package excel

import (
	"fmt"
	"io"

	"github.com/xuri/excelize/v2"
)

type Worksheet struct {
	Name string
	Rows [][]string
}

// ReadWorkbook preserves sheet order and expands only explicitly merged cells.
func ReadWorkbook(reader io.Reader) ([]Worksheet, error) {
	file, err := excelize.OpenReader(reader)
	if err != nil {
		return nil, err
	}
	defer func() { _ = file.Close() }()
	sheets := make([]Worksheet, 0, file.SheetCount)
	for _, name := range file.GetSheetList() {
		rows, err := file.GetRows(name)
		if err != nil {
			return nil, fmt.Errorf("read worksheet %q: %w", name, err)
		}
		merges, err := file.GetMergeCells(name)
		if err != nil {
			return nil, err
		}
		for _, merge := range merges {
			startCol, startRow, err := excelize.CellNameToCoordinates(merge.GetStartAxis())
			if err != nil {
				return nil, err
			}
			endCol, endRow, err := excelize.CellNameToCoordinates(merge.GetEndAxis())
			if err != nil {
				return nil, err
			}
			// A formatted merge far below the data is not an instruction to allocate a full sheet.
			if startRow > len(rows) {
				continue
			}
			if endRow > len(rows) {
				endRow = len(rows)
			}
			value, err := file.GetCellValue(name, merge.GetStartAxis())
			if err != nil {
				return nil, err
			}
			for row := startRow; row <= endRow; row++ {
				if len(rows[row-1]) < endCol {
					rows[row-1] = append(rows[row-1], make([]string, endCol-len(rows[row-1]))...)
				}
				for col := startCol; col <= endCol; col++ {
					rows[row-1][col-1] = value
				}
			}
		}
		sheets = append(sheets, Worksheet{Name: name, Rows: rows})
	}
	if len(sheets) == 0 {
		return nil, fmt.Errorf("empty workbook")
	}
	return sheets, nil
}
