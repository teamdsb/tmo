package handler

import (
	"context"
	"encoding/json"
	"github.com/google/uuid"
	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/http/oapi"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
)

func TestOrdersStatusGroupsFilterBeforePaginationAndRespectOwnership(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)
	q := db.New(pool)
	sku, _ := seedCatalog(t, q)
	sales, other, customer := uuid.New(), uuid.New(), uuid.New()
	for _, status := range []string{"SUBMITTED", "PAY_PENDING", "PAY_FAILED", "CONFIRMED", "PAID", "SHIPPED"} {
		order := seedOrderWithItem(t, q, customer, &sales, sku.ID)
		if _, err := pool.Exec(context.Background(), "UPDATE orders SET status=$2,created_at='2026-01-01T00:00:00Z' WHERE id=$1", order.ID, status); err != nil {
			t.Fatal(err)
		}
	}
	seedOrderWithItem(t, q, customer, &other, sku.ID)
	router := newAuthIntegrationRouter(pool, q)
	token := makeAuthToken(t, sales, "SALES", nil)
	for _, scenario := range []struct {
		filter string
		total  int
	}{
		{"statuses=SUBMITTED,PAY_PENDING,PAY_FAILED", 3},
		{"statuses=SUBMITTED&statuses=PAY_PENDING&statuses=PAY_FAILED", 3},
		{"status=SUBMITTED", 1},
		{"statuses=SUBMITTED&statuses=SUBMITTED", 1},
	} {
		filter := scenario.filter
		t.Run(filter, func(t *testing.T) {
			seen := map[uuid.UUID]bool{}
			previousID := ""
			for page := 1; page <= scenario.total; page++ {
				query := "/orders?" + filter + "&pageSize=1&page=" + strconv.Itoa(page)
				req := httptest.NewRequest(http.MethodGet, query, nil)
				req.Header.Set("Authorization", "Bearer "+token)
				rec := httptest.NewRecorder()
				router.ServeHTTP(rec, req)
				if rec.Code != http.StatusOK {
					t.Fatalf("list: %d %s", rec.Code, rec.Body.String())
				}
				var got oapi.PagedOrderList
				if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
					t.Fatal(err)
				}
				if got.Total != scenario.total || len(got.Items) != 1 {
					t.Fatalf("filter count/page mismatch: %#v", got)
				}
				item := got.Items[0]
				if item.Status != oapi.OrderStatusSUBMITTED && item.Status != oapi.OrderStatusPAYPENDING && item.Status != oapi.OrderStatusPAYFAILED {
					t.Fatalf("wrong status: %s", item.Status)
				}
				if seen[item.Id] {
					t.Fatalf("unstable pagination repeated %s", item.Id)
				}
				if previousID != "" && item.Id.String() > previousID {
					t.Fatalf("equal-time orders are not stably ordered by ID: %s before %s", previousID, item.Id)
				}
				previousID = item.Id.String()
				seen[item.Id] = true
			}
		})
	}
}

func TestOrdersRejectsInvalidOrAmbiguousStatusFilters(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)
	q := db.New(pool)
	router := newAuthIntegrationRouter(pool, q)
	token := makeAuthToken(t, uuid.New(), "CUSTOMER", nil)
	for _, query := range []string{"status=SUBMITTED&statuses=SUBMITTED,PAY_PENDING", "statuses=NOT_A_STATUS", "statuses=", "status=NOT_A_STATUS"} {
		req := httptest.NewRequest(http.MethodGet, "/orders?"+query, nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("%s: expected 400, got %d %s", query, rec.Code, rec.Body.String())
		}
	}
}
