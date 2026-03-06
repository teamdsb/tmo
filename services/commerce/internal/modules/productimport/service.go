package productimport

import (
	"archive/zip"
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/excel"
	"github.com/teamdsb/tmo/services/commerce/internal/http/oapi"
)

const (
	rowStatusPending   = "PENDING"
	rowStatusSucceeded = "SUCCEEDED"
	rowStatusFailed    = "FAILED"
)

type EnqueueInput struct {
	CreatedByUserID   pgtype.UUID
	ExcelFile         io.Reader
	ExcelFileName     string
	ImagesZipFile     io.Reader
	ImagesZipFileName string
	ImageBaseURL      string
}

type Service struct {
	DB                  *pgxpool.Pool
	MediaLocalOutputDir string
	MediaPublicBaseURL  string
	Logger              *slog.Logger
}

type rowExecutionState struct {
	Parsed         parsedRow
	Record         db.ProductImportRow
	Error          string
	PersistedState string
}

type groupExecution struct {
	Key      string
	Rows     []*rowExecutionState
	RowStart int
}

type importSummary struct {
	JobID       string    `json:"jobId"`
	Status      string    `json:"status"`
	TotalRows   int       `json:"totalRows"`
	SuccessRows int       `json:"successRows"`
	FailedRows  int       `json:"failedRows"`
	ProcessedAt time.Time `json:"processedAt"`
}

func NewService(pool *pgxpool.Pool, mediaLocalOutputDir, mediaPublicBaseURL string, logger *slog.Logger) *Service {
	return &Service{
		DB:                  pool,
		MediaLocalOutputDir: mediaLocalOutputDir,
		MediaPublicBaseURL:  mediaPublicBaseURL,
		Logger:              logger,
	}
}

func (s *Service) Enqueue(ctx context.Context, input EnqueueInput) (db.ImportJob, error) {
	if s == nil || s.DB == nil {
		return db.ImportJob{}, errors.New("product import service is not configured")
	}
	if input.ExcelFile == nil {
		return db.ImportJob{}, errors.New("excel file is required")
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
		Type:            string(oapi.ImportJobTypePRODUCTIMPORT),
		Status:          string(oapi.PENDING),
		Progress:        0,
		ResultFileUrl:   nil,
		ErrorReportUrl:  nil,
		CreatedByUserID: input.CreatedByUserID,
	})
	if err != nil {
		return db.ImportJob{}, fmt.Errorf("create import job: %w", err)
	}

	jobRoot := s.jobRootDir(job.ID)
	inputDir := filepath.Join(jobRoot, "input")
	if err := os.MkdirAll(inputDir, 0o755); err != nil {
		return db.ImportJob{}, fmt.Errorf("create job input dir: %w", err)
	}

	cleanupDir := true
	defer func() {
		if cleanupDir {
			_ = os.RemoveAll(jobRoot)
		}
	}()

	excelFileName := sanitizeFileName(input.ExcelFileName, "product-import.xlsx")
	excelPath := filepath.Join(inputDir, excelFileName)
	if err := copyReaderToFile(excelPath, input.ExcelFile); err != nil {
		return db.ImportJob{}, fmt.Errorf("save excel file: %w", err)
	}

	var imagesZipPath *string
	var imagesZipName *string
	if input.ImagesZipFile != nil {
		name := sanitizeFileName(input.ImagesZipFileName, "images.zip")
		pathValue := filepath.Join(inputDir, name)
		if err := copyReaderToFile(pathValue, input.ImagesZipFile); err != nil {
			return db.ImportJob{}, fmt.Errorf("save images zip: %w", err)
		}
		imagesZipPath = &pathValue
		imagesZipName = &name
	}

	var baseURL *string
	if trimmed := strings.TrimSpace(input.ImageBaseURL); trimmed != "" {
		baseURL = &trimmed
	}

	if _, err := queries.CreateProductImportJob(ctx, db.CreateProductImportJobParams{
		JobID:         job.ID,
		ExcelFilePath: excelPath,
		ExcelFileName: excelFileName,
		ImagesZipPath: imagesZipPath,
		ImagesZipName: imagesZipName,
		ImageBaseUrl:  baseURL,
	}); err != nil {
		return db.ImportJob{}, fmt.Errorf("create product import job: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return db.ImportJob{}, fmt.Errorf("commit tx: %w", err)
	}
	cleanupDir = false
	return job, nil
}

