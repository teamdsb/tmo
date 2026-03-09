package handler

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	openapi_types "github.com/oapi-codegen/runtime/types"

	shareddb "github.com/teamdsb/tmo/packages/go-shared/db"
	"github.com/teamdsb/tmo/services/identity/internal/db"
)

const (
	maxPaymentTermRemarkLength = 500
	maxCustomTermLabelLength   = 50
	maxMonthlySettlementDays   = 120
	maxAuditRemarkLength       = 120
	maxTransferReasonLength    = 200
	maxTagNameLength           = 30
	maxBatchCustomerSize       = 200
)

const (
	paymentTermTypeCash    = "CASH"
	paymentTermTypeMonthly = "MONTHLY"
	paymentTermTypeCustom  = "CUSTOM"
)

var hexColorPattern = regexp.MustCompile(`^#[0-9A-F]{6}$`)

type featureFlagsResponse struct {
	PaymentEnabled   bool `json:"paymentEnabled"`
	WechatPayEnabled bool `json:"wechatPayEnabled"`
	AlipayPayEnabled bool `json:"alipayPayEnabled"`
}

type featureFlagsPatch struct {
	PaymentEnabled   *bool `json:"paymentEnabled,omitempty"`
	WechatPayEnabled *bool `json:"wechatPayEnabled,omitempty"`
	AlipayPayEnabled *bool `json:"alipayPayEnabled,omitempty"`
}

type transferCustomerRequest struct {
	ToSalesUserID string  `json:"toSalesUserId"`
	Reason        *string `json:"reason,omitempty"`
}

type batchTransferCustomersRequest struct {
	CustomerIDs   []string `json:"customerIds"`
	ToSalesUserID string   `json:"toSalesUserId"`
	Reason        *string  `json:"reason,omitempty"`
}

type batchTransferResult struct {
	RequestedCount int `json:"requestedCount"`
	Transferred    int `json:"transferredCount"`
	Unchanged      int `json:"unchangedCount"`
}

type paymentTermConfig struct {
	Type                  string  `json:"type"`
	MonthlySettlementDays *int32  `json:"monthlySettlementDays"`
	CustomTermLabel       *string `json:"customTermLabel"`
}

type customerFinanceProfileResponse struct {
	CustomerID        openapi_types.UUID `json:"customerId"`
	PaymentTerm       *paymentTermConfig `json:"paymentTerm"`
	PaymentTermRemark *string            `json:"paymentTermRemark"`
	UpdatedAt         string             `json:"updatedAt"`
}

type customerFinanceProfilePatch struct {
	PaymentTerm       json.RawMessage `json:"paymentTerm,omitempty"`
	PaymentTermRemark string          `json:"paymentTermRemark"`
}

type salesUserSummary struct {
	ID          string   `json:"id"`
	DisplayName string   `json:"displayName"`
	Phone       *string  `json:"phone"`
	Status      string   `json:"status"`
	Roles       []string `json:"roles"`
}

type pagedSalesUsersResponse struct {
	Items    []salesUserSummary `json:"items"`
	Page     int                `json:"page"`
	PageSize int                `json:"pageSize"`
	Total    int                `json:"total"`
}

type adminUserSummary struct {
	ID          string   `json:"id"`
	DisplayName string   `json:"displayName"`
	Phone       *string  `json:"phone"`
	UserType    string   `json:"userType"`
	Status      string   `json:"status"`
	Roles       []string `json:"roles"`
	CreatedAt   string   `json:"createdAt"`
	UpdatedAt   string   `json:"updatedAt"`
}

type pagedAdminUsersResponse struct {
	Items    []adminUserSummary `json:"items"`
	Page     int                `json:"page"`
	PageSize int                `json:"pageSize"`
	Total    int                `json:"total"`
}

type updateAdminUserRequest struct {
	Roles          *[]string `json:"roles,omitempty"`
	Status         *string   `json:"status,omitempty"`
	DisabledReason *string   `json:"disabledReason,omitempty"`
}

type customerTagResponse struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Color  string `json:"color"`
	Sort   int32  `json:"sort"`
	Active bool   `json:"active"`
}

type adminCustomerOwnerResponse struct {
	ID          string  `json:"id"`
	DisplayName string  `json:"displayName"`
	Phone       *string `json:"phone"`
}

type adminCustomerResponse struct {
	ID               string                      `json:"id"`
	DisplayName      string                      `json:"displayName"`
	Phone            *string                     `json:"phone"`
	OwnerSalesUserID *string                     `json:"ownerSalesUserId"`
	OwnerSales       *adminCustomerOwnerResponse `json:"ownerSales"`
	Tags             []customerTagResponse       `json:"tags"`
	CreatedAt        string                      `json:"createdAt"`
}

type pagedAdminCustomersResponse struct {
	Items    []adminCustomerResponse `json:"items"`
	Page     int                     `json:"page"`
	PageSize int                     `json:"pageSize"`
	Total    int                     `json:"total"`
}

type createCustomerTagRequest struct {
	Name   string `json:"name"`
	Color  string `json:"color"`
	Sort   *int32 `json:"sort,omitempty"`
	Active *bool  `json:"active,omitempty"`
}

type updateCustomerTagRequest struct {
	Name   *string `json:"name,omitempty"`
	Color  *string `json:"color,omitempty"`
	Sort   *int32  `json:"sort,omitempty"`
	Active *bool   `json:"active,omitempty"`
}

type batchUpdateCustomerTagsRequest struct {
	CustomerIDs  []string `json:"customerIds"`
	AddTagIDs    []string `json:"addTagIds,omitempty"`
	RemoveTagIDs []string `json:"removeTagIds,omitempty"`
}

type batchTagUpdateResult struct {
	RequestedCount int `json:"requestedCount"`
	UpdatedCount   int `json:"updatedCount"`
}

