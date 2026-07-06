package handler

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/oapi-codegen/runtime/types"

	shareddb "github.com/teamdsb/tmo/packages/go-shared/db"
	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/http/oapi"
)

var errInvalidFulfillmentTransition = errors.New("order cannot be assigned in its current state")

type orderFulfillmentTransition struct {
	status          string
	paymentStatus   string
	latestPaymentID pgtype.UUID
	paymentChannel  *string
	paidAt          pgtype.Timestamptz
}

func validateOrderFulfillmentInput(owner uuid.UUID, note, key string) error {
	if owner == uuid.Nil {
		return errors.New("ownerSalesUserId is required")
	}
	if strings.TrimSpace(note) == "" {
		return errors.New("note is required")
	}
	if len([]rune(strings.TrimSpace(note))) > 1000 {
		return errors.New("note must be at most 1000 characters")
	}
	if strings.TrimSpace(key) == "" {
		return errors.New("Idempotency-Key is required")
	}
	return nil
}

func resolveOrderFulfillmentTransition(order db.Order, confirmOffline bool) (orderFulfillmentTransition, error) {
	switch strings.ToUpper(order.Status) {
	case "SHIPPED", "DELIVERED", "CANCELLED", "CLOSED":
		return orderFulfillmentTransition{}, errInvalidFulfillmentTransition
	}
	if confirmOffline {
		if strings.EqualFold(order.PaymentStatus, "PAID") {
			return orderFulfillmentTransition{}, errors.New("order is already paid")
		}
		channel := "OFFLINE"
		return orderFulfillmentTransition{status: "CONFIRMED", paymentStatus: "PAID", paymentChannel: &channel, paidAt: pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true}}, nil
	}
	if !strings.EqualFold(order.PaymentStatus, "PAID") {
		return orderFulfillmentTransition{}, errors.New("order must be paid before assignment")
	}
	if !strings.EqualFold(order.Status, "PAID") && !strings.EqualFold(order.Status, "CONFIRMED") {
		return orderFulfillmentTransition{}, errInvalidFulfillmentTransition
	}
	return orderFulfillmentTransition{status: "CONFIRMED", paymentStatus: order.PaymentStatus, latestPaymentID: order.LatestPaymentID, paymentChannel: order.PaymentChannel, paidAt: order.PaidAt}, nil
}

func fulfillmentAction(order db.Order, confirmOffline bool) string {
	if confirmOffline {
		return "OFFLINE_PAYMENT_AND_ASSIGN"
	}
	if order.OwnerSalesUserID.Valid {
		return "REASSIGN"
	}
	return "ASSIGN"
}

