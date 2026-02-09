package http

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	apierrors "github.com/teamdsb/tmo/packages/go-shared/errors"
	"github.com/teamdsb/tmo/packages/go-shared/httpx"
)

const (
	defaultImageProxyMaxBytes          = int64(8 * 1024 * 1024)
	defaultImageProxyCacheMaxAgeSecond = 3600
	imageProxyUserAgent                = "tmo-gateway-image-proxy/1.0"
)

type ImageProxyHandler struct {
	client             *http.Client
	allowlist          []string
	maxBytes           int64
	cacheMaxAgeSeconds int
	logger             *slog.Logger
}

func NewImageProxyHandler(client *http.Client, allowlist []string, timeout time.Duration, maxBytes int64, cacheMaxAgeSeconds int, logger *slog.Logger) *ImageProxyHandler {
	normalizedAllowlist := normalizeAllowlist(allowlist)
	if maxBytes <= 0 {
		maxBytes = defaultImageProxyMaxBytes
	}
	if cacheMaxAgeSeconds <= 0 {
		cacheMaxAgeSeconds = defaultImageProxyCacheMaxAgeSecond
	}
	if timeout <= 0 {
		timeout = 10 * time.Second
	}
	if client == nil {
		transport := newProxyTransport(timeout)
		client = &http.Client{
			Transport: transport,
			Timeout:   timeout,
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				if isHostAllowed(strings.ToLower(req.URL.Hostname()), normalizedAllowlist) {
					return nil
				}
				return fmt.Errorf("redirect host is not allowed")
			},
		}
	}

	return &ImageProxyHandler{
		client:             client,
		allowlist:          normalizedAllowlist,
		maxBytes:           maxBytes,
		cacheMaxAgeSeconds: cacheMaxAgeSeconds,
		logger:             logger,
	}
}

func (h *ImageProxyHandler) Handle(c *gin.Context) {
	rawURL := strings.TrimSpace(c.Query("url"))
	if rawURL == "" {
		apierrors.Write(c, http.StatusBadRequest, apierrors.APIError{
			Code:    "missing_image_url",
			Message: "query parameter url is required",
		})
		return
	}

	targetURL, err := parseImageURL(rawURL)
	if err != nil {
		apierrors.Write(c, http.StatusBadRequest, apierrors.APIError{
			Code:    "invalid_image_url",
			Message: "invalid image url",
		})
		return
	}

	host := strings.ToLower(targetURL.Hostname())
	if !isHostAllowed(host, h.allowlist) {
		apierrors.Write(c, http.StatusForbidden, apierrors.APIError{
			Code:    "image_host_not_allowed",
			Message: "image host is not allowed",
			Details: map[string]interface{}{
				"host":      host,
				"allowlist": h.allowlist,
			},
		})
		return
	}

	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, targetURL.String(), nil)
	if err != nil {
		apierrors.Write(c, http.StatusBadRequest, apierrors.APIError{
			Code:    "invalid_image_url",
			Message: "invalid image url",
		})
		return
	}
	req.Header.Set("Accept", "image/*,*/*;q=0.8")
	req.Header.Set("User-Agent", imageProxyUserAgent)
	if requestID := httpx.RequestIDFromContext(c); requestID != "" {
		req.Header.Set("X-Request-ID", requestID)
	}

	resp, err := h.client.Do(req)
	if err != nil {
		if isContextCanceled(c.Request.Context(), err) {
			c.Status(499)
			return
		}
		if h.logger != nil {
			h.logger.Error("image proxy upstream request failed", "error", err, "url", targetURL.String())
		}
		apierrors.Write(c, http.StatusBadGateway, apierrors.APIError{
			Code:    "upstream_unavailable",
			Message: "image upstream unavailable",
		})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		if h.logger != nil {
			h.logger.Warn("image proxy upstream status is not successful", "status", resp.StatusCode, "url", targetURL.String())
		}
		apierrors.Write(c, http.StatusBadGateway, apierrors.APIError{
			Code:    "upstream_bad_status",
			Message: "image upstream returned bad status",
			Details: map[string]interface{}{
				"status": resp.StatusCode,
			},
		})
		return
	}

	contentType := strings.TrimSpace(resp.Header.Get("Content-Type"))
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	payload, err := io.ReadAll(io.LimitReader(resp.Body, h.maxBytes+1))
	if err != nil {
		if isContextCanceled(c.Request.Context(), err) {
			c.Status(499)
			return
		}
		if h.logger != nil {
			h.logger.Error("image proxy failed to read upstream body", "error", err, "url", targetURL.String())
		}
		apierrors.Write(c, http.StatusBadGateway, apierrors.APIError{
			Code:    "upstream_read_failed",
			Message: "failed to read image upstream response",
		})
		return
	}
	if int64(len(payload)) > h.maxBytes {
		apierrors.Write(c, http.StatusRequestEntityTooLarge, apierrors.APIError{
			Code:    "image_too_large",
			Message: "image exceeds proxy size limit",
			Details: map[string]interface{}{
				"maxBytes": h.maxBytes,
			},
		})
		return
	}

	cacheControl := strings.TrimSpace(resp.Header.Get("Cache-Control"))
	if cacheControl == "" {
		cacheControl = fmt.Sprintf("public, max-age=%d", h.cacheMaxAgeSeconds)
	}
	c.Header("Cache-Control", cacheControl)
	if etag := strings.TrimSpace(resp.Header.Get("ETag")); etag != "" {
		c.Header("ETag", etag)
	}
	if lastModified := strings.TrimSpace(resp.Header.Get("Last-Modified")); lastModified != "" {
		c.Header("Last-Modified", lastModified)
	}
	c.Data(http.StatusOK, contentType, payload)
}

func parseImageURL(rawURL string) (*url.URL, error) {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return nil, err
	}
	if !parsed.IsAbs() {
		return nil, fmt.Errorf("url is not absolute")
	}
	scheme := strings.ToLower(strings.TrimSpace(parsed.Scheme))
	if scheme != "https" && scheme != "http" {
		return nil, fmt.Errorf("unsupported url scheme")
	}
	if strings.TrimSpace(parsed.Hostname()) == "" {
		return nil, fmt.Errorf("url host is empty")
	}
	return parsed, nil
}

func normalizeAllowlist(allowlist []string) []string {
	if len(allowlist) == 0 {
		return nil
	}
	normalized := make([]string, 0, len(allowlist))
	seen := make(map[string]struct{}, len(allowlist))
	for _, host := range allowlist {
		value := strings.ToLower(strings.TrimSpace(host))
		if value == "" {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		normalized = append(normalized, value)
	}
	return normalized
}

func isHostAllowed(host string, allowlist []string) bool {
	value := strings.ToLower(strings.TrimSpace(host))
	if value == "" {
		return false
	}
	for _, allowed := range allowlist {
		if value == allowed {
			return true
		}
		if strings.HasSuffix(value, "."+allowed) {
			return true
		}
	}
	return false
}

func isContextCanceled(ctx context.Context, err error) bool {
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	if ctx == nil {
		return false
	}
	return errors.Is(ctx.Err(), context.Canceled) || errors.Is(ctx.Err(), context.DeadlineExceeded)
}
