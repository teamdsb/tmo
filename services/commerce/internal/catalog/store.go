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
}
