package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/oapi-codegen/runtime/types"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/http/oapi"
)

type catalogCategoriesResponse struct {
	Items []oapi.Category `json:"items"`
}

func (h *Handler) GetCatalogCategories(c *gin.Context) {
	response := catalogCategoriesResponse{Items: []oapi.Category{}}
	c.JSON(http.StatusOK, response)
}

func (h *Handler) GetCatalogProducts(c *gin.Context, params oapi.GetCatalogProductsParams) {
	page := 1
	pageSize := 20
	if params.Page != nil && *params.Page > 0 {
		page = *params.Page
	}
	if params.PageSize != nil && *params.PageSize > 0 {
		pageSize = *params.PageSize
	}
	if pageSize > 100 {
		pageSize = 100
	}

	offset := (page - 1) * pageSize

	categoryFilter := pgtype.UUID{}
	if params.CategoryId != nil {
		categoryFilter = pgtype.UUID{Bytes: uuid.UUID(*params.CategoryId), Valid: true}
	}

	products, err := h.Store.ListProducts(c.Request.Context(), db.ListProductsParams{
		Q:          params.Q,
		CategoryID: categoryFilter,
		Offset:     int32(offset),
		Limit:      int32(pageSize),
	})
	if err != nil {
		h.logError("list products failed", err)
		c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list products"})
		return
	}

	total, err := h.Store.CountProducts(c.Request.Context(), db.CountProductsParams{
		Q:          params.Q,
		CategoryID: categoryFilter,
	})
	if err != nil {
		h.logError("count products failed", err)
		c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to list products"})
		return
	}

	items := make([]oapi.ProductSummary, 0, len(products))
	for _, product := range products {
		items = append(items, productSummaryFromModel(product))
	}

	c.JSON(http.StatusOK, oapi.PagedProductList{
		Items:    items,
		Page:     page,
		PageSize: pageSize,
		Total:    int(total),
	})
}

func (h *Handler) PostCatalogProducts(c *gin.Context) {
	var request oapi.CreateCatalogProductRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "invalid request body"})
		return
	}
	if request.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "name is required"})
		return
	}

	images := derefStringSlice(request.Images)
	tags := derefStringSlice(request.Tags)
	filters := derefStringSlice(request.FilterDimensions)

	product, err := h.Store.CreateProduct(c.Request.Context(), db.CreateProductParams{
		Name:             request.Name,
		Description:      request.Description,
		CategoryID:       uuid.UUID(request.CategoryId),
		CoverImageUrl:    request.CoverImageUrl,
		Images:           images,
		Tags:             tags,
		FilterDimensions: filters,
	})
	if err != nil {
		h.logError("create product failed", err)
		c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to create product"})
		return
	}

	c.JSON(http.StatusCreated, productDetailFromModel(product))
}

func (h *Handler) GetCatalogProductsSpuId(c *gin.Context, spuId types.UUID) {
	product, err := h.Store.GetProduct(c.Request.Context(), uuid.UUID(spuId))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"message": "product not found"})
			return
		}
		h.logError("get product failed", err)
		c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to fetch product"})
		return
	}

	c.JSON(http.StatusOK, productDetailFromModel(product))
}

func (h *Handler) logError(message string, err error) {
	if h.Logger == nil {
		return
	}
	h.Logger.Error(message, "error", err)
}

func productSummaryFromModel(product db.CatalogProduct) oapi.ProductSummary {
	summary := oapi.ProductSummary{
		Id:         types.UUID(product.ID),
		Name:       product.Name,
		CategoryId: types.UUID(product.CategoryID),
	}
	if product.CoverImageUrl != nil {
		summary.CoverImageUrl = product.CoverImageUrl
	}
	if len(product.Tags) > 0 {
		tags := make([]string, len(product.Tags))
		copy(tags, product.Tags)
		summary.Tags = &tags
	}
	return summary
}

func productDetailFromModel(product db.CatalogProduct) oapi.ProductDetail {
	var detail oapi.ProductDetail
	if len(product.Images) > 0 {
		images := make([]string, len(product.Images))
		copy(images, product.Images)
		detail.Product.Images = &images
	}
	if len(product.FilterDimensions) > 0 {
		filters := make([]string, len(product.FilterDimensions))
		copy(filters, product.FilterDimensions)
		detail.Product.FilterDimensions = &filters
	}

	detail.Product.Id = types.UUID(product.ID)
	detail.Product.Name = product.Name
	detail.Product.CategoryId = types.UUID(product.CategoryID)
	detail.Product.Description = product.Description
	detail.Skus = []oapi.SKU{}

	return detail
}

func derefStringSlice(value *[]string) []string {
	if value == nil {
		return []string{}
	}
	out := make([]string, len(*value))
	copy(out, *value)
	return out
}
