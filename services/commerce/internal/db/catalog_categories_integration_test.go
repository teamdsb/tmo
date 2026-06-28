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

	if _, err := pool.Exec(ctx, "TRUNCATE catalog_categories CASCADE"); err != nil {
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

func TestCatalogCategorySortPositionsStayUnique(test *testing.T) {
	pool := openTestPool(test)
	ctx := context.Background()

	if _, err := pool.Exec(ctx, "TRUNCATE catalog_categories CASCADE"); err != nil {
		test.Fatalf("truncate catalog_categories: %v", err)
	}

	queries := New(pool)
	first, err := queries.CreateCategory(ctx, CreateCategoryParams{Name: "First", Sort: 1})
	if err != nil {
		test.Fatalf("create first category: %v", err)
	}
	second, err := queries.CreateCategory(ctx, CreateCategoryParams{Name: "Second", Sort: 2})
	if err != nil {
		test.Fatalf("create second category: %v", err)
	}
	inserted, err := queries.CreateCategory(ctx, CreateCategoryParams{Name: "Inserted", Sort: 1})
	if err != nil {
		test.Fatalf("insert category at occupied position: %v", err)
	}
	assertCategoryOrder(test, ctx, queries, []uuid.UUID{inserted.ID, first.ID, second.ID})

	moveToFirst := int32(1)
	if _, err := queries.UpdateCategory(ctx, UpdateCategoryParams{ID: second.ID, Sort: &moveToFirst}); err != nil {
		test.Fatalf("move category to first position: %v", err)
	}
	assertCategoryOrder(test, ctx, queries, []uuid.UUID{second.ID, inserted.ID, first.ID})

	moveToLast := int32(3)
	if _, err := queries.UpdateCategory(ctx, UpdateCategoryParams{ID: second.ID, Sort: &moveToLast}); err != nil {
		test.Fatalf("move category to last position: %v", err)
	}
	assertCategoryOrder(test, ctx, queries, []uuid.UUID{inserted.ID, first.ID, second.ID})

	if affected, err := queries.DeleteCategory(ctx, first.ID); err != nil {
		test.Fatalf("delete middle category: %v", err)
	} else if affected != 1 {
		test.Fatalf("expected one deleted category, got %d", affected)
	}
	assertCategoryOrder(test, ctx, queries, []uuid.UUID{inserted.ID, second.ID})
}

func assertCategoryOrder(test *testing.T, ctx context.Context, queries *Queries, expected []uuid.UUID) {
	test.Helper()
	items, err := queries.ListCategories(ctx)
	if err != nil {
		test.Fatalf("list categories: %v", err)
	}
	if len(items) != len(expected) {
		test.Fatalf("expected %d categories, got %d", len(expected), len(items))
	}
	for index, item := range items {
		if item.ID != expected[index] {
			test.Fatalf("position %d: expected category %s, got %s", index+1, expected[index], item.ID)
		}
		if item.Sort != int32(index+1) {
			test.Fatalf("category %s: expected sort %d, got %d", item.ID, index+1, item.Sort)
		}
	}
}
