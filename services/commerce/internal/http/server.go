package http

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/teamdsb/tmo/packages/go-shared/httpx"
	"github.com/teamdsb/tmo/services/commerce/internal/http/handler"
	"github.com/teamdsb/tmo/services/commerce/internal/http/oapi"
)

func NewRouter(handler *handler.Handler, logger *slog.Logger, readyCheck func(context.Context) error) *gin.Engine {
	router := httpx.NewRouter(
		httpx.WithLogger(logger),
		httpx.WithOtel("commerce"),
	)

	router.GET("/health", httpx.Health())
	router.GET("/ready", httpx.Ready(readyCheck))

	oapi.RegisterHandlers(router, handler)
	router.POST("/admin/products/import-jobs", handler.PostAdminProductsImportJobs)
	router.POST("/admin/shipments/import-jobs", handler.PostShipmentsImportJobs)
	router.POST("/admin/product-requests/export-jobs", handler.PostAdminProductRequestsExportJobs)
	router.GET("/admin/import-jobs/:jobId", handler.GetAdminImportJobsJobId)

	return router
}

func NewServer(addr string, router http.Handler) *http.Server {
	return httpx.NewServer(addr, router)
}
