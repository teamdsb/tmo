package platform

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

type weappClient struct {
	appID       string
	appSecret   string
	sessionURL  string
	tokenURL    string
	qrCodeURL   string
	httpClient  *http.Client
	tokenMutex  sync.Mutex
	accessToken string
	expiresAt   time.Time
}

func newWeappClient(cfg Config, client *http.Client) *weappClient {
	if cfg.WeappAppID == "" || cfg.WeappAppSecret == "" {
		return nil
	}
	return &weappClient{
		appID:      cfg.WeappAppID,
		appSecret:  cfg.WeappAppSecret,
		sessionURL: cfg.WeappSessionURL,
		tokenURL:   cfg.WeappTokenURL,
		qrCodeURL:  cfg.WeappQRCodeURL,
		httpClient: client,
	}
}

func (c *weappClient) Resolve(ctx context.Context, code string) (LoginIdentity, error) {
	endpoint, err := url.Parse(c.sessionURL)
	if err != nil {
		return LoginIdentity{}, fmt.Errorf("resolve weapp endpoint: %w", err)
	}
	query := endpoint.Query()
	query.Set("appid", c.appID)
	query.Set("secret", c.appSecret)
	query.Set("js_code", code)
	query.Set("grant_type", "authorization_code")
	endpoint.RawQuery = query.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return LoginIdentity{}, fmt.Errorf("create weapp request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return LoginIdentity{}, fmt.Errorf("weapp request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return LoginIdentity{}, fmt.Errorf("weapp response status %d", resp.StatusCode)
	}

	var payload weappSessionResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return LoginIdentity{}, fmt.Errorf("decode weapp response: %w", err)
	}
	if payload.ErrCode != 0 {
		return LoginIdentity{}, fmt.Errorf("weapp error %d: %s", payload.ErrCode, payload.ErrMsg)
	}
	if payload.OpenID == "" {
		return LoginIdentity{}, errors.New("weapp openid missing")
	}

	return LoginIdentity{
		ProviderUserID: payload.OpenID,
		UnionID:        payload.UnionID,
	}, nil
}

func (c *weappClient) GenerateQRCode(ctx context.Context, scene, page string, width int) ([]byte, error) {
	token, err := c.getAccessToken(ctx)
	if err != nil {
		return nil, err
	}

	endpoint, err := url.Parse(c.qrCodeURL)
	if err != nil {
		return nil, fmt.Errorf("resolve weapp qrcode endpoint: %w", err)
	}
	query := endpoint.Query()
	query.Set("access_token", token)
	endpoint.RawQuery = query.Encode()

	payload := map[string]interface{}{
		"scene": scene,
	}
	if strings.TrimSpace(page) != "" {
		payload["page"] = page
	}
	if width > 0 {
		payload["width"] = width
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal weapp qrcode request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint.String(), bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create weapp qrcode request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("weapp qrcode request failed: %w", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read weapp qrcode response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("weapp qrcode status %d", resp.StatusCode)
	}

	if len(data) > 0 && data[0] == '{' {
		var errResp weappErrorResponse
		if err := json.Unmarshal(data, &errResp); err == nil && errResp.ErrCode != 0 {
			return nil, fmt.Errorf("weapp qrcode error %d: %s", errResp.ErrCode, errResp.ErrMsg)
		}
	}

	return data, nil
}

func (c *weappClient) getAccessToken(ctx context.Context) (string, error) {
	c.tokenMutex.Lock()
	defer c.tokenMutex.Unlock()

	if c.accessToken != "" && time.Now().Before(c.expiresAt) {
		return c.accessToken, nil
	}

	endpoint, err := url.Parse(c.tokenURL)
	if err != nil {
		return "", fmt.Errorf("resolve weapp token endpoint: %w", err)
	}
	query := endpoint.Query()
	query.Set("grant_type", "client_credential")
	query.Set("appid", c.appID)
	query.Set("secret", c.appSecret)
	endpoint.RawQuery = query.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return "", fmt.Errorf("create weapp token request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("weapp token request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("weapp token status %d", resp.StatusCode)
	}

	var payload weappTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return "", fmt.Errorf("decode weapp token response: %w", err)
	}
	if payload.ErrCode != 0 {
		return "", fmt.Errorf("weapp token error %d: %s", payload.ErrCode, payload.ErrMsg)
	}
	if payload.AccessToken == "" {
		return "", errors.New("weapp access token missing")
	}

	ttl := time.Duration(payload.ExpiresIn) * time.Second
	c.accessToken = payload.AccessToken
	c.expiresAt = time.Now().Add(ttl - time.Minute)
	return c.accessToken, nil
}

type weappSessionResponse struct {
	OpenID  string `json:"openid"`
	UnionID string `json:"unionid"`
	ErrCode int    `json:"errcode"`
	ErrMsg  string `json:"errmsg"`
}

type weappTokenResponse struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	ErrCode     int    `json:"errcode"`
	ErrMsg      string `json:"errmsg"`
}

type weappErrorResponse struct {
	ErrCode int    `json:"errcode"`
	ErrMsg  string `json:"errmsg"`
}
