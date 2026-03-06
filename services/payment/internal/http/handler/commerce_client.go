package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type CommerceClient struct {
	baseURL   string
	syncToken string
	client    *http.Client
}

type CommerceOrder struct {
	ID            string              `json:"id"`
	Status        string              `json:"status"`
	PaymentStatus string              `json:"paymentStatus"`
	Items         []CommerceOrderItem `json:"items"`
}

type CommerceOrderItem struct {
	Qty          int   `json:"qty"`
	UnitPriceFen int64 `json:"unitPriceFen"`
}

type CommercePaymentSyncRequest struct {
	PaymentID       string     `json:"paymentId"`
	Channel         string     `json:"channel"`
	Status          string     `json:"status"`
	ProviderTradeNo *string    `json:"providerTradeNo,omitempty"`
	PaidAt          *time.Time `json:"paidAt,omitempty"`
}

func NewCommerceClient(baseURL, syncToken string) *CommerceClient {
	return &CommerceClient{
		baseURL:   strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		syncToken: strings.TrimSpace(syncToken),
		client: &http.Client{
			Timeout: 8 * time.Second,
		},
	}
}

func (c *CommerceClient) GetOrder(ctx context.Context, authHeader, orderID string) (CommerceOrder, error) {
	if c == nil || c.baseURL == "" {
		return CommerceOrder{}, fmt.Errorf("commerce client is not configured")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/orders/"+orderID, nil)
	if err != nil {
		return CommerceOrder{}, fmt.Errorf("build commerce order request: %w", err)
	}
	if strings.TrimSpace(authHeader) != "" {
		req.Header.Set("Authorization", authHeader)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return CommerceOrder{}, fmt.Errorf("request commerce order: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return CommerceOrder{}, fmt.Errorf("commerce order request failed with status %d", resp.StatusCode)
	}

	var order CommerceOrder
	if err := json.NewDecoder(resp.Body).Decode(&order); err != nil {
		return CommerceOrder{}, fmt.Errorf("decode commerce order response: %w", err)
	}
	return order, nil
}

func (c *CommerceClient) SyncOrderPayment(ctx context.Context, orderID string, payload CommercePaymentSyncRequest) error {
	if c == nil || c.baseURL == "" {
		return fmt.Errorf("commerce client is not configured")
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal commerce payment sync payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/internal/orders/"+orderID+"/payment-status", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build commerce payment sync request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if c.syncToken != "" {
		req.Header.Set("X-Internal-Token", c.syncToken)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("request commerce payment sync: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("commerce payment sync failed with status %d", resp.StatusCode)
	}

	return nil
}
