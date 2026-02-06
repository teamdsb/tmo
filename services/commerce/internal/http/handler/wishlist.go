package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/oapi-codegen/runtime/types"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/http/oapi"
)

type wishlistResponse struct {
	Items []oapi.WishlistItem `json:"items"`
}

func (h *Handler) GetWishlist(c *gin.Context) {
	claims, ok := h.requireRole(c, "CUSTOMER", "ADMIN")
	if !ok {
		return
	}

	items, err := h.WishlistStore.ListWishlistItems(c.Request.Context(), claims.UserID)
	if err != nil {
		h.logError("list wishlist items failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch wishlist")
		return
	}

	skuIDs := make([]uuid.UUID, 0, len(items))
	for _, item := range items {
		skuIDs = append(skuIDs, item.SkuID)
	}

	skuMap, err := h.loadSkusWithTiers(c.Request.Context(), skuIDs)
	if err != nil {
		h.logError("load skus failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch wishlist")
		return
	}

	response := wishlistResponse{
		Items: make([]oapi.WishlistItem, 0, len(items)),
	}
	for _, item := range items {
		sku, ok := skuMap[item.SkuID]
		if !ok {
			h.logError("sku missing for wishlist item", errors.New("sku not found"))
			h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to fetch wishlist")
			return
		}
		response.Items = append(response.Items, oapi.WishlistItem{
			Sku:       sku,
			CreatedAt: item.CreatedAt.Time,
		})
	}

	c.JSON(http.StatusOK, response)
}

func (h *Handler) PostWishlist(c *gin.Context) {
	claims, ok := h.requireRole(c, "CUSTOMER", "ADMIN")
	if !ok {
		return
	}

	var request oapi.PostWishlistJSONBody
	if err := c.ShouldBindJSON(&request); err != nil {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid request body")
		return
	}
	if request.SkuId == (types.UUID{}) {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "skuId is required")
		return
	}

	skuID := uuid.UUID(request.SkuId)
	skus, err := h.CatalogStore.ListSkusByIDs(c.Request.Context(), []uuid.UUID{skuID})
	if err != nil {
		h.logError("list skus failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to add wishlist item")
		return
	}
	if len(skus) == 0 {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "invalid skuId")
		return
	}
	if !skus[0].IsActive {
		h.writeError(c, http.StatusBadRequest, "invalid_request", "sku is inactive")
		return
	}

	if err := h.WishlistStore.CreateWishlistItem(c.Request.Context(), db.CreateWishlistItemParams{
		OwnerUserID: claims.UserID,
		SkuID:       skuID,
	}); err != nil {
		h.logError("create wishlist item failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to add wishlist item")
		return
	}

	c.Status(http.StatusNoContent)
}

func (h *Handler) DeleteWishlistSkuId(c *gin.Context, skuId types.UUID) {
	claims, ok := h.requireRole(c, "CUSTOMER", "ADMIN")
	if !ok {
		return
	}

	if err := h.WishlistStore.DeleteWishlistItem(c.Request.Context(), db.DeleteWishlistItemParams{
		OwnerUserID: claims.UserID,
		SkuID:       uuid.UUID(skuId),
	}); err != nil {
		h.logError("delete wishlist item failed", err)
		h.writeError(c, http.StatusInternalServerError, "internal_error", "failed to remove wishlist item")
		return
	}

	c.Status(http.StatusNoContent)
}
