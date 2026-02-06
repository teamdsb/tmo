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

func (h *Handler) GetAfterSalesTickets(c *gin.Context, params oapi.GetAfterSalesTicketsParams) {
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

	createdByFilter := pgtype.UUID{}
	ownerSalesFilter := pgtype.UUID{}
	role := strings.ToUpper(claims.Role)
	switch role {
	case "CUSTOMER":
		createdByFilter = pgtype.UUID{Bytes: claims.UserID, Valid: true}
	case "SALES":
		ownerSalesFilter = pgtype.UUID{Bytes: claims.UserID, Valid: true}
	}

	status := (*string)(nil)
	if params.Status != nil {
		value := string(*params.Status)
		status = &value
	}

	orderFilter := pgtype.UUID{}
	if params.OrderId != nil {
		orderFilter = pgtype.UUID{Bytes: uuid.UUID(*params.OrderId), Valid: true}
	}

	tickets, err := h.AfterSalesStore.ListAfterSalesTickets(c.Request.Context(), db.ListAfterSalesTicketsParams{
		CreatedByUserID:  createdByFilter,
		OwnerSalesUserID: ownerSalesFilter,
		Status:           status,
		OrderID:          orderFilter,
		Offset:           clampInt32(offset),
		Limit:            clampInt32(pageSize),
	})
	if err != nil {
		h.logError("list after sales tickets failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list after-sales tickets")
		return
	}

	total, err := h.AfterSalesStore.CountAfterSalesTickets(c.Request.Context(), db.CountAfterSalesTicketsParams{
		CreatedByUserID:  createdByFilter,
		OwnerSalesUserID: ownerSalesFilter,
		Status:           status,
		OrderID:          orderFilter,
	})
	if err != nil {
		h.logError("count after sales tickets failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list after-sales tickets")
		return
	}

	items := make([]oapi.AfterSalesTicket, 0, len(tickets))
	for _, ticket := range tickets {
		items = append(items, afterSalesTicketFromModel(ticket))
	}

	c.JSON(http.StatusOK, oapi.PagedAfterSalesTicketList{
		Items:    items,
		Page:     page,
		PageSize: pageSize,
		Total:    int(total),
	})
}

func (h *Handler) PostAfterSalesTickets(c *gin.Context) {
	claims, ok := h.requireRole(c, "CUSTOMER", "ADMIN")
	if !ok {
		return
	}

	var request oapi.CreateAfterSalesTicket
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}
	if strings.TrimSpace(request.Subject) == "" {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "subject is required")
		return
	}
	if strings.TrimSpace(request.Description) == "" {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "description is required")
		return
	}

	orderID := pgtype.UUID{}
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
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to create after-sales ticket")
			return
		}
		if strings.EqualFold(claims.Role, "CUSTOMER") && order.CustomerID != claims.UserID {
			h.writeError(c, http.StatusNotFound, "not_found", "order not found")
			return
		}
		orderID = pgtype.UUID{Bytes: value, Valid: true}
		if order.OwnerSalesUserID.Valid {
			ownerSales = order.OwnerSalesUserID
		}
	}

	if !ownerSales.Valid && strings.EqualFold(claims.Role, "CUSTOMER") && claims.OwnerSalesUserID != uuid.Nil {
		ownerSales = pgtype.UUID{Bytes: claims.OwnerSalesUserID, Valid: true}
	}

	ticket, err := h.AfterSalesStore.CreateAfterSalesTicket(c.Request.Context(), db.CreateAfterSalesTicketParams{
		Status:              string(oapi.TicketStatusOPEN),
		OrderID:             orderID,
		CreatedByUserID:     claims.UserID,
		OwnerSalesUserID:    ownerSales,
		AssignedStaffUserID: pgtype.UUID{},
		Subject:             request.Subject,
		Description:         request.Description,
		Attachments:         derefStringSlice(request.Attachments),
	})
	if err != nil {
		h.logError("create after sales ticket failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to create after-sales ticket")
		return
	}

	c.JSON(http.StatusCreated, afterSalesTicketFromModel(ticket))
}

func (h *Handler) GetAfterSalesTicketsTicketId(c *gin.Context, ticketId types.UUID) {
	claims, ok := h.requireRole(c, "CUSTOMER", "SALES", "CS", "ADMIN")
	if !ok {
		return
	}

	ticket, err := h.AfterSalesStore.GetAfterSalesTicket(c.Request.Context(), uuid.UUID(ticketId))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "after-sales ticket not found")
			return
		}
		h.logError("get after sales ticket failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch after-sales ticket")
		return
	}

	if !canAccessAfterSalesTicket(claims.Role, claims.UserID, ticket) {
		h.writeError(c, http.StatusNotFound, "not_found", "after-sales ticket not found")
		return
	}

	c.JSON(http.StatusOK, afterSalesTicketFromModel(ticket))
}

