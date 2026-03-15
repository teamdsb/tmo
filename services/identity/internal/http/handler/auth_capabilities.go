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
	Alipay    miniLoginPlatformCapabilitiesResponse `json:"alipay"`
}

func (h *Handler) GetAuthMiniCapabilities(c *gin.Context) {
	loginMode := strings.ToLower(strings.TrimSpace(h.Config.LoginMode))
	weappMissing := make([]string, 0, 2)
	if strings.TrimSpace(h.Config.WeappAppID) == "" {
		weappMissing = append(weappMissing, "IDENTITY_WEAPP_APPID")
	}
	if strings.TrimSpace(h.Config.WeappAppSecret) == "" {
		weappMissing = append(weappMissing, "IDENTITY_WEAPP_APPSECRET")
	}
	alipayMissing := make([]string, 0, 4)
	if strings.TrimSpace(h.Config.AlipayAppID) == "" {
		alipayMissing = append(alipayMissing, "IDENTITY_ALIPAY_APP_ID")
	}
	if strings.TrimSpace(h.Config.AlipayPrivateKey) == "" {
		alipayMissing = append(alipayMissing, "IDENTITY_ALIPAY_PRIVATE_KEY")
	}
	if strings.TrimSpace(h.Config.AlipayPublicKey) == "" {
		alipayMissing = append(alipayMissing, "IDENTITY_ALIPAY_PUBLIC_KEY")
	}
	if strings.TrimSpace(h.Config.AlipayAESKey) == "" {
		alipayMissing = append(alipayMissing, "IDENTITY_ALIPAY_AES_KEY")
	}

	weappRealPhoneLoginReady := loginMode == "real" &&
		len(weappMissing) == 0 &&
		!h.Config.EnablePhoneProofSimulation
	alipayRealPhoneLoginReady := loginMode == "real" &&
		len(alipayMissing) == 0 &&
		!h.Config.EnablePhoneProofSimulation

	c.JSON(http.StatusOK, miniLoginCapabilitiesResponse{
		LoginMode: loginMode,
		Weapp: miniLoginPlatformCapabilitiesResponse{
			RealPhoneLoginReady:         weappRealPhoneLoginReady,
			PhoneProofSimulationEnabled: h.Config.EnablePhoneProofSimulation,
			Missing:                     weappMissing,
		},
		Alipay: miniLoginPlatformCapabilitiesResponse{
			RealPhoneLoginReady:         alipayRealPhoneLoginReady,
			PhoneProofSimulationEnabled: h.Config.EnablePhoneProofSimulation,
			Missing:                     alipayMissing,
		},
	})
}
