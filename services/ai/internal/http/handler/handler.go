package handler

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"

	apierrors "github.com/teamdsb/tmo/packages/go-shared/errors"
	"github.com/teamdsb/tmo/packages/go-shared/httpx"
	"github.com/teamdsb/tmo/services/ai/internal/commerce"
	"github.com/teamdsb/tmo/services/ai/internal/http/middleware"
	"github.com/teamdsb/tmo/services/ai/internal/http/oapi"
	"github.com/teamdsb/tmo/services/ai/internal/knowledge"
	"github.com/teamdsb/tmo/services/ai/internal/provider"
)

type CommerceClient interface {
	GetAfterSalesTicket(ctx context.Context, authHeader string, ticketID uuid.UUID, requestID string) (commerce.AfterSalesTicket, error)
	ListAfterSalesMessages(ctx context.Context, authHeader string, ticketID uuid.UUID, requestID string) ([]commerce.AfterSalesMessage, error)
}

type KnowledgeBase interface {
	Search(query string, limit int) knowledge.SearchResult
}

type SuggestionProvider interface {
	Suggest(ctx context.Context, input provider.SuggestionInput) ([]string, error)
}

type Handler struct {
	Logger      *slog.Logger
	Auth        *middleware.Authenticator
	Commerce    CommerceClient
	Knowledge   KnowledgeBase
	Suggestions SuggestionProvider
}

func (h *Handler) PostAiAfterSalesSuggestions(c *gin.Context) {
	if _, ok := h.requireRole(c, "CUSTOMER", "SALES", "CS", "MANAGER", "BOSS", "ADMIN"); !ok {
		return
	}

	var request oapi.AIReplySuggestionRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	ticketID := uuid.UUID(request.TicketId)
	if ticketID == uuid.Nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "ticketId is required")
		return
	}

	authHeader := c.GetHeader("Authorization")
	requestID := httpx.RequestIDFromContext(c)

	ticket, err := h.Commerce.GetAfterSalesTicket(c.Request.Context(), authHeader, ticketID, requestID)
	if err != nil {
		h.writeCommerceError(c, err, "after-sales ticket not found")
		return
	}

	messages, err := h.Commerce.ListAfterSalesMessages(c.Request.Context(), authHeader, ticketID, requestID)
	if err != nil {
		h.writeCommerceError(c, err, "failed to fetch after-sales messages")
		return
	}

	truncatedMessages, err := trimMessages(messages, request.LatestMessageId)
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}

	searchQuery := buildSearchQuery(ticket, truncatedMessages)
	searchResult := h.Knowledge.Search(searchQuery, 3)

	suggestions, err := h.Suggestions.Suggest(c.Request.Context(), provider.SuggestionInput{
		Ticket:    ticket,
		Messages:  truncatedMessages,
		Knowledge: searchResult,
	})
	if err != nil {
		h.logError("generate ai suggestions failed", err)
		h.writeError(c, http.StatusServiceUnavailable, "ai_provider_unavailable", "ai provider unavailable")
		return
	}
	if len(suggestions) == 0 {
		h.writeError(c, http.StatusServiceUnavailable, "ai_provider_unavailable", "ai provider unavailable")
		return
	}

	c.JSON(http.StatusOK, oapi.AIReplySuggestions{
		TicketId:    request.TicketId,
		Suggestions: suggestions,
		GeneratedAt: time.Now().UTC(),
	})
}

func (h *Handler) requireRole(c *gin.Context, roles ...string) (middleware.Claims, bool) {
	if h.Auth == nil {
		return middleware.Claims{}, true
	}
	return h.Auth.RequireRole(c, roles...)
}

func (h *Handler) writeCommerceError(c *gin.Context, err error, notFoundMessage string) {
	var requestErr *commerce.RequestError
	if errors.As(err, &requestErr) {
		switch requestErr.StatusCode {
		case http.StatusNotFound:
			h.writeError(c, http.StatusNotFound, "ticket_not_found", notFoundMessage)
			return
		case http.StatusUnauthorized:
			h.writeError(c, http.StatusUnauthorized, "unauthorized", "missing or invalid authorization")
			return
		case http.StatusForbidden:
			h.writeError(c, http.StatusForbidden, "forbidden", "permission denied")
			return
		default:
			h.writeError(c, http.StatusBadGateway, "commerce_unavailable", "commerce upstream unavailable")
			return
		}
	}

	h.logError("commerce upstream request failed", err)
	h.writeError(c, http.StatusBadGateway, "commerce_unavailable", "commerce upstream unavailable")
}

func (h *Handler) writeError(c *gin.Context, status int, code, message string) {
	apierrors.Write(c, status, apierrors.APIError{
		Code:    code,
		Message: message,
	})
}

func (h *Handler) logError(message string, err error) {
	if h.Logger == nil || err == nil {
		return
	}
	h.Logger.Error(message, "error", err)
}

func trimMessages(messages []commerce.AfterSalesMessage, latestMessageID *openapi_types.UUID) ([]commerce.AfterSalesMessage, error) {
	if latestMessageID == nil {
		return messages, nil
	}

	target := uuid.UUID(*latestMessageID)
	for idx, message := range messages {
		if message.ID == target {
			return messages[:idx+1], nil
		}
	}

	return nil, errors.New("latestMessageId not found in ticket")
}

func buildSearchQuery(ticket commerce.AfterSalesTicket, messages []commerce.AfterSalesMessage) string {
	parts := []string{ticket.Subject, ticket.Description}
	for _, message := range messages {
		if content := strings.TrimSpace(message.Content); content != "" {
			parts = append(parts, content)
		}
	}
	return strings.Join(parts, " ")
}
