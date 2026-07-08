package handler

import (
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

var (
	errInvalidShipTransition    = errors.New("order must be confirmed and paid before shipping")
	errInvalidReceiptTransition = errors.New("order must be shipped before receipt confirmation")
)

func (h *Handler) PostAdminOrdersOrderIdShip(c *gin.Context, orderID types.UUID) {
	if _, ok := h.requireRole(c, "PROCUREMENT", "CS", "MANAGER", "BOSS", "ADMIN"); !ok {
		return
	}

	var request oapi.ShipOrderRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}
	waybillNo := strings.TrimSpace(request.WaybillNo)
	if waybillNo == "" {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "waybillNo is required")
		return
	}

	if h.DB == nil {
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to ship order")
		return
	}

	shippedAt := time.Now().UTC()
	if request.ShippedAt != nil {
		shippedAt = request.ShippedAt.UTC()
	}
	var carrier *string
	if request.Carrier != nil {
		trimmed := strings.TrimSpace(*request.Carrier)
		if trimmed != "" {
			carrier = &trimmed
		}
	}

	ctx := c.Request.Context()
	var updated db.Order
	err := shareddb.WithTx(ctx, h.DB, func(tx pgx.Tx) error {
		q := db.New(tx)
		current, err := q.GetOrderForUpdate(ctx, uuid.UUID(orderID))
		if err != nil {
			return err
		}
		if !strings.EqualFold(current.Status, string(oapi.OrderStatusCONFIRMED)) || !strings.EqualFold(current.PaymentStatus, string(oapi.OrderPaymentStatusPAID)) {
			return errInvalidShipTransition
		}
		if _, err := q.UpsertTrackingShipment(ctx, db.UpsertTrackingShipmentParams{
			OrderID:   current.ID,
			WaybillNo: waybillNo,
			Carrier:   carrier,
			ShippedAt: pgtype.Timestamptz{Time: shippedAt, Valid: true},
		}); err != nil {
			return err
		}
		updated, err = q.UpdateOrderStatus(ctx, db.UpdateOrderStatusParams{
			ID:     current.ID,
			Status: string(oapi.OrderStatusSHIPPED),
		})
		return err
	})
	if err != nil {
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			h.writeError(c, http.StatusNotFound, "not_found", "order not found")
		case errors.Is(err, errInvalidShipTransition):
			h.writeError(c, http.StatusConflict, "invalid_order_state", err.Error())
		default:
			h.logError("ship order failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to ship order")
		}
		return
	}

	response, err := h.orderResponse(ctx, updated)
	if err != nil {
		h.logError("map shipped order failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch updated order")
		return
	}
	c.JSON(http.StatusOK, response)
}

func (h *Handler) PostOrdersOrderIdConfirmReceipt(c *gin.Context, orderID types.UUID) {
	claims, ok := h.requireRole(c, "CUSTOMER")
	if !ok {
		return
	}
	if h.DB == nil {
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to confirm receipt")
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
		if current.CustomerID != claims.UserID {
			return pgx.ErrNoRows
		}
		if !strings.EqualFold(current.Status, string(oapi.OrderStatusSHIPPED)) {
			return errInvalidReceiptTransition
		}
		updated, err = q.UpdateOrderStatus(ctx, db.UpdateOrderStatusParams{
			ID:     current.ID,
			Status: string(oapi.OrderStatusDELIVERED),
		})
		return err
	})
	if err != nil {
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			h.writeError(c, http.StatusNotFound, "not_found", "order not found")
		case errors.Is(err, errInvalidReceiptTransition):
			h.writeError(c, http.StatusConflict, "invalid_order_state", err.Error())
		default:
			h.logError("confirm receipt failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to confirm receipt")
		}
		return
	}

	response, err := h.orderResponse(ctx, updated)
	if err != nil {
		h.logError("map receipt order failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch updated order")
		return
	}
	c.JSON(http.StatusOK, response)
}

func (h *Handler) PostAdminOrdersOrderIdConfirmDelivery(c *gin.Context, orderID types.UUID) {
	if _, ok := h.requireRole(c, "PROCUREMENT", "CS", "MANAGER", "BOSS", "ADMIN"); !ok {
		return
	}
	if h.DB == nil {
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to confirm delivery")
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
		if !strings.EqualFold(current.Status, string(oapi.OrderStatusSHIPPED)) {
			return errInvalidReceiptTransition
		}
		updated, err = q.UpdateOrderStatus(ctx, db.UpdateOrderStatusParams{
			ID:     current.ID,
			Status: string(oapi.OrderStatusDELIVERED),
		})
		return err
	})
	if err != nil {
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			h.writeError(c, http.StatusNotFound, "not_found", "order not found")
		case errors.Is(err, errInvalidReceiptTransition):
			h.writeError(c, http.StatusConflict, "invalid_order_state", err.Error())
		default:
			h.logError("admin confirm delivery failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to confirm delivery")
		}
		return
	}

	response, err := h.orderResponse(ctx, updated)
	if err != nil {
		h.logError("map delivered order failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch updated order")
		return
	}
	c.JSON(http.StatusOK, response)
}
