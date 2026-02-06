package handler

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/oapi-codegen/runtime/types"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/http/oapi"
)

func (h *Handler) GetInquiriesPrice(c *gin.Context, params oapi.GetInquiriesPriceParams) {
	claims, ok := h.requireRole(c, "CUSTOMER", "SALES", "CS", "ADMIN")
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

	role := strings.ToUpper(claims.Role)
	createdByFilter := pgtype.UUID{}
	ownerSalesFilter := pgtype.UUID{}
	switch role {
	case "CUSTOMER":
		createdByFilter = pgtype.UUID{Bytes: claims.UserID, Valid: true}
	case "SALES":
		ownerSalesFilter = pgtype.UUID{Bytes: claims.UserID, Valid: true}
	}

	var status *string
	if params.Status != nil {
		value := string(*params.Status)
		status = &value
	}

	inquiries, err := h.InquiryStore.ListPriceInquiries(c.Request.Context(), db.ListPriceInquiriesParams{
		CreatedByUserID:  createdByFilter,
		OwnerSalesUserID: ownerSalesFilter,
		Status:           status,
		Offset:           clampInt32(offset),
		Limit:            clampInt32(pageSize),
	})
	if err != nil {
		h.logError("list price inquiries failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list inquiries")
		return
	}

	total, err := h.InquiryStore.CountPriceInquiries(c.Request.Context(), db.CountPriceInquiriesParams{
		CreatedByUserID:  createdByFilter,
		OwnerSalesUserID: ownerSalesFilter,
		Status:           status,
	})
	if err != nil {
		h.logError("count price inquiries failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list inquiries")
		return
	}

	items := make([]oapi.PriceInquiry, 0, len(inquiries))
	for _, inquiry := range inquiries {
		items = append(items, priceInquiryFromModel(inquiry))
	}

	c.JSON(http.StatusOK, oapi.PagedPriceInquiryList{
		Items:    items,
		Page:     page,
		PageSize: pageSize,
		Total:    int(total),
	})
}

func (h *Handler) PostInquiriesPrice(c *gin.Context) {
	claims, ok := h.requireRole(c, "CUSTOMER", "ADMIN")
	if !ok {
		return
	}

	var request oapi.CreatePriceInquiry
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}
	if strings.TrimSpace(request.Message) == "" {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "message is required")
		return
	}

	orderID := pgtype.UUID{}
	assignedSales := pgtype.UUID{}
	ownerSales := pgtype.UUID{}
	if request.OrderId != nil {
		value := uuid.UUID(*request.OrderId)
		order, err := h.OrderStore.GetOrder(c.Request.Context(), value)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				h.writeError(c, http.StatusNotFound, "not_found", "order not found")
				return
			}
			h.logError("get order failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to create inquiry")
			return
		}
		if strings.EqualFold(claims.Role, "CUSTOMER") && order.CustomerID != claims.UserID {
			h.writeError(c, http.StatusNotFound, "not_found", "order not found")
			return
		}
		orderID = pgtype.UUID{Bytes: value, Valid: true}
		if order.OwnerSalesUserID.Valid {
			ownerSales = order.OwnerSalesUserID
			assignedSales = order.OwnerSalesUserID
		}
	}

	skuID := pgtype.UUID{}
	if request.SkuId != nil {
		value := uuid.UUID(*request.SkuId)
		skus, err := h.CatalogStore.ListSkusByIDs(c.Request.Context(), []uuid.UUID{value})
		if err != nil {
			h.logError("list skus failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to create inquiry")
			return
		}
		if len(skus) == 0 {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid skuId")
			return
		}
		if !skus[0].IsActive {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "sku is inactive")
			return
		}
		skuID = pgtype.UUID{Bytes: value, Valid: true}
	}

	if !ownerSales.Valid && strings.EqualFold(claims.Role, "CUSTOMER") && claims.OwnerSalesUserID != uuid.Nil {
		ownerSales = pgtype.UUID{Bytes: claims.OwnerSalesUserID, Valid: true}
		assignedSales = ownerSales
	}

	inquiry, err := h.InquiryStore.CreatePriceInquiry(c.Request.Context(), db.CreatePriceInquiryParams{
		CreatedByUserID:     claims.UserID,
		OwnerSalesUserID:    ownerSales,
		AssignedSalesUserID: assignedSales,
		SkuID:               skuID,
		OrderID:             orderID,
		Message:             request.Message,
		Status:              string(oapi.PriceInquiryStatusOPEN),
		ResponseNote:        nil,
	})
	if err != nil {
		h.logError("create price inquiry failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to create inquiry")
		return
	}

	c.JSON(http.StatusCreated, priceInquiryFromModel(inquiry))
}

