package productrequestexport

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/xuri/excelize/v2"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/excel"
	"github.com/teamdsb/tmo/services/commerce/internal/http/oapi"
)

const exportFileName = "product-requests.xlsx"

type EnqueueInput struct {
	CreatedByUserID pgtype.UUID
	CreatedAfter    *time.Time
	CreatedBefore   *time.Time
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
		return db.ImportJob{}, fmt.Errorf("product request export service is not configured")
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
		Type:            string(oapi.ImportJobTypePRODUCTREQUESTEXPORT),
		Status:          string(oapi.PENDING),
		Progress:        0,
		ResultFileUrl:   nil,
		ErrorReportUrl:  nil,
		CreatedByUserID: input.CreatedByUserID,
	})
	if err != nil {
		return db.ImportJob{}, fmt.Errorf("create export job: %w", err)
	}

	if _, err := queries.CreateProductRequestExportJob(ctx, db.CreateProductRequestExportJobParams{
		JobID:         job.ID,
		CreatedAfter:  toPgTimestamp(input.CreatedAfter),
		CreatedBefore: toPgTimestamp(input.CreatedBefore),
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
	_, err := db.New(s.DB).ResetRunningProductRequestExportJobs(ctx)
	return err
}

func (s *Service) RunNext(ctx context.Context) (bool, error) {
	if s == nil || s.DB == nil {
		return false, nil
	}

	job, err := db.New(s.DB).ClaimNextPendingProductRequestExportJob(ctx)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, fmt.Errorf("claim pending product request export job: %w", err)
	}

	if err := s.processJob(ctx, claimToProductRequestExportJob(job)); err != nil {
		return true, err
	}
	return true, nil
}

func (s *Service) processJob(ctx context.Context, job db.ProductRequestExportJob) error {
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

	rows, err := db.New(s.DB).ListProductRequestExportRows(ctx, db.ListProductRequestExportRowsParams{
		CreatedAfter:  job.CreatedAfter,
		CreatedBefore: job.CreatedBefore,
	})
	if err != nil {
		return s.failJob(ctx, job.JobID, fmt.Sprintf("list product requests for export: %v", err))
	}

	if _, err := db.New(s.DB).UpdateProductRequestExportJobRows(ctx, db.UpdateProductRequestExportJobRowsParams{
		JobID:        job.JobID,
		ExportedRows: int32(len(rows)),
	}); err != nil {
		return fmt.Errorf("update exported rows: %w", err)
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
	_ = reason
	_, err := db.New(s.DB).FinalizeImportJob(ctx, db.FinalizeImportJobParams{
		ID:             jobID,
		Status:         string(oapi.FAILED),
		Progress:       100,
		ResultFileUrl:  nil,
		ErrorReportUrl: nil,
	})
	if err != nil {
		return err
	}
	return nil
}

func (s *Service) writeWorkbook(jobID uuid.UUID, requests []db.ProductRequest) (string, error) {
	spec := excel.ProductRequestExportTemplate()
	file := excelize.NewFile()
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
		values := exportRowValues(request)
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
	if err := os.MkdirAll(filepath.Dir(localPath), 0o755); err != nil {
		return "", err
	}
	if err := file.SaveAs(localPath); err != nil {
		return "", err
	}
	return strings.TrimRight(s.MediaPublicBaseURL, "/") + "/" + strings.TrimLeft(filepath.ToSlash(relativePath), "/"), nil
}

func exportRowValues(request db.ProductRequest) []string {
	return []string{
		request.ID.String(),
		request.CreatedByUserID.String(),
		uuidString(request.OwnerSalesUserID),
		request.Name,
		uuidString(request.CategoryID),
		nullableString(request.Spec),
		nullableString(request.Material),
		nullableString(request.Dimensions),
		nullableString(request.Color),
		nullableString(request.Qty),
		nullableString(request.Note),
		strings.Join(request.ReferenceImageUrls, " | "),
		timeString(request.CreatedAt),
		timeString(request.UpdatedAt),
	}
}

func nullableString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func uuidString(value pgtype.UUID) string {
	if !value.Valid {
		return ""
	}
	return uuid.UUID(value.Bytes).String()
}

func timeString(value pgtype.Timestamptz) string {
	if !value.Valid {
		return ""
	}
	return value.Time.UTC().Format(time.RFC3339)
}

func toPgTimestamp(value *time.Time) pgtype.Timestamptz {
	if value == nil {
		return pgtype.Timestamptz{}
	}
	return pgtype.Timestamptz{Time: value.UTC(), Valid: true}
}

func claimToProductRequestExportJob(row db.ClaimNextPendingProductRequestExportJobRow) db.ProductRequestExportJob {
	return db.ProductRequestExportJob{
		JobID:         row.JobID,
		CreatedAfter:  row.CreatedAfter,
		CreatedBefore: row.CreatedBefore,
		ExportedRows:  row.ExportedRows,
		CreatedAt:     row.ExportCreatedAt,
		UpdatedAt:     row.ExportUpdatedAt,
	}
}
