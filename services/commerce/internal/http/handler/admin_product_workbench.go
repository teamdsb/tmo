package handler

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/http/oapi"
	"github.com/teamdsb/tmo/services/commerce/internal/modules/productimport"
)

func importPagination(c *gin.Context) (int, int, error) {
	page, size := 1, 20
	for _, field := range []struct {
		name   string
		target *int
	}{{"page", &page}, {"pageSize", &size}} {
		if raw := c.Query(field.name); raw != "" {
			value, err := strconv.Atoi(raw)
			if err != nil || value < 1 || value > 1000000 {
				return 0, 0, productimport.ErrInvalid
			}
			*field.target = value
		}
	}
	if size > 100 {
		size = 100
	}
	return page, size, nil
}

func (h *Handler) importWorkbenchError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		h.writeError(c, http.StatusNotFound, "not_found", "任务或复核记录不存在")
	case errors.Is(err, productimport.ErrConflict), errors.Is(err, productimport.ErrLeaseLost):
		h.writeError(c, http.StatusConflict, "import_conflict", err.Error())
	case errors.Is(err, productimport.ErrInvalid):
		h.writeError(c, http.StatusBadRequest, "invalid_request", err.Error())
	default:
		h.logError("product import workbench failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "商品任务处理失败")
	}
}

func (h *Handler) importWorkbenchReady(c *gin.Context) bool {
	if h.ProductImport == nil || h.ProductImport.DB == nil {
		h.writeError(c, http.StatusServiceUnavailable, "unavailable", "商品导入服务未配置")
		return false
	}
	return true
}

