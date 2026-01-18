package http

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/teamdsb/tmo/services/commerce/internal/http/handler"
	"github.com/teamdsb/tmo/services/commerce/internal/http/oapi"
)

func NewRouter(handler *handler.Handler) *gin.Engine {
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(gin.Logger())

	router.GET("/health", func(c *gin.Context) {
		c.String(http.StatusOK, "OK")
	})

	oapi.RegisterHandlers(router, handler)

	return router
}

func NewServer(addr string, router http.Handler) *http.Server {
	return &http.Server{
		Addr:              addr,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
}
