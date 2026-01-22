package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/teamdsb/tmo/services/commerce/internal/db"
	"github.com/teamdsb/tmo/services/commerce/internal/http/oapi"
	"github.com/teamdsb/tmo/services/commerce/internal/modules/catalog"
)

type stubStore struct {
	createProductFn func(context.Context, db.CreateProductParams) (db.CatalogProduct, error)
	listProductsFn  func(context.Context, db.ListProductsParams) ([]db.CatalogProduct, error)
	countProductsFn func(context.Context, db.CountProductsParams) (int64, error)
	getProductFn    func(context.Context, uuid.UUID) (db.CatalogProduct, error)
	createCategoryFn       func(context.Context, db.CreateCategoryParams) (db.CatalogCategory, error)
	listCategoriesFn       func(context.Context) ([]db.CatalogCategory, error)
	createSkuFn            func(context.Context, db.CreateSkuParams) (db.CatalogSku, error)
	listSkusByProductFn    func(context.Context, uuid.UUID) ([]db.CatalogSku, error)
	listSkusByIDsFn        func(context.Context, []uuid.UUID) ([]db.CatalogSku, error)
	listSkusBySkuCodeFn    func(context.Context, string) ([]db.CatalogSku, error)
	listSkusByNameFn       func(context.Context, string) ([]db.CatalogSku, error)
	listSkusByNameAndSpecFn func(context.Context, db.ListSkusByNameAndSpecParams) ([]db.CatalogSku, error)
	createPriceTierFn      func(context.Context, db.CreatePriceTierParams) (db.CatalogPriceTier, error)
	listPriceTiersBySkuFn  func(context.Context, uuid.UUID) ([]db.CatalogPriceTier, error)
	listPriceTiersBySkusFn func(context.Context, []uuid.UUID) ([]db.CatalogPriceTier, error)
}

func (s *stubStore) CreateProduct(ctx context.Context, arg db.CreateProductParams) (db.CatalogProduct, error) {
	if s.createProductFn == nil {
		return db.CatalogProduct{}, pgx.ErrTxClosed
	}
	return s.createProductFn(ctx, arg)
}

func (s *stubStore) ListProducts(ctx context.Context, arg db.ListProductsParams) ([]db.CatalogProduct, error) {
	if s.listProductsFn == nil {
		return nil, pgx.ErrTxClosed
	}
	return s.listProductsFn(ctx, arg)
}

func (s *stubStore) CountProducts(ctx context.Context, arg db.CountProductsParams) (int64, error) {
	if s.countProductsFn == nil {
		return 0, pgx.ErrTxClosed
	}
	return s.countProductsFn(ctx, arg)
}

func (s *stubStore) GetProduct(ctx context.Context, id uuid.UUID) (db.CatalogProduct, error) {
	if s.getProductFn == nil {
		return db.CatalogProduct{}, pgx.ErrTxClosed
	}
	return s.getProductFn(ctx, id)
}

func (s *stubStore) CreateCategory(ctx context.Context, arg db.CreateCategoryParams) (db.CatalogCategory, error) {
	if s.createCategoryFn == nil {
		return db.CatalogCategory{}, pgx.ErrTxClosed
	}
	return s.createCategoryFn(ctx, arg)
}

func (s *stubStore) ListCategories(ctx context.Context) ([]db.CatalogCategory, error) {
	if s.listCategoriesFn == nil {
		return nil, pgx.ErrTxClosed
	}
	return s.listCategoriesFn(ctx)
}

func (s *stubStore) CreateSku(ctx context.Context, arg db.CreateSkuParams) (db.CatalogSku, error) {
	if s.createSkuFn == nil {
		return db.CatalogSku{}, pgx.ErrTxClosed
	}
	return s.createSkuFn(ctx, arg)
}

func (s *stubStore) ListSkusByProduct(ctx context.Context, productID uuid.UUID) ([]db.CatalogSku, error) {
	if s.listSkusByProductFn == nil {
		return nil, pgx.ErrTxClosed
	}
	return s.listSkusByProductFn(ctx, productID)
}

func (s *stubStore) ListSkusByIDs(ctx context.Context, ids []uuid.UUID) ([]db.CatalogSku, error) {
	if s.listSkusByIDsFn == nil {
		return nil, pgx.ErrTxClosed
	}
	return s.listSkusByIDsFn(ctx, ids)
}

