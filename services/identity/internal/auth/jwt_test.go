package auth

import (
	"testing"
	"time"

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
