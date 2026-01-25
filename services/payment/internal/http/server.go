package http

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/teamdsb/tmo/packages/go-shared/httpx"
	"github.com/teamdsb/tmo/services/payment/internal/http/handler"
	"github.com/teamdsb/tmo/services/payment/internal/http/oapi"
)

func NewRouter(handler *handler.Handler, logger *slog.Logger, readyCheck func(context.Context) error) *gin.Engine {
	router := httpx.NewRouter(
		httpx.WithLogger(logger),
		httpx.WithOtel("payment"),
	)

	router.GET("/health", httpx.Health())
	router.GET("/ready", httpx.Ready(readyCheck))

	oapi.RegisterHandlers(router, handler)

	return router
}

func NewServer(addr string, router http.Handler) *http.Server {
	return httpx.NewServer(addr, router)
}
