package handler

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

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
	"github.com/teamdsb/tmo/services/commerce/internal/modules/productimport"
)

func TestAdminProductImportJobRequiresExcelFile(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)
	queries := db.New(pool)

	router, _ := newAuthRouterWithProductImport(pool, queries, t.TempDir(), "http://localhost:8080/assets/media")

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	if err := writer.WriteField("imageBaseUrl", "https://cdn.example.com/catalog"); err != nil {
		t.Fatalf("write imageBaseUrl field: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/admin/products/import-jobs", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+makeAuthToken(t, uuid.New(), "ADMIN", nil))
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d: %s", recorder.Code, recorder.Body.String())
	}
}

func TestAdminProductImportJobCreateAndQuery(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)
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

	mediaDir := t.TempDir()
	router, service := newAuthRouterWithProductImport(pool, queries, mediaDir, "http://localhost:8080/assets/media")
	workbook := buildAdminProductWorkbook(t, [][]string{
		adminProductWorkbookRow(t, map[string]string{
			"groupkey":         "admin-job",
			"skucode":          "ADMIN-JOB-1",
			"productname":      "Admin Imported Product",
			"skuname":          "Admin Imported SKU",
			"categoryid":       category.ID.String(),
			"coverimage":       "main.png",
			"images":           "main.png|detail.png",
			"tags":             "fastener|steel",
			"filterdimensions": "material|size",
			"attributes":       "material:steel|size:M6",
			"pricetiers":       "1-:1000",
		}),
	})
	imagesZip := buildAdminZipArchive(t, map[string][]byte{
		"main.png":   adminPNGBytes(),
		"detail.png": adminPNGBytes(),
	})

	req := multipartProductImportRequest(t, "/admin/products/import-jobs", workbook, imagesZip, "https://cdn.example.com/catalog")
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

	productJob, err := queries.GetProductImportJob(ctx, uuid.UUID(created.Id))
	if err != nil {
		t.Fatalf("get product import job: %v", err)
	}
	if productJob.ImageBaseUrl == nil || *productJob.ImageBaseUrl != "https://cdn.example.com/catalog" {
		t.Fatalf("unexpected imageBaseUrl: %#v", productJob.ImageBaseUrl)
	}
	if productJob.ImagesZipName == nil || *productJob.ImagesZipName != "images.zip" {
		t.Fatalf("unexpected imagesZipName: %#v", productJob.ImagesZipName)
	}
	if _, err := os.Stat(productJob.ExcelFilePath); err != nil {
		t.Fatalf("expected excel file to be written: %v", err)
	}

	if _, err := service.RunNext(ctx); err != nil {
		t.Fatalf("run next product import job: %v", err)
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
}

func newAuthRouterWithProductImport(pool *pgxpool.Pool, store *db.Queries, mediaLocalDir, mediaBaseURL string) (*gin.Engine, *productimport.Service) {
	gin.SetMode(gin.TestMode)
	router := httpx.NewRouter()
	authenticator := middleware.NewAuthenticator(true, testJWTSecret, testJWTIssuer)
	productImportService := productimport.NewService(pool, mediaLocalDir, mediaBaseURL, nil)
	handler := &Handler{
		CatalogStore:        store,
		TrackingStore:       store,
		ProductImport:       productImportService,
		MediaLocalOutputDir: mediaLocalDir,
		MediaPublicBaseURL:  mediaBaseURL,
		DB:                  pool,
		Auth:                authenticator,
	}
	oapi.RegisterHandlers(router, handler)
	router.POST("/admin/products/import-jobs", handler.PostAdminProductsImportJobs)
	router.GET("/admin/import-jobs/:jobId", handler.GetAdminImportJobsJobId)
	return router, productImportService
}

func multipartProductImportRequest(t *testing.T, path string, workbook, imagesZip []byte, imageBaseURL string) *http.Request {
	t.Helper()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	excelPart, err := writer.CreateFormFile("excelFile", "products.xlsx")
	if err != nil {
		t.Fatalf("create excel file part: %v", err)
	}
	if _, err := excelPart.Write(workbook); err != nil {
		t.Fatalf("write excel file part: %v", err)
	}

	if len(imagesZip) > 0 {
		zipPart, err := writer.CreateFormFile("imagesZip", "images.zip")
		if err != nil {
			t.Fatalf("create zip file part: %v", err)
		}
		if _, err := zipPart.Write(imagesZip); err != nil {
			t.Fatalf("write zip file part: %v", err)
		}
	}

	if imageBaseURL != "" {
		if err := writer.WriteField("imageBaseUrl", imageBaseURL); err != nil {
			t.Fatalf("write imageBaseUrl field: %v", err)
		}
	}

	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, path, &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	return req
}

func buildAdminProductWorkbook(t *testing.T, dataRows [][]string) []byte {
	t.Helper()

	file := excelize.NewFile()
	sheet := file.GetSheetName(0)
	headers := excel.TemplateHeaders(excel.ProductImportTemplate())
	allRows := append([][]string{headers}, dataRows...)
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

func adminProductWorkbookRow(t *testing.T, values map[string]string) []string {
	t.Helper()

	spec := excel.ProductImportTemplate()
	row := make([]string, len(spec.Columns))
	for index, column := range spec.Columns {
		row[index] = values[column.Key]
	}
	return row
}

func buildAdminZipArchive(t *testing.T, files map[string][]byte) []byte {
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

func adminPNGBytes() []byte {
	return []byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D}
}
