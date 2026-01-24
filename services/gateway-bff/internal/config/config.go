package config

import sharedconfig "github.com/teamdsb/tmo/packages/go-shared/config"

const (
	defaultHTTPAddr        = ":8080"
	defaultIdentityBaseURL = "http://localhost:8081"
	defaultCommerceBaseURL = "http://localhost:8082"
	defaultLogLevel        = "info"
)

type Config struct {
	HTTPAddr        string
	IdentityBaseURL string
	CommerceBaseURL string
	LogLevel        string
}

func Load() Config {
	return Config{
		HTTPAddr:        sharedconfig.String("GATEWAY_HTTP_ADDR", defaultHTTPAddr),
		IdentityBaseURL: sharedconfig.String("GATEWAY_IDENTITY_BASE_URL", defaultIdentityBaseURL),
		CommerceBaseURL: sharedconfig.String("GATEWAY_COMMERCE_BASE_URL", defaultCommerceBaseURL),
		LogLevel:        sharedconfig.String("GATEWAY_LOG_LEVEL", defaultLogLevel),
	}
}
