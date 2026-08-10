package handler

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/teamdsb/tmo/services/payment/internal/db"
	"github.com/teamdsb/tmo/services/payment/internal/http/middleware"
	"github.com/teamdsb/tmo/services/payment/internal/http/oapi"
	"github.com/teamdsb/tmo/services/payment/internal/provider"
)

type wechatProviderStub struct {
	created         provider.WechatCreateRequest
	query           provider.WechatResolution
	queryOutTradeNo string
	notify          provider.WechatResolution
	notifyBody      string
}

func (s *wechatProviderStub) Create(_ context.Context, request provider.WechatCreateRequest) (provider.WechatCreateResult, error) {
	s.created = request
	return provider.WechatCreateResult{PrepayID: "wx-prepay", Package: "prepay_id=wx-prepay", NonceStr: "nonce", TimeStamp: "1", SignType: "RSA", PaySign: "sign"}, nil
}
func (s *wechatProviderStub) Query(_ context.Context, outTradeNo string) (provider.WechatResolution, error) {
	s.queryOutTradeNo = outTradeNo
	return s.query, nil
}
func (s *wechatProviderStub) ParseNotify(_ context.Context, request *http.Request) (provider.WechatResolution, error) {
	body, _ := io.ReadAll(request.Body)
	s.notifyBody = string(body)
	return s.notify, nil
}

func TestCreateWechatPaymentUsesAuthenticatedOpenID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	orderID := uuid.MustParse("abababab-abab-abab-abab-abababababab")
	commerce := newCommerceServerStub(CommerceOrder{ID: orderID.String(), Status: "SUBMITTED", PaymentStatus: "UNPAID", Items: []CommerceOrderItem{{Qty: 1, UnitPriceFen: 888}}})
	defer commerce.Close()
	wechat := &wechatProviderStub{}
	h := &Handler{
		Flags: StaticFlagsProvider{Flags: FeatureFlags{PaymentEnabled: true, WechatPayEnabled: true}},
		Store: newPaymentStoreStub(), Commerce: NewCommerceClient(commerce.URL(), "sync-token"), ProviderMode: "wechat", Wechat: wechat,
	}
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/payments/wechat/create", nil)
	c.Request.Header.Set("Authorization", "Bearer user-token")
	response, err := h.createPaymentSession(c, middleware.Claims{
		UserID: uuid.MustParse("cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd"), Role: "CUSTOMER",
		IdentityProvider: "weapp", ProviderUserID: "openid-1",
	}, orderID, paymentChannelWechat, strPtr("idem-real"))
	if err != nil {
		t.Fatal(err)
	}
	if response == nil || wechat.created.OpenID != "openid-1" || wechat.created.AmountFen != 888 || wechat.created.OutTradeNo != "abababababababababababababababab" {
		t.Fatalf("unexpected provider request/response: %#v %#v", wechat.created, response)
	}
}

