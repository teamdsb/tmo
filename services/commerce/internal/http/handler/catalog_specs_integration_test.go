package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/google/uuid"
	"github.com/teamdsb/tmo/services/commerce/internal/db"
)

func catalogJSON(t *testing.T, router http.Handler, method, path string, payload any, role string) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(method, path, bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+makeAuthToken(t, uuid.New(), role, nil))
	result := httptest.NewRecorder()
	router.ServeHTTP(result, request)
	return result
}

func TestCatalogSpecificationsAtomicSaveAndRename(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)
	q := db.New(pool)
	ctx := context.Background()
	a, b := seedCatalog(t, q)
	router, _ := newAuthRouterWithProductImport(pool, q, t.TempDir(), "http://localhost/media")
	path := "/catalog/products/" + a.ProductID.String()
	rows := []map[string]any{
		{"id": a.ID, "name": a.Name, "attributes": map[string]string{"材质": "钢", "长度": "1m", "直径": "6", "备注": "保留"}},
		{"id": b.ID, "name": b.Name, "attributes": map[string]string{"材质": "钢", "长度": "2m", "直径": "6"}},
	}
	result := catalogJSON(t, router, http.MethodPatch, path, map[string]any{"filterDimensions": []string{"材质", "长度", "直径"}, "skus": rows}, "ADMIN")
	if result.Code != 200 {
		t.Fatalf("save: %d %s", result.Code, result.Body.String())
	}
	originalTiers, err := q.ListPriceTiersBySku(ctx, a.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(originalTiers) != 1 || originalTiers[0].UnitPriceFen != 12000 {
		t.Fatal("price changed")
	}

	rows[0]["attributes"] = map[string]string{"材料": "钢", "长度": "1m", "直径": "6", "备注": "保留"}
	rows[1]["attributes"] = map[string]string{"材料": "钢", "长度": "2m", "直径": "6"}
	result = catalogJSON(t, router, http.MethodPatch, path, map[string]any{"filterDimensions": []string{"材料", "长度", "直径"}, "skus": rows}, "ADMIN")
	if result.Code != 200 {
		t.Fatalf("rename: %d %s", result.Code, result.Body.String())
	}
	skus, err := q.ListSkusByProduct(ctx, a.ProductID)
	if err != nil {
		t.Fatal(err)
	}
	if len(skus) != 2 || skus[0].ID != a.ID || skus[0].Spec == nil || *skus[0].Spec != "钢 / 1m / 6" || skus[0].Unit == nil || *skus[0].Unit != "pcs" || *skus[0].SkuCode != "SP-001" {
		t.Fatalf("lost identity/metadata: %+v", skus)
	}
	tiers, _ := q.ListPriceTiersBySku(ctx, a.ID)
	if tiers[0].ID != originalTiers[0].ID {
		t.Fatal("omitted tier prices were rewritten")
	}

	// A late database uniqueness failure must undo product and earlier SKU writes.
	conflict := []map[string]any{rows[0], {"name": "conflicting code", "skuCode": "SP-001", "attributes": map[string]string{"材料": "铜", "长度": "3m", "直径": "8"}}}
	result = catalogJSON(t, router, http.MethodPatch, path, map[string]any{"name": "MUST ROLLBACK", "skus": conflict}, "ADMIN")
	if result.Code != 400 {
		t.Fatalf("conflict: %d %s", result.Code, result.Body.String())
	}
	product, _ := q.GetProduct(ctx, a.ProductID)
	if product.Name == "MUST ROLLBACK" {
		t.Fatal("partial product write persisted")
	}
	skus, _ = q.ListSkusByProduct(ctx, a.ProductID)
	if len(skus) != 2 || !skus[1].IsActive {
		t.Fatal("failed transaction changed SKU collection")
	}

	result = catalogJSON(t, router, http.MethodPatch, path, map[string]any{"skus": rows[:1]}, "ADMIN")
	if result.Code != 200 {
		t.Fatalf("remove: %d %s", result.Code, result.Body.String())
	}
	removed, _ := q.ListSkusByIDs(ctx, []uuid.UUID{b.ID})
	if len(removed) != 1 || removed[0].IsActive {
		t.Fatal("removed SKU must remain as inactive history")
	}
	if prices, _ := q.ListPriceTiersBySku(ctx, b.ID); len(prices) != 1 {
		t.Fatal("removed SKU prices lost")
	}
}

