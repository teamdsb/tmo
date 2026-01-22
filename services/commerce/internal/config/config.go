package config

import sharedconfig "github.com/teamdsb/tmo/packages/go-shared/config"

const (
	defaultHTTPAddr = ":8080"
	// #nosec G101 -- local dev DSN defaults are safe for test environments.
	defaultDBDSN    = "postgres://commerce:commerce@localhost:5432/commerce?sslmode=disable"
	defaultLogLevel = "info"
	defaultAuthEnabled = false
	// #nosec G101 -- local dev JWT defaults are safe for test environments.
	defaultJWTSecret = "dev-secret"
	defaultJWTIssuer = ""
)

type Config struct {
	HTTPAddr    string
	DBDSN       string
	LogLevel    string
	AuthEnabled bool
	JWTSecret   string
	JWTIssuer   string
}

func Load() Config {
	return Config{
		HTTPAddr: sharedconfig.String("COMMERCE_HTTP_ADDR", defaultHTTPAddr),
		DBDSN:    sharedconfig.String("COMMERCE_DB_DSN", defaultDBDSN),
		LogLevel: sharedconfig.String("COMMERCE_LOG_LEVEL", defaultLogLevel),
		AuthEnabled: sharedconfig.Bool("COMMERCE_AUTH_ENABLED", defaultAuthEnabled),
		JWTSecret:   sharedconfig.String("COMMERCE_JWT_SECRET", defaultJWTSecret),
		JWTIssuer:   sharedconfig.String("COMMERCE_JWT_ISSUER", defaultJWTIssuer),
	}
}
