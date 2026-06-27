package db

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
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
		Status:           "ACTIVE",
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

func TestListProductsOrdersByStatusThenNewest(t *testing.T) {
	pool := openTestPool(t)
	ctx := context.Background()

	if _, err := pool.Exec(ctx, "TRUNCATE catalog_products CASCADE"); err != nil {
		t.Fatalf("truncate catalog_products: %v", err)
	}

	queries := New(pool)
	type productSeed struct {
		name      string
		status    string
		createdAt time.Time
	}
	baseTime := time.Date(2026, time.June, 27, 8, 0, 0, 0, time.UTC)
	seeds := []productSeed{
		{name: "Draft newest overall", status: "DRAFT", createdAt: baseTime.Add(4 * time.Minute)},
		{name: "Active older", status: "ACTIVE", createdAt: baseTime.Add(time.Minute)},
		{name: "Inactive", status: "INACTIVE", createdAt: baseTime.Add(3 * time.Minute)},
		{name: "Active newer", status: "ACTIVE", createdAt: baseTime.Add(2 * time.Minute)},
	}
	for _, seed := range seeds {
		product, err := queries.CreateProduct(ctx, CreateProductParams{
			Name:             seed.name,
			Images:           []string{},
			Tags:             []string{},
			FilterDimensions: []string{},
			Status:           seed.status,
		})
		if err != nil {
			t.Fatalf("create %s: %v", seed.name, err)
		}
		if _, err := pool.Exec(ctx, "UPDATE catalog_products SET created_at = $2 WHERE id = $1", product.ID, seed.createdAt); err != nil {
			t.Fatalf("set created_at for %s: %v", seed.name, err)
		}
	}

	products, err := queries.ListProducts(ctx, ListProductsParams{Offset: 0, Limit: 10})
	if err != nil {
		t.Fatalf("list products: %v", err)
	}
	want := []string{"Active newer", "Active older", "Draft newest overall", "Inactive"}
	if len(products) != len(want) {
		t.Fatalf("expected %d products, got %d", len(want), len(products))
	}
	for index, name := range want {
		if products[index].Name != name {
			t.Fatalf("product %d: expected %q, got %q", index, name, products[index].Name)
		}
	}
}

func TestDeleteProductClearsCartAndWishlistReferencesForAllStatuses(t *testing.T) {
	pool := openTestPool(t)
	ctx := context.Background()

	if _, err := pool.Exec(ctx, "TRUNCATE catalog_products CASCADE"); err != nil {
		t.Fatalf("truncate catalog_products: %v", err)
	}

	queries := New(pool)
	for _, status := range []string{"ACTIVE", "DRAFT"} {
		t.Run(status, func(t *testing.T) {
			product, err := queries.CreateProduct(ctx, CreateProductParams{
				Name:             "Delete " + status,
				Images:           []string{},
				Tags:             []string{},
				FilterDimensions: []string{},
				Status:           status,
			})
			if err != nil {
				t.Fatalf("create product: %v", err)
			}

			skuCode := "delete-" + status
			sku, err := queries.CreateSku(ctx, CreateSkuParams{
				ProductID:  product.ID,
				SkuCode:    &skuCode,
				Name:       product.Name,
				Attributes: []byte("{}"),
				IsActive:   true,
			})
			if err != nil {
				t.Fatalf("create sku: %v", err)
			}

			ownerID := uuid.New()
			if _, err := queries.UpsertCartItem(ctx, UpsertCartItemParams{
				OwnerUserID: ownerID,
				SkuID:       sku.ID,
				Qty:         1,
			}); err != nil {
				t.Fatalf("create cart item: %v", err)
			}
			if err := queries.CreateWishlistItem(ctx, CreateWishlistItemParams{
				OwnerUserID: ownerID,
				SkuID:       sku.ID,
			}); err != nil {
				t.Fatalf("create wishlist item: %v", err)
			}

			affected, err := queries.DeleteProduct(ctx, product.ID)
			if err != nil {
				t.Fatalf("delete product: %v", err)
			}
			if affected != 1 {
				t.Fatalf("expected 1 deleted product, got %d", affected)
			}

			if _, err := queries.GetProduct(ctx, product.ID); err == nil {
				t.Fatalf("expected product to be deleted")
			} else if err != pgx.ErrNoRows {
				t.Fatalf("expected ErrNoRows after delete, got %v", err)
			}

			cartItems, err := queries.ListCartItems(ctx, ownerID)
			if err != nil {
				t.Fatalf("list cart items: %v", err)
			}
			if len(cartItems) != 0 {
				t.Fatalf("expected cart references to be deleted, got %d", len(cartItems))
			}

			wishlistItems, err := queries.ListWishlistItems(ctx, ownerID)
			if err != nil {
				t.Fatalf("list wishlist items: %v", err)
			}
			if len(wishlistItems) != 0 {
				t.Fatalf("expected wishlist references to be deleted, got %d", len(wishlistItems))
			}
		})
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
