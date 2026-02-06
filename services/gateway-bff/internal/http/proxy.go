package http

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	apierrors "github.com/teamdsb/tmo/packages/go-shared/errors"
	"github.com/teamdsb/tmo/packages/go-shared/httpx"
)

type ProxyHandler struct {
	identity *httputil.ReverseProxy
	commerce *httputil.ReverseProxy
	payment  *httputil.ReverseProxy
	ai       *httputil.ReverseProxy
}

func NewProxyHandler(identityBaseURL, commerceBaseURL, paymentBaseURL, aiBaseURL string, logger *slog.Logger, timeout time.Duration) (*ProxyHandler, error) {
	identityTarget, err := parseBaseURL(identityBaseURL)
	if err != nil {
		return nil, fmt.Errorf("identity base url: %w", err)
	}
	commerceTarget, err := parseBaseURL(commerceBaseURL)
	if err != nil {
		return nil, fmt.Errorf("commerce base url: %w", err)
	}
	paymentTarget, err := parseBaseURL(paymentBaseURL)
	if err != nil {
		return nil, fmt.Errorf("payment base url: %w", err)
	}
	aiTarget, aiEnabled, err := parseOptionalBaseURL(aiBaseURL)
	if err != nil {
		return nil, fmt.Errorf("ai base url: %w", err)
	}

	transport := newProxyTransport(timeout)
	identityProxy := newReverseProxy(identityTarget, logger, transport)
	commerceProxy := newReverseProxy(commerceTarget, logger, transport)
	paymentProxy := newReverseProxy(paymentTarget, logger, transport)
	var aiProxy *httputil.ReverseProxy
	if aiEnabled {
		aiProxy = newReverseProxy(aiTarget, logger, transport)
	}

	return &ProxyHandler{
		identity: identityProxy,
		commerce: commerceProxy,
		payment:  paymentProxy,
		ai:       aiProxy,
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

func (p *ProxyHandler) Payment(c *gin.Context) {
	if p.payment == nil {
		apierrors.Write(c, http.StatusServiceUnavailable, apierrors.APIError{
			Code:    "payment_unavailable",
			Message: "payment service unavailable",
		})
		return
	}
	setRequestIDHeader(c)
	p.payment.ServeHTTP(c.Writer, c.Request)
}

func (p *ProxyHandler) AI(c *gin.Context) {
	if p.ai == nil {
		apierrors.Write(c, http.StatusNotImplemented, apierrors.APIError{
			Code:    "not_implemented",
			Message: "ai service not implemented",
		})
		return
	}
	setRequestIDHeader(c)
	p.ai.ServeHTTP(c.Writer, c.Request)
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

func parseOptionalBaseURL(raw string) (*url.URL, bool, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return nil, false, nil
	}
	parsed, err := parseBaseURL(value)
	if err != nil {
		return nil, false, err
	}
	return parsed, true, nil
}

func newReverseProxy(target *url.URL, logger *slog.Logger, transport http.RoundTripper) *httputil.ReverseProxy {
	proxy := httputil.NewSingleHostReverseProxy(target)
	if transport != nil {
		proxy.Transport = transport
	}
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

func newProxyTransport(timeout time.Duration) *http.Transport {
	adjusted := timeout
	if adjusted <= 0 {
		adjusted = 10 * time.Second
	}
	return &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   adjusted,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		TLSHandshakeTimeout:   adjusted,
		ResponseHeaderTimeout: adjusted,
		ExpectContinueTimeout: 1 * time.Second,
		IdleConnTimeout:       90 * time.Second,
		MaxIdleConns:          100,
		MaxIdleConnsPerHost:   25,
	}
}
