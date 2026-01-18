package config

import sharedconfig "github.com/teamdsb/tmo/packages/go-shared/config"

const (
	defaultHTTPAddr = ":8080"
	// #nosec G101 -- local dev DSN defaults are safe for test environments.
	defaultDBDSN    = "postgres://commerce:commerce@localhost:5432/commerce?sslmode=disable"
	defaultLogLevel = "info"
)

type Config struct {
	HTTPAddr string
	DBDSN    string
	LogLevel string
}

func Load() Config {
	return Config{
		HTTPAddr: sharedconfig.String("COMMERCE_HTTP_ADDR", defaultHTTPAddr),
		DBDSN:    sharedconfig.String("COMMERCE_DB_DSN", defaultDBDSN),
		LogLevel: sharedconfig.String("COMMERCE_LOG_LEVEL", defaultLogLevel),
	}
}