type promoteCustomerToSalesResponse struct {
	ID        string   `json:"id"`
	UserType  string   `json:"userType"`
	Status    string   `json:"status"`
	Roles     []string `json:"roles"`
	Promoted  bool     `json:"promoted"`
	CreatedAt string   `json:"createdAt"`
	UpdatedAt string   `json:"updatedAt"`
}

func adminUserSummaryFromModel(user db.User, roles []string) adminUserSummary {
	return adminUserSummary{
		ID:          user.ID.String(),
		DisplayName: safeString(user.DisplayName, "未命名用户"),
		Phone:       user.Phone,
		UserType:    strings.ToLower(strings.TrimSpace(user.UserType)),
		Status:      strings.ToLower(strings.TrimSpace(user.Status)),
		Roles:       normalizeAdminRoles(roles),
		CreatedAt:   user.CreatedAt.Time.Format(time.RFC3339),
		UpdatedAt:   user.UpdatedAt.Time.Format(time.RFC3339),
	}
}

func (h *Handler) GetAdminConfigFeatureFlags(c *gin.Context) {
	flags, err := h.Store.GetFeatureFlags(c.Request.Context())
	if err != nil {
		h.logError("get feature flags failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch feature flags")
		return
	}

	c.JSON(http.StatusOK, featureFlagsResponse{
		PaymentEnabled:   flags.PaymentEnabled,
		WechatPayEnabled: flags.WechatPayEnabled,
		AlipayPayEnabled: flags.AlipayPayEnabled,
	})
}

func (h *Handler) PatchAdminConfigFeatureFlags(c *gin.Context) {
	claims, _, ok := h.requirePermission(c, "config:feature_flags", "ALL")
	if !ok {
		return
	}

	var request featureFlagsPatch
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	current, err := h.Store.GetFeatureFlags(c.Request.Context())
	if err != nil {
		h.logError("get feature flags failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch feature flags")
		return
	}

	paymentEnabled := current.PaymentEnabled
	if request.PaymentEnabled != nil {
		paymentEnabled = *request.PaymentEnabled
	}
	wechatEnabled := current.WechatPayEnabled
	if request.WechatPayEnabled != nil {
		wechatEnabled = *request.WechatPayEnabled
	}
	alipayEnabled := current.AlipayPayEnabled
	if request.AlipayPayEnabled != nil {
		alipayEnabled = *request.AlipayPayEnabled
	}

	updated, err := h.Store.UpdateFeatureFlags(c.Request.Context(), db.UpdateFeatureFlagsParams{
		PaymentEnabled:   paymentEnabled,
		WechatPayEnabled: wechatEnabled,
		AlipayPayEnabled: alipayEnabled,
	})
	if err != nil {
		h.logError("update feature flags failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to update feature flags")
		return
	}

	h.recordAudit(c, &claims.UserID, "config.feature_flags.update", "feature_flags", nil, map[string]interface{}{
		"paymentEnabled":   updated.PaymentEnabled,
		"wechatPayEnabled": updated.WechatPayEnabled,
		"alipayPayEnabled": updated.AlipayPayEnabled,
	})

	c.JSON(http.StatusOK, featureFlagsResponse{
		PaymentEnabled:   updated.PaymentEnabled,
		WechatPayEnabled: updated.WechatPayEnabled,
		AlipayPayEnabled: updated.AlipayPayEnabled,
	})
}

func (h *Handler) GetAdminSalesUsers(c *gin.Context) {
	if _, _, ok := h.requirePermission(c, "customer:transfer", "ALL"); !ok {
		return
	}

	page, pageSize := parsePagination(c)
	offset := (page - 1) * pageSize
	keyword := normalizeKeyword(c.Query("q"))

	users, err := h.Store.ListActiveSalesUsers(c.Request.Context(), db.ListActiveSalesUsersParams{
		Q:      keyword,
		Limit:  int32(pageSize),
		Offset: int32(offset),
	})
	if err != nil {
		h.logError("list active sales users failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list sales users")
		return
	}

	total, err := h.Store.CountActiveSalesUsers(c.Request.Context(), keyword)
	if err != nil {
		h.logError("count active sales users failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list sales users")
		return
	}

	items := make([]salesUserSummary, 0, len(users))
	for _, user := range users {
		roles, err := h.Store.ListUserRoles(c.Request.Context(), user.ID)
		if err != nil {
			h.logError("list sales user roles failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list sales users")
			return
		}
		items = append(items, salesUserSummaryFromModel(user, normalizeRoles(roles)))
	}

	c.JSON(http.StatusOK, pagedSalesUsersResponse{
		Items:    items,
		Page:     page,
		PageSize: pageSize,
		Total:    int(total),
	})
}

func (h *Handler) GetAdminUsers(c *gin.Context) {
	if _, _, ok := h.requirePermission(c, "rbac:manage", "ALL"); !ok {
		return
	}

	page, pageSize := parsePagination(c)
	offset := (page - 1) * pageSize
	keyword := normalizeKeyword(c.Query("q"))
	status := normalizeLowerKeyword(c.Query("status"))
	role := normalizeUpperKeyword(c.Query("role"))

	users, err := h.Store.ListAdminUsers(c.Request.Context(), db.ListAdminUsersParams{
		Q:      keyword,
		Status: status,
		Role:   role,
		Limit:  int32(pageSize),
		Offset: int32(offset),
	})
	if err != nil {
		h.logError("list admin users failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list admin users")
		return
	}

	total, err := h.Store.CountAdminUsers(c.Request.Context(), db.CountAdminUsersParams{
		Q:      keyword,
		Status: status,
		Role:   role,
	})
	if err != nil {
		h.logError("count admin users failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list admin users")
		return
	}

	items := make([]adminUserSummary, 0, len(users))
	for _, user := range users {
		roles, err := h.Store.ListUserRoles(c.Request.Context(), user.ID)
		if err != nil {
			h.logError("list admin user roles failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list admin users")
			return
		}
		items = append(items, adminUserSummaryFromModel(user, roles))
	}

	c.JSON(http.StatusOK, pagedAdminUsersResponse{
		Items:    items,
		Page:     page,
		PageSize: pageSize,
		Total:    int(total),
	})
}

