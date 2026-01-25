package handler

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/http/oapi"
)

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
		CreatedByUserID:  claims.UserID,
		OwnerSalesUserID: ownerSales,
		Name:             request.Name,
		Spec:             request.Spec,
		Qty:              request.Qty,
		Note:             request.Note,
	})
	if err != nil {
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
	if request.Qty != nil {
		response.Qty = request.Qty
	}
	if request.Note != nil {
		response.Note = request.Note
	}
	return response
}
