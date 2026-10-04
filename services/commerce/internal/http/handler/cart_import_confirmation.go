package handler

import (
	"context"
	"errors"
	"math"
	"net/http"
	"slices"
	"sort"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	shareddb "github.com/teamdsb/tmo/packages/go-shared/db"
	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/http/oapi"
)

type cartImportConfirmationError struct {
	status  int
	message string
}

func (e cartImportConfirmationError) Error() string { return e.message }

func (h *Handler) confirmCartImport(ctx context.Context, ownerID, jobID uuid.UUID, request oapi.ConfirmCartImportRequest) error {
	if h.DB == nil {
		return errors.New("database is not configured")
	}
	return shareddb.WithTx(ctx, h.DB, func(tx pgx.Tx) error {
		q := db.New(tx)
		// A job row is the durable idempotency boundary, including concurrent
		// retries after the client lost a successful response.
		job, err := q.GetCartImportJobForUpdate(ctx, jobID)
		if errors.Is(err, pgx.ErrNoRows) || (err == nil && job.OwnerUserID != ownerID) {
			return cartImportConfirmationError{http.StatusNotFound, "import job not found"}
		}
		if err != nil {
			return err
		}
		if job.Status != string(oapi.SUCCEEDED) {
			return cartImportConfirmationError{http.StatusConflict, "import job is not ready for confirmation"}
		}
		rows, err := q.ListCartImportRows(ctx, jobID)
		if err != nil {
			return err
		}
		rowByNo := make(map[int]int, len(rows))
		for i, row := range rows {
			rowByNo[int(row.RowNo)] = i
		}
		seen := make(map[int]bool, len(request.Selections))
		quantities := make(map[uuid.UUID]int64)
		updates := make([]db.UpdateCartImportRowSelectionParams, 0, len(request.Selections))
		for _, selection := range request.Selections {
			index, ok := rowByNo[selection.RowNo]
			if !ok || seen[selection.RowNo] {
				return cartImportConfirmationError{http.StatusBadRequest, "unknown or duplicate import row"}
			}
			seen[selection.RowNo] = true
			row := rows[index]
			qty := int32(1)
			if selection.Qty != nil {
				if *selection.Qty < 1 || *selection.Qty > math.MaxInt32 {
					return cartImportConfirmationError{http.StatusBadRequest, "qty must be between 1 and 2147483647"}
				}
				qty = int32(*selection.Qty)
			} else if row.RawQty != nil {
				if parsed, ok := parseQty(*row.RawQty); ok {
					qty = parsed
				}
			}
			// AUTO rows have already changed the cart during recognition.
			// Confirmed rows must never be applied a second time.
			if row.SelectedSkuID.Valid || row.MatchType == cartImportMatchAuto {
				previousSKU, previousQty := row.SkuID, row.Qty
				if row.SelectedSkuID.Valid {
					previousSKU, previousQty = row.SelectedSkuID, row.SelectedQty
				}
				if !previousSKU.Valid || uuid.UUID(previousSKU.Bytes) != selection.SkuId || previousQty == nil || *previousQty != qty {
					return cartImportConfirmationError{http.StatusConflict, "import row has already been confirmed differently"}
				}
				continue
			}
			if !slices.Contains(row.CandidateSkuIds, selection.SkuId) {
				return cartImportConfirmationError{http.StatusBadRequest, "selected SKU is not an import candidate"}
			}
			quantities[selection.SkuId] += int64(qty)
			if quantities[selection.SkuId] > math.MaxInt32 {
				return cartImportConfirmationError{http.StatusBadRequest, "combined SKU quantity is too large"}
			}
			selectedID := pgtype.UUID{Bytes: selection.SkuId, Valid: true}
			updates = append(updates, db.UpdateCartImportRowSelectionParams{JobID: jobID, RowNo: row.RowNo, SelectedSkuID: selectedID, SelectedQty: &qty})
			rows[index].SelectedSkuID = selectedID
			rows[index].SelectedQty = &qty
		}
		ids := make([]uuid.UUID, 0, len(quantities))
		for id := range quantities {
			ids = append(ids, id)
		}
		sort.Slice(ids, func(i, j int) bool { return ids[i].String() < ids[j].String() })
		if len(ids) > 0 {
			// Use the same catalog/cart lock order as checkout. A candidate may
			// have been unpublished between file recognition and confirmation.
			products, err := q.ListProductsBySkuIDsForUpdate(ctx, ids)
			if err != nil {
				return err
			}
			for _, product := range products {
				if product.Status != productStatusActive {
					return cartImportConfirmationError{http.StatusBadRequest, "selected product is not active"}
				}
			}
			skus, err := q.ListSkusByIDsForNoKeyUpdate(ctx, ids)
			if err != nil {
				return err
			}
			if len(skus) != len(ids) {
				return cartImportConfirmationError{http.StatusBadRequest, "selected SKU no longer exists"}
			}
			for _, sku := range skus {
				if !sku.IsActive {
					return cartImportConfirmationError{http.StatusBadRequest, "selected SKU is inactive"}
				}
			}
		}
		for _, update := range updates {
			if err := q.UpdateCartImportRowSelection(ctx, update); err != nil {
				return err
			}
		}
		for _, id := range ids {
			if _, err := q.UpsertCartItem(ctx, db.UpsertCartItemParams{OwnerUserID: ownerID, SkuID: id, Qty: int32(quantities[id])}); err != nil {
				return err
			}
		}
		var added, pending int32
		for _, row := range rows {
			if row.MatchType == cartImportMatchAuto || row.SelectedSkuID.Valid {
				added++
			} else {
				pending++
			}
		}
		return q.UpdateCartImportJobCounts(ctx, db.UpdateCartImportJobCountsParams{ID: jobID, AutoAddedCount: added, PendingCount: pending, Status: string(oapi.SUCCEEDED), Progress: 100})
	})
}
