package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/oapi-codegen/runtime/types"

	shareddb "github.com/teamdsb/tmo/packages/go-shared/db"
	sharedmoney "github.com/teamdsb/tmo/packages/go-shared/money"
	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/http/oapi"
)

func (h *Handler) PostOrders(c *gin.Context, params oapi.PostOrdersParams) {
	claims, ok := h.requireUser(c)
	if !ok {
		return
	}

	var request oapi.CreateOrderRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}
	if len(request.Items) == 0 {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "items is required")
		return
	}

	if params.IdempotencyKey != nil {
		order, err := h.OrderStore.GetOrderByIdempotencyKey(c.Request.Context(), db.GetOrderByIdempotencyKeyParams{
			CustomerID:     claims.UserID,
			IdempotencyKey: params.IdempotencyKey,
		})
		if err == nil {
			h.logError("idempotency key conflict", errors.New("duplicate key"))
			h.writeErrorWithDetails(c, http.StatusConflict, "conflict", "duplicate idempotency key", map[string]interface{}{
				"orderId": order.ID,
			})
			return
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			h.logError("check idempotency key failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to submit order")
			return
		}
	}

	skuIDs := make([]uuid.UUID, 0, len(request.Items))
	qtyBySku := make(map[uuid.UUID]int32, len(request.Items))
	for _, item := range request.Items {
		if item.Qty < 1 {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "qty must be >= 1")
			return
		}
		skuID := uuid.UUID(item.SkuId)
		skuIDs = append(skuIDs, skuID)
		qtyBySku[skuID] += clampInt32(item.Qty)
	}

	uniqueSkuIDs := uniqueUUIDs(skuIDs)
	skus, err := h.CatalogStore.ListSkusByIDs(c.Request.Context(), uniqueSkuIDs)
	if err != nil {
		h.logError("list skus failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to submit order")
		return
	}
	if len(skus) != len(uniqueSkuIDs) {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid skuId")
		return
	}

	tiers, err := h.CatalogStore.ListPriceTiersBySkus(c.Request.Context(), uniqueSkuIDs)
	if err != nil {
		h.logError("list price tiers failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to submit order")
		return
	}

	tiersBySku := map[uuid.UUID][]db.CatalogPriceTier{}
	for _, tier := range tiers {
		tiersBySku[tier.SkuID] = append(tiersBySku[tier.SkuID], tier)
	}

	orderItems := make([]struct {
		sku          db.CatalogSku
		qty          int32
		unitPriceFen sharedmoney.Fen
	}, 0, len(skus))
	for _, sku := range skus {
		qty := qtyBySku[sku.ID]
		if !sku.IsActive {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "sku is inactive")
			return
		}
		priceFen, ok := selectUnitPrice(tiersBySku[sku.ID], qty)
		if !ok {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "price tier not found")
			return
		}
		orderItems = append(orderItems, struct {
			sku          db.CatalogSku
			qty          int32
			unitPriceFen sharedmoney.Fen
		}{
			sku:          sku,
			qty:          qty,
			unitPriceFen: priceFen,
		})
	}

	addressJSON, err := json.Marshal(request.Address)
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid address")
		return
	}
	if h.DB == nil {
		h.logError("create order failed", errors.New("db pool is nil"))
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to submit order")
		return
	}

	ctx := c.Request.Context()
	var order db.Order
	ownerSalesUserID := pgtype.UUID{}
	if strings.ToUpper(claims.Role) == "CUSTOMER" && claims.OwnerSalesUserID != uuid.Nil {
		ownerSalesUserID = pgtype.UUID{Bytes: claims.OwnerSalesUserID, Valid: true}
	}
	err = shareddb.WithTx(ctx, h.DB, func(tx pgx.Tx) error {
		q := db.New(tx)
		var err error
		order, err = q.CreateOrder(ctx, db.CreateOrderParams{
			Status:           string(oapi.OrderStatusSUBMITTED),
			CustomerID:       claims.UserID,
			OwnerSalesUserID: ownerSalesUserID,
			Address:          addressJSON,
			Remark:           request.Remark,
			IdempotencyKey:   params.IdempotencyKey,
		})
		if err != nil {
			return err
		}
		for _, item := range orderItems {
			if _, err := q.CreateOrderItem(ctx, db.CreateOrderItemParams{
				OrderID:      order.ID,
				SkuID:        item.sku.ID,
				Qty:          item.qty,
				UnitPriceFen: item.unitPriceFen.Int64(),
			}); err != nil {
				return err
			}
		}
		if err := q.DeleteCartItemsBySkuIDs(ctx, db.DeleteCartItemsBySkuIDsParams{
			OwnerUserID: claims.UserID,
			SkuIds:      uniqueSkuIDs,
		}); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		if shareddb.IsUniqueViolation(err) && params.IdempotencyKey != nil {
			h.logError("idempotency key conflict", err)
			var details map[string]interface{}
			if existing, lookupErr := h.OrderStore.GetOrderByIdempotencyKey(c.Request.Context(), db.GetOrderByIdempotencyKeyParams{
				CustomerID:     claims.UserID,
				IdempotencyKey: params.IdempotencyKey,
			}); lookupErr == nil {
				details = map[string]interface{}{
					"orderId": existing.ID,
				}
			}
			h.writeErrorWithDetails(c, http.StatusConflict, "conflict", "duplicate idempotency key", details)
			return
		}
		h.logError("create order failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to submit order")
		return
	}

	items := make([]oapi.OrderItem, 0, len(orderItems))
	for _, item := range orderItems {
		mapped, err := skuFromModel(item.sku, tiersBySku[item.sku.ID])
		if err != nil {
			h.logError("map sku failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to submit order")
			return
		}
		items = append(items, oapi.OrderItem{
			Sku:          mapped,
			Qty:          int(item.qty),
			UnitPriceFen: item.unitPriceFen.Int64(),
		})
	}

	response, err := orderFromModel(order, items)
	if err != nil {
		h.logError("map order failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to submit order")
		return
	}

	c.JSON(http.StatusCreated, response)
}

