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
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/teamdsb/tmo/services/identity/internal/auth"
	"github.com/teamdsb/tmo/services/identity/internal/config"
	"github.com/teamdsb/tmo/services/identity/internal/db"
	httpserver "github.com/teamdsb/tmo/services/identity/internal/http"
	"github.com/teamdsb/tmo/services/identity/internal/http/handler"
	"github.com/teamdsb/tmo/services/identity/internal/http/oapi"
	"github.com/teamdsb/tmo/services/identity/internal/platform"
)

const (
	adminUsername = "admin"
	adminPassword = "admin123"
	csUsername    = "cs"
	csPassword    = "cs123"
	salesUsername = "sales"
	salesPassword = "sales123"
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

func TestMiniLoginRequiresPhoneProofInRealMode(t *testing.T) {
	router, pool := setupTestRouterWithMode(t, platform.LoginModeReal)
	ctx := context.Background()

	if err := resetIdentityTables(ctx, pool); err != nil {
		t.Fatalf("reset tables: %v", err)
	}

	resp := doJSON(t, router, http.MethodPost, "/auth/mini/login", map[string]interface{}{
		"platform": "weapp",
		"code":     "mock_customer_001",
	}, "")
	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", resp.Code, resp.Body.String())
	}

	var errResp map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&errResp); err != nil {
		t.Fatalf("decode error response: %v", err)
	}
	if errResp["code"] != "phone_required" {
		t.Fatalf("expected phone_required, got %#v", errResp["code"])
	}
}

func TestMiniLoginUsesWeappSimulationInRealModeWithoutWeappConfig(t *testing.T) {
	router, pool := setupTestRouterWithPlatformConfig(t, platform.Config{
		Mode:                       platform.LoginModeReal,
		EnablePhoneProofSimulation: true,
		PhoneProofSimulationPhone:  "+15550000003",
		WeappSalesPage:             "pages/index/index",
		WeappQRWidth:               256,
		AlipaySalesPage:            "pages/index/index",
	})
	ctx := context.Background()

	if err := resetIdentityTables(ctx, pool); err != nil {
		t.Fatalf("reset tables: %v", err)
	}

	firstLogin := doJSON(t, router, http.MethodPost, "/auth/mini/login", map[string]interface{}{
		"platform": "weapp",
		"code":     "wx-first-code",
		"phoneProof": map[string]interface{}{
			"code": "simulated_weapp_phone_proof",
		},
	}, "")
	if firstLogin.Code != http.StatusOK {
		t.Fatalf("expected first login 200, got %d: %s", firstLogin.Code, firstLogin.Body.String())
	}

	secondLogin := doJSON(t, router, http.MethodPost, "/auth/mini/login", map[string]interface{}{
		"platform": "weapp",
		"code":     "wx-second-code",
		"phoneProof": map[string]interface{}{
			"code": "simulated_weapp_phone_proof",
		},
	}, "")
	if secondLogin.Code != http.StatusOK {
		t.Fatalf("expected second login 200, got %d: %s", secondLogin.Code, secondLogin.Body.String())
	}

	store := db.New(pool)
	user, err := store.GetUserByIdentity(ctx, db.GetUserByIdentityParams{
		Provider:       "weapp",
		ProviderUserID: "sim_weapp:+15550000003",
	})
	if err != nil {
		t.Fatalf("lookup simulated identity: %v", err)
	}
	if user.Phone == nil || *user.Phone != "+15550000003" {
		t.Fatalf("expected simulated phone to be bound, got %#v", user.Phone)
	}
}

