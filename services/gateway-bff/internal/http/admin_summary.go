package http

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/teamdsb/tmo/packages/go-shared/httpx"
)

type AdminSummaryMetrics struct {
	ProductsTotal        int `json:"productsTotal"`
	OrdersTotal          int `json:"ordersTotal"`
	OrdersPending        int `json:"ordersPending"`
	InquiriesTotal       int `json:"inquiriesTotal"`
	InquiriesOpen        int `json:"inquiriesOpen"`
	ProductRequestsTotal int `json:"productRequestsTotal"`
}

type AdminSummaryResponse struct {
	GeneratedAt   time.Time           `json:"generatedAt"`
	Metrics       AdminSummaryMetrics `json:"metrics"`
	FeatureFlags  map[string]bool     `json:"featureFlags"`
	WarningLabels []string            `json:"warnings,omitempty"`
}

type AdminSummaryHandler struct {
	identityBaseURL string
	commerceBaseURL string
	client          *http.Client
	logger          *slog.Logger
}

func NewAdminSummaryHandler(identityBaseURL, commerceBaseURL string, client *http.Client, logger *slog.Logger) *AdminSummaryHandler {
	return &AdminSummaryHandler{
		identityBaseURL: strings.TrimRight(strings.TrimSpace(identityBaseURL), "/"),
		commerceBaseURL: strings.TrimRight(strings.TrimSpace(commerceBaseURL), "/"),
		client:          client,
		logger:          logger,
	}
}

func (h *AdminSummaryHandler) Handle(c *gin.Context) {
	response := AdminSummaryResponse{
		GeneratedAt: time.Now().UTC(),
		FeatureFlags: map[string]bool{
			"paymentEnabled":   false,
			"wechatPayEnabled": false,
			"alipayPayEnabled": false,
		},
	}

	authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
	requestID := httpx.RequestIDFromContext(c)

	if payload, err := h.fetchJSONMap(c.Request.Context(), h.identityBaseURL+"/admin/config/feature-flags", requestID, authHeader); err == nil {
		response.FeatureFlags = readFeatureFlags(payload)
	} else {
		response.WarningLabels = append(response.WarningLabels, "feature_flags_unavailable")
		h.logWarn("admin summary: feature flags unavailable", err)
	}

	if payload, err := h.fetchJSONMap(c.Request.Context(), h.commerceBaseURL+"/catalog/products?page=1&pageSize=1", requestID, authHeader); err == nil {
		response.Metrics.ProductsTotal = extractTotal(payload)
	} else {
		response.WarningLabels = append(response.WarningLabels, "products_unavailable")
		h.logWarn("admin summary: products unavailable", err)
	}

	if payload, err := h.fetchJSONMap(c.Request.Context(), h.commerceBaseURL+"/orders?page=1&pageSize=50", requestID, authHeader); err == nil {
		response.Metrics.OrdersTotal = extractTotal(payload)
		response.Metrics.OrdersPending = countPendingOrders(payload)
	} else {
		response.WarningLabels = append(response.WarningLabels, "orders_unavailable")
		h.logWarn("admin summary: orders unavailable", err)
	}

	if payload, err := h.fetchJSONMap(c.Request.Context(), h.commerceBaseURL+"/inquiries/price?page=1&pageSize=50", requestID, authHeader); err == nil {
		response.Metrics.InquiriesTotal = extractTotal(payload)
		response.Metrics.InquiriesOpen = countOpenInquiries(payload)
	} else {
		response.WarningLabels = append(response.WarningLabels, "inquiries_unavailable")
		h.logWarn("admin summary: inquiries unavailable", err)
	}

	if payload, err := h.fetchJSONMap(c.Request.Context(), h.commerceBaseURL+"/product-requests?page=1&pageSize=1", requestID, authHeader); err == nil {
		response.Metrics.ProductRequestsTotal = extractTotal(payload)
	} else {
		response.WarningLabels = append(response.WarningLabels, "product_requests_unavailable")
		h.logWarn("admin summary: product requests unavailable", err)
	}

	c.JSON(http.StatusOK, response)
}

func (h *AdminSummaryHandler) fetchJSONMap(ctx context.Context, url, requestID, authHeader string) (map[string]interface{}, error) {
	if strings.TrimSpace(url) == "" {
		return nil, fmt.Errorf("missing upstream url")
	}

	client := h.client
	if client == nil {
		client = http.DefaultClient
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	if requestID != "" {
		req.Header.Set("X-Request-ID", requestID)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("upstream status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if len(body) == 0 {
		return map[string]interface{}{}, nil
	}

	payload := make(map[string]interface{})
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}
	return payload, nil
}

func readFeatureFlags(payload map[string]interface{}) map[string]bool {
	flags := map[string]bool{
		"paymentEnabled":   false,
		"wechatPayEnabled": false,
		"alipayPayEnabled": false,
	}

	for key := range flags {
		if value, ok := payload[key].(bool); ok {
			flags[key] = value
		}
	}
	return flags
}

func extractTotal(payload map[string]interface{}) int {
	raw, ok := payload["total"]
	if !ok {
		return 0
	}
	switch value := raw.(type) {
	case float64:
		return int(value)
	case int:
		return value
	case int32:
		return int(value)
	case int64:
		return int(value)
	default:
		return 0
	}
}

func countPendingOrders(payload map[string]interface{}) int {
	items, ok := payload["items"].([]interface{})
	if !ok {
		return 0
	}

	count := 0
	for _, rawItem := range items {
		item, ok := rawItem.(map[string]interface{})
		if !ok {
			continue
		}
		status, _ := item["status"].(string)
		switch strings.ToUpper(strings.TrimSpace(status)) {
		case "SUBMITTED", "CONFIRMED", "PAY_PENDING":
			count++
		}
	}
	return count
}

func countOpenInquiries(payload map[string]interface{}) int {
	items, ok := payload["items"].([]interface{})
	if !ok {
		return 0
	}

	count := 0
	for _, rawItem := range items {
		item, ok := rawItem.(map[string]interface{})
		if !ok {
			continue
		}
		status, _ := item["status"].(string)
		if strings.EqualFold(status, "OPEN") {
			count++
		}
	}
	return count
}

func (h *AdminSummaryHandler) logWarn(message string, err error) {
	if h.logger == nil || err == nil {
		return
	}
	h.logger.Warn(message, "error", err)
}
