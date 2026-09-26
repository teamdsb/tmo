package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"slices"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/teamdsb/tmo/packages/go-shared/catalogspec"
	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/http/oapi"
	"github.com/teamdsb/tmo/services/commerce/internal/modules/catalog"
)

// Catalog SKU writes preserve omitted fields on existing records. An empty
// priceTiers array explicitly clears prices; omitting it preserves exact fen.
type catalogSkuWrite struct {
	ID         *uuid.UUID             `json:"id"`
	Name       string                 `json:"name"`
	SkuCode    optionalNullableString `json:"skuCode"`
	Spec       optionalNullableString `json:"spec"`
	Attributes *map[string]string     `json:"attributes"`
	Unit       optionalNullableString `json:"unit"`
	IsActive   *bool                  `json:"isActive"`
	PriceTiers *[]oapi.PriceTier      `json:"priceTiers"`
}

type catalogValidationError struct{ message string }

func (e catalogValidationError) Error() string { return e.message }
func invalidCatalog(format string, args ...any) error {
	return catalogValidationError{fmt.Sprintf(format, args...)}
}

// Every catalog writer locks the parent product, so validating a complete
// combination set and subsequently writing it cannot race another SKU writer.
func (h *Handler) catalogWrite(c *gin.Context, productID uuid.UUID, status int, write func(catalog.Store, db.CatalogProduct) (any, error)) {
	ctx := c.Request.Context()
	var result any
	var err error
	if h.DB == nil {
		var product db.CatalogProduct
		product, err = h.CatalogStore.GetProduct(ctx, productID)
		if err == nil {
			result, err = write(h.CatalogStore, product)
		}
	} else {
		var tx pgx.Tx
		tx, err = h.DB.Begin(ctx)
		if err == nil {
			defer func() { _ = tx.Rollback(ctx) }()
			q := db.New(tx)
			var product db.CatalogProduct
			product, err = q.GetProductForUpdate(ctx, productID)
			if err == nil {
				result, err = write(q, product)
			}
			if err == nil {
				var pending bool
				pending, err = q.ProductActiveWithPendingReview(ctx, productID)
				if err == nil && pending {
					err = invalidCatalog("商品存在待复核导入问题，请完成复核后上架")
				}
			}
			if err == nil {
				err = tx.Commit(ctx)
			}
		}
	}
	if err != nil {
		var validation catalogValidationError
		var pgErr *pgconn.PgError
		switch {
		case errors.As(err, &validation):
			h.writeError(c, http.StatusBadRequest, "invalid_request", validation.Error())
		case errors.Is(err, pgx.ErrNoRows):
			h.writeError(c, http.StatusNotFound, "not_found", "product or SKU not found")
		case errors.As(err, &pgErr) && (pgErr.Code == "23505" || pgErr.Code == "23503"):
			h.writeError(c, http.StatusBadRequest, "invalid_request", "SKU code conflicts or referenced catalog record does not exist")
		default:
			h.logError("catalog transaction failed", err)
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to save catalog")
		}
		return
	}
	c.JSON(status, result)
}

func catalogDetail(ctx context.Context, store catalog.Store, product db.CatalogProduct) (oapi.ProductDetail, error) {
	skus, err := store.ListSkusByProduct(ctx, product.ID)
	if err != nil {
		return oapi.ProductDetail{}, err
	}
	var tiers []db.CatalogPriceTier
	if len(skus) > 0 {
		ids := make([]uuid.UUID, len(skus))
		for i, sku := range skus {
			ids[i] = sku.ID
		}
		tiers, err = store.ListPriceTiersBySkus(ctx, ids)
		if err != nil {
			return oapi.ProductDetail{}, err
		}
	}
	return productDetailFromModel(product, skus, tiers)
}