func TestMiniLoginReusesExistingWeappIdentityForSimulatedPhone(t *testing.T) {
	router, pool := setupTestRouterWithPlatformConfig(t, platform.Config{
		Mode:                       platform.LoginModeReal,
		EnablePhoneProofSimulation: true,
		PhoneProofSimulationPhone:  "+15550000003",
		WeappSalesPage:             "pages/index/index",
		WeappQRWidth:               256,
		AlipaySalesPage:            "pages/index/index",
	})
	ctx := context.Background()

	if err := resetIdentityTables(ctx, pool); err != nil {
		t.Fatalf("reset tables: %v", err)
	}

	customerID := uuid.MustParse("dddddddd-dddd-dddd-dddd-dddddddddddd")
	if err := seedCustomer(ctx, pool, customerID, "Customer Dev", nil); err != nil {
		t.Fatalf("seed customer: %v", err)
	}
	if err := seedCustomerPhone(ctx, pool, customerID, "+15550000003"); err != nil {
		t.Fatalf("seed customer phone: %v", err)
	}
	if err := seedIdentity(ctx, pool, customerID, "mock_customer_001"); err != nil {
		t.Fatalf("seed customer identity: %v", err)
	}

	resp := doJSON(t, router, http.MethodPost, "/auth/mini/login", map[string]interface{}{
		"platform": "weapp",
		"code":     "wx-simulated-code",
		"phoneProof": map[string]interface{}{
			"code": "simulated_weapp_phone_proof",
		},
	}, "")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected login 200, got %d: %s", resp.Code, resp.Body.String())
	}

	var authResponse oapi.AuthResponse
	if err := json.NewDecoder(resp.Body).Decode(&authResponse); err != nil {
		t.Fatalf("decode auth response: %v", err)
	}
	if authResponse.User.UserType != oapi.UserUserTypeCustomer {
		t.Fatalf("expected userType customer, got %s", authResponse.User.UserType)
	}

	var identityCount int
	if err := pool.QueryRow(ctx, `
SELECT count(*)
FROM user_identities
WHERE user_id = $1 AND provider = 'weapp'
`, customerID).Scan(&identityCount); err != nil {
		t.Fatalf("count customer identities: %v", err)
	}
	if identityCount != 1 {
		t.Fatalf("expected existing weapp identity to be reused, got %d identities", identityCount)
	}
}

func TestAuthMiniCapabilitiesShowsMissingWeappConfig(t *testing.T) {
	router, pool := setupTestRouterWithPlatformConfig(t, platform.Config{
		Mode:                        platform.LoginModeReal,
		EnablePhoneProofSimulation:  false,
		PhoneProofSimulationPhone:   "+15550000003",
		WeappSalesPage:              "pages/index/index",
		WeappQRWidth:                256,
		AlipaySalesPage:             "pages/index/index",
	})
	ctx := context.Background()

	if err := resetIdentityTables(ctx, pool); err != nil {
		t.Fatalf("reset tables: %v", err)
	}

	resp := doJSON(t, router, http.MethodGet, "/auth/mini/capabilities", nil, "")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}

	var payload map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		t.Fatalf("decode capabilities: %v", err)
	}

	weapp, ok := payload["weapp"].(map[string]any)
	if !ok {
		t.Fatalf("expected weapp payload, got %#v", payload["weapp"])
	}
	if payload["loginMode"] != "real" {
		t.Fatalf("expected loginMode real, got %#v", payload["loginMode"])
	}
	if weapp["realPhoneLoginReady"] != false {
		t.Fatalf("expected realPhoneLoginReady false, got %#v", weapp["realPhoneLoginReady"])
	}
}

