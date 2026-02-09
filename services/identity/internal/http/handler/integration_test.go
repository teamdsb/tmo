package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/teamdsb/tmo/services/identity/internal/auth"
	"github.com/teamdsb/tmo/services/identity/internal/db"
	httpserver "github.com/teamdsb/tmo/services/identity/internal/http"
	"github.com/teamdsb/tmo/services/identity/internal/http/handler"
	"github.com/teamdsb/tmo/services/identity/internal/http/oapi"
	"github.com/teamdsb/tmo/services/identity/internal/platform"
)

const (
	adminUsername = "admin"
	adminPassword = "admin123"
)

var (
	adminID = uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	salesID = uuid.MustParse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
	multiID = uuid.MustParse("cccccccc-cccc-cccc-cccc-cccccccccccc")
)

func TestMiniLoginCreatesCustomer(t *testing.T) {
	router, pool := setupTestRouter(t)
	ctx := context.Background()

	if err := resetIdentityTables(ctx, pool); err != nil {
		t.Fatalf("reset tables: %v", err)
	}

	resp := doJSON(t, router, http.MethodPost, "/auth/mini/login", map[string]interface{}{
		"platform": "weapp",
		"code":     "mock_customer_001",
	}, "")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}

	var authResponse oapi.AuthResponse
	if err := json.NewDecoder(resp.Body).Decode(&authResponse); err != nil {
		t.Fatalf("decode auth response: %v", err)
	}

	if authResponse.User.UserType != oapi.UserUserTypeCustomer {
		t.Fatalf("expected userType customer, got %s", authResponse.User.UserType)
	}

	meResp := doJSON(t, router, http.MethodGet, "/me", nil, authResponse.AccessToken)
	if meResp.Code != http.StatusOK {
		t.Fatalf("expected /me 200, got %d: %s", meResp.Code, meResp.Body.String())
	}
	var me oapi.User
	if err := json.NewDecoder(meResp.Body).Decode(&me); err != nil {
		t.Fatalf("decode me: %v", err)
	}
	if me.UserType != oapi.UserUserTypeCustomer {
		t.Fatalf("expected /me userType customer, got %s", me.UserType)
	}
}

func TestPasswordLoginAdmin(t *testing.T) {
	router, pool := setupTestRouter(t)
	ctx := context.Background()

	if err := resetIdentityTables(ctx, pool); err != nil {
		t.Fatalf("reset tables: %v", err)
	}
	if err := seedAdmin(ctx, pool); err != nil {
		t.Fatalf("seed admin: %v", err)
	}

	resp := doJSON(t, router, http.MethodPost, "/auth/password/login", map[string]interface{}{
		"username": adminUsername,
		"password": adminPassword,
	}, "")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestMiniLoginRoleConflict(t *testing.T) {
	router, pool := setupTestRouter(t)
	ctx := context.Background()

	if err := resetIdentityTables(ctx, pool); err != nil {
		t.Fatalf("reset tables: %v", err)
	}
	if err := seedMultiRole(ctx, pool); err != nil {
		t.Fatalf("seed multi role: %v", err)
	}

	resp := doJSON(t, router, http.MethodPost, "/auth/mini/login", map[string]interface{}{
		"platform": "weapp",
		"code":     "mock_multi_001",
	}, "")
	if resp.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", resp.Code, resp.Body.String())
	}

	resp = doJSON(t, router, http.MethodPost, "/auth/mini/login", map[string]interface{}{
		"platform": "weapp",
		"code":     "mock_multi_001",
		"role":     "SALES",
	}, "")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}

	var authResponse oapi.AuthResponse
	if err := json.NewDecoder(resp.Body).Decode(&authResponse); err != nil {
		t.Fatalf("decode auth response: %v", err)
	}
	if authResponse.User.UserType != oapi.UserUserTypeStaff {
		t.Fatalf("expected userType staff, got %s", authResponse.User.UserType)
	}
}