func (h *Handler) PatchAdminUsersUserId(c *gin.Context) {
	claims, _, ok := h.requirePermission(c, "rbac:manage", "ALL")
	if !ok {
		return
	}

	userID, err := uuid.Parse(strings.TrimSpace(c.Param("userId")))
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid userId")
		return
	}

	var request updateAdminUserRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}
	if request.Roles == nil && request.Status == nil && request.DisabledReason == nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "at least one field is required")
		return
	}

	user, err := h.Store.GetUserByID(c.Request.Context(), userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "admin user not found")
			return
		}
		h.logError("get admin user failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to update admin user")
		return
	}
	if strings.ToLower(strings.TrimSpace(user.UserType)) != "admin" {
		h.writeError(c, http.StatusNotFound, "not_found", "admin user not found")
		return
	}

	currentRoles, err := h.Store.ListUserRoles(c.Request.Context(), user.ID)
	if err != nil {
		h.logError("list admin user roles failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to update admin user")
		return
	}
	currentRoles = normalizeAdminRoles(currentRoles)

	nextRoles := currentRoles
	if request.Roles != nil {
		nextRoles = normalizeAdminRoles(*request.Roles)
		if len(nextRoles) == 0 {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "roles is required")
			return
		}
		for _, role := range nextRoles {
			if !isAdminRole(role) {
				h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid admin role")
				return
			}
		}
	}

	status := ""
	var disabledAt pgtype.Timestamptz
	var disabledReason *string
	if request.Status != nil {
		status = strings.ToLower(strings.TrimSpace(*request.Status))
		switch status {
		case "active":
			disabledAt = pgtype.Timestamptz{}
			disabledReason = nil
		case "disabled":
			if containsRole(nextRoles, "BOSS") {
				h.writeError(c, http.StatusBadRequest, "invalid_request", "boss account cannot be disabled")
				return
			}
			disabledAt = pgtype.Timestamptz{Time: time.Now(), Valid: true}
			disabledReason = request.DisabledReason
		default:
			h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid status")
			return
		}
	}

	err = shareddb.WithTx(c.Request.Context(), h.DB, func(tx pgx.Tx) error {
		q := h.Store.WithTx(tx)
		if request.Roles != nil {
			if err := q.DeleteUserRoles(c.Request.Context(), user.ID); err != nil {
				return err
			}
			for _, role := range nextRoles {
				if err := q.AddUserRole(c.Request.Context(), db.AddUserRoleParams{
					UserID: user.ID,
					Role:   role,
				}); err != nil {
					return err
				}
			}
		}
		if status != "" {
			if _, err := q.UpdateUserStatus(c.Request.Context(), db.UpdateUserStatusParams{
				ID:             user.ID,
				Status:         status,
				DisabledAt:     disabledAt,
				DisabledReason: disabledReason,
			}); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		h.logError("update admin user failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to update admin user")
		return
	}

	updated, err := h.Store.GetUserByID(c.Request.Context(), user.ID)
	if err != nil {
		h.logError("reload admin user failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to update admin user")
		return
	}
	updatedRoles, err := h.Store.ListUserRoles(c.Request.Context(), updated.ID)
	if err != nil {
		h.logError("list updated admin user roles failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to update admin user")
		return
	}
	updatedRoles = normalizeAdminRoles(updatedRoles)

	h.recordAudit(c, &claims.UserID, "admin_user.update", "admin_user", &updated.ID, map[string]interface{}{
		"roles":  updatedRoles,
		"status": updated.Status,
	})

	c.JSON(http.StatusOK, adminUserSummaryFromModel(updated, updatedRoles))
}

func (h *Handler) PostAdminCustomersCustomerIdPromoteToSales(c *gin.Context) {
	claims, _, ok := h.requirePermission(c, "customer:transfer", "ALL")
	if !ok {
		return
	}

	customerID, err := uuid.Parse(strings.TrimSpace(c.Param("customerId")))
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid customerId")
		return
	}

	user, err := h.Store.GetUserByID(c.Request.Context(), customerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "customer not found")
			return
		}
		h.logError("get customer failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to promote customer")
		return
	}

	promoted := false
	switch strings.ToLower(strings.TrimSpace(user.UserType)) {
	case "customer":
		promotedUser, err := h.Store.PromoteCustomerToStaff(c.Request.Context(), customerID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				h.writeError(c, http.StatusNotFound, "not_found", "customer not found")
				return
			}
			h.logError("promote customer to staff failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to promote customer")
			return
		}
		user = promotedUser
		promoted = true
	case "staff":
		// Already staff, only ensure SALES role.
	case "admin":
		h.writeError(c, http.StatusBadRequest, "invalid_request", "admin user cannot be promoted")
		return
	default:
		h.writeError(c, http.StatusBadRequest, "invalid_request", "unsupported user type")
		return
	}

	if err := h.Store.AddUserRole(c.Request.Context(), db.AddUserRoleParams{
		UserID: user.ID,
		Role:   "SALES",
	}); err != nil {
		h.logError("add sales role failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to promote customer")
		return
	}

	if err := h.Store.AddUserRole(c.Request.Context(), db.AddUserRoleParams{
		UserID: user.ID,
		Role:   "CUSTOMER",
	}); err != nil {
		h.logError("keep customer role failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to promote customer")
		return
	}

	roles, err := h.Store.ListUserRoles(c.Request.Context(), user.ID)
	if err != nil {
		h.logError("list promoted user roles failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to promote customer")
		return
	}

	h.recordAudit(c, &claims.UserID, "customer.promote_to_sales", "customer", &user.ID, map[string]interface{}{
		"customerId": user.ID.String(),
		"promoted":   promoted,
		"roles":      normalizeRoles(roles),
	})

	c.JSON(http.StatusOK, promoteCustomerToSalesResponse{
		ID:        user.ID.String(),
		UserType:  strings.ToLower(strings.TrimSpace(user.UserType)),
		Status:    strings.ToLower(strings.TrimSpace(user.Status)),
		Roles:     normalizeRoles(roles),
		Promoted:  promoted,
		CreatedAt: user.CreatedAt.Time.Format(time.RFC3339),
		UpdatedAt: user.UpdatedAt.Time.Format(time.RFC3339),
	})
}