func TestCatalogSpecificationsRejectInvalidAndSerializeConcurrentWrites(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)
	q := db.New(pool)
	ctx := context.Background()
	a, b := seedCatalog(t, q)
	router, _ := newAuthRouterWithProductImport(pool, q, t.TempDir(), "http://localhost/media")
	path := "/catalog/products/" + a.ProductID.String()
	rows := []map[string]any{{"id": a.ID, "name": a.Name, "attributes": map[string]string{"规格": "1m"}}, {"id": b.ID, "name": b.Name, "attributes": map[string]string{"规格": "2m"}}}
	result := catalogJSON(t, router, http.MethodPatch, path, map[string]any{"filterDimensions": []string{"规格"}, "skus": rows}, "ADMIN")
	if result.Code != 200 {
		t.Fatal(result.Body.String())
	}
	invalid := []any{
		map[string]any{"filterDimensions": []string{"a", "b", "c", "d"}},
		map[string]any{"filterDimensions": []string{"规格", "规格"}},
		map[string]any{"filterDimensions": []string{" "}},
		map[string]any{"skus": []any{map[string]any{"id": a.ID, "name": a.Name, "attributes": map[string]string{}}}},
		map[string]any{"skus": []any{rows[0], map[string]any{"name": "duplicate", "attributes": map[string]string{"规格": "1m"}}}},
		map[string]any{"skus": []any{map[string]any{"id": uuid.New(), "name": "foreign", "attributes": map[string]string{"规格": "3m"}}}},
	}
	for _, payload := range invalid {
		response := catalogJSON(t, router, http.MethodPatch, path, payload, "ADMIN")
		if response.Code != 400 {
			t.Fatalf("expected invalid request: %d %s", response.Code, response.Body.String())
		}
	}
	forbidden := catalogJSON(t, router, http.MethodPatch, path, map[string]any{"name": "forbidden"}, "CUSTOMER")
	if forbidden.Code != 403 {
		t.Fatalf("expected forbidden: %d", forbidden.Code)
	}
	codes := make(chan int, 2)
	var wg sync.WaitGroup
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			response := catalogJSON(t, router, http.MethodPost, path+"/skus", map[string]any{"name": "3m", "attributes": map[string]string{"规格": "3m"}}, "ADMIN")
			codes <- response.Code
		}()
	}
	wg.Wait()
	close(codes)
	counts := map[int]int{}
	for status := range codes {
		counts[status]++
	}
	if counts[201] != 1 || counts[400] != 1 {
		t.Fatalf("duplicate concurrent SKU accepted: %v", counts)
	}
	skus, _ := q.ListSkusByProduct(ctx, a.ProductID)
	if len(skus) != 3 {
		t.Fatalf("unexpected sku count %d", len(skus))
	}
}

func TestCatalogSpecificationsPreserveUnpricedAndAllowClearingCode(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)
	q := db.New(pool)
	ctx := context.Background()
	a, _ := seedCatalog(t, q)
	if _, err := q.DeletePriceTiersBySku(ctx, a.ID); err != nil {
		t.Fatal(err)
	}
	router, _ := newAuthRouterWithProductImport(pool, q, t.TempDir(), "http://localhost/media")
	path := "/catalog/products/" + a.ProductID.String()
	payload := map[string]any{"filterDimensions": []string{"规格"}, "skus": []any{map[string]any{"id": a.ID, "name": a.Name, "skuCode": nil, "attributes": map[string]string{"规格": "M8", "品牌": "Acme"}}}}
	response := catalogJSON(t, router, http.MethodPatch, path, payload, "ADMIN")
	if response.Code != 200 {
		t.Fatal(response.Body.String())
	}
	skus, _ := q.ListSkusByIDs(ctx, []uuid.UUID{a.ID})
	tiers, _ := q.ListPriceTiersBySku(ctx, a.ID)
	if skus[0].SkuCode != nil || len(tiers) != 0 {
		t.Fatal("code not cleared or unpriced SKU changed")
	}
	collision := map[string]any{"filterDimensions": []string{"品牌"}, "skus": []any{map[string]any{"id": a.ID, "name": a.Name, "attributes": map[string]string{"品牌": "M8"}}}}
	response = catalogJSON(t, router, http.MethodPatch, path, collision, "ADMIN")
	if response.Code != 400 {
		t.Fatalf("extension collision accepted: %s", response.Body.String())
	}
}