func TestPostPaymentsWechatCreateCreatesPaymentAndSyncsOrder(t *testing.T) {
	gin.SetMode(gin.TestMode)

	orderID := uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	store := newPaymentStoreStub()
	commerce := newCommerceServerStub(CommerceOrder{
		ID:            orderID.String(),
		Status:        "SUBMITTED",
		PaymentStatus: "UNPAID",
		Items: []CommerceOrderItem{
			{Qty: 2, UnitPriceFen: 1500},
			{Qty: 1, UnitPriceFen: 3000},
		},
	})
	defer commerce.Close()

	router := newTestRouter(&Handler{
		Flags:        StaticFlagsProvider{Flags: FeatureFlags{PaymentEnabled: true, WechatPayEnabled: true, AlipayPayEnabled: true}},
		Store:        store,
		Commerce:     NewCommerceClient(commerce.URL(), "sync-token"),
		ProviderMode: "mock",
	})

	req := httptest.NewRequest(http.MethodPost, "/payments/wechat/create", strings.NewReader(`{"orderId":"`+orderID.String()+`"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotency-Key", "idem-create-1")
	req.Header.Set("Authorization", "Bearer user-token")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var response struct {
		PaymentID string `json:"paymentId"`
		OrderID   string `json:"orderId"`
		Channel   string `json:"channel"`
		Status    string `json:"status"`
		PrepayID  string `json:"prepayId"`
		Package   string `json:"package"`
		SignType  string `json:"signType"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.PaymentID == "" || response.OrderID != orderID.String() {
		t.Fatalf("unexpected response: %#v", response)
	}
	if response.Channel != paymentChannelWechat || response.Status != paymentStatusPending {
		t.Fatalf("unexpected channel/status: %#v", response)
	}
	if response.PrepayID == "" || !strings.HasPrefix(response.Package, "prepay_id=") || response.SignType != "RSA" {
		t.Fatalf("unexpected wechat payload: %#v", response)
	}
	if len(store.payments) != 1 {
		t.Fatalf("expected one payment, got %d", len(store.payments))
	}
	if commerce.lastAuthorization != "Bearer user-token" {
		t.Fatalf("expected authorization passthrough, got %q", commerce.lastAuthorization)
	}
	if len(commerce.syncRequests) != 1 {
		t.Fatalf("expected one sync request, got %d", len(commerce.syncRequests))
	}
	if commerce.syncToken != "sync-token" {
		t.Fatalf("expected sync token header, got %q", commerce.syncToken)
	}
	if commerce.syncRequests[0].Status != paymentStatusPending {
		t.Fatalf("expected PAY_PENDING sync, got %#v", commerce.syncRequests[0])
	}
}

func TestPostPaymentsWechatCreateReturnsExistingPaymentForIdempotencyKey(t *testing.T) {
	gin.SetMode(gin.TestMode)

	orderID := uuid.MustParse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
	paymentID := uuid.MustParse("cccccccc-cccc-cccc-cccc-cccccccccccc")
	store := newPaymentStoreStub()
	commerce := newCommerceServerStub(CommerceOrder{
		ID:            orderID.String(),
		Status:        "COMPLETED",
		PaymentStatus: "PAID",
		Items:         []CommerceOrderItem{{Qty: 1, UnitPriceFen: 1999}},
	})
	defer commerce.Close()

	response := map[string]interface{}{
		"orderId":   orderID.String(),
		"channel":   paymentChannelWechat,
		"status":    paymentStatusPending,
		"expiresAt": time.Now().UTC().Add(15 * time.Minute).Format(time.RFC3339),
		"prepayId":  "prepay_existing",
		"package":   "prepay_id=prepay_existing",
		"nonceStr":  "nonce-existing",
		"timeStamp": "1234567890",
		"signType":  "RSA",
		"paySign":   "sign-existing",
	}
	raw, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("marshal existing payload: %v", err)
	}
	store.payments[paymentID] = db.Payment{
		ID:              paymentID,
		OrderID:         orderID,
		Channel:         paymentChannelWechat,
		Status:          paymentStatusPaid,
		AmountFen:       1999,
		Currency:        "CNY",
		IdempotencyKey:  strPtr("idem-existing"),
		ProviderPayload: raw,
		CreatedAt:       pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
		UpdatedAt:       pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
	}
	store.idempotency[keyForIdempotency(orderID, paymentChannelWechat, "idem-existing")] = paymentID

	router := newTestRouter(&Handler{
		Flags:        StaticFlagsProvider{Flags: FeatureFlags{PaymentEnabled: true, WechatPayEnabled: true, AlipayPayEnabled: true}},
		Store:        store,
		Commerce:     NewCommerceClient(commerce.URL(), "sync-token"),
		ProviderMode: "mock",
	})

	req := httptest.NewRequest(http.MethodPost, "/payments/wechat/create", strings.NewReader(`{"orderId":"`+orderID.String()+`"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotency-Key", "idem-existing")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		PaymentID string `json:"paymentId"`
		PrepayID  string `json:"prepayId"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.PaymentID != paymentID.String() || payload.PrepayID != "prepay_existing" {
		t.Fatalf("unexpected idempotent response: %#v", payload)
	}
	if store.createCalls != 0 {
		t.Fatalf("expected no new payment creation, got %d", store.createCalls)
	}
	if len(commerce.syncRequests) != 1 || commerce.syncRequests[0].PaymentID != paymentID.String() || commerce.syncRequests[0].Status != paymentStatusPaid {
		t.Fatalf("expected idempotent replay to repair commerce sync, got %#v", commerce.syncRequests)
	}
}

func TestPostPaymentsWechatCreateDoesNotReplayIdempotencyBeforeOrderAuthorization(t *testing.T) {
	gin.SetMode(gin.TestMode)

	orderID := uuid.MustParse("bcbcbcbc-bcbc-bcbc-bcbc-bcbcbcbcbcbc")
	paymentID := uuid.MustParse("cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd")
	store := newPaymentStoreStub()
	existing := paymentFixture(paymentID, paymentChannelWechat, paymentStatusPending)
	existing.OrderID = orderID
	existing.IdempotencyKey = strPtr("idem-private")
	existing.ProviderPayload = json.RawMessage(`{
		"orderId":"` + orderID.String() + `",
		"channel":"WECHAT",
		"status":"PAY_PENDING",
		"expiresAt":"2030-01-01T00:00:00Z",
		"prepayId":"private-prepay",
		"package":"prepay_id=private-prepay",
		"nonceStr":"private-nonce",
		"timeStamp":"1",
		"signType":"RSA",
		"paySign":"private-sign"
	}`)
	store.payments[paymentID] = existing
	store.idempotency[keyForIdempotency(orderID, paymentChannelWechat, "idem-private")] = paymentID

	commerce := newCommerceServerStub(CommerceOrder{})
	commerce.getOrderStatus = http.StatusForbidden
	defer commerce.Close()
	router := newTestRouter(&Handler{
		Flags:        StaticFlagsProvider{Flags: FeatureFlags{PaymentEnabled: true, WechatPayEnabled: true}},
		Store:        store,
		Commerce:     NewCommerceClient(commerce.URL(), "sync-token"),
		ProviderMode: "mock",
	})

	req := httptest.NewRequest(http.MethodPost, "/payments/wechat/create", strings.NewReader(`{"orderId":"`+orderID.String()+`"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotency-Key", "idem-private")
	req.Header.Set("Authorization", "Bearer unauthorized-user")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected denied Commerce lookup to fail before replay, got %d: %s", rec.Code, rec.Body.String())
	}
	if strings.Contains(rec.Body.String(), paymentID.String()) || strings.Contains(rec.Body.String(), "private-prepay") {
		t.Fatalf("denied request leaked payment payload: %s", rec.Body.String())
	}
	if len(commerce.syncRequests) != 0 {
		t.Fatalf("denied request synchronized payment state: %#v", commerce.syncRequests)
	}
}

func TestPostPaymentsAlipayCreateReturnsNotImplemented(t *testing.T) {
	gin.SetMode(gin.TestMode)

	orderID := uuid.MustParse("dddddddd-dddd-dddd-dddd-dddddddddddd")
	store := newPaymentStoreStub()
	router := newTestRouter(&Handler{
		Flags:        StaticFlagsProvider{Flags: FeatureFlags{PaymentEnabled: true, WechatPayEnabled: true, AlipayPayEnabled: true}},
		Store:        store,
		ProviderMode: "mock",
	})

	req := httptest.NewRequest(http.MethodPost, "/payments/alipay/create", strings.NewReader(`{"orderId":"`+orderID.String()+`"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotImplemented {
		t.Fatalf("expected 501, got %d: %s", rec.Code, rec.Body.String())
	}

	var response struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.Code != "not_implemented" {
		t.Fatalf("expected not_implemented error, got %#v", response)
	}
	if store.createCalls != 0 || len(store.payments) != 0 {
		t.Fatalf("alipay create must not create a payment, calls=%d payments=%d", store.createCalls, len(store.payments))
	}
}

func TestPostPaymentsAlipayNotifyReturnsNotImplementedWithoutMutation(t *testing.T) {
	gin.SetMode(gin.TestMode)

	paymentID := uuid.MustParse("dededede-dede-dede-dede-dededededede")
	store := newPaymentStoreStub()
	store.payments[paymentID] = paymentFixture(paymentID, paymentChannelWechat, paymentStatusPending)
	router := newTestRouter(&Handler{
		Flags:        StaticFlagsProvider{Flags: FeatureFlags{PaymentEnabled: true, AlipayPayEnabled: true}},
		Store:        store,
		ProviderMode: "mock",
	})

	body := `{"paymentId":"` + paymentID.String() + `","status":"SUCCESS"}`
	req := httptest.NewRequest(http.MethodPost, "/payments/alipay/notify", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotImplemented {
		t.Fatalf("expected 501, got %d: %s", rec.Code, rec.Body.String())
	}
	if store.payments[paymentID].Status != paymentStatusPending || len(store.webhooks) != 0 {
		t.Fatalf("alipay notify mutated payment state: payment=%#v webhooks=%#v", store.payments[paymentID], store.webhooks)
	}
}

func TestBuildProviderPayloadDoesNotCreateFakeAlipayTrade(t *testing.T) {
	now := time.Now().UTC()
	payload, tradeNo, prepayID, raw, err := buildProviderPayload(paymentChannelAlipay, uuid.New(), now, now.Add(15*time.Minute))
	if err == nil {
		t.Fatalf("expected Alipay payload generation to be unsupported, got payload=%#v tradeNo=%#v prepayID=%#v raw=%s", payload, tradeNo, prepayID, raw)
	}
	if payload != nil || tradeNo != nil || prepayID != nil || raw != nil {
		t.Fatalf("unsupported Alipay provider produced fake payment data: payload=%#v tradeNo=%#v prepayID=%#v raw=%s", payload, tradeNo, prepayID, raw)
	}
}

func TestPostPaymentsWechatCreateRejectsDisabledProvider(t *testing.T) {
	gin.SetMode(gin.TestMode)

	orderID := uuid.MustParse("dfdfdfdf-dfdf-dfdf-dfdf-dfdfdfdfdfdf")
	store := newPaymentStoreStub()
	commerce := newCommerceServerStub(CommerceOrder{
		ID: orderID.String(), Status: "SUBMITTED", PaymentStatus: "UNPAID",
		Items: []CommerceOrderItem{{Qty: 1, UnitPriceFen: 500}},
	})
	defer commerce.Close()
	router := newTestRouter(&Handler{
		Flags:        StaticFlagsProvider{Flags: FeatureFlags{PaymentEnabled: true, WechatPayEnabled: true}},
		Store:        store,
		Commerce:     NewCommerceClient(commerce.URL(), "sync-token"),
		ProviderMode: "disabled",
	})

	req := httptest.NewRequest(http.MethodPost, "/payments/wechat/create", strings.NewReader(`{"orderId":"`+orderID.String()+`"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d: %s", rec.Code, rec.Body.String())
	}
	if store.createCalls != 0 || len(store.payments) != 0 {
		t.Fatalf("disabled provider created a payment: calls=%d payments=%d", store.createCalls, len(store.payments))
	}
}

func TestPostPaymentsWechatCreateRejectsWhenFeatureFlagDisabled(t *testing.T) {
	gin.SetMode(gin.TestMode)

	orderID := uuid.MustParse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee")
	store := newPaymentStoreStub()
	commerce := newCommerceServerStub(CommerceOrder{
		ID:            orderID.String(),
		Status:        "SUBMITTED",
		PaymentStatus: "UNPAID",
		Items:         []CommerceOrderItem{{Qty: 1, UnitPriceFen: 100}},
	})
	defer commerce.Close()

	router := newTestRouter(&Handler{
		Flags:        StaticFlagsProvider{Flags: FeatureFlags{}},
		Store:        store,
		Commerce:     NewCommerceClient(commerce.URL(), "sync-token"),
		ProviderMode: "mock",
	})

	req := httptest.NewRequest(http.MethodPost, "/payments/wechat/create", strings.NewReader(`{"orderId":"`+orderID.String()+`"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestPostPaymentsPaymentIdRecheckUpdatesStatusAndSyncsOrder(t *testing.T) {
	gin.SetMode(gin.TestMode)

	orderID := uuid.MustParse("ffffffff-ffff-ffff-ffff-ffffffffffff")
	paymentID := uuid.MustParse("10101010-1010-1010-1010-101010101010")
	store := newPaymentStoreStub()
	store.payments[paymentID] = db.Payment{
		ID:              paymentID,
		OrderID:         orderID,
		Channel:         paymentChannelWechat,
		Status:          paymentStatusPending,
		AmountFen:       2400,
		Currency:        "CNY",
		ProviderTradeNo: strPtr("wx-order-1"),
		ProviderPayload: json.RawMessage(`{"orderId":"` + orderID.String() + `"}`),
		CreatedAt:       pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
		UpdatedAt:       pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
	}
	commerce := newCommerceServerStub(CommerceOrder{
		ID:            orderID.String(),
		Status:        "PAY_PENDING",
		PaymentStatus: "PAY_PENDING",
		Items:         []CommerceOrderItem{{Qty: 2, UnitPriceFen: 1200}},
	})
	defer commerce.Close()

	router := newTestRouter(&Handler{
		Flags:        StaticFlagsProvider{Flags: FeatureFlags{PaymentEnabled: true, WechatPayEnabled: true}},
		Store:        store,
		Commerce:     NewCommerceClient(commerce.URL(), "sync-token"),
		ProviderMode: "mock",
	})

	req := httptest.NewRequest(http.MethodPost, "/payments/"+paymentID.String()+"/recheck", strings.NewReader(`{"clientResult":"SUCCESS"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	if store.payments[paymentID].Status != paymentStatusPaid {
		t.Fatalf("expected payment status PAID, got %s", store.payments[paymentID].Status)
	}
	if len(commerce.syncRequests) != 1 || commerce.syncRequests[0].Status != paymentStatusPaid {
		t.Fatalf("unexpected sync requests: %#v", commerce.syncRequests)
	}
}

func TestPostPaymentsPaymentIdRecheckDoesNotTrustClientSuccessWhenProviderDisabled(t *testing.T) {
	gin.SetMode(gin.TestMode)

	paymentID := uuid.MustParse("11112222-3333-4444-5555-666677778888")
	store := newPaymentStoreStub()
	store.payments[paymentID] = paymentFixture(paymentID, paymentChannelWechat, paymentStatusPending)
	router := newTestRouter(&Handler{Store: store, ProviderMode: "disabled"})

	req := httptest.NewRequest(http.MethodPost, "/payments/"+paymentID.String()+"/recheck", strings.NewReader(`{"clientResult":"SUCCESS"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 with unchanged state, got %d: %s", rec.Code, rec.Body.String())
	}
	if store.payments[paymentID].Status != paymentStatusPending {
		t.Fatalf("disabled provider trusted client success: %#v", store.payments[paymentID])
	}
}

func TestWechatRecheckUsesSameOutTradeNoAsCreate(t *testing.T) {
	gin.SetMode(gin.TestMode)

	orderID := uuid.MustParse("12345678-1234-5678-90ab-1234567890ab")
	wechat := &wechatProviderStub{query: provider.WechatResolution{Status: paymentStatusPending}}
	handler := &Handler{ProviderMode: "wechat", Wechat: wechat}
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/payments/recheck", nil)

	_, err := handler.resolvePaymentFromClientResult(c, db.Payment{
		OrderID: orderID,
		Channel: paymentChannelWechat,
		Status:  paymentStatusPending,
	}, oapi.PaymentRecheckRequest{})
	if err != nil {
		t.Fatalf("resolve payment: %v", err)
	}
	if want := wechatOutTradeNo(orderID); wechat.queryOutTradeNo != want {
		t.Fatalf("wechat query outTradeNo = %q, want create value %q", wechat.queryOutTradeNo, want)
	}
}

func TestPostPaymentsWechatNotifyStoresWebhookAndMarksPaid(t *testing.T) {
	gin.SetMode(gin.TestMode)

	orderID := uuid.MustParse("20202020-2020-2020-2020-202020202020")
	paymentID := uuid.MustParse("30303030-3030-3030-3030-303030303030")
	store := newPaymentStoreStub()
	store.payments[paymentID] = db.Payment{
		ID:              paymentID,
		OrderID:         orderID,
		Channel:         paymentChannelWechat,
		Status:          paymentStatusPending,
		AmountFen:       3600,
		Currency:        "CNY",
		ProviderPayload: json.RawMessage(`{"orderId":"` + orderID.String() + `"}`),
		CreatedAt:       pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
		UpdatedAt:       pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
	}
	commerce := newCommerceServerStub(CommerceOrder{
		ID:            orderID.String(),
		Status:        "PAY_PENDING",
		PaymentStatus: "PAY_PENDING",
		Items:         []CommerceOrderItem{{Qty: 1, UnitPriceFen: 3600}},
	})
	defer commerce.Close()

	router := newTestRouter(&Handler{
		Flags:        StaticFlagsProvider{Flags: FeatureFlags{PaymentEnabled: true, WechatPayEnabled: true}},
		Store:        store,
		Commerce:     NewCommerceClient(commerce.URL(), "sync-token"),
		ProviderMode: "mock",
	})

	body := `{"paymentId":"` + paymentID.String() + `","status":"SUCCESS","providerTradeNo":"wx-trade-123","eventType":"payment.succeeded"}`
	req := httptest.NewRequest(http.MethodPost, "/payments/wechat/notify", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if len(store.webhooks) != 1 {
		t.Fatalf("expected one webhook, got %d", len(store.webhooks))
	}
	if store.payments[paymentID].Status != paymentStatusPaid {
		t.Fatalf("expected payment status PAID, got %s", store.payments[paymentID].Status)
	}
	if store.payments[paymentID].ProviderTradeNo == nil || *store.payments[paymentID].ProviderTradeNo != "wx-trade-123" {
		t.Fatalf("expected provider trade no to be updated, got %#v", store.payments[paymentID].ProviderTradeNo)
	}
	if len(commerce.syncRequests) != 1 || commerce.syncRequests[0].Status != paymentStatusPaid {
		t.Fatalf("unexpected sync requests: %#v", commerce.syncRequests)
	}
}

func TestPostPaymentsWechatNotifyRejectsMissingStatus(t *testing.T) {
	gin.SetMode(gin.TestMode)

	paymentID := uuid.MustParse("21212121-2121-2121-2121-212121212121")
	store := newPaymentStoreStub()
	store.payments[paymentID] = paymentFixture(paymentID, paymentChannelWechat, paymentStatusPending)
	router := newTestRouter(&Handler{
		Flags:        StaticFlagsProvider{Flags: FeatureFlags{PaymentEnabled: true, WechatPayEnabled: true}},
		Store:        store,
		ProviderMode: "mock",
	})

	req := httptest.NewRequest(http.MethodPost, "/payments/wechat/notify", strings.NewReader(`{"paymentId":"`+paymentID.String()+`"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
	if store.payments[paymentID].Status != paymentStatusPending || len(store.webhooks) != 0 {
		t.Fatalf("missing-status callback mutated state: payment=%#v webhooks=%#v", store.payments[paymentID], store.webhooks)
	}
}

func TestPostPaymentsWechatNotifyRejectsDisabledProvider(t *testing.T) {
	gin.SetMode(gin.TestMode)

	paymentID := uuid.MustParse("23232323-2323-2323-2323-232323232323")
	store := newPaymentStoreStub()
	store.payments[paymentID] = paymentFixture(paymentID, paymentChannelWechat, paymentStatusPending)
	router := newTestRouter(&Handler{
		Flags:        StaticFlagsProvider{Flags: FeatureFlags{PaymentEnabled: true, WechatPayEnabled: true}},
		Store:        store,
		ProviderMode: "disabled",
	})

	body := `{"paymentId":"` + paymentID.String() + `","status":"SUCCESS"}`
	req := httptest.NewRequest(http.MethodPost, "/payments/wechat/notify", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d: %s", rec.Code, rec.Body.String())
	}
	if store.payments[paymentID].Status != paymentStatusPending || len(store.webhooks) != 0 {
		t.Fatalf("disabled provider callback mutated state: payment=%#v webhooks=%#v", store.payments[paymentID], store.webhooks)
	}
}

func TestPostPaymentsWechatNotifyRealProviderPreservesRawBody(t *testing.T) {
	gin.SetMode(gin.TestMode)

	orderID := uuid.MustParse("40404040-4040-4040-4040-404040404040")
	paymentID := uuid.MustParse("50505050-5050-5050-5050-505050505050")
	store := newPaymentStoreStub()
	store.payments[paymentID] = db.Payment{
		ID: paymentID, OrderID: orderID, Channel: paymentChannelWechat, Status: paymentStatusPending,
		AmountFen: 1200, Currency: "CNY", ProviderPayload: json.RawMessage(`{}`),
		CreatedAt: pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
		UpdatedAt: pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
	}
	wechat := &wechatProviderStub{notify: provider.WechatResolution{
		OutTradeNo: "40404040404040404040404040404040", Status: paymentStatusPaid, ProviderTradeNo: "wx-real-trade", AmountFen: 1200,
	}}
	router := newTestRouter(&Handler{Store: store, ProviderMode: "wechat", Wechat: wechat})
	body := `{"id":"wechat-notification","resource":{"ciphertext":"encrypted"}}`
	req := httptest.NewRequest(http.MethodPost, "/payments/wechat/notify", strings.NewReader(body))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if wechat.notifyBody != body {
		t.Fatalf("provider received unexpected body: %q", wechat.notifyBody)
	}
	if len(store.webhooks) != 1 || string(store.webhooks[0].RawBody) != body {
		t.Fatalf("webhook raw body was not preserved: %#v", store.webhooks)
	}
	if store.payments[paymentID].Status != paymentStatusPaid {
		t.Fatalf("expected payment status PAID, got %s", store.payments[paymentID].Status)
	}
}

func TestApplyPaymentResolutionReloadsPaidStateAfterMonotonicUpdateConflict(t *testing.T) {
	gin.SetMode(gin.TestMode)

	paymentID := uuid.MustParse("51515151-5151-5151-5151-515151515151")
	store := newPaymentStoreStub()
	paid := paymentFixture(paymentID, paymentChannelWechat, paymentStatusPaid)
	paid.PaidAt = pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true}
	store.payments[paymentID] = paid
	stale := paid
	stale.Status = paymentStatusPending
	stale.PaidAt = pgtype.Timestamptz{}
	commerce := newCommerceServerStub(CommerceOrder{})
	defer commerce.Close()
	handler := &Handler{Store: store, Commerce: NewCommerceClient(commerce.URL(), "sync-token")}
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/payments/"+paymentID.String()+"/recheck", nil)

	updated, err := handler.applyPaymentResolution(c, stale, paymentStatusFailed, nil, strPtr("late failure"))
	if err != nil {
		t.Fatalf("expected monotonic conflict to reload current payment, got %v", err)
	}
	if updated.Status != paymentStatusPaid || store.payments[paymentID].Status != paymentStatusPaid {
		t.Fatalf("PAID payment was overwritten: updated=%#v stored=%#v", updated, store.payments[paymentID])
	}
	if len(commerce.syncRequests) != 1 || commerce.syncRequests[0].Status != paymentStatusPaid {
		t.Fatalf("expected current PAID state to be synchronized, got %#v", commerce.syncRequests)
	}
}

func TestApplyPaymentResolutionSameStateRetryRepairsCommerceSync(t *testing.T) {
	gin.SetMode(gin.TestMode)

	paymentID := uuid.MustParse("52525252-5252-5252-5252-525252525252")
	store := newPaymentStoreStub()
	payment := paymentFixture(paymentID, paymentChannelWechat, paymentStatusPending)
	store.payments[paymentID] = payment
	commerce := newCommerceServerStub(CommerceOrder{})
	commerce.syncFailuresRemaining = 1
	defer commerce.Close()
	handler := &Handler{Store: store, Commerce: NewCommerceClient(commerce.URL(), "sync-token")}
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/payments/"+paymentID.String()+"/recheck", nil)

	if _, err := handler.applyPaymentResolution(c, payment, paymentStatusPaid, nil, nil); err == nil {
		t.Fatal("expected first commerce synchronization to fail")
	}
	current := store.payments[paymentID]
	if current.Status != paymentStatusPaid {
		t.Fatalf("expected local payment state to be PAID after first attempt, got %s", current.Status)
	}
	if _, err := handler.applyPaymentResolution(c, current, paymentStatusPaid, nil, nil); err != nil {
		t.Fatalf("expected same-state retry to repair synchronization, got %v", err)
	}
	if len(commerce.syncRequests) != 2 || commerce.syncRequests[1].Status != paymentStatusPaid {
		t.Fatalf("expected two commerce sync attempts, got %#v", commerce.syncRequests)
	}
}

func TestPostPaymentsWechatCreateReloadsUniqueKeyRaceWinner(t *testing.T) {
	gin.SetMode(gin.TestMode)

	orderID := uuid.MustParse("53535353-5353-5353-5353-535353535353")
	paymentID := uuid.MustParse("54545454-5454-5454-5454-545454545454")
	existing := paymentFixture(paymentID, paymentChannelWechat, paymentStatusPending)
	existing.OrderID = orderID
	existing.IdempotencyKey = strPtr("idem-race")
	response := map[string]interface{}{
		"orderId": orderID.String(), "channel": paymentChannelWechat, "status": paymentStatusPending,
		"expiresAt": time.Now().UTC().Add(15 * time.Minute).Format(time.RFC3339), "prepayId": "race-prepay",
		"package": "prepay_id=race-prepay", "nonceStr": "nonce", "timeStamp": "1", "signType": "RSA", "paySign": "sign",
	}
	existing.ProviderPayload, _ = json.Marshal(response)
	store := &uniqueRacePaymentStore{paymentStoreStub: newPaymentStoreStub(), existing: existing}
	commerce := newCommerceServerStub(CommerceOrder{
		ID: orderID.String(), Status: "SUBMITTED", PaymentStatus: "UNPAID",
		Items: []CommerceOrderItem{{Qty: 1, UnitPriceFen: 500}},
	})
	defer commerce.Close()
	router := newTestRouter(&Handler{
		Flags:        StaticFlagsProvider{Flags: FeatureFlags{PaymentEnabled: true, WechatPayEnabled: true}},
		Store:        store,
		Commerce:     NewCommerceClient(commerce.URL(), "sync-token"),
		ProviderMode: "mock",
	})

	req := httptest.NewRequest(http.MethodPost, "/payments/wechat/create", strings.NewReader(`{"orderId":"`+orderID.String()+`"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotency-Key", "idem-race")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected race loser to return existing payment, got %d: %s", rec.Code, rec.Body.String())
	}
	var payload struct {
		PaymentID string `json:"paymentId"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.PaymentID != paymentID.String() || store.createCalls != 1 {
		t.Fatalf("unexpected race result: payload=%#v createCalls=%d", payload, store.createCalls)
	}
	if len(commerce.syncRequests) != 1 || commerce.syncRequests[0].PaymentID != paymentID.String() {
		t.Fatalf("expected race winner state to be synchronized, got %#v", commerce.syncRequests)
	}
}

type paymentStoreStub struct {
	mu          sync.Mutex
	createCalls int
	payments    map[uuid.UUID]db.Payment
	idempotency map[string]uuid.UUID
	webhooks    []db.PaymentWebhook
	audits      []db.PaymentAuditLog
}

func newPaymentStoreStub() *paymentStoreStub {
	return &paymentStoreStub{
		payments:    make(map[uuid.UUID]db.Payment),
		idempotency: make(map[string]uuid.UUID),
		webhooks:    []db.PaymentWebhook{},
		audits:      []db.PaymentAuditLog{},
	}
}

func (s *paymentStoreStub) CreatePayment(_ context.Context, arg db.CreatePaymentParams) (db.Payment, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.createCalls++
	id := uuid.New()
	now := time.Now().UTC()
	payment := db.Payment{
		ID:               id,
		OrderID:          arg.OrderID,
		PayerUserID:      arg.PayerUserID,
		Channel:          arg.Channel,
		Status:           arg.Status,
		AmountFen:        arg.AmountFen,
		Currency:         arg.Currency,
		IdempotencyKey:   arg.IdempotencyKey,
		ProviderTradeNo:  arg.ProviderTradeNo,
		ProviderPrepayID: arg.ProviderPrepayID,
		ProviderPayload:  arg.ProviderPayload,
		FailureCode:      arg.FailureCode,
		FailureMessage:   arg.FailureMessage,
		PaidAt:           arg.PaidAt,
		ClosedAt:         arg.ClosedAt,
		CreatedAt:        pgtype.Timestamptz{Time: now, Valid: true},
		UpdatedAt:        pgtype.Timestamptz{Time: now, Valid: true},
	}
	s.payments[id] = payment
	if arg.IdempotencyKey != nil {
		s.idempotency[keyForIdempotency(arg.OrderID, arg.Channel, *arg.IdempotencyKey)] = id
	}
	return payment, nil
}

func (s *paymentStoreStub) GetPayment(_ context.Context, id uuid.UUID) (db.Payment, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	payment, ok := s.payments[id]
	if !ok {
		return db.Payment{}, pgx.ErrNoRows
	}
	return payment, nil
}

func (s *paymentStoreStub) GetLatestPaymentByOrderChannel(_ context.Context, arg db.GetLatestPaymentByOrderChannelParams) (db.Payment, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var latest db.Payment
	found := false
	for _, payment := range s.payments {
		if payment.OrderID != arg.OrderID || payment.Channel != arg.Channel {
			continue
		}
		if !found || payment.CreatedAt.Time.After(latest.CreatedAt.Time) {
			latest = payment
			found = true
		}
	}
	if !found {
		return db.Payment{}, pgx.ErrNoRows
	}
	return latest, nil
}

func (s *paymentStoreStub) GetPaymentByIdempotencyKey(_ context.Context, arg db.GetPaymentByIdempotencyKeyParams) (db.Payment, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if arg.IdempotencyKey == nil {
		return db.Payment{}, pgx.ErrNoRows
	}
	paymentID, ok := s.idempotency[keyForIdempotency(arg.OrderID, arg.Channel, *arg.IdempotencyKey)]
	if !ok {
		return db.Payment{}, pgx.ErrNoRows
	}
	return s.payments[paymentID], nil
}

func (s *paymentStoreStub) UpdatePaymentState(_ context.Context, arg db.UpdatePaymentStateParams) (db.Payment, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	payment, ok := s.payments[arg.ID]
	if !ok {
		return db.Payment{}, pgx.ErrNoRows
	}
	if payment.Status == paymentStatusPaid && arg.Status != paymentStatusPaid {
		return db.Payment{}, pgx.ErrNoRows
	}
	payment.Status = arg.Status
	payment.ProviderTradeNo = arg.ProviderTradeNo
	payment.ProviderPrepayID = arg.ProviderPrepayID
	payment.ProviderPayload = arg.ProviderPayload
	payment.FailureCode = arg.FailureCode
	payment.FailureMessage = arg.FailureMessage
	payment.PaidAt = arg.PaidAt
	payment.ClosedAt = arg.ClosedAt
	payment.UpdatedAt = pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true}
	s.payments[arg.ID] = payment
	return payment, nil
}

func (s *paymentStoreStub) ListPayments(context.Context, db.ListPaymentsParams) ([]db.Payment, error) {
	return nil, nil
}

func (s *paymentStoreStub) CountPayments(context.Context, db.CountPaymentsParams) (int64, error) {
	return 0, nil
}

func (s *paymentStoreStub) CreatePaymentWebhook(_ context.Context, arg db.CreatePaymentWebhookParams) (db.PaymentWebhook, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	webhook := db.PaymentWebhook{
		ID:             uuid.New(),
		PaymentID:      arg.PaymentID,
		Provider:       arg.Provider,
		EventType:      arg.EventType,
		DeliveryStatus: arg.DeliveryStatus,
		RawBody:        arg.RawBody,
		ReplayCount:    0,
		ProcessedAt:    arg.ProcessedAt,
		CreatedAt:      pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
		UpdatedAt:      pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
	}
	s.webhooks = append(s.webhooks, webhook)
	return webhook, nil
}

func (s *paymentStoreStub) GetPaymentWebhook(context.Context, uuid.UUID) (db.PaymentWebhook, error) {
	return db.PaymentWebhook{}, errors.New("not implemented")
}

func (s *paymentStoreStub) ListPaymentWebhooks(context.Context, db.ListPaymentWebhooksParams) ([]db.PaymentWebhook, error) {
	return nil, nil
}

func (s *paymentStoreStub) CountPaymentWebhooks(context.Context, db.CountPaymentWebhooksParams) (int64, error) {
	return 0, nil
}

func (s *paymentStoreStub) ReplayPaymentWebhook(context.Context, db.ReplayPaymentWebhookParams) (db.PaymentWebhook, error) {
	return db.PaymentWebhook{}, errors.New("not implemented")
}

func (s *paymentStoreStub) CreatePaymentAuditLog(_ context.Context, arg db.CreatePaymentAuditLogParams) (db.PaymentAuditLog, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	audit := db.PaymentAuditLog{
		ID:        uuid.New(),
		PaymentID: arg.PaymentID,
		Action:    arg.Action,
		Actor:     arg.Actor,
		Detail:    arg.Detail,
		CreatedAt: pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true},
	}
	s.audits = append(s.audits, audit)
	return audit, nil
}

func (s *paymentStoreStub) ListPaymentAuditLogs(context.Context, db.ListPaymentAuditLogsParams) ([]db.PaymentAuditLog, error) {
	return nil, nil
}

func (s *paymentStoreStub) CountPaymentAuditLogs(context.Context, db.CountPaymentAuditLogsParams) (int64, error) {
	return 0, nil
}

type commerceServerStub struct {
	server                *httptest.Server
	order                 CommerceOrder
	getOrderStatus        int
	lastAuthorization     string
	syncToken             string
	syncRequests          []CommercePaymentSyncRequest
	syncFailuresRemaining int
}

func newCommerceServerStub(order CommerceOrder) *commerceServerStub {
	stub := &commerceServerStub{order: order, syncRequests: []CommercePaymentSyncRequest{}}
	stub.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && strings.HasPrefix(r.URL.Path, "/orders/"):
			stub.lastAuthorization = r.Header.Get("Authorization")
			if stub.getOrderStatus != 0 {
				http.Error(w, "order access denied", stub.getOrderStatus)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(stub.order)
		case r.Method == http.MethodPost && strings.HasPrefix(r.URL.Path, "/internal/orders/") && strings.HasSuffix(r.URL.Path, "/payment-status"):
			stub.syncToken = r.Header.Get("X-Internal-Token")
			var payload CommercePaymentSyncRequest
			_ = json.NewDecoder(r.Body).Decode(&payload)
			stub.syncRequests = append(stub.syncRequests, payload)
			if stub.syncFailuresRemaining > 0 {
				stub.syncFailuresRemaining--
				http.Error(w, "temporary sync failure", http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusOK)
		default:
			http.NotFound(w, r)
		}
	}))
	return stub
}

type uniqueRacePaymentStore struct {
	*paymentStoreStub
	existing    db.Payment
	lookupCalls int
}

func (s *uniqueRacePaymentStore) GetPaymentByIdempotencyKey(context.Context, db.GetPaymentByIdempotencyKeyParams) (db.Payment, error) {
	s.lookupCalls++
	if s.lookupCalls == 1 {
		return db.Payment{}, pgx.ErrNoRows
	}
	return s.existing, nil
}

func (s *uniqueRacePaymentStore) CreatePayment(context.Context, db.CreatePaymentParams) (db.Payment, error) {
	s.createCalls++
	return db.Payment{}, &pgconn.PgError{Code: "23505", ConstraintName: "payments_order_channel_idempotency_idx"}
}

func paymentFixture(id uuid.UUID, channel, status string) db.Payment {
	now := time.Now().UTC()
	return db.Payment{
		ID: id, OrderID: uuid.New(), Channel: channel, Status: status, AmountFen: 500, Currency: "CNY",
		ProviderPayload: json.RawMessage(`{}`),
		CreatedAt:       pgtype.Timestamptz{Time: now, Valid: true},
		UpdatedAt:       pgtype.Timestamptz{Time: now, Valid: true},
	}
}

func (s *commerceServerStub) Close() {
	s.server.Close()
}

func (s *commerceServerStub) URL() string {
	return s.server.URL
}

func keyForIdempotency(orderID uuid.UUID, channel, idempotencyKey string) string {
	return orderID.String() + "|" + channel + "|" + strings.TrimSpace(idempotencyKey)
}

func strPtr(value string) *string {
	return &value
}

func newTestRouter(handler *Handler) *gin.Engine {
	router := gin.New()
	oapi.RegisterHandlers(router, handler)
	router.GET("/admin/payments/transactions", handler.GetAdminPaymentsTransactions)
	router.GET("/admin/payments/transactions/:id", handler.GetAdminPaymentsTransactionsId)
	router.GET("/admin/payments/audit-logs", handler.GetAdminPaymentsAuditLogs)
	router.GET("/admin/payments/webhooks", handler.GetAdminPaymentsWebhooks)
	router.POST("/admin/payments/webhooks/:id/replay", handler.PostAdminPaymentsWebhooksIdReplay)
	return router
}
