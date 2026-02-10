package platform

import (
	"context"
	"crypto"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
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
	appID                 string
	privateKey            *rsa.PrivateKey
	publicKey             *rsa.PublicKey
	aesKey                []byte
	aesKeyErr             error
	gatewayURL            string
	signType              string
	phoneFallbackAuthUser bool
	httpClient            *http.Client
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

	var aesKey []byte
	var aesKeyErr error
	if strings.TrimSpace(cfg.AlipayAESKey) != "" {
		aesKey, aesKeyErr = parseAESKey(cfg.AlipayAESKey)
	}

	return &alipayClient{
		appID:                 cfg.AlipayAppID,
		privateKey:            privateKey,
		publicKey:             publicKey,
		aesKey:                aesKey,
		aesKeyErr:             aesKeyErr,
		gatewayURL:            cfg.AlipayGatewayURL,
		signType:              signType,
		phoneFallbackAuthUser: cfg.AlipayPhoneFallbackAuthUser,
		httpClient:            client,
	}
}

func (c *alipayClient) Resolve(ctx context.Context, code string) (LoginIdentity, error) {
	token, err := c.exchangeAuthCode(ctx, code)
	if err != nil {
		return LoginIdentity{}, err
	}
	return LoginIdentity{ProviderUserID: token.UserID}, nil
}

func (c *alipayClient) ResolvePhone(ctx context.Context, proof PhoneProof) (string, error) {
	var resolveErrors []error

	if strings.TrimSpace(proof.Response) != "" {
		phone, err := c.resolvePhoneFromEncryptedProof(proof)
		if err == nil {
			return phone, nil
		}
		resolveErrors = append(resolveErrors, err)
	}

	if c.phoneFallbackAuthUser && strings.TrimSpace(proof.Code) != "" {
		phone, err := c.resolvePhoneByAuthUser(ctx, proof.Code)
		if err == nil {
			return phone, nil
		}
		resolveErrors = append(resolveErrors, err)
	}

	if len(resolveErrors) > 0 {
		return "", errors.Join(resolveErrors...)
	}
	return "", errors.New("alipay phone proof is required")
}

func (c *alipayClient) resolvePhoneByAuthUser(ctx context.Context, code string) (string, error) {
	token, err := c.exchangeAuthCode(ctx, code)
	if err != nil {
		return "", err
	}

	params := url.Values{}
	params.Set("auth_token", token.AccessToken)

	var response alipayUserInfoResponse
	if err := c.call(ctx, "alipay.user.info.share", params, &response); err != nil {
		return "", err
	}
	if response.Response.Code != "10000" {
		return "", fmt.Errorf("alipay user info error %s: %s", response.Response.Code, response.Response.Msg)
	}

	phone := strings.TrimSpace(response.Response.Mobile)
	if phone == "" {
		return "", errors.New("alipay phone missing")
	}
	return phone, nil
}

func (c *alipayClient) resolvePhoneFromEncryptedProof(proof PhoneProof) (string, error) {
	envelope, err := normalizeAlipayPhoneEnvelope(proof)
	if err != nil {
		return "", err
	}

	if envelope.SignType != "" && !strings.EqualFold(envelope.SignType, "RSA2") {
		return "", fmt.Errorf("unsupported alipay sign type: %s", envelope.SignType)
	}
	if envelope.EncryptType != "" && !strings.EqualFold(envelope.EncryptType, "AES") {
		return "", fmt.Errorf("unsupported alipay encrypt type: %s", envelope.EncryptType)
	}

	if c.publicKey == nil {
		return "", errors.New("alipay public key is required to verify phone payload")
	}
	if envelope.Sign == "" {
		return "", errors.New("alipay phone signature is required")
	}
	if err := verifyAlipaySignature(envelope.Response, envelope.Sign, c.publicKey); err != nil {
		return "", fmt.Errorf("verify alipay phone payload signature: %w", err)
	}

	if phone := extractPhoneFromPayloadString(envelope.Response); phone != "" {
		return phone, nil
	}

	plaintext, err := c.decryptPhonePayload(envelope.Response)
	if err != nil {
		return "", err
	}
	phone := extractPhoneFromPayloadString(string(plaintext))
	if phone == "" {
		return "", errors.New("alipay phone missing")
	}
	return phone, nil
}

