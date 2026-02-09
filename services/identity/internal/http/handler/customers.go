package handler

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/teamdsb/tmo/services/identity/internal/db"
	"github.com/teamdsb/tmo/services/identity/internal/http/oapi"
)

func (h *Handler) GetCustomers(c *gin.Context, params oapi.GetCustomersParams) {
	claims, ok := h.requireClaims(c)
	if !ok {
		return
	}

	scope, allowed, err := h.permissionScope(c, claims.UserID, "customer:read")
	if err != nil {
		h.logError("list effective permissions failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list customers")
		return
	}
	if !allowed {
		h.writeError(c, http.StatusForbidden, "forbidden", "permission denied")
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

	var keyword *string
	if params.Q != nil {
		trimmed := strings.TrimSpace(*params.Q)
		if trimmed != "" {
			keyword = &trimmed
		}
	}

	ownerSalesFilter := pgtype.UUID{}
	if params.OwnerSalesUserId != nil {
		ownerSalesFilter = pgtype.UUID{Bytes: uuid.UUID(*params.OwnerSalesUserId), Valid: true}
	}
	customerFilter := pgtype.UUID{}
	switch scope {
	case "OWNED":
		ownerSalesFilter = pgtype.UUID{Bytes: claims.UserID, Valid: true}
	case "SELF":
		customerFilter = pgtype.UUID{Bytes: claims.UserID, Valid: true}
	}

	customers, err := h.Store.ListCustomers(c.Request.Context(), db.ListCustomersParams{
		Q:                keyword,
		OwnerSalesUserID: ownerSalesFilter,
		CustomerID:       customerFilter,
		Limit:            int32(pageSize),
		Offset:           int32(offset),
	})
	if err != nil {
		h.logError("list customers failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list customers")
		return
	}

	total, err := h.Store.CountCustomers(c.Request.Context(), db.CountCustomersParams{
		Q:                keyword,
		OwnerSalesUserID: ownerSalesFilter,
		CustomerID:       customerFilter,
	})
	if err != nil {
		h.logError("count customers failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list customers")
		return
	}

	items := make([]oapi.Customer, 0, len(customers))
	for _, customer := range customers {
		items = append(items, customerFromModel(customer))
	}

	c.JSON(http.StatusOK, oapi.PagedCustomerList{
		Items:    items,
		Page:     page,
		PageSize: pageSize,
		Total:    int(total),
	})
}

func (h *Handler) GetCustomersCustomerId(c *gin.Context, customerId openapi_types.UUID) {
	claims, ok := h.requireClaims(c)
	if !ok {
		return
	}

	scope, allowed, err := h.permissionScope(c, claims.UserID, "customer:read")
	if err != nil {
		h.logError("list effective permissions failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch customer")
		return
	}
	if !allowed {
		h.writeError(c, http.StatusForbidden, "forbidden", "permission denied")
		return
	}

	customer, err := h.Store.GetCustomerByID(c.Request.Context(), uuid.UUID(customerId))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "customer not found")
			return
		}
		h.logError("get customer failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch customer")
		return
	}

	if !h.customerReadableByScope(scope, claims.UserID, customer) {
		h.writeError(c, http.StatusForbidden, "forbidden", "permission denied")
		return
	}

	c.JSON(http.StatusOK, customerFromModel(customer))
}

func (h *Handler) permissionScope(c *gin.Context, userID uuid.UUID, permissionCode string) (string, bool, error) {
	permissions, err := h.Store.ListEffectivePermissions(c.Request.Context(), userID)
	if err != nil {
		return "", false, err
	}
	for _, permission := range permissions {
		if permission.PermissionCode == permissionCode {
			return strings.ToUpper(permission.Scope), true, nil
		}
	}
	return "", false, nil
}

func (h *Handler) customerReadableByScope(scope string, userID uuid.UUID, customer db.User) bool {
	switch strings.ToUpper(scope) {
	case "ALL":
		return true
	case "OWNED":
		return customer.OwnerSalesUserID.Valid && customer.OwnerSalesUserID.Bytes == userID
	case "SELF":
		return customer.ID == userID
	default:
		return false
	}
}

func customerFromModel(user db.User) oapi.Customer {
	displayName := ""
	if user.DisplayName != nil {
		displayName = *user.DisplayName
	}

	response := oapi.Customer{
		Id:          openapi_types.UUID(user.ID),
		DisplayName: displayName,
		CreatedAt:   user.CreatedAt.Time,
	}
	if user.Phone != nil {
		response.Phone = user.Phone
	}
	if user.OwnerSalesUserID.Valid {
		ownerSalesUserID := openapi_types.UUID(user.OwnerSalesUserID.Bytes)
		response.OwnerSalesUserId = &ownerSalesUserID
	}
	return response
}
