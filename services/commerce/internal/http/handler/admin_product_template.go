package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/teamdsb/tmo/services/commerce/internal/excel"
	"github.com/xuri/excelize/v2"
)

func (h *Handler) GetAdminProductImportTemplate(c *gin.Context) {
	if _, ok := h.requireRole(c, "BOSS", "ADMIN"); !ok {
		return
	}
	file := excelize.NewFile()
	defer func() { _ = file.Close() }()
	spec := excel.ProductMaintenanceTemplate()
	if err := file.SetSheetName("Sheet1", spec.SheetName); err != nil {
		h.importWorkbenchError(c, err)
		return
	}
	for i, column := range spec.Columns {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		if err := file.SetCellValue(spec.SheetName, cell, column.Header); err != nil {
			h.importWorkbenchError(c, err)
			return
		}
	}
	if err := excel.FormatProductWorkbook(file, spec.SheetName, len(spec.Columns)); err != nil {
		h.importWorkbenchError(c, err)
		return
	}
	if _, err := file.NewSheet("分类参考"); err != nil {
		h.importWorkbenchError(c, err)
		return
	}
	headers := []interface{}{"分类ID", "分类名称", "父分类ID"}
	if err := file.SetSheetRow("分类参考", "A1", &headers); err != nil {
		h.importWorkbenchError(c, err)
		return
	}
	if h.CatalogStore != nil {
		categories, err := h.CatalogStore.ListCategories(c.Request.Context())
		if err != nil {
			h.importWorkbenchError(c, err)
			return
		}
		for i, category := range categories {
			parent := ""
			if category.ParentID.Valid {
				parent = uuid.UUID(category.ParentID.Bytes).String()
			}
			row := []interface{}{category.ID.String(), category.Name, parent}
			cell, _ := excelize.CoordinatesToCellName(1, i+2)
			if err := file.SetSheetRow("分类参考", cell, &row); err != nil {
				h.importWorkbenchError(c, err)
				return
			}
		}
	}
	if err := excel.FormatProductWorkbook(file, "分类参考", 3); err != nil {
		h.importWorkbenchError(c, err)
		return
	}
	data, err := file.WriteToBuffer()
	if err != nil {
		h.importWorkbenchError(c, err)
		return
	}
	c.Header("Content-Disposition", `attachment; filename="product-template.xlsx"`)
	c.Data(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", data.Bytes())
}
