package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
)

func TestPaymentSyncIgnoresOldVersionAfterNewVersionCompletes(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)
	queries := db.New(pool)
	sku, _ := seedCatalog(t, queries)
	order := seedOrderWithItem(t, queries, uuid.New(), nil, sku.ID)
	router := paymentOrderingRouter(pool, queries)
	paymentID := uuid.New()
	created := time.Now().UTC().Truncate(time.Microsecond)
	postOrderedPayment(t, router, order.ID, paymentID, "PAY_FAILED", &created, 2)
	postOrderedPayment(t, router, order.ID, paymentID, "PAY_PENDING", &created, 1)
	stored, err := queries.GetOrder(context.Background(), order.ID)
	if err != nil || stored.PaymentStatus != "PAY_FAILED" || stored.PaymentSyncStateVersion != 2 || !stored.PaymentSyncCreatedAt.Time.Equal(created) {
		t.Fatalf("late old sync overwrote the already-acknowledged new state: %#v err=%v", stored, err)
	}
	if err := db.ApplyMigrations(context.Background(), pool, filepath.Join("..", "..", "..", "migrations")); err != nil {
		t.Fatal(err)
	}
	reloaded, err := queries.GetOrder(context.Background(), order.ID)
	if err != nil || reloaded.PaymentSyncStateVersion != 2 || !reloaded.PaymentSyncCreatedAt.Time.Equal(created) {
		t.Fatalf("migration replay lost watermark: %#v %v", reloaded, err)
	}
}

func TestPaymentSyncRejectsIncompleteOrInconsistentOrderingMetadata(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)
	queries := db.New(pool)
	sku, _ := seedCatalog(t, queries)
	order := seedOrderWithItem(t, queries, uuid.New(), nil, sku.ID)
	router := paymentOrderingRouter(pool, queries)
	paymentID := uuid.New()
	created := time.Now().UTC().Truncate(time.Microsecond)
	postOrderedPayment(t, router, order.ID, paymentID, "PAY_FAILED", &created, 2)
	for _, metadata := range []map[string]any{
		{"stateVersion": 3},
		{"paymentCreatedAt": created},
		{"paymentCreatedAt": created, "stateVersion": 0},
		{"paymentCreatedAt": created.Add(time.Hour), "stateVersion": 3},
	} {
		metadata["paymentId"] = paymentID
		metadata["channel"] = "WECHAT_B2B"
		metadata["status"] = "PAY_PENDING"
		raw, err := json.Marshal(metadata)
		if err != nil {
			t.Fatal(err)
		}
		req := httptest.NewRequest(http.MethodPost, "/internal/orders/"+order.ID.String()+"/payment-status", bytes.NewReader(raw))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Internal-Token", "ordering-sync")
		response := httptest.NewRecorder()
		router.ServeHTTP(response, req)
		if response.Code != http.StatusBadRequest {
			t.Fatalf("invalid ordering metadata accepted: %d %s", response.Code, response.Body.String())
		}
	}
	stored, err := queries.GetOrder(context.Background(), order.ID)
	if err != nil || stored.PaymentStatus != "PAY_FAILED" || stored.PaymentSyncStateVersion != 2 || !stored.PaymentSyncCreatedAt.Time.Equal(created) {
		t.Fatalf("invalid metadata changed watermark: %#v %v", stored, err)
	}
}

func TestPaymentSyncOrdersAttemptsBeforeVersionsAndBreaksTimeTies(t *testing.T) {
	for _, sameTime := range []bool{false, true} {
		t.Run(map[bool]string{false: "creation time", true: "payment ID tie break"}[sameTime], func(t *testing.T) {
			pool := openHandlerTestPool(t)
			resetCommerceTables(t, pool)
			queries := db.New(pool)
			sku, _ := seedCatalog(t, queries)
			order := seedOrderWithItem(t, queries, uuid.New(), nil, sku.ID)
			router := paymentOrderingRouter(pool, queries)
			olderID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
			newerID := uuid.MustParse("ffffffff-ffff-ffff-ffff-ffffffffffff")
			newerTime := time.Now().UTC().Truncate(time.Microsecond)
			olderTime := newerTime.Add(-time.Minute)
			if sameTime {
				olderTime = newerTime
			}
			postOrderedPayment(t, router, order.ID, newerID, "PAY_FAILED", &newerTime, 1)
			postOrderedPayment(t, router, order.ID, olderID, "PAY_PENDING", &olderTime, 100)
			stored, err := queries.GetOrder(context.Background(), order.ID)
			if err != nil || stored.PaymentStatus != "PAY_FAILED" || uuid.UUID(stored.LatestPaymentID.Bytes) != newerID {
				t.Fatalf("old attempt superseded a newer attempt: %#v err=%v", stored, err)
			}
		})
	}
}

