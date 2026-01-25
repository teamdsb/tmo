package oapi_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/teamdsb/tmo/services/commerce/internal/http/oapi"
)

type stubServer struct {
	calledPath string
}

func (server *stubServer) GetCart(context *gin.Context) {
	server.calledPath = context.FullPath()
	context.Status(http.StatusOK)
}

func (server *stubServer) PostCartImportJobs(context *gin.Context) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) GetCartImportJobsJobId(context *gin.Context, jobId openapi_types.UUID) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) PostCartImportJobsJobIdConfirm(context *gin.Context, jobId openapi_types.UUID) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) PostCartItems(context *gin.Context) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) DeleteCartItemsItemId(context *gin.Context, itemId openapi_types.UUID) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) PatchCartItemsItemId(context *gin.Context, itemId openapi_types.UUID) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) GetCatalogCategories(context *gin.Context) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) PostCatalogCategories(context *gin.Context) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) GetCatalogProducts(context *gin.Context, params oapi.GetCatalogProductsParams) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) PostCatalogProducts(context *gin.Context) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) GetCatalogProductsSpuId(context *gin.Context, spuId openapi_types.UUID) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) PostCatalogProductsSpuIdSkus(context *gin.Context, spuId openapi_types.UUID) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) GetOrders(context *gin.Context, params oapi.GetOrdersParams) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) PostOrders(context *gin.Context, params oapi.PostOrdersParams) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) GetOrdersOrderId(context *gin.Context, orderId openapi_types.UUID) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) GetOrdersOrderIdTracking(context *gin.Context, orderId openapi_types.UUID) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) PostOrdersOrderIdTracking(context *gin.Context, orderId openapi_types.UUID) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) PostShipmentsImportJobs(context *gin.Context) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) GetAfterSalesTickets(context *gin.Context, params oapi.GetAfterSalesTicketsParams) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) PostAfterSalesTickets(context *gin.Context) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) GetAfterSalesTicketsTicketId(context *gin.Context, ticketId openapi_types.UUID) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) PatchAfterSalesTicketsTicketId(context *gin.Context, ticketId openapi_types.UUID) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) GetAfterSalesTicketsTicketIdMessages(context *gin.Context, ticketId openapi_types.UUID, params oapi.GetAfterSalesTicketsTicketIdMessagesParams) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) PostAfterSalesTicketsTicketIdMessages(context *gin.Context, ticketId openapi_types.UUID) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) GetInquiriesPrice(context *gin.Context, params oapi.GetInquiriesPriceParams) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) PostInquiriesPrice(context *gin.Context) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) GetInquiriesPriceInquiryId(context *gin.Context, inquiryId openapi_types.UUID) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) PatchInquiriesPriceInquiryId(context *gin.Context, inquiryId openapi_types.UUID) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) GetInquiriesPriceInquiryIdMessages(context *gin.Context, inquiryId openapi_types.UUID, params oapi.GetInquiriesPriceInquiryIdMessagesParams) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) PostInquiriesPriceInquiryIdMessages(context *gin.Context, inquiryId openapi_types.UUID) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) GetProductRequests(context *gin.Context, params oapi.GetProductRequestsParams) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) PostProductRequests(context *gin.Context) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) GetWishlist(context *gin.Context) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) PostWishlist(context *gin.Context) {
	context.Status(http.StatusNotImplemented)
}

func (server *stubServer) DeleteWishlistSkuId(context *gin.Context, skuId openapi_types.UUID) {
	context.Status(http.StatusNotImplemented)
}

func TestRegisterHandlersRoutes(test *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	server := &stubServer{}

	oapi.RegisterHandlers(router, server)

	request := httptest.NewRequest(http.MethodGet, "/cart", nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		test.Fatalf("expected status OK, got %d", recorder.Code)
	}
	if server.calledPath != "/cart" {
		test.Fatalf("expected handler to be invoked for /cart, got %q", server.calledPath)
	}
}
