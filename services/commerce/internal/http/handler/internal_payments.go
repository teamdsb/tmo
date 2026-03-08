package handler

import (
	"context"
	"crypto/subtle"
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
	PaymentID       string     `json:"paymentId"`
	Channel         string     `json:"channel"`
	Status          string     `json:"status"`
	ProviderTradeNo *string    `json:"providerTradeNo,omitempty"`
	PaidAt          *time.Time `json:"paidAt,omitempty"`
}

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

	order, err := h.syncOrderPaymentSummary(c.Request.Context(), orderID, db.UpdateOrderPaymentSummaryParams{
		ID:              orderID,
		Status:          orderStatus,
		PaymentStatus:   strings.ToUpper(strings.TrimSpace(request.Status)),
		LatestPaymentID: latestPaymentID,
		PaymentChannel:  normalizeOptionalText(request.Channel),
		PaidAt:          paidAt,
	})
	if err != nil {
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

	skuIDs := make([]uuid.UUID, 0, len(items))
	for _, item := range items {
		skuIDs = append(skuIDs, item.SkuID)
	}
	skuMap, err := h.loadSkusWithTiers(c.Request.Context(), skuIDs)
	if err != nil {
		h.logError("load skus failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to sync order payment summary")
		return
	}
	mappedItems, err := mapOrderItems(items, skuMap)
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

		if strings.EqualFold(current.PaymentStatus, "PAID") || strings.EqualFold(current.Status, "PAID") {
			order = current
			return nil
		}

		order, err = q.UpdateOrderPaymentSummary(ctx, update)
		if err != nil {
			return err
		}
		if !strings.EqualFold(update.PaymentStatus, "PAID") {
			return nil
		}

		orderItems, err := q.ListOrderItems(ctx, orderID)
		if err != nil {
			return err
		}

		sourceIDs := make([]uuid.UUID, 0, len(orderItems))
		for _, item := range orderItems {
			if item.SourceCartItemID.Valid {
				sourceIDs = append(sourceIDs, item.SourceCartItemID.Bytes)
			}
		}
		if len(sourceIDs) == 0 {
			return nil
		}

		cartItems, err := q.ListCartItemsByIDsForUpdate(ctx, db.ListCartItemsByIDsForUpdateParams{
			OwnerUserID: order.CustomerID,
			Ids:         uniqueUUIDs(sourceIDs),
		})
		if err != nil {
			return err
		}

		cartByID := make(map[uuid.UUID]db.CartItem, len(cartItems))
		for _, item := range cartItems {
			cartByID[item.ID] = item
		}

		for _, item := range orderItems {
			if !item.SourceCartItemID.Valid {
				continue
			}
			cartItem, ok := cartByID[item.SourceCartItemID.Bytes]
			if !ok || cartItem.SkuID != item.SkuID {
				continue
			}

			nextQty := cartItem.Qty - item.Qty
			if nextQty > 0 {
				updatedCartItem, err := q.UpdateCartItemQty(ctx, db.UpdateCartItemQtyParams{
					ID:          cartItem.ID,
					Qty:         nextQty,
					OwnerUserID: order.CustomerID,
				})
				if err != nil {
					return err
				}
				cartByID[updatedCartItem.ID] = updatedCartItem
				continue
			}
			if err := q.DeleteCartItem(ctx, db.DeleteCartItemParams{
				ID:          cartItem.ID,
				OwnerUserID: order.CustomerID,
			}); err != nil {
				return err
			}
			delete(cartByID, cartItem.ID)
		}

		return nil
	})
	if err != nil {
		return db.Order{}, err
	}
	return order, nil
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
