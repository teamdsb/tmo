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
	"sync"
	"time"

	"github.com/google/uuid"
)

type WechatB2BConfig struct {
	AppID, AppSecret, MchID, AppKey, SessionURL, TokenURL, OrderURL string
	Environment                                                     int
}

const (
	defaultWechatB2BTokenURL = "https://api.weixin.qq.com/cgi-bin/stable_token"
	defaultWechatB2BOrderURL = "https://api.weixin.qq.com/retail/B2b/getorder"
)

type WechatB2BDirectProvider struct {
	config             WechatB2BConfig
	client             *http.Client
	tokenMu            sync.Mutex
	cachedAccessToken  string
	accessTokenExpires time.Time
}

func NewWechatB2BDirectProvider(config WechatB2BConfig) (*WechatB2BDirectProvider, error) {
	if strings.TrimSpace(config.AppID) == "" || strings.TrimSpace(config.AppSecret) == "" || strings.TrimSpace(config.MchID) == "" || strings.TrimSpace(config.AppKey) == "" || strings.TrimSpace(config.SessionURL) == "" {
		return nil, fmt.Errorf("wechat b2b credentials are incomplete")
	}
	if config.Environment != 0 && config.Environment != 1 {
		return nil, fmt.Errorf("wechat b2b environment must be 0 or 1")
	}
	if strings.TrimSpace(config.TokenURL) == "" {
		config.TokenURL = defaultWechatB2BTokenURL
	}
	if strings.TrimSpace(config.OrderURL) == "" {
		config.OrderURL = defaultWechatB2BOrderURL
	}
	return &WechatB2BDirectProvider{config: config, client: &http.Client{Timeout: 10 * time.Second}}, nil
}

func (p *WechatB2BDirectProvider) CreateCommonPayParams(ctx context.Context, request WechatB2BPaymentRequest) (map[string]interface{}, error) {
	if strings.TrimSpace(request.LoginCode) == "" {
		return nil, fmt.Errorf("wechat login code is required")
	}
	sessionKey, err := p.sessionKey(ctx, request.LoginCode)
	if err != nil {
		return nil, err
	}
	signDataBytes, err := json.Marshal(map[string]interface{}{
		"mchid":        p.config.MchID,
		"out_trade_no": strings.ReplaceAll(request.OrderID.String(), "-", ""),
		"description":  "云互惠直采订单",
		"amount": map[string]interface{}{
			"order_amount": request.AmountFen,
			"currency":     "CNY",
		},
		"attach": request.OrderID.String(),
		"env":    p.config.Environment,
	})
	if err != nil {
		return nil, fmt.Errorf("encode wechat b2b sign data: %w", err)
	}
	signData := string(signDataBytes)
	return map[string]interface{}{
		"signData":  signData,
		"mode":      "retail_pay_goods",
		"paySig":    hmacSHA256Hex(p.config.AppKey, "requestCommonPayment&"+signData),
		"signature": hmacSHA256Hex(sessionKey, signData),
	}, nil
}

