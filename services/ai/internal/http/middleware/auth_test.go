package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func TestRequireRoleReturnsAdminWhenAuthDisabled(t *testing.T) {
	gin.SetMode(gin.TestMode)

	auth := NewAuthenticator(false, "unused", "")
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/", nil)

	claims, ok := auth.RequireRole(ctx, "ADMIN")
	if !ok {
		t.Fatalf("expected auth disabled to allow request")
	}
	if claims.Role != "ADMIN" {
		t.Fatalf("expected ADMIN role, got %s", claims.Role)
	}
}

func TestRequireRoleAcceptsValidTokenAndParsesOwnerSalesUserID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	auth := NewAuthenticator(true, "secret-1", "issuer-1")
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	ctx.Request.Header.Set("Authorization", "Bearer "+signAuthToken(t, "secret-1", "issuer-1", "CS", "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"))

	claims, ok := auth.RequireRole(ctx, "CS")
	if !ok {
		t.Fatalf("expected valid token")
	}
	if claims.Role != "CS" || claims.OwnerSalesUserID.String() != "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" {
		t.Fatalf("unexpected claims %#v", claims)
	}
}

func TestRequireRoleRejectsWrongRole(t *testing.T) {
	gin.SetMode(gin.TestMode)

	auth := NewAuthenticator(true, "secret-1", "issuer-1")
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	ctx.Request.Header.Set("Authorization", "Bearer "+signAuthToken(t, "secret-1", "issuer-1", "CUSTOMER", ""))

	_, ok := auth.RequireRole(ctx, "CS")
	if ok {
		t.Fatalf("expected role mismatch to fail")
	}
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", recorder.Code)
	}
}

func TestRequireRoleRejectsInvalidIssuer(t *testing.T) {
	gin.SetMode(gin.TestMode)

	auth := NewAuthenticator(true, "secret-1", "issuer-1")
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	ctx.Request.Header.Set("Authorization", "Bearer "+signAuthToken(t, "secret-1", "wrong-issuer", "CS", ""))

	_, ok := auth.RequireRole(ctx, "CS")
	if ok {
		t.Fatalf("expected invalid issuer to fail")
	}
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", recorder.Code)
	}
}

func TestRequireRoleRejectsInvalidOwnerSalesUserID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	auth := NewAuthenticator(true, "secret-1", "issuer-1")
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"iss":              "issuer-1",
		"sub":              "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
		"role":             "CS",
		"ownerSalesUserId": "not-a-uuid",
	})
	signed, err := token.SignedString([]byte("secret-1"))
	if err != nil {
		t.Fatalf("SignedString() error = %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	ctx.Request.Header.Set("Authorization", "Bearer "+signed)

	_, ok := auth.RequireRole(ctx, "CS")
	if ok {
		t.Fatalf("expected invalid ownerSalesUserId to fail")
	}
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", recorder.Code)
	}
}

func signAuthToken(t *testing.T, secret, issuer, role, ownerSalesUserID string) string {
	t.Helper()

	claims := jwt.MapClaims{
		"iss":  issuer,
		"sub":  "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
		"role": role,
	}
	if ownerSalesUserID != "" {
		claims["ownerSalesUserId"] = ownerSalesUserID
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("SignedString() error = %v", err)
	}
	return signed
}
