package main

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

const defaultDSN = "postgres://commerce:commerce@localhost:5432/identity?sslmode=disable"

const (
	adminUsername = "admin"
	adminPassword = "admin123"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	dsn := os.Getenv("IDENTITY_DB_DSN")
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

	if strings.EqualFold(os.Getenv("IDENTITY_SEED_RESET"), "true") {
		if _, err := pool.Exec(ctx, `
TRUNCATE TABLE
  audit_logs,
  staff_binding_tokens,
  sales_qr_codes,
  user_passwords,
  user_identities,
  user_roles,
  users,
  staff_phone_whitelist
RESTART IDENTITY CASCADE
`); err != nil {
			return fmt.Errorf("reset seed data: %w", err)
		}
	}

	adminID := uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	salesID := uuid.MustParse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
	multiID := uuid.MustParse("cccccccc-cccc-cccc-cccc-cccccccccccc")
	customerID := uuid.MustParse("dddddddd-dddd-dddd-dddd-dddddddddddd")

	if err := ensureUser(ctx, pool, seedUser{
		ID:          adminID,
		DisplayName: "Admin",
		UserType:    "admin",
		Phone:       strPtr("+15550000001"),
	}); err != nil {
		return err
	}
	if err := ensureUser(ctx, pool, seedUser{
		ID:          salesID,
		DisplayName: "Sales Dev",
		UserType:    "staff",
		Phone:       strPtr("+15550000002"),
	}); err != nil {
		return err
	}
	if err := ensureUser(ctx, pool, seedUser{
		ID:               customerID,
		DisplayName:      "Customer Dev",
		UserType:         "customer",
		OwnerSalesUserID: &salesID,
		Phone:            strPtr("+15550000003"),
	}); err != nil {
		return err
	}
	if err := ensureUser(ctx, pool, seedUser{
		ID:               multiID,
		DisplayName:      "Multi Role",
		UserType:         "customer",
		OwnerSalesUserID: &salesID,
		Phone:            strPtr("+15550000004"),
	}); err != nil {
		return err
	}

	if err := ensureRole(ctx, pool, adminID, "ADMIN"); err != nil {
		return err
	}
	if err := ensureRole(ctx, pool, salesID, "SALES"); err != nil {
		return err
	}
	if err := ensureRole(ctx, pool, customerID, "CUSTOMER"); err != nil {
		return err
	}
	if err := ensureRole(ctx, pool, multiID, "CUSTOMER"); err != nil {
		return err
	}
	if err := ensureRole(ctx, pool, multiID, "SALES"); err != nil {
		return err
	}

	if err := ensureIdentity(ctx, pool, seedIdentity{
		Provider:       "weapp",
		ProviderUserID: "mock_sales_001",
		UserID:         salesID,
	}); err != nil {
		return err
	}
	if err := ensureIdentity(ctx, pool, seedIdentity{
		Provider:       "weapp",
		ProviderUserID: "mock_customer_001",
		UserID:         customerID,
	}); err != nil {
		return err
	}
	if err := ensureIdentity(ctx, pool, seedIdentity{
		Provider:       "weapp",
		ProviderUserID: "mock_multi_001",
		UserID:         multiID,
	}); err != nil {
		return err
	}

	if err := ensureStaffPhoneWhitelist(ctx, pool, seedStaffPhoneWhitelist{
		Phone: "+15550000002",
		Roles: []string{"SALES"},
		Note:  "default sales fixture",
	}); err != nil {
		return err
	}
	if err := ensureStaffPhoneWhitelist(ctx, pool, seedStaffPhoneWhitelist{
		Phone: "+15550000004",
		Roles: []string{"SALES", "PROCUREMENT"},
		Note:  "multi-role fixture",
	}); err != nil {
		return err
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash admin password: %w", err)
	}
	if err := ensurePassword(ctx, pool, adminID, adminUsername, string(passwordHash)); err != nil {
		return err
	}

	fmt.Println("seed data applied")
	fmt.Printf("admin username: %s\n", adminUsername)
	fmt.Printf("admin password: %s\n", adminPassword)
	fmt.Println("seeded phones: +15550000001(admin), +15550000002(sales), +15550000003(customer), +15550000004(multi-role)")
	return nil
}

type seedUser struct {
	ID               uuid.UUID
	DisplayName      string
	UserType         string
	OwnerSalesUserID *uuid.UUID
	Phone            *string
}

func ensureUser(ctx context.Context, pool *pgxpool.Pool, user seedUser) error {
	if _, err := pool.Exec(ctx, `
INSERT INTO users (id, display_name, user_type, owner_sales_user_id, phone)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (id) DO UPDATE
SET display_name = EXCLUDED.display_name,
    user_type = EXCLUDED.user_type,
    owner_sales_user_id = EXCLUDED.owner_sales_user_id,
    phone = EXCLUDED.phone,
    updated_at = now()
`, user.ID, user.DisplayName, user.UserType, user.OwnerSalesUserID, user.Phone); err != nil {
		return fmt.Errorf("seed user %s: %w", user.DisplayName, err)
	}
	return nil
}

func ensureRole(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, role string) error {
	if _, err := pool.Exec(ctx, `
INSERT INTO user_roles (user_id, role)
VALUES ($1, $2)
ON CONFLICT (user_id, role) DO NOTHING
`, userID, role); err != nil {
		return fmt.Errorf("seed role %s: %w", role, err)
	}
	return nil
}

type seedIdentity struct {
	Provider       string
	ProviderUserID string
	UserID         uuid.UUID
}

func ensureIdentity(ctx context.Context, pool *pgxpool.Pool, identity seedIdentity) error {
	identityID := uuid.New()
	if _, err := pool.Exec(ctx, `
INSERT INTO user_identities (id, provider, provider_user_id, user_id)
VALUES ($1, $2, $3, $4)
ON CONFLICT (provider, provider_user_id) DO UPDATE
SET user_id = EXCLUDED.user_id,
    updated_at = now()
`, identityID, identity.Provider, identity.ProviderUserID, identity.UserID); err != nil {
		return fmt.Errorf("seed identity %s: %w", identity.ProviderUserID, err)
	}
	return nil
}

func ensurePassword(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, username, passwordHash string) error {
	if _, err := pool.Exec(ctx, `
INSERT INTO user_passwords (user_id, username, password_hash)
VALUES ($1, $2, $3)
ON CONFLICT (user_id) DO UPDATE
SET username = EXCLUDED.username,
    password_hash = EXCLUDED.password_hash,
    updated_at = now()
`, userID, username, passwordHash); err != nil {
		return fmt.Errorf("seed password for %s: %w", username, err)
	}
	return nil
}

type seedStaffPhoneWhitelist struct {
	Phone string
	Roles []string
	Note  string
}

func ensureStaffPhoneWhitelist(ctx context.Context, pool *pgxpool.Pool, seed seedStaffPhoneWhitelist) error {
	if _, err := pool.Exec(ctx, `
INSERT INTO staff_phone_whitelist (phone, roles, enabled, note)
VALUES ($1, $2, true, $3)
ON CONFLICT (phone) DO UPDATE
SET roles = EXCLUDED.roles,
    enabled = true,
    note = EXCLUDED.note,
    updated_at = now()
`, seed.Phone, seed.Roles, seed.Note); err != nil {
		return fmt.Errorf("seed staff phone whitelist %s: %w", seed.Phone, err)
	}
	return nil
}

func strPtr(v string) *string {
	return &v
}
