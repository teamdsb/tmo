package handler

import (
	"bytes"
	"context"
	"crypto/subtle"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	shareddb "github.com/teamdsb/tmo/packages/go-shared/db"
	"github.com/teamdsb/tmo/services/commerce/internal/db"
)

type internalOrderPaymentSyncRequest struct {
	PaymentID        string     `json:"paymentId"`
	Channel          string     `json:"channel"`
	Status           string     `json:"status"`
	ProviderTradeNo  *string    `json:"providerTradeNo,omitempty"`
	PaidAt           *time.Time `json:"paidAt,omitempty"`
	PaymentCreatedAt *time.Time `json:"paymentCreatedAt,omitempty"`
	StateVersion     *int64     `json:"stateVersion,omitempty"`
}

var errPaymentSyncSourceMismatch = errors.New("paymentCreatedAt must remain unchanged for the same payment")

func (h *Handler) PostInternalOrdersOrderIdPaymentStatus(c *gin.Context) {
	if !h.authorizeInternalSync(c) {
		h.writeError(c, http.StatusUnauthorized, "unauthorized", "invalid internal sync token")
		return
	}

	orderID, err := uuid.Parse(strings.TrimSpace(c.Param("orderId")))
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid orderId")
		return
	}

	var request internalOrderPaymentSyncRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	paymentID, err := uuid.Parse(strings.TrimSpace(request.PaymentID))
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid paymentId")
		return
	}

	orderStatus, ok := paymentStatusToOrderStatus(request.Status)
	if !ok {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid payment status")
		return
	}

	latestPaymentID := pgtype.UUID{Bytes: paymentID, Valid: true}
	paidAt := pgtype.Timestamptz{}
	if request.PaidAt != nil {
		paidAt = pgtype.Timestamptz{Time: request.PaidAt.UTC(), Valid: true}
	}
	var sourceCreatedAt pgtype.Timestamptz
	var stateVersion int64
	if request.PaymentCreatedAt != nil || request.StateVersion != nil {
		if request.PaymentCreatedAt == nil || request.StateVersion == nil || request.PaymentCreatedAt.IsZero() || *request.StateVersion <= 0 {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "paymentCreatedAt and positive stateVersion must be supplied together")
			return
		}
		sourceCreatedAt = pgtype.Timestamptz{Time: request.PaymentCreatedAt.UTC(), Valid: true}
		stateVersion = *request.StateVersion
	}

	order, err := h.syncOrderPaymentSummary(c.Request.Context(), orderID, db.UpdateOrderPaymentSummaryParams{
		ID:                      orderID,
		Status:                  orderStatus,
		PaymentStatus:           strings.ToUpper(strings.TrimSpace(request.Status)),
		LatestPaymentID:         latestPaymentID,
		PaymentChannel:          normalizeOptionalText(request.Channel),
		PaidAt:                  paidAt,
		PaymentSyncCreatedAt:    sourceCreatedAt,
		PaymentSyncStateVersion: stateVersion,
	})
	if err != nil {
		if errors.Is(err, errPaymentSyncSourceMismatch) {
			h.writeError(c, http.StatusBadRequest, "invalid_request", err.Error())
			return
		}
		if err == pgx.ErrNoRows {
			h.writeError(c, http.StatusNotFound, "not_found", "order not found")
			return
		}
		h.logError("sync order payment summary failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to sync order payment summary")
		return
	}

	items, err := h.OrderStore.ListOrderItems(c.Request.Context(), order.ID)
	if err != nil {
		h.logError("list order items failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to sync order payment summary")
		return
	}

	mappedItems, err := mapOrderItems(items)
	if err != nil {
		h.logError("map order items failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to sync order payment summary")
		return
	}

	response, err := orderFromModel(order, mappedItems)
	if err != nil {
		h.logError("map order failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to sync order payment summary")
		return
	}

	c.JSON(http.StatusOK, response)
}

func (h *Handler) syncOrderPaymentSummary(ctx context.Context, orderID uuid.UUID, update db.UpdateOrderPaymentSummaryParams) (db.Order, error) {
	if h.DB == nil {
		return h.OrderStore.UpdateOrderPaymentSummary(ctx, update)
	}

	var order db.Order
	err := shareddb.WithTx(ctx, h.DB, func(tx pgx.Tx) error {
		q := db.New(tx)

		current, err := q.GetOrderForUpdate(ctx, orderID)
		if err != nil {
			return err
		}

		accept, err := shouldAcceptPaymentSync(current, update)
		if err != nil {
			return err
		}
		if !accept {
			order = current
			return nil
		}

		order, err = q.UpdateOrderPaymentSummary(ctx, update)
		if err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return db.Order{}, err
	}
	return order, nil
}

// Compare and persist the source ordering while holding the order row lock.
// A confirmed payment outranks every pending/failed attempt, however late it is.
func shouldAcceptPaymentSync(current db.Order, update db.UpdateOrderPaymentSummaryParams) (bool, error) {
	if strings.EqualFold(current.PaymentStatus, "PAID") || strings.EqualFold(current.Status, "PAID") {
		return false, nil
	}
	if strings.EqualFold(update.PaymentStatus, "PAID") {
		return true, nil
	}
	if !current.PaymentSyncCreatedAt.Valid || current.PaymentSyncStateVersion <= 0 || !current.LatestPaymentID.Valid {
		return true, nil
	}
	// Once ordering exists, a versionless message cannot prove it is newer.
	// Its payment row remains durable for a new worker to resend with metadata.
	if !update.PaymentSyncCreatedAt.Valid || update.PaymentSyncStateVersion <= 0 {
		return false, nil
	}
	if current.LatestPaymentID.Bytes == update.LatestPaymentID.Bytes {
		if !current.PaymentSyncCreatedAt.Time.Equal(update.PaymentSyncCreatedAt.Time) {
			return false, errPaymentSyncSourceMismatch
		}
		return update.PaymentSyncStateVersion > current.PaymentSyncStateVersion, nil
	}
	if update.PaymentSyncCreatedAt.Time.Equal(current.PaymentSyncCreatedAt.Time) {
		return bytes.Compare(update.LatestPaymentID.Bytes[:], current.LatestPaymentID.Bytes[:]) > 0, nil
	}
	return update.PaymentSyncCreatedAt.Time.After(current.PaymentSyncCreatedAt.Time), nil
}

func (h *Handler) authorizeInternalSync(c *gin.Context) bool {
	expected := strings.TrimSpace(h.InternalSyncToken)
	if expected == "" {
		return false
	}
	provided := strings.TrimSpace(c.GetHeader("X-Internal-Token"))
	return subtle.ConstantTimeCompare([]byte(expected), []byte(provided)) == 1
}

func paymentStatusToOrderStatus(status string) (string, bool) {
	switch strings.ToUpper(strings.TrimSpace(status)) {
	case "PAY_PENDING":
		return "PAY_PENDING", true
	case "PAID":
		return "PAID", true
	case "PAY_FAILED", "CANCELLED":
		return "PAY_FAILED", true
	default:
		return "", false
	}
}

func normalizeOptionalText(raw string) *string {
	value := strings.TrimSpace(raw)
	if value == "" {
		return nil
	}
	return &value
}
