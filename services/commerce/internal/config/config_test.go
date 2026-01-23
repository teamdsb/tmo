package config

import "testing"

func TestLoadDefaults(test *testing.T) {
	test.Setenv("COMMERCE_HTTP_ADDR", "")
	test.Setenv("COMMERCE_DB_DSN", "")
	test.Setenv("COMMERCE_LOG_LEVEL", "")
	test.Setenv("COMMERCE_AUTH_ENABLED", "")
	test.Setenv("COMMERCE_JWT_SECRET", "")
	test.Setenv("COMMERCE_JWT_ISSUER", "")

	loaded := Load()

	if loaded.HTTPAddr != defaultHTTPAddr {
		test.Fatalf("expected default HTTP addr %q, got %q", defaultHTTPAddr, loaded.HTTPAddr)
	}
	if loaded.DBDSN != defaultDBDSN {
		test.Fatalf("expected default DB DSN %q, got %q", defaultDBDSN, loaded.DBDSN)
	}
	if loaded.LogLevel != defaultLogLevel {
		test.Fatalf("expected default log level %q, got %q", defaultLogLevel, loaded.LogLevel)
	}
	if loaded.AuthEnabled != defaultAuthEnabled {
		test.Fatalf("expected default auth enabled %v, got %v", defaultAuthEnabled, loaded.AuthEnabled)
	}
	if loaded.JWTSecret != defaultJWTSecret {
		test.Fatalf("expected default JWT secret %q, got %q", defaultJWTSecret, loaded.JWTSecret)
	}
	if loaded.JWTIssuer != defaultJWTIssuer {
		test.Fatalf("expected default JWT issuer %q, got %q", defaultJWTIssuer, loaded.JWTIssuer)
	}
}

func TestLoadOverrides(test *testing.T) {
	test.Setenv("COMMERCE_HTTP_ADDR", ":9090")
	test.Setenv("COMMERCE_DB_DSN", "postgres://user:pass@localhost:5432/custom")
	test.Setenv("COMMERCE_LOG_LEVEL", "debug")
	test.Setenv("COMMERCE_AUTH_ENABLED", "true")
	test.Setenv("COMMERCE_JWT_SECRET", "custom-secret")
	test.Setenv("COMMERCE_JWT_ISSUER", "custom-issuer")

	loaded := Load()

	if loaded.HTTPAddr != ":9090" {
		test.Fatalf("expected HTTP addr override, got %q", loaded.HTTPAddr)
	}
	if loaded.DBDSN != "postgres://user:pass@localhost:5432/custom" {
		test.Fatalf("expected DB DSN override, got %q", loaded.DBDSN)
	}
	if loaded.LogLevel != "debug" {
		test.Fatalf("expected log level override, got %q", loaded.LogLevel)
	}
	if !loaded.AuthEnabled {
		test.Fatalf("expected auth enabled override to be true")
	}
	if loaded.JWTSecret != "custom-secret" {
		test.Fatalf("expected JWT secret override, got %q", loaded.JWTSecret)
	}
	if loaded.JWTIssuer != "custom-issuer" {
		test.Fatalf("expected JWT issuer override, got %q", loaded.JWTIssuer)
	}
}