func (s *stubStore) ListSkusBySkuCode(ctx context.Context, skuCode string) ([]db.CatalogSku, error) {
	if s.listSkusBySkuCodeFn == nil {
		return nil, pgx.ErrTxClosed
	}
	return s.listSkusBySkuCodeFn(ctx, skuCode)
}

func (s *stubStore) ListSkusByName(ctx context.Context, name string) ([]db.CatalogSku, error) {
	if s.listSkusByNameFn == nil {
		return nil, pgx.ErrTxClosed
	}
	return s.listSkusByNameFn(ctx, name)
}

func (s *stubStore) ListSkusByNameAndSpec(ctx context.Context, arg db.ListSkusByNameAndSpecParams) ([]db.CatalogSku, error) {
	if s.listSkusByNameAndSpecFn == nil {
		return nil, pgx.ErrTxClosed
	}
	return s.listSkusByNameAndSpecFn(ctx, arg)
}

func (s *stubStore) CreatePriceTier(ctx context.Context, arg db.CreatePriceTierParams) (db.CatalogPriceTier, error) {
	if s.createPriceTierFn == nil {
		return db.CatalogPriceTier{}, pgx.ErrTxClosed
	}
	return s.createPriceTierFn(ctx, arg)
}

func (s *stubStore) ListPriceTiersBySku(ctx context.Context, skuID uuid.UUID) ([]db.CatalogPriceTier, error) {
	if s.listPriceTiersBySkuFn == nil {
		return nil, pgx.ErrTxClosed
	}
	return s.listPriceTiersBySkuFn(ctx, skuID)
}

func (s *stubStore) ListPriceTiersBySkus(ctx context.Context, skuIDs []uuid.UUID) ([]db.CatalogPriceTier, error) {
	if s.listPriceTiersBySkusFn == nil {
		return nil, pgx.ErrTxClosed
	}
	return s.listPriceTiersBySkusFn(ctx, skuIDs)
}

func newTestRouter(store catalog.Store) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	oapi.RegisterHandlers(router, &Handler{CatalogStore: store})
	return router
}

func TestGetCatalogProducts_Defaults(t *testing.T) {
	categoryID := uuid.New()
	productID := uuid.New()
	cover := "https://example.com/cover.jpg"
	q := "steel"

	var gotList db.ListProductsParams
	var gotCount db.CountProductsParams

	store := &stubStore{
		listProductsFn: func(ctx context.Context, arg db.ListProductsParams) ([]db.CatalogProduct, error) {
			gotList = arg
			return []db.CatalogProduct{
				{
					ID:            productID,
					Name:          "Steel Pipe",
					CategoryID:    categoryID,
					CoverImageUrl: &cover,
					Tags:          []string{"steel", "pipe"},
					Images:        []string{},
				},
			}, nil
		},
		countProductsFn: func(ctx context.Context, arg db.CountProductsParams) (int64, error) {
			gotCount = arg
			return 1, nil
		},
	}

	router := newTestRouter(store)
	req := httptest.NewRequest(http.MethodGet, "/catalog/products?page=2&pageSize=10&q="+q+"&categoryId="+categoryID.String(), nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}

	if gotList.Limit != 10 || gotList.Offset != 10 {
		t.Fatalf("expected limit 10 and offset 10, got limit=%d offset=%d", gotList.Limit, gotList.Offset)
	}
	if gotList.Q == nil || *gotList.Q != q {
		t.Fatalf("expected q %q, got %#v", q, gotList.Q)
	}
	if !gotList.CategoryID.Valid || gotList.CategoryID.Bytes != categoryID {
		t.Fatalf("expected category filter %s, got %+v", categoryID.String(), gotList.CategoryID)
	}
	if gotCount.Q == nil || *gotCount.Q != q {
		t.Fatalf("expected count q %q, got %#v", q, gotCount.Q)
	}
	if !gotCount.CategoryID.Valid || gotCount.CategoryID.Bytes != categoryID {
		t.Fatalf("expected count category filter %s, got %+v", categoryID.String(), gotCount.CategoryID)
	}

	var response oapi.PagedProductList
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.Page != 2 || response.PageSize != 10 || response.Total != 1 {
		t.Fatalf("unexpected paging response: %+v", response)
	}
	if len(response.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(response.Items))
	}
	if response.Items[0].Id != productID {
		t.Fatalf("expected product id %s, got %s", productID, response.Items[0].Id)
	}
	if response.Items[0].CoverImageUrl == nil || *response.Items[0].CoverImageUrl != cover {
		t.Fatalf("expected cover url %q", cover)
	}
}