func TestPaymentSyncRollingCompatibilityAndLatePaidPriority(t *testing.T) {
	for _, legacyPaid := range []bool{false, true} {
		t.Run(map[bool]string{false: "versioned paid", true: "legacy paid"}[legacyPaid], func(t *testing.T) {
			pool := openHandlerTestPool(t)
			resetCommerceTables(t, pool)
			queries := db.New(pool)
			sku, _ := seedCatalog(t, queries)
			order := seedOrderWithItem(t, queries, uuid.New(), nil, sku.ID)
			router := paymentOrderingRouter(pool, queries)
			olderID, newerID := uuid.New(), uuid.New()
			newerTime := time.Now().UTC().Truncate(time.Microsecond)
			olderTime := newerTime.Add(-time.Minute)
			postOrderedPayment(t, router, order.ID, olderID, "PAY_PENDING", nil, 0)
			postOrderedPayment(t, router, order.ID, newerID, "PAY_FAILED", &newerTime, 2)
			postOrderedPayment(t, router, order.ID, olderID, "PAY_PENDING", nil, 0)
			beforePaid, err := queries.GetOrder(context.Background(), order.ID)
			if err != nil || beforePaid.PaymentStatus != "PAY_FAILED" || uuid.UUID(beforePaid.LatestPaymentID.Bytes) != newerID {
				t.Fatalf("legacy nonpaid erased a versioned state: %#v %v", beforePaid, err)
			}
			if legacyPaid {
				postOrderedPayment(t, router, order.ID, olderID, "PAID", nil, 0)
			} else {
				postOrderedPayment(t, router, order.ID, olderID, "PAID", &olderTime, 1)
			}
			paid, err := queries.GetOrder(context.Background(), order.ID)
			if err != nil || paid.PaymentStatus != "PAID" || uuid.UUID(paid.LatestPaymentID.Bytes) != olderID {
				t.Fatalf("late authoritative paid was lost: %#v %v", paid, err)
			}
			postOrderedPayment(t, router, order.ID, newerID, "PAY_PENDING", &newerTime, 3)
			postOrderedPayment(t, router, order.ID, newerID, "PAID", &newerTime, 4)
			unchanged, err := queries.GetOrder(context.Background(), order.ID)
			if err != nil || unchanged.PaymentStatus != "PAID" || uuid.UUID(unchanged.LatestPaymentID.Bytes) != olderID || !unchanged.PaidAt.Time.Equal(paid.PaidAt.Time) {
				t.Fatalf("paid winner drifted after late retries: %#v %v", unchanged, err)
			}
		})
	}
}

func paymentOrderingRouter(pool *pgxpool.Pool, queries *db.Queries) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	h := &Handler{DB: pool, OrderStore: queries, InternalSyncToken: "ordering-sync"}
	router.POST("/internal/orders/:orderId/payment-status", h.PostInternalOrdersOrderIdPaymentStatus)
	return router
}

func postOrderedPayment(t *testing.T, router http.Handler, orderID, paymentID uuid.UUID, status string, createdAt *time.Time, version int64) {
	t.Helper()
	body := map[string]any{"paymentId": paymentID, "channel": "WECHAT_B2B", "status": status}
	if createdAt != nil {
		body["paymentCreatedAt"] = createdAt
		body["stateVersion"] = version
	}
	if status == "PAID" {
		body["paidAt"] = time.Now().UTC()
	}
	raw, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPost, "/internal/orders/"+orderID.String()+"/payment-status", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Token", "ordering-sync")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, req)
	if response.Code != http.StatusOK {
		t.Fatalf("sync %s v%d: %d %s", status, version, response.Code, response.Body.String())
	}
}
