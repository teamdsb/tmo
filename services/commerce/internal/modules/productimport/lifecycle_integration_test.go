package productimport

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/excel"
	"github.com/xuri/excelize/v2"
)

func enqueuePreview(t *testing.T, s *Service, data []byte) Preview {
	t.Helper()
	ctx := context.Background()
	job, err := s.Enqueue(ctx, EnqueueInput{ExcelFile: bytes.NewReader(data), ExcelFileName: "source.xlsx"})
	if err != nil {
		t.Fatal(err)
	}
	if ok, err := s.RunNext(ctx); err != nil || !ok {
		t.Fatalf("prepare preview: %v %v", ok, err)
	}
	preview, err := s.GetPreview(ctx, job.ID, 1, 200, false)
	if err != nil {
		t.Fatal(err)
	}
	detail, err := s.GetJob(ctx, job.ID)
	if err != nil || detail.Status != "AWAITING_CONFIRMATION" {
		t.Fatalf("unexpected job: %+v %v", detail, err)
	}
	return preview
}

// Existing catalog fixtures now pass through the same explicit confirmation boundary.
func runPreparedImport(t *testing.T, s *Service, ctx context.Context, id uuid.UUID) (bool, error) {
	t.Helper()
	ok, err := s.RunNext(ctx)
	if err != nil || !ok {
		return ok, err
	}
	detail, err := s.GetJob(ctx, id)
	if err != nil {
		return ok, err
	}
	if detail.Status != "AWAITING_CONFIRMATION" || detail.Summary.FailedRows > 0 {
		return ok, nil
	}
	if _, err := s.Confirm(ctx, id, detail.Revision, uuid.New(), uuid.NewString()); err != nil {
		return true, err
	}
	return s.RunNext(ctx)
}

func confirmPreview(t *testing.T, s *Service, preview Preview) JobDetail {
	t.Helper()
	ctx := context.Background()
	if _, err := s.Confirm(ctx, preview.JobID, preview.Revision, uuid.New(), uuid.NewString()); err != nil {
		t.Fatal(err)
	}
	if ok, err := s.RunNext(ctx); err != nil || !ok {
		t.Fatalf("commit: %v %v", ok, err)
	}
	result, err := s.GetJob(ctx, preview.JobID)
	if err != nil {
		t.Fatal(err)
	}
	if result.Status == "FAILED" && result.ErrorReportURL != nil {
		relative := strings.TrimPrefix(*result.ErrorReportURL, testMediaBaseURL+"/")
		if report, readErr := os.ReadFile(filepath.Join(s.MediaLocalOutputDir, filepath.FromSlash(relative))); readErr == nil {
			t.Logf("failure report: %s", report)
		}
	}
	return result
}

func legacyWorkbook(t *testing.T, rows [][]string) []byte {
	t.Helper()
	file := excelize.NewFile()
	defer func() { _ = file.Close() }()
	all := append([][]string{{"序号", "物资", "规格型号", "单位", "分类"}}, rows...)
	for index, row := range all {
		cell, _ := excelize.CoordinatesToCellName(1, index+1)
		if err := file.SetSheetRow("Sheet1", cell, &row); err != nil {
			t.Fatal(err)
		}
	}
	buffer, err := file.WriteToBuffer()
	if err != nil {
		t.Fatal(err)
	}
	return buffer.Bytes()
}

func TestLifecyclePreviewRevisionConfirmationAndBlankPreservation(t *testing.T) {
	pool := openProductImportTestPool(t)
	resetProductImportTables(t, pool)
	ctx := context.Background()
	q := db.New(pool)
	category, err := q.CreateCategory(ctx, db.CreateCategoryParams{Name: "测试分类", Sort: 1})
	if err != nil {
		t.Fatal(err)
	}
	s := NewService(pool, t.TempDir(), testMediaBaseURL, nil)
	fields := map[string]string{"groupkey": "a", "productname": "商品", "skuname": "型号", "skucode": "LIFECYCLE-1", "categoryid": category.ID.String(), "spec1name": "尺寸", "spec1value": "10mm", "description": "keep description", "images": "https://example.com/p.png", "tags": "tag", "unit": "件", "pricetiers": "1-:1200"}
	preview := enqueuePreview(t, s, buildProductWorkbook(t, [][]string{productWorkbookRow(t, fields)}))
	products, err := q.ListProducts(ctx, db.ListProductsParams{Limit: 20})
	if err != nil || len(products) != 0 {
		t.Fatal("preview mutated catalog", products, err)
	}
	if _, err := s.Confirm(ctx, preview.JobID, preview.Revision+1, uuid.New(), "stale"); !errors.Is(err, ErrConflict) {
		t.Fatalf("stale confirmation: %v", err)
	}
	key := uuid.NewString()
	actor := uuid.New()
	if _, err := s.Confirm(ctx, preview.JobID, preview.Revision, actor, key); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Confirm(ctx, preview.JobID, preview.Revision, actor, key); err != nil {
		t.Fatal("same confirmation must be idempotent", err)
	}
	if _, err := s.Confirm(ctx, preview.JobID, preview.Revision, actor, "different"); !errors.Is(err, ErrConflict) {
		t.Fatal(err)
	}
	if _, err := s.RunNext(ctx); err != nil {
		t.Fatal(err)
	}
	first, err := s.GetJob(ctx, preview.JobID)
	if err != nil || first.Status != "SUCCEEDED" {
		t.Fatalf("commit: %+v %v", first, err)
	}
	products, err = q.ListProducts(ctx, db.ListProductsParams{Limit: 20})
	if err != nil || len(products) != 1 {
		t.Fatal(products, err)
	}
	skus, err := q.ListSkusByProduct(ctx, products[0].ID)
	if err != nil || len(skus) != 1 {
		t.Fatal(skus, err)
	}
	fields["productid"], fields["skuid"] = products[0].ID.String(), skus[0].ID.String()
	for _, key := range []string{"description", "images", "tags", "unit", "pricetiers"} {
		fields[key] = ""
	}
	second := confirmPreview(t, s, enqueuePreview(t, s, buildProductWorkbook(t, [][]string{productWorkbookRow(t, fields)})))
	if second.Status != "SUCCEEDED" {
		t.Fatalf("blank update: %+v", second)
	}
	product, err := q.GetProduct(ctx, products[0].ID)
	if err != nil {
		t.Fatal(err)
	}
	skus, err = q.ListSkusByProduct(ctx, products[0].ID)
	if err != nil {
		t.Fatal(err)
	}
	tiers, err := q.ListPriceTiersBySku(ctx, skus[0].ID)
	if err != nil {
		t.Fatal(err)
	}
	if derefString(product.Description) != "keep description" || len(product.Images) != 1 || len(product.Tags) != 1 || derefString(skus[0].Unit) != "件" || len(tiers) != 1 || tiers[0].UnitPriceFen != 1200 {
		t.Fatalf("blank cells cleared values: %+v %+v %+v", product, skus, tiers)
	}
	third := enqueuePreview(t, s, buildProductWorkbook(t, [][]string{productWorkbookRow(t, fields)}))
	resolution := ResolutionInput{ExpectedRevision: third.Revision, Groups: []GroupResolution{{Key: third.Items[0].Key, Rows: []RowResolution{{RowID: third.Items[0].Rows[0].RowID, ClearFields: []string{"description", "images", "tags", "unit", "priceTiers"}}}}}}
	third, err = s.ResolvePreview(ctx, third.JobID, resolution)
	if err != nil {
		t.Fatal(err)
	}
	if result := confirmPreview(t, s, third); result.Status != "SUCCEEDED" {
		t.Fatal(result)
	}
	product, _ = q.GetProduct(ctx, products[0].ID)
	skus, _ = q.ListSkusByProduct(ctx, product.ID)
	tiers, _ = q.ListPriceTiersBySku(ctx, skus[0].ID)
	if product.Description != nil || len(product.Images) != 0 || len(product.Tags) != 0 || skus[0].Unit != nil || len(tiers) != 0 {
		t.Fatal("explicit clear was not applied")
	}
}

