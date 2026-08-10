package platform

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestNewMiniLoginResolverUsesBoundedPrivateDefaultHTTPClient(t *testing.T) {
	resolver := NewMiniLoginResolver(Config{
		WeappAppID:     "wx-test-app",
		WeappAppSecret: "test-secret",
	})
	if resolver.weapp == nil {
		t.Fatal("expected configured WeChat client")
	}
	if resolver.weapp.httpClient == http.DefaultClient {
		t.Fatal("expected a private default HTTP client")
	}
	if resolver.weapp.httpClient.Timeout != 15*time.Second {
		t.Fatalf("expected default HTTP timeout 15s, got %s", resolver.weapp.httpClient.Timeout)
	}
}

func TestNewMiniLoginResolverPreservesInjectedHTTPClient(t *testing.T) {
	injected := &http.Client{Timeout: 37 * time.Second}
	resolver := NewMiniLoginResolver(Config{
		WeappAppID:     "wx-test-app",
		WeappAppSecret: "test-secret",
		HTTPClient:     injected,
	})
	if resolver.weapp == nil {
		t.Fatal("expected configured WeChat client")
	}
	if resolver.weapp.httpClient != injected {
		t.Fatal("expected explicitly injected HTTP client pointer to be preserved")
	}
	if resolver.weapp.httpClient.Timeout != 37*time.Second {
		t.Fatalf("expected injected HTTP timeout 37s, got %s", resolver.weapp.httpClient.Timeout)
	}
}

func TestResolveRejectsMockCodeInRealModeWithoutPlatformConfig(t *testing.T) {
	resolver := NewMiniLoginResolver(Config{
		Mode: LoginModeReal,
	})

	if _, err := resolver.Resolve(context.Background(), "weapp", "mock_customer_001"); err == nil {
		t.Fatal("expected mock code to be rejected in real mode")
	}
}

func TestResolveRejectsArbitraryCodeInRealModeWithoutPlatformConfig(t *testing.T) {
	resolver := NewMiniLoginResolver(Config{
		Mode:                       LoginModeReal,
		EnablePhoneProofSimulation: true,
		PhoneProofSimulationPhone:  "+15550000003",
	})

	if _, err := resolver.Resolve(context.Background(), "weapp", "real_code_123"); err == nil {
		t.Fatalf("expected non-mock code to fail without platform config")
	}
}

func TestResolveDoesNotUseLocalMockIdentityWhenPlatformClientExists(t *testing.T) {
	calls := 0
	resolver := NewMiniLoginResolver(Config{
		Mode:            LoginModeMock,
		WeappAppID:      "wx-test-app",
		WeappAppSecret:  "test-secret",
		WeappSessionURL: "https://wechat.example/session",
		HTTPClient: &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			calls++
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     make(http.Header),
				Body:       io.NopCloser(strings.NewReader(`{"openid":"upstream-openid"}`)),
				Request:    req,
			}, nil
		})},
	})

	identity, err := resolver.Resolve(context.Background(), "weapp", "mock_debug_001")
	if err != nil {
		t.Fatalf("expected configured platform client to handle the code: %v", err)
	}
	if calls != 1 || identity.ProviderUserID != "upstream-openid" {
		t.Fatalf("expected one upstream call and upstream identity, calls=%d identity=%#v", calls, identity)
	}
}

func TestResolveRejectsMockCodeInRealModeEvenWhenWeappConfigExists(t *testing.T) {
	calls := 0
	resolver := NewMiniLoginResolver(Config{
		Mode:            LoginModeReal,
		WeappAppID:      "wx-test-app",
		WeappAppSecret:  "test-secret",
		WeappSessionURL: "https://wechat.example/session",
		HTTPClient: &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			calls++
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     make(http.Header),
				Body:       io.NopCloser(strings.NewReader(`{"openid":"should-not-be-used"}`)),
				Request:    req,
			}, nil
		})},
	})

	if _, err := resolver.Resolve(context.Background(), "weapp", "mock_debug_001"); err == nil {
		t.Fatal("expected configured real-mode resolver to reject mock code")
	}
	if calls != 0 {
		t.Fatalf("expected mock code rejection before any upstream request, calls=%d", calls)
	}
}

func TestResolveAllowsLocalMockCodeOnlyInMockModeWithoutPlatformConfig(t *testing.T) {
	resolver := NewMiniLoginResolver(Config{Mode: LoginModeMock})

	identity, err := resolver.Resolve(context.Background(), "weapp", "mock_customer_001")
	if err != nil {
		t.Fatalf("expected local mock identity, got error: %v", err)
	}
	if identity.ProviderUserID != "mock_customer_001" {
		t.Fatalf("expected provider user id mock_customer_001, got %q", identity.ProviderUserID)
	}
}

func TestResolvePhoneRejectsDirectPhoneInRealMode(t *testing.T) {
	resolver := NewMiniLoginResolver(Config{Mode: LoginModeReal})

	if _, err := resolver.ResolvePhone(context.Background(), "weapp", PhoneProof{Phone: "+15550000003"}); err == nil {
		t.Fatal("expected direct phone proof to be rejected in real mode")
	}
}

func TestResolvePhoneAllowsDirectPhoneInMockMode(t *testing.T) {
	resolver := NewMiniLoginResolver(Config{Mode: LoginModeMock})

	phone, err := resolver.ResolvePhone(context.Background(), "weapp", PhoneProof{Phone: "+15550000003"})
	if err != nil {
		t.Fatalf("expected direct phone in mock mode, got error: %v", err)
	}
	if phone != "+15550000003" {
		t.Fatalf("expected normalized passthrough phone, got %q", phone)
	}
}

func TestPhoneProofSimulationIsDisabledInRealMode(t *testing.T) {
	resolver := NewMiniLoginResolver(Config{
		Mode:                       LoginModeReal,
		EnablePhoneProofSimulation: true,
		PhoneProofSimulationPhone:  "+15550000003",
	})

	if resolver.SupportsPhoneProofSimulation() {
		t.Fatal("expected phone proof simulation to be disabled in real mode")
	}
}