func (h *Handler) GetAdminCustomers(c *gin.Context) {
	if _, _, ok := h.requirePermission(c, "customer:read", "ALL"); !ok {
		return
	}

	page, pageSize := parsePagination(c)
	offset := (page - 1) * pageSize
	keyword := normalizeKeyword(c.Query("q"))

	_, ownerFilter, err := parseOptionalUUID(c.Query("ownerSalesUserId"))
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid ownerSalesUserId")
		return
	}

	tagIDs, err := parseUUIDList(c.QueryArray("tagIds"))
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid tagIds")
		return
	}
	filterByTags := len(tagIDs) > 0

	customers, err := h.Store.ListAdminCustomers(c.Request.Context(), db.ListAdminCustomersParams{
		Q:                keyword,
		OwnerSalesUserID: ownerFilter,
		FilterByTags:     filterByTags,
		TagIds:           tagIDs,
		Limit:            int32(pageSize),
		Offset:           int32(offset),
	})
	if err != nil {
		h.logError("list admin customers failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list customers")
		return
	}

	total, err := h.Store.CountAdminCustomers(c.Request.Context(), db.CountAdminCustomersParams{
		Q:                keyword,
		OwnerSalesUserID: ownerFilter,
		FilterByTags:     filterByTags,
		TagIds:           tagIDs,
	})
	if err != nil {
		h.logError("count admin customers failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list customers")
		return
	}

	ownerIDs := make([]uuid.UUID, 0, len(customers))
	ownerSeen := make(map[uuid.UUID]struct{}, len(customers))
	customerIDs := make([]uuid.UUID, 0, len(customers))
	for _, customer := range customers {
		customerIDs = append(customerIDs, customer.ID)
		if customer.OwnerSalesUserID.Valid {
			ownerID := customer.OwnerSalesUserID.Bytes
			if _, ok := ownerSeen[ownerID]; !ok {
				ownerSeen[ownerID] = struct{}{}
				ownerIDs = append(ownerIDs, ownerID)
			}
		}
	}

	ownersMap := make(map[uuid.UUID]adminCustomerOwnerResponse, len(ownerIDs))
	if len(ownerIDs) > 0 {
		owners, err := h.Store.ListUsersByIDs(c.Request.Context(), ownerIDs)
		if err != nil {
			h.logError("list customer owners failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list customers")
			return
		}
		for _, owner := range owners {
			ownersMap[owner.ID] = adminCustomerOwnerResponse{
				ID:          owner.ID.String(),
				DisplayName: safeDisplayName(owner.DisplayName),
				Phone:       owner.Phone,
			}
		}
	}

	tagsByCustomerID := make(map[uuid.UUID][]customerTagResponse, len(customerIDs))
	if len(customerIDs) > 0 {
		tagRows, err := h.Store.ListCustomerTagsByCustomerIDs(c.Request.Context(), customerIDs)
		if err != nil {
			h.logError("list customer tags failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list customers")
			return
		}
		for _, tagRow := range tagRows {
			tagsByCustomerID[tagRow.CustomerID] = append(tagsByCustomerID[tagRow.CustomerID], customerTagResponse{
				ID:     tagRow.TagID.String(),
				Name:   tagRow.TagName,
				Color:  tagRow.TagColor,
				Sort:   tagRow.TagSort,
				Active: tagRow.TagActive,
			})
		}
	}

	items := make([]adminCustomerResponse, 0, len(customers))
	for _, customer := range customers {
		var ownerSalesUserID *string
		var ownerSales *adminCustomerOwnerResponse
		if customer.OwnerSalesUserID.Valid {
			ownerID := customer.OwnerSalesUserID.Bytes
			ownerIDString := uuid.UUID(ownerID).String()
			ownerSalesUserID = &ownerIDString
			if owner, ok := ownersMap[ownerID]; ok {
				ownerCopy := owner
				ownerSales = &ownerCopy
			}
		}
		items = append(items, adminCustomerResponse{
			ID:               customer.ID.String(),
			DisplayName:      safeDisplayName(customer.DisplayName),
			Phone:            customer.Phone,
			OwnerSalesUserID: ownerSalesUserID,
			OwnerSales:       ownerSales,
			Tags:             tagsByCustomerID[customer.ID],
			CreatedAt:        customer.CreatedAt.Time.Format(time.RFC3339),
		})
	}

	c.JSON(http.StatusOK, pagedAdminCustomersResponse{
		Items:    items,
		Page:     page,
		PageSize: pageSize,
		Total:    int(total),
	})
}