func (p *WechatB2BDirectProvider) QueryPayment(ctx context.Context, request WechatB2BQueryRequest) (WechatB2BPaymentResolution, error) {
	if request.OrderID == uuid.Nil || request.AmountFen <= 0 {
		return WechatB2BPaymentResolution{}, fmt.Errorf("invalid wechat b2b order query")
	}
	accessToken, err := p.accessToken(ctx)
	if err != nil {
		return WechatB2BPaymentResolution{}, err
	}
	body, err := json.Marshal(struct {
		MchID      string `json:"mchid"`
		OutTradeNo string `json:"out_trade_no"`
	}{MchID: p.config.MchID, OutTradeNo: strings.ReplaceAll(request.OrderID.String(), "-", "")})
	if err != nil {
		return WechatB2BPaymentResolution{}, fmt.Errorf("encode wechat b2b order query: %w", err)
	}
	u, err := url.Parse(p.config.OrderURL)
	if err != nil {
		return WechatB2BPaymentResolution{}, fmt.Errorf("parse wechat b2b order URL: %w", err)
	}
	q := u.Query()
	q.Set("access_token", accessToken)
	q.Set("pay_sig", hmacSHA256Hex(p.config.AppKey, "/retail/B2b/getorder&"+string(body)))
	u.RawQuery = q.Encode()
	httpRequest, err := http.NewRequestWithContext(ctx, http.MethodPost, u.String(), strings.NewReader(string(body)))
	if err != nil {
		return WechatB2BPaymentResolution{}, fmt.Errorf("build wechat b2b order query: %w", err)
	}
	httpRequest.Header.Set("Content-Type", "application/json")
	response, err := p.client.Do(httpRequest)
	if err != nil {
		return WechatB2BPaymentResolution{}, fmt.Errorf("wechat b2b order query failed")
	}
	defer response.Body.Close()
	responseBody, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if err != nil {
		return WechatB2BPaymentResolution{}, fmt.Errorf("read wechat b2b order response: %w", err)
	}
	var payload struct {
		ErrCode            int    `json:"errcode"`
		ErrMsg             string `json:"errmsg"`
		MchID              string `json:"mchid"`
		OutTradeNo         string `json:"out_trade_no"`
		Attach             string `json:"attach"`
		Env                int    `json:"env"`
		PayStatus          string `json:"pay_status"`
		WxpayTransactionID string `json:"wxpay_transaction_id"`
		Amount             struct {
			OrderAmount int64  `json:"order_amount"`
			Currency    string `json:"currency"`
		} `json:"amount"`
	}
	if err := json.Unmarshal(responseBody, &payload); err != nil {
		return WechatB2BPaymentResolution{}, fmt.Errorf("decode wechat b2b order response: %w", err)
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 || payload.ErrCode != 0 {
		return WechatB2BPaymentResolution{}, fmt.Errorf("wechat b2b order query failed: %d %s", payload.ErrCode, payload.ErrMsg)
	}
	resolution := WechatB2BPaymentResolution{Status: paymentStatusPending}
	if payload.PayStatus == "ORDER_PAY_SUCC" {
		if payload.MchID != p.config.MchID || payload.OutTradeNo != strings.ReplaceAll(request.OrderID.String(), "-", "") || payload.Attach != request.OrderID.String() || payload.Env != p.config.Environment || payload.Amount.OrderAmount != request.AmountFen || payload.Amount.Currency != "CNY" {
			return WechatB2BPaymentResolution{}, fmt.Errorf("wechat b2b order response validation failed")
		}
		if strings.TrimSpace(payload.WxpayTransactionID) == "" {
			return WechatB2BPaymentResolution{}, fmt.Errorf("wechat b2b paid order has no transaction ID")
		}
		resolution.Status = paymentStatusPaid
		resolution.ProviderTradeNo = payload.WxpayTransactionID
	}
	return resolution, nil
}

func (p *WechatB2BDirectProvider) accessToken(ctx context.Context) (string, error) {
	p.tokenMu.Lock()
	defer p.tokenMu.Unlock()
	if p.cachedAccessToken != "" && time.Now().Add(time.Minute).Before(p.accessTokenExpires) {
		return p.cachedAccessToken, nil
	}
	body, err := json.Marshal(struct {
		GrantType    string `json:"grant_type"`
		AppID        string `json:"appid"`
		Secret       string `json:"secret"`
		ForceRefresh bool   `json:"force_refresh"`
	}{GrantType: "client_credential", AppID: p.config.AppID, Secret: p.config.AppSecret, ForceRefresh: false})
	if err != nil {
		return "", fmt.Errorf("encode wechat b2b token request: %w", err)
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, p.config.TokenURL, strings.NewReader(string(body)))
	if err != nil {
		return "", fmt.Errorf("build wechat b2b token request: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")
	response, err := p.client.Do(request)
	if err != nil {
		return "", fmt.Errorf("wechat b2b token request failed")
	}
	defer response.Body.Close()
	responseBody, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if err != nil {
		return "", fmt.Errorf("read wechat b2b token response: %w", err)
	}
	var payload struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
		ErrCode     int    `json:"errcode"`
		ErrMsg      string `json:"errmsg"`
	}
	if err := json.Unmarshal(responseBody, &payload); err != nil {
		return "", fmt.Errorf("decode wechat b2b token response: %w", err)
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 || payload.ErrCode != 0 || strings.TrimSpace(payload.AccessToken) == "" {
		return "", fmt.Errorf("wechat b2b token request failed: %d %s", payload.ErrCode, payload.ErrMsg)
	}
	expiresIn := time.Duration(payload.ExpiresIn) * time.Second
	if expiresIn <= time.Minute {
		expiresIn = 5 * time.Minute
	}
	p.cachedAccessToken = payload.AccessToken
	p.accessTokenExpires = time.Now().Add(expiresIn)
	return payload.AccessToken, nil
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
		return "", fmt.Errorf("build wechat code2session request: %w", err)
	}
	resp, err := p.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("wechat code2session request failed")
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return "", fmt.Errorf("read wechat code2session response: %w", err)
	}
	var payload struct {
		SessionKey string `json:"session_key"`
		ErrCode    int    `json:"errcode"`
		ErrMsg     string `json:"errmsg"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return "", fmt.Errorf("decode wechat code2session response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 || payload.ErrCode != 0 || strings.TrimSpace(payload.SessionKey) == "" {
		return "", fmt.Errorf("wechat code2session failed: %d %s", payload.ErrCode, payload.ErrMsg)
	}
	return payload.SessionKey, nil
}

func hmacSHA256Hex(key, message string) string {
	mac := hmac.New(sha256.New, []byte(key))
	_, _ = mac.Write([]byte(message))
	return hex.EncodeToString(mac.Sum(nil))
}