func (h *Handler) GetInquiriesPriceInquiryId(c *gin.Context, inquiryId types.UUID) {
	claims, ok := h.requireRole(c, "CUSTOMER", "SALES", "CS", "ADMIN")
	if !ok {
		return
	}

	inquiry, err := h.InquiryStore.GetPriceInquiry(c.Request.Context(), uuid.UUID(inquiryId))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "inquiry not found")
			return
		}
		h.logError("get price inquiry failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch inquiry")
		return
	}

	if !canAccessPriceInquiry(claims.Role, claims.UserID, inquiry) {
		h.writeError(c, http.StatusNotFound, "not_found", "inquiry not found")
		return
	}

	c.JSON(http.StatusOK, priceInquiryFromModel(inquiry))
}

func (h *Handler) PatchInquiriesPriceInquiryId(c *gin.Context, inquiryId types.UUID) {
	claims, ok := h.requireRole(c, "SALES", "CS", "ADMIN")
	if !ok {
		return
	}

	var payload oapi.UpdatePriceInquiryRequest
	fields, err := decodeJSONFields(c, &payload)
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	statusSet := hasJSONField(fields, "status")
	assignedSet := hasJSONField(fields, "assignedSalesUserId")
	responseNoteSet := hasJSONField(fields, "responseNote")
	if !statusSet && !assignedSet && !responseNoteSet {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "no fields to update")
		return
	}

	inquiry, err := h.InquiryStore.GetPriceInquiry(c.Request.Context(), uuid.UUID(inquiryId))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "inquiry not found")
			return
		}
		h.logError("get price inquiry failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to update inquiry")
		return
	}

	if strings.EqualFold(claims.Role, "SALES") && !canAccessPriceInquiry(claims.Role, claims.UserID, inquiry) {
		h.writeError(c, http.StatusNotFound, "not_found", "inquiry not found")
		return
	}

	var status *string
	if payload.Status != nil {
		value := string(*payload.Status)
		status = &value
	}

	assigned := pgtype.UUID{}
	if payload.AssignedSalesUserId != nil {
		assigned = pgtype.UUID{Bytes: uuid.UUID(*payload.AssignedSalesUserId), Valid: true}
	}

	updated, err := h.InquiryStore.UpdatePriceInquiry(c.Request.Context(), db.UpdatePriceInquiryParams{
		ID:                     uuid.UUID(inquiryId),
		Status:                 status,
		AssignedSalesUserID:    assigned,
		AssignedSalesUserIDSet: assignedSet,
		ResponseNote:           payload.ResponseNote,
		ResponseNoteSet:        responseNoteSet,
	})
	if err != nil {
		h.logError("update price inquiry failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to update inquiry")
		return
	}

	c.JSON(http.StatusOK, priceInquiryFromModel(updated))
}

func (h *Handler) GetInquiriesPriceInquiryIdMessages(
	c *gin.Context,
	inquiryId types.UUID,
	params oapi.GetInquiriesPriceInquiryIdMessagesParams,
) {
	claims, ok := h.requireRole(c, "CUSTOMER", "SALES", "CS", "ADMIN")
	if !ok {
		return
	}

	inquiry, err := h.InquiryStore.GetPriceInquiry(c.Request.Context(), uuid.UUID(inquiryId))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "inquiry not found")
			return
		}
		h.logError("get price inquiry failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch messages")
		return
	}

	if !canAccessPriceInquiry(claims.Role, claims.UserID, inquiry) {
		h.writeError(c, http.StatusNotFound, "not_found", "inquiry not found")
		return
	}

	page := 1
	pageSize := 50
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

	messages, err := h.InquiryStore.ListInquiryMessages(c.Request.Context(), db.ListInquiryMessagesParams{
		InquiryID: uuid.UUID(inquiryId),
		Offset:    clampInt32(offset),
		Limit:     clampInt32(pageSize),
	})
	if err != nil {
		h.logError("list inquiry messages failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch messages")
		return
	}

	total, err := h.InquiryStore.CountInquiryMessages(c.Request.Context(), uuid.UUID(inquiryId))
	if err != nil {
		h.logError("count inquiry messages failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch messages")
		return
	}

	items := make([]oapi.InquiryMessage, 0, len(messages))
	for _, message := range messages {
		items = append(items, inquiryMessageFromModel(message))
	}

	c.JSON(http.StatusOK, oapi.PagedInquiryMessageList{
		Items:    items,
		Page:     page,
		PageSize: pageSize,
		Total:    int(total),
	})
}

