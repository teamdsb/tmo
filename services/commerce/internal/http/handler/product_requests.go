package handler

import (
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/http/oapi"
)

const maxProductRequestAssetSize int64 = 5 * 1024 * 1024
const productRequestsCategoryForeignKey = "product_requests_category_id_fkey"

var allowedProductRequestAssetTypes = map[string]string{
	"image/jpeg":      ".jpg",
	"image/png":       ".png",
	"image/webp":      ".webp",
	"application/pdf": ".pdf",
}

func isCategoryForeignKeyViolation(err error) bool {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		return false
	}
	return pgErr.Code == "23503" && pgErr.ConstraintName == productRequestsCategoryForeignKey
}

func (h *Handler) GetProductRequests(c *gin.Context, params oapi.GetProductRequestsParams) {
	claims, ok := h.requireRole(c, "CUSTOMER", "SALES", "CS", "ADMIN")
	if !ok {
		return
	}

	page := 1
	pageSize := 20
	if params.Page != nil && *params.Page > 0 {
		page = *params.Page
	}
	if params.PageSize != nil && *params.PageSize > 0 {
		pageSize = *params.PageSize
	}
	if pageSize > 100 {
		pageSize = 100
	}
	offset := (page - 1) * pageSize

	role := strings.ToUpper(claims.Role)
	createdByFilter := pgtype.UUID{}
	ownerSalesFilter := pgtype.UUID{}
	switch role {
	case "CUSTOMER":
		createdByFilter = pgtype.UUID{Bytes: claims.UserID, Valid: true}
	case "SALES":
		ownerSalesFilter = pgtype.UUID{Bytes: claims.UserID, Valid: true}
	}

	createdAfter := pgtype.Timestamptz{}
	if params.CreatedAfter != nil {
		createdAfter = pgtype.Timestamptz{Time: *params.CreatedAfter, Valid: true}
	}
	createdBefore := pgtype.Timestamptz{}
	if params.CreatedBefore != nil {
		createdBefore = pgtype.Timestamptz{Time: *params.CreatedBefore, Valid: true}
	}

	requests, err := h.ProductRequestStore.ListProductRequests(c.Request.Context(), db.ListProductRequestsParams{
		CreatedByUserID:  createdByFilter,
		OwnerSalesUserID: ownerSalesFilter,
		CreatedAfter:     createdAfter,
		CreatedBefore:    createdBefore,
		Offset:           clampInt32(offset),
		Limit:            clampInt32(pageSize),
	})
	if err != nil {
		h.logError("list product requests failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list product requests")
		return
	}

	total, err := h.ProductRequestStore.CountProductRequests(c.Request.Context(), db.CountProductRequestsParams{
		CreatedByUserID:  createdByFilter,
		OwnerSalesUserID: ownerSalesFilter,
		CreatedAfter:     createdAfter,
		CreatedBefore:    createdBefore,
	})
	if err != nil {
		h.logError("count product requests failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list product requests")
		return
	}

	items := make([]oapi.ProductRequest, 0, len(requests))
	for _, request := range requests {
		items = append(items, productRequestFromModel(request))
	}

	c.JSON(http.StatusOK, oapi.PagedProductRequestList{
		Items:    items,
		Page:     page,
		PageSize: pageSize,
		Total:    int(total),
	})
}

func (h *Handler) PostProductRequests(c *gin.Context) {
	claims, ok := h.requireRole(c, "CUSTOMER", "ADMIN")
	if !ok {
		return
	}

	var request oapi.CreateProductRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}
	if strings.TrimSpace(request.Name) == "" {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "name is required")
		return
	}

	ownerSales := pgtype.UUID{}
	if strings.EqualFold(claims.Role, "CUSTOMER") && claims.OwnerSalesUserID != uuid.Nil {
		ownerSales = pgtype.UUID{Bytes: claims.OwnerSalesUserID, Valid: true}
	}

	created, err := h.ProductRequestStore.CreateProductRequest(c.Request.Context(), db.CreateProductRequestParams{
		CreatedByUserID:    claims.UserID,
		OwnerSalesUserID:   ownerSales,
		Name:               request.Name,
		CategoryID:         uuidToPgtype(request.CategoryId),
		Spec:               request.Spec,
		Material:           request.Material,
		Dimensions:         request.Dimensions,
		Color:              request.Color,
		Qty:                request.Qty,
		Note:               request.Note,
		ReferenceImageUrls: defaultStringSlice(request.ReferenceImageUrls),
	})
	if err != nil {
		if isCategoryForeignKeyViolation(err) {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "categoryId does not exist")
			return
		}
		h.logError("create product request failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to create product request")
		return
	}

	c.JSON(http.StatusCreated, productRequestFromModel(created))
}

