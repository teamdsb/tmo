package http

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestAdminSuppliersRoutesForwardToCommerce(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := NewRouter(ProxyHandlers{
		Identity:     markerHandler("identity"),
		Commerce:     markerHandler("commerce"),
		Payment:      markerHandler("payment"),
		AI:           markerHandler("ai"),
		Bootstrap:    markerHandler("bootstrap"),
		AdminSummary: markerHandler("summary"),
		Image:        markerHandler("image"),
	}, nil, func(context.Context) error {
		return nil
	}, 0)

	for _, path := range []string{"/admin/suppliers", "/admin/suppliers/abc", "/admin/suppliers/abc/contacts"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		recorder := httptest.NewRecorder()
		router.ServeHTTP(recorder, req)

		if recorder.Code != http.StatusNoContent {
			t.Fatalf("path %s expected status 204, got %d", path, recorder.Code)
		}
		if got := recorder.Header().Get("X-Upstream"); got != "commerce" {
			t.Fatalf("path %s expected commerce upstream, got %s", path, got)
		}
	}
}

func TestAdminUsersRouteStillForwardsToIdentity(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := NewRouter(ProxyHandlers{
		Identity:     markerHandler("identity"),
		Commerce:     markerHandler("commerce"),
		Payment:      markerHandler("payment"),
		AI:           markerHandler("ai"),
		Bootstrap:    markerHandler("bootstrap"),
		AdminSummary: markerHandler("summary"),
		Image:        markerHandler("image"),
	}, nil, func(context.Context) error {
		return nil
	}, 0)

	req := httptest.NewRequest(http.MethodGet, "/admin/users", nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusNoContent {
		t.Fatalf("expected status 204, got %d", recorder.Code)
	}
	if got := recorder.Header().Get("X-Upstream"); got != "identity" {
		t.Fatalf("expected identity upstream, got %s", got)
	}
}

func markerHandler(name string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Upstream", name)
		c.Status(http.StatusNoContent)
	}
}

func TestProductImportWorkbenchProxyPreservesRequests(t *testing.T) {
	gin.SetMode(gin.TestMode)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		w.Header().Set("X-Received-Method", r.Method)
		w.Header().Set("X-Received-URI", r.URL.RequestURI())
		w.Header().Set("X-Received-Authorization", r.Header.Get("Authorization"))
		w.Header().Set("X-Received-Idempotency", r.Header.Get("Idempotency-Key"))
		w.Header().Set("X-Received-Body", string(body))
		w.WriteHeader(http.StatusNoContent)
	}))
	defer upstream.Close()
	proxy, err := NewProxyHandler(upstream.URL, upstream.URL, upstream.URL, "", nil, time.Second)
	if err != nil {
		t.Fatal(err)
	}
	router := NewRouter(ProxyHandlers{Identity: proxy.Identity, Commerce: proxy.Commerce, Payment: proxy.Payment, AI: proxy.AI, Bootstrap: markerHandler("bootstrap"), AdminSummary: markerHandler("summary"), Image: markerHandler("image")}, nil, nil, 0)
	gateway := httptest.NewServer(router)
	defer gateway.Close()
	for _, tc := range []struct{ method, path, body string }{
		{"GET", "/admin/products?needsReview=true&page=2", ""},
		{"GET", "/admin/products/import-template", ""},
		{"GET", "/admin/import-jobs?pageSize=20", ""},
		{"GET", "/admin/products/import-jobs/123/preview?needsReview=true", ""},
		{"PUT", "/admin/products/import-jobs/123/preview-resolution", `{"expectedRevision":1,"groups":[]}`},
		{"POST", "/admin/products/import-jobs/123/confirm", `{"expectedRevision":1}`},
		{"POST", "/admin/products/import-jobs/123/cancel", "{}"},
		{"GET", "/admin/products/import-reviews?status=PENDING", ""},
		{"PATCH", "/admin/products/import-reviews/123", `{"status":"RESOLVED"}`},
	} {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			request, err := http.NewRequestWithContext(context.Background(), tc.method, gateway.URL+tc.path, strings.NewReader(tc.body))
			if err != nil {
				t.Fatal(err)
			}
			request.Header.Set("Authorization", "Bearer proxy-fixture")
			request.Header.Set("Idempotency-Key", "proxy-fixture")
			request.Header.Set("Content-Type", "application/json")
			result, err := gateway.Client().Do(request)
			if err != nil {
				t.Fatal(err)
			}
			defer func() { _ = result.Body.Close() }()
			if result.StatusCode != http.StatusNoContent {
				t.Fatalf("status %d", result.StatusCode)
			}
			for key, expected := range map[string]string{"X-Received-Method": tc.method, "X-Received-URI": tc.path, "X-Received-Authorization": "Bearer proxy-fixture", "X-Received-Idempotency": "proxy-fixture", "X-Received-Body": tc.body} {
				if result.Header.Get(key) != expected {
					t.Errorf("%s not preserved: %q", key, result.Header.Get(key))
				}
			}
		})
	}
}
