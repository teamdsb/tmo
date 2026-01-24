package config

import (
	"time"

	sharedconfig "github.com/teamdsb/tmo/packages/go-shared/config"
)

const (
	defaultHTTPAddr = ":8081"
	// #nosec G101 -- local dev DSN defaults are safe for test environments.
	defaultDBDSN    = "postgres://commerce:commerce@localhost:5432/identity?sslmode=disable"
	defaultLogLevel = "info"
	// #nosec G101 -- local dev JWT defaults are safe for test environments.
	defaultJWTSecret      = "dev-secret"
	defaultJWTIssuer      = "tmo-identity"
	defaultAccessTokenTTL = 168 * time.Hour
	defaultWeappAppID     = ""
	defaultWeappSecret    = ""
)

type Config struct {
	HTTPAddr       string
	DBDSN          string
	LogLevel       string
	JWTSecret      string
	JWTIssuer      string
	AccessTokenTTL time.Duration
	WeappAppID     string
	WeappAppSecret string
}

func Load() Config {
	return Config{
		HTTPAddr:       sharedconfig.String("IDENTITY_HTTP_ADDR", defaultHTTPAddr),
		DBDSN:          sharedconfig.String("IDENTITY_DB_DSN", defaultDBDSN),
		LogLevel:       sharedconfig.String("IDENTITY_LOG_LEVEL", defaultLogLevel),
		JWTSecret:      sharedconfig.String("IDENTITY_JWT_SECRET", defaultJWTSecret),
		JWTIssuer:      sharedconfig.String("IDENTITY_JWT_ISSUER", defaultJWTIssuer),
		AccessTokenTTL: sharedconfig.Duration("IDENTITY_ACCESS_TOKEN_TTL", defaultAccessTokenTTL),
		WeappAppID:     sharedconfig.String("IDENTITY_WEAPP_APPID", defaultWeappAppID),
		WeappAppSecret: sharedconfig.String("IDENTITY_WEAPP_APPSECRET", defaultWeappSecret),
	}
}
