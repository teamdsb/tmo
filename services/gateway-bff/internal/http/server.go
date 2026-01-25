package http

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/teamdsb/tmo/packages/go-shared/httpx"
)

type ProxyHandlers struct {
	Identity  gin.HandlerFunc
	Commerce  gin.HandlerFunc
	Payment   gin.HandlerFunc
	AI        gin.HandlerFunc
	Bootstrap gin.HandlerFunc
}

func NewRouter(handlers ProxyHandlers, logger *slog.Logger, readyCheck func(context.Context) error, maxBodyBytes int64) *gin.Engine {
	router := httpx.NewRouter(
		httpx.WithLogger(logger),
		httpx.WithOtel("gateway-bff"),
	)
	if maxBodyBytes > 0 {
		router.Use(limitRequestBody(maxBodyBytes))
		router.MaxMultipartMemory = maxBodyBytes
	}

	router.GET("/health", httpx.Health())
	router.GET("/ready", httpx.Ready(readyCheck))

	router.GET("/bff/bootstrap", handlers.Bootstrap)

	router.Any("/auth", handlers.Identity)
	router.Any("/auth/*path", handlers.Identity)
	router.Any("/me", handlers.Identity)
	router.Any("/me/*path", handlers.Identity)
	router.Any("/rbac", handlers.Identity)
	router.Any("/rbac/*path", handlers.Identity)
	router.Any("/staff", handlers.Identity)
	router.Any("/staff/*path", handlers.Identity)
	router.Any("/audit-logs", handlers.Identity)
	router.Any("/audit-logs/*path", handlers.Identity)
	router.Any("/customers", handlers.Identity)
	router.Any("/customers/*path", handlers.Identity)

	router.Any("/admin/config/feature-flags", handlers.Identity)
	router.Any("/admin/customers", handlers.Identity)
	router.Any("/admin/customers/*path", handlers.Identity)

	router.Any("/payments", handlers.Payment)
	router.Any("/payments/*path", handlers.Payment)

	router.Any("/admin", handlers.Commerce)
	router.Any("/admin/*path", handlers.Commerce)

	router.Any("/ai", handlers.AI)
	router.Any("/ai/*path", handlers.AI)

	router.NoRoute(handlers.Commerce)

	return router
}

func NewServer(addr string, router http.Handler) *http.Server {
	return httpx.NewServer(addr, router)
}

func limitRequestBody(maxBytes int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
		c.Next()
	}
}
