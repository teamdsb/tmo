package handler

import (
	"encoding/json"
	"errors"
	"math"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/oapi-codegen/runtime/types"

	apierrors "github.com/teamdsb/tmo/packages/go-shared/errors"
	sharedmoney "github.com/teamdsb/tmo/packages/go-shared/money"
	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/http/oapi"
)

type catalogCategoriesResponse struct {
	Items []oapi.Category `json:"items"`
}

type patchCategoryRequest struct {
	Name     *string          `json:"name"`
	ParentID *json.RawMessage `json:"parentId"`
	Sort     *int             `json:"sort"`
}

func (h *Handler) GetCatalogCategories(c *gin.Context) {
	categories, err := h.CatalogStore.ListCategories(c.Request.Context())
	if err != nil {
		h.logError("list categories failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list categories")
		return
	}

	items := make([]oapi.Category, 0, len(categories))
	for _, category := range categories {
		items = append(items, categoryFromModel(category))
	}

	c.JSON(http.StatusOK, catalogCategoriesResponse{Items: items})
}

func (h *Handler) GetCatalogCategoriesCategoryId(c *gin.Context, categoryId types.UUID) {
	category, err := h.CatalogStore.GetCategory(c.Request.Context(), uuid.UUID(categoryId))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "category not found")
			return
		}
		h.logError("get category failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch category")
		return
	}

	c.JSON(http.StatusOK, categoryFromModel(category))
}

func (h *Handler) PostCatalogCategories(c *gin.Context) {
	if _, ok := h.requireRole(c, "ADMIN"); !ok {
		return
	}

	var request oapi.CreateCategoryRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}
	if strings.TrimSpace(request.Name) == "" {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "name is required")
		return
	}

	parentID := pgtype.UUID{}
	if request.ParentId != nil {
		value := uuid.UUID(*request.ParentId)
		parentID = pgtype.UUID{Bytes: value, Valid: true}
	}

	sort := int32(0)
	if request.Sort != nil {
		sort = clampInt32(*request.Sort)
	}

	category, err := h.CatalogStore.CreateCategory(c.Request.Context(), db.CreateCategoryParams{
		Name:     request.Name,
		ParentID: parentID,
		Sort:     sort,
	})
	if err != nil {
		h.logError("create category failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to create category")
		return
	}

	c.JSON(http.StatusCreated, categoryFromModel(category))
}

func (h *Handler) PatchCatalogCategoriesCategoryId(c *gin.Context, categoryId types.UUID) {
	if _, ok := h.requireRole(c, "ADMIN"); !ok {
		return
	}

	var request patchCategoryRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}

	if request.Name == nil && request.ParentID == nil && request.Sort == nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "at least one field must be provided")
		return
	}

	var name *string
	if request.Name != nil {
		trimmed := strings.TrimSpace(*request.Name)
		if trimmed == "" {
			h.writeError(c, http.StatusBadRequest, "invalid_request", "name is required")
			return
		}
		name = &trimmed
	}

	parentIDSet := request.ParentID != nil
	parentID := pgtype.UUID{}
	if parentIDSet {
		raw := strings.TrimSpace(string(*request.ParentID))
		if raw != "" && raw != "null" {
			var parsed types.UUID
			if err := json.Unmarshal(*request.ParentID, &parsed); err != nil {
				h.writeError(c, http.StatusBadRequest, "invalid_request", "parentId must be a valid uuid or null")
				return
			}
			parentID = pgtype.UUID{Bytes: uuid.UUID(parsed), Valid: true}
		}
	}

	var sort *int32
	if request.Sort != nil {
		value := clampInt32(*request.Sort)
		sort = &value
	}

	category, err := h.CatalogStore.UpdateCategory(c.Request.Context(), db.UpdateCategoryParams{
		ID:          uuid.UUID(categoryId),
		Name:        name,
		ParentIDSet: parentIDSet,
		ParentID:    parentID,
		Sort:        sort,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "category not found")
			return
		}
		h.logError("update category failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to update category")
		return
	}

	c.JSON(http.StatusOK, categoryFromModel(category))
}

