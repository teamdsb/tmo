package provider

import (
	"testing"

	"github.com/wechatpay-apiv3/wechatpay-go/core"
	"github.com/wechatpay-apiv3/wechatpay-go/services/payments"
)

func TestResolutionFromTransactionMapsWechatStates(t *testing.T) {
	tests := []struct{ state, want string }{
		{"SUCCESS", "PAID"}, {"USERPAYING", "PAY_PENDING"}, {"NOTPAY", "PAY_PENDING"},
		{"CLOSED", "CANCELLED"}, {"REVOKED", "CANCELLED"}, {"PAYERROR", "PAY_FAILED"},
	}
	for _, test := range tests {
		t.Run(test.state, func(t *testing.T) {
			got := resolutionFromTransaction(&payments.Transaction{
				TradeState: core.String(test.state), OutTradeNo: core.String("order-1"),
				TransactionId: core.String("wx-1"), Amount: &payments.TransactionAmount{Total: core.Int64(100)},
			})
			if got.Status != test.want || got.OutTradeNo != "order-1" || got.AmountFen != 100 {
				t.Fatalf("unexpected resolution: %#v", got)
			}
		})
	}
}

func TestValidateWechatConfigRequiresCredentials(t *testing.T) {
	if err := validateWechatConfig(WechatConfig{}); err == nil {
		t.Fatal("expected missing configuration error")
	}
	config := WechatConfig{
		AppID: "wx-app", MchID: "mch", APIv3Key: "12345678901234567890123456789012",
		MerchantPrivateKeyPath: "/tmp/key.pem", MerchantSerialNumber: "serial", NotifyURL: "https://pay.example.com/notify",
	}
	if err := validateWechatConfig(config); err != nil {
		t.Fatalf("expected valid configuration, got %v", err)
	}
}
