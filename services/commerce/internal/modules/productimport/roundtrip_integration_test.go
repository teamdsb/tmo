package productimport

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/modules/productexport"
)

func TestExportImportRoundtripPreservesIDsStatusAndAllSKUData(t *testing.T) {
	pool := openProductImportTestPool(t)
	resetProductImportTables(t, pool)
	ctx := context.Background()
	q := db.New(pool)
	category, err := q.CreateCategory(ctx, db.CreateCategoryParams{Name: "Roundtrip", Sort: 1})
	if err != nil {
		t.Fatal(err)
	}
	media := t.TempDir()
	importer := NewService(pool, media, testMediaBaseURL, nil)
	runImport := func(data []byte) db.ProductImportJob {
		t.Helper()
		job, err := importer.Enqueue(ctx, EnqueueInput{ExcelFile: bytes.NewReader(data), ExcelFileName: "products.xlsx"})
		if err != nil {
			t.Fatal(err)
		}
		if ok, err := importer.RunNext(ctx); err != nil || !ok {
			t.Fatalf("run import %v %v", ok, err)
		}
		result, err := q.GetProductImportJob(ctx, job.ID)
		if err != nil {
			t.Fatal(err)
		}
		return result
	}
	rows := make([][]string, 0, 6)
	for i, status := range []string{"DRAFT", "ACTIVE", "INACTIVE"} {
		fields := map[string]string{"groupkey": status, "productname": status, "productstatus": status, "categoryid": category.ID.String(), "skuname": "无编码型号", "unit": "盒", "spec1name": "材质", "spec1value": "钢|铝", "attributes": `{"备注":"a|b:c"}`, "pricetiers": "1-9:1200|10-:1000", "isactive": "true", "coverimage": "https://example.com/original.png", "images": "https://example.com/original.png|https://example.com/detail.png", "tags": "tag"}
		if i >= 1 {
			fields["spec2name"] = "长度"
			fields["spec2value"] = "10mm"
		}
		if i >= 2 {
			fields["spec3name"] = "直径"
			fields["spec3value"] = "M6"
		}
		rows = append(rows, productWorkbookRow(t, fields))
		fields["skuname"] = "停用型号"
		fields["spec1value"] = "铜"
		fields["isactive"] = "false"
		rows = append(rows, productWorkbookRow(t, fields))
	}
	first := runImport(buildProductWorkbook(t, rows))
	if first.SuccessRows != 6 {
		t.Fatalf("initial import %+v", first)
	}
	empty, err := q.CreateProduct(ctx, db.CreateProductParams{Name: "No SKU", CategoryID: category.ID, Images: []string{}, Tags: []string{}, FilterDimensions: []string{"规格"}, Status: "DRAFT"})
	if err != nil {
		t.Fatal(err)
	}
	before, err := q.ListProducts(ctx, db.ListProductsParams{Limit: 100})
	if err != nil {
		t.Fatal(err)
	}
	original := map[uuid.UUID][]db.CatalogSku{}
	for _, p := range before {
		skus, err := q.ListSkusByProduct(ctx, p.ID)
		if err != nil {
			t.Fatal(err)
		}
		original[p.ID] = skus
	}
	exporter := productexport.NewService(pool, media, testMediaBaseURL)
	job, err := exporter.Enqueue(ctx, productexport.EnqueueInput{})
	if err != nil {
		t.Fatal(err)
	}
	if ok, err := exporter.RunNext(ctx); err != nil || !ok {
		t.Fatalf("run export %v %v", ok, err)
	}
	exported, err := q.GetImportJob(ctx, job.ID)
	if err != nil || exported.ResultFileUrl == nil {
		t.Fatalf("export %+v %v", exported, err)
	}
	path := filepath.Join(media, filepath.FromSlash(strings.TrimPrefix(*exported.ResultFileUrl, testMediaBaseURL+"/")))
	// #nosec G304 -- path is constructed from this test's temporary export directory.
	workbook, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	for n := 0; n < 2; n++ {
		result := runImport(workbook)
		if result.SuccessRows != 7 || result.FailedRows != 0 {
			t.Fatalf("roundtrip %d %+v", n, result)
		}
	}
	after, err := q.ListProducts(ctx, db.ListProductsParams{Limit: 100})
	if err != nil {
		t.Fatal(err)
	}
	if len(after) != 4 {
		t.Fatalf("duplicate products: %d", len(after))
	}
	for _, p := range after {
		skus, err := q.ListSkusByProduct(ctx, p.ID)
		if err != nil {
			t.Fatal(err)
		}
		if len(skus) != len(original[p.ID]) {
			t.Fatalf("SKU count changed for %s", p.ID)
		}
		if p.ID == empty.ID {
			if len(skus) != 0 {
				t.Fatal("product-only row created SKU")
			}
			continue
		}
		if p.Status != p.Name {
			t.Fatalf("status changed: %+v", p)
		}
		if p.CoverImageUrl == nil || *p.CoverImageUrl != "https://example.com/original.png" || len(p.Images) != 2 {
			t.Fatal("images lost")
		}
		for i, sku := range skus {
			old := original[p.ID][i]
			if sku.ID != old.ID || sku.IsActive != old.IsActive || !bytes.Equal(sku.Attributes, old.Attributes) || derefString(sku.Unit) != "盒" {
				t.Fatalf("SKU changed: %+v -> %+v", old, sku)
			}
			tiers, err := q.ListPriceTiersBySku(ctx, sku.ID)
			if err != nil || len(tiers) != 2 || tiers[0].UnitPriceFen != 1200 || tiers[1].UnitPriceFen != 1000 {
				t.Fatal("tiers lost", tiers, err)
			}
		}
	}
	// Category/status filters are persisted and honored by the async worker.
	active := "ACTIVE"
	filtered, err := exporter.Enqueue(ctx, productexport.EnqueueInput{Status: &active, CategoryID: pgtype.UUID{Bytes: category.ID, Valid: true}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := exporter.RunNext(ctx); err != nil {
		t.Fatal(err)
	}
	detail, err := q.GetProductExportJob(ctx, filtered.ID)
	if err != nil || detail.ExportedRows != 2 {
		t.Fatalf("filtered export %+v %v", detail, err)
	}
	var searchableProduct db.CatalogProduct
	for _, product := range after {
		if product.Status == "ACTIVE" {
			searchableProduct = product
			break
		}
	}
	if _, err := pool.Exec(ctx, `UPDATE catalog_skus SET sku_code='PART_100%' WHERE id=$1`, original[searchableProduct.ID][0].ID); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name, query string
		rows        int32
	}{
		{"product ID", searchableProduct.ID.String(), 2},
		{"category label case insensitive", "  ROUNDTRIP  ", 7},
		{"SKU name including inactive", "停用型号", 6},
		{"SKU code", "part_100%", 2},
		{"SKU combined label", "无编码型号 PART_100%", 2},
		{"literal percent", "%", 2},
		{"literal underscore", "_", 2},
	} {
		t.Run(tc.name, func(t *testing.T) {
			searched, err := exporter.Enqueue(ctx, productexport.EnqueueInput{Query: &tc.query})
			if err != nil {
				t.Fatal(err)
			}
			if _, err := exporter.RunNext(ctx); err != nil {
				t.Fatal(err)
			}
			result, err := q.GetProductExportJob(ctx, searched.ID)
			if err != nil || result.ExportedRows != tc.rows {
				t.Fatalf("export search %q expected %d rows, got %+v %v", tc.query, tc.rows, result, err)
			}
		})
	}

	// Export goes beyond its internal page size and includes products without SKUs.
	if _, err := pool.Exec(ctx, `INSERT INTO catalog_products (name,category_id,status) SELECT 'Pagination-' || n, $1, 'DRAFT' FROM generate_series(1,501) n`, category.ID); err != nil {
		t.Fatal(err)
	}
	query := "Pagination-"
	paged, err := exporter.Enqueue(ctx, productexport.EnqueueInput{Query: &query})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := exporter.RunNext(ctx); err != nil {
		t.Fatal(err)
	}
	pagedDetail, err := q.GetProductExportJob(ctx, paged.ID)
	if err != nil || pagedDetail.ExportedRows != 501 {
		t.Fatalf("paged export %+v %v", pagedDetail, err)
	}

	if _, err := q.CreateProduct(ctx, db.CreateProductParams{Name: "Invalid dimensions", CategoryID: category.ID, Images: []string{}, Tags: []string{}, FilterDimensions: []string{"a", "b", "c", "d"}, Status: "DRAFT"}); err != nil {
		t.Fatal(err)
	}
	invalidQuery := "Invalid dimensions"
	invalidJob, err := exporter.Enqueue(ctx, productexport.EnqueueInput{Query: &invalidQuery})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := exporter.RunNext(ctx); err != nil {
		t.Fatal(err)
	}
	invalidResult, err := q.GetImportJob(ctx, invalidJob.ID)
	if err != nil || invalidResult.Status != "FAILED" || invalidResult.ErrorReportUrl == nil {
		t.Fatalf("invalid dimensions must fail visibly: %+v %v", invalidResult, err)
	}

}

func TestImportRejectsIdentityConflictsAndInvalidFinalCombinationsAtomically(t *testing.T) {
	pool := openProductImportTestPool(t)
	resetProductImportTables(t, pool)
	ctx := context.Background()
	q := db.New(pool)
	category, err := q.CreateCategory(ctx, db.CreateCategoryParams{Name: "Identity", Sort: 1})
	if err != nil {
		t.Fatal(err)
	}
	importer := NewService(pool, t.TempDir(), testMediaBaseURL, nil)
	run := func(rows ...map[string]string) db.ProductImportJob {
		t.Helper()
		data := make([][]string, 0, len(rows))
		for _, row := range rows {
			data = append(data, productWorkbookRow(t, row))
		}
		job, err := importer.Enqueue(ctx, EnqueueInput{ExcelFile: bytes.NewReader(buildProductWorkbook(t, data)), ExcelFileName: "test.xlsx"})
		if err != nil {
			t.Fatal(err)
		}
		if _, err := importer.RunNext(ctx); err != nil {
			t.Fatal(err)
		}
		result, err := q.GetProductImportJob(ctx, job.ID)
		if err != nil {
			t.Fatal(err)
		}
		return result
	}
	row := func(code, value string) map[string]string {
		return map[string]string{"groupkey": "a", "productname": "Original", "categoryid": category.ID.String(), "skucode": code, "spec1name": "Size", "spec1value": value, "isactive": "true", "pricetiers": "1-:100"}
	}
	if result := run(row("A", "S"), row("B", "M")); result.SuccessRows != 2 {
		t.Fatalf("seed %+v", result)
	}
	products, err := q.ListProducts(ctx, db.ListProductsParams{Limit: 10})
	if err != nil || len(products) != 1 {
		t.Fatal(products, err)
	}
	product := products[0]
	skus, err := q.ListSkusByProduct(ctx, product.ID)
	if err != nil {
		t.Fatal(err)
	}
	byCode := map[string]db.CatalogSku{}
	for _, sku := range skus {
		byCode[*sku.SkuCode] = sku
	}
	for _, tc := range []struct {
		name    string
		prepare func(map[string]string)
	}{
		{"duplicate omitted SKU", func(r map[string]string) { r["spec1value"] = "M" }},
		{"rename omits active SKU", func(r map[string]string) { r["spec1name"] = "New Size" }},
		{"ID code conflict", func(r map[string]string) { r["skucode"] = "B" }},
		{"foreign product", func(r map[string]string) { r["productid"] = uuid.NewString() }},
		{"missing SKU ID", func(r map[string]string) { r["skuid"] = uuid.NewString() }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := row("A", "S")
			r["productid"] = product.ID.String()
			r["skuid"] = byCode["A"].ID.String()
			r["productname"] = "Should rollback"
			tc.prepare(r)
			if result := run(r); result.FailedRows != 1 || result.SuccessRows != 0 {
				t.Fatalf("expected rejection %+v", result)
			}
			current, err := q.GetProduct(ctx, product.ID)
			if err != nil || current.Name != "Original" || current.FilterDimensions[0] != "Size" {
				t.Fatalf("product did not roll back %+v %v", current, err)
			}
			currentSkus, err := q.ListSkusByProduct(ctx, product.ID)
			if err != nil || len(currentSkus) != 2 {
				t.Fatal("SKU count changed", err)
			}
		})
	}
	// Literal IDs and codes differ, but both rows resolve to the same persisted SKU.
	byID := row("", "L")
	byID["productid"] = product.ID.String()
	byID["skuid"] = byCode["A"].ID.String()
	byID["productname"] = "Should rollback"
	byAlias := row("A", "XL")
	byAlias["productid"] = product.ID.String()
	byAlias["productname"] = "Should rollback"
	if result := run(byID, byAlias); result.FailedRows != 2 || result.SuccessRows != 0 {
		t.Fatalf("resolved SKU aliases must reject entire group: %+v", result)
	}
	unchanged, err := q.GetProduct(ctx, product.ID)
	if err != nil || unchanged.Name != "Original" {
		t.Fatalf("alias collision mutated product: %+v %v", unchanged, err)
	}
	aliases, err := q.ListSkusByProduct(ctx, product.ID)
	if err != nil {
		t.Fatal(err)
	}
	for _, sku := range aliases {
		if sku.ID == byCode["A"].ID && (derefString(sku.SkuCode) != "A" || derefString(sku.Spec) != "S") {
			t.Fatalf("alias collision mutated SKU: %+v", sku)
		}
	}

	// Updating only one SKU preserves the omitted sibling and the old status when blank.
	good := row("A", "L")
	good["productid"] = product.ID.String()
	good["skuid"] = byCode["A"].ID.String()
	good["productstatus"] = "ACTIVE"
	if result := run(good); result.SuccessRows != 1 {
		t.Fatalf("expected valid partial update %+v", result)
	}
	current, err := q.GetProduct(ctx, product.ID)
	if err != nil || current.Status != "ACTIVE" {
		t.Fatal(current, err)
	}
}