func productRequestFromModel(request db.ProductRequest) oapi.ProductRequest {
	response := oapi.ProductRequest{
		Id:              request.ID,
		CreatedByUserId: request.CreatedByUserID,
		Name:            request.Name,
		CreatedAt:       request.CreatedAt.Time,
	}
	if request.Spec != nil {
		response.Spec = request.Spec
	}
	if request.CategoryID.Valid {
		value := openapi_types.UUID(request.CategoryID.Bytes)
		response.CategoryId = &value
	}
	if request.Material != nil {
		response.Material = request.Material
	}
	if request.Dimensions != nil {
		response.Dimensions = request.Dimensions
	}
	if request.Color != nil {
		response.Color = request.Color
	}
	if request.Qty != nil {
		response.Qty = request.Qty
	}
	if request.Note != nil {
		response.Note = request.Note
	}
	if request.ReferenceImageUrls != nil {
		referenceImageURLs := append([]string(nil), request.ReferenceImageUrls...)
		response.ReferenceImageUrls = &referenceImageURLs
	}
	return response
}

func (h *Handler) PostProductRequestsAssets(c *gin.Context) {
	if _, ok := h.requireRole(c, "CUSTOMER", "ADMIN"); !ok {
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "missing file")
		return
	}
	if fileHeader.Size > maxProductRequestAssetSize {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "file exceeds 5MB limit")
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "failed to read file")
		return
	}
	defer func() {
		_ = file.Close()
	}()

	sniff := make([]byte, 512)
	n, err := io.ReadFull(file, sniff)
	if err != nil && err != io.ErrUnexpectedEOF {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "failed to read file")
		return
	}
	sniff = sniff[:n]
	contentType := http.DetectContentType(sniff)
	ext, allowed := allowedProductRequestAssetTypes[contentType]
	if !allowed {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "unsupported file type")
		return
	}

	localDir := strings.TrimSpace(h.MediaLocalOutputDir)
	baseURL := strings.TrimSpace(h.MediaPublicBaseURL)
	if localDir == "" || baseURL == "" {
		h.logError("product request asset upload is not configured", nil)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "media upload is not configured")
		return
	}

	subDir := filepath.Join(localDir, "product-requests")
	if err := os.MkdirAll(subDir, 0o755); err != nil {
		h.logError("create media directory failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to save file")
		return
	}

	fileName := uuid.NewString() + ext
	localPath := filepath.Join(subDir, fileName)
	dst, err := os.Create(localPath)
	if err != nil {
		h.logError("create media file failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to save file")
		return
	}

	written := int64(0)
	cleanup := func() {
		_ = dst.Close()
		_ = os.Remove(localPath)
	}

	if n > 0 {
		bytesWritten, writeErr := dst.Write(sniff)
		if writeErr != nil {
			cleanup()
			h.logError("write media file failed", writeErr)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to save file")
			return
		}
		written += int64(bytesWritten)
	}

	remaining := maxProductRequestAssetSize + 1 - written
	if remaining < 0 {
		cleanup()
		h.writeError(c, http.StatusBadRequest, "invalid_request", "file exceeds 5MB limit")
		return
	}

	copied, copyErr := io.Copy(dst, io.LimitReader(file, remaining))
	written += copied
	if copyErr != nil {
		cleanup()
		h.logError("write media file failed", copyErr)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to save file")
		return
	}
	if written > maxProductRequestAssetSize {
		cleanup()
		h.writeError(c, http.StatusBadRequest, "invalid_request", "file exceeds 5MB limit")
		return
	}
	if err := dst.Close(); err != nil {
		_ = os.Remove(localPath)
		h.logError("close media file failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to save file")
		return
	}

	publicURL := strings.TrimRight(baseURL, "/") + "/product-requests/" + fileName
	c.JSON(http.StatusCreated, oapi.ProductRequestAsset{
		Url:         publicURL,
		ContentType: contentType,
		Size:        written,
	})
}

func defaultStringSlice(value *[]string) []string {
	if value == nil {
		return []string{}
	}
	return *value
}

func uuidToPgtype(value *uuid.UUID) pgtype.UUID {
	if value == nil {
		return pgtype.UUID{}
	}
	return pgtype.UUID{Bytes: *value, Valid: true}
}