func TestSalesQrCode(t *testing.T) {
	router, pool := setupTestRouter(t)
	ctx := context.Background()

	if err := resetIdentityTables(ctx, pool); err != nil {
		t.Fatalf("reset tables: %v", err)
	}
	if err := seedSales(ctx, pool); err != nil {
		t.Fatalf("seed sales: %v", err)
	}

	loginResp := doJSON(t, router, http.MethodPost, "/auth/mini/login", map[string]interface{}{
		"platform": "weapp",
		"code":     "mock_sales_001",
		"role":     "SALES",
	}, "")
	if loginResp.Code != http.StatusOK {
		t.Fatalf("expected login 200, got %d: %s", loginResp.Code, loginResp.Body.String())
	}
	var authResponse oapi.AuthResponse
	if err := json.NewDecoder(loginResp.Body).Decode(&authResponse); err != nil {
		t.Fatalf("decode login response: %v", err)
	}

	qrResp := doJSON(t, router, http.MethodGet, "/me/sales-qr-code", nil, authResponse.AccessToken)
	if qrResp.Code != http.StatusOK {
		t.Fatalf("expected qr 200, got %d: %s", qrResp.Code, qrResp.Body.String())
	}
	var qr oapi.SalesQrCode
	if err := json.NewDecoder(qrResp.Body).Decode(&qr); err != nil {
		t.Fatalf("decode qr: %v", err)
	}
	if qr.Scene == "" || qr.QrCodeUrl == "" || qr.ExpiresAt == nil {
		t.Fatalf("expected qr fields to be set")
	}
}

func TestStaffBindingTokenFlow(t *testing.T) {
	router, pool := setupTestRouter(t)
	ctx := context.Background()

	if err := resetIdentityTables(ctx, pool); err != nil {
		t.Fatalf("reset tables: %v", err)
	}
	if err := seedAdmin(ctx, pool); err != nil {
		t.Fatalf("seed admin: %v", err)
	}

	adminLogin := doJSON(t, router, http.MethodPost, "/auth/password/login", map[string]interface{}{
		"username": adminUsername,
		"password": adminPassword,
	}, "")
	if adminLogin.Code != http.StatusOK {
		t.Fatalf("expected admin login 200, got %d: %s", adminLogin.Code, adminLogin.Body.String())
	}
	var adminAuth oapi.AuthResponse
	if err := json.NewDecoder(adminLogin.Body).Decode(&adminAuth); err != nil {
		t.Fatalf("decode admin auth: %v", err)
	}

	createResp := doJSON(t, router, http.MethodPost, "/staff", map[string]interface{}{
		"displayName": "Staff A",
		"roles":       []string{"SALES"},
	}, adminAuth.AccessToken)
	if createResp.Code != http.StatusCreated {
		t.Fatalf("expected staff create 201, got %d: %s", createResp.Code, createResp.Body.String())
	}
	var staff oapi.StaffUser
	if err := json.NewDecoder(createResp.Body).Decode(&staff); err != nil {
		t.Fatalf("decode staff: %v", err)
	}

	staffID := uuid.UUID(staff.Id)
	bindingResp := doJSON(t, router, http.MethodPost, "/staff/"+staffID.String()+"/bindings", map[string]interface{}{
		"platform": "weapp",
	}, adminAuth.AccessToken)
	if bindingResp.Code != http.StatusCreated {
		t.Fatalf("expected binding 201, got %d: %s", bindingResp.Code, bindingResp.Body.String())
	}
	var token oapi.StaffBindingToken
	if err := json.NewDecoder(bindingResp.Body).Decode(&token); err != nil {
		t.Fatalf("decode binding token: %v", err)
	}

	bindLogin := doJSON(t, router, http.MethodPost, "/auth/mini/login", map[string]interface{}{
		"platform":     "weapp",
		"code":         "mock_staff_001",
		"bindingToken": token.Token,
		"role":         "SALES",
	}, "")
	if bindLogin.Code != http.StatusOK {
		t.Fatalf("expected staff login 200, got %d: %s", bindLogin.Code, bindLogin.Body.String())
	}
	var staffAuth oapi.AuthResponse
	if err := json.NewDecoder(bindLogin.Body).Decode(&staffAuth); err != nil {
		t.Fatalf("decode staff auth: %v", err)
	}
	if staffAuth.User.UserType != oapi.UserUserTypeStaff {
		t.Fatalf("expected staff userType, got %s", staffAuth.User.UserType)
	}
}

