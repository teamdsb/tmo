package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
)

func TestPostCatalogProductsRejectsMoreThanNineImages(t *testing.T) {
	store := &stubStore{
		createProductFn: func(context.Context, db.CreateProductParams) (db.CatalogProduct, error) {
			t.Fatal("create product must not be called for an invalid image list")
			return db.CatalogProduct{}, nil
		},
	}
	body, err := json.Marshal(map[string]interface{}{
		"name":       "图片超限商品",
		"categoryId": uuid.NewString(),
		"images":     testProductImageURLs(10),
	})
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/catalog/products", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	newTestRouter(store).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if !bytes.Contains(recorder.Body.Bytes(), []byte("images supports at most 9 items")) {
		t.Fatalf("expected image limit message, got %s", recorder.Body.String())
	}
}

func TestPatchCatalogProductsRejectsMoreThanNineImages(t *testing.T) {
	productID := uuid.New()
	store := &stubStore{
		getProductFn: func(context.Context, uuid.UUID) (db.CatalogProduct, error) {
			return db.CatalogProduct{ID: productID, Name: "已有商品", CategoryID: uuid.New()}, nil
		},
		updateProductFn: func(context.Context, db.UpdateProductParams) (db.CatalogProduct, error) {
			t.Fatal("update product must not be called for an invalid image list")
			return db.CatalogProduct{}, nil
		},
	}
	body, err := json.Marshal(map[string]interface{}{"images": testProductImageURLs(10)})
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPatch, "/catalog/products/"+productID.String(), bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	newTestRouter(store).ServeHTTP(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if !bytes.Contains(recorder.Body.Bytes(), []byte("images supports at most 9 items")) {
		t.Fatalf("expected image limit message, got %s", recorder.Body.String())
	}
}

func testProductImageURLs(count int) []string {
	images := make([]string, count)
	for index := range images {
		images[index] = fmt.Sprintf("https://example.com/product-%d.jpg", index+1)
	}
	return images
}
