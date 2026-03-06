package handler

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	apierrors "github.com/teamdsb/tmo/packages/go-shared/errors"
	"github.com/teamdsb/tmo/services/payment/internal/db"
)

type adminPaymentTransaction struct {
	ID            string `json:"id"`
	OrderID       string `json:"orderId"`
	UserID        string `json:"userId"`
	Channel       string `json:"channel"`
	Status        string `json:"status"`
	AmountFen     int64  `json:"amountFen"`
	Currency      string `json:"currency"`
	CreatedAt     string `json:"createdAt"`
	UpdatedAt     string `json:"updatedAt"`
	FailureReason string `json:"failureReason,omitempty"`
}

type adminPaymentAuditLog struct {
	ID            string `json:"id"`
	TransactionID string `json:"transactionId"`
	Action        string `json:"action"`
	Actor         string `json:"actor"`
	Detail        string `json:"detail"`
	CreatedAt     string `json:"createdAt"`
}

type adminPaymentWebhook struct {
	ID          string `json:"id"`
	Provider    string `json:"provider"`
	EventType   string `json:"eventType"`
	Transaction string `json:"transactionId"`
	Status      string `json:"status"`
	ReplayCount int    `json:"replayCount"`
	ReceivedAt  string `json:"receivedAt"`
	LastReplay  string `json:"lastReplayAt,omitempty"`
}

type pagedAdminPaymentTransactions struct {
	Items    []adminPaymentTransaction `json:"items"`
	Page     int                       `json:"page"`
	PageSize int                       `json:"pageSize"`
	Total    int                       `json:"total"`
}

type pagedAdminPaymentAuditLogs struct {
	Items    []adminPaymentAuditLog `json:"items"`
	Page     int                    `json:"page"`
	PageSize int                    `json:"pageSize"`
	Total    int                    `json:"total"`
}

type pagedAdminPaymentWebhooks struct {
	Items    []adminPaymentWebhook `json:"items"`
	Page     int                   `json:"page"`
	PageSize int                   `json:"pageSize"`
	Total    int                   `json:"total"`
}

type replayWebhookResponse struct {
	ID          string `json:"id"`
	Status      string `json:"status"`
	ReplayCount int    `json:"replayCount"`
	ReplayedAt  string `json:"replayedAt"`
}

func (h *Handler) GetAdminPaymentsTransactions(c *gin.Context) {
	if _, ok := h.requireUser(c); !ok {
		return
	}
	if h.Store == nil {
		apierrors.Write(c, http.StatusInternalServerError, apierrors.APIError{
			Code:    "internal_error",
			Message: "payment store is not configured",
		})
		return
	}

	page, pageSize := parsePageParams(c)
	offset := (page - 1) * pageSize
	q := normalizeKeyword(c.Query("q"))
	status := normalizeKeyword(c.Query("status"))
	channel := normalizeKeyword(c.Query("channel"))

	items, err := h.Store.ListPayments(c.Request.Context(), db.ListPaymentsParams{
		Q:       normalizeNullableText(q),
		Status:  normalizeNullableText(status),
		Channel: normalizeNullableText(strings.ToUpper(channel)),
		Offset:  int32(offset),
		Limit:   int32(pageSize),
	})
	if err != nil {
		h.logError("list payment transactions failed", err)
		apierrors.Write(c, http.StatusInternalServerError, apierrors.APIError{
			Code:    "internal_error",
			Message: "failed to list payment transactions",
		})
		return
	}

	total, err := h.Store.CountPayments(c.Request.Context(), db.CountPaymentsParams{
		Q:       normalizeNullableText(q),
		Status:  normalizeNullableText(status),
		Channel: normalizeNullableText(strings.ToUpper(channel)),
	})
	if err != nil {
		h.logError("count payment transactions failed", err)
		apierrors.Write(c, http.StatusInternalServerError, apierrors.APIError{
			Code:    "internal_error",
			Message: "failed to list payment transactions",
		})
		return
	}

	payload := make([]adminPaymentTransaction, 0, len(items))
	for _, item := range items {
		payload = append(payload, adminTransactionFromModel(item))
	}

	c.JSON(http.StatusOK, pagedAdminPaymentTransactions{
		Items:    payload,
		Page:     page,
		PageSize: pageSize,
		Total:    int(total),
	})
}

func (h *Handler) GetAdminPaymentsTransactionsId(c *gin.Context) {
	if _, ok := h.requireUser(c); !ok {
		return
	}
	if h.Store == nil {
		apierrors.Write(c, http.StatusInternalServerError, apierrors.APIError{
			Code:    "internal_error",
			Message: "payment store is not configured",
		})
		return
	}

	paymentID, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
	if err != nil {
		apierrors.Write(c, http.StatusBadRequest, apierrors.APIError{
			Code:    "invalid_request",
			Message: "id is required",
		})
		return
	}

	payment, err := h.Store.GetPayment(c.Request.Context(), paymentID)
	if err != nil {
		apierrors.Write(c, http.StatusNotFound, apierrors.APIError{
			Code:    "not_found",
			Message: "transaction not found",
		})
		return
	}

	c.JSON(http.StatusOK, adminTransactionFromModel(payment))
}

