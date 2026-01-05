package handlers

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"

	"tmo/internal/store"
)

type Handler struct {
	store store.Store
}

func NewRouter(store store.Store) *gin.Engine {
	router := gin.Default()
	h := &Handler{store: store}

	router.GET("/health", func(c *gin.Context) {
		c.String(http.StatusOK, "OK")
	})

	admin := router.Group("/api/admin")
	admin.Use(requireAdmin())
	admin.POST("/sales", h.createSales)
	admin.POST("/customers", h.createCustomer)
	admin.GET("/customers/:id", h.getCustomer)
	admin.POST("/customers/transfer", h.transferCustomer)

	router.POST("/api/sales/bind", h.bindCustomer)

	return router
}

type createSalesRequest struct {
	Name string `json:"name"`
}

type createCustomerRequest struct {
	Name  string `json:"name"`
	Phone string `json:"phone"`
}

type bindRequest struct {
	BindCode string `json:"bind_code"`
}

type transferRequest struct {
	CustomerID string `json:"customer_id"`
	NewSalesID string `json:"new_sales_id"`
}

func (h *Handler) createSales(c *gin.Context) {
	var req createSalesRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_name"})
		return
	}

	sales, err := h.store.CreateSales(c.Request.Context(), strings.TrimSpace(req.Name))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "create_sales_failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":         sales.ID,
		"name":       sales.Name,
		"bind_code":  sales.BindCode,
		"created_at": sales.CreatedAt,
	})
}

func (h *Handler) createCustomer(c *gin.Context) {
	var req createCustomerRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_name"})
		return
	}

	customer, err := h.store.CreateCustomer(c.Request.Context(), strings.TrimSpace(req.Name), strings.TrimSpace(req.Phone))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "create_customer_failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":         customer.ID,
		"name":       customer.Name,
		"phone":      customer.Phone,
		"sales_id":   customer.SalesID,
		"created_at": customer.CreatedAt,
	})
}

func (h *Handler) getCustomer(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_customer_id"})
		return
	}

	customer, err := h.store.GetCustomer(c.Request.Context(), id)
	if err != nil {
		if err == store.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "customer_not_found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "get_customer_failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":         customer.ID,
		"name":       customer.Name,
		"phone":      customer.Phone,
		"sales_id":   customer.SalesID,
		"created_at": customer.CreatedAt,
	})
}

func (h *Handler) bindCustomer(c *gin.Context) {
	customerID, err := customerIDFromHeader(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "customer_id_required"})
		return
	}

	var req bindRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.BindCode) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_bind_code"})
		return
	}

	sales, err := h.store.GetSalesByBindCode(c.Request.Context(), strings.TrimSpace(req.BindCode))
	if err != nil {
		if err == store.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "bind_code_not_found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "lookup_sales_failed"})
		return
	}

	bound, err := h.store.BindCustomerToSales(c.Request.Context(), customerID, sales.ID)
	if err != nil {
		if err == store.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "customer_not_found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "bind_failed"})
		return
	}

	if bound {
		c.JSON(http.StatusOK, gin.H{
			"status":   "bound",
			"sales_id": sales.ID,
		})
		return
	}

	customer, err := h.store.GetCustomer(c.Request.Context(), customerID)
	if err != nil {
		if err == store.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "customer_not_found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "get_customer_failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":   "already_bound",
		"sales_id": customer.SalesID,
	})
}

func (h *Handler) transferCustomer(c *gin.Context) {
	var req transferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request"})
		return
	}

	customerID, err := uuid.Parse(strings.TrimSpace(req.CustomerID))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_customer_id"})
		return
	}

	newSalesID, err := uuid.Parse(strings.TrimSpace(req.NewSalesID))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_new_sales_id"})
		return
	}

	oldSalesID, err := h.store.TransferCustomer(c.Request.Context(), customerID, newSalesID)
	if err != nil {
		if err == store.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "customer_not_found"})
			return
		}
		if isForeignKeyViolation(err) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_sales_id"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "transfer_failed"})
		return
	}

	var oldSalesIDPtr *uuid.UUID
	if oldSalesID != uuid.Nil {
		oldSalesIDPtr = &oldSalesID
	}

	c.JSON(http.StatusOK, gin.H{
		"status":       "transferred",
		"old_sales_id": oldSalesIDPtr,
		"new_sales_id": newSalesID,
	})
}

func requireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		if strings.ToLower(strings.TrimSpace(c.GetHeader("X-Role"))) != "admin" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "admin_required"})
			return
		}
		c.Next()
	}
}

func customerIDFromHeader(c *gin.Context) (uuid.UUID, error) {
	value := strings.TrimSpace(c.GetHeader("X-Customer-Id"))
	if value == "" {
		return uuid.Nil, errors.New("missing X-Customer-Id")
	}

	return uuid.Parse(value)
}

func isForeignKeyViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23503"
	}
	return false
}
