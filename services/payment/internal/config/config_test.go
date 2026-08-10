package config

import "testing"

func TestLoadEnablesAuthenticationByDefault(t *testing.T) {
	t.Setenv("PAYMENT_AUTH_ENABLED", "")

	if cfg := Load(); !cfg.AuthEnabled {
		t.Fatal("expected payment authentication to be enabled by default")
	}
}

func TestLoadDisablesProviderByDefault(t *testing.T) {
	t.Setenv("PAYMENT_PROVIDER_MODE", "")

	if cfg := Load(); cfg.ProviderMode != "disabled" {
		t.Fatalf("expected payment provider to be disabled by default, got %q", cfg.ProviderMode)
	}
}

func TestValidateRejectsMissingJWTSecretWhenAuthenticationEnabled(t *testing.T) {
	t.Setenv("PAYMENT_AUTH_ENABLED", "")
	t.Setenv("PAYMENT_JWT_SECRET", "")

	cfg := Load()
	if cfg.JWTSecret != "" {
		t.Fatalf("expected no built-in JWT secret, got %q", cfg.JWTSecret)
	}
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected authentication without PAYMENT_JWT_SECRET to fail validation")
	}
}

func TestValidateAllowsExplicitJWTSecret(t *testing.T) {
	cfg := Config{AuthEnabled: true, JWTSecret: "test-secret"}
	if err := cfg.Validate(); err != nil {
		t.Fatalf("expected explicit JWT secret to pass validation, got %v", err)
	}
}
