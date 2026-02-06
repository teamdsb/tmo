package productrequest

import (
	"context"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
)

type Store interface {
	CreateProductRequest(ctx context.Context, arg db.CreateProductRequestParams) (db.ProductRequest, error)
	ListProductRequests(ctx context.Context, arg db.ListProductRequestsParams) ([]db.ProductRequest, error)
	CountProductRequests(ctx context.Context, arg db.CountProductRequestsParams) (int64, error)
}
