package productexport

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/teamdsb/tmo/packages/go-shared/catalogspec"
	"github.com/xuri/excelize/v2"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/excel"
	"github.com/teamdsb/tmo/services/commerce/internal/http/oapi"
)

const exportFileName = "products.xlsx"

type EnqueueInput struct {
	CreatedByUserID pgtype.UUID
	Query           *string
	CategoryID      pgtype.UUID
	Status          *string
}

type Service struct {
	DB                  *pgxpool.Pool
	MediaLocalOutputDir string
	MediaPublicBaseURL  string
}

func NewService(pool *pgxpool.Pool, mediaLocalOutputDir, mediaPublicBaseURL string) *Service {
	return &Service{
		DB:                  pool,
		MediaLocalOutputDir: mediaLocalOutputDir,
		MediaPublicBaseURL:  mediaPublicBaseURL,
	}
}

func (s *Service) Enqueue(ctx context.Context, input EnqueueInput) (db.ImportJob, error) {
	if s == nil || s.DB == nil {
		return db.ImportJob{}, fmt.Errorf("product export service is not configured")
	}

	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return db.ImportJob{}, fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	queries := db.New(tx)
	job, err := queries.CreateImportJob(ctx, db.CreateImportJobParams{
		Type:            string(oapi.ImportJobTypePRODUCTEXPORT),
		Status:          string(oapi.PENDING),
		Progress:        0,
		ResultFileUrl:   nil,
		ErrorReportUrl:  nil,
		CreatedByUserID: input.CreatedByUserID,
	})
	if err != nil {
		return db.ImportJob{}, fmt.Errorf("create export job: %w", err)
	}

	if _, err := queries.CreateProductExportJob(ctx, db.CreateProductExportJobParams{
		JobID: job.ID,
		Query: input.Query, CategoryID: input.CategoryID, ProductStatus: input.Status,
	}); err != nil {
		return db.ImportJob{}, fmt.Errorf("create export detail job: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return db.ImportJob{}, fmt.Errorf("commit tx: %w", err)
	}

	return job, nil
}

func (s *Service) ResetStaleRunning(ctx context.Context) error {
	if s == nil || s.DB == nil {
		return nil
	}
	_, err := db.New(s.DB).ResetRunningProductExportJobs(ctx)
	return err
}

func (s *Service) RunNext(ctx context.Context) (bool, error) {
	if s == nil || s.DB == nil {
		return false, nil
	}

	job, err := db.New(s.DB).ClaimNextPendingProductExportJob(ctx)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, fmt.Errorf("claim pending product export job: %w", err)
	}

	if err := s.processJob(ctx, claimToProductExportJob(job)); err != nil {
		return true, err
	}
	return true, nil
}

func (s *Service) processJob(ctx context.Context, job db.ProductExportJob) error {
	if strings.TrimSpace(s.MediaLocalOutputDir) == "" || strings.TrimSpace(s.MediaPublicBaseURL) == "" {
		return s.failJob(ctx, job.JobID, "media output is not configured")
	}

	if _, err := db.New(s.DB).UpdateImportJobStatus(ctx, db.UpdateImportJobStatusParams{
		ID:       job.JobID,
		Status:   string(oapi.RUNNING),
		Progress: 20,
	}); err != nil {
		return fmt.Errorf("mark export job running: %w", err)
	}

	rows, err := s.exportRows(ctx, job)
	if err != nil {
		return s.failJob(ctx, job.JobID, fmt.Sprintf("list products: %v", err))
	}
	if len(rows) > math.MaxInt32 {
		return s.failJob(ctx, job.JobID, "too many export rows")
	}
	// #nosec G115 -- len(rows) is nonnegative and checked against MaxInt32 above.
	if _, err := db.New(s.DB).UpdateProductExportJobRows(ctx, db.UpdateProductExportJobRowsParams{JobID: job.JobID, ExportedRows: int32(len(rows))}); err != nil {
		return s.failJob(ctx, job.JobID, err.Error())
	}

	if _, err := db.New(s.DB).UpdateImportJobStatus(ctx, db.UpdateImportJobStatusParams{
		ID:       job.JobID,
		Status:   string(oapi.RUNNING),
		Progress: 75,
	}); err != nil {
		return fmt.Errorf("update export job progress: %w", err)
	}

	resultURL, err := s.writeWorkbook(job.JobID, rows)
	if err != nil {
		return s.failJob(ctx, job.JobID, fmt.Sprintf("write export workbook: %v", err))
	}

	_, err = db.New(s.DB).FinalizeImportJob(ctx, db.FinalizeImportJobParams{
		ID:             job.JobID,
		Status:         string(oapi.SUCCEEDED),
		Progress:       100,
		ResultFileUrl:  &resultURL,
		ErrorReportUrl: nil,
	})
	return err
}