func (h *Handler) PostAdminCustomersCustomerIdTransfer(c *gin.Context) {
	claims, _, ok := h.requirePermission(c, "customer:transfer", "ALL")
	if !ok {
		return
	}

	customerID, err := uuid.Parse(strings.TrimSpace(c.Param("customerId")))
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid customer id")
		return
	}

	var request transferCustomerRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	toSalesID, reason, err := validateTransferInput(request.ToSalesUserID, request.Reason)
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}

	if _, err := h.Store.GetActiveSalesUserByID(c.Request.Context(), toSalesID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "toSalesUserId must be an active SALES user")
			return
		}
		h.logError("get active sales user failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to transfer customer")
		return
	}

	customer, err := h.Store.GetUserByID(c.Request.Context(), customerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "customer not found")
			return
		}
		h.logError("get customer failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to transfer customer")
		return
	}
	if strings.ToLower(customer.UserType) != "customer" {
		h.writeError(c, http.StatusNotFound, "not_found", "customer not found")
		return
	}

	unchanged := customer.OwnerSalesUserID.Valid && customer.OwnerSalesUserID.Bytes == toSalesID
	if !unchanged {
		if _, err := h.Store.TransferCustomerOwnership(c.Request.Context(), db.TransferCustomerOwnershipParams{
			ID:               customerID,
			OwnerSalesUserID: pgtype.UUID{Bytes: toSalesID, Valid: true},
		}); err != nil {
			h.logError("transfer customer failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to transfer customer")
			return
		}
	}

	metadata := map[string]interface{}{
		"customerId":    customerID.String(),
		"toSalesUserId": toSalesID.String(),
		"unchanged":     unchanged,
	}
	if customer.OwnerSalesUserID.Valid {
		metadata["fromSalesUserId"] = uuid.UUID(customer.OwnerSalesUserID.Bytes).String()
	}
	if reason != "" {
		metadata["reason"] = reason
	}

	h.recordAudit(c, &claims.UserID, "customer.transfer", "customer", &customerID, metadata)
	c.Status(http.StatusNoContent)
}

func (h *Handler) PostAdminCustomersTransfer(c *gin.Context) {
	claims, _, ok := h.requirePermission(c, "customer:transfer", "ALL")
	if !ok {
		return
	}

	var request batchTransferCustomersRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	customerIDs, err := parseUUIDList(request.CustomerIDs)
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "customerIds must be valid UUIDs")
		return
	}
	if len(customerIDs) == 0 {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "customerIds is required")
		return
	}
	if len(customerIDs) > maxBatchCustomerSize {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "too many customers in one request")
		return
	}

	toSalesID, reason, err := validateTransferInput(request.ToSalesUserID, request.Reason)
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}

	if _, err := h.Store.GetActiveSalesUserByID(c.Request.Context(), toSalesID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "toSalesUserId must be an active SALES user")
			return
		}
		h.logError("get active sales user failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to transfer customers")
		return
	}

	customerCount, err := h.Store.CountCustomersByIDs(c.Request.Context(), customerIDs)
	if err != nil {
		h.logError("count customers by ids failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to transfer customers")
		return
	}
	if customerCount != int64(len(customerIDs)) {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "customerIds contains non-customer or missing IDs")
		return
	}

	unchangedCount, err := h.Store.CountCustomersOwnedBySalesInIDs(c.Request.Context(), db.CountCustomersOwnedBySalesInIDsParams{
		CustomerIds:      customerIDs,
		OwnerSalesUserID: toSalesID,
	})
	if err != nil {
		h.logError("count unchanged transfers failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to transfer customers")
		return
	}

	if _, err := h.Store.TransferCustomersOwnership(c.Request.Context(), db.TransferCustomersOwnershipParams{
		CustomerIds:      customerIDs,
		OwnerSalesUserID: toSalesID,
	}); err != nil {
		h.logError("batch transfer customers failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to transfer customers")
		return
	}

	transferredCount := len(customerIDs) - int(unchangedCount)
	if transferredCount < 0 {
		transferredCount = 0
	}

	h.recordAudit(c, &claims.UserID, "customer.transfer.batch", "customer", nil, map[string]interface{}{
		"requestedCount": len(customerIDs),
		"toSalesUserId":  toSalesID.String(),
		"reason":         reason,
		"customerIds":    sortedUUIDStrings(customerIDs),
		"unchangedCount": unchangedCount,
	})

	c.JSON(http.StatusOK, batchTransferResult{
		RequestedCount: len(customerIDs),
		Transferred:    transferredCount,
		Unchanged:      int(unchangedCount),
	})
}

func (h *Handler) GetAdminCustomerTags(c *gin.Context) {
	if _, _, ok := h.requirePermission(c, "customer:tag", "ALL"); !ok {
		return
	}

	includeInactive := strings.EqualFold(strings.TrimSpace(c.Query("includeInactive")), "true")
	tags, err := h.Store.ListCustomerTags(c.Request.Context(), includeInactive)
	if err != nil {
		h.logError("list customer tags failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list customer tags")
		return
	}

	response := make([]customerTagResponse, 0, len(tags))
	for _, tag := range tags {
		response = append(response, customerTagResponseFromModel(tag))
	}
	c.JSON(http.StatusOK, gin.H{"items": response})
}

func (h *Handler) PostAdminCustomerTags(c *gin.Context) {
	claims, _, ok := h.requirePermission(c, "customer:tag", "ALL")
	if !ok {
		return
	}

	var request createCustomerTagRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	name, err := normalizeTagName(request.Name)
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	color, err := normalizeTagColor(request.Color)
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}

	sortValue := int32(0)
	if request.Sort != nil {
		sortValue = *request.Sort
	}
	active := true
	if request.Active != nil {
		active = *request.Active
	}

	tag, err := h.Store.CreateCustomerTag(c.Request.Context(), db.CreateCustomerTagParams{
		ID:     uuid.New(),
		Name:   name,
		Color:  color,
		Sort:   sortValue,
		Active: active,
	})
	if err != nil {
		if isUniqueViolation(err) {
			h.writeError(c, http.StatusConflict, "conflict", "customer tag name already exists")
			return
		}
		h.logError("create customer tag failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to create customer tag")
		return
	}

	h.recordAudit(c, &claims.UserID, "customer.tag.create", "customer_tag", &tag.ID, map[string]interface{}{
		"name":   tag.Name,
		"color":  tag.Color,
		"sort":   tag.Sort,
		"active": tag.Active,
	})

	c.JSON(http.StatusCreated, customerTagResponseFromModel(tag))
}

