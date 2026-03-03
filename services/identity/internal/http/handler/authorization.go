package handler

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/teamdsb/tmo/services/identity/internal/auth"
)

func (h *Handler) requireAdmin(c *gin.Context) (auth.Claims, bool) {
	return h.requireBoss(c)
}

func (h *Handler) requireBoss(c *gin.Context) (auth.Claims, bool) {
	claims, ok := h.requireClaims(c)
	if !ok {
		return auth.Claims{}, false
	}
	switch strings.ToUpper(claims.Role) {
	case "BOSS", "ADMIN":
		return claims, true
	default:
		h.writeError(c, http.StatusForbidden, "forbidden", "permission denied")
		return auth.Claims{}, false
	}
}

func (h *Handler) requirePermission(c *gin.Context, permissionCode string, requiredScope string) (auth.Claims, string, bool) {
	claims, ok := h.requireClaims(c)
	if !ok {
		return auth.Claims{}, "", false
	}

	scope, allowed, err := h.permissionScope(c, claims.UserID, permissionCode)
	if err != nil {
		h.logError("list effective permissions failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to authorize")
		return auth.Claims{}, "", false
	}
	if !allowed {
		h.writeError(c, http.StatusForbidden, "forbidden", "permission denied")
		return auth.Claims{}, "", false
	}
	if requiredScope != "" && !scopeAllows(scope, requiredScope) {
		h.writeError(c, http.StatusForbidden, "forbidden", "permission denied")
		return auth.Claims{}, "", false
	}

	return claims, scope, true
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
