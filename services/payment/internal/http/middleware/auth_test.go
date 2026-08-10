package middleware

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"

	"github.com/teamdsb/tmo/packages/go-shared/authn"
)

type credentialValidatorFunc func(context.Context, string) error

func (f credentialValidatorFunc) Validate(ctx context.Context, authorization string) error {
	return f(ctx, authorization)
}

func TestRequireUserChecksCredentialRevocation(t *testing.T) {
	const (
		secret = "payment-auth-test-secret"
		issuer = "payment-auth-test-issuer"
	)
	tests := []struct {
		name       string
		validator  error
		wantOK     bool
		wantStatus int
	}{
		{name: "active", wantOK: true, wantStatus: http.StatusOK},
		{name: "revoked", validator: authn.ErrInvalidCredential, wantStatus: http.StatusUnauthorized},
		{name: "identity unavailable", validator: errors.New("identity network failure"), wantStatus: http.StatusServiceUnavailable},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			token := signedCredentialTestToken(t, secret, issuer)
			authorization := "Bearer " + token
			var gotAuthorization string
			authenticator := NewAuthenticator(true, secret, issuer, credentialValidatorFunc(func(_ context.Context, raw string) error {
				gotAuthorization = raw
				return test.validator
			}))
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodGet, "/payments/test", nil)
			ctx.Request.Header.Set("Authorization", authorization)

			_, ok := authenticator.RequireUser(ctx)
			if ok != test.wantOK {
				t.Fatalf("RequireUser() ok = %v, want %v", ok, test.wantOK)
			}
			if recorder.Code != test.wantStatus {
				t.Fatalf("status = %d, want %d", recorder.Code, test.wantStatus)
			}
			if gotAuthorization != authorization {
				t.Fatalf("validator authorization = %q, want %q", gotAuthorization, authorization)
			}
		})
	}
}

func signedCredentialTestToken(t *testing.T, secret, issuer string) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
		"role": "CUSTOMER",
		"iss":  issuer,
	})
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return signed
}
