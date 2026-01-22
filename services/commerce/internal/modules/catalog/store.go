package catalog

import (
	"context"

	"github.com/google/uuid"
	"github.com/teamdsb/tmo/services/commerce/internal/db"
)

type Store interface {
	CreateProduct(ctx context.Context, arg db.CreateProductParams) (db.CatalogProduct, error)
	ListProducts(ctx context.Context, arg db.ListProductsParams) ([]db.CatalogProduct, error)
	CountProducts(ctx context.Context, arg db.CountProductsParams) (int64, error)
	GetProduct(ctx context.Context, id uuid.UUID) (db.CatalogProduct, error)
	CreateCategory(ctx context.Context, arg db.CreateCategoryParams) (db.CatalogCategory, error)
	ListCategories(ctx context.Context) ([]db.CatalogCategory, error)
	CreateSku(ctx context.Context, arg db.CreateSkuParams) (db.CatalogSku, error)
	ListSkusByProduct(ctx context.Context, productID uuid.UUID) ([]db.CatalogSku, error)
	ListSkusByIDs(ctx context.Context, ids []uuid.UUID) ([]db.CatalogSku, error)
	ListSkusBySkuCode(ctx context.Context, skuCode *string) ([]db.CatalogSku, error)
	ListSkusByName(ctx context.Context, name string) ([]db.CatalogSku, error)
	ListSkusByNameAndSpec(ctx context.Context, arg db.ListSkusByNameAndSpecParams) ([]db.CatalogSku, error)
	CreatePriceTier(ctx context.Context, arg db.CreatePriceTierParams) (db.CatalogPriceTier, error)
	ListPriceTiersBySku(ctx context.Context, skuID uuid.UUID) ([]db.CatalogPriceTier, error)
	ListPriceTiersBySkus(ctx context.Context, skuIDs []uuid.UUID) ([]db.CatalogPriceTier, error)
}
