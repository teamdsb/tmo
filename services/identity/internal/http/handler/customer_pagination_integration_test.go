package handler_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/teamdsb/tmo/services/identity/internal/http/oapi"
)

func TestCustomerPaginationUsesStableOrderForEqualCreationTimes(t *testing.T) {
	router, pool := setupTestRouter(t)
	ctx := context.Background()
	if err := resetIdentityTables(ctx, pool); err != nil {
		t.Fatal(err)
	}
	if err := seedSales(ctx, pool); err != nil {
		t.Fatal(err)
	}
	for i := 1; i <= 51; i++ {
		id := uuid.MustParse(fmt.Sprintf("10000000-0000-0000-0000-%012d", i))
		if err := seedCustomer(ctx, pool, id, fmt.Sprintf("Customer %02d", i), &salesID); err != nil {
			t.Fatal(err)
		}
	}
	if err := seedCustomer(ctx, pool, uuid.New(), "Not owned", nil); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, "UPDATE users SET created_at='2026-01-01T00:00:00Z' WHERE user_type='customer'"); err != nil {
		t.Fatal(err)
	}
	login := doJSON(t, router, http.MethodPost, "/auth/mini/login", map[string]interface{}{
		"platform": "weapp", "code": "mock_sales_001", "role": "SALES",
	}, "")
	if login.Code != http.StatusOK {
		t.Fatalf("login: %d %s", login.Code, login.Body.String())
	}
	var session oapi.AuthResponse
	if err := json.NewDecoder(login.Body).Decode(&session); err != nil {
		t.Fatal(err)
	}
	count := 0
	for page := 1; page <= 3; page++ {
		response := doJSON(t, router, http.MethodGet, fmt.Sprintf("/customers?page=%d&pageSize=20", page), nil, session.AccessToken)
		if response.Code != http.StatusOK {
			t.Fatalf("page %d: %d %s", page, response.Code, response.Body.String())
		}
		var list oapi.PagedCustomerList
		if err := json.NewDecoder(response.Body).Decode(&list); err != nil {
			t.Fatal(err)
		}
		if list.Total != 51 {
			t.Fatalf("wrong scoped total: %d", list.Total)
		}
		expectedCount := 20
		if page == 3 {
			expectedCount = 11
		}
		if len(list.Items) != expectedCount {
			t.Fatalf("page %d size: %d", page, len(list.Items))
		}
		for _, customer := range list.Items {
			expectedID := fmt.Sprintf("10000000-0000-0000-0000-%012d", 51-count)
			if customer.Id.String() != expectedID {
				t.Fatalf("unstable page %d: expected %s, got %s", page, expectedID, customer.Id)
			}
			count++
		}
	}
	if count != 51 {
		t.Fatalf("expected all 51 customers, got %d", count)
	}
}