func TestPostCatalogProducts_Creates(t *testing.T) {
	categoryID := uuid.New()
	productID := uuid.New()
	cover := "https://example.com/cover.jpg"
	description := "Schedule 40"

	var gotCreate db.CreateProductParams
	store := &stubStore{
		createProductFn: func(ctx context.Context, arg db.CreateProductParams) (db.CatalogProduct, error) {
			gotCreate = arg
			return db.CatalogProduct{
				ID:               productID,
				Name:             arg.Name,
				Description:      arg.Description,
				CategoryID:       arg.CategoryID,
				CoverImageUrl:    arg.CoverImageUrl,
				Images:           arg.Images,
				Tags:             arg.Tags,
				FilterDimensions: arg.FilterDimensions,
			}, nil
		},
	}

	payload := oapi.CreateCatalogProductRequest{
		Name:        "Steel Pipe",
		CategoryId:  categoryID,
		Description: &description,
		CoverImageUrl: func() *string {
			return &cover
		}(),
		Images:           &[]string{"https://example.com/steel.jpg"},
		Tags:             &[]string{"steel", "pipe"},
		FilterDimensions: &[]string{"material"},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}

	router := newTestRouter(store)
	req := httptest.NewRequest(http.MethodPost, "/catalog/products", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d", recorder.Code)
	}
	if gotCreate.Name != payload.Name || gotCreate.CategoryID != payload.CategoryId {
		t.Fatalf("unexpected create params: %+v", gotCreate)
	}
	if gotCreate.Description == nil || *gotCreate.Description != description {
		t.Fatalf("expected description %q", description)
	}
	if gotCreate.CoverImageUrl == nil || *gotCreate.CoverImageUrl != cover {
		t.Fatalf("expected cover url %q", cover)
	}
	if len(gotCreate.Images) != 1 || gotCreate.Images[0] != "https://example.com/steel.jpg" {
		t.Fatalf("unexpected images: %+v", gotCreate.Images)
	}
	if len(gotCreate.Tags) != 2 || gotCreate.Tags[0] != "steel" {
		t.Fatalf("unexpected tags: %+v", gotCreate.Tags)
	}
	if len(gotCreate.FilterDimensions) != 1 || gotCreate.FilterDimensions[0] != "material" {
		t.Fatalf("unexpected filters: %+v", gotCreate.FilterDimensions)
	}

	var response oapi.ProductDetail
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.Product.Id != productID {
		t.Fatalf("expected product id %s, got %s", productID, response.Product.Id)
	}
	if response.Product.Description == nil || *response.Product.Description != description {
		t.Fatalf("expected description %q", description)
	}
	if response.Product.CategoryId != categoryID {
		t.Fatalf("expected category id %s", categoryID)
	}
	if response.Product.Images == nil || len(*response.Product.Images) != 1 {
		t.Fatalf("expected images in response")
	}
	if len(response.Skus) != 0 {
		t.Fatalf("expected empty skus")
	}
}

func TestGetCatalogProductsSpuId_NotFound(t *testing.T) {
	productID := uuid.New()
	store := &stubStore{
		getProductFn: func(ctx context.Context, id uuid.UUID) (db.CatalogProduct, error) {
			return db.CatalogProduct{}, pgx.ErrNoRows
		},
	}

	router := newTestRouter(store)
	req := httptest.NewRequest(http.MethodGet, "/catalog/products/"+productID.String(), nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d", recorder.Code)
	}
}

func TestGetCatalogCategories_Empty(t *testing.T) {
	store := &stubStore{
		listCategoriesFn: func(ctx context.Context) ([]db.CatalogCategory, error) {
			return []db.CatalogCategory{}, nil
		},
	}
	router := newTestRouter(store)
	req := httptest.NewRequest(http.MethodGet, "/catalog/categories", nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}

	var response struct {
		Items []oapi.Category `json:"items"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.Items == nil || len(response.Items) != 0 {
		t.Fatalf("expected empty categories list")
	}
}