func (s *Service) ResetStaleRunning(ctx context.Context) error {
	if s == nil || s.DB == nil {
		return nil
	}
	_, err := db.New(s.DB).ResetRunningProductImportJobs(ctx)
	return err
}

func (s *Service) RunNext(ctx context.Context) (bool, error) {
	if s == nil || s.DB == nil {
		return false, nil
	}

	job, err := db.New(s.DB).ClaimNextPendingProductImportJob(ctx)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, fmt.Errorf("claim pending product import job: %w", err)
	}

	if err := s.processJob(ctx, claimToProductImportJob(job)); err != nil {
		return true, err
	}
	return true, nil
}

func (s *Service) processJob(ctx context.Context, job db.ProductImportJob) error {
	rows, err := s.readWorkbook(job.ExcelFilePath)
	if err != nil {
		return s.failJob(ctx, job.JobID, fmt.Sprintf("failed to read excel: %v", err))
	}

	parsedRows, err := parseWorkbookRows(rows)
	if err != nil {
		return s.failJob(ctx, job.JobID, err.Error())
	}

	states, err := s.persistParsedRows(ctx, job.JobID, parsedRows)
	if err != nil {
		return s.failJob(ctx, job.JobID, fmt.Sprintf("failed to persist parsed rows: %v", err))
	}
	if _, err := db.New(s.DB).UpdateProductImportJobCounts(ctx, db.UpdateProductImportJobCountsParams{
		JobID:       job.JobID,
		TotalRows:   int32(len(states)),
		SuccessRows: 0,
		FailedRows:  0,
	}); err != nil {
		s.logError("update product import total rows failed", err)
	}

	groups := s.buildGroups(states)
	if err := s.flushFailedRows(ctx, states); err != nil {
		return s.failJob(ctx, job.JobID, fmt.Sprintf("failed to persist validation errors: %v", err))
	}

	resolver, err := newImageResolver(job, s.MediaLocalOutputDir, s.MediaPublicBaseURL)
	if err != nil {
		return s.failJob(ctx, job.JobID, fmt.Sprintf("failed to prepare image resolver: %v", err))
	}
	defer resolver.Close()

	for index, group := range groups {
		if err := s.processGroup(ctx, group, resolver); err != nil {
			s.logError("process product import group failed", err)
		}
		progress := 10 + int32(((index+1)*80)/maxInt(1, len(groups)))
		if _, err := db.New(s.DB).UpdateImportJobStatus(ctx, db.UpdateImportJobStatusParams{
			ID:       job.JobID,
			Status:   string(oapi.RUNNING),
			Progress: progress,
		}); err != nil {
			s.logError("update product import progress failed", err)
		}
	}

	totalRows, successRows, failedRows := summarizeStates(states)
	if _, err := db.New(s.DB).UpdateProductImportJobCounts(ctx, db.UpdateProductImportJobCountsParams{
		JobID:       job.JobID,
		TotalRows:   int32(totalRows),
		SuccessRows: int32(successRows),
		FailedRows:  int32(failedRows),
	}); err != nil {
		s.logError("update product import counts failed", err)
	}

	resultURL, err := s.writeSummary(job.JobID, importSummary{
		JobID:       job.JobID.String(),
		Status:      string(oapi.SUCCEEDED),
		TotalRows:   totalRows,
		SuccessRows: successRows,
		FailedRows:  failedRows,
		ProcessedAt: time.Now().UTC(),
	})
	if err != nil {
		s.logError("write product import summary failed", err)
	}

	var errorReportURL *string
	if failedRows > 0 {
		reportURL, reportErr := s.writeErrorReport(job.JobID, states)
		if reportErr != nil {
			s.logError("write product import error report failed", reportErr)
		} else {
			errorReportURL = reportURL
		}
	}

	_, finalizeErr := db.New(s.DB).FinalizeImportJob(ctx, db.FinalizeImportJobParams{
		ID:             job.JobID,
		Status:         string(oapi.SUCCEEDED),
		Progress:       100,
		ResultFileUrl:  resultURL,
		ErrorReportUrl: errorReportURL,
	})
	return finalizeErr
}

