package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/teamdsb/tmo/packages/go-shared/httpx"
	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/http/middleware"
	"github.com/teamdsb/tmo/services/commerce/internal/http/oapi"
)

type productRequestAuthorizationStore struct {
	listCalls   int
	countCalls  int
	listParams  db.ListProductRequestsParams
	countParams db.CountProductRequestsParams
}

func (s *productRequestAuthorizationStore) CreateProductRequest(context.Context, db.CreateProductRequestParams) (db.ProductRequest, error) {
	return db.ProductRequest{}, nil
}

func (s *productRequestAuthorizationStore) ListProductRequests(_ context.Context, params db.ListProductRequestsParams) ([]db.ProductRequest, error) {
	s.listCalls++
	s.listParams = params
	return []db.ProductRequest{}, nil
}

func (s *productRequestAuthorizationStore) CountProductRequests(_ context.Context, params db.CountProductRequestsParams) (int64, error) {
	s.countCalls++
	s.countParams = params
	return 0, nil
}

func TestGetProductRequestsAuthorizationScopes(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name              string
		role              string
		wantStatus        int
		wantCreatedBySelf bool
		wantOwnedBySelf   bool
	}{
		{name: "customer sees self", role: "CUSTOMER", wantStatus: http.StatusOK, wantCreatedBySelf: true},
		{name: "sales sees owned", role: "SALES", wantStatus: http.StatusOK, wantOwnedBySelf: true},
		{name: "cs sees all", role: "CS", wantStatus: http.StatusOK},
		{name: "manager sees all", role: "MANAGER", wantStatus: http.StatusOK},
		{name: "boss sees all", role: "BOSS", wantStatus: http.StatusOK},
		{name: "admin sees all", role: "ADMIN", wantStatus: http.StatusOK},
		{name: "procurement is forbidden", role: "PROCUREMENT", wantStatus: http.StatusForbidden},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			userID := uuid.New()
			store := &productRequestAuthorizationStore{}
			handler := &Handler{
				ProductRequestStore: store,
				Auth:                middleware.NewAuthenticator(true, testJWTSecret, testJWTIssuer),
			}
			router := httpx.NewRouter()
			router.GET("/product-requests", func(c *gin.Context) {
				handler.GetProductRequests(c, oapi.GetProductRequestsParams{})
			})

			req := httptest.NewRequest(http.MethodGet, "/product-requests", nil)
			req.Header.Set("Authorization", "Bearer "+makeAuthToken(t, userID, tt.role, nil))
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, req)

			if recorder.Code != tt.wantStatus {
				t.Fatalf("expected status %d, got %d: %s", tt.wantStatus, recorder.Code, recorder.Body.String())
			}
			if tt.wantStatus == http.StatusForbidden {
				if store.listCalls != 0 || store.countCalls != 0 {
					t.Fatalf("expected forbidden role not to query store, got list=%d count=%d calls", store.listCalls, store.countCalls)
				}
				return
			}
			if store.listCalls != 1 || store.countCalls != 1 {
				t.Fatalf("expected one list and count call, got list=%d count=%d", store.listCalls, store.countCalls)
			}

			assertScope := func(name string, valid bool, got uuid.UUID, wantSelf bool) {
				t.Helper()
				if valid != wantSelf {
					t.Fatalf("expected %s filter valid=%t, got %t", name, wantSelf, valid)
				}
				if wantSelf && got != userID {
					t.Fatalf("expected %s filter %s, got %s", name, userID, got)
				}
			}
			assertScope("createdBy", store.listParams.CreatedByUserID.Valid, store.listParams.CreatedByUserID.Bytes, tt.wantCreatedBySelf)
			assertScope("ownerSales", store.listParams.OwnerSalesUserID.Valid, store.listParams.OwnerSalesUserID.Bytes, tt.wantOwnedBySelf)
			if store.countParams.CreatedByUserID != store.listParams.CreatedByUserID || store.countParams.OwnerSalesUserID != store.listParams.OwnerSalesUserID {
				t.Fatal("expected count query to use the same authorization scope as list query")
			}
		})
	}
}
