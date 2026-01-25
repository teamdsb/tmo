package config

import (
	"time"

	sharedconfig "github.com/teamdsb/tmo/packages/go-shared/config"
)

const (
	defaultHTTPAddr        = ":8080"
	defaultIdentityBaseURL = "http://localhost:8081"
	defaultCommerceBaseURL = "http://localhost:8082"
	defaultPaymentBaseURL  = "http://localhost:8083"
	defaultAIBaseURL       = ""
	defaultLogLevel        = "info"
	defaultUpstreamTimeout = 10 * time.Second
	defaultMaxBodyBytes    = 32 * 1024 * 1024
)

type Config struct {
	HTTPAddr        string
	IdentityBaseURL string
	CommerceBaseURL string
	PaymentBaseURL  string
	AIBaseURL       string
	LogLevel        string
	UpstreamTimeout time.Duration
	MaxBodyBytes    int
}

func Load() Config {
	return Config{
		HTTPAddr:        sharedconfig.String("GATEWAY_HTTP_ADDR", defaultHTTPAddr),
		IdentityBaseURL: sharedconfig.String("GATEWAY_IDENTITY_BASE_URL", defaultIdentityBaseURL),
		CommerceBaseURL: sharedconfig.String("GATEWAY_COMMERCE_BASE_URL", defaultCommerceBaseURL),
		PaymentBaseURL:  sharedconfig.String("GATEWAY_PAYMENT_BASE_URL", defaultPaymentBaseURL),
		AIBaseURL:       sharedconfig.String("GATEWAY_AI_BASE_URL", defaultAIBaseURL),
		LogLevel:        sharedconfig.String("GATEWAY_LOG_LEVEL", defaultLogLevel),
		UpstreamTimeout: sharedconfig.Duration("GATEWAY_UPSTREAM_TIMEOUT", defaultUpstreamTimeout),
		MaxBodyBytes:    sharedconfig.Int("GATEWAY_MAX_BODY_BYTES", defaultMaxBodyBytes),
	}
}
