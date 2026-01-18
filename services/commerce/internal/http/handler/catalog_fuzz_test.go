package handler

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
)

func FuzzCatalogProducts(f *testing.F) {
	seed := []byte(`{"name":"Steel Pipe","categoryId":"00000000-0000-0000-0000-000000000000"}`)
	f.Add(seed)
	f.Add([]byte(`{}`))
	f.Add([]byte(`{"name":123}`))
	f.Add([]byte(`not-json`))

	store := &stubStore{
		createProductFn: func(ctx context.Context, arg db.CreateProductParams) (db.CatalogProduct, error) {
			return db.CatalogProduct{
				ID:         uuid.New(),
				Name:       arg.Name,
				CategoryID: arg.CategoryID,
			}, nil
		},
	}

	f.Fuzz(func(t *testing.T, body []byte) {
		if len(body) > 1<<20 {
			t.Skip("payload too large")
		}

		router := newTestRouter(store)
		req := httptest.NewRequest(http.MethodPost, "/catalog/products", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, req)

		if recorder.Code != http.StatusBadRequest && recorder.Code != http.StatusCreated {
			t.Fatalf("unexpected status: %d", recorder.Code)
		}
	})
}
