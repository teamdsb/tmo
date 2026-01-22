package handler

import (
	"context"

	"github.com/google/uuid"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/http/oapi"
)

func (h *Handler) loadSkusWithTiers(ctx context.Context, skuIDs []uuid.UUID) (map[uuid.UUID]oapi.SKU, error) {
	unique := uniqueUUIDs(skuIDs)
	result := make(map[uuid.UUID]oapi.SKU, len(unique))
	if len(unique) == 0 {
		return result, nil
	}

	skus, err := h.CatalogStore.ListSkusByIDs(ctx, unique)
	if err != nil {
		return nil, err
	}

	tiers, err := h.CatalogStore.ListPriceTiersBySkus(ctx, unique)
	if err != nil {
		return nil, err
	}

	tiersBySku := map[uuid.UUID][]db.CatalogPriceTier{}
	for _, tier := range tiers {
		tiersBySku[tier.SkuID] = append(tiersBySku[tier.SkuID], tier)
	}

	for _, sku := range skus {
		mapped, err := skuFromModel(sku, tiersBySku[sku.ID])
		if err != nil {
			return nil, err
		}
		result[sku.ID] = mapped
	}

	return result, nil
}

func uniqueUUIDs(values []uuid.UUID) []uuid.UUID {
	seen := make(map[uuid.UUID]struct{}, len(values))
	unique := make([]uuid.UUID, 0, len(values))
	for _, value := range values {
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		unique = append(unique, value)
	}
	return unique
}
