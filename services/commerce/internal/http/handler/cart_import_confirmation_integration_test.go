package handler

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/teamdsb/tmo/services/commerce/internal/db"
)

func seedPendingCartImport(t *testing.T, q *db.Queries, owner, sku uuid.UUID, rows int) uuid.UUID {
	t.Helper()
	ctx := context.Background()
	job, err := q.CreateCartImportJob(ctx, db.CreateCartImportJobParams{OwnerUserID: owner, Status: "SUCCEEDED", Progress: 100, PendingCount: int32(rows)})
	if err != nil {
		t.Fatal(err)
	}
	for n := 1; n <= rows; n++ {
		raw := "3"
		_, err = q.CreateCartImportRow(ctx, db.CreateCartImportRowParams{JobID: job.ID, RowNo: int32(n), RawQty: &raw, MatchType: "AMBIGUOUS", CandidateSkuIds: []uuid.UUID{sku}})
		if err != nil {
			t.Fatal(err)
		}
	}
	return job.ID
}

func confirmCartImportRequest(router http.Handler, token string, job uuid.UUID, selections string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/cart/import-jobs/"+job.String()+"/confirm", strings.NewReader(`{"selections":`+selections+`}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, req)
	return response
}

func TestCartImportConfirmationRetriesAddEachRowOnce(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)
	q := db.New(pool)
	sku, _ := seedCatalog(t, q)
	owner := uuid.New()
	job := seedPendingCartImport(t, q, owner, sku.ID, 1)
	_, err := q.UpsertCartItem(context.Background(), db.UpsertCartItemParams{OwnerUserID: owner, SkuID: sku.ID, Qty: 5})
	if err != nil {
		t.Fatal(err)
	}
	token := makeAuthToken(t, owner, "CUSTOMER", nil)
	router := newAuthIntegrationRouter(pool, q)
	payload := fmt.Sprintf(`[{"rowNo":1,"skuId":"%s","qty":3}]`, sku.ID)
	responses := make(chan *httptest.ResponseRecorder, 2)
	for range 2 {
		go func() { responses <- confirmCartImportRequest(router, token, job, payload) }()
	}
	for range 2 {
		got := <-responses
		if got.Code != http.StatusOK {
			t.Fatalf("confirm: %d %s", got.Code, got.Body.String())
		}
	}
	got := confirmCartImportRequest(router, token, job, payload)
	if got.Code != http.StatusOK {
		t.Fatalf("retry: %d %s", got.Code, got.Body.String())
	}
	items, err := q.ListCartItems(context.Background(), owner)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].Qty != 8 {
		t.Fatalf("expected existing 5 plus imported 3 once, got %#v", items)
	}
	stored, err := q.GetCartImportJob(context.Background(), job)
	if err != nil {
		t.Fatal(err)
	}
	if stored.PendingCount != 0 || stored.AutoAddedCount != 1 {
		t.Fatalf("wrong result counts: %#v", stored)
	}
	changed := confirmCartImportRequest(router, token, job, fmt.Sprintf(`[{"rowNo":1,"skuId":"%s","qty":4}]`, sku.ID))
	if changed.Code != http.StatusConflict {
		t.Fatalf("changed retry expected 409, got %d %s", changed.Code, changed.Body.String())
	}
}

func TestCartImportConfirmationRollsBackEarlierSelections(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)
	q := db.New(pool)
	sku, _ := seedCatalog(t, q)
	owner := uuid.New()
	job := seedPendingCartImport(t, q, owner, sku.ID, 2)
	token := makeAuthToken(t, owner, "CUSTOMER", nil)
	payload := fmt.Sprintf(`[{"rowNo":1,"skuId":"%s","qty":3},{"rowNo":2,"skuId":"%s","qty":0}]`, sku.ID, sku.ID)
	got := confirmCartImportRequest(newAuthIntegrationRouter(pool, q), token, job, payload)
	if got.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d %s", got.Code, got.Body.String())
	}
	items, err := q.ListCartItems(context.Background(), owner)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 0 {
		t.Fatalf("failed confirmation left cart items: %#v", items)
	}
	rows, err := q.ListCartImportRows(context.Background(), job)
	if err != nil {
		t.Fatal(err)
	}
	for _, row := range rows {
		if row.SelectedSkuID.Valid {
			t.Fatalf("failed confirmation left selected row: %#v", row)
		}
	}
}

func TestCartImportConfirmationRejectsOtherOwnersAndInvalidRows(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)
	q := db.New(pool)
	sku, otherSKU := seedCatalog(t, q)
	owner := uuid.New()
	job := seedPendingCartImport(t, q, owner, sku.ID, 1)
	router := newAuthIntegrationRouter(pool, q)
	cases := []struct {
		name   string
		user   uuid.UUID
		rows   string
		status int
	}{
		{"other owner", uuid.New(), fmt.Sprintf(`[{"rowNo":1,"skuId":"%s","qty":3}]`, sku.ID), http.StatusNotFound},
		{"unknown row", owner, fmt.Sprintf(`[{"rowNo":9,"skuId":"%s","qty":3}]`, sku.ID), http.StatusBadRequest},
		{"not a candidate", owner, fmt.Sprintf(`[{"rowNo":1,"skuId":"%s","qty":3}]`, otherSKU.ID), http.StatusBadRequest},
		{"duplicate row", owner, fmt.Sprintf(`[{"rowNo":1,"skuId":"%s","qty":3},{"rowNo":1,"skuId":"%s","qty":3}]`, sku.ID, sku.ID), http.StatusBadRequest},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := confirmCartImportRequest(router, makeAuthToken(t, tc.user, "CUSTOMER", nil), job, tc.rows)
			if got.Code != tc.status {
				t.Fatalf("expected %d, got %d %s", tc.status, got.Code, got.Body.String())
			}
		})
	}
	items, err := q.ListCartItems(context.Background(), owner)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 0 {
		t.Fatalf("invalid selections changed cart: %#v", items)
	}
}

