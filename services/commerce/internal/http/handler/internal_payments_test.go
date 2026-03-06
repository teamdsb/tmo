package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/http/oapi"
)

func TestPostInternalOrdersOrderIdPaymentStatusMapsStatuses(t *testing.T) {
	gin.SetMode(gin.TestMode)

	orderID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	paymentID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	skuID := uuid.MustParse("33333333-3333-3333-3333-333333333333")
	productID := uuid.MustParse("44444444-4444-4444-4444-444444444444")
	now := time.Date(2026, 3, 6, 8, 0, 0, 0, time.UTC)

	cases := []struct {
		name                string
		inputStatus         string
		expectedOrderStatus string
		expectedPaidAt      bool
	}{
		{name: "pay pending", inputStatus: "PAY_PENDING", expectedOrderStatus: "PAY_PENDING"},
		{name: "paid", inputStatus: "PAID", expectedOrderStatus: "PAID", expectedPaidAt: true},
		{name: "pay failed", inputStatus: "PAY_FAILED", expectedOrderStatus: "PAY_FAILED"},
		{name: "cancelled", inputStatus: "CANCELLED", expectedOrderStatus: "PAY_FAILED"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			orderStore := &internalPaymentOrderStoreStub{
				updateFn: func(_ context.Context, arg db.UpdateOrderPaymentSummaryParams) (db.Order, error) {
					return db.Order{
						ID:              orderID,
						Status:          arg.Status,
						CustomerID:      uuid.MustParse("55555555-5555-5555-5555-555555555555"),
						PaymentStatus:   arg.PaymentStatus,
						LatestPaymentID: arg.LatestPaymentID,
						PaymentChannel:  arg.PaymentChannel,
						PaidAt:          arg.PaidAt,
						CreatedAt:       pgtype.Timestamptz{Time: now, Valid: true},
						UpdatedAt:       pgtype.Timestamptz{Time: now, Valid: true},
					}, nil
				},
				listItemsFn: func(context.Context, uuid.UUID) ([]db.OrderItem, error) {
					return []db.OrderItem{
						{
							ID:           uuid.MustParse("66666666-6666-6666-6666-666666666666"),
							OrderID:      orderID,
							SkuID:        skuID,
							Qty:          2,
							UnitPriceFen: 1888,
							CreatedAt:    pgtype.Timestamptz{Time: now, Valid: true},
							UpdatedAt:    pgtype.Timestamptz{Time: now, Valid: true},
						},
					}, nil
				},
			}
			catalogStore := &stubStore{
				listSkusByIDsFn: func(context.Context, []uuid.UUID) ([]db.CatalogSku, error) {
					unit := "pcs"
					return []db.CatalogSku{
						{
							ID:        skuID,
							ProductID: productID,
							Name:      "Test SKU",
							Unit:      &unit,
							IsActive:  true,
							CreatedAt: pgtype.Timestamptz{Time: now, Valid: true},
							UpdatedAt: pgtype.Timestamptz{Time: now, Valid: true},
						},
					}, nil
				},
				listPriceTiersBySkusFn: func(context.Context, []uuid.UUID) ([]db.CatalogPriceTier, error) {
					return nil, nil
				},
			}

			handler := &Handler{
				OrderStore:        orderStore,
				CatalogStore:      catalogStore,
				InternalSyncToken: "sync-token",
			}
			router := gin.New()
			router.POST("/internal/orders/:orderId/payment-status", handler.PostInternalOrdersOrderIdPaymentStatus)

			payload := map[string]any{
				"paymentId": paymentID.String(),
				"channel":   "WECHAT",
				"status":    tc.inputStatus,
			}
			if tc.expectedPaidAt {
				payload["paidAt"] = now.Format(time.RFC3339)
			}

			body, err := json.Marshal(payload)
			if err != nil {
				t.Fatalf("marshal payload: %v", err)
			}

			req := httptest.NewRequest(http.MethodPost, "/internal/orders/"+orderID.String()+"/payment-status", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("X-Internal-Token", "sync-token")
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)

			if rec.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
			}
			if orderStore.lastUpdate.ID != orderID {
				t.Fatalf("expected order id %s, got %s", orderID, orderStore.lastUpdate.ID)
			}
			if orderStore.lastUpdate.Status != tc.expectedOrderStatus {
				t.Fatalf("expected order status %s, got %s", tc.expectedOrderStatus, orderStore.lastUpdate.Status)
			}
			if orderStore.lastUpdate.PaymentStatus != tc.inputStatus {
				t.Fatalf("expected payment status %s, got %s", tc.inputStatus, orderStore.lastUpdate.PaymentStatus)
			}
			if orderStore.lastUpdate.PaymentChannel == nil || *orderStore.lastUpdate.PaymentChannel != "WECHAT" {
				t.Fatalf("expected payment channel WECHAT, got %#v", orderStore.lastUpdate.PaymentChannel)
			}
			if tc.expectedPaidAt != orderStore.lastUpdate.PaidAt.Valid {
				t.Fatalf("unexpected paidAt valid state: %+v", orderStore.lastUpdate.PaidAt)
			}

			var response oapi.Order
			if err := json.NewDecoder(rec.Body).Decode(&response); err != nil {
				t.Fatalf("decode response: %v", err)
			}
			if string(response.Status) != tc.expectedOrderStatus {
				t.Fatalf("expected response status %s, got %s", tc.expectedOrderStatus, response.Status)
			}
			if string(response.PaymentStatus) != tc.inputStatus {
				t.Fatalf("expected response payment status %s, got %s", tc.inputStatus, response.PaymentStatus)
			}
			if response.LatestPaymentId == nil || uuid.UUID(*response.LatestPaymentId) != paymentID {
				t.Fatalf("expected latest payment id %s, got %#v", paymentID, response.LatestPaymentId)
			}
		})
	}
}

