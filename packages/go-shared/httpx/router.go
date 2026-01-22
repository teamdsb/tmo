package httpx

import (
	"log/slog"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/contrib/instrumentation/github.com/gin-gonic/gin/otelgin"
)

type RouterOption func(*routerOptions)

type routerOptions struct {
	logger          *slog.Logger
	otelServiceName string
	trustedProxies  []string
}

func WithLogger(logger *slog.Logger) RouterOption {
	return func(options *routerOptions) {
		options.logger = logger
	}
}

func WithOtel(serviceName string) RouterOption {
	return func(options *routerOptions) {
		options.otelServiceName = serviceName
	}
}

func WithTrustedProxies(proxies []string) RouterOption {
	return func(options *routerOptions) {
		options.trustedProxies = proxies
	}
}

func NewRouter(opts ...RouterOption) *gin.Engine {
	options := &routerOptions{}
	for _, opt := range opts {
		opt(options)
	}

	router := gin.New()
	if len(options.trustedProxies) > 0 {
		if err := router.SetTrustedProxies(options.trustedProxies); err != nil && options.logger != nil {
			options.logger.Warn("invalid trusted proxies", "error", err)
		}
	}

	router.Use(RequestID())
	if options.otelServiceName != "" {
		router.Use(otelgin.Middleware(options.otelServiceName))
	}
	if options.logger != nil {
		router.Use(AccessLog(options.logger))
	}
	router.Use(Recovery(options.logger))

	return router
}