func (h *Handler) PatchAdminCustomerTagsTagId(c *gin.Context) {
	claims, _, ok := h.requirePermission(c, "customer:tag", "ALL")
	if !ok {
		return
	}

	tagID, err := uuid.Parse(strings.TrimSpace(c.Param("tagId")))
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid tag id")
		return
	}

	var request updateCustomerTagRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}
	if request.Name == nil && request.Color == nil && request.Sort == nil && request.Active == nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "at least one field is required")
		return
	}

	var name *string
	if request.Name != nil {
		normalized, err := normalizeTagName(*request.Name)
		if err != nil {
			h.writeError(c, http.StatusBadRequest, "invalid_request", err.Error())
			return
		}
		name = &normalized
	}

	var color *string
	if request.Color != nil {
		normalized, err := normalizeTagColor(*request.Color)
		if err != nil {
			h.writeError(c, http.StatusBadRequest, "invalid_request", err.Error())
			return
		}
		color = &normalized
	}

	tag, err := h.Store.UpdateCustomerTag(c.Request.Context(), db.UpdateCustomerTagParams{
		ID:     tagID,
		Name:   name,
		Color:  color,
		Sort:   request.Sort,
		Active: request.Active,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "customer tag not found")
			return
		}
		if isUniqueViolation(err) {
			h.writeError(c, http.StatusConflict, "conflict", "customer tag name already exists")
			return
		}
		h.logError("update customer tag failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to update customer tag")
		return
	}

	h.recordAudit(c, &claims.UserID, "customer.tag.update", "customer_tag", &tag.ID, map[string]interface{}{
		"name":   tag.Name,
		"color":  tag.Color,
		"sort":   tag.Sort,
		"active": tag.Active,
	})

	c.JSON(http.StatusOK, customerTagResponseFromModel(tag))
}

func (h *Handler) PostAdminCustomersTagsBatchUpdate(c *gin.Context) {
	claims, _, ok := h.requirePermission(c, "customer:tag", "ALL")
	if !ok {
		return
	}

	var request batchUpdateCustomerTagsRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	customerIDs, err := parseUUIDList(request.CustomerIDs)
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "customerIds must be valid UUIDs")
		return
	}
	if len(customerIDs) == 0 {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "customerIds is required")
		return
	}
	if len(customerIDs) > maxBatchCustomerSize {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "too many customers in one request")
		return
	}

	addTagIDs, err := parseUUIDList(request.AddTagIDs)
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "addTagIds must be valid UUIDs")
		return
	}
	removeTagIDs, err := parseUUIDList(request.RemoveTagIDs)
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "removeTagIds must be valid UUIDs")
		return
	}
	if len(addTagIDs) == 0 && len(removeTagIDs) == 0 {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "addTagIds or removeTagIds is required")
		return
	}

	removeSet := make(map[uuid.UUID]struct{}, len(removeTagIDs))
	for _, id := range removeTagIDs {
		removeSet[id] = struct{}{}
	}
	for _, id := range addTagIDs {
		if _, ok := removeSet[id]; ok {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "same tag cannot be in both addTagIds and removeTagIds")
			return
		}
	}

	customerCount, err := h.Store.CountCustomersByIDs(c.Request.Context(), customerIDs)
	if err != nil {
		h.logError("count customers by ids failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to update customer tags")
		return
	}
	if customerCount != int64(len(customerIDs)) {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "customerIds contains non-customer or missing IDs")
		return
	}

	allTagIDs := unionUUIDs(addTagIDs, removeTagIDs)
	if len(allTagIDs) > 0 {
		tags, err := h.Store.ListCustomerTagsByIDs(c.Request.Context(), allTagIDs)
		if err != nil {
			h.logError("list tags by ids failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to update customer tags")
			return
		}
		if len(tags) != len(allTagIDs) {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "contains unknown tag IDs")
			return
		}
		activeMap := make(map[uuid.UUID]bool, len(tags))
		for _, tag := range tags {
			activeMap[tag.ID] = tag.Active
		}
		for _, tagID := range addTagIDs {
			if !activeMap[tagID] {
				h.writeError(c, http.StatusBadRequest, "invalid_request", "cannot add inactive tag")
				return
			}
		}
	}

	err = shareddb.WithTx(c.Request.Context(), h.DB, func(tx pgx.Tx) error {
		q := h.Store.WithTx(tx)
		for _, tagID := range addTagIDs {
			if err := q.AddCustomerTagBindings(c.Request.Context(), db.AddCustomerTagBindingsParams{
				CustomerIds: customerIDs,
				TagID:       tagID,
				CreatedBy:   claims.UserID,
			}); err != nil {
				return err
			}
		}
		for _, tagID := range removeTagIDs {
			if err := q.RemoveCustomerTagBindings(c.Request.Context(), db.RemoveCustomerTagBindingsParams{
				TagID:       tagID,
				CustomerIds: customerIDs,
			}); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		h.logError("batch update customer tags failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to update customer tags")
		return
	}

	h.recordAudit(c, &claims.UserID, "customer.tags.batch_update", "customer", nil, map[string]interface{}{
		"requestedCount": len(customerIDs),
		"addTagIds":      sortedUUIDStrings(addTagIDs),
		"removeTagIds":   sortedUUIDStrings(removeTagIDs),
		"customerIds":    sortedUUIDStrings(customerIDs),
	})

	c.JSON(http.StatusOK, batchTagUpdateResult{
		RequestedCount: len(customerIDs),
		UpdatedCount:   len(customerIDs),
	})
}

func (h *Handler) GetAdminCustomersCustomerIdFinanceProfile(c *gin.Context) {
	if _, ok := h.requireAdmin(c); !ok {
		return
	}

	customerID, err := uuid.Parse(strings.TrimSpace(c.Param("customerId")))
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid customer id")
		return
	}

	profile, err := h.Store.GetCustomerFinanceProfile(c.Request.Context(), customerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "customer not found")
			return
		}
		h.logError("get customer finance profile failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch customer finance profile")
		return
	}

	c.JSON(http.StatusOK, customerFinanceProfileResponse{
		CustomerID:        openapi_types.UUID(profile.ID),
		PaymentTerm:       buildPaymentTermConfig(profile.PaymentTermType, profile.PaymentTermDays, profile.PaymentTermCustomLabel),
		PaymentTermRemark: profile.PaymentTermRemark,
		UpdatedAt:         profile.UpdatedAt.Time.Format(time.RFC3339),
	})
}