func variantsFromModels(skus []db.CatalogSku) ([]catalogspec.Variant, error) {
	result := make([]catalogspec.Variant, 0, len(skus))
	for _, sku := range skus {
		attrs := map[string]string{}
		if len(sku.Attributes) > 0 {
			if err := json.Unmarshal(sku.Attributes, &attrs); err != nil {
				return nil, err
			}
		}
		spec := ""
		if sku.Spec != nil {
			spec = *sku.Spec
		}
		result = append(result, catalogspec.Variant{ID: sku.ID.String(), Name: sku.Name, Spec: spec, Attributes: attrs, Active: sku.IsActive})
	}
	return result, nil
}

func prepareSku(product db.CatalogProduct, input catalogSkuWrite, existing *db.CatalogSku) (db.CatalogSku, error) {
	sku := db.CatalogSku{ID: uuid.New(), ProductID: product.ID, IsActive: true}
	if existing != nil {
		sku = *existing
	}
	sku.Name = strings.TrimSpace(input.Name)
	if sku.Name == "" {
		return sku, invalidCatalog("SKU name is required")
	}
	if input.SkuCode.Set {
		sku.SkuCode = trimNullable(input.SkuCode.Value)
	}
	if input.Spec.Set {
		sku.Spec = trimNullable(input.Spec.Value)
	}
	if input.Unit.Set {
		sku.Unit = trimNullable(input.Unit.Value)
	}
	if input.IsActive != nil {
		sku.IsActive = *input.IsActive
	}
	attrs := map[string]string{}
	if len(sku.Attributes) > 0 {
		if err := json.Unmarshal(sku.Attributes, &attrs); err != nil {
			return sku, err
		}
	}
	if input.Attributes != nil {
		attrs = *input.Attributes
	}
	if attrs == nil {
		attrs = map[string]string{}
	}
	if len(product.FilterDimensions) > 0 {
		normalized, spec, err := catalogspec.NormalizeValues(product.FilterDimensions, attrs)
		if err != nil && sku.IsActive {
			return sku, invalidCatalog("%s", err)
		}
		if err == nil {
			attrs = normalized
			sku.Spec = &spec
		}
	} else {
		if sku.Spec == nil {
			sku.Spec = trimNullable(catalogStringPtr(attrs["spec"]))
		}
		// Copy before removing legacy fallback, never mutate an incoming map.
		clone := map[string]string{}
		for key, value := range attrs {
			if key != "spec" {
				clone[key] = value
			}
		}
		attrs = clone
	}
	var err error
	sku.Attributes, err = json.Marshal(attrs)
	if err != nil {
		return sku, err
	}
	if input.PriceTiers != nil {
		tiers := *input.PriceTiers
		for i, tier := range tiers {
			if tier.MinQty < 1 || tier.MinQty > math.MaxInt32 || tier.UnitPriceFen < 0 ||
				(tier.MaxQty != nil && (*tier.MaxQty < tier.MinQty || *tier.MaxQty > math.MaxInt32)) {
				return sku, invalidCatalog("invalid price tier %d", i+1)
			}
			if i > 0 && (tiers[i-1].MaxQty == nil || tier.MinQty <= *tiers[i-1].MaxQty) {
				return sku, invalidCatalog("price tiers must be ordered and non-overlapping")
			}
		}
	}
	return sku, nil
}

func trimNullable(value *string) *string {
	if value == nil {
		return nil
	}
	clean := strings.TrimSpace(*value)
	if clean == "" {
		return nil
	}
	return &clean
}
func catalogStringPtr(value string) *string { return &value }

