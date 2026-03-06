package config

import (
	"testing"
	"time"
)

func TestLoadReturnsDefaults(t *testing.T) {
	t.Setenv("AI_HTTP_ADDR", "")
	t.Setenv("AI_LOG_LEVEL", "")
	t.Setenv("AI_AUTH_ENABLED", "")
	t.Setenv("AI_JWT_SECRET", "")
	t.Setenv("AI_JWT_ISSUER", "")
	t.Setenv("AI_COMMERCE_BASE_URL", "")
	t.Setenv("AI_REQUEST_TIMEOUT", "")
	t.Setenv("AI_PROVIDER", "")
	t.Setenv("AI_PROVIDER_BASE_URL", "")
	t.Setenv("AI_PROVIDER_API_KEY", "")
	t.Setenv("AI_PROVIDER_MODEL", "")
	t.Setenv("AI_KNOWLEDGE_REFRESH_INTERVAL", "")

	cfg := Load()
	if cfg.HTTPAddr != defaultHTTPAddr || cfg.Provider != defaultProvider || cfg.CommerceBaseURL != defaultCommerceBaseURL {
		t.Fatalf("unexpected defaults %#v", cfg)
	}
	if cfg.RequestTimeout != defaultRequestTimeout || cfg.KnowledgeRefreshInterval != defaultKnowledgeRefreshInterval {
		t.Fatalf("unexpected duration defaults %#v", cfg)
	}
}

func TestLoadRespectsEnvAndFallsBackOnInvalidDurations(t *testing.T) {
	t.Setenv("AI_HTTP_ADDR", ":18084")
	t.Setenv("AI_LOG_LEVEL", "debug")
	t.Setenv("AI_AUTH_ENABLED", "true")
	t.Setenv("AI_JWT_SECRET", "secret-1")
	t.Setenv("AI_JWT_ISSUER", "issuer-1")
	t.Setenv("AI_COMMERCE_BASE_URL", "http://commerce.internal")
	t.Setenv("AI_REQUEST_TIMEOUT", "-1s")
	t.Setenv("AI_PROVIDER", "mock")
	t.Setenv("AI_PROVIDER_BASE_URL", "http://provider.internal")
	t.Setenv("AI_PROVIDER_API_KEY", "key-1")
	t.Setenv("AI_PROVIDER_MODEL", "model-1")
	t.Setenv("AI_KNOWLEDGE_REFRESH_INTERVAL", "0s")

	cfg := Load()
	if cfg.HTTPAddr != ":18084" || !cfg.AuthEnabled || cfg.JWTSecret != "secret-1" || cfg.JWTIssuer != "issuer-1" {
		t.Fatalf("unexpected env config %#v", cfg)
	}
	if cfg.ProviderBaseURL != "http://provider.internal" || cfg.ProviderAPIKey != "key-1" || cfg.ProviderModel != "model-1" {
		t.Fatalf("unexpected provider config %#v", cfg)
	}
	if cfg.RequestTimeout != 10*time.Second {
		t.Fatalf("expected invalid timeout to fallback to default, got %v", cfg.RequestTimeout)
	}
	if cfg.KnowledgeRefreshInterval != 5*time.Minute {
		t.Fatalf("expected invalid refresh interval to fallback to default, got %v", cfg.KnowledgeRefreshInterval)
	}
}