func (s *Service) persistParsedRows(ctx context.Context, jobID uuid.UUID, parsedRows []parsedRowState) ([]*rowExecutionState, error) {
	queries := db.New(s.DB)
	states := make([]*rowExecutionState, 0, len(parsedRows))
	for _, item := range parsedRows {
		rowStatus := rowStatusPending
		var errMessage *string
		if item.Error != "" {
			rowStatus = rowStatusFailed
			errValue := item.Error
			errMessage = &errValue
		}
		skuCode := normalizeNullableString(item.Row.SkuCode)
		productName := item.Row.ProductName
		record, err := queries.CreateProductImportRow(ctx, db.CreateProductImportRowParams{
			JobID:        jobID,
			LineNo:       int32(item.Row.RowNumber),
			GroupKey:     normalizeNullableString(item.Row.GroupKey),
			SkuCode:      skuCode,
			ProductName:  normalizeNullableString(productName),
			Status:       rowStatus,
			ErrorMessage: errMessage,
			RowData:      marshalPayload(item.Row),
			ProductID:    pgtype.UUID{},
			SkuID:        pgtype.UUID{},
		})
		if err != nil {
			return nil, err
		}
		states = append(states, &rowExecutionState{
			Parsed:         item.Row,
			Record:         record,
			Error:          item.Error,
			PersistedState: rowStatus,
		})
	}
	return states, nil
}

func (s *Service) buildGroups(states []*rowExecutionState) []*groupExecution {
	grouped := map[string]*groupExecution{}
	ordered := make([]*groupExecution, 0)
	for _, state := range states {
		if state.Error != "" {
			continue
		}
		group, ok := grouped[state.Parsed.GroupKey]
		if !ok {
			group = &groupExecution{
				Key:      state.Parsed.GroupKey,
				Rows:     []*rowExecutionState{},
				RowStart: state.Parsed.RowNumber,
			}
			grouped[state.Parsed.GroupKey] = group
			ordered = append(ordered, group)
		}
		group.Rows = append(group.Rows, state)
	}

	validGroups := make([]*groupExecution, 0, len(ordered))
	for _, group := range ordered {
		if message := validateGroupRows(group.Rows); message != "" {
			for _, row := range group.Rows {
				row.Error = message
			}
			continue
		}
		validGroups = append(validGroups, group)
	}

	slices.SortFunc(validGroups, func(left, right *groupExecution) int {
		return left.RowStart - right.RowStart
	})
	return validGroups
}

func validateGroupRows(rows []*rowExecutionState) string {
	if len(rows) == 0 {
		return ""
	}
	first := rows[0].Parsed
	seenSkuCodes := map[string]struct{}{}
	for _, row := range rows {
		if row.Parsed.ProductName != first.ProductName ||
			row.Parsed.CategoryID != first.CategoryID ||
			!equalNullableString(row.Parsed.Description, first.Description) ||
			row.Parsed.CoverImageRef != first.CoverImageRef ||
			!slices.Equal(row.Parsed.ImageRefs, first.ImageRefs) ||
			!slices.Equal(row.Parsed.Tags, first.Tags) ||
			!slices.Equal(row.Parsed.FilterDimensions, first.FilterDimensions) {
			return "rows in the same groupKey must share identical product-level fields"
		}

		if row.Parsed.SkuCode == "" {
			continue
		}
		if _, exists := seenSkuCodes[row.Parsed.SkuCode]; exists {
			return fmt.Sprintf("duplicate skuCode %q in the same group", row.Parsed.SkuCode)
		}
		seenSkuCodes[row.Parsed.SkuCode] = struct{}{}
	}
	return ""
}

func (s *Service) flushFailedRows(ctx context.Context, states []*rowExecutionState) error {
	queries := db.New(s.DB)
	for _, state := range states {
		if state.Error == "" || state.PersistedState == rowStatusFailed {
			continue
		}
		record, err := queries.UpdateProductImportRowResult(ctx, db.UpdateProductImportRowResultParams{
			ID:           state.Record.ID,
			Status:       rowStatusFailed,
			ErrorMessage: &state.Error,
			ProductID:    pgtype.UUID{},
			SkuID:        pgtype.UUID{},
		})
		if err != nil {
			return err
		}
		state.Record = record
		state.PersistedState = rowStatusFailed
	}
	return nil
}

