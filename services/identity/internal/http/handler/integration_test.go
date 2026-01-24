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

	if authResponse.User.UserType != oapi.Customer {
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
	if me.UserType != oapi.Customer {
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
	if authResponse.User.UserType != oapi.Staff {
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
		DB:       pool,
		Logger:   logger,
		Auth:     auth.NewTokenManager("test-secret", "test-issuer", 2*time.Hour),
		Store:    store,
		Platform: platform.NewMiniLoginResolver("", ""),
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
TRUNCATE TABLE sales_qr_codes, user_passwords, user_identities, user_roles, users RESTART IDENTITY CASCADE
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
ON CONFLICT (provider, provider_user_id) DO UPDATE
SET user_id = EXCLUDED.user_id,
    updated_at = now()
`, uuid.New(), "weapp", providerUserID, userID)
	return err
}
