package productrequestexport

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xuri/excelize/v2"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/excel"
	"github.com/teamdsb/tmo/services/commerce/internal/http/oapi"
)

const testMediaBaseURL = "http://localhost:8080/assets/media"

func TestServiceRunNextWritesWorkbook(t *testing.T) {
	pool := openProductRequestExportTestPool(t)
	resetProductRequestExportTables(t, pool)
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

	createdBy := uuid.New()
	ownerSales := uuid.New()
	if _, err := queries.CreateProductRequest(ctx, db.CreateProductRequestParams{
		CreatedByUserID:    createdBy,
		OwnerSalesUserID:   pgtype.UUID{Bytes: ownerSales, Valid: true},
		Name:               "Need custom bracket",
		CategoryID:         pgtype.UUID{Bytes: category.ID, Valid: true},
		Spec:               stringPtr("grade A"),
		Material:           stringPtr("stainless steel"),
		Dimensions:         stringPtr("100x50x2"),
		Color:              stringPtr("silver"),
		Qty:                stringPtr("10 pcs"),
		Note:               stringPtr("urgent"),
		ReferenceImageUrls: []string{"https://example.com/a.png", "https://example.com/b.png"},
	}); err != nil {
		t.Fatalf("seed product request: %v", err)
	}
	if _, err := queries.CreateProductRequest(ctx, db.CreateProductRequestParams{
		CreatedByUserID:    uuid.New(),
		OwnerSalesUserID:   pgtype.UUID{},
		Name:               "Need plain part",
		CategoryID:         pgtype.UUID{},
		ReferenceImageUrls: []string{},
	}); err != nil {
		t.Fatalf("seed second product request: %v", err)
	}

	mediaDir := t.TempDir()
	service := NewService(pool, mediaDir, testMediaBaseURL)
	job, err := service.Enqueue(ctx, EnqueueInput{
		CreatedByUserID: pgtype.UUID{Bytes: uuid.New(), Valid: true},
	})
	if err != nil {
		t.Fatalf("enqueue export: %v", err)
	}

	processed, err := service.RunNext(ctx)
	if err != nil {
		t.Fatalf("run next export job: %v", err)
	}
	if !processed {
		t.Fatalf("expected export job to be processed")
	}

	importJob, err := queries.GetImportJob(ctx, job.ID)
	if err != nil {
		t.Fatalf("get import job: %v", err)
	}
	if importJob.Status != string(oapi.SUCCEEDED) {
		t.Fatalf("expected SUCCEEDED, got %s", importJob.Status)
	}
	if importJob.ResultFileUrl == nil || *importJob.ResultFileUrl == "" {
		t.Fatalf("expected resultFileUrl to be set")
	}

	exportJob, err := queries.GetProductRequestExportJob(ctx, job.ID)
	if err != nil {
		t.Fatalf("get export job detail: %v", err)
	}
	if exportJob.ExportedRows != 2 {
		t.Fatalf("expected exportedRows 2, got %d", exportJob.ExportedRows)
	}

	rows := readExportWorkbookRows(t, mediaDir, *importJob.ResultFileUrl)
	headers := excel.TemplateHeaders(excel.ProductRequestExportTemplate())
	if len(rows) != 3 {
		t.Fatalf("expected header plus 2 data rows, got %d", len(rows))
	}
	if strings.Join(rows[0], ",") != strings.Join(headers, ",") {
		t.Fatalf("unexpected export headers: %#v", rows[0])
	}
	if rows[1][0] == "" || rows[1][3] == "" || rows[1][12] == "" || rows[1][13] == "" {
		t.Fatalf("expected key exported fields to be populated, got %#v", rows[1])
	}
	if rows[1][11] != "https://example.com/a.png | https://example.com/b.png" {
		t.Fatalf("unexpected referenceImageUrls export cell: %q", rows[1][11])
	}
}

