package config

import (
	"time"

	sharedconfig "github.com/teamdsb/tmo/packages/go-shared/config"
)

const (
	defaultHTTPAddr            = ":8083"
	defaultLogLevel            = "info"
	defaultAuthEnabled         = false
	defaultJWTSecret           = "dev-secret"
	defaultJWTIssuer           = ""
	defaultIdentityBaseURL     = "http://localhost:8081"
	defaultFeatureFlagsTimeout = 2 * time.Second
	defaultPaymentEnabled      = false
	defaultWechatPayEnabled    = false
	defaultAlipayPayEnabled    = false
)

type Config struct {
	HTTPAddr            string
	LogLevel            string
	AuthEnabled         bool
	JWTSecret           string
	JWTIssuer           string
	IdentityBaseURL     string
	FeatureFlagsTimeout time.Duration
	PaymentEnabled      bool
	WechatPayEnabled    bool
	AlipayPayEnabled    bool
}

func Load() Config {
	return Config{
		HTTPAddr:            sharedconfig.String("PAYMENT_HTTP_ADDR", defaultHTTPAddr),
		LogLevel:            sharedconfig.String("PAYMENT_LOG_LEVEL", defaultLogLevel),
		AuthEnabled:         sharedconfig.Bool("PAYMENT_AUTH_ENABLED", defaultAuthEnabled),
		JWTSecret:           sharedconfig.String("PAYMENT_JWT_SECRET", defaultJWTSecret),
		JWTIssuer:           sharedconfig.String("PAYMENT_JWT_ISSUER", defaultJWTIssuer),
		IdentityBaseURL:     sharedconfig.String("PAYMENT_IDENTITY_BASE_URL", defaultIdentityBaseURL),
		FeatureFlagsTimeout: sharedconfig.Duration("PAYMENT_FEATURE_FLAGS_TIMEOUT", defaultFeatureFlagsTimeout),
		PaymentEnabled:      sharedconfig.Bool("PAYMENT_ENABLED", defaultPaymentEnabled),
		WechatPayEnabled:    sharedconfig.Bool("PAYMENT_WECHAT_PAY_ENABLED", defaultWechatPayEnabled),
		AlipayPayEnabled:    sharedconfig.Bool("PAYMENT_ALIPAY_PAY_ENABLED", defaultAlipayPayEnabled),
	}
}