func persistSku(ctx context.Context, store catalog.Store, sku db.CatalogSku, exists bool, tiers *[]oapi.PriceTier) (db.CatalogSku, error) {
	var result db.CatalogSku
	var err error
	if exists {
		result, err = store.UpdateSku(ctx, db.UpdateSkuParams{ID: sku.ID, SkuCode: sku.SkuCode, Name: sku.Name, Spec: sku.Spec, Attributes: sku.Attributes, Unit: sku.Unit, IsActive: sku.IsActive})
	} else {
		result, err = store.CreateSku(ctx, db.CreateSkuParams{ProductID: sku.ProductID, SkuCode: sku.SkuCode, Name: sku.Name, Spec: sku.Spec, Attributes: sku.Attributes, Unit: sku.Unit, IsActive: sku.IsActive})
	}
	if err != nil {
		return result, err
	}
	if tiers != nil {
		if _, err = store.DeletePriceTiersBySku(ctx, result.ID); err != nil {
			return result, err
		}
		for _, tier := range *tiers {
			var max *int32
			if tier.MaxQty != nil {
				v := clampInt32(*tier.MaxQty)
				max = &v
			}
			if _, err = store.CreatePriceTier(ctx, db.CreatePriceTierParams{SkuID: result.ID, MinQty: clampInt32(tier.MinQty), MaxQty: max, UnitPriceFen: tier.UnitPriceFen}); err != nil {
				return result, err
			}
		}
	}
	return result, nil
}

func (h *Handler) patchCatalogProduct(c *gin.Context, productID uuid.UUID, request patchProductRequest) {
	h.catalogWrite(c, productID, http.StatusOK, func(store catalog.Store, existing db.CatalogProduct) (any, error) {
		ctx := c.Request.Context()
		next := existing
		if request.Name != nil {
			next.Name = strings.TrimSpace(*request.Name)
			if next.Name == "" {
				return nil, invalidCatalog("name is required")
			}
		}
		if request.CategoryID != nil {
			if *request.CategoryID == (uuid.UUID{}) {
				return nil, invalidCatalog("categoryId is required")
			}
			next.CategoryID = *request.CategoryID
		}
		if request.Description.Set {
			next.Description = request.Description.Value
		}
		if request.CoverImageURL.Set {
			next.CoverImageUrl = request.CoverImageURL.Value
		}
		if request.Images != nil {
			next.Images = append([]string{}, (*request.Images)...)
		}
		if len(next.Images) > maxCatalogProductImages {
			return nil, invalidCatalog("images supports at most 9 items")
		}
		if request.Tags != nil {
			next.Tags = append([]string{}, (*request.Tags)...)
		}
		if request.FilterDimensions != nil {
			var err error
			next.FilterDimensions, err = catalogspec.NormalizeDimensions(*request.FilterDimensions)
			if err != nil {
				return nil, invalidCatalog("%s", err)
			}
		}
		if request.Status != nil {
			status, ok := normalizeProductStatus(*request.Status)
			if !ok {
				return nil, invalidCatalog("status must be ACTIVE, INACTIVE, or DRAFT")
			}
			next.Status = status
		}
		oldSkus, err := store.ListSkusByProduct(ctx, productID)
		if err != nil {
			return nil, err
		}
		byID := map[uuid.UUID]db.CatalogSku{}
		for _, sku := range oldSkus {
			byID[sku.ID] = sku
		}
		finalSkus := oldSkus
		if request.Skus != nil {
			finalSkus = make([]db.CatalogSku, 0, len(*request.Skus))
			seen := map[uuid.UUID]bool{}
			for _, input := range *request.Skus {
				var old *db.CatalogSku
				if input.ID != nil {
					value, ok := byID[*input.ID]
					if !ok {
						return nil, invalidCatalog("SKU id does not belong to this product")
					}
					if seen[value.ID] {
						return nil, invalidCatalog("duplicate SKU id")
					}
					seen[value.ID] = true
					old = &value
				}
				if old != nil && !slices.Equal(existing.FilterDimensions, next.FilterDimensions) && input.Attributes != nil {
					var oldAttributes map[string]string
					if err := json.Unmarshal(old.Attributes, &oldAttributes); err != nil {
						return nil, err
					}
					for _, dimension := range next.FilterDimensions {
						value, exists := oldAttributes[dimension]
						if exists && !slices.Contains(existing.FilterDimensions, dimension) && value != (*input.Attributes)[dimension] {
							return nil, invalidCatalog("specification name %q conflicts with an existing extension attribute", dimension)
						}
					}
				}
				sku, err := prepareSku(next, input, old)
				if err != nil {
					return nil, err
				}
				finalSkus = append(finalSkus, sku)
			}
		}
		if request.Skus != nil || request.FilterDimensions != nil {
			variants, err := variantsFromModels(finalSkus)
			if err != nil {
				return nil, err
			}
			if err = catalogspec.ValidateCombinations(next.FilterDimensions, variants); err != nil {
				return nil, invalidCatalog("%s", err)
			}
		}
		product, err := store.UpdateProduct(ctx, db.UpdateProductParams{ID: productID, Name: next.Name, Description: next.Description, CategoryID: next.CategoryID, CoverImageUrl: next.CoverImageUrl, Images: next.Images, Tags: next.Tags, FilterDimensions: next.FilterDimensions, Status: next.Status})
		if err != nil {
			return nil, err
		}
		if request.Skus != nil {
			retained := map[uuid.UUID]bool{}
			for i, sku := range finalSkus {
				input := (*request.Skus)[i]
				if input.ID != nil {
					retained[*input.ID] = true
				}
				if _, err = persistSku(ctx, store, sku, input.ID != nil, input.PriceTiers); err != nil {
					return nil, err
				}
			}
			for _, sku := range oldSkus {
				if retained[sku.ID] || !sku.IsActive {
					continue
				}
				sku.IsActive = false
				if _, err = persistSku(ctx, store, sku, true, nil); err != nil {
					return nil, err
				}
			}
		} else if request.FilterDimensions != nil && !slices.Equal(existing.FilterDimensions, next.FilterDimensions) {
			// A dimension-only update may change order; keep the summary in sync.
			for _, sku := range oldSkus {
				if !sku.IsActive {
					continue
				}
				normalized, err := prepareSku(next, catalogSkuWrite{Name: sku.Name}, &sku)
				if err != nil {
					return nil, err
				}
				if _, err = persistSku(ctx, store, normalized, true, nil); err != nil {
					return nil, err
				}
			}
		}
		return catalogDetail(ctx, store, product)
	})
}