func (s *Service) processGroup(ctx context.Context, group *groupExecution, resolver *imageResolver) error {
	coverURL, imageURLs, err := resolver.ResolveGroup(group.Rows[0].Parsed.CoverImageRef, group.Rows[0].Parsed.ImageRefs)
	if err != nil {
		return s.markGroupFailed(ctx, group.Rows, err.Error())
	}

	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return s.markGroupFailed(ctx, group.Rows, fmt.Sprintf("begin tx: %v", err))
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	queries := db.New(tx)
	existingSkus := map[string]db.CatalogSku{}
	matchedProductIDs := map[uuid.UUID]struct{}{}
	for _, row := range group.Rows {
		if row.Parsed.SkuCode == "" {
			continue
		}
		skuCode := row.Parsed.SkuCode
		matches, err := queries.ListSkusBySkuCode(ctx, &skuCode)
		if err != nil {
			return s.markGroupFailed(ctx, group.Rows, fmt.Sprintf("lookup skuCode %q: %v", skuCode, err))
		}
		if len(matches) > 1 {
			return s.markGroupFailed(ctx, group.Rows, fmt.Sprintf("skuCode %q matched multiple records", skuCode))
		}
		if len(matches) == 1 {
			existingSkus[skuCode] = matches[0]
			matchedProductIDs[matches[0].ProductID] = struct{}{}
		}
	}

	if len(matchedProductIDs) > 1 {
		return s.markGroupFailed(ctx, group.Rows, "matched skuCodes belong to different products")
	}

	groupHead := group.Rows[0].Parsed
	var product db.CatalogProduct
	if len(matchedProductIDs) == 1 {
		for productID := range matchedProductIDs {
			product, err = queries.UpdateProduct(ctx, db.UpdateProductParams{
				ID:               productID,
				Name:             groupHead.ProductName,
				Description:      groupHead.Description,
				CategoryID:       groupHead.CategoryID,
				CoverImageUrl:    coverURL,
				Images:           imageURLs,
				Tags:             groupHead.Tags,
				FilterDimensions: groupHead.FilterDimensions,
			})
		}
		if err != nil {
			return s.markGroupFailed(ctx, group.Rows, fmt.Sprintf("update product: %v", err))
		}
	} else {
		product, err = queries.CreateProduct(ctx, db.CreateProductParams{
			Name:             groupHead.ProductName,
			Description:      groupHead.Description,
			CategoryID:       groupHead.CategoryID,
			CoverImageUrl:    coverURL,
			Images:           imageURLs,
			Tags:             groupHead.Tags,
			FilterDimensions: groupHead.FilterDimensions,
		})
		if err != nil {
			return s.markGroupFailed(ctx, group.Rows, fmt.Sprintf("create product: %v", err))
		}
	}

	for _, state := range group.Rows {
		attributesJSON, err := json.Marshal(state.Parsed.Attributes)
		if err != nil {
			return s.markGroupFailed(ctx, group.Rows, fmt.Sprintf("marshal attributes: %v", err))
		}

		skuCode := normalizeNullableString(state.Parsed.SkuCode)
		var sku db.CatalogSku
		existing, hasExisting := existingSkus[state.Parsed.SkuCode]
		if hasExisting {
			sku, err = queries.UpdateSku(ctx, db.UpdateSkuParams{
				ID:         existing.ID,
				SkuCode:    skuCode,
				Name:       state.Parsed.SkuName,
				Spec:       state.Parsed.Spec,
				Attributes: attributesJSON,
				Unit:       state.Parsed.Unit,
				IsActive:   state.Parsed.IsActive,
			})
		} else {
			sku, err = queries.CreateSku(ctx, db.CreateSkuParams{
				ProductID:  product.ID,
				SkuCode:    skuCode,
				Name:       state.Parsed.SkuName,
				Spec:       state.Parsed.Spec,
				Attributes: attributesJSON,
				Unit:       state.Parsed.Unit,
				IsActive:   state.Parsed.IsActive,
			})
		}
		if err != nil {
			return s.markGroupFailed(ctx, group.Rows, fmt.Sprintf("upsert sku: %v", err))
		}

		if _, err := queries.DeletePriceTiersBySku(ctx, sku.ID); err != nil {
			return s.markGroupFailed(ctx, group.Rows, fmt.Sprintf("delete old price tiers: %v", err))
		}
		for _, tier := range state.Parsed.PriceTiers {
			var maxQty *int32
			if tier.MaxQty != nil {
				value := intToInt32(*tier.MaxQty)
				maxQty = &value
			}
			if _, err := queries.CreatePriceTier(ctx, db.CreatePriceTierParams{
				SkuID:        sku.ID,
				MinQty:       intToInt32(tier.MinQty),
				MaxQty:       maxQty,
				UnitPriceFen: tier.UnitPriceFen,
			}); err != nil {
				return s.markGroupFailed(ctx, group.Rows, fmt.Sprintf("create price tier: %v", err))
			}
		}

		state.Record, err = db.New(tx).UpdateProductImportRowResult(ctx, db.UpdateProductImportRowResultParams{
			ID:           state.Record.ID,
			Status:       rowStatusSucceeded,
			ErrorMessage: nil,
			ProductID:    pgtype.UUID{Bytes: product.ID, Valid: true},
			SkuID:        pgtype.UUID{Bytes: sku.ID, Valid: true},
		})
		if err != nil {
			return s.markGroupFailed(ctx, group.Rows, fmt.Sprintf("update row result: %v", err))
		}
		state.PersistedState = rowStatusSucceeded
		state.Error = ""
	}

	if err := tx.Commit(ctx); err != nil {
		return s.markGroupFailed(ctx, group.Rows, fmt.Sprintf("commit tx: %v", err))
	}
	return nil
}

