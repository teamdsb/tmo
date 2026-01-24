package db

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	shareddb "github.com/teamdsb/tmo/packages/go-shared/db"
)

func NewPool(ctx context.Context, dsn string) (*pgxpool.Pool, error) {
	return shareddb.NewPool(ctx, dsn)
}

func Ready(ctx context.Context, pool *pgxpool.Pool) error {
	return shareddb.Ready(ctx, pool)
}