func (h *Handler) PatchAdminCustomersCustomerIdFinanceProfile(c *gin.Context) {
	claims, ok := h.requireAdmin(c)
	if !ok {
		return
	}

	customerID, err := uuid.Parse(strings.TrimSpace(c.Param("customerId")))
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid customer id")
		return
	}

	var request customerFinanceProfilePatch
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	trimmedRemark := strings.TrimSpace(request.PaymentTermRemark)
	if utf8.RuneCountInString(trimmedRemark) > maxPaymentTermRemarkLength {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "paymentTermRemark must be <= 500 characters")
		return
	}

	var remark *string
	if trimmedRemark != "" {
		remark = &trimmedRemark
	}

	currentProfile, err := h.Store.GetCustomerFinanceProfile(c.Request.Context(), customerID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "customer not found")
			return
		}
		h.logError("get customer finance profile failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to update customer finance profile")
		return
	}

	nextPaymentTermType := currentProfile.PaymentTermType
	nextPaymentTermDays := currentProfile.PaymentTermDays
	nextCustomTermLabel := currentProfile.PaymentTermCustomLabel

	if request.PaymentTerm != nil {
		trimmedPaymentTermRaw := bytes.TrimSpace(request.PaymentTerm)
		switch {
		case bytes.Equal(trimmedPaymentTermRaw, []byte("null")):
			nextPaymentTermType = nil
			nextPaymentTermDays = nil
			nextCustomTermLabel = nil
		default:
			var requestedPaymentTerm paymentTermConfig
			if err := json.Unmarshal(trimmedPaymentTermRaw, &requestedPaymentTerm); err != nil {
				h.writeError(c, http.StatusBadRequest, "invalid_request", "paymentTerm must be null or object")
				return
			}

			normalizedPaymentTermType := strings.ToUpper(strings.TrimSpace(requestedPaymentTerm.Type))
			trimmedCustomTermLabel := ""
			if requestedPaymentTerm.CustomTermLabel != nil {
				trimmedCustomTermLabel = strings.TrimSpace(*requestedPaymentTerm.CustomTermLabel)
			}

			if utf8.RuneCountInString(trimmedCustomTermLabel) > maxCustomTermLabelLength {
				h.writeError(c, http.StatusBadRequest, "invalid_request", "customTermLabel must be <= 50 characters")
				return
			}

			switch normalizedPaymentTermType {
			case paymentTermTypeCash:
				if requestedPaymentTerm.MonthlySettlementDays != nil {
					h.writeError(c, http.StatusBadRequest, "invalid_request", "monthlySettlementDays must be empty when type is CASH")
					return
				}
				if trimmedCustomTermLabel != "" {
					h.writeError(c, http.StatusBadRequest, "invalid_request", "customTermLabel must be empty when type is CASH")
					return
				}
				nextPaymentTermType = &normalizedPaymentTermType
				nextPaymentTermDays = nil
				nextCustomTermLabel = nil
			case paymentTermTypeMonthly:
				if requestedPaymentTerm.MonthlySettlementDays == nil {
					h.writeError(c, http.StatusBadRequest, "invalid_request", "monthlySettlementDays is required when type is MONTHLY")
					return
				}
				if *requestedPaymentTerm.MonthlySettlementDays < 1 || *requestedPaymentTerm.MonthlySettlementDays > maxMonthlySettlementDays {
					h.writeError(c, http.StatusBadRequest, "invalid_request", "monthlySettlementDays must be between 1 and 120")
					return
				}
				if trimmedCustomTermLabel != "" {
					h.writeError(c, http.StatusBadRequest, "invalid_request", "customTermLabel must be empty when type is MONTHLY")
					return
				}
				nextPaymentTermType = &normalizedPaymentTermType
				nextPaymentTermDays = requestedPaymentTerm.MonthlySettlementDays
				nextCustomTermLabel = nil
			case paymentTermTypeCustom:
				if requestedPaymentTerm.MonthlySettlementDays != nil {
					h.writeError(c, http.StatusBadRequest, "invalid_request", "monthlySettlementDays must be empty when type is CUSTOM")
					return
				}
				if trimmedCustomTermLabel == "" {
					h.writeError(c, http.StatusBadRequest, "invalid_request", "customTermLabel is required when type is CUSTOM")
					return
				}
				nextPaymentTermType = &normalizedPaymentTermType
				nextPaymentTermDays = nil
				nextCustomTermLabel = &trimmedCustomTermLabel
			default:
				h.writeError(c, http.StatusBadRequest, "invalid_request", "paymentTerm.type must be one of CASH, MONTHLY, CUSTOM")
				return
			}
		}
	}

	profile, err := h.Store.UpdateCustomerFinanceProfile(c.Request.Context(), db.UpdateCustomerFinanceProfileParams{
		ID:                     customerID,
		PaymentTermType:        nextPaymentTermType,
		PaymentTermDays:        nextPaymentTermDays,
		PaymentTermCustomLabel: nextCustomTermLabel,
		PaymentTermRemark:      remark,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "customer not found")
			return
		}
		h.logError("update customer finance profile failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to update customer finance profile")
		return
	}

	h.recordAudit(c, &claims.UserID, "customer.finance_profile.update", "customer", &profile.ID, map[string]interface{}{
		"customerId":        profile.ID.String(),
		"paymentTermType":   profile.PaymentTermType,
		"paymentTermDays":   profile.PaymentTermDays,
		"customTermLabel":   truncateRemarkForAudit(pointerStringValue(profile.PaymentTermCustomLabel)),
		"paymentTermRemark": truncateRemarkForAudit(trimmedRemark),
	})

	c.JSON(http.StatusOK, customerFinanceProfileResponse{
		CustomerID:        openapi_types.UUID(profile.ID),
		PaymentTerm:       buildPaymentTermConfig(profile.PaymentTermType, profile.PaymentTermDays, profile.PaymentTermCustomLabel),
		PaymentTermRemark: profile.PaymentTermRemark,
		UpdatedAt:         profile.UpdatedAt.Time.Format(time.RFC3339),
	})
}

