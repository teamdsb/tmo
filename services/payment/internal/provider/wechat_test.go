package provider

import (
	"os"
	"path/filepath"
	"strings"
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

func TestValidatePrivateKeyFilePermissions(t *testing.T) {
	keyPath := filepath.Join(t.TempDir(), "merchant-private-key.pem")
	if err := os.WriteFile(keyPath, []byte("test-key"), 0o600); err != nil {
		t.Fatalf("write private key fixture: %v", err)
	}
	if err := os.Chmod(keyPath, 0o400); err != nil {
		t.Fatalf("secure private key fixture: %v", err)
	}
	if err := validatePrivateKeyFilePermissions(keyPath); err != nil {
		t.Fatalf("expected 0400 regular file to pass validation, got %v", err)
	}

	if err := os.Chmod(keyPath, 0o440); err != nil {
		t.Fatalf("make private key group-readable: %v", err)
	}
	if err := validatePrivateKeyFilePermissions(keyPath); err == nil || !strings.Contains(err.Error(), "0400") {
		t.Fatalf("expected group-readable private key to be rejected, got %v", err)
	}

	if err := validatePrivateKeyFilePermissions(filepath.Dir(keyPath)); err == nil {
		t.Fatal("expected private key directory to be rejected")
	}
}
