package db

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

func TestCatalogCategoryQueries(test *testing.T) {
	pool := openTestPool(test)
	ctx := context.Background()

	if _, err := pool.Exec(ctx, "TRUNCATE catalog_categories"); err != nil {
		test.Fatalf("truncate catalog_categories: %v", err)
	}

	queries := New(pool)
	category, err := queries.CreateCategory(ctx, CreateCategoryParams{
		Name:     "Metals",
		ParentID: pgtype.UUID{},
		Sort:     10,
	})
	if err != nil {
		test.Fatalf("create category: %v", err)
	}
	if category.ID == uuid.Nil {
		test.Fatalf("expected category id to be set")
	}

	list, err := queries.ListCategories(ctx)
	if err != nil {
		test.Fatalf("list categories: %v", err)
	}
	if len(list) != 1 {
		test.Fatalf("expected 1 category, got %d", len(list))
	}
	if list[0].ID != category.ID {
		test.Fatalf("expected category id %s, got %s", category.ID.String(), list[0].ID.String())
	}
	if list[0].Name != category.Name {
		test.Fatalf("expected category name %q, got %q", category.Name, list[0].Name)
	}
}
