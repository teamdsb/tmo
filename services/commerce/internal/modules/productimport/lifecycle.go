package productimport

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/teamdsb/tmo/packages/go-shared/catalogspec"
	"github.com/teamdsb/tmo/services/commerce/internal/db"
)

var (
	ErrConflict  = errors.New("import state conflict")
	ErrInvalid   = errors.New("invalid import request")
	ErrLeaseLost = errors.New("import lease lost")
)

type Issue struct {
	Code     string `json:"code"`
	Message  string `json:"message"`
	Severity string `json:"severity"`
}

type Summary struct {
	TotalRows      int `json:"totalRows"`
	SuccessRows    int `json:"successRows"`
	FailedRows     int `json:"failedRows"`
	SkippedRows    int `json:"skippedRows"`
	SplitProducts  int `json:"splitProducts"`
	ReviewCount    int `json:"reviewCount"`
	ProductCreates int `json:"productCreates"`
	ProductUpdates int `json:"productUpdates"`
	SKUCreates     int `json:"skuCreates"`
	SKUUpdates     int `json:"skuUpdates"`
}

type JobDetail struct {
	ID             uuid.UUID `json:"id"`
	Type           string    `json:"type"`
	Status         string    `json:"status"`
	Phase          string    `json:"phase"`
	Progress       int       `json:"progress"`
	FileName       string    `json:"fileName"`
	SourceFormat   string    `json:"sourceFormat"`
	Revision       int       `json:"revision"`
	Summary        Summary   `json:"summary"`
	ResultFileURL  *string   `json:"resultFileUrl"`
	ErrorReportURL *string   `json:"errorReportUrl"`
	CreatedAt      time.Time `json:"createdAt"`
}

type PreviewRow struct {
	RowID       uuid.UUID         `json:"rowId"`
	SourceSheet string            `json:"sourceSheet"`
	SourceRow   int               `json:"sourceRow"`
	SKUCode     string            `json:"skuCode"`
	SKUName     string            `json:"skuName"`
	Spec        string            `json:"spec"`
	Attributes  map[string]string `json:"attributes"`
	Unit        string            `json:"unit"`
	Action      string            `json:"action"`
	Issues      []Issue           `json:"issues"`
	RawValues   map[string]string `json:"rawValues"`
	ClearFields []string          `json:"clearFields"`
}

type PreviewGroup struct {
	Key         string       `json:"key"`
	ProductName string       `json:"productName"`
	ProductID   *uuid.UUID   `json:"productId"`
	CategoryID  uuid.UUID    `json:"categoryId"`
	Dimensions  []string     `json:"dimensions"`
	Action      string       `json:"action"`
	Rows        []PreviewRow `json:"rows"`
	Issues      []Issue      `json:"issues"`
	ClearFields []string     `json:"clearFields"`
}

type Preview struct {
	JobID        uuid.UUID      `json:"jobId"`
	Revision     int            `json:"revision"`
	SourceFormat string         `json:"sourceFormat"`
	Summary      Summary        `json:"summary"`
	Items        []PreviewGroup `json:"items"`
	Total        int            `json:"total"`
	Page         int            `json:"page"`
	PageSize     int            `json:"pageSize"`
}

type RowResolution struct {
	RowID       uuid.UUID          `json:"rowId"`
	Unit        *string            `json:"unit,omitempty"`
	Attributes  *map[string]string `json:"attributes,omitempty"`
	GroupKey    *string            `json:"groupKey,omitempty"`
	Ignored     *bool              `json:"ignored,omitempty"`
	ClearFields []string           `json:"clearFields,omitempty"`
}

type GroupResolution struct {
	Key         string          `json:"key"`
	ProductName *string         `json:"productName,omitempty"`
	CategoryID  *uuid.UUID      `json:"categoryId,omitempty"`
	Dimensions  *[]string       `json:"dimensions,omitempty"`
	Rows        []RowResolution `json:"rows"`
}

type ResolutionInput struct {
	ExpectedRevision int               `json:"expectedRevision"`
	Groups           []GroupResolution `json:"groups"`
}

type JobList struct {
	Items    []JobDetail `json:"items"`
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
}

type Review struct {
	ID          uuid.UUID         `json:"id"`
	JobID       uuid.UUID         `json:"jobId"`
	ProductID   uuid.UUID         `json:"productId"`
	SKUID       *uuid.UUID        `json:"skuId"`
	ProductName string            `json:"productName"`
	SourceSheet string            `json:"sourceSheet"`
	SourceRow   int               `json:"sourceRow"`
	Code        string            `json:"code"`
	Message     string            `json:"message"`
	Status      string            `json:"status"`
	RawValues   map[string]string `json:"rawValues"`
	CreatedAt   time.Time         `json:"createdAt"`
	ResolvedAt  *time.Time        `json:"resolvedAt"`
}

type ReviewList struct {
	Items    []Review `json:"items"`
	Total    int      `json:"total"`
	Page     int      `json:"page"`
	PageSize int      `json:"pageSize"`
}

// Stored separately from the public preview so persistence never loses source evidence.
type storedRow struct {
	Parsed          parsedRow `json:"parsed"`
	Error           string    `json:"error"`
	ParseError      string    `json:"parseError"`
	Action          string    `json:"action"`
	TargetSnapshot  string    `json:"targetSnapshot"`
	PreserveProduct bool      `json:"preserveProduct"`
	PreserveSKU     bool      `json:"preserveSKU"`
}

func pageBounds(page, size int) (int, int) {
	if page < 1 {
		page = 1
	}
	if size < 1 || size > 200 {
		size = 50
	}
	return page, size
}

func (s *Service) GetJob(ctx context.Context, id uuid.UUID) (JobDetail, error) {
	q := db.New(s.DB)
	base, err := q.GetImportJob(ctx, id)
	if err != nil {
		return JobDetail{}, err
	}
	result := JobDetail{ID: base.ID, Type: base.Type, Status: base.Status, Progress: int(base.Progress), ResultFileURL: base.ResultFileUrl, ErrorReportURL: base.ErrorReportUrl, CreatedAt: base.CreatedAt.Time}
	if base.Type == "PRODUCT_EXPORT" {
		export, err := q.GetProductExportJob(ctx, id)
		if err != nil {
			return JobDetail{}, err
		}
		result.FileName = "products.xlsx"
		result.Summary.TotalRows = int(export.ExportedRows)
		if base.Status == "SUCCEEDED" {
			result.Summary.SuccessRows = int(export.ExportedRows)
		}
	}
	if base.Type == "PRODUCT_IMPORT" {
		job, err := q.GetProductImportLifecycle(ctx, id)
		if err != nil {
			return JobDetail{}, err
		}
		result.FileName, result.SourceFormat, result.Phase, result.Revision = job.ExcelFileName, job.SourceFormat, job.Phase, int(job.PreviewRevision)
		if err := json.Unmarshal(job.Summary, &result.Summary); err != nil {
			return JobDetail{}, err
		}
		if job.Phase == "COMPLETED" {
			_, count, err := s.pendingJobReviews(ctx, id)
			if err != nil {
				return JobDetail{}, err
			}
			result.Summary.ReviewCount = count
		}
	}
	return result, nil
}

