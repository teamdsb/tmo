package handler

import (
	"log/slog"

	"github.com/gin-gonic/gin"

	"github.com/teamdsb/tmo/services/payment/internal/http/middleware"
)

type Handler struct {
	Logger *slog.Logger
	Auth   *middleware.Authenticator
	Flags  FeatureFlagsProvider
}

func (h *Handler) requireUser(c *gin.Context) bool {
	if h.Auth == nil {
		return true
	}
	_, ok := h.Auth.RequireUser(c)
	return ok
}

func (h *Handler) logError(message string, err error) {
	if h.Logger == nil || err == nil {
		return
	}
	h.Logger.Error(message, "error", err)
}
