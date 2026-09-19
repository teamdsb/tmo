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

func TestValidateWechatB2BModeRequiresAuthenticationAndCredentials(t *testing.T) {
	valid := Config{
		AuthEnabled: true, JWTSecret: "test-secret", ProviderMode: "b2b",
		WechatB2BAppID: "app", WechatB2BAppSecret: "secret", WechatB2BMchID: "mch", WechatB2BAppKey: "key",
		WechatB2BEnvironment: 0, WechatB2BSessionURL: "https://api.weixin.qq.com/sns/jscode2session",
	}
	if err := valid.Validate(); err != nil {
		t.Fatalf("expected complete B2B config to pass, got %v", err)
	}

	withoutAuth := valid
	withoutAuth.AuthEnabled = false
	if err := withoutAuth.Validate(); err == nil {
		t.Fatal("expected B2B mode without authentication to fail")
	}

	tests := []struct {
		name   string
		mutate func(*Config)
	}{
		{name: "appid", mutate: func(c *Config) { c.WechatB2BAppID = "" }},
		{name: "appsecret", mutate: func(c *Config) { c.WechatB2BAppSecret = "" }},
		{name: "mchid", mutate: func(c *Config) { c.WechatB2BMchID = "" }},
		{name: "appkey", mutate: func(c *Config) { c.WechatB2BAppKey = "" }},
		{name: "session url", mutate: func(c *Config) { c.WechatB2BSessionURL = "" }},
		{name: "environment", mutate: func(c *Config) { c.WechatB2BEnvironment = 2 }},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			cfg := valid
			test.mutate(&cfg)
			if err := cfg.Validate(); err == nil {
				t.Fatalf("expected missing/invalid %s to fail", test.name)
			}
		})
	}
}

func TestValidateDisabledModeDoesNotRequireWechatCredentials(t *testing.T) {
	cfg := Config{AuthEnabled: true, JWTSecret: "test-secret", ProviderMode: "disabled"}
	if err := cfg.Validate(); err != nil {
		t.Fatalf("disabled mode must not require provider credentials: %v", err)
	}
}
