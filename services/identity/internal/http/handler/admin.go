package handler

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/teamdsb/tmo/services/identity/internal/db"
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
	claims, ok := h.requireAdmin(c)
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
	claims, ok := h.requireAdmin(c)
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
