package excel

import (
	"errors"
	"io"
	"strings"
	"unicode"

	"github.com/xuri/excelize/v2"
)

func ReadRows(reader io.Reader) ([][]string, error) {
	file, err := excelize.OpenReader(reader)
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = file.Close()
	}()

	sheet := file.GetSheetName(0)
	if sheet == "" {
		return nil, errors.New("empty workbook")
	}
	rows, err := file.GetRows(sheet)
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, errors.New("empty worksheet")
	}
	return rows, nil
}

func NormalizeHeaderKey(value string) string {
	trimmed := strings.TrimSpace(strings.ToLower(value))
	return strings.Map(func(r rune) rune {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			return r
		}
		return -1
	}, trimmed)
}

func HeaderIndexMap(headers []string) map[string]int {
	index := make(map[string]int, len(headers))
	for i, header := range headers {
		key := NormalizeHeaderKey(header)
		if key == "" {
			continue
		}
		index[key] = i
	}
	return index
}

func CellValue(row []string, index map[string]int, key string) string {
	idx, ok := index[key]
	if !ok {
		return ""
	}
	if idx >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[idx])
}