func (h *Handler) GetAdminPaymentsAuditLogs(c *gin.Context) {
	if _, ok := h.requireUser(c); !ok {
		return
	}
	if h.Store == nil {
		apierrors.Write(c, http.StatusInternalServerError, apierrors.APIError{
			Code:    "internal_error",
			Message: "payment store is not configured",
		})
		return
	}

	page, pageSize := parsePageParams(c)
	offset := (page - 1) * pageSize
	q := normalizeKeyword(c.Query("q"))
	action := normalizeKeyword(c.Query("action"))

	items, err := h.Store.ListPaymentAuditLogs(c.Request.Context(), db.ListPaymentAuditLogsParams{
		Q:      normalizeNullableText(q),
		Action: normalizeNullableText(action),
		Offset: int32(offset),
		Limit:  int32(pageSize),
	})
	if err != nil {
		h.logError("list payment audit logs failed", err)
		apierrors.Write(c, http.StatusInternalServerError, apierrors.APIError{
			Code:    "internal_error",
			Message: "failed to list payment audit logs",
		})
		return
	}

	total, err := h.Store.CountPaymentAuditLogs(c.Request.Context(), db.CountPaymentAuditLogsParams{
		Q:      normalizeNullableText(q),
		Action: normalizeNullableText(action),
	})
	if err != nil {
		h.logError("count payment audit logs failed", err)
		apierrors.Write(c, http.StatusInternalServerError, apierrors.APIError{
			Code:    "internal_error",
			Message: "failed to list payment audit logs",
		})
		return
	}

	payload := make([]adminPaymentAuditLog, 0, len(items))
	for _, item := range items {
		payload = append(payload, adminAuditFromModel(item))
	}

	c.JSON(http.StatusOK, pagedAdminPaymentAuditLogs{
		Items:    payload,
		Page:     page,
		PageSize: pageSize,
		Total:    int(total),
	})
}

func (h *Handler) GetAdminPaymentsWebhooks(c *gin.Context) {
	if _, ok := h.requireUser(c); !ok {
		return
	}
	if h.Store == nil {
		apierrors.Write(c, http.StatusInternalServerError, apierrors.APIError{
			Code:    "internal_error",
			Message: "payment store is not configured",
		})
		return
	}

	page, pageSize := parsePageParams(c)
	offset := (page - 1) * pageSize
	q := normalizeKeyword(c.Query("q"))
	provider := normalizeKeyword(c.Query("provider"))

	items, err := h.Store.ListPaymentWebhooks(c.Request.Context(), db.ListPaymentWebhooksParams{
		Q:        normalizeNullableText(q),
		Provider: normalizeNullableText(strings.ToLower(provider)),
		Offset:   int32(offset),
		Limit:    int32(pageSize),
	})
	if err != nil {
		h.logError("list payment webhooks failed", err)
		apierrors.Write(c, http.StatusInternalServerError, apierrors.APIError{
			Code:    "internal_error",
			Message: "failed to list payment webhooks",
		})
		return
	}

	total, err := h.Store.CountPaymentWebhooks(c.Request.Context(), db.CountPaymentWebhooksParams{
		Q:        normalizeNullableText(q),
		Provider: normalizeNullableText(strings.ToLower(provider)),
	})
	if err != nil {
		h.logError("count payment webhooks failed", err)
		apierrors.Write(c, http.StatusInternalServerError, apierrors.APIError{
			Code:    "internal_error",
			Message: "failed to list payment webhooks",
		})
		return
	}

	payload := make([]adminPaymentWebhook, 0, len(items))
	for _, item := range items {
		payload = append(payload, adminWebhookFromModel(item))
	}

	c.JSON(http.StatusOK, pagedAdminPaymentWebhooks{
		Items:    payload,
		Page:     page,
		PageSize: pageSize,
		Total:    int(total),
	})
}

