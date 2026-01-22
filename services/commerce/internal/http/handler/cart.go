package handler

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/oapi-codegen/runtime/types"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/http/oapi"
)

const (
	cartImportMatchAuto      = "AUTO"
	cartImportMatchAmbiguous = "AMBIGUOUS"
	cartImportMatchNotFound  = "NOT_FOUND"
)

type cartImportRowInput struct {
	RowNo   int
	SkuID   *uuid.UUID
	SkuCode string
	Name    string
	Spec    string
	QtyRaw  string
}

func (h *Handler) GetCart(c *gin.Context) {
	claims, ok := h.requireUser(c)
	if !ok {
		return
	}

	cart, err := h.buildCartResponse(c.Request.Context(), claims.UserID)
	if err != nil {
		h.logError("get cart failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch cart")
		return
	}

	c.JSON(http.StatusOK, cart)
}

func (h *Handler) PostCartItems(c *gin.Context) {
	claims, ok := h.requireUser(c)
	if !ok {
		return
	}

	var request oapi.AddCartItemRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}
	if request.Qty < 1 {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "qty must be >= 1")
		return
	}

	_, err := h.CartStore.UpsertCartItem(c.Request.Context(), db.UpsertCartItemParams{
		OwnerUserID: claims.UserID,
		SkuID:       uuid.UUID(request.SkuId),
		Qty:         clampInt32(request.Qty),
	})
	if err != nil {
		h.logError("upsert cart item failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to add cart item")
		return
	}

	cart, err := h.buildCartResponse(c.Request.Context(), claims.UserID)
	if err != nil {
		h.logError("get cart failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch cart")
		return
	}

	c.JSON(http.StatusOK, cart)
}

