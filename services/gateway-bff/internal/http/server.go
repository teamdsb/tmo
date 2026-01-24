package http

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/teamdsb/tmo/packages/go-shared/httpx"
)

type ProxyHandlers struct {
	Identity gin.HandlerFunc
	Commerce gin.HandlerFunc
}

func NewRouter(handlers ProxyHandlers, logger *slog.Logger, readyCheck func(context.Context) error) *gin.Engine {
	router := httpx.NewRouter(
		httpx.WithLogger(logger),
		httpx.WithOtel("gateway-bff"),
	)

	router.GET("/health", httpx.Health())
	router.GET("/ready", httpx.Ready(readyCheck))

	router.Any("/auth", handlers.Identity)
	router.Any("/auth/*path", handlers.Identity)
	router.Any("/me", handlers.Identity)
	router.Any("/me/*path", handlers.Identity)

	router.NoRoute(handlers.Commerce)

	return router
}

func NewServer(addr string, router http.Handler) *http.Server {
	return httpx.NewServer(addr, router)
}
