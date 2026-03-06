package productimport

import (
	"archive/zip"
	"bytes"
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

func TestServiceRunNextCreatesMultiSkuProductWithZipImages(t *testing.T) {
	pool := openProductImportTestPool(t)
	resetProductImportTables(t, pool)
	queries := db.New(pool)

	ctx := context.Background()
	category, err := queries.CreateCategory(ctx, db.CreateCategoryParams{
		Name:     "Fasteners",
		ParentID: pgtype.UUID{},
		Sort:     1,
	})
	if err != nil {
		t.Fatalf("create category: %v", err)
	}

	workbook := buildProductWorkbook(t, [][]string{
		productWorkbookRow(t, map[string]string{
			"groupkey":         "bolt-a",
			"skucode":          "BOLT-A-M6",
			"productname":      "Bolt A",
			"skuname":          "Bolt A M6",
			"categoryid":       category.ID.String(),
			"description":      "galvanized bolt",
			"coverimage":       "main.png",
			"images":           "main.png|detail.png",
			"tags":             "fastener|steel",
			"filterdimensions": "material|length|size",
			"spec":             "M6",
			"attributes":       "material:steel|length:10mm|size:M6",
			"unit":             "pcs",
			"isactive":         "true",
			"pricetiers":       "1-9:1200|10-:1000",
		}),
		productWorkbookRow(t, map[string]string{
			"groupkey":         "bolt-a",
			"skucode":          "BOLT-A-M8",
			"productname":      "Bolt A",
			"skuname":          "Bolt A M8",
			"categoryid":       category.ID.String(),
			"description":      "galvanized bolt",
			"coverimage":       "main.png",
			"images":           "main.png|detail.png",
			"tags":             "fastener|steel",
			"filterdimensions": "material|length|size",
			"spec":             "M8",
			"attributes":       "material:steel|length:12mm|size:M8",
			"unit":             "pcs",
			"isactive":         "true",
			"pricetiers":       "1-9:1400|10-:1100",
		}),
	})
	imagesZip := buildZipArchive(t, map[string][]byte{
		"main.png":   pngBytes(),
		"detail.png": pngBytes(),
	})

	service := NewService(pool, t.TempDir(), testMediaBaseURL, nil)
	job, err := service.Enqueue(ctx, EnqueueInput{
		CreatedByUserID:   pgtype.UUID{Bytes: uuid.New(), Valid: true},
		ExcelFile:         bytes.NewReader(workbook),
		ExcelFileName:     "products.xlsx",
		ImagesZipFile:     bytes.NewReader(imagesZip),
		ImagesZipFileName: "images.zip",
	})
	if err != nil {
		t.Fatalf("enqueue product import: %v", err)
	}

	processed, err := service.RunNext(ctx)
	if err != nil {
		t.Fatalf("run next job: %v", err)
	}
	if !processed {
		t.Fatalf("expected a pending product import job to be processed")
	}

	importJob, err := queries.GetImportJob(ctx, job.ID)
	if err != nil {
		t.Fatalf("get import job: %v", err)
	}
	if importJob.Status != string(oapi.SUCCEEDED) {
		t.Fatalf("expected job status SUCCEEDED, got %s", importJob.Status)
	}
	if importJob.ResultFileUrl == nil || *importJob.ResultFileUrl == "" {
		t.Fatalf("expected resultFileUrl to be set")
	}
	if importJob.ErrorReportUrl != nil {
		t.Fatalf("expected no errorReportUrl, got %q", *importJob.ErrorReportUrl)
	}

	productJob, err := queries.GetProductImportJob(ctx, job.ID)
	if err != nil {
		t.Fatalf("get product import job: %v", err)
	}
	if productJob.TotalRows != 2 || productJob.SuccessRows != 2 || productJob.FailedRows != 0 {
		t.Fatalf("unexpected row counts: %+v", productJob)
	}

	products, err := queries.ListProducts(ctx, db.ListProductsParams{Offset: 0, Limit: 20})
	if err != nil {
		t.Fatalf("list products: %v", err)
	}
	if len(products) != 1 {
		t.Fatalf("expected 1 product, got %d", len(products))
	}
	product := products[0]
	if product.CoverImageUrl == nil || !strings.Contains(*product.CoverImageUrl, "/import-jobs/") {
		t.Fatalf("expected managed cover image URL, got %#v", product.CoverImageUrl)
	}
	if len(product.Images) != 2 {
		t.Fatalf("expected 2 product images, got %d", len(product.Images))
	}

	skus, err := queries.ListSkusByProduct(ctx, product.ID)
	if err != nil {
		t.Fatalf("list skus: %v", err)
	}
	if len(skus) != 2 {
		t.Fatalf("expected 2 skus, got %d", len(skus))
	}

	tiersA, err := queries.ListPriceTiersBySku(ctx, skus[0].ID)
	if err != nil {
		t.Fatalf("list price tiers for first sku: %v", err)
	}
	tiersB, err := queries.ListPriceTiersBySku(ctx, skus[1].ID)
	if err != nil {
		t.Fatalf("list price tiers for second sku: %v", err)
	}
	if len(tiersA) != 2 || len(tiersB) != 2 {
		t.Fatalf("expected 2 tiers per sku, got %d and %d", len(tiersA), len(tiersB))
	}
}

func TestServiceRunNextStoresEmptyArraysAsEmptySlices(t *testing.T) {
	pool := openProductImportTestPool(t)
	resetProductImportTables(t, pool)
	queries := db.New(pool)

	ctx := context.Background()
	category, err := queries.CreateCategory(ctx, db.CreateCategoryParams{
		Name:     "Fasteners",
		ParentID: pgtype.UUID{},
		Sort:     1,
	})
	if err != nil {
		t.Fatalf("create category: %v", err)
	}

	workbook := buildProductWorkbook(t, [][]string{
		productWorkbookRow(t, map[string]string{
			"groupkey":    "empty-arrays",
			"skucode":     "EMPTY-ARRAYS-1",
			"productname": "Arrayless Product",
			"skuname":     "Arrayless SKU",
			"categoryid":  category.ID.String(),
			"attributes":  "material:steel",
			"pricetiers":  "1-:1000",
		}),
	})

	service := NewService(pool, t.TempDir(), testMediaBaseURL, nil)
	if _, err := service.Enqueue(ctx, EnqueueInput{
		CreatedByUserID: pgtype.UUID{Bytes: uuid.New(), Valid: true},
		ExcelFile:       bytes.NewReader(workbook),
		ExcelFileName:   "empty-arrays.xlsx",
	}); err != nil {
		t.Fatalf("enqueue import: %v", err)
	}

	if _, err := service.RunNext(ctx); err != nil {
		t.Fatalf("run next job: %v", err)
	}

	products, err := queries.ListProducts(ctx, db.ListProductsParams{Offset: 0, Limit: 20})
	if err != nil {
		t.Fatalf("list products: %v", err)
	}
	if len(products) != 1 {
		t.Fatalf("expected 1 product, got %d", len(products))
	}
	if len(products[0].Images) != 0 {
		t.Fatalf("expected empty images slice, got %#v", products[0].Images)
	}
	if len(products[0].Tags) != 0 {
		t.Fatalf("expected empty tags slice, got %#v", products[0].Tags)
	}
	if len(products[0].FilterDimensions) != 0 {
		t.Fatalf("expected empty filterDimensions slice, got %#v", products[0].FilterDimensions)
	}
}

func TestServiceRunNextUpdatesExistingSkuBySkuCode(t *testing.T) {
	pool := openProductImportTestPool(t)
	resetProductImportTables(t, pool)
	queries := db.New(pool)

	ctx := context.Background()
	category, err := queries.CreateCategory(ctx, db.CreateCategoryParams{
		Name:     "Fasteners",
		ParentID: pgtype.UUID{},
		Sort:     1,
	})
	if err != nil {
		t.Fatalf("create category: %v", err)
	}
	product, err := queries.CreateProduct(ctx, db.CreateProductParams{
		Name:             "Old Bolt",
		Description:      stringPtr("old description"),
		CategoryID:       category.ID,
		CoverImageUrl:    stringPtr("https://old.example.com/old.png"),
		Images:           []string{"https://old.example.com/old.png"},
		Tags:             []string{"legacy"},
		FilterDimensions: []string{"material"},
	})
	if err != nil {
		t.Fatalf("seed product: %v", err)
	}
	sku, err := queries.CreateSku(ctx, db.CreateSkuParams{
		ProductID:  product.ID,
		SkuCode:    stringPtr("BOLT-UPD-01"),
		Name:       "Old Bolt SKU",
		Spec:       stringPtr("OLD"),
		Attributes: []byte(`{"material":"steel"}`),
		Unit:       stringPtr("pcs"),
		IsActive:   true,
	})
	if err != nil {
		t.Fatalf("seed sku: %v", err)
	}
	if _, err := queries.CreatePriceTier(ctx, db.CreatePriceTierParams{
		SkuID:        sku.ID,
		MinQty:       1,
		MaxQty:       nil,
		UnitPriceFen: 9999,
	}); err != nil {
		t.Fatalf("seed price tier: %v", err)
	}

	workbook := buildProductWorkbook(t, [][]string{
		productWorkbookRow(t, map[string]string{
			"groupkey":         "bolt-upd",
			"skucode":          "BOLT-UPD-01",
			"productname":      "Updated Bolt",
			"skuname":          "Updated Bolt SKU",
			"categoryid":       category.ID.String(),
			"description":      "new description",
			"coverimage":       "catalog/updated.png",
			"images":           "catalog/updated.png|catalog/detail.png",
			"tags":             "updated|steel",
			"filterdimensions": "material|size",
			"spec":             "M10",
			"attributes":       "material:stainless|size:M10",
			"unit":             "box",
			"isactive":         "false",
			"pricetiers":       "1-:4500",
		}),
	})

	service := NewService(pool, t.TempDir(), testMediaBaseURL, nil)
	job, err := service.Enqueue(ctx, EnqueueInput{
		CreatedByUserID: pgtype.UUID{Bytes: uuid.New(), Valid: true},
		ExcelFile:       bytes.NewReader(workbook),
		ExcelFileName:   "update.xlsx",
		ImageBaseURL:    "https://cdn.example.com/assets",
	})
	if err != nil {
		t.Fatalf("enqueue update import: %v", err)
	}

	if _, err := service.RunNext(ctx); err != nil {
		t.Fatalf("run next update job: %v", err)
	}

	importJob, err := queries.GetImportJob(ctx, job.ID)
	if err != nil {
		t.Fatalf("get import job: %v", err)
	}
	if importJob.Status != string(oapi.SUCCEEDED) {
		t.Fatalf("expected SUCCEEDED status, got %s", importJob.Status)
	}

	updatedProduct, err := queries.GetProduct(ctx, product.ID)
	if err != nil {
		t.Fatalf("get updated product: %v", err)
	}
	if updatedProduct.Name != "Updated Bolt" {
		t.Fatalf("expected product name to update, got %s", updatedProduct.Name)
	}
	if updatedProduct.CoverImageUrl == nil || *updatedProduct.CoverImageUrl != "https://cdn.example.com/assets/catalog/updated.png" {
		t.Fatalf("unexpected cover image URL: %#v", updatedProduct.CoverImageUrl)
	}

	updatedSkus, err := queries.ListSkusByProduct(ctx, product.ID)
	if err != nil {
		t.Fatalf("list updated skus: %v", err)
	}
	if len(updatedSkus) != 1 {
		t.Fatalf("expected 1 sku, got %d", len(updatedSkus))
	}
	if updatedSkus[0].Spec == nil || *updatedSkus[0].Spec != "M10" {
		t.Fatalf("expected spec M10, got %#v", updatedSkus[0].Spec)
	}
	if updatedSkus[0].IsActive {
		t.Fatalf("expected sku to become inactive")
	}

	tiers, err := queries.ListPriceTiersBySku(ctx, updatedSkus[0].ID)
	if err != nil {
		t.Fatalf("list updated tiers: %v", err)
	}
	if len(tiers) != 1 || tiers[0].UnitPriceFen != 4500 {
		t.Fatalf("expected old tiers to be replaced, got %+v", tiers)
	}
}

func TestServiceRunNextMarksMalformedWorkbookAsFailed(t *testing.T) {
	pool := openProductImportTestPool(t)
	resetProductImportTables(t, pool)
	queries := db.New(pool)

	ctx := context.Background()
	service := NewService(pool, t.TempDir(), testMediaBaseURL, nil)
	job, err := service.Enqueue(ctx, EnqueueInput{
		CreatedByUserID: pgtype.UUID{Bytes: uuid.New(), Valid: true},
		ExcelFile:       bytes.NewBufferString("not-an-excel-file"),
		ExcelFileName:   "broken.xlsx",
	})
	if err != nil {
		t.Fatalf("enqueue malformed workbook: %v", err)
	}

	processed, err := service.RunNext(ctx)
	if err != nil {
		t.Fatalf("run next job: %v", err)
	}
	if !processed {
		t.Fatalf("expected malformed job to be processed")
	}

	importJob, err := queries.GetImportJob(ctx, job.ID)
	if err != nil {
		t.Fatalf("get import job: %v", err)
	}
	if importJob.Status != string(oapi.FAILED) {
		t.Fatalf("expected FAILED status, got %s", importJob.Status)
	}
	if importJob.ErrorReportUrl == nil || *importJob.ErrorReportUrl == "" {
		t.Fatalf("expected fatal errorReportUrl to be set")
	}
}

func TestServiceRunNextSupportsPartialSuccessAndWritesErrorReport(t *testing.T) {
	pool := openProductImportTestPool(t)
	resetProductImportTables(t, pool)
	queries := db.New(pool)

	ctx := context.Background()
	category, err := queries.CreateCategory(ctx, db.CreateCategoryParams{
		Name:     "Fasteners",
		ParentID: pgtype.UUID{},
		Sort:     1,
	})
	if err != nil {
		t.Fatalf("create category: %v", err)
	}

	workbook := buildProductWorkbook(t, [][]string{
		productWorkbookRow(t, map[string]string{
			"groupkey":    "ok-row",
			"skucode":     "OK-SKU-1",
			"productname": "Okay Product",
			"skuname":     "Okay Product SKU",
			"categoryid":  category.ID.String(),
			"description": "valid row",
			"spec":        "OK",
			"attributes":  "material:steel",
			"unit":        "pcs",
			"isactive":    "true",
			"pricetiers":  "1-:1000",
		}),
		productWorkbookRow(t, map[string]string{
			"groupkey":    "bad-row",
			"skucode":     "BAD-SKU-1",
			"productname": "Broken Product",
			"skuname":     "Broken Product SKU",
			"categoryid":  category.ID.String(),
			"description": "invalid row",
			"spec":        "BAD",
			"attributes":  "material:steel",
			"unit":        "pcs",
			"isactive":    "true",
			"pricetiers":  "oops",
		}),
	})

	mediaDir := t.TempDir()
	service := NewService(pool, mediaDir, testMediaBaseURL, nil)
	job, err := service.Enqueue(ctx, EnqueueInput{
		CreatedByUserID: pgtype.UUID{Bytes: uuid.New(), Valid: true},
		ExcelFile:       bytes.NewReader(workbook),
		ExcelFileName:   "partial.xlsx",
	})
	if err != nil {
		t.Fatalf("enqueue partial import: %v", err)
	}

	if _, err := service.RunNext(ctx); err != nil {
		t.Fatalf("run next partial job: %v", err)
	}

	importJob, err := queries.GetImportJob(ctx, job.ID)
	if err != nil {
		t.Fatalf("get import job: %v", err)
	}
	if importJob.Status != string(oapi.SUCCEEDED) {
		t.Fatalf("expected SUCCEEDED status, got %s", importJob.Status)
	}
	if importJob.ErrorReportUrl == nil || *importJob.ErrorReportUrl == "" {
		t.Fatalf("expected errorReportUrl to be set")
	}

	productJob, err := queries.GetProductImportJob(ctx, job.ID)
	if err != nil {
		t.Fatalf("get product import job: %v", err)
	}
	if productJob.TotalRows != 2 || productJob.SuccessRows != 1 || productJob.FailedRows != 1 {
		t.Fatalf("unexpected partial row counts: %+v", productJob)
	}

	rows, err := queries.ListProductImportRowsByJob(ctx, job.ID)
	if err != nil {
		t.Fatalf("list product import rows: %v", err)
	}
	if len(rows) != 2 {
		t.Fatalf("expected 2 import rows, got %d", len(rows))
	}

	products, err := queries.ListProducts(ctx, db.ListProductsParams{Offset: 0, Limit: 20})
	if err != nil {
		t.Fatalf("list products: %v", err)
	}
	if len(products) != 1 {
		t.Fatalf("expected only the valid row to create a product, got %d", len(products))
	}

	reportPath := strings.TrimPrefix(*importJob.ErrorReportUrl, strings.TrimRight(testMediaBaseURL, "/")+"/")
	reportBytes, err := os.ReadFile(filepath.Join(mediaDir, filepath.FromSlash(reportPath)))
	if err != nil {
		t.Fatalf("read error report: %v", err)
	}
	if !strings.Contains(string(reportBytes), "priceTiers must use range:price format") {
		t.Fatalf("expected detailed error report, got %s", string(reportBytes))
	}
}

func openProductImportTestPool(t *testing.T) *pgxpool.Pool {
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

func resetProductImportTables(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err := pool.Exec(ctx, `
TRUNCATE product_import_rows,
product_import_jobs,
order_tracking_shipments,
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

func buildProductWorkbook(t *testing.T, dataRows [][]string) []byte {
	t.Helper()

	file := excelize.NewFile()
	sheet := file.GetSheetName(0)
	headers := excel.TemplateHeaders(excel.ProductImportTemplate())
	allRows := make([][]string, 0, len(dataRows)+1)
	allRows = append(allRows, headers)
	allRows = append(allRows, dataRows...)

	for rowIndex, row := range allRows {
		for columnIndex, value := range row {
			cell, err := excelize.CoordinatesToCellName(columnIndex+1, rowIndex+1)
			if err != nil {
				t.Fatalf("coordinates to cell name: %v", err)
			}
			if err := file.SetCellValue(sheet, cell, value); err != nil {
				t.Fatalf("set cell value: %v", err)
			}
		}
	}

	var buffer bytes.Buffer
	if err := file.Write(&buffer); err != nil {
		t.Fatalf("write workbook: %v", err)
	}
	return buffer.Bytes()
}

func productWorkbookRow(t *testing.T, values map[string]string) []string {
	t.Helper()

	spec := excel.ProductImportTemplate()
	row := make([]string, len(spec.Columns))
	for index, column := range spec.Columns {
		row[index] = values[column.Key]
	}
	return row
}

func buildZipArchive(t *testing.T, files map[string][]byte) []byte {
	t.Helper()

	var buffer bytes.Buffer
	writer := zip.NewWriter(&buffer)
	for name, contents := range files {
		entry, err := writer.Create(name)
		if err != nil {
			t.Fatalf("create zip entry: %v", err)
		}
		if _, err := entry.Write(contents); err != nil {
			t.Fatalf("write zip entry: %v", err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close zip writer: %v", err)
	}
	return buffer.Bytes()
}

func pngBytes() []byte {
	return []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D}
}

func stringPtr(value string) *string {
	return &value
}
