package config

import "os"

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
	HTTPAddr string
	DBDSN    string
	LogLevel string
	AuthEnabled bool
	JWTSecret   string
	JWTIssuer   string
}

func Load() Config {
<<<<<<< Updated upstream
	cfg := Config{
		HTTPAddr: defaultHTTPAddr,
		DBDSN:    defaultDBDSN,
		LogLevel: defaultLogLevel,
=======
	return Config{
		HTTPAddr: sharedconfig.String("COMMERCE_HTTP_ADDR", defaultHTTPAddr),
		DBDSN:    sharedconfig.String("COMMERCE_DB_DSN", defaultDBDSN),
		LogLevel: sharedconfig.String("COMMERCE_LOG_LEVEL", defaultLogLevel),
		AuthEnabled: sharedconfig.Bool("COMMERCE_AUTH_ENABLED", defaultAuthEnabled),
		JWTSecret:   sharedconfig.String("COMMERCE_JWT_SECRET", defaultJWTSecret),
		JWTIssuer:   sharedconfig.String("COMMERCE_JWT_ISSUER", defaultJWTIssuer),
>>>>>>> Stashed changes
	}

	if value := os.Getenv("COMMERCE_HTTP_ADDR"); value != "" {
		cfg.HTTPAddr = value
	}
	if value := os.Getenv("COMMERCE_DB_DSN"); value != "" {
		cfg.DBDSN = value
	}
	if value := os.Getenv("COMMERCE_LOG_LEVEL"); value != "" {
		cfg.LogLevel = value
	}

	return cfg
}