func (h *Handler) PatchAdminOrdersOrderIdFulfillment(c *gin.Context, orderID types.UUID, params oapi.PatchAdminOrdersOrderIdFulfillmentParams) {
	claims, ok := h.requireRole(c, "BOSS", "MANAGER", "ADMIN")
	if !ok {
		return
	}
	var request oapi.UpdateOrderFulfillmentRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}
	ownerID := uuid.UUID(request.OwnerSalesUserId)
	note := strings.TrimSpace(request.Note)
	key := strings.TrimSpace(params.IdempotencyKey)
	if err := validateOrderFulfillmentInput(ownerID, note, key); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	if h.DB == nil {
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to update order")
		return
	}
	lookup := db.New(h.DB)
	if _, err := lookup.GetOrderAdminEventByIdempotencyKey(c.Request.Context(), db.GetOrderAdminEventByIdempotencyKeyParams{OrderID: uuid.UUID(orderID), IdempotencyKey: key}); err == nil {
		order, getErr := lookup.GetOrder(c.Request.Context(), uuid.UUID(orderID))
		if getErr != nil {
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch updated order")
			return
		}
		response, mapErr := h.orderResponse(c.Request.Context(), order)
		if mapErr != nil {
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch updated order")
			return
		}
		c.JSON(http.StatusOK, response)
		return
	} else if !errors.Is(err, pgx.ErrNoRows) {
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to update order")
		return
	}
	if h.SalesValidator == nil {
		h.writeError(c, http.StatusBadGateway, "identity_unavailable", "unable to validate sales assignee")
		return
	}
	if err := h.SalesValidator.ValidateActiveSales(c.Request.Context(), c.GetHeader("Authorization"), ownerID); err != nil {
		if errors.Is(err, errSalesAssigneeInvalid) {
			h.writeError(c, http.StatusConflict, "invalid_sales_assignee", err.Error())
			return
		}
		h.logError("validate sales assignee failed", err)
		h.writeError(c, http.StatusBadGateway, "identity_unavailable", "unable to validate sales assignee")
		return
	}
	ctx := c.Request.Context()
	var updated db.Order
	err := shareddb.WithTx(ctx, h.DB, func(tx pgx.Tx) error {
		q := db.New(tx)
		current, err := q.GetOrderForUpdate(ctx, uuid.UUID(orderID))
		if err != nil {
			return err
		}
		if _, err := q.GetOrderAdminEventByIdempotencyKey(ctx, db.GetOrderAdminEventByIdempotencyKeyParams{OrderID: uuid.UUID(orderID), IdempotencyKey: key}); err == nil {
			updated = current
			return nil
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return err
		}
		transition, err := resolveOrderFulfillmentTransition(current, request.ConfirmOfflinePayment)
		if err != nil {
			return err
		}
		updated, err = q.UpdateOrderFulfillment(ctx, db.UpdateOrderFulfillmentParams{
			ID: current.ID, Status: transition.status, PaymentStatus: transition.paymentStatus,
			LatestPaymentID: transition.latestPaymentID, PaymentChannel: transition.paymentChannel, PaidAt: transition.paidAt,
			OwnerSalesUserID: pgtype.UUID{Bytes: ownerID, Valid: true},
		})
		if err != nil {
			return err
		}
		action := fulfillmentAction(current, request.ConfirmOfflinePayment)
		_, err = q.CreateOrderAdminEvent(ctx, db.CreateOrderAdminEventParams{
			OrderID: current.ID, IdempotencyKey: key, ActorUserID: claims.UserID, Action: action, Note: note,
			PreviousStatus: current.Status, NewStatus: updated.Status, PreviousPaymentStatus: current.PaymentStatus, NewPaymentStatus: updated.PaymentStatus,
			PreviousOwnerSalesUserID: current.OwnerSalesUserID, NewOwnerSalesUserID: ownerID,
		})
		return err
	})
	if err != nil {
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			h.writeError(c, http.StatusNotFound, "not_found", "order not found")
		case errors.Is(err, errInvalidFulfillmentTransition), strings.Contains(err.Error(), "paid"):
			h.writeError(c, http.StatusConflict, "invalid_order_state", err.Error())
		default:
			h.logError("update order fulfillment failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to update order")
		}
		return
	}
	response, err := h.orderResponse(ctx, updated)
	if err != nil {
		h.logError("map updated order failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch updated order")
		return
	}
	c.JSON(http.StatusOK, response)
}

func (h *Handler) GetAdminOrdersOrderIdEvents(c *gin.Context, orderID types.UUID) {
	if _, ok := h.requireRole(c, "BOSS", "MANAGER", "ADMIN"); !ok {
		return
	}
	if h.DB == nil {
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list order events")
		return
	}
	q := db.New(h.DB)
	if _, err := q.GetOrder(c.Request.Context(), uuid.UUID(orderID)); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "order not found")
		} else {
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list order events")
		}
		return
	}
	events, err := q.ListOrderAdminEvents(c.Request.Context(), uuid.UUID(orderID))
	if err != nil {
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list order events")
		return
	}
	items := make([]oapi.OrderAdminEvent, 0, len(events))
	for _, event := range events {
		items = append(items, orderAdminEventFromModel(event))
	}
	c.JSON(http.StatusOK, oapi.OrderAdminEventList{Items: items})
}

func (h *Handler) orderResponse(ctx context.Context, order db.Order) (oapi.Order, error) {
	items, err := h.OrderStore.ListOrderItems(ctx, order.ID)
	if err != nil {
		return oapi.Order{}, err
	}
	skuIDs := make([]uuid.UUID, 0, len(items))
	for _, item := range items {
		skuIDs = append(skuIDs, item.SkuID)
	}
	skus, err := h.loadSkusWithTiers(ctx, skuIDs)
	if err != nil {
		return oapi.Order{}, err
	}
	mapped, err := mapOrderItems(items, skus)
	if err != nil {
		return oapi.Order{}, err
	}
	return orderFromModel(order, mapped)
}

func orderAdminEventFromModel(event db.OrderAdminEvent) oapi.OrderAdminEvent {
	result := oapi.OrderAdminEvent{Id: event.ID, OrderId: event.OrderID, ActorUserId: event.ActorUserID, Action: event.Action, Note: event.Note, PreviousStatus: oapi.OrderStatus(event.PreviousStatus), NewStatus: oapi.OrderStatus(event.NewStatus), PreviousPaymentStatus: oapi.OrderPaymentStatus(event.PreviousPaymentStatus), NewPaymentStatus: oapi.OrderPaymentStatus(event.NewPaymentStatus), NewOwnerSalesUserId: event.NewOwnerSalesUserID, CreatedAt: event.CreatedAt.Time}
	if event.PreviousOwnerSalesUserID.Valid {
		id := types.UUID(event.PreviousOwnerSalesUserID.Bytes)
		result.PreviousOwnerSalesUserId = &id
	}
	return result
}
