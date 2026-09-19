package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return f(request)
}

func TestNewWechatB2BDirectProviderRequiresCompleteCredentials(t *testing.T) {
	tests := []WechatB2BConfig{
		{},
		{AppID: "app", AppSecret: "secret", MchID: "mch", SessionURL: "https://example.com"},
		{AppID: "app", AppSecret: "secret", MchID: "mch", AppKey: "key", Environment: 2, SessionURL: "https://example.com"},
	}
	for _, config := range tests {
		if _, err := NewWechatB2BDirectProvider(config); err == nil {
			t.Fatalf("expected invalid config to fail: %#v", config)
		}
	}
}

func TestWechatB2BDirectProviderCreatesSignedCommonPayParams(t *testing.T) {
	sessionServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("appid") != "app-id" || r.URL.Query().Get("secret") != "app-secret" || r.URL.Query().Get("js_code") != "login-code" {
			t.Fatalf("unexpected code2session query: %s", r.URL.RawQuery)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"session_key":"session-key"}`))
	}))
	defer sessionServer.Close()

	provider, err := NewWechatB2BDirectProvider(WechatB2BConfig{
		AppID: "app-id", AppSecret: "app-secret", MchID: "1747937433", AppKey: "app-key",
		Environment: 0, SessionURL: sessionServer.URL,
	})
	if err != nil {
		t.Fatal(err)
	}
	orderID := uuid.MustParse("6fc00330-8131-4bdb-b115-c197a29aa14f")
	params, err := provider.CreateCommonPayParams(context.Background(), WechatB2BPaymentRequest{
		OrderID: orderID, AmountFen: 1, ExpiresAt: time.Now().Add(15 * time.Minute), LoginCode: "login-code",
	})
	if err != nil {
		t.Fatal(err)
	}
	signData, ok := params["signData"].(string)
	if !ok || signData == "" {
		t.Fatalf("missing signData: %#v", params)
	}
	var payload struct {
		MchID      string `json:"mchid"`
		OutTradeNo string `json:"out_trade_no"`
		Attach     string `json:"attach"`
		Env        int    `json:"env"`
		Amount     struct {
			OrderAmount int64  `json:"order_amount"`
			Currency    string `json:"currency"`
		} `json:"amount"`
	}
	if err := json.Unmarshal([]byte(signData), &payload); err != nil {
		t.Fatal(err)
	}
	if payload.MchID != "1747937433" || payload.OutTradeNo != "6fc0033081314bdbb115c197a29aa14f" || strings.Contains(payload.OutTradeNo, "-") {
		t.Fatalf("unexpected merchant order payload: %#v", payload)
	}
	if payload.Attach != orderID.String() || payload.Amount.OrderAmount != 1 || payload.Amount.Currency != "CNY" || payload.Env != 0 {
		t.Fatalf("unexpected payment payload: %#v", payload)
	}
	if params["mode"] != "retail_pay_goods" {
		t.Fatalf("unexpected mode: %#v", params["mode"])
	}
	if params["paySig"] != hmacSHA256Hex("app-key", "requestCommonPayment&"+signData) {
		t.Fatalf("unexpected paySig")
	}
	if params["signature"] != hmacSHA256Hex("session-key", signData) {
		t.Fatalf("unexpected session signature")
	}
}

func TestWechatB2BDirectProviderRejectsMissingLoginCodeAndWechatError(t *testing.T) {
	sessionServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"errcode":40029,"errmsg":"invalid code"}`))
	}))
	defer sessionServer.Close()
	provider, err := NewWechatB2BDirectProvider(WechatB2BConfig{
		AppID: "app", AppSecret: "secret", MchID: "mch", AppKey: "key", SessionURL: sessionServer.URL,
	})
	if err != nil {
		t.Fatal(err)
	}
	request := WechatB2BPaymentRequest{OrderID: uuid.New(), AmountFen: 1}
	if _, err := provider.CreateCommonPayParams(context.Background(), request); err == nil || !strings.Contains(err.Error(), "login code") {
		t.Fatalf("expected missing login code error, got %v", err)
	}
	request.LoginCode = "bad-code"
	if _, err := provider.CreateCommonPayParams(context.Background(), request); err == nil || !strings.Contains(err.Error(), "40029") {
		t.Fatalf("expected code2session error, got %v", err)
	}
}

func TestWechatB2BDirectProviderSanitizesTransportErrors(t *testing.T) {
	provider, err := NewWechatB2BDirectProvider(WechatB2BConfig{
		AppID: "app", AppSecret: "sentinel-app-secret", MchID: "mch", AppKey: "key",
		SessionURL: "https://api.weixin.qq.com/sns/jscode2session",
	})
	if err != nil {
		t.Fatal(err)
	}
	provider.client = &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		return nil, errors.New("transport failed")
	})}
	_, err = provider.CreateCommonPayParams(context.Background(), WechatB2BPaymentRequest{
		OrderID: uuid.New(), AmountFen: 1, LoginCode: "sentinel-login-code",
	})
	if err == nil {
		t.Fatal("expected transport failure")
	}
	message := err.Error()
	if strings.Contains(message, "sentinel-app-secret") || strings.Contains(message, "sentinel-login-code") || strings.Contains(message, "https://") {
		t.Fatalf("transport error leaked credentials or request URL: %q", message)
	}
}
