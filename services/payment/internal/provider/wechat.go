package provider

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/wechatpay-apiv3/wechatpay-go/core"
	"github.com/wechatpay-apiv3/wechatpay-go/core/auth/verifiers"
	"github.com/wechatpay-apiv3/wechatpay-go/core/downloader"
	"github.com/wechatpay-apiv3/wechatpay-go/core/notify"
	"github.com/wechatpay-apiv3/wechatpay-go/core/option"
	"github.com/wechatpay-apiv3/wechatpay-go/services/payments"
	"github.com/wechatpay-apiv3/wechatpay-go/services/payments/jsapi"
	"github.com/wechatpay-apiv3/wechatpay-go/utils"
)

type WechatConfig struct {
	AppID, MchID, APIv3Key, MerchantPrivateKeyPath, MerchantSerialNumber, NotifyURL string
}

type WechatCreateRequest struct {
	OutTradeNo, Description, OpenID string
	AmountFen                       int64
	ExpiresAt                       time.Time
}

type WechatCreateResult struct {
	PrepayID, Package, NonceStr, TimeStamp, SignType, PaySign string
}

type WechatResolution struct {
	OutTradeNo, Status, ProviderTradeNo, Reason string
	AmountFen                                   int64
}

type Wechat interface {
	Create(context.Context, WechatCreateRequest) (WechatCreateResult, error)
	Query(context.Context, string) (WechatResolution, error)
	ParseNotify(context.Context, *http.Request) (WechatResolution, error)
}

type WechatProvider struct {
	config  WechatConfig
	service jsapi.JsapiApiService
	notify  *notify.Handler
}

func NewWechat(ctx context.Context, config WechatConfig) (*WechatProvider, error) {
	if err := validateWechatConfig(config); err != nil {
		return nil, err
	}
	privateKey, err := utils.LoadPrivateKeyWithPath(config.MerchantPrivateKeyPath)
	if err != nil {
		return nil, fmt.Errorf("load wechat merchant private key: %w", err)
	}
	client, err := core.NewClient(ctx, option.WithWechatPayAutoAuthCipher(
		config.MchID, config.MerchantSerialNumber, privateKey, config.APIv3Key,
	))
	if err != nil {
		return nil, fmt.Errorf("initialize wechat pay client: %w", err)
	}
	visitor := downloader.MgrInstance().GetCertificateVisitor(config.MchID)
	notifyHandler, err := notify.NewRSANotifyHandler(config.APIv3Key, verifiers.NewSHA256WithRSAVerifier(visitor))
	if err != nil {
		return nil, fmt.Errorf("initialize wechat notify handler: %w", err)
	}
	return &WechatProvider{config: config, service: jsapi.JsapiApiService{Client: client}, notify: notifyHandler}, nil
}

func (p *WechatProvider) Create(ctx context.Context, request WechatCreateRequest) (WechatCreateResult, error) {
	description := strings.TrimSpace(request.Description)
	if description == "" {
		description = "TMO订单"
	}
	response, _, err := p.service.PrepayWithRequestPayment(ctx, jsapi.PrepayRequest{
		Appid: core.String(p.config.AppID), Mchid: core.String(p.config.MchID),
		Description: core.String(description), OutTradeNo: core.String(request.OutTradeNo),
		NotifyUrl: core.String(p.config.NotifyURL), TimeExpire: core.Time(request.ExpiresAt),
		Amount: &jsapi.Amount{Total: core.Int64(request.AmountFen), Currency: core.String("CNY")},
		Payer:  &jsapi.Payer{Openid: core.String(request.OpenID)},
	})
	if err != nil {
		return WechatCreateResult{}, fmt.Errorf("wechat jsapi prepay: %w", err)
	}
	return WechatCreateResult{
		PrepayID: valueOf(response.PrepayId), Package: valueOf(response.Package),
		NonceStr: valueOf(response.NonceStr), TimeStamp: valueOf(response.TimeStamp),
		SignType: valueOf(response.SignType), PaySign: valueOf(response.PaySign),
	}, nil
}

func (p *WechatProvider) Query(ctx context.Context, outTradeNo string) (WechatResolution, error) {
	transaction, _, err := p.service.QueryOrderByOutTradeNo(ctx, jsapi.QueryOrderByOutTradeNoRequest{
		OutTradeNo: core.String(outTradeNo), Mchid: core.String(p.config.MchID),
	})
	if err != nil {
		return WechatResolution{}, fmt.Errorf("wechat query order: %w", err)
	}
	return resolutionFromTransaction(transaction), nil
}

func (p *WechatProvider) ParseNotify(ctx context.Context, request *http.Request) (WechatResolution, error) {
	transaction := new(payments.Transaction)
	if _, err := p.notify.ParseNotifyRequest(ctx, request, transaction); err != nil {
		return WechatResolution{}, fmt.Errorf("verify wechat notification: %w", err)
	}
	if valueOf(transaction.Appid) != p.config.AppID || valueOf(transaction.Mchid) != p.config.MchID {
		return WechatResolution{}, fmt.Errorf("wechat notification merchant mismatch")
	}
	return resolutionFromTransaction(transaction), nil
}

func resolutionFromTransaction(transaction *payments.Transaction) WechatResolution {
	resolution := WechatResolution{
		OutTradeNo:      valueOf(transaction.OutTradeNo),
		ProviderTradeNo: valueOf(transaction.TransactionId),
		Reason:          valueOf(transaction.TradeStateDesc),
	}
	if transaction.Amount != nil {
		resolution.AmountFen = valueOf(transaction.Amount.Total)
	}
	switch strings.ToUpper(valueOf(transaction.TradeState)) {
	case "SUCCESS", "REFUND":
		resolution.Status = "PAID"
	case "CLOSED", "REVOKED":
		resolution.Status = "CANCELLED"
	case "PAYERROR":
		resolution.Status = "PAY_FAILED"
	default:
		resolution.Status = "PAY_PENDING"
	}
	return resolution
}

func valueOf[T any](value *T) T {
	if value == nil {
		var zero T
		return zero
	}
	return *value
}

func validateWechatConfig(config WechatConfig) error {
	values := map[string]string{
		"PAYMENT_WECHAT_APP_ID": config.AppID, "PAYMENT_WECHAT_MCH_ID": config.MchID,
		"PAYMENT_WECHAT_API_V3_KEY": config.APIv3Key, "PAYMENT_WECHAT_MERCHANT_PRIVATE_KEY_PATH": config.MerchantPrivateKeyPath,
		"PAYMENT_WECHAT_MERCHANT_SERIAL_NUMBER": config.MerchantSerialNumber, "PAYMENT_WECHAT_NOTIFY_URL": config.NotifyURL,
	}
	for name, value := range values {
		if strings.TrimSpace(value) == "" {
			return fmt.Errorf("%s is required for wechat provider", name)
		}
	}
	if len(config.APIv3Key) != 32 {
		return fmt.Errorf("PAYMENT_WECHAT_API_V3_KEY must be 32 bytes")
	}
	return nil
}