func (c *alipayClient) exchangeAuthCode(ctx context.Context, code string) (alipayOAuthTokenResult, error) {
	trimmedCode := strings.TrimSpace(code)
	if trimmedCode == "" {
		return alipayOAuthTokenResult{}, errors.New("alipay auth code is required")
	}

	params := url.Values{}
	params.Set("grant_type", "authorization_code")
	params.Set("code", trimmedCode)

	var response alipayOAuthResponse
	if err := c.call(ctx, "alipay.system.oauth.token", params, &response); err != nil {
		return alipayOAuthTokenResult{}, err
	}
	if response.Response.Code != "10000" {
		return alipayOAuthTokenResult{}, fmt.Errorf("alipay oauth error %s: %s", response.Response.Code, response.Response.Msg)
	}
	if response.Response.UserID == "" {
		return alipayOAuthTokenResult{}, errors.New("alipay user_id missing")
	}
	if response.Response.AccessToken == "" {
		return alipayOAuthTokenResult{}, errors.New("alipay access token missing")
	}

	return alipayOAuthTokenResult{
		UserID:      response.Response.UserID,
		AccessToken: response.Response.AccessToken,
	}, nil
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

func parseAESKey(raw string) ([]byte, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, errors.New("alipay aes key is empty")
	}
	if isValidAESKeyLength(len(trimmed)) {
		return []byte(trimmed), nil
	}

	decoded, err := decodeBase64String(trimmed)
	if err == nil && isValidAESKeyLength(len(decoded)) {
		return decoded, nil
	}

	hexDecoded, err := hex.DecodeString(trimmed)
	if err == nil && isValidAESKeyLength(len(hexDecoded)) {
		return hexDecoded, nil
	}

	return nil, errors.New("alipay aes key length must be 16, 24, or 32 bytes")
}

func isValidAESKeyLength(length int) bool {
	return length == 16 || length == 24 || length == 32
}

type alipayPhoneEnvelope struct {
	Response    string
	Sign        string
	SignType    string
	EncryptType string
	Charset     string
}

func normalizeAlipayPhoneEnvelope(proof PhoneProof) (alipayPhoneEnvelope, error) {
	envelope := alipayPhoneEnvelope{
		Response:    strings.TrimSpace(proof.Response),
		Sign:        strings.TrimSpace(proof.Sign),
		SignType:    strings.TrimSpace(proof.SignType),
		EncryptType: strings.TrimSpace(proof.EncryptType),
		Charset:     strings.TrimSpace(proof.Charset),
	}
	if envelope.Response == "" {
		return alipayPhoneEnvelope{}, errors.New("alipay phone response is required")
	}

	var payload map[string]interface{}
	if err := json.Unmarshal([]byte(envelope.Response), &payload); err == nil {
		if nested := readStringFromMap(payload, "response"); nested != "" {
			envelope.Response = nested
			if envelope.Sign == "" {
				envelope.Sign = readStringFromMap(payload, "sign")
			}
			if envelope.SignType == "" {
				envelope.SignType = readStringFromMap(payload, "signType", "sign_type")
			}
			if envelope.EncryptType == "" {
				envelope.EncryptType = readStringFromMap(payload, "encryptType", "encrypt_type")
			}
			if envelope.Charset == "" {
				envelope.Charset = readStringFromMap(payload, "charset")
			}
		}
	}

	return envelope, nil
}

func (c *alipayClient) decryptPhonePayload(encrypted string) ([]byte, error) {
	if c.aesKeyErr != nil {
		return nil, fmt.Errorf("invalid alipay aes key: %w", c.aesKeyErr)
	}
	if len(c.aesKey) == 0 {
		return nil, errors.New("alipay aes key is required to decrypt phone payload")
	}

	iv, ciphertext, err := splitEncryptedPayload(encrypted)
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(c.aesKey)
	if err != nil {
		return nil, fmt.Errorf("create aes cipher: %w", err)
	}
	if len(iv) != block.BlockSize() {
		return nil, errors.New("invalid alipay payload iv length")
	}
	if len(ciphertext) == 0 || len(ciphertext)%block.BlockSize() != 0 {
		return nil, errors.New("invalid alipay payload ciphertext length")
	}

	plaintext := make([]byte, len(ciphertext))
	copy(plaintext, ciphertext)
	cipher.NewCBCDecrypter(block, iv).CryptBlocks(plaintext, plaintext)

	unpadded, err := pkcs5Unpad(plaintext, block.BlockSize())
	if err != nil {
		return nil, err
	}
	return unpadded, nil
}

func splitEncryptedPayload(raw string) ([]byte, []byte, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, nil, errors.New("alipay encrypted payload is empty")
	}

	if strings.Contains(trimmed, ":") {
		parts := strings.SplitN(trimmed, ":", 2)
		iv, err := decodeBase64String(strings.TrimSpace(parts[0]))
		if err != nil {
			return nil, nil, fmt.Errorf("decode alipay payload iv: %w", err)
		}
		ciphertext, err := decodeBase64String(strings.TrimSpace(parts[1]))
		if err != nil {
			return nil, nil, fmt.Errorf("decode alipay payload ciphertext: %w", err)
		}
		return iv, ciphertext, nil
	}

	if strings.HasPrefix(trimmed, "{") {
		var payload map[string]interface{}
		if err := json.Unmarshal([]byte(trimmed), &payload); err != nil {
			return nil, nil, fmt.Errorf("decode alipay encrypted json: %w", err)
		}
		ivRaw := readStringFromMap(payload, "iv")
		dataRaw := readStringFromMap(payload, "encryptedData", "encrypted_data", "data")
		if ivRaw != "" && dataRaw != "" {
			iv, err := decodeBase64String(ivRaw)
			if err != nil {
				return nil, nil, fmt.Errorf("decode alipay json iv: %w", err)
			}
			ciphertext, err := decodeBase64String(dataRaw)
			if err != nil {
				return nil, nil, fmt.Errorf("decode alipay json ciphertext: %w", err)
			}
			return iv, ciphertext, nil
		}
	}

	ciphertext, err := decodeBase64String(trimmed)
	if err != nil {
		return nil, nil, fmt.Errorf("decode alipay encrypted payload: %w", err)
	}
	if len(ciphertext) <= aes.BlockSize {
		return nil, nil, errors.New("alipay payload is too short")
	}
	iv := make([]byte, aes.BlockSize)
	copy(iv, ciphertext[:aes.BlockSize])
	data := make([]byte, len(ciphertext)-aes.BlockSize)
	copy(data, ciphertext[aes.BlockSize:])
	return iv, data, nil
}

