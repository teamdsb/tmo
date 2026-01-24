package handler

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/teamdsb/tmo/services/identity/internal/db"
	"github.com/teamdsb/tmo/services/identity/internal/http/oapi"
)

func (h *Handler) GetAuditLogs(c *gin.Context, params oapi.GetAuditLogsParams) {
	if _, ok := h.requireAdmin(c); !ok {
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

	actor := pgtype.UUID{}
	if params.ActorUserId != nil {
		actor = pgtype.UUID{Bytes: *params.ActorUserId, Valid: true}
	}

	action := params.Action
	targetType := params.TargetType

	rows, err := h.Store.ListAuditLogs(c.Request.Context(), db.ListAuditLogsParams{
		ActorUserID: actor,
		Action:      action,
		TargetType:  targetType,
		Limit:       int32(pageSize),
		Offset:      int32(offset),
	})
	if err != nil {
		h.logError("list audit logs failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list audit logs")
		return
	}

	total, err := h.Store.CountAuditLogs(c.Request.Context(), db.CountAuditLogsParams{
		ActorUserID: actor,
		Action:      action,
		TargetType:  targetType,
	})
	if err != nil {
		h.logError("count audit logs failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list audit logs")
		return
	}

	items := make([]oapi.AuditLog, 0, len(rows))
	for _, row := range rows {
		var metadata map[string]interface{}
		if len(row.Metadata) > 0 {
			_ = json.Unmarshal(row.Metadata, &metadata)
		}
		logItem := oapi.AuditLog{
			Id:         row.ID,
			Action:     row.Action,
			TargetType: row.TargetType,
			CreatedAt:  row.CreatedAt.Time,
		}
		if metadata != nil {
			logItem.Metadata = &metadata
		}
		if row.ActorUserID.Valid {
			actor := openapi_types.UUID(row.ActorUserID.Bytes)
			logItem.ActorUserId = &actor
		}
		if row.TargetID.Valid {
			target := openapi_types.UUID(row.TargetID.Bytes)
			logItem.TargetId = &target
		}
		if row.RequestID != nil {
			logItem.RequestId = row.RequestID
		}
		if row.Ip != nil {
			logItem.Ip = row.Ip
		}
		if row.UserAgent != nil {
			logItem.UserAgent = row.UserAgent
		}
		items = append(items, logItem)
	}

	c.JSON(http.StatusOK, oapi.PagedAuditLogList{
		Items:    items,
		Page:     page,
		PageSize: pageSize,
		Total:    int(total),
	})
}
