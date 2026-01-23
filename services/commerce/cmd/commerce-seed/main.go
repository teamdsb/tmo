package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const defaultDSN = "postgres://commerce:commerce@localhost:5432/commerce?sslmode=disable"

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	dsn := os.Getenv("COMMERCE_DB_DSN")
	if dsn == "" {
		dsn = defaultDSN
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return fmt.Errorf("connect to database: %w", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		return fmt.Errorf("ping database: %w", err)
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	categoryID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	productID := uuid.MustParse("22222222-2222-2222-2222-222222222222")

	if _, err := tx.Exec(ctx, `
INSERT INTO catalog_categories (id, name, parent_id, sort)
VALUES ($1, $2, $3, $4)
ON CONFLICT (id) DO NOTHING
`, categoryID, "Metals", nil, 1); err != nil {
		return fmt.Errorf("seed category: %w", err)
	}

	description := "Schedule 40"
	cover := "https://example.com/steel.jpg"
	if _, err := tx.Exec(ctx, `
INSERT INTO catalog_products (id, name, description, category_id, cover_image_url, images, tags, filter_dimensions)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (id) DO NOTHING
`, productID, "Steel Pipe", description, categoryID, cover,
		[]string{cover}, []string{"steel", "pipe"}, []string{"material", "length"}); err != nil {
		return fmt.Errorf("seed product: %w", err)
	}

	skuAID, err := ensureSku(ctx, tx, skuSeed{
		ID:         uuid.MustParse("33333333-3333-3333-3333-333333333333"),
		ProductID:  productID,
		SkuCode:    "SP-001",
		Name:       "Steel Pipe 1m",
		Spec:       "1m",
		Attributes: json.RawMessage(`{"length":"1m"}`),
		Unit:       "pcs",
		IsActive:   true,
	})
	if err != nil {
		return err
	}
	skuBID, err := ensureSku(ctx, tx, skuSeed{
		ID:         uuid.MustParse("44444444-4444-4444-4444-444444444444"),
		ProductID:  productID,
		SkuCode:    "SP-002",
		Name:       "Steel Pipe 2m",
		Spec:       "2m",
		Attributes: json.RawMessage(`{"length":"2m"}`),
		Unit:       "pcs",
		IsActive:   true,
	})
	if err != nil {
		return err
	}

	if err := ensurePriceTier(ctx, tx, skuAID, 1, nil, 12000); err != nil {
		return err
	}
	if err := ensurePriceTier(ctx, tx, skuBID, 1, nil, 18000); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit seed: %w", err)
	}

	fmt.Println("seed data applied")
	return nil
}

type skuSeed struct {
	ID         uuid.UUID
	ProductID  uuid.UUID
	SkuCode    string
	Name       string
	Spec       string
	Attributes json.RawMessage
	Unit       string
	IsActive   bool
}

func ensureSku(ctx context.Context, tx pgx.Tx, seed skuSeed) (uuid.UUID, error) {
	if _, err := tx.Exec(ctx, `
INSERT INTO catalog_skus (id, product_id, sku_code, name, spec, attributes, unit, is_active)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (sku_code) WHERE sku_code IS NOT NULL
DO UPDATE SET
  product_id = EXCLUDED.product_id,
  name = EXCLUDED.name,
  spec = EXCLUDED.spec,
  attributes = EXCLUDED.attributes,
  unit = EXCLUDED.unit,
  is_active = EXCLUDED.is_active
`, seed.ID, seed.ProductID, seed.SkuCode, seed.Name, seed.Spec, seed.Attributes, seed.Unit, seed.IsActive); err != nil {
		return uuid.Nil, fmt.Errorf("seed sku %s: %w", seed.SkuCode, err)
	}

	var id uuid.UUID
	if err := tx.QueryRow(ctx, `SELECT id FROM catalog_skus WHERE sku_code = $1`, seed.SkuCode).Scan(&id); err != nil {
		return uuid.Nil, fmt.Errorf("lookup sku %s: %w", seed.SkuCode, err)
	}
	return id, nil
}

func ensurePriceTier(ctx context.Context, tx pgx.Tx, skuID uuid.UUID, minQty int32, maxQty *int32, unitPriceFen int64) error {
	var exists bool
	if err := tx.QueryRow(ctx, `
SELECT EXISTS (
  SELECT 1 FROM catalog_price_tiers
  WHERE sku_id = $1 AND min_qty = $2 AND (max_qty IS NOT DISTINCT FROM $3)
)
`, skuID, minQty, maxQty).Scan(&exists); err != nil {
		return fmt.Errorf("check price tier: %w", err)
	}
	if exists {
		return nil
	}

	if _, err := tx.Exec(ctx, `
INSERT INTO catalog_price_tiers (sku_id, min_qty, max_qty, unit_price_fen)
VALUES ($1, $2, $3, $4)
`, skuID, minQty, maxQty, unitPriceFen); err != nil {
		return fmt.Errorf("seed price tier: %w", err)
	}
	return nil
}
