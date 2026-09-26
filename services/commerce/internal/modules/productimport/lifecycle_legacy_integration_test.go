package productimport

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/teamdsb/tmo/services/commerce/internal/db"
)

func TestLifecycleLegacyMigrationPreservesAuditAndStopsInterruptedWrites(t *testing.T) {
	pool := openProductImportTestPool(t)
	resetProductImportTables(t, pool)
	ctx := context.Background()
	q := db.New(pool)
	s := NewService(pool, t.TempDir(), testMediaBaseURL, nil)
	category, err := q.CreateCategory(ctx, db.CreateCategoryParams{Name: "Legacy category"})
	if err != nil {
		t.Fatal(err)
	}
	product, err := q.CreateProduct(ctx, db.CreateProductParams{Name: "Already committed", CategoryID: category.ID, Status: "DRAFT", Images: []string{}, Tags: []string{}, FilterDimensions: []string{"Size"}})
	if err != nil {
		t.Fatal(err)
	}
	sku, err := q.CreateSku(ctx, db.CreateSkuParams{ProductID: product.ID, Name: "No code SKU", Attributes: []byte(`{"Size":"10mm"}`), IsActive: true})
	if err != nil {
		t.Fatal(err)
	}
	oldRow := parsedRow{RowNumber: 2, GroupKey: "old-group", ProductName: product.Name, SkuName: sku.Name, CategoryID: category.ID, FilterDimensions: []string{"Size"}, Attributes: map[string]string{"Size": "10mm"}, IsActive: true, RawValues: map[string]string{"productname": product.Name, "unit": "box"}}
	payload := legacyRowPayload(t, oldRow)
	makeJob := func(status string, rows bool) uuid.UUID {
		t.Helper()
		job, err := q.CreateImportJob(ctx, db.CreateImportJobParams{Type: "PRODUCT_IMPORT", Status: status, ResultFileUrl: stringPointer("https://example.com/old-summary.json"), ErrorReportUrl: stringPointer("https://example.com/old-errors.csv")})
		if err != nil {
			t.Fatal(err)
		}
		_, err = pool.Exec(ctx, `INSERT INTO product_import_jobs (job_id,excel_file_path,excel_file_name,total_rows,success_rows,failed_rows) VALUES ($1,'old.xlsx','old.xlsx',2,1,1)`, job.ID)
		if err != nil {
			t.Fatal(err)
		}
		if rows {
			for i, rowStatus := range []string{"SUCCEEDED", "PENDING"} {
				row := oldRow
				row.RowNumber += i
				var productID, skuID pgtype.UUID
				if i == 0 {
					productID, skuID = pgtype.UUID{Bytes: product.ID, Valid: true}, pgtype.UUID{Bytes: sku.ID, Valid: true}
				} else if status != "RUNNING" && status != "PENDING" {
					rowStatus = "FAILED"
				}
				_, err := q.CreateProductImportRow(ctx, db.CreateProductImportRowParams{JobID: job.ID, LineNo: intToInt32(row.RowNumber), GroupKey: &row.GroupKey, ProductName: &row.ProductName, Status: rowStatus, RowData: legacyRowPayload(t, row), ProductID: productID, SkuID: skuID})
				if err != nil {
					t.Fatal(err)
				}
			}
		}
		return job.ID
	}
	// A new worker can be validating before its first parsed row exists.
	newJob, err := s.Enqueue(ctx, EnqueueInput{ExcelFile: bytes.NewReader([]byte("unused")), ExcelFileName: "new.xlsx"})
	if err != nil {
		t.Fatal(err)
	}
	claimed, err := q.ClaimProductImportLifecycle(ctx)
	if err != nil || claimed.JobID != newJob.ID {
		t.Fatal(claimed, err)
	}
	ids := []uuid.UUID{makeJob("SUCCEEDED", true), makeJob("FAILED", true), makeJob("RUNNING", true), makeJob("PENDING", true), makeJob("FAILED", false), makeJob("RUNNING", false)}
	pendingWorkbook := buildProductWorkbook(t, [][]string{productWorkbookRow(t, map[string]string{"groupkey": "pending", "productname": "Unstarted product", "skuname": "Unstarted SKU", "spec": "10mm", "categoryid": category.ID.String()})})
	pending, err := s.Enqueue(ctx, EnqueueInput{ExcelFile: bytes.NewReader(pendingWorkbook), ExcelFileName: "pending.xlsx"})
	if err != nil {
		t.Fatal(err)
	}
	for iteration := 0; iteration < 2; iteration++ {
		if err := db.ApplyMigrations(ctx, pool, filepath.Join("..", "..", "..", "migrations")); err != nil {
			t.Fatal(err)
		}
		for i, id := range ids {
			detail, err := s.GetJob(ctx, id)
			if err != nil || detail.Phase != "COMPLETED" || detail.Summary.TotalRows != 2 || detail.Summary.SuccessRows != 1 || detail.Summary.FailedRows != 1 {
				t.Fatalf("legacy %d iteration %d: %+v %v", i, iteration, detail, err)
			}
			if i == 0 && detail.Status != "SUCCEEDED" || i != 0 && detail.Status != "FAILED" {
				t.Fatalf("legacy status changed incorrectly: %+v", detail)
			}
			if detail.ResultFileURL == nil || *detail.ResultFileURL != "https://example.com/old-summary.json" || detail.ErrorReportURL == nil || *detail.ErrorReportURL != "https://example.com/old-errors.csv" {
				t.Fatal("legacy download audit lost", detail)
			}
			if _, err := s.Cancel(ctx, id, uuid.New()); !errors.Is(err, ErrConflict) {
				t.Fatal("legacy terminal was cancellable", err)
			}
			if i < 4 {
				preview, err := s.GetPreview(ctx, id, 1, 20, false)
				if err != nil || preview.Summary.SuccessRows != 1 || preview.Summary.FailedRows != 1 || len(preview.Items) != 1 || preview.Items[0].ProductName != product.Name || len(preview.Items[0].Rows) != 2 || preview.Items[0].Rows[0].SKUName != sku.Name || preview.Items[0].Rows[0].SourceRow != 2 || preview.Items[0].Rows[0].RawValues["unit"] != "box" {
					t.Fatalf("legacy preview lost original content: %+v %v", preview, err)
				}
				stored, err := q.ListProductImportRowsByJob(ctx, id)
				if err != nil || !stored[0].ProductID.Valid || uuid.UUID(stored[0].ProductID.Bytes) != product.ID || !stored[0].SkuID.Valid || uuid.UUID(stored[0].SkuID.Bytes) != sku.ID {
					t.Fatal("committed legacy identities lost", stored, err)
				}
				var payloadMatches bool
				if err := pool.QueryRow(ctx, "SELECT row_data=$2::jsonb FROM product_import_rows WHERE id=$1", stored[0].ID, payload).Scan(&payloadMatches); err != nil || !payloadMatches {
					t.Fatal("legacy source payload was overwritten", err)
				}
				if (i == 2 || i == 3) && (stored[1].Status != "FAILED" || stored[1].ErrorMessage == nil || !strings.Contains(*stored[1].ErrorMessage, "升级中断") || len(preview.Items[0].Rows[1].Issues) == 0) {
					t.Fatal("interrupted row lacks actionable explanation", stored[1])
				}
			}
		}
		current, err := q.GetProductImportLifecycle(ctx, newJob.ID)
		if err != nil || current.Phase != "VALIDATING" || current.LeaseToken != claimed.LeaseToken {
			t.Fatal("migration changed an active new worker", current, err)
		}
		unstarted, err := s.GetJob(ctx, pending.ID)
		if err != nil || unstarted.Status != "PENDING" || unstarted.Phase != "VALIDATE_PENDING" {
			t.Fatal("migration changed an unstarted job", unstarted, err)
		}
	}
	if processed, err := s.RunNext(ctx); err != nil || !processed {
		t.Fatal("unstarted legacy job did not reach preview", processed, err)
	}
	unstarted, err := s.GetJob(ctx, pending.ID)
	if err != nil || unstarted.Status != "AWAITING_CONFIRMATION" {
		t.Fatal("unstarted job was not preview-only", unstarted, err)
	}
	if processed, err := s.RunNext(ctx); err != nil || processed {
		t.Fatal("legacy jobs were reimported", processed, err)
	}
	var productCount, skuCount int
	if err := pool.QueryRow(ctx, "SELECT (SELECT count(*) FROM catalog_products),(SELECT count(*) FROM catalog_skus)").Scan(&productCount, &skuCount); err != nil || productCount != 1 || skuCount != 1 {
		t.Fatal("upgrade duplicated committed no-code catalog rows", productCount, skuCount, err)
	}
}

func stringPointer(value string) *string { return &value }

func legacyRowPayload(t *testing.T, row parsedRow) []byte {
	t.Helper()
	payload, err := json.Marshal(map[string]interface{}{
		"productId": row.ProductID, "skuId": row.SkuID, "productStatus": row.ProductStatus,
		"noSKU": row.NoSKU, "rowNumber": row.RowNumber, "groupKey": row.GroupKey,
		"skuCode": row.SkuCode, "productName": row.ProductName, "skuName": row.SkuName,
		"categoryId": row.CategoryID.String(), "description": derefString(row.Description),
		"coverImage": row.CoverImageRef, "images": row.ImageRefs, "tags": row.Tags,
		"filterDimensions": row.FilterDimensions, "spec": derefString(row.Spec),
		"attributes": row.Attributes, "unit": derefString(row.Unit), "isActive": row.IsActive,
		"priceTiers": row.PriceTiers, "rawValues": row.RawValues,
	})
	if err != nil {
		t.Fatal(err)
	}
	return payload
}
