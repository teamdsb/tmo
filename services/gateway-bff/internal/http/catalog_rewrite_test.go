package http

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestRewriteExternalImageURL(t *testing.T) {
	t.Parallel()

	publicBase, err := url.Parse("http://localhost:8080")
	if err != nil {
		t.Fatalf("parse public base: %v", err)
	}

	source := "https://images.unsplash.com/photo-1545239351-1141bd82e8a6"
	got := rewriteExternalImageURL(source, publicBase)
	want := "http://localhost:8080/assets/img?url=https%3A%2F%2Fimages.unsplash.com%2Fphoto-1545239351-1141bd82e8a6"
	if got != want {
		t.Fatalf("expected rewritten url %q, got %q", want, got)
	}

	sameOrigin := "http://localhost:8080/assets/img?url=https%3A%2F%2Fimages.unsplash.com%2Fphoto"
	if rewriteExternalImageURL(sameOrigin, publicBase) != sameOrigin {
		t.Fatalf("same-origin URL should not be rewritten")
	}
}

func TestCatalogRewriteHandlerListProducts(t *testing.T) {
	t.Parallel()

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/catalog/products" {
			t.Fatalf("unexpected upstream path %q", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"items":[{"id":"prod-1","coverImageUrl":"https://images.unsplash.com/photo-1545239351-1141bd82e8a6"}],"page":1,"pageSize":20,"total":1}`))
	}))
	defer upstream.Close()

	handler, err := NewCatalogRewriteHandler(upstream.URL, "http://localhost:8080", time.Second, nil)
	if err != nil {
		t.Fatalf("new catalog rewrite handler: %v", err)
	}

	router := gin.New()
	router.GET("/catalog/products", handler.ListProducts)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/catalog/products?page=1&pageSize=20", nil)
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("parse response json: %v", err)
	}

	items, ok := payload["items"].([]interface{})
	if !ok || len(items) != 1 {
		t.Fatalf("unexpected items payload: %+v", payload["items"])
	}

	item, ok := items[0].(map[string]interface{})
	if !ok {
		t.Fatalf("unexpected item payload: %+v", items[0])
	}
	got, _ := item["coverImageUrl"].(string)
	wantPrefix := "http://localhost:8080/assets/img?url=https%3A%2F%2Fimages.unsplash.com%2Fphoto-1545239351-1141bd82e8a6"
	if got != wantPrefix {
		t.Fatalf("expected rewritten coverImageUrl %q, got %q", wantPrefix, got)
	}
}

func TestCatalogRewriteHandlerProductDetail(t *testing.T) {
	t.Parallel()

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/catalog/products/prod-1" {
			t.Fatalf("unexpected upstream path %q", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"product":{"id":"prod-1","name":"demo","coverImageUrl":"https://images.unsplash.com/photo-1517048676732-d65bc937f952","images":["https://images.unsplash.com/photo-1545239351-1141bd82e8a6","/assets/images/local.png"]},"skus":[]}`))
	}))
	defer upstream.Close()

	handler, err := NewCatalogRewriteHandler(upstream.URL, "http://localhost:8080", time.Second, nil)
	if err != nil {
		t.Fatalf("new catalog rewrite handler: %v", err)
	}

	router := gin.New()
	router.GET("/catalog/products/:spuId", handler.GetProductDetail)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/catalog/products/prod-1", nil)
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}

	body := recorder.Body.String()
	if !strings.Contains(body, "http://localhost:8080/assets/img?url=") {
		t.Fatalf("expected rewritten proxy urls in body, got %s", body)
	}
	if !strings.Contains(body, "/assets/images/local.png") {
		t.Fatalf("expected local image path unchanged, got %s", body)
	}
}

func TestCatalogRewriteHandlerPassthroughNonJSON(t *testing.T) {
	t.Parallel()

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("plain text"))
	}))
	defer upstream.Close()

	handler, err := NewCatalogRewriteHandler(upstream.URL, "http://localhost:8080", time.Second, nil)
	if err != nil {
		t.Fatalf("new catalog rewrite handler: %v", err)
	}

	router := gin.New()
	router.GET("/catalog/products", handler.ListProducts)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/catalog/products", nil)
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}
	if recorder.Body.String() != "plain text" {
		t.Fatalf("expected passthrough body, got %q", recorder.Body.String())
	}
}
