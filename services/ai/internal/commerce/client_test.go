package commerce

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestGetAfterSalesTicketForwardsAuthAndRequestID(t *testing.T) {
	ticketID := uuid.MustParse("11111111-1111-1111-1111-111111111111")

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer token-1" {
			t.Fatalf("expected Authorization header, got %q", got)
		}
		if got := r.Header.Get("X-Request-ID"); got != "req-1" {
			t.Fatalf("expected request id req-1, got %q", got)
		}
		if got := r.URL.Path; got != "/after-sales/tickets/"+ticketID.String() {
			t.Fatalf("unexpected path %q", got)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"id":          ticketID.String(),
			"status":      "OPEN",
			"subject":     "包装破损",
			"description": "客户反馈包装破损",
		})
	}))
	defer server.Close()

	client := NewClient(server.URL, time.Second)
	ticket, err := client.GetAfterSalesTicket(context.Background(), "Bearer token-1", ticketID, "req-1")
	if err != nil {
		t.Fatalf("GetAfterSalesTicket() error = %v", err)
	}
	if ticket.ID != ticketID {
		t.Fatalf("expected ticket id %s, got %s", ticketID, ticket.ID)
	}
}

func TestListAfterSalesMessagesPaginatesUntilTotal(t *testing.T) {
	ticketID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	message1 := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	message2 := uuid.MustParse("33333333-3333-3333-3333-333333333333")

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		page := r.URL.Query().Get("page")
		w.Header().Set("Content-Type", "application/json")
		switch page {
		case "1":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"items": []map[string]any{{
					"id":         message1.String(),
					"ticketId":   ticketID.String(),
					"senderType": "customer",
					"content":    "第一条",
					"createdAt":  time.Now().UTC().Format(time.RFC3339),
				}},
				"page":     1,
				"pageSize": 100,
				"total":    2,
			})
		case "2":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"items": []map[string]any{{
					"id":         message2.String(),
					"ticketId":   ticketID.String(),
					"senderType": "staff",
					"content":    "第二条",
					"createdAt":  time.Now().UTC().Format(time.RFC3339),
				}},
				"page":     2,
				"pageSize": 100,
				"total":    2,
			})
		default:
			t.Fatalf("unexpected page %q", page)
		}
	}))
	defer server.Close()

	client := NewClient(server.URL, time.Second)
	messages, err := client.ListAfterSalesMessages(context.Background(), "Bearer token-1", ticketID, "req-2")
	if err != nil {
		t.Fatalf("ListAfterSalesMessages() error = %v", err)
	}
	if len(messages) != 2 {
		t.Fatalf("expected 2 messages, got %d", len(messages))
	}
}

func TestListProductsPageBuildsQuery(t *testing.T) {
	productID := uuid.MustParse("11111111-1111-1111-1111-111111111111")

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.URL.Query().Get("page"); got != "2" {
			t.Fatalf("expected page=2, got %q", got)
		}
		if got := r.URL.Query().Get("pageSize"); got != "50" {
			t.Fatalf("expected pageSize=50, got %q", got)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"items": []map[string]any{{
				"id":         productID.String(),
				"name":       "阻燃电缆 3x2.5",
				"categoryId": uuid.Nil.String(),
			}},
			"page":     2,
			"pageSize": 50,
			"total":    1,
		})
	}))
	defer server.Close()

	client := NewClient(server.URL, time.Second)
	response, err := client.ListProductsPage(context.Background(), 2, 50)
	if err != nil {
		t.Fatalf("ListProductsPage() error = %v", err)
	}
	if len(response.Items) != 1 || response.Items[0].ID != productID {
		t.Fatalf("unexpected response %#v", response)
	}
}

func TestGetProductDetailParsesResponse(t *testing.T) {
	productID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	skuID := uuid.MustParse("22222222-2222-2222-2222-222222222222")

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"product": map[string]any{
				"id":          productID.String(),
				"name":        "阻燃电缆 3x2.5",
				"description": "铜芯阻燃电缆",
				"images":      []string{},
				"categoryId":  uuid.Nil.String(),
			},
			"skus": []map[string]any{{
				"id":         skuID.String(),
				"spuId":      productID.String(),
				"name":       "阻燃电缆 3x2.5",
				"spec":       "100m/卷",
				"attributes": map[string]string{"length": "100m"},
				"isActive":   true,
			}},
		})
	}))
	defer server.Close()

	client := NewClient(server.URL, time.Second)
	detail, err := client.GetProductDetail(context.Background(), productID)
	if err != nil {
		t.Fatalf("GetProductDetail() error = %v", err)
	}
	if detail.Product.ID != productID || len(detail.SKUs) != 1 || detail.SKUs[0].ID != skuID {
		t.Fatalf("unexpected detail %#v", detail)
	}
}

func TestRequestErrorIncludesCodeWhenPresent(t *testing.T) {
	err := (&RequestError{StatusCode: 502, Code: "commerce_unavailable"}).Error()
	if !strings.Contains(err, "code=commerce_unavailable") {
		t.Fatalf("expected code in error string, got %q", err)
	}
}

func TestGetJSONReturnsRequestErrorOnNon2xx(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"code":    "forbidden",
			"message": "permission denied",
		})
	}))
	defer server.Close()

	client := NewClient(server.URL, time.Second)
	_, err := client.ListProductsPage(context.Background(), 1, 20)
	var requestErr *RequestError
	if !errors.As(err, &requestErr) {
		t.Fatalf("expected RequestError, got %T", err)
	}
	if requestErr.StatusCode != http.StatusForbidden || requestErr.Code != "forbidden" {
		t.Fatalf("unexpected request error %#v", requestErr)
	}
}

func TestGetJSONFailsWhenBaseURLMissing(t *testing.T) {
	client := NewClient("", time.Second)
	client.baseURL = ""

	_, err := client.ListProductsPage(context.Background(), 1, 20)
	if err == nil || !strings.Contains(err.Error(), "base url missing") {
		t.Fatalf("expected base url missing error, got %v", err)
	}
}
