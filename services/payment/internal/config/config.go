package config

import (
	"errors"
	"path/filepath"
	"strings"
	"time"

	sharedconfig "github.com/teamdsb/tmo/packages/go-shared/config"
)

const (
	defaultHTTPAddr            = ":8083"
	defaultLogLevel            = "info"
	defaultAuthEnabled         = true
	defaultDBDSN               = "postgres://commerce:commerce@localhost:5432/payment?sslmode=disable"
	defaultJWTSecret           = ""
	defaultJWTIssuer           = ""
	defaultIdentityBaseURL     = "http://localhost:8081"
	defaultCommerceBaseURL     = "http://localhost:8080"
	defaultFeatureFlagsTimeout = 2 * time.Second
	defaultPaymentEnabled      = false
	defaultWechatPayEnabled    = false
	defaultAlipayPayEnabled    = false
	defaultCommerceSyncToken   = "dev-payment-sync-token"
	defaultProviderMode        = "disabled"
	defaultWechatB2BSessionURL = "https://api.weixin.qq.com/sns/jscode2session"
)

type Config struct {
	HTTPAddr                     string
	LogLevel                     string
	AuthEnabled                  bool
	DBDSN                        string
	JWTSecret                    string
	JWTIssuer                    string
	IdentityBaseURL              string
	CommerceBaseURL              string
	CommerceSyncToken            string
	ProviderMode                 string
	MigrationsDir                string
	FeatureFlagsTimeout          time.Duration
	PaymentEnabled               bool
	WechatPayEnabled             bool
	AlipayPayEnabled             bool
	WechatAppID                  string
	WechatMchID                  string
	WechatAPIv3Key               string
	WechatMerchantPrivateKeyPath string
	WechatMerchantSerialNumber   string
	WechatNotifyURL              string
	WechatB2BAppID               string
	WechatB2BAppSecret           string
	WechatB2BMchID               string
	WechatB2BAppKey              string
	WechatB2BEnvironment         int
	WechatB2BSessionURL          string
}

func Load() Config {
	return Config{
		HTTPAddr:                     sharedconfig.String("PAYMENT_HTTP_ADDR", defaultHTTPAddr),
		LogLevel:                     sharedconfig.String("PAYMENT_LOG_LEVEL", defaultLogLevel),
		AuthEnabled:                  sharedconfig.Bool("PAYMENT_AUTH_ENABLED", defaultAuthEnabled),
		DBDSN:                        sharedconfig.String("PAYMENT_DB_DSN", defaultDBDSN),
		JWTSecret:                    sharedconfig.String("PAYMENT_JWT_SECRET", defaultJWTSecret),
		JWTIssuer:                    sharedconfig.String("PAYMENT_JWT_ISSUER", defaultJWTIssuer),
		IdentityBaseURL:              sharedconfig.String("PAYMENT_IDENTITY_BASE_URL", defaultIdentityBaseURL),
		CommerceBaseURL:              sharedconfig.String("PAYMENT_COMMERCE_BASE_URL", defaultCommerceBaseURL),
		CommerceSyncToken:            sharedconfig.String("PAYMENT_COMMERCE_SYNC_TOKEN", defaultCommerceSyncToken),
		ProviderMode:                 sharedconfig.String("PAYMENT_PROVIDER_MODE", defaultProviderMode),
		MigrationsDir:                sharedconfig.String("PAYMENT_MIGRATIONS_DIR", filepath.Join("migrations")),
		FeatureFlagsTimeout:          sharedconfig.Duration("PAYMENT_FEATURE_FLAGS_TIMEOUT", defaultFeatureFlagsTimeout),
		PaymentEnabled:               sharedconfig.Bool("PAYMENT_ENABLED", defaultPaymentEnabled),
		WechatPayEnabled:             sharedconfig.Bool("PAYMENT_WECHAT_PAY_ENABLED", defaultWechatPayEnabled),
		AlipayPayEnabled:             sharedconfig.Bool("PAYMENT_ALIPAY_PAY_ENABLED", defaultAlipayPayEnabled),
		WechatAppID:                  sharedconfig.String("PAYMENT_WECHAT_APP_ID", ""),
		WechatMchID:                  sharedconfig.String("PAYMENT_WECHAT_MCH_ID", ""),
		WechatAPIv3Key:               sharedconfig.String("PAYMENT_WECHAT_API_V3_KEY", ""),
		WechatMerchantPrivateKeyPath: sharedconfig.String("PAYMENT_WECHAT_MERCHANT_PRIVATE_KEY_PATH", ""),
		WechatMerchantSerialNumber:   sharedconfig.String("PAYMENT_WECHAT_MERCHANT_SERIAL_NUMBER", ""),
		WechatNotifyURL:              sharedconfig.String("PAYMENT_WECHAT_NOTIFY_URL", ""),
		WechatB2BAppID:               sharedconfig.String("PAYMENT_WECHAT_B2B_APP_ID", ""),
		WechatB2BAppSecret:           sharedconfig.String("PAYMENT_WECHAT_B2B_APP_SECRET", ""),
		WechatB2BMchID:               sharedconfig.String("PAYMENT_WECHAT_B2B_MCH_ID", ""),
		WechatB2BAppKey:              sharedconfig.String("PAYMENT_WECHAT_B2B_APP_KEY", ""),
		WechatB2BEnvironment:         sharedconfig.Int("PAYMENT_WECHAT_B2B_ENV", 0),
		WechatB2BSessionURL:          sharedconfig.String("PAYMENT_WECHAT_B2B_SESSION_URL", defaultWechatB2BSessionURL),
	}
}

func (c Config) Validate() error {
	if c.AuthEnabled && strings.TrimSpace(c.JWTSecret) == "" {
		return errors.New("PAYMENT_JWT_SECRET is required when PAYMENT_AUTH_ENABLED is true")
	}
	if strings.EqualFold(strings.TrimSpace(c.ProviderMode), "b2b") {
		if !c.AuthEnabled {
			return errors.New("PAYMENT_AUTH_ENABLED must be true for the b2b provider")
		}
		values := map[string]string{
			"PAYMENT_WECHAT_B2B_APP_ID":      c.WechatB2BAppID,
			"PAYMENT_WECHAT_B2B_APP_SECRET":  c.WechatB2BAppSecret,
			"PAYMENT_WECHAT_B2B_MCH_ID":      c.WechatB2BMchID,
			"PAYMENT_WECHAT_B2B_APP_KEY":     c.WechatB2BAppKey,
			"PAYMENT_WECHAT_B2B_SESSION_URL": c.WechatB2BSessionURL,
		}
		for name, value := range values {
			if strings.TrimSpace(value) == "" {
				return errors.New(name + " is required for the b2b provider")
			}
		}
		if c.WechatB2BEnvironment != 0 && c.WechatB2BEnvironment != 1 {
			return errors.New("PAYMENT_WECHAT_B2B_ENV must be 0 or 1")
		}
	}
	return nil
}