func (h *Handler) writeCatalogSku(c *gin.Context, productID uuid.UUID, skuID *uuid.UUID) {
	var request catalogSkuWrite
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, 400, "invalid_request", "invalid request body")
		return
	}
	if strings.TrimSpace(request.Name) == "" {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "SKU name is required")
		return
	}
	status := http.StatusCreated
	if skuID != nil {
		status = http.StatusOK
	}
	h.catalogWrite(c, productID, status, func(store catalog.Store, product db.CatalogProduct) (any, error) {
		ctx := c.Request.Context()
		skus, err := store.ListSkusByProduct(ctx, productID)
		if err != nil {
			return nil, err
		}
		var old *db.CatalogSku
		if skuID != nil {
			for _, sku := range skus {
				if sku.ID == *skuID {
					value := sku
					old = &value
					break
				}
			}
			if old == nil {
				return nil, pgx.ErrNoRows
			}
		}
		next, err := prepareSku(product, request, old)
		if err != nil {
			return nil, err
		}
		finalSkus := make([]db.CatalogSku, 0, len(skus)+1)
		for _, sku := range skus {
			if skuID == nil || sku.ID != *skuID {
				finalSkus = append(finalSkus, sku)
			}
		}
		finalSkus = append(finalSkus, next)
		variants, err := variantsFromModels(finalSkus)
		if err != nil {
			return nil, err
		}
		if err = catalogspec.ValidateCombinations(product.FilterDimensions, variants); err != nil {
			return nil, invalidCatalog("%s", err)
		}
		sku, err := persistSku(ctx, store, next, old != nil, request.PriceTiers)
		if err != nil {
			return nil, err
		}
		tiers, err := store.ListPriceTiersBySku(ctx, sku.ID)
		if err != nil {
			return nil, err
		}
		return skuFromModel(sku, tiers)
	})
}
