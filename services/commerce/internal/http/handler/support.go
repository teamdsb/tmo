package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"

	shareddb "github.com/teamdsb/tmo/packages/go-shared/db"
	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/http/middleware"
)

const (
	supportConversationStatusOpenUnassigned = "OPEN_UNASSIGNED"
	supportConversationStatusOpenAssigned   = "OPEN_ASSIGNED"
	supportConversationStatusClosed         = "CLOSED"

	supportSenderTypeCustomer = "CUSTOMER"
	supportSenderTypeStaff    = "STAFF"
	supportSenderTypeSystem   = "SYSTEM"

	supportMessageTypeText        = "TEXT"
	supportMessageTypeImage       = "IMAGE"
	supportMessageTypeOrderCard   = "ORDER_CARD"
	supportMessageTypeProductCard = "PRODUCT_CARD"
	supportMessageTypeSystem      = "SYSTEM"

	maxSupportMessageImageSize int64 = 5 * 1024 * 1024
)

var allowedSupportImageTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

type supportConversationListResponse struct {
	Items    []supportConversationView `json:"items"`
	Page     int                       `json:"page"`
	PageSize int                       `json:"pageSize"`
	Total    int                       `json:"total"`
}

type supportMessageListResponse struct {
	Items    []supportMessageView `json:"items"`
	Page     int                  `json:"page"`
	PageSize int                  `json:"pageSize"`
	Total    int                  `json:"total"`
}

type supportConversationView struct {
	ID                  uuid.UUID  `json:"id"`
	CustomerUserID      uuid.UUID  `json:"customerUserId"`
	CustomerDisplayName *string    `json:"customerDisplayName,omitempty"`
	CustomerPhone       *string    `json:"customerPhone,omitempty"`
	OwnerSalesUserID    *uuid.UUID `json:"ownerSalesUserId,omitempty"`
	AssigneeUserID      *uuid.UUID `json:"assigneeUserId,omitempty"`
	AssigneeRole        *string    `json:"assigneeRole,omitempty"`
	Status              string     `json:"status"`
	LastMessageType     *string    `json:"lastMessageType,omitempty"`
	LastMessagePreview  *string    `json:"lastMessagePreview,omitempty"`
	LastMessageAt       time.Time  `json:"lastMessageAt"`
	CustomerUnreadCount int        `json:"customerUnreadCount"`
	StaffUnreadCount    int        `json:"staffUnreadCount"`
	CreatedAt           time.Time  `json:"createdAt"`
	UpdatedAt           time.Time  `json:"updatedAt"`
	ClosedAt            *time.Time `json:"closedAt,omitempty"`
}

type supportMessageAssetView struct {
	ID          uuid.UUID `json:"id"`
	ContentType string    `json:"contentType"`
	FileName    string    `json:"fileName"`
	FileSize    int64     `json:"fileSize"`
	Url         string    `json:"url"`
	CreatedAt   time.Time `json:"createdAt"`
}

type supportMessageView struct {
	ID             uuid.UUID                `json:"id"`
	ConversationID uuid.UUID                `json:"conversationId"`
	SenderType     string                   `json:"senderType"`
	SenderUserID   *uuid.UUID               `json:"senderUserId,omitempty"`
	SenderRole     *string                  `json:"senderRole,omitempty"`
	MessageType    string                   `json:"messageType"`
	TextContent    *string                  `json:"textContent,omitempty"`
	Asset          *supportMessageAssetView `json:"asset,omitempty"`
	CardPayload    json.RawMessage          `json:"cardPayload,omitempty"`
	CreatedAt      time.Time                `json:"createdAt"`
}

type supportConversationDetailResponse struct {
	Conversation supportConversationView    `json:"conversation"`
	Messages     []supportMessageView       `json:"messages"`
	Context      supportConversationContext `json:"context"`
}

type supportConversationContext struct {
	CustomerUserID   uuid.UUID                  `json:"customerUserId"`
	OwnerSalesUserID *uuid.UUID                 `json:"ownerSalesUserId,omitempty"`
	RecentOrders     []supportOrderSummary      `json:"recentOrders"`
	RecentInquiries  []supportInquirySummary    `json:"recentInquiries"`
	RecentTickets    []supportAfterSalesSummary `json:"recentTickets"`
}

type supportOrderSummary struct {
	ID         uuid.UUID `json:"id"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"createdAt"`
	Remark     *string   `json:"remark,omitempty"`
	FirstItem  *string   `json:"firstItem,omitempty"`
	TotalItems int       `json:"totalItems"`
}

