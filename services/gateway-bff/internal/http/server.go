package http

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/teamdsb/tmo/packages/go-shared/httpx"
)

type ProxyHandlers struct {
	Identity             gin.HandlerFunc
	Commerce             gin.HandlerFunc
	CatalogProducts      gin.HandlerFunc
	CatalogProductDetail gin.HandlerFunc
	Media                gin.HandlerFunc
	Payment              gin.HandlerFunc
	AI                   gin.HandlerFunc
	Bootstrap            gin.HandlerFunc
	AdminSummary         gin.HandlerFunc
	Image                gin.HandlerFunc
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
	router.GET("/bff/admin/summary", handlers.AdminSummary)
	router.GET("/assets/img", handlers.Image)
	if handlers.Media != nil {
		router.GET("/assets/media/*path", handlers.Media)
	}
	if handlers.CatalogProducts != nil {
		router.GET("/catalog/products", handlers.CatalogProducts)
	} else {
		router.GET("/catalog/products", handlers.Commerce)
	}
	if handlers.CatalogProductDetail != nil {
		router.GET("/catalog/products/:spuId", handlers.CatalogProductDetail)
	} else {
		router.GET("/catalog/products/:spuId", handlers.Commerce)
	}

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
	router.Any("/admin/sales-users", handlers.Identity)
	router.Any("/admin/users", handlers.Identity)
	router.Any("/admin/customers", handlers.Identity)
	router.Any("/admin/customers/*path", handlers.Identity)
	router.Any("/admin/customer-tags", handlers.Identity)
	router.Any("/admin/customer-tags/*path", handlers.Identity)
	router.Any("/admin/inquiries", handlers.Commerce)
	router.Any("/admin/inquiries/*path", handlers.Commerce)
	router.Any("/admin/payments", handlers.Payment)
	router.Any("/admin/payments/*path", handlers.Payment)
	router.Any("/admin/products/import-jobs", handlers.Commerce)
	router.Any("/admin/shipments/import-jobs", handlers.Commerce)
	router.Any("/admin/product-requests/export-jobs", handlers.Commerce)
	router.Any("/admin/import-jobs/:jobId", handlers.Commerce)
	router.Any("/admin/suppliers", handlers.Commerce)
	router.Any("/admin/suppliers/*path", handlers.Commerce)

	router.Any("/payments", handlers.Payment)
	router.Any("/payments/*path", handlers.Payment)

	router.Any("/admin", handlers.Commerce)

	router.Any("/ai", handlers.AI)
	router.Any("/ai/*path", handlers.AI)

	router.NoRoute(handlers.Commerce)

	return router
}

func NewServer(addr string, router http.Handler) *http.Server {
	server := httpx.NewServer(addr, router)
	// Gateway image proxy may need extra time before first byte is written.
	// Keep a longer write timeout here to avoid empty replies on slow upstream images.
	server.WriteTimeout = 2 * time.Minute
	return server
}

func limitRequestBody(maxBytes int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
		c.Next()
	}
}