func TestMePermissions(t *testing.T) {
	router, pool := setupTestRouter(t)
	ctx := context.Background()

	if err := resetIdentityTables(ctx, pool); err != nil {
		t.Fatalf("reset tables: %v", err)
	}
	if err := seedAdmin(ctx, pool); err != nil {
		t.Fatalf("seed admin: %v", err)
	}

	adminLogin := doJSON(t, router, http.MethodPost, "/auth/password/login", map[string]interface{}{
		"username": adminUsername,
		"password": adminPassword,
	}, "")
	if adminLogin.Code != http.StatusOK {
		t.Fatalf("expected admin login 200, got %d: %s", adminLogin.Code, adminLogin.Body.String())
	}
	var adminAuth oapi.AuthResponse
	if err := json.NewDecoder(adminLogin.Body).Decode(&adminAuth); err != nil {
		t.Fatalf("decode admin auth: %v", err)
	}

	permResp := doJSON(t, router, http.MethodGet, "/me/permissions", nil, adminAuth.AccessToken)
	if permResp.Code != http.StatusOK {
		t.Fatalf("expected permissions 200, got %d: %s", permResp.Code, permResp.Body.String())
	}
	var perms oapi.PermissionList
	if err := json.NewDecoder(permResp.Body).Decode(&perms); err != nil {
		t.Fatalf("decode permissions: %v", err)
	}
	found := false
	for _, item := range perms.Items {
		if item.Code == "rbac:manage" && item.Scope == oapi.ALL {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected rbac:manage permission")
	}
}

func TestGetCustomersAdminListAndDetail(t *testing.T) {
	router, pool := setupTestRouter(t)
	ctx := context.Background()

	if err := resetIdentityTables(ctx, pool); err != nil {
		t.Fatalf("reset tables: %v", err)
	}
	if err := seedAdmin(ctx, pool); err != nil {
		t.Fatalf("seed admin: %v", err)
	}
	if err := seedSales(ctx, pool); err != nil {
		t.Fatalf("seed sales: %v", err)
	}

	ownedCustomerID := uuid.New()
	otherCustomerID := uuid.New()
	if err := seedCustomer(ctx, pool, ownedCustomerID, "客户A", &salesID); err != nil {
		t.Fatalf("seed owned customer: %v", err)
	}
	if err := seedCustomer(ctx, pool, otherCustomerID, "客户B", nil); err != nil {
		t.Fatalf("seed customer: %v", err)
	}

	adminLogin := doJSON(t, router, http.MethodPost, "/auth/password/login", map[string]interface{}{
		"username": adminUsername,
		"password": adminPassword,
	}, "")
	if adminLogin.Code != http.StatusOK {
		t.Fatalf("expected admin login 200, got %d: %s", adminLogin.Code, adminLogin.Body.String())
	}
	var adminAuth oapi.AuthResponse
	if err := json.NewDecoder(adminLogin.Body).Decode(&adminAuth); err != nil {
		t.Fatalf("decode admin auth: %v", err)
	}

	listResp := doJSON(t, router, http.MethodGet, "/customers?page=1&pageSize=10&q=客户", nil, adminAuth.AccessToken)
	if listResp.Code != http.StatusOK {
		t.Fatalf("expected list customers 200, got %d: %s", listResp.Code, listResp.Body.String())
	}

	var list oapi.PagedCustomerList
	if err := json.NewDecoder(listResp.Body).Decode(&list); err != nil {
		t.Fatalf("decode customers list: %v", err)
	}
	if list.Total != 2 || len(list.Items) != 2 {
		t.Fatalf("expected total/items = 2, got total=%d items=%d", list.Total, len(list.Items))
	}

	found := map[uuid.UUID]bool{}
	for _, item := range list.Items {
		found[uuid.UUID(item.Id)] = true
	}
	if !found[ownedCustomerID] || !found[otherCustomerID] {
		t.Fatalf("expected customers in list, got %+v", found)
	}

	detailResp := doJSON(t, router, http.MethodGet, "/customers/"+ownedCustomerID.String(), nil, adminAuth.AccessToken)
	if detailResp.Code != http.StatusOK {
		t.Fatalf("expected customer detail 200, got %d: %s", detailResp.Code, detailResp.Body.String())
	}

	var detail oapi.Customer
	if err := json.NewDecoder(detailResp.Body).Decode(&detail); err != nil {
		t.Fatalf("decode customer detail: %v", err)
	}
	if uuid.UUID(detail.Id) != ownedCustomerID {
		t.Fatalf("expected customer id %s, got %s", ownedCustomerID, detail.Id)
	}
	if detail.OwnerSalesUserId == nil || uuid.UUID(*detail.OwnerSalesUserId) != salesID {
		t.Fatalf("expected ownerSalesUserId %s, got %#v", salesID, detail.OwnerSalesUserId)
	}
}

func TestGetCustomersSalesScopeOwned(t *testing.T) {
	router, pool := setupTestRouter(t)
	ctx := context.Background()

	if err := resetIdentityTables(ctx, pool); err != nil {
		t.Fatalf("reset tables: %v", err)
	}
	if err := seedSales(ctx, pool); err != nil {
		t.Fatalf("seed sales: %v", err)
	}

	otherSalesID := uuid.New()
	if err := seedUser(ctx, pool, otherSalesID, "Other Sales", "staff"); err != nil {
		t.Fatalf("seed other sales: %v", err)
	}
	if err := seedRole(ctx, pool, otherSalesID, "SALES"); err != nil {
		t.Fatalf("seed other sales role: %v", err)
	}

	ownedCustomerID := uuid.New()
	unownedCustomerID := uuid.New()
	if err := seedCustomer(ctx, pool, ownedCustomerID, "我的客户", &salesID); err != nil {
		t.Fatalf("seed owned customer: %v", err)
	}
	if err := seedCustomer(ctx, pool, unownedCustomerID, "别人的客户", &otherSalesID); err != nil {
		t.Fatalf("seed unowned customer: %v", err)
	}

	loginResp := doJSON(t, router, http.MethodPost, "/auth/mini/login", map[string]interface{}{
		"platform": "weapp",
		"code":     "mock_sales_001",
		"role":     "SALES",
	}, "")
	if loginResp.Code != http.StatusOK {
		t.Fatalf("expected login 200, got %d: %s", loginResp.Code, loginResp.Body.String())
	}
	var salesAuth oapi.AuthResponse
	if err := json.NewDecoder(loginResp.Body).Decode(&salesAuth); err != nil {
		t.Fatalf("decode sales auth: %v", err)
	}

	listResp := doJSON(
		t,
		router,
		http.MethodGet,
		"/customers?page=1&pageSize=10&ownerSalesUserId="+otherSalesID.String(),
		nil,
		salesAuth.AccessToken,
	)
	if listResp.Code != http.StatusOK {
		t.Fatalf("expected list customers 200, got %d: %s", listResp.Code, listResp.Body.String())
	}

	var list oapi.PagedCustomerList
	if err := json.NewDecoder(listResp.Body).Decode(&list); err != nil {
		t.Fatalf("decode customers list: %v", err)
	}
	if list.Total != 1 || len(list.Items) != 1 {
		t.Fatalf("expected total/items = 1, got total=%d items=%d", list.Total, len(list.Items))
	}
	if uuid.UUID(list.Items[0].Id) != ownedCustomerID {
		t.Fatalf("expected owned customer %s, got %s", ownedCustomerID, list.Items[0].Id)
	}

	ownedResp := doJSON(t, router, http.MethodGet, "/customers/"+ownedCustomerID.String(), nil, salesAuth.AccessToken)
	if ownedResp.Code != http.StatusOK {
		t.Fatalf("expected owned customer detail 200, got %d: %s", ownedResp.Code, ownedResp.Body.String())
	}

	unownedResp := doJSON(t, router, http.MethodGet, "/customers/"+unownedCustomerID.String(), nil, salesAuth.AccessToken)
	if unownedResp.Code != http.StatusForbidden {
		t.Fatalf("expected unowned customer detail 403, got %d: %s", unownedResp.Code, unownedResp.Body.String())
	}
}

func setupTestRouter(t *testing.T) (*gin.Engine, *pgxpool.Pool) {
	t.Helper()

	dsn := os.Getenv("IDENTITY_DB_DSN")
	if dsn == "" {
		t.Skip("IDENTITY_DB_DSN is not set; skipping integration test")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatalf("connect to database: %v", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		t.Fatalf("ping database: %v", err)
	}

	migrationsDir := filepath.Join("..", "..", "..", "migrations")
	if err := db.ApplyMigrations(ctx, pool, migrationsDir); err != nil {
		pool.Close()
		t.Fatalf("apply migrations: %v", err)
	}

	t.Cleanup(func() {
		pool.Close()
	})

	gin.SetMode(gin.TestMode)
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	store := db.New(pool)
	apiHandler := &handler.Handler{
		DB:     pool,
		Logger: logger,
		Auth:   auth.NewTokenManager("test-secret", "test-issuer", 2*time.Hour),
		Store:  store,
		Platform: platform.NewMiniLoginResolver(platform.Config{
			Mode:            platform.LoginModeMock,
			WeappSalesPage:  "pages/index/index",
			WeappQRWidth:    256,
			AlipaySalesPage: "pages/index/index",
		}),
	}

	router := httpserver.NewRouter(apiHandler, logger, func(ctx context.Context) error {
		return db.Ready(ctx, pool)
	})
	return router, pool
}

func doJSON(t *testing.T, router http.Handler, method, path string, body interface{}, token string) *httptest.ResponseRecorder {
	t.Helper()

	var reader io.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal body: %v", err)
		}
		reader = bytes.NewReader(payload)
	}

	req := httptest.NewRequest(method, path, reader)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	return recorder
}

