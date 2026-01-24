package auth

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var (
	ErrInvalidToken   = errors.New("invalid token")
	ErrMissingSubject = errors.New("missing subject")
	ErrInvalidIssuer  = errors.New("invalid issuer")
)

type Claims struct {
	UserID           uuid.UUID
	Role             string
	Roles            []string
	UserType         string
	OwnerSalesUserID *uuid.UUID
	ExpiresAt        time.Time
}

type TokenManager struct {
	secret []byte
	issuer string
	ttl    time.Duration
}

func NewTokenManager(secret, issuer string, ttl time.Duration) *TokenManager {
	return &TokenManager{
		secret: []byte(secret),
		issuer: issuer,
		ttl:    ttl,
	}
}

func (m *TokenManager) Issue(userID uuid.UUID, role string, roles []string, userType string, ownerSalesUserID *uuid.UUID) (string, time.Time, error) {
	now := time.Now()
	expiresAt := now.Add(m.ttl)

	claims := jwt.MapClaims{
		"sub":  userID.String(),
		"role": role,
		"exp":  expiresAt.Unix(),
		"iat":  now.Unix(),
	}
	if m.issuer != "" {
		claims["iss"] = m.issuer
	}
	if len(roles) > 0 {
		claims["roles"] = roles
	}
	if userType != "" {
		claims["userType"] = userType
	}
	if ownerSalesUserID != nil && *ownerSalesUserID != uuid.Nil {
		claims["ownerSalesUserId"] = ownerSalesUserID.String()
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(m.secret)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("sign token: %w", err)
	}
	return signed, expiresAt, nil
}

func (m *TokenManager) ParseAuthorization(raw string) (Claims, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return Claims{}, ErrInvalidToken
	}
	parts := strings.SplitN(raw, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return Claims{}, ErrInvalidToken
	}
	return m.Parse(parts[1])
}

func (m *TokenManager) Parse(raw string) (Claims, error) {
	token, err := jwt.Parse(raw, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return m.secret, nil
	})
	if err != nil || !token.Valid {
		return Claims{}, ErrInvalidToken
	}

	mapClaims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return Claims{}, ErrInvalidToken
	}

	if m.issuer != "" {
		issuer, ok := mapClaims["iss"].(string)
		if !ok || issuer != m.issuer {
			return Claims{}, ErrInvalidIssuer
		}
	}

	sub, ok := mapClaims["sub"].(string)
	if !ok || sub == "" {
		return Claims{}, ErrMissingSubject
	}
	userID, err := uuid.Parse(sub)
	if err != nil {
		return Claims{}, ErrMissingSubject
	}

	role, _ := mapClaims["role"].(string)
	claims := Claims{
		UserID: userID,
		Role:   role,
	}

	if rawRoles, ok := mapClaims["roles"]; ok {
		switch typed := rawRoles.(type) {
		case []interface{}:
			roles := make([]string, 0, len(typed))
			for _, value := range typed {
				if roleValue, ok := value.(string); ok {
					roles = append(roles, roleValue)
				}
			}
			claims.Roles = roles
		case []string:
			claims.Roles = typed
		}
	}

	if userType, ok := mapClaims["userType"].(string); ok {
		claims.UserType = userType
	}

	if ownerRaw, ok := mapClaims["ownerSalesUserId"].(string); ok && ownerRaw != "" {
		ownerID, err := uuid.Parse(ownerRaw)
		if err != nil {
			return Claims{}, ErrInvalidToken
		}
		claims.OwnerSalesUserID = &ownerID
	}

	if expRaw, ok := mapClaims["exp"].(float64); ok {
		claims.ExpiresAt = time.Unix(int64(expRaw), 0)
	}

	return claims, nil
}
