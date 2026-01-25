package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/teamdsb/tmo/packages/go-shared/httpx"
	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/http/middleware"
	"github.com/teamdsb/tmo/services/commerce/internal/http/oapi"
)

func TestPostOrdersClearsCartItems(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)

	queries := db.New(pool)
	skuA, skuB := seedCatalog(t, queries)

	ctx := context.Background()
	customerID := uuid.Nil
	if _, err := queries.UpsertCartItem(ctx, db.UpsertCartItemParams{
		OwnerUserID: customerID,
		SkuID:       skuA.ID,
		Qty:         2,
	}); err != nil {
		t.Fatalf("seed cart item A: %v", err)
	}
	if _, err := queries.UpsertCartItem(ctx, db.UpsertCartItemParams{
		OwnerUserID: customerID,
		SkuID:       skuB.ID,
		Qty:         1,
	}); err != nil {
		t.Fatalf("seed cart item B: %v", err)
	}

	router := newIntegrationRouter(pool, queries)
	body := fmt.Sprintf(`{"address":{"receiverName":"A","receiverPhone":"1","detail":"X"},"items":[{"skuId":"%s","qty":2}]}`, skuA.ID.String())
	req := httptest.NewRequest(http.MethodPost, "/orders", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d: %s", recorder.Code, recorder.Body.String())
	}

	items, err := queries.ListCartItems(ctx, customerID)
	if err != nil {
		t.Fatalf("list cart items: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 cart item remaining, got %d", len(items))
	}
	if items[0].SkuID != skuB.ID {
		t.Fatalf("expected remaining sku %s, got %s", skuB.ID, items[0].SkuID)
	}
}

