package http

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/teamdsb/tmo/packages/go-shared/httpx"
	"github.com/teamdsb/tmo/services/identity/internal/http/handler"
	"github.com/teamdsb/tmo/services/identity/internal/http/oapi"
)

func NewRouter(handler *handler.Handler, logger *slog.Logger, readyCheck func(context.Context) error) *gin.Engine {
	router := httpx.NewRouter(
		httpx.WithLogger(logger),
		httpx.WithOtel("identity"),
	)

	router.GET("/health", httpx.Health())
	router.GET("/ready", httpx.Ready(readyCheck))

	oapi.RegisterHandlers(router, handler)
	router.GET("/admin/config/feature-flags", handler.GetAdminConfigFeatureFlags)
	router.PATCH("/admin/config/feature-flags", handler.PatchAdminConfigFeatureFlags)
	router.GET("/admin/sales-users", handler.GetAdminSalesUsers)
	router.GET("/admin/users", handler.GetAdminUsers)
	router.PATCH("/admin/users/:userId", handler.PatchAdminUsersUserId)
	router.GET("/admin/customers", handler.GetAdminCustomers)
	router.POST("/admin/customers/:customerId/promote-to-sales", handler.PostAdminCustomersCustomerIdPromoteToSales)
	router.POST("/admin/customers/transfer", handler.PostAdminCustomersTransfer)
	router.POST("/admin/customers/:customerId/transfer", handler.PostAdminCustomersCustomerIdTransfer)
	router.GET("/admin/customers/:customerId/finance-profile", handler.GetAdminCustomersCustomerIdFinanceProfile)
	router.PATCH("/admin/customers/:customerId/finance-profile", handler.PatchAdminCustomersCustomerIdFinanceProfile)
	router.GET("/admin/customer-tags", handler.GetAdminCustomerTags)
	router.POST("/admin/customer-tags", handler.PostAdminCustomerTags)
	router.PATCH("/admin/customer-tags/:tagId", handler.PatchAdminCustomerTagsTagId)
	router.POST("/admin/customers/tags:batch-update", handler.PostAdminCustomersTagsBatchUpdate)

	return router
}

func NewServer(addr string, router http.Handler) *http.Server {
	return httpx.NewServer(addr, router)
}