func (h *Handler) GetAdminProductImportPreview(c *gin.Context) {
	if _, ok := h.requireRole(c, "BOSS", "ADMIN"); !ok {
		return
	}
	id, err := uuid.Parse(c.Param("jobId"))
	if err != nil {
		h.importWorkbenchError(c, productimport.ErrInvalid)
		return
	}
	page, size, err := importPagination(c)
	if err != nil {
		h.importWorkbenchError(c, err)
		return
	}
	if !h.importWorkbenchReady(c) {
		return
	}
	result, err := h.ProductImport.GetPreview(c.Request.Context(), id, page, size, c.Query("needsReview") == "true")
	if err != nil {
		h.importWorkbenchError(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) PutAdminProductImportResolution(c *gin.Context) {
	if _, ok := h.requireRole(c, "BOSS", "ADMIN"); !ok {
		return
	}
	id, err := uuid.Parse(c.Param("jobId"))
	if err != nil {
		h.importWorkbenchError(c, productimport.ErrInvalid)
		return
	}
	var input productimport.ResolutionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		h.importWorkbenchError(c, productimport.ErrInvalid)
		return
	}
	if !h.importWorkbenchReady(c) {
		return
	}
	result, err := h.ProductImport.ResolvePreview(c.Request.Context(), id, input)
	if err != nil {
		h.importWorkbenchError(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) PostAdminProductImportConfirm(c *gin.Context) {
	actor, ok := h.requireRole(c, "BOSS", "ADMIN")
	if !ok {
		return
	}
	id, err := uuid.Parse(c.Param("jobId"))
	if err != nil {
		h.importWorkbenchError(c, productimport.ErrInvalid)
		return
	}
	var input struct {
		ExpectedRevision int `json:"expectedRevision"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		h.importWorkbenchError(c, productimport.ErrInvalid)
		return
	}
	key := strings.TrimSpace(c.GetHeader("Idempotency-Key"))
	if key == "" || len(key) > 200 {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "请提供 Idempotency-Key")
		return
	}
	if !h.importWorkbenchReady(c) {
		return
	}
	result, err := h.ProductImport.Confirm(c.Request.Context(), id, input.ExpectedRevision, actor.UserID, key)
	if err != nil {
		h.importWorkbenchError(c, err)
		return
	}
	c.JSON(http.StatusAccepted, result)
}

func (h *Handler) PostAdminProductImportCancel(c *gin.Context) {
	actor, ok := h.requireRole(c, "BOSS", "ADMIN")
	if !ok {
		return
	}
	id, err := uuid.Parse(c.Param("jobId"))
	if err != nil {
		h.importWorkbenchError(c, productimport.ErrInvalid)
		return
	}
	if !h.importWorkbenchReady(c) {
		return
	}
	result, err := h.ProductImport.Cancel(c.Request.Context(), id, actor.UserID)
	if err != nil {
		h.importWorkbenchError(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) GetAdminImportJobs(c *gin.Context) {
	if _, ok := h.requireRole(c, "BOSS", "ADMIN"); !ok {
		return
	}
	page, size, err := importPagination(c)
	if err != nil {
		h.importWorkbenchError(c, err)
		return
	}
	if !h.importWorkbenchReady(c) {
		return
	}
	result, err := h.ProductImport.ListJobs(c.Request.Context(), page, size, c.Query("type"), c.Query("status"))
	if err != nil {
		h.importWorkbenchError(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) GetAdminProductImportReviews(c *gin.Context) {
	if _, ok := h.requireRole(c, "BOSS", "ADMIN"); !ok {
		return
	}
	page, size, err := importPagination(c)
	if err != nil {
		h.importWorkbenchError(c, err)
		return
	}
	productID := uuid.Nil
	if raw := c.Query("productId"); raw != "" {
		productID, err = uuid.Parse(raw)
		if err != nil {
			h.importWorkbenchError(c, productimport.ErrInvalid)
			return
		}
	}
	status := c.DefaultQuery("status", "PENDING")
	if status != "PENDING" && status != "RESOLVED" && status != "ALL" {
		h.importWorkbenchError(c, productimport.ErrInvalid)
		return
	}
	if status == "ALL" {
		status = ""
	}
	if !h.importWorkbenchReady(c) {
		return
	}
	result, err := h.ProductImport.ListReviews(c.Request.Context(), page, size, status, productID)
	if err != nil {
		h.importWorkbenchError(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) PatchAdminProductImportReview(c *gin.Context) {
	actor, ok := h.requireRole(c, "BOSS", "ADMIN")
	if !ok {
		return
	}
	id, err := uuid.Parse(c.Param("reviewId"))
	if err != nil {
		h.importWorkbenchError(c, productimport.ErrInvalid)
		return
	}
	var input struct {
		Status string `json:"status"`
	}
	if err := c.ShouldBindJSON(&input); err != nil || input.Status != "RESOLVED" {
		h.importWorkbenchError(c, productimport.ErrInvalid)
		return
	}
	if !h.importWorkbenchReady(c) {
		return
	}
	result, err := h.ProductImport.ResolveReview(c.Request.Context(), id, actor.UserID)
	if err != nil {
		h.importWorkbenchError(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) GetAdminCatalogProducts(c *gin.Context) {
	if _, ok := h.requireRole(c, "BOSS", "ADMIN"); !ok {
		return
	}
	page, size, err := importPagination(c)
	if err != nil {
		h.importWorkbenchError(c, err)
		return
	}
	categoryID := pgtype.UUID{}
	if raw := c.Query("categoryId"); raw != "" {
		id := uuid.Nil
		if raw != "__NO_CATEGORY__" {
			id, err = uuid.Parse(raw)
			if err != nil {
				h.importWorkbenchError(c, productimport.ErrInvalid)
				return
			}
		}
		categoryID = pgtype.UUID{Bytes: id, Valid: true}
	}
	var status, query *string
	if value := c.Query("status"); value != "" && value != "ALL" {
		if value != "ACTIVE" && value != "DRAFT" && value != "INACTIVE" {
			h.importWorkbenchError(c, productimport.ErrInvalid)
			return
		}
		status = &value
	}
	if value := strings.TrimSpace(c.Query("q")); value != "" {
		query = &value
	}
	if h.DB == nil {
		h.writeError(c, http.StatusServiceUnavailable, "unavailable", "商品服务未配置")
		return
	}
	q := db.New(h.DB)
	needsReview := c.Query("needsReview") == "true"
	products, err := q.ListProductExportProducts(c.Request.Context(), db.ListProductExportProductsParams{Q: query, CategoryID: categoryID, Status: status, NeedsReview: needsReview, Limit: clampInt32(size), Offset: clampInt32((page - 1) * size)})
	if err != nil {
		h.importWorkbenchError(c, err)
		return
	}
	total, err := q.CountAdminCatalogProducts(c.Request.Context(), db.CountAdminCatalogProductsParams{Q: query, CategoryID: categoryID, Status: status, NeedsReview: needsReview})
	if err != nil {
		h.importWorkbenchError(c, err)
		return
	}
	type item struct {
		oapi.ProductSummary
		ReviewCount int `json:"reviewCount"`
	}
	items := make([]item, 0, len(products))
	for _, product := range products {
		count, err := q.CountPendingProductImportReviews(c.Request.Context(), product.ID)
		if err != nil {
			h.importWorkbenchError(c, err)
			return
		}
		items = append(items, item{ProductSummary: productSummaryFromModel(product), ReviewCount: int(count)})
	}
	c.JSON(http.StatusOK, gin.H{"items": items, "total": total, "page": page, "pageSize": size})
}
