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
	"github.com/teamdsb/tmo/packages/go-shared/catalogspec"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
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
	SourceNamespace   string
}

type Service struct {
	DB                  *pgxpool.Pool
	MediaLocalOutputDir string
	MediaPublicBaseURL  string
	Logger              *slog.Logger
}

type rowExecutionState struct {
	Parsed          parsedRow
	Record          db.ProductImportRow
	Error           string
	ParseError      string
	PersistedState  string
	Action          string
	TargetSnapshot  string
	PreserveProduct bool
	PreserveSKU     bool
}

type groupExecution struct {
	Key         string
	Rows        []*rowExecutionState
	SkippedRows []*rowExecutionState
	RowStart    int
}

type groupExecutionError struct {
	message string
}

func (e *groupExecutionError) Error() string {
	return e.message
}

func newGroupExecutionError(format string, args ...interface{}) error {
	return &groupExecutionError{message: fmt.Sprintf(format, args...)}
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
	// #nosec G301 -- public report/image ancestors must be traversable by Nginx.
	if err := os.MkdirAll(jobRoot, 0o755); err != nil {
		return db.ImportJob{}, fmt.Errorf("create job media dir: %w", err)
	}
	inputDir := filepath.Join(jobRoot, "input")
	if err := os.MkdirAll(inputDir, 0o750); err != nil {
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
	if _, err := tx.Exec(ctx, "UPDATE product_import_jobs SET source_namespace=$2 WHERE job_id=$1", job.ID, strings.TrimSpace(input.SourceNamespace)); err != nil {
		return db.ImportJob{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return db.ImportJob{}, fmt.Errorf("commit tx: %w", err)
	}
	cleanupDir = false
	return job, nil
}

func (s *Service) ResetStaleRunning(ctx context.Context) error {
	// Expired leases are reclaimed atomically by RunNext. Live workers are untouched.
	return nil
}

func (s *Service) RunNext(ctx context.Context) (bool, error) {
	if s == nil || s.DB == nil {
		return false, nil
	}

	claimed, err := db.New(s.DB).ClaimProductImportLifecycle(ctx)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, fmt.Errorf("claim pending product import job: %w", err)
	}

	job := db.ProductImportJob(claimed)
	runCtx, cancel := context.WithCancel(ctx)
	runCtx = context.WithValue(runCtx, leaseContextKey{}, leaseIdentity{JobID: job.JobID, Token: job.LeaseToken})
	done := make(chan struct{})
	go func() {
		defer close(done)
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-runCtx.Done():
				return
			case <-ticker.C:
				n, heartbeatErr := db.New(s.DB).HeartbeatProductImportLifecycle(runCtx, db.HeartbeatProductImportLifecycleParams{JobID: job.JobID, LeaseToken: job.LeaseToken})
				if heartbeatErr != nil || n != 1 {
					cancel()
					return
				}
			}
		}
	}()
	if job.Phase == "COMMITTING" {
		err = s.commitPreview(runCtx, job)
	} else {
		err = s.preparePreview(runCtx, job)
	}
	if err != nil && runCtx.Err() == nil && !errors.Is(err, ErrLeaseLost) {
		err = s.failLifecycle(runCtx, job, err.Error())
	}
	cancel()
	<-done
	return true, err
}

