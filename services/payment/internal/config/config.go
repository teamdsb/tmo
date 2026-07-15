package config

import (
	"path/filepath"
	"time"

	sharedconfig "github.com/teamdsb/tmo/packages/go-shared/config"
)

const (
	defaultHTTPAddr            = ":8083"
	defaultLogLevel            = "info"
	defaultAuthEnabled         = false
	defaultDBDSN               = "postgres://commerce:commerce@localhost:5432/payment?sslmode=disable"
	defaultJWTSecret           = "dev-secret"
	defaultJWTIssuer           = ""
	defaultIdentityBaseURL     = "http://localhost:8081"
	defaultCommerceBaseURL     = "http://localhost:8080"
	defaultFeatureFlagsTimeout = 2 * time.Second
	defaultPaymentEnabled      = false
	defaultWechatPayEnabled    = false
	defaultAlipayPayEnabled    = false
	defaultCommerceSyncToken   = "dev-payment-sync-token"
	defaultProviderMode        = "mock"
	defaultWechatSessionURL    = "https://api.weixin.qq.com/sns/jscode2session"
)

type Config struct {
	HTTPAddr             string
	LogLevel             string
	AuthEnabled          bool
	DBDSN                string
	JWTSecret            string
	JWTIssuer            string
	IdentityBaseURL      string
	CommerceBaseURL      string
	CommerceSyncToken    string
	ProviderMode         string
	MigrationsDir        string
	FeatureFlagsTimeout  time.Duration
	PaymentEnabled       bool
	WechatPayEnabled     bool
	AlipayPayEnabled     bool
	WechatB2BAppID       string
	WechatB2BAppSecret   string
	WechatB2BMchID       string
	WechatB2BAppKey      string
	WechatB2BEnvironment int
	WechatSessionURL     string
}

func Load() Config {
	return Config{
		HTTPAddr:             sharedconfig.String("PAYMENT_HTTP_ADDR", defaultHTTPAddr),
		LogLevel:             sharedconfig.String("PAYMENT_LOG_LEVEL", defaultLogLevel),
		AuthEnabled:          sharedconfig.Bool("PAYMENT_AUTH_ENABLED", defaultAuthEnabled),
		DBDSN:                sharedconfig.String("PAYMENT_DB_DSN", defaultDBDSN),
		JWTSecret:            sharedconfig.String("PAYMENT_JWT_SECRET", defaultJWTSecret),
		JWTIssuer:            sharedconfig.String("PAYMENT_JWT_ISSUER", defaultJWTIssuer),
		IdentityBaseURL:      sharedconfig.String("PAYMENT_IDENTITY_BASE_URL", defaultIdentityBaseURL),
		CommerceBaseURL:      sharedconfig.String("PAYMENT_COMMERCE_BASE_URL", defaultCommerceBaseURL),
		CommerceSyncToken:    sharedconfig.String("PAYMENT_COMMERCE_SYNC_TOKEN", defaultCommerceSyncToken),
		ProviderMode:         sharedconfig.String("PAYMENT_PROVIDER_MODE", defaultProviderMode),
		MigrationsDir:        sharedconfig.String("PAYMENT_MIGRATIONS_DIR", filepath.Join("migrations")),
		FeatureFlagsTimeout:  sharedconfig.Duration("PAYMENT_FEATURE_FLAGS_TIMEOUT", defaultFeatureFlagsTimeout),
		PaymentEnabled:       sharedconfig.Bool("PAYMENT_ENABLED", defaultPaymentEnabled),
		WechatPayEnabled:     sharedconfig.Bool("PAYMENT_WECHAT_PAY_ENABLED", defaultWechatPayEnabled),
		AlipayPayEnabled:     sharedconfig.Bool("PAYMENT_ALIPAY_PAY_ENABLED", defaultAlipayPayEnabled),
		WechatB2BAppID:       sharedconfig.String("PAYMENT_WECHAT_B2B_APP_ID", ""),
		WechatB2BAppSecret:   sharedconfig.String("PAYMENT_WECHAT_B2B_APP_SECRET", ""),
		WechatB2BMchID:       sharedconfig.String("PAYMENT_WECHAT_B2B_MCH_ID", ""),
		WechatB2BAppKey:      sharedconfig.String("PAYMENT_WECHAT_B2B_APP_KEY", ""),
		WechatB2BEnvironment: sharedconfig.Int("PAYMENT_WECHAT_B2B_ENV", 0),
		WechatSessionURL:     sharedconfig.String("PAYMENT_WECHAT_B2B_SESSION_URL", defaultWechatSessionURL),
	}
}