func resetIdentityTables(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, `
TRUNCATE TABLE audit_logs, staff_binding_tokens, sales_qr_codes, user_passwords, user_identities, user_roles, users RESTART IDENTITY CASCADE
`)
	return err
}

func seedAdmin(ctx context.Context, pool *pgxpool.Pool) error {
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	if err := seedUser(ctx, pool, adminID, "Admin", "admin"); err != nil {
		return err
	}
	if err := seedRole(ctx, pool, adminID, "ADMIN"); err != nil {
		return err
	}
	if _, err := pool.Exec(ctx, `
INSERT INTO user_passwords (user_id, username, password_hash)
VALUES ($1, $2, $3)
ON CONFLICT (user_id) DO UPDATE
SET username = EXCLUDED.username,
    password_hash = EXCLUDED.password_hash,
    updated_at = now()
`, adminID, adminUsername, string(passwordHash)); err != nil {
		return err
	}
	return nil
}

func seedSales(ctx context.Context, pool *pgxpool.Pool) error {
	if err := seedUser(ctx, pool, salesID, "Sales Dev", "staff"); err != nil {
		return err
	}
	if err := seedRole(ctx, pool, salesID, "SALES"); err != nil {
		return err
	}
	return seedIdentity(ctx, pool, salesID, "mock_sales_001")
}

