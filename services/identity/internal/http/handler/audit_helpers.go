package handler

import (
	"encoding/json"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/teamdsb/tmo/services/identity/internal/db"
)

func (h *Handler) recordAudit(c *gin.Context, actorID *uuid.UUID, action, targetType string, targetID *uuid.UUID, metadata map[string]interface{}) {
	if h.Store == nil {
		return
	}

	actor := pgtype.UUID{}
	if actorID != nil && *actorID != uuid.Nil {
		actor = pgtype.UUID{Bytes: *actorID, Valid: true}
	}
	target := pgtype.UUID{}
	if targetID != nil && *targetID != uuid.Nil {
		target = pgtype.UUID{Bytes: *targetID, Valid: true}
	}

	var meta []byte
	if metadata != nil {
		if encoded, err := json.Marshal(metadata); err == nil {
			meta = encoded
		}
	}
	var targetTypePtr *string
	if strings.TrimSpace(targetType) != "" {
		targetTypePtr = &targetType
	}
	requestID := strings.TrimSpace(c.GetHeader("X-Request-ID"))
	var requestIDPtr *string
	if requestID != "" {
		requestIDPtr = &requestID
	}
	ip := strings.TrimSpace(c.ClientIP())
	var ipPtr *string
	if ip != "" {
		ipPtr = &ip
	}
	agent := strings.TrimSpace(c.Request.UserAgent())
	var agentPtr *string
	if agent != "" {
		agentPtr = &agent
	}

	if _, err := h.Store.CreateAuditLog(c.Request.Context(), db.CreateAuditLogParams{
		ID:          uuid.New(),
		ActorUserID: actor,
		Action:      action,
		TargetType:  targetTypePtr,
		TargetID:    target,
		Metadata:    meta,
		RequestID:   requestIDPtr,
		Ip:          ipPtr,
		UserAgent:   agentPtr,
	}); err != nil {
		h.logError("write audit log failed", err)
	}
}