func loadRows(ctx context.Context, q *db.Queries, jobID uuid.UUID) ([]*rowExecutionState, error) {
	records, err := q.ListProductImportRowsByJob(ctx, jobID)
	if err != nil {
		return nil, err
	}
	result := make([]*rowExecutionState, 0, len(records))
	var legacy *bool
	for _, record := range records {
		var value storedRow
		if err := json.Unmarshal(record.RowData, &value); err != nil {
			return nil, err
		}
		var envelope map[string]json.RawMessage
		if err := json.Unmarshal(record.RowData, &envelope); err != nil {
			return nil, err
		}
		if _, current := envelope["parsed"]; !current {
			if legacy == nil {
				job, err := q.GetProductImportLifecycle(ctx, jobID)
				if err != nil {
					return nil, err
				}
				isLegacy := job.PreviewRevision == 0
				legacy = &isLegacy
			}
			if !*legacy {
				return nil, fmt.Errorf("import row %s has no persisted preview", record.ID)
			}
			// Pre-preview tasks persisted flat camelCase fields; keep the source JSON intact.
			if err := json.Unmarshal(record.RowData, &value.Parsed); err != nil {
				return nil, err
			}
			value.Parsed.SourceRow = int(record.LineNo)
			if value.Parsed.RowNumber == 0 {
				value.Parsed.RowNumber = int(record.LineNo)
			}
			if value.Parsed.GroupKey == "" && record.GroupKey != nil {
				value.Parsed.GroupKey = *record.GroupKey
			}
			if value.Parsed.ProductName == "" && record.ProductName != nil {
				value.Parsed.ProductName = *record.ProductName
			}
			if value.Parsed.Attributes == nil {
				value.Parsed.Attributes = map[string]string{}
			}
			if value.Parsed.RawValues == nil {
				value.Parsed.RawValues = map[string]string{}
			}
			value.Action = record.Status
			if record.ErrorMessage != nil {
				value.Error = *record.ErrorMessage
			}
		}
		result = append(result, &rowExecutionState{Parsed: value.Parsed, Record: record, Error: value.Error, ParseError: value.ParseError, PersistedState: record.Status, Action: value.Action, TargetSnapshot: value.TargetSnapshot, PreserveProduct: value.PreserveProduct, PreserveSKU: value.PreserveSKU})
	}
	return result, nil
}

func statePayload(state *rowExecutionState) []byte {
	value, _ := json.Marshal(storedRow{Parsed: state.Parsed, Error: state.Error, ParseError: state.ParseError, Action: state.Action, TargetSnapshot: state.TargetSnapshot, PreserveProduct: state.PreserveProduct, PreserveSKU: state.PreserveSKU})
	return value
}

func groupStates(states []*rowExecutionState) []*groupExecution {
	indexed := map[string]*groupExecution{}
	result := []*groupExecution{}
	for _, state := range states {
		key := state.Parsed.GroupKey
		if key == "" {
			key = "row:" + state.Record.ID.String()
		}
		group := indexed[key]
		if group == nil {
			group = &groupExecution{Key: key, RowStart: state.Parsed.RowNumber}
			indexed[key] = group
			result = append(result, group)
		}
		group.Rows = append(group.Rows, state)
	}
	return result
}

func previewGroups(states []*rowExecutionState, needsReview bool) []PreviewGroup {
	groups := []PreviewGroup{}
	for _, group := range groupStates(states) {
		head := group.Rows[0].Parsed
		item := PreviewGroup{Key: group.Key, ProductName: head.ProductName, CategoryID: head.CategoryID, Dimensions: nonNilStrings(head.FilterDimensions), Action: "SKIP", Rows: []PreviewRow{}, Issues: []Issue{}}
		item.ClearFields = productClearFields(group.Rows)
		if head.ProductID != uuid.Nil {
			id := head.ProductID
			item.ProductID = &id
		} else if group.Rows[0].Record.ProductID.Valid {
			id := uuid.UUID(group.Rows[0].Record.ProductID.Bytes)
			item.ProductID = &id
		}
		for _, state := range group.Rows {
			row := state.Parsed
			issues := append([]Issue{}, row.Issues...)
			if state.Error != "" {
				issues = append(issues, Issue{Code: "INVALID_ROW", Message: state.Error, Severity: "ERROR"})
			}
			action := state.Action
			if state.Error != "" {
				action = "ERROR"
			}
			if row.Ignored {
				action = "SKIP"
			}
			if action != "SKIP" {
				item.Action = action
			}
			item.Issues = append(item.Issues, issues...)
			item.Rows = append(item.Rows, PreviewRow{RowID: state.Record.ID, SourceSheet: row.SourceSheet, SourceRow: row.SourceRow, SKUCode: row.SkuCode, SKUName: row.SkuName, Spec: derefString(row.Spec), Attributes: row.Attributes, Unit: derefString(row.Unit), Action: action, Issues: issues, RawValues: row.RawValues, ClearFields: nonNilStrings(row.ClearFields)})
		}
		if !needsReview || len(item.Issues) > 0 {
			groups = append(groups, item)
		}
	}
	return groups
}

func summarizePreview(states []*rowExecutionState, completed bool) Summary {
	summary := Summary{TotalRows: len(states)}
	for _, group := range groupStates(states) {
		create, update, split := false, false, false
		for _, row := range group.Rows {
			if row.Parsed.Ignored || row.Action == "SKIP" {
				summary.SkippedRows++
				continue
			}
			if row.Error != "" || row.PersistedState == rowStatusFailed {
				summary.FailedRows++
				continue
			}
			if completed && row.PersistedState == rowStatusSucceeded {
				summary.SuccessRows++
			}
			if row.Parsed.Split {
				split = true
			}
			if len(row.Parsed.Issues) > 0 {
				summary.ReviewCount++
			}
			if row.Parsed.ProductID == uuid.Nil {
				create = true
			} else {
				update = true
			}
			if !row.Parsed.NoSKU {
				if row.Parsed.SkuID == uuid.Nil {
					summary.SKUCreates++
				} else {
					summary.SKUUpdates++
				}
			}
		}
		if create {
			summary.ProductCreates++
		} else if update {
			summary.ProductUpdates++
		}
		if split {
			summary.SplitProducts++
		}
	}
	return summary
}

func (s *Service) GetPreview(ctx context.Context, id uuid.UUID, page, size int, needsReview bool) (Preview, error) {
	job, err := db.New(s.DB).GetProductImportLifecycle(ctx, id)
	if err != nil {
		return Preview{}, err
	}
	states, err := loadRows(ctx, db.New(s.DB), id)
	if err != nil {
		return Preview{}, err
	}
	page, size = pageBounds(page, size)
	completed := job.Phase == "COMPLETED"
	groups := previewGroups(states, needsReview && !completed)
	summary := summarizePreview(states, completed)
	if completed {
		if job.PreviewRevision == 0 {
			if err := json.Unmarshal(job.Summary, &summary); err != nil {
				return Preview{}, err
			}
		}
		pending, count, err := s.pendingJobReviews(ctx, id)
		if err != nil {
			return Preview{}, err
		}
		summary.ReviewCount = count
		if needsReview {
			groups = slices.DeleteFunc(groups, func(group PreviewGroup) bool { return group.ProductID == nil || !pending[*group.ProductID] })
		}
	}
	result := Preview{JobID: id, Revision: int(job.PreviewRevision), SourceFormat: job.SourceFormat, Summary: summary, Total: len(groups), Page: page, PageSize: size, Items: []PreviewGroup{}}
	start := (page - 1) * size
	if start < len(groups) {
		result.Items = groups[start:min(start+size, len(groups))]
	}
	return result, nil
}

// Count affected catalog rows, not repeated reasons, matching the preview summary.
func (s *Service) pendingJobReviews(ctx context.Context, jobID uuid.UUID) (map[uuid.UUID]bool, int, error) {
	rows, err := s.DB.Query(ctx, `SELECT DISTINCT review.product_id,review.sku_id
FROM product_import_reviews review
WHERE review.status='PENDING' AND (review.job_id=$1 OR EXISTS (
    SELECT 1 FROM product_import_rows imported
    WHERE imported.job_id=$1 AND imported.product_id=review.product_id
      AND (review.sku_id IS NULL OR imported.sku_id=review.sku_id)
))`, jobID)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	products := map[uuid.UUID]bool{}
	count := 0
	for rows.Next() {
		var productID uuid.UUID
		var skuID pgtype.UUID
		if err := rows.Scan(&productID, &skuID); err != nil {
			return nil, 0, err
		}
		products[productID] = true
		count++
	}
	return products, count, rows.Err()
}

func (s *Service) ListJobs(ctx context.Context, page, size int, kind, status string) (JobList, error) {
	page, size = pageBounds(page, size)
	result := JobList{Items: []JobDetail{}, Page: page, PageSize: size}
	if err := s.DB.QueryRow(ctx, "SELECT count(*) FROM import_jobs WHERE ($1='' OR type=$1) AND ($2='' OR status=$2)", kind, status).Scan(&result.Total); err != nil {
		return result, err
	}
	rows, err := s.DB.Query(ctx, "SELECT id FROM import_jobs WHERE ($1='' OR type=$1) AND ($2='' OR status=$2) ORDER BY created_at DESC,id DESC LIMIT $3 OFFSET $4", kind, status, size, (page-1)*size)
	if err != nil {
		return result, err
	}
	ids := []uuid.UUID{}
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return result, err
		}
		ids = append(ids, id)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return result, err
	}
	for _, id := range ids {
		job, err := s.GetJob(ctx, id)
		if err != nil {
			return result, err
		}
		result.Items = append(result.Items, job)
	}
	return result, nil
}

