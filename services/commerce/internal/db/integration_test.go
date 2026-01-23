package db

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestCatalogQueries(t *testing.T) {
	pool := openTestPool(t)
	ctx := context.Background()

	if _, err := pool.Exec(ctx, "TRUNCATE catalog_products CASCADE"); err != nil {
		t.Fatalf("truncate catalog_products: %v", err)
	}

	queries := New(pool)
	categoryID := uuid.New()
	cover := "https://example.com/steel.jpg"
	description := "Schedule 40"
	images := []string{"https://example.com/steel.jpg"}
	tags := []string{"steel", "pipe"}
	filters := []string{"material", "length"}

	product, err := queries.CreateProduct(ctx, CreateProductParams{
		Name:             "Steel Pipe",
		Description:      &description,
		CategoryID:       categoryID,
		CoverImageUrl:    &cover,
		Images:           images,
		Tags:             tags,
		FilterDimensions: filters,
	})
	if err != nil {
		t.Fatalf("create product: %v", err)
	}
	if product.ID == uuid.Nil {
		t.Fatalf("expected product id to be set")
	}

	list, err := queries.ListProducts(ctx, ListProductsParams{
		Q:          stringPtr("Steel"),
		CategoryID: pgtype.UUID{Bytes: categoryID, Valid: true},
		Offset:     0,
		Limit:      10,
	})
	if err != nil {
		t.Fatalf("list products: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 product, got %d", len(list))
	}

	total, err := queries.CountProducts(ctx, CountProductsParams{
		Q:          stringPtr("Steel"),
		CategoryID: pgtype.UUID{Bytes: categoryID, Valid: true},
	})
	if err != nil {
		t.Fatalf("count products: %v", err)
	}
	if total != 1 {
		t.Fatalf("expected total 1, got %d", total)
	}

	fetched, err := queries.GetProduct(ctx, product.ID)
	if err != nil {
		t.Fatalf("get product: %v", err)
	}
	if fetched.Name != "Steel Pipe" || fetched.CategoryID != categoryID {
		t.Fatalf("unexpected fetched product: %+v", fetched)
	}
}

func openTestPool(t *testing.T) *pgxpool.Pool {
	t.Helper()

	dsn := os.Getenv("COMMERCE_DB_DSN")
	if dsn == "" {
		t.Skip("COMMERCE_DB_DSN is not set; skipping integration test")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := connectWithRetry(ctx, dsn)
	if err != nil {
		t.Fatalf("connect to database: %v", err)
	}

	migrationsDir := filepath.Join("..", "..", "migrations")
	if err := ApplyMigrations(ctx, pool, migrationsDir); err != nil {
		pool.Close()
		t.Fatalf("apply migrations: %v", err)
	}

	t.Cleanup(func() {
		pool.Close()
	})

	return pool
}

func connectWithRetry(ctx context.Context, dsn string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, err
	}

	for attempt := 0; attempt < 10; attempt++ {
		if err := pool.Ping(ctx); err == nil {
			return pool, nil
		}
		select {
		case <-time.After(2 * time.Second):
		case <-ctx.Done():
			pool.Close()
			return nil, ctx.Err()
		}
	}

	pool.Close()
	return nil, fmt.Errorf("database did not become ready")
}

func stringPtr(value string) *string {
	return &value
}