func (s *Service) markGroupFailed(ctx context.Context, rows []*rowExecutionState, message string) error {
	queries := db.New(s.DB)
	for _, state := range rows {
		state.Error = message
		record, err := queries.UpdateProductImportRowResult(ctx, db.UpdateProductImportRowResultParams{
			ID:           state.Record.ID,
			Status:       rowStatusFailed,
			ErrorMessage: &message,
			ProductID:    pgtype.UUID{},
			SkuID:        pgtype.UUID{},
		})
		if err != nil {
			return err
		}
		state.Record = record
		state.PersistedState = rowStatusFailed
	}
	return fmt.Errorf("%s", message)
}

func (s *Service) failJob(ctx context.Context, jobID uuid.UUID, reason string) error {
	reportURL, err := s.writeFatalErrorReport(jobID, reason)
	if err != nil {
		s.logError("write fatal product import error report failed", err)
	}
	_, finalizeErr := db.New(s.DB).FinalizeImportJob(ctx, db.FinalizeImportJobParams{
		ID:             jobID,
		Status:         string(oapi.FAILED),
		Progress:       100,
		ResultFileUrl:  nil,
		ErrorReportUrl: reportURL,
	})
	if finalizeErr != nil {
		return finalizeErr
	}
	return nil
}

func (s *Service) readWorkbook(excelPath string) ([][]string, error) {
	file, err := os.Open(excelPath)
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = file.Close()
	}()
	return excel.ReadRows(file)
}

func summarizeStates(states []*rowExecutionState) (int, int, int) {
	totalRows := len(states)
	successRows := 0
	failedRows := 0
	for _, state := range states {
		if state.PersistedState == rowStatusSucceeded {
			successRows++
			continue
		}
		failedRows++
	}
	return totalRows, successRows, failedRows
}

func (s *Service) writeSummary(jobID uuid.UUID, summary importSummary) (*string, error) {
	relativePath := filepath.ToSlash(filepath.Join("import-jobs", jobID.String(), "reports", "summary.json"))
	localPath := filepath.Join(s.MediaLocalOutputDir, filepath.FromSlash(relativePath))
	if err := os.MkdirAll(filepath.Dir(localPath), 0o755); err != nil {
		return nil, err
	}
	encoded, err := json.MarshalIndent(summary, "", "  ")
	if err != nil {
		return nil, err
	}
	if err := os.WriteFile(localPath, encoded, 0o644); err != nil {
		return nil, err
	}
	urlValue := s.publicURL(relativePath)
	return &urlValue, nil
}