func TestLifecycleLegacySplitReviewsAndReorderedReplay(t *testing.T) {
	pool := openProductImportTestPool(t)
	resetProductImportTables(t, pool)
	ctx := context.Background()
	q := db.New(pool)
	s := NewService(pool, t.TempDir(), testMediaBaseURL, nil)
	rows := [][]string{{"1", "纸箱", "620*600*340", "个", "未知分类"}, {"2", "辅料", "A-1", "个", ""}}
	preview := enqueuePreview(t, s, legacyWorkbook(t, rows))
	if preview.Summary.SplitProducts != 2 {
		t.Fatalf("split preview: %+v", preview)
	}
	result := confirmPreview(t, s, preview)
	if result.Status != "SUCCEEDED" || result.Summary.ReviewCount != 2 {
		t.Fatalf("result: %+v", result)
	}
	products, err := q.ListProducts(ctx, db.ListProductsParams{Limit: 20})
	if err != nil || len(products) != 2 {
		t.Fatal(products, err)
	}
	for _, product := range products {
		if product.Status != "DRAFT" {
			t.Fatalf("split is live: %+v", product)
		}
	}
	reviews, err := s.ListReviews(ctx, 1, 100, "PENDING", uuid.Nil)
	if err != nil || reviews.Total < 2 {
		t.Fatal(reviews, err)
	}
	if _, err := s.ResolveReview(ctx, reviews.Items[0].ID, uuid.New()); !errors.Is(err, ErrInvalid) {
		t.Fatalf("uncategorized review resolved: %v", err)
	}
	if _, err := pool.Exec(ctx, "UPDATE catalog_products SET name='管理员已修正',updated_at=now() WHERE id=$1", products[0].ID); err != nil {
		t.Fatal(err)
	}
	reversed := [][]string{{"99", "辅料", "A-1", "个", ""}, {"", "纸箱", "620*600*340", "个", "未知分类"}}
	replay := confirmPreview(t, s, enqueuePreview(t, s, legacyWorkbook(t, reversed)))
	if replay.Summary.SkippedRows != 2 || replay.Summary.ProductCreates != 0 {
		t.Fatalf("replay duplicated: %+v", replay)
	}
	product, err := q.GetProduct(ctx, products[0].ID)
	if err != nil || product.Name != "管理员已修正" {
		t.Fatal("manual correction lost", product, err)
	}
	after, err := s.ListReviews(ctx, 1, 100, "PENDING", uuid.Nil)
	if err != nil || after.Total != reviews.Total {
		t.Fatal("duplicate review", after, err)
	}
}

func TestLifecycleSnapshotAndLeaseFencing(t *testing.T) {
	pool := openProductImportTestPool(t)
	resetProductImportTables(t, pool)
	ctx := context.Background()
	q := db.New(pool)
	s := NewService(pool, t.TempDir(), testMediaBaseURL, nil)
	category, err := q.CreateCategory(ctx, db.CreateCategoryParams{Name: "测试分类", Sort: 1})
	if err != nil {
		t.Fatal(err)
	}
	fields := map[string]string{"groupkey": "a", "productname": "商品", "skuname": "A", "categoryid": category.ID.String(), "spec": "A", "skucode": "FENCE-1"}
	first := confirmPreview(t, s, enqueuePreview(t, s, buildProductWorkbook(t, [][]string{productWorkbookRow(t, fields)})))
	if first.Status != "SUCCEEDED" {
		t.Fatal(first)
	}
	products, _ := q.ListProducts(ctx, db.ListProductsParams{Limit: 20})
	fields["productid"] = products[0].ID.String()
	preview := enqueuePreview(t, s, buildProductWorkbook(t, [][]string{productWorkbookRow(t, fields)}))
	if _, err := pool.Exec(ctx, "UPDATE catalog_products SET name='changed',updated_at=now() WHERE id=$1", products[0].ID); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Confirm(ctx, preview.JobID, preview.Revision, uuid.New(), "stale-target"); !errors.Is(err, ErrConflict) {
		t.Fatalf("stale target accepted: %v", err)
	}
	refreshed, err := s.ResolvePreview(ctx, preview.JobID, ResolutionInput{ExpectedRevision: preview.Revision})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.Confirm(ctx, refreshed.JobID, refreshed.Revision, uuid.New(), "fresh-target"); err != nil {
		t.Fatal(err)
	}
	claimed, err := q.ClaimProductImportLifecycle(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := q.ClaimProductImportLifecycle(ctx); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("live lease stolen: %v", err)
	}
	if _, err := pool.Exec(ctx, "UPDATE product_import_jobs SET lease_expires_at=now()-interval '1 second' WHERE job_id=$1", claimed.JobID); err != nil {
		t.Fatal(err)
	}
	replacement, err := q.ClaimProductImportLifecycle(ctx)
	if err != nil {
		t.Fatal(err)
	}
	oldCtx := context.WithValue(ctx, leaseContextKey{}, leaseIdentity{JobID: claimed.JobID, Token: claimed.LeaseToken})
	if err := s.commitPreview(oldCtx, db.ProductImportJob(claimed)); !errors.Is(err, ErrLeaseLost) {
		t.Fatalf("old worker wrote: %v", err)
	}
	newCtx := context.WithValue(ctx, leaseContextKey{}, leaseIdentity{JobID: replacement.JobID, Token: replacement.LeaseToken})
	if err := s.commitPreview(newCtx, db.ProductImportJob(replacement)); err != nil {
		t.Fatal(err)
	}
	detail, err := s.GetJob(ctx, replacement.JobID)
	if err != nil || detail.Status != "SUCCEEDED" {
		t.Fatal(detail, err)
	}
}

