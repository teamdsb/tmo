package handler

import (
	"context"
	"log/slog"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	apierrors "github.com/teamdsb/tmo/packages/go-shared/errors"
	"github.com/teamdsb/tmo/services/payment/internal/db"
	"github.com/teamdsb/tmo/services/payment/internal/http/middleware"
	"github.com/teamdsb/tmo/services/payment/internal/provider"
)

type Handler struct {
	Logger       *slog.Logger
	Auth         *middleware.Authenticator
	Flags        FeatureFlagsProvider
	Store        PaymentStore
	Commerce     *CommerceClient
	ProviderMode string
	Wechat       provider.Wechat
}

type PaymentStore interface {
	CreatePayment(ctx context.Context, arg db.CreatePaymentParams) (db.Payment, error)
	GetPayment(ctx context.Context, id uuid.UUID) (db.Payment, error)
	GetPaymentByIdempotencyKey(ctx context.Context, arg db.GetPaymentByIdempotencyKeyParams) (db.Payment, error)
	UpdatePaymentState(ctx context.Context, arg db.UpdatePaymentStateParams) (db.Payment, error)
	ListPayments(ctx context.Context, arg db.ListPaymentsParams) ([]db.Payment, error)
	CountPayments(ctx context.Context, arg db.CountPaymentsParams) (int64, error)
	CreatePaymentWebhook(ctx context.Context, arg db.CreatePaymentWebhookParams) (db.PaymentWebhook, error)
	GetPaymentWebhook(ctx context.Context, id uuid.UUID) (db.PaymentWebhook, error)
	ListPaymentWebhooks(ctx context.Context, arg db.ListPaymentWebhooksParams) ([]db.PaymentWebhook, error)
	CountPaymentWebhooks(ctx context.Context, arg db.CountPaymentWebhooksParams) (int64, error)
	ReplayPaymentWebhook(ctx context.Context, arg db.ReplayPaymentWebhookParams) (db.PaymentWebhook, error)
	CreatePaymentAuditLog(ctx context.Context, arg db.CreatePaymentAuditLogParams) (db.PaymentAuditLog, error)
	ListPaymentAuditLogs(ctx context.Context, arg db.ListPaymentAuditLogsParams) ([]db.PaymentAuditLog, error)
	CountPaymentAuditLogs(ctx context.Context, arg db.CountPaymentAuditLogsParams) (int64, error)
}

func (h *Handler) requireUser(c *gin.Context) (middleware.Claims, bool) {
	if h.Auth == nil {
		return middleware.Claims{Role: "ADMIN"}, true
	}
	return h.Auth.RequireUser(c)
}

func (h *Handler) requireCustomer(c *gin.Context) (middleware.Claims, bool) {
	if h.Auth == nil || !h.Auth.Enabled() {
		return middleware.Claims{Role: "CUSTOMER"}, true
	}

	claims, ok := h.requireUser(c)
	if !ok {
		return middleware.Claims{}, false
	}
	if strings.EqualFold(strings.TrimSpace(claims.Role), "CUSTOMER") {
		return claims, true
	}

	apierrors.Write(c, http.StatusForbidden, apierrors.APIError{
		Code:    "forbidden",
		Message: "customer payment access is forbidden",
	})
	return middleware.Claims{}, false
}

func (h *Handler) requireAdminUser(c *gin.Context) (middleware.Claims, bool) {
	claims, ok := h.requireUser(c)
	if !ok {
		return middleware.Claims{}, false
	}

	switch strings.ToUpper(strings.TrimSpace(claims.Role)) {
	case "ADMIN", "BOSS":
		return claims, true
	default:
		apierrors.Write(c, http.StatusForbidden, apierrors.APIError{
			Code:    "forbidden",
			Message: "admin payment access is forbidden",
		})
		return middleware.Claims{}, false
	}
}

func (h *Handler) logError(message string, err error) {
	if h.Logger == nil || err == nil {
		return
	}
	h.Logger.Error(message, "error", err)
}

func (h *Handler) getFeatureFlags(c *gin.Context) FeatureFlags {
	if h.Flags == nil {
		return FeatureFlags{}
	}
	flags, err := h.Flags.GetFlags(c.Request.Context())
	if err != nil {
		h.logError("fetch feature flags failed", err)
	}
	return flags
}