func (s *Service) failJob(ctx context.Context, jobID uuid.UUID, reason string) error {
	relative := filepath.Join("import-jobs", jobID.String(), "exports", "error.txt")
	reportPath := filepath.Join(s.MediaLocalOutputDir, relative)
	var reportURL *string
	// #nosec G301 -- downloadable reports are served by a separate Nginx user.
	if err := os.MkdirAll(filepath.Dir(reportPath), 0o755); err == nil {
		// #nosec G306 -- this report is published through the existing media URL.
		if err := os.WriteFile(reportPath, []byte(reason), 0o644); err == nil {
			value := strings.TrimRight(s.MediaPublicBaseURL, "/") + "/" + filepath.ToSlash(relative)
			reportURL = &value
		}
	}
	_, err := db.New(s.DB).FinalizeImportJob(ctx, db.FinalizeImportJobParams{
		ID:     jobID,
		Status: string(oapi.FAILED), Progress: 100, ResultFileUrl: nil, ErrorReportUrl: reportURL,
	})
	if err != nil {
		return err
	}
	return nil
}

func (s *Service) writeWorkbook(jobID uuid.UUID, requests [][]string) (string, error) {
	spec := excel.ProductImportTemplate()
	file := excelize.NewFile()
	defer func() { _ = file.Close() }()
	sheet := file.GetSheetName(0)
	if err := file.SetSheetName(sheet, spec.SheetName); err != nil {
		return "", err
	}
	sheet = spec.SheetName

	for columnIndex, header := range excel.TemplateHeaders(spec) {
		cell, err := excelize.CoordinatesToCellName(columnIndex+1, 1)
		if err != nil {
			return "", err
		}
		if err := file.SetCellValue(sheet, cell, header); err != nil {
			return "", err
		}
	}

	for rowIndex, request := range requests {
		values := request
		for columnIndex, value := range values {
			cell, err := excelize.CoordinatesToCellName(columnIndex+1, rowIndex+2)
			if err != nil {
				return "", err
			}
			if err := file.SetCellValue(sheet, cell, value); err != nil {
				return "", err
			}
		}
	}

	relativePath := filepath.Join("import-jobs", jobID.String(), "exports", exportFileName)
	localPath := filepath.Join(s.MediaLocalOutputDir, filepath.FromSlash(relativePath))
	// #nosec G301 -- downloadable workbooks are served by a separate Nginx user.
	if err := os.MkdirAll(filepath.Dir(localPath), 0o755); err != nil {
		return "", err
	}
	if err := file.SaveAs(localPath); err != nil {
		return "", err
	}
	return strings.TrimRight(s.MediaPublicBaseURL, "/") + "/" + strings.TrimLeft(filepath.ToSlash(relativePath), "/"), nil
}

func nullableString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func claimToProductExportJob(row db.ClaimNextPendingProductExportJobRow) db.ProductExportJob {
	return db.ProductExportJob{JobID: row.JobID, Query: row.Query, CategoryID: row.CategoryID, ProductStatus: row.ProductStatus, ExportedRows: row.ExportedRows, CreatedAt: row.ExportCreatedAt, UpdatedAt: row.ExportUpdatedAt}
}

