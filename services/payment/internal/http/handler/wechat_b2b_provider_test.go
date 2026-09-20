package handler

import (
	"context"
	"encoding/json"
	"errors"
	"io"
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

func TestWechatB2BDirectProviderQueriesAndValidatesPaidOrder(t *testing.T) {
	orderID := uuid.MustParse("6fc00330-8131-4bdb-b115-c197a29aa14f")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/token":
			body, err := io.ReadAll(r.Body)
			if err != nil {
				t.Fatal(err)
			}
			if r.Method != http.MethodPost || string(body) != `{"grant_type":"client_credential","appid":"app-id","secret":"app-secret","force_refresh":false}` {
				t.Fatalf("unexpected stable token request: %s %q", r.Method, string(body))
			}
			_, _ = w.Write([]byte(`{"access_token":"access-token"}`))
		case "/order":
			if r.Method != http.MethodPost || r.URL.Query().Get("access_token") != "access-token" {
				t.Fatalf("unexpected order request: %s %s", r.Method, r.URL.RawQuery)
			}
			body, err := io.ReadAll(r.Body)
			if err != nil {
				t.Fatal(err)
			}
			wantBody := `{"mchid":"1747937433","out_trade_no":"6fc0033081314bdbb115c197a29aa14f"}`
			if string(body) != wantBody || r.URL.Query().Get("pay_sig") != hmacSHA256Hex("app-key", "/retail/B2b/getorder&"+wantBody) {
				t.Fatalf("unexpected signed order request: %q %q", string(body), r.URL.Query().Get("pay_sig"))
			}
			_, _ = w.Write([]byte(`{"errcode":0,"mchid":"1747937433","out_trade_no":"6fc0033081314bdbb115c197a29aa14f","attach":"6fc00330-8131-4bdb-b115-c197a29aa14f","env":0,"pay_status":"ORDER_PAY_SUCC","wxpay_transaction_id":"4200000000000000000","amount":{"order_amount":1,"currency":"CNY"}}`))
		default:
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
	}))
	defer server.Close()

	provider, err := NewWechatB2BDirectProvider(WechatB2BConfig{
		AppID: "app-id", AppSecret: "app-secret", MchID: "1747937433", AppKey: "app-key", SessionURL: server.URL + "/session",
		TokenURL: server.URL + "/token", OrderURL: server.URL + "/order",
	})
	if err != nil {
		t.Fatal(err)
	}
	resolution, err := provider.QueryPayment(context.Background(), WechatB2BQueryRequest{OrderID: orderID, AmountFen: 1})
	if err != nil {
		t.Fatal(err)
	}
	if resolution.Status != paymentStatusPaid || resolution.ProviderTradeNo != "4200000000000000000" {
		t.Fatalf("unexpected resolution: %#v", resolution)
	}
}

func TestWechatB2BDirectProviderRejectsMismatchedOrderResponse(t *testing.T) {
	orderID := uuid.New()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/token" {
			_, _ = w.Write([]byte(`{"access_token":"access-token"}`))
			return
		}
		_, _ = w.Write([]byte(`{"errcode":0,"mchid":"mch","out_trade_no":"wrong","attach":"wrong","env":0,"pay_status":"ORDER_PAY_SUCC","wxpay_transaction_id":"trade","amount":{"order_amount":1,"currency":"CNY"}}`))
	}))
	defer server.Close()
	provider, err := NewWechatB2BDirectProvider(WechatB2BConfig{AppID: "app", AppSecret: "secret", MchID: "mch", AppKey: "key", SessionURL: server.URL, TokenURL: server.URL + "/token", OrderURL: server.URL + "/order"})
	if err != nil {
		t.Fatal(err)
	}
	_, err = provider.QueryPayment(context.Background(), WechatB2BQueryRequest{OrderID: orderID, AmountFen: 1})
	if err == nil || !strings.Contains(err.Error(), "validation") {
		t.Fatalf("expected response validation error, got %v", err)
	}
}

func TestWechatB2BDirectProviderKeepsIncompletePendingOrderPending(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/token" {
			_, _ = w.Write([]byte(`{"access_token":"access-token"}`))
			return
		}
		_, _ = w.Write([]byte(`{"errcode":0,"pay_status":"ORDER_NOT_PAY"}`))
	}))
	defer server.Close()
	provider, err := NewWechatB2BDirectProvider(WechatB2BConfig{AppID: "app", AppSecret: "secret", MchID: "mch", AppKey: "key", SessionURL: server.URL, TokenURL: server.URL + "/token", OrderURL: server.URL + "/order"})
	if err != nil {
		t.Fatal(err)
	}
	resolution, err := provider.QueryPayment(context.Background(), WechatB2BQueryRequest{OrderID: uuid.New(), AmountFen: 1})
	if err != nil {
		t.Fatal(err)
	}
	if resolution.Status != paymentStatusPending {
		t.Fatalf("expected incomplete non-success response to remain pending: %#v", resolution)
	}
}

func TestWechatB2BDirectProviderCachesAccessToken(t *testing.T) {
	tokenCalls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/token" {
			tokenCalls++
			_, _ = w.Write([]byte(`{"access_token":"access-token","expires_in":7200}`))
			return
		}
		_, _ = w.Write([]byte(`{"errcode":0,"pay_status":"ORDER_NOT_PAY"}`))
	}))
	defer server.Close()
	provider, err := NewWechatB2BDirectProvider(WechatB2BConfig{AppID: "app", AppSecret: "secret", MchID: "mch", AppKey: "key", SessionURL: server.URL, TokenURL: server.URL + "/token", OrderURL: server.URL + "/order"})
	if err != nil {
		t.Fatal(err)
	}
	for range 2 {
		if _, err := provider.QueryPayment(context.Background(), WechatB2BQueryRequest{OrderID: uuid.New(), AmountFen: 1}); err != nil {
			t.Fatal(err)
		}
	}
	if tokenCalls != 1 {
		t.Fatalf("expected a cached B2B access token, got %d token requests", tokenCalls)
	}
}