type supportInquirySummary struct {
	ID        uuid.UUID `json:"id"`
	Status    string    `json:"status"`
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"createdAt"`
}

type supportAfterSalesSummary struct {
	ID        uuid.UUID `json:"id"`
	Status    string    `json:"status"`
	Subject   string    `json:"subject"`
	CreatedAt time.Time `json:"createdAt"`
}

type createSupportMessageRequest struct {
	MessageType string          `json:"messageType"`
	Text        *string         `json:"text"`
	AssetID     *uuid.UUID      `json:"assetId"`
	CardPayload json.RawMessage `json:"cardPayload"`
}

type transferSupportConversationRequest struct {
	ToUserID uuid.UUID `json:"toUserId"`
	ToRole   string    `json:"toRole"`
	Note     *string   `json:"note"`
}

func (h *Handler) GetSupportConversationsCurrent(c *gin.Context) {
	claims, ok := h.requireRole(c, "CUSTOMER")
	if !ok {
		return
	}

	conversation, err := h.ensureActiveSupportConversation(c.Request.Context(), claims)
	if err != nil {
		h.logError("ensure support conversation failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to load support conversation")
		return
	}

	c.JSON(http.StatusOK, supportConversationFromModel(conversation))
}

func (h *Handler) GetSupportConversationsConversationIdMessages(c *gin.Context) {
	claims, conversation, ok := h.loadSupportConversationForCommonRoute(c)
	if !ok {
		return
	}

	if !canAccessSupportConversation(claims.Role, claims.UserID, conversation) {
		h.writeError(c, http.StatusNotFound, "not_found", "conversation not found")
		return
	}

	page, pageSize, offset := supportPageParams(c)
	items, total, err := h.listSupportMessages(c.Request.Context(), conversation.ID, offset, pageSize)
	if err != nil {
		h.logError("list support messages failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to load support messages")
		return
	}

	c.JSON(http.StatusOK, supportMessageListResponse{
		Items:    items,
		Page:     page,
		PageSize: pageSize,
		Total:    int(total),
	})
}

func (h *Handler) PostSupportConversationsConversationIdMessages(c *gin.Context) {
	claims, conversation, ok := h.loadSupportConversationForCommonRoute(c)
	if !ok {
		return
	}

	var request createSupportMessageRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	message, conversation, err := h.createSupportMessage(c.Request.Context(), claims, conversation, request)
	if err != nil {
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			h.writeError(c, http.StatusNotFound, "not_found", "conversation not found")
		case strings.Contains(err.Error(), "permission denied"):
			h.writeError(c, http.StatusForbidden, "forbidden", "permission denied")
		case strings.Contains(err.Error(), "invalid request"):
			h.writeError(c, http.StatusBadRequest, "invalid_request", strings.TrimPrefix(err.Error(), "invalid request: "))
		default:
			h.logError("create support message failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to create support message")
		}
		return
	}

	view, err := h.supportMessageView(c.Request.Context(), message)
	if err != nil {
		h.logError("map support message failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to create support message")
		return
	}

	publishSupportEvent(h.SupportHub, "message.created", conversation, gin.H{
		"conversation": supportConversationFromModel(conversation),
		"message":      view,
	})

	c.JSON(http.StatusCreated, view)
}

func (h *Handler) PostSupportConversationsConversationIdMessagesImage(c *gin.Context) {
	claims, conversation, ok := h.loadSupportConversationForCommonRoute(c)
	if !ok {
		return
	}
	if !canAccessSupportConversation(claims.Role, claims.UserID, conversation) {
		h.writeError(c, http.StatusNotFound, "not_found", "conversation not found")
		return
	}

	asset, err := h.uploadSupportMessageAsset(c, claims.UserID, conversation.ID)
	if err != nil {
		switch {
		case strings.Contains(err.Error(), "invalid request"):
			h.writeError(c, http.StatusBadRequest, "invalid_request", strings.TrimPrefix(err.Error(), "invalid request: "))
		default:
			h.logError("upload support asset failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to upload support image")
		}
		return
	}

	c.JSON(http.StatusCreated, supportMessageAssetFromModel(asset))
}

func (h *Handler) PostSupportConversationsConversationIdRead(c *gin.Context) {
	claims, conversation, ok := h.loadSupportConversationForCommonRoute(c)
	if !ok {
		return
	}
	if !canAccessSupportConversation(claims.Role, claims.UserID, conversation) {
		h.writeError(c, http.StatusNotFound, "not_found", "conversation not found")
		return
	}

	var updated db.SupportConversation
	var err error
	if isCustomerRole(claims.Role) {
		updated, err = h.SupportStore.MarkSupportConversationReadForCustomer(c.Request.Context(), conversation.ID)
	} else {
		updated, err = h.SupportStore.MarkSupportConversationReadForStaff(c.Request.Context(), conversation.ID)
	}
	if err != nil {
		h.logError("mark support conversation read failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to update conversation")
		return
	}

	payload := supportConversationFromModel(updated)
	publishSupportEvent(h.SupportHub, "conversation.read", updated, payload)
	c.JSON(http.StatusOK, payload)
}

func (h *Handler) GetAdminSupportConversations(c *gin.Context) {
	claims, ok := h.requireRole(c, "CS", "MANAGER", "BOSS", "ADMIN")
	if !ok {
		return
	}

	page, pageSize, offset := supportPageParams(c)
	scope := strings.ToLower(strings.TrimSpace(c.Query("scope")))
	status := strings.TrimSpace(c.Query("status"))
	statusPtr := nullableString(status)

	params := db.ListSupportConversationsParams{
		Offset: clampInt32(offset),
		Limit:  clampInt32(pageSize),
	}
	countParams := db.CountSupportConversationsParams{}
	if scope == "mine" {
		value := pgtype.UUID{Bytes: claims.UserID, Valid: true}
		params.AssigneeUserID = value
		countParams.AssigneeUserID = value
	}
	if scope == "unassigned" {
		params.UnassignedOnly = true
		countParams.UnassignedOnly = true
	}
	if scope == "unread" {
		params.UnreadOnly = true
		countParams.UnreadOnly = true
	}
	params.Status = statusPtr
	countParams.Status = statusPtr

	items, err := h.SupportStore.ListSupportConversations(c.Request.Context(), params)
	if err != nil {
		h.logError("list support conversations failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list support conversations")
		return
	}
	total, err := h.SupportStore.CountSupportConversations(c.Request.Context(), countParams)
	if err != nil {
		h.logError("count support conversations failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list support conversations")
		return
	}

	responseItems := make([]supportConversationView, 0, len(items))
	for _, item := range items {
		if !canAccessSupportConversation(claims.Role, claims.UserID, item) {
			continue
		}
		responseItems = append(responseItems, supportConversationFromModel(item))
	}

	c.JSON(http.StatusOK, supportConversationListResponse{
		Items:    responseItems,
		Page:     page,
		PageSize: pageSize,
		Total:    int(total),
	})
}

func (h *Handler) GetAdminSupportConversationsConversationId(c *gin.Context) {
	claims, conversation, ok := h.loadSupportConversationForAdminRoute(c)
	if !ok {
		return
	}
	if !canAccessSupportConversation(claims.Role, claims.UserID, conversation) {
		h.writeError(c, http.StatusNotFound, "not_found", "conversation not found")
		return
	}

	messages, _, err := h.listSupportMessages(c.Request.Context(), conversation.ID, 0, 100)
	if err != nil {
		h.logError("list support messages failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to load support conversation")
		return
	}

	contextView, err := h.buildSupportConversationContext(c.Request.Context(), conversation)
	if err != nil {
		h.logError("build support conversation context failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to load support conversation")
		return
	}

	c.JSON(http.StatusOK, supportConversationDetailResponse{
		Conversation: supportConversationFromModel(conversation),
		Messages:     messages,
		Context:      contextView,
	})
}

func (h *Handler) PostAdminSupportConversationsConversationIdClaim(c *gin.Context) {
	claims, conversation, ok := h.loadSupportConversationForAdminRoute(c)
	if !ok {
		return
	}
	if !canAccessSupportConversation(claims.Role, claims.UserID, conversation) {
		h.writeError(c, http.StatusNotFound, "not_found", "conversation not found")
		return
	}

	updated, err := h.SupportStore.ClaimSupportConversation(c.Request.Context(), db.ClaimSupportConversationParams{
		ID:             conversation.ID,
		AssigneeUserID: pgtype.UUID{Bytes: claims.UserID, Valid: true},
		AssigneeRole:   nullableString(strings.ToUpper(claims.Role)),
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusConflict, "conflict", "conversation has already been claimed")
			return
		}
		h.logError("claim support conversation failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to claim conversation")
		return
	}

	payload := supportConversationFromModel(updated)
	publishSupportEvent(h.SupportHub, "conversation.claimed", updated, payload)
	c.JSON(http.StatusOK, payload)
}

func (h *Handler) PostAdminSupportConversationsConversationIdRelease(c *gin.Context) {
	claims, conversation, ok := h.loadSupportConversationForAdminRoute(c)
	if !ok {
		return
	}
	if !canAccessSupportConversation(claims.Role, claims.UserID, conversation) {
		h.writeError(c, http.StatusNotFound, "not_found", "conversation not found")
		return
	}
	if !canManageSupportAssignment(claims.Role, conversation, claims.UserID) {
		h.writeError(c, http.StatusForbidden, "forbidden", "permission denied")
		return
	}

	updated, err := h.SupportStore.ReleaseSupportConversation(c.Request.Context(), conversation.ID)
	if err != nil {
		h.logError("release support conversation failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to release conversation")
		return
	}

	payload := supportConversationFromModel(updated)
	publishSupportEvent(h.SupportHub, "conversation.updated", updated, payload)
	c.JSON(http.StatusOK, payload)
}

func (h *Handler) PostAdminSupportConversationsConversationIdTransfer(c *gin.Context) {
	claims, conversation, ok := h.loadSupportConversationForAdminRoute(c)
	if !ok {
		return
	}
	if !canManageSupportTransfer(claims.Role) {
		h.writeError(c, http.StatusForbidden, "forbidden", "permission denied")
		return
	}

	var request transferSupportConversationRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}
	if request.ToUserID == uuid.Nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "toUserId is required")
		return
	}
	if strings.TrimSpace(request.ToRole) == "" {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "toRole is required")
		return
	}

	updated, err := h.SupportStore.TransferSupportConversation(c.Request.Context(), db.TransferSupportConversationParams{
		ID:             conversation.ID,
		AssigneeUserID: pgtype.UUID{Bytes: request.ToUserID, Valid: true},
		AssigneeRole:   nullableString(strings.ToUpper(request.ToRole)),
	})
	if err != nil {
		h.logError("transfer support conversation failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to transfer conversation")
		return
	}

	fromUser := pgtype.UUID{}
	if conversation.AssigneeUserID.Valid {
		fromUser = conversation.AssigneeUserID
	}
	if _, err := h.SupportStore.CreateSupportConversationTransfer(c.Request.Context(), db.CreateSupportConversationTransferParams{
		ConversationID:  conversation.ID,
		FromUserID:      fromUser,
		FromRole:        nullableString(optionalString(conversation.AssigneeRole)),
		ToUserID:        request.ToUserID,
		ToRole:          strings.ToUpper(request.ToRole),
		Note:            nullableString(optionalString(request.Note)),
		CreatedByUserID: claims.UserID,
	}); err != nil {
		h.logError("create support transfer record failed", err)
	}

	if _, _, err := h.createSupportSystemMessage(c.Request.Context(), updated, fmt.Sprintf("会话已转接给 %s。", strings.ToUpper(request.ToRole))); err != nil {
		h.logError("create support transfer system message failed", err)
	}

	payload := supportConversationFromModel(updated)
	publishSupportEvent(h.SupportHub, "conversation.transferred", updated, payload)
	c.JSON(http.StatusOK, payload)
}

func (h *Handler) ensureActiveSupportConversation(ctx context.Context, claims middleware.Claims) (db.SupportConversation, error) {
	if h.DB == nil {
		return db.SupportConversation{}, errors.New("db pool is nil")
	}
	conversation, err := h.SupportStore.GetActiveSupportConversationByCustomer(ctx, claims.UserID)
	if err == nil {
		if !supportConversationSnapshotNeedsRepair(conversation, claims) {
			return conversation, nil
		}
		return h.updateSupportConversationSnapshot(ctx, conversation, claims)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return db.SupportConversation{}, err
	}

	var created db.SupportConversation
	err = shareddb.WithTx(ctx, h.DB, func(tx pgx.Tx) error {
		queries := db.New(tx)
		existing, getErr := queries.GetActiveSupportConversationByCustomer(ctx, claims.UserID)
		if getErr == nil {
			created = existing
			return nil
		}
		if !errors.Is(getErr, pgx.ErrNoRows) {
			return getErr
		}

		ownerSales := pgtype.UUID{}
		if claims.OwnerSalesUserID != uuid.Nil {
			ownerSales = pgtype.UUID{Bytes: claims.OwnerSalesUserID, Valid: true}
		}
		record, createErr := queries.CreateSupportConversation(ctx, db.CreateSupportConversationParams{
			CustomerUserID:      claims.UserID,
			CustomerDisplayName: nullableTrimmedString(claims.DisplayName),
			CustomerPhone:       nullableTrimmedString(claims.Phone),
			OwnerSalesUserID:    ownerSales,
			Status:              supportConversationStatusOpenUnassigned,
			Column10:            nil,
		})
		if createErr != nil {
			var pgErr *pgconn.PgError
			if errors.As(createErr, &pgErr) && pgErr.Code == "23505" {
				record, getErr = queries.GetActiveSupportConversationByCustomer(ctx, claims.UserID)
				if getErr != nil {
					return getErr
				}
			} else {
				return createErr
			}
		}

		created = record
		if _, _, sysErr := h.createSupportSystemMessageTx(ctx, queries, record, "您好，我是在线客服。请发送文字、图片、订单或商品卡片。"); sysErr != nil {
			return sysErr
		}
		return nil
	})
	return created, err
}

func (h *Handler) updateSupportConversationSnapshot(ctx context.Context, conversation db.SupportConversation, claims middleware.Claims) (db.SupportConversation, error) {
	if h.SupportStore == nil {
		return db.SupportConversation{}, errors.New("support store is nil")
	}
	return h.SupportStore.UpdateSupportConversationCustomerSnapshot(ctx, db.UpdateSupportConversationCustomerSnapshotParams{
		ID:                  conversation.ID,
		CustomerDisplayName: nullableTrimmedString(claims.DisplayName),
		CustomerPhone:       nullableTrimmedString(claims.Phone),
	})
}

func (h *Handler) createSupportMessage(ctx context.Context, claims middleware.Claims, conversation db.SupportConversation, request createSupportMessageRequest) (db.SupportMessage, db.SupportConversation, error) {
	var message db.SupportMessage
	var updatedConversation db.SupportConversation

	if h.DB == nil {
		return message, updatedConversation, errors.New("db pool is nil")
	}

	err := shareddb.WithTx(ctx, h.DB, func(tx pgx.Tx) error {
		queries := db.New(tx)
		current, err := queries.GetSupportConversation(ctx, conversation.ID)
		if err != nil {
			return err
		}
		if !canAccessSupportConversation(claims.Role, claims.UserID, current) {
			return errors.New("permission denied")
		}

		senderType := supportSenderTypeStaff
		senderRole := strings.ToUpper(claims.Role)
		if isCustomerRole(claims.Role) {
			senderType = supportSenderTypeCustomer
		}

		if senderType == supportSenderTypeStaff {
			if !current.AssigneeUserID.Valid {
				claimed, claimErr := queries.ClaimSupportConversation(ctx, db.ClaimSupportConversationParams{
					ID:             current.ID,
					AssigneeUserID: pgtype.UUID{Bytes: claims.UserID, Valid: true},
					AssigneeRole:   nullableString(senderRole),
				})
				if claimErr != nil {
					return claimErr
				}
				current = claimed
			}
			if !current.AssigneeUserID.Valid || current.AssigneeUserID.Bytes != claims.UserID {
				return errors.New("permission denied")
			}
		}

		messageType := strings.ToUpper(strings.TrimSpace(request.MessageType))
		if messageType == "" {
			messageType = supportMessageTypeText
		}
		var textValue *string
		var assetID pgtype.UUID
		cardPayload := request.CardPayload

		switch messageType {
		case supportMessageTypeText:
			text := strings.TrimSpace(optionalString(request.Text))
			if text == "" {
				return errors.New("invalid request: text is required")
			}
			textValue = &text
		case supportMessageTypeImage:
			if request.AssetID == nil || *request.AssetID == uuid.Nil {
				return errors.New("invalid request: assetId is required")
			}
			asset, err := queries.GetSupportMessageAsset(ctx, *request.AssetID)
			if err != nil {
				return errors.New("invalid request: asset not found")
			}
			if asset.ConversationID != current.ID {
				return errors.New("invalid request: asset does not belong to conversation")
			}
			assetID = pgtype.UUID{Bytes: asset.ID, Valid: true}
			text := "[图片]"
			textValue = &text
		case supportMessageTypeOrderCard, supportMessageTypeProductCard:
			if len(bytesTrimSpace(cardPayload)) == 0 {
				return errors.New("invalid request: cardPayload is required")
			}
			if !json.Valid(cardPayload) {
				return errors.New("invalid request: cardPayload must be valid json")
			}
			preview, err := supportCardPreview(cardPayload)
			if err != nil {
				return errors.New("invalid request: invalid cardPayload")
			}
			textValue = &preview
		default:
			return errors.New("invalid request: unsupported messageType")
		}

		created, err := queries.CreateSupportMessage(ctx, db.CreateSupportMessageParams{
			ConversationID: current.ID,
			SenderType:     senderType,
			SenderUserID:   pgtype.UUID{Bytes: claims.UserID, Valid: true},
			SenderRole:     nullableString(senderRole),
			MessageType:    messageType,
			TextContent:    textValue,
			AssetID:        assetID,
			CardPayload:    cardPayload,
		})
		if err != nil {
			return err
		}

		nextCustomerUnread := int(current.CustomerUnreadCount)
		nextStaffUnread := int(current.StaffUnreadCount)
		switch senderType {
		case supportSenderTypeCustomer:
			nextCustomerUnread = 0
			nextStaffUnread++
		case supportSenderTypeStaff:
			nextStaffUnread = 0
			nextCustomerUnread++
		}

		preview := strings.TrimSpace(optionalString(textValue))
		updated, err := queries.UpdateSupportConversationAfterMessage(ctx, db.UpdateSupportConversationAfterMessageParams{
			ID:                  current.ID,
			LastMessageType:     nullableString(messageType),
			LastMessagePreview:  nullableString(preview),
			LastMessageAt:       created.CreatedAt,
			CustomerUnreadCount: int32(nextCustomerUnread),
			StaffUnreadCount:    int32(nextStaffUnread),
			Status:              supportConversationStatusOpenAssignedIfNeeded(current),
		})
		if err != nil {
			return err
		}

		message = created
		updatedConversation = updated
		return nil
	})
	return message, updatedConversation, err
}

func (h *Handler) createSupportSystemMessage(ctx context.Context, conversation db.SupportConversation, text string) (db.SupportMessage, db.SupportConversation, error) {
	if h.DB == nil {
		return db.SupportMessage{}, db.SupportConversation{}, errors.New("db pool is nil")
	}

	var message db.SupportMessage
	var updated db.SupportConversation
	err := shareddb.WithTx(ctx, h.DB, func(tx pgx.Tx) error {
		var innerErr error
		message, updated, innerErr = h.createSupportSystemMessageTx(ctx, db.New(tx), conversation, text)
		return innerErr
	})
	return message, updated, err
}

func (h *Handler) createSupportSystemMessageTx(ctx context.Context, queries *db.Queries, conversation db.SupportConversation, text string) (db.SupportMessage, db.SupportConversation, error) {
	message, err := queries.CreateSupportMessage(ctx, db.CreateSupportMessageParams{
		ConversationID: conversation.ID,
		SenderType:     supportSenderTypeSystem,
		MessageType:    supportMessageTypeSystem,
		TextContent:    nullableString(text),
	})
	if err != nil {
		return db.SupportMessage{}, db.SupportConversation{}, err
	}
	updated, err := queries.UpdateSupportConversationAfterMessage(ctx, db.UpdateSupportConversationAfterMessageParams{
		ID:                  conversation.ID,
		LastMessageType:     nullableString(supportMessageTypeSystem),
		LastMessagePreview:  nullableString(text),
		LastMessageAt:       message.CreatedAt,
		CustomerUnreadCount: conversation.CustomerUnreadCount,
		StaffUnreadCount:    conversation.StaffUnreadCount,
		Status:              supportConversationStatusOpenAssignedIfNeeded(conversation),
	})
	return message, updated, err
}

func (h *Handler) uploadSupportMessageAsset(c *gin.Context, uploadedByUserID uuid.UUID, conversationID uuid.UUID) (db.SupportMessageAsset, error) {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		return db.SupportMessageAsset{}, errors.New("invalid request: missing file")
	}
	if fileHeader.Size > maxSupportMessageImageSize {
		return db.SupportMessageAsset{}, errors.New("invalid request: file exceeds 5MB limit")
	}

	file, err := fileHeader.Open()
	if err != nil {
		return db.SupportMessageAsset{}, errors.New("invalid request: failed to read file")
	}
	defer func() {
		_ = file.Close()
	}()

	sniff := make([]byte, 512)
	n, err := io.ReadFull(file, sniff)
	if err != nil && err != io.ErrUnexpectedEOF {
		return db.SupportMessageAsset{}, errors.New("invalid request: failed to read file")
	}
	sniff = sniff[:n]
	contentType := http.DetectContentType(sniff)
	ext, allowed := allowedSupportImageTypes[contentType]
	if !allowed {
		return db.SupportMessageAsset{}, errors.New("invalid request: unsupported file type")
	}

	localDir := strings.TrimSpace(h.MediaLocalOutputDir)
	baseURL := strings.TrimSpace(h.MediaPublicBaseURL)
	if localDir == "" || baseURL == "" {
		return db.SupportMessageAsset{}, errors.New("media upload is not configured")
	}

	subDir := filepath.Join(localDir, "support")
	if err := os.MkdirAll(subDir, 0o755); err != nil {
		return db.SupportMessageAsset{}, err
	}

	fileName := uuid.NewString() + ext
	localPath := filepath.Join(subDir, fileName)
	dst, err := os.Create(localPath)
	if err != nil {
		return db.SupportMessageAsset{}, err
	}
	defer func() {
		_ = dst.Close()
	}()

	if _, err := dst.Write(sniff); err != nil {
		return db.SupportMessageAsset{}, err
	}
	if _, err := io.Copy(dst, file); err != nil {
		return db.SupportMessageAsset{}, err
	}
	if err := dst.Close(); err != nil {
		return db.SupportMessageAsset{}, err
	}

	url := strings.TrimRight(baseURL, "/") + "/support/" + fileName
	asset, err := h.SupportStore.CreateSupportMessageAsset(c.Request.Context(), db.CreateSupportMessageAssetParams{
		ConversationID:   conversationID,
		UploadedByUserID: uploadedByUserID,
		ContentType:      contentType,
		FileName:         fileName,
		FileSize:         fileHeader.Size,
		Url:              url,
	})
	if err != nil {
		return db.SupportMessageAsset{}, err
	}
	return asset, nil
}

func (h *Handler) listSupportMessages(ctx context.Context, conversationID uuid.UUID, offset, limit int) ([]supportMessageView, int64, error) {
	messages, err := h.SupportStore.ListSupportMessages(ctx, db.ListSupportMessagesParams{
		ConversationID: conversationID,
		Offset:         clampInt32(offset),
		Limit:          clampInt32(limit),
	})
	if err != nil {
		return nil, 0, err
	}
	total, err := h.SupportStore.CountSupportMessages(ctx, conversationID)
	if err != nil {
		return nil, 0, err
	}

	views := make([]supportMessageView, 0, len(messages))
	for _, message := range messages {
		view, err := h.supportMessageView(ctx, message)
		if err != nil {
			return nil, 0, err
		}
		views = append(views, view)
	}
	return views, total, nil
}

func (h *Handler) supportMessageView(ctx context.Context, message db.SupportMessage) (supportMessageView, error) {
	view := supportMessageView{
		ID:             message.ID,
		ConversationID: message.ConversationID,
		SenderType:     message.SenderType,
		SenderRole:     message.SenderRole,
		MessageType:    message.MessageType,
		TextContent:    message.TextContent,
		CardPayload:    cloneRawMessage(message.CardPayload),
		CreatedAt:      message.CreatedAt.Time,
	}
	if message.SenderUserID.Valid {
		value := uuid.UUID(message.SenderUserID.Bytes)
		view.SenderUserID = &value
	}
	if message.AssetID.Valid {
		asset, err := h.SupportStore.GetSupportMessageAsset(ctx, message.AssetID.Bytes)
		if err != nil {
			return supportMessageView{}, err
		}
		assetView := supportMessageAssetFromModel(asset)
		view.Asset = &assetView
	}
	return view, nil
}

func (h *Handler) buildSupportConversationContext(ctx context.Context, conversation db.SupportConversation) (supportConversationContext, error) {
	orderRows, err := h.OrderStore.ListOrders(ctx, db.ListOrdersParams{
		CustomerID: pgtype.UUID{Bytes: conversation.CustomerUserID, Valid: true},
		Offset:     0,
		Limit:      5,
	})
	if err != nil {
		return supportConversationContext{}, err
	}

	orderSummaries := make([]supportOrderSummary, 0, len(orderRows))
	for _, orderRow := range orderRows {
		items, itemErr := h.OrderStore.ListOrderItems(ctx, orderRow.ID)
		if itemErr != nil {
			return supportConversationContext{}, itemErr
		}
		summary := supportOrderSummary{
			ID:         orderRow.ID,
			Status:     orderRow.Status,
			CreatedAt:  orderRow.CreatedAt.Time,
			Remark:     orderRow.Remark,
			TotalItems: len(items),
		}
		if len(items) > 0 {
			skuMap, skuErr := h.loadSkusWithTiers(ctx, []uuid.UUID{items[0].SkuID})
			if skuErr != nil {
				return supportConversationContext{}, skuErr
			}
			if sku, ok := skuMap[items[0].SkuID]; ok {
				name := sku.Name
				summary.FirstItem = &name
			}
		}
		orderSummaries = append(orderSummaries, summary)
	}

	inquiryRows, err := h.InquiryStore.ListPriceInquiries(ctx, db.ListPriceInquiriesParams{
		CreatedByUserID: pgtype.UUID{Bytes: conversation.CustomerUserID, Valid: true},
		Offset:          0,
		Limit:           5,
	})
	if err != nil {
		return supportConversationContext{}, err
	}
	inquirySummaries := make([]supportInquirySummary, 0, len(inquiryRows))
	for _, item := range inquiryRows {
		inquirySummaries = append(inquirySummaries, supportInquirySummary{
			ID:        item.ID,
			Status:    item.Status,
			Message:   item.Message,
			CreatedAt: item.CreatedAt.Time,
		})
	}

	ticketRows, err := h.AfterSalesStore.ListAfterSalesTickets(ctx, db.ListAfterSalesTicketsParams{
		CreatedByUserID: pgtype.UUID{Bytes: conversation.CustomerUserID, Valid: true},
		Offset:          0,
		Limit:           5,
	})
	if err != nil {
		return supportConversationContext{}, err
	}
	ticketSummaries := make([]supportAfterSalesSummary, 0, len(ticketRows))
	for _, item := range ticketRows {
		ticketSummaries = append(ticketSummaries, supportAfterSalesSummary{
			ID:        item.ID,
			Status:    item.Status,
			Subject:   item.Subject,
			CreatedAt: item.CreatedAt.Time,
		})
	}

	return supportConversationContext{
		CustomerUserID:   conversation.CustomerUserID,
		OwnerSalesUserID: uuidPtrFromPgtype(conversation.OwnerSalesUserID),
		RecentOrders:     orderSummaries,
		RecentInquiries:  inquirySummaries,
		RecentTickets:    ticketSummaries,
	}, nil
}

func (h *Handler) loadSupportConversationForCommonRoute(c *gin.Context) (middleware.Claims, db.SupportConversation, bool) {
	claims, ok := h.requireUser(c)
	if !ok {
		return middleware.Claims{}, db.SupportConversation{}, false
	}
	conversationID, err := parseSupportConversationID(c.Param("conversationId"))
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid conversationId")
		return middleware.Claims{}, db.SupportConversation{}, false
	}
	conversation, err := h.SupportStore.GetSupportConversation(c.Request.Context(), conversationID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "conversation not found")
			return middleware.Claims{}, db.SupportConversation{}, false
		}
		h.logError("get support conversation failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to load conversation")
		return middleware.Claims{}, db.SupportConversation{}, false
	}
	return claims, conversation, true
}

func (h *Handler) loadSupportConversationForAdminRoute(c *gin.Context) (middleware.Claims, db.SupportConversation, bool) {
	claims, ok := h.requireRole(c, "CS", "MANAGER", "BOSS", "ADMIN")
	if !ok {
		return middleware.Claims{}, db.SupportConversation{}, false
	}
	conversationID, err := parseSupportConversationID(c.Param("conversationId"))
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid conversationId")
		return middleware.Claims{}, db.SupportConversation{}, false
	}
	conversation, err := h.SupportStore.GetSupportConversation(c.Request.Context(), conversationID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "conversation not found")
			return middleware.Claims{}, db.SupportConversation{}, false
		}
		h.logError("get support conversation failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to load conversation")
		return middleware.Claims{}, db.SupportConversation{}, false
	}
	return claims, conversation, true
}

func supportConversationFromModel(model db.SupportConversation) supportConversationView {
	return supportConversationView{
		ID:                  model.ID,
		CustomerUserID:      model.CustomerUserID,
		CustomerDisplayName: model.CustomerDisplayName,
		CustomerPhone:       model.CustomerPhone,
		OwnerSalesUserID:    uuidPtrFromPgtype(model.OwnerSalesUserID),
		AssigneeUserID:      uuidPtrFromPgtype(model.AssigneeUserID),
		AssigneeRole:        model.AssigneeRole,
		Status:              model.Status,
		LastMessageType:     model.LastMessageType,
		LastMessagePreview:  model.LastMessagePreview,
		LastMessageAt:       model.LastMessageAt.Time,
		CustomerUnreadCount: int(model.CustomerUnreadCount),
		StaffUnreadCount:    int(model.StaffUnreadCount),
		CreatedAt:           model.CreatedAt.Time,
		UpdatedAt:           model.UpdatedAt.Time,
		ClosedAt:            timePtrFromPg(model.ClosedAt),
	}
}

func supportConversationSnapshotNeedsRepair(conversation db.SupportConversation, claims middleware.Claims) bool {
	if claims.DisplayName != "" && trimmedPtrValue(conversation.CustomerDisplayName) != claims.DisplayName {
		return true
	}
	if claims.Phone != "" && trimmedPtrValue(conversation.CustomerPhone) != claims.Phone {
		return true
	}
	return false
}

func trimmedPtrValue(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}

func nullableTrimmedString(value string) *string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return &value
}

func supportMessageAssetFromModel(model db.SupportMessageAsset) supportMessageAssetView {
	return supportMessageAssetView{
		ID:          model.ID,
		ContentType: model.ContentType,
		FileName:    model.FileName,
		FileSize:    model.FileSize,
		Url:         model.Url,
		CreatedAt:   model.CreatedAt.Time,
	}
}

func supportPageParams(c *gin.Context) (page int, pageSize int, offset int) {
	page = 1
	pageSize = 50
	if value := strings.TrimSpace(c.Query("page")); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil && parsed > 0 {
			page = parsed
		}
	}
	if value := strings.TrimSpace(c.Query("pageSize")); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil && parsed > 0 {
			pageSize = parsed
		}
	}
	if pageSize > 100 {
		pageSize = 100
	}
	offset = (page - 1) * pageSize
	return
}

func parseSupportConversationID(raw string) (uuid.UUID, error) {
	return uuid.Parse(strings.TrimSpace(raw))
}

func canAccessSupportConversation(role string, userID uuid.UUID, conversation db.SupportConversation) bool {
	switch strings.ToUpper(strings.TrimSpace(role)) {
	case "CUSTOMER":
		return conversation.CustomerUserID == userID
	case "CS", "MANAGER", "BOSS", "ADMIN":
		return true
	default:
		return false
	}
}

func canManageSupportTransfer(role string) bool {
	switch strings.ToUpper(strings.TrimSpace(role)) {
	case "CS", "ADMIN", "BOSS":
		return true
	default:
		return false
	}
}

func canManageSupportAssignment(role string, conversation db.SupportConversation, userID uuid.UUID) bool {
	switch strings.ToUpper(strings.TrimSpace(role)) {
	case "CS", "ADMIN", "BOSS", "MANAGER":
		return true
	default:
		return false
	}
}

func isCustomerRole(role string) bool {
	return strings.EqualFold(strings.TrimSpace(role), "CUSTOMER")
}

func supportConversationStatusOpenAssignedIfNeeded(conversation db.SupportConversation) string {
	if conversation.ClosedAt.Valid {
		return supportConversationStatusClosed
	}
	if conversation.AssigneeUserID.Valid {
		return supportConversationStatusOpenAssigned
	}
	return supportConversationStatusOpenUnassigned
}

func supportCardPreview(raw json.RawMessage) (string, error) {
	var payload map[string]interface{}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return "", err
	}
	if title, ok := payload["title"].(string); ok && strings.TrimSpace(title) != "" {
		return strings.TrimSpace(title), nil
	}
	if subtitle, ok := payload["subtitle"].(string); ok && strings.TrimSpace(subtitle) != "" {
		return strings.TrimSpace(subtitle), nil
	}
	return "[卡片消息]", nil
}

func uuidPtrFromPgtype(value pgtype.UUID) *uuid.UUID {
	if !value.Valid {
		return nil
	}
	result := uuid.UUID(value.Bytes)
	return &result
}

func timePtrFromPg(value pgtype.Timestamptz) *time.Time {
	if !value.Valid {
		return nil
	}
	result := value.Time
	return &result
}

func nullableString(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func optionalString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func cloneRawMessage(value []byte) json.RawMessage {
	if len(value) == 0 {
		return nil
	}
	cloned := make([]byte, len(value))
	copy(cloned, value)
	return cloned
}

func bytesTrimSpace(value []byte) []byte {
	return []byte(strings.TrimSpace(string(value)))
}
