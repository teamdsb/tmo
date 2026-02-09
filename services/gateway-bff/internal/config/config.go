package config

import (
	"sort"
	"strings"
	"time"

	sharedconfig "github.com/teamdsb/tmo/packages/go-shared/config"
)

const (
	defaultHTTPAddr                    = ":8080"
	defaultPublicBaseURL               = "http://localhost:8080"
	defaultIdentityBaseURL             = "http://localhost:8081"
	defaultCommerceBaseURL             = "http://localhost:8082"
	defaultPaymentBaseURL              = "http://localhost:8083"
	defaultAIBaseURL                   = ""
	defaultLogLevel                    = "info"
	defaultUpstreamTimeout             = 10 * time.Second
	defaultMaxBodyBytes                = 32 * 1024 * 1024
	defaultImageProxyAllowlist         = "images.unsplash.com"
	defaultImageProxyTimeout           = 10 * time.Second
	defaultImageProxyMaxBytes          = 8 * 1024 * 1024
	defaultImageProxyCacheMaxAgeSecond = 3600
)

type Config struct {
	HTTPAddr                     string
	PublicBaseURL                string
	IdentityBaseURL              string
	CommerceBaseURL              string
	PaymentBaseURL               string
	AIBaseURL                    string
	LogLevel                     string
	UpstreamTimeout              time.Duration
	MaxBodyBytes                 int
	ImageProxyAllowlist          []string
	ImageProxyTimeout            time.Duration
	ImageProxyMaxBytes           int
	ImageProxyCacheMaxAgeSeconds int
}

func Load() Config {
	allowlist := parseHostAllowlist(sharedconfig.String("GATEWAY_IMAGE_PROXY_ALLOWLIST", defaultImageProxyAllowlist))
	if len(allowlist) == 0 {
		allowlist = parseHostAllowlist(defaultImageProxyAllowlist)
	}

	imageProxyTimeout := sharedconfig.Duration("GATEWAY_IMAGE_PROXY_TIMEOUT", defaultImageProxyTimeout)
	if imageProxyTimeout <= 0 {
		imageProxyTimeout = defaultImageProxyTimeout
	}

	imageProxyMaxBytes := sharedconfig.Int("GATEWAY_IMAGE_PROXY_MAX_BYTES", defaultImageProxyMaxBytes)
	if imageProxyMaxBytes <= 0 {
		imageProxyMaxBytes = defaultImageProxyMaxBytes
	}

	imageProxyCacheMaxAgeSeconds := sharedconfig.Int("GATEWAY_IMAGE_PROXY_CACHE_MAX_AGE_SECONDS", defaultImageProxyCacheMaxAgeSecond)
	if imageProxyCacheMaxAgeSeconds <= 0 {
		imageProxyCacheMaxAgeSeconds = defaultImageProxyCacheMaxAgeSecond
	}

	return Config{
		HTTPAddr:                     sharedconfig.String("GATEWAY_HTTP_ADDR", defaultHTTPAddr),
		PublicBaseURL:                sharedconfig.String("GATEWAY_PUBLIC_BASE_URL", defaultPublicBaseURL),
		IdentityBaseURL:              sharedconfig.String("GATEWAY_IDENTITY_BASE_URL", defaultIdentityBaseURL),
		CommerceBaseURL:              sharedconfig.String("GATEWAY_COMMERCE_BASE_URL", defaultCommerceBaseURL),
		PaymentBaseURL:               sharedconfig.String("GATEWAY_PAYMENT_BASE_URL", defaultPaymentBaseURL),
		AIBaseURL:                    sharedconfig.String("GATEWAY_AI_BASE_URL", defaultAIBaseURL),
		LogLevel:                     sharedconfig.String("GATEWAY_LOG_LEVEL", defaultLogLevel),
		UpstreamTimeout:              sharedconfig.Duration("GATEWAY_UPSTREAM_TIMEOUT", defaultUpstreamTimeout),
		MaxBodyBytes:                 sharedconfig.Int("GATEWAY_MAX_BODY_BYTES", defaultMaxBodyBytes),
		ImageProxyAllowlist:          allowlist,
		ImageProxyTimeout:            imageProxyTimeout,
		ImageProxyMaxBytes:           imageProxyMaxBytes,
		ImageProxyCacheMaxAgeSeconds: imageProxyCacheMaxAgeSeconds,
	}
}

func parseHostAllowlist(raw string) []string {
	items := strings.Split(raw, ",")
	seen := make(map[string]struct{}, len(items))
	hosts := make([]string, 0, len(items))
	for _, item := range items {
		host := strings.ToLower(strings.TrimSpace(item))
		if host == "" {
			continue
		}
		if _, exists := seen[host]; exists {
			continue
		}
		seen[host] = struct{}{}
		hosts = append(hosts, host)
	}
	sort.Strings(hosts)
	return hosts
}
