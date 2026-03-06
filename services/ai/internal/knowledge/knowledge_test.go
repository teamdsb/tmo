package knowledge

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/teamdsb/tmo/services/ai/internal/commerce"
)

type fakeLoader struct {
	pages   []commerce.PagedProductList
	details map[uuid.UUID]commerce.ProductDetail
}

func (f *fakeLoader) ListProductsPage(_ context.Context, page, _ int) (commerce.PagedProductList, error) {
	if page <= 0 || page > len(f.pages) {
		return commerce.PagedProductList{}, nil
	}
	return f.pages[page-1], nil
}

func (f *fakeLoader) GetProductDetail(_ context.Context, productID uuid.UUID) (commerce.ProductDetail, error) {
	return f.details[productID], nil
}

func TestSearchFallsBackToTemplatesWithoutCatalogSnapshot(t *testing.T) {
	base, err := NewBase(&fakeLoader{}, nil, 0)
	if err != nil {
		t.Fatalf("NewBase() error = %v", err)
	}

	result := base.Search("客户反馈包装破损，需要核实照片", 3)
	if len(result.Products) != 0 {
		t.Fatalf("expected no product matches, got %d", len(result.Products))
	}
	if len(result.Templates) == 0 {
		t.Fatalf("expected template matches")
	}
	if got := result.Templates[0].Template.ID; got != "packaging-damage" {
		t.Fatalf("expected packaging-damage template, got %s", got)
	}
}

func TestRefreshBuildsProductSnapshotAndSearchFindsCatalogMatch(t *testing.T) {
	productID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	loader := &fakeLoader{
		pages: []commerce.PagedProductList{
			{
				Items: []commerce.ProductSummary{
					{ID: productID, Name: "阻燃电缆 3x2.5"},
				},
				Page:     1,
				PageSize: 100,
				Total:    1,
			},
		},
		details: map[uuid.UUID]commerce.ProductDetail{
			productID: {
				Product: commerce.ProductInfo{
					ID:          productID,
					Name:        "阻燃电缆 3x2.5",
					Description: strPtr("铜芯阻燃电缆，适合动力配电与设备引接。"),
				},
				SKUs: []commerce.SKU{
					{
						ID:       uuid.MustParse("22222222-2222-2222-2222-222222222222"),
						SpuID:    productID,
						Name:     "阻燃电缆 3x2.5",
						Spec:     strPtr("100m/卷"),
						Unit:     strPtr("卷"),
						IsActive: true,
						Attributes: map[string]string{
							"core":    "3",
							"section": "2.5mm2",
							"length":  "100m",
						},
					},
				},
			},
		},
	}

	base, err := NewBase(loader, nil, 0)
	if err != nil {
		t.Fatalf("NewBase() error = %v", err)
	}
	if err := base.Refresh(context.Background()); err != nil {
		t.Fatalf("Refresh() error = %v", err)
	}

	result := base.Search("阻燃电缆 100m 客户反馈包装破损", 3)
	if len(result.Products) == 0 {
		t.Fatalf("expected product matches")
	}
	if got := result.Products[0].Document.Name; got != "阻燃电缆 3x2.5" {
		t.Fatalf("expected first product to be 阻燃电缆 3x2.5, got %s", got)
	}
	if len(result.Templates) == 0 || result.Templates[0].Template.ID != "packaging-damage" {
		t.Fatalf("expected packaging-damage template, got %#v", result.Templates)
	}
}

func strPtr(value string) *string {
	return &value
}
