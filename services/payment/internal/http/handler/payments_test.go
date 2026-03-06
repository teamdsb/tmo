package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/teamdsb/tmo/services/payment/internal/db"
	"github.com/teamdsb/tmo/services/payment/internal/http/oapi"
)

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
		Status:        "SUBMITTED",
		PaymentStatus: "UNPAID",
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
		Status:          paymentStatusPending,
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
	if len(commerce.syncRequests) != 0 {
		t.Fatalf("expected no extra sync request for idempotent replay, got %d", len(commerce.syncRequests))
	}
}

func TestPostPaymentsAlipayCreateReturnsTradeNo(t *testing.T) {
	gin.SetMode(gin.TestMode)

	orderID := uuid.MustParse("dddddddd-dddd-dddd-dddd-dddddddddddd")
	store := newPaymentStoreStub()
	commerce := newCommerceServerStub(CommerceOrder{
		ID:            orderID.String(),
		Status:        "SUBMITTED",
		PaymentStatus: "UNPAID",
		Items:         []CommerceOrderItem{{Qty: 3, UnitPriceFen: 888}},
	})
	defer commerce.Close()

	router := newTestRouter(&Handler{
		Flags:        StaticFlagsProvider{Flags: FeatureFlags{PaymentEnabled: true, WechatPayEnabled: true, AlipayPayEnabled: true}},
		Store:        store,
		Commerce:     NewCommerceClient(commerce.URL(), "sync-token"),
		ProviderMode: "mock",
	})

	req := httptest.NewRequest(http.MethodPost, "/payments/alipay/create", strings.NewReader(`{"orderId":"`+orderID.String()+`"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var response struct {
		PaymentID string                 `json:"paymentId"`
		TradeNo   string                 `json:"tradeNo"`
		PayParams map[string]interface{} `json:"payParams"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.PaymentID == "" || response.TradeNo == "" {
		t.Fatalf("unexpected response: %#v", response)
	}
	if got := response.PayParams["tradeNO"]; got != response.TradeNo {
		t.Fatalf("expected tradeNO pay param, got %#v", response.PayParams)
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
	server            *httptest.Server
	order             CommerceOrder
	lastAuthorization string
	syncToken         string
	syncRequests      []CommercePaymentSyncRequest
}

func newCommerceServerStub(order CommerceOrder) *commerceServerStub {
	stub := &commerceServerStub{order: order, syncRequests: []CommercePaymentSyncRequest{}}
	stub.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && strings.HasPrefix(r.URL.Path, "/orders/"):
			stub.lastAuthorization = r.Header.Get("Authorization")
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(stub.order)
		case r.Method == http.MethodPost && strings.HasPrefix(r.URL.Path, "/internal/orders/") && strings.HasSuffix(r.URL.Path, "/payment-status"):
			stub.syncToken = r.Header.Get("X-Internal-Token")
			var payload CommercePaymentSyncRequest
			_ = json.NewDecoder(r.Body).Decode(&payload)
			stub.syncRequests = append(stub.syncRequests, payload)
			w.WriteHeader(http.StatusOK)
		default:
			http.NotFound(w, r)
		}
	}))
	return stub
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
