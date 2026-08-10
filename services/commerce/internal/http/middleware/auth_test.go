package middleware

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/teamdsb/tmo/packages/go-shared/authn"
)

type credentialValidatorFunc func(context.Context, string) error

func (f credentialValidatorFunc) Validate(ctx context.Context, authorization string) error {
	return f(ctx, authorization)
}

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

func TestRequireUserParsesOwnerSalesUserID(test *testing.T) {
	authenticator := NewAuthenticator(true, "secret", "issuer")
	userID := uuid.New()
	ownerSalesUserID := uuid.New()
	token := makeTokenWithOwner(test, "secret", "issuer", userID, "buyer", ownerSalesUserID.String())

	context, recorder := newTestContext()
	context.Request.Header.Set("Authorization", "Bearer "+token)

	claims, ok := authenticator.RequireUser(context)
	if !ok {
		test.Fatal("expected authentication to succeed")
	}
	if claims.OwnerSalesUserID != ownerSalesUserID {
		test.Fatalf("expected owner sales id %s, got %s", ownerSalesUserID, claims.OwnerSalesUserID)
	}
	if recorder.Code != http.StatusOK {
		test.Fatalf("expected status OK, got %d", recorder.Code)
	}
}

func TestRequireUserInvalidOwnerSalesUserID(test *testing.T) {
	authenticator := NewAuthenticator(true, "secret", "issuer")
	userID := uuid.New()
	token := makeTokenWithOwner(test, "secret", "issuer", userID, "buyer", "not-a-uuid")

	context, recorder := newTestContext()
	context.Request.Header.Set("Authorization", "Bearer "+token)

	_, ok := authenticator.RequireUser(context)
	if ok {
		test.Fatal("expected authentication to fail for invalid ownerSalesUserId")
	}
	if recorder.Code != http.StatusUnauthorized {
		test.Fatalf("expected status unauthorized, got %d", recorder.Code)
	}
}

func TestRequireUserParsesCustomerProfile(test *testing.T) {
	authenticator := NewAuthenticator(true, "secret", "issuer")
	userID := uuid.New()
	token := makeTokenWithProfile(test, "secret", "issuer", userID, "customer", "用户0003", "+15550000003")

	context, recorder := newTestContext()
	context.Request.Header.Set("Authorization", "Bearer "+token)

	claims, ok := authenticator.RequireUser(context)
	if !ok {
		test.Fatal("expected authentication to succeed")
	}
	if claims.DisplayName != "用户0003" {
		test.Fatalf("expected displayName 用户0003, got %q", claims.DisplayName)
	}
	if claims.Phone != "+15550000003" {
		test.Fatalf("expected phone +15550000003, got %q", claims.Phone)
	}
	if recorder.Code != http.StatusOK {
		test.Fatalf("expected status OK, got %d", recorder.Code)
	}
}

func TestRequireUserChecksCredentialRevocation(t *testing.T) {
	userID := uuid.New()
	token := makeToken(t, "secret", "issuer", userID, "buyer")

	tests := []struct {
		name       string
		validator  error
		wantOK     bool
		wantStatus int
	}{
		{name: "active", wantOK: true, wantStatus: http.StatusOK},
		{name: "revoked", validator: authn.ErrInvalidCredential, wantStatus: http.StatusUnauthorized},
		{name: "identity unavailable", validator: errors.New("network failure"), wantStatus: http.StatusServiceUnavailable},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			var gotAuthorization string
			authenticator := NewAuthenticator(true, "secret", "issuer", credentialValidatorFunc(func(_ context.Context, authorization string) error {
				gotAuthorization = authorization
				return test.validator
			}))
			ctx, recorder := newTestContext()
			ctx.Request.Header.Set("Authorization", "Bearer "+token)

			_, ok := authenticator.RequireUser(ctx)
			if ok != test.wantOK {
				t.Fatalf("RequireUser() ok = %v, want %v", ok, test.wantOK)
			}
			if recorder.Code != test.wantStatus {
				t.Fatalf("status = %d, want %d", recorder.Code, test.wantStatus)
			}
			if gotAuthorization != "Bearer "+token {
				t.Fatalf("validator authorization = %q", gotAuthorization)
			}
		})
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

func makeTokenWithOwner(test *testing.T, secret, issuer string, userID uuid.UUID, role string, ownerSalesUserID string) string {
	test.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":              userID.String(),
		"role":             role,
		"iss":              issuer,
		"ownerSalesUserId": ownerSalesUserID,
	})
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		test.Fatalf("sign token: %v", err)
	}
	return signed
}

func makeTokenWithProfile(test *testing.T, secret, issuer string, userID uuid.UUID, role string, displayName string, phone string) string {
	test.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":         userID.String(),
		"role":        role,
		"iss":         issuer,
		"displayName": displayName,
		"phone":       phone,
	})
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		test.Fatalf("sign token: %v", err)
	}
	return signed
}