func (h *Handler) PatchCartItemsItemId(c *gin.Context, itemId types.UUID) {
	claims, ok := h.requireUser(c)
	if !ok {
		return
	}

	var payload struct {
		Qty int `json:"qty"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}
	if payload.Qty < 1 {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "qty must be >= 1")
		return
	}

	_, err := h.CartStore.UpdateCartItemQty(c.Request.Context(), db.UpdateCartItemQtyParams{
		ID:          uuid.UUID(itemId),
		Qty:         clampInt32(payload.Qty),
		OwnerUserID: claims.UserID,
	})
	if err != nil {
		h.logError("update cart item failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to update cart item")
		return
	}

	cart, err := h.buildCartResponse(c.Request.Context(), claims.UserID)
	if err != nil {
		h.logError("get cart failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch cart")
		return
	}

	c.JSON(http.StatusOK, cart)
}

func (h *Handler) DeleteCartItemsItemId(c *gin.Context, itemId types.UUID) {
	claims, ok := h.requireUser(c)
	if !ok {
		return
	}

	if err := h.CartStore.DeleteCartItem(c.Request.Context(), db.DeleteCartItemParams{
		ID:          uuid.UUID(itemId),
		OwnerUserID: claims.UserID,
	}); err != nil {
		h.logError("delete cart item failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to delete cart item")
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *Handler) PostCartImportJobs(c *gin.Context) {
	claims, ok := h.requireUser(c)
	if !ok {
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "missing file")
		return
	}
	file, err := fileHeader.Open()
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "failed to read file")
		return
	}
	defer func() {
		_ = file.Close()
	}()

	rows, err := readExcelRows(file)
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid excel file")
		return
	}

	job, err := h.CartStore.CreateCartImportJob(c.Request.Context(), db.CreateCartImportJobParams{
		OwnerUserID:    claims.UserID,
		Status:         string(oapi.RUNNING),
		Progress:       0,
		AutoAddedCount: 0,
		PendingCount:   0,
	})
	if err != nil {
		h.logError("create cart import job failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to create import job")
		return
	}

	rowInputs := parseCartImportRows(rows)
	autoAdded := make([]oapi.CartImportAddedItem, 0)
	pending := make([]oapi.CartImportPendingItem, 0)
	var autoCount int32
	var pendingCount int32

	for _, row := range rowInputs {
		matches, err := h.matchSkusForCartRow(c.Request.Context(), row)
		if err != nil {
			h.logError("match sku failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to process import file")
			return
		}

		qty, qtyOk := parseQty(row.QtyRaw)
		if len(matches) == 1 && qtyOk {
			sku := matches[0]
			_, err := h.CartStore.UpsertCartItem(c.Request.Context(), db.UpsertCartItemParams{
				OwnerUserID: claims.UserID,
				SkuID:       sku.ID,
				Qty:         qty,
			})
			if err != nil {
				h.logError("auto add cart item failed", err)
				h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to process import file")
				return
			}

			_, err = h.CartStore.CreateCartImportRow(c.Request.Context(), db.CreateCartImportRowParams{
				JobID:           job.ID,
				RowNo:           clampInt32(row.RowNo),
				RawName:         row.Name,
				RawSpec:         stringPtrOrNil(row.Spec),
				RawQty:          stringPtrOrNil(row.QtyRaw),
				MatchType:       cartImportMatchAuto,
				SkuID:           pgtype.UUID{Bytes: sku.ID, Valid: true},
				Qty:             &qty,
				CandidateSkuIds: []uuid.UUID{},
				SelectedSkuID:   pgtype.UUID{},
				SelectedQty:     nil,
			})
			if err != nil {
				h.logError("create import row failed", err)
				h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to process import file")
				return
			}

			autoAdded = append(autoAdded, oapi.CartImportAddedItem{
				RowNo: row.RowNo,
				SkuId: sku.ID,
				Qty:   int(qty),
			})
			autoCount++
			continue
		}

		matchType := cartImportMatchNotFound
		if len(matches) > 1 || (len(matches) == 1 && !qtyOk) {
			matchType = cartImportMatchAmbiguous
		}

		candidateIDs := make([]uuid.UUID, 0, len(matches))
		for _, candidate := range matches {
			candidateIDs = append(candidateIDs, candidate.ID)
		}

		_, err = h.CartStore.CreateCartImportRow(c.Request.Context(), db.CreateCartImportRowParams{
			JobID:           job.ID,
			RowNo:           clampInt32(row.RowNo),
			RawName:         row.Name,
			RawSpec:         stringPtrOrNil(row.Spec),
			RawQty:          stringPtrOrNil(row.QtyRaw),
			MatchType:       matchType,
			SkuID:           pgtype.UUID{},
			Qty:             nil,
			CandidateSkuIds: candidateIDs,
			SelectedSkuID:   pgtype.UUID{},
			SelectedQty:     nil,
		})
		if err != nil {
			h.logError("create import row failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to process import file")
			return
		}

		pendingItem, err := h.buildPendingItem(c.Request.Context(), row, matchType, candidateIDs)
		if err != nil {
			h.logError("build pending item failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to process import file")
			return
		}
		pending = append(pending, pendingItem)
		pendingCount++
	}

	if err := h.CartStore.UpdateCartImportJobCounts(c.Request.Context(), db.UpdateCartImportJobCountsParams{
		ID:             job.ID,
		AutoAddedCount: autoCount,
		PendingCount:   pendingCount,
		Status:         string(oapi.SUCCEEDED),
		Progress:       100,
	}); err != nil {
		h.logError("update import job failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to finalize import job")
		return
	}

	createdAt := job.CreatedAt.Time
	response := oapi.CartImportJob{
		Id:        job.ID,
		Type:      oapi.CartImportJobTypeCARTIMPORT,
		Status:    oapi.SUCCEEDED,
		Progress:  100,
		CreatedAt: createdAt,
		Result: &oapi.CartImportResult{
			AutoAddedCount: int(autoCount),
			PendingCount:   int(pendingCount),
			AutoAddedItems: autoAdded,
			PendingItems:   pending,
		},
	}

	c.JSON(http.StatusAccepted, response)
}

func (h *Handler) GetCartImportJobsJobId(c *gin.Context, jobId types.UUID) {
	claims, ok := h.requireUser(c)
	if !ok {
		return
	}

	job, err := h.CartStore.GetCartImportJob(c.Request.Context(), uuid.UUID(jobId))
	if err != nil {
		h.logError("get cart import job failed", err)
		h.writeError(c, http.StatusNotFound, "not_found", "import job not found")
		return
	}
	if job.OwnerUserID != claims.UserID {
		h.writeError(c, http.StatusNotFound, "not_found", "import job not found")
		return
	}

	rows, err := h.CartStore.ListCartImportRows(c.Request.Context(), job.ID)
	if err != nil {
		h.logError("list import rows failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch import job")
		return
	}

	result, autoCount, pendingCount, err := h.buildCartImportResult(c.Request.Context(), rows)
	if err != nil {
		h.logError("build import result failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch import job")
		return
	}

	createdAt := job.CreatedAt.Time
	response := oapi.CartImportJob{
		Id:        job.ID,
		Type:      oapi.CartImportJobTypeCARTIMPORT,
		Status:    oapi.JobStatus(job.Status),
		Progress:  int(job.Progress),
		CreatedAt: createdAt,
		Result:    &result,
	}
	response.Result.AutoAddedCount = int(autoCount)
	response.Result.PendingCount = int(pendingCount)

	c.JSON(http.StatusOK, response)
}

func (h *Handler) PostCartImportJobsJobIdConfirm(c *gin.Context, jobId types.UUID) {
	claims, ok := h.requireUser(c)
	if !ok {
		return
	}

	job, err := h.CartStore.GetCartImportJob(c.Request.Context(), uuid.UUID(jobId))
	if err != nil {
		h.logError("get cart import job failed", err)
		h.writeError(c, http.StatusNotFound, "not_found", "import job not found")
		return
	}
	if job.OwnerUserID != claims.UserID {
		h.writeError(c, http.StatusNotFound, "not_found", "import job not found")
		return
	}

	var request oapi.ConfirmCartImportRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	rows, err := h.CartStore.ListCartImportRows(c.Request.Context(), job.ID)
	if err != nil {
		h.logError("list import rows failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to confirm import job")
		return
	}
	rowByNo := map[int]int{}
	for i, row := range rows {
		rowByNo[int(row.RowNo)] = i
	}

	for _, selection := range request.Selections {
		index, ok := rowByNo[selection.RowNo]
		if !ok {
			continue
		}
		row := rows[index]

		qty := int32(1)
		if selection.Qty != nil {
			qty = clampInt32(*selection.Qty)
		} else if row.RawQty != nil {
			if parsed, ok := parseQty(*row.RawQty); ok {
				qty = parsed
			}
		}

		if err := h.CartStore.UpdateCartImportRowSelection(c.Request.Context(), db.UpdateCartImportRowSelectionParams{
			JobID:         job.ID,
			SelectedSkuID: pgtype.UUID{Bytes: uuid.UUID(selection.SkuId), Valid: true},
			SelectedQty:   &qty,
			RowNo:         clampInt32(selection.RowNo),
		}); err != nil {
			h.logError("update import row failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to confirm import job")
			return
		}

		_, err = h.CartStore.UpsertCartItem(c.Request.Context(), db.UpsertCartItemParams{
			OwnerUserID: claims.UserID,
			SkuID:       uuid.UUID(selection.SkuId),
			Qty:         qty,
		})
		if err != nil {
			h.logError("add cart item failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to confirm import job")
			return
		}
	}

	rows, err = h.CartStore.ListCartImportRows(c.Request.Context(), job.ID)
	if err != nil {
		h.logError("list import rows failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to confirm import job")
		return
	}

	_, autoCount, pendingCount, err := h.buildCartImportResult(c.Request.Context(), rows)
	if err != nil {
		h.logError("build import result failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to confirm import job")
		return
	}

	if err := h.CartStore.UpdateCartImportJobCounts(c.Request.Context(), db.UpdateCartImportJobCountsParams{
		ID:             job.ID,
		AutoAddedCount: autoCount,
		PendingCount:   pendingCount,
		Status:         string(oapi.SUCCEEDED),
		Progress:       100,
	}); err != nil {
		h.logError("update import job failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to confirm import job")
		return
	}

	cart, err := h.buildCartResponse(c.Request.Context(), claims.UserID)
	if err != nil {
		h.logError("get cart failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch cart")
		return
	}

	c.JSON(http.StatusOK, cart)
}

func (h *Handler) buildCartResponse(ctx context.Context, ownerID uuid.UUID) (oapi.Cart, error) {
	items, err := h.CartStore.ListCartItems(ctx, ownerID)
	if err != nil {
		return oapi.Cart{}, err
	}

	skuIDs := make([]uuid.UUID, 0, len(items))
	for _, item := range items {
		skuIDs = append(skuIDs, item.SkuID)
	}

	skuMap, err := h.loadSkusWithTiers(ctx, skuIDs)
	if err != nil {
		return oapi.Cart{}, err
	}

	response := oapi.Cart{Items: make([]oapi.CartItem, 0, len(items))}
	var latest *time.Time
	for _, item := range items {
		sku, ok := skuMap[item.SkuID]
		if !ok {
			return oapi.Cart{}, errors.New("sku not found")
		}
		response.Items = append(response.Items, oapi.CartItem{
			Id:  item.ID,
			Sku: sku,
			Qty: int(item.Qty),
		})
		if updatedAt := timeFromTimestamptz(item.UpdatedAt); updatedAt != nil {
			if latest == nil || updatedAt.After(*latest) {
				latest = updatedAt
			}
		}
	}
	response.UpdatedAt = latest
	return response, nil
}

func (h *Handler) matchSkusForCartRow(ctx context.Context, row cartImportRowInput) ([]db.CatalogSku, error) {
	switch {
	case row.SkuID != nil:
		return h.CatalogStore.ListSkusByIDs(ctx, []uuid.UUID{*row.SkuID})
	case row.SkuCode != "":
		skuCode := row.SkuCode
		return h.CatalogStore.ListSkusBySkuCode(ctx, &skuCode)
	case row.Name != "" && row.Spec != "":
		spec := row.Spec
		return h.CatalogStore.ListSkusByNameAndSpec(ctx, db.ListSkusByNameAndSpecParams{
			Name: row.Name,
			Spec: &spec,
		})
	case row.Name != "":
		return h.CatalogStore.ListSkusByName(ctx, row.Name)
	default:
		return nil, nil
	}
}

func (h *Handler) buildPendingItem(ctx context.Context, row cartImportRowInput, matchType string, candidateIDs []uuid.UUID) (oapi.CartImportPendingItem, error) {
	skuMap, err := h.loadSkusWithTiers(ctx, candidateIDs)
	if err != nil {
		return oapi.CartImportPendingItem{}, err
	}

	candidates := make([]oapi.CartImportCandidate, 0, len(candidateIDs))
	for _, id := range candidateIDs {
		if sku, ok := skuMap[id]; ok {
			candidates = append(candidates, oapi.CartImportCandidate{Sku: sku})
		}
	}

	pending := oapi.CartImportPendingItem{
		RowNo:      row.RowNo,
		RawName:    row.Name,
		MatchType:  oapi.NOTFOUND,
		Candidates: candidates,
	}
	if matchType == cartImportMatchAmbiguous {
		pending.MatchType = oapi.AMBIGUOUS
	}
	if row.Spec != "" {
		pending.RawSpec = &row.Spec
	}
	if row.QtyRaw != "" {
		pending.RawQty = &row.QtyRaw
	}
	return pending, nil
}

func (h *Handler) buildCartImportResult(ctx context.Context, rows []db.CartImportRow) (oapi.CartImportResult, int32, int32, error) {
	candidateIDs := make([]uuid.UUID, 0)
	for _, row := range rows {
		candidateIDs = append(candidateIDs, row.CandidateSkuIds...)
		if row.SkuID.Valid {
			candidateIDs = append(candidateIDs, uuid.UUID(row.SkuID.Bytes))
		}
		if row.SelectedSkuID.Valid {
			candidateIDs = append(candidateIDs, uuid.UUID(row.SelectedSkuID.Bytes))
		}
	}

	skuMap, err := h.loadSkusWithTiers(ctx, candidateIDs)
	if err != nil {
		return oapi.CartImportResult{}, 0, 0, err
	}

	result := oapi.CartImportResult{
		AutoAddedItems: []oapi.CartImportAddedItem{},
		PendingItems:   []oapi.CartImportPendingItem{},
	}
	var autoCount int32
	var pendingCount int32

	for _, row := range rows {
		if row.MatchType == cartImportMatchAuto || row.SelectedSkuID.Valid {
			skuID := uuid.UUID(row.SkuID.Bytes)
			if row.SelectedSkuID.Valid {
				skuID = uuid.UUID(row.SelectedSkuID.Bytes)
			}
			qty := int32(1)
			if row.SelectedQty != nil {
				qty = *row.SelectedQty
			} else if row.Qty != nil {
				qty = *row.Qty
			}
			result.AutoAddedItems = append(result.AutoAddedItems, oapi.CartImportAddedItem{
				RowNo: int(row.RowNo),
				SkuId: skuID,
				Qty:   int(qty),
			})
			autoCount++
			continue
		}

		pendingItem := oapi.CartImportPendingItem{
			RowNo:      int(row.RowNo),
			RawName:    row.RawName,
			MatchType:  oapi.NOTFOUND,
			Candidates: []oapi.CartImportCandidate{},
		}
		if row.MatchType == cartImportMatchAmbiguous {
			pendingItem.MatchType = oapi.AMBIGUOUS
		}
		if row.RawSpec != nil {
			pendingItem.RawSpec = row.RawSpec
		}
		if row.RawQty != nil {
			pendingItem.RawQty = row.RawQty
		}
		if len(row.CandidateSkuIds) > 0 {
			candidates := make([]oapi.CartImportCandidate, 0, len(row.CandidateSkuIds))
			for _, id := range row.CandidateSkuIds {
				if sku, ok := skuMap[id]; ok {
					candidates = append(candidates, oapi.CartImportCandidate{Sku: sku})
				}
			}
			pendingItem.Candidates = candidates
		}

		result.PendingItems = append(result.PendingItems, pendingItem)
		pendingCount++
	}

	result.AutoAddedCount = int(autoCount)
	result.PendingCount = int(pendingCount)
	return result, autoCount, pendingCount, nil
}

func parseCartImportRows(rows [][]string) []cartImportRowInput {
	if len(rows) <= 1 {
		return nil
	}
	index := headerIndexMap(rows[0])
	inputs := make([]cartImportRowInput, 0, len(rows)-1)

	for i := 1; i < len(rows); i++ {
		row := rows[i]
		skuIDRaw := cellValue(row, index, "skuid")
		skuCode := cellValue(row, index, "skucode")
		name := cellValue(row, index, "name")
		spec := cellValue(row, index, "spec")
		qtyRaw := cellValue(row, index, "qty")

		if skuIDRaw == "" && skuCode == "" && name == "" && spec == "" && qtyRaw == "" {
			continue
		}

		if name == "" {
			if skuCode != "" {
				name = skuCode
			} else if skuIDRaw != "" {
				name = skuIDRaw
			}
		}

		var skuID *uuid.UUID
		if skuIDRaw != "" {
			if parsed, err := uuid.Parse(skuIDRaw); err == nil {
				skuID = &parsed
			}
		}

		inputs = append(inputs, cartImportRowInput{
			RowNo:   i + 1,
			SkuID:   skuID,
			SkuCode: skuCode,
			Name:    name,
			Spec:    spec,
			QtyRaw:  qtyRaw,
		})
	}
	return inputs
}

func parseQty(raw string) (int32, bool) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return 0, false
	}
	value, err := strconv.Atoi(trimmed)
	if err != nil || value < 1 {
		return 0, false
	}
	return clampInt32(value), true
}

func stringPtrOrNil(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}