func (s *Service) buildGroups(states []*rowExecutionState) []*groupExecution {
	grouped := map[string]*groupExecution{}
	ordered := make([]*groupExecution, 0)
	// Resolve the group alias before grouping so even a row that failed before
	// UUID parsing rejects its complete product group.
	productKeyByGroup := map[string]string{}
	for _, state := range states {
		if state.Parsed.ProductID != uuid.Nil && productKeyByGroup[state.Parsed.GroupKey] == "" {
			productKeyByGroup[state.Parsed.GroupKey] = state.Parsed.ProductID.String()
		}
	}
	for _, state := range states {
		key := state.Parsed.GroupKey
		if productKeyByGroup[key] != "" {
			key = productKeyByGroup[key]
		}
		group, ok := grouped[key]
		if !ok {
			group = &groupExecution{
				Key:      state.Parsed.GroupKey,
				Rows:     []*rowExecutionState{},
				RowStart: state.Parsed.RowNumber,
			}
			grouped[key] = group
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
	seenIDs := map[uuid.UUID]bool{}
	for _, row := range rows {
		if row.Error != "" {
			return fmt.Sprintf("row %d: %s", row.Parsed.RowNumber, row.Error)
		}
		if row.Parsed.NoSKU && len(rows) > 1 {
			return "a product-only row cannot be combined with SKU rows"
		}
		if row.Parsed.SkuID != uuid.Nil {
			if seenIDs[row.Parsed.SkuID] {
				return "duplicate SKU ID in the same group"
			}
			seenIDs[row.Parsed.SkuID] = true
		}
		if row.Parsed.ProductID != first.ProductID || row.Parsed.ProductStatus != first.ProductStatus || row.Parsed.ProductName != first.ProductName ||
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

func (s *Service) processGroupTransaction(
	ctx context.Context,
	group *groupExecution,
	coverURL *string,
	imageURLs []string,
) error {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return newGroupExecutionError("begin tx: %v", err)
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	queries := db.New(tx)
	if err := lockLease(ctx, tx); err != nil {
		return err
	}
	if err := lockSourceGroups(ctx, tx, group.Rows); err != nil {
		return err
	}
	if err := verifyGroupTargets(ctx, queries, group.Rows); err != nil {
		return err
	}
	if len(group.Rows) == 0 {
		if err := persistSkippedRows(ctx, queries, group.SkippedRows); err != nil {
			return err
		}
		if err := verifyLease(ctx, tx); err != nil {
			return err
		}
		return tx.Commit(ctx)
	}
	existingSkus := map[int]db.CatalogSku{}
	resolvedSkuRows := map[uuid.UUID]int{}
	matchedProductIDs := map[uuid.UUID]struct{}{}
	for _, row := range group.Rows {
		if row.Parsed.ProductID != uuid.Nil {
			matchedProductIDs[row.Parsed.ProductID] = struct{}{}
		}
		var matched *db.CatalogSku
		if row.Parsed.SkuID != uuid.Nil {
			skus, err := queries.ListSkusByIDs(ctx, []uuid.UUID{row.Parsed.SkuID})
			if err != nil || len(skus) != 1 {
				return newGroupExecutionError("SKU ID %s was not found", row.Parsed.SkuID)
			}
			matched = &skus[0]
		}
		if row.Parsed.SkuCode != "" {
			matches, err := queries.ListSkusBySkuCode(ctx, &row.Parsed.SkuCode)
			if err != nil {
				return newGroupExecutionError("lookup skuCode: %v", err)
			}
			if len(matches) > 1 {
				return newGroupExecutionError("skuCode %q matched multiple records", row.Parsed.SkuCode)
			}
			if len(matches) == 1 {
				if matched != nil && matched.ID != matches[0].ID {
					return newGroupExecutionError("SKU ID and skuCode identify different records")
				}
				matched = &matches[0]
			}
		}
		if matched != nil {
			if row.Action != "" && row.Parsed.SkuID == uuid.Nil {
				return fmt.Errorf("%w: SKU code was created after preview", ErrConflict)
			}
			if previousRow, exists := resolvedSkuRows[matched.ID]; exists {
				return newGroupExecutionError("rows %d and %d resolve to the same SKU ID %s", previousRow, row.Parsed.RowNumber, matched.ID)
			}
			resolvedSkuRows[matched.ID] = row.Parsed.RowNumber
			existingSkus[row.Parsed.RowNumber] = *matched
			matchedProductIDs[matched.ProductID] = struct{}{}
		}
	}
	if len(matchedProductIDs) > 1 {
		return newGroupExecutionError("product IDs and matched SKUs belong to different products")
	}

	groupHead := group.Rows[0].Parsed
	groupHead.ClearFields = append(append([]string{}, groupHead.ClearFields...), productClearFields(group.Rows)...)
	preserveProduct := group.Rows[0].PreserveProduct
	normalizedImages := nonNilStrings(imageURLs)
	normalizedTags := nonNilStrings(groupHead.Tags)
	normalizedFilterDimensions := nonNilStrings(groupHead.FilterDimensions)
	var product db.CatalogProduct
	if len(matchedProductIDs) == 1 {
		for productID := range matchedProductIDs {
			existingProduct, getErr := queries.GetProductForUpdate(ctx, productID)
			if getErr != nil {
				return newGroupExecutionError("get product: %v", getErr)
			}
			for _, state := range group.Rows {
				if state.TargetSnapshot != "" {
					snapshot, snapshotErr := productSnapshot(ctx, queries, productID)
					if snapshotErr != nil {
						return snapshotErr
					}
					if snapshot != state.TargetSnapshot {
						return fmt.Errorf("%w: target product changed after preview", ErrConflict)
					}
				}
			}
			if preserveProduct {
				if !groupHead.ProvidedFields["resolvedProductName"] {
					groupHead.ProductName = existingProduct.Name
				}
				if !groupHead.ProvidedFields["resolvedCategoryId"] {
					groupHead.CategoryID = existingProduct.CategoryID
				}
				groupHead.Description = existingProduct.Description
				normalizedTags = existingProduct.Tags
				if !groupHead.ProvidedFields["resolvedDimensions"] {
					normalizedFilterDimensions = existingProduct.FilterDimensions
				}
				if !groupHead.ProvidedFields["sourceImageFill"] {
					normalizedImages = existingProduct.Images
					coverURL = existingProduct.CoverImageUrl
				}
			}
			if !provided(groupHead, "description") {
				groupHead.Description = existingProduct.Description
			}
			if !provided(groupHead, "images") {
				normalizedImages = existingProduct.Images
			}
			if !provided(groupHead, "coverImage") {
				coverURL = existingProduct.CoverImageUrl
			}
			if !provided(groupHead, "tags") {
				normalizedTags = existingProduct.Tags
			}
			if !provided(groupHead, "filterDimensions") {
				normalizedFilterDimensions = existingProduct.FilterDimensions
			}
			if slices.Contains(groupHead.ClearFields, "description") {
				groupHead.Description = nil
			}
			if slices.Contains(groupHead.ClearFields, "images") {
				normalizedImages = []string{}
			}
			if slices.Contains(groupHead.ClearFields, "coverImage") {
				coverURL = nil
			}
			if slices.Contains(groupHead.ClearFields, "tags") {
				normalizedTags = []string{}
			}
			product, err = queries.UpdateProduct(ctx, db.UpdateProductParams{
				ID:               productID,
				Name:             groupHead.ProductName,
				Description:      groupHead.Description,
				CategoryID:       groupHead.CategoryID,
				CoverImageUrl:    coverURL,
				Images:           normalizedImages,
				Tags:             normalizedTags,
				FilterDimensions: normalizedFilterDimensions,
				Status:           importProductStatus(groupHead.ProductStatus, existingProduct.Status),
			})
		}
		if err != nil {
			return newGroupExecutionError("update product: %v", err)
		}
	} else {
		product, err = queries.CreateProduct(ctx, db.CreateProductParams{
			Name:             groupHead.ProductName,
			Description:      groupHead.Description,
			CategoryID:       groupHead.CategoryID,
			CoverImageUrl:    coverURL,
			Images:           normalizedImages,
			Tags:             normalizedTags,
			FilterDimensions: normalizedFilterDimensions,
			Status:           importProductStatus(groupHead.ProductStatus, "DRAFT"),
		})
		if err != nil {
			return newGroupExecutionError("create product: %v", err)
		}
	}

	for _, state := range group.Rows {
		if state.Parsed.NoSKU {
			record, err := queries.UpdateProductImportRowResult(ctx, db.UpdateProductImportRowResultParams{ID: state.Record.ID, Status: rowStatusSucceeded, ProductID: pgtype.UUID{Bytes: product.ID, Valid: true}})
			if err != nil {
				return err
			}
			state.Record = record
			state.PersistedState = rowStatusSucceeded
			if err := persistSourceAndReviews(ctx, queries, state, product.ID, uuid.Nil); err != nil {
				return err
			}
			continue
		}
		attributesJSON, err := json.Marshal(state.Parsed.Attributes)
		if err != nil {
			return newGroupExecutionError("marshal attributes: %v", err)
		}

		skuCode := normalizeNullableString(state.Parsed.SkuCode)
		var sku db.CatalogSku
		existing, hasExisting := existingSkus[state.Parsed.RowNumber]
		switch {
		case hasExisting && state.PreserveSKU:
			sku, err = updatePreservedSKU(ctx, queries, product, state.Parsed, existing)
		case hasExisting:
			if !provided(state.Parsed, "skuCode") {
				skuCode = existing.SkuCode
			}
			if !provided(state.Parsed, "skuName") {
				state.Parsed.SkuName = existing.Name
			}
			if !provided(state.Parsed, "spec") {
				state.Parsed.Spec = existing.Spec
			}
			if !provided(state.Parsed, "unit") {
				state.Parsed.Unit = existing.Unit
			}
			if !provided(state.Parsed, "isActive") {
				state.Parsed.IsActive = existing.IsActive
			}
			attrs := map[string]string{}
			if err := json.Unmarshal(existing.Attributes, &attrs); err != nil {
				return err
			}
			for key, value := range state.Parsed.Attributes {
				attrs[key] = value
			}
			if slices.Contains(state.Parsed.ClearFields, "attributes") {
				attrs = map[string]string{}
			}
			attributesJSON, err = json.Marshal(attrs)
			if err != nil {
				return err
			}
			if slices.Contains(state.Parsed.ClearFields, "skuCode") {
				skuCode = nil
			}
			if slices.Contains(state.Parsed.ClearFields, "unit") {
				state.Parsed.Unit = nil
			}
			if len(product.FilterDimensions) > 0 && state.Parsed.IsActive {
				normalized, path, normalizeErr := catalogspec.NormalizeValues(product.FilterDimensions, attrs)
				if normalizeErr != nil {
					return normalizeErr
				}
				attributesJSON, _ = json.Marshal(normalized)
				state.Parsed.Spec = &path
			}
			sku, err = queries.UpdateSku(ctx, db.UpdateSkuParams{
				ID:         existing.ID,
				SkuCode:    skuCode,
				Name:       state.Parsed.SkuName,
				Spec:       state.Parsed.Spec,
				Attributes: attributesJSON,
				Unit:       state.Parsed.Unit,
				IsActive:   state.Parsed.IsActive,
			})
		default:
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
			return newGroupExecutionError("upsert sku: %v", err)
		}

		if (!state.PreserveSKU && (!hasExisting || provided(state.Parsed, "priceTiers"))) || slices.Contains(state.Parsed.ClearFields, "priceTiers") {
			if _, err := queries.DeletePriceTiersBySku(ctx, sku.ID); err != nil {
				return newGroupExecutionError("delete old price tiers: %v", err)
			}
			for _, tier := range state.Parsed.PriceTiers {
				if slices.Contains(state.Parsed.ClearFields, "priceTiers") {
					break
				}
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
					return newGroupExecutionError("create price tier: %v", err)
				}
			}
		}

		record, err := db.New(tx).UpdateProductImportRowResult(ctx, db.UpdateProductImportRowResultParams{
			ID:           state.Record.ID,
			Status:       rowStatusSucceeded,
			ErrorMessage: nil,
			ProductID:    pgtype.UUID{Bytes: product.ID, Valid: true},
			SkuID:        pgtype.UUID{Bytes: sku.ID, Valid: true},
		})
		if err != nil {
			return newGroupExecutionError("update row result: %v", err)
		}
		state.Record = record
		state.PersistedState = rowStatusSucceeded
		state.Error = ""
		if err := persistSourceAndReviews(ctx, queries, state, product.ID, sku.ID); err != nil {
			return err
		}
	}

	allSkus, err := queries.ListSkusByProduct(ctx, product.ID)
	if err != nil {
		return err
	}
	variants := make([]catalogspec.Variant, 0, len(allSkus))
	for _, sku := range allSkus {
		attrs := map[string]string{}
		if err := json.Unmarshal(sku.Attributes, &attrs); err != nil {
			return err
		}
		variants = append(variants, catalogspec.Variant{ID: sku.ID.String(), Name: sku.Name, Spec: derefString(sku.Spec), Attributes: attrs, Active: sku.IsActive})
	}
	if err := catalogspec.ValidateCombinations(product.FilterDimensions, variants); err != nil {
		return newGroupExecutionError("invalid final SKU combinations: %v", err)
	}
	if product.Status == "ACTIVE" {
		pending, err := queries.CountPendingProductImportReviews(ctx, product.ID)
		if err != nil {
			return err
		}
		if pending > 0 {
			return fmt.Errorf("%w: product has unresolved import reviews and cannot be activated", ErrConflict)
		}
	}
	if err := persistSkippedRows(ctx, queries, group.SkippedRows); err != nil {
		return err
	}
	if err := verifyLease(ctx, tx); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return newGroupExecutionError("commit tx: %v", err)
	}
	return nil
}

func (s *Service) writeErrorReport(jobID uuid.UUID, states []*rowExecutionState) (*string, error) {
	// A separate report identifier prevents retries from replacing an already published file.
	relativePath := filepath.ToSlash(filepath.Join("import-jobs", jobID.String(), "reports", "errors-"+uuid.NewString()+".csv"))
	localPath := filepath.Join(s.MediaLocalOutputDir, filepath.FromSlash(relativePath))
	// #nosec G301 -- published import reports/images must be traversable by Nginx.
	if err := os.MkdirAll(filepath.Dir(localPath), 0o755); err != nil {
		return nil, err
	}

	// #nosec G304 -- server-generated report path inside the job media directory.
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
	const maxProductImages = 9
	uniqueRefs := make([]string, 0, len(imageRefs)+1)
	for _, ref := range append([]string{coverRef}, imageRefs...) {
		trimmed := strings.TrimSpace(ref)
		if trimmed != "" && !slices.Contains(uniqueRefs, trimmed) {
			uniqueRefs = append(uniqueRefs, trimmed)
		}
	}
	if len(uniqueRefs) > maxProductImages {
		return nil, nil, fmt.Errorf("product supports at most %d images", maxProductImages)
	}

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
	if len(resolvedImages) > maxProductImages {
		return nil, nil, fmt.Errorf("product supports at most %d images", maxProductImages)
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
	// #nosec G301 -- published import reports/images must be traversable by Nginx.
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

func nonNilStrings(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}

func copyReaderToFile(path string, reader io.Reader) error {
	// #nosec G304 -- caller constructs this upload path beneath the server-managed job directory.
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

func importProductStatus(provided, fallback string) string {
	if provided != "" {
		return provided
	}
	return fallback
}
