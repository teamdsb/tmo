package productimport

import (
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/excel"
	"github.com/xuri/excelize/v2"
)

func (s *Service) writeResultWorkbook(job db.ProductImportJob, states []*rowExecutionState, summary Summary, status string) (*string, error) {
	file := excelize.NewFile()
	defer func() { _ = file.Close() }()
	if err := file.SetSheetName("Sheet1", "导入结果"); err != nil {
		return nil, err
	}
	headers := []interface{}{"商品名称", "SKU名称", "SKU编码", "规格", "单位", "处理结果", "原因", "工作表", "原始行", "商品ID", "SKU ID"}
	if err := file.SetSheetRow("导入结果", "A1", &headers); err != nil {
		return nil, err
	}
	labels := map[string]string{"SUCCEEDED": "已导入", "SKIPPED": "已跳过", "FAILED": "失败", "PENDING": "待处理"}
	for i, state := range states {
		row := state.Parsed
		messages := []string{}
		for _, issue := range row.Issues {
			messages = append(messages, issue.Message)
		}
		if state.Error != "" {
			messages = append(messages, state.Error)
		}
		productID, skuID := "", ""
		if state.Record.ProductID.Valid {
			productID = uuid.UUID(state.Record.ProductID.Bytes).String()
		}
		if state.Record.SkuID.Valid {
			skuID = uuid.UUID(state.Record.SkuID.Bytes).String()
		}
		label := labels[state.PersistedState]
		if label == "" {
			label = state.PersistedState
		}
		values := []interface{}{row.ProductName, row.SkuName, row.SkuCode, nullableText(row.Spec), nullableText(row.Unit), label, strings.Join(messages, "；"), row.SourceSheet, row.SourceRow, productID, skuID}
		cell, _ := excelize.CoordinatesToCellName(1, i+2)
		if err := file.SetSheetRow("导入结果", cell, &values); err != nil {
			return nil, err
		}
	}
	if err := excel.FormatProductWorkbook(file, "导入结果", len(headers)); err != nil {
		return nil, err
	}
	if _, err := file.NewSheet("汇总"); err != nil {
		return nil, err
	}
	summaryRows := [][]interface{}{{"项目", "数量或状态"}, {"任务", job.JobID.String()}, {"状态", status}, {"总行数", summary.TotalRows}, {"成功行数", summary.SuccessRows}, {"失败行数", summary.FailedRows}, {"跳过行数", summary.SkippedRows}, {"独立创建商品", summary.SplitProducts}, {"待复核行数", summary.ReviewCount}}
	for i, row := range summaryRows {
		cell, _ := excelize.CoordinatesToCellName(1, i+1)
		if err := file.SetSheetRow("汇总", cell, &row); err != nil {
			return nil, err
		}
	}
	if err := excel.FormatProductWorkbook(file, "汇总", 2); err != nil {
		return nil, err
	}
	reportID := uuid.NewString()
	relative := filepath.Join("import-jobs", job.JobID.String(), "reports", reportID, "result.xlsx")
	target := filepath.Join(s.MediaLocalOutputDir, relative)
	// #nosec G301 -- published report directories must be traversable by the separate Nginx user.
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return nil, err
	}
	// #nosec G302 G304 -- this UUID-based path is inside the job media directory; published workbooks must be readable by the separate Nginx user.
	destination, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644)
	if err != nil {
		return nil, err
	}
	if err := file.Write(destination); err != nil {
		_ = destination.Close()
		return nil, err
	}
	if err := destination.Close(); err != nil {
		return nil, err
	}
	result := strings.TrimRight(s.MediaPublicBaseURL, "/") + "/" + filepath.ToSlash(relative)
	return &result, nil
}

func nullableText(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
