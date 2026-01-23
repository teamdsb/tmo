package cart

import (
	"context"

	"github.com/google/uuid"
	"github.com/teamdsb/tmo/services/commerce/internal/db"
)

type Store interface {
	UpsertCartItem(ctx context.Context, arg db.UpsertCartItemParams) (db.CartItem, error)
	ListCartItems(ctx context.Context, ownerID uuid.UUID) ([]db.CartItem, error)
	UpdateCartItemQty(ctx context.Context, arg db.UpdateCartItemQtyParams) (db.CartItem, error)
	DeleteCartItem(ctx context.Context, arg db.DeleteCartItemParams) error
	DeleteCartItemsBySkuIDs(ctx context.Context, arg db.DeleteCartItemsBySkuIDsParams) error
	CreateCartImportJob(ctx context.Context, arg db.CreateCartImportJobParams) (db.CartImportJob, error)
	UpdateCartImportJobCounts(ctx context.Context, arg db.UpdateCartImportJobCountsParams) error
	GetCartImportJob(ctx context.Context, id uuid.UUID) (db.CartImportJob, error)
	CreateCartImportRow(ctx context.Context, arg db.CreateCartImportRowParams) (db.CartImportRow, error)
	ListCartImportRows(ctx context.Context, jobID uuid.UUID) ([]db.CartImportRow, error)
	UpdateCartImportRowSelection(ctx context.Context, arg db.UpdateCartImportRowSelectionParams) error
}