func TestGetStaffSupportsPhoneQuery(t *testing.T) {
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
	if err := seedCustomerPhone(ctx, pool, salesID, "+15550000002"); err != nil {
		t.Fatalf("seed sales phone: %v", err)
	}

	loginResp := doJSON(t, router, http.MethodPost, "/auth/password/login", map[string]interface{}{
		"username": adminUsername,
		"password": adminPassword,
	}, "")
	if loginResp.Code != http.StatusOK {
		t.Fatalf("expected password login 200, got %d: %s", loginResp.Code, loginResp.Body.String())
	}
	var adminAuth oapi.AuthResponse
	if err := json.NewDecoder(loginResp.Body).Decode(&adminAuth); err != nil {
		t.Fatalf("decode auth response: %v", err)
	}
	resp := doJSON(t, router, http.MethodGet, "/staff?page=1&pageSize=20&q=%2B15550000002", nil, adminAuth.AccessToken)
	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.Code, resp.Body.String())
	}

	var payload oapi.PagedStaffList
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		t.Fatalf("decode staff list: %v", err)
	}
	if payload.Total != 1 || len(payload.Items) != 1 {
		t.Fatalf("expected 1 staff result, got total=%d items=%d", payload.Total, len(payload.Items))
	}
	if payload.Items[0].Phone == nil || *payload.Items[0].Phone != "+15550000002" {
		t.Fatalf("expected returned phone, got %#v", payload.Items[0].Phone)
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

func TestPasswordLoginRoleConflictAndRetry(t *testing.T) {
	router, pool := setupTestRouter(t)
	ctx := context.Background()

	if err := resetIdentityTables(ctx, pool); err != nil {
		t.Fatalf("reset tables: %v", err)
	}
	if err := seedAdmin(ctx, pool); err != nil {
		t.Fatalf("seed admin: %v", err)
	}
	if err := seedRole(ctx, pool, adminID, "BOSS"); err != nil {
		t.Fatalf("seed boss role: %v", err)
	}

	resp := doJSON(t, router, http.MethodPost, "/auth/password/login", map[string]interface{}{
		"username": adminUsername,
		"password": adminPassword,
	}, "")
	if resp.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", resp.Code, resp.Body.String())
	}

	var errResp map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&errResp); err != nil {
		t.Fatalf("decode error response: %v", err)
	}
	details, _ := errResp["details"].(map[string]interface{})
	available, _ := details["availableRoles"].([]interface{})
	if len(available) < 2 {
		t.Fatalf("expected availableRoles to include multiple entries, got %#v", details["availableRoles"])
	}

	retry := doJSON(t, router, http.MethodPost, "/auth/password/login", map[string]interface{}{
		"username": adminUsername,
		"password": adminPassword,
		"role":     "BOSS",
	}, "")
	if retry.Code != http.StatusOK {
		t.Fatalf("expected retry 200, got %d: %s", retry.Code, retry.Body.String())
	}
}

