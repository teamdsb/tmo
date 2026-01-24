package http

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	apierrors "github.com/teamdsb/tmo/packages/go-shared/errors"
	"github.com/teamdsb/tmo/packages/go-shared/httpx"
)

type ProxyHandler struct {
	identity *httputil.ReverseProxy
	commerce *httputil.ReverseProxy
}

func NewProxyHandler(identityBaseURL, commerceBaseURL string, logger *slog.Logger) (*ProxyHandler, error) {
	identityTarget, err := parseBaseURL(identityBaseURL)
	if err != nil {
		return nil, fmt.Errorf("identity base url: %w", err)
	}
	commerceTarget, err := parseBaseURL(commerceBaseURL)
	if err != nil {
		return nil, fmt.Errorf("commerce base url: %w", err)
	}

	return &ProxyHandler{
		identity: newReverseProxy(identityTarget, logger),
		commerce: newReverseProxy(commerceTarget, logger),
	}, nil
}

func (p *ProxyHandler) Identity(c *gin.Context) {
	setRequestIDHeader(c)
	p.identity.ServeHTTP(c.Writer, c.Request)
}

func (p *ProxyHandler) Commerce(c *gin.Context) {
	setRequestIDHeader(c)
	p.commerce.ServeHTTP(c.Writer, c.Request)
}

func setRequestIDHeader(c *gin.Context) {
	requestID := httpx.RequestIDFromContext(c)
	if requestID != "" {
		c.Request.Header.Set("X-Request-ID", requestID)
	}
}

func parseBaseURL(raw string) (*url.URL, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return nil, fmt.Errorf("missing base url")
	}
	parsed, err := url.Parse(value)
	if err != nil {
		return nil, err
	}
	if parsed.Scheme == "" || parsed.Host == "" {
		return nil, fmt.Errorf("invalid base url %q", raw)
	}
	return parsed, nil
}

func newReverseProxy(target *url.URL, logger *slog.Logger) *httputil.ReverseProxy {
	proxy := httputil.NewSingleHostReverseProxy(target)
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		requestID := r.Header.Get("X-Request-ID")
		if requestID == "" {
			requestID = uuid.NewString()
			w.Header().Set("X-Request-ID", requestID)
		}
		if logger != nil && err != nil {
			logger.Error("proxy error",
				"error", err,
				"upstream", target.String(),
				"path", r.URL.Path,
				"request_id", requestID,
			)
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		_ = json.NewEncoder(w).Encode(apierrors.APIError{
			Code:      "bad_gateway",
			Message:   "upstream unavailable",
			RequestId: requestID,
		})
	}
	return proxy
}