func TestPostOrdersIdempotencyConflict(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)

	queries := db.New(pool)
	skuA, _ := seedCatalog(t, queries)

	router := newIntegrationRouter(pool, queries)
	body := fmt.Sprintf(`{"address":{"receiverName":"A","receiverPhone":"1","detail":"X"},"items":[{"skuId":"%s","qty":2}]}`, skuA.ID.String())
	idempotencyKey := "order-dup-001"

	req := httptest.NewRequest(http.MethodPost, "/orders", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotency-Key", idempotencyKey)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d: %s", recorder.Code, recorder.Body.String())
	}

	var created oapi.Order
	if err := json.Unmarshal(recorder.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode order response: %v", err)
	}

	req = httptest.NewRequest(http.MethodPost, "/orders", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotency-Key", idempotencyKey)
	recorder = httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusConflict {
		t.Fatalf("expected status 409, got %d: %s", recorder.Code, recorder.Body.String())
	}

	var errResp struct {
		Details map[string]interface{} `json:"details"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &errResp); err != nil {
		t.Fatalf("decode conflict response: %v", err)
	}
	if errResp.Details == nil {
		t.Fatalf("expected conflict details")
	}
	if got, ok := errResp.Details["orderId"].(string); !ok || got != created.Id.String() {
		t.Fatalf("expected orderId %s, got %#v", created.Id.String(), errResp.Details["orderId"])
	}
}

func TestPostOrdersStoresOwnerSalesUserID(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)

	queries := db.New(pool)
	skuA, _ := seedCatalog(t, queries)

	customerID := uuid.New()
	ownerSalesID := uuid.New()

	router := newAuthIntegrationRouter(pool, queries)
	body := fmt.Sprintf(`{"address":{"receiverName":"A","receiverPhone":"1","detail":"X"},"items":[{"skuId":"%s","qty":2}]}`, skuA.ID.String())
	req := httptest.NewRequest(http.MethodPost, "/orders", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+makeAuthToken(t, customerID, "CUSTOMER", &ownerSalesID))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d: %s", recorder.Code, recorder.Body.String())
	}

	var created oapi.Order
	if err := json.Unmarshal(recorder.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode order response: %v", err)
	}

	fetched, err := queries.GetOrder(context.Background(), uuid.UUID(created.Id))
	if err != nil {
		t.Fatalf("get order: %v", err)
	}
	if !fetched.OwnerSalesUserID.Valid || fetched.OwnerSalesUserID.Bytes != ownerSalesID {
		t.Fatalf("expected owner sales id %s, got %v", ownerSalesID, fetched.OwnerSalesUserID)
	}
}

func TestTrackingUpdateKeepsOrderStatus(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)

	queries := db.New(pool)
	skuA, _ := seedCatalog(t, queries)

	ctx := context.Background()
	address, _ := json.Marshal(oapi.Address{
		ReceiverName:  "A",
		ReceiverPhone: "1",
		Detail:        "X",
	})
	order, err := queries.CreateOrder(ctx, db.CreateOrderParams{
		Status:           string(oapi.OrderStatusSUBMITTED),
		CustomerID:       uuid.Nil,
		OwnerSalesUserID: pgtype.UUID{},
		Address:          address,
		Remark:           nil,
		IdempotencyKey:   nil,
	})
	if err != nil {
		t.Fatalf("create order: %v", err)
	}
	if _, err := queries.CreateOrderItem(ctx, db.CreateOrderItemParams{
		OrderID:      order.ID,
		SkuID:        skuA.ID,
		Qty:          1,
		UnitPriceFen: 12000,
	}); err != nil {
		t.Fatalf("create order item: %v", err)
	}

	router := newIntegrationRouter(pool, queries)
	trackingBody := `{"shipments":[{"waybillNo":"WB-1","carrier":"DHL"}]}`
	req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/orders/%s/tracking", order.ID), bytes.NewBufferString(trackingBody))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", recorder.Code, recorder.Body.String())
	}

	fetched, err := queries.GetOrder(ctx, order.ID)
	if err != nil {
		t.Fatalf("get order: %v", err)
	}
	if fetched.Status != string(oapi.OrderStatusSUBMITTED) {
		t.Fatalf("expected status SUBMITTED, got %s", fetched.Status)
	}
}

func TestGetOrdersSalesFiltersOwned(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)

	queries := db.New(pool)
	skuA, _ := seedCatalog(t, queries)

	customerA := uuid.New()
	customerB := uuid.New()
	salesA := uuid.New()
	salesB := uuid.New()

	orderOwned := seedOrderWithItem(t, queries, customerA, &salesA, skuA.ID)
	seedOrderWithItem(t, queries, customerB, &salesB, skuA.ID)
	seedOrderWithItem(t, queries, customerA, nil, skuA.ID)

	router := newAuthIntegrationRouter(pool, queries)
	req := httptest.NewRequest(http.MethodGet, "/orders", nil)
	req.Header.Set("Authorization", "Bearer "+makeAuthToken(t, salesA, "SALES", nil))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", recorder.Code, recorder.Body.String())
	}

	var list oapi.PagedOrderList
	if err := json.Unmarshal(recorder.Body.Bytes(), &list); err != nil {
		t.Fatalf("decode orders response: %v", err)
	}
	if len(list.Items) != 1 {
		t.Fatalf("expected 1 order, got %d", len(list.Items))
	}
	if list.Items[0].Id != orderOwned.ID {
		t.Fatalf("expected order %s, got %s", orderOwned.ID, list.Items[0].Id)
	}
}

func TestGetOrdersCustomerFiltersSelf(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)

	queries := db.New(pool)
	skuA, _ := seedCatalog(t, queries)

	customerA := uuid.New()
	customerB := uuid.New()

	orderA := seedOrderWithItem(t, queries, customerA, nil, skuA.ID)
	seedOrderWithItem(t, queries, customerB, nil, skuA.ID)

	router := newAuthIntegrationRouter(pool, queries)
	req := httptest.NewRequest(http.MethodGet, "/orders", nil)
	req.Header.Set("Authorization", "Bearer "+makeAuthToken(t, customerA, "CUSTOMER", nil))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", recorder.Code, recorder.Body.String())
	}

	var list oapi.PagedOrderList
	if err := json.Unmarshal(recorder.Body.Bytes(), &list); err != nil {
		t.Fatalf("decode orders response: %v", err)
	}
	if len(list.Items) != 1 {
		t.Fatalf("expected 1 order, got %d", len(list.Items))
	}
	if list.Items[0].Id != orderA.ID {
		t.Fatalf("expected order %s, got %s", orderA.ID, list.Items[0].Id)
	}
}

func TestGetOrdersSalesRequiresOwnership(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)

	queries := db.New(pool)
	skuA, _ := seedCatalog(t, queries)

	customer := uuid.New()
	salesA := uuid.New()
	salesB := uuid.New()

	owned := seedOrderWithItem(t, queries, customer, &salesA, skuA.ID)
	unowned := seedOrderWithItem(t, queries, customer, nil, skuA.ID)

	router := newAuthIntegrationRouter(pool, queries)

	req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/orders/%s", owned.ID), nil)
	req.Header.Set("Authorization", "Bearer "+makeAuthToken(t, salesB, "SALES", nil))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d: %s", recorder.Code, recorder.Body.String())
	}

	req = httptest.NewRequest(http.MethodGet, fmt.Sprintf("/orders/%s", unowned.ID), nil)
	req.Header.Set("Authorization", "Bearer "+makeAuthToken(t, salesA, "SALES", nil))
	recorder = httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d: %s", recorder.Code, recorder.Body.String())
	}

	req = httptest.NewRequest(http.MethodGet, fmt.Sprintf("/orders/%s", owned.ID), nil)
	req.Header.Set("Authorization", "Bearer "+makeAuthToken(t, salesA, "SALES", nil))
	recorder = httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", recorder.Code, recorder.Body.String())
	}
}

func openHandlerTestPool(t *testing.T) *pgxpool.Pool {
	t.Helper()

	dsn := os.Getenv("COMMERCE_DB_DSN")
	if dsn == "" {
		t.Skip("COMMERCE_DB_DSN is not set; skipping integration test")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatalf("connect to database: %v", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		t.Fatalf("ping database: %v", err)
	}

	migrationsDir := filepath.Join("..", "..", "..", "migrations")
	if err := db.ApplyMigrations(ctx, pool, migrationsDir); err != nil {
		pool.Close()
		t.Fatalf("apply migrations: %v", err)
	}

	t.Cleanup(func() {
		pool.Close()
	})

	return pool
}

func resetCommerceTables(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err := pool.Exec(ctx, `
TRUNCATE order_tracking_shipments,
import_jobs,
order_items,
orders,
cart_items,
cart_import_rows,
cart_import_jobs,
catalog_price_tiers,
catalog_skus,
catalog_products,
catalog_categories
RESTART IDENTITY CASCADE`)
	if err != nil {
		t.Fatalf("truncate tables: %v", err)
	}
}

func seedCatalog(t *testing.T, queries *db.Queries) (db.CatalogSku, db.CatalogSku) {
	t.Helper()

	ctx := context.Background()
	category, err := queries.CreateCategory(ctx, db.CreateCategoryParams{
		Name:     "Metals",
		ParentID: pgtype.UUID{},
		Sort:     1,
	})
	if err != nil {
		t.Fatalf("create category: %v", err)
	}

	description := "Schedule 40"
	cover := "https://example.com/steel.jpg"
	product, err := queries.CreateProduct(ctx, db.CreateProductParams{
		Name:             "Steel Pipe",
		Description:      &description,
		CategoryID:       category.ID,
		CoverImageUrl:    &cover,
		Images:           []string{cover},
		Tags:             []string{"steel", "pipe"},
		FilterDimensions: []string{"material", "length"},
	})
	if err != nil {
		t.Fatalf("create product: %v", err)
	}

	skuA, err := queries.CreateSku(ctx, db.CreateSkuParams{
		ProductID:  product.ID,
		SkuCode:    stringPtr("SP-001"),
		Name:       "Steel Pipe 1m",
		Spec:       stringPtr("1m"),
		Attributes: json.RawMessage(`{"length":"1m"}`),
		Unit:       stringPtr("pcs"),
		IsActive:   true,
	})
	if err != nil {
		t.Fatalf("create sku A: %v", err)
	}
	skuB, err := queries.CreateSku(ctx, db.CreateSkuParams{
		ProductID:  product.ID,
		SkuCode:    stringPtr("SP-002"),
		Name:       "Steel Pipe 2m",
		Spec:       stringPtr("2m"),
		Attributes: json.RawMessage(`{"length":"2m"}`),
		Unit:       stringPtr("pcs"),
		IsActive:   true,
	})
	if err != nil {
		t.Fatalf("create sku B: %v", err)
	}

	if _, err := queries.CreatePriceTier(ctx, db.CreatePriceTierParams{
		SkuID:        skuA.ID,
		MinQty:       1,
		MaxQty:       nil,
		UnitPriceFen: 12000,
	}); err != nil {
		t.Fatalf("create price tier A: %v", err)
	}
	if _, err := queries.CreatePriceTier(ctx, db.CreatePriceTierParams{
		SkuID:        skuB.ID,
		MinQty:       1,
		MaxQty:       nil,
		UnitPriceFen: 18000,
	}); err != nil {
		t.Fatalf("create price tier B: %v", err)
	}

	return skuA, skuB
}

func stringPtr(value string) *string {
	return &value
}

func newIntegrationRouter(pool *pgxpool.Pool, store *db.Queries) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := httpx.NewRouter()
	oapi.RegisterHandlers(router, &Handler{
		CatalogStore:  store,
		CartStore:     store,
		OrderStore:    store,
		TrackingStore: store,
		DB:            pool,
	})
	return router
}

func newAuthIntegrationRouter(pool *pgxpool.Pool, store *db.Queries) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := httpx.NewRouter()
	authenticator := middleware.NewAuthenticator(true, testJWTSecret, testJWTIssuer)
	oapi.RegisterHandlers(router, &Handler{
		CatalogStore:  store,
		CartStore:     store,
		OrderStore:    store,
		TrackingStore: store,
		DB:            pool,
		Auth:          authenticator,
	})
	return router
}

func seedOrderWithItem(t *testing.T, queries *db.Queries, customerID uuid.UUID, ownerSalesID *uuid.UUID, skuID uuid.UUID) db.Order {
	t.Helper()

	ctx := context.Background()
	address, _ := json.Marshal(oapi.Address{
		ReceiverName:  "A",
		ReceiverPhone: "1",
		Detail:        "X",
	})

	owner := pgtype.UUID{}
	if ownerSalesID != nil && *ownerSalesID != uuid.Nil {
		owner = pgtype.UUID{Bytes: *ownerSalesID, Valid: true}
	}

	order, err := queries.CreateOrder(ctx, db.CreateOrderParams{
		Status:           string(oapi.OrderStatusSUBMITTED),
		CustomerID:       customerID,
		OwnerSalesUserID: owner,
		Address:          address,
		Remark:           nil,
		IdempotencyKey:   nil,
	})
	if err != nil {
		t.Fatalf("create order: %v", err)
	}
	if _, err := queries.CreateOrderItem(ctx, db.CreateOrderItemParams{
		OrderID:      order.ID,
		SkuID:        skuID,
		Qty:          1,
		UnitPriceFen: 12000,
	}); err != nil {
		t.Fatalf("create order item: %v", err)
	}
	return order
}

const (
	testJWTSecret = "test-secret"
	testJWTIssuer = "test-issuer"
)

func makeAuthToken(t *testing.T, userID uuid.UUID, role string, ownerSalesUserID *uuid.UUID) string {
	t.Helper()

	claims := jwt.MapClaims{
		"sub":  userID.String(),
		"role": role,
		"iss":  testJWTIssuer,
	}
	if ownerSalesUserID != nil && *ownerSalesUserID != uuid.Nil {
		claims["ownerSalesUserId"] = ownerSalesUserID.String()
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(testJWTSecret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return signed
}