func seedMultiRole(ctx context.Context, pool *pgxpool.Pool) error {
	if err := seedUser(ctx, pool, multiID, "Multi Role", "customer"); err != nil {
		return err
	}
	if err := seedRole(ctx, pool, multiID, "CUSTOMER"); err != nil {
		return err
	}
	if err := seedRole(ctx, pool, multiID, "SALES"); err != nil {
		return err
	}
	return seedIdentity(ctx, pool, multiID, "mock_multi_001")
}

func seedUser(ctx context.Context, pool *pgxpool.Pool, id uuid.UUID, name, userType string) error {
	_, err := pool.Exec(ctx, `
INSERT INTO users (id, display_name, user_type, owner_sales_user_id)
VALUES ($1, $2, $3, $4)
ON CONFLICT (id) DO UPDATE
SET display_name = EXCLUDED.display_name,
    user_type = EXCLUDED.user_type,
    owner_sales_user_id = EXCLUDED.owner_sales_user_id,
    updated_at = now()
`, id, &name, userType, pgtype.UUID{})
	return err
}

func seedRole(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, role string) error {
	_, err := pool.Exec(ctx, `
INSERT INTO user_roles (user_id, role)
VALUES ($1, $2)
ON CONFLICT (user_id, role) DO NOTHING
`, userID, role)
	return err
}

func seedIdentity(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, providerUserID string) error {
	_, err := pool.Exec(ctx, `
INSERT INTO user_identities (id, provider, provider_user_id, user_id)
VALUES ($1, $2, $3, $4)
ON CONFLICT (provider, provider_user_id) DO NOTHING
`, uuid.New(), "weapp", providerUserID, userID)
	return err
}

func seedCustomer(ctx context.Context, pool *pgxpool.Pool, id uuid.UUID, name string, ownerSalesID *uuid.UUID) error {
	owner := pgtype.UUID{}
	if ownerSalesID != nil {
		owner = pgtype.UUID{Bytes: *ownerSalesID, Valid: true}
	}

	_, err := pool.Exec(ctx, `
INSERT INTO users (id, display_name, user_type, owner_sales_user_id)
VALUES ($1, $2, $3, $4)
ON CONFLICT (id) DO UPDATE
SET display_name = EXCLUDED.display_name,
    user_type = EXCLUDED.user_type,
    owner_sales_user_id = EXCLUDED.owner_sales_user_id,
    updated_at = now()
`, id, &name, "customer", owner)
	if err != nil {
		return err
	}

	return seedRole(ctx, pool, id, "CUSTOMER")
}
