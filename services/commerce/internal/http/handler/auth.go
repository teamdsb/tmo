package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/teamdsb/tmo/services/commerce/internal/http/middleware"
)

func (h *Handler) requireUser(c *gin.Context) (middleware.Claims, bool) {
	if h.Auth == nil {
		return middleware.Claims{UserID: uuid.Nil, Role: "ADMIN"}, true
	}
	return h.Auth.RequireUser(c)
}

func (h *Handler) requireRole(c *gin.Context, roles ...string) (middleware.Claims, bool) {
	if h.Auth == nil {
		return middleware.Claims{UserID: uuid.Nil, Role: "ADMIN"}, true
	}
	return h.Auth.RequireRole(c, roles...)
}