// A repeatable-read snapshot keeps every exported product, SKU and price tier consistent.
func (s *Service) exportRows(ctx context.Context, job db.ProductExportJob) ([][]string, error) {
	tx, err := s.DB.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	q := db.New(tx)
	result := [][]string{}
	for offset := int32(0); ; offset += 500 {
		products, err := q.ListProductExportProducts(ctx, db.ListProductExportProductsParams{Q: job.Query, CategoryID: job.CategoryID, Status: job.ProductStatus, Limit: 500, Offset: offset})
		if err != nil {
			return nil, err
		}
		for _, product := range products {
			if _, err := catalogspec.NormalizeDimensions(product.FilterDimensions); err != nil {
				return nil, fmt.Errorf("product %s: %w", product.ID, err)
			}
			skus, err := q.ListSkusByProduct(ctx, product.ID)
			if err != nil {
				return nil, err
			}
			if len(skus) == 0 {
				result = append(result, exportRowValues(product, nil, nil))
				continue
			}
			for _, sku := range skus {
				tiers, err := q.ListPriceTiersBySku(ctx, sku.ID)
				if err != nil {
					return nil, err
				}
				result = append(result, exportRowValues(product, &sku, tiers))
			}
		}
		if len(products) < 500 {
			break
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return result, nil
}

func exportRowValues(product db.CatalogProduct, sku *db.CatalogSku, tiers []db.CatalogPriceTier) []string {
	encoded := func(value interface{}) string {
		data, _ := json.Marshal(value)
		if string(data) == "null" {
			return ""
		}
		return string(data)
	}
	values := map[string]string{"groupkey": product.ID.String(), "productid": product.ID.String(), "productname": product.Name, "productstatus": product.Status, "categoryid": product.CategoryID.String(), "description": nullableString(product.Description), "coverimage": nullableString(product.CoverImageUrl), "images": encoded(product.Images), "tags": encoded(product.Tags)}
	dimensions := product.FilterDimensions
	if sku != nil {
		attrs := map[string]string{}
		_ = json.Unmarshal(sku.Attributes, &attrs)
		values["skuid"] = sku.ID.String()
		values["skucode"] = nullableString(sku.SkuCode)
		values["skuname"] = sku.Name
		values["spec"] = nullableString(sku.Spec)
		values["unit"] = nullableString(sku.Unit)
		values["isactive"] = strconv.FormatBool(sku.IsActive)
		if len(dimensions) == 0 {
			dimensions = []string{"规格"}
			value := nullableString(sku.Spec)
			if value == "" {
				value = sku.Name
			}
			attrs["规格"] = value
			values["spec"] = value
		}
		for i, name := range dimensions {
			values[fmt.Sprintf("spec%dvalue", i+1)] = attrs[name]
		}
		if _, path, err := catalogspec.NormalizeValues(dimensions, attrs); err == nil {
			values["spec"] = path
		}
		values["attributes"] = encoded(attrs)
		prices := make([]string, 0, len(tiers))
		for _, tier := range tiers {
			maxQty := ""
			if tier.MaxQty != nil {
				maxQty = strconv.Itoa(int(*tier.MaxQty))
			}
			prices = append(prices, fmt.Sprintf("%d-%s:%d", tier.MinQty, maxQty, tier.UnitPriceFen))
		}
		values["pricetiers"] = strings.Join(prices, "|")
	}
	for i, name := range dimensions {
		values[fmt.Sprintf("spec%dname", i+1)] = name
	}
	if len(dimensions) > 0 {
		values["filterdimensions"] = encoded(dimensions)
	}
	result := make([]string, 0, len(excel.ProductImportTemplate().Columns))
	for _, column := range excel.ProductImportTemplate().Columns {
		result = append(result, values[column.Key])
	}
	return result
}
