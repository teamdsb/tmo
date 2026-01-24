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
	defaultJWTSecret        = "dev-secret"
	defaultJWTIssuer        = "tmo-identity"
	defaultAccessTokenTTL   = 168 * time.Hour
	defaultLoginMode        = "mock"
	defaultWeappAppID       = ""
	defaultWeappSecret      = ""
	defaultWeappTokenURL    = "https://api.weixin.qq.com/cgi-bin/token"
	defaultWeappSessionURL  = "https://api.weixin.qq.com/sns/jscode2session"
	defaultWeappQRCodeURL   = "https://api.weixin.qq.com/wxa/getwxacodeunlimit"
	defaultWeappSalesPage   = "pages/index/index"
	defaultWeappQRWidth     = 256
	defaultAlipayGatewayURL = "https://openapi.alipay.com/gateway.do"
	defaultAlipaySignType   = "RSA2"
	defaultAlipaySalesPage  = "pages/index/index"
)

type Config struct {
	HTTPAddr         string
	DBDSN            string
	LogLevel         string
	JWTSecret        string
	JWTIssuer        string
	AccessTokenTTL   time.Duration
	LoginMode        string
	WeappAppID       string
	WeappAppSecret   string
	WeappTokenURL    string
	WeappSessionURL  string
	WeappQRCodeURL   string
	WeappSalesPage   string
	WeappQRWidth     int
	AlipayAppID      string
	AlipayPrivateKey string
	AlipayPublicKey  string
	AlipayGatewayURL string
	AlipaySignType   string
	AlipaySalesPage  string
}

func Load() Config {
	return Config{
		HTTPAddr:         sharedconfig.String("IDENTITY_HTTP_ADDR", defaultHTTPAddr),
		DBDSN:            sharedconfig.String("IDENTITY_DB_DSN", defaultDBDSN),
		LogLevel:         sharedconfig.String("IDENTITY_LOG_LEVEL", defaultLogLevel),
		JWTSecret:        sharedconfig.String("IDENTITY_JWT_SECRET", defaultJWTSecret),
		JWTIssuer:        sharedconfig.String("IDENTITY_JWT_ISSUER", defaultJWTIssuer),
		AccessTokenTTL:   sharedconfig.Duration("IDENTITY_ACCESS_TOKEN_TTL", defaultAccessTokenTTL),
		LoginMode:        sharedconfig.String("IDENTITY_LOGIN_MODE", defaultLoginMode),
		WeappAppID:       sharedconfig.String("IDENTITY_WEAPP_APPID", defaultWeappAppID),
		WeappAppSecret:   sharedconfig.String("IDENTITY_WEAPP_APPSECRET", defaultWeappSecret),
		WeappTokenURL:    sharedconfig.String("IDENTITY_WEAPP_TOKEN_URL", defaultWeappTokenURL),
		WeappSessionURL:  sharedconfig.String("IDENTITY_WEAPP_SESSION_URL", defaultWeappSessionURL),
		WeappQRCodeURL:   sharedconfig.String("IDENTITY_WEAPP_QRCODE_URL", defaultWeappQRCodeURL),
		WeappSalesPage:   sharedconfig.String("IDENTITY_WEAPP_SALES_QR_PAGE", defaultWeappSalesPage),
		WeappQRWidth:     sharedconfig.Int("IDENTITY_WEAPP_QR_WIDTH", defaultWeappQRWidth),
		AlipayAppID:      sharedconfig.String("IDENTITY_ALIPAY_APP_ID", ""),
		AlipayPrivateKey: sharedconfig.String("IDENTITY_ALIPAY_PRIVATE_KEY", ""),
		AlipayPublicKey:  sharedconfig.String("IDENTITY_ALIPAY_PUBLIC_KEY", ""),
		AlipayGatewayURL: sharedconfig.String("IDENTITY_ALIPAY_GATEWAY_URL", defaultAlipayGatewayURL),
		AlipaySignType:   sharedconfig.String("IDENTITY_ALIPAY_SIGN_TYPE", defaultAlipaySignType),
		AlipaySalesPage:  sharedconfig.String("IDENTITY_ALIPAY_SALES_QR_PAGE", defaultAlipaySalesPage),
	}
}