func (h *Handler) DeleteCatalogCategoriesCategoryId(c *gin.Context, categoryId types.UUID) {
	if _, ok := h.requireRole(c, "ADMIN"); !ok {
		return
	}

	affected, err := h.CatalogStore.DeleteCategory(c.Request.Context(), uuid.UUID(categoryId))
	if err != nil {
		h.logError("delete category failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to delete category")
		return
	}
	if affected == 0 {
		h.writeError(c, http.StatusNotFound, "not_found", "category not found")
		return
	}

	c.Status(http.StatusNoContent)
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
	offset32 := clampInt32(offset)
	limit32 := clampInt32(pageSize)

	categoryFilter := pgtype.UUID{}
	if params.CategoryId != nil {
		categoryFilter = pgtype.UUID{Bytes: *params.CategoryId, Valid: true}
	}

	products, err := h.CatalogStore.ListProducts(c.Request.Context(), db.ListProductsParams{
		Q:          params.Q,
		CategoryID: categoryFilter,
		Offset:     offset32,
		Limit:      limit32,
	})
	if err != nil {
		h.logError("list products failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list products")
		return
	}

	total, err := h.CatalogStore.CountProducts(c.Request.Context(), db.CountProductsParams{
		Q:          params.Q,
		CategoryID: categoryFilter,
	})
	if err != nil {
		h.logError("count products failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to list products")
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
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}
	if request.Name == "" {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "name is required")
		return
	}
	if request.CategoryId == (types.UUID{}) {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "categoryId is required")
		return
	}

	images := derefStringSlice(request.Images)
	tags := derefStringSlice(request.Tags)
	filters := derefStringSlice(request.FilterDimensions)

	product, err := h.CatalogStore.CreateProduct(c.Request.Context(), db.CreateProductParams{
		Name:             request.Name,
		Description:      request.Description,
		CategoryID:       request.CategoryId,
		CoverImageUrl:    request.CoverImageUrl,
		Images:           images,
		Tags:             tags,
		FilterDimensions: filters,
	})
	if err != nil {
		h.logError("create product failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to create product")
		return
	}

	detail, err := productDetailFromModel(product, nil, nil)
	if err != nil {
		h.logError("map product detail failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to create product")
		return
	}

	c.JSON(http.StatusCreated, detail)
}

func (h *Handler) GetCatalogProductsSpuId(c *gin.Context, spuId types.UUID) {
	product, err := h.CatalogStore.GetProduct(c.Request.Context(), spuId)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			h.writeError(c, http.StatusNotFound, "not_found", "product not found")
			return
		}
		h.logError("get product failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch product")
		return
	}

	skus, err := h.CatalogStore.ListSkusByProduct(c.Request.Context(), product.ID)
	if err != nil {
		h.logError("list skus failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch product")
		return
	}

	var priceTiers []db.CatalogPriceTier
	if len(skus) > 0 {
		skuIDs := make([]uuid.UUID, 0, len(skus))
		for _, sku := range skus {
			skuIDs = append(skuIDs, sku.ID)
		}
		priceTiers, err = h.CatalogStore.ListPriceTiersBySkus(c.Request.Context(), skuIDs)
		if err != nil {
			h.logError("list price tiers failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch product")
			return
		}
	}

	detail, err := productDetailFromModel(product, skus, priceTiers)
	if err != nil {
		h.logError("map product detail failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch product")
		return
	}

	c.JSON(http.StatusOK, detail)
}

func (h *Handler) PostCatalogProductsSpuIdSkus(c *gin.Context, spuId types.UUID) {
	if _, ok := h.requireRole(c, "ADMIN"); !ok {
		return
	}

	var request oapi.CreateSkuRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}
	if strings.TrimSpace(request.Name) == "" {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "name is required")
		return
	}

	attributes := map[string]string{}
	if request.Attributes != nil {
		attributes = *request.Attributes
	}
	spec := ""
	if request.Spec != nil {
		spec = strings.TrimSpace(*request.Spec)
	}
	if spec == "" {
		if value, ok := attributes["spec"]; ok {
			spec = strings.TrimSpace(value)
		}
	}
	delete(attributes, "spec")
	var specPtr *string
	if spec != "" {
		specPtr = &spec
	}
	attributesJSON, err := json.Marshal(attributes)
	if err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid attributes")
		return
	}

	isActive := true
	if request.IsActive != nil {
		isActive = *request.IsActive
	}

	sku, err := h.CatalogStore.CreateSku(c.Request.Context(), db.CreateSkuParams{
		ProductID:  uuid.UUID(spuId),
		SkuCode:    request.SkuCode,
		Name:       request.Name,
		Spec:       specPtr,
		Attributes: attributesJSON,
		Unit:       request.Unit,
		IsActive:   isActive,
	})
	if err != nil {
		h.logError("create sku failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to create sku")
		return
	}

	tiers := make([]db.CatalogPriceTier, 0, len(derefPriceTiers(request.PriceTiers)))
	for _, tier := range derefPriceTiers(request.PriceTiers) {
		minQty := clampInt32(tier.MinQty)
		var maxQty *int32
		if tier.MaxQty != nil {
			value := clampInt32(*tier.MaxQty)
			maxQty = &value
		}
		unitPrice := sharedmoney.FromInt64(tier.UnitPriceFen)
		createdTier, err := h.CatalogStore.CreatePriceTier(c.Request.Context(), db.CreatePriceTierParams{
			SkuID:        sku.ID,
			MinQty:       minQty,
			MaxQty:       maxQty,
			UnitPriceFen: unitPrice.Int64(),
		})
		if err != nil {
			h.logError("create price tier failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to create sku")
			return
		}
		tiers = append(tiers, createdTier)
	}

	response, err := skuFromModel(sku, tiers)
	if err != nil {
		h.logError("map sku failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to create sku")
		return
	}

	c.JSON(http.StatusCreated, response)
}

