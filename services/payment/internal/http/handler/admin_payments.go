package handler

import (
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	apierrors "github.com/teamdsb/tmo/packages/go-shared/errors"
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

type paymentAdminStore struct {
	mu           sync.RWMutex
	transactions []adminPaymentTransaction
	auditLogs    []adminPaymentAuditLog
	webhooks     []adminPaymentWebhook
}

var defaultPaymentAdminStore = newPaymentAdminStore()

func newPaymentAdminStore() *paymentAdminStore {
	now := time.Now().UTC()
	timeText := now.Format(time.RFC3339)
	prev := now.Add(-2 * time.Hour).Format(time.RFC3339)
	old := now.Add(-24 * time.Hour).Format(time.RFC3339)

	return &paymentAdminStore{
		transactions: []adminPaymentTransaction{
			{
				ID:        "TXN-20260305-001",
				OrderID:   "ORD-20260305-001",
				UserID:    "u-alex",
				Channel:   "wechat",
				Status:    "paid",
				AmountFen: 128000,
				Currency:  "CNY",
				CreatedAt: prev,
				UpdatedAt: timeText,
			},
			{
				ID:            "TXN-20260305-002",
				OrderID:       "ORD-20260305-002",
				UserID:        "u-sarah",
				Channel:       "alipay",
				Status:        "failed",
				AmountFen:     4599,
				Currency:      "CNY",
				CreatedAt:     old,
				UpdatedAt:     prev,
				FailureReason: "gateway_declined",
			},
		},
		auditLogs: []adminPaymentAuditLog{
			{
				ID:            "AUD-20260305-001",
				TransactionID: "TXN-20260305-001",
				Action:        "status_updated",
				Actor:         "system",
				Detail:        "status changed to paid",
				CreatedAt:     timeText,
			},
			{
				ID:            "AUD-20260305-002",
				TransactionID: "TXN-20260305-002",
				Action:        "webhook_received",
				Actor:         "system",
				Detail:        "alipay callback processed",
				CreatedAt:     prev,
			},
		},
		webhooks: []adminPaymentWebhook{
			{
				ID:          "WH-20260305-001",
				Provider:    "wechat",
				EventType:   "payment.succeeded",
				Transaction: "TXN-20260305-001",
				Status:      "processed",
				ReplayCount: 0,
				ReceivedAt:  timeText,
			},
			{
				ID:          "WH-20260305-002",
				Provider:    "alipay",
				EventType:   "payment.failed",
				Transaction: "TXN-20260305-002",
				Status:      "processed",
				ReplayCount: 0,
				ReceivedAt:  prev,
			},
		},
	}
}

func (h *Handler) GetAdminPaymentsTransactions(c *gin.Context) {
	if !h.requireUser(c) {
		return
	}

	page, pageSize := parsePageParams(c)
	q := normalizeKeyword(c.Query("q"))
	status := normalizeKeyword(c.Query("status"))
	channel := normalizeKeyword(c.Query("channel"))

	defaultPaymentAdminStore.mu.RLock()
	defer defaultPaymentAdminStore.mu.RUnlock()

	filtered := make([]adminPaymentTransaction, 0, len(defaultPaymentAdminStore.transactions))
	for _, item := range defaultPaymentAdminStore.transactions {
		if q != "" {
			query := strings.ToLower(q)
			if !strings.Contains(strings.ToLower(item.ID), query) &&
				!strings.Contains(strings.ToLower(item.OrderID), query) &&
				!strings.Contains(strings.ToLower(item.UserID), query) {
				continue
			}
		}
		if status != "" && !strings.EqualFold(item.Status, status) {
			continue
		}
		if channel != "" && !strings.EqualFold(item.Channel, channel) {
			continue
		}
		filtered = append(filtered, item)
	}

	items := paginate(filtered, page, pageSize)
	c.JSON(http.StatusOK, pagedAdminPaymentTransactions{
		Items:    items,
		Page:     page,
		PageSize: pageSize,
		Total:    len(filtered),
	})
}

func (h *Handler) GetAdminPaymentsTransactionsId(c *gin.Context) {
	if !h.requireUser(c) {
		return
	}

	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		apierrors.Write(c, http.StatusBadRequest, apierrors.APIError{
			Code:    "invalid_request",
			Message: "id is required",
		})
		return
	}

	defaultPaymentAdminStore.mu.RLock()
	defer defaultPaymentAdminStore.mu.RUnlock()
	for _, item := range defaultPaymentAdminStore.transactions {
		if strings.EqualFold(item.ID, id) {
			c.JSON(http.StatusOK, item)
			return
		}
	}

	apierrors.Write(c, http.StatusNotFound, apierrors.APIError{
		Code:    "not_found",
		Message: "transaction not found",
	})
}

