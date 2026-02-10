package platform

import (
	"context"
	"errors"
	"net/http"
	"strings"
)

var ErrUnsupportedPlatform = errors.New("unsupported platform")

type LoginMode string

const (
	LoginModeMock LoginMode = "mock"
	LoginModeReal LoginMode = "real"
)

type LoginIdentity struct {
	ProviderUserID string
	UnionID        string
}

type PhoneProof struct {
	Code  string
	Phone string
}

type Config struct {
	Mode             LoginMode
	WeappAppID       string
	WeappAppSecret   string
	WeappSessionURL  string
	WeappTokenURL    string
	WeappQRCodeURL   string
	WeappPhoneURL    string
	WeappSalesPage   string
	WeappQRWidth     int
	AlipayAppID      string
	AlipayPrivateKey string
	AlipayPublicKey  string
	AlipayGatewayURL string
	AlipaySignType   string
	AlipaySalesPage  string
	HTTPClient       *http.Client
}

type MiniLoginResolver struct {
	mode            LoginMode
	weapp           *weappClient
	alipay          *alipayClient
	weappSalesPage  string
	weappQRWidth    int
	alipaySalesPage string
}

func NewMiniLoginResolver(cfg Config) *MiniLoginResolver {
	mode := cfg.Mode
	switch mode {
	case LoginModeReal, LoginModeMock:
	default:
		mode = LoginModeMock
	}

	client := cfg.HTTPClient
	if client == nil {
		client = http.DefaultClient
	}

	return &MiniLoginResolver{
		mode:            mode,
		weapp:           newWeappClient(cfg, client),
		alipay:          newAlipayClient(cfg, client),
		weappSalesPage:  cfg.WeappSalesPage,
		weappQRWidth:    cfg.WeappQRWidth,
		alipaySalesPage: cfg.AlipaySalesPage,
	}
}

func (r *MiniLoginResolver) Resolve(ctx context.Context, platform, code string) (LoginIdentity, error) {
	if strings.TrimSpace(code) == "" {
		return LoginIdentity{}, errors.New("code is required")
	}

	switch strings.ToLower(platform) {
	case "weapp":
		if r.mode == LoginModeMock && r.weapp == nil {
			return LoginIdentity{ProviderUserID: code}, nil
		}
		if r.weapp == nil {
			return LoginIdentity{}, errors.New("weapp is not configured")
		}
		return r.weapp.Resolve(ctx, code)
	case "alipay":
		if r.mode == LoginModeMock && r.alipay == nil {
			return LoginIdentity{ProviderUserID: code}, nil
		}
		if r.alipay == nil {
			return LoginIdentity{}, errors.New("alipay is not configured")
		}
		return r.alipay.Resolve(ctx, code)
	default:
		return LoginIdentity{}, ErrUnsupportedPlatform
	}
}

func (r *MiniLoginResolver) ResolvePhone(ctx context.Context, platform string, proof PhoneProof) (string, error) {
	if strings.TrimSpace(proof.Phone) != "" {
		return strings.TrimSpace(proof.Phone), nil
	}

	switch strings.ToLower(platform) {
	case "weapp":
		if r.mode == LoginModeMock && r.weapp == nil {
			return "", errors.New("weapp phone proof is not configured")
		}
		if r.weapp == nil {
			return "", errors.New("weapp is not configured")
		}
		return r.weapp.ResolvePhone(ctx, proof.Code)
	case "alipay":
		if r.mode == LoginModeMock && r.alipay == nil {
			return "", errors.New("alipay phone proof is not configured")
		}
		if r.alipay == nil {
			return "", errors.New("alipay is not configured")
		}
		return r.alipay.ResolvePhone(ctx, proof.Code)
	default:
		return "", ErrUnsupportedPlatform
	}
}

func (r *MiniLoginResolver) RequiresPhoneProof() bool {
	return r.mode == LoginModeReal
}

func (r *MiniLoginResolver) GenerateSalesQRCode(ctx context.Context, platform, scene string) (string, error) {
	switch strings.ToLower(platform) {
	case "weapp":
		if r.mode == LoginModeMock && r.weapp == nil {
			return generateMockQRCode(scene)
		}
		if r.weapp == nil {
			return "", errors.New("weapp is not configured")
		}
		bytes, err := r.weapp.GenerateQRCode(ctx, scene, r.weappSalesPage, r.weappQRWidth)
		if err != nil {
			return "", err
		}
		return encodePNGDataURL(bytes), nil
	case "alipay":
		if r.mode == LoginModeMock && r.alipay == nil {
			return generateMockQRCode(scene)
		}
		if r.alipay == nil {
			return "", errors.New("alipay is not configured")
		}
		return r.alipay.GenerateQRCode(ctx, scene, r.alipaySalesPage)
	default:
		return "", ErrUnsupportedPlatform
	}
}