func (h *Handler) logError(message string, err error) {
	if h.Logger == nil {
		return
	}
	h.Logger.Error(message, "error", err)
}

func (h *Handler) writeError(c *gin.Context, status int, code, message string) {
	apierrors.Write(c, status, apierrors.APIError{
		Code:    code,
		Message: message,
	})
}

func (h *Handler) writeErrorWithDetails(c *gin.Context, status int, code, message string, details map[string]interface{}) {
	apierrors.Write(c, status, apierrors.APIError{
		Code:    code,
		Message: message,
		Details: details,
	})
}

func categoryFromModel(category db.CatalogCategory) oapi.Category {
	response := oapi.Category{
		Id:   category.ID,
		Name: category.Name,
		Sort: int(category.Sort),
	}
	if category.ParentID.Valid {
		parent := types.UUID(category.ParentID.Bytes)
		response.ParentId = &parent
	}
	return response
}
func productSummaryFromModel(product db.CatalogProduct) oapi.ProductSummary {
	summary := oapi.ProductSummary{
		Id:         product.ID,
		Name:       product.Name,
		CategoryId: product.CategoryID,
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

func productDetailFromModel(product db.CatalogProduct, skus []db.CatalogSku, tiers []db.CatalogPriceTier) (oapi.ProductDetail, error) {
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

	detail.Product.Id = product.ID
	detail.Product.Name = product.Name
	detail.Product.CategoryId = product.CategoryID
	detail.Product.Description = product.Description

	tiersBySku := map[uuid.UUID][]db.CatalogPriceTier{}
	for _, tier := range tiers {
		tiersBySku[tier.SkuID] = append(tiersBySku[tier.SkuID], tier)
	}

	detail.Skus = make([]oapi.SKU, 0, len(skus))
	for _, sku := range skus {
		mapped, err := skuFromModel(sku, tiersBySku[sku.ID])
		if err != nil {
			return oapi.ProductDetail{}, err
		}
		detail.Skus = append(detail.Skus, mapped)
	}

	return detail, nil
}

func skuFromModel(sku db.CatalogSku, tiers []db.CatalogPriceTier) (oapi.SKU, error) {
	response := oapi.SKU{
		Id:       sku.ID,
		SpuId:    sku.ProductID,
		Name:     sku.Name,
		IsActive: sku.IsActive,
	}
	if sku.SkuCode != nil {
		response.SkuCode = sku.SkuCode
	}
	if sku.Spec != nil {
		response.Spec = sku.Spec
	}
	if sku.Unit != nil {
		response.Unit = sku.Unit
	}
	if len(sku.Attributes) > 0 {
		var attrs map[string]string
		if err := json.Unmarshal(sku.Attributes, &attrs); err != nil {
			return oapi.SKU{}, err
		}
		if len(attrs) > 0 {
			response.Attributes = &attrs
		}
	}
	if len(tiers) > 0 {
		mapped := make([]oapi.PriceTier, 0, len(tiers))
		for _, tier := range tiers {
			unitPrice := sharedmoney.FromInt64(tier.UnitPriceFen)
			entry := oapi.PriceTier{
				MinQty:       int(tier.MinQty),
				UnitPriceFen: unitPrice.Int64(),
			}
			if tier.MaxQty != nil {
				value := int(*tier.MaxQty)
				entry.MaxQty = &value
			}
			mapped = append(mapped, entry)
		}
		response.PriceTiers = &mapped
	}
	return response, nil
}

func derefStringSlice(value *[]string) []string {
	if value == nil {
		return []string{}
	}
	out := make([]string, len(*value))
	copy(out, *value)
	return out
}

func derefPriceTiers(value *[]oapi.PriceTier) []oapi.PriceTier {
	if value == nil {
		return nil
	}
	out := make([]oapi.PriceTier, len(*value))
	copy(out, *value)
	return out
}

func clampInt32(value int) int32 {
	if value > math.MaxInt32 {
		return math.MaxInt32
	}
	if value < math.MinInt32 {
		return math.MinInt32
	}
	// #nosec G115 -- value is clamped to the int32 range above.
	return int32(value)
}
