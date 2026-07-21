package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestWechatB2BDirectProviderUsesCompactOutTradeNo(t *testing.T) {
	sessionServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.URL.Query().Get("js_code"); got != "login-code" {
			t.Fatalf("expected login code, got %q", got)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"session_key":"session-key"}`))
	}))
	defer sessionServer.Close()

	provider, err := NewWechatB2BDirectProvider(WechatB2BConfig{
		AppID:      "app-id",
		AppSecret:  "app-secret",
		MchID:      "mch-id",
		AppKey:     "app-key",
		SessionURL: sessionServer.URL,
	})
	if err != nil {
		t.Fatalf("new provider: %v", err)
	}

	orderID := uuid.MustParse("6fc00330-8131-4bdb-b115-c197a29aa14f")
	params, err := provider.CreateCommonPayParams(context.Background(), WechatB2BPaymentRequest{
		OrderID:   orderID,
		AmountFen: 1,
		ExpiresAt: time.Now().Add(15 * time.Minute),
		LoginCode: "login-code",
	})
	if err != nil {
		t.Fatalf("create common pay params: %v", err)
	}

	signData, ok := params["signData"].(string)
	if !ok || signData == "" {
		t.Fatalf("missing signData: %#v", params)
	}
	var payload struct {
		OutTradeNo string `json:"out_trade_no"`
		Attach     string `json:"attach"`
	}
	if err := json.Unmarshal([]byte(signData), &payload); err != nil {
		t.Fatalf("decode signData: %v", err)
	}
	if payload.OutTradeNo != "6fc0033081314bdbb115c197a29aa14f" {
		t.Fatalf("unexpected out_trade_no: %q", payload.OutTradeNo)
	}
	if strings.Contains(payload.OutTradeNo, "-") {
		t.Fatalf("out_trade_no must not contain hyphens: %q", payload.OutTradeNo)
	}
	if payload.Attach != orderID.String() {
		t.Fatalf("expected attach to keep order UUID, got %q", payload.Attach)
	}
}
