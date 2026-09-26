package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/modules/productexport"
	"github.com/teamdsb/tmo/services/commerce/internal/modules/productimport"
	"github.com/xuri/excelize/v2"
)

func TestImportReviewBlocksPublishingAndExportsOnlyPendingProducts(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)
	ctx := context.Background()
	q := db.New(pool)
	mediaDir := t.TempDir()
	router, service := newAuthRouterWithProductImport(pool, q, mediaDir, "http://localhost/media")
	file := excelize.NewFile()
	header := []string{"序号", "物资", "规格型号", "单位", "分类"}
	row := []string{"1", "轴承", "30309", "个", "未知分类"}
	if err := file.SetSheetRow("Sheet1", "A1", &header); err != nil {
		t.Fatal(err)
	}
	if err := file.SetSheetRow("Sheet1", "A2", &row); err != nil {
		t.Fatal(err)
	}
	content, err := file.WriteToBuffer()
	if err != nil {
		t.Fatal(err)
	}
	_ = file.Close()
	job, err := service.Enqueue(ctx, productimport.EnqueueInput{ExcelFile: bytes.NewReader(content.Bytes()), ExcelFileName: "legacy.xlsx"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.RunNext(ctx); err != nil {
		t.Fatal(err)
	}
	preview, err := service.GetPreview(ctx, job.ID, 1, 20, false)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := service.Confirm(ctx, job.ID, preview.Revision, uuid.New(), uuid.NewString()); err != nil {
		t.Fatal(err)
	}
	if _, err := service.RunNext(ctx); err != nil {
		t.Fatal(err)
	}
	reviews, err := service.ListReviews(ctx, 1, 20, "PENDING", uuid.Nil)
	if err != nil || len(reviews.Items) != 1 {
		t.Fatalf("reviews %+v %v", reviews, err)
	}
	review := reviews.Items[0]
	productPath := "/catalog/products/" + review.ProductID.String()
	response := catalogJSON(t, router, http.MethodPatch, productPath, map[string]any{"status": "ACTIVE"}, "ADMIN")
	if response.Code != 400 {
		t.Fatalf("unreviewed product published: %d %s", response.Code, response.Body.String())
	}
	saved, err := q.GetProduct(ctx, review.ProductID)
	if err != nil || saved.Status != "DRAFT" {
		t.Fatalf("draft gate not atomic: %+v %v", saved, err)
	}

	seedCatalog(t, q)
	response = catalogJSON(t, router, http.MethodGet, "/admin/products?needsReview=true&pageSize=1", nil, "ADMIN")
	if response.Code != 200 {
		t.Fatalf("review product list: %s", response.Body.String())
	}
	var page struct {
		Total int `json:"total"`
		Items []struct {
			ID          uuid.UUID `json:"id"`
			ReviewCount int       `json:"reviewCount"`
		} `json:"items"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &page); err != nil {
		t.Fatal(err)
	}
	if page.Total != 1 || len(page.Items) != 1 || page.Items[0].ID != review.ProductID || page.Items[0].ReviewCount != 1 {
		t.Fatalf("wrong review filter: %+v", page)
	}

	exporter := productexport.NewService(pool, mediaDir, "http://localhost/media")
	export, err := exporter.Enqueue(ctx, productexport.EnqueueInput{NeedsReview: true})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := exporter.RunNext(ctx); err != nil {
		t.Fatal(err)
	}
	exported, err := q.GetImportJob(ctx, export.ID)
	if err != nil || exported.Status != "SUCCEEDED" || exported.ResultFileUrl == nil {
		t.Fatalf("export %+v %v", exported, err)
	}
	exportDetail, err := service.GetJob(ctx, export.ID)
	if err != nil || exportDetail.Summary.TotalRows != 1 || exportDetail.FileName != "products.xlsx" {
		t.Fatalf("export summary: %+v %v", exportDetail, err)
	}
	path := filepath.Join(mediaDir, strings.TrimPrefix(*exported.ResultFileUrl, "http://localhost/media/"))
	workbook, err := excelize.OpenFile(path)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = workbook.Close() }()
	rows, err := workbook.GetRows(workbook.GetSheetName(0))
	if err != nil || len(rows) != 2 {
		t.Fatalf("export scope: %d rows %v", len(rows), err)
	}
	evidence, err := workbook.GetRows("来源资料")
	if err != nil || len(evidence) != 2 || !strings.Contains(evidence[1][5], "30309") {
		t.Fatalf("source evidence missing: %v %v", evidence, err)
	}

	category, err := q.CreateCategory(ctx, db.CreateCategoryParams{Name: "五金", Sort: 1})
	if err != nil {
		t.Fatal(err)
	}
	response = catalogJSON(t, router, http.MethodPatch, productPath, map[string]any{"categoryId": category.ID}, "ADMIN")
	if response.Code != 200 {
		t.Fatalf("fix category: %s", response.Body.String())
	}
	response = catalogJSON(t, router, http.MethodPatch, "/admin/products/import-reviews/"+review.ID.String(), map[string]any{"status": "RESOLVED"}, "ADMIN")
	if response.Code != 200 {
		t.Fatalf("resolve: %s", response.Body.String())
	}
	response = catalogJSON(t, router, http.MethodPatch, productPath, map[string]any{"status": "ACTIVE"}, "ADMIN")
	if response.Code != 200 {
		t.Fatalf("publish reviewed: %s", response.Body.String())
	}
	pending, err := service.ListReviews(ctx, 1, 20, "PENDING", review.ProductID)
	if err != nil || pending.Total != 0 {
		t.Fatalf("review did not persist: %+v %v", pending, err)
	}
}