func reviewScan(row pgx.Row) (Review, error) {
	var review Review
	var raw []byte
	err := row.Scan(&review.ID, &review.JobID, &review.ProductID, &review.SKUID, &review.ProductName, &review.SourceSheet, &review.SourceRow, &review.Code, &review.Message, &review.Status, &raw, &review.CreatedAt, &review.ResolvedAt)
	if err == nil {
		err = json.Unmarshal(raw, &review.RawValues)
	}
	return review, err
}

const reviewSelect = "SELECT r.id,r.job_id,r.product_id,r.sku_id,p.name,r.source_sheet,r.source_row,r.code,r.message,r.status,r.raw_values,r.created_at,r.resolved_at FROM product_import_reviews r JOIN catalog_products p ON p.id=r.product_id "

func (s *Service) ListReviews(ctx context.Context, page, size int, status string, productID uuid.UUID) (ReviewList, error) {
	page, size = pageBounds(page, size)
	result := ReviewList{Items: []Review{}, Page: page, PageSize: size}
	if status != "" && status != "PENDING" && status != "RESOLVED" {
		return result, fmt.Errorf("%w: invalid review status", ErrInvalid)
	}
	const where = " WHERE ($1='' OR r.status=$1) AND ($2::uuid='00000000-0000-0000-0000-000000000000' OR r.product_id=$2)"
	if err := s.DB.QueryRow(ctx, "SELECT count(*) FROM product_import_reviews r"+where, status, productID).Scan(&result.Total); err != nil {
		return result, err
	}
	rows, err := s.DB.Query(ctx, reviewSelect+where+" ORDER BY r.created_at DESC,r.id DESC LIMIT $3 OFFSET $4", status, productID, size, (page-1)*size)
	if err != nil {
		return result, err
	}
	defer rows.Close()
	for rows.Next() {
		review, err := reviewScan(rows)
		if err != nil {
			return result, err
		}
		result.Items = append(result.Items, review)
	}
	return result, rows.Err()
}

func (s *Service) ResolveReview(ctx context.Context, id, actor uuid.UUID) (Review, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return Review{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var productID uuid.UUID
	if err := tx.QueryRow(ctx, "SELECT product_id FROM product_import_reviews WHERE id=$1", id).Scan(&productID); err != nil {
		return Review{}, err
	}
	q := db.New(tx)
	product, err := q.GetProductForUpdate(ctx, productID)
	if err != nil {
		return Review{}, err
	}
	if product.CategoryID == uuid.Nil {
		return Review{}, fmt.Errorf("%w: assign a category before resolving review", ErrInvalid)
	}
	if err := validateStoredProduct(ctx, q, product); err != nil {
		return Review{}, fmt.Errorf("%w: %v", ErrInvalid, err)
	}
	if _, err := tx.Exec(ctx, "UPDATE product_import_reviews SET status='RESOLVED',resolved_at=COALESCE(resolved_at,now()),resolved_by_user_id=COALESCE(resolved_by_user_id,$2) WHERE id=$1", id, actor); err != nil {
		return Review{}, err
	}
	result, err := reviewScan(tx.QueryRow(ctx, reviewSelect+"WHERE r.id=$1", id))
	if err != nil {
		return result, err
	}
	return result, tx.Commit(ctx)
}

func validateStoredProduct(ctx context.Context, q *db.Queries, product db.CatalogProduct) error {
	skus, err := q.ListSkusByProduct(ctx, product.ID)
	if err != nil {
		return err
	}
	variants := make([]catalogspec.Variant, 0, len(skus))
	for _, sku := range skus {
		attrs := map[string]string{}
		if err := json.Unmarshal(sku.Attributes, &attrs); err != nil {
			return err
		}
		variants = append(variants, catalogspec.Variant{ID: sku.ID.String(), Name: sku.Name, Spec: derefString(sku.Spec), Attributes: attrs, Active: sku.IsActive})
	}
	return catalogspec.ValidateCombinations(product.FilterDimensions, variants)
}

func productSnapshot(ctx context.Context, q *db.Queries, id uuid.UUID) (string, error) {
	product, err := q.GetProduct(ctx, id)
	if err != nil {
		return "", err
	}
	skus, err := q.ListSkusByProduct(ctx, id)
	if err != nil {
		return "", err
	}
	sort.Slice(skus, func(i, j int) bool { return skus[i].ID.String() < skus[j].ID.String() })
	ids := make([]uuid.UUID, 0, len(skus))
	for _, sku := range skus {
		ids = append(ids, sku.ID)
	}
	tiers := []db.CatalogPriceTier{}
	if len(ids) > 0 {
		tiers, err = q.ListPriceTiersBySkus(ctx, ids)
		if err != nil {
			return "", err
		}
	}
	sort.Slice(tiers, func(i, j int) bool { return tiers[i].ID.String() < tiers[j].ID.String() })
	raw, err := json.Marshal(struct {
		Product db.CatalogProduct
		SKUs    []db.CatalogSku
		Tiers   []db.CatalogPriceTier
	}{product, skus, tiers})
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:]), nil
}

type leaseContextKey struct{}
type leaseIdentity struct {
	JobID uuid.UUID
	Token pgtype.UUID
}

func lockLease(ctx context.Context, tx pgx.Tx) error {
	lease, ok := ctx.Value(leaseContextKey{}).(leaseIdentity)
	if !ok {
		return nil
	}
	var one int
	err := tx.QueryRow(ctx, "SELECT 1 FROM product_import_jobs WHERE job_id=$1 AND lease_token=$2 AND lease_expires_at>clock_timestamp() AND phase IN ('VALIDATING','COMMITTING') FOR UPDATE", lease.JobID, lease.Token).Scan(&one)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrLeaseLost
	}
	return err
}

func verifyLease(ctx context.Context, tx pgx.Tx) error {
	lease, ok := ctx.Value(leaseContextKey{}).(leaseIdentity)
	if !ok {
		return nil
	}
	var valid bool
	if err := tx.QueryRow(ctx, "SELECT lease_token=$2 AND lease_expires_at>clock_timestamp() FROM product_import_jobs WHERE job_id=$1", lease.JobID, lease.Token).Scan(&valid); err != nil {
		return err
	}
	if !valid {
		return ErrLeaseLost
	}
	return nil
}

