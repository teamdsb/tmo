package handler

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

// WechatB2BConfig contains server-only B2B credentials. Store these values in
// deployment secrets, never in miniapp code or a committed env file.
type WechatB2BConfig struct {
	AppID, AppSecret, MchID, AppKey, SessionURL string
	Environment                                 int
}

type WechatB2BDirectProvider struct {
	config WechatB2BConfig
	client *http.Client
}

func NewWechatB2BDirectProvider(config WechatB2BConfig) (*WechatB2BDirectProvider, error) {
	if strings.TrimSpace(config.AppID) == "" || strings.TrimSpace(config.AppSecret) == "" || strings.TrimSpace(config.MchID) == "" || strings.TrimSpace(config.AppKey) == "" {
		return nil, fmt.Errorf("wechat b2b credentials are incomplete")
	}
	if config.Environment != 0 && config.Environment != 1 {
		return nil, fmt.Errorf("wechat b2b environment must be 0 or 1")
	}
	return &WechatB2BDirectProvider{config: config, client: http.DefaultClient}, nil
}

func (p *WechatB2BDirectProvider) CreateCommonPayParams(ctx context.Context, request WechatB2BPaymentRequest) (map[string]interface{}, error) {
	if strings.TrimSpace(request.LoginCode) == "" {
		return nil, fmt.Errorf("wechat login code is required")
	}
	sessionKey, err := p.sessionKey(ctx, request.LoginCode)
	if err != nil {
		return nil, err
	}
	outTradeNo := strings.ReplaceAll(request.OrderID.String(), "-", "")
	signDataBytes, err := json.Marshal(map[string]interface{}{
		"mchid": p.config.MchID, "out_trade_no": outTradeNo, "description": "云互惠直采订单",
		"amount": map[string]interface{}{"order_amount": request.AmountFen, "currency": "CNY"}, "attach": request.OrderID.String(), "env": p.config.Environment,
	})
	if err != nil {
		return nil, err
	}
	signData := string(signDataBytes)
	return map[string]interface{}{"signData": signData, "mode": "retail_pay_goods", "paySig": hmacSHA256Hex(p.config.AppKey, "requestCommonPayment&"+signData), "signature": hmacSHA256Hex(sessionKey, signData)}, nil
}

func (p *WechatB2BDirectProvider) sessionKey(ctx context.Context, code string) (string, error) {
	u, err := url.Parse(p.config.SessionURL)
	if err != nil {
		return "", fmt.Errorf("parse wechat session URL: %w", err)
	}
	q := u.Query()
	q.Set("appid", p.config.AppID)
	q.Set("secret", p.config.AppSecret)
	q.Set("js_code", code)
	q.Set("grant_type", "authorization_code")
	u.RawQuery = q.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return "", err
	}
	resp, err := p.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("call wechat code2session: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return "", err
	}
	var payload struct {
		SessionKey string `json:"session_key"`
		ErrCode    int    `json:"errcode"`
		ErrMsg     string `json:"errmsg"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 || payload.ErrCode != 0 || payload.SessionKey == "" {
		return "", fmt.Errorf("wechat code2session failed: %d %s", payload.ErrCode, payload.ErrMsg)
	}
	return payload.SessionKey, nil
}

func hmacSHA256Hex(key, message string) string {
	mac := hmac.New(sha256.New, []byte(key))
	_, _ = mac.Write([]byte(message))
	return hex.EncodeToString(mac.Sum(nil))
}
