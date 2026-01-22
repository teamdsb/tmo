package order

import (
	"context"

	"github.com/google/uuid"
	"github.com/teamdsb/tmo/services/commerce/internal/db"
)

type Store interface {
	CreateOrder(ctx context.Context, arg db.CreateOrderParams) (db.Order, error)
	CreateOrderItem(ctx context.Context, arg db.CreateOrderItemParams) (db.OrderItem, error)
	ListOrders(ctx context.Context, arg db.ListOrdersParams) ([]db.Order, error)
	CountOrders(ctx context.Context, arg db.CountOrdersParams) (int64, error)
	GetOrder(ctx context.Context, id uuid.UUID) (db.Order, error)
	ListOrderItems(ctx context.Context, orderID uuid.UUID) ([]db.OrderItem, error)
	GetOrderByIdempotencyKey(ctx context.Context, arg db.GetOrderByIdempotencyKeyParams) (db.Order, error)
}
