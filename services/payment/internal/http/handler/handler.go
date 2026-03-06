package handler

import (
	"context"
	"log/slog"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/teamdsb/tmo/services/payment/internal/db"
	"github.com/teamdsb/tmo/services/payment/internal/http/middleware"
)

type Handler struct {
	Logger       *slog.Logger
	Auth         *middleware.Authenticator
	Flags        FeatureFlagsProvider
	Store        PaymentStore
	Commerce     *CommerceClient
	ProviderMode string
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
