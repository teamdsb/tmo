package platform

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

var ErrUnsupportedPlatform = errors.New("unsupported platform")

type MiniLoginResolver struct {
	WeappAppID     string
	WeappAppSecret string
	HTTPClient     *http.Client
}

func NewMiniLoginResolver(weappAppID, weappAppSecret string) *MiniLoginResolver {
	return &MiniLoginResolver{
		WeappAppID:     weappAppID,
		WeappAppSecret: weappAppSecret,
		HTTPClient: &http.Client{
			Timeout: 5 * time.Second,
		},
	}
}

func (r *MiniLoginResolver) Resolve(ctx context.Context, platform, code string) (string, error) {
	if strings.TrimSpace(code) == "" {
		return "", errors.New("code is required")
	}

	switch strings.ToLower(platform) {
	case "weapp":
		if strings.HasPrefix(code, "mock_") || r.WeappAppID == "" || r.WeappAppSecret == "" {
			return code, nil
		}
		return r.resolveWeapp(ctx, code)
	case "alipay":
		return code, nil
	default:
		return "", ErrUnsupportedPlatform
	}
}

func (r *MiniLoginResolver) resolveWeapp(ctx context.Context, code string) (string, error) {
	client := r.HTTPClient
	if client == nil {
		client = http.DefaultClient
	}

	endpoint, err := url.Parse("https://api.weixin.qq.com/sns/jscode2session")
	if err != nil {
		return "", fmt.Errorf("resolve weapp endpoint: %w", err)
	}
	query := endpoint.Query()
	query.Set("appid", r.WeappAppID)
	query.Set("secret", r.WeappAppSecret)
	query.Set("js_code", code)
	query.Set("grant_type", "authorization_code")
	endpoint.RawQuery = query.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return "", fmt.Errorf("create weapp request: %w", err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("weapp request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("weapp response status %d", resp.StatusCode)
	}

	var payload weappSessionResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return "", fmt.Errorf("decode weapp response: %w", err)
	}
	if payload.ErrCode != 0 {
		return "", fmt.Errorf("weapp error %d: %s", payload.ErrCode, payload.ErrMsg)
	}
	if payload.OpenID == "" {
		return "", errors.New("weapp openid missing")
	}

	return payload.OpenID, nil
}

type weappSessionResponse struct {
	OpenID  string `json:"openid"`
	UnionID string `json:"unionid"`
	ErrCode int    `json:"errcode"`
	ErrMsg  string `json:"errmsg"`
}
