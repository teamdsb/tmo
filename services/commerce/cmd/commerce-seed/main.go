package main

import (
	"context"
	"encoding/json"
	"errors"
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

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
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

	seed := buildCatalogSeed()

	categoryCount := 0
	productCount := 0
	skuCount := 0
	priceTierCount := 0

	for _, category := range seed.Categories {
		if err := ensureCategory(ctx, tx, category); err != nil {
			return err
		}
		categoryCount++
	}

	for _, product := range seed.Products {
		if err := ensureProduct(ctx, tx, product); err != nil {
			return err
		}
		productCount++

		for _, sku := range product.SKUs {
			skuID, err := ensureSku(ctx, tx, product.ID, sku)
			if err != nil {
				return err
			}
			skuCount++

			for _, tier := range sku.PriceTiers {
				if err := ensurePriceTier(ctx, tx, skuID, tier.MinQty, tier.MaxQty, tier.UnitPriceFen); err != nil {
					return err
				}
				priceTierCount++
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit seed: %w", err)
	}

	fmt.Printf(
		"seed data applied: %d categories, %d products, %d skus, %d price tiers\n",
		categoryCount,
		productCount,
		skuCount,
		priceTierCount,
	)
	return nil
}

type catalogSeed struct {
	Categories []categorySeed
	Products   []productSeed
}

type categorySeed struct {
	ID       uuid.UUID
	Name     string
	ParentID *uuid.UUID
	Sort     int32
}

type productSeed struct {
	ID               uuid.UUID
	Name             string
	Description      string
	CategoryID       uuid.UUID
	CoverImageURL    string
	Images           []string
	Tags             []string
	FilterDimensions []string
	SKUs             []skuSeed
}

type skuSeed struct {
	ID         uuid.UUID
	SkuCode    string
	Name       string
	Spec       string
	Attributes json.RawMessage
	Unit       string
	IsActive   bool
	PriceTiers []priceTierSeed
}

type priceTierSeed struct {
	MinQty       int32
	MaxQty       *int32
	UnitPriceFen int64
}

func ensureCategory(ctx context.Context, tx pgx.Tx, seed categorySeed) error {
	if _, err := tx.Exec(ctx, `
INSERT INTO catalog_categories (id, name, parent_id, sort)
VALUES ($1, $2, $3, $4)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    parent_id = EXCLUDED.parent_id,
    sort = EXCLUDED.sort,
    updated_at = now()
`, seed.ID, seed.Name, seed.ParentID, seed.Sort); err != nil {
		return fmt.Errorf("seed category %s: %w", seed.Name, err)
	}
	return nil
}

func ensureProduct(ctx context.Context, tx pgx.Tx, seed productSeed) error {
	if _, err := tx.Exec(ctx, `
INSERT INTO catalog_products (
  id,
  name,
  description,
  category_id,
  cover_image_url,
  images,
  tags,
  filter_dimensions
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    category_id = EXCLUDED.category_id,
    cover_image_url = EXCLUDED.cover_image_url,
    images = EXCLUDED.images,
    tags = EXCLUDED.tags,
    filter_dimensions = EXCLUDED.filter_dimensions,
    updated_at = now()
`,
		seed.ID,
		seed.Name,
		seed.Description,
		seed.CategoryID,
		seed.CoverImageURL,
		seed.Images,
		seed.Tags,
		seed.FilterDimensions,
	); err != nil {
		return fmt.Errorf("seed product %s: %w", seed.Name, err)
	}
	return nil
}

func ensureSku(ctx context.Context, tx pgx.Tx, productID uuid.UUID, seed skuSeed) (uuid.UUID, error) {
	if _, err := tx.Exec(ctx, `
INSERT INTO catalog_skus (
  id,
  product_id,
  sku_code,
  name,
  spec,
  attributes,
  unit,
  is_active
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (sku_code) WHERE sku_code IS NOT NULL
DO UPDATE SET
  product_id = EXCLUDED.product_id,
  name = EXCLUDED.name,
  spec = EXCLUDED.spec,
  attributes = EXCLUDED.attributes,
  unit = EXCLUDED.unit,
  is_active = EXCLUDED.is_active,
  updated_at = now()
`,
		seed.ID,
		productID,
		seed.SkuCode,
		seed.Name,
		seed.Spec,
		seed.Attributes,
		seed.Unit,
		seed.IsActive,
	); err != nil {
		return uuid.Nil, fmt.Errorf("seed sku %s: %w", seed.SkuCode, err)
	}

	var id uuid.UUID
	if seed.SkuCode == "" {
		if err := tx.QueryRow(ctx, `SELECT id FROM catalog_skus WHERE id = $1`, seed.ID).Scan(&id); err != nil {
			return uuid.Nil, fmt.Errorf("lookup sku by id %s: %w", seed.ID, err)
		}
		return id, nil
	}

	if err := tx.QueryRow(ctx, `SELECT id FROM catalog_skus WHERE sku_code = $1`, seed.SkuCode).Scan(&id); err != nil {
		return uuid.Nil, fmt.Errorf("lookup sku %s: %w", seed.SkuCode, err)
	}
	return id, nil
}

func ensurePriceTier(ctx context.Context, tx pgx.Tx, skuID uuid.UUID, minQty int32, maxQty *int32, unitPriceFen int64) error {
	var existingID uuid.UUID
	err := tx.QueryRow(ctx, `
SELECT id
FROM catalog_price_tiers
WHERE sku_id = $1
  AND min_qty = $2
  AND (max_qty IS NOT DISTINCT FROM $3)
LIMIT 1
`, skuID, minQty, maxQty).Scan(&existingID)
	if err == nil {
		if _, updateErr := tx.Exec(ctx, `
UPDATE catalog_price_tiers
SET unit_price_fen = $2,
    updated_at = now()
WHERE id = $1
`, existingID, unitPriceFen); updateErr != nil {
			return fmt.Errorf("update price tier %s min=%d: %w", skuID, minQty, updateErr)
		}
		return nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("check price tier %s min=%d: %w", skuID, minQty, err)
	}

	if _, err := tx.Exec(ctx, `
INSERT INTO catalog_price_tiers (sku_id, min_qty, max_qty, unit_price_fen)
VALUES ($1, $2, $3, $4)
`, skuID, minQty, maxQty, unitPriceFen); err != nil {
		return fmt.Errorf("insert price tier %s min=%d: %w", skuID, minQty, err)
	}
	return nil
}

func buildCatalogSeed() catalogSeed {
	metalsID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	electricalID := uuid.MustParse("55555555-5555-5555-5555-555555555555")
	safetyID := uuid.MustParse("66666666-6666-6666-6666-666666666666")

	products := []productSeed{
		{
			ID:               uuid.MustParse("22222222-2222-2222-2222-222222222222"),
			Name:             "Q235 焊接钢管",
			Description:      "结构支撑常用焊接钢管，适配土建与机电安装场景。",
			CategoryID:       metalsID,
			CoverImageURL:    "https://images.unsplash.com/photo-1545239351-1141bd82e8a6",
			Images:           []string{"https://images.unsplash.com/photo-1545239351-1141bd82e8a6"},
			Tags:             []string{"钢材", "结构件"},
			FilterDimensions: []string{"外径", "壁厚", "长度"},
			SKUs: []skuSeed{
				newSKU("33333333-3333-3333-3333-333333333301", "MET-PIPE-001", "Q235 焊接钢管", "DN40 x 3.5mm x 6m", map[string]string{"diameter": "DN40", "thickness": "3.5mm", "length": "6m"}, "根", 12800),
				newSKU("33333333-3333-3333-3333-333333333302", "MET-PIPE-002", "Q235 焊接钢管", "DN50 x 3.8mm x 6m", map[string]string{"diameter": "DN50", "thickness": "3.8mm", "length": "6m"}, "根", 16200),
			},
		},
		{
			ID:               uuid.MustParse("22222222-2222-2222-2222-222222222223"),
			Name:             "304 不锈钢角钢",
			Description:      "室内外通用耐腐角钢，适合设备框架和支架制作。",
			CategoryID:       metalsID,
			CoverImageURL:    "https://images.unsplash.com/photo-1517048676732-d65bc937f952",
			Images:           []string{"https://images.unsplash.com/photo-1517048676732-d65bc937f952"},
			Tags:             []string{"不锈钢", "角钢"},
			FilterDimensions: []string{"边宽", "厚度", "长度"},
			SKUs: []skuSeed{
				newSKU("33333333-3333-3333-3333-333333333303", "MET-ANG-001", "304 不锈钢角钢", "30x30x3mm x 6m", map[string]string{"width": "30mm", "thickness": "3mm", "length": "6m"}, "根", 18600),
				newSKU("33333333-3333-3333-3333-333333333304", "MET-ANG-002", "304 不锈钢角钢", "40x40x4mm x 6m", map[string]string{"width": "40mm", "thickness": "4mm", "length": "6m"}, "根", 24800),
			},
		},
		{
			ID:               uuid.MustParse("22222222-2222-2222-2222-222222222224"),
			Name:             "镀锌槽钢 C100",
			Description:      "高强度镀锌槽钢，适合综合管廊和电缆桥架主梁。",
			CategoryID:       metalsID,
			CoverImageURL:    "https://images.unsplash.com/photo-1545239351-1141bd82e8a6",
			Images:           []string{"https://images.unsplash.com/photo-1545239351-1141bd82e8a6"},
			Tags:             []string{"镀锌", "槽钢"},
			FilterDimensions: []string{"型号", "厚度", "长度"},
			SKUs: []skuSeed{
				newSKU("33333333-3333-3333-3333-333333333305", "MET-CHN-001", "镀锌槽钢 C100", "C100 x 2.5mm x 6m", map[string]string{"model": "C100", "thickness": "2.5mm", "length": "6m"}, "根", 14200),
				newSKU("33333333-3333-3333-3333-333333333306", "MET-CHN-002", "镀锌槽钢 C100", "C100 x 3.0mm x 6m", map[string]string{"model": "C100", "thickness": "3.0mm", "length": "6m"}, "根", 16800),
			},
		},
		{
			ID:               uuid.MustParse("22222222-2222-2222-2222-222222222225"),
			Name:             "阻燃电缆 3x2.5",
			Description:      "铜芯阻燃电缆，适合动力配电与设备引接。",
			CategoryID:       electricalID,
			CoverImageURL:    "https://images.unsplash.com/photo-1509395176047-4a66953fd231",
			Images:           []string{"https://images.unsplash.com/photo-1509395176047-4a66953fd231"},
			Tags:             []string{"电缆", "阻燃"},
			FilterDimensions: []string{"芯数", "截面积", "长度"},
			SKUs: []skuSeed{
				newSKU("33333333-3333-3333-3333-333333333307", "ELE-CAB-001", "阻燃电缆 3x2.5", "50m/卷", map[string]string{"core": "3", "section": "2.5mm2", "length": "50m"}, "卷", 23800),
				newSKU("33333333-3333-3333-3333-333333333308", "ELE-CAB-002", "阻燃电缆 3x2.5", "100m/卷", map[string]string{"core": "3", "section": "2.5mm2", "length": "100m"}, "卷", 45800),
			},
		},
		{
			ID:               uuid.MustParse("22222222-2222-2222-2222-222222222226"),
			Name:             "工业继电器 24V",
			Description:      "DIN 导轨安装，适用于自动化控制柜。",
			CategoryID:       electricalID,
			CoverImageURL:    "https://images.unsplash.com/photo-1518770660439-4636190af475",
			Images:           []string{"https://images.unsplash.com/photo-1518770660439-4636190af475"},
			Tags:             []string{"继电器", "控制柜"},
			FilterDimensions: []string{"线圈电压", "触点容量"},
			SKUs: []skuSeed{
				newSKU("33333333-3333-3333-3333-333333333309", "ELE-REL-001", "工业继电器 24V", "2NO 10A", map[string]string{"coil": "24VDC", "contact": "2NO", "current": "10A"}, "只", 8800),
				newSKU("33333333-3333-3333-3333-33333333330a", "ELE-REL-002", "工业继电器 24V", "2NO 16A", map[string]string{"coil": "24VDC", "contact": "2NO", "current": "16A"}, "只", 10200),
			},
		},
		{
			ID:               uuid.MustParse("22222222-2222-2222-2222-222222222227"),
			Name:             "塑壳断路器 3P 63A",
			Description:      "低压配电保护，短路与过载双重保护。",
			CategoryID:       electricalID,
			CoverImageURL:    "https://images.unsplash.com/photo-1498050108023-c5249f4df085",
			Images:           []string{"https://images.unsplash.com/photo-1498050108023-c5249f4df085"},
			Tags:             []string{"断路器", "配电"},
			FilterDimensions: []string{"极数", "额定电流"},
			SKUs: []skuSeed{
				newSKU("33333333-3333-3333-3333-33333333330b", "ELE-BRK-001", "塑壳断路器 3P", "3P 63A", map[string]string{"pole": "3P", "current": "63A"}, "只", 35600),
				newSKU("33333333-3333-3333-3333-33333333330c", "ELE-BRK-002", "塑壳断路器 3P", "3P 100A", map[string]string{"pole": "3P", "current": "100A"}, "只", 42800),
			},
		},
		{
			ID:               uuid.MustParse("22222222-2222-2222-2222-222222222228"),
			Name:             "LED 工程投光灯",
			Description:      "高亮低功耗，适用于工地夜间照明。",
			CategoryID:       electricalID,
			CoverImageURL:    "https://images.unsplash.com/photo-1524484485831-a92ffc0de03f",
			Images:           []string{"https://images.unsplash.com/photo-1524484485831-a92ffc0de03f"},
			Tags:             []string{"照明", "LED"},
			FilterDimensions: []string{"功率", "防护等级"},
			SKUs: []skuSeed{
				newSKU("33333333-3333-3333-3333-33333333330d", "ELE-LGT-001", "LED 工程投光灯", "50W IP65", map[string]string{"power": "50W", "ip": "IP65"}, "盏", 9600),
				newSKU("33333333-3333-3333-3333-33333333330e", "ELE-LGT-002", "LED 工程投光灯", "100W IP65", map[string]string{"power": "100W", "ip": "IP65"}, "盏", 14800),
			},
		},
		{
			ID:               uuid.MustParse("22222222-2222-2222-2222-222222222229"),
			Name:             "PT100 温度传感器",
			Description:      "工业温控专用探头，适配 PLC 温控模块。",
			CategoryID:       electricalID,
			CoverImageURL:    "https://images.unsplash.com/photo-1517048676732-d65bc937f952",
			Images:           []string{"https://images.unsplash.com/photo-1517048676732-d65bc937f952"},
			Tags:             []string{"传感器", "温控"},
			FilterDimensions: []string{"探杆长度", "线缆长度"},
			SKUs: []skuSeed{
				newSKU("33333333-3333-3333-3333-33333333330f", "ELE-SEN-001", "PT100 温度传感器", "探杆 50mm", map[string]string{"probe": "50mm", "cable": "2m"}, "支", 7800),
				newSKU("33333333-3333-3333-3333-333333333310", "ELE-SEN-002", "PT100 温度传感器", "探杆 100mm", map[string]string{"probe": "100mm", "cable": "2m"}, "支", 8800),
			},
		},
		{
			ID:               uuid.MustParse("22222222-2222-2222-2222-22222222222a"),
			Name:             "防割手套 5 级",
			Description:      "金属加工/搬运作业手部防护。",
			CategoryID:       safetyID,
			CoverImageURL:    "https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a",
			Images:           []string{"https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a"},
			Tags:             []string{"PPE", "手部防护"},
			FilterDimensions: []string{"尺码"},
			SKUs: []skuSeed{
				newSKU("33333333-3333-3333-3333-333333333311", "SAF-GLV-001", "防割手套", "M 码", map[string]string{"size": "M", "standard": "EN388"}, "双", 3200),
				newSKU("33333333-3333-3333-3333-333333333312", "SAF-GLV-002", "防割手套", "L 码", map[string]string{"size": "L", "standard": "EN388"}, "双", 3200),
			},
		},
		{
			ID:               uuid.MustParse("22222222-2222-2222-2222-22222222222b"),
			Name:             "ABS 安全帽",
			Description:      "高冲击吸收，适合施工与巡检场景。",
			CategoryID:       safetyID,
			CoverImageURL:    "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a",
			Images:           []string{"https://images.unsplash.com/photo-1520607162513-77705c0f0d4a"},
			Tags:             []string{"PPE", "头部防护"},
			FilterDimensions: []string{"颜色"},
			SKUs: []skuSeed{
				newSKU("33333333-3333-3333-3333-333333333313", "SAF-HEL-001", "ABS 安全帽", "白色", map[string]string{"color": "white", "standard": "GB2811"}, "顶", 5800),
				newSKU("33333333-3333-3333-3333-333333333314", "SAF-HEL-002", "ABS 安全帽", "黄色", map[string]string{"color": "yellow", "standard": "GB2811"}, "顶", 5800),
			},
		},
		{
			ID:               uuid.MustParse("22222222-2222-2222-2222-22222222222c"),
			Name:             "反光安全背心",
			Description:      "高可视反光条设计，夜间作业更安全。",
			CategoryID:       safetyID,
			CoverImageURL:    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
			Images:           []string{"https://images.unsplash.com/photo-1500530855697-b586d89ba3ee"},
			Tags:             []string{"PPE", "高可视"},
			FilterDimensions: []string{"尺码", "颜色"},
			SKUs: []skuSeed{
				newSKU("33333333-3333-3333-3333-333333333315", "SAF-VST-001", "反光安全背心", "橙色 M", map[string]string{"size": "M", "color": "orange"}, "件", 2200),
				newSKU("33333333-3333-3333-3333-333333333316", "SAF-VST-002", "反光安全背心", "荧黄 L", map[string]string{"size": "L", "color": "yellow"}, "件", 2200),
			},
		},
		{
			ID:               uuid.MustParse("22222222-2222-2222-2222-22222222222d"),
			Name:             "N95 防护口罩",
			Description:      "颗粒物防护，适用于粉尘环境日常作业。",
			CategoryID:       safetyID,
			CoverImageURL:    "https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a",
			Images:           []string{"https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a"},
			Tags:             []string{"PPE", "呼吸防护"},
			FilterDimensions: []string{"包装规格"},
			SKUs: []skuSeed{
				newSKU("33333333-3333-3333-3333-333333333317", "SAF-MSK-001", "N95 防护口罩", "20 只/盒", map[string]string{"pack": "20"}, "盒", 6400),
				newSKU("33333333-3333-3333-3333-333333333318", "SAF-MSK-002", "N95 防护口罩", "200 只/箱", map[string]string{"pack": "200"}, "箱", 56000),
			},
		},
	}

	return catalogSeed{
		Categories: []categorySeed{
			{ID: metalsID, Name: "金属材料", ParentID: nil, Sort: 1},
			{ID: electricalID, Name: "电气电工", ParentID: nil, Sort: 2},
			{ID: safetyID, Name: "安全防护", ParentID: nil, Sort: 3},
		},
		Products: products,
	}
}

func newSKU(
	id string,
	skuCode string,
	name string,
	spec string,
	attrs map[string]string,
	unit string,
	basePrice int64,
) skuSeed {
	payload, _ := json.Marshal(attrs)
	return skuSeed{
		ID:         uuid.MustParse(id),
		SkuCode:    skuCode,
		Name:       name,
		Spec:       spec,
		Attributes: payload,
		Unit:       unit,
		IsActive:   true,
		PriceTiers: newTiers(basePrice),
	}
}

func newTiers(basePrice int64) []priceTierSeed {
	return []priceTierSeed{
		{MinQty: 1, MaxQty: int32Ptr(9), UnitPriceFen: basePrice},
		{MinQty: 10, MaxQty: int32Ptr(49), UnitPriceFen: clampPrice(basePrice - 800)},
		{MinQty: 50, MaxQty: nil, UnitPriceFen: clampPrice(basePrice - 1600)},
	}
}

func clampPrice(price int64) int64 {
	if price < 1 {
		return 1
	}
	return price
}

func int32Ptr(v int32) *int32 {
	return &v
}
