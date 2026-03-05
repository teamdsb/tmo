package http

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

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
