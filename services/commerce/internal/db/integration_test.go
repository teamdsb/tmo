package db

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestCatalogQueries(t *testing.T) {
	pool := openTestPool(t)
	ctx := context.Background()

	if _, err := pool.Exec(ctx, "TRUNCATE catalog_products"); err != nil {
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

	if err := applyMigrations(ctx, pool); err != nil {
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

func applyMigrations(ctx context.Context, pool *pgxpool.Pool) error {
	path := filepath.Join("..", "..", "migrations", "00001_create_catalog_products.sql")
	// #nosec G304 -- path is a fixed, repo-local migration file for tests.
	content, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read migration: %w", err)
	}

	upSQL := extractGooseUp(string(content))
	statements := splitSQLStatements(upSQL)
	for _, statement := range statements {
		if _, err := pool.Exec(ctx, statement); err != nil {
			return fmt.Errorf("exec migration statement: %w", err)
		}
	}

	return nil
}

func extractGooseUp(content string) string {
	lines := strings.Split(content, "\n")
	inUp := false
	var builder strings.Builder
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "-- +goose Up") {
			inUp = true
			continue
		}
		if strings.HasPrefix(trimmed, "-- +goose Down") {
			break
		}
		if !inUp {
			continue
		}
		if strings.HasPrefix(trimmed, "-- +goose") {
			continue
		}
		builder.WriteString(line)
		builder.WriteString("\n")
	}
	return builder.String()
}

func splitSQLStatements(sql string) []string {
	parts := strings.Split(sql, ";")
	statements := make([]string, 0, len(parts))
	for _, part := range parts {
		statement := strings.TrimSpace(part)
		if statement == "" {
			continue
		}
		statements = append(statements, statement)
	}
	return statements
}

func stringPtr(value string) *string {
	return &value
}