func (s *Service) preparePreview(ctx context.Context, job db.ProductImportJob) error {
	format, parsed, err := parseSourceWorkbook(job.ExcelFilePath)
	if err != nil {
		return err
	}
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := lockLease(ctx, tx); err != nil {
		return err
	}
	q := db.New(tx)
	states := make([]*rowExecutionState, 0, len(parsed))
	for _, item := range parsed {
		row := item.Row
		if job.SourceNamespace != "" {
			row.SourceNamespace = job.SourceNamespace
		}
		if job.ImagesZipPath != nil {
			if value, ok := row.RawValues["sourceCoverImage"]; ok {
				row.CoverImageRef = value
			}
			if raw := row.RawValues["sourceImageRefs"]; raw != "" {
				if err := json.Unmarshal([]byte(raw), &row.ImageRefs); err != nil {
					return err
				}
			}
			if row.ProvidedFields == nil {
				row.ProvidedFields = map[string]bool{}
			}
			row.ProvidedFields["sourceImagesAvailable"] = true
			if row.CoverImageRef != "" {
				row.ProvidedFields["coverImage"] = true
			}
			if len(row.ImageRefs) > 0 {
				row.ProvidedFields["images"] = true
			}
		}
		states = append(states, &rowExecutionState{Parsed: row, Error: item.Error, ParseError: item.Error, Action: "CREATE", PersistedState: rowStatusPending})
	}
	if err := s.prepareTargets(ctx, q, states, format); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, "DELETE FROM product_import_rows WHERE job_id=$1", job.JobID); err != nil {
		return err
	}
	for _, state := range states {
		record, err := q.CreateProductImportRow(ctx, db.CreateProductImportRowParams{JobID: job.JobID, LineNo: intToInt32(state.Parsed.RowNumber), GroupKey: normalizeNullableString(state.Parsed.GroupKey), SkuCode: normalizeNullableString(state.Parsed.SkuCode), ProductName: normalizeNullableString(state.Parsed.ProductName), RowData: statePayload(state), Status: rowStatusPending})
		if err != nil {
			return err
		}
		state.Record = record
	}
	summary := summarizePreview(states, false)
	raw, _ := json.Marshal(summary)
	if err := verifyLease(ctx, tx); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, "UPDATE product_import_jobs SET source_format=$2,phase='AWAITING_CONFIRMATION',preview_revision=preview_revision+1,summary=$3,total_rows=$4,failed_rows=$5,success_rows=0,lease_token=NULL,lease_expires_at=NULL,updated_at=now() WHERE job_id=$1", job.JobID, format, raw, len(states), summary.FailedRows); err != nil {
		return err
	}
	if _, err := q.UpdateImportJobStatus(ctx, db.UpdateImportJobStatusParams{ID: job.JobID, Status: "AWAITING_CONFIRMATION", Progress: 40}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func categoryPathIndex(categories []db.CatalogCategory) map[string][]uuid.UUID {
	byID := map[uuid.UUID]db.CatalogCategory{}
	for _, category := range categories {
		byID[category.ID] = category
	}
	result := map[string][]uuid.UUID{}
	for _, category := range categories {
		path := []string{}
		seen := map[uuid.UUID]bool{}
		current := category
		for {
			if seen[current.ID] {
				path = nil
				break
			}
			seen[current.ID] = true
			path = append([]string{strings.TrimSpace(current.Name)}, path...)
			if !current.ParentID.Valid {
				break
			}
			parent, ok := byID[current.ParentID.Bytes]
			if !ok {
				path = nil
				break
			}
			current = parent
		}
		if len(path) > 0 {
			key := strings.Join(path, "\x1f")
			result[key] = append(result[key], category.ID)
		}
	}
	return result
}

func (s *Service) prepareTargets(ctx context.Context, q *db.Queries, states []*rowExecutionState, format string) error {
	categories, err := q.ListCategories(ctx)
	if err != nil {
		return err
	}
	paths := categoryPathIndex(categories)
	seenSources := map[string]bool{}
	for _, state := range states {
		row := &state.Parsed
		state.Error = state.ParseError
		state.PreserveProduct = false
		state.PreserveSKU = false
		if row.Ignored {
			state.Action = "SKIP"
			continue
		}
		if state.Error != "" {
			state.Action = "ERROR"
			continue
		}
		if format != "STANDARD" && !row.ProvidedFields["categoryId"] {
			ids := paths[strings.Join(row.SourceCategoryPath, "\x1f")]
			if len(ids) == 1 {
				row.CategoryID = ids[0]
			} else {
				row.CategoryID = uuid.Nil
				row.Issues = addIssue(row.Issues, Issue{Code: "CATEGORY_UNRESOLVED", Message: "来源分类未唯一匹配，请指定商品分类", Severity: "WARNING"})
			}
		}
		if row.CategoryID != uuid.Nil {
			if _, err := q.GetCategory(ctx, row.CategoryID); err != nil {
				if !errors.Is(err, pgx.ErrNoRows) {
					return err
				}
				state.Error = "categoryId does not identify a category"
				state.Action = "ERROR"
				continue
			}
		}
		if row.CategoryID == uuid.Nil {
			row.Issues = addIssue(row.Issues, Issue{Code: "CATEGORY_UNRESOLVED", Message: "商品尚未分类，请指定分类后复核", Severity: "WARNING"})
		}
		if row.Split || len(row.Issues) > 0 || row.CategoryID == uuid.Nil {
			row.ProductStatus = "DRAFT"
		}
		sourceKey := row.SourceNamespace + "\x00" + row.SourceProductKey + "\x00" + row.SourceSKUKey
		if row.SourceNamespace != "" && row.SourceSKUKey != "" {
			if seenSources[sourceKey] {
				state.Action = "SKIP"
				row.Ignored = true
				continue
			}
			seenSources[sourceKey] = true
			ref, lookupErr := q.GetProductImportSourceRef(ctx, db.GetProductImportSourceRefParams{SourceNamespace: row.SourceNamespace, SourceProductKey: row.SourceProductKey, SourceSkuKey: row.SourceSKUKey})
			if errors.Is(lookupErr, pgx.ErrNoRows) {
				previous, previousErr := q.GetProductImportSourceSKU(ctx, db.GetProductImportSourceSKUParams{SourceNamespace: row.SourceNamespace, SourceSkuKey: row.SourceSKUKey})
				if previousErr == nil {
					if row.Split && !strings.Contains(previous.SourceProductKey, "-split-") {
						state.Error = "existing source SKU cannot be reassigned to an ambiguous split product"
						state.Action = "ERROR"
						continue
					}
					ref, lookupErr = previous, nil
					row.SourceProductKey = previous.SourceProductKey
					row.GroupKey = "product:" + previous.ProductID.String()
					row.Issues = addIssue(row.Issues, Issue{Code: "SOURCE_GROUP_PRESERVED", Message: "保留该来源SKU原商品归属，未自动合并", Severity: "WARNING"})
				} else if !errors.Is(previousErr, pgx.ErrNoRows) {
					return previousErr
				}
			}
			switch {
			case lookupErr == nil:
				if row.ProductID != uuid.Nil && row.ProductID != ref.ProductID || row.SkuID != uuid.Nil && (!ref.SkuID.Valid || row.SkuID != uuid.UUID(ref.SkuID.Bytes)) {
					state.Error = "source reference conflicts with explicit IDs"
					state.Action = "ERROR"
					continue
				}
				row.ProductID = ref.ProductID
				state.PreserveProduct = ref.SourceProductFingerprint == sourceProductFingerprint(*row)
				state.PreserveSKU = ref.SourceFingerprint == row.SourceFingerprint
				if ref.SkuID.Valid {
					row.SkuID = ref.SkuID.Bytes
				}
				if ref.SourceFingerprint == row.SourceFingerprint && !row.ProvidedFields["productResolution"] && !row.ProvidedFields["rowResolution"] {
					fillImages := false
					if row.ProvidedFields["sourceImagesAvailable"] {
						product, err := q.GetProduct(ctx, ref.ProductID)
						if err != nil {
							return err
						}
						fillImages = len(product.Images) == 0 && (len(row.ImageRefs) > 0 || row.CoverImageRef != "")
					}
					if fillImages {
						row.ProvidedFields["sourceImageFill"] = true
					} else {
						state.Action = "SKIP"
						continue
					}
				}
			case !errors.Is(lookupErr, pgx.ErrNoRows):
				return lookupErr
			default:
				refs, err := q.ListProductImportSourceGroup(ctx, db.ListProductImportSourceGroupParams{SourceNamespace: row.SourceNamespace, SourceProductKey: row.SourceProductKey})
				if err != nil {
					return err
				}
				if !row.Split && !row.ProvidedFields["groupResolution"] {
					family, err := q.ListProductImportSourceFamily(ctx, db.ListProductImportSourceFamilyParams{SourceNamespace: row.SourceNamespace, OriginalSourceProductKey: originalSourceProductKey(*row)})
					if err != nil {
						return err
					}
					ids := map[uuid.UUID]bool{}
					for _, ref := range family {
						ids[ref.ProductID] = true
					}
					if len(ids) == 1 && len(refs) == 0 {
						refs = family
						row.SourceProductKey = family[0].SourceProductKey
					} else if len(ids) > 1 {
						if row.ProductID != uuid.Nil && strings.TrimSpace(row.RawValues["productid"]) != "" {
							state.Error = "explicit Product ID cannot be reassigned by ambiguous source grouping"
							state.Action = "ERROR"
							continue
						}
						refs = nil
						row.ProductID = uuid.Nil
						row.SourceProductKey = originalSourceProductKey(*row) + "-split-" + sourceFingerprint(row.SourceSKUKey)[:16]
						row.GroupKey = row.SourceProductKey
						row.Split = true
						row.ProductStatus = "DRAFT"
						row.Issues = addIssue(row.Issues, Issue{Code: "SOURCE_GROUP_AMBIGUOUS", Message: "此来源商品已拆分到多个商品，新增SKU已独立建草稿待复核", Severity: "WARNING"})
					}
				}
				sort.Slice(refs, func(i, j int) bool {
					if refs[i].UpdatedAt.Time.Equal(refs[j].UpdatedAt.Time) {
						return refs[i].SourceSkuKey < refs[j].SourceSkuKey
					}
					return refs[i].UpdatedAt.Time.After(refs[j].UpdatedAt.Time)
				})
				if len(refs) > 0 {
					state.PreserveProduct = refs[0].SourceProductFingerprint == sourceProductFingerprint(*row)
				}
				for _, ref := range refs {
					if row.ProductID != uuid.Nil && row.ProductID != ref.ProductID {
						state.Error = "source product identifies multiple target products"
						break
					}
					row.ProductID = ref.ProductID
				}
			}
		}
		if state.Error != "" {
			state.Action = "ERROR"
			continue
		}
		var matched *db.CatalogSku
		if row.SkuID != uuid.Nil {
			skus, err := q.ListSkusByIDs(ctx, []uuid.UUID{row.SkuID})
			if err != nil {
				return err
			}
			if len(skus) != 1 {
				state.Error = "SKU ID was not found"
			} else {
				matched = &skus[0]
			}
		}
		if row.SkuCode != "" {
			skus, err := q.ListSkusBySkuCode(ctx, &row.SkuCode)
			if err != nil {
				return err
			}
			if len(skus) > 1 {
				state.Error = "SKU code matched multiple records"
			}
			if len(skus) == 1 {
				switch {
				case matched != nil && matched.ID != skus[0].ID:
					state.Error = "SKU ID and code identify different records"
				case row.SourceNamespace != "" && row.SkuID == uuid.Nil && row.ProductID == uuid.Nil && format != "STANDARD":
					state.Error = "source SKU code conflicts with an existing catalog SKU"
				default:
					matched = &skus[0]
				}
			}
		}
		if matched != nil {
			if row.ProductID != uuid.Nil && row.ProductID != matched.ProductID {
				state.Error = "SKU belongs to another product"
			} else {
				row.ProductID = matched.ProductID
				row.SkuID = matched.ID
			}
		}
		if state.Error != "" {
			state.Action = "ERROR"
			continue
		}
		switch {
		case row.ProductID != uuid.Nil:
			if state.PreserveProduct {
				product, err := q.GetProduct(ctx, row.ProductID)
				if err != nil {
					return err
				}
				if !row.ProvidedFields["resolvedProductName"] {
					row.ProductName = product.Name
				}
				if !row.ProvidedFields["resolvedCategoryId"] {
					row.CategoryID = product.CategoryID
				}
				if !row.ProvidedFields["resolvedDimensions"] {
					row.FilterDimensions = product.FilterDimensions
				}
				if product.CategoryID != uuid.Nil {
					row.Issues = slices.DeleteFunc(row.Issues, func(issue Issue) bool { return issue.Code == "CATEGORY_UNRESOLVED" })
				}
				if !row.Split && len(row.Issues) == 0 {
					row.ProductStatus = ""
				}
			}
			if row.ProductStatus == "ACTIVE" {
				pending, err := q.CountPendingProductImportReviews(ctx, row.ProductID)
				if err != nil {
					return err
				}
				if pending > 0 {
					state.Error = "product has unresolved import reviews and cannot be activated"
					state.Action = "ERROR"
					continue
				}
			}
			snapshot, err := productSnapshot(ctx, q, row.ProductID)
			if errors.Is(err, pgx.ErrNoRows) {
				state.Error = "Product ID was not found"
				state.Action = "ERROR"
				continue
			}
			if err != nil {
				return err
			}
			state.TargetSnapshot = snapshot
			state.Action = "UPDATE"
		case row.Split:
			state.Action = "SPLIT"
		default:
			state.Action = "CREATE"
		}
	}
	// A target product is the transaction boundary, even when source aliases differ.
	for _, group := range groupStates(states) {
		var id uuid.UUID
		conflict := false
		for _, row := range group.Rows {
			if row.Error != "" {
				continue
			}
			if row.Parsed.ProductID != uuid.Nil {
				if id != uuid.Nil && id != row.Parsed.ProductID {
					conflict = true
				}
				id = row.Parsed.ProductID
			}
		}
		if conflict {
			for _, row := range group.Rows {
				row.Error = "group refers to different products"
				row.Action = "ERROR"
			}
			continue
		}
		if id != uuid.Nil {
			for _, row := range group.Rows {
				if row.Error != "" {
					continue
				}
				row.Parsed.ProductID = id
				row.Parsed.GroupKey = "product:" + id.String()
				if row.Action != "SKIP" {
					snapshot, err := productSnapshot(ctx, q, id)
					if err != nil {
						return err
					}
					row.TargetSnapshot = snapshot
					row.Action = "UPDATE"
				}
			}
		}
	}
	for _, group := range groupStates(states) {
		active := []*rowExecutionState{}
		for _, row := range group.Rows {
			if row.Action != "SKIP" && !row.Parsed.Ignored {
				active = append(active, row)
			}
		}
		if len(active) == 0 {
			continue
		}
		if message := validateGroupRows(active); message != "" {
			for _, row := range active {
				row.Error = message
				row.Action = "ERROR"
			}
			continue
		}
		variants := []catalogspec.Variant{}
		for _, row := range active {
			if !row.Parsed.NoSKU {
				variants = append(variants, catalogspec.Variant{Name: row.Parsed.SkuName, Spec: derefString(row.Parsed.Spec), Attributes: row.Parsed.Attributes, Active: row.Parsed.IsActive})
			}
		}
		if active[0].Parsed.ProductID != uuid.Nil {
			var err error
			variants, err = previewFinalVariants(ctx, q, active)
			if err != nil {
				for _, row := range active {
					row.Error = err.Error()
					row.Action = "ERROR"
				}
				continue
			}
		}
		dimensions := active[0].Parsed.FilterDimensions
		if active[0].Parsed.ProductID != uuid.Nil && !provided(active[0].Parsed, "filterDimensions") {
			product, err := q.GetProduct(ctx, active[0].Parsed.ProductID)
			if err != nil {
				return err
			}
			dimensions = product.FilterDimensions
		}
		if err := catalogspec.ValidateCombinations(dimensions, variants); err != nil {
			for _, row := range active {
				row.Error = err.Error()
				row.Action = "ERROR"
			}
		}
	}
	return nil
}

func addIssue(issues []Issue, issue Issue) []Issue {
	for _, existing := range issues {
		if existing.Code == issue.Code {
			return issues
		}
	}
	return append(issues, issue)
}

func previewFinalVariants(ctx context.Context, q *db.Queries, states []*rowExecutionState) ([]catalogspec.Variant, error) {
	head := states[0].Parsed
	product, err := q.GetProduct(ctx, head.ProductID)
	if err != nil {
		return nil, err
	}
	dimensions := head.FilterDimensions
	if !provided(head, "filterDimensions") {
		dimensions = product.FilterDimensions
	}
	skus, err := q.ListSkusByProduct(ctx, product.ID)
	if err != nil {
		return nil, err
	}
	existing := map[uuid.UUID]db.CatalogSku{}
	result := map[uuid.UUID]catalogspec.Variant{}
	for _, sku := range skus {
		attrs := map[string]string{}
		if err := json.Unmarshal(sku.Attributes, &attrs); err != nil {
			return nil, err
		}
		existing[sku.ID] = sku
		result[sku.ID] = catalogspec.Variant{ID: sku.ID.String(), Name: sku.Name, Spec: derefString(sku.Spec), Attributes: attrs, Active: sku.IsActive}
	}
	for _, state := range states {
		row := state.Parsed
		if row.NoSKU {
			continue
		}
		if state.PreserveSKU && !row.ProvidedFields["rowResolution"] {
			continue
		}
		attrs := map[string]string{}
		if old, ok := existing[row.SkuID]; ok {
			if err := json.Unmarshal(old.Attributes, &attrs); err != nil {
				return nil, err
			}
			if state.PreserveSKU {
				row.SkuName = old.Name
				row.IsActive = old.IsActive
				row.Spec = old.Spec
				if !row.ProvidedFields["resolvedAttributes"] {
					row.Attributes = nil
				}
			}
			if !provided(row, "spec") {
				row.Spec = old.Spec
			}
			if !provided(row, "isActive") {
				row.IsActive = old.IsActive
			}
			if !provided(row, "skuName") {
				row.SkuName = old.Name
			}
		}
		for key, value := range row.Attributes {
			attrs[key] = value
		}
		if slices.Contains(row.ClearFields, "attributes") {
			attrs = map[string]string{}
		}
		if len(dimensions) > 0 && row.IsActive {
			normalized, path, err := catalogspec.NormalizeValues(dimensions, attrs)
			if err != nil {
				return nil, err
			}
			attrs = normalized
			row.Spec = &path
		}
		id := row.SkuID
		if id == uuid.Nil {
			id = state.Record.ID
			if id == uuid.Nil {
				id = uuid.New()
			}
		}
		result[id] = catalogspec.Variant{ID: id.String(), Name: row.SkuName, Spec: derefString(row.Spec), Attributes: attrs, Active: row.IsActive}
	}
	variants := make([]catalogspec.Variant, 0, len(result))
	for _, variant := range result {
		variants = append(variants, variant)
	}
	sort.Slice(variants, func(i, j int) bool { return variants[i].ID < variants[j].ID })
	return variants, nil
}

func (s *Service) ResolvePreview(ctx context.Context, id uuid.UUID, input ResolutionInput) (Preview, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return Preview{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	q := db.New(tx)
	job, err := q.LockProductImportLifecycle(ctx, id)
	if err != nil {
		return Preview{}, err
	}
	if job.Phase != "AWAITING_CONFIRMATION" || int(job.PreviewRevision) != input.ExpectedRevision {
		return Preview{}, fmt.Errorf("%w: preview revision or phase changed", ErrConflict)
	}
	states, err := loadRows(ctx, q, id)
	if err != nil {
		return Preview{}, err
	}
	byKey := map[string][]*rowExecutionState{}
	byID := map[uuid.UUID]*rowExecutionState{}
	for _, state := range states {
		byKey[state.Parsed.GroupKey] = append(byKey[state.Parsed.GroupKey], state)
		byID[state.Record.ID] = state
	}
	for _, change := range input.Groups {
		group, ok := byKey[change.Key]
		if !ok {
			return Preview{}, fmt.Errorf("%w: unknown group", ErrInvalid)
		}
		if change.Dimensions != nil {
			if _, err := catalogspec.NormalizeDimensions(*change.Dimensions); err != nil {
				return Preview{}, fmt.Errorf("%w: %v", ErrInvalid, err)
			}
		}
		for _, state := range group {
			row := &state.Parsed
			if row.ProvidedFields == nil {
				row.ProvidedFields = map[string]bool{}
			}
			if change.ProductName != nil || change.CategoryID != nil || change.Dimensions != nil {
				row.ProvidedFields["productResolution"] = true
			}
			if change.ProductName != nil {
				if strings.TrimSpace(*change.ProductName) == "" {
					return Preview{}, fmt.Errorf("%w: product name is required", ErrInvalid)
				}
				row.ProductName = strings.TrimSpace(*change.ProductName)
				row.ProvidedFields["resolvedProductName"] = true
			}
			if change.CategoryID != nil {
				row.CategoryID = *change.CategoryID
				row.ProvidedFields["categoryId"] = true
				row.ProvidedFields["resolvedCategoryId"] = true
				row.Issues = slices.DeleteFunc(row.Issues, func(issue Issue) bool { return issue.Code == "CATEGORY_UNRESOLVED" })
			}
			if change.Dimensions != nil {
				row.FilterDimensions = *change.Dimensions
				row.ProvidedFields["filterDimensions"] = true
				row.ProvidedFields["resolvedDimensions"] = true
			}
		}
		for _, changeRow := range change.Rows {
			state, ok := byID[changeRow.RowID]
			if !ok || state.Parsed.GroupKey != change.Key {
				return Preview{}, fmt.Errorf("%w: row does not belong to group", ErrInvalid)
			}
			row := &state.Parsed
			row.ProvidedFields["rowResolution"] = true
			if changeRow.Unit != nil {
				row.Unit = normalizeNullableString(*changeRow.Unit)
				row.ProvidedFields["unit"] = row.Unit != nil
				row.ProvidedFields["resolvedUnit"] = true
				if row.Unit != nil && knownSourceUnit(*row.Unit) {
					row.Issues = slices.DeleteFunc(row.Issues, func(issue Issue) bool { return issue.Code == "UNIT_MISSING" || issue.Code == "UNIT_UNRECOGNIZED" })
				}
			}
			if changeRow.Attributes != nil {
				row.Attributes = *changeRow.Attributes
				row.ProvidedFields["attributes"] = true
				row.ProvidedFields["resolvedAttributes"] = true
				attrs, path, err := catalogspec.NormalizeValues(row.FilterDimensions, row.Attributes)
				if err != nil {
					return Preview{}, fmt.Errorf("%w: %v", ErrInvalid, err)
				}
				row.Attributes = attrs
				row.Spec = &path
				row.ProvidedFields["spec"] = true
				if change.Dimensions != nil {
					row.Issues = slices.DeleteFunc(row.Issues, func(issue Issue) bool {
						return slices.Contains([]string{"SPEC_UNRECOGNIZED", "SPEC_VALUE_MISSING", "SPEC_AMBIGUOUS", "SPEC_COMBINATION_DUPLICATE"}, issue.Code)
					})
				}
				if strings.Contains(state.ParseError, "specification") || strings.Contains(state.ParseError, "Attributes") || strings.Contains(state.ParseError, "attributes") {
					state.ParseError = ""
				}
			}
			if changeRow.Ignored != nil {
				row.Ignored = *changeRow.Ignored
			}
			if changeRow.GroupKey != nil {
				if strings.TrimSpace(*changeRow.GroupKey) == "" {
					return Preview{}, fmt.Errorf("%w: groupKey is required", ErrInvalid)
				}
				targetKey := strings.TrimSpace(*changeRow.GroupKey)
				if targetKey != row.GroupKey {
					if row.SkuID != uuid.Nil || strings.TrimSpace(row.RawValues["productid"]) != "" {
						return Preview{}, fmt.Errorf("%w: existing catalog identities cannot be reassigned through preview grouping", ErrInvalid)
					}
					originalKey := originalSourceProductKey(*row)
					if row.RawValues == nil {
						row.RawValues = map[string]string{}
					}
					row.RawValues["sourceOriginalProductKey"] = originalKey
					if row.SourceNamespace != "" {
						row.SourceProductKey = "manual-" + sourceFingerprint(map[string]string{"sourceProduct": originalKey, "group": targetKey})
					}
					row.GroupKey = targetKey
					row.ProductID = uuid.Nil
					row.ProvidedFields["groupResolution"] = true
					row.Split = false
				}
			}
			for _, field := range changeRow.ClearFields {
				if !slices.Contains([]string{"description", "coverImage", "images", "tags", "unit", "skuCode", "priceTiers", "attributes"}, field) {
					return Preview{}, fmt.Errorf("%w: unsupported clear field %q", ErrInvalid, field)
				}
			}
			if changeRow.ClearFields != nil {
				row.ClearFields = changeRow.ClearFields
			}
			for _, field := range changeRow.ClearFields {
				if slices.Contains([]string{"description", "coverImage", "images", "tags"}, field) {
					row.ProvidedFields["productResolution"] = true
				}
			}
		}
	}
	if err := s.prepareTargets(ctx, q, states, job.SourceFormat); err != nil {
		return Preview{}, err
	}
	for _, state := range states {
		if _, err := tx.Exec(ctx, "UPDATE product_import_rows SET row_data=$2,group_key=$3,updated_at=now() WHERE id=$1", state.Record.ID, statePayload(state), state.Parsed.GroupKey); err != nil {
			return Preview{}, err
		}
	}
	summary, _ := json.Marshal(summarizePreview(states, false))
	if _, err := tx.Exec(ctx, "UPDATE product_import_jobs SET preview_revision=preview_revision+1,summary=$2,failed_rows=$3,updated_at=now() WHERE job_id=$1", id, summary, summarizePreview(states, false).FailedRows); err != nil {
		return Preview{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Preview{}, err
	}
	return s.GetPreview(ctx, id, 1, 50, false)
}

func (s *Service) Confirm(ctx context.Context, id uuid.UUID, revision int, actor uuid.UUID, key string) (JobDetail, error) {
	if strings.TrimSpace(key) == "" {
		return JobDetail{}, fmt.Errorf("%w: Idempotency-Key is required", ErrInvalid)
	}
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return JobDetail{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	q := db.New(tx)
	job, err := q.LockProductImportLifecycle(ctx, id)
	if err != nil {
		return JobDetail{}, err
	}
	if job.ConfirmIdempotencyKey != nil {
		if *job.ConfirmIdempotencyKey == key && job.ConfirmedRevision != nil && int(*job.ConfirmedRevision) == revision {
			if err := tx.Commit(ctx); err != nil {
				return JobDetail{}, err
			}
			return s.GetJob(ctx, id)
		}
		return JobDetail{}, fmt.Errorf("%w: job was already confirmed", ErrConflict)
	}
	if job.Phase != "AWAITING_CONFIRMATION" || int(job.PreviewRevision) != revision {
		return JobDetail{}, fmt.Errorf("%w: preview revision or phase changed", ErrConflict)
	}
	states, err := loadRows(ctx, q, id)
	if err != nil {
		return JobDetail{}, err
	}
	for _, state := range states {
		if state.Parsed.Ignored || state.Action == "SKIP" {
			continue
		}
		if state.Error != "" {
			return JobDetail{}, fmt.Errorf("%w: preview contains blocking errors", ErrInvalid)
		}
		if state.Parsed.SkuID == uuid.Nil && state.Parsed.SkuCode != "" {
			matches, err := q.ListSkusBySkuCode(ctx, &state.Parsed.SkuCode)
			if err != nil {
				return JobDetail{}, err
			}
			if len(matches) > 0 {
				return JobDetail{}, fmt.Errorf("%w: SKU code was created after preview", ErrConflict)
			}
		}
		if err := verifyGroupTargets(ctx, q, []*rowExecutionState{state}); err != nil {
			return JobDetail{}, err
		}
		if state.Parsed.ProductID != uuid.Nil {
			snapshot, err := productSnapshot(ctx, q, state.Parsed.ProductID)
			if err != nil {
				return JobDetail{}, err
			}
			if snapshot != state.TargetSnapshot {
				return JobDetail{}, fmt.Errorf("%w: target product changed; refresh preview", ErrConflict)
			}
		}
	}
	if _, err := tx.Exec(ctx, "UPDATE product_import_jobs SET phase='COMMIT_PENDING',confirmed_revision=$2,confirmed_by_user_id=$3,confirm_idempotency_key=$4,updated_at=now() WHERE job_id=$1", id, revision, actor, key); err != nil {
		return JobDetail{}, err
	}
	if _, err := q.UpdateImportJobStatus(ctx, db.UpdateImportJobStatusParams{ID: id, Status: "PENDING", Progress: 50}); err != nil {
		return JobDetail{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return JobDetail{}, err
	}
	return s.GetJob(ctx, id)
}

func (s *Service) Cancel(ctx context.Context, id, actor uuid.UUID) (JobDetail, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return JobDetail{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	q := db.New(tx)
	job, err := q.LockProductImportLifecycle(ctx, id)
	if err != nil {
		return JobDetail{}, err
	}
	if job.Phase == "CANCELLED" {
		if err := tx.Commit(ctx); err != nil {
			return JobDetail{}, err
		}
		return s.GetJob(ctx, id)
	}
	if job.Phase != "VALIDATE_PENDING" && job.Phase != "VALIDATING" && job.Phase != "AWAITING_CONFIRMATION" {
		return JobDetail{}, fmt.Errorf("%w: confirmed jobs cannot be cancelled", ErrConflict)
	}
	if _, err := tx.Exec(ctx, "UPDATE product_import_jobs SET phase='CANCELLED',lease_token=NULL,lease_expires_at=NULL,updated_at=now() WHERE job_id=$1", id); err != nil {
		return JobDetail{}, err
	}
	if _, err := q.UpdateImportJobStatus(ctx, db.UpdateImportJobStatusParams{ID: id, Status: "CANCELLED", Progress: 100}); err != nil {
		return JobDetail{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return JobDetail{}, err
	}
	return s.GetJob(ctx, id)
}

func productClearFields(states []*rowExecutionState) []string {
	result := []string{}
	for _, state := range states {
		if state.Parsed.Ignored {
			continue
		}
		for _, field := range state.Parsed.ClearFields {
			if slices.Contains([]string{"description", "coverImage", "images", "tags"}, field) && !slices.Contains(result, field) {
				result = append(result, field)
			}
		}
	}
	sort.Strings(result)
	return result
}

func provided(row parsedRow, key string) bool {
	if row.ProvidedFields != nil {
		return row.ProvidedFields[key]
	}
	// Historical in-package callers construct parsed rows directly.
	switch key {
	case "description":
		return row.Description != nil
	case "images":
		return len(row.ImageRefs) > 0
	case "coverImage":
		return row.CoverImageRef != ""
	case "tags":
		return len(row.Tags) > 0
	case "filterDimensions":
		return len(row.FilterDimensions) > 0
	case "skuCode":
		return row.SkuCode != ""
	case "skuName":
		return row.SkuName != ""
	case "spec":
		return row.Spec != nil
	case "unit":
		return row.Unit != nil
	case "isActive":
		return row.RawValues["isactive"] != ""
	case "priceTiers":
		return len(row.PriceTiers) > 0
	}
	return false
}

func updatePreservedSKU(ctx context.Context, q *db.Queries, product db.CatalogProduct, row parsedRow, existing db.CatalogSku) (db.CatalogSku, error) {
	if !row.ProvidedFields["rowResolution"] && !row.ProvidedFields["resolvedDimensions"] {
		return existing, nil
	}
	attrs := map[string]string{}
	if err := json.Unmarshal(existing.Attributes, &attrs); err != nil {
		return db.CatalogSku{}, err
	}
	if row.ProvidedFields["resolvedAttributes"] {
		for key, value := range row.Attributes {
			attrs[key] = value
		}
	}
	if slices.Contains(row.ClearFields, "attributes") {
		attrs = map[string]string{}
	}
	spec := existing.Spec
	if len(product.FilterDimensions) > 0 && existing.IsActive {
		normalized, path, err := catalogspec.NormalizeValues(product.FilterDimensions, attrs)
		if err != nil {
			return db.CatalogSku{}, err
		}
		attrs = normalized
		spec = &path
	}
	unit := existing.Unit
	if row.ProvidedFields["resolvedUnit"] && row.Unit != nil {
		unit = row.Unit
	}
	if slices.Contains(row.ClearFields, "unit") {
		unit = nil
	}
	code := existing.SkuCode
	if slices.Contains(row.ClearFields, "skuCode") {
		code = nil
	}
	raw, err := json.Marshal(attrs)
	if err != nil {
		return db.CatalogSku{}, err
	}
	return q.UpdateSku(ctx, db.UpdateSkuParams{ID: existing.ID, SkuCode: code, Name: existing.Name, Spec: spec, Attributes: raw, Unit: unit, IsActive: existing.IsActive})
}

func lockSourceGroups(ctx context.Context, tx pgx.Tx, states []*rowExecutionState) error {
	keys := []string{}
	for _, state := range states {
		row := state.Parsed
		if row.SourceNamespace != "" {
			key := row.SourceNamespace + "\x1f" + row.SourceProductKey
			if !slices.Contains(keys, key) {
				keys = append(keys, key)
			}
		}
	}
	sort.Strings(keys)
	for _, key := range keys {
		if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", key); err != nil {
			return err
		}
	}
	return nil
}

func verifyGroupTargets(ctx context.Context, q *db.Queries, states []*rowExecutionState) error {
	for _, state := range states {
		row := state.Parsed
		if row.SourceNamespace == "" || row.SourceSKUKey == "" {
			continue
		}
		ref, err := q.GetProductImportSourceRef(ctx, db.GetProductImportSourceRefParams{SourceNamespace: row.SourceNamespace, SourceProductKey: row.SourceProductKey, SourceSkuKey: row.SourceSKUKey})
		if err == nil {
			if row.ProductID != ref.ProductID || ref.SkuID.Valid && row.SkuID != uuid.UUID(ref.SkuID.Bytes) {
				return fmt.Errorf("%w: source binding changed after preview", ErrConflict)
			}
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return err
		}
		refs, err := q.ListProductImportSourceGroup(ctx, db.ListProductImportSourceGroupParams{SourceNamespace: row.SourceNamespace, SourceProductKey: row.SourceProductKey})
		if err != nil {
			return err
		}
		for _, other := range refs {
			if row.ProductID != other.ProductID {
				return fmt.Errorf("%w: source product changed after preview", ErrConflict)
			}
		}
	}
	return nil
}

func persistSourceAndReviews(ctx context.Context, q *db.Queries, state *rowExecutionState, productID, skuID uuid.UUID) error {
	row := state.Parsed
	sku := pgtype.UUID{Bytes: skuID, Valid: skuID != uuid.Nil}
	if row.SourceNamespace != "" && row.SourceSKUKey != "" {
		if err := q.UpsertProductImportSourceRef(ctx, db.UpsertProductImportSourceRefParams{SourceNamespace: row.SourceNamespace, SourceProductKey: row.SourceProductKey, SourceSkuKey: row.SourceSKUKey, SourceFingerprint: row.SourceFingerprint, ProductID: productID, SkuID: sku, FirstJobID: state.Record.JobID, SourceProductFingerprint: sourceProductFingerprint(row), OriginalSourceProductKey: originalSourceProductKey(row)}); err != nil {
			return err
		}
	}
	raw, err := json.Marshal(row.RawValues)
	if err != nil {
		return err
	}
	for _, issue := range row.Issues {
		if issue.Severity != "WARNING" {
			continue
		}
		namespace := row.SourceNamespace
		sourceKey := row.SourceSKUKey
		if namespace == "" || sourceKey == "" {
			namespace = "job:" + state.Record.JobID.String()
			sourceKey = state.Record.ID.String()
		}
		if err := q.CreateProductImportReview(ctx, db.CreateProductImportReviewParams{JobID: state.Record.JobID, ProductID: productID, SkuID: sku, SourceNamespace: namespace, SourceProductKey: row.SourceProductKey, SourceSkuKey: sourceKey, SourceFingerprint: row.SourceFingerprint, SourceSheet: row.SourceSheet, SourceRow: intToInt32(row.SourceRow), Code: issue.Code, Message: issue.Message, RawValues: raw}); err != nil {
			return err
		}
	}
	return nil
}

func sourceProductFingerprint(row parsedRow) string {
	if raw := row.RawValues["sourceProduct"]; raw != "" {
		var values map[string]string
		if json.Unmarshal([]byte(raw), &values) == nil {
			return sourceFingerprint(fingerprintValues(values))
		}
	}
	values := map[string]string{}
	for _, key := range []string{"物资", "单位", "分类", "productname", "categoryid", "description", "coverimage", "images", "tags", "filterdimensions", "productstatus"} {
		if value, ok := row.RawValues[key]; ok {
			values[key] = value
		}
	}
	return sourceFingerprint(values)
}

func originalSourceProductKey(row parsedRow) string {
	if value := row.RawValues["sourceOriginalProductKey"]; value != "" {
		return value
	}
	return row.SourceProductKey
}

func persistSkippedRows(ctx context.Context, q *db.Queries, states []*rowExecutionState) error {
	for _, state := range states {
		row := state.Parsed
		record, err := q.UpdateProductImportRowResult(ctx, db.UpdateProductImportRowResultParams{ID: state.Record.ID, Status: "SKIPPED", ProductID: pgtype.UUID{Bytes: row.ProductID, Valid: row.ProductID != uuid.Nil}, SkuID: pgtype.UUID{Bytes: row.SkuID, Valid: row.SkuID != uuid.Nil}})
		if err != nil {
			return err
		}
		state.Record = record
		state.PersistedState = "SKIPPED"
	}
	return nil
}

func (s *Service) commitPreview(ctx context.Context, job db.ProductImportJob) error {
	states, err := loadRows(ctx, db.New(s.DB), job.JobID)
	if err != nil {
		return err
	}
	resolver, err := newImageResolver(job, s.MediaLocalOutputDir, s.MediaPublicBaseURL)
	if err != nil {
		return err
	}
	defer resolver.Close()
	groups := groupStates(states)
	for _, original := range groups {
		group := &groupExecution{Key: original.Key, RowStart: original.RowStart}
		for _, state := range original.Rows {
			if state.PersistedState == rowStatusSucceeded || state.PersistedState == rowStatusFailed || state.PersistedState == "SKIPPED" {
				continue
			}
			if state.Parsed.Ignored || state.Action == "SKIP" {
				group.SkippedRows = append(group.SkippedRows, state)
			} else {
				group.Rows = append(group.Rows, state)
			}
		}
		if len(group.Rows)+len(group.SkippedRows) == 0 {
			continue
		}
		var cover *string
		var images []string
		if len(group.Rows) > 0 {
			cover, images, err = resolver.ResolveGroup(group.Rows[0].Parsed.CoverImageRef, group.Rows[0].Parsed.ImageRefs)
		}
		if err == nil {
			err = s.processGroupTransaction(ctx, group, cover, images)
		}
		if err != nil {
			if errors.Is(err, ErrLeaseLost) || ctx.Err() != nil {
				return err
			}
			if markErr := s.markLifecycleGroupFailed(ctx, append(group.Rows, group.SkippedRows...), err.Error()); markErr != nil {
				return markErr
			}
		}
		err = nil
	}
	// Reload durable results, since a failed transaction may have changed only in-memory states.
	states, err = loadRows(ctx, db.New(s.DB), job.JobID)
	if err != nil {
		return err
	}
	summary := summarizePreview(states, true)
	status := "SUCCEEDED"
	if summary.FailedRows > 0 {
		status = "PARTIALLY_SUCCEEDED"
		if summary.SuccessRows+summary.SkippedRows == 0 {
			status = "FAILED"
		}
	}
	raw, _ := json.Marshal(summary)
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := lockLease(ctx, tx); err != nil {
		return err
	}
	resultURL, err := s.writeResultWorkbook(job, states, summary, status)
	if err != nil {
		return err
	}
	var errorURL *string
	if summary.FailedRows > 0 {
		errorURL, err = s.writeErrorReport(job.JobID, states)
		if err != nil {
			return err
		}
	}
	if err := verifyLease(ctx, tx); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, "UPDATE product_import_jobs SET phase='COMPLETED',summary=$2,total_rows=$3,success_rows=$4,failed_rows=$5,lease_token=NULL,lease_expires_at=NULL,updated_at=now() WHERE job_id=$1", job.JobID, raw, summary.TotalRows, summary.SuccessRows, summary.FailedRows); err != nil {
		return err
	}
	if _, err := db.New(tx).FinalizeImportJob(ctx, db.FinalizeImportJobParams{ID: job.JobID, Status: status, Progress: 100, ResultFileUrl: resultURL, ErrorReportUrl: errorURL}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Service) markLifecycleGroupFailed(ctx context.Context, states []*rowExecutionState, message string) error {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := lockLease(ctx, tx); err != nil {
		return err
	}
	q := db.New(tx)
	for _, state := range states {
		state.Error = message
		state.Action = "ERROR"
		state.PersistedState = rowStatusFailed
		if _, err := q.UpdateProductImportRowResult(ctx, db.UpdateProductImportRowResultParams{ID: state.Record.ID, Status: rowStatusFailed, ErrorMessage: &message}); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, "UPDATE product_import_rows SET row_data=$2 WHERE id=$1", state.Record.ID, statePayload(state)); err != nil {
			return err
		}
	}
	if err := verifyLease(ctx, tx); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (s *Service) failLifecycle(ctx context.Context, job db.ProductImportJob, message string) error {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := lockLease(ctx, tx); err != nil {
		return err
	}
	errorURL, err := s.writeFatalErrorReport(job.JobID, message)
	if err != nil {
		return err
	}
	if err := verifyLease(ctx, tx); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, "UPDATE product_import_jobs SET phase='COMPLETED',lease_token=NULL,lease_expires_at=NULL,updated_at=now() WHERE job_id=$1", job.JobID); err != nil {
		return err
	}
	if _, err := db.New(tx).FinalizeImportJob(ctx, db.FinalizeImportJobParams{ID: job.JobID, Status: "FAILED", Progress: 100, ErrorReportUrl: errorURL}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
