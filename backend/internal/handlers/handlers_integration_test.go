package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"tmo/internal/db"
	"tmo/internal/store"
)

type createSalesResponse struct {
	ID       string `json:"id"`
	BindCode string `json:"bind_code"`
}

type createCustomerResponse struct {
	ID string `json:"id"`
}

type bindResponse struct {
	Status  string  `json:"status"`
	SalesID *string `json:"sales_id"`
}

type transferResponse struct {
	Status     string  `json:"status"`
	OldSalesID *string `json:"old_sales_id"`
	NewSalesID string  `json:"new_sales_id"`
}

type getCustomerResponse struct {
	ID      string  `json:"id"`
	SalesID *string `json:"sales_id"`
}

func TestSalesBindingChain(t *testing.T) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Skip("DATABASE_URL not set; skip integration test")
	}

	ctx := context.Background()
	pool, err := db.NewPool(ctx, databaseURL)
	if err != nil {
		t.Fatalf("db connect: %v", err)
	}
	defer pool.Close()

	storeSvc := store.NewPostgresStore(pool)
	gin.SetMode(gin.TestMode)
	router := NewRouter(storeSvc)

	var salesAID uuid.UUID
	var salesBID uuid.UUID
	var customerID uuid.UUID

	defer func() {
		if customerID != uuid.Nil {
			_, _ = pool.Exec(ctx, "DELETE FROM customers WHERE id = $1", customerID)
		}
		if salesAID != uuid.Nil {
			_, _ = pool.Exec(ctx, "DELETE FROM sales_profiles WHERE id = $1", salesAID)
		}
		if salesBID != uuid.Nil {
			_, _ = pool.Exec(ctx, "DELETE FROM sales_profiles WHERE id = $1", salesBID)
		}
	}()

	salesA := mustCreateSales(t, router, "Alice")
	salesAID = salesA.ID

	salesB := mustCreateSales(t, router, "Bob")
	salesBID = salesB.ID

	customerID = mustCreateCustomer(t, router, "Buyer")

	bindResp := mustBindCustomer(t, router, customerID, salesA.BindCode)
	if bindResp.Status != "bound" {
		t.Fatalf("expected status bound, got %q", bindResp.Status)
	}
	if bindResp.SalesID == nil || *bindResp.SalesID != salesA.ID.String() {
		t.Fatalf("expected sales_id %s, got %v", salesA.ID.String(), bindResp.SalesID)
	}

	bindResp = mustBindCustomer(t, router, customerID, salesA.BindCode)
	if bindResp.Status != "already_bound" {
		t.Fatalf("expected status already_bound, got %q", bindResp.Status)
	}
	if bindResp.SalesID == nil || *bindResp.SalesID != salesA.ID.String() {
		t.Fatalf("expected sales_id %s, got %v", salesA.ID.String(), bindResp.SalesID)
	}

	transferResp := mustTransferCustomer(t, router, customerID, salesB.ID)
	if transferResp.Status != "transferred" {
		t.Fatalf("expected status transferred, got %q", transferResp.Status)
	}
	if transferResp.NewSalesID != salesB.ID.String() {
		t.Fatalf("expected new_sales_id %s, got %s", salesB.ID.String(), transferResp.NewSalesID)
	}
	if transferResp.OldSalesID == nil || *transferResp.OldSalesID != salesA.ID.String() {
		t.Fatalf("expected old_sales_id %s, got %v", salesA.ID.String(), transferResp.OldSalesID)
	}

	customerResp := mustGetCustomer(t, router, customerID)
	if customerResp.SalesID == nil || *customerResp.SalesID != salesB.ID.String() {
		t.Fatalf("expected sales_id %s, got %v", salesB.ID.String(), customerResp.SalesID)
	}
}

type salesInfo struct {
	ID       uuid.UUID
	BindCode string
}

func mustCreateSales(t *testing.T, router http.Handler, name string) salesInfo {
	t.Helper()

	rr := performJSON(t, router, http.MethodPost, "/api/admin/sales", map[string]string{"name": name}, map[string]string{
		"X-Role": "admin",
	})
	assertStatus(t, rr, http.StatusOK)

	var resp createSalesResponse
	decodeJSON(t, rr, &resp)
	if resp.ID == "" || resp.BindCode == "" {
		t.Fatalf("invalid sales response: %+v", resp)
	}

	id, err := uuid.Parse(resp.ID)
	if err != nil {
		t.Fatalf("invalid sales id: %v", err)
	}

	return salesInfo{ID: id, BindCode: resp.BindCode}
}

func mustCreateCustomer(t *testing.T, router http.Handler, name string) uuid.UUID {
	t.Helper()

	rr := performJSON(t, router, http.MethodPost, "/api/admin/customers", map[string]string{"name": name}, map[string]string{
		"X-Role": "admin",
	})
	assertStatus(t, rr, http.StatusOK)

	var resp createCustomerResponse
	decodeJSON(t, rr, &resp)
	if resp.ID == "" {
		t.Fatalf("invalid customer response: %+v", resp)
	}

	id, err := uuid.Parse(resp.ID)
	if err != nil {
		t.Fatalf("invalid customer id: %v", err)
	}

	return id
}

func mustBindCustomer(t *testing.T, router http.Handler, customerID uuid.UUID, bindCode string) bindResponse {
	t.Helper()

	rr := performJSON(t, router, http.MethodPost, "/api/sales/bind", map[string]string{"bind_code": bindCode}, map[string]string{
		"X-Customer-Id": customerID.String(),
	})
	assertStatus(t, rr, http.StatusOK)

	var resp bindResponse
	decodeJSON(t, rr, &resp)

	return resp
}

func mustTransferCustomer(t *testing.T, router http.Handler, customerID uuid.UUID, newSalesID uuid.UUID) transferResponse {
	t.Helper()

	rr := performJSON(t, router, http.MethodPost, "/api/admin/customers/transfer", map[string]string{
		"customer_id":  customerID.String(),
		"new_sales_id": newSalesID.String(),
	}, map[string]string{
		"X-Role": "admin",
	})
	assertStatus(t, rr, http.StatusOK)

	var resp transferResponse
	decodeJSON(t, rr, &resp)

	return resp
}

func mustGetCustomer(t *testing.T, router http.Handler, customerID uuid.UUID) getCustomerResponse {
	t.Helper()

	path := fmt.Sprintf("/api/admin/customers/%s", customerID.String())
	rr := performJSON(t, router, http.MethodGet, path, nil, map[string]string{
		"X-Role": "admin",
	})
	assertStatus(t, rr, http.StatusOK)

	var resp getCustomerResponse
	decodeJSON(t, rr, &resp)

	return resp
}

func performJSON(t *testing.T, router http.Handler, method string, path string, body any, headers map[string]string) *httptest.ResponseRecorder {
	t.Helper()

	var reader *bytes.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("json marshal: %v", err)
		}
		reader = bytes.NewReader(payload)
	} else {
		reader = bytes.NewReader(nil)
	}

	req := httptest.NewRequest(method, path, reader)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	for key, value := range headers {
		req.Header.Set(key, value)
	}

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)
	return rr
}

func decodeJSON(t *testing.T, rr *httptest.ResponseRecorder, target any) {
	t.Helper()

	if err := json.NewDecoder(rr.Body).Decode(target); err != nil {
		t.Fatalf("json decode: %v", err)
	}
}

func assertStatus(t *testing.T, rr *httptest.ResponseRecorder, expected int) {
	t.Helper()

	if rr.Code != expected {
		t.Fatalf("expected status %d, got %d: %s", expected, rr.Code, rr.Body.String())
	}
}
