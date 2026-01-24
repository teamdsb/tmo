package handler

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/teamdsb/tmo/services/identity/internal/auth"
)

func (h *Handler) requireAdmin(c *gin.Context) (auth.Claims, bool) {
	claims, ok := h.requireClaims(c)
	if !ok {
		return auth.Claims{}, false
	}
	if strings.ToUpper(claims.Role) != "ADMIN" {
		h.writeError(c, http.StatusForbidden, "forbidden", "permission denied")
		return auth.Claims{}, false
	}
	return claims, true
}

func scopeRank(scope string) int {
	switch strings.ToUpper(scope) {
	case "ALL":
		return 3
	case "OWNED":
		return 2
	case "SELF":
		return 1
	default:
		return 0
	}
}

func scopeAllows(actual, required string) bool {
	return scopeRank(actual) >= scopeRank(required)
}
