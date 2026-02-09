package http

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	apierrors "github.com/teamdsb/tmo/packages/go-shared/errors"
	"github.com/teamdsb/tmo/packages/go-shared/httpx"
)

type CatalogRewriteHandler struct {
	client          *http.Client
	commerceBaseURL *url.URL
	publicBaseURL   *url.URL
	logger          *slog.Logger
}

func NewCatalogRewriteHandler(commerceBaseURL, publicBaseURL string, timeout time.Duration, logger *slog.Logger) (*CatalogRewriteHandler, error) {
	commerceBase, err := parseBaseURL(commerceBaseURL)
	if err != nil {
		return nil, fmt.Errorf("commerce base url: %w", err)
	}
	publicBase, err := parseBaseURL(publicBaseURL)
	if err != nil {
		return nil, fmt.Errorf("public base url: %w", err)
	}

	adjustedTimeout := timeout
	if adjustedTimeout <= 0 {
		adjustedTimeout = 10 * time.Second
	}
	client := &http.Client{
		Transport: newProxyTransport(adjustedTimeout),
		Timeout:   adjustedTimeout,
	}

	return &CatalogRewriteHandler{
		client:          client,
		commerceBaseURL: commerceBase,
		publicBaseURL:   publicBase,
		logger:          logger,
	}, nil
}

func (h *CatalogRewriteHandler) ListProducts(c *gin.Context) {
	h.proxyAndRewrite(c, rewriteProductListPayload)
}

func (h *CatalogRewriteHandler) GetProductDetail(c *gin.Context) {
	h.proxyAndRewrite(c, rewriteProductDetailPayload)
}

func (h *CatalogRewriteHandler) proxyAndRewrite(c *gin.Context, rewrite func(payload map[string]interface{}, publicBaseURL *url.URL) bool) {
	upstreamURL := h.commerceBaseURL.ResolveReference(&url.URL{
		Path:     c.Request.URL.Path,
		RawQuery: c.Request.URL.RawQuery,
	})

	request, err := http.NewRequestWithContext(c.Request.Context(), c.Request.Method, upstreamURL.String(), nil)
	if err != nil {
		apierrors.Write(c, http.StatusBadRequest, apierrors.APIError{
			Code:    "invalid_request",
			Message: "failed to build upstream request",
		})
		return
	}
	copyRequestHeaders(request.Header, c.Request.Header)
	if requestID := httpx.RequestIDFromContext(c); requestID != "" {
		request.Header.Set("X-Request-ID", requestID)
	}

	response, err := h.client.Do(request)
	if err != nil {
		requestID := request.Header.Get("X-Request-ID")
		if requestID == "" {
			requestID = uuid.NewString()
		}
		if h.logger != nil {
			h.logger.Error("catalog rewrite upstream request failed",
				"error", err,
				"path", c.Request.URL.Path,
				"request_id", requestID,
			)
		}
		apierrors.Write(c, http.StatusBadGateway, apierrors.APIError{
			Code:      "bad_gateway",
			Message:   "upstream unavailable",
			RequestId: requestID,
		})
		return
	}
	defer response.Body.Close()

	body, err := io.ReadAll(response.Body)
	if err != nil {
		apierrors.Write(c, http.StatusBadGateway, apierrors.APIError{
			Code:    "bad_gateway",
			Message: "failed to read upstream response",
		})
		return
	}

	contentType := strings.ToLower(strings.TrimSpace(response.Header.Get("Content-Type")))
	shouldRewrite := response.StatusCode >= http.StatusOK
	shouldRewrite = shouldRewrite && response.StatusCode < http.StatusMultipleChoices
	shouldRewrite = shouldRewrite && strings.Contains(contentType, "application/json")
	if shouldRewrite {
		var payload map[string]interface{}
		if err := json.Unmarshal(body, &payload); err != nil {
			if h.logger != nil {
				h.logger.Warn("catalog rewrite skipped due to invalid upstream json",
					"error", err,
					"path", c.Request.URL.Path,
				)
			}
		} else if rewrite(payload, h.publicBaseURL) {
			rewrittenBody, marshalErr := json.Marshal(payload)
			if marshalErr != nil {
				if h.logger != nil {
					h.logger.Warn("catalog rewrite failed to marshal rewritten payload",
						"error", marshalErr,
						"path", c.Request.URL.Path,
					)
				}
			} else {
				body = rewrittenBody
				if response.Header.Get("Content-Type") == "" {
					response.Header.Set("Content-Type", "application/json")
				}
			}
		}
	}

	writeUpstreamResponse(c, response.StatusCode, response.Header, body)
}