func TestCartImportConfirmationDoesNotReapplyAutoAddedRows(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)
	q := db.New(pool)
	sku, _ := seedCatalog(t, q)
	owner := uuid.New()
	ctx := context.Background()
	job, err := q.CreateCartImportJob(ctx, db.CreateCartImportJobParams{OwnerUserID: owner, Status: "SUCCEEDED", Progress: 100, AutoAddedCount: 1})
	if err != nil {
		t.Fatal(err)
	}
	qty := int32(3)
	_, err = q.CreateCartImportRow(ctx, db.CreateCartImportRowParams{JobID: job.ID, RowNo: 1, MatchType: "AUTO", SkuID: pgtype.UUID{Bytes: sku.ID, Valid: true}, Qty: &qty, RawQty: stringPtr("3"), CandidateSkuIds: []uuid.UUID{}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := q.UpsertCartItem(ctx, db.UpsertCartItemParams{OwnerUserID: owner, SkuID: sku.ID, Qty: qty}); err != nil {
		t.Fatal(err)
	}
	got := confirmCartImportRequest(newAuthIntegrationRouter(pool, q), makeAuthToken(t, owner, "CUSTOMER", nil), job.ID, fmt.Sprintf(`[{"rowNo":1,"skuId":"%s","qty":3}]`, sku.ID))
	if got.Code != http.StatusOK {
		t.Fatalf("auto row retry: %d %s", got.Code, got.Body.String())
	}
	items, err := q.ListCartItems(ctx, owner)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].Qty != 3 {
		t.Fatalf("auto row applied twice: %#v", items)
	}
}

func TestCartImportConfirmationRejectsCandidateUnpublishedAfterRecognition(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)
	q := db.New(pool)
	sku, _ := seedCatalog(t, q)
	owner := uuid.New()
	job := seedPendingCartImport(t, q, owner, sku.ID, 1)
	if _, err := pool.Exec(context.Background(), "UPDATE catalog_products SET status='INACTIVE' WHERE id=$1", sku.ProductID); err != nil {
		t.Fatal(err)
	}
	got := confirmCartImportRequest(newAuthIntegrationRouter(pool, q), makeAuthToken(t, owner, "CUSTOMER", nil), job, fmt.Sprintf(`[{"rowNo":1,"skuId":"%s","qty":3}]`, sku.ID))
	if got.Code != http.StatusBadRequest {
		t.Fatalf("unpublished candidate: %d %s", got.Code, got.Body.String())
	}
	items, err := q.ListCartItems(context.Background(), owner)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 0 {
		t.Fatalf("unpublished candidate changed cart: %#v", items)
	}
}

func TestCartImportConfirmationRollsBackAfterDatabaseWriteFailure(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetCommerceTables(t, pool)
	q := db.New(pool)
	first, second := seedCatalog(t, q)
	if first.ID.String() > second.ID.String() {
		first, second = second, first
	}
	owner := uuid.New()
	ctx := context.Background()
	job, err := q.CreateCartImportJob(ctx, db.CreateCartImportJobParams{OwnerUserID: owner, Status: "SUCCEEDED", Progress: 100, PendingCount: 2})
	if err != nil {
		t.Fatal(err)
	}
	for i, sku := range []db.CatalogSku{first, second} {
		_, err := q.CreateCartImportRow(ctx, db.CreateCartImportRowParams{JobID: job.ID, RowNo: int32(i + 1), MatchType: "AMBIGUOUS", RawQty: stringPtr("3"), CandidateSkuIds: []uuid.UUID{sku.ID}})
		if err != nil {
			t.Fatal(err)
		}
	}
	for _, item := range []db.UpsertCartItemParams{
		{OwnerUserID: owner, SkuID: first.ID, Qty: 7},
		{OwnerUserID: owner, SkuID: second.ID, Qty: math.MaxInt32},
	} {
		if _, err := q.UpsertCartItem(ctx, item); err != nil {
			t.Fatal(err)
		}
	}
	// Both rows pass input validation. The second cart write exceeds the
	// database integer range after the first write has already run.
	payload := fmt.Sprintf(`[{"rowNo":1,"skuId":"%s","qty":3},{"rowNo":2,"skuId":"%s","qty":3}]`, first.ID, second.ID)
	response := confirmCartImportRequest(newAuthIntegrationRouter(pool, q), makeAuthToken(t, owner, "CUSTOMER", nil), job.ID, payload)
	if response.Code < 400 {
		t.Fatalf("expected database failure, got %d %s", response.Code, response.Body.String())
	}
	items, err := q.ListCartItems(ctx, owner)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 2 {
		t.Fatalf("cart rows changed: %#v", items)
	}
	for _, item := range items {
		expected := int32(7)
		if item.SkuID == second.ID {
			expected = math.MaxInt32
		}
		if item.Qty != expected {
			t.Fatalf("partial cart write survived rollback: %#v", item)
		}
	}
	rows, err := q.ListCartImportRows(ctx, job.ID)
	if err != nil {
		t.Fatal(err)
	}
	for _, row := range rows {
		if row.SelectedSkuID.Valid {
			t.Fatalf("partial selection survived rollback: %#v", row)
		}
	}
	stored, err := q.GetCartImportJob(ctx, job.ID)
	if err != nil {
		t.Fatal(err)
	}
	if stored.AutoAddedCount != 0 || stored.PendingCount != 2 {
		t.Fatalf("partial counts survived rollback: %#v", stored)
	}
}
