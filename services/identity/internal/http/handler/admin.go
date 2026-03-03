package handler

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/teamdsb/tmo/services/identity/internal/db"
)

const (
	maxPaymentTermRemarkLength = 500
	maxCustomTermLabelLength   = 50
	maxMonthlySettlementDays   = 120
	maxAuditRemarkLength       = 120
)

const (
	paymentTermTypeCash    = "CASH"
	paymentTermTypeMonthly = "MONTHLY"
	paymentTermTypeCustom  = "CUSTOM"
)

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
	toSalesID, err := uuid.Parse(strings.TrimSpace(request.ToSalesUserID))
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid toSalesUserId")
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

	updated, err := h.Store.TransferCustomerOwnership(c.Request.Context(), db.TransferCustomerOwnershipParams{
		ID:               customerID,
		OwnerSalesUserID: pgtype.UUID{Bytes: toSalesID, Valid: true},
	})
	if err != nil {
		h.logError("transfer customer failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to transfer customer")
		return
	}

	metadata := map[string]interface{}{
		"toSalesUserId": toSalesID.String(),
	}
	if customer.OwnerSalesUserID.Valid {
		metadata["fromSalesUserId"] = uuid.UUID(customer.OwnerSalesUserID.Bytes).String()
	}
	if request.Reason != nil && strings.TrimSpace(*request.Reason) != "" {
		metadata["reason"] = strings.TrimSpace(*request.Reason)
	}

	h.recordAudit(c, &claims.UserID, "customer.transfer", "customer", &updated.ID, metadata)

	c.Status(http.StatusNoContent)
}

func (h *Handler) GetAdminCustomersCustomerIdFinanceProfile(c *gin.Context) {
<<<<<<< ours
	if _, ok := h.requireBoss(c); !ok {
=======
	if _, ok := h.requireAdmin(c); !ok {
>>>>>>> theirs
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
<<<<<<< ours
	claims, ok := h.requireBoss(c)
=======
	claims, ok := h.requireAdmin(c)
>>>>>>> theirs
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
<<<<<<< ours
		ID:                     customerID,
		PaymentTermType:        nextPaymentTermType,
		PaymentTermDays:        nextPaymentTermDays,
		PaymentTermCustomLabel: nextCustomTermLabel,
		PaymentTermRemark:      remark,
=======
		ID:                    customerID,
		PaymentTermType:       nextPaymentTermType,
		PaymentTermDays:       nextPaymentTermDays,
		PaymentTermCustomLabel: nextCustomTermLabel,
		PaymentTermRemark:     remark,
>>>>>>> theirs
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
<<<<<<< ours
		"customerId":        profile.ID.String(),
		"paymentTermType":   profile.PaymentTermType,
		"paymentTermDays":   profile.PaymentTermDays,
		"customTermLabel":   truncateRemarkForAudit(pointerStringValue(profile.PaymentTermCustomLabel)),
		"paymentTermRemark": truncateRemarkForAudit(trimmedRemark),
=======
		"customerId":         profile.ID.String(),
		"paymentTermType":    profile.PaymentTermType,
		"paymentTermDays":    profile.PaymentTermDays,
		"customTermLabel":    truncateRemarkForAudit(pointerStringValue(profile.PaymentTermCustomLabel)),
		"paymentTermRemark":  truncateRemarkForAudit(trimmedRemark),
>>>>>>> theirs
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

	config := &paymentTermConfig{
		Type: normalizedType,
	}
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
