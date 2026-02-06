package http

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/teamdsb/tmo/packages/go-shared/httpx"
)

type BootstrapHandler struct {
	IdentityBaseURL string
	Client          *http.Client
	Logger          *slog.Logger
}

type bootstrapPayload struct {
	Me           json.RawMessage `json:"me"`
	Permissions  json.RawMessage `json:"permissions"`
	FeatureFlags json.RawMessage `json:"featureFlags"`
}

var (
	defaultFeatureFlags = json.RawMessage(`{"paymentEnabled":false,"wechatPayEnabled":false,"alipayPayEnabled":false}`)
	defaultPermissions  = json.RawMessage(`{"items":[]}`)
)

func NewBootstrapHandler(identityBaseURL string, client *http.Client, logger *slog.Logger) *BootstrapHandler {
	return &BootstrapHandler{
		IdentityBaseURL: identityBaseURL,
		Client:          client,
		Logger:          logger,
	}
}

func (h *BootstrapHandler) Handle(c *gin.Context) {
	identityBase := strings.TrimRight(strings.TrimSpace(h.IdentityBaseURL), "/")
	if identityBase == "" {
		c.JSON(http.StatusInternalServerError, bootstrapPayload{
			Me:           json.RawMessage("null"),
			Permissions:  defaultPermissions,
			FeatureFlags: defaultFeatureFlags,
		})
		return
	}

	authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
	requestID := httpx.RequestIDFromContext(c)

	featureFlags := defaultFeatureFlags
	if status, body, err := h.fetchJSON(c.Request.Context(), identityBase+"/admin/config/feature-flags", requestID, authHeader); err == nil {
		if status >= 200 && status < 300 && len(body) > 0 {
			featureFlags = body
		}
	}

	if authHeader == "" {
		c.JSON(http.StatusOK, bootstrapPayload{
			Me:           json.RawMessage("null"),
			Permissions:  defaultPermissions,
			FeatureFlags: featureFlags,
		})
		return
	}

	meStatus, meBody, err := h.fetchJSON(c.Request.Context(), identityBase+"/me", requestID, authHeader)
	if err != nil || meStatus < 200 || meStatus >= 300 {
		h.forwardUpstreamError(c, meStatus, meBody, err, "bootstrap me")
		return
	}

	permStatus, permBody, err := h.fetchJSON(c.Request.Context(), identityBase+"/me/permissions", requestID, authHeader)
	if err != nil || permStatus < 200 || permStatus >= 300 {
		h.forwardUpstreamError(c, permStatus, permBody, err, "bootstrap permissions")
		return
	}

	if len(permBody) == 0 {
		permBody = defaultPermissions
	}
	if len(meBody) == 0 {
		meBody = json.RawMessage("null")
	}

	c.JSON(http.StatusOK, bootstrapPayload{
		Me:           meBody,
		Permissions:  permBody,
		FeatureFlags: featureFlags,
	})
}

func (h *BootstrapHandler) fetchJSON(ctx context.Context, url, requestID, authHeader string) (int, json.RawMessage, error) {
	client := h.Client
	if client == nil {
		client = http.DefaultClient
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return 0, nil, err
	}
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	if requestID != "" {
		req.Header.Set("X-Request-ID", requestID)
	}
	resp, err := client.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return resp.StatusCode, nil, err
	}
	return resp.StatusCode, json.RawMessage(body), nil
}

func (h *BootstrapHandler) forwardUpstreamError(c *gin.Context, status int, body []byte, err error, label string) {
	if err != nil && h.Logger != nil {
		h.Logger.Error("bff bootstrap upstream error", "error", err, "label", label)
	}
	if status <= 0 {
		status = http.StatusBadGateway
	}
	if len(body) == 0 {
		c.Status(status)
		return
	}
	c.Data(status, "application/json", body)
}