func TestLifecycleCancellationAndBlockingErrors(t *testing.T) {
	pool := openProductImportTestPool(t)
	resetProductImportTables(t, pool)
	ctx := context.Background()
	q := db.New(pool)
	s := NewService(pool, t.TempDir(), testMediaBaseURL, nil)
	category, err := q.CreateCategory(ctx, db.CreateCategoryParams{Name: "Test", Sort: 1})
	if err != nil {
		t.Fatal(err)
	}
	fields := map[string]string{"groupkey": "a", "productname": "商品", "categoryid": category.ID.String(), "pricetiers": "invalid"}
	preview := enqueuePreview(t, s, buildProductWorkbook(t, [][]string{productWorkbookRow(t, fields)}))
	if preview.Summary.FailedRows != 1 {
		t.Fatal(preview)
	}
	if _, err := s.Confirm(ctx, preview.JobID, preview.Revision, uuid.New(), "blocked"); !errors.Is(err, ErrInvalid) {
		t.Fatal("invalid price was accepted", err)
	}
	if _, err := s.Cancel(ctx, preview.JobID, uuid.New()); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Confirm(ctx, preview.JobID, preview.Revision, uuid.New(), "cancelled"); !errors.Is(err, ErrConflict) {
		t.Fatal(err)
	}
	rows, err := q.ListProducts(ctx, db.ListProductsParams{Limit: 20})
	if err != nil || len(rows) != 0 {
		t.Fatal(rows, err)
	}
}

func TestLifecycleConcurrentCreateDoesNotOverwrite(t *testing.T) {
	pool := openProductImportTestPool(t)
	resetProductImportTables(t, pool)
	ctx := context.Background()
	q := db.New(pool)
	s := NewService(pool, t.TempDir(), testMediaBaseURL, nil)
	category, err := q.CreateCategory(ctx, db.CreateCategoryParams{Name: "Test", Sort: 1})
	if err != nil {
		t.Fatal(err)
	}
	fields := map[string]string{"groupkey": "a", "productname": "original", "skuname": "SKU", "spec": "A", "skucode": "SHARED-CODE", "categoryid": category.ID.String()}
	first := enqueuePreview(t, s, buildProductWorkbook(t, [][]string{productWorkbookRow(t, fields)}))
	fields["productname"] = "must not overwrite"
	second := enqueuePreview(t, s, buildProductWorkbook(t, [][]string{productWorkbookRow(t, fields)}))
	third := enqueuePreview(t, s, buildProductWorkbook(t, [][]string{productWorkbookRow(t, fields)}))
	// Confirm both while the code is still free, then let the first commit win.
	if _, err := s.Confirm(ctx, first.JobID, first.Revision, uuid.New(), "first"); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Confirm(ctx, second.JobID, second.Revision, uuid.New(), "second"); err != nil {
		t.Fatal(err)
	}
	if _, err := s.RunNext(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Confirm(ctx, third.JobID, third.Revision, uuid.New(), "third"); !errors.Is(err, ErrConflict) {
		t.Fatalf("stale CREATE confirm accepted: %v", err)
	}
	if _, err := s.RunNext(ctx); err != nil {
		t.Fatal(err)
	}
	result, err := s.GetJob(ctx, second.JobID)
	if err != nil || result.Status != "FAILED" {
		t.Fatalf("stale CREATE commit accepted: %+v %v", result, err)
	}
	products, err := q.ListProducts(ctx, db.ListProductsParams{Limit: 20})
	if err != nil || len(products) != 1 || products[0].Name != "original" {
		t.Fatal("concurrent CREATE overwrote product", products, err)
	}
}

func TestLifecycleRecoverySkipsCommittedGroups(t *testing.T) {
	pool := openProductImportTestPool(t)
	resetProductImportTables(t, pool)
	ctx := context.Background()
	q := db.New(pool)
	s := NewService(pool, t.TempDir(), testMediaBaseURL, nil)
	category, err := q.CreateCategory(ctx, db.CreateCategoryParams{Name: "Test", Sort: 1})
	if err != nil {
		t.Fatal(err)
	}
	rows := make([][]string, 0, 2)
	for _, key := range []string{"A", "B"} {
		rows = append(rows, productWorkbookRow(t, map[string]string{"groupkey": key, "productname": key, "skuname": key, "categoryid": category.ID.String(), "spec": key}))
	}
	preview := enqueuePreview(t, s, buildProductWorkbook(t, rows))
	if _, err := s.Confirm(ctx, preview.JobID, preview.Revision, uuid.New(), "recover"); err != nil {
		t.Fatal(err)
	}
	claim, err := q.ClaimProductImportLifecycle(ctx)
	if err != nil {
		t.Fatal(err)
	}
	leased := context.WithValue(ctx, leaseContextKey{}, leaseIdentity{JobID: claim.JobID, Token: claim.LeaseToken})
	states, err := loadRows(leased, q, claim.JobID)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.processGroupTransaction(leased, groupStates(states)[0], nil, nil); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, "UPDATE product_import_jobs SET lease_expires_at=now()-interval '1 second' WHERE job_id=$1", claim.JobID); err != nil {
		t.Fatal(err)
	}
	if _, err := s.RunNext(ctx); err != nil {
		t.Fatal(err)
	}
	products, err := q.ListProducts(ctx, db.ListProductsParams{Limit: 20})
	if err != nil || len(products) != 2 {
		t.Fatalf("committed group replayed: %+v %v", products, err)
	}
	result, err := s.GetJob(ctx, claim.JobID)
	if err != nil || result.Status != "SUCCEEDED" || result.Summary.SuccessRows != 2 {
		t.Fatal(result, err)
	}
}