func (h *Handler) PatchAfterSalesTicketsTicketId(c *gin.Context, ticketId types.UUID) {
	claims, ok := h.requireRole(c, "SALES", "CS", "ADMIN")
	if !ok {
		return
	}

	var payload oapi.UpdateAfterSalesTicketRequest
	fields, err := decodeJSONFields(c, &payload)
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	statusSet := hasJSONField(fields, "status")
	assignedSet := hasJSONField(fields, "assignedStaffUserId")
	if !statusSet && !assignedSet {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "no fields to update")
		return
	}

	ticket, err := h.AfterSalesStore.GetAfterSalesTicket(c.Request.Context(), uuid.UUID(ticketId))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "after-sales ticket not found")
			return
		}
		h.logError("get after sales ticket failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to update after-sales ticket")
		return
	}

	if strings.EqualFold(claims.Role, "SALES") && !canAccessAfterSalesTicket(claims.Role, claims.UserID, ticket) {
		h.writeError(c, http.StatusNotFound, "not_found", "after-sales ticket not found")
		return
	}

	var status *string
	if payload.Status != nil {
		value := string(*payload.Status)
		status = &value
	}

	assigned := pgtype.UUID{}
	if payload.AssignedStaffUserId != nil {
		assigned = pgtype.UUID{Bytes: uuid.UUID(*payload.AssignedStaffUserId), Valid: true}
	}

	updated, err := h.AfterSalesStore.UpdateAfterSalesTicket(c.Request.Context(), db.UpdateAfterSalesTicketParams{
		ID:                     uuid.UUID(ticketId),
		Status:                 status,
		AssignedStaffUserID:    assigned,
		AssignedStaffUserIDSet: assignedSet,
	})
	if err != nil {
		h.logError("update after sales ticket failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to update after-sales ticket")
		return
	}

	c.JSON(http.StatusOK, afterSalesTicketFromModel(updated))
}

func (h *Handler) GetAfterSalesTicketsTicketIdMessages(
	c *gin.Context,
	ticketId types.UUID,
	params oapi.GetAfterSalesTicketsTicketIdMessagesParams,
) {
	claims, ok := h.requireRole(c, "CUSTOMER", "SALES", "CS", "ADMIN")
	if !ok {
		return
	}

	ticket, err := h.AfterSalesStore.GetAfterSalesTicket(c.Request.Context(), uuid.UUID(ticketId))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "after-sales ticket not found")
			return
		}
		h.logError("get after sales ticket failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch messages")
		return
	}

	if !canAccessAfterSalesTicket(claims.Role, claims.UserID, ticket) {
		h.writeError(c, http.StatusNotFound, "not_found", "after-sales ticket not found")
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

	messages, err := h.AfterSalesStore.ListAfterSalesMessages(c.Request.Context(), db.ListAfterSalesMessagesParams{
		TicketID: uuid.UUID(ticketId),
		Offset:   clampInt32(offset),
		Limit:    clampInt32(pageSize),
	})
	if err != nil {
		h.logError("list after sales messages failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch messages")
		return
	}

	total, err := h.AfterSalesStore.CountAfterSalesMessages(c.Request.Context(), uuid.UUID(ticketId))
	if err != nil {
		h.logError("count after sales messages failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch messages")
		return
	}

	items := make([]oapi.AfterSalesMessage, 0, len(messages))
	for _, message := range messages {
		items = append(items, afterSalesMessageFromModel(message))
	}

	c.JSON(http.StatusOK, oapi.PagedAfterSalesMessageList{
		Items:    items,
		Page:     page,
		PageSize: pageSize,
		Total:    int(total),
	})
}

func (h *Handler) PostAfterSalesTicketsTicketIdMessages(c *gin.Context, ticketId types.UUID) {
	claims, ok := h.requireRole(c, "CUSTOMER", "SALES", "CS", "ADMIN")
	if !ok {
		return
	}

	var request oapi.CreateTicketMessage
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}
	if strings.TrimSpace(request.Content) == "" {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "content is required")
		return
	}

	ticket, err := h.AfterSalesStore.GetAfterSalesTicket(c.Request.Context(), uuid.UUID(ticketId))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "after-sales ticket not found")
			return
		}
		h.logError("get after sales ticket failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to create message")
		return
	}

	if !canAccessAfterSalesTicket(claims.Role, claims.UserID, ticket) {
		h.writeError(c, http.StatusNotFound, "not_found", "after-sales ticket not found")
		return
	}

	senderType := oapi.Staff
	if strings.EqualFold(claims.Role, "CUSTOMER") {
		senderType = oapi.Customer
	}

	message, err := h.AfterSalesStore.CreateAfterSalesMessage(c.Request.Context(), db.CreateAfterSalesMessageParams{
		TicketID:     uuid.UUID(ticketId),
		SenderType:   string(senderType),
		SenderUserID: pgtype.UUID{Bytes: claims.UserID, Valid: true},
		Content:      request.Content,
	})
	if err != nil {
		h.logError("create after sales message failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to create message")
		return
	}

	c.JSON(http.StatusCreated, afterSalesMessageFromModel(message))
}

func afterSalesTicketFromModel(ticket db.AfterSalesTicket) oapi.AfterSalesTicket {
	response := oapi.AfterSalesTicket{
		Id:          ticket.ID,
		Status:      oapi.TicketStatus(ticket.Status),
		Subject:     ticket.Subject,
		Description: ticket.Description,
		CreatedAt:   ticket.CreatedAt.Time,
		UpdatedAt:   timeFromTimestamptz(ticket.UpdatedAt),
	}
	if ticket.OrderID.Valid {
		value := types.UUID(ticket.OrderID.Bytes)
		response.OrderId = &value
	}
	if ticket.AssignedStaffUserID.Valid {
		value := types.UUID(ticket.AssignedStaffUserID.Bytes)
		response.AssignedStaffUserId = &value
	}
	return response
}

func afterSalesMessageFromModel(message db.AfterSalesMessage) oapi.AfterSalesMessage {
	response := oapi.AfterSalesMessage{
		Id:         message.ID,
		TicketId:   message.TicketID,
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

func canAccessAfterSalesTicket(role string, userID uuid.UUID, ticket db.AfterSalesTicket) bool {
	switch strings.ToUpper(role) {
	case "CUSTOMER":
		return ticket.CreatedByUserID == userID
	case "SALES":
		return ticket.OwnerSalesUserID.Valid && ticket.OwnerSalesUserID.Bytes == userID
	default:
		return true
	}
}
