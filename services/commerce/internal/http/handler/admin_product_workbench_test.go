package handler

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/teamdsb/tmo/services/commerce/internal/http/middleware"
	"github.com/xuri/excelize/v2"
)

func TestProductWorkbenchAuthorizationAndTemplate(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := &Handler{Auth: middleware.NewAuthenticator(true, testJWTSecret, testJWTIssuer)}
	routes := []struct {
		method, path string
		handler      gin.HandlerFunc
	}{
		{"GET", "/admin/products", h.GetAdminCatalogProducts},
		{"GET", "/admin/products/import-template", h.GetAdminProductImportTemplate},
		{"GET", "/admin/import-jobs", h.GetAdminImportJobs},
		{"GET", "/admin/products/import-reviews", h.GetAdminProductImportReviews},
		{"GET", "/admin/products/import-jobs/:jobId/preview", h.GetAdminProductImportPreview},
		{"PUT", "/admin/products/import-jobs/:jobId/preview-resolution", h.PutAdminProductImportResolution},
		{"POST", "/admin/products/import-jobs/:jobId/confirm", h.PostAdminProductImportConfirm},
		{"POST", "/admin/products/import-jobs/:jobId/cancel", h.PostAdminProductImportCancel},
		{"PATCH", "/admin/products/import-reviews/:reviewId", h.PatchAdminProductImportReview},
	}
	for _, route := range routes {
		for _, role := range []string{"CS", "MANAGER", "SALES", "CUSTOMER"} {
			t.Run(role+" "+route.method+" "+route.path, func(t *testing.T) {
				router := gin.New()
				router.Handle(route.method, route.path, route.handler)
				request := httptest.NewRequest(route.method, route.path, bytes.NewBufferString("{}"))
				request.Header.Set("Authorization", "Bearer "+makeAuthToken(t, uuid.New(), role, nil))
				response := httptest.NewRecorder()
				router.ServeHTTP(response, request)
				if response.Code != http.StatusForbidden {
					t.Fatalf("got %d: %s", response.Code, response.Body.String())
				}
			})
		}
	}
	router := gin.New()
	router.GET("/template", h.GetAdminProductImportTemplate)
	request := httptest.NewRequest("GET", "/template", nil)
	request.Header.Set("Authorization", "Bearer "+makeAuthToken(t, uuid.New(), "ADMIN", nil))
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != 200 {
		t.Fatalf("%d %s", response.Code, response.Body.String())
	}
	file, err := excelize.OpenReader(bytes.NewReader(response.Body.Bytes()))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = file.Close() }()
	rows, err := file.GetRows("商品维护")
	if err != nil || len(rows) != 1 || rows[0][0] != "商品名称" || rows[0][4] != "一级规格名称" {
		t.Fatalf("unexpected template: %v %v", rows, err)
	}
}
