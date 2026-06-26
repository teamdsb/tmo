package handler

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/oapi-codegen/runtime/types"

	"github.com/teamdsb/tmo/packages/go-shared/httpx"
	"github.com/teamdsb/tmo/services/commerce/internal/http/middleware"
)

func parsePathUUID(c *gin.Context, key string) types.UUID {
	parsed := uuid.MustParse(c.Param(key))
	return types.UUID(parsed)
}

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

func TestCatalogWriteEndpointsAllowBossRole(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := httpx.NewRouter()
	handler := &Handler{
		Auth: middleware.NewAuthenticator(true, testJWTSecret, testJWTIssuer),
	}
	router.POST("/catalog/categories", handler.PostCatalogCategories)
	router.PATCH("/catalog/categories/:categoryId", func(c *gin.Context) {
		handler.PatchCatalogCategoriesCategoryId(c, parsePathUUID(c, "categoryId"))
	})
	router.PUT("/admin/miniapp/display-categories", handler.PutAdminMiniappDisplayCategories)
	router.POST("/catalog/products", handler.PostCatalogProducts)
	router.PATCH("/catalog/products/:spuId", func(c *gin.Context) {
		handler.PatchCatalogProductsSpuId(c, parsePathUUID(c, "spuId"))
	})
	router.POST("/catalog/products/:spuId/skus", func(c *gin.Context) {
		handler.PostCatalogProductsSpuIdSkus(c, parsePathUUID(c, "spuId"))
	})

	for _, tc := range []struct {
		method string
		path   string
		body   string
	}{
		{method: http.MethodPost, path: "/catalog/categories", body: `{}`},
		{method: http.MethodPatch, path: "/catalog/categories/11111111-1111-1111-1111-111111111111", body: `{}`},
		{method: http.MethodPut, path: "/admin/miniapp/display-categories", body: `{}`},
		{method: http.MethodPost, path: "/catalog/products", body: `{}`},
		{method: http.MethodPatch, path: "/catalog/products/11111111-1111-1111-1111-111111111111", body: `{}`},
		{method: http.MethodPost, path: "/catalog/products/11111111-1111-1111-1111-111111111111/skus", body: `{}`},
	} {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, bytes.NewReader([]byte(tc.body)))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+makeAuthToken(t, uuid.New(), "BOSS", nil))
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, req)

			if recorder.Code == http.StatusForbidden {
				t.Fatalf("expected BOSS to pass authorization, got 403: %s", recorder.Body.String())
			}
		})
	}
}

func TestCatalogWriteEndpointsRejectSalesRole(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := httpx.NewRouter()
	handler := &Handler{
		Auth: middleware.NewAuthenticator(true, testJWTSecret, testJWTIssuer),
	}
	router.POST("/catalog/categories", handler.PostCatalogCategories)
	router.PATCH("/catalog/products/:spuId", func(c *gin.Context) {
		handler.PatchCatalogProductsSpuId(c, parsePathUUID(c, "spuId"))
	})

	for _, tc := range []struct {
		method string
		path   string
	}{
		{method: http.MethodPost, path: "/catalog/categories"},
		{method: http.MethodPatch, path: "/catalog/products/11111111-1111-1111-1111-111111111111"},
	} {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, tc.path, bytes.NewReader([]byte(`{}`)))
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
