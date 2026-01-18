package config

import "os"

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
	cfg := Config{
		HTTPAddr: defaultHTTPAddr,
		DBDSN:    defaultDBDSN,
		LogLevel: defaultLogLevel,
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
