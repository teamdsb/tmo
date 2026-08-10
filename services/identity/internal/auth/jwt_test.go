package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

func TestPlatformIdentityRoundTripsThroughToken(t *testing.T) {
	manager := NewTokenManager("secret", "issuer", time.Hour)
	token, _, err := manager.Issue(
		uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"), "CUSTOMER", []string{"CUSTOMER"},
		"customer", nil, nil, nil, WithPlatformIdentity("weapp", "openid-1"),
	)
	if err != nil {
		t.Fatal(err)
	}
	claims, err := manager.Parse(token)
	if err != nil {
		t.Fatal(err)
	}
	if claims.IdentityProvider != "weapp" || claims.ProviderUserID != "openid-1" {
		t.Fatalf("unexpected identity claims: %#v", claims)
	}
}

func TestCredentialVersionRoundTripsThroughToken(t *testing.T) {
	manager := NewTokenManager("secret", "issuer", time.Hour)
	token, _, err := manager.Issue(
		uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"), "CUSTOMER", []string{"CUSTOMER"},
		"customer", nil, nil, nil, WithCredentialVersion(3),
	)
	if err != nil {
		t.Fatal(err)
	}

	claims, err := manager.Parse(token)
	if err != nil {
		t.Fatal(err)
	}
	if claims.CredentialVersion != 3 {
		t.Fatalf("expected credential version 3, got %d", claims.CredentialVersion)
	}
}

func TestLegacyTokenWithoutCredentialVersionParsesAsZero(t *testing.T) {
	manager := NewTokenManager("secret", "issuer", time.Hour)
	token, _, err := manager.Issue(
		uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"), "CUSTOMER", []string{"CUSTOMER"},
		"customer", nil, nil, nil,
	)
	if err != nil {
		t.Fatal(err)
	}

	claims, err := manager.Parse(token)
	if err != nil {
		t.Fatal(err)
	}
	if claims.CredentialVersion != 0 {
		t.Fatalf("expected missing credential version to parse as zero, got %d", claims.CredentialVersion)
	}
}

func TestParseRejectsInvalidCredentialVersion(t *testing.T) {
	manager := NewTokenManager("secret", "issuer", time.Hour)
	for name, credentialVersion := range map[string]any{
		"negative":   float64(-1),
		"fractional": 1.5,
	} {
		t.Run(name, func(t *testing.T) {
			token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
				"sub":               "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
				"iss":               "issuer",
				"exp":               time.Now().Add(time.Hour).Unix(),
				"credentialVersion": credentialVersion,
			})
			raw, err := token.SignedString([]byte("secret"))
			if err != nil {
				t.Fatal(err)
			}

			if _, err := manager.Parse(raw); err == nil {
				t.Fatalf("expected credentialVersion=%v to be rejected", credentialVersion)
			}
		})
	}
}
