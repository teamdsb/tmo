package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/teamdsb/tmo/services/payment/internal/db"
	"github.com/teamdsb/tmo/services/payment/internal/http/middleware"
)

const (
	adminTestJWTSecret = "payment-admin-test-secret"
	adminTestJWTIssuer = "payment-admin-test-issuer"
)

func TestAdminPaymentHandlersEnforceRoleAuthorization(t *testing.T) {
	gin.SetMode(gin.TestMode)

	type endpoint struct {
		name   string
		method string
		path   func(*adminPaymentStoreStub) string
	}
	endpoints := []endpoint{
		{name: "transactions", method: http.MethodGet, path: func(_ *adminPaymentStoreStub) string { return "/admin/payments/transactions" }},
		{name: "transaction detail", method: http.MethodGet, path: func(store *adminPaymentStoreStub) string {
			return "/admin/payments/transactions/" + store.payment.ID.String()
		}},
		{name: "audit logs", method: http.MethodGet, path: func(_ *adminPaymentStoreStub) string { return "/admin/payments/audit-logs" }},
		{name: "webhooks", method: http.MethodGet, path: func(_ *adminPaymentStoreStub) string { return "/admin/payments/webhooks" }},
		{name: "webhook replay", method: http.MethodPost, path: func(store *adminPaymentStoreStub) string {
			return "/admin/payments/webhooks/" + store.webhook.ID.String() + "/replay"
		}},
	}

	for _, role := range []string{"CUSTOMER", "SALES", "CS", "MANAGER", "BOSS", "ADMIN"} {
		role := role
		for _, endpoint := range endpoints {
			endpoint := endpoint
			t.Run(role+"/"+endpoint.name, func(t *testing.T) {
				store := newAdminPaymentStoreStub()
				handler := &Handler{
					Auth:  middleware.NewAuthenticator(true, adminTestJWTSecret, adminTestJWTIssuer),
					Store: store,
				}
				router := newTestRouter(handler)

				req := httptest.NewRequest(endpoint.method, endpoint.path(store), nil)
				req.Header.Set("Authorization", "Bearer "+signedAdminTestToken(t, role))
				rec := httptest.NewRecorder()
				router.ServeHTTP(rec, req)

				if role != "ADMIN" && role != "BOSS" {
					if rec.Code != http.StatusForbidden {
						t.Fatalf("expected role %s to receive 403, got %d: %s", role, rec.Code, rec.Body.String())
					}
					return
				}
				if rec.Code != http.StatusOK {
					t.Fatalf("expected role %s to be accepted, got %d: %s", role, rec.Code, rec.Body.String())
				}
			})
		}
	}
}