func TestLifecycleReviewFailureRollsBackCatalogAndSourceBinding(t *testing.T) {
	pool := openProductImportTestPool(t)
	resetProductImportTables(t, pool)
	ctx := context.Background()
	q := db.New(pool)
	s := NewService(pool, t.TempDir(), testMediaBaseURL, nil)
	preview := enqueuePreview(t, s, legacyWorkbook(t, [][]string{{"1", "辅料", "A-1", "个", ""}, {"2", "辅料", "A-2", "个", ""}}))
	_, err := pool.Exec(ctx, `CREATE OR REPLACE FUNCTION fail_import_review_for_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.source_row=3 THEN RAISE EXCEPTION 'review persistence unavailable'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_import_review_for_test BEFORE INSERT ON product_import_reviews FOR EACH ROW EXECUTE FUNCTION fail_import_review_for_test();`)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), "DROP TRIGGER IF EXISTS fail_import_review_for_test ON product_import_reviews; DROP FUNCTION IF EXISTS fail_import_review_for_test();")
	})
	result := confirmPreview(t, s, preview)
	if result.Status != "PARTIALLY_SUCCEEDED" || result.Summary.SuccessRows != 1 || result.Summary.FailedRows != 1 {
		t.Fatalf("expected group rollback: %+v", result)
	}
	products, err := q.ListProducts(ctx, db.ListProductsParams{Limit: 20})
	if err != nil || len(products) != 1 {
		t.Fatal(products, err)
	}
	var refs int
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM product_import_source_refs").Scan(&refs); err != nil || refs != 1 {
		t.Fatal("source binding escaped rollback", refs, err)
	}
	reviews, err := s.ListReviews(ctx, 1, 100, "PENDING", uuid.Nil)
	if err != nil {
		t.Fatal(err)
	}
	for _, review := range reviews.Items {
		if review.SourceRow == 3 {
			t.Fatal("review escaped rollback")
		}
	}
}