func TestPasswordLoginSalesRejected(t *testing.T) {
	router, pool := setupTestRouter(t)
	ctx := context.Background()

	if err := resetIdentityTables(ctx, pool); err != nil {
		t.Fatalf("reset tables: %v", err)
	}
	if err := seedSales(ctx, pool); err != nil {
		t.Fatalf("seed sales: %v", err)
	}
	if err := seedPassword(ctx, pool, salesID, salesUsername, salesPassword); err != nil {
		t.Fatalf("seed sales password: %v", err)
	}

	resp := doJSON(t, router, http.MethodPost, "/auth/password/login", map[string]interface{}{
		"username": salesUsername,
		"password": salesPassword,
	}, "")
	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestPasswordLoginCS(t *testing.T) {
	router, pool := setupTestRouter(t)
	ctx := context.Background()

	if err := resetIdentityTables(ctx, pool); err != nil {
		t.Fatalf("reset tables: %v", err)
	}

	csID := uuid.New()
	if err := seedUser(ctx, pool, csID, "CS Dev", "staff"); err != nil {
		t.Fatalf("seed cs: %v", err)
	}
	if err := seedRole(ctx, pool, csID, "CS"); err != nil {
		t.Fatalf("seed cs role: %v", err)
	}
	if err := seedPassword(ctx, pool, csID, csUsername, csPassword); err != nil {
		t.Fatalf("seed cs password: %v", err)
	}

	resp := doJSON(t, router, http.MethodPost, "/auth/password/login", map[string]interface{}{
		"username": csUsername,
		"password": csPassword,
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

func TestAdminCustomerFinanceProfile(t *testing.T) {
	type financeProfileResponse struct {
		CustomerID        uuid.UUID `json:"customerId"`
		PaymentTermRemark *string   `json:"paymentTermRemark"`
		UpdatedAt         string    `json:"updatedAt"`
	}

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

	customerID := uuid.New()
	if err := seedCustomer(ctx, pool, customerID, "账期客户", &salesID); err != nil {
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

	salesLogin := doJSON(t, router, http.MethodPost, "/auth/mini/login", map[string]interface{}{
		"platform": "weapp",
		"code":     "mock_sales_001",
		"role":     "SALES",
	}, "")
	if salesLogin.Code != http.StatusOK {
		t.Fatalf("expected sales login 200, got %d: %s", salesLogin.Code, salesLogin.Body.String())
	}
	var salesAuth oapi.AuthResponse
	if err := json.NewDecoder(salesLogin.Body).Decode(&salesAuth); err != nil {
		t.Fatalf("decode sales auth: %v", err)
	}

	path := "/admin/customers/" + customerID.String() + "/finance-profile"
	getResp := doJSON(t, router, http.MethodGet, path, nil, adminAuth.AccessToken)
	if getResp.Code != http.StatusOK {
		t.Fatalf("expected finance profile get 200, got %d: %s", getResp.Code, getResp.Body.String())
	}

	var profile financeProfileResponse
	if err := json.NewDecoder(getResp.Body).Decode(&profile); err != nil {
		t.Fatalf("decode profile: %v", err)
	}
	if profile.CustomerID != customerID {
		t.Fatalf("expected customer id %s, got %s", customerID, profile.CustomerID)
	}
	if profile.PaymentTermRemark != nil {
		t.Fatalf("expected nil remark, got %q", *profile.PaymentTermRemark)
	}
	if profile.UpdatedAt == "" {
		t.Fatalf("expected updatedAt to be set")
	}

	patchResp := doJSON(t, router, http.MethodPatch, path, map[string]interface{}{
		"paymentTermRemark": "  月结 30 天，对公转账  ",
	}, adminAuth.AccessToken)
	if patchResp.Code != http.StatusOK {
		t.Fatalf("expected finance profile patch 200, got %d: %s", patchResp.Code, patchResp.Body.String())
	}

	if err := json.NewDecoder(patchResp.Body).Decode(&profile); err != nil {
		t.Fatalf("decode patched profile: %v", err)
	}
	if profile.PaymentTermRemark == nil || *profile.PaymentTermRemark != "月结 30 天，对公转账" {
		t.Fatalf("expected trimmed remark, got %#v", profile.PaymentTermRemark)
	}

	getUpdatedResp := doJSON(t, router, http.MethodGet, path, nil, adminAuth.AccessToken)
	if getUpdatedResp.Code != http.StatusOK {
		t.Fatalf("expected finance profile get 200 after patch, got %d: %s", getUpdatedResp.Code, getUpdatedResp.Body.String())
	}
	if err := json.NewDecoder(getUpdatedResp.Body).Decode(&profile); err != nil {
		t.Fatalf("decode updated profile: %v", err)
	}
	if profile.PaymentTermRemark == nil || *profile.PaymentTermRemark != "月结 30 天，对公转账" {
		t.Fatalf("expected persisted remark, got %#v", profile.PaymentTermRemark)
	}

	clearResp := doJSON(t, router, http.MethodPatch, path, map[string]interface{}{
		"paymentTermRemark": "   ",
	}, adminAuth.AccessToken)
	if clearResp.Code != http.StatusOK {
		t.Fatalf("expected clear remark 200, got %d: %s", clearResp.Code, clearResp.Body.String())
	}
	if err := json.NewDecoder(clearResp.Body).Decode(&profile); err != nil {
		t.Fatalf("decode cleared profile: %v", err)
	}
	if profile.PaymentTermRemark != nil {
		t.Fatalf("expected cleared nil remark, got %#v", profile.PaymentTermRemark)
	}

	forbiddenResp := doJSON(t, router, http.MethodPatch, path, map[string]interface{}{
		"paymentTermRemark": "现款",
	}, salesAuth.AccessToken)
	if forbiddenResp.Code != http.StatusForbidden {
		t.Fatalf("expected non-admin patch 403, got %d: %s", forbiddenResp.Code, forbiddenResp.Body.String())
	}

	notFoundResp := doJSON(t, router, http.MethodGet, "/admin/customers/"+uuid.NewString()+"/finance-profile", nil, adminAuth.AccessToken)
	if notFoundResp.Code != http.StatusNotFound {
		t.Fatalf("expected unknown customer 404, got %d: %s", notFoundResp.Code, notFoundResp.Body.String())
	}

	tooLongResp := doJSON(t, router, http.MethodPatch, path, map[string]interface{}{
		"paymentTermRemark": strings.Repeat("x", 501),
	}, adminAuth.AccessToken)
	if tooLongResp.Code != http.StatusBadRequest {
		t.Fatalf("expected too long remark 400, got %d: %s", tooLongResp.Code, tooLongResp.Body.String())
	}
}

func TestAdminCustomerTransferAndBatch(t *testing.T) {
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

	targetSalesID := uuid.New()
	if err := seedUser(ctx, pool, targetSalesID, "Target Sales", "staff"); err != nil {
		t.Fatalf("seed target sales: %v", err)
	}
	if err := seedRole(ctx, pool, targetSalesID, "SALES"); err != nil {
		t.Fatalf("seed target sales role: %v", err)
	}

	customer1 := uuid.New()
	customer2 := uuid.New()
	customer3 := uuid.New()
	if err := seedCustomer(ctx, pool, customer1, "客户1", &salesID); err != nil {
		t.Fatalf("seed customer1: %v", err)
	}
	if err := seedCustomer(ctx, pool, customer2, "客户2", &salesID); err != nil {
		t.Fatalf("seed customer2: %v", err)
	}
	if err := seedCustomer(ctx, pool, customer3, "客户3", nil); err != nil {
		t.Fatalf("seed customer3: %v", err)
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

	singleTransfer := doJSON(t, router, http.MethodPost, "/admin/customers/"+customer1.String()+"/transfer", map[string]interface{}{
		"toSalesUserId": targetSalesID.String(),
		"reason":        "区域调整",
	}, adminAuth.AccessToken)
	if singleTransfer.Code != http.StatusNoContent {
		t.Fatalf("expected single transfer 204, got %d: %s", singleTransfer.Code, singleTransfer.Body.String())
	}

	detail1 := doJSON(t, router, http.MethodGet, "/customers/"+customer1.String(), nil, adminAuth.AccessToken)
	if detail1.Code != http.StatusOK {
		t.Fatalf("expected customer detail 200, got %d: %s", detail1.Code, detail1.Body.String())
	}
	var customerDetail oapi.Customer
	if err := json.NewDecoder(detail1.Body).Decode(&customerDetail); err != nil {
		t.Fatalf("decode customer detail: %v", err)
	}
	if customerDetail.OwnerSalesUserId == nil || uuid.UUID(*customerDetail.OwnerSalesUserId) != targetSalesID {
		t.Fatalf("expected ownerSalesUserId %s, got %#v", targetSalesID, customerDetail.OwnerSalesUserId)
	}

	batchTransfer := doJSON(t, router, http.MethodPost, "/admin/customers/transfer", map[string]interface{}{
		"customerIds":   []string{customer2.String(), customer3.String()},
		"toSalesUserId": targetSalesID.String(),
		"reason":        "批量重分配",
	}, adminAuth.AccessToken)
	if batchTransfer.Code != http.StatusOK {
		t.Fatalf("expected batch transfer 200, got %d: %s", batchTransfer.Code, batchTransfer.Body.String())
	}
	var transferResp struct {
		RequestedCount int `json:"requestedCount"`
		Transferred    int `json:"transferredCount"`
		Unchanged      int `json:"unchangedCount"`
	}
	if err := json.NewDecoder(batchTransfer.Body).Decode(&transferResp); err != nil {
		t.Fatalf("decode batch transfer response: %v", err)
	}
	if transferResp.RequestedCount != 2 || transferResp.Transferred != 2 || transferResp.Unchanged != 0 {
		t.Fatalf("unexpected batch transfer result: %#v", transferResp)
	}

	for _, customerID := range []uuid.UUID{customer2, customer3} {
		detailResp := doJSON(t, router, http.MethodGet, "/customers/"+customerID.String(), nil, adminAuth.AccessToken)
		if detailResp.Code != http.StatusOK {
			t.Fatalf("expected customer detail 200 for %s, got %d: %s", customerID, detailResp.Code, detailResp.Body.String())
		}
		var detail oapi.Customer
		if err := json.NewDecoder(detailResp.Body).Decode(&detail); err != nil {
			t.Fatalf("decode customer detail for %s: %v", customerID, err)
		}
		if detail.OwnerSalesUserId == nil || uuid.UUID(*detail.OwnerSalesUserId) != targetSalesID {
			t.Fatalf("expected ownerSalesUserId %s for %s, got %#v", targetSalesID, customerID, detail.OwnerSalesUserId)
		}
	}

	invalidTarget := doJSON(t, router, http.MethodPost, "/admin/customers/"+customer1.String()+"/transfer", map[string]interface{}{
		"toSalesUserId": customer2.String(),
	}, adminAuth.AccessToken)
	if invalidTarget.Code != http.StatusBadRequest {
		t.Fatalf("expected invalid transfer target 400, got %d: %s", invalidTarget.Code, invalidTarget.Body.String())
	}
}

func TestAdminUsersList(t *testing.T) {
	router, pool := setupTestRouter(t)
	ctx := context.Background()

	if err := resetIdentityTables(ctx, pool); err != nil {
		t.Fatalf("reset tables: %v", err)
	}
	if err := seedAdmin(ctx, pool); err != nil {
		t.Fatalf("seed admin: %v", err)
	}

	managerID := uuid.New()
	if err := seedUser(ctx, pool, managerID, "Manager", "staff"); err != nil {
		t.Fatalf("seed manager user: %v", err)
	}
	if err := seedRole(ctx, pool, managerID, "MANAGER"); err != nil {
		t.Fatalf("seed manager role: %v", err)
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

	listResp := doJSON(t, router, http.MethodGet, "/admin/users?page=1&pageSize=20", nil, adminAuth.AccessToken)
	if listResp.Code != http.StatusOK {
		t.Fatalf("expected list admin users 200, got %d: %s", listResp.Code, listResp.Body.String())
	}
	var listPayload struct {
		Items []struct {
			ID    string   `json:"id"`
			Roles []string `json:"roles"`
		} `json:"items"`
		Total int `json:"total"`
	}
	if err := json.NewDecoder(listResp.Body).Decode(&listPayload); err != nil {
		t.Fatalf("decode list admin users: %v", err)
	}
	if listPayload.Total < 2 {
		t.Fatalf("expected at least 2 admin users, got %d", listPayload.Total)
	}

	filteredResp := doJSON(t, router, http.MethodGet, "/admin/users?page=1&pageSize=20&role=ADMIN", nil, adminAuth.AccessToken)
	if filteredResp.Code != http.StatusOK {
		t.Fatalf("expected filtered admin users 200, got %d: %s", filteredResp.Code, filteredResp.Body.String())
	}
	var filteredPayload struct {
		Items []struct {
			ID    string   `json:"id"`
			Roles []string `json:"roles"`
		} `json:"items"`
		Total int `json:"total"`
	}
	if err := json.NewDecoder(filteredResp.Body).Decode(&filteredPayload); err != nil {
		t.Fatalf("decode filtered admin users: %v", err)
	}
	if filteredPayload.Total == 0 {
		t.Fatalf("expected filtered admin users")
	}
	for _, item := range filteredPayload.Items {
		if !containsRole(item.Roles, "ADMIN") {
			t.Fatalf("expected ADMIN role in filtered result, got %#v", item.Roles)
		}
	}
}

func TestPromoteCustomerToSalesIsIdempotent(t *testing.T) {
	router, pool := setupTestRouter(t)
	ctx := context.Background()

	if err := resetIdentityTables(ctx, pool); err != nil {
		t.Fatalf("reset tables: %v", err)
	}
	if err := seedAdmin(ctx, pool); err != nil {
		t.Fatalf("seed admin: %v", err)
	}

	customerID := uuid.New()
	if err := seedCustomer(ctx, pool, customerID, "待提权客户", nil); err != nil {
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

	path := "/admin/customers/" + customerID.String() + "/promote-to-sales"
	first := doJSON(t, router, http.MethodPost, path, map[string]interface{}{}, adminAuth.AccessToken)
	if first.Code != http.StatusOK {
		t.Fatalf("expected first promote 200, got %d: %s", first.Code, first.Body.String())
	}
	var firstPayload struct {
		ID       string   `json:"id"`
		UserType string   `json:"userType"`
		Roles    []string `json:"roles"`
		Promoted bool     `json:"promoted"`
	}
	if err := json.NewDecoder(first.Body).Decode(&firstPayload); err != nil {
		t.Fatalf("decode first promote payload: %v", err)
	}
	if firstPayload.ID != customerID.String() {
		t.Fatalf("expected id %s, got %s", customerID, firstPayload.ID)
	}
	if firstPayload.UserType != "staff" {
		t.Fatalf("expected promoted userType staff, got %s", firstPayload.UserType)
	}
	if !containsRole(firstPayload.Roles, "SALES") {
		t.Fatalf("expected SALES role after promote, got %#v", firstPayload.Roles)
	}
	if !firstPayload.Promoted {
		t.Fatalf("expected first promote marked as promoted")
	}

	second := doJSON(t, router, http.MethodPost, path, map[string]interface{}{}, adminAuth.AccessToken)
	if second.Code != http.StatusOK {
		t.Fatalf("expected second promote 200, got %d: %s", second.Code, second.Body.String())
	}
	var secondPayload struct {
		Roles    []string `json:"roles"`
		Promoted bool     `json:"promoted"`
	}
	if err := json.NewDecoder(second.Body).Decode(&secondPayload); err != nil {
		t.Fatalf("decode second promote payload: %v", err)
	}
	if !containsRole(secondPayload.Roles, "SALES") {
		t.Fatalf("expected SALES role after second promote, got %#v", secondPayload.Roles)
	}
	if secondPayload.Promoted {
		t.Fatalf("expected second promote to be idempotent")
	}
}

func TestAdminCustomerTagsAndBatchUpdate(t *testing.T) {
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

	customerA := uuid.New()
	customerB := uuid.New()
	if err := seedCustomer(ctx, pool, customerA, "打标客户A", &salesID); err != nil {
		t.Fatalf("seed customer A: %v", err)
	}
	if err := seedCustomer(ctx, pool, customerB, "打标客户B", nil); err != nil {
		t.Fatalf("seed customer B: %v", err)
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

	createTag := doJSON(t, router, http.MethodPost, "/admin/customer-tags", map[string]interface{}{
		"name":  "重点客户",
		"color": "#FF8800",
	}, adminAuth.AccessToken)
	if createTag.Code != http.StatusCreated {
		t.Fatalf("expected create tag 201, got %d: %s", createTag.Code, createTag.Body.String())
	}
	var createdTag struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(createTag.Body).Decode(&createdTag); err != nil {
		t.Fatalf("decode created tag: %v", err)
	}
	if createdTag.ID == "" {
		t.Fatalf("expected created tag id")
	}

	applyTags := doJSON(t, router, http.MethodPost, "/admin/customers/tags:batch-update", map[string]interface{}{
		"customerIds": []string{customerA.String(), customerB.String()},
		"addTagIds":   []string{createdTag.ID},
	}, adminAuth.AccessToken)
	if applyTags.Code != http.StatusOK {
		t.Fatalf("expected batch add tags 200, got %d: %s", applyTags.Code, applyTags.Body.String())
	}

	filtered := doJSON(
		t,
		router,
		http.MethodGet,
		"/admin/customers?page=1&pageSize=10&tagIds="+createdTag.ID,
		nil,
		adminAuth.AccessToken,
	)
	if filtered.Code != http.StatusOK {
		t.Fatalf("expected filtered customers 200, got %d: %s", filtered.Code, filtered.Body.String())
	}
	var customerList struct {
		Items []struct {
			ID   string `json:"id"`
			Tags []struct {
				ID string `json:"id"`
			} `json:"tags"`
		} `json:"items"`
		Total int `json:"total"`
	}
	if err := json.NewDecoder(filtered.Body).Decode(&customerList); err != nil {
		t.Fatalf("decode filtered customers: %v", err)
	}
	if customerList.Total != 2 || len(customerList.Items) != 2 {
		t.Fatalf("expected 2 tagged customers, got total=%d items=%d", customerList.Total, len(customerList.Items))
	}

	removeTag := doJSON(t, router, http.MethodPost, "/admin/customers/tags:batch-update", map[string]interface{}{
		"customerIds":  []string{customerB.String()},
		"removeTagIds": []string{createdTag.ID},
	}, adminAuth.AccessToken)
	if removeTag.Code != http.StatusOK {
		t.Fatalf("expected batch remove tag 200, got %d: %s", removeTag.Code, removeTag.Body.String())
	}

	disableTag := doJSON(t, router, http.MethodPatch, "/admin/customer-tags/"+createdTag.ID, map[string]interface{}{
		"active": false,
	}, adminAuth.AccessToken)
	if disableTag.Code != http.StatusOK {
		t.Fatalf("expected disable tag 200, got %d: %s", disableTag.Code, disableTag.Body.String())
	}

	addInactive := doJSON(t, router, http.MethodPost, "/admin/customers/tags:batch-update", map[string]interface{}{
		"customerIds": []string{customerB.String()},
		"addTagIds":   []string{createdTag.ID},
	}, adminAuth.AccessToken)
	if addInactive.Code != http.StatusBadRequest {
		t.Fatalf("expected add inactive tag 400, got %d: %s", addInactive.Code, addInactive.Body.String())
	}
}

func containsRole(roles []string, role string) bool {
	for _, candidate := range roles {
		if strings.EqualFold(candidate, role) {
			return true
		}
	}
	return false
}

func setupTestRouter(t *testing.T) (*gin.Engine, *pgxpool.Pool) {
	return setupTestRouterWithMode(t, platform.LoginModeMock)
}

func setupTestRouterWithMode(t *testing.T, mode platform.LoginMode) (*gin.Engine, *pgxpool.Pool) {
	return setupTestRouterWithPlatformConfig(t, platform.Config{
		Mode:            mode,
		WeappSalesPage:  "pages/index/index",
		WeappQRWidth:    256,
		AlipaySalesPage: "pages/index/index",
	})
}

func setupTestRouterWithPlatformConfig(t *testing.T, resolverConfig platform.Config) (*gin.Engine, *pgxpool.Pool) {
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
		Config: config.Config{
			LoginMode:                  string(resolverConfig.Mode),
			WeappAppID:                 resolverConfig.WeappAppID,
			WeappAppSecret:             resolverConfig.WeappAppSecret,
			EnablePhoneProofSimulation: resolverConfig.EnablePhoneProofSimulation,
		},
		DB:       pool,
		Logger:   logger,
		Auth:     auth.NewTokenManager("test-secret", "test-issuer", 2*time.Hour),
		Store:    store,
		Platform: platform.NewMiniLoginResolver(resolverConfig),
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
TRUNCATE TABLE audit_logs, staff_binding_tokens, sales_qr_codes, user_passwords, user_identities, user_roles, customer_tag_bindings, customer_tags, users RESTART IDENTITY CASCADE
`)
	return err
}

func seedAdmin(ctx context.Context, pool *pgxpool.Pool) error {
	if err := seedUser(ctx, pool, adminID, "Admin", "admin"); err != nil {
		return err
	}
	if err := seedRole(ctx, pool, adminID, "ADMIN"); err != nil {
		return err
	}
	return seedPassword(ctx, pool, adminID, adminUsername, adminPassword)
}

func seedPassword(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, username, password string) error {
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	if _, err := pool.Exec(ctx, `
INSERT INTO user_passwords (user_id, username, password_hash)
VALUES ($1, $2, $3)
ON CONFLICT (user_id) DO UPDATE
SET username = EXCLUDED.username,
    password_hash = EXCLUDED.password_hash,
    updated_at = now()
`, userID, username, string(passwordHash)); err != nil {
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

func seedCustomerPhone(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, phone string) error {
	_, err := pool.Exec(ctx, `
UPDATE users
SET phone = $2,
    updated_at = now()
WHERE id = $1
`, userID, phone)
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
