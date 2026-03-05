package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/teamdsb/tmo/packages/go-shared/httpx"
)

func TestGetAdminSuppliers(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetSupplierTables(t, pool)

	targetID := seedSupplierFixtures(t, pool)
	router := newSuppliersAdminTestRouter(pool)

	req := httptest.NewRequest(http.MethodGet, "/admin/suppliers?q=子午线&page=1&pageSize=20", nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", recorder.Code, recorder.Body.String())
	}

	var response adminSupplierListResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.Total != 1 {
		t.Fatalf("expected total 1, got %d", response.Total)
	}
	if len(response.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(response.Items))
	}
	if response.Items[0].ID != targetID.String() {
		t.Fatalf("expected supplier %s, got %s", targetID, response.Items[0].ID)
	}
	if response.Items[0].Status != "ACTIVE" {
		t.Fatalf("expected status ACTIVE, got %s", response.Items[0].Status)
	}
}

func TestPatchAdminSuppliersSupplierId(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetSupplierTables(t, pool)

	targetID := seedSupplierFixtures(t, pool)
	router := newSuppliersAdminTestRouter(pool)

	body := `{"status":"PAUSED","score":83,"notes":"manual-review","categories":["物流","国际"]}`
	req := httptest.NewRequest(http.MethodPatch, fmt.Sprintf("/admin/suppliers/%s", targetID), bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", recorder.Code, recorder.Body.String())
	}

	var response adminSupplierItem
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode patch response: %v", err)
	}
	if response.Status != "PAUSED" {
		t.Fatalf("expected status PAUSED, got %s", response.Status)
	}
	if response.Score != 83 {
		t.Fatalf("expected score 83, got %d", response.Score)
	}
	if response.Notes != "manual-review" {
		t.Fatalf("expected notes updated, got %s", response.Notes)
	}

	var (
		status string
		score  int
		notes  string
	)
	if err := pool.QueryRow(context.Background(), `SELECT status, score, notes FROM admin_suppliers WHERE id = $1`, targetID).Scan(&status, &score, &notes); err != nil {
		t.Fatalf("query supplier after patch: %v", err)
	}
	if status != "PAUSED" || score != 83 || notes != "manual-review" {
		t.Fatalf("unexpected persisted values status=%s score=%d notes=%s", status, score, notes)
	}
}

func TestGetAdminSupplierContactsAndScorecards(t *testing.T) {
	pool := openHandlerTestPool(t)
	resetSupplierTables(t, pool)

	targetID := seedSupplierFixtures(t, pool)
	router := newSuppliersAdminTestRouter(pool)

	contactsReq := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/admin/suppliers/%s/contacts", targetID), nil)
	contactsResp := httptest.NewRecorder()
	router.ServeHTTP(contactsResp, contactsReq)

	if contactsResp.Code != http.StatusOK {
		t.Fatalf("expected contacts status 200, got %d: %s", contactsResp.Code, contactsResp.Body.String())
	}

	var contacts adminSupplierContactListResponse
	if err := json.Unmarshal(contactsResp.Body.Bytes(), &contacts); err != nil {
		t.Fatalf("decode contacts response: %v", err)
	}
	if len(contacts.Items) != 1 {
		t.Fatalf("expected 1 contact, got %d", len(contacts.Items))
	}

	scorecardsReq := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/admin/suppliers/%s/scorecards", targetID), nil)
	scorecardsResp := httptest.NewRecorder()
	router.ServeHTTP(scorecardsResp, scorecardsReq)

	if scorecardsResp.Code != http.StatusOK {
		t.Fatalf("expected scorecards status 200, got %d: %s", scorecardsResp.Code, scorecardsResp.Body.String())
	}

	var scorecards adminSupplierScorecardListResponse
	if err := json.Unmarshal(scorecardsResp.Body.Bytes(), &scorecards); err != nil {
		t.Fatalf("decode scorecards response: %v", err)
	}
	if len(scorecards.Items) != 1 {
		t.Fatalf("expected 1 scorecard, got %d", len(scorecards.Items))
	}
}

func newSuppliersAdminTestRouter(pool *pgxpool.Pool) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := httpx.NewRouter()
	handler := &Handler{DB: pool}
	router.GET("/admin/suppliers", handler.GetAdminSuppliers)
	router.GET("/admin/suppliers/:supplierId", handler.GetAdminSuppliersSupplierId)
	router.PATCH("/admin/suppliers/:supplierId", handler.PatchAdminSuppliersSupplierId)
	router.GET("/admin/suppliers/:supplierId/contacts", handler.GetAdminSuppliersSupplierIdContacts)
	router.GET("/admin/suppliers/:supplierId/scorecards", handler.GetAdminSuppliersSupplierIdScorecards)
	return router
}

func resetSupplierTables(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()

	ctx := context.Background()
	if _, err := pool.Exec(ctx, `
TRUNCATE admin_supplier_scorecards,
admin_supplier_contacts,
admin_suppliers
RESTART IDENTITY CASCADE
`); err != nil {
		t.Fatalf("truncate supplier tables: %v", err)
	}
}

func seedSupplierFixtures(t *testing.T, pool *pgxpool.Pool) uuid.UUID {
	t.Helper()

	ctx := context.Background()
	supplierID := uuid.New()
	contactID := uuid.New()
	scorecardID := uuid.New()

	if _, err := pool.Exec(ctx, `
INSERT INTO admin_suppliers (
  id,
  supplier_code,
  name,
  country,
  city,
  categories,
  status,
  score,
  last_quote_amount_cents,
  last_quote_at,
  notes,
  created_at,
  updated_at
)
VALUES ($1, 'SUP-TEST-1', '子午线物流', '德国', '汉堡', ARRAY['运输','货运'], 'ACTIVE', 92, 8500000, now(), 'seed note', now(), now())
`, supplierID); err != nil {
		t.Fatalf("insert supplier fixture: %v", err)
	}

	if _, err := pool.Exec(ctx, `
INSERT INTO admin_supplier_contacts (
  id,
  supplier_id,
  name,
  title,
  email,
  phone,
  is_primary,
  created_at,
  updated_at
)
VALUES ($1, $2, 'Hans Weber', '高级客户经理', 'hans.weber@fixture.example', '+49 40 3389 1200', true, now(), now())
`, contactID, supplierID); err != nil {
		t.Fatalf("insert supplier contact fixture: %v", err)
	}

	if _, err := pool.Exec(ctx, `
INSERT INTO admin_supplier_scorecards (
  id,
  supplier_id,
  period,
  delivery_score,
  quality_score,
  price_score,
  risk_level,
  created_at
)
VALUES ($1, $2, '2026-02', 94, 91, 89, 'LOW', now())
`, scorecardID, supplierID); err != nil {
		t.Fatalf("insert supplier scorecard fixture: %v", err)
	}

	return supplierID
}