func buildPaymentTermConfig(paymentTermType *string, paymentTermDays *int32, customTermLabel *string) *paymentTermConfig {
	if paymentTermType == nil {
		return nil
	}

	normalizedType := strings.ToUpper(strings.TrimSpace(*paymentTermType))
	if normalizedType == "" {
		return nil
	}

	config := &paymentTermConfig{Type: normalizedType}
	switch normalizedType {
	case paymentTermTypeMonthly:
		config.MonthlySettlementDays = paymentTermDays
	case paymentTermTypeCustom:
		config.CustomTermLabel = customTermLabel
	}
	return config
}

func truncateRemarkForAudit(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}

	runes := []rune(value)
	if len(runes) <= maxAuditRemarkLength {
		return value
	}
	return string(runes[:maxAuditRemarkLength]) + "..."
}

func pointerStringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func parsePagination(c *gin.Context) (int, int) {
	page := parsePositiveInt(c.Query("page"), 1)
	pageSize := parsePositiveInt(c.Query("pageSize"), 20)
	if pageSize > 100 {
		pageSize = 100
	}
	return page, pageSize
}

func parsePositiveInt(raw string, fallback int) int {
	value, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}

func parseOptionalUUID(raw string) (uuid.UUID, pgtype.UUID, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return uuid.Nil, pgtype.UUID{}, nil
	}
	parsed, err := uuid.Parse(trimmed)
	if err != nil {
		return uuid.Nil, pgtype.UUID{}, err
	}
	return parsed, pgtype.UUID{Bytes: parsed, Valid: true}, nil
}

func parseUUIDList(rawValues []string) ([]uuid.UUID, error) {
	seen := make(map[uuid.UUID]struct{}, len(rawValues))
	result := make([]uuid.UUID, 0, len(rawValues))
	for _, rawValue := range rawValues {
		for _, piece := range strings.Split(rawValue, ",") {
			trimmed := strings.TrimSpace(piece)
			if trimmed == "" {
				continue
			}
			id, err := uuid.Parse(trimmed)
			if err != nil {
				return nil, err
			}
			if _, ok := seen[id]; ok {
				continue
			}
			seen[id] = struct{}{}
			result = append(result, id)
		}
	}
	return result, nil
}

func normalizeKeyword(raw string) *string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func normalizeUpperKeyword(raw string) *string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil
	}
	upper := strings.ToUpper(trimmed)
	return &upper
}

func normalizeLowerKeyword(raw string) *string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil
	}
	lower := strings.ToLower(trimmed)
	return &lower
}

func safeString(value *string, fallback string) string {
	if value == nil {
		return fallback
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return fallback
	}
	return trimmed
}

func validateTransferInput(toSalesUserID string, reason *string) (uuid.UUID, string, error) {
	toSalesID, err := uuid.Parse(strings.TrimSpace(toSalesUserID))
	if err != nil {
		return uuid.Nil, "", errors.New("invalid toSalesUserId")
	}

	trimmedReason := ""
	if reason != nil {
		trimmedReason = strings.TrimSpace(*reason)
	}
	if utf8.RuneCountInString(trimmedReason) > maxTransferReasonLength {
		return uuid.Nil, "", errors.New("reason must be <= 200 characters")
	}

	return toSalesID, trimmedReason, nil
}

func normalizeTagName(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", errors.New("name is required")
	}
	if utf8.RuneCountInString(trimmed) > maxTagNameLength {
		return "", errors.New("name must be <= 30 characters")
	}
	return trimmed, nil
}

func normalizeTagColor(raw string) (string, error) {
	trimmed := strings.ToUpper(strings.TrimSpace(raw))
	if trimmed == "" {
		return "", errors.New("color is required")
	}
	if !strings.HasPrefix(trimmed, "#") {
		trimmed = "#" + trimmed
	}
	if !hexColorPattern.MatchString(trimmed) {
		return "", errors.New("color must be a 6-digit hex value")
	}
	return trimmed, nil
}

func unionUUIDs(first []uuid.UUID, second []uuid.UUID) []uuid.UUID {
	seen := make(map[uuid.UUID]struct{}, len(first)+len(second))
	result := make([]uuid.UUID, 0, len(first)+len(second))
	for _, id := range first {
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		result = append(result, id)
	}
	for _, id := range second {
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		result = append(result, id)
	}
	return result
}

func sortedUUIDStrings(ids []uuid.UUID) []string {
	values := make([]string, 0, len(ids))
	for _, id := range ids {
		values = append(values, id.String())
	}
	sort.Strings(values)
	return values
}

func safeDisplayName(displayName *string) string {
	if displayName == nil {
		return "未命名"
	}
	trimmed := strings.TrimSpace(*displayName)
	if trimmed == "" {
		return "未命名"
	}
	return trimmed
}

func salesUserSummaryFromModel(user db.User, roles []string) salesUserSummary {
	return salesUserSummary{
		ID:          user.ID.String(),
		DisplayName: safeDisplayName(user.DisplayName),
		Phone:       user.Phone,
		Status:      strings.ToLower(strings.TrimSpace(user.Status)),
		Roles:       roles,
	}
}

func customerTagResponseFromModel(tag db.CustomerTag) customerTagResponse {
	return customerTagResponse{
		ID:     tag.ID.String(),
		Name:   tag.Name,
		Color:  tag.Color,
		Sort:   tag.Sort,
		Active: tag.Active,
	}
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		return false
	}
	return pgErr.Code == "23505"
}
