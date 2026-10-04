package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/http/oapi"
)

func TestPostOrdersRejectsUnavailableCatalogWithoutConsumingCart(t *testing.T) {
	for _, scenario := range []struct {
		name string
		sql  string
	}{
		{"inactive product", "UPDATE catalog_products SET status = 'INACTIVE' WHERE id = $1"},
		{"draft product", "UPDATE catalog_products SET status = 'DRAFT' WHERE id = $1"},
		{"incomplete specification", "UPDATE catalog_skus SET attributes = '{\"length\":\"1m\"}' WHERE product_id = $1"},
		{"inactive SKU", "UPDATE catalog_skus SET is_active = false WHERE product_id = $1"},
		{"missing SKU name", "UPDATE catalog_skus SET name = '' WHERE product_id = $1"},
	} {
		t.Run(scenario.name, func(t *testing.T) {
			pool := openHandlerTestPool(t)
			resetCommerceTables(t, pool)
			queries := db.New(pool)
			sku, _ := seedCatalog(t, queries)
			customer := uuid.New()
			cart, err := queries.UpsertCartItem(context.Background(), db.UpsertCartItemParams{OwnerUserID: customer, SkuID: sku.ID, Qty: 2})
			if err != nil {
				t.Fatal(err)
			}
			if _, err := pool.Exec(context.Background(), scenario.sql, sku.ProductID); err != nil {
				t.Fatal(err)
			}
			response := submitSnapshotTestOrder(t, newAuthIntegrationRouter(pool, queries), customer, cart)
			if response.Code != http.StatusBadRequest {
				t.Fatalf("unavailable catalog must reject checkout, got %d: %s", response.Code, response.Body.String())
			}
			assertSnapshotTestCartUnchanged(t, queries, customer, cart)
			var count int
			if err := pool.QueryRow(context.Background(), "SELECT count(*) FROM orders WHERE customer_id = $1", customer).Scan(&count); err != nil || count != 0 {
				t.Fatalf("rejected checkout left orders: count=%d err=%v", count, err)
			}
		})
	}
}

func TestPostOrdersWaitsForConcurrentProductUnpublish(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)
	queries := db.New(pool)
	sku, _ := seedCatalog(t, queries)
	customer := uuid.New()
	cart, err := queries.UpsertCartItem(context.Background(), db.UpsertCartItemParams{OwnerUserID: customer, SkuID: sku.ID, Qty: 2})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	edit, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = edit.Rollback(context.Background()) }()
	if _, err := db.New(edit).GetProductForUpdate(ctx, sku.ProductID); err != nil {
		t.Fatal(err)
	}
	if _, err := edit.Exec(ctx, "UPDATE catalog_products SET status = 'INACTIVE' WHERE id = $1", sku.ProductID); err != nil {
		t.Fatal(err)
	}
	config := pool.Config().Copy()
	config.ConnConfig.RuntimeParams["application_name"] = "tmo-checkout-concurrency-test"
	checkoutPool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	defer checkoutPool.Close()
	router := newAuthIntegrationRouter(checkoutPool, db.New(checkoutPool))
	request := snapshotTestOrderRequest(t, customer, cart).WithContext(ctx)
	result := make(chan *httptest.ResponseRecorder, 1)
	go func() {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
		result <- response
	}()
	// Wait for the transaction to reach a database lock, without using a
	// fixed sleep to guess whether checkout has read the catalog yet.
	ticker := time.NewTicker(10 * time.Millisecond)
	defer ticker.Stop()
waiting:
	for {
		select {
		case response := <-result:
			t.Fatalf("checkout ignored the in-flight catalog change: %d %s", response.Code, response.Body.String())
		case <-ctx.Done():
			t.Fatal("checkout never waited for the catalog transaction")
		case <-ticker.C:
			var blocked bool
			if err := pool.QueryRow(ctx, "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name = 'tmo-checkout-concurrency-test' AND wait_event_type = 'Lock')").Scan(&blocked); err != nil {
				t.Fatal(err)
			}
			if blocked {
				break waiting
			}
		}
	}
	if err := edit.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	select {
	case response := <-result:
		if response.Code != http.StatusBadRequest {
			t.Fatalf("checkout must re-read the committed unpublish: %d %s", response.Code, response.Body.String())
		}
	case <-ctx.Done():
		t.Fatal("checkout did not resume after catalog commit")
	}
	assertSnapshotTestCartUnchanged(t, queries, customer, cart)
}