func decodeBase64String(raw string) ([]byte, error) {
	encodings := []*base64.Encoding{
		base64.StdEncoding,
		base64.RawStdEncoding,
		base64.URLEncoding,
		base64.RawURLEncoding,
	}
	var decodeErr error
	for _, encoding := range encodings {
		decoded, err := encoding.DecodeString(raw)
		if err == nil {
			return decoded, nil
		}
		decodeErr = err
	}
	return nil, decodeErr
}

func pkcs5Unpad(raw []byte, blockSize int) ([]byte, error) {
	if len(raw) == 0 || len(raw)%blockSize != 0 {
		return nil, errors.New("invalid alipay payload padding size")
	}
	padding := int(raw[len(raw)-1])
	if padding == 0 || padding > blockSize || padding > len(raw) {
		return nil, errors.New("invalid alipay payload padding")
	}
	for _, value := range raw[len(raw)-padding:] {
		if int(value) != padding {
			return nil, errors.New("invalid alipay payload padding")
		}
	}
	return raw[:len(raw)-padding], nil
}

func extractPhoneFromPayloadString(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}

	var payload interface{}
	if err := json.Unmarshal([]byte(trimmed), &payload); err != nil {
		return ""
	}
	return extractPhoneFromPayload(payload)
}

func extractPhoneFromPayload(payload interface{}) string {
	switch value := payload.(type) {
	case map[string]interface{}:
		for _, key := range []string{"mobile", "phoneNumber", "phone_number", "purePhoneNumber", "pure_phone_number"} {
			if phone := strings.TrimSpace(readStringFromMap(value, key)); phone != "" {
				return phone
			}
		}
		for _, key := range []string{"phoneInfo", "phone_info", "response", "result", "data"} {
			nested, ok := value[key]
			if !ok {
				continue
			}
			if phone := extractPhoneFromPayload(nested); phone != "" {
				return phone
			}
		}
	case []interface{}:
		for _, item := range value {
			if phone := extractPhoneFromPayload(item); phone != "" {
				return phone
			}
		}
	case string:
		return extractPhoneFromPayloadString(value)
	}
	return ""
}

func readStringFromMap(payload map[string]interface{}, keys ...string) string {
	for _, key := range keys {
		value, ok := payload[key]
		if !ok || value == nil {
			continue
		}
		switch cast := value.(type) {
		case string:
			if trimmed := strings.TrimSpace(cast); trimmed != "" {
				return trimmed
			}
		case float64:
			return strings.TrimSpace(fmt.Sprintf("%.0f", cast))
		case json.Number:
			if trimmed := strings.TrimSpace(cast.String()); trimmed != "" {
				return trimmed
			}
		}
	}
	return ""
}

type alipayOAuthResponse struct {
	Response struct {
		Code        string `json:"code"`
		Msg         string `json:"msg"`
		UserID      string `json:"user_id"`
		AccessToken string `json:"access_token"`
		SubCode     string `json:"sub_code"`
		SubMsg      string `json:"sub_msg"`
		ExpiresIn   string `json:"expires_in"`
	} `json:"alipay_system_oauth_token_response"`
	Sign string `json:"sign"`
}

type alipayOAuthTokenResult struct {
	UserID      string
	AccessToken string
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

type alipayUserInfoResponse struct {
	Response struct {
		Code    string `json:"code"`
		Msg     string `json:"msg"`
		SubCode string `json:"sub_code"`
		SubMsg  string `json:"sub_msg"`
		Mobile  string `json:"mobile"`
	} `json:"alipay_user_info_share_response"`
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
	return verifyAlipaySignature(content, sign, key)
}

func verifyAlipaySignature(content, signature string, key *rsa.PublicKey) error {
	decoded, err := decodeBase64String(strings.TrimSpace(signature))
	if err != nil {
		return fmt.Errorf("decode alipay sign: %w", err)
	}
	hash := sha256.Sum256([]byte(content))
	if err := rsa.VerifyPKCS1v15(key, crypto.SHA256, hash[:], decoded); err != nil {
		return fmt.Errorf("verify alipay sign: %w", err)
	}
	return nil
}
