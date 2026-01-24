package handler

import (
	"crypto/rand"
	"encoding/base32"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	apierrors "github.com/teamdsb/tmo/packages/go-shared/errors"
	"github.com/teamdsb/tmo/services/identity/internal/db"
	"github.com/teamdsb/tmo/services/identity/internal/http/oapi"

	openapi_types "github.com/oapi-codegen/runtime/types"
)

var miniLoginRoles = map[string]struct{}{
	"CUSTOMER":    {},
	"SALES":       {},
	"PROCUREMENT": {},
	"CS":          {},
}

func (h *Handler) writeError(c *gin.Context, status int, code, message string) {
	apierrors.Write(c, status, apierrors.APIError{
		Code:    code,
		Message: message,
	})
}

func (h *Handler) writeErrorWithDetails(c *gin.Context, status int, code, message string, details map[string]interface{}) {
	apierrors.Write(c, status, apierrors.APIError{
		Code:    code,
		Message: message,
		Details: details,
	})
}

func (h *Handler) logError(message string, err error) {
	if h.Logger == nil || err == nil {
		return
	}
	h.Logger.Error(message, "error", err)
}

func normalizeRoles(roles []string) []string {
	seen := make(map[string]struct{}, len(roles))
	normalized := make([]string, 0, len(roles))
	for _, role := range roles {
		value := strings.ToUpper(strings.TrimSpace(role))
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		normalized = append(normalized, value)
	}
	sort.Strings(normalized)
	return normalized
}

func filterMiniLoginRoles(roles []string) []string {
	filtered := make([]string, 0, len(roles))
	for _, role := range roles {
		if _, ok := miniLoginRoles[role]; ok {
			filtered = append(filtered, role)
		}
	}
	sort.Strings(filtered)
	return filtered
}

func containsRole(roles []string, role string) bool {
	for _, candidate := range roles {
		if candidate == role {
			return true
		}
	}
	return false
}

func userTypeFromRole(role string) (oapi.UserUserType, bool) {
	switch strings.ToUpper(role) {
	case "CUSTOMER":
		return oapi.UserUserTypeCustomer, true
	case "SALES", "PROCUREMENT", "CS":
		return oapi.UserUserTypeStaff, true
	case "ADMIN":
		return oapi.UserUserTypeAdmin, true
	default:
		return "", false
	}
}

func userTypeFromString(raw string) (oapi.UserUserType, bool) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "customer":
		return oapi.UserUserTypeCustomer, true
	case "staff":
		return oapi.UserUserTypeStaff, true
	case "admin":
		return oapi.UserUserTypeAdmin, true
	default:
		return "", false
	}
}

func userFromModel(user db.User, roles []string, userType oapi.UserUserType) oapi.User {
	createdAt := time.Time{}
	if user.CreatedAt.Valid {
		createdAt = user.CreatedAt.Time
	}
	response := oapi.User{
		Id:        openapi_types.UUID(user.ID),
		UserType:  userType,
		Roles:     roles,
		CreatedAt: createdAt,
	}
	if user.DisplayName != nil {
		response.DisplayName = user.DisplayName
	}
	if user.Status != "" {
		status := oapi.UserStatus(user.Status)
		response.Status = &status
	}
	if user.DisabledAt.Valid {
		disabledAt := user.DisabledAt.Time
		response.DisabledAt = &disabledAt
	}
	if user.DisabledReason != nil {
		response.DisabledReason = user.DisabledReason
	}
	return response
}

func expiresInSeconds(expiresAt time.Time) int {
	remaining := time.Until(expiresAt)
	if remaining <= 0 {
		return 0
	}
	return int(remaining.Seconds())
}

func generateSalesScene() string {
	buf := make([]byte, 12)
	if _, err := rand.Read(buf); err != nil {
		return uuid.NewString()
	}
	encoder := base32.StdEncoding.WithPadding(base32.NoPadding)
	return encoder.EncodeToString(buf)
}
