package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xuri/excelize/v2"

	"github.com/teamdsb/tmo/packages/go-shared/httpx"
	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/excel"
	"github.com/teamdsb/tmo/services/commerce/internal/http/middleware"
	"github.com/teamdsb/tmo/services/commerce/internal/http/oapi"
	"github.com/teamdsb/tmo/services/commerce/internal/modules/productrequestexport"
)

func TestAdminProductRequestExportCreateAndQuery(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)
	queries := db.New(pool)

	ctx := context.Background()
	category, err := queries.CreateCategory(ctx, db.CreateCategoryParams{
		Name:     "Steel",
		ParentID: pgtype.UUID{},
		Sort:     1,
	})
	if err != nil {
		t.Fatalf("create category: %v", err)
	}

	oldRequest, err := queries.CreateProductRequest(ctx, db.CreateProductRequestParams{
		CreatedByUserID:    uuid.New(),
		OwnerSalesUserID:   pgtype.UUID{},
		Name:               "Old request",
		CategoryID:         pgtype.UUID{Bytes: category.ID, Valid: true},
		ReferenceImageUrls: []string{},
	})
	if err != nil {
		t.Fatalf("seed old request: %v", err)
	}
	newRequest, err := queries.CreateProductRequest(ctx, db.CreateProductRequestParams{
		CreatedByUserID:    uuid.New(),
		OwnerSalesUserID:   pgtype.UUID{},
		Name:               "Need export",
		CategoryID:         pgtype.UUID{Bytes: category.ID, Valid: true},
		Spec:               stringPtr("A"),
		ReferenceImageUrls: []string{"https://example.com/a.png"},
	})
	if err != nil {
		t.Fatalf("seed new request: %v", err)
	}

	oldTime := time.Date(2026, 3, 1, 10, 0, 0, 0, time.UTC)
	newTime := time.Date(2026, 3, 5, 10, 0, 0, 0, time.UTC)
	if _, err := pool.Exec(ctx, `UPDATE product_requests SET created_at = $2, updated_at = $2 WHERE id = $1`, oldRequest.ID, oldTime); err != nil {
		t.Fatalf("update old request time: %v", err)
	}
	if _, err := pool.Exec(ctx, `UPDATE product_requests SET created_at = $2, updated_at = $2 WHERE id = $1`, newRequest.ID, newTime); err != nil {
		t.Fatalf("update new request time: %v", err)
	}

	mediaDir := t.TempDir()
	router, service := newAuthRouterWithProductRequestExport(pool, queries, mediaDir, "http://localhost:8080/assets/media")
	body, err := json.Marshal(map[string]string{
		"createdAfter":  "2026-03-04T00:00:00Z",
		"createdBefore": "2026-03-06T00:00:00Z",
	})
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/admin/product-requests/export-jobs", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+makeAuthToken(t, uuid.New(), "ADMIN", nil))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusAccepted {
		t.Fatalf("expected status 202, got %d: %s", recorder.Code, recorder.Body.String())
	}

	var created oapi.ImportJob
	if err := json.Unmarshal(recorder.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode created job: %v", err)
	}

	exportJob, err := queries.GetProductRequestExportJob(ctx, uuid.UUID(created.Id))
	if err != nil {
		t.Fatalf("get export detail job: %v", err)
	}
	if !exportJob.CreatedAfter.Valid || exportJob.CreatedAfter.Time.UTC().Format(time.RFC3339) != "2026-03-04T00:00:00Z" {
		t.Fatalf("unexpected createdAfter: %+v", exportJob.CreatedAfter)
	}

	if _, err := service.RunNext(ctx); err != nil {
		t.Fatalf("run export worker: %v", err)
	}

	req = httptest.NewRequest(http.MethodGet, "/admin/import-jobs/"+created.Id.String(), nil)
	req.Header.Set("Authorization", "Bearer "+makeAuthToken(t, uuid.New(), "ADMIN", nil))
	recorder = httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", recorder.Code, recorder.Body.String())
	}

	var fetched oapi.ImportJob
	if err := json.Unmarshal(recorder.Body.Bytes(), &fetched); err != nil {
		t.Fatalf("decode fetched job: %v", err)
	}
	if fetched.Status != oapi.SUCCEEDED {
		t.Fatalf("expected SUCCEEDED, got %s", fetched.Status)
	}
	if fetched.ResultFileUrl == nil || *fetched.ResultFileUrl == "" {
		t.Fatalf("expected resultFileUrl to be set")
	}

	rows := readAdminExportWorkbookRows(t, mediaDir, *fetched.ResultFileUrl)
	if len(rows) != 2 {
		t.Fatalf("expected header plus one filtered row, got %d", len(rows))
	}
	if rows[1][3] != "Need export" {
		t.Fatalf("unexpected exported row: %#v", rows[1])
	}
}

func newAuthRouterWithProductRequestExport(pool *pgxpool.Pool, store *db.Queries, mediaLocalDir, mediaBaseURL string) (*gin.Engine, *productrequestexport.Service) {
	gin.SetMode(gin.TestMode)
	router := httpx.NewRouter()
	authenticator := middleware.NewAuthenticator(true, testJWTSecret, testJWTIssuer)
	exportService := productrequestexport.NewService(pool, mediaLocalDir, mediaBaseURL)
	handler := &Handler{
		CatalogStore:         store,
		TrackingStore:        store,
		ProductRequestExport: exportService,
		DB:                   pool,
		Auth:                 authenticator,
	}
	oapi.RegisterHandlers(router, handler)
	router.POST("/admin/product-requests/export-jobs", handler.PostAdminProductRequestsExportJobs)
	router.GET("/admin/import-jobs/:jobId", handler.GetAdminImportJobsJobId)
	return router, exportService
}

func readAdminExportWorkbookRows(t *testing.T, mediaDir, resultURL string) [][]string {
	t.Helper()

	relativePath := strings.TrimPrefix(resultURL, "http://localhost:8080/assets/media/")
	file, err := excelize.OpenFile(filepath.Join(mediaDir, filepath.FromSlash(relativePath)))
	if err != nil {
		t.Fatalf("open admin export workbook: %v", err)
	}
	defer func() {
		_ = file.Close()
	}()

	rows, err := file.GetRows(excel.ProductRequestExportTemplate().SheetName)
	if err != nil {
		t.Fatalf("read admin export workbook rows: %v", err)
	}
	return rows
}
