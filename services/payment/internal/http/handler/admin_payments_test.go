package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestAdminPaymentsTransactionsList(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	h := &Handler{}
	router.GET("/admin/payments/transactions", h.GetAdminPaymentsTransactions)

	req := httptest.NewRequest(http.MethodGet, "/admin/payments/transactions?page=1&pageSize=10", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Items []map[string]interface{} `json:"items"`
		Total int                      `json:"total"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.Total == 0 || len(payload.Items) == 0 {
		t.Fatalf("expected non-empty transactions, got total=%d items=%d", payload.Total, len(payload.Items))
	}
}

func TestAdminPaymentsWebhookReplay(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	h := &Handler{}
	router.POST("/admin/payments/webhooks/:id/replay", h.PostAdminPaymentsWebhooksIdReplay)

	req := httptest.NewRequest(http.MethodPost, "/admin/payments/webhooks/WH-20260305-001/replay", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		ID          string `json:"id"`
		ReplayCount int    `json:"replayCount"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode replay response: %v", err)
	}
	if payload.ID == "" || payload.ReplayCount <= 0 {
		t.Fatalf("expected replay id and positive replayCount, got %#v", payload)
	}
}
