package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/teamdsb/tmo/packages/go-shared/httpx"
	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/http/middleware"
	"github.com/teamdsb/tmo/services/commerce/internal/http/oapi"
)

func TestProductRequestsCreateAndListWithNewFields(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)
	queries := db.New(pool)

	category, err := queries.CreateCategory(context.Background(), db.CreateCategoryParams{
		Name:     "Steel",
		ParentID: pgtype.UUID{},
		Sort:     1,
	})
	if err != nil {
		t.Fatalf("create category: %v", err)
	}

	customerID := uuid.New()
	ownerSalesID := uuid.New()
	router := newAuthIntegrationRouter(pool, queries)

	payload := map[string]interface{}{
		"name":               "Need custom sheet",
		"categoryId":         category.ID.String(),
		"spec":               "grade A",
		"material":           "stainless steel",
		"dimensions":         "100x50x2",
		"color":              "silver",
		"qty":                "10 pcs",
		"note":               "urgent",
		"referenceImageUrls": []string{"https://example.com/a.png", "https://example.com/b.png"},
	}
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/product-requests", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+makeAuthToken(t, customerID, "CUSTOMER", &ownerSalesID))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d: %s", recorder.Code, recorder.Body.String())
	}

	var created oapi.ProductRequest
	if err := json.Unmarshal(recorder.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if created.CategoryId == nil || uuid.UUID(*created.CategoryId) != category.ID {
		t.Fatalf("expected categoryId %s, got %#v", category.ID, created.CategoryId)
	}
	if created.ReferenceImageUrls == nil || len(*created.ReferenceImageUrls) != 2 {
		t.Fatalf("expected 2 referenceImageUrls, got %#v", created.ReferenceImageUrls)
	}

	stored, err := queries.ListProductRequests(context.Background(), db.ListProductRequestsParams{
		CreatedByUserID: pgtype.UUID{Bytes: customerID, Valid: true},
		Offset:          0,
		Limit:           20,
	})
	if err != nil {
		t.Fatalf("list stored product requests: %v", err)
	}
	if len(stored) != 1 {
		t.Fatalf("expected 1 stored request, got %d", len(stored))
	}
	if !stored[0].OwnerSalesUserID.Valid || stored[0].OwnerSalesUserID.Bytes != ownerSalesID {
		t.Fatalf("expected ownerSalesUserId %s, got %+v", ownerSalesID, stored[0].OwnerSalesUserID)
	}
	if !stored[0].CategoryID.Valid || stored[0].CategoryID.Bytes != category.ID {
		t.Fatalf("expected categoryId %s, got %+v", category.ID, stored[0].CategoryID)
	}

	req = httptest.NewRequest(http.MethodGet, "/product-requests", nil)
	req.Header.Set("Authorization", "Bearer "+makeAuthToken(t, customerID, "CUSTOMER", &ownerSalesID))
	recorder = httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", recorder.Code, recorder.Body.String())
	}

	var list oapi.PagedProductRequestList
	if err := json.Unmarshal(recorder.Body.Bytes(), &list); err != nil {
		t.Fatalf("decode list response: %v", err)
	}
	if len(list.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(list.Items))
	}
	if list.Items[0].Material == nil || *list.Items[0].Material != "stainless steel" {
		t.Fatalf("expected material to be preserved, got %#v", list.Items[0].Material)
	}
}

func TestProductRequestsCreateInvalidCategoryIDReturnsBadRequest(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)
	queries := db.New(pool)

	customerID := uuid.New()
	router := newAuthIntegrationRouter(pool, queries)

	payload := map[string]interface{}{
		"name":       "Need custom sheet",
		"categoryId": uuid.New().String(),
	}
	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/product-requests", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+makeAuthToken(t, customerID, "CUSTOMER", nil))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d: %s", recorder.Code, recorder.Body.String())
	}

	var apiError map[string]interface{}
	if err := json.Unmarshal(recorder.Body.Bytes(), &apiError); err != nil {
		t.Fatalf("decode error response: %v", err)
	}
	if apiError["code"] != "invalid_request" {
		t.Fatalf("expected invalid_request code, got %#v", apiError["code"])
	}
	if apiError["message"] != "categoryId does not exist" {
		t.Fatalf("expected categoryId does not exist message, got %#v", apiError["message"])
	}
}