func (s *Service) writeErrorReport(jobID uuid.UUID, states []*rowExecutionState) (*string, error) {
	relativePath := filepath.ToSlash(filepath.Join("import-jobs", jobID.String(), "reports", "errors.csv"))
	localPath := filepath.Join(s.MediaLocalOutputDir, filepath.FromSlash(relativePath))
	if err := os.MkdirAll(filepath.Dir(localPath), 0o755); err != nil {
		return nil, err
	}

	file, err := os.Create(localPath)
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = file.Close()
	}()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	if err := writer.Write([]string{"rowNumber", "groupKey", "skuCode", "productName", "status", "errorMessage"}); err != nil {
		return nil, err
	}
	for _, state := range states {
		if state.PersistedState != rowStatusFailed {
			continue
		}
		if err := writer.Write([]string{
			fmt.Sprintf("%d", state.Parsed.RowNumber),
			state.Parsed.GroupKey,
			state.Parsed.SkuCode,
			state.Parsed.ProductName,
			state.PersistedState,
			state.Error,
		}); err != nil {
			return nil, err
		}
	}
	urlValue := s.publicURL(relativePath)
	return &urlValue, nil
}

func (s *Service) writeFatalErrorReport(jobID uuid.UUID, reason string) (*string, error) {
	state := &rowExecutionState{
		Parsed:         parsedRow{RowNumber: 0},
		Error:          reason,
		PersistedState: rowStatusFailed,
	}
	return s.writeErrorReport(jobID, []*rowExecutionState{state})
}

func (s *Service) publicURL(relativePath string) string {
	return strings.TrimRight(s.MediaPublicBaseURL, "/") + "/" + strings.TrimLeft(filepath.ToSlash(relativePath), "/")
}

func (s *Service) jobRootDir(jobID uuid.UUID) string {
	return filepath.Join(s.MediaLocalOutputDir, "import-jobs", jobID.String())
}

func (s *Service) logError(message string, err error) {
	if s == nil || s.Logger == nil {
		return
	}
	s.Logger.Error(message, "error", err)
}

type imageResolver struct {
	jobID         uuid.UUID
	localBaseDir  string
	publicBaseURL string
	imageBaseURL  string
	zipReader     *zip.ReadCloser
	index         map[string]*zip.File
	cache         map[string]string
}

func newImageResolver(job db.ProductImportJob, mediaLocalBase, mediaPublicBase string) (*imageResolver, error) {
	resolver := &imageResolver{
		jobID:         job.JobID,
		localBaseDir:  mediaLocalBase,
		publicBaseURL: mediaPublicBase,
		cache:         map[string]string{},
	}
	if job.ImageBaseUrl != nil {
		resolver.imageBaseURL = strings.TrimSpace(*job.ImageBaseUrl)
	}
	if job.ImagesZipPath == nil || strings.TrimSpace(*job.ImagesZipPath) == "" {
		return resolver, nil
	}

	reader, err := zip.OpenReader(*job.ImagesZipPath)
	if err != nil {
		return nil, err
	}
	resolver.zipReader = reader
	resolver.index = map[string]*zip.File{}
	for _, file := range reader.File {
		if file.FileInfo().IsDir() {
			continue
		}
		normalized := normalizeArchiveKey(file.Name)
		resolver.index[normalized] = file
		base := normalizeArchiveKey(filepath.Base(file.Name))
		if _, exists := resolver.index[base]; !exists {
			resolver.index[base] = file
		}
	}
	return resolver, nil
}

func (r *imageResolver) ResolveGroup(coverRef string, imageRefs []string) (*string, []string, error) {
	resolvedImages := make([]string, 0, len(imageRefs))
	for _, ref := range imageRefs {
		value, err := r.resolve(ref)
		if err != nil {
			return nil, nil, err
		}
		if value == "" {
			continue
		}
		if !slices.Contains(resolvedImages, value) {
			resolvedImages = append(resolvedImages, value)
		}
	}

	var coverURL *string
	if strings.TrimSpace(coverRef) != "" {
		value, err := r.resolve(coverRef)
		if err != nil {
			return nil, nil, err
		}
		if value != "" {
			coverURL = &value
			if !slices.Contains(resolvedImages, value) {
				resolvedImages = append([]string{value}, resolvedImages...)
			}
		}
	}
	if coverURL == nil && len(resolvedImages) > 0 {
		coverURL = &resolvedImages[0]
	}
	return coverURL, resolvedImages, nil
}