func (h *Handler) GetOrders(c *gin.Context, params oapi.GetOrdersParams) {
	claims, ok := h.requireRole(c, "CUSTOMER", "SALES", "PROCUREMENT", "CS", "ADMIN")
	if !ok {
		return
	}

	page := 1
	pageSize := 20
	if params.Page != nil && *params.Page > 0 {
		page = *params.Page
	}
	if params.PageSize != nil && *params.PageSize > 0 {
		pageSize = *params.PageSize
	}
	if pageSize > 100 {
		pageSize = 100
	}
	offset := (page - 1) * pageSize

	customerFilter := pgtype.UUID{}
	ownerFilter := pgtype.UUID{}
	role := strings.ToUpper(claims.Role)
	switch role {
	case "CUSTOMER":
		customerFilter = pgtype.UUID{Bytes: claims.UserID, Valid: true}
	case "SALES":
		ownerFilter = pgtype.UUID{Bytes: claims.UserID, Valid: true}
		if params.CustomerId != nil {
			customerFilter = pgtype.UUID{Bytes: uuid.UUID(*params.CustomerId), Valid: true}
		}
	case "PROCUREMENT", "CS", "ADMIN":
		if params.CustomerId != nil {
			customerFilter = pgtype.UUID{Bytes: uuid.UUID(*params.CustomerId), Valid: true}
		}
		if params.OwnerSalesUserId != nil {
			ownerFilter = pgtype.UUID{Bytes: uuid.UUID(*params.OwnerSalesUserId), Valid: true}
		}
	}

	var status *string
	if params.Status != nil {
		value := string(*params.Status)
		status = &value
	}

	orders, err := h.OrderStore.ListOrders(c.Request.Context(), db.ListOrdersParams{
		CustomerID:       customerFilter,
		OwnerSalesUserID: ownerFilter,
		Status:           status,
		Offset:           clampInt32(offset),
		Limit:            clampInt32(pageSize),
	})
	if err != nil {
		h.logError("list orders failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list orders")
		return
	}

	total, err := h.OrderStore.CountOrders(c.Request.Context(), db.CountOrdersParams{
		CustomerID:       customerFilter,
		OwnerSalesUserID: ownerFilter,
		Status:           status,
	})
	if err != nil {
		h.logError("count orders failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list orders")
		return
	}

	orderItems := make(map[uuid.UUID][]db.OrderItem, len(orders))
	allSkuIDs := make([]uuid.UUID, 0)
	for _, order := range orders {
		items, err := h.OrderStore.ListOrderItems(c.Request.Context(), order.ID)
		if err != nil {
			h.logError("list order items failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list orders")
			return
		}
		orderItems[order.ID] = items
		for _, item := range items {
			allSkuIDs = append(allSkuIDs, item.SkuID)
		}
	}

	skuMap, err := h.loadSkusWithTiers(c.Request.Context(), allSkuIDs)
	if err != nil {
		h.logError("load skus failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list orders")
		return
	}

	items := make([]oapi.Order, 0, len(orders))
	for _, order := range orders {
		mappedItems, err := mapOrderItems(orderItems[order.ID], skuMap)
		if err != nil {
			h.logError("map order items failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list orders")
			return
		}
		mapped, err := orderFromModel(order, mappedItems)
		if err != nil {
			h.logError("map order failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list orders")
			return
		}
		items = append(items, mapped)
	}

	c.JSON(http.StatusOK, oapi.PagedOrderList{
		Items:    items,
		Page:     page,
		PageSize: pageSize,
		Total:    int(total),
	})
}