func copyRequestHeaders(target, source http.Header) {
	for key, values := range source {
		for _, value := range values {
			target.Add(key, value)
		}
	}
}

func writeUpstreamResponse(c *gin.Context, statusCode int, headers http.Header, body []byte) {
	copyUpstreamHeaders(c.Writer.Header(), headers)
	c.Status(statusCode)
	if len(body) > 0 {
		_, _ = c.Writer.Write(body)
	}
	c.Abort()
}

func copyUpstreamHeaders(target, source http.Header) {
	for key := range target {
		target.Del(key)
	}
	for key, values := range source {
		if isHopByHopHeader(key) || strings.EqualFold(key, "Content-Length") {
			continue
		}
		for _, value := range values {
			target.Add(key, value)
		}
	}
}

func isHopByHopHeader(name string) bool {
	switch strings.ToLower(strings.TrimSpace(name)) {
	case "connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade":
		return true
	default:
		return false
	}
}

func rewriteProductListPayload(payload map[string]interface{}, publicBaseURL *url.URL) bool {
	items, ok := payload["items"].([]interface{})
	if !ok {
		return false
	}

	changed := false
	for _, item := range items {
		mapped, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		if rewriteCoverImageField(mapped, publicBaseURL) {
			changed = true
		}
	}
	return changed
}

func rewriteProductDetailPayload(payload map[string]interface{}, publicBaseURL *url.URL) bool {
	productRaw, ok := payload["product"].(map[string]interface{})
	if !ok {
		return false
	}

	changed := rewriteCoverImageField(productRaw, publicBaseURL)

	images, ok := productRaw["images"].([]interface{})
	if !ok {
		return changed
	}
	for i, value := range images {
		raw, ok := value.(string)
		if !ok {
			continue
		}
		rewritten := rewriteExternalImageURL(raw, publicBaseURL)
		if rewritten == raw {
			continue
		}
		images[i] = rewritten
		changed = true
	}
	productRaw["images"] = images
	return changed
}

func rewriteCoverImageField(payload map[string]interface{}, publicBaseURL *url.URL) bool {
	value, ok := payload["coverImageUrl"].(string)
	if !ok {
		return false
	}
	rewritten := rewriteExternalImageURL(value, publicBaseURL)
	if rewritten == value {
		return false
	}
	payload["coverImageUrl"] = rewritten
	return true
}

func rewriteExternalImageURL(raw string, publicBaseURL *url.URL) string {
	value := strings.TrimSpace(raw)
	if value == "" || publicBaseURL == nil {
		return raw
	}

	parsed, err := url.Parse(value)
	if err != nil || !parsed.IsAbs() {
		return raw
	}

	scheme := strings.ToLower(strings.TrimSpace(parsed.Scheme))
	if scheme != "https" && scheme != "http" {
		return raw
	}

	if sameOrigin(parsed, publicBaseURL) {
		return raw
	}

	base := strings.TrimRight(publicBaseURL.String(), "/")
	return fmt.Sprintf("%s/assets/img?url=%s", base, url.QueryEscape(value))
}

func sameOrigin(left, right *url.URL) bool {
	if left == nil || right == nil {
		return false
	}
	return strings.EqualFold(left.Scheme, right.Scheme) && strings.EqualFold(left.Host, right.Host)
}
