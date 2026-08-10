package http

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"sync"

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
	defaultFeatureFlags = json.RawMessage(`{"paymentEnabled":false,"wechatPayEnabled":false,"wechatB2bEnabled":false,"alipayPayEnabled":false}`)
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

	if authHeader == "" {
		featureFlags := defaultFeatureFlags
		if status, body, err := h.fetchJSON(c.Request.Context(), identityBase+"/admin/config/feature-flags", requestID, authHeader); err == nil {
			if status >= 200 && status < 300 && len(body) > 0 {
				featureFlags = body
			}
		}
		c.JSON(http.StatusOK, bootstrapPayload{
			Me:           json.RawMessage("null"),
			Permissions:  defaultPermissions,
			FeatureFlags: featureFlags,
		})
		return
	}

	type upstreamResult struct {
		status int
		body   json.RawMessage
		err    error
	}
	urls := []string{
		identityBase + "/admin/config/feature-flags",
		identityBase + "/me",
		identityBase + "/me/permissions",
	}
	results := make([]upstreamResult, len(urls))
	var waitGroup sync.WaitGroup
	waitGroup.Add(len(urls))
	for index, url := range urls {
		index, url := index, url
		go func() {
			defer waitGroup.Done()
			results[index].status, results[index].body, results[index].err = h.fetchJSON(c.Request.Context(), url, requestID, authHeader)
		}()
	}
	waitGroup.Wait()

	featureFlags := defaultFeatureFlags
	if result := results[0]; result.err == nil && result.status >= 200 && result.status < 300 && len(result.body) > 0 {
		featureFlags = result.body
	}

	meResult := results[1]
	if meResult.err != nil || meResult.status < 200 || meResult.status >= 300 {
		h.forwardUpstreamError(c, meResult.status, meResult.body, meResult.err, "bootstrap me")
		return
	}

	permissionsResult := results[2]
	if permissionsResult.err != nil || permissionsResult.status < 200 || permissionsResult.status >= 300 {
		h.forwardUpstreamError(c, permissionsResult.status, permissionsResult.body, permissionsResult.err, "bootstrap permissions")
		return
	}

	meBody := meResult.body
	permBody := permissionsResult.body
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