func TestPostInternalOrdersOrderIdPaymentStatusRejectsUnauthorizedRequests(t *testing.T) {
	gin.SetMode(gin.TestMode)

	orderID := uuid.New()
	payload := `{"paymentId":"` + uuid.NewString() + `","status":"PAID"}`
	router := gin.New()
	router.POST("/internal/orders/:orderId/payment-status", (&Handler{
		OrderStore:        &internalPaymentOrderStoreStub{},
		CatalogStore:      &stubStore{},
		InternalSyncToken: "sync-token",
	}).PostInternalOrdersOrderIdPaymentStatus)

	for _, tc := range []struct {
		name  string
		token string
	}{
		{name: "missing token"},
		{name: "bad token", token: "wrong-token"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/internal/orders/"+orderID.String()+"/payment-status", bytes.NewBufferString(payload))
			req.Header.Set("Content-Type", "application/json")
			if tc.token != "" {
				req.Header.Set("X-Internal-Token", tc.token)
			}
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)
			if rec.Code != http.StatusUnauthorized {
				t.Fatalf("expected 401, got %d: %s", rec.Code, rec.Body.String())
			}
		})
	}
}

func TestPostInternalOrdersOrderIdPaymentStatusRejectsInvalidIdentifiers(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.POST("/internal/orders/:orderId/payment-status", (&Handler{
		OrderStore:        &internalPaymentOrderStoreStub{},
		CatalogStore:      &stubStore{},
		InternalSyncToken: "sync-token",
	}).PostInternalOrdersOrderIdPaymentStatus)

	cases := []struct {
		name    string
		orderID string
		body    string
	}{
		{
			name:    "invalid order id",
			orderID: "bad-order-id",
			body:    `{"paymentId":"` + uuid.NewString() + `","status":"PAID"}`,
		},
		{
			name:    "invalid payment id",
			orderID: uuid.NewString(),
			body:    `{"paymentId":"bad-payment-id","status":"PAID"}`,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/internal/orders/"+tc.orderID+"/payment-status", bytes.NewBufferString(tc.body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("X-Internal-Token", "sync-token")
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
			}
		})
	}
}

type internalPaymentOrderStoreStub struct {
	updateFn    func(context.Context, db.UpdateOrderPaymentSummaryParams) (db.Order, error)
	listItemsFn func(context.Context, uuid.UUID) ([]db.OrderItem, error)
	lastUpdate  db.UpdateOrderPaymentSummaryParams
}

func (s *internalPaymentOrderStoreStub) CreateOrder(context.Context, db.CreateOrderParams) (db.Order, error) {
	return db.Order{}, pgx.ErrTxClosed
}

func (s *internalPaymentOrderStoreStub) CreateOrderItem(context.Context, db.CreateOrderItemParams) (db.OrderItem, error) {
	return db.OrderItem{}, pgx.ErrTxClosed
}

func (s *internalPaymentOrderStoreStub) ListOrders(context.Context, db.ListOrdersParams) ([]db.Order, error) {
	return nil, pgx.ErrTxClosed
}

func (s *internalPaymentOrderStoreStub) CountOrders(context.Context, db.CountOrdersParams) (int64, error) {
	return 0, pgx.ErrTxClosed
}

func (s *internalPaymentOrderStoreStub) ListOrderStatusStats(context.Context, db.ListOrderStatusStatsParams) ([]db.ListOrderStatusStatsRow, error) {
	return nil, pgx.ErrTxClosed
}

func (s *internalPaymentOrderStoreStub) GetOrder(context.Context, uuid.UUID) (db.Order, error) {
	return db.Order{}, pgx.ErrTxClosed
}

func (s *internalPaymentOrderStoreStub) ListOrderItems(ctx context.Context, orderID uuid.UUID) ([]db.OrderItem, error) {
	if s.listItemsFn == nil {
		return nil, pgx.ErrTxClosed
	}
	return s.listItemsFn(ctx, orderID)
}

func (s *internalPaymentOrderStoreStub) GetOrderByIdempotencyKey(context.Context, db.GetOrderByIdempotencyKeyParams) (db.Order, error) {
	return db.Order{}, pgx.ErrTxClosed
}

func (s *internalPaymentOrderStoreStub) UpdateOrderPaymentSummary(ctx context.Context, arg db.UpdateOrderPaymentSummaryParams) (db.Order, error) {
	s.lastUpdate = arg
	if s.updateFn == nil {
		return db.Order{}, pgx.ErrTxClosed
	}
	return s.updateFn(ctx, arg)
}