func (h *Handler) GetAdminPaymentsAuditLogs(c *gin.Context) {
	if !h.requireUser(c) {
		return
	}

	page, pageSize := parsePageParams(c)
	q := normalizeKeyword(c.Query("q"))
	action := normalizeKeyword(c.Query("action"))

	defaultPaymentAdminStore.mu.RLock()
	defer defaultPaymentAdminStore.mu.RUnlock()

	filtered := make([]adminPaymentAuditLog, 0, len(defaultPaymentAdminStore.auditLogs))
	for _, item := range defaultPaymentAdminStore.auditLogs {
		if q != "" {
			query := strings.ToLower(q)
			if !strings.Contains(strings.ToLower(item.TransactionID), query) &&
				!strings.Contains(strings.ToLower(item.Detail), query) {
				continue
			}
		}
		if action != "" && !strings.EqualFold(item.Action, action) {
			continue
		}
		filtered = append(filtered, item)
	}

	items := paginate(filtered, page, pageSize)
	c.JSON(http.StatusOK, pagedAdminPaymentAuditLogs{
		Items:    items,
		Page:     page,
		PageSize: pageSize,
		Total:    len(filtered),
	})
}

func (h *Handler) GetAdminPaymentsWebhooks(c *gin.Context) {
	if !h.requireUser(c) {
		return
	}

	page, pageSize := parsePageParams(c)
	q := normalizeKeyword(c.Query("q"))
	provider := normalizeKeyword(c.Query("provider"))

	defaultPaymentAdminStore.mu.RLock()
	defer defaultPaymentAdminStore.mu.RUnlock()

	filtered := make([]adminPaymentWebhook, 0, len(defaultPaymentAdminStore.webhooks))
	for _, item := range defaultPaymentAdminStore.webhooks {
		if q != "" {
			query := strings.ToLower(q)
			if !strings.Contains(strings.ToLower(item.ID), query) &&
				!strings.Contains(strings.ToLower(item.Transaction), query) &&
				!strings.Contains(strings.ToLower(item.EventType), query) {
				continue
			}
		}
		if provider != "" && !strings.EqualFold(item.Provider, provider) {
			continue
		}
		filtered = append(filtered, item)
	}

	items := paginate(filtered, page, pageSize)
	c.JSON(http.StatusOK, pagedAdminPaymentWebhooks{
		Items:    items,
		Page:     page,
		PageSize: pageSize,
		Total:    len(filtered),
	})
}

func (h *Handler) PostAdminPaymentsWebhooksIdReplay(c *gin.Context) {
	if !h.requireUser(c) {
		return
	}

	id := strings.TrimSpace(c.Param("id"))
	if id == "" {
		apierrors.Write(c, http.StatusBadRequest, apierrors.APIError{
			Code:    "invalid_request",
			Message: "id is required",
		})
		return
	}

	defaultPaymentAdminStore.mu.Lock()
	defer defaultPaymentAdminStore.mu.Unlock()

	for idx, webhook := range defaultPaymentAdminStore.webhooks {
		if !strings.EqualFold(webhook.ID, id) {
			continue
		}

		now := time.Now().UTC().Format(time.RFC3339)
		webhook.ReplayCount++
		webhook.LastReplay = now
		webhook.Status = "replayed"
		defaultPaymentAdminStore.webhooks[idx] = webhook

		audit := adminPaymentAuditLog{
			ID:            "AUD-" + strings.ReplaceAll(now, ":", ""),
			TransactionID: webhook.Transaction,
			Action:        "webhook_replay",
			Actor:         "admin",
			Detail:        "manual replay for " + webhook.ID,
			CreatedAt:     now,
		}
		defaultPaymentAdminStore.auditLogs = append([]adminPaymentAuditLog{audit}, defaultPaymentAdminStore.auditLogs...)

		c.JSON(http.StatusOK, replayWebhookResponse{
			ID:          webhook.ID,
			Status:      "accepted",
			ReplayCount: webhook.ReplayCount,
			ReplayedAt:  now,
		})
		return
	}

	apierrors.Write(c, http.StatusNotFound, apierrors.APIError{
		Code:    "not_found",
		Message: "webhook not found",
	})
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

func paginate[T any](items []T, page int, pageSize int) []T {
	if len(items) == 0 {
		return []T{}
	}
	start := (page - 1) * pageSize
	if start >= len(items) {
		return []T{}
	}
	end := start + pageSize
	if end > len(items) {
		end = len(items)
	}
	window := slices.Clone(items[start:end])
	if window == nil {
		return []T{}
	}
	return window
}