func (r *imageResolver) resolve(ref string) (string, error) {
	trimmed := strings.TrimSpace(ref)
	if trimmed == "" {
		return "", nil
	}
	if looksLikeURL(trimmed) {
		return trimmed, nil
	}
	if r.imageBaseURL != "" {
		baseURL, err := url.Parse(strings.TrimRight(r.imageBaseURL, "/") + "/")
		if err == nil {
			joined, joinErr := baseURL.Parse(strings.TrimLeft(trimmed, "/"))
			if joinErr == nil {
				return joined.String(), nil
			}
		}
	}
	if r.index == nil {
		return "", fmt.Errorf("image %q was not found in imagesZip", trimmed)
	}

	key := normalizeArchiveKey(trimmed)
	if cached, ok := r.cache[key]; ok {
		return cached, nil
	}
	file, ok := r.index[key]
	if !ok {
		base := normalizeArchiveKey(filepath.Base(trimmed))
		file, ok = r.index[base]
		if !ok {
			return "", fmt.Errorf("image %q was not found in imagesZip", trimmed)
		}
		key = base
	}

	source, err := file.Open()
	if err != nil {
		return "", err
	}
	defer func() {
		_ = source.Close()
	}()

	fileName := uuid.NewString() + filepath.Ext(file.Name)
	relativePath := filepath.ToSlash(filepath.Join("import-jobs", r.jobID.String(), "images", fileName))
	localPath := filepath.Join(r.localBaseDir, filepath.FromSlash(relativePath))
	if err := os.MkdirAll(filepath.Dir(localPath), 0o755); err != nil {
		return "", err
	}
	if err := copyReaderToFile(localPath, source); err != nil {
		return "", err
	}
	publicURL := strings.TrimRight(r.publicBaseURL, "/") + "/" + strings.TrimLeft(relativePath, "/")
	r.cache[key] = publicURL
	return publicURL, nil
}

func (r *imageResolver) Close() {
	if r == nil || r.zipReader == nil {
		return
	}
	_ = r.zipReader.Close()
}

func equalNullableString(left, right *string) bool {
	if left == nil && right == nil {
		return true
	}
	if left == nil || right == nil {
		return false
	}
	return *left == *right
}

func intToInt32(value int) int32 {
	if value > math.MaxInt32 {
		return math.MaxInt32
	}
	if value < math.MinInt32 {
		return math.MinInt32
	}
	return int32(value)
}

func claimToProductImportJob(row db.ClaimNextPendingProductImportJobRow) db.ProductImportJob {
	return db.ProductImportJob{
		JobID:         row.JobID,
		ExcelFilePath: row.ExcelFilePath,
		ExcelFileName: row.ExcelFileName,
		ImagesZipPath: row.ImagesZipPath,
		ImagesZipName: row.ImagesZipName,
		ImageBaseUrl:  row.ImageBaseUrl,
		TotalRows:     row.TotalRows,
		SuccessRows:   row.SuccessRows,
		FailedRows:    row.FailedRows,
		CreatedAt:     row.ProductImportCreatedAt,
		UpdatedAt:     row.ProductImportUpdatedAt,
	}
}

func maxInt(left, right int) int {
	if left > right {
		return left
	}
	return right
}

func copyReaderToFile(path string, reader io.Reader) error {
	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer func() {
		_ = file.Close()
	}()
	if _, err := io.Copy(file, reader); err != nil {
		return err
	}
	return file.Close()
}

func sanitizeFileName(raw, fallback string) string {
	value := strings.TrimSpace(filepath.Base(raw))
	if value == "" || value == "." || value == string(filepath.Separator) {
		return fallback
	}
	value = strings.ReplaceAll(value, "..", "")
	value = strings.ReplaceAll(value, "/", "_")
	value = strings.ReplaceAll(value, "\\", "_")
	if value == "" {
		return fallback
	}
	return value
}

func normalizeArchiveKey(raw string) string {
	value := strings.TrimSpace(raw)
	value = strings.ReplaceAll(value, "\\", "/")
	value = path.Clean("/" + strings.TrimLeft(value, "/"))
	value = strings.TrimPrefix(value, "/")
	return strings.ToLower(value)
}
