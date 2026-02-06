package wishlist

import (
	"context"

	"github.com/google/uuid"
	"github.com/teamdsb/tmo/services/commerce/internal/db"
)

type Store interface {
	ListWishlistItems(ctx context.Context, ownerID uuid.UUID) ([]db.WishlistItem, error)
	CreateWishlistItem(ctx context.Context, arg db.CreateWishlistItemParams) error
	DeleteWishlistItem(ctx context.Context, arg db.DeleteWishlistItemParams) error
}
