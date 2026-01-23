package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

func TestRequireUserDisabled(test *testing.T) {
	authenticator := NewAuthenticator(false, "secret", "issuer")
	context, recorder := newTestContext()

	claims, ok := authenticator.RequireUser(context)
	if !ok {
		test.Fatal("expected authentication to succeed when disabled")
	}
	if claims.Role != "ADMIN" {
		test.Fatalf("expected ADMIN role, got %q", claims.Role)
	}
	if recorder.Code != http.StatusOK {
		test.Fatalf("expected status OK, got %d", recorder.Code)
	}
}

func TestRequireUserMissingHeader(test *testing.T) {
	authenticator := NewAuthenticator(true, "secret", "issuer")
	context, recorder := newTestContext()

	_, ok := authenticator.RequireUser(context)
	if ok {
		test.Fatal("expected authentication to fail without header")
	}
	if recorder.Code != http.StatusUnauthorized {
		test.Fatalf("expected status unauthorized, got %d", recorder.Code)
	}
}

func TestRequireRoleMismatch(test *testing.T) {
	authenticator := NewAuthenticator(true, "secret", "issuer")
	userID := uuid.New()
	token := makeToken(test, "secret", "issuer", userID, "buyer")

	context, recorder := newTestContext()
	context.Request.Header.Set("Authorization", "Bearer "+token)

	_, ok := authenticator.RequireRole(context, "ADMIN")
	if ok {
		test.Fatal("expected role check to fail")
	}
	if recorder.Code != http.StatusForbidden {
		test.Fatalf("expected status forbidden, got %d", recorder.Code)
	}
}

func TestRequireRoleMatch(test *testing.T) {
	authenticator := NewAuthenticator(true, "secret", "issuer")
	userID := uuid.New()
	token := makeToken(test, "secret", "issuer", userID, "buyer")

	context, recorder := newTestContext()
	context.Request.Header.Set("Authorization", "Bearer "+token)

	claims, ok := authenticator.RequireRole(context, "buyer")
	if !ok {
		test.Fatal("expected role check to succeed")
	}
	if claims.UserID != userID {
		test.Fatalf("expected user id %s, got %s", userID, claims.UserID)
	}
	if recorder.Code != http.StatusOK {
		test.Fatalf("expected status OK, got %d", recorder.Code)
	}
}

func newTestContext() (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/", nil)
	return context, recorder
}

func makeToken(test *testing.T, secret, issuer string, userID uuid.UUID, role string) string {
	test.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  userID.String(),
		"role": role,
		"iss":  issuer,
	})
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		test.Fatalf("sign token: %v", err)
	}
	return signed
}
