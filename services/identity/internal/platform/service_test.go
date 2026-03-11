package platform

import (
	"context"
	"testing"
)

func TestResolveAllowsMockCodeFallbackInRealModeWithoutPlatformConfig(t *testing.T) {
	resolver := NewMiniLoginResolver(Config{
		Mode: LoginModeReal,
	})

	identity, err := resolver.Resolve(context.Background(), "weapp", "mock_customer_001")
	if err != nil {
		t.Fatalf("expected mock code fallback in real mode, got error: %v", err)
	}
	if identity.ProviderUserID != "mock_customer_001" {
		t.Fatalf("expected provider user id mock_customer_001, got %q", identity.ProviderUserID)
	}
}

func TestResolveRejectsArbitraryCodeInRealModeWithoutPlatformConfig(t *testing.T) {
	resolver := NewMiniLoginResolver(Config{
		Mode: LoginModeReal,
	})

	if _, err := resolver.Resolve(context.Background(), "weapp", "real_code_123"); err == nil {
		t.Fatalf("expected non-mock code to fail without platform config")
	}
}

func TestResolvePrefersLocalMockCodeEvenWhenWeappConfigExists(t *testing.T) {
	resolver := NewMiniLoginResolver(Config{
		Mode:            LoginModeReal,
		WeappAppID:      "wx-test-app",
		WeappAppSecret:  "test-secret",
		WeappSessionURL: "https://example.com/jscode2session",
	})

	identity, err := resolver.Resolve(context.Background(), "weapp", "mock_debug_001")
	if err != nil {
		t.Fatalf("expected configured resolver to keep local mock fallback, got error: %v", err)
	}
	if identity.ProviderUserID != "mock_debug_001" {
		t.Fatalf("expected provider user id mock_debug_001, got %q", identity.ProviderUserID)
	}
}
