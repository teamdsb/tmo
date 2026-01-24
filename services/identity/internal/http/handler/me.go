package handler

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

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
			userType = oapi.UserUserTypeCustomer
		}
	}

	c.JSON(http.StatusOK, userFromModel(user, roles, userType))
}

func (h *Handler) GetMeSalesQrCode(c *gin.Context, params oapi.GetMeSalesQrCodeParams) {
	claims, ok := h.requireClaims(c)
	if !ok {
		return
	}
	if h.Store == nil || h.Platform == nil {
		h.writeError(c, http.StatusInternalServerError, "internal_error", "service not ready")
		return
	}

	if strings.ToUpper(claims.Role) != "SALES" {
		h.writeError(c, http.StatusForbidden, "forbidden", "permission denied")
		return
	}

	platformName := "weapp"
	if params.Platform != nil {
		platformName = string(*params.Platform)
	}
	if platformName != "weapp" && platformName != "alipay" {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid platform")
		return
	}

	if existing, err := h.Store.GetLatestSalesQrCode(c.Request.Context(), db.GetLatestSalesQrCodeParams{
		SalesUserID: claims.UserID,
		Platform:    platformName,
	}); err == nil {
		if existing.QrCodeUrl != nil && existing.ExpiresAt.Valid && existing.ExpiresAt.Time.After(time.Now()) {
			expiresAt := existing.ExpiresAt.Time
			platform := oapi.SalesQrCodePlatform(platformName)
			c.JSON(http.StatusOK, oapi.SalesQrCode{
				QrCodeUrl: *existing.QrCodeUrl,
				Scene:     existing.Scene,
				ExpiresAt: &expiresAt,
				Platform:  &platform,
			})
			return
		}
	}

	scene := generateSalesScene()
	expiresAt := time.Now().Add(salesSceneTTL)

	qrCodeURL, err := h.Platform.GenerateSalesQRCode(c.Request.Context(), platformName, scene)
	if err != nil {
		h.logError("generate sales qr failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to create qr code")
		return
	}

	var qrURL *string
	if qrCodeURL != "" {
		qrURL = &qrCodeURL
	}
	if err := h.Store.CreateSalesQrCode(c.Request.Context(), db.CreateSalesQrCodeParams{
		Scene:       scene,
		SalesUserID: claims.UserID,
		Platform:    platformName,
		QrCodeUrl:   qrURL,
		ExpiresAt: pgtype.Timestamptz{
			Time:  expiresAt,
			Valid: true,
		},
	}); err != nil {
		h.logError("create sales qr failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to create qr code")
		return
	}

	platform := oapi.SalesQrCodePlatform(platformName)
	response := oapi.SalesQrCode{
		QrCodeUrl: qrCodeURL,
		Scene:     scene,
		ExpiresAt: &expiresAt,
		Platform:  &platform,
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
