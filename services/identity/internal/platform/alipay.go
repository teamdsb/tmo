package platform

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"
)

type alipayClient struct {
	appID      string
	privateKey *rsa.PrivateKey
	publicKey  *rsa.PublicKey
	gatewayURL string
	signType   string
	httpClient *http.Client
}

func newAlipayClient(cfg Config, client *http.Client) *alipayClient {
	if cfg.AlipayAppID == "" || cfg.AlipayPrivateKey == "" {
		return nil
	}
	privateKey, err := parseRSAPrivateKey(cfg.AlipayPrivateKey)
	if err != nil {
		return nil
	}
	var publicKey *rsa.PublicKey
	if cfg.AlipayPublicKey != "" {
		publicKey, _ = parseRSAPublicKey(cfg.AlipayPublicKey)
	}
	signType := cfg.AlipaySignType
	if signType == "" {
		signType = "RSA2"
	}
	return &alipayClient{
		appID:      cfg.AlipayAppID,
		privateKey: privateKey,
		publicKey:  publicKey,
		gatewayURL: cfg.AlipayGatewayURL,
		signType:   signType,
		httpClient: client,
	}
}

func (c *alipayClient) Resolve(ctx context.Context, code string) (LoginIdentity, error) {
	params := url.Values{}
	params.Set("grant_type", "authorization_code")
	params.Set("code", code)

	var response alipayOAuthResponse
	if err := c.call(ctx, "alipay.system.oauth.token", params, &response); err != nil {
		return LoginIdentity{}, err
	}
	if response.Response.Code != "10000" {
		return LoginIdentity{}, fmt.Errorf("alipay oauth error %s: %s", response.Response.Code, response.Response.Msg)
	}
	if response.Response.UserID == "" {
		return LoginIdentity{}, errors.New("alipay user_id missing")
	}

	return LoginIdentity{ProviderUserID: response.Response.UserID}, nil
}

func (c *alipayClient) GenerateQRCode(ctx context.Context, scene, page string) (string, error) {
	payload := map[string]string{
		"url_param": page,
	}
	if strings.TrimSpace(scene) != "" {
		payload["query_param"] = "scene=" + scene
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("marshal alipay qrcode payload: %w", err)
	}

	params := url.Values{}
	params.Set("biz_content", string(raw))

	var response alipayQRCodeResponse
	if err := c.call(ctx, "alipay.open.app.qrcode.create", params, &response); err != nil {
		return "", err
	}
	if response.Response.Code != "10000" {
		return "", fmt.Errorf("alipay qrcode error %s: %s", response.Response.Code, response.Response.Msg)
	}
	if response.Response.QRCodeURL == "" {
		return "", errors.New("alipay qr_code_url missing")
	}
	return response.Response.QRCodeURL, nil
}

func (c *alipayClient) call(ctx context.Context, method string, params url.Values, out interface{}) error {
	if c == nil {
		return errors.New("alipay is not configured")
	}

	now := time.Now().Format("2006-01-02 15:04:05")
	params.Set("app_id", c.appID)
	params.Set("method", method)
	params.Set("format", "JSON")
	params.Set("charset", "utf-8")
	params.Set("sign_type", c.signType)
	params.Set("timestamp", now)
	params.Set("version", "1.0")

	signContent := buildSignContent(params)
	signature, err := signRSA(signContent, c.privateKey)
	if err != nil {
		return fmt.Errorf("sign alipay request: %w", err)
	}
	params.Set("sign", signature)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.gatewayURL, strings.NewReader(params.Encode()))
	if err != nil {
		return fmt.Errorf("create alipay request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("alipay request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("alipay status %d", resp.StatusCode)
	}

	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return fmt.Errorf("decode alipay response: %w", err)
	}

	if c.publicKey != nil {
		if err := verifyAlipayResponse(out, c.publicKey); err != nil {
			return err
		}
	}

	return nil
}

func buildSignContent(params url.Values) string {
	keys := make([]string, 0, len(params))
	for key := range params {
		if key == "sign" {
			continue
		}
		keys = append(keys, key)
	}
	sort.Strings(keys)
	var builder strings.Builder
	for i, key := range keys {
		if i > 0 {
			builder.WriteByte('&')
		}
		builder.WriteString(key)
		builder.WriteByte('=')
		builder.WriteString(params.Get(key))
	}
	return builder.String()
}

func signRSA(content string, key *rsa.PrivateKey) (string, error) {
	hash := sha256.Sum256([]byte(content))
	sig, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, hash[:])
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(sig), nil
}

func parseRSAPrivateKey(pemData string) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode([]byte(pemData))
	if block == nil {
		return nil, errors.New("invalid private key")
	}
	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err == nil {
		if rsaKey, ok := key.(*rsa.PrivateKey); ok {
			return rsaKey, nil
		}
	}
	rsaKey, err := x509.ParsePKCS1PrivateKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	return rsaKey, nil
}

func parseRSAPublicKey(pemData string) (*rsa.PublicKey, error) {
	block, _ := pem.Decode([]byte(pemData))
	if block == nil {
		return nil, errors.New("invalid public key")
	}
	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err == nil {
		if rsaKey, ok := pub.(*rsa.PublicKey); ok {
			return rsaKey, nil
		}
	}
	rsaKey, err := x509.ParsePKCS1PublicKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	return rsaKey, nil
}

type alipayOAuthResponse struct {
	Response struct {
		Code      string `json:"code"`
		Msg       string `json:"msg"`
		UserID    string `json:"user_id"`
		SubCode   string `json:"sub_code"`
		SubMsg    string `json:"sub_msg"`
		ExpiresIn string `json:"expires_in"`
	} `json:"alipay_system_oauth_token_response"`
	Sign string `json:"sign"`
}

type alipayQRCodeResponse struct {
	Response struct {
		Code      string `json:"code"`
		Msg       string `json:"msg"`
		SubCode   string `json:"sub_code"`
		SubMsg    string `json:"sub_msg"`
		QRCodeURL string `json:"qr_code_url"`
	} `json:"alipay_open_app_qrcode_create_response"`
	Sign string `json:"sign"`
}

func verifyAlipayResponse(out interface{}, key *rsa.PublicKey) error {
	raw, err := json.Marshal(out)
	if err != nil {
		return nil
	}
	var payload map[string]json.RawMessage
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil
	}
	signRaw, ok := payload["sign"]
	if !ok {
		return nil
	}
	var sign string
	if err := json.Unmarshal(signRaw, &sign); err != nil {
		return nil
	}

	var contentKey string
	for key := range payload {
		if key == "sign" {
			continue
		}
		contentKey = key
		break
	}
	if contentKey == "" {
		return nil
	}

	content := strings.TrimSpace(string(payload[contentKey]))
	decoded, err := base64.StdEncoding.DecodeString(sign)
	if err != nil {
		return fmt.Errorf("decode alipay sign: %w", err)
	}
	hash := sha256.Sum256([]byte(content))
	if err := rsa.VerifyPKCS1v15(key, crypto.SHA256, hash[:], decoded); err != nil {
		return fmt.Errorf("verify alipay sign: %w", err)
	}
	return nil
}
