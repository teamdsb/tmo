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
	router.GET("/ws/support", handler.GetSupportWebSocket)
	router.GET("/support/conversations/current", handler.GetSupportConversationsCurrent)
	router.GET("/support/conversations/:conversationId/messages", handler.GetSupportConversationsConversationIdMessages)
	router.POST("/support/conversations/:conversationId/messages", handler.PostSupportConversationsConversationIdMessages)
	router.POST("/support/conversations/:conversationId/messages/image", handler.PostSupportConversationsConversationIdMessagesImage)
	router.POST("/support/conversations/:conversationId/read", handler.PostSupportConversationsConversationIdRead)
	router.GET("/admin/support/conversations", handler.GetAdminSupportConversations)
	router.GET("/admin/support/conversations/:conversationId", handler.GetAdminSupportConversationsConversationId)
	router.POST("/admin/support/conversations/:conversationId/claim", handler.PostAdminSupportConversationsConversationIdClaim)
	router.POST("/admin/support/conversations/:conversationId/release", handler.PostAdminSupportConversationsConversationIdRelease)
	router.POST("/admin/support/conversations/:conversationId/transfer", handler.PostAdminSupportConversationsConversationIdTransfer)
	router.POST("/admin/products/import-jobs", handler.PostAdminProductsImportJobs)
	router.POST("/admin/shipments/import-jobs", handler.PostShipmentsImportJobs)
	router.POST("/admin/product-requests/export-jobs", handler.PostAdminProductRequestsExportJobs)
	router.GET("/admin/import-jobs/:jobId", handler.GetAdminImportJobsJobId)
	router.GET("/admin/inquiries/:inquiryId/requirement-profile", handler.GetAdminInquiriesInquiryIdRequirementProfile)
	router.GET("/admin/suppliers", handler.GetAdminSuppliers)
	router.GET("/admin/suppliers/:supplierId", handler.GetAdminSuppliersSupplierId)
	router.PATCH("/admin/suppliers/:supplierId", handler.PatchAdminSuppliersSupplierId)
	router.GET("/admin/suppliers/:supplierId/contacts", handler.GetAdminSuppliersSupplierIdContacts)
	router.GET("/admin/suppliers/:supplierId/scorecards", handler.GetAdminSuppliersSupplierIdScorecards)
	router.GET("/admin/miniapp/display-categories", handler.GetAdminMiniappDisplayCategories)
	router.PUT("/admin/miniapp/display-categories", handler.PutAdminMiniappDisplayCategories)
	router.POST("/internal/orders/:orderId/payment-status", handler.PostInternalOrdersOrderIdPaymentStatus)

	return router
}

func NewServer(addr string, router http.Handler) *http.Server {
	return httpx.NewServer(addr, router)
}
