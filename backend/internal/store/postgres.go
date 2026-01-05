package store

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresStore struct {
	pool *pgxpool.Pool
}

func NewPostgresStore(pool *pgxpool.Pool) *PostgresStore {
	return &PostgresStore{pool: pool}
}

func (s *PostgresStore) CreateSales(ctx context.Context, name string) (SalesProfile, error) {
	for i := 0; i < 3; i++ {
		id := uuid.New()
		bindCode := newBindCode()

		var createdAt time.Time
		err := s.pool.QueryRow(ctx,
			"INSERT INTO sales_profiles (id, name, bind_code) VALUES ($1, $2, $3) RETURNING created_at",
			id, name, bindCode,
		).Scan(&createdAt)
		if err != nil {
			if isUniqueViolation(err) {
				continue
			}
			return SalesProfile{}, err
		}

		return SalesProfile{
			ID:        id,
			Name:      name,
			BindCode:  bindCode,
			CreatedAt: createdAt,
		}, nil
	}

	return SalesProfile{}, errors.New("failed to generate unique bind_code")
}

func (s *PostgresStore) CreateCustomer(ctx context.Context, name string, phone string) (Customer, error) {
	id := uuid.New()
	var createdAt time.Time
	err := s.pool.QueryRow(ctx,
		"INSERT INTO customers (id, name, phone) VALUES ($1, $2, $3) RETURNING created_at",
		id, name, phone,
	).Scan(&createdAt)
	if err != nil {
		return Customer{}, err
	}

	return Customer{
		ID:        id,
		Name:      name,
		Phone:     phone,
		SalesID:   nil,
		CreatedAt: createdAt,
	}, nil
}

func (s *PostgresStore) GetCustomer(ctx context.Context, id uuid.UUID) (Customer, error) {
	var customer Customer
	var salesID *uuid.UUID

	err := s.pool.QueryRow(ctx,
		"SELECT id, name, phone, sales_id, created_at FROM customers WHERE id = $1",
		id,
	).Scan(&customer.ID, &customer.Name, &customer.Phone, &salesID, &customer.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Customer{}, ErrNotFound
		}
		return Customer{}, err
	}

	customer.SalesID = salesID
	return customer, nil
}

func (s *PostgresStore) GetSalesByBindCode(ctx context.Context, bindCode string) (SalesProfile, error) {
	var sales SalesProfile
	var createdAt time.Time

	err := s.pool.QueryRow(ctx,
		"SELECT id, name, bind_code, created_at FROM sales_profiles WHERE bind_code = $1",
		bindCode,
	).Scan(&sales.ID, &sales.Name, &sales.BindCode, &createdAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SalesProfile{}, ErrNotFound
		}
		return SalesProfile{}, err
	}

	sales.CreatedAt = createdAt
	return sales, nil
}

func (s *PostgresStore) BindCustomerToSales(ctx context.Context, customerID uuid.UUID, salesID uuid.UUID) (bool, error) {
	res, err := s.pool.Exec(ctx,
		"UPDATE customers SET sales_id = $1 WHERE id = $2 AND sales_id IS NULL",
		salesID, customerID,
	)
	if err != nil {
		return false, err
	}
	if res.RowsAffected() == 0 {
		var existing *uuid.UUID
		err := s.pool.QueryRow(ctx,
			"SELECT sales_id FROM customers WHERE id = $1",
			customerID,
		).Scan(&existing)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return false, ErrNotFound
			}
			return false, err
		}

		return false, nil
	}

	return true, nil
}

func (s *PostgresStore) TransferCustomer(ctx context.Context, customerID uuid.UUID, newSalesID uuid.UUID) (uuid.UUID, error) {
	var oldSalesID *uuid.UUID
	if err := s.pool.QueryRow(ctx,
		"SELECT sales_id FROM customers WHERE id = $1",
		customerID,
	).Scan(&oldSalesID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return uuid.Nil, ErrNotFound
		}
		return uuid.Nil, err
	}

	if _, err := s.pool.Exec(ctx,
		"UPDATE customers SET sales_id = $1 WHERE id = $2",
		newSalesID, customerID,
	); err != nil {
		return uuid.Nil, err
	}

	if oldSalesID == nil {
		return uuid.Nil, nil
	}
	return *oldSalesID, nil
}

func newBindCode() string {
	return strings.ReplaceAll(uuid.NewString(), "-", "")
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}
	return false
}

var _ Store = (*PostgresStore)(nil)
