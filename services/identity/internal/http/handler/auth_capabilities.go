package handler

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

type miniLoginPlatformCapabilitiesResponse struct {
	RealPhoneLoginReady       bool     `json:"realPhoneLoginReady"`
	PhoneProofSimulationEnabled bool   `json:"phoneProofSimulationEnabled"`
	Missing                   []string `json:"missing"`
}

type miniLoginCapabilitiesResponse struct {
	LoginMode string                                `json:"loginMode"`
	Weapp     miniLoginPlatformCapabilitiesResponse `json:"weapp"`
}

func (h *Handler) GetAuthMiniCapabilities(c *gin.Context) {
	loginMode := strings.ToLower(strings.TrimSpace(h.Config.LoginMode))
	missing := make([]string, 0, 2)
	if strings.TrimSpace(h.Config.WeappAppID) == "" {
		missing = append(missing, "IDENTITY_WEAPP_APPID")
	}
	if strings.TrimSpace(h.Config.WeappAppSecret) == "" {
		missing = append(missing, "IDENTITY_WEAPP_APPSECRET")
	}

	realPhoneLoginReady := loginMode == "real" &&
		len(missing) == 0 &&
		!h.Config.EnablePhoneProofSimulation

	c.JSON(http.StatusOK, miniLoginCapabilitiesResponse{
		LoginMode: loginMode,
		Weapp: miniLoginPlatformCapabilitiesResponse{
			RealPhoneLoginReady:         realPhoneLoginReady,
			PhoneProofSimulationEnabled: h.Config.EnablePhoneProofSimulation,
			Missing:                     missing,
		},
	})
}