func TestServiceRunNextAppliesFiltersAndSupportsEmptyWorkbook(t *testing.T) {
	pool := openProductRequestExportTestPool(t)
	resetProductRequestExportTables(t, pool)
	queries := db.New(pool)

	ctx := context.Background()
	oldRequest, err := queries.CreateProductRequest(ctx, db.CreateProductRequestParams{
		CreatedByUserID:    uuid.New(),
		OwnerSalesUserID:   pgtype.UUID{},
		Name:               "Old request",
		CategoryID:         pgtype.UUID{},
		ReferenceImageUrls: []string{},
	})
	if err != nil {
		t.Fatalf("seed old request: %v", err)
	}
	newRequest, err := queries.CreateProductRequest(ctx, db.CreateProductRequestParams{
		CreatedByUserID:    uuid.New(),
		OwnerSalesUserID:   pgtype.UUID{},
		Name:               "New request",
		CategoryID:         pgtype.UUID{},
		ReferenceImageUrls: []string{},
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
	service := NewService(pool, mediaDir, testMediaBaseURL)
	createdAfter := time.Date(2026, 3, 4, 0, 0, 0, 0, time.UTC)
	createdBefore := time.Date(2026, 3, 6, 0, 0, 0, 0, time.UTC)
	job, err := service.Enqueue(ctx, EnqueueInput{
		CreatedByUserID: pgtype.UUID{Bytes: uuid.New(), Valid: true},
		CreatedAfter:    &createdAfter,
		CreatedBefore:   &createdBefore,
	})
	if err != nil {
		t.Fatalf("enqueue filtered export: %v", err)
	}

	if _, err := service.RunNext(ctx); err != nil {
		t.Fatalf("run filtered export: %v", err)
	}

	importJob, err := queries.GetImportJob(ctx, job.ID)
	if err != nil {
		t.Fatalf("get filtered import job: %v", err)
	}
	rows := readExportWorkbookRows(t, mediaDir, *importJob.ResultFileUrl)
	if len(rows) != 2 {
		t.Fatalf("expected header plus one filtered row, got %d", len(rows))
	}
	if rows[1][3] != "New request" {
		t.Fatalf("expected only new request to be exported, got %#v", rows[1])
	}

	futureAfter := time.Date(2026, 3, 7, 0, 0, 0, 0, time.UTC)
	emptyJob, err := service.Enqueue(ctx, EnqueueInput{
		CreatedByUserID: pgtype.UUID{Bytes: uuid.New(), Valid: true},
		CreatedAfter:    &futureAfter,
	})
	if err != nil {
		t.Fatalf("enqueue empty export: %v", err)
	}
	if _, err := service.RunNext(ctx); err != nil {
		t.Fatalf("run empty export: %v", err)
	}

	emptyImportJob, err := queries.GetImportJob(ctx, emptyJob.ID)
	if err != nil {
		t.Fatalf("get empty import job: %v", err)
	}
	emptyRows := readExportWorkbookRows(t, mediaDir, *emptyImportJob.ResultFileUrl)
	if len(emptyRows) != 1 {
		t.Fatalf("expected header-only workbook, got %d rows", len(emptyRows))
	}
}

func TestServiceResetStaleRunningJobs(t *testing.T) {
	pool := openProductRequestExportTestPool(t)
	resetProductRequestExportTables(t, pool)
	queries := db.New(pool)

	ctx := context.Background()
	job, err := queries.CreateImportJob(ctx, db.CreateImportJobParams{
		Type:            string(oapi.ImportJobTypePRODUCTREQUESTEXPORT),
		Status:          string(oapi.RUNNING),
		Progress:        33,
		ResultFileUrl:   nil,
		ErrorReportUrl:  nil,
		CreatedByUserID: pgtype.UUID{Bytes: uuid.New(), Valid: true},
	})
	if err != nil {
		t.Fatalf("create import job: %v", err)
	}
	if _, err := queries.CreateProductRequestExportJob(ctx, db.CreateProductRequestExportJobParams{
		JobID:         job.ID,
		CreatedAfter:  pgtype.Timestamptz{},
		CreatedBefore: pgtype.Timestamptz{},
	}); err != nil {
		t.Fatalf("create export detail job: %v", err)
	}

	service := NewService(pool, t.TempDir(), testMediaBaseURL)
	if err := service.ResetStaleRunning(ctx); err != nil {
		t.Fatalf("reset stale running jobs: %v", err)
	}

	refreshed, err := queries.GetImportJob(ctx, job.ID)
	if err != nil {
		t.Fatalf("get reset import job: %v", err)
	}
	if refreshed.Status != string(oapi.PENDING) || refreshed.Progress != 0 {
		t.Fatalf("expected reset to PENDING/0, got %s/%d", refreshed.Status, refreshed.Progress)
	}
}

func openProductRequestExportTestPool(t *testing.T) *pgxpool.Pool {
	t.Helper()

	dsn := os.Getenv("COMMERCE_DB_DSN")
	if dsn == "" {
		t.Skip("COMMERCE_DB_DSN is not set; skipping integration test")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatalf("connect to database: %v", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		t.Fatalf("ping database: %v", err)
	}

	migrationsDir := filepath.Join("..", "..", "..", "migrations")
	if err := db.ApplyMigrations(ctx, pool, migrationsDir); err != nil {
		pool.Close()
		t.Fatalf("apply migrations: %v", err)
	}

	t.Cleanup(func() {
		pool.Close()
	})
	return pool
}

func resetProductRequestExportTables(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err := pool.Exec(ctx, `
TRUNCATE order_tracking_shipments,
import_jobs,
product_requests,
order_items,
orders,
cart_items,
cart_import_rows,
cart_import_jobs,
catalog_price_tiers,
catalog_skus,
catalog_products,
catalog_categories
RESTART IDENTITY CASCADE`)
	if err != nil {
		t.Fatalf("truncate tables: %v", err)
	}
}

func readExportWorkbookRows(t *testing.T, mediaDir, resultURL string) [][]string {
	t.Helper()

	relativePath := strings.TrimPrefix(resultURL, testMediaBaseURL+"/")
	file, err := excelize.OpenFile(filepath.Join(mediaDir, filepath.FromSlash(relativePath)))
	if err != nil {
		t.Fatalf("open export workbook: %v", err)
	}
	defer func() {
		_ = file.Close()
	}()

	rows, err := file.GetRows(excel.ProductRequestExportTemplate().SheetName)
	if err != nil {
		t.Fatalf("read export workbook rows: %v", err)
	}
	return rows
}

func stringPtr(value string) *string {
	return &value
}