func (h *Handler) PostAdminPaymentsWebhooksIdReplay(c *gin.Context) {
	if _, ok := h.requireUser(c); !ok {
		return
	}
	if h.Store == nil {
		apierrors.Write(c, http.StatusInternalServerError, apierrors.APIError{
			Code:    "internal_error",
			Message: "payment store is not configured",
		})
		return
	}

	webhookID, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
	if err != nil {
		apierrors.Write(c, http.StatusBadRequest, apierrors.APIError{
			Code:    "invalid_request",
			Message: "id is required",
		})
		return
	}

	webhook, err := h.Store.GetPaymentWebhook(c.Request.Context(), webhookID)
	if err != nil {
		apierrors.Write(c, http.StatusNotFound, apierrors.APIError{
			Code:    "not_found",
			Message: "webhook not found",
		})
		return
	}

	now := time.Now().UTC()
	webhook, err = h.Store.ReplayPaymentWebhook(c.Request.Context(), db.ReplayPaymentWebhookParams{
		ID:             webhookID,
		DeliveryStatus: "REPLAYED",
		ProcessedAt:    pgtype.Timestamptz{Time: now, Valid: true},
	})
	if err != nil {
		h.logError("replay payment webhook failed", err)
		apierrors.Write(c, http.StatusInternalServerError, apierrors.APIError{
			Code:    "internal_error",
			Message: "failed to replay webhook",
		})
		return
	}

	if webhook.PaymentID.Valid {
		payment, err := h.Store.GetPayment(c.Request.Context(), webhook.PaymentID.Bytes)
		if err == nil && h.Commerce != nil {
			var paidAt *time.Time
			if payment.PaidAt.Valid {
				value := payment.PaidAt.Time
				paidAt = &value
			}
			if err := h.Commerce.SyncOrderPayment(c.Request.Context(), payment.OrderID.String(), CommercePaymentSyncRequest{
				PaymentID:       payment.ID.String(),
				Channel:         payment.Channel,
				Status:          payment.Status,
				ProviderTradeNo: payment.ProviderTradeNo,
				PaidAt:          paidAt,
			}); err != nil {
				h.logError("replay webhook sync order failed", err)
			}
		}
	}

	if err := h.recordAudit(c.Request.Context(), nullableUUIDBytes(webhook.PaymentID), "webhook_replay", "admin", fmt.Sprintf("manual replay for %s", webhook.ID)); err != nil {
		h.logError("create payment audit log failed", err)
	}

	c.JSON(http.StatusOK, replayWebhookResponse{
		ID:          webhook.ID.String(),
		Status:      "accepted",
		ReplayCount: int(webhook.ReplayCount),
		ReplayedAt:  now.Format(time.RFC3339),
	})
}

func adminTransactionFromModel(item db.Payment) adminPaymentTransaction {
	return adminPaymentTransaction{
		ID:            item.ID.String(),
		OrderID:       item.OrderID.String(),
		UserID:        nullableUUIDString(item.PayerUserID),
		Channel:       strings.ToLower(item.Channel),
		Status:        strings.ToLower(item.Status),
		AmountFen:     item.AmountFen,
		Currency:      item.Currency,
		CreatedAt:     item.CreatedAt.Time.Format(time.RFC3339),
		UpdatedAt:     item.UpdatedAt.Time.Format(time.RFC3339),
		FailureReason: nullableString(item.FailureMessage),
	}
}

func adminAuditFromModel(item db.PaymentAuditLog) adminPaymentAuditLog {
	return adminPaymentAuditLog{
		ID:            item.ID.String(),
		TransactionID: nullableUUIDString(item.PaymentID),
		Action:        item.Action,
		Actor:         item.Actor,
		Detail:        item.Detail,
		CreatedAt:     item.CreatedAt.Time.Format(time.RFC3339),
	}
}

func adminWebhookFromModel(item db.PaymentWebhook) adminPaymentWebhook {
	return adminPaymentWebhook{
		ID:          item.ID.String(),
		Provider:    item.Provider,
		EventType:   item.EventType,
		Transaction: nullableUUIDString(item.PaymentID),
		Status:      strings.ToLower(item.DeliveryStatus),
		ReplayCount: int(item.ReplayCount),
		ReceivedAt:  item.CreatedAt.Time.Format(time.RFC3339),
		LastReplay:  timestampString(item.ProcessedAt),
	}
}

func normalizeKeyword(raw string) string {
	return strings.TrimSpace(raw)
}

func parsePageParams(c *gin.Context) (int, int) {
	page := 1
	pageSize := 20
	if parsed, ok := parsePositiveInt(c.Query("page")); ok {
		page = parsed
	}
	if parsed, ok := parsePositiveInt(c.Query("pageSize")); ok {
		pageSize = parsed
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return page, pageSize
}

func parsePositiveInt(raw string) (int, bool) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return 0, false
	}
	parsed := 0
	for _, ch := range trimmed {
		if ch < '0' || ch > '9' {
			return 0, false
		}
		parsed = parsed*10 + int(ch-'0')
	}
	if parsed <= 0 {
		return 0, false
	}
	return parsed, true
}

func normalizeNullableText(raw string) *string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func nullableUUIDString(value pgtype.UUID) string {
	if value.Valid {
		return uuid.UUID(value.Bytes).String()
	}
	return ""
}

func nullableUUIDBytes(value pgtype.UUID) uuid.UUID {
	if value.Valid {
		return value.Bytes
	}
	return uuid.Nil
}

func nullableString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func timestampString(value pgtype.Timestamptz) string {
	if value.Valid {
		return value.Time.Format(time.RFC3339)
	}
	return ""
}
