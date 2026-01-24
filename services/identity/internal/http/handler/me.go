package handler

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/skip2/go-qrcode"

	"github.com/teamdsb/tmo/services/identity/internal/auth"
	"github.com/teamdsb/tmo/services/identity/internal/db"
	"github.com/teamdsb/tmo/services/identity/internal/http/oapi"
)

const salesSceneTTL = 7 * 24 * time.Hour

func (h *Handler) GetMe(c *gin.Context) {
	claims, ok := h.requireClaims(c)
	if !ok {
		return
	}

	user, err := h.Store.GetUserByID(c.Request.Context(), claims.UserID)
	if err != nil {
		if err == pgx.ErrNoRows {
			h.writeError(c, http.StatusUnauthorized, "unauthorized", "invalid token")
			return
		}
		h.logError("lookup user failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch user")
		return
	}

	roles, err := h.Store.ListUserRoles(c.Request.Context(), user.ID)
	if err != nil {
		h.logError("list roles failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch user")
		return
	}
	roles = normalizeRoles(roles)

	userType, ok := userTypeFromRole(claims.Role)
	if !ok {
		userType, ok = userTypeFromString(user.UserType)
		if !ok {
			userType = oapi.Customer
		}
	}

	c.JSON(http.StatusOK, userFromModel(user, roles, userType))
}

func (h *Handler) GetMeSalesQrCode(c *gin.Context) {
	claims, ok := h.requireClaims(c)
	if !ok {
		return
	}

	if strings.ToUpper(claims.Role) != "SALES" {
		h.writeError(c, http.StatusForbidden, "forbidden", "permission denied")
		return
	}

	scene := uuid.NewString()
	expiresAt := time.Now().Add(salesSceneTTL)

	if err := h.Store.CreateSalesQrCode(c.Request.Context(), db.CreateSalesQrCodeParams{
		Scene:       scene,
		SalesUserID: claims.UserID,
		ExpiresAt: pgtype.Timestamptz{
			Time:  expiresAt,
			Valid: true,
		},
	}); err != nil {
		h.logError("create sales qr failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to create qr code")
		return
	}

	payload := fmt.Sprintf("tmo://sales-bind?scene=%s", scene)
	png, err := qrcode.Encode(payload, qrcode.Medium, 256)
	if err != nil {
		h.logError("encode qr failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to create qr code")
		return
	}

	encoded := base64.StdEncoding.EncodeToString(png)
	response := oapi.SalesQrCode{
		QrCodeUrl: "data:image/png;base64," + encoded,
		Scene:     scene,
		ExpiresAt: &expiresAt,
	}
	c.JSON(http.StatusOK, response)
}

func (h *Handler) requireClaims(c *gin.Context) (auth.Claims, bool) {
	if h.Auth == nil {
		h.writeError(c, http.StatusInternalServerError, "internal_error", "service not ready")
		return auth.Claims{}, false
	}
	claims, err := h.Auth.ParseAuthorization(c.GetHeader("Authorization"))
	if err != nil {
		h.writeError(c, http.StatusUnauthorized, "unauthorized", "invalid token")
		return auth.Claims{}, false
	}
	return claims, true
}
