package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestCommerceClientGetOrderForwardsAuthorization(t *testing.T) {
	var gotAuth string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		if r.Method != http.MethodGet || r.URL.Path != "/orders/order-1" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(CommerceOrder{
			ID:            "order-1",
			Status:        "SUBMITTED",
			PaymentStatus: "UNPAID",
			Items:         []CommerceOrderItem{{Qty: 2, UnitPriceFen: 1000}},
		})
	}))
	defer server.Close()

	client := NewCommerceClient(server.URL, "sync-token")
	order, err := client.GetOrder(context.Background(), "Bearer abc", "order-1")
	if err != nil {
		t.Fatalf("GetOrder returned error: %v", err)
	}
	if gotAuth != "Bearer abc" {
		t.Fatalf("expected Authorization header to be forwarded, got %q", gotAuth)
	}
	if order.ID != "order-1" || order.Status != "SUBMITTED" {
		t.Fatalf("unexpected order payload: %#v", order)
	}
}

func TestCommerceClientSyncOrderPaymentSendsInternalToken(t *testing.T) {
	var gotToken string
	var gotPayload CommercePaymentSyncRequest

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/internal/orders/order-1/payment-status" {
			http.NotFound(w, r)
			return
		}
		gotToken = r.Header.Get("X-Internal-Token")
		if err := json.NewDecoder(r.Body).Decode(&gotPayload); err != nil {
			t.Fatalf("decode payload: %v", err)
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	client := NewCommerceClient(server.URL, "sync-token")
	now := time.Now().UTC()
	err := client.SyncOrderPayment(context.Background(), "order-1", CommercePaymentSyncRequest{
		PaymentID:       "payment-1",
		Channel:         "WECHAT",
		Status:          "PAID",
		ProviderTradeNo: strPtr("wx-1"),
		PaidAt:          &now,
	})
	if err != nil {
		t.Fatalf("SyncOrderPayment returned error: %v", err)
	}
	if gotToken != "sync-token" {
		t.Fatalf("expected X-Internal-Token header, got %q", gotToken)
	}
	if gotPayload.PaymentID != "payment-1" || gotPayload.Status != "PAID" {
		t.Fatalf("unexpected sync payload: %#v", gotPayload)
	}
}

func TestCommerceClientReturnsErrorOnNon2xx(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	client := NewCommerceClient(server.URL, "sync-token")
	if _, err := client.GetOrder(context.Background(), "", "order-1"); err == nil {
		t.Fatal("expected GetOrder to fail on non-2xx response")
	}
	if err := client.SyncOrderPayment(context.Background(), "order-1", CommercePaymentSyncRequest{PaymentID: "payment-1"}); err == nil {
		t.Fatal("expected SyncOrderPayment to fail on non-2xx response")
	}
}