func TestOrderItemSnapshotSurvivesCatalogEdits(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)
	queries := db.New(pool)
	sku, _ := seedCatalog(t, queries)
	customer := uuid.New()
	cart, err := queries.UpsertCartItem(context.Background(), db.UpsertCartItemParams{OwnerUserID: customer, SkuID: sku.ID, Qty: 2})
	if err != nil {
		t.Fatal(err)
	}
	router := newAuthIntegrationRouter(pool, queries)
	response := submitSnapshotTestOrder(t, router, customer, cart)
	if response.Code != http.StatusCreated {
		t.Fatalf("checkout: %d %s", response.Code, response.Body.String())
	}
	var created oapi.Order
	if err := json.Unmarshal(response.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(context.Background(), "UPDATE catalog_skus SET name = 'Changed name', spec = 'Changed spec', unit = 'boxes', attributes = '{\"material\":\"copper\",\"length\":\"5m\"}', is_active = false WHERE id = $1", sku.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(context.Background(), "UPDATE catalog_price_tiers SET unit_price_fen = 99999 WHERE sku_id = $1", sku.ID); err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{"/orders/" + created.Id.String(), "/orders"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.Header.Set("Authorization", "Bearer "+makeAuthToken(t, customer, "CUSTOMER", nil))
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("%s: %d %s", path, rec.Code, rec.Body.String())
		}
		var fetched oapi.Order
		if path == "/orders" {
			var list oapi.PagedOrderList
			if err := json.Unmarshal(rec.Body.Bytes(), &list); err != nil || len(list.Items) != 1 {
				t.Fatalf("decode order list: %v %s", err, rec.Body.String())
			}
			fetched = list.Items[0]
		} else if err := json.Unmarshal(rec.Body.Bytes(), &fetched); err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(created.Items, fetched.Items) {
			t.Errorf("%s changed purchase details after catalog edit: purchased=%#v fetched=%#v", path, created.Items, fetched.Items)
		}
	}
	// Fulfillment, payment sync and support summaries must also work without
	// a live catalog dependency once the purchase snapshot exists.
	h := &Handler{OrderStore: queries, InquiryStore: queries, AfterSalesStore: queries, DB: pool, InternalSyncToken: "snapshot-sync"}
	stored, err := queries.GetOrder(context.Background(), created.Id)
	if err != nil {
		t.Fatal(err)
	}
	fulfilled, err := h.orderResponse(context.Background(), stored)
	if err != nil || !reflect.DeepEqual(created.Items, fulfilled.Items) {
		t.Fatalf("fulfillment response changed purchase details: %#v err=%v", fulfilled.Items, err)
	}
	conversation, err := h.buildSupportConversationContext(context.Background(), db.SupportConversation{CustomerUserID: customer})
	if err != nil || len(conversation.RecentOrders) != 1 || conversation.RecentOrders[0].FirstItem == nil || *conversation.RecentOrders[0].FirstItem != sku.Name {
		t.Fatalf("support summary changed purchase details: %#v err=%v", conversation.RecentOrders, err)
	}
	syncRouter := gin.New()
	syncRouter.POST("/internal/orders/:orderId/payment-status", h.PostInternalOrdersOrderIdPaymentStatus)
	syncRequest := httptest.NewRequest(http.MethodPost, "/internal/orders/"+created.Id.String()+"/payment-status", strings.NewReader(fmt.Sprintf(`{"paymentId":"%s","channel":"WECHAT_B2B","status":"PAID"}`, uuid.New())))
	syncRequest.Header.Set("Content-Type", "application/json")
	syncRequest.Header.Set("X-Internal-Token", "snapshot-sync")
	synced := httptest.NewRecorder()
	syncRouter.ServeHTTP(synced, syncRequest)
	var syncedOrder oapi.Order
	if err := json.Unmarshal(synced.Body.Bytes(), &syncedOrder); err != nil || synced.Code != http.StatusOK || !reflect.DeepEqual(created.Items, syncedOrder.Items) {
		t.Fatalf("payment sync response changed purchase details: %d %s err=%v", synced.Code, synced.Body.String(), err)
	}
	later := seedOrderWithItem(t, queries, customer, nil, sku.ID)
	listRequest := httptest.NewRequest(http.MethodGet, "/orders", nil)
	listRequest.Header.Set("Authorization", "Bearer "+makeAuthToken(t, customer, "CUSTOMER", nil))
	listResponse := httptest.NewRecorder()
	router.ServeHTTP(listResponse, listRequest)
	var versions oapi.PagedOrderList
	if err := json.Unmarshal(listResponse.Body.Bytes(), &versions); err != nil || listResponse.Code != http.StatusOK || len(versions.Items) != 2 {
		t.Fatalf("load two purchases of the same SKU: %d %s err=%v", listResponse.Code, listResponse.Body.String(), err)
	}
	for _, version := range versions.Items {
		expected := sku.Name
		if version.Id == later.ID {
			expected = "Changed name"
		}
		if len(version.Items) != 1 || version.Items[0].Sku.Name != expected {
			t.Fatalf("same-SKU purchase snapshots were mixed: order=%s expected=%q got=%#v", version.Id, expected, version.Items)
		}
	}
}

