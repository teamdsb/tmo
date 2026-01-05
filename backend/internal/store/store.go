package store

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

var ErrNotFound = errors.New("not found")

type Store interface {
	CreateSales(ctx context.Context, name string) (SalesProfile, error)
	CreateCustomer(ctx context.Context, name string, phone string) (Customer, error)
	GetCustomer(ctx context.Context, id uuid.UUID) (Customer, error)
	GetSalesByBindCode(ctx context.Context, bindCode string) (SalesProfile, error)
	BindCustomerToSales(ctx context.Context, customerID uuid.UUID, salesID uuid.UUID) (bool, error)
	TransferCustomer(ctx context.Context, customerID uuid.UUID, newSalesID uuid.UUID) (uuid.UUID, error)
}
