package handler

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/teamdsb/tmo/packages/go-shared/httpx"
	"github.com/teamdsb/tmo/services/commerce/internal/http/middleware"
)

func TestAdminImportEndpointsAllowBossRole(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := httpx.NewRouter()
	handler := &Handler{
		Auth: middleware.NewAuthenticator(true, testJWTSecret, testJWTIssuer),
	}
	router.POST("/admin/products/import-jobs", handler.PostAdminProductsImportJobs)
	router.POST("/admin/product-requests/export-jobs", handler.PostAdminProductRequestsExportJobs)

	requests := []struct {
		name        string
		method      string
		path        string
		contentType string
		body        []byte
	}{
		{
			name:        "product import",
			method:      http.MethodPost,
			path:        "/admin/products/import-jobs",
			contentType: "multipart/form-data; boundary=missing",
			body:        []byte("--missing--"),
		},
		{
			name:        "product request export",
			method:      http.MethodPost,
			path:        "/admin/product-requests/export-jobs",
			contentType: "application/json",
			body:        []byte(`{}`),
		},
	}

	for _, tc := range requests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, bytes.NewReader(tc.body))
			req.Header.Set("Content-Type", tc.contentType)
			req.Header.Set("Authorization", "Bearer "+makeAuthToken(t, uuid.New(), "BOSS", nil))
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, req)

			if recorder.Code == http.StatusForbidden {
				t.Fatalf("expected BOSS to pass authorization, got 403: %s", recorder.Body.String())
			}
		})
	}
}

func TestAdminImportEndpointsRejectSalesRole(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := httpx.NewRouter()
	handler := &Handler{
		Auth: middleware.NewAuthenticator(true, testJWTSecret, testJWTIssuer),
	}
	router.POST("/admin/products/import-jobs", handler.PostAdminProductsImportJobs)
	router.POST("/admin/product-requests/export-jobs", handler.PostAdminProductRequestsExportJobs)

	for _, path := range []string{"/admin/products/import-jobs", "/admin/product-requests/export-jobs"} {
		t.Run(path, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader([]byte(`{}`)))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+makeAuthToken(t, uuid.New(), "SALES", nil))
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, req)

			if recorder.Code != http.StatusForbidden {
				t.Fatalf("expected SALES to be forbidden, got %d: %s", recorder.Code, recorder.Body.String())
			}
		})
	}
}
