package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/teamdsb/tmo/services/identity/internal/http/oapi"
)

func (h *Handler) GetCustomers(c *gin.Context, params oapi.GetCustomersParams) {
	h.writeError(c, http.StatusNotImplemented, "not_implemented", "customers endpoint is not implemented")
}

func (h *Handler) GetCustomersCustomerId(c *gin.Context, customerId openapi_types.UUID) {
	h.writeError(c, http.StatusNotImplemented, "not_implemented", "customer detail endpoint is not implemented")
}