func (h *Handler) GetOrdersOrderId(c *gin.Context, orderId types.UUID) {
	claims, ok := h.requireRole(c, "CUSTOMER", "SALES", "PROCUREMENT", "CS", "ADMIN")
	if !ok {
		return
	}

	order, err := h.OrderStore.GetOrder(c.Request.Context(), uuid.UUID(orderId))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "order not found")
			return
		}
		h.logError("get order failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch order")
		return
	}
	switch strings.ToUpper(claims.Role) {
	case "CUSTOMER":
		if order.CustomerID != claims.UserID {
			h.writeError(c, http.StatusNotFound, "not_found", "order not found")
			return
		}
	case "SALES":
		if !order.OwnerSalesUserID.Valid || order.OwnerSalesUserID.Bytes != claims.UserID {
			h.writeError(c, http.StatusNotFound, "not_found", "order not found")
			return
		}
	}

	orderItems, err := h.OrderStore.ListOrderItems(c.Request.Context(), order.ID)
	if err != nil {
		h.logError("list order items failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch order")
		return
	}

	skuIDs := make([]uuid.UUID, 0, len(orderItems))
	for _, item := range orderItems {
		skuIDs = append(skuIDs, item.SkuID)
	}

	skuMap, err := h.loadSkusWithTiers(c.Request.Context(), skuIDs)
	if err != nil {
		h.logError("load skus failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch order")
		return
	}

	mappedItems, err := mapOrderItems(orderItems, skuMap)
	if err != nil {
		h.logError("map order items failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch order")
		return
	}

	response, err := orderFromModel(order, mappedItems)
	if err != nil {
		h.logError("map order failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch order")
		return
	}

	c.JSON(http.StatusOK, response)
}

func mapOrderItems(items []db.OrderItem, skuMap map[uuid.UUID]oapi.SKU) ([]oapi.OrderItem, error) {
	mapped := make([]oapi.OrderItem, 0, len(items))
	for _, item := range items {
		sku, ok := skuMap[item.SkuID]
		if !ok {
			return nil, errors.New("sku not found")
		}
		unitPrice := sharedmoney.FromInt64(item.UnitPriceFen)
		mapped = append(mapped, oapi.OrderItem{
			Sku:          sku,
			Qty:          int(item.Qty),
			UnitPriceFen: unitPrice.Int64(),
		})
	}
	return mapped, nil
}

func orderFromModel(order db.Order, items []oapi.OrderItem) (oapi.Order, error) {
	var address oapi.Address
	if len(order.Address) > 0 {
		if err := json.Unmarshal(order.Address, &address); err != nil {
			return oapi.Order{}, err
		}
	}

	response := oapi.Order{
		Id:        order.ID,
		Status:    oapi.OrderStatus(order.Status),
		Items:     items,
		CreatedAt: order.CreatedAt.Time,
		UpdatedAt: timeFromTimestamptz(order.UpdatedAt),
	}
	if len(order.Address) > 0 {
		response.Address = &address
	}
	if order.Remark != nil {
		response.Remark = order.Remark
	}
	return response, nil
}

func selectUnitPrice(tiers []db.CatalogPriceTier, qty int32) (sharedmoney.Fen, bool) {
	var selected *db.CatalogPriceTier
	for i := range tiers {
		tier := tiers[i]
		if qty < tier.MinQty {
			continue
		}
		if tier.MaxQty != nil && qty > *tier.MaxQty {
			continue
		}
		selected = &tier
	}
	if selected == nil {
		return sharedmoney.Zero, false
	}
	return sharedmoney.FromInt64(selected.UnitPriceFen), true
}
