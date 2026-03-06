package config

import (
	"time"

	sharedconfig "github.com/teamdsb/tmo/packages/go-shared/config"
)

const (
	defaultHTTPAddr                 = ":8084"
	defaultLogLevel                 = "info"
	defaultAuthEnabled              = false
	defaultJWTSecret                = "dev-secret"
	defaultJWTIssuer                = ""
	defaultCommerceBaseURL          = "http://localhost:8082"
	defaultRequestTimeout           = 10 * time.Second
	defaultProvider                 = "mock"
	defaultProviderBaseURL          = ""
	defaultProviderAPIKey           = ""
	defaultProviderModel            = ""
	defaultKnowledgeRefreshInterval = 5 * time.Minute
)

type Config struct {
	HTTPAddr                 string
	LogLevel                 string
	AuthEnabled              bool
	JWTSecret                string
	JWTIssuer                string
	CommerceBaseURL          string
	RequestTimeout           time.Duration
	Provider                 string
	ProviderBaseURL          string
	ProviderAPIKey           string
	ProviderModel            string
	KnowledgeRefreshInterval time.Duration
}

func Load() Config {
	refreshInterval := sharedconfig.Duration("AI_KNOWLEDGE_REFRESH_INTERVAL", defaultKnowledgeRefreshInterval)
	if refreshInterval <= 0 {
		refreshInterval = defaultKnowledgeRefreshInterval
	}

	requestTimeout := sharedconfig.Duration("AI_REQUEST_TIMEOUT", defaultRequestTimeout)
	if requestTimeout <= 0 {
		requestTimeout = defaultRequestTimeout
	}

	return Config{
		HTTPAddr:                 sharedconfig.String("AI_HTTP_ADDR", defaultHTTPAddr),
		LogLevel:                 sharedconfig.String("AI_LOG_LEVEL", defaultLogLevel),
		AuthEnabled:              sharedconfig.Bool("AI_AUTH_ENABLED", defaultAuthEnabled),
		JWTSecret:                sharedconfig.String("AI_JWT_SECRET", defaultJWTSecret),
		JWTIssuer:                sharedconfig.String("AI_JWT_ISSUER", defaultJWTIssuer),
		CommerceBaseURL:          sharedconfig.String("AI_COMMERCE_BASE_URL", defaultCommerceBaseURL),
		RequestTimeout:           requestTimeout,
		Provider:                 sharedconfig.String("AI_PROVIDER", defaultProvider),
		ProviderBaseURL:          sharedconfig.String("AI_PROVIDER_BASE_URL", defaultProviderBaseURL),
		ProviderAPIKey:           sharedconfig.String("AI_PROVIDER_API_KEY", defaultProviderAPIKey),
		ProviderModel:            sharedconfig.String("AI_PROVIDER_MODEL", defaultProviderModel),
		KnowledgeRefreshInterval: refreshInterval,
	}
}
