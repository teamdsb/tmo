package handler

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
)

func TestPatchCartItemReplacesSkuAtomically(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)
	queries := db.New(pool)
	sourceSKU, targetSKU := seedCatalog(t, queries)
	ownerID := uuid.New()

	sourceItem, err := queries.UpsertCartItem(context.Background(), db.UpsertCartItemParams{
		OwnerUserID: ownerID,
		SkuID:       sourceSKU.ID,
		Qty:         7,
	})
	if err != nil {
		t.Fatalf("seed source cart item: %v", err)
	}

	response := patchCartItem(t, newAuthIntegrationRouter(pool, queries), ownerID, sourceItem.ID, targetSKU.ID, 2)
	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", response.Code, response.Body.String())
	}

	items, err := queries.ListCartItems(context.Background(), ownerID)
	if err != nil {
		t.Fatalf("list cart items: %v", err)
	}
	if len(items) != 1 || items[0].SkuID != targetSKU.ID || items[0].Qty != 2 {
		t.Fatalf("expected one target SKU row with requested qty 2, got %#v", items)
	}
}

func TestPatchCartItemQuantityOnlyKeepsExistingSku(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)
	queries := db.New(pool)
	sourceSKU, _ := seedCatalog(t, queries)
	ownerID := uuid.New()

	sourceItem, err := queries.UpsertCartItem(context.Background(), db.UpsertCartItemParams{
		OwnerUserID: ownerID,
		SkuID:       sourceSKU.ID,
		Qty:         7,
	})
	if err != nil {
		t.Fatalf("seed source cart item: %v", err)
	}

	body := `{"qty":4}`
	req := httptest.NewRequest(http.MethodPatch, "/cart/items/"+sourceItem.ID.String(), strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+makeAuthToken(t, ownerID, "CUSTOMER", nil))
	response := httptest.NewRecorder()
	newAuthIntegrationRouter(pool, queries).ServeHTTP(response, req)
	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", response.Code, response.Body.String())
	}

	items, err := queries.ListCartItems(context.Background(), ownerID)
	if err != nil {
		t.Fatalf("list cart items: %v", err)
	}
	if len(items) != 1 || items[0].ID != sourceItem.ID || items[0].SkuID != sourceSKU.ID || items[0].Qty != 4 {
		t.Fatalf("expected qty-only PATCH to keep source row and SKU with qty 4, got %#v", items)
	}
}

func TestPatchCartItemReplacementMergesExistingTargetUsingRequestedQty(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)
	queries := db.New(pool)
	sourceSKU, targetSKU := seedCatalog(t, queries)
	ownerID := uuid.New()

	sourceItem, err := queries.UpsertCartItem(context.Background(), db.UpsertCartItemParams{
		OwnerUserID: ownerID,
		SkuID:       sourceSKU.ID,
		Qty:         7,
	})
	if err != nil {
		t.Fatalf("seed source cart item: %v", err)
	}
	if _, err := queries.UpsertCartItem(context.Background(), db.UpsertCartItemParams{
		OwnerUserID: ownerID,
		SkuID:       targetSKU.ID,
		Qty:         11,
	}); err != nil {
		t.Fatalf("seed target cart item: %v", err)
	}

	response := patchCartItem(t, newAuthIntegrationRouter(pool, queries), ownerID, sourceItem.ID, targetSKU.ID, 3)
	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", response.Code, response.Body.String())
	}

	items, err := queries.ListCartItems(context.Background(), ownerID)
	if err != nil {
		t.Fatalf("list cart items: %v", err)
	}
	if len(items) != 1 || items[0].SkuID != targetSKU.ID || items[0].Qty != 14 {
		t.Fatalf("expected existing target qty 11 plus replacement qty 3 as one row with qty 14, got %#v", items)
	}
}

func TestPatchCartItemReplacementDoesNotChangeMissingOrCrossUserSource(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)
	queries := db.New(pool)
	sourceSKU, targetSKU := seedCatalog(t, queries)
	ownerID := uuid.New()
	otherOwnerID := uuid.New()

	otherItem, err := queries.UpsertCartItem(context.Background(), db.UpsertCartItemParams{
		OwnerUserID: otherOwnerID,
		SkuID:       sourceSKU.ID,
		Qty:         5,
	})
	if err != nil {
		t.Fatalf("seed other user's source cart item: %v", err)
	}

	router := newAuthIntegrationRouter(pool, queries)
	for name, itemID := range map[string]uuid.UUID{
		"missing":    uuid.New(),
		"cross-user": otherItem.ID,
	} {
		t.Run(name, func(t *testing.T) {
			response := patchCartItem(t, router, ownerID, itemID, targetSKU.ID, 2)
			if response.Code != http.StatusNotFound {
				t.Fatalf("expected 404, got %d: %s", response.Code, response.Body.String())
			}
		})
	}

	otherItems, err := queries.ListCartItems(context.Background(), otherOwnerID)
	if err != nil {
		t.Fatalf("list other user's cart: %v", err)
	}
	if len(otherItems) != 1 || otherItems[0].ID != otherItem.ID || otherItems[0].SkuID != sourceSKU.ID || otherItems[0].Qty != 5 {
		t.Fatalf("expected other user's cart to remain unchanged, got %#v", otherItems)
	}
	ownerItems, err := queries.ListCartItems(context.Background(), ownerID)
	if err != nil {
		t.Fatalf("list request owner's cart: %v", err)
	}
	if len(ownerItems) != 0 {
		t.Fatalf("expected no target row for missing sources, got %#v", ownerItems)
	}
}

func patchCartItem(t *testing.T, router http.Handler, ownerID, itemID, skuID uuid.UUID, qty int) *httptest.ResponseRecorder {
	t.Helper()
	body := fmt.Sprintf(`{"skuId":"%s","qty":%d}`, skuID, qty)
	req := httptest.NewRequest(http.MethodPatch, "/cart/items/"+itemID.String(), strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+makeAuthToken(t, ownerID, "CUSTOMER", nil))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	return recorder
}
