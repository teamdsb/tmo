package address

import (
	"context"

	"github.com/google/uuid"
	"github.com/teamdsb/tmo/services/commerce/internal/db"
)

type Store interface {
	ListUserAddresses(ctx context.Context, userID uuid.UUID) ([]db.UserAddress, error)
	CountUserAddresses(ctx context.Context, userID uuid.UUID) (int64, error)
	CreateUserAddress(ctx context.Context, arg db.CreateUserAddressParams) (db.UserAddress, error)
	GetUserAddress(ctx context.Context, arg db.GetUserAddressParams) (db.UserAddress, error)
	ClearUserDefaultAddresses(ctx context.Context, userID uuid.UUID) error
	UpdateUserAddress(ctx context.Context, arg db.UpdateUserAddressParams) (db.UserAddress, error)
	DeleteUserAddress(ctx context.Context, arg db.DeleteUserAddressParams) (db.UserAddress, error)
	GetLatestUserAddress(ctx context.Context, userID uuid.UUID) (db.UserAddress, error)
	SetUserAddressDefault(ctx context.Context, arg db.SetUserAddressDefaultParams) (db.UserAddress, error)
}
