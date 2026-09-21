package handler

import (
	"bytes"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/teamdsb/tmo/packages/go-shared/httpx"
	"github.com/teamdsb/tmo/services/commerce/internal/http/middleware"
	"github.com/teamdsb/tmo/services/commerce/internal/modules/productexport"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestProductExportAuthorizationAndFilters(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := &Handler{Auth: middleware.NewAuthenticator(true, testJWTSecret, testJWTIssuer), ProductExport: &productexport.Service{}}
	router := httpx.NewRouter()
	router.POST("/admin/products/export-jobs", h.PostAdminProductsExportJobs)
	for _, tc := range []struct {
		name, role, body string
		status           int
	}{
		{"sales denied", "SALES", `{}`, http.StatusForbidden},
		{"customer denied", "CUSTOMER", `{}`, http.StatusForbidden},
		{"boss allowed", "BOSS", `{}`, http.StatusInternalServerError},
		{"admin allowed", "ADMIN", `{}`, http.StatusInternalServerError},
		{"invalid status", "ADMIN", `{"status":"DELETED"}`, http.StatusBadRequest},
		{"invalid category", "ADMIN", `{"categoryId":"x"}`, http.StatusBadRequest},
		{"no category sentinel", "ADMIN", `{"categoryId":"__NO_CATEGORY__"}`, http.StatusInternalServerError},
	} {
		t.Run(tc.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodPost, "/admin/products/export-jobs", bytes.NewBufferString(tc.body))
			request.Header.Set("Content-Type", "application/json")
			request.Header.Set("Authorization", "Bearer "+makeAuthToken(t, uuid.New(), tc.role, nil))
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if response.Code != tc.status {
				t.Fatalf("status %d body %s", response.Code, response.Body.String())
			}
		})
	}
}
