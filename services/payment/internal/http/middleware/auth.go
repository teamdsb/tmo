package middleware

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/teamdsb/tmo/packages/go-shared/authn"
	apierrors "github.com/teamdsb/tmo/packages/go-shared/errors"
)

type Claims struct {
	UserID           uuid.UUID
	Role             string
	IdentityProvider string
	ProviderUserID   string
}

type Authenticator struct {
	enabled   bool
	secret    []byte
	issuer    string
	validator authn.CredentialValidator
}

func NewAuthenticator(enabled bool, secret, issuer string, validators ...authn.CredentialValidator) *Authenticator {
	authenticator := &Authenticator{
		enabled: enabled,
		secret:  []byte(secret),
		issuer:  issuer,
	}
	if len(validators) > 0 {
		authenticator.validator = validators[0]
	}
	return authenticator
}

func (a *Authenticator) RequireUser(c *gin.Context) (Claims, bool) {
	claims, ok := a.parseClaims(c)
	if !ok {
		return Claims{}, false
	}
	return claims, true
}

func (a *Authenticator) parseClaims(c *gin.Context) (Claims, bool) {
	if !a.enabled {
		return Claims{UserID: uuid.Nil, Role: "ADMIN"}, true
	}
	raw := strings.TrimSpace(c.GetHeader("Authorization"))
	if raw == "" {
		writeError(c, http.StatusUnauthorized, "unauthorized", "missing authorization")
		return Claims{}, false
	}
	parts := strings.SplitN(raw, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		writeError(c, http.StatusUnauthorized, "unauthorized", "invalid authorization header")
		return Claims{}, false
	}

	token, err := jwt.Parse(parts[1], func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unsupported signing method")
		}
		return a.secret, nil
	})
	if err != nil || !token.Valid {
		writeError(c, http.StatusUnauthorized, "unauthorized", "invalid token")
		return Claims{}, false
	}
	mapClaims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		writeError(c, http.StatusUnauthorized, "unauthorized", "invalid token claims")
		return Claims{}, false
	}
	if a.issuer != "" {
		issuer, ok := mapClaims["iss"].(string)
		if !ok || issuer != a.issuer {
			writeError(c, http.StatusUnauthorized, "unauthorized", "invalid token issuer")
			return Claims{}, false
		}
	}
	sub, ok := mapClaims["sub"].(string)
	if !ok || sub == "" {
		writeError(c, http.StatusUnauthorized, "unauthorized", "missing subject")
		return Claims{}, false
	}
	userID, err := uuid.Parse(sub)
	if err != nil {
		writeError(c, http.StatusUnauthorized, "unauthorized", "invalid subject")
		return Claims{}, false
	}
	role, _ := mapClaims["role"].(string)
	identityProvider, _ := mapClaims["identityProvider"].(string)
	providerUserID, _ := mapClaims["providerUserId"].(string)
	if a.validator != nil {
		if err := a.validator.Validate(c.Request.Context(), raw); err != nil {
			if errors.Is(err, authn.ErrInvalidCredential) {
				writeError(c, http.StatusUnauthorized, "unauthorized", "invalid token")
			} else {
				writeError(c, http.StatusServiceUnavailable, "authentication_unavailable", "identity validation unavailable")
			}
			return Claims{}, false
		}
	}
	return Claims{UserID: userID, Role: role, IdentityProvider: identityProvider, ProviderUserID: providerUserID}, true
}

func writeError(c *gin.Context, status int, code, message string) {
	apierrors.Write(c, status, apierrors.APIError{
		Code:    code,
		Message: message,
	})
}
