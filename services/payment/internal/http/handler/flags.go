package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

type FeatureFlags struct {
	PaymentEnabled   bool `json:"paymentEnabled"`
	WechatPayEnabled bool `json:"wechatPayEnabled"`
	AlipayPayEnabled bool `json:"alipayPayEnabled"`
}

type FeatureFlagsProvider interface {
	GetFlags(ctx context.Context) (FeatureFlags, error)
}

type StaticFlagsProvider struct {
	Flags FeatureFlags
}

func (p StaticFlagsProvider) GetFlags(ctx context.Context) (FeatureFlags, error) {
	return p.Flags, nil
}

type IdentityFlagsProvider struct {
	BaseURL  string
	Client   *http.Client
	Fallback FeatureFlags
	Logger   *slog.Logger
}

func NewIdentityFlagsProvider(baseURL string, timeout time.Duration, fallback FeatureFlags, logger *slog.Logger) FeatureFlagsProvider {
	if timeout <= 0 {
		timeout = 2 * time.Second
	}
	client := &http.Client{
		Timeout: timeout,
	}
	return &IdentityFlagsProvider{
		BaseURL:  strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		Client:   client,
		Fallback: fallback,
		Logger:   logger,
	}
}

func (p *IdentityFlagsProvider) GetFlags(ctx context.Context) (FeatureFlags, error) {
	if strings.TrimSpace(p.BaseURL) == "" {
		return p.Fallback, nil
	}
	client := p.Client
	if client == nil {
		client = http.DefaultClient
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, p.BaseURL+"/admin/config/feature-flags", nil)
	if err != nil {
		return p.Fallback, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return p.Fallback, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return p.Fallback, fmt.Errorf("feature flags status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return p.Fallback, err
	}
	var flags FeatureFlags
	if err := json.Unmarshal(body, &flags); err != nil {
		return p.Fallback, err
	}
	return flags, nil
}
