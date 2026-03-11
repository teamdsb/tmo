package main

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

const defaultDSN = "postgres://commerce:commerce@localhost:5432/identity?sslmode=disable"

const (
	bossUsername    = "boss"
	bossPassword    = "boss123"
	managerUsername = "manager"
	managerPassword = "manager123"
	csUsername      = "cs"
	csPassword      = "cs123"
	salesUsername   = "sales"
	salesPassword   = "sales123"
	adminUsername   = "admin"
	adminPassword   = "admin123"
	debugUsername   = "debug"
	debugPassword   = "debug123"
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
		fmt.Println("resetting identity seed data...")
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
	bossID := uuid.MustParse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee")
	managerID := uuid.MustParse("ffffffff-ffff-ffff-ffff-ffffffffffff")
	csID := uuid.MustParse("99999999-9999-9999-9999-999999999999")
	salesID := uuid.MustParse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
	multiID := uuid.MustParse("cccccccc-cccc-cccc-cccc-cccccccccccc")
	customerID := uuid.MustParse("dddddddd-dddd-dddd-dddd-dddddddddddd")
	debugID := uuid.MustParse("12121212-1212-1212-1212-121212121212")

	if err := ensureUser(ctx, pool, seedUser{
		ID:          adminID,
		DisplayName: "Admin",
		UserType:    "admin",
		Phone:       strPtr("+15550000001"),
	}); err != nil {
		return err
	}
	if err := ensureUser(ctx, pool, seedUser{
		ID:          bossID,
		DisplayName: "Boss",
		UserType:    "admin",
		Phone:       strPtr("+15550000005"),
	}); err != nil {
		return err
	}
	if err := ensureUser(ctx, pool, seedUser{
		ID:          managerID,
		DisplayName: "Manager",
		UserType:    "staff",
		Phone:       strPtr("+15550000006"),
	}); err != nil {
		return err
	}
	if err := ensureUser(ctx, pool, seedUser{
		ID:          csID,
		DisplayName: "CS Dev",
		UserType:    "staff",
		Phone:       strPtr("+15550000007"),
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
	if err := ensureUser(ctx, pool, seedUser{
		ID:               debugID,
		DisplayName:      "Debug All Roles",
		UserType:         "customer",
		OwnerSalesUserID: &salesID,
		Phone:            strPtr("+15550000008"),
	}); err != nil {
		return err
	}

	roleTargets := []seedRoleAssignment{
		{UserID: adminID, Roles: []string{"ADMIN"}},
		{UserID: bossID, Roles: []string{"BOSS"}},
		{UserID: managerID, Roles: []string{"MANAGER"}},
		{UserID: csID, Roles: []string{"CS"}},
		{UserID: salesID, Roles: []string{"SALES"}},
		{UserID: customerID, Roles: []string{"CUSTOMER"}},
		{UserID: multiID, Roles: []string{"CUSTOMER", "SALES"}},
		{UserID: debugID, Roles: []string{"CUSTOMER", "SALES", "CS", "MANAGER", "ADMIN", "BOSS"}},
	}
	for _, roleTarget := range roleTargets {
		if err := ensureExactRoles(ctx, pool, roleTarget.UserID, roleTarget.Roles); err != nil {
			return err
		}
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
	if err := ensureIdentity(ctx, pool, seedIdentity{
		Provider:       "weapp",
		ProviderUserID: "mock_debug_001",
		UserID:         debugID,
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
		Roles: []string{"SALES", "CS"},
		Note:  "multi-role fixture",
	}); err != nil {
		return err
	}

	adminPasswordHash, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash admin password: %w", err)
	}
	if err := ensurePassword(ctx, pool, adminID, adminUsername, string(adminPasswordHash)); err != nil {
		return err
	}
	bossPasswordHash, err := bcrypt.GenerateFromPassword([]byte(bossPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash boss password: %w", err)
	}
	if err := ensurePassword(ctx, pool, bossID, bossUsername, string(bossPasswordHash)); err != nil {
		return err
	}
	managerPasswordHash, err := bcrypt.GenerateFromPassword([]byte(managerPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash manager password: %w", err)
	}
	if err := ensurePassword(ctx, pool, managerID, managerUsername, string(managerPasswordHash)); err != nil {
		return err
	}
	csPasswordHash, err := bcrypt.GenerateFromPassword([]byte(csPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash cs password: %w", err)
	}
	if err := ensurePassword(ctx, pool, csID, csUsername, string(csPasswordHash)); err != nil {
		return err
	}
	salesPasswordHash, err := bcrypt.GenerateFromPassword([]byte(salesPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash sales password: %w", err)
	}
	if err := ensurePassword(ctx, pool, salesID, salesUsername, string(salesPasswordHash)); err != nil {
		return err
	}
	debugPasswordHash, err := bcrypt.GenerateFromPassword([]byte(debugPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("hash debug password: %w", err)
	}
	if err := ensurePassword(ctx, pool, debugID, debugUsername, string(debugPasswordHash)); err != nil {
		return err
	}
	if err := verifySeedState(ctx, pool); err != nil {
		return err
	}

	fmt.Println("seed data applied (identity)")
	fmt.Println("web login accounts:")
	fmt.Printf("- %s / %s (role: ADMIN)\n", adminUsername, adminPassword)
	fmt.Printf("- %s / %s (role: BOSS)\n", bossUsername, bossPassword)
	fmt.Printf("- %s / %s (role: MANAGER)\n", managerUsername, managerPassword)
	fmt.Printf("- %s / %s (role: CS)\n", csUsername, csPassword)
	fmt.Printf("- %s / %s (roles: BOSS / ADMIN / MANAGER / CS; use /auth/debug/switch-role for local role switch)\n", debugUsername, debugPassword)
	fmt.Println("miniapp account:")
	fmt.Printf("- %s / %s (role: SALES, password login disabled)\n", salesUsername, salesPassword)
	fmt.Println("seeded phones: +15550000001(admin), +15550000002(sales), +15550000003(customer), +15550000004(multi-role), +15550000005(boss), +15550000006(manager), +15550000007(cs), +15550000008(debug)")
	return nil
}

func verifySeedState(ctx context.Context, pool *pgxpool.Pool) error {
	requiredPasswords := map[string]string{
		adminUsername:   "ADMIN",
		bossUsername:    "BOSS",
		managerUsername: "MANAGER",
		csUsername:      "CS",
		salesUsername:   "SALES",
		debugUsername:   "ADMIN",
	}
	for username, role := range requiredPasswords {
		var exists bool
		if err := pool.QueryRow(ctx, `
SELECT EXISTS (
  SELECT 1
  FROM user_passwords up
  JOIN user_roles ur ON ur.user_id = up.user_id
  WHERE up.username = $1 AND ur.role = $2
)
`, username, role).Scan(&exists); err != nil {
			return fmt.Errorf("verify password seed for %s: %w", username, err)
		}
		if !exists {
			return fmt.Errorf("verify password seed for %s: missing password or role %s", username, role)
		}
	}

	requiredBindings := map[string]string{
		"mock_sales_001":    "SALES",
		"mock_customer_001": "CUSTOMER",
		"mock_multi_001":    "CUSTOMER",
		"mock_debug_001":    "CUSTOMER",
	}
	for providerUserID, role := range requiredBindings {
		var exists bool
		if err := pool.QueryRow(ctx, `
SELECT EXISTS (
  SELECT 1
  FROM user_identities ui
  JOIN user_roles ur ON ur.user_id = ui.user_id
  WHERE ui.provider = 'weapp' AND ui.provider_user_id = $1 AND ur.role = $2
)
`, providerUserID, role).Scan(&exists); err != nil {
			return fmt.Errorf("verify identity binding %s: %w", providerUserID, err)
		}
		if !exists {
			return fmt.Errorf("verify identity binding %s: missing role %s", providerUserID, role)
		}
	}

	requiredPhones := map[string][]string{
		"+15550000002": {"SALES"},
		"+15550000004": {"SALES", "CS"},
	}
	for phone, roles := range requiredPhones {
		var stored []string
		if err := pool.QueryRow(ctx, `
SELECT roles
FROM staff_phone_whitelist
WHERE phone = $1 AND enabled = true
`, phone).Scan(&stored); err != nil {
			if err == pgx.ErrNoRows {
				return fmt.Errorf("verify phone whitelist %s: %w", phone, err)
			}
			return fmt.Errorf("verify phone whitelist %s: %w", phone, err)
		}
		if !sameStringSet(stored, roles) {
			return fmt.Errorf("verify phone whitelist %s: expected roles %v, got %v", phone, roles, stored)
		}
	}

	return nil
}

func sameStringSet(left, right []string) bool {
	if len(left) != len(right) {
		return false
	}
	seen := make(map[string]int, len(left))
	for _, item := range left {
		seen[item]++
	}
	for _, item := range right {
		seen[item]--
		if seen[item] < 0 {
			return false
		}
	}
	for _, count := range seen {
		if count != 0 {
			return false
		}
	}
	return true
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

type seedRoleAssignment struct {
	UserID uuid.UUID
	Roles  []string
}

func ensureExactRoles(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, roles []string) error {
	if len(roles) == 0 {
		return fmt.Errorf("seed roles for user %s: roles is required", userID)
	}

	if _, err := pool.Exec(ctx, `
DELETE FROM user_roles
WHERE user_id = $1
  AND NOT (role = ANY($2::text[]))
`, userID, roles); err != nil {
		return fmt.Errorf("cleanup stale roles for user %s: %w", userID, err)
	}

	for _, role := range roles {
		if _, err := pool.Exec(ctx, `
INSERT INTO user_roles (user_id, role)
VALUES ($1, $2)
ON CONFLICT (user_id, role) DO NOTHING
`, userID, role); err != nil {
			return fmt.Errorf("seed role %s for user %s: %w", role, userID, err)
		}
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
DELETE FROM user_passwords
WHERE user_id = $1 OR username = $2
`, userID, username); err != nil {
		return fmt.Errorf("cleanup password for %s: %w", username, err)
	}

	if _, err := pool.Exec(ctx, `
INSERT INTO user_passwords (user_id, username, password_hash)
VALUES ($1, $2, $3)
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