func TestProductRequestsPermissions(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)
	queries := db.New(pool)
	router := newAuthIntegrationRouter(pool, queries)

	customerID := uuid.New()
	salesA := uuid.New()
	salesB := uuid.New()

	if _, err := queries.CreateProductRequest(context.Background(), db.CreateProductRequestParams{
		CreatedByUserID:    customerID,
		OwnerSalesUserID:   pgtype.UUID{Bytes: salesA, Valid: true},
		Name:               "A",
		CategoryID:         pgtype.UUID{},
		ReferenceImageUrls: []string{},
	}); err != nil {
		t.Fatalf("seed request A: %v", err)
	}
	if _, err := queries.CreateProductRequest(context.Background(), db.CreateProductRequestParams{
		CreatedByUserID:    customerID,
		OwnerSalesUserID:   pgtype.UUID{Bytes: salesB, Valid: true},
		Name:               "B",
		CategoryID:         pgtype.UUID{},
		ReferenceImageUrls: []string{},
	}); err != nil {
		t.Fatalf("seed request B: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/product-requests", nil)
	req.Header.Set("Authorization", "Bearer "+makeAuthToken(t, salesA, "SALES", nil))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", recorder.Code, recorder.Body.String())
	}
	var list oapi.PagedProductRequestList
	if err := json.Unmarshal(recorder.Body.Bytes(), &list); err != nil {
		t.Fatalf("decode list response: %v", err)
	}
	if len(list.Items) != 1 {
		t.Fatalf("expected sales to see 1 owned item, got %d", len(list.Items))
	}

	req = httptest.NewRequest(http.MethodPost, "/product-requests", bytes.NewBufferString(`{"name":"x"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+makeAuthToken(t, salesA, "SALES", nil))
	recorder = httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected status 403 for sales create, got %d: %s", recorder.Code, recorder.Body.String())
	}
}

func TestProductRequestAssetsUploadSuccessAndFailure(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)
	queries := db.New(pool)

	tmpDir := t.TempDir()
	router := newAuthRouterWithMedia(queries, tmpDir, "http://localhost:8080/assets/media")
	customerID := uuid.New()

	pngData := []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x00}
	req := multipartFileRequest(t, http.MethodPost, "/product-requests/assets", "file", "demo.png", pngData)
	req.Header.Set("Authorization", "Bearer "+makeAuthToken(t, customerID, "CUSTOMER", nil))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d: %s", recorder.Code, recorder.Body.String())
	}
	var uploaded oapi.ProductRequestAsset
	if err := json.Unmarshal(recorder.Body.Bytes(), &uploaded); err != nil {
		t.Fatalf("decode upload response: %v", err)
	}
	if uploaded.ContentType != "image/png" {
		t.Fatalf("expected image/png, got %s", uploaded.ContentType)
	}
	if uploaded.Size != int64(len(pngData)) {
		t.Fatalf("expected size %d, got %d", len(pngData), uploaded.Size)
	}
	prefix := "http://localhost:8080/assets/media/product-requests/"
	if !strings.HasPrefix(uploaded.Url, prefix) {
		t.Fatalf("expected url prefix %s, got %s", prefix, uploaded.Url)
	}
	fileName := strings.TrimPrefix(uploaded.Url, prefix)
	if fileName == "" {
		t.Fatalf("expected non-empty file name in uploaded url")
	}
	if _, err := os.Stat(filepath.Join(tmpDir, "product-requests", fileName)); err != nil {
		t.Fatalf("expected file written to disk: %v", err)
	}

	req = multipartFileRequest(t, http.MethodPost, "/product-requests/assets", "file", "demo.txt", []byte("plain text"))
	req.Header.Set("Authorization", "Bearer "+makeAuthToken(t, customerID, "CUSTOMER", nil))
	recorder = httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for unsupported type, got %d: %s", recorder.Code, recorder.Body.String())
	}

	largePng := append([]byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}, bytes.Repeat([]byte("a"), int(maxProductRequestAssetSize)+8)...)
	req = multipartFileRequest(t, http.MethodPost, "/product-requests/assets", "file", "too-large.png", largePng)
	req.Header.Set("Authorization", "Bearer "+makeAuthToken(t, customerID, "CUSTOMER", nil))
	recorder = httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400 for oversized file, got %d: %s", recorder.Code, recorder.Body.String())
	}
}

func newAuthRouterWithMedia(store *db.Queries, mediaLocalDir, mediaBaseURL string) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := httpx.NewRouter()
	authenticator := middleware.NewAuthenticator(true, testJWTSecret, testJWTIssuer)
	oapi.RegisterHandlers(router, &Handler{
		CatalogStore:        store,
		CartStore:           store,
		OrderStore:          store,
		TrackingStore:       store,
		ProductRequestStore: store,
		DB:                  nil,
		Auth:                authenticator,
		MediaLocalOutputDir: mediaLocalDir,
		MediaPublicBaseURL:  mediaBaseURL,
	})
	return router
}

func multipartFileRequest(t *testing.T, method, path, fieldName, fileName string, fileBytes []byte) *http.Request {
	t.Helper()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile(fieldName, fileName)
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, err := part.Write(fileBytes); err != nil {
		t.Fatalf("write form file: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	req := httptest.NewRequest(method, path, &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	return req
}