func workbookFromSheets(t *testing.T, sheets []excel.Worksheet) []byte {
	t.Helper()
	file := excelize.NewFile()
	defer func() { _ = file.Close() }()
	for i, sheet := range sheets {
		if i == 0 {
			if err := file.SetSheetName("Sheet1", sheet.Name); err != nil {
				t.Fatal(err)
			}
		} else if _, err := file.NewSheet(sheet.Name); err != nil {
			t.Fatal(err)
		}
		for j, row := range sheet.Rows {
			cell, _ := excelize.CoordinatesToCellName(1, j+1)
			if err := file.SetSheetRow(sheet.Name, cell, &row); err != nil {
				t.Fatal(err)
			}
		}
	}
	buf, err := file.WriteToBuffer()
	if err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func createSourceCategories(t *testing.T, q *db.Queries, rows []parsedRowState) {
	t.Helper()
	known := map[string]uuid.UUID{}
	for _, state := range rows {
		parent := pgtype.UUID{}
		parts := make([]string, 0, len(state.Row.SourceCategoryPath))
		for _, part := range state.Row.SourceCategoryPath {
			parts = append(parts, part)
			key := strings.Join(parts, "/")
			id, ok := known[key]
			if !ok {
				category, err := q.CreateCategory(context.Background(), db.CreateCategoryParams{Name: part, ParentID: parent, Sort: 1000})
				if err != nil {
					t.Fatal(err)
				}
				id = category.ID
				known[key] = id
			}
			parent = pgtype.UUID{Bytes: id, Valid: true}
		}
	}
}

func TestLifecycleMasterAppendPreservesActiveProductCorrections(t *testing.T) {
	pool := openProductImportTestPool(t)
	resetProductImportTables(t, pool)
	ctx := context.Background()
	q := db.New(pool)
	s := NewService(pool, t.TempDir(), testMediaBaseURL, nil)
	sheets := trialFixtureSheets()
	_, parsed, err := parseSourceSheets(sheets)
	if err != nil {
		t.Fatal(err)
	}
	createSourceCategories(t, q, parsed)
	result := confirmPreview(t, s, enqueuePreview(t, s, workbookFromSheets(t, sheets)))
	if result.Status != "SUCCEEDED" || result.Summary.SuccessRows != 2 {
		t.Fatal(result)
	}
	products, err := q.ListProducts(ctx, db.ListProductsParams{Limit: 20})
	if err != nil || len(products) != 1 {
		t.Fatal(products, err)
	}
	id := products[0].ID
	if _, err := pool.Exec(ctx, "UPDATE catalog_products SET name='人工维护名称',description='人工维护描述',status='ACTIVE',updated_at=now() WHERE id=$1", id); err != nil {
		t.Fatal(err)
	}
	sheets[1].Rows = append(sheets[1].Rows, []string{"P-1", "S-3", "M5x24", "个", "", "IMG-1", "102"})
	sheets[2].Rows = append(sheets[2].Rows, []string{"P-1", "S-3", "螺纹直径", "", "M5", "", "目录", "SOURCE-1"}, []string{"P-1", "S-3", "长度", "24", "", "mm", "目录", "SOURCE-1"}, []string{"P-1", "S-3", "螺距", "0.8", "", "mm", "目录", "SOURCE-1"})
	next := confirmPreview(t, s, enqueuePreview(t, s, workbookFromSheets(t, sheets)))
	if next.Status != "SUCCEEDED" || next.Summary.SkippedRows != 2 || next.Summary.SuccessRows != 1 {
		t.Fatalf("append failed: %+v", next)
	}
	product, err := q.GetProduct(ctx, id)
	if err != nil || product.Name != "人工维护名称" || derefString(product.Description) != "人工维护描述" || product.Status != "ACTIVE" {
		t.Fatalf("append overwrote product corrections: %+v %v", product, err)
	}
	skus, err := q.ListSkusByProduct(ctx, id)
	if err != nil || len(skus) != 3 {
		t.Fatal(skus, err)
	}
	// A SKU-only source edit must also preserve unchanged product metadata.
	sheets[2].Rows[len(sheets[2].Rows)-2][3] = "25"
	changed := confirmPreview(t, s, enqueuePreview(t, s, workbookFromSheets(t, sheets)))
	if changed.Status != "SUCCEEDED" {
		t.Fatal(changed)
	}
	product, _ = q.GetProduct(ctx, id)
	if product.Name != "人工维护名称" || product.Status != "ACTIVE" {
		t.Fatal("SKU source edit overwrote product", product)
	}
	skus, _ = q.ListSkusByProduct(ctx, id)
	var preserved db.CatalogSku
	for _, sku := range skus {
		if derefString(sku.SkuCode) == "S-1" {
			preserved = sku
		}
	}
	if _, err := pool.Exec(ctx, "UPDATE catalog_skus SET name='人工SKU名' WHERE id=$1", preserved.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := q.CreatePriceTier(ctx, db.CreatePriceTierParams{SkuID: preserved.ID, MinQty: 1, UnitPriceFen: 600}); err != nil {
		t.Fatal(err)
	}
	rename := enqueuePreview(t, s, workbookFromSheets(t, sheets))
	name := "再次修正名称"
	rename, err = s.ResolvePreview(ctx, rename.JobID, ResolutionInput{ExpectedRevision: rename.Revision, Groups: []GroupResolution{{Key: rename.Items[0].Key, ProductName: &name}}})
	if err != nil {
		t.Fatal(err)
	}
	if result := confirmPreview(t, s, rename); result.Status != "SUCCEEDED" {
		t.Fatal(result)
	}
	skips := enqueuePreview(t, s, workbookFromSheets(t, sheets))
	unit := "盒"
	var rowID uuid.UUID
	for _, row := range skips.Items[0].Rows {
		if row.SKUCode == "S-1" {
			rowID = row.RowID
		}
	}
	skips, err = s.ResolvePreview(ctx, skips.JobID, ResolutionInput{ExpectedRevision: skips.Revision, Groups: []GroupResolution{{Key: skips.Items[0].Key, Rows: []RowResolution{{RowID: rowID, Unit: &unit, ClearFields: []string{"description", "priceTiers"}}}}}})
	if err != nil {
		t.Fatal(err)
	}
	if result := confirmPreview(t, s, skips); result.Status != "SUCCEEDED" {
		t.Fatal(result)
	}
	product, _ = q.GetProduct(ctx, id)
	skus, _ = q.ListSkusByProduct(ctx, id)
	tiers, _ := q.ListPriceTiersBySku(ctx, preserved.ID)
	if product.Name != name || product.Description != nil || product.Status != "ACTIVE" || len(tiers) != 0 {
		t.Fatal("source resolution overwrote unrelated product edits", product, tiers)
	}
	for _, sku := range skus {
		if sku.ID == preserved.ID && (sku.Name != "人工SKU名" || derefString(sku.Unit) != "盒") {
			t.Fatal("source resolution overwrote unrelated SKU edits", sku)
		}
	}
}

func TestLifecycleMasterCorrectedSplitKeepsIndependentBinding(t *testing.T) {
	pool := openProductImportTestPool(t)
	resetProductImportTables(t, pool)
	ctx := context.Background()
	q := db.New(pool)
	s := NewService(pool, t.TempDir(), testMediaBaseURL, nil)
	sheets := trialFixtureSheets()
	sheets[2].Rows[6][5] = ""
	_, parsed, err := parseSourceSheets(sheets)
	if err != nil {
		t.Fatal(err)
	}
	createSourceCategories(t, q, parsed)
	first := confirmPreview(t, s, enqueuePreview(t, s, workbookFromSheets(t, sheets)))
	if first.Status != "SUCCEEDED" || first.Summary.SplitProducts != 1 {
		t.Fatal(first)
	}
	ref, err := q.GetProductImportSourceSKU(ctx, db.GetProductImportSourceSKUParams{SourceNamespace: "trial-master", SourceSkuKey: "S-2"})
	if err != nil {
		t.Fatal(err)
	}
	sheets[2].Rows[6][5] = "mm"
	second := confirmPreview(t, s, enqueuePreview(t, s, workbookFromSheets(t, sheets)))
	if second.Status != "SUCCEEDED" {
		t.Fatal(second)
	}
	after, err := q.GetProductImportSourceSKU(ctx, db.GetProductImportSourceSKUParams{SourceNamespace: "trial-master", SourceSkuKey: "S-2"})
	if err != nil || after.ProductID != ref.ProductID || after.SkuID != ref.SkuID {
		t.Fatal("corrected split was silently merged", after, err)
	}
	products, err := q.ListProducts(ctx, db.ListProductsParams{Limit: 20})
	if err != nil || len(products) != 2 {
		t.Fatal(products, err)
	}
}

func TestLifecycleOriginalMaster42SKUs(t *testing.T) {
	path := os.Getenv("TMO_TRIAL_MASTER_WORKBOOK")
	if path == "" {
		t.Skip("set TMO_TRIAL_MASTER_WORKBOOK for original master database acceptance")
	}
	pool := openProductImportTestPool(t)
	resetProductImportTables(t, pool)
	ctx := context.Background()
	q := db.New(pool)
	s := NewService(pool, t.TempDir(), testMediaBaseURL, nil)
	_, parsed, err := parseSourceWorkbook(path)
	if err != nil {
		t.Fatal(err)
	}
	createSourceCategories(t, q, parsed)
	// #nosec G304 G703 -- operator-selected, read-only original workbook fixture.
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var archive []byte
	imagePaths := map[string]bool{}
	if imageRoot := os.Getenv("TMO_TRIAL_IMAGE_ROOT"); imageRoot != "" {
		var buffer bytes.Buffer
		writer := zip.NewWriter(&buffer)
		for _, state := range parsed {
			var refs []string
			if err := json.Unmarshal([]byte(state.Row.RawValues["sourceImageRefs"]), &refs); err != nil {
				t.Fatal(err)
			}
			for _, path := range refs {
				if imagePaths[path] {
					continue
				}
				imagePaths[path] = true
				// #nosec G304 G703 -- operator-selected, read-only original image fixture.
				fileData, err := os.ReadFile(filepath.Join(imageRoot, filepath.FromSlash(path)))
				if err != nil {
					t.Fatal(err)
				}
				entry, err := writer.Create(filepath.ToSlash(path))
				if err != nil {
					t.Fatal(err)
				}
				if _, err := entry.Write(fileData); err != nil {
					t.Fatal(err)
				}
			}
		}
		if err := writer.Close(); err != nil {
			t.Fatal(err)
		}
		archive = buffer.Bytes()
		if len(imagePaths) != 12 {
			t.Fatalf("expected 12 original images, got %d", len(imagePaths))
		}
	}
	runOriginal := func() Preview {
		t.Helper()
		input := EnqueueInput{ExcelFile: bytes.NewReader(data), ExcelFileName: "original-master.xlsx"}
		if len(archive) > 0 {
			input.ImagesZipFile = bytes.NewReader(archive)
			input.ImagesZipFileName = "original-images.zip"
		}
		job, err := s.Enqueue(ctx, input)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := s.RunNext(ctx); err != nil {
			t.Fatal(err)
		}
		preview, err := s.GetPreview(ctx, job.ID, 1, 200, false)
		if err != nil {
			t.Fatal(err)
		}
		return preview
	}
	preview := runOriginal()
	if preview.Summary.TotalRows != 42 || preview.Summary.ProductCreates != 10 || preview.Summary.SplitProducts != 0 || preview.Summary.FailedRows != 0 {
		t.Fatalf("master preview: %+v", preview.Summary)
	}
	result := confirmPreview(t, s, preview)
	if result.Status != "SUCCEEDED" || result.Summary.SuccessRows != 42 {
		t.Fatal(result)
	}
	if result.ResultFileURL == nil {
		t.Fatal("missing result workbook")
	}
	reportPath := filepath.Join(s.MediaLocalOutputDir, filepath.FromSlash(strings.TrimPrefix(*result.ResultFileURL, testMediaBaseURL+"/")))
	report, err := excelize.OpenFile(reportPath)
	if err != nil {
		t.Fatal(err)
	}
	resultRows, err := report.GetRows("导入结果")
	_ = report.Close()
	if err != nil || len(resultRows) != 43 || resultRows[0][0] != "商品名称" {
		t.Fatalf("invalid operator result workbook: rows=%d err=%v", len(resultRows), err)
	}
	for _, row := range resultRows[1:] {
		if len(row) < 11 || row[9] == "" || row[10] == "" {
			t.Fatal("result workbook lost catalog identity", row)
		}
	}
	products, err := q.ListProducts(ctx, db.ListProductsParams{Limit: 100})
	if err != nil || len(products) != 10 {
		t.Fatal(products, err)
	}
	count := 0
	expected := map[string]parsedRow{}
	for _, state := range parsed {
		expected[state.Row.SkuCode] = state.Row
	}
	storedImages := map[string]bool{}
	for _, product := range products {
		skus, err := q.ListSkusByProduct(ctx, product.ID)
		if err != nil {
			t.Fatal(err)
		}
		count += len(skus)
		for _, sku := range skus {
			row, ok := expected[derefString(sku.SkuCode)]
			if !ok {
				t.Fatalf("unexpected source SKU %s", derefString(sku.SkuCode))
			}
			attrs := map[string]string{}
			if err := json.Unmarshal(sku.Attributes, &attrs); err != nil {
				t.Fatal(err)
			}
			for name, value := range row.Attributes {
				if attrs[name] != value {
					t.Fatalf("SKU %s lost attribute %s: %q != %q", *sku.SkuCode, name, attrs[name], value)
				}
			}
			if derefString(sku.Spec) != derefString(row.Spec) {
				t.Fatalf("SKU specification path changed: %+v", sku)
			}
		}
		if len(archive) > 0 {
			if product.CoverImageUrl == nil || len(product.Images) == 0 {
				t.Fatalf("missing original images: %+v", product)
			}
			for _, url := range product.Images {
				storedImages[url] = true
				relative := strings.TrimPrefix(url, testMediaBaseURL+"/")
				info, err := os.Stat(filepath.Join(s.MediaLocalOutputDir, filepath.FromSlash(relative)))
				if err != nil || info.Size() == 0 {
					t.Fatalf("missing rendered image %s: %v", url, err)
				}
			}
		}
	}
	if count != 42 {
		t.Fatalf("got %d SKUs", count)
	}
	if len(archive) > 0 && len(storedImages) != 12 {
		t.Fatalf("expected 12 stored images, got %d", len(storedImages))
	}
	repeated := confirmPreview(t, s, runOriginal())
	if repeated.Summary.SkippedRows != 42 {
		t.Fatalf("master duplicate replay: %+v", repeated)
	}
}

func TestLifecycleAttributeEditKeepsUnitReviewAndImportCannotPublish(t *testing.T) {
	pool := openProductImportTestPool(t)
	resetProductImportTables(t, pool)
	ctx := context.Background()
	q := db.New(pool)
	s := NewService(pool, t.TempDir(), testMediaBaseURL, nil)
	category, err := q.CreateCategory(ctx, db.CreateCategoryParams{Name: "五金", Sort: 1})
	if err != nil {
		t.Fatal(err)
	}
	preview := enqueuePreview(t, s, legacyWorkbook(t, [][]string{{"1", "气管接头", "PC6-M12X1.5", "GK", "五金"}}))
	attrs := map[string]string{}
	for key, value := range preview.Items[0].Rows[0].Attributes {
		attrs[key] = value
	}
	attrs["备注"] = "只补充备注"
	resolved, err := s.ResolvePreview(ctx, preview.JobID, ResolutionInput{ExpectedRevision: preview.Revision, Groups: []GroupResolution{{Key: preview.Items[0].Key, Rows: []RowResolution{{RowID: preview.Items[0].Rows[0].RowID, Attributes: &attrs}}}}})
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, issue := range resolved.Items[0].Rows[0].Issues {
		found = found || issue.Code == "UNIT_UNRECOGNIZED"
	}
	if !found {
		t.Fatal("unrelated attribute edit erased unit warning")
	}
	result := confirmPreview(t, s, resolved)
	if result.Status != "SUCCEEDED" {
		t.Fatal(result)
	}
	reviews, err := s.ListReviews(ctx, 1, 100, "PENDING", uuid.Nil)
	if err != nil || reviews.Total == 0 {
		t.Fatal(reviews, err)
	}
	products, _ := q.ListProducts(ctx, db.ListProductsParams{Limit: 20})
	skus, _ := q.ListSkusByProduct(ctx, products[0].ID)
	fields := map[string]string{"groupkey": "publish", "productid": products[0].ID.String(), "skuid": skus[0].ID.String(), "productname": products[0].Name, "skuname": skus[0].Name, "categoryid": category.ID.String(), "productstatus": "ACTIVE", "spec": derefString(skus[0].Spec)}
	publish := enqueuePreview(t, s, buildProductWorkbook(t, [][]string{productWorkbookRow(t, fields)}))
	if publish.Summary.FailedRows != 1 {
		t.Fatal("pending review activation was not blocked", publish)
	}
	if _, err := s.Confirm(ctx, publish.JobID, publish.Revision, uuid.New(), "activate"); !errors.Is(err, ErrInvalid) {
		t.Fatal("pending review import activated", err)
	}
}

func TestLifecycleMultipleResolutionsPreserveExplicitClears(t *testing.T) {
	pool := openProductImportTestPool(t)
	resetProductImportTables(t, pool)
	ctx := context.Background()
	q := db.New(pool)
	s := NewService(pool, t.TempDir(), testMediaBaseURL, nil)
	category, err := q.CreateCategory(ctx, db.CreateCategoryParams{Name: "Test", Sort: 1})
	if err != nil {
		t.Fatal(err)
	}
	fields := map[string]string{"groupkey": "a", "productname": "Product", "skuname": "SKU", "skucode": "CLEAR-1", "spec": "A", "categoryid": category.ID.String(), "description": "remove me", "pricetiers": "1-:1000"}
	first := confirmPreview(t, s, enqueuePreview(t, s, buildProductWorkbook(t, [][]string{productWorkbookRow(t, fields)})))
	if first.Status != "SUCCEEDED" {
		t.Fatal(first)
	}
	preview := enqueuePreview(t, s, buildProductWorkbook(t, [][]string{productWorkbookRow(t, fields)}))
	item := preview.Items[0]
	rowID := item.Rows[0].RowID
	preview, err = s.ResolvePreview(ctx, preview.JobID, ResolutionInput{ExpectedRevision: preview.Revision, Groups: []GroupResolution{{Key: item.Key, Rows: []RowResolution{{RowID: rowID, ClearFields: []string{"description", "priceTiers"}}}}}})
	if err != nil {
		t.Fatal(err)
	}
	unit := "件"
	preview, err = s.ResolvePreview(ctx, preview.JobID, ResolutionInput{ExpectedRevision: preview.Revision, Groups: []GroupResolution{{Key: item.Key, Rows: []RowResolution{{RowID: rowID, Unit: &unit}}}}})
	if err != nil {
		t.Fatal(err)
	}
	if len(preview.Items[0].Rows[0].ClearFields) != 2 {
		t.Fatal("later edit erased pending clears", preview)
	}
	if result := confirmPreview(t, s, preview); result.Status != "SUCCEEDED" {
		t.Fatal(result)
	}
	products, _ := q.ListProducts(ctx, db.ListProductsParams{Limit: 20})
	skus, _ := q.ListSkusByProduct(ctx, products[0].ID)
	tiers, _ := q.ListPriceTiersBySku(ctx, skus[0].ID)
	if products[0].Description != nil || len(tiers) != 0 || derefString(skus[0].Unit) != "件" {
		t.Fatal("saved clears were not committed")
	}
}

func TestLifecycleManualSourceSplitRecoveryAndReplay(t *testing.T) {
	pool := openProductImportTestPool(t)
	resetProductImportTables(t, pool)
	ctx := context.Background()
	q := db.New(pool)
	s := NewService(pool, t.TempDir(), testMediaBaseURL, nil)
	sheets := trialFixtureSheets()
	_, parsed, err := parseSourceSheets(sheets)
	if err != nil {
		t.Fatal(err)
	}
	createSourceCategories(t, q, parsed)
	preview := enqueuePreview(t, s, workbookFromSheets(t, sheets))
	firstKey, secondKey := preview.Items[0].Key, "独立组B"
	group := preview.Items[0]
	preview, err = s.ResolvePreview(ctx, preview.JobID, ResolutionInput{ExpectedRevision: preview.Revision, Groups: []GroupResolution{{Key: group.Key, Rows: []RowResolution{{RowID: group.Rows[0].RowID, GroupKey: &firstKey}, {RowID: group.Rows[1].RowID, GroupKey: &secondKey}}}}})
	if err != nil {
		t.Fatal(err)
	}
	if preview.Total != 2 || preview.Summary.ProductCreates != 2 || preview.Summary.FailedRows != 0 {
		t.Fatalf("manual split preview failed: %+v", preview)
	}
	if _, err := s.Confirm(ctx, preview.JobID, preview.Revision, uuid.New(), "manual-split"); err != nil {
		t.Fatal(err)
	}
	claim, err := q.ClaimProductImportLifecycle(ctx)
	if err != nil {
		t.Fatal(err)
	}
	leased := context.WithValue(ctx, leaseContextKey{}, leaseIdentity{JobID: claim.JobID, Token: claim.LeaseToken})
	states, err := loadRows(ctx, q, claim.JobID)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.processGroupTransaction(leased, groupStates(states)[0], nil, nil); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, "UPDATE product_import_jobs SET lease_expires_at=now()-interval '1 second' WHERE job_id=$1", claim.JobID); err != nil {
		t.Fatal(err)
	}
	if _, err := s.RunNext(ctx); err != nil {
		t.Fatal(err)
	}
	result, err := s.GetJob(ctx, preview.JobID)
	if err != nil || result.Status != "SUCCEEDED" || result.Summary.SuccessRows != 2 {
		t.Fatalf("manual split retry failed: %+v %v", result, err)
	}
	products, err := q.ListProducts(ctx, db.ListProductsParams{Limit: 20})
	if err != nil || len(products) != 2 {
		t.Fatal(products, err)
	}
	refs, err := q.ListProductImportSourceFamily(ctx, db.ListProductImportSourceFamilyParams{SourceNamespace: "trial-master", OriginalSourceProductKey: "P-1"})
	if err != nil || len(refs) != 2 || refs[0].ProductID == refs[1].ProductID || refs[0].SourceProductKey == refs[1].SourceProductKey {
		t.Fatalf("split source bindings collided: %+v %v", refs, err)
	}
	replay := confirmPreview(t, s, enqueuePreview(t, s, workbookFromSheets(t, sheets)))
	if replay.Summary.SkippedRows != 2 || replay.Status != "SUCCEEDED" {
		t.Fatal("manual split replay lost identity", replay)
	}
	sheets[1].Rows = append(sheets[1].Rows, []string{"P-1", "S-3", "M5x24", "个", "", "IMG-1", "102"})
	sheets[2].Rows = append(sheets[2].Rows, []string{"P-1", "S-3", "螺纹直径", "", "M5", "", "目录", "SOURCE-1"}, []string{"P-1", "S-3", "长度", "24", "", "mm", "目录", "SOURCE-1"}, []string{"P-1", "S-3", "螺距", "0.8", "", "mm", "目录", "SOURCE-1"})
	appended := confirmPreview(t, s, enqueuePreview(t, s, workbookFromSheets(t, sheets)))
	if appended.Status != "SUCCEEDED" || appended.Summary.SkippedRows != 2 || appended.Summary.SplitProducts != 1 || appended.Summary.ReviewCount != 1 {
		t.Fatalf("ambiguous new SKU was not isolated: %+v", appended)
	}
	// Removing an imported draft should retain job/row audit without blocking catalog deletion.
	if _, err := q.DeleteProduct(ctx, products[0].ID); err != nil {
		t.Fatal("source references blocked catalog deletion", err)
	}
	records, err := q.ListProductImportRowsByJob(ctx, preview.JobID)
	if err != nil || len(records) != 2 {
		t.Fatal("catalog deletion lost job audit", records, err)
	}
}

func TestLifecycleProductClearsOnSecondSKURow(t *testing.T) {
	pool := openProductImportTestPool(t)
	resetProductImportTables(t, pool)
	ctx := context.Background()
	q := db.New(pool)
	s := NewService(pool, t.TempDir(), testMediaBaseURL, nil)
	category, err := q.CreateCategory(ctx, db.CreateCategoryParams{Name: "Test", Sort: 1})
	if err != nil {
		t.Fatal(err)
	}
	rows := make([][]string, 0, 2)
	for _, code := range []string{"CLEAR-A", "CLEAR-B"} {
		rows = append(rows, productWorkbookRow(t, map[string]string{"groupkey": "a", "productname": "Product", "skuname": code, "skucode": code, "spec": code, "categoryid": category.ID.String(), "description": "remove", "images": "https://example.com/a.png", "coverimage": "https://example.com/a.png", "tags": "tag", "pricetiers": "1-:1000"}))
	}
	if result := confirmPreview(t, s, enqueuePreview(t, s, buildProductWorkbook(t, rows))); result.Status != "SUCCEEDED" {
		t.Fatal(result)
	}
	preview := enqueuePreview(t, s, buildProductWorkbook(t, rows))
	group := preview.Items[0]
	preview, err = s.ResolvePreview(ctx, preview.JobID, ResolutionInput{ExpectedRevision: preview.Revision, Groups: []GroupResolution{{Key: group.Key, Rows: []RowResolution{{RowID: group.Rows[1].RowID, ClearFields: []string{"images", "coverImage", "description", "tags", "priceTiers"}}}}}})
	if err != nil {
		t.Fatal(err)
	}
	if len(preview.Items[0].ClearFields) != 4 || len(preview.Items[0].Rows[0].ClearFields) != 0 || len(preview.Items[0].Rows[1].ClearFields) != 5 {
		t.Fatalf("group clears not reflected correctly: %+v", preview)
	}
	if result := confirmPreview(t, s, preview); result.Status != "SUCCEEDED" {
		t.Fatal(result)
	}
	products, _ := q.ListProducts(ctx, db.ListProductsParams{Limit: 20})
	product := products[0]
	if len(product.Images) != 0 || product.CoverImageUrl != nil || product.Description != nil || len(product.Tags) != 0 {
		t.Fatalf("non-first row product clear was ignored: %+v", product)
	}
	skus, _ := q.ListSkusByProduct(ctx, product.ID)
	for _, sku := range skus {
		tiers, err := q.ListPriceTiersBySku(ctx, sku.ID)
		if err != nil {
			t.Fatal(err)
		}
		if *sku.SkuCode == "CLEAR-A" && len(tiers) != 1 {
			t.Fatal("SKU clear leaked across rows")
		}
		if *sku.SkuCode == "CLEAR-B" && len(tiers) != 0 {
			t.Fatal("second SKU clear was lost")
		}
	}
}

func TestLifecycleResolvedReviewsStopRemindingCompletedJobs(t *testing.T) {
	pool := openProductImportTestPool(t)
	resetProductImportTables(t, pool)
	ctx := context.Background()
	q := db.New(pool)
	s := NewService(pool, t.TempDir(), testMediaBaseURL, nil)
	if _, err := q.CreateCategory(ctx, db.CreateCategoryParams{Name: "五金", Sort: 1}); err != nil {
		t.Fatal(err)
	}
	source := legacyWorkbook(t, [][]string{{"1", "纸箱", "620*600*340", "GK", "五金"}})
	before := enqueuePreview(t, s, source)
	if before.Summary.ReviewCount != 1 {
		t.Fatal("preview warning count changed", before)
	}
	first := confirmPreview(t, s, before)
	if first.Summary.ReviewCount != 1 {
		t.Fatal("completed job lost pending reviews", first)
	}
	replay := confirmPreview(t, s, enqueuePreview(t, s, source))
	if replay.Summary.SkippedRows != 1 || replay.Summary.ReviewCount != 1 {
		t.Fatal("skipped replay did not reflect existing pending target", replay)
	}
	pending, err := s.GetPreview(ctx, first.ID, 1, 50, true)
	if err != nil || pending.Total != 1 || pending.Summary.ReviewCount != 1 {
		t.Fatal(pending, err)
	}
	reviews, err := s.ListReviews(ctx, 1, 100, "PENDING", *pending.Items[0].ProductID)
	if err != nil || reviews.Total < 2 {
		t.Fatal("expected distinct source warnings", reviews, err)
	}
	for i, review := range reviews.Items {
		if _, err := s.ResolveReview(ctx, review.ID, uuid.New()); err != nil {
			t.Fatal(err)
		}
		if i < len(reviews.Items)-1 {
			part, err := s.GetJob(ctx, first.ID)
			if err != nil || part.Summary.ReviewCount != 1 {
				t.Fatal("unfinished review no longer counted", part, err)
			}
		}
	}
	for _, jobID := range []uuid.UUID{first.ID, replay.ID} {
		detail, err := s.GetJob(ctx, jobID)
		if err != nil || detail.Summary.ReviewCount != 0 {
			t.Fatal("resolved job still reminds", detail, err)
		}
		filtered, err := s.GetPreview(ctx, jobID, 1, 50, true)
		if err != nil || filtered.Total != 0 || len(filtered.Items) != 0 || filtered.Summary.ReviewCount != 0 {
			t.Fatal("resolved target still appears in needsReview", filtered, err)
		}
		audit, err := s.GetPreview(ctx, jobID, 1, 50, false)
		if err != nil || audit.Total != 1 || len(audit.Items[0].Issues) == 0 || audit.Summary.ReviewCount != 0 {
			t.Fatal("historical issue evidence was removed", audit, err)
		}
	}
	history, err := s.ListJobs(ctx, 1, 50, "PRODUCT_IMPORT", "")
	if err != nil {
		t.Fatal(err)
	}
	for _, job := range history.Items {
		if job.Summary.ReviewCount != 0 {
			t.Fatal("history retained stale review reminder", job)
		}
	}
}