func TestOrderSnapshotMigrationBackfillsOnlyMissingSnapshots(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)
	queries := db.New(pool)
	sku, _ := seedCatalog(t, queries)
	legacy := seedOrderWithItem(t, queries, uuid.New(), nil, sku.ID)
	existing := seedOrderWithItem(t, queries, uuid.New(), nil, sku.ID)
	ctx := context.Background()
	migrations := filepath.Join("..", "..", "..", "migrations")
	// Reproduce an older row with no snapshot while retaining a newer row's
	// snapshot; the actual migration must fill only the missing value.
	if _, err := pool.Exec(ctx, "ALTER TABLE order_items ALTER COLUMN sku_snapshot DROP NOT NULL"); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := db.ApplyMigrations(context.Background(), pool, migrations); err != nil {
			t.Errorf("restore snapshot constraint: %v", err)
		}
	})
	if _, err := pool.Exec(ctx, "UPDATE order_items SET sku_snapshot = NULL WHERE order_id = $1", legacy.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, "UPDATE catalog_skus SET name = 'Name available at migration' WHERE id = $1", sku.ID); err != nil {
		t.Fatal(err)
	}
	if err := db.ApplyMigrations(ctx, pool, migrations); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, "UPDATE catalog_skus SET name = 'Later edit' WHERE id = $1", sku.ID); err != nil {
		t.Fatal(err)
	}
	if err := db.ApplyMigrations(ctx, pool, migrations); err != nil {
		t.Fatal(err)
	}
	for orderID, expected := range map[uuid.UUID]string{legacy.ID: "Name available at migration", existing.ID: sku.Name} {
		items, err := queries.ListOrderItems(ctx, orderID)
		if err != nil {
			t.Fatal(err)
		}
		mapped, err := mapOrderItems(items)
		if err != nil || len(mapped) != 1 || mapped[0].Sku.Name != expected {
			t.Fatalf("migration replaced preserved snapshot: expected=%q mapped=%#v err=%v", expected, mapped, err)
		}
	}
	// The old SQL shape must remain insertable during rolling deployment.
	var legacyInsertSnapshot json.RawMessage
	if err := pool.QueryRow(ctx, `INSERT INTO order_items (order_id, sku_id, qty, unit_price_fen)
VALUES ($1, $2, 1, 12000) RETURNING sku_snapshot`, legacy.ID, sku.ID).Scan(&legacyInsertSnapshot); err != nil {
		t.Fatalf("old application insert cannot save a snapshot: %v", err)
	}
	var inserted oapi.SKU
	if err := json.Unmarshal(legacyInsertSnapshot, &inserted); err != nil || inserted.Id != sku.ID || inserted.Name != "Later edit" {
		t.Fatalf("old application insert snapshot is invalid: %s err=%v", legacyInsertSnapshot, err)
	}
}

func TestOrderSnapshotsPreserveLegacyBlankNames(t *testing.T) {
	skuID := uuid.New()
	productID := uuid.New()
	raw, err := json.Marshal(oapi.SKU{Id: skuID, SpuId: productID, Name: "", IsActive: false})
	if err != nil {
		t.Fatal(err)
	}
	items, err := mapOrderItems([]db.OrderItem{{SkuID: skuID, SkuSnapshot: raw, Qty: 1, UnitPriceFen: 100}})
	if err != nil || len(items) != 1 || items[0].Sku.Name != "" {
		t.Fatalf("legacy blank name must remain readable without inventing history: %#v err=%v", items, err)
	}
}

func snapshotTestOrderRequest(t *testing.T, customer uuid.UUID, cart db.CartItem) *http.Request {
	t.Helper()
	body := fmt.Sprintf(`{"address":{"receiverName":"A","receiverPhone":"1","detail":"X"},"paymentMethod":"OFFLINE","items":[{"cartItemId":"%s","skuId":"%s","qty":2}]}`, cart.ID, cart.SkuID)
	req := httptest.NewRequest(http.MethodPost, "/orders", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+makeAuthToken(t, customer, "CUSTOMER", nil))
	return req
}

func submitSnapshotTestOrder(t *testing.T, router http.Handler, customer uuid.UUID, cart db.CartItem) *httptest.ResponseRecorder {
	t.Helper()
	response := httptest.NewRecorder()
	router.ServeHTTP(response, snapshotTestOrderRequest(t, customer, cart))
	return response
}

func assertSnapshotTestCartUnchanged(t *testing.T, queries *db.Queries, customer uuid.UUID, cart db.CartItem) {
	t.Helper()
	items, err := queries.ListCartItems(context.Background(), customer)
	if err != nil || len(items) != 1 || items[0].ID != cart.ID || items[0].Qty != cart.Qty {
		t.Fatalf("rejected checkout changed cart: %#v err=%v", items, err)
	}
}