func (h *Handler) PostInquiriesPriceInquiryIdMessages(c *gin.Context, inquiryId types.UUID) {
	claims, ok := h.requireRole(c, "CUSTOMER", "SALES", "CS", "ADMIN")
	if !ok {
		return
	}

	var request oapi.CreateInquiryMessage
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}
	if strings.TrimSpace(request.Content) == "" {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "content is required")
		return
	}

	inquiry, err := h.InquiryStore.GetPriceInquiry(c.Request.Context(), uuid.UUID(inquiryId))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "inquiry not found")
			return
		}
		h.logError("get price inquiry failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to create message")
		return
	}

	if !canAccessPriceInquiry(claims.Role, claims.UserID, inquiry) {
		h.writeError(c, http.StatusNotFound, "not_found", "inquiry not found")
		return
	}

	senderType := oapi.Staff
	if strings.EqualFold(claims.Role, "CUSTOMER") {
		senderType = oapi.Customer
	}

	message, err := h.InquiryStore.CreateInquiryMessage(c.Request.Context(), db.CreateInquiryMessageParams{
		InquiryID:    uuid.UUID(inquiryId),
		SenderType:   string(senderType),
		SenderUserID: pgtype.UUID{Bytes: claims.UserID, Valid: true},
		Content:      request.Content,
	})
	if err != nil {
		h.logError("create inquiry message failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to create message")
		return
	}

	c.JSON(http.StatusCreated, inquiryMessageFromModel(message))
}

func priceInquiryFromModel(inquiry db.PriceInquiry) oapi.PriceInquiry {
	response := oapi.PriceInquiry{
		Id:              inquiry.ID,
		CreatedByUserId: inquiry.CreatedByUserID,
		Message:         inquiry.Message,
		Status:          oapi.PriceInquiryStatus(inquiry.Status),
		CreatedAt:       inquiry.CreatedAt.Time,
		UpdatedAt:       timeFromTimestamptz(inquiry.UpdatedAt),
	}
	if inquiry.AssignedSalesUserID.Valid {
		value := types.UUID(inquiry.AssignedSalesUserID.Bytes)
		response.AssignedSalesUserId = &value
	}
	if inquiry.SkuID.Valid {
		value := types.UUID(inquiry.SkuID.Bytes)
		response.SkuId = &value
	}
	if inquiry.OrderID.Valid {
		value := types.UUID(inquiry.OrderID.Bytes)
		response.OrderId = &value
	}
	if inquiry.ResponseNote != nil {
		response.ResponseNote = inquiry.ResponseNote
	}
	return response
}

func inquiryMessageFromModel(message db.InquiryMessage) oapi.InquiryMessage {
	response := oapi.InquiryMessage{
		Id:         message.ID,
		InquiryId:  message.InquiryID,
		SenderType: oapi.MessageSenderType(message.SenderType),
		Content:    message.Content,
		CreatedAt:  message.CreatedAt.Time,
	}
	if message.SenderUserID.Valid {
		value := types.UUID(message.SenderUserID.Bytes)
		response.SenderUserId = &value
	}
	return response
}

func canAccessPriceInquiry(role string, userID uuid.UUID, inquiry db.PriceInquiry) bool {
	switch strings.ToUpper(role) {
	case "CUSTOMER":
		return inquiry.CreatedByUserID == userID
	case "SALES":
		if inquiry.OwnerSalesUserID.Valid && inquiry.OwnerSalesUserID.Bytes == userID {
			return true
		}
		return inquiry.AssignedSalesUserID.Valid && inquiry.AssignedSalesUserID.Bytes == userID
	default:
		return true
	}
}