func signedAdminTestToken(t *testing.T, role string) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":  "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
		"role": role,
		"iss":  adminTestJWTIssuer,
		"exp":  time.Now().Add(time.Hour).Unix(),
	})
	signed, err := token.SignedString([]byte(adminTestJWTSecret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return signed
}

func TestAdminPaymentsTransactionsList(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	store := newAdminPaymentStoreStub()
	router.GET("/admin/payments/transactions", (&Handler{Store: store}).GetAdminPaymentsTransactions)

	req := httptest.NewRequest(http.MethodGet, "/admin/payments/transactions?page=1&pageSize=10", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		Items []map[string]interface{} `json:"items"`
		Total int                      `json:"total"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.Total != 1 || len(payload.Items) != 1 {
		t.Fatalf("expected one transaction, got total=%d items=%d", payload.Total, len(payload.Items))
	}
}

func TestAdminPaymentsWebhookReplay(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	store := newAdminPaymentStoreStub()
	router.POST("/admin/payments/webhooks/:id/replay", (&Handler{Store: store}).PostAdminPaymentsWebhooksIdReplay)

	req := httptest.NewRequest(http.MethodPost, "/admin/payments/webhooks/"+store.webhook.ID.String()+"/replay", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	var payload struct {
		ID          string `json:"id"`
		ReplayCount int    `json:"replayCount"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode replay response: %v", err)
	}
	if payload.ID != store.webhook.ID.String() || payload.ReplayCount != 1 {
		t.Fatalf("unexpected replay response: %#v", payload)
	}
}

type adminPaymentStoreStub struct {
	payment db.Payment
	webhook db.PaymentWebhook
}

func newAdminPaymentStoreStub() *adminPaymentStoreStub {
	now := time.Now().UTC()
	paymentID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	orderID := uuid.MustParse("22222222-2222-2222-2222-222222222222")
	webhookID := uuid.MustParse("33333333-3333-3333-3333-333333333333")
	userID := uuid.MustParse("44444444-4444-4444-4444-444444444444")

	return &adminPaymentStoreStub{
		payment: db.Payment{
			ID:          paymentID,
			OrderID:     orderID,
			PayerUserID: pgtype.UUID{Bytes: userID, Valid: true},
			Channel:     "WECHAT",
			Status:      paymentStatusPending,
			AmountFen:   18800,
			Currency:    "CNY",
			CreatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
			UpdatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
		},
		webhook: db.PaymentWebhook{
			ID:             webhookID,
			PaymentID:      pgtype.UUID{Bytes: paymentID, Valid: true},
			Provider:       "wechat",
			EventType:      "payment.succeeded",
			DeliveryStatus: "PENDING",
			ReplayCount:    0,
			CreatedAt:      pgtype.Timestamptz{Time: now, Valid: true},
			UpdatedAt:      pgtype.Timestamptz{Time: now, Valid: true},
		},
	}
}

func (s *adminPaymentStoreStub) CreatePayment(context.Context, db.CreatePaymentParams) (db.Payment, error) {
	return db.Payment{}, errors.New("not implemented")
}

func (s *adminPaymentStoreStub) GetPayment(_ context.Context, id uuid.UUID) (db.Payment, error) {
	if id != s.payment.ID {
		return db.Payment{}, errors.New("not found")
	}
	return s.payment, nil
}

func (s *adminPaymentStoreStub) GetPaymentByIdempotencyKey(context.Context, db.GetPaymentByIdempotencyKeyParams) (db.Payment, error) {
	return db.Payment{}, errors.New("not found")
}

func (s *adminPaymentStoreStub) UpdatePaymentState(context.Context, db.UpdatePaymentStateParams) (db.Payment, error) {
	return db.Payment{}, errors.New("not implemented")
}

func (s *adminPaymentStoreStub) ListPayments(context.Context, db.ListPaymentsParams) ([]db.Payment, error) {
	return []db.Payment{s.payment}, nil
}

func (s *adminPaymentStoreStub) CountPayments(context.Context, db.CountPaymentsParams) (int64, error) {
	return 1, nil
}

func (s *adminPaymentStoreStub) CreatePaymentWebhook(context.Context, db.CreatePaymentWebhookParams) (db.PaymentWebhook, error) {
	return db.PaymentWebhook{}, errors.New("not implemented")
}

func (s *adminPaymentStoreStub) GetPaymentWebhook(_ context.Context, id uuid.UUID) (db.PaymentWebhook, error) {
	if id != s.webhook.ID {
		return db.PaymentWebhook{}, errors.New("not found")
	}
	return s.webhook, nil
}

func (s *adminPaymentStoreStub) ListPaymentWebhooks(context.Context, db.ListPaymentWebhooksParams) ([]db.PaymentWebhook, error) {
	return []db.PaymentWebhook{s.webhook}, nil
}

func (s *adminPaymentStoreStub) CountPaymentWebhooks(context.Context, db.CountPaymentWebhooksParams) (int64, error) {
	return 1, nil
}

func (s *adminPaymentStoreStub) ReplayPaymentWebhook(_ context.Context, arg db.ReplayPaymentWebhookParams) (db.PaymentWebhook, error) {
	if arg.ID != s.webhook.ID {
		return db.PaymentWebhook{}, errors.New("not found")
	}
	s.webhook.ReplayCount++
	s.webhook.DeliveryStatus = arg.DeliveryStatus
	s.webhook.ProcessedAt = arg.ProcessedAt
	return s.webhook, nil
}

func (s *adminPaymentStoreStub) CreatePaymentAuditLog(context.Context, db.CreatePaymentAuditLogParams) (db.PaymentAuditLog, error) {
	return db.PaymentAuditLog{}, nil
}

func (s *adminPaymentStoreStub) ListPaymentAuditLogs(context.Context, db.ListPaymentAuditLogsParams) ([]db.PaymentAuditLog, error) {
	return nil, nil
}

func (s *adminPaymentStoreStub) CountPaymentAuditLogs(context.Context, db.CountPaymentAuditLogsParams) (int64, error) {
	return 0, nil
}
